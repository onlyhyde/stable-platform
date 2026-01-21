package model

import (
	"time"
)

// OrderStatus represents the status of an onramp order
type OrderStatus string

const (
	OrderStatusPending     OrderStatus = "pending"
	OrderStatusProcessing  OrderStatus = "processing"
	OrderStatusCompleted   OrderStatus = "completed"
	OrderStatusFailed      OrderStatus = "failed"
	OrderStatusCancelled   OrderStatus = "cancelled"
	OrderStatusKYCRequired OrderStatus = "kyc_required"
)

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
	ID               string        `json:"id"`
	UserID           string        `json:"userId"`
	WalletAddress    string        `json:"walletAddress"`
	FiatAmount       string        `json:"fiatAmount"`
	FiatCurrency     string        `json:"fiatCurrency"`
	CryptoAmount     string        `json:"cryptoAmount"`
	CryptoCurrency   string        `json:"cryptoCurrency"`
	ExchangeRate     string        `json:"exchangeRate"`
	Fee              string        `json:"fee"`
	PaymentMethod    PaymentMethod `json:"paymentMethod"`
	Status           OrderStatus   `json:"status"`
	FailureReason    string        `json:"failureReason,omitempty"`
	TxHash           string        `json:"txHash,omitempty"`
	ChainID          int           `json:"chainId"`
	KYCStatus        string        `json:"kycStatus,omitempty"`
	CreatedAt        time.Time     `json:"createdAt"`
	UpdatedAt        time.Time     `json:"updatedAt"`
	CompletedAt      *time.Time    `json:"completedAt,omitempty"`
}

// CreateOrderRequest represents a request to create an order
type CreateOrderRequest struct {
	UserID        string        `json:"userId" binding:"required"`
	WalletAddress string        `json:"walletAddress" binding:"required"`
	FiatAmount    string        `json:"fiatAmount" binding:"required"`
	FiatCurrency  string        `json:"fiatCurrency" binding:"required"`
	CryptoCurrency string       `json:"cryptoCurrency" binding:"required"`
	PaymentMethod PaymentMethod `json:"paymentMethod" binding:"required"`
	ChainID       int           `json:"chainId" binding:"required"`
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
	EventType string      `json:"eventType"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}
