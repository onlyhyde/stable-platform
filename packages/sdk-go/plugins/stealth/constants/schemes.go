// Package constants provides constant values for the stealth address plugin.
package constants

// ViewTagSize is the size of the view tag in bytes.
const ViewTagSize = 1

// CompressedPubKeySize is the size of a compressed public key in bytes.
const CompressedPubKeySize = 33

// UncompressedPubKeySize is the size of an uncompressed public key in bytes.
const UncompressedPubKeySize = 65

// StealthMetaAddressSize is the size of a stealth meta address in bytes.
// (spending public key + viewing public key = 33 + 33 = 66 bytes)
const StealthMetaAddressSize = 66

// StealthMetaAddressPrefix is the URI prefix for stealth meta addresses.
const StealthMetaAddressPrefix = "st"

// MaxMetadataSize is the maximum size of metadata in bytes.
const MaxMetadataSize = 1024

// ChainPrefix constants for common chains.
const (
	ChainPrefixEthereum    = "eth"
	ChainPrefixStableNet   = "stablenet"
	ChainPrefixSepolia     = "sep"
	ChainPrefixBaseSepolia = "basesep"
)
