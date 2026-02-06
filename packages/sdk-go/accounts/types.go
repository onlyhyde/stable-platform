// Package accounts provides smart account abstractions for ERC-4337.
package accounts

import (
	"context"

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

// SmartAccount represents an ERC-4337 smart account.
type SmartAccount interface {
	// Address returns the account address.
	Address() types.Address

	// EntryPoint returns the EntryPoint address.
	EntryPoint() types.Address

	// GetNonce returns the current nonce from EntryPoint.
	GetNonce(ctx context.Context) (uint64, error)

	// GetInitCode returns the init code for account deployment.
	// Returns empty if already deployed.
	GetInitCode(ctx context.Context) (types.Hex, error)

	// EncodeCallData encodes calls into the account's execute format.
	EncodeCallData(calls []Call) (types.Hex, error)

	// SignUserOperation signs a UserOperation hash.
	SignUserOperation(ctx context.Context, userOpHash types.Hash) (types.Hex, error)

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
