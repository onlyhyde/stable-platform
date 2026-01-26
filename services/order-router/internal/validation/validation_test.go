package validation

import (
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidAmountOrZero(tt.amount); got != tt.want {
				t.Errorf("IsValidAmountOrZero(%q) = %v, want %v", tt.amount, got, tt.want)
			}
		})
	}
}

func TestIsValidSlippage(t *testing.T) {
	tests := []struct {
		name     string
		slippage float64
		want     bool
	}{
		{"zero", 0, true},
		{"valid 1%", 100, true},
		{"valid 100%", 10000, true},
		{"negative", -1, false},
		{"over 100%", 10001, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidSlippage(tt.slippage); got != tt.want {
				t.Errorf("IsValidSlippage(%v) = %v, want %v", tt.slippage, got, tt.want)
			}
		})
	}
}

func TestValidator(t *testing.T) {
	t.Run("no errors", func(t *testing.T) {
		v := NewValidator()
		v.ValidateEthereumAddress("0x1234567890abcdef1234567890abcdef12345678", "tokenIn")
		v.ValidateAmount("1000000", "amountIn")

		if v.HasErrors() {
			t.Errorf("expected no errors, got: %s", v.Error())
		}
	})

	t.Run("multiple errors", func(t *testing.T) {
		v := NewValidator()
		v.ValidateEthereumAddress("invalid", "tokenIn")
		v.ValidateAmount("-100", "amountIn")

		if !v.HasErrors() {
			t.Error("expected errors, got none")
		}

		errors := v.Errors()
		if len(errors) != 2 {
			t.Errorf("expected 2 errors, got %d", len(errors))
		}
	})

	t.Run("required field empty", func(t *testing.T) {
		v := NewValidator()
		v.ValidateRequired("", "field")

		if !v.HasErrors() {
			t.Error("expected error for empty required field")
		}
	})
}
