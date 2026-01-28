package model

import (
	"time"
)

// OrderStatus represents the status of an onramp order
type OrderStatus string

const (
	OrderStatusPending                   OrderStatus = "pending"
	OrderStatusPendingPayment            OrderStatus = "pending_payment"
	OrderStatusProcessing                OrderStatus = "processing"
	OrderStatusPaymentCompletedPendingTx OrderStatus = "payment_completed_pending_transfer"
	OrderStatusCompleted                 OrderStatus = "completed"
	OrderStatusFailed                    OrderStatus = "failed"
	OrderStatusCancelled                 OrderStatus = "cancelled"
	OrderStatusRefundPending             OrderStatus = "refund_pending"
	OrderStatusRefunded                  OrderStatus = "refunded"
	OrderStatusKYCRequired               OrderStatus = "kyc_required"
)

// KYCStatus represents KYC verification status
type KYCStatus string

const (
	KYCStatusNone     KYCStatus = "none"
	KYCStatusPending  KYCStatus = "pending"
	KYCStatusApproved KYCStatus = "approved"
	KYCStatusRejected KYCStatus = "rejected"
	KYCStatusExpired  KYCStatus = "expired"
)

// KYCLevel represents KYC verification level
type KYCLevel string

const (
	KYCLevelNone     KYCLevel = "none"
	KYCLevelBasic    KYCLevel = "basic"
	KYCLevelAdvanced KYCLevel = "advanced"
)

// KYCRecord represents a KYC verification record
type KYCRecord struct {
	ID             string        `json:"id"`
	UserID         string        `json:"userId"`
	Level          KYCLevel      `json:"level"`
	Status         KYCStatus     `json:"status"`
	Documents      *KYCDocuments `json:"documents,omitempty"`
	RejectedReason string        `json:"rejectedReason,omitempty"`
	RenewalOf      string        `json:"renewalOf,omitempty"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
	ApprovedAt     *time.Time    `json:"approvedAt,omitempty"`
	ExpiresAt      *time.Time    `json:"expiresAt,omitempty"`
}

// KYCDocuments represents submitted KYC documents
type KYCDocuments struct {
	IDType      string      `json:"idType"`
	IDNumber    string      `json:"idNumber"`
	FullName    string      `json:"fullName"`
	DateOfBirth string      `json:"dateOfBirth"`
	Nationality string      `json:"nationality"`
	Address     *KYCAddress `json:"address"`
}

// KYCAddress represents address information
type KYCAddress struct {
	Street     string `json:"street"`
	City       string `json:"city"`
	Country    string `json:"country"`
	PostalCode string `json:"postalCode"`
}

// KYCLimits represents transaction limits based on KYC level
type KYCLimits struct {
	Daily          string `json:"daily"`
	Monthly        string `json:"monthly"`
	PerTransaction string `json:"perTransaction"`
}

// KYCUsage represents current usage against limits
type KYCUsage struct {
	DailyUsed   string `json:"dailyUsed"`
	MonthlyUsed string `json:"monthlyUsed"`
}

// KYCLevelLimits maps KYC levels to their limits
var KYCLevelLimits = map[KYCLevel]KYCLimits{
	KYCLevelNone: {
		Daily:          "0",
		Monthly:        "0",
		PerTransaction: "0",
	},
	KYCLevelBasic: {
		Daily:          "1000.00",
		Monthly:        "10000.00",
		PerTransaction: "500.00",
	},
	KYCLevelAdvanced: {
		Daily:          "50000.00",
		Monthly:        "500000.00",
		PerTransaction: "25000.00",
	},
}

// SubmitKYCRequest represents a KYC submission request
type SubmitKYCRequest struct {
	UserID    string       `json:"userId" binding:"required"`
	Level     KYCLevel     `json:"level" binding:"required"`
	Documents KYCDocuments `json:"documents" binding:"required"`
}

// RenewKYCRequest represents a KYC renewal request
type RenewKYCRequest struct {
	UserID string `json:"userId" binding:"required"`
}

// KYCStatusResponse represents KYC status response
type KYCStatusResponse struct {
	UserID     string     `json:"userId"`
	Level      KYCLevel   `json:"level"`
	Status     KYCStatus  `json:"status"`
	Limits     KYCLimits  `json:"limits"`
	Usage      *KYCUsage  `json:"usage,omitempty"`
	ApprovedAt *time.Time `json:"approvedAt,omitempty"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
}

// KYCRequirementsResponse represents KYC requirements
type KYCRequirementsResponse struct {
	Levels map[KYCLevel]KYCLevelRequirements `json:"levels"`
}

// KYCLevelRequirements represents requirements for a KYC level
type KYCLevelRequirements struct {
	Limits       KYCLimits `json:"limits"`
	Requirements []string  `json:"requirements"`
}

// BankAccountInfo represents bank account information for transfers
type BankAccountInfo struct {
	AccountNo  string `json:"accountNo" binding:"required"`
	HolderName string `json:"holderName" binding:"required"`
}

// PaymentMethod represents payment method for fiat
type PaymentMethod string

const (
	PaymentMethodCard         PaymentMethod = "card"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodApplePay     PaymentMethod = "apple_pay"
	PaymentMethodGooglePay    PaymentMethod = "google_pay"
)

// Order represents a fiat-to-crypto purchase order
type Order struct {
	ID                string        `json:"id"`
	UserID            string        `json:"userId"`
	WalletAddress     string        `json:"walletAddress"`
	FiatAmount        string        `json:"fiatAmount"`
	FiatCurrency      string        `json:"fiatCurrency"`
	CryptoAmount      string        `json:"cryptoAmount"`
	CryptoCurrency    string        `json:"cryptoCurrency"`
	ExchangeRate      string        `json:"exchangeRate"`
	Fee               string        `json:"fee"`
	PaymentMethod     PaymentMethod `json:"paymentMethod"`
	Status            OrderStatus   `json:"status"`
	FailureReason     string        `json:"failureReason,omitempty"`
	TxHash            string        `json:"txHash,omitempty"`
	ChainID           int           `json:"chainId"`
	KYCStatus         string        `json:"kycStatus,omitempty"`
	ReturnURL         string        `json:"returnUrl,omitempty"`
	CancelURL         string        `json:"cancelUrl,omitempty"`
	PaymentURL        string        `json:"paymentUrl,omitempty"`
	PaymentExpiresAt  *time.Time    `json:"paymentExpiresAt,omitempty"`
	PaymentSessionID  string        `json:"paymentSessionId,omitempty"`
	DebitRequestID    string        `json:"debitRequestId,omitempty"`
	ExternalPaymentID string        `json:"externalPaymentId,omitempty"`
	BankAccountNo     string        `json:"bankAccountNo,omitempty"`
	BankHolderName    string        `json:"bankHolderName,omitempty"`
	CreatedAt         time.Time     `json:"createdAt"`
	UpdatedAt         time.Time     `json:"updatedAt"`
	CompletedAt       *time.Time    `json:"completedAt,omitempty"`
	RefundedAt        *time.Time    `json:"refundedAt,omitempty"`
}

// CreateOrderRequest represents a request to create an order
type CreateOrderRequest struct {
	UserID         string           `json:"userId" binding:"required"`
	WalletAddress  string           `json:"walletAddress" binding:"required"`
	FiatAmount     string           `json:"fiatAmount" binding:"required"`
	FiatCurrency   string           `json:"fiatCurrency" binding:"required"`
	CryptoCurrency string           `json:"cryptoCurrency" binding:"required"`
	PaymentMethod  PaymentMethod    `json:"paymentMethod" binding:"required"`
	ChainID        int              `json:"chainId" binding:"required"`
	ReturnURL      string           `json:"returnUrl"`
	CancelURL      string           `json:"cancelUrl"`
	BankAccount    *BankAccountInfo `json:"bankAccount"`
}

// QuoteRequest represents a request for a price quote
type QuoteRequest struct {
	FiatAmount     string `json:"fiatAmount" binding:"required"`
	FiatCurrency   string `json:"fiatCurrency" binding:"required"`
	CryptoCurrency string `json:"cryptoCurrency" binding:"required"`
}

// QuoteResponse represents a price quote response
type QuoteResponse struct {
	FiatAmount     string `json:"fiatAmount"`
	FiatCurrency   string `json:"fiatCurrency"`
	CryptoAmount   string `json:"cryptoAmount"`
	CryptoCurrency string `json:"cryptoCurrency"`
	ExchangeRate   string `json:"exchangeRate"`
	Fee            string `json:"fee"`
	FeePercent     string `json:"feePercent"`
	ExpiresAt      string `json:"expiresAt"`
}

// WebhookPayload represents a webhook notification payload
type WebhookPayload struct {
	EventType string    `json:"eventType"`
	Timestamp time.Time `json:"timestamp"`
	Data      any       `json:"data"`
}

// ========== Supported Assets & Networks (ONRAMP-04) ==========

// SupportedAsset represents a supported crypto asset
type SupportedAsset struct {
	Symbol       string   `json:"symbol"`
	Name         string   `json:"name"`
	Decimals     int      `json:"decimals"`
	ContractAddr string   `json:"contractAddress,omitempty"` // Empty for native assets
	IsNative     bool     `json:"isNative"`
	ChainIDs     []int    `json:"chainIds"`
	MinAmount    string   `json:"minAmount"`
	MaxAmount    string   `json:"maxAmount"`
	IconURL      string   `json:"iconUrl,omitempty"`
}

// SupportedChain represents a supported blockchain network
type SupportedChain struct {
	ChainID        int            `json:"chainId"`
	Name           string         `json:"name"`
	ShortName      string         `json:"shortName"`
	NativeCurrency NativeCurrency `json:"nativeCurrency"`
	ExplorerURL    string         `json:"explorerUrl"`
	RpcURL         string         `json:"rpcUrl,omitempty"`
	IsTestnet      bool           `json:"isTestnet"`
	Assets         []string       `json:"assets"` // Supported asset symbols
}

// NativeCurrency represents the native currency of a chain
type NativeCurrency struct {
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

// SupportedFiat represents a supported fiat currency
type SupportedFiat struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	MinOrder string `json:"minOrder"`
	MaxOrder string `json:"maxOrder"`
}

// TradingPair represents a supported fiat-to-crypto trading pair
type TradingPair struct {
	FiatCode       string `json:"fiatCode"`
	CryptoSymbol   string `json:"cryptoSymbol"`
	MinFiatAmount  string `json:"minFiatAmount"`
	MaxFiatAmount  string `json:"maxFiatAmount"`
	FeePercent     string `json:"feePercent"`
	Available      bool   `json:"available"`
}

// SupportedAssetsResponse is returned by GET /supported-assets
type SupportedAssetsResponse struct {
	Assets []SupportedAsset `json:"assets"`
}

// SupportedChainsResponse is returned by GET /supported-chains
type SupportedChainsResponse struct {
	Chains []SupportedChain `json:"chains"`
}

// SupportedFiatsResponse is returned by GET /supported-fiats
type SupportedFiatsResponse struct {
	Fiats []SupportedFiat `json:"fiats"`
}

// TradingPairsResponse is returned by GET /trading-pairs
type TradingPairsResponse struct {
	Pairs []TradingPair `json:"pairs"`
}

// ========== Multi-Currency Rates (ONRAMP-05) ==========

// ExchangeRate represents an exchange rate between fiat and crypto
type ExchangeRate struct {
	FiatCode     string `json:"fiatCode"`
	CryptoSymbol string `json:"cryptoSymbol"`
	Rate         string `json:"rate"`
	InverseRate  string `json:"inverseRate"`
	UpdatedAt    string `json:"updatedAt"`
}

// FeeStructure represents the fee structure for a trading pair
type FeeStructure struct {
	FiatCode     string `json:"fiatCode"`
	CryptoSymbol string `json:"cryptoSymbol"`
	FeePercent   string `json:"feePercent"`
	MinFee       string `json:"minFee"`
	MaxFee       string `json:"maxFee,omitempty"` // Empty means no cap
}

// RatesResponse is returned by GET /rates
type RatesResponse struct {
	Rates []ExchangeRate `json:"rates"`
}

// FeesResponse is returned by GET /fees
type FeesResponse struct {
	Fees []FeeStructure `json:"fees"`
}
