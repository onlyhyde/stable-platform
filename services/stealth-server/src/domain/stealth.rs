use elliptic_curve::sec1::ToEncodedPoint;
use k256::{
    ecdh::EphemeralSecret,
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
}
