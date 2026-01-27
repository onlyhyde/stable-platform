package service

import (
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

func TestValidateLuhn(t *testing.T) {
	tests := []struct {
		name      string
		cardNum   string
		wantErr   bool
	}{
		// Valid test card numbers (from Stripe test cards)
		{"Valid Visa", "4242424242424242", false},
		{"Valid Visa with spaces", "4242 4242 4242 4242", false},
		{"Valid Visa with dashes", "4242-4242-4242-4242", false},
		{"Valid Mastercard", "5555555555554444", false},
		{"Valid AmEx", "378282246310005", false},
		{"Valid AmEx 2", "371449635398431", false},
		{"Valid Discover", "6011111111111117", false},
		{"Valid Visa 13 digit", "4222222222222", false},

		// Invalid card numbers
		{"Invalid checksum", "4242424242424241", true},
		{"Invalid all zeros", "0000000000000000", true},
		{"Too short", "424242424242", true},
		{"Too long", "42424242424242424242", true},
		{"Empty", "", true},
		{"Invalid characters only", "abcdefghijklm", true},
		{"Single digit", "4", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateLuhn(tt.cardNum)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateLuhn(%q) error = %v, wantErr %v", tt.cardNum, err, tt.wantErr)
			}
		})
	}
}

func TestValidateCVV(t *testing.T) {
	tests := []struct {
		name    string
		cvv     string
		brand   string
		wantErr bool
	}{
		// Valid CVV
		{"Valid 3-digit CVV for Visa", "123", "visa", false},
		{"Valid 3-digit CVV for Mastercard", "456", "mastercard", false},
		{"Valid 3-digit CVV for Discover", "789", "discover", false},
		{"Valid 4-digit CVV for AmEx", "1234", "amex", false},

		// Invalid CVV
		{"Too short for Visa", "12", "visa", true},
		{"Too long for Visa", "1234", "visa", true},
		{"Too short for AmEx", "123", "amex", true},
		{"Too long for AmEx", "12345", "amex", true},
		{"Empty CVV", "", "visa", true},
		{"CVV with letters", "12a", "visa", true},
		{"CVV with spaces", "1 3", "visa", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCVV(tt.cvv, tt.brand)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCVV(%q, %q) error = %v, wantErr %v", tt.cvv, tt.brand, err, tt.wantErr)
			}
		})
	}
}

func TestValidateExpiry(t *testing.T) {
	now := time.Now()
	currentYear := now.Year()
	currentMonth := int(now.Month())

	// Calculate next month for valid test case
	nextMonth := currentMonth + 1
	nextMonthYear := currentYear
	if nextMonth > 12 {
		nextMonth = 1
		nextMonthYear++
	}

	// Calculate previous month for expired test case
	prevMonth := currentMonth - 1
	prevMonthYear := currentYear
	if prevMonth < 1 {
		prevMonth = 12
		prevMonthYear--
	}

	tests := []struct {
		name      string
		expMonth  string
		expYear   string
		wantErr   bool
	}{
		// Valid expiry
		{"Current month (valid until end of month)", intToStr(currentMonth), intToStr(currentYear), false},
		{"Next month", intToStr(nextMonth), intToStr(nextMonthYear), false},
		{"Next year", "12", intToStr(currentYear + 1), false},
		{"2-digit year format", "12", intToStr(currentYear + 1 - 2000), false},
		{"Far future (10 years)", "01", intToStr(currentYear + 10), false},

		// Invalid expiry
		{"Previous month (expired)", intToStr(prevMonth), intToStr(prevMonthYear), true},
		{"Previous year (expired)", "12", intToStr(currentYear - 1), true},
		{"Invalid month 0", "0", intToStr(currentYear + 1), true},
		{"Invalid month 13", "13", intToStr(currentYear + 1), true},
		{"Invalid month letters", "ab", intToStr(currentYear + 1), true},
		{"Invalid year letters", "12", "abcd", true},
		{"Too far in future (25 years)", "12", intToStr(currentYear + 25), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateExpiry(tt.expMonth, tt.expYear)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateExpiry(%q, %q) error = %v, wantErr %v", tt.expMonth, tt.expYear, err, tt.wantErr)
			}
		})
	}
}

func TestValidateCard(t *testing.T) {
	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	tests := []struct {
		name      string
		card      *model.CardDetails
		wantErr   bool
		wantReason string
	}{
		{
			name: "Valid Visa card",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr: false,
		},
		{
			name: "Valid AmEx card",
			card: &model.CardDetails{
				Number:   "378282246310005",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "1234",
				Name:     "Test User",
			},
			wantErr: false,
		},
		{
			name: "Invalid card number",
			card: &model.CardDetails{
				Number:   "4242424242424241", // Bad checksum
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "invalid_card_number",
		},
		{
			name: "Invalid CVV for Visa",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "12", // Too short
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "invalid_cvv",
		},
		{
			name: "Expired card",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "01",
				ExpYear:  intToStr(now.Year() - 1),
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "card_expired",
		},
		{
			name:    "Nil card",
			card:    nil,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCard(tt.card)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCard() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantReason != "" && err != nil {
				if validationErr, ok := err.(*CardValidationError); ok {
					if validationErr.Reason != tt.wantReason {
						t.Errorf("validateCard() reason = %v, wantReason %v", validationErr.Reason, tt.wantReason)
					}
				}
			}
		})
	}
}

func TestDetectCardBrand(t *testing.T) {
	tests := []struct {
		name      string
		cardNum   string
		wantBrand string
	}{
		{"Visa", "4242424242424242", "visa"},
		{"Visa (4111)", "4111111111111111", "visa"},
		{"Mastercard", "5555555555554444", "mastercard"},
		{"AmEx (34)", "343434343434343", "amex"},
		{"AmEx (37)", "378282246310005", "amex"},
		{"Discover", "6011111111111117", "discover"},
		{"Unknown (starts with 9)", "9999999999999999", "unknown"},
		{"Unknown (starts with 3, not AmEx)", "3111111111111111", "unknown"},
		{"Empty", "", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			brand := detectCardBrand(tt.cardNum)
			if brand != tt.wantBrand {
				t.Errorf("detectCardBrand(%q) = %v, want %v", tt.cardNum, brand, tt.wantBrand)
			}
		})
	}
}

func TestMaskCardInfo(t *testing.T) {
	tests := []struct {
		name      string
		last4     string
		brand     string
		want      string
	}{
		{"Full info", "1234", "visa", "visa:****1234"},
		{"No last4", "", "visa", "visa:****"},
		{"No brand", "1234", "", "****1234"},
		{"No info", "", "", "N/A"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskCardInfo(tt.last4, tt.brand)
			if got != tt.want {
				t.Errorf("maskCardInfo(%q, %q) = %v, want %v", tt.last4, tt.brand, got, tt.want)
			}
		})
	}
}

func TestMaskIdempotencyKey(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{"Long key", "abcdefghijklmnop", "abcd****mnop"},
		{"Exactly 8 chars", "12345678", "****"},
		{"Short key", "12345", "****"},
		{"Empty", "", "****"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskIdempotencyKey(tt.key)
			if got != tt.want {
				t.Errorf("maskIdempotencyKey(%q) = %v, want %v", tt.key, got, tt.want)
			}
		})
	}
}

// Helper function
func intToStr(i int) string {
	return string([]byte{
		byte(i/1000) + '0',
		byte((i/100)%10) + '0',
		byte((i/10)%10) + '0',
		byte(i%10) + '0',
	})
}
