package validation

import (
	"strings"
	"testing"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
)

// --- CreateAccountRequest validation ---

func TestValidateCreateAccountRequest_Valid(t *testing.T) {
	req := &model.CreateAccountRequest{
		Name:     "John Doe",
		Currency: "USD",
		Balance:  "1000.00",
	}
	errs := ValidateCreateAccountRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateCreateAccountRequest_ValidNoBalance(t *testing.T) {
	req := &model.CreateAccountRequest{
		Name:     "Alice",
		Currency: "EUR",
	}
	errs := ValidateCreateAccountRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors without balance, got: %v", errs.Error())
	}
}

func TestValidateCreateAccountRequest_InvalidName(t *testing.T) {
	tests := []struct {
		name string
		val  string
		want string
	}{
		{"empty", "", "account name is required"},
		{"whitespace only", "   ", "at least 1 character"},
		{"too long", strings.Repeat("a", 101), "must not exceed 100"},
		{"invalid chars", "Name<script>", "invalid characters"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: tt.val, Currency: "USD"}
			errs := ValidateCreateAccountRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "name", tt.want)
		})
	}
}

func TestValidateCreateAccountRequest_ValidNameFormats(t *testing.T) {
	names := []string{
		"John Doe",
		"O'Brien",
		"Mary-Jane Watson",
		"Dr. Smith",
		"Company123",
	}
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: name, Currency: "USD"}
			errs := ValidateCreateAccountRequest(req)
			if errs.HasErrors() {
				t.Errorf("expected name %q to be valid, got: %v", name, errs.Error())
			}
		})
	}
}

func TestValidateCreateAccountRequest_InvalidCurrency(t *testing.T) {
	tests := []struct {
		name     string
		currency string
		want     string
	}{
		{"empty", "", "currency is required"},
		{"unsupported", "BTC", "unsupported currency"},
		{"invalid code", "ABCD", "unsupported currency"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: "Test", Currency: tt.currency}
			errs := ValidateCreateAccountRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "currency", tt.want)
		})
	}
}

func TestValidateCreateAccountRequest_SupportedCurrencies(t *testing.T) {
	currencies := []string{"USD", "EUR", "GBP", "KRW", "JPY", "CHF", "CAD", "AUD"}
	for _, currency := range currencies {
		t.Run(currency, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: "Test", Currency: currency}
			errs := ValidateCreateAccountRequest(req)
			if errs.HasErrors() {
				t.Errorf("expected currency %s to be valid, got: %v", currency, errs.Error())
			}
		})
	}
}

func TestValidateCreateAccountRequest_InvalidBalance(t *testing.T) {
	tests := []struct {
		name    string
		balance string
		want    string
	}{
		{"not a number", "abc", "valid number"},
		{"negative", "-100", "must not be negative"},
		{"exceeds max", "2000000000", "must not exceed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: "Test", Currency: "USD", Balance: tt.balance}
			errs := ValidateCreateAccountRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "balance", tt.want)
		})
	}
}

func TestValidateCreateAccountRequest_ValidBalance(t *testing.T) {
	balances := []string{"0", "0.01", "100.50", "999999999.99", "1000000000"}
	for _, balance := range balances {
		t.Run(balance, func(t *testing.T) {
			req := &model.CreateAccountRequest{Name: "Test", Currency: "USD", Balance: balance}
			errs := ValidateCreateAccountRequest(req)
			if errs.HasErrors() {
				t.Errorf("expected balance %s to be valid, got: %v", balance, errs.Error())
			}
		})
	}
}

// --- TransferRequest validation ---

func TestValidateTransferRequest_Valid(t *testing.T) {
	req := &model.TransferRequest{
		FromAccountNo: "BANK1234567890",
		ToAccountNo:   "BANK0987654321",
		Amount:        "100.00",
		Reference:     "Payment for services",
	}
	errs := ValidateTransferRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateTransferRequest_ValidNoReference(t *testing.T) {
	req := &model.TransferRequest{
		FromAccountNo: "BANK1234567890",
		ToAccountNo:   "BANK0987654321",
		Amount:        "50.00",
	}
	errs := ValidateTransferRequest(req)
	if errs.HasErrors() {
		t.Errorf("expected no errors without reference, got: %v", errs.Error())
	}
}

func TestValidateTransferRequest_InvalidAccountNo(t *testing.T) {
	tests := []struct {
		name string
		val  string
		want string
	}{
		{"empty", "", "account number is required"},
		{"no prefix", "1234567890", "must start with 'BANK'"},
		{"wrong prefix", "ACCT1234567890", "must start with 'BANK'"},
		{"too few digits", "BANK123", "must start with 'BANK' followed by 4-14 digits"},
		{"letters after prefix", "BANKabcdefgh", "must start with 'BANK'"},
	}
	for _, tt := range tests {
		t.Run("from_"+tt.name, func(t *testing.T) {
			req := validTransferRequest()
			req.FromAccountNo = tt.val
			errs := ValidateTransferRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "fromAccountNo", tt.want)
		})
		t.Run("to_"+tt.name, func(t *testing.T) {
			req := validTransferRequest()
			req.ToAccountNo = tt.val
			errs := ValidateTransferRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "toAccountNo", tt.want)
		})
	}
}

func TestValidateTransferRequest_SelfTransfer(t *testing.T) {
	req := &model.TransferRequest{
		FromAccountNo: "BANK1234567890",
		ToAccountNo:   "BANK1234567890",
		Amount:        "100.00",
	}
	errs := ValidateTransferRequest(req)
	if !errs.HasErrors() {
		t.Fatal("expected validation error for self-transfer")
	}
	assertFieldError(t, errs, "toAccountNo", "cannot transfer to the same account")
}

func TestValidateTransferRequest_InvalidAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount string
		want   string
	}{
		{"empty", "", "transfer amount is required"},
		{"not a number", "abc", "valid number"},
		{"zero", "0", "greater than zero"},
		{"negative", "-50", "greater than zero"},
		{"below minimum", "0.001", "at least 0.01"},
		{"exceeds maximum", "2000000000", "must not exceed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validTransferRequest()
			req.Amount = tt.amount
			errs := ValidateTransferRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "amount", tt.want)
		})
	}
}

func TestValidateTransferRequest_ValidAmounts(t *testing.T) {
	amounts := []string{"0.01", "1.00", "100.50", "999999999.99", "1000000000"}
	for _, amount := range amounts {
		t.Run(amount, func(t *testing.T) {
			req := validTransferRequest()
			req.Amount = amount
			errs := ValidateTransferRequest(req)
			if errs.HasErrors() {
				t.Errorf("expected amount %s to be valid, got: %v", amount, errs.Error())
			}
		})
	}
}

func TestValidateTransferRequest_InvalidReference(t *testing.T) {
	tests := []struct {
		name string
		ref  string
		want string
	}{
		{"too long", strings.Repeat("a", 201), "must not exceed 200"},
		{"invalid chars", "ref<script>alert(1)</script>", "invalid characters"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validTransferRequest()
			req.Reference = tt.ref
			errs := ValidateTransferRequest(req)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "reference", tt.want)
		})
	}
}

func TestValidateTransferRequest_ValidReferences(t *testing.T) {
	refs := []string{
		"Invoice #12345",
		"Payment_2026-01",
		"Transfer/Ref.001",
		"Simple reference",
	}
	for _, ref := range refs {
		t.Run(ref, func(t *testing.T) {
			req := validTransferRequest()
			req.Reference = ref
			errs := ValidateTransferRequest(req)
			if errs.HasErrors() {
				t.Errorf("expected reference %q to be valid, got: %v", ref, errs.Error())
			}
		})
	}
}

func TestValidateTransferRequest_AllErrors(t *testing.T) {
	req := &model.TransferRequest{
		FromAccountNo: "",
		ToAccountNo:   "",
		Amount:        "",
	}
	errs := ValidateTransferRequest(req)
	if len(errs.Errors) != 3 {
		t.Errorf("expected 3 errors for all empty fields, got %d: %v", len(errs.Errors), errs.Error())
	}
}

// --- Path parameter validation ---

func TestValidateAccountNoParam_Valid(t *testing.T) {
	valid := []string{"BANK1234", "BANK1234567890", "BANK12345678901234"}
	for _, v := range valid {
		errs := ValidateAccountNoParam(v)
		if errs.HasErrors() {
			t.Errorf("expected %s to be valid, got: %v", v, errs.Error())
		}
	}
}

func TestValidateAccountNoParam_Invalid(t *testing.T) {
	tests := []struct {
		name string
		val  string
		want string
	}{
		{"empty", "", "account number is required"},
		{"no prefix", "1234567890", "must start with 'BANK'"},
		{"too short", "BANK123", "must start with 'BANK' followed by 4-14 digits"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateAccountNoParam(tt.val)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "accountNo", tt.want)
		})
	}
}

func TestValidateTransferID_Valid(t *testing.T) {
	errs := ValidateTransferID("550e8400-e29b-41d4-a716-446655440000")
	if errs.HasErrors() {
		t.Errorf("expected no errors, got: %v", errs.Error())
	}
}

func TestValidateTransferID_Invalid(t *testing.T) {
	tests := []struct {
		name string
		id   string
		want string
	}{
		{"empty", "", "transfer ID is required"},
		{"not uuid", "abc123", "valid UUID"},
		{"partial uuid", "550e8400-e29b-41d4", "valid UUID"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateTransferID(tt.id)
			if !errs.HasErrors() {
				t.Fatal("expected validation error")
			}
			assertFieldError(t, errs, "id", tt.want)
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

func validTransferRequest() *model.TransferRequest {
	return &model.TransferRequest{
		FromAccountNo: "BANK1234567890",
		ToAccountNo:   "BANK0987654321",
		Amount:        "100.00",
	}
}

func assertFieldError(t *testing.T, errs *ValidationErrors, field, containsMsg string) {
	t.Helper()
	for _, e := range errs.Errors {
		if e.Field == field {
			if strings.Contains(e.Message, containsMsg) {
				return
			}
			t.Errorf("field %q error %q does not contain %q", field, e.Message, containsMsg)
			return
		}
	}
	t.Errorf("no error found for field %q (errors: %v)", field, errs.Errors)
}
