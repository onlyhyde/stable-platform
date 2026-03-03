// Package types provides transaction types for multi-mode transaction support.
package types

import "math/big"

// ============================================================================
// Transaction Mode
// ============================================================================

// TransactionMode represents the execution mode for transactions.
type TransactionMode string

// Transaction mode constants.
const (
	// TransactionModeEOA is a direct EOA transaction via eth_sendTransaction.
	TransactionModeEOA TransactionMode = "eoa"

	// TransactionModeEIP7702 is an EIP-7702 SetCode transaction for delegation.
	TransactionModeEIP7702 TransactionMode = "eip7702"

	// TransactionModeSmartAccount is a Smart Account UserOperation via Bundler.
	TransactionModeSmartAccount TransactionMode = "smartAccount"
)

// String returns the string representation of the transaction mode.
func (m TransactionMode) String() string {
	return string(m)
}

// IsValid checks if the transaction mode is valid.
func (m TransactionMode) IsValid() bool {
	switch m {
	case TransactionModeEOA, TransactionModeEIP7702, TransactionModeSmartAccount:
		return true
	default:
		return false
	}
}

// ============================================================================
// Gas Payment Type
// ============================================================================

// GasPaymentType represents the gas payment strategy for Smart Account mode.
type GasPaymentType string

// Gas payment type constants.
const (
	// GasPaymentTypeSponsor means paymaster sponsors gas (free for user).
	GasPaymentTypeSponsor GasPaymentType = "sponsor"

	// GasPaymentTypeNative means user pays with native token (ETH).
	GasPaymentTypeNative GasPaymentType = "native"

	// GasPaymentTypeERC20 means user pays with ERC20 token.
	GasPaymentTypeERC20 GasPaymentType = "erc20"
)

// String returns the string representation of the gas payment type.
func (g GasPaymentType) String() string {
	return string(g)
}

// IsValid checks if the gas payment type is valid.
func (g GasPaymentType) IsValid() bool {
	switch g {
	case GasPaymentTypeSponsor, GasPaymentTypeNative, GasPaymentTypeERC20:
		return true
	default:
		return false
	}
}

// ============================================================================
// Gas Payment Config
// ============================================================================

// GasPaymentConfig represents gas payment configuration for Smart Account transactions.
type GasPaymentConfig struct {
	// Type is the payment strategy type.
	Type GasPaymentType `json:"type"`

	// TokenAddress is the ERC20 token address (required when type is 'erc20').
	TokenAddress *Address `json:"tokenAddress,omitempty"`

	// TokenSymbol is the token symbol for UI display.
	TokenSymbol string `json:"tokenSymbol,omitempty"`

	// TokenDecimals is the token decimals for formatting.
	TokenDecimals uint8 `json:"tokenDecimals,omitempty"`

	// EstimatedAmount is the estimated token amount for gas (in token's smallest unit).
	EstimatedAmount *big.Int `json:"estimatedAmount,omitempty"`
}

// ============================================================================
// Signed Authorization (for EIP-7702)
// ============================================================================

// EIP7702SignedAuthorization represents a signed EIP-7702 authorization for transactions.
type EIP7702SignedAuthorization struct {
	// ChainId is the chain ID.
	ChainId uint64 `json:"chainId"`

	// Address is the contract address to delegate to.
	Address Address `json:"address"`

	// Nonce is the authorization nonce.
	Nonce uint64 `json:"nonce"`

	// R is the ECDSA signature r component.
	R Hash `json:"r"`

	// S is the ECDSA signature s component.
	S Hash `json:"s"`

	// YParity is the ECDSA recovery id.
	YParity uint8 `json:"yParity"`
}

// ============================================================================
// Multi-Mode Transaction Request
// ============================================================================

// MultiModeTransactionRequest represents a unified interface for all transaction types.
type MultiModeTransactionRequest struct {
	// Mode is the transaction execution mode.
	Mode TransactionMode `json:"mode"`

	// From is the sender address.
	From Address `json:"from"`

	// To is the recipient address.
	To Address `json:"to"`

	// Value is the value in wei.
	Value *big.Int `json:"value"`

	// Data is the transaction calldata.
	Data Hex `json:"data"`

	// ChainId is the chain ID.
	ChainId *uint64 `json:"chainId,omitempty"`

	// ---- EOA/EIP-7702 specific ----

	// Gas is the gas limit.
	Gas *big.Int `json:"gas,omitempty"`

	// MaxFeePerGas is the max fee per gas (EIP-1559).
	MaxFeePerGas *big.Int `json:"maxFeePerGas,omitempty"`

	// MaxPriorityFeePerGas is the max priority fee per gas (EIP-1559).
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas,omitempty"`

	// Nonce is the transaction nonce.
	Nonce *uint64 `json:"nonce,omitempty"`

	// ---- EIP-7702 specific ----

	// AuthorizationList is the authorization list for SetCode transaction.
	AuthorizationList []EIP7702SignedAuthorization `json:"authorizationList,omitempty"`

	// ---- Smart Account specific ----

	// GasPayment is the gas payment configuration.
	GasPayment *GasPaymentConfig `json:"gasPayment,omitempty"`
}

// ============================================================================
// Gas Estimate
// ============================================================================

// GasEstimate represents gas estimation result.
type GasEstimate struct {
	// GasLimit is the estimated gas limit.
	GasLimit *big.Int `json:"gasLimit"`

	// MaxFeePerGas is the max fee per gas.
	MaxFeePerGas *big.Int `json:"maxFeePerGas"`

	// MaxPriorityFeePerGas is the max priority fee per gas.
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`

	// EstimatedCost is the total estimated cost in wei.
	EstimatedCost *big.Int `json:"estimatedCost"`

	// EstimatedCostUsd is the estimated cost in USD (optional).
	EstimatedCostUsd *float64 `json:"estimatedCostUsd,omitempty"`

	// ---- Smart Account specific ----

	// PreVerificationGas is the pre-verification gas.
	PreVerificationGas *big.Int `json:"preVerificationGas,omitempty"`

	// VerificationGasLimit is the verification gas limit.
	VerificationGasLimit *big.Int `json:"verificationGasLimit,omitempty"`

	// CallGasLimit is the call gas limit.
	CallGasLimit *big.Int `json:"callGasLimit,omitempty"`

	// PaymasterVerificationGasLimit is the paymaster verification gas limit.
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit,omitempty"`

	// PaymasterPostOpGasLimit is the paymaster post-op gas limit.
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit,omitempty"`

	// UnusedGasPenalty is the EIP-4337 v0.9 unused gas penalty
	// (10% of unused callGas + postOpGas above 40K threshold).
	UnusedGasPenalty *big.Int `json:"unusedGasPenalty,omitempty"`
}

// ============================================================================
// Transaction Result
// ============================================================================

// TransactionResult represents the result of a transaction.
type TransactionResult struct {
	// Hash is the transaction hash (EOA/EIP-7702) or UserOp hash (Smart Account).
	Hash Hash `json:"hash"`

	// Mode is the transaction mode used.
	Mode TransactionMode `json:"mode"`

	// ChainId is the chain ID.
	ChainId uint64 `json:"chainId"`

	// Timestamp is the timestamp when sent.
	Timestamp int64 `json:"timestamp"`
}

// ============================================================================
// Type Guards
// ============================================================================

// IsEOAMode checks if the mode is EOA.
func IsEOAMode(mode TransactionMode) bool {
	return mode == TransactionModeEOA
}

// IsEIP7702Mode checks if the mode is EIP-7702.
func IsEIP7702Mode(mode TransactionMode) bool {
	return mode == TransactionModeEIP7702
}

// IsSmartAccountMode checks if the mode is Smart Account.
func IsSmartAccountMode(mode TransactionMode) bool {
	return mode == TransactionModeSmartAccount
}

// IsSponsoredGas checks if gas payment is sponsor type.
func IsSponsoredGas(config *GasPaymentConfig) bool {
	return config != nil && config.Type == GasPaymentTypeSponsor
}

// IsNativeGas checks if gas payment is native type.
func IsNativeGas(config *GasPaymentConfig) bool {
	return config != nil && config.Type == GasPaymentTypeNative
}

// IsERC20Gas checks if gas payment is ERC20 type.
func IsERC20Gas(config *GasPaymentConfig) bool {
	return config != nil && config.Type == GasPaymentTypeERC20 && config.TokenAddress != nil
}

// ============================================================================
// Validation
// ============================================================================

// Validate validates the multi-mode transaction request.
func (r *MultiModeTransactionRequest) Validate() error {
	if !r.Mode.IsValid() {
		return &ValidationError{Field: "mode", Message: "invalid transaction mode"}
	}

	if r.From == (Address{}) {
		return &ValidationError{Field: "from", Message: "from address is required"}
	}

	if r.To == (Address{}) {
		return &ValidationError{Field: "to", Message: "to address is required"}
	}

	// Mode-specific validation
	switch r.Mode {
	case TransactionModeEIP7702:
		if len(r.AuthorizationList) == 0 {
			return &ValidationError{Field: "authorizationList", Message: "EIP-7702 mode requires authorization list"}
		}
	case TransactionModeSmartAccount:
		if r.GasPayment != nil && !r.GasPayment.Type.IsValid() {
			return &ValidationError{Field: "gasPayment.type", Message: "invalid gas payment type"}
		}
		if r.GasPayment != nil && r.GasPayment.Type == GasPaymentTypeERC20 && r.GasPayment.TokenAddress == nil {
			return &ValidationError{Field: "gasPayment.tokenAddress", Message: "ERC20 gas payment requires token address"}
		}
	}

	return nil
}

// ValidationError represents a validation error.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}

// ============================================================================
// Helper Functions
// ============================================================================

// NewEOATransactionRequest creates a new EOA transaction request.
func NewEOATransactionRequest(from, to Address, value *big.Int, data Hex) *MultiModeTransactionRequest {
	return &MultiModeTransactionRequest{
		Mode:  TransactionModeEOA,
		From:  from,
		To:    to,
		Value: value,
		Data:  data,
	}
}

// NewEIP7702TransactionRequest creates a new EIP-7702 transaction request.
func NewEIP7702TransactionRequest(from, to Address, value *big.Int, data Hex, authList []EIP7702SignedAuthorization) *MultiModeTransactionRequest {
	return &MultiModeTransactionRequest{
		Mode:              TransactionModeEIP7702,
		From:              from,
		To:                to,
		Value:             value,
		Data:              data,
		AuthorizationList: authList,
	}
}

// NewSmartAccountTransactionRequest creates a new Smart Account transaction request.
func NewSmartAccountTransactionRequest(from, to Address, value *big.Int, data Hex, gasPayment *GasPaymentConfig) *MultiModeTransactionRequest {
	return &MultiModeTransactionRequest{
		Mode:       TransactionModeSmartAccount,
		From:       from,
		To:         to,
		Value:      value,
		Data:       data,
		GasPayment: gasPayment,
	}
}

// NewSponsoredGasPayment creates a sponsored gas payment config.
func NewSponsoredGasPayment() *GasPaymentConfig {
	return &GasPaymentConfig{
		Type: GasPaymentTypeSponsor,
	}
}

// NewNativeGasPayment creates a native gas payment config.
func NewNativeGasPayment() *GasPaymentConfig {
	return &GasPaymentConfig{
		Type: GasPaymentTypeNative,
	}
}

// NewERC20GasPayment creates an ERC20 gas payment config.
func NewERC20GasPayment(tokenAddress Address, tokenSymbol string, tokenDecimals uint8) *GasPaymentConfig {
	return &GasPaymentConfig{
		Type:          GasPaymentTypeERC20,
		TokenAddress:  &tokenAddress,
		TokenSymbol:   tokenSymbol,
		TokenDecimals: tokenDecimals,
	}
}
