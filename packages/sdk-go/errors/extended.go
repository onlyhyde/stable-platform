// Package errors provides error types and codes for the StableNet Go SDK.
package errors

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Extended Error Codes
// ============================================================================

// Additional SDK error codes.
const (
	// Security errors
	ErrSecurityRisk        SdkErrorCode = "SECURITY_RISK"
	ErrPhishingDetected    SdkErrorCode = "PHISHING_DETECTED"
	ErrSuspiciousActivity  SdkErrorCode = "SUSPICIOUS_ACTIVITY"
	ErrRateLimitExceeded   SdkErrorCode = "RATE_LIMIT_EXCEEDED"
	ErrInvalidTypedData    SdkErrorCode = "INVALID_TYPED_DATA"

	// EIP-7702 errors
	ErrEIP7702NotSupported    SdkErrorCode = "EIP7702_NOT_SUPPORTED"
	ErrEIP7702InvalidAuth     SdkErrorCode = "EIP7702_INVALID_AUTH"
	ErrEIP7702DelegationFailed SdkErrorCode = "EIP7702_DELEGATION_FAILED"
	ErrEIP7702AlreadyDelegated SdkErrorCode = "EIP7702_ALREADY_DELEGATED"

	// Module errors (extended)
	ErrModuleUninstallFailed   SdkErrorCode = "MODULE_UNINSTALL_FAILED"
	ErrModuleAlreadyInstalled  SdkErrorCode = "MODULE_ALREADY_INSTALLED"
	ErrModuleNotSupported      SdkErrorCode = "MODULE_NOT_SUPPORTED"
	ErrModuleVersionMismatch   SdkErrorCode = "MODULE_VERSION_MISMATCH"

	// RPC errors (extended)
	ErrRPCMethodNotFound   SdkErrorCode = "RPC_METHOD_NOT_FOUND"
	ErrRPCInvalidParams    SdkErrorCode = "RPC_INVALID_PARAMS"
	ErrRPCInternalError    SdkErrorCode = "RPC_INTERNAL_ERROR"
	ErrRPCResourceNotFound SdkErrorCode = "RPC_RESOURCE_NOT_FOUND"

	// Chain errors
	ErrChainNotSupported   SdkErrorCode = "CHAIN_NOT_SUPPORTED"
	ErrChainMismatch       SdkErrorCode = "CHAIN_MISMATCH"
	ErrInsufficientBalance SdkErrorCode = "INSUFFICIENT_BALANCE"

	// Encoding errors
	ErrEncodingFailed SdkErrorCode = "ENCODING_FAILED"
	ErrDecodingFailed SdkErrorCode = "DECODING_FAILED"
	ErrABIError       SdkErrorCode = "ABI_ERROR"
)

// ============================================================================
// RPC Error
// ============================================================================

// RPCErrorCode represents JSON-RPC error codes.
type RPCErrorCode int

// Standard JSON-RPC error codes.
const (
	RPCErrParseError     RPCErrorCode = -32700
	RPCErrInvalidRequest RPCErrorCode = -32600
	RPCErrMethodNotFound RPCErrorCode = -32601
	RPCErrInvalidParams  RPCErrorCode = -32602
	RPCErrInternalError  RPCErrorCode = -32603

	// Custom RPC error codes
	RPCErrResourceNotFound RPCErrorCode = -32001
	RPCErrResourceUnavailable RPCErrorCode = -32002
	RPCErrTransactionRejected RPCErrorCode = -32003
	RPCErrExecutionError   RPCErrorCode = -32004
)

// RPCError represents a JSON-RPC error.
type RPCError struct {
	*SdkError
	RPCCode RPCErrorCode   `json:"rpcCode"`
	Data    interface{}    `json:"data,omitempty"`
}

// NewRPCError creates a new RPC error.
func NewRPCError(rpcCode RPCErrorCode, message string, data interface{}, ctx *ErrorContext) *RPCError {
	return &RPCError{
		SdkError: NewSdkError(ErrRPCError, message, nil, ctx),
		RPCCode:  rpcCode,
		Data:     data,
	}
}

// Error implements the error interface.
func (e *RPCError) Error() string {
	return fmt.Sprintf("%s [%d]: %s", e.Code, e.RPCCode, e.Message)
}

// ============================================================================
// Security Error
// ============================================================================

// SecurityError represents a security-related error.
type SecurityError struct {
	*SdkError
	RiskLevel   string   `json:"riskLevel"`
	RiskFactors []string `json:"riskFactors,omitempty"`
	Blocked     bool     `json:"blocked"`
}

// NewSecurityError creates a new security error.
func NewSecurityError(code SdkErrorCode, message string, riskLevel string, riskFactors []string, blocked bool, ctx *ErrorContext) *SecurityError {
	return &SecurityError{
		SdkError:    NewSdkError(code, message, nil, ctx),
		RiskLevel:   riskLevel,
		RiskFactors: riskFactors,
		Blocked:     blocked,
	}
}

// GetUserMessage returns a user-friendly message for security errors.
func (e *SecurityError) GetUserMessage() string {
	switch e.Code {
	case ErrPhishingDetected:
		return "Potential phishing attempt detected. Please verify the source."
	case ErrSecurityRisk:
		return fmt.Sprintf("Security risk detected (%s). Proceed with caution.", e.RiskLevel)
	case ErrSuspiciousActivity:
		return "Suspicious activity detected. Please review before proceeding."
	case ErrRateLimitExceeded:
		return "Too many requests. Please wait before trying again."
	default:
		return e.Message
	}
}

// ============================================================================
// EIP-7702 Error
// ============================================================================

// EIP7702Error represents an EIP-7702 delegation error.
type EIP7702Error struct {
	*SdkError
	DelegateAddress *types.Address `json:"delegateAddress,omitempty"`
	AuthorizationHash *types.Hash  `json:"authorizationHash,omitempty"`
	Reason          string         `json:"reason,omitempty"`
}

// NewEIP7702Error creates a new EIP-7702 error.
func NewEIP7702Error(code SdkErrorCode, message string, delegateAddress *types.Address, authHash *types.Hash, reason string, ctx *ErrorContext) *EIP7702Error {
	return &EIP7702Error{
		SdkError:          NewSdkError(code, message, nil, ctx),
		DelegateAddress:   delegateAddress,
		AuthorizationHash: authHash,
		Reason:            reason,
	}
}

// GetUserMessage returns a user-friendly message for EIP-7702 errors.
func (e *EIP7702Error) GetUserMessage() string {
	switch e.Code {
	case ErrEIP7702NotSupported:
		return "This network does not support EIP-7702 delegation."
	case ErrEIP7702InvalidAuth:
		return "Invalid authorization signature."
	case ErrEIP7702DelegationFailed:
		return "Failed to delegate account. " + e.Reason
	case ErrEIP7702AlreadyDelegated:
		return "Account is already delegated."
	default:
		return e.Message
	}
}

// ============================================================================
// Error Collection
// ============================================================================

// ErrorCollection aggregates multiple errors.
type ErrorCollection struct {
	Errors []error `json:"errors"`
}

// NewErrorCollection creates a new error collection.
func NewErrorCollection() *ErrorCollection {
	return &ErrorCollection{
		Errors: make([]error, 0),
	}
}

// Add adds an error to the collection.
func (c *ErrorCollection) Add(err error) {
	if err != nil {
		c.Errors = append(c.Errors, err)
	}
}

// HasErrors returns true if the collection has errors.
func (c *ErrorCollection) HasErrors() bool {
	return len(c.Errors) > 0
}

// Error implements the error interface.
func (c *ErrorCollection) Error() string {
	if len(c.Errors) == 0 {
		return ""
	}
	if len(c.Errors) == 1 {
		return c.Errors[0].Error()
	}

	messages := make([]string, len(c.Errors))
	for i, err := range c.Errors {
		messages[i] = err.Error()
	}
	return fmt.Sprintf("multiple errors: [%s]", strings.Join(messages, "; "))
}

// First returns the first error or nil.
func (c *ErrorCollection) First() error {
	if len(c.Errors) > 0 {
		return c.Errors[0]
	}
	return nil
}

// ToError returns the collection as an error or nil if empty.
func (c *ErrorCollection) ToError() error {
	if len(c.Errors) == 0 {
		return nil
	}
	return c
}

// ============================================================================
// Error Result
// ============================================================================

// ErrorResult wraps an error with additional metadata.
type ErrorResult struct {
	Error       error         `json:"error"`
	Code        SdkErrorCode  `json:"code"`
	Message     string        `json:"message"`
	Timestamp   time.Time     `json:"timestamp"`
	RequestID   string        `json:"requestId,omitempty"`
	TraceID     string        `json:"traceId,omitempty"`
	Recoverable bool          `json:"recoverable"`
	Suggestions []string      `json:"suggestions,omitempty"`
}

// NewErrorResult creates a new error result.
func NewErrorResult(err error) *ErrorResult {
	result := &ErrorResult{
		Error:     err,
		Timestamp: time.Now(),
	}

	// Extract code and message from SDK errors
	if sdkErr, ok := err.(*SdkError); ok {
		result.Code = sdkErr.Code
		result.Message = sdkErr.Message
		result.Recoverable = sdkErr.IsRetryable()
	} else if bundlerErr, ok := err.(*BundlerError); ok {
		result.Code = bundlerErr.Code
		result.Message = bundlerErr.Message
		result.Recoverable = bundlerErr.IsRetryable()
	} else if pmErr, ok := err.(*PaymasterError); ok {
		result.Code = pmErr.Code
		result.Message = pmErr.Message
		result.Recoverable = pmErr.IsRetryable()
	} else {
		result.Code = ErrUnknown
		result.Message = err.Error()
	}

	return result
}

// WithRequestID sets the request ID.
func (r *ErrorResult) WithRequestID(id string) *ErrorResult {
	r.RequestID = id
	return r
}

// WithTraceID sets the trace ID.
func (r *ErrorResult) WithTraceID(id string) *ErrorResult {
	r.TraceID = id
	return r
}

// WithSuggestions sets recovery suggestions.
func (r *ErrorResult) WithSuggestions(suggestions ...string) *ErrorResult {
	r.Suggestions = suggestions
	return r
}

// ToJSON returns the error result as JSON.
func (r *ErrorResult) ToJSON() ([]byte, error) {
	return json.Marshal(r)
}

// ============================================================================
// Error Helpers
// ============================================================================

// GetErrorCode extracts the error code from any error type.
func GetErrorCode(err error) SdkErrorCode {
	switch e := err.(type) {
	case *SdkError:
		return e.Code
	case *BundlerError:
		return e.Code
	case *PaymasterError:
		return e.Code
	case *UserOperationError:
		return e.Code
	case *TransactionError:
		return e.Code
	case *GasEstimationError:
		return e.Code
	case *ConfigurationError:
		return e.Code
	case *ValidationError:
		return e.Code
	case *ModuleError:
		return e.Code
	case *RPCError:
		return e.Code
	case *SecurityError:
		return e.Code
	case *EIP7702Error:
		return e.Code
	default:
		return ErrUnknown
	}
}

// GetUserMessage extracts a user-friendly message from any error type.
func GetUserMessage(err error) string {
	switch e := err.(type) {
	case *SdkError:
		return e.GetUserMessage()
	case *BundlerError:
		return e.GetUserMessage()
	case *PaymasterError:
		return e.GetUserMessage()
	case *SecurityError:
		return e.GetUserMessage()
	case *EIP7702Error:
		return e.GetUserMessage()
	default:
		return err.Error()
	}
}

// IsRetryableError checks if any error type is retryable.
func IsRetryableError(err error) bool {
	switch e := err.(type) {
	case *SdkError:
		return e.IsRetryable()
	case *BundlerError:
		return e.IsRetryable()
	case *PaymasterError:
		return e.IsRetryable()
	default:
		return false
	}
}

// IsNetworkError checks if the error is a network-related error.
func IsNetworkError(err error) bool {
	code := GetErrorCode(err)
	return code == ErrNetworkError || code == ErrRPCError || code == ErrTimeout
}

// IsSecurityError checks if the error is a security-related error.
func IsSecurityError(err error) bool {
	code := GetErrorCode(err)
	return code == ErrSecurityRisk || code == ErrPhishingDetected ||
		code == ErrSuspiciousActivity || code == ErrRateLimitExceeded
}

// IsModuleError checks if the error is a module-related error.
func IsModuleError(err error) bool {
	code := GetErrorCode(err)
	return code == ErrModuleNotInstalled || code == ErrModuleInstallFailed ||
		code == ErrModuleUninstallFailed || code == ErrModuleAlreadyInstalled ||
		code == ErrInvalidModuleConfig || code == ErrModuleNotSupported
}

// IsEIP7702Error checks if the error is an EIP-7702 error.
func IsEIP7702Error(err error) bool {
	code := GetErrorCode(err)
	return code == ErrEIP7702NotSupported || code == ErrEIP7702InvalidAuth ||
		code == ErrEIP7702DelegationFailed || code == ErrEIP7702AlreadyDelegated
}

// ============================================================================
// Error Context Builder
// ============================================================================

// ErrorContextBuilder helps build error context.
type ErrorContextBuilder struct {
	ctx *ErrorContext
}

// NewErrorContextBuilder creates a new error context builder.
func NewErrorContextBuilder() *ErrorContextBuilder {
	return &ErrorContextBuilder{
		ctx: &ErrorContext{
			Timestamp: time.Now().UnixMilli(),
		},
	}
}

// WithChainID sets the chain ID.
func (b *ErrorContextBuilder) WithChainID(chainID types.ChainID) *ErrorContextBuilder {
	b.ctx.ChainID = chainID
	return b
}

// WithOperation sets the operation name.
func (b *ErrorContextBuilder) WithOperation(operation string) *ErrorContextBuilder {
	b.ctx.Operation = operation
	return b
}

// Build returns the error context.
func (b *ErrorContextBuilder) Build() *ErrorContext {
	return b.ctx
}
