// Package stealth provides EIP-5564 stealth address functionality for the StableNet SDK.
// It enables privacy-preserving transactions through one-time stealth addresses.
package stealth

import (
	"math/big"

	"github.com/stablenet/sdk-go/plugins/stealth/crypto"
	"github.com/stablenet/sdk-go/types"
)

// Re-export crypto types for convenience.
type (
	SchemeID                    = crypto.SchemeID
	StealthMetaAddress          = crypto.StealthMetaAddress
	ParsedStealthMetaAddressURI = crypto.ParsedStealthMetaAddressURI
	GeneratedStealthAddress     = crypto.GeneratedStealthAddress
	StealthKeyPair              = crypto.StealthKeyPair
	StealthKeys                 = crypto.StealthKeys
	ComputedStealthKey          = crypto.ComputedStealthKey
)

// Re-export scheme constants.
const (
	SchemeReserved  = crypto.SchemeReserved
	SchemeSecp256k1 = crypto.SchemeSecp256k1
)

// DefaultSchemeID is the default scheme ID for StableNet.
const DefaultSchemeID = crypto.DefaultSchemeID

// StealthAnnouncement represents an EIP-5564 stealth announcement.
type StealthAnnouncement struct {
	// SchemeID is the scheme ID used.
	SchemeID SchemeID `json:"schemeId"`
	// StealthAddress is the stealth address.
	StealthAddress types.Address `json:"stealthAddress"`
	// Caller is the caller address (who made the announcement).
	Caller types.Address `json:"caller"`
	// EphemeralPubKey is the ephemeral public key.
	EphemeralPubKey types.Hex `json:"ephemeralPubKey"`
	// Metadata contains the view tag and optional extra data.
	Metadata types.Hex `json:"metadata"`
	// BlockNumber is the block number of the announcement.
	BlockNumber *big.Int `json:"blockNumber"`
	// TxHash is the transaction hash.
	TxHash types.Hash `json:"txHash"`
	// LogIndex is the log index within the transaction.
	LogIndex uint `json:"logIndex"`
}

// AnnouncementFilterOptions represents filter options for fetching announcements.
type AnnouncementFilterOptions struct {
	// FromBlock is the starting block number.
	FromBlock *big.Int `json:"fromBlock,omitempty"`
	// ToBlock is the ending block number (use nil for "latest").
	ToBlock *big.Int `json:"toBlock,omitempty"`
	// SchemeID filters by scheme ID (optional).
	SchemeID *SchemeID `json:"schemeId,omitempty"`
	// Caller filters by caller address (optional).
	Caller *types.Address `json:"caller,omitempty"`
}

// RegistryEntry represents an EIP-6538 stealth registry entry.
type RegistryEntry struct {
	// Registrant is the registrant address.
	Registrant types.Address `json:"registrant"`
	// SchemeID is the scheme ID.
	SchemeID SchemeID `json:"schemeId"`
	// StealthMetaAddress is the raw stealth meta address.
	StealthMetaAddress types.Hex `json:"stealthMetaAddress"`
	// BlockNumber is the block number when registered.
	BlockNumber *big.Int `json:"blockNumber"`
}

// WatchAnnouncementsOptions represents options for watching announcements.
type WatchAnnouncementsOptions struct {
	// SpendingPubKey is the spending public key.
	SpendingPubKey types.Hex `json:"spendingPubKey"`
	// ViewingPrivateKey is the viewing private key for scanning.
	ViewingPrivateKey types.Hex `json:"viewingPrivateKey"`
	// FromBlock is the starting block (default: current block).
	FromBlock *big.Int `json:"fromBlock,omitempty"`
	// SchemeID filters by scheme ID (optional).
	SchemeID *SchemeID `json:"schemeId,omitempty"`
	// PollingIntervalMs is the polling interval in milliseconds.
	PollingIntervalMs uint64 `json:"pollingIntervalMs,omitempty"`
}

// AnnouncementCallback is called when an announcement is found.
type AnnouncementCallback func(announcement *StealthAnnouncement, key *crypto.ComputedStealthKey) error

// ErrorCallback is called when an error occurs.
type ErrorCallback func(err error)

// GenerateStealthAddressParams represents parameters for generating a stealth address.
type GenerateStealthAddressParams struct {
	// StealthMetaAddressURI is the stealth meta-address URI (st:eth:0x...).
	StealthMetaAddressURI string `json:"stealthMetaAddressUri"`
}

// ComputeStealthKeyParams represents parameters for computing a stealth key.
type ComputeStealthKeyParams struct {
	// Announcement is the announcement to process.
	Announcement *StealthAnnouncement `json:"announcement"`
	// SpendingPrivateKey is the spending private key.
	SpendingPrivateKey types.Hex `json:"spendingPrivateKey"`
	// ViewingPrivateKey is the viewing private key.
	ViewingPrivateKey types.Hex `json:"viewingPrivateKey"`
}

// RegisterStealthMetaAddressParams represents parameters for registering a stealth meta address.
type RegisterStealthMetaAddressParams struct {
	// SchemeID is the scheme ID.
	SchemeID SchemeID `json:"schemeId"`
	// StealthMetaAddress is the stealth meta address (spending + viewing public keys).
	StealthMetaAddress types.Hex `json:"stealthMetaAddress"`
}

// AnnounceParams represents parameters for announcing a stealth payment.
type AnnounceParams struct {
	// SchemeID is the scheme ID.
	SchemeID SchemeID `json:"schemeId"`
	// StealthAddress is the stealth address.
	StealthAddress types.Address `json:"stealthAddress"`
	// EphemeralPubKey is the ephemeral public key.
	EphemeralPubKey types.Hex `json:"ephemeralPubKey"`
	// Metadata contains the view tag and optional extra data.
	Metadata types.Hex `json:"metadata"`
}

// CheckAnnouncementParams represents parameters for checking an announcement.
type CheckAnnouncementParams struct {
	// Announcement is the announcement to check.
	Announcement *StealthAnnouncement `json:"announcement"`
	// ViewingPrivateKey is the viewing private key.
	ViewingPrivateKey types.Hex `json:"viewingPrivateKey"`
	// SpendingPubKey is the spending public key.
	SpendingPubKey types.Hex `json:"spendingPubKey"`
}

// ComputeStealthKeyResult represents the result of computing a stealth key with detailed info.
type ComputeStealthKeyResult struct {
	// Success indicates whether computation was successful.
	Success bool `json:"success"`
	// Key is the computed stealth key (if successful).
	Key *crypto.ComputedStealthKey `json:"key,omitempty"`
	// Reason is the failure reason (if unsuccessful).
	Reason string `json:"reason,omitempty"`
	// Error is the error (if unsuccessful).
	Error error `json:"error,omitempty"`
}

// FailureReasons for ComputeStealthKeyResult.
const (
	ReasonViewTagMismatch  = "view_tag_mismatch"
	ReasonAddressMismatch  = "address_mismatch"
	ReasonInvalidInput     = "invalid_input"
	ReasonComputationError = "computation_error"
)
