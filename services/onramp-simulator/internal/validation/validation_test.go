package validation

import (
	"testing"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

// --- QuoteRequest validation ---

func TestValidateQuoteRequest_Valid(t *testing.T) {
	req := &model.QuoteRequest{
		FiatAmount:     "100.00",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
	}
	errs := ValidateQuoteRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateQuoteRequest_InvalidAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount string
		want   string
	}{
		{"empty", "", "fiat amount is required"},
		{"not a number", "abc", "fiat amount must be a valid number"},
		{"negative", "-10", "fiat amount must be greater than zero"},
		{"zero", "0", "fiat amount must be greater than zero"},
		{"below minimum", "0.50", "fiat amount must be at least"},
		{"above maximum", "100000", "fiat amount must not exceed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.QuoteRequest{
				FiatAmount:     tt.amount,
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			}
			errs := ValidateQuoteRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "fiatAmount", tt.want)
		})
	}
}

func TestValidateQuoteRequest_InvalidFiatCurrency(t *testing.T) {
	req := &model.QuoteRequest{
		FiatAmount:     "100",
		FiatCurrency:   "XYZ",
		CryptoCurrency: "USDC",
	}
	errs := ValidateQuoteRequest(req)
	if !errs.HasErrors() {
		t.Fatal("expected validation error")
	}
	assertFieldError(t, errs, "fiatCurrency", "unsupported fiat currency")
}

func TestValidateQuoteRequest_InvalidCryptoCurrency(t *testing.T) {
	req := &model.QuoteRequest{
		FiatAmount:     "100",
		FiatCurrency:   "USD",
		CryptoCurrency: "SHIB",
	}
	errs := ValidateQuoteRequest(req)
	if !errs.HasErrors() {
		t.Fatal("expected validation error")
	}
	assertFieldError(t, errs, "cryptoCurrency", "unsupported crypto currency")
}

func TestValidateQuoteRequest_MultipleErrors(t *testing.T) {
	req := &model.QuoteRequest{
		FiatAmount:     "-5",
		FiatCurrency:   "XYZ",
		CryptoCurrency: "SHIB",
	}
	errs := ValidateQuoteRequest(req)
	if len(errs.Errors) != 3 {
		t.Errorf("expected 3 errors, got %d: %v", len(errs.Errors), errs.Error())
	}
}

// --- CreateOrderRequest validation ---

func TestValidateCreateOrderRequest_Valid(t *testing.T) {
	req := &model.CreateOrderRequest{
		UserID:         "user123",
		WalletAddress:  "0x1234567890abcdef1234567890abcdef12345678",
		FiatAmount:     "500.00",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	}
	errs := ValidateCreateOrderRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateCreateOrderRequest_InvalidWalletAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    string
	}{
		{"empty", "", "wallet address is required"},
		{"no 0x prefix", "1234567890abcdef1234567890abcdef12345678", "valid EVM address"},
		{"too short", "0x1234", "valid EVM address"},
		{"too long", "0x1234567890abcdef1234567890abcdef1234567890", "valid EVM address"},
		{"invalid chars", "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", "valid EVM address"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validOrderRequest()
			req.WalletAddress = tt.address
			errs := ValidateCreateOrderRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "walletAddress", tt.want)
		})
	}
}

func TestValidateCreateOrderRequest_InvalidUserID(t *testing.T) {
	tests := []struct {
		name   string
		userID string
		want   string
	}{
		{"empty", "", "user ID is required"},
		{"too short", "ab", "at least 3 characters"},
		{"invalid chars", "user<>123", "invalid characters"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validOrderRequest()
			req.UserID = tt.userID
			errs := ValidateCreateOrderRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "userId", tt.want)
		})
	}
}

func TestValidateCreateOrderRequest_EmailUserID(t *testing.T) {
	req := validOrderRequest()
	req.UserID = "user@example.com"
	errs := ValidateCreateOrderRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected email userID to be valid, got: %v", errs.Error())
	}
}

func TestValidateCreateOrderRequest_InvalidPaymentMethod(t *testing.T) {
	req := validOrderRequest()
	req.PaymentMethod = "crypto_wallet"
	errs := ValidateCreateOrderRequest(req)
	if !errs.HasErrors() {
		t.Fatal("expected validation error")
	}
	assertFieldError(t, errs, "paymentMethod", "unsupported payment method")
}

func TestValidateCreateOrderRequest_InvalidChainID(t *testing.T) {
	tests := []struct {
		name    string
		chainID int
		want    string
	}{
		{"zero", 0, "chain ID is required"},
		{"negative", -1, "chain ID must be positive"},
		{"unsupported", 999, "unsupported chain ID"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validOrderRequest()
			req.ChainID = tt.chainID
			errs := ValidateCreateOrderRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "chainId", tt.want)
		})
	}
}

func TestValidateCreateOrderRequest_SupportedChainIDs(t *testing.T) {
	chains := []int{1, 10, 137, 42161, 8453, 31337}
	for _, chainID := range chains {
		req := validOrderRequest()
		req.ChainID = chainID
		errs := ValidateCreateOrderRequest(req)
		if errs.HasErrors() {
			t.Errorf("expected chainID %d to be valid, got: %v", chainID, errs.Error())
		}
	}
}

func TestValidateCreateOrderRequest_AllPaymentMethods(t *testing.T) {
	methods := []model.PaymentMethod{
		model.PaymentMethodCard,
		model.PaymentMethodBankTransfer,
		model.PaymentMethodApplePay,
		model.PaymentMethodGooglePay,
	}
	for _, method := range methods {
		req := validOrderRequest()
		req.PaymentMethod = method
		errs := ValidateCreateOrderRequest(req)
		if errs.HasErrors() {
			t.Errorf("expected payment method %s to be valid, got: %v", method, errs.Error())
		}
	}
}

func TestValidateCreateOrderRequest_AllErrors(t *testing.T) {
	req := &model.CreateOrderRequest{
		UserID:         "",
		WalletAddress:  "",
		FiatAmount:     "",
		FiatCurrency:   "",
		CryptoCurrency: "",
		PaymentMethod:  "",
		ChainID:        0,
	}
	errs := ValidateCreateOrderRequest(req)
	if len(errs.Errors) != 7 {
		t.Errorf("expected 7 errors for all empty fields, got %d: %v", len(errs.Errors), errs.Error())
	}
}

// --- OrderID validation ---

func TestValidateOrderID_Valid(t *testing.T) {
	errs := ValidateOrderID("550e8400-e29b-41d4-a716-446655440000")
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateOrderID_Invalid(t *testing.T) {
	tests := []struct {
		name string
		id   string
		want string
	}{
		{"empty", "", "order ID is required"},
		{"not uuid", "abc123", "valid UUID"},
		{"partial uuid", "550e8400-e29b-41d4", "valid UUID"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateOrderID(tt.id)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "id", tt.want)
		})
	}
}

// --- UserID param validation ---

func TestValidateUserIDParam_Valid(t *testing.T) {
	errs := ValidateUserIDParam("user123")
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateUserIDParam_Invalid(t *testing.T) {
	errs := ValidateUserIDParam("")
	if !errs.HasErrors() {
		t.Fatal("expected validation error")
	}
}

// --- Boundary amount tests ---

func TestValidateFiatAmount_Boundaries(t *testing.T) {
	tests := []struct {
		name    string
		amount  string
		isValid bool
	}{
		{"exact minimum", "1.00", true},
		{"just below minimum", "0.99", false},
		{"exact maximum", "50000", true},
		{"just above maximum", "50001", false},
		{"large valid", "49999.99", true},
		{"small valid", "1.01", true},
		{"decimal precision", "100.123456", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.QuoteRequest{
				FiatAmount:     tt.amount,
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			}
			errs := ValidateQuoteRequest(req)
			if tt.isValid && errs.HasErrors() {
				t.Errorf("expected valid, got errors: %v", errs.Error())
			}
			if !tt.isValid && !errs.HasErrors() {
				t.Errorf("expected invalid for amount %s", tt.amount)
			}
		})
	}
}

// --- ValidationErrors ---

func TestValidationErrors_Error(t *testing.T) {
	errs := &ValidationErrors{}
	if errs.Error() != "validation failed" {
		t.Errorf("expected 'validation failed', got: %s", errs.Error())
	}

	errs.Add("field1", "error1")
	errs.Add("field2", "error2")
	msg := errs.Error()
	if msg == "" {
		t.Fatal("expected non-empty error message")
	}
}

func TestValidationErrors_HasErrors(t *testing.T) {
	errs := &ValidationErrors{}
	if errs.HasErrors() {
		t.Fatal("expected no errors initially")
	}
	errs.Add("field", "message")
	if !errs.HasErrors() {
		t.Fatal("expected errors after Add")
	}
}

// --- Helpers ---

func validOrderRequest() *model.CreateOrderRequest {
	return &model.CreateOrderRequest{
		UserID:         "user123",
		WalletAddress:  "0x1234567890abcdef1234567890abcdef12345678",
		FiatAmount:     "100.00",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	}
}

func assertFieldError(t *testing.T, errs *ValidationErrors, field, containsMsg string) {
	t.Helper()
	for _, e := range errs.Errors {
		if e.Field == field {
			for i := 0; i <= len(e.Message)-len(containsMsg); i++ {
				if e.Message[i:i+len(containsMsg)] == containsMsg {
					return
				}
			}
			t.Errorf("field %q error %q does not contain %q", field, e.Message, containsMsg)
			return
		}
	}
	t.Errorf("no error found for field %q", field)
}
