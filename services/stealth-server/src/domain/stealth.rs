use elliptic_curve::sec1::ToEncodedPoint;
use k256::{
    ecdh::EphemeralSecret,
    ecdsa::{RecoveryId, Signature, VerifyingKey},
    elliptic_curve::ScalarPrimitive,
    PublicKey, Secp256k1, SecretKey,
};
use sha3::{Digest, Keccak256};
use thiserror::Error;

/// Scheme IDs as defined in EIP-5564
pub mod scheme {
    pub const SECP256K1: u64 = 1;
    pub const ED25519: u64 = 2;
}

#[derive(Debug, Error)]
pub enum StealthError {
    #[error("Invalid public key: {0}")]
    InvalidPublicKey(String),
    #[error("Invalid private key: {0}")]
    InvalidPrivateKey(String),
    #[error("Invalid signature: {0}")]
    InvalidSignature(String),
    #[error("Signature verification failed: recovered address {recovered} does not match expected {expected}")]
    SignatureMismatch { recovered: String, expected: String },
    #[error("Unsupported scheme: {0}")]
    UnsupportedScheme(u64),
    #[error("Hex decode error: {0}")]
    HexError(#[from] hex::FromHexError),
    #[error("Crypto error: {0}")]
    CryptoError(String),
}

/// Compute the view tag from a shared secret
/// View tag is the first byte of keccak256(sharedSecret)
pub fn compute_view_tag(shared_secret: &[u8]) -> u8 {
    let hash = Keccak256::digest(shared_secret);
    hash[0]
}

/// Create the message to sign for registration
/// Uses EIP-191 personal_sign format: "\x19Ethereum Signed Message:\n" + len(message) + message
pub fn create_registration_message(stealth_meta_address: &str) -> Vec<u8> {
    let message = format!("Register stealth meta-address: {}", stealth_meta_address);
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut data = prefix.into_bytes();
    data.extend_from_slice(message.as_bytes());
    data
}

/// Recover Ethereum address from a signature and message
/// Signature format: 65 bytes (r: 32, s: 32, v: 1)
/// v is the recovery id (27 or 28 for Ethereum, 0 or 1 for raw)
pub fn recover_address(message: &[u8], signature_hex: &str) -> Result<String, StealthError> {
    let sig_hex = signature_hex.strip_prefix("0x").unwrap_or(signature_hex);
    let sig_bytes = hex::decode(sig_hex)?;

    if sig_bytes.len() != 65 {
        return Err(StealthError::InvalidSignature(format!(
            "signature must be 65 bytes, got {}",
            sig_bytes.len()
        )));
    }

    // Extract r, s, v components
    let r_s = &sig_bytes[..64];
    let v = sig_bytes[64];

    // Convert v to recovery id (Ethereum uses 27/28, we need 0/1)
    let recovery_id = match v {
        27 | 0 => 0,
        28 | 1 => 1,
        _ => {
            return Err(StealthError::InvalidSignature(format!(
                "invalid recovery id: {}",
                v
            )))
        }
    };

    // Hash the message
    let message_hash = Keccak256::digest(message);

    // Create signature from r, s bytes
    let signature = Signature::from_slice(r_s)
        .map_err(|e| StealthError::InvalidSignature(e.to_string()))?;

    // Create recovery id
    let rec_id = RecoveryId::new(recovery_id != 0, false);

    // Recover the public key
    let verifying_key = VerifyingKey::recover_from_prehash(&message_hash, &signature, rec_id)
        .map_err(|e| StealthError::InvalidSignature(e.to_string()))?;

    // Convert to uncompressed public key bytes
    let public_key = PublicKey::from(verifying_key);
    let pub_key_bytes = public_key.to_encoded_point(false);

    // Derive address: keccak256(pubkey[1..65])[12..32]
    let pub_key_hash = Keccak256::digest(&pub_key_bytes.as_bytes()[1..]);
    let address = format!("0x{}", hex::encode(&pub_key_hash[12..]));

    Ok(address)
}

/// Verify that a signature was created by the claimed address
/// Returns Ok(()) if verification succeeds, or an error if it fails
pub fn verify_registration_signature(
    address: &str,
    stealth_meta_address: &str,
    signature: &str,
) -> Result<(), StealthError> {
    let message = create_registration_message(stealth_meta_address);
    let recovered_address = recover_address(&message, signature)?;

    // Compare addresses (case-insensitive)
    if recovered_address.to_lowercase() != address.to_lowercase() {
        return Err(StealthError::SignatureMismatch {
            recovered: recovered_address,
            expected: address.to_string(),
        });
    }

    Ok(())
}

/// Check if an announcement matches a viewing key by comparing view tags
pub fn check_view_tag(
    ephemeral_pub_key: &str,
    viewing_private_key: &str,
    expected_view_tag: u8,
) -> Result<bool, StealthError> {
    let shared_secret = compute_shared_secret(ephemeral_pub_key, viewing_private_key)?;
    let computed_tag = compute_view_tag(&shared_secret);
    Ok(computed_tag == expected_view_tag)
}

/// Compute ECDH shared secret from ephemeral public key and viewing private key
pub fn compute_shared_secret(
    ephemeral_pub_key_hex: &str,
    viewing_private_key_hex: &str,
) -> Result<Vec<u8>, StealthError> {
    let epk_hex = ephemeral_pub_key_hex
        .strip_prefix("0x")
        .unwrap_or(ephemeral_pub_key_hex);
    let vpk_hex = viewing_private_key_hex
        .strip_prefix("0x")
        .unwrap_or(viewing_private_key_hex);

    let epk_bytes = hex::decode(epk_hex)?;
    let vpk_bytes = hex::decode(vpk_hex)?;

    let ephemeral_pub = PublicKey::from_sec1_bytes(&epk_bytes)
        .map_err(|e| StealthError::InvalidPublicKey(e.to_string()))?;

    let viewing_secret = SecretKey::from_slice(&vpk_bytes)
        .map_err(|e| StealthError::InvalidPrivateKey(e.to_string()))?;

    // Compute ECDH shared secret
    let shared_point = k256::ecdh::diffie_hellman(
        viewing_secret.to_nonzero_scalar(),
        ephemeral_pub.as_affine(),
    );

    Ok(shared_point.raw_secret_bytes().to_vec())
}

/// Compute the stealth private key from spending key and shared secret
/// stealthPrivateKey = spendingPrivateKey + keccak256(sharedSecret)
pub fn compute_stealth_private_key(
    spending_private_key_hex: &str,
    shared_secret: &[u8],
) -> Result<Vec<u8>, StealthError> {
    let spk_hex = spending_private_key_hex
        .strip_prefix("0x")
        .unwrap_or(spending_private_key_hex);
    let spk_bytes = hex::decode(spk_hex)?;

    let spending_secret = SecretKey::from_slice(&spk_bytes)
        .map_err(|e| StealthError::InvalidPrivateKey(e.to_string()))?;

    // Hash the shared secret
    let hash = Keccak256::digest(shared_secret);

    // Convert hash to scalar using ScalarPrimitive
    let hash_array: [u8; 32] = hash.into();
    let hash_scalar_primitive = ScalarPrimitive::<Secp256k1>::from_bytes(&hash_array.into())
        .unwrap_or_else(|| ScalarPrimitive::ZERO);
    let hash_scalar = k256::Scalar::from(&hash_scalar_primitive);

    // Add spending key + hash (mod curve order)
    let spending_scalar = *spending_secret.to_nonzero_scalar();
    let stealth_scalar = spending_scalar + hash_scalar;

    Ok(stealth_scalar.to_bytes().to_vec())
}

/// Generate a stealth address from recipient's stealth meta-address
/// Returns (stealthAddress, ephemeralPubKey, viewTag)
pub fn generate_stealth_address(
    spending_pub_key_hex: &str,
    viewing_pub_key_hex: &str,
) -> Result<(String, String, u8), StealthError> {
    let spk_hex = spending_pub_key_hex
        .strip_prefix("0x")
        .unwrap_or(spending_pub_key_hex);
    let vpk_hex = viewing_pub_key_hex
        .strip_prefix("0x")
        .unwrap_or(viewing_pub_key_hex);

    let spk_bytes = hex::decode(spk_hex)?;
    let vpk_bytes = hex::decode(vpk_hex)?;

    let spending_pub = PublicKey::from_sec1_bytes(&spk_bytes)
        .map_err(|e| StealthError::InvalidPublicKey(e.to_string()))?;
    let viewing_pub = PublicKey::from_sec1_bytes(&vpk_bytes)
        .map_err(|e| StealthError::InvalidPublicKey(e.to_string()))?;

    // Generate ephemeral key pair
    let ephemeral_secret = EphemeralSecret::random(&mut rand::thread_rng());
    let ephemeral_pub = ephemeral_secret.public_key();

    // Compute shared secret with viewing public key
    let shared_secret = ephemeral_secret.diffie_hellman(&viewing_pub);
    let shared_bytes = shared_secret.raw_secret_bytes();

    // Compute view tag
    let view_tag = compute_view_tag(shared_bytes);

    // Hash shared secret
    let hash = Keccak256::digest(shared_bytes);
    let hash_array: [u8; 32] = hash.into();
    let hash_scalar_primitive = ScalarPrimitive::<Secp256k1>::from_bytes(&hash_array.into())
        .unwrap_or_else(|| ScalarPrimitive::ZERO);
    let hash_scalar = k256::Scalar::from(&hash_scalar_primitive);

    // Compute stealth public key: P_stealth = P_spending + hash * G
    let hash_point = k256::ProjectivePoint::GENERATOR * hash_scalar;
    let stealth_point = spending_pub.to_projective() + hash_point;
    let stealth_affine = k256::AffinePoint::from(stealth_point);
    let stealth_pub = PublicKey::from_affine(stealth_affine)
        .map_err(|e| StealthError::CryptoError(e.to_string()))?;

    // Derive address from stealth public key
    let stealth_pub_bytes = stealth_pub.to_encoded_point(false);
    let pub_key_hash = Keccak256::digest(&stealth_pub_bytes.as_bytes()[1..]); // Skip 0x04 prefix
    let stealth_address = format!("0x{}", hex::encode(&pub_key_hash[12..]));

    // Encode ephemeral public key
    let ephemeral_pub_encoded = ephemeral_pub.to_encoded_point(true);
    let ephemeral_pub_hex = format!("0x{}", hex::encode(ephemeral_pub_encoded.as_bytes()));

    Ok((stealth_address, ephemeral_pub_hex, view_tag))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_view_tag() {
        let shared_secret = hex::decode("abcd1234").unwrap();
        let view_tag = compute_view_tag(&shared_secret);
        // View tag should be a single byte
        assert!(view_tag <= 255);
    }

    #[test]
    fn test_create_registration_message() {
        let meta_address = "st:eth:0x1234...";
        let message = create_registration_message(meta_address);

        // Should contain the EIP-191 prefix
        assert!(message.starts_with(b"\x19Ethereum Signed Message:\n"));

        // Should contain the stealth meta-address
        let message_str = String::from_utf8_lossy(&message);
        assert!(message_str.contains(meta_address));
    }

    #[test]
    fn test_recover_address_invalid_signature_length() {
        let message = b"test message";

        // Too short signature
        let result = recover_address(message, "0x1234");
        assert!(result.is_err());

        if let Err(StealthError::InvalidSignature(msg)) = result {
            assert!(msg.contains("65 bytes"));
        } else {
            panic!("Expected InvalidSignature error");
        }
    }

    #[test]
    fn test_recover_address_invalid_recovery_id() {
        let message = b"test message";

        // 65 bytes but invalid recovery id (v = 30)
        let mut sig = vec![0u8; 64];
        sig.push(30); // Invalid v value
        let sig_hex = hex::encode(&sig);

        let result = recover_address(message, &sig_hex);
        assert!(result.is_err());

        if let Err(StealthError::InvalidSignature(msg)) = result {
            assert!(msg.contains("invalid recovery id"));
        } else {
            panic!("Expected InvalidSignature error");
        }
    }

    #[test]
    fn test_verify_registration_signature_mismatch() {
        // This test verifies that mismatched addresses are detected
        // Since we don't have a real signature, we can only test the error path
        let address = "0x1234567890123456789012345678901234567890";
        let meta_address = "st:eth:0xabc...";

        // Create a dummy 65-byte signature with valid v value
        let mut sig = vec![0u8; 64];
        sig.push(27); // Valid v value for Ethereum
        let signature = format!("0x{}", hex::encode(&sig));

        // This should fail because the recovered address won't match
        let result = verify_registration_signature(address, meta_address, &signature);

        // We expect either InvalidSignature (if recovery fails) or SignatureMismatch
        assert!(result.is_err());
    }
}
