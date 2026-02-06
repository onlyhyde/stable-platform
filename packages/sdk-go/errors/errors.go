package errors

import (
	"fmt"
	"math/big"
	"time"

	"github.com/stablenet/sdk-go/types"
)

// ErrorContext provides additional context for errors.
type ErrorContext struct {
	ChainID   types.ChainID `json:"chainId,omitempty"`
	Operation string        `json:"operation,omitempty"`
	Timestamp int64         `json:"timestamp,omitempty"`
}

// SdkError is the base error type for all SDK errors.
type SdkError struct {
	Code      SdkErrorCode  `json:"code"`
	Message   string        `json:"message"`
	Cause     error         `json:"cause,omitempty"`
	Context   *ErrorContext `json:"context,omitempty"`
	Timestamp int64         `json:"timestamp"`
}

// Error implements the error interface.
func (e *SdkError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying error.
func (e *SdkError) Unwrap() error {
	return e.Cause
}

// IsRetryable returns whether the error is retryable.
func (e *SdkError) IsRetryable() bool {
	return e.Code.IsRetryable()
}

// GetUserMessage returns a user-friendly error message.
func (e *SdkError) GetUserMessage() string {
	switch e.Code {
	case ErrNetworkError:
		return "Unable to connect. Please check your internet connection."
	case ErrTransactionFailed, ErrUserOpFailed:
		return "Transaction failed. Please try again."
	case ErrTransactionRejected, ErrUserOpRejected:
		return "Transaction was rejected."
	case ErrSignatureRejected:
		return "Signature request was rejected."
	case ErrInsufficientGas:
		return "Insufficient gas for transaction."
	case ErrUnauthorized:
		return "You are not authorized to perform this action."
	case ErrAccountNotDeployed:
		return "Smart account is not deployed yet."
	case ErrPaymasterNotAvailable:
		return "Gas sponsorship is not available."
	case ErrInsufficientSponsorBalance:
		return "The sponsor does not have sufficient balance."
	default:
		if e.Message != "" {
			return e.Message
		}
		return "An unexpected error occurred."
	}
}

// NewSdkError creates a new SDK error.
func NewSdkError(code SdkErrorCode, message string, cause error, ctx *ErrorContext) *SdkError {
	timestamp := time.Now().UnixMilli()
	if ctx != nil && ctx.Timestamp != 0 {
		timestamp = ctx.Timestamp
	}
	return &SdkError{
		Code:      code,
		Message:   message,
		Cause:     cause,
		Context:   ctx,
		Timestamp: timestamp,
	}
}

// NewError creates a simple SDK error with just code and message.
func NewError(code SdkErrorCode, message string) *SdkError {
	return NewSdkError(code, message, nil, nil)
}

// WrapError wraps an error with SDK error context.
func WrapError(code SdkErrorCode, message string, cause error) *SdkError {
	return NewSdkError(code, message, cause, nil)
}

// BundlerError represents an error from the ERC-4337 bundler.
type BundlerError struct {
	*SdkError
	BundlerCode BundlerErrorCode `json:"bundlerCode"`
	Data        interface{}      `json:"data,omitempty"`
}

// Error implements the error interface.
func (e *BundlerError) Error() string {
	return fmt.Sprintf("%s [%s]: %s", e.Code, e.BundlerCode.String(), e.Message)
}

// IsRetryable returns whether the bundler error is retryable.
func (e *BundlerError) IsRetryable() bool {
	return e.BundlerCode.IsRetryable()
}

// GetUserMessage returns a user-friendly message for bundler errors.
func (e *BundlerError) GetUserMessage() string {
	switch e.BundlerCode {
	case BundlerErrRejectedByEPOrAccount:
		return "Transaction was rejected by the account."
	case BundlerErrRejectedByPaymaster:
		return "Transaction was rejected by the paymaster."
	case BundlerErrInvalidSignature:
		return "Invalid signature provided."
	case BundlerErrBannedOpcode:
		return "Transaction contains disallowed operations."
	case BundlerErrBannedOrThrottled:
		return "Too many requests. Please wait and try again."
	case BundlerErrStakeOrDelayTooLow:
		return "Insufficient stake or delay for operation."
	default:
		if e.Message != "" {
			return e.Message
		}
		return "Bundler error occurred."
	}
}

// NewBundlerError creates a new bundler error.
func NewBundlerError(bundlerCode BundlerErrorCode, message string, data interface{}, ctx *ErrorContext) *BundlerError {
	return &BundlerError{
		SdkError:    NewSdkError(ErrBundlerError, message, nil, ctx),
		BundlerCode: bundlerCode,
		Data:        data,
	}
}

// UserOperationError represents an error related to user operations.
type UserOperationError struct {
	*SdkError
	UserOpHash types.Hash    `json:"userOpHash,omitempty"`
	Sender     types.Address `json:"sender,omitempty"`
	Reason     string        `json:"reason,omitempty"`
	RevertData types.Hex     `json:"revertData,omitempty"`
	GasUsed    *big.Int      `json:"gasUsed,omitempty"`
}

// NewUserOperationError creates a new user operation error.
func NewUserOperationError(code SdkErrorCode, message string, userOpHash types.Hash, sender types.Address, reason string, revertData types.Hex, gasUsed *big.Int, ctx *ErrorContext) *UserOperationError {
	return &UserOperationError{
		SdkError:   NewSdkError(code, message, nil, ctx),
		UserOpHash: userOpHash,
		Sender:     sender,
		Reason:     reason,
		RevertData: revertData,
		GasUsed:    gasUsed,
	}
}

// TransactionError represents an error related to transactions.
type TransactionError struct {
	*SdkError
	TxHash     types.Hash    `json:"txHash,omitempty"`
	From       types.Address `json:"from,omitempty"`
	To         types.Address `json:"to,omitempty"`
	Reason     string        `json:"reason,omitempty"`
	RevertData types.Hex     `json:"revertData,omitempty"`
	GasUsed    *big.Int      `json:"gasUsed,omitempty"`
}

// NewTransactionError creates a new transaction error.
func NewTransactionError(code SdkErrorCode, message string, txHash types.Hash, from, to types.Address, reason string, revertData types.Hex, gasUsed *big.Int, ctx *ErrorContext) *TransactionError {
	return &TransactionError{
		SdkError:   NewSdkError(code, message, nil, ctx),
		TxHash:     txHash,
		From:       from,
		To:         to,
		Reason:     reason,
		RevertData: revertData,
		GasUsed:    gasUsed,
	}
}

// GasEstimationError represents a gas estimation error.
type GasEstimationError struct {
	*SdkError
	Operation    string   `json:"operation"`
	EstimatedGas *big.Int `json:"estimatedGas,omitempty"`
	AvailableGas *big.Int `json:"availableGas,omitempty"`
	Reason       string   `json:"reason,omitempty"`
}

// NewGasEstimationError creates a new gas estimation error.
func NewGasEstimationError(message string, operation string, estimatedGas, availableGas *big.Int, reason string, ctx *ErrorContext) *GasEstimationError {
	return &GasEstimationError{
		SdkError:     NewSdkError(ErrGasEstimationFailed, message, nil, ctx),
		Operation:    operation,
		EstimatedGas: estimatedGas,
		AvailableGas: availableGas,
		Reason:       reason,
	}
}

// ConfigurationError represents a configuration error.
type ConfigurationError struct {
	*SdkError
	ParameterName string `json:"parameterName,omitempty"`
}

// NewConfigurationError creates a new configuration error.
func NewConfigurationError(message string, parameterName string, ctx *ErrorContext) *ConfigurationError {
	return &ConfigurationError{
		SdkError:      NewSdkError(ErrInvalidConfig, message, nil, ctx),
		ParameterName: parameterName,
	}
}

// ValidationError represents a validation error.
type ValidationError struct {
	*SdkError
	Field string      `json:"field,omitempty"`
	Value interface{} `json:"value,omitempty"`
}

// NewValidationError creates a new validation error.
func NewValidationError(message string, field string, value interface{}, ctx *ErrorContext) *ValidationError {
	return &ValidationError{
		SdkError: NewSdkError(ErrValidation, message, nil, ctx),
		Field:    field,
		Value:    value,
	}
}

// PaymasterError represents a paymaster error.
type PaymasterError struct {
	*SdkError
	PaymasterCode PaymasterErrorCode `json:"paymasterCode"`
	RPCCode       int                `json:"rpcCode,omitempty"`
	Reason        string             `json:"reason,omitempty"`
}

// IsRetryable returns whether the paymaster error is retryable.
func (e *PaymasterError) IsRetryable() bool {
	return e.PaymasterCode.IsRetryable()
}

// GetUserMessage returns a user-friendly message for paymaster errors.
func (e *PaymasterError) GetUserMessage() string {
	switch e.PaymasterCode {
	case PaymasterErrNotAvailable:
		return "Gas sponsorship is not available for this transaction."
	case PaymasterErrInsufficientBalance:
		return "The sponsor does not have sufficient balance."
	case PaymasterErrTokenNotSupported:
		return "This token is not supported for gas payment."
	case PaymasterErrInsufficientAllowance:
		return "Please approve the token for gas payment."
	case PaymasterErrTimeout:
		return "Paymaster service timed out. Please try again."
	case PaymasterErrHTTPError:
		return "Could not connect to paymaster service."
	default:
		if e.Message != "" {
			return e.Message
		}
		return "Paymaster error occurred."
	}
}

// NewPaymasterError creates a new paymaster error.
func NewPaymasterError(paymasterCode PaymasterErrorCode, message string, rpcCode int, reason string, ctx *ErrorContext) *PaymasterError {
	return &PaymasterError{
		SdkError:      NewSdkError(ErrPaymasterError, message, nil, ctx),
		PaymasterCode: paymasterCode,
		RPCCode:       rpcCode,
		Reason:        reason,
	}
}

// ModuleError represents a module-related error.
type ModuleError struct {
	*SdkError
	ModuleAddress types.Address    `json:"moduleAddress,omitempty"`
	ModuleType    types.ModuleType `json:"moduleType,omitempty"`
}

// NewModuleError creates a new module error.
func NewModuleError(code SdkErrorCode, message string, moduleAddress types.Address, moduleType types.ModuleType, ctx *ErrorContext) *ModuleError {
	return &ModuleError{
		SdkError:      NewSdkError(code, message, nil, ctx),
		ModuleAddress: moduleAddress,
		ModuleType:    moduleType,
	}
}

// Is checks if the target error matches the SdkError code.
func Is(err error, code SdkErrorCode) bool {
	if sdkErr, ok := err.(*SdkError); ok {
		return sdkErr.Code == code
	}
	if bundlerErr, ok := err.(*BundlerError); ok {
		return bundlerErr.Code == code
	}
	if userOpErr, ok := err.(*UserOperationError); ok {
		return userOpErr.Code == code
	}
	if txErr, ok := err.(*TransactionError); ok {
		return txErr.Code == code
	}
	if gasErr, ok := err.(*GasEstimationError); ok {
		return gasErr.Code == code
	}
	if cfgErr, ok := err.(*ConfigurationError); ok {
		return cfgErr.Code == code
	}
	if valErr, ok := err.(*ValidationError); ok {
		return valErr.Code == code
	}
	if pmErr, ok := err.(*PaymasterError); ok {
		return pmErr.Code == code
	}
	if modErr, ok := err.(*ModuleError); ok {
		return modErr.Code == code
	}
	return false
}

// IsBundlerError checks if the error is a bundler error with a specific code.
func IsBundlerError(err error, code BundlerErrorCode) bool {
	if bundlerErr, ok := err.(*BundlerError); ok {
		return bundlerErr.BundlerCode == code
	}
	return false
}

// IsPaymasterError checks if the error is a paymaster error with a specific code.
func IsPaymasterError(err error, code PaymasterErrorCode) bool {
	if pmErr, ok := err.(*PaymasterError); ok {
		return pmErr.PaymasterCode == code
	}
	return false
}
