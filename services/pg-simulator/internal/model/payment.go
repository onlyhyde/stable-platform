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
	SettledAt     *time.Time    `json:"settledAt,omitempty"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`

	// 3D Secure fields
	ThreeDSecure *ThreeDSecureData `json:"threeDSecure,omitempty"`

	// Bank transfer fields
	BankAccountNo  string `json:"bankAccountNo,omitempty"`  // Masked account number
	BankHolderName string `json:"bankHolderName,omitempty"` // Masked holder name
	DebitRequestID string `json:"debitRequestId,omitempty"` // bank-simulator debit request ID
	ReturnURL      string `json:"returnUrl,omitempty"`
	CancelURL      string `json:"cancelUrl,omitempty"`

	// Wallet fields
	WalletID   string     `json:"walletId,omitempty"`
	WalletType WalletType `json:"walletType,omitempty"`
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
	MerchantID     string           `json:"merchantId" binding:"required"`
	OrderID        string           `json:"orderId" binding:"required"`
	Amount         string           `json:"amount" binding:"required"`
	Currency       string           `json:"currency" binding:"required"`
	Card           *CardDetails     `json:"card,omitempty"`
	Method         PaymentMethod    `json:"method" binding:"required"`
	IdempotencyKey string           `json:"idempotencyKey,omitempty"` // Optional key to prevent duplicate payments
	BankAccount    *BankAccountInfo `json:"bankAccount,omitempty"`    // Required for bank_transfer
	WalletID       string           `json:"walletId,omitempty"`       // Required for wallet
	ReturnURL      string           `json:"returnUrl,omitempty"`
	CancelURL      string           `json:"cancelUrl,omitempty"`
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
	PaymentID     string             `json:"paymentId"`
	Status        ThreeDSecureStatus `json:"status"`
	PaymentStatus PaymentStatus      `json:"paymentStatus"`
	ECI           string             `json:"eci,omitempty"`
	CAVV          string             `json:"cavv,omitempty"`
}

// BankAccountInfo represents bank account information for bank transfer payments
type BankAccountInfo struct {
	AccountNo  string `json:"accountNo" binding:"required"`
	HolderName string `json:"holderName" binding:"required"`
}

// WalletType represents the type of wallet
type WalletType string

const (
	WalletTypeKakao  WalletType = "kakao"
	WalletTypeNaver  WalletType = "naver"
	WalletTypeToss   WalletType = "toss"
	WalletTypePayco  WalletType = "payco"
	WalletTypeCustom WalletType = "custom"
)

// WalletStatus represents the status of a wallet
type WalletStatus string

const (
	WalletStatusActive   WalletStatus = "active"
	WalletStatusInactive WalletStatus = "inactive"
)

// Wallet represents a registered payment wallet
type Wallet struct {
	ID         string       `json:"id"`
	UserID     string       `json:"userId"`
	Name       string       `json:"name"`
	Type       WalletType   `json:"type"`
	CardLast4  string       `json:"cardLast4"`
	CardBrand  string       `json:"cardBrand"`
	Status     WalletStatus `json:"status"`
	// Internal fields (not included in response)
	CardNumber string    `json:"-"`
	CardExpiry string    `json:"-"`
	CardCVV    string    `json:"-"`
	CardName   string    `json:"-"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// CreateWalletRequest represents a request to create a wallet
type CreateWalletRequest struct {
	UserID      string       `json:"userId" binding:"required"`
	Name        string       `json:"name" binding:"required"`
	Type        WalletType   `json:"type" binding:"required"`
	DefaultCard *CardDetails `json:"defaultCard" binding:"required"`
}

// WalletListResponse represents a response containing a list of wallets
type WalletListResponse struct {
	Wallets []*Wallet `json:"wallets"`
}

// ========== Settlement (PG-05) ==========

// SettlementStatus represents the status of a settlement
type SettlementStatus string

const (
	SettlementStatusPending    SettlementStatus = "pending"
	SettlementStatusProcessing SettlementStatus = "processing"
	SettlementStatusCompleted  SettlementStatus = "completed"
	SettlementStatusFailed     SettlementStatus = "failed"
)

// Merchant represents a registered merchant
type Merchant struct {
	ID                    string    `json:"id"`
	Name                  string    `json:"name"`
	FeeRate               string    `json:"feeRate"` // "0.03" = 3%
	SettlementBankAccount string    `json:"settlementBankAccount"`
	Status                string    `json:"status"` // active, suspended
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

// CreateMerchantRequest represents a request to register a merchant
type CreateMerchantRequest struct {
	ID                    string `json:"id" binding:"required"`
	Name                  string `json:"name" binding:"required"`
	FeeRate               string `json:"feeRate" binding:"required"`
	SettlementBankAccount string `json:"settlementBankAccount" binding:"required"`
}

// Settlement represents a settlement record for a merchant
type Settlement struct {
	ID            string           `json:"id"`
	BatchID       string           `json:"batchId"`
	MerchantID    string           `json:"merchantId"`
	PaymentCount  int              `json:"paymentCount"`
	PaymentIDs    []string         `json:"paymentIds,omitempty"`
	GrossAmount   string           `json:"grossAmount"`
	FeeAmount     string           `json:"feeAmount"`
	NetAmount     string           `json:"netAmount"`
	BankAccountNo string           `json:"bankAccountNo"`
	TransactionID string           `json:"transactionId,omitempty"`
	Status        SettlementStatus `json:"status"`
	FailureReason string           `json:"failureReason,omitempty"`
	CreatedAt     time.Time        `json:"createdAt"`
	SettledAt     *time.Time       `json:"settledAt,omitempty"`
}

// SettlementBatch represents a batch of settlements
type SettlementBatch struct {
	ID          string           `json:"id"`
	Status      SettlementStatus `json:"status"`
	Settlements []*Settlement    `json:"settlements,omitempty"`
	Summary     *BatchSummary    `json:"summary,omitempty"`
	CreatedAt   time.Time        `json:"createdAt"`
	CompletedAt *time.Time       `json:"completedAt,omitempty"`
}

// BatchSummary represents summary of a settlement batch
type BatchSummary struct {
	TotalGross   string `json:"totalGross"`
	TotalFees    string `json:"totalFees"`
	TotalNet     string `json:"totalNet"`
	SuccessCount int    `json:"successCount"`
	FailedCount  int    `json:"failedCount"`
}

// ProcessSettlementRequest represents a request to process a settlement batch
type ProcessSettlementRequest struct {
	MerchantID string `json:"merchantId"`
	FromDate   string `json:"fromDate"`
	ToDate     string `json:"toDate"`
}

// AdjustmentType represents the type of settlement adjustment
type AdjustmentType string

const (
	AdjustmentTypeDeduction AdjustmentType = "deduction"
	AdjustmentTypeAddition  AdjustmentType = "addition"
)

// Adjustment represents a settlement adjustment
type Adjustment struct {
	ID            string         `json:"id"`
	SettlementID  string         `json:"settlementId"`
	MerchantID    string         `json:"merchantId"`
	Type          AdjustmentType `json:"type"`
	Amount        string         `json:"amount"`
	Reason        string         `json:"reason"`
	ReferenceID   string         `json:"referenceId,omitempty"`
	Description   string         `json:"description,omitempty"`
	Status        string         `json:"status"` // applied, pending, rejected
	BalanceBefore string         `json:"balanceBefore"`
	BalanceAfter  string         `json:"balanceAfter"`
	CreatedAt     time.Time      `json:"createdAt"`
}

// CreateAdjustmentRequest represents a request to create a settlement adjustment
type CreateAdjustmentRequest struct {
	Type        AdjustmentType `json:"type" binding:"required"`
	Amount      string         `json:"amount" binding:"required"`
	Reason      string         `json:"reason" binding:"required"`
	ReferenceID string         `json:"referenceId"`
	Description string         `json:"description"`
}

// AdjustmentSummary represents summary of adjustments for a settlement
type AdjustmentSummary struct {
	TotalDeductions   string `json:"totalDeductions"`
	TotalAdditions    string `json:"totalAdditions"`
	NetAdjustment     string `json:"netAdjustment"`
	AdjustedNetAmount string `json:"adjustedNetAmount"`
}

// MerchantSettlementsResponse represents merchant settlement history
type MerchantSettlementsResponse struct {
	Settlements []*Settlement `json:"settlements"`
	Total       int           `json:"total"`
}

// AdjustmentsResponse represents adjustments list with summary
type AdjustmentsResponse struct {
	Adjustments []*Adjustment      `json:"adjustments"`
	Summary     *AdjustmentSummary `json:"summary"`
}

// ========== Checkout Session (PG-04) ==========

// CheckoutSessionStatus represents the status of a checkout session
type CheckoutSessionStatus string

const (
	CheckoutSessionStatusPending   CheckoutSessionStatus = "pending"
	CheckoutSessionStatusCompleted CheckoutSessionStatus = "completed"
	CheckoutSessionStatusExpired   CheckoutSessionStatus = "expired"
	CheckoutSessionStatusCancelled CheckoutSessionStatus = "cancelled"
)

// CheckoutSession represents a checkout session
type CheckoutSession struct {
	ID          string                `json:"id"`
	MerchantID  string                `json:"merchantId"`
	OrderID     string                `json:"orderId"`
	OrderName   string                `json:"orderName,omitempty"`
	Amount      string                `json:"amount"`
	Currency    string                `json:"currency"`
	ReturnURL   string                `json:"returnUrl"`
	CancelURL   string                `json:"cancelUrl"`
	CheckoutURL string                `json:"checkoutUrl"`
	PaymentID   string                `json:"paymentId,omitempty"`
	Status      CheckoutSessionStatus `json:"status"`
	ExpiresAt   time.Time             `json:"expiresAt"`
	CreatedAt   time.Time             `json:"createdAt"`
	UpdatedAt   time.Time             `json:"updatedAt"`
}

// CreateCheckoutSessionRequest represents a request to create a checkout session
type CreateCheckoutSessionRequest struct {
	MerchantID    string `json:"merchantId" binding:"required"`
	OrderID       string `json:"orderId" binding:"required"`
	OrderName     string `json:"orderName,omitempty"`
	Amount        string `json:"amount" binding:"required"`
	Currency      string `json:"currency" binding:"required"`
	CustomerEmail string `json:"customerEmail,omitempty"`
	ReturnURL     string `json:"returnUrl" binding:"required"`
	CancelURL     string `json:"cancelUrl" binding:"required"`
}
