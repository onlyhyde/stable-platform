use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::stealth::verify_registration_signature;

/// Stealth meta-address as defined in EIP-5564
/// Format: st:<chain>:0x<spendingPubKey><viewingPubKey>
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthMetaAddress {
    /// Chain identifier (e.g., "eth", "arb")
    pub chain: String,
    /// Spending public key (compressed, 33 bytes)
    pub spending_pub_key: String,
    /// Viewing public key (compressed, 33 bytes)
    pub viewing_pub_key: String,
}

#[derive(Debug, Error)]
pub enum RegistryError {
    #[error("Invalid meta-address format: {0}")]
    InvalidFormat(String),
    #[error("Invalid prefix: expected 'st:', got '{0}'")]
    InvalidPrefix(String),
    #[error("Invalid key length: expected 66 chars (33 bytes), got {0}")]
    InvalidKeyLength(usize),
    #[error("Hex decode error: {0}")]
    HexError(#[from] hex::FromHexError),
    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),
}

impl StealthMetaAddress {
    /// Parse a stealth meta-address URI
    /// Format: st:<chain>:0x<spendingPubKey><viewingPubKey>
    /// Example: st:eth:0x02abc...02def...
    pub fn parse(uri: &str) -> Result<Self, RegistryError> {
        let parts: Vec<&str> = uri.split(':').collect();
        if parts.len() != 3 {
            return Err(RegistryError::InvalidFormat(format!(
                "Expected 3 parts separated by ':', got {}",
                parts.len()
            )));
        }

        if parts[0] != "st" {
            return Err(RegistryError::InvalidPrefix(parts[0].to_string()));
        }

        let chain = parts[1].to_string();
        let keys = parts[2].strip_prefix("0x").unwrap_or(parts[2]);

        // Each compressed public key is 33 bytes = 66 hex chars
        // Total should be 132 hex chars
        if keys.len() != 132 {
            return Err(RegistryError::InvalidFormat(format!(
                "Expected 132 hex chars for keys, got {}",
                keys.len()
            )));
        }

        // Validate hex
        hex::decode(keys)?;

        let spending_pub_key = format!("0x{}", &keys[0..66]);
        let viewing_pub_key = format!("0x{}", &keys[66..132]);

        Ok(StealthMetaAddress {
            chain,
            spending_pub_key,
            viewing_pub_key,
        })
    }

    /// Encode to stealth meta-address URI format
    pub fn to_uri(&self) -> String {
        let spending = self.spending_pub_key.strip_prefix("0x").unwrap_or(&self.spending_pub_key);
        let viewing = self.viewing_pub_key.strip_prefix("0x").unwrap_or(&self.viewing_pub_key);
        format!("st:{}:0x{}{}", self.chain, spending, viewing)
    }
}

/// Registration entry stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Registration {
    /// Registrant's address
    pub address: String,
    /// Scheme ID
    pub scheme_id: u64,
    /// Stealth meta-address
    pub stealth_meta_address: StealthMetaAddress,
    /// Signature proving ownership
    pub signature: String,
    /// Registration timestamp
    pub registered_at: chrono::DateTime<chrono::Utc>,
}

impl Registration {
    /// Verify the registration signature using ecrecover
    /// The message to sign is: "Register stealth meta-address: <uri>"
    pub fn verify_signature(&self) -> Result<bool, RegistryError> {
        let meta_address_uri = self.stealth_meta_address.to_uri();

        verify_registration_signature(&self.address, &meta_address_uri, &self.signature)
            .map(|_| true)
            .map_err(|e| RegistryError::SignatureVerificationFailed(e.to_string()))
    }

    /// Generate the message that should be signed for registration
    pub fn signing_message(meta_address_uri: &str) -> String {
        format!("Register stealth meta-address: {}", meta_address_uri)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_meta_address() {
        let spending = "02".to_string() + &"ab".repeat(32);
        let viewing = "03".to_string() + &"cd".repeat(32);
        let uri = format!("st:eth:0x{}{}", spending, viewing);

        let meta = StealthMetaAddress::parse(&uri).unwrap();
        assert_eq!(meta.chain, "eth");
        assert_eq!(meta.spending_pub_key, format!("0x{}", spending));
        assert_eq!(meta.viewing_pub_key, format!("0x{}", viewing));
    }

    #[test]
    fn test_meta_address_roundtrip() {
        let spending = "02".to_string() + &"ab".repeat(32);
        let viewing = "03".to_string() + &"cd".repeat(32);
        let uri = format!("st:eth:0x{}{}", spending, viewing);

        let meta = StealthMetaAddress::parse(&uri).unwrap();
        let encoded = meta.to_uri();
        assert_eq!(uri, encoded);
    }

    #[test]
    fn test_invalid_prefix() {
        let result = StealthMetaAddress::parse("xx:eth:0x1234");
        assert!(matches!(result, Err(RegistryError::InvalidPrefix(_))));
    }

    #[test]
    fn test_signing_message() {
        let uri = "st:eth:0x1234";
        let msg = Registration::signing_message(uri);
        assert_eq!(msg, "Register stealth meta-address: st:eth:0x1234");
    }
}
