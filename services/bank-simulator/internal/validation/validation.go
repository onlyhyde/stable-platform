package validation

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
)

// Validation constraints
const (
	MinNameLength      = 1
	MaxNameLength      = 100
	MaxReferenceLength = 200
	MinTransferAmount  = "0.01"
	MaxTransferAmount  = "1000000000" // 1 billion
	MaxBalanceAmount   = "1000000000"
)

// Supported currencies (ISO 4217)
var (
	SupportedCurrencies = map[string]bool{
		"USD": true, "EUR": true, "GBP": true, "KRW": true,
		"JPY": true, "CHF": true, "CAD": true, "AUD": true,
	}

	// Account number format: "BANK" prefix followed by digits
	accountNoRegex = regexp.MustCompile(`^BANK\d{4,14}$`)
	// Name: alphanumeric, spaces, hyphens, apostrophes, dots
	nameRegex = regexp.MustCompile(`^[a-zA-Z0-9\s\-'.]+$`)
	// Reference: alphanumeric, spaces, hyphens, underscores, dots, slashes
	referenceRegex = regexp.MustCompile(`^[a-zA-Z0-9\s\-_./#]+$`)
	// UUID format
	uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// ValidationError holds a field-level validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationErrors is a collection of validation errors
type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

// Error implements the error interface
func (ve *ValidationErrors) Error() string {
	if len(ve.Errors) == 0 {
		return "validation failed"
	}
	msgs := make([]string, len(ve.Errors))
	for i, e := range ve.Errors {
		msgs[i] = fmt.Sprintf("%s: %s", e.Field, e.Message)
	}
	return "validation failed: " + strings.Join(msgs, "; ")
}

// HasErrors returns true if there are validation errors
func (ve *ValidationErrors) HasErrors() bool {
	return len(ve.Errors) > 0
}

// Add adds a validation error
func (ve *ValidationErrors) Add(field, message string) {
	ve.Errors = append(ve.Errors, ValidationError{Field: field, Message: message})
}

// ValidateCreateAccountRequest validates an account creation request
func ValidateCreateAccountRequest(req *model.CreateAccountRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateName(req.Name, errs)
	validateCurrency(req.Currency, errs)

	// Balance is optional; validate only if provided
	if req.Balance != "" {
		validateBalance(req.Balance, errs)
	}

	return errs
}

// ValidateTransferRequest validates a transfer request
func ValidateTransferRequest(req *model.TransferRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateAccountNo(req.FromAccountNo, "fromAccountNo", errs)
	validateAccountNo(req.ToAccountNo, "toAccountNo", errs)
	validateTransferAmount(req.Amount, errs)

	// Reference is optional; validate only if provided
	if req.Reference != "" {
		validateReference(req.Reference, errs)
	}

	// Self-transfer check (only if both account numbers are valid)
	if req.FromAccountNo != "" && req.ToAccountNo != "" && req.FromAccountNo == req.ToAccountNo {
		errs.Add("toAccountNo", "cannot transfer to the same account")
	}

	return errs
}

// ValidateAccountNoParam validates an account number path parameter
func ValidateAccountNoParam(accountNo string) *ValidationErrors {
	errs := &ValidationErrors{}
	validateAccountNo(accountNo, "accountNo", errs)
	return errs
}

// ValidateTransferID validates a transfer ID path parameter (UUID)
func ValidateTransferID(id string) *ValidationErrors {
	errs := &ValidationErrors{}

	if id == "" {
		errs.Add("id", "transfer ID is required")
		return errs
	}

	if !uuidRegex.MatchString(id) {
		errs.Add("id", "transfer ID must be a valid UUID")
	}

	return errs
}

// --- Field validators ---

func validateName(name string, errs *ValidationErrors) {
	if name == "" {
		errs.Add("name", "account name is required")
		return
	}

	trimmed := strings.TrimSpace(name)
	if len(trimmed) < MinNameLength {
		errs.Add("name", fmt.Sprintf("account name must be at least %d character", MinNameLength))
		return
	}

	if len(trimmed) > MaxNameLength {
		errs.Add("name", fmt.Sprintf("account name must not exceed %d characters", MaxNameLength))
		return
	}

	if !nameRegex.MatchString(trimmed) {
		errs.Add("name", "account name contains invalid characters (allowed: letters, numbers, spaces, hyphens, apostrophes, dots)")
	}
}

func validateCurrency(currency string, errs *ValidationErrors) {
	if currency == "" {
		errs.Add("currency", "currency is required")
		return
	}

	upper := strings.ToUpper(currency)
	if !SupportedCurrencies[upper] {
		supported := make([]string, 0, len(SupportedCurrencies))
		for k := range SupportedCurrencies {
			supported = append(supported, k)
		}
		errs.Add("currency", fmt.Sprintf("unsupported currency: %s (supported: %s)", currency, strings.Join(supported, ", ")))
	}
}

func validateBalance(balance string, errs *ValidationErrors) {
	parsed, ok := new(big.Float).SetString(balance)
	if !ok {
		errs.Add("balance", "balance must be a valid number")
		return
	}

	if parsed.Sign() < 0 {
		errs.Add("balance", "balance must not be negative")
		return
	}

	maxBalance, _ := new(big.Float).SetString(MaxBalanceAmount)
	if parsed.Cmp(maxBalance) > 0 {
		errs.Add("balance", fmt.Sprintf("balance must not exceed %s", MaxBalanceAmount))
	}
}

func validateTransferAmount(amount string, errs *ValidationErrors) {
	if amount == "" {
		errs.Add("amount", "transfer amount is required")
		return
	}

	parsed, ok := new(big.Float).SetString(amount)
	if !ok {
		errs.Add("amount", "transfer amount must be a valid number")
		return
	}

	if parsed.Sign() <= 0 {
		errs.Add("amount", "transfer amount must be greater than zero")
		return
	}

	minAmount, _ := new(big.Float).SetString(MinTransferAmount)
	if parsed.Cmp(minAmount) < 0 {
		errs.Add("amount", fmt.Sprintf("transfer amount must be at least %s", MinTransferAmount))
		return
	}

	maxAmount, _ := new(big.Float).SetString(MaxTransferAmount)
	if parsed.Cmp(maxAmount) > 0 {
		errs.Add("amount", fmt.Sprintf("transfer amount must not exceed %s", MaxTransferAmount))
	}
}

func validateAccountNo(accountNo string, field string, errs *ValidationErrors) {
	if accountNo == "" {
		errs.Add(field, "account number is required")
		return
	}

	if !accountNoRegex.MatchString(accountNo) {
		errs.Add(field, "account number must start with 'BANK' followed by 4-14 digits")
	}
}

func validateReference(reference string, errs *ValidationErrors) {
	if len(reference) > MaxReferenceLength {
		errs.Add("reference", fmt.Sprintf("reference must not exceed %d characters", MaxReferenceLength))
		return
	}

	if !referenceRegex.MatchString(reference) {
		errs.Add("reference", "reference contains invalid characters (allowed: letters, numbers, spaces, hyphens, underscores, dots, slashes, #)")
	}
}

// ValidateDepositRequest validates a deposit request
func ValidateDepositRequest(req *model.DepositRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateTransferAmount(req.Amount, errs)

	// Reference is optional; validate only if provided
	if req.Reference != "" {
		validateReference(req.Reference, errs)
	}

	// Description is optional; validate length if provided
	if req.Description != "" && len(req.Description) > 500 {
		errs.Add("description", "description must not exceed 500 characters")
	}

	return errs
}

// ValidateWithdrawRequest validates a withdraw request
func ValidateWithdrawRequest(req *model.WithdrawRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateTransferAmount(req.Amount, errs)

	// Reference is optional; validate only if provided
	if req.Reference != "" {
		validateReference(req.Reference, errs)
	}

	// Description is optional; validate length if provided
	if req.Description != "" && len(req.Description) > 500 {
		errs.Add("description", "description must not exceed 500 characters")
	}

	return errs
}

// ValidateVerifyAccountRequest validates a verify account request
func ValidateVerifyAccountRequest(req *model.VerifyAccountRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateAccountNo(req.AccountNo, "accountNo", errs)

	if req.HolderName == "" {
		errs.Add("holderName", "holder name is required")
	} else if len(strings.TrimSpace(req.HolderName)) < 1 {
		errs.Add("holderName", "holder name must not be empty")
	} else if len(req.HolderName) > MaxNameLength {
		errs.Add("holderName", fmt.Sprintf("holder name must not exceed %d characters", MaxNameLength))
	}

	return errs
}

// ValidateInitiateVerificationRequest validates an initiate verification request
func ValidateInitiateVerificationRequest(req *model.InitiateVerificationRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateAccountNo(req.AccountNo, "accountNo", errs)

	return errs
}

// ValidateCompleteVerificationRequest validates a complete verification request
func ValidateCompleteVerificationRequest(req *model.CompleteVerificationRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	if req.VerificationID == "" {
		errs.Add("verificationId", "verification ID is required")
	} else if !uuidRegex.MatchString(req.VerificationID) {
		errs.Add("verificationId", "verification ID must be a valid UUID")
	}

	if req.Code == "" {
		errs.Add("code", "verification code is required")
	} else if len(req.Code) != 4 {
		errs.Add("code", "verification code must be 4 digits")
	} else {
		// Check if code is all digits
		for _, c := range req.Code {
			if c < '0' || c > '9' {
				errs.Add("code", "verification code must contain only digits")
				break
			}
		}
	}

	return errs
}

// ValidateCreateDebitRequestInput validates a create debit request input
func ValidateCreateDebitRequestInput(req *model.CreateDebitRequestInput) *ValidationErrors {
	errs := &ValidationErrors{}

	// Idempotency key
	if req.IdempotencyKey == "" {
		errs.Add("idempotencyKey", "idempotency key is required")
	}

	// Account number
	validateAccountNo(req.AccountNo, "accountNo", errs)

	// Amount
	validateTransferAmount(req.Amount, errs)

	// Currency
	validateCurrency(req.Currency, errs)

	// Creditor ID
	if req.CreditorID == "" {
		errs.Add("creditorId", "creditor ID is required")
	} else if len(req.CreditorID) > 100 {
		errs.Add("creditorId", "creditor ID must not exceed 100 characters")
	}

	// Creditor Name
	if req.CreditorName == "" {
		errs.Add("creditorName", "creditor name is required")
	} else if len(req.CreditorName) > MaxNameLength {
		errs.Add("creditorName", fmt.Sprintf("creditor name must not exceed %d characters", MaxNameLength))
	}

	// Reference (optional)
	if req.Reference != "" {
		validateReference(req.Reference, errs)
	}

	// Description (optional)
	if req.Description != "" && len(req.Description) > 500 {
		errs.Add("description", "description must not exceed 500 characters")
	}

	return errs
}

// ValidateDebitRequestID validates a debit request ID path parameter (UUID)
func ValidateDebitRequestID(id string) *ValidationErrors {
	errs := &ValidationErrors{}

	if id == "" {
		errs.Add("id", "debit request ID is required")
		return errs
	}

	if !uuidRegex.MatchString(id) {
		errs.Add("id", "debit request ID must be a valid UUID")
	}

	return errs
}
