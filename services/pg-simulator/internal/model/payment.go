package model

import (
	"time"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusApproved  PaymentStatus = "approved"
	PaymentStatusDeclined  PaymentStatus = "declined"
	PaymentStatusRefunded  PaymentStatus = "refunded"
	PaymentStatusCancelled PaymentStatus = "cancelled"
)

// PaymentMethod represents payment method type
type PaymentMethod string

const (
	PaymentMethodCard   PaymentMethod = "card"
	PaymentMethodBank   PaymentMethod = "bank_transfer"
	PaymentMethodWallet PaymentMethod = "wallet"
)

// Payment represents a payment transaction
type Payment struct {
	ID            string        `json:"id"`
	MerchantID    string        `json:"merchantId"`
	OrderID       string        `json:"orderId"`
	Amount        string        `json:"amount"`
	Currency      string        `json:"currency"`
	Method        PaymentMethod `json:"method"`
	Status        PaymentStatus `json:"status"`
	CardLast4     string        `json:"cardLast4,omitempty"`
	CardBrand     string        `json:"cardBrand,omitempty"`
	FailureReason string        `json:"failureReason,omitempty"`
	RefundedAt    *time.Time    `json:"refundedAt,omitempty"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

// CardDetails represents credit card details
type CardDetails struct {
	Number   string `json:"number" binding:"required"`
	ExpMonth string `json:"expMonth" binding:"required"`
	ExpYear  string `json:"expYear" binding:"required"`
	CVV      string `json:"cvv" binding:"required"`
	Name     string `json:"name" binding:"required"`
}

// CreatePaymentRequest represents a request to create a payment
type CreatePaymentRequest struct {
	MerchantID     string        `json:"merchantId" binding:"required"`
	OrderID        string        `json:"orderId" binding:"required"`
	Amount         string        `json:"amount" binding:"required"`
	Currency       string        `json:"currency" binding:"required"`
	Card           *CardDetails  `json:"card,omitempty"`
	Method         PaymentMethod `json:"method" binding:"required"`
	IdempotencyKey string        `json:"idempotencyKey,omitempty"` // Optional key to prevent duplicate payments
}

// RefundRequest represents a request to refund a payment
type RefundRequest struct {
	Amount string `json:"amount,omitempty"` // Empty = full refund
	Reason string `json:"reason,omitempty"`
}

// WebhookPayload represents a webhook notification payload
type WebhookPayload struct {
	EventType string      `json:"eventType"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}
