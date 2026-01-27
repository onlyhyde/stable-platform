package validation

import (
	"strings"
	"testing"
)

func TestIsValidEthereumAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{"valid lowercase", "0x1234567890abcdef1234567890abcdef12345678", true},
		{"valid uppercase", "0x1234567890ABCDEF1234567890ABCDEF12345678", true},
		{"valid mixed case", "0x1234567890AbCdEf1234567890aBcDeF12345678", true},
		{"empty", "", false},
		{"no prefix", "1234567890abcdef1234567890abcdef12345678", false},
		{"too short", "0x1234567890abcdef1234567890abcdef1234567", false},
		{"too long", "0x1234567890abcdef1234567890abcdef123456789", false},
		{"invalid chars", "0x1234567890abcdef1234567890abcdef1234567g", false},
		{"just prefix", "0x", false},
		{"spaces", " 0x1234567890abcdef1234567890abcdef12345678 ", false},
		{"null address", "0x0000000000000000000000000000000000000000", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidEthereumAddress(tt.address); got != tt.want {
				t.Errorf("IsValidEthereumAddress(%q) = %v, want %v", tt.address, got, tt.want)
			}
		})
	}
}

func TestIsValidAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount string
		want   bool
	}{
		{"positive integer", "1000000", true},
		{"one", "1", true},
		{"large number", "115792089237316195423570985008687907853269984665640564039457584007913129639935", true},
		{"zero", "0", false},
		{"negative", "-100", false},
		{"empty", "", false},
		{"float", "100.5", false},
		{"hex", "0x100", false},
		{"text", "abc", false},
		{"spaces", " 100 ", false},
		{"leading zeros", "0001000", true}, // big.Int handles this
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidAmount(tt.amount); got != tt.want {
				t.Errorf("IsValidAmount(%q) = %v, want %v", tt.amount, got, tt.want)
			}
		})
	}
}

func TestIsValidAmountOrZero(t *testing.T) {
	tests := []struct {
		name   string
		amount string
		want   bool
	}{
		{"positive integer", "1000000", true},
		{"zero", "0", true},
		{"negative", "-100", false},
		{"empty", "", false},
		{"large number", "999999999999999999999999999999", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidAmountOrZero(tt.amount); got != tt.want {
				t.Errorf("IsValidAmountOrZero(%q) = %v, want %v", tt.amount, got, tt.want)
			}
		})
	}
}

func TestIsValidHexString(t *testing.T) {
	tests := []struct {
		name string
		hex  string
		want bool
	}{
		{"valid hex", "0x1234abcd", true},
		{"valid empty hex", "0x", true},
		{"valid long hex", "0xabcdef1234567890", true},
		{"uppercase hex", "0xABCDEF", true},
		{"mixed case", "0xAbCdEf", true},
		{"empty", "", false},
		{"no prefix", "1234abcd", false},
		{"invalid chars", "0x123g", false},
		{"spaces", "0x 1234", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidHexString(tt.hex); got != tt.want {
				t.Errorf("IsValidHexString(%q) = %v, want %v", tt.hex, got, tt.want)
			}
		})
	}
}

func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		fieldName string
		wantErr   bool
	}{
		{"non-empty", "value", "field", false},
		{"empty", "", "field", true},
		{"whitespace only", "   ", "field", true},
		{"tabs and spaces", "\t  \n", "field", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRequired(tt.value, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRequired() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && err.Field != tt.fieldName {
				t.Errorf("ValidateRequired() field = %s, want %s", err.Field, tt.fieldName)
			}
		})
	}
}

func TestValidateEthereumAddress(t *testing.T) {
	tests := []struct {
		name      string
		address   string
		fieldName string
		wantErr   bool
	}{
		{"valid address", "0x1234567890abcdef1234567890abcdef12345678", "recipient", false},
		{"empty address", "", "recipient", true},
		{"invalid address", "not-an-address", "recipient", true},
		{"too short", "0x1234", "recipient", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEthereumAddress(tt.address, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateEthereumAddress() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && err.Field != tt.fieldName {
				t.Errorf("ValidateEthereumAddress() field = %s, want %s", err.Field, tt.fieldName)
			}
		})
	}
}

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		name      string
		amount    string
		fieldName string
		wantErr   bool
	}{
		{"valid amount", "1000000", "amount", false},
		{"empty amount", "", "amount", true},
		{"zero amount", "0", "amount", true},
		{"negative amount", "-100", "amount", true},
		{"invalid amount", "not-a-number", "amount", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAmount(tt.amount, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAmount() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && err.Field != tt.fieldName {
				t.Errorf("ValidateAmount() field = %s, want %s", err.Field, tt.fieldName)
			}
		})
	}
}

func TestValidationError_Error(t *testing.T) {
	err := &ValidationError{
		Field:   "amount",
		Message: "must be positive",
	}

	expected := "amount: must be positive"
	if err.Error() != expected {
		t.Errorf("Error() = %s, want %s", err.Error(), expected)
	}
}

func TestValidationErrors_Error(t *testing.T) {
	tests := []struct {
		name   string
		errors ValidationErrors
		want   string
	}{
		{
			name:   "empty errors",
			errors: ValidationErrors{},
			want:   "",
		},
		{
			name: "single error",
			errors: ValidationErrors{
				{Field: "amount", Message: "is required"},
			},
			want: "amount: is required",
		},
		{
			name: "multiple errors",
			errors: ValidationErrors{
				{Field: "amount", Message: "is required"},
				{Field: "recipient", Message: "must be valid address"},
			},
			want: "amount: is required; recipient: must be valid address",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.errors.Error(); got != tt.want {
				t.Errorf("Error() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestValidationErrors_IsEmpty(t *testing.T) {
	empty := ValidationErrors{}
	if !empty.IsEmpty() {
		t.Error("expected IsEmpty() = true for empty errors")
	}

	notEmpty := ValidationErrors{{Field: "test", Message: "error"}}
	if notEmpty.IsEmpty() {
		t.Error("expected IsEmpty() = false for non-empty errors")
	}
}

func TestValidator_Basic(t *testing.T) {
	v := NewValidator()
	if v == nil {
		t.Fatal("expected validator to be created")
	}
	if v.HasErrors() {
		t.Error("expected no errors initially")
	}
}

func TestValidator_AddError(t *testing.T) {
	v := NewValidator()

	// Add nil error (should be ignored)
	v.AddError(nil)
	if v.HasErrors() {
		t.Error("expected no errors after adding nil")
	}

	// Add actual error
	v.AddError(&ValidationError{Field: "test", Message: "error"})
	if !v.HasErrors() {
		t.Error("expected errors after adding error")
	}

	errors := v.Errors()
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
}

func TestValidator_Chaining(t *testing.T) {
	v := NewValidator()

	// Chain multiple validations
	v.ValidateEthereumAddress("0x1234567890abcdef1234567890abcdef12345678", "from").
		ValidateEthereumAddress("0xabcdef1234567890abcdef1234567890abcdef12", "to").
		ValidateAmount("1000000", "amount")

	if v.HasErrors() {
		t.Errorf("expected no errors for valid inputs, got: %s", v.Error())
	}
}

func TestValidator_ChainWithErrors(t *testing.T) {
	v := NewValidator()

	// Chain with invalid inputs
	v.ValidateEthereumAddress("invalid", "from").
		ValidateAmount("-100", "amount").
		ValidateRequired("", "field")

	if !v.HasErrors() {
		t.Error("expected errors for invalid inputs")
	}

	errors := v.Errors()
	if len(errors) != 3 {
		t.Errorf("expected 3 errors, got %d", len(errors))
	}

	// Verify all errors are present
	errorStr := v.Error()
	if !strings.Contains(errorStr, "from") {
		t.Error("expected 'from' in error string")
	}
	if !strings.Contains(errorStr, "amount") {
		t.Error("expected 'amount' in error string")
	}
	if !strings.Contains(errorStr, "field") {
		t.Error("expected 'field' in error string")
	}
}

func TestValidator_ValidateRequired(t *testing.T) {
	v := NewValidator()
	v.ValidateRequired("", "requiredField")

	if !v.HasErrors() {
		t.Error("expected error for empty required field")
	}

	errors := v.Errors()
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
	if errors[0].Field != "requiredField" {
		t.Errorf("expected field 'requiredField', got %s", errors[0].Field)
	}
}

func TestValidator_Error(t *testing.T) {
	v := NewValidator()

	// Empty validator
	if v.Error() != "" {
		t.Errorf("expected empty error string, got: %s", v.Error())
	}

	// With errors
	v.AddError(&ValidationError{Field: "test", Message: "error"})
	if v.Error() == "" {
		t.Error("expected non-empty error string")
	}
}
