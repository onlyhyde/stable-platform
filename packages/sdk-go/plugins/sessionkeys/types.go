// Package sessionkeys provides Session Key Executor plugin for ERC-7579 smart accounts.
package sessionkeys

import (
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Session Key Configuration
// ============================================================================

// SessionKeyConfig represents session key configuration stored in the contract.
type SessionKeyConfig struct {
	// SessionKey is the session key address.
	SessionKey types.Address `json:"sessionKey"`

	// ValidAfter is the timestamp when session becomes valid (unix timestamp).
	ValidAfter uint64 `json:"validAfter"`

	// ValidUntil is the timestamp when session expires (unix timestamp).
	ValidUntil uint64 `json:"validUntil"`

	// SpendingLimit is the maximum ETH that can be spent in this session.
	SpendingLimit *big.Int `json:"spendingLimit"`

	// SpentAmount is the amount already spent.
	SpentAmount *big.Int `json:"spentAmount"`

	// Nonce is the current nonce for replay protection.
	Nonce *big.Int `json:"nonce"`

	// IsActive indicates whether the session is active.
	IsActive bool `json:"isActive"`
}

// SessionKeyState represents session key state with computed values.
type SessionKeyState struct {
	// Config is the session configuration.
	Config *SessionKeyConfig `json:"config"`

	// RemainingLimit is the remaining spending limit.
	RemainingLimit *big.Int `json:"remainingLimit"`

	// IsValid indicates whether the session is currently valid.
	IsValid bool `json:"isValid"`

	// TimeRemaining is the time until expiration (in seconds, 0 if expired).
	TimeRemaining uint64 `json:"timeRemaining"`
}

// ============================================================================
// Permission
// ============================================================================

// Permission represents a permission for a specific target contract and function.
type Permission struct {
	// Target is the target contract address.
	Target types.Address `json:"target"`

	// Selector is the function selector (bytes4), use 0x00000000 for any selector.
	Selector types.Hex `json:"selector"`

	// MaxValue is the maximum ETH value per call (0 = unlimited).
	MaxValue *big.Int `json:"maxValue"`

	// Allowed indicates whether this permission is allowed.
	Allowed bool `json:"allowed"`
}

// PermissionInput represents permission input for creating/granting permissions.
type PermissionInput struct {
	// Target is the target contract address.
	Target types.Address `json:"target"`

	// Selector is the function selector (bytes4), use '0x00000000' for any function.
	Selector types.Hex `json:"selector,omitempty"`

	// MaxValue is the maximum ETH value per call.
	MaxValue *big.Int `json:"maxValue,omitempty"`
}

// ============================================================================
// Execution Request
// ============================================================================

// ExecutionRequest represents an execution request through session key.
type ExecutionRequest struct {
	// Target is the target contract.
	Target types.Address `json:"target"`

	// Value is the ETH value to send.
	Value *big.Int `json:"value"`

	// Data is the call data.
	Data types.Hex `json:"data"`
}

// ============================================================================
// Session Key Executor Config
// ============================================================================

// ExecutorConfig represents session key executor configuration.
type ExecutorConfig struct {
	// ExecutorAddress is the executor contract address.
	ExecutorAddress types.Address `json:"executorAddress"`

	// ChainId is the chain ID.
	ChainId uint64 `json:"chainId"`
}

// ============================================================================
// Create Session Key Params
// ============================================================================

// CreateSessionKeyParams represents parameters for creating a session key.
type CreateSessionKeyParams struct {
	// Account is the account that owns the session.
	Account types.Address `json:"account"`

	// SessionKey is the session key address.
	SessionKey types.Address `json:"sessionKey"`

	// ValidAfter is the session validity start (unix timestamp, default: now).
	ValidAfter uint64 `json:"validAfter,omitempty"`

	// ValidUntil is the session validity end (unix timestamp, default: 1 hour from now).
	ValidUntil uint64 `json:"validUntil,omitempty"`

	// SpendingLimit is the maximum ETH spending limit.
	SpendingLimit *big.Int `json:"spendingLimit,omitempty"`

	// Permissions is the initial permissions to grant.
	Permissions []PermissionInput `json:"permissions,omitempty"`
}

// ============================================================================
// ABI Definitions
// ============================================================================

// SessionKeyExecutorABI is the ABI for SessionKeyExecutor contract.
var SessionKeyExecutorABI abi.ABI

func init() {
	var err error
	SessionKeyExecutorABI, err = abi.JSON(strings.NewReader(sessionKeyExecutorABIJSON))
	if err != nil {
		panic("failed to parse SessionKeyExecutor ABI: " + err.Error())
	}
}

const sessionKeyExecutorABIJSON = `[
	{
		"name": "addSessionKey",
		"type": "function",
		"inputs": [
			{"name": "sessionKey", "type": "address"},
			{"name": "validAfter", "type": "uint48"},
			{"name": "validUntil", "type": "uint48"},
			{"name": "spendingLimit", "type": "uint256"}
		],
		"outputs": []
	},
	{
		"name": "revokeSessionKey",
		"type": "function",
		"inputs": [{"name": "sessionKey", "type": "address"}],
		"outputs": []
	},
	{
		"name": "grantPermission",
		"type": "function",
		"inputs": [
			{"name": "sessionKey", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "selector", "type": "bytes4"},
			{"name": "maxValue", "type": "uint256"}
		],
		"outputs": []
	},
	{
		"name": "revokePermission",
		"type": "function",
		"inputs": [
			{"name": "sessionKey", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "selector", "type": "bytes4"}
		],
		"outputs": []
	},
	{
		"name": "executeAsSessionKey",
		"type": "function",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "value", "type": "uint256"},
			{"name": "data", "type": "bytes"}
		],
		"outputs": [{"name": "", "type": "bytes[]"}]
	},
	{
		"name": "executeOnBehalf",
		"type": "function",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "value", "type": "uint256"},
			{"name": "data", "type": "bytes"},
			{"name": "signature", "type": "bytes"}
		],
		"outputs": [{"name": "", "type": "bytes[]"}]
	},
	{
		"name": "getSessionKey",
		"type": "function",
		"stateMutability": "view",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "sessionKey", "type": "address"}
		],
		"outputs": [
			{
				"name": "",
				"type": "tuple",
				"components": [
					{"name": "sessionKey", "type": "address"},
					{"name": "validAfter", "type": "uint48"},
					{"name": "validUntil", "type": "uint48"},
					{"name": "spendingLimit", "type": "uint256"},
					{"name": "spentAmount", "type": "uint256"},
					{"name": "nonce", "type": "uint256"},
					{"name": "isActive", "type": "bool"}
				]
			}
		]
	},
	{
		"name": "hasPermission",
		"type": "function",
		"stateMutability": "view",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "sessionKey", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "selector", "type": "bytes4"}
		],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "getActiveSessionKeys",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "account", "type": "address"}],
		"outputs": [{"name": "", "type": "address[]"}]
	},
	{
		"name": "getRemainingSpendingLimit",
		"type": "function",
		"stateMutability": "view",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "sessionKey", "type": "address"}
		],
		"outputs": [{"name": "", "type": "uint256"}]
	}
]`

// Common selectors.
var (
	// WildcardSelector allows any function call.
	WildcardSelector = types.Hex{0x00, 0x00, 0x00, 0x00}
)

// ============================================================================
// Helper Functions
// ============================================================================

// ToBytes4 converts a Hex to a [4]byte selector.
func ToBytes4(h types.Hex) [4]byte {
	var b [4]byte
	if len(h) >= 4 {
		copy(b[:], h[:4])
	}
	return b
}

// ToCommonAddress converts types.Address to common.Address.
func ToCommonAddress(a types.Address) common.Address {
	return common.Address(a)
}
