// Package eip7702 provides EIP-7702 (EOA Code Delegation) support.
package eip7702

import (
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// Authorization represents an EIP-7702 authorization structure.
// This is signed by an EOA to delegate code execution to a contract.
type Authorization struct {
	// ChainId is the chain ID this authorization is valid for.
	// Use 0 for wildcard (valid on any chain).
	ChainId *big.Int `json:"chainId"`

	// Address is the contract address to delegate to.
	Address types.Address `json:"address"`

	// Nonce is the account nonce at the time of signing.
	Nonce *big.Int `json:"nonce"`
}

// SignedAuthorization represents a signed EIP-7702 authorization.
type SignedAuthorization struct {
	Authorization

	// V is the recovery id of the signature.
	V uint8 `json:"v"`

	// R is the first 32 bytes of the signature.
	R types.Hash `json:"r"`

	// S is the second 32 bytes of the signature.
	S types.Hash `json:"s"`
}

// DelegationStatus describes the current delegation status of an account.
type DelegationStatus struct {
	// IsDelegated indicates whether the account has EIP-7702 delegation.
	IsDelegated bool `json:"isDelegated"`

	// DelegateAddress is the address of the delegated contract.
	// Nil if not delegated.
	DelegateAddress *types.Address `json:"delegateAddress,omitempty"`

	// Code is the account's bytecode.
	Code types.Hex `json:"code,omitempty"`
}

// DelegatePreset represents a known delegate contract configuration.
type DelegatePreset struct {
	// Name is the human-readable name.
	Name string `json:"name"`

	// Address is the contract address.
	Address types.Address `json:"address"`

	// Description is a brief description of the delegate.
	Description string `json:"description,omitempty"`

	// IsVerified indicates whether the contract is verified/audited.
	IsVerified bool `json:"isVerified"`
}

// ParsedSignature contains the parsed v, r, s components of a signature.
type ParsedSignature struct {
	V uint8
	R types.Hash
	S types.Hash
}
