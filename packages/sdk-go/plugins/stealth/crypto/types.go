// Package crypto provides cryptographic operations for stealth addresses.
package crypto

import "github.com/stablenet/sdk-go/types"

// SchemeID represents the EIP-5564 stealth address scheme identifier.
type SchemeID uint8

const (
	// SchemeReserved is the reserved scheme (not used).
	SchemeReserved SchemeID = 0
	// SchemeSecp256k1 is the secp256k1 scheme with view tags (recommended).
	SchemeSecp256k1 SchemeID = 1
)

// DefaultSchemeID is the default scheme ID for StableNet.
const DefaultSchemeID = SchemeSecp256k1

// StealthMetaAddress represents a stealth meta-address (EIP-5564).
type StealthMetaAddress struct {
	// SpendingPubKey is the spending public key (compressed, 33 bytes).
	SpendingPubKey types.Hex `json:"spendingPubKey"`
	// ViewingPubKey is the viewing public key (compressed, 33 bytes).
	ViewingPubKey types.Hex `json:"viewingPubKey"`
	// SchemeID is the scheme identifier.
	SchemeID SchemeID `json:"schemeId"`
}

// ParsedStealthMetaAddressURI represents a parsed stealth meta-address URI.
type ParsedStealthMetaAddressURI struct {
	// ChainPrefix is the chain prefix (e.g., "eth", "stablenet").
	ChainPrefix string `json:"chainPrefix"`
	// StealthMetaAddress is the parsed stealth meta address.
	StealthMetaAddress StealthMetaAddress `json:"stealthMetaAddress"`
	// Raw is the raw hex string.
	Raw types.Hex `json:"raw"`
}

// GeneratedStealthAddress represents the result of generating a stealth address.
type GeneratedStealthAddress struct {
	// StealthAddress is the one-time stealth address.
	StealthAddress types.Address `json:"stealthAddress"`
	// EphemeralPubKey is the ephemeral public key to be announced.
	EphemeralPubKey types.Hex `json:"ephemeralPubKey"`
	// ViewTag is the view tag for efficient scanning (1 byte).
	ViewTag types.Hex `json:"viewTag"`
}

// StealthKeyPair represents a stealth key pair.
type StealthKeyPair struct {
	// PrivateKey is the private key.
	PrivateKey types.Hex `json:"privateKey"`
	// PublicKey is the public key (compressed).
	PublicKey types.Hex `json:"publicKey"`
}

// StealthKeys represents the full set of keys for receiving stealth payments.
type StealthKeys struct {
	// Spending is the spending key pair.
	Spending StealthKeyPair `json:"spending"`
	// Viewing is the viewing key pair.
	Viewing StealthKeyPair `json:"viewing"`
}

// ComputedStealthKey represents the result of computing a stealth private key.
type ComputedStealthKey struct {
	// StealthAddress is the derived stealth address.
	StealthAddress types.Address `json:"stealthAddress"`
	// StealthPrivateKey is the derived private key for the stealth address.
	StealthPrivateKey types.Hex `json:"stealthPrivateKey"`
}
