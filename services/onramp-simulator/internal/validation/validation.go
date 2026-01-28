package validation

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

// Validation constraints
const (
	MinFiatAmount    = "1.00"    // Minimum $1
	MaxFiatAmount    = "50000"   // Maximum $50,000
	MinUserIDLength  = 3
	MaxUserIDLength  = 128
	WalletAddrLength = 42 // "0x" + 40 hex chars
)

// Supported values
var (
	SupportedFiatCurrencies   = map[string]bool{"USD": true, "EUR": true, "GBP": true, "KRW": true, "JPY": true}
	SupportedCryptoCurrencies = map[string]bool{"USDC": true, "USDT": true, "DAI": true, "ETH": true, "WKRC": true}
	SupportedChainIDs         = map[int]bool{1: true, 10: true, 137: true, 42161: true, 8453: true, 31337: true}
	SupportedPaymentMethods   = map[model.PaymentMethod]bool{
		model.PaymentMethodCard:         true,
		model.PaymentMethodBankTransfer: true,
		model.PaymentMethodApplePay:     true,
		model.PaymentMethodGooglePay:    true,
	}

	walletAddrRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	userIDRegex     = regexp.MustCompile(`^[a-zA-Z0-9._@+\-]+$`)
	uuidRegex       = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// ValidationError holds field-level validation errors
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

// ValidateQuoteRequest validates a quote request
func ValidateQuoteRequest(req *model.QuoteRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateFiatAmount(req.FiatAmount, errs)
	validateFiatCurrency(req.FiatCurrency, errs)
	validateCryptoCurrency(req.CryptoCurrency, errs)

	return errs
}

// ValidateCreateOrderRequest validates an order creation request
func ValidateCreateOrderRequest(req *model.CreateOrderRequest) *ValidationErrors {
	errs := &ValidationErrors{}

	validateUserID(req.UserID, errs)
	validateWalletAddress(req.WalletAddress, errs)
	validateFiatAmount(req.FiatAmount, errs)
	validateFiatCurrency(req.FiatCurrency, errs)
	validateCryptoCurrency(req.CryptoCurrency, errs)
	validatePaymentMethod(req.PaymentMethod, errs)
	validateChainID(req.ChainID, errs)

	return errs
}

// ValidateOrderID validates an order ID (UUID format)
func ValidateOrderID(id string) *ValidationErrors {
	errs := &ValidationErrors{}

	if id == "" {
		errs.Add("id", "order ID is required")
		return errs
	}

	if !uuidRegex.MatchString(id) {
		errs.Add("id", "order ID must be a valid UUID")
	}

	return errs
}

// ValidateUserID validates a user ID for path parameter
func ValidateUserIDParam(userID string) *ValidationErrors {
	errs := &ValidationErrors{}
	validateUserID(userID, errs)
	return errs
}

// --- Field validators ---

func validateFiatAmount(amount string, errs *ValidationErrors) {
	if amount == "" {
		errs.Add("fiatAmount", "fiat amount is required")
		return
	}

	parsed, ok := new(big.Float).SetString(amount)
	if !ok {
		errs.Add("fiatAmount", "fiat amount must be a valid number")
		return
	}

	// Check not negative or zero
	if parsed.Sign() <= 0 {
		errs.Add("fiatAmount", "fiat amount must be greater than zero")
		return
	}

	// Check minimum
	minAmount, _ := new(big.Float).SetString(MinFiatAmount)
	if parsed.Cmp(minAmount) < 0 {
		errs.Add("fiatAmount", fmt.Sprintf("fiat amount must be at least %s", MinFiatAmount))
		return
	}

	// Check maximum
	maxAmount, _ := new(big.Float).SetString(MaxFiatAmount)
	if parsed.Cmp(maxAmount) > 0 {
		errs.Add("fiatAmount", fmt.Sprintf("fiat amount must not exceed %s", MaxFiatAmount))
		return
	}
}

func validateFiatCurrency(currency string, errs *ValidationErrors) {
	if currency == "" {
		errs.Add("fiatCurrency", "fiat currency is required")
		return
	}

	upper := strings.ToUpper(currency)
	if !SupportedFiatCurrencies[upper] {
		supported := make([]string, 0, len(SupportedFiatCurrencies))
		for k := range SupportedFiatCurrencies {
			supported = append(supported, k)
		}
		errs.Add("fiatCurrency", fmt.Sprintf("unsupported fiat currency: %s (supported: %s)", currency, strings.Join(supported, ", ")))
	}
}

func validateCryptoCurrency(currency string, errs *ValidationErrors) {
	if currency == "" {
		errs.Add("cryptoCurrency", "crypto currency is required")
		return
	}

	upper := strings.ToUpper(currency)
	if !SupportedCryptoCurrencies[upper] {
		supported := make([]string, 0, len(SupportedCryptoCurrencies))
		for k := range SupportedCryptoCurrencies {
			supported = append(supported, k)
		}
		errs.Add("cryptoCurrency", fmt.Sprintf("unsupported crypto currency: %s (supported: %s)", currency, strings.Join(supported, ", ")))
	}
}

func validateWalletAddress(address string, errs *ValidationErrors) {
	if address == "" {
		errs.Add("walletAddress", "wallet address is required")
		return
	}

	if !walletAddrRegex.MatchString(address) {
		errs.Add("walletAddress", "wallet address must be a valid EVM address (0x followed by 40 hex characters)")
	}
}

func validateUserID(userID string, errs *ValidationErrors) {
	if userID == "" {
		errs.Add("userId", "user ID is required")
		return
	}

	if len(userID) < MinUserIDLength {
		errs.Add("userId", fmt.Sprintf("user ID must be at least %d characters", MinUserIDLength))
		return
	}

	if len(userID) > MaxUserIDLength {
		errs.Add("userId", fmt.Sprintf("user ID must not exceed %d characters", MaxUserIDLength))
		return
	}

	if !userIDRegex.MatchString(userID) {
		errs.Add("userId", "user ID contains invalid characters (allowed: alphanumeric, ., _, @, +, -)")
	}
}

func validatePaymentMethod(method model.PaymentMethod, errs *ValidationErrors) {
	if method == "" {
		errs.Add("paymentMethod", "payment method is required")
		return
	}

	if !SupportedPaymentMethods[method] {
		errs.Add("paymentMethod", fmt.Sprintf("unsupported payment method: %s (supported: card, bank_transfer, apple_pay, google_pay)", method))
	}
}

func validateChainID(chainID int, errs *ValidationErrors) {
	if chainID == 0 {
		errs.Add("chainId", "chain ID is required")
		return
	}

	if chainID < 0 {
		errs.Add("chainId", "chain ID must be positive")
		return
	}

	if !SupportedChainIDs[chainID] {
		errs.Add("chainId", fmt.Sprintf("unsupported chain ID: %d", chainID))
	}
}
