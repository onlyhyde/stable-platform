// Package security provides security utilities for input validation and risk analysis.
package security

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// ============================================================================
// Validation Result
// ============================================================================

// ValidationResult contains the result of input validation.
type ValidationResult struct {
	// IsValid indicates whether the input is valid.
	IsValid bool `json:"isValid"`

	// Errors contains validation error messages.
	Errors []string `json:"errors"`

	// Warnings contains non-critical warning messages.
	Warnings []string `json:"warnings,omitempty"`

	// NormalizedValue contains the normalized/sanitized value.
	NormalizedValue any `json:"normalizedValue,omitempty"`
}

// ============================================================================
// Validation Options
// ============================================================================

// HexValidationOptions configures hex string validation.
type HexValidationOptions struct {
	// RequirePrefix requires the 0x prefix.
	RequirePrefix bool

	// ExactLength requires an exact length (including 0x prefix).
	ExactLength int

	// MinLength requires a minimum length.
	MinLength int

	// MaxLength requires a maximum length.
	MaxLength int
}

// SanitizeOptions configures string sanitization.
type SanitizeOptions struct {
	// MaxLength is the maximum allowed length.
	MaxLength int

	// EscapeHtml escapes HTML entities.
	EscapeHtml bool
}

// ============================================================================
// Transaction Object
// ============================================================================

// TransactionObject represents a transaction for validation.
type TransactionObject struct {
	From                 string `json:"from,omitempty"`
	To                   string `json:"to,omitempty"`
	Value                string `json:"value,omitempty"`
	Gas                  string `json:"gas,omitempty"`
	GasPrice             string `json:"gasPrice,omitempty"`
	MaxFeePerGas         string `json:"maxFeePerGas,omitempty"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas,omitempty"`
	Data                 string `json:"data,omitempty"`
	Nonce                string `json:"nonce,omitempty"`
}

// RpcRequestObject represents an RPC request for validation.
type RpcRequestObject struct {
	Jsonrpc string `json:"jsonrpc,omitempty"`
	Method  string `json:"method,omitempty"`
	Params  any    `json:"params,omitempty"`
	Id      any    `json:"id,omitempty"`
}

// ============================================================================
// Input Validator
// ============================================================================

// InputValidator provides comprehensive input validation for wallet security.
type InputValidator struct{}

// NewInputValidator creates a new InputValidator.
func NewInputValidator() *InputValidator {
	return &InputValidator{}
}

// ValidateAddress validates an Ethereum address.
func (v *InputValidator) ValidateAddress(address string) *ValidationResult {
	errors := []string{}
	warnings := []string{}

	// Check for empty
	if address == "" {
		return &ValidationResult{
			IsValid: false,
			Errors:  []string{"Address is required"},
		}
	}

	// Check prefix
	if !strings.HasPrefix(address, "0x") {
		errors = append(errors, "Address must start with 0x")
	}

	// Check length
	if len(address) != 42 {
		errors = append(errors, "Address must be 42 characters")
	}

	// Check for valid hex characters
	if len(address) > 2 {
		hexPart := address[2:]
		matched, _ := regexp.MatchString(`^[0-9a-fA-F]*$`, hexPart)
		if !matched {
			errors = append(errors, "Address contains invalid characters")
		}
	}

	// Validate EIP-55 checksum for mixed case addresses
	if len(errors) == 0 {
		hexPart := address[2:]
		lowerCase := strings.ToLower(hexPart)
		upperCase := strings.ToUpper(hexPart)
		isMixedCase := hexPart != lowerCase && hexPart != upperCase

		if isMixedCase {
			// Verify checksum using go-ethereum's implementation
			checksumAddr := common.HexToAddress(address)
			if checksumAddr.Hex() != address {
				warnings = append(warnings, "Address has mixed case but invalid EIP-55 checksum")
				errors = append(errors, "Address has invalid EIP-55 checksum")
			}
		}
	}

	var normalizedValue any
	if len(errors) == 0 {
		checksumAddr := common.HexToAddress(address)
		normalizedValue = checksumAddr.Hex()
	}

	return &ValidationResult{
		IsValid:         len(errors) == 0,
		Errors:          errors,
		Warnings:        warnings,
		NormalizedValue: normalizedValue,
	}
}

// ValidateHex validates a hex string.
func (v *InputValidator) ValidateHex(hex string, options *HexValidationOptions) *ValidationResult {
	if options == nil {
		options = &HexValidationOptions{RequirePrefix: true}
	}

	errors := []string{}

	// Check for empty
	if hex == "" {
		return &ValidationResult{
			IsValid: false,
			Errors:  []string{"Hex string is required"},
		}
	}

	// Check prefix
	hasPrefix := strings.HasPrefix(hex, "0x")
	if options.RequirePrefix && !hasPrefix {
		errors = append(errors, "Hex string must start with 0x")
	}

	// Get hex content
	hexContent := hex
	if hasPrefix {
		hexContent = hex[2:]
	}
	fullLength := len(hex)
	if !hasPrefix {
		fullLength += 2
	}

	// Check for valid hex characters
	matched, _ := regexp.MatchString(`^[0-9a-fA-F]*$`, hexContent)
	if !matched {
		errors = append(errors, "Invalid hex characters")
	}

	// Check exact length
	if options.ExactLength > 0 && fullLength != options.ExactLength {
		errors = append(errors, "Hex string must be exactly "+strconv.Itoa(options.ExactLength)+" characters")
	}

	// Check minimum length
	if options.MinLength > 0 && fullLength < options.MinLength {
		errors = append(errors, "Hex string must be at least "+strconv.Itoa(options.MinLength)+" characters")
	}

	// Check maximum length
	if options.MaxLength > 0 && fullLength > options.MaxLength {
		errors = append(errors, "Hex string must be at most "+strconv.Itoa(options.MaxLength)+" characters")
	}

	var normalizedValue any
	if len(errors) == 0 {
		if hasPrefix {
			normalizedValue = strings.ToLower(hex)
		} else {
			normalizedValue = strings.ToLower("0x" + hex)
		}
	}

	return &ValidationResult{
		IsValid:         len(errors) == 0,
		Errors:          errors,
		NormalizedValue: normalizedValue,
	}
}

// ValidateChainId validates a chain ID.
func (v *InputValidator) ValidateChainId(chainId any) *ValidationResult {
	errors := []string{}
	var normalizedValue int64

	switch cid := chainId.(type) {
	case string:
		if strings.HasPrefix(cid, "0x") {
			val, err := strconv.ParseInt(cid[2:], 16, 64)
			if err != nil {
				return &ValidationResult{
					IsValid: false,
					Errors:  []string{"Invalid chain ID format"},
				}
			}
			normalizedValue = val
		} else {
			val, err := strconv.ParseInt(cid, 10, 64)
			if err != nil {
				return &ValidationResult{
					IsValid: false,
					Errors:  []string{"Invalid chain ID format"},
				}
			}
			normalizedValue = val
		}
	case int:
		normalizedValue = int64(cid)
	case int64:
		normalizedValue = cid
	case uint64:
		normalizedValue = int64(cid)
	case float64:
		normalizedValue = int64(cid)
	default:
		return &ValidationResult{
			IsValid: false,
			Errors:  []string{"Chain ID must be a number or string"},
		}
	}

	// Check if positive
	if normalizedValue <= 0 {
		errors = append(errors, "Chain ID must be positive")
	}

	return &ValidationResult{
		IsValid:         len(errors) == 0,
		Errors:          errors,
		NormalizedValue: normalizedValue,
	}
}

// ValidateTransaction validates a transaction object.
func (v *InputValidator) ValidateTransaction(tx *TransactionObject) *ValidationResult {
	errors := []string{}
	warnings := []string{}

	// Check for from address (required)
	if tx.From == "" {
		errors = append(errors, "Transaction must have a from address")
	} else {
		fromResult := v.ValidateAddress(tx.From)
		if !fromResult.IsValid {
			errors = append(errors, "Invalid from address: "+strings.Join(fromResult.Errors, ", "))
		}
	}

	// Check to address (optional for contract deployment)
	if tx.To != "" {
		toResult := v.ValidateAddress(tx.To)
		if !toResult.IsValid {
			errors = append(errors, "Invalid to address: "+strings.Join(toResult.Errors, ", "))
		}
	} else if tx.Data == "" || tx.Data == "0x" {
		warnings = append(warnings, "Transaction has no to address and no data - this may fail")
	}

	// Validate value if present
	if tx.Value != "" {
		valueResult := v.ValidateHex(tx.Value, nil)
		if !valueResult.IsValid {
			errors = append(errors, "Invalid value: "+strings.Join(valueResult.Errors, ", "))
		}
	}

	// Validate gas if present
	if tx.Gas != "" {
		gasResult := v.ValidateHex(tx.Gas, nil)
		if !gasResult.IsValid {
			errors = append(errors, "Invalid gas: "+strings.Join(gasResult.Errors, ", "))
		}
	}

	// Validate gasPrice if present
	if tx.GasPrice != "" {
		gasPriceResult := v.ValidateHex(tx.GasPrice, nil)
		if !gasPriceResult.IsValid {
			errors = append(errors, "Invalid gasPrice: "+strings.Join(gasPriceResult.Errors, ", "))
		}
	}

	// Validate maxFeePerGas if present
	if tx.MaxFeePerGas != "" {
		maxFeeResult := v.ValidateHex(tx.MaxFeePerGas, nil)
		if !maxFeeResult.IsValid {
			errors = append(errors, "Invalid maxFeePerGas: "+strings.Join(maxFeeResult.Errors, ", "))
		}
	}

	// Validate maxPriorityFeePerGas if present
	if tx.MaxPriorityFeePerGas != "" {
		maxPriorityResult := v.ValidateHex(tx.MaxPriorityFeePerGas, nil)
		if !maxPriorityResult.IsValid {
			errors = append(errors, "Invalid maxPriorityFeePerGas: "+strings.Join(maxPriorityResult.Errors, ", "))
		}
	}

	// Validate data if present
	if tx.Data != "" && tx.Data != "0x" {
		dataResult := v.ValidateHex(tx.Data, nil)
		if !dataResult.IsValid {
			errors = append(errors, "Invalid data: "+strings.Join(dataResult.Errors, ", "))
		}
	}

	// Validate nonce if present
	if tx.Nonce != "" {
		nonceResult := v.ValidateHex(tx.Nonce, nil)
		if !nonceResult.IsValid {
			errors = append(errors, "Invalid nonce: "+strings.Join(nonceResult.Errors, ", "))
		}
	}

	return &ValidationResult{
		IsValid:  len(errors) == 0,
		Errors:   errors,
		Warnings: warnings,
	}
}

// ValidateRpcRequest validates an RPC request object.
func (v *InputValidator) ValidateRpcRequest(request *RpcRequestObject) *ValidationResult {
	errors := []string{}

	// Check for method (required)
	if request.Method == "" {
		errors = append(errors, "RPC request must have a method")
	}

	// Check params if present
	if request.Params != nil {
		if _, ok := request.Params.([]any); !ok {
			if _, ok := request.Params.([]interface{}); !ok {
				errors = append(errors, "Params must be an array")
			}
		}
	}

	// Check id if present
	if request.Id != nil {
		switch request.Id.(type) {
		case int, int64, float64, string:
			// Valid types
		default:
			errors = append(errors, "ID must be a number or string")
		}
	}

	return &ValidationResult{
		IsValid: len(errors) == 0,
		Errors:  errors,
	}
}

// SanitizeString sanitizes string input.
func (v *InputValidator) SanitizeString(input string, options *SanitizeOptions) string {
	if options == nil {
		options = &SanitizeOptions{MaxLength: 10000, EscapeHtml: true}
	}

	result := input

	// Remove null bytes
	result = strings.ReplaceAll(result, "\x00", "")

	// Trim whitespace
	result = strings.TrimSpace(result)

	// Limit length
	maxLength := options.MaxLength
	if maxLength <= 0 {
		maxLength = 10000
	}
	if len(result) > maxLength {
		result = result[:maxLength]
	}

	// Escape HTML if enabled
	if options.EscapeHtml {
		result = strings.ReplaceAll(result, "&", "&amp;")
		result = strings.ReplaceAll(result, "<", "&lt;")
		result = strings.ReplaceAll(result, ">", "&gt;")
		result = strings.ReplaceAll(result, "\"", "&quot;")
		result = strings.ReplaceAll(result, "'", "&#039;")
	}

	return result
}

// ============================================================================
// Utility Functions
// ============================================================================

// Default validator instance
var defaultValidator = NewInputValidator()

// IsValidAddress checks if an address is valid.
func IsValidAddress(address string) bool {
	return defaultValidator.ValidateAddress(address).IsValid
}

// IsValidHex checks if a hex string is valid.
func IsValidHex(hex string, options *HexValidationOptions) bool {
	return defaultValidator.ValidateHex(hex, options).IsValid
}

// IsValidChainId checks if a chain ID is valid.
func IsValidChainId(chainId any) bool {
	return defaultValidator.ValidateChainId(chainId).IsValid
}

// IsValidTransactionObject checks if a transaction object is valid.
func IsValidTransactionObject(tx *TransactionObject) bool {
	return defaultValidator.ValidateTransaction(tx).IsValid
}

// IsValidRpcRequest checks if an RPC request is valid.
func IsValidRpcRequest(request *RpcRequestObject) bool {
	return defaultValidator.ValidateRpcRequest(request).IsValid
}

// SanitizeString sanitizes a string using the default validator.
func SanitizeString(input string, options *SanitizeOptions) string {
	return defaultValidator.SanitizeString(input, options)
}
