package validation

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"
)

var (
	// ethereumAddressRegex matches valid Ethereum addresses (0x + 40 hex chars)
	ethereumAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

	// hexRegex matches valid hex strings
	hexRegex = regexp.MustCompile(`^0x[a-fA-F0-9]*$`)
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors represents multiple validation errors
type ValidationErrors []ValidationError

func (e ValidationErrors) Error() string {
	if len(e) == 0 {
		return ""
	}
	var msgs []string
	for _, err := range e {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

// IsEmpty returns true if there are no validation errors
func (e ValidationErrors) IsEmpty() bool {
	return len(e) == 0
}

// IsValidEthereumAddress checks if a string is a valid Ethereum address
func IsValidEthereumAddress(address string) bool {
	if address == "" {
		return false
	}
	return ethereumAddressRegex.MatchString(address)
}

// IsValidAmount checks if a string is a valid positive integer amount
func IsValidAmount(amount string) bool {
	if amount == "" {
		return false
	}

	// Try to parse as big.Int
	n := new(big.Int)
	_, ok := n.SetString(amount, 10)
	if !ok {
		return false
	}

	// Must be positive (> 0)
	return n.Sign() > 0
}

// IsValidAmountOrZero checks if a string is a valid non-negative integer amount
func IsValidAmountOrZero(amount string) bool {
	if amount == "" {
		return false
	}

	// Try to parse as big.Int
	n := new(big.Int)
	_, ok := n.SetString(amount, 10)
	if !ok {
		return false
	}

	// Must be non-negative (>= 0)
	return n.Sign() >= 0
}

// IsValidHexString checks if a string is a valid hex string with 0x prefix
func IsValidHexString(hex string) bool {
	if hex == "" {
		return false
	}
	return hexRegex.MatchString(hex)
}

// ValidateRequired checks if a required field is present
func ValidateRequired(value, fieldName string) *ValidationError {
	if strings.TrimSpace(value) == "" {
		return &ValidationError{
			Field:   fieldName,
			Message: "is required",
		}
	}
	return nil
}

// ValidateEthereumAddress validates an Ethereum address field
func ValidateEthereumAddress(address, fieldName string) *ValidationError {
	if address == "" {
		return &ValidationError{
			Field:   fieldName,
			Message: "is required",
		}
	}
	if !IsValidEthereumAddress(address) {
		return &ValidationError{
			Field:   fieldName,
			Message: "must be a valid Ethereum address (0x + 40 hex characters)",
		}
	}
	return nil
}

// ValidateAmount validates an amount field (must be positive integer string)
func ValidateAmount(amount, fieldName string) *ValidationError {
	if amount == "" {
		return &ValidationError{
			Field:   fieldName,
			Message: "is required",
		}
	}
	if !IsValidAmount(amount) {
		return &ValidationError{
			Field:   fieldName,
			Message: "must be a positive integer",
		}
	}
	return nil
}

// Validator helps collect validation errors
type Validator struct {
	errors ValidationErrors
}

// NewValidator creates a new validator
func NewValidator() *Validator {
	return &Validator{
		errors: make(ValidationErrors, 0),
	}
}

// AddError adds an error if not nil
func (v *Validator) AddError(err *ValidationError) {
	if err != nil {
		v.errors = append(v.errors, *err)
	}
}

// ValidateEthereumAddress validates and adds error if invalid
func (v *Validator) ValidateEthereumAddress(address, fieldName string) *Validator {
	v.AddError(ValidateEthereumAddress(address, fieldName))
	return v
}

// ValidateAmount validates and adds error if invalid
func (v *Validator) ValidateAmount(amount, fieldName string) *Validator {
	v.AddError(ValidateAmount(amount, fieldName))
	return v
}

// ValidateRequired validates and adds error if empty
func (v *Validator) ValidateRequired(value, fieldName string) *Validator {
	v.AddError(ValidateRequired(value, fieldName))
	return v
}

// Errors returns all collected validation errors
func (v *Validator) Errors() ValidationErrors {
	return v.errors
}

// HasErrors returns true if there are validation errors
func (v *Validator) HasErrors() bool {
	return len(v.errors) > 0
}

// Error returns the error string or empty if no errors
func (v *Validator) Error() string {
	return v.errors.Error()
}
