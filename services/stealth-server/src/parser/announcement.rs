use alloy_primitives::{Address, U256};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::subscriber::LogEvent;

/// EIP-5564 Announcement event
/// event Announcement(
///     uint256 indexed schemeId,
///     address indexed stealthAddress,
///     address indexed caller,
///     bytes ephemeralPubKey,
///     bytes metadata
/// )
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Announcement {
    /// Scheme ID (1 = secp256k1, 2 = ed25519, etc.)
    pub scheme_id: u64,
    /// Generated stealth address
    pub stealth_address: String,
    /// Address that called the announcer
    pub caller: String,
    /// Ephemeral public key used to derive the stealth address
    pub ephemeral_pub_key: String,
    /// Additional metadata (may contain view tag)
    pub metadata: String,
    /// Extracted view tag (first byte of metadata if present)
    pub view_tag: Option<u8>,
    /// Block number where this announcement was made
    pub block_number: u64,
    /// Transaction hash
    pub transaction_hash: String,
    /// Log index within the transaction
    pub log_index: u32,
}

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("Invalid topic count: expected 4, got {0}")]
    InvalidTopicCount(usize),
    #[error("Failed to parse topic: {0}")]
    InvalidTopic(String),
    #[error("Failed to decode data: {0}")]
    InvalidData(String),
    #[error("Hex decode error: {0}")]
    HexError(#[from] hex::FromHexError),
}

/// Parser for Announcement events
pub struct AnnouncementParser;

impl AnnouncementParser {
    /// Announcement event signature: keccak256("Announcement(uint256,address,address,bytes,bytes)")
    pub const EVENT_SIGNATURE: &'static str =
        "0x5f0eab0a76a3dafb20eb8e3a71c9f28235b81829d63f9e47b2754f4c605209e6";

    /// Parse a LogEvent into an Announcement
    pub fn parse(log: &LogEvent) -> Result<Announcement, ParseError> {
        // Verify topic count (event signature + 3 indexed params)
        if log.topics.len() != 4 {
            return Err(ParseError::InvalidTopicCount(log.topics.len()));
        }

        // Topic[0] = event signature (already verified by filter)
        // Topic[1] = schemeId (uint256 indexed)
        // Topic[2] = stealthAddress (address indexed)
        // Topic[3] = caller (address indexed)

        let scheme_id = Self::parse_uint256(&log.topics[1])?;
        let stealth_address = Self::parse_address(&log.topics[2])?;
        let caller = Self::parse_address(&log.topics[3])?;

        // Decode non-indexed data: ephemeralPubKey (bytes) and metadata (bytes)
        let (ephemeral_pub_key, metadata) = Self::parse_data(&log.data)?;

        // Extract view tag from metadata (first byte if present)
        let view_tag = Self::extract_view_tag(&metadata);

        Ok(Announcement {
            scheme_id,
            stealth_address,
            caller,
            ephemeral_pub_key,
            metadata,
            view_tag,
            block_number: log.block_number,
            transaction_hash: log.transaction_hash.clone(),
            log_index: log.log_index,
        })
    }

    fn parse_uint256(topic: &str) -> Result<u64, ParseError> {
        let topic = topic.strip_prefix("0x").unwrap_or(topic);
        let bytes = hex::decode(topic).map_err(ParseError::HexError)?;

        if bytes.len() != 32 {
            return Err(ParseError::InvalidTopic(format!(
                "Expected 32 bytes, got {}",
                bytes.len()
            )));
        }

        // For scheme_id, we only care about the last 8 bytes (u64)
        let value = U256::from_be_slice(&bytes);
        Ok(value.to::<u64>())
    }

    fn parse_address(topic: &str) -> Result<String, ParseError> {
        let topic = topic.strip_prefix("0x").unwrap_or(topic);
        let bytes = hex::decode(topic).map_err(ParseError::HexError)?;

        if bytes.len() != 32 {
            return Err(ParseError::InvalidTopic(format!(
                "Expected 32 bytes, got {}",
                bytes.len()
            )));
        }

        // Address is right-aligned in 32 bytes, take last 20 bytes
        let address_bytes: [u8; 20] = bytes[12..32]
            .try_into()
            .map_err(|_| ParseError::InvalidTopic("Failed to extract address".to_string()))?;

        let address = Address::from(address_bytes);
        Ok(format!("0x{}", hex::encode(address.as_slice())))
    }

    fn parse_data(data: &str) -> Result<(String, String), ParseError> {
        let data = data.strip_prefix("0x").unwrap_or(data);
        let bytes = hex::decode(data).map_err(ParseError::HexError)?;

        if bytes.len() < 128 {
            return Err(ParseError::InvalidData(format!(
                "Data too short: {} bytes",
                bytes.len()
            )));
        }

        // ABI encoded bytes layout:
        // [0..32] - offset to ephemeralPubKey
        // [32..64] - offset to metadata
        // [64..96] - length of ephemeralPubKey
        // [96..96+len] - ephemeralPubKey data
        // [...] - length of metadata
        // [...] - metadata data

        let epk_offset = U256::from_be_slice(&bytes[0..32]).to::<usize>();
        let meta_offset = U256::from_be_slice(&bytes[32..64]).to::<usize>();

        let epk_len = U256::from_be_slice(&bytes[epk_offset..epk_offset + 32]).to::<usize>();
        let epk_start = epk_offset + 32;
        let epk_end = epk_start + epk_len;

        if epk_end > bytes.len() {
            return Err(ParseError::InvalidData("ephemeralPubKey out of bounds".to_string()));
        }
        let ephemeral_pub_key = format!("0x{}", hex::encode(&bytes[epk_start..epk_end]));

        let meta_len = U256::from_be_slice(&bytes[meta_offset..meta_offset + 32]).to::<usize>();
        let meta_start = meta_offset + 32;
        let meta_end = meta_start + meta_len;

        if meta_end > bytes.len() {
            return Err(ParseError::InvalidData("metadata out of bounds".to_string()));
        }
        let metadata = format!("0x{}", hex::encode(&bytes[meta_start..meta_end]));

        Ok((ephemeral_pub_key, metadata))
    }

    fn extract_view_tag(metadata: &str) -> Option<u8> {
        let metadata = metadata.strip_prefix("0x").unwrap_or(metadata);
        if metadata.is_empty() {
            return None;
        }

        hex::decode(metadata)
            .ok()
            .and_then(|bytes| bytes.first().copied())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_address() {
        let topic = "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045";
        let address = AnnouncementParser::parse_address(topic).unwrap();
        assert_eq!(address.to_lowercase(), "0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    }

    #[test]
    fn test_parse_uint256() {
        let topic = "0x0000000000000000000000000000000000000000000000000000000000000001";
        let value = AnnouncementParser::parse_uint256(topic).unwrap();
        assert_eq!(value, 1);
    }

    #[test]
    fn test_extract_view_tag() {
        let metadata = "0xff1234";
        let view_tag = AnnouncementParser::extract_view_tag(metadata);
        assert_eq!(view_tag, Some(0xff));
    }

    #[test]
    fn test_extract_view_tag_empty() {
        let metadata = "0x";
        let view_tag = AnnouncementParser::extract_view_tag(metadata);
        assert_eq!(view_tag, None);
    }
}
