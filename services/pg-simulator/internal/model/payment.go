package model

import (
	"time"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending            PaymentStatus = "pending"
	PaymentStatusRequires3DS        PaymentStatus = "requires_3ds"
	PaymentStatusPending3DSComplete PaymentStatus = "pending_3ds_complete"
	PaymentStatusApproved           PaymentStatus = "approved"
	PaymentStatusDeclined           PaymentStatus = "declined"
	PaymentStatusRefunded           PaymentStatus = "refunded"
	PaymentStatusCancelled          PaymentStatus = "cancelled"
)

// ThreeDSecureStatus represents the status of 3D Secure authentication
type ThreeDSecureStatus string

const (
	ThreeDSecureStatusNotRequired ThreeDSecureStatus = "not_required"
	ThreeDSecureStatusPending     ThreeDSecureStatus = "pending"
	ThreeDSecureStatusChallenged  ThreeDSecureStatus = "challenged"
	ThreeDSecureStatusSucceeded   ThreeDSecureStatus = "succeeded"
	ThreeDSecureStatusFailed      ThreeDSecureStatus = "failed"
	ThreeDSecureStatusAbandoned   ThreeDSecureStatus = "abandoned"
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

	// 3D Secure fields
	ThreeDSecure *ThreeDSecureData `json:"threeDSecure,omitempty"`
}

// ThreeDSecureData contains 3D Secure authentication data
type ThreeDSecureData struct {
	Status            ThreeDSecureStatus `json:"status"`
	Version           string             `json:"version"`             // "1.0" or "2.0"
	ACSTransactionID  string             `json:"acsTransactionId"`    // Access Control Server transaction ID
	DSTransactionID   string             `json:"dsTransactionId"`     // Directory Server transaction ID
	AuthenticationURL string             `json:"authenticationUrl"`   // URL for cardholder authentication
	ChallengeRequired bool               `json:"challengeRequired"`   // Whether challenge is required
	ECI               string             `json:"eci,omitempty"`       // Electronic Commerce Indicator
	CAVV              string             `json:"cavv,omitempty"`      // Cardholder Authentication Verification Value
	AuthenticatedAt   *time.Time         `json:"authenticatedAt,omitempty"`
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

// ThreeDSecureInitiateRequest represents a request to initiate 3D Secure authentication
type ThreeDSecureInitiateRequest struct {
	ReturnURL string `json:"returnUrl" binding:"required"` // URL to redirect after authentication
	UserAgent string `json:"userAgent,omitempty"`          // Browser user agent
	IPAddress string `json:"ipAddress,omitempty"`          // Customer IP address
}

// ThreeDSecureInitiateResponse represents the response from 3D Secure initiation
type ThreeDSecureInitiateResponse struct {
	PaymentID         string             `json:"paymentId"`
	Status            ThreeDSecureStatus `json:"status"`
	ChallengeRequired bool               `json:"challengeRequired"`
	AuthenticationURL string             `json:"authenticationUrl,omitempty"` // URL to redirect for challenge
	ACSTransactionID  string             `json:"acsTransactionId,omitempty"`
}

// ThreeDSecureCompleteRequest represents a request to complete 3D Secure authentication
type ThreeDSecureCompleteRequest struct {
	ChallengeResponse string `json:"challengeResponse,omitempty"` // Response from the challenge (OTP, etc.)
}

// ThreeDSecureCompleteResponse represents the response from completing 3D Secure
type ThreeDSecureCompleteResponse struct {
	PaymentID   string             `json:"paymentId"`
	Status      ThreeDSecureStatus `json:"status"`
	PaymentStatus PaymentStatus    `json:"paymentStatus"`
	ECI         string             `json:"eci,omitempty"`
	CAVV        string             `json:"cavv,omitempty"`
}
