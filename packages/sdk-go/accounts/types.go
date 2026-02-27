// Package accounts provides smart account abstractions for ERC-4337.
package accounts

import (
	"context"
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// AccountType represents the type of account.
type AccountType string

const (
	// AccountTypeEOA is a standard Externally Owned Account.
	AccountTypeEOA AccountType = "eoa"

	// AccountTypeSmart is a pure Smart Account (contract wallet).
	AccountTypeSmart AccountType = "smart"

	// AccountTypeDelegated is an EOA with EIP-7702 delegation to Smart Account.
	AccountTypeDelegated AccountType = "delegated"
)

// Call represents a single call to be executed.
type Call struct {
	To    types.Address
	Value types.BigInt
	Data  types.Hex
}

// Validator represents an ERC-7579 validator module.
type Validator interface {
	// Address returns the validator module address.
	Address() types.Address

	// GetInitData returns the initialization data for the validator.
	GetInitData(ctx context.Context) (types.Hex, error)

	// SignHash signs a hash with this validator.
	SignHash(ctx context.Context, hash types.Hash) (types.Hex, error)

	// GetSignerAddress returns the signer address.
	GetSignerAddress() types.Address
}

// SignatureFormatter wraps a raw validator signature into the account-specific
// on-chain format. Different smart account implementations use different
// envelope formats (e.g., Kernel v3 prepends a mode byte).
//
// Implementations:
//   - KernelSignatureFormatter: prepends 0x02 (validation mode) for Kernel v3
//   - Custom formatters can prepend enable-mode bytes, multi-sig wrappers, etc.
type SignatureFormatter interface {
	// FormatSignature wraps the raw validator signature into the account's
	// expected on-chain format.
	FormatSignature(rawSignature types.Hex) (types.Hex, error)
}

// SmartAccount represents an ERC-4337 smart account.
type SmartAccount interface {
	// Address returns the account address.
	Address() types.Address

	// EntryPoint returns the EntryPoint address.
	EntryPoint() types.Address

	// GetNonce returns the current nonce from EntryPoint (key=0).
	GetNonce(ctx context.Context) (uint64, error)

	// GetNonceWithKey returns the nonce for a specific key from EntryPoint.
	// EIP-4337 nonces use uint192 key + uint64 sequence for parallel execution.
	// Key 0 is the default; different keys allow independent nonce sequences.
	GetNonceWithKey(ctx context.Context, key *big.Int) (uint64, error)

	// GetInitCode returns the init code for account deployment.
	// Returns empty if already deployed.
	GetInitCode(ctx context.Context) (types.Hex, error)

	// EncodeCallData encodes calls into the account's execute format.
	EncodeCallData(calls []Call) (types.Hex, error)

	// SignUserOperation signs a UserOperation hash.
	SignUserOperation(ctx context.Context, userOpHash types.Hash) (types.Hex, error)

	// VerifySignature verifies a UserOperation signature on-chain.
	// For EOA signers, uses ecrecover. For contract signers, uses ERC-1271.
	// Returns true if the signature is valid for this account's signer.
	VerifySignature(ctx context.Context, userOpHash types.Hash, signature types.Hex) (bool, error)

	// GetFactory returns the factory address (nil if deployed).
	GetFactory(ctx context.Context) (*types.Address, error)

	// GetFactoryData returns the factory call data (nil if deployed).
	GetFactoryData(ctx context.Context) (types.Hex, error)

	// IsDeployed returns whether the account is deployed on-chain.
	IsDeployed(ctx context.Context) (bool, error)
}

// Account represents account information.
type Account struct {
	// Address is the account address.
	Address types.Address

	// Name is the display name.
	Name string

	// Type is the account type.
	Type AccountType

	// DelegateAddress is the delegate contract address for delegated EOA.
	DelegateAddress *types.Address

	// IsDeployed indicates whether the smart account is deployed.
	IsDeployed bool

	// InstalledModules lists the installed ERC-7579 modules.
	InstalledModules []types.InstalledModule

	// CreatedAt is the creation timestamp.
	CreatedAt int64

	// LastActivity is the last activity timestamp.
	LastActivity int64
}

// SupportsSmartAccount returns whether the account supports smart account features.
func (a *Account) SupportsSmartAccount() bool {
	return a.Type == AccountTypeSmart || a.Type == AccountTypeDelegated
}

// CanInstallModules returns whether the account can install modules.
func (a *Account) CanInstallModules() bool {
	return a.SupportsSmartAccount() && a.IsDeployed
}
