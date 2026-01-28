package model

import (
	"time"
)

// AccountStatus represents the status of a bank account
type AccountStatus string

const (
	AccountStatusActive   AccountStatus = "active"
	AccountStatusFrozen   AccountStatus = "frozen"
	AccountStatusClosed   AccountStatus = "closed"
)

// Account represents a simulated bank account
type Account struct {
	ID          string        `json:"id"`
	AccountNo   string        `json:"accountNo"`
	Name        string        `json:"name"`
	Currency    string        `json:"currency"`
	Balance     string        `json:"balance"` // String to avoid float precision issues
	Status      AccountStatus `json:"status"`
	ClosedAt    *time.Time    `json:"closedAt,omitempty"`
	CloseReason string        `json:"closeReason,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// TransferStatus represents the status of a transfer
type TransferStatus string

const (
	TransferStatusPending   TransferStatus = "pending"
	TransferStatusCompleted TransferStatus = "completed"
	TransferStatusFailed    TransferStatus = "failed"
)

// Transfer represents a bank transfer
type Transfer struct {
	ID              string         `json:"id"`
	FromAccountNo   string         `json:"fromAccountNo"`
	ToAccountNo     string         `json:"toAccountNo"`
	Amount          string         `json:"amount"`
	Currency        string         `json:"currency"`
	Reference       string         `json:"reference"`
	Status          TransferStatus `json:"status"`
	FailureReason   string         `json:"failureReason,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	CompletedAt     *time.Time     `json:"completedAt,omitempty"`
}

// CreateAccountRequest represents a request to create an account
type CreateAccountRequest struct {
	Name     string `json:"name" binding:"required"`
	Currency string `json:"currency" binding:"required"`
	Balance  string `json:"balance,omitempty"`
}

// TransferRequest represents a request to transfer funds
type TransferRequest struct {
	FromAccountNo string `json:"fromAccountNo" binding:"required"`
	ToAccountNo   string `json:"toAccountNo" binding:"required"`
	Amount        string `json:"amount" binding:"required"`
	Reference     string `json:"reference,omitempty"`
}

// WebhookPayload represents a webhook notification payload
type WebhookPayload struct {
	EventType string      `json:"eventType"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// TransactionType represents the type of a transaction
type TransactionType string

const (
	TransactionTypeDeposit     TransactionType = "deposit"
	TransactionTypeWithdraw    TransactionType = "withdraw"
	TransactionTypeTransferIn  TransactionType = "transfer_in"
	TransactionTypeTransferOut TransactionType = "transfer_out"
	TransactionTypeDebit       TransactionType = "debit" // Direct Debit용
)

// Transaction represents a single transaction record
type Transaction struct {
	ID            string          `json:"id"`
	AccountNo     string          `json:"accountNo"`
	Type          TransactionType `json:"type"`
	Amount        string          `json:"amount"`
	BalanceBefore string          `json:"balanceBefore"`
	BalanceAfter  string          `json:"balanceAfter"`
	Reference     string          `json:"reference,omitempty"`
	Description   string          `json:"description,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
}

// DepositRequest represents a request to deposit funds
type DepositRequest struct {
	Amount      string `json:"amount" binding:"required"`
	Reference   string `json:"reference"`
	Description string `json:"description"`
}

// WithdrawRequest represents a request to withdraw funds
type WithdrawRequest struct {
	Amount      string `json:"amount" binding:"required"`
	Reference   string `json:"reference"`
	Description string `json:"description"`
}

// VerificationStatus represents the status of a verification
type VerificationStatus string

const (
	VerificationStatusPending  VerificationStatus = "pending"
	VerificationStatusVerified VerificationStatus = "verified"
	VerificationStatusExpired  VerificationStatus = "expired"
	VerificationStatusFailed   VerificationStatus = "failed"
)

// Verification represents a 1-won verification record
type Verification struct {
	ID          string             `json:"id"`
	AccountNo   string             `json:"accountNo"`
	Code        string             `json:"-"` // 내부용, 응답에 포함 안함
	Status      VerificationStatus `json:"status"`
	Attempts    int                `json:"attempts"`
	MaxAttempts int                `json:"maxAttempts"`
	ExpiresAt   time.Time          `json:"expiresAt"`
	CreatedAt   time.Time          `json:"createdAt"`
	VerifiedAt  *time.Time         `json:"verifiedAt,omitempty"`
}

// VerifyAccountRequest represents a request to verify account holder
type VerifyAccountRequest struct {
	AccountNo  string `json:"accountNo" binding:"required"`
	HolderName string `json:"holderName" binding:"required"`
}

// VerifyAccountResponse represents the response for account verification
type VerifyAccountResponse struct {
	Verified   bool   `json:"verified"`
	AccountNo  string `json:"accountNo,omitempty"`
	MaskedName string `json:"maskedName,omitempty"`
	Status     string `json:"status,omitempty"`
	Reason     string `json:"reason,omitempty"`
}

// InitiateVerificationRequest represents a request to start 1-won verification
type InitiateVerificationRequest struct {
	AccountNo string `json:"accountNo" binding:"required"`
}

// InitiateVerificationResponse represents the response for 1-won verification initiation
type InitiateVerificationResponse struct {
	VerificationID    string    `json:"verificationId"`
	AccountNo         string    `json:"accountNo"`
	Amount            string    `json:"amount"`
	DepositorName     string    `json:"depositorName"`
	ExpiresAt         time.Time `json:"expiresAt"`
	AttemptsRemaining int       `json:"attemptsRemaining"`
}

// CompleteVerificationRequest represents a request to complete 1-won verification
type CompleteVerificationRequest struct {
	VerificationID string `json:"verificationId" binding:"required"`
	Code           string `json:"code" binding:"required"`
}

// CompleteVerificationResponse represents the response for 1-won verification completion
type CompleteVerificationResponse struct {
	Verified          bool   `json:"verified"`
	VerificationID    string `json:"verificationId"`
	AccountNo         string `json:"accountNo,omitempty"`
	Reason            string `json:"reason,omitempty"`
	AttemptsRemaining int    `json:"attemptsRemaining,omitempty"`
}

// DebitRequestStatus represents the status of a debit request
type DebitRequestStatus string

const (
	DebitRequestStatusPending    DebitRequestStatus = "pending"
	DebitRequestStatusProcessing DebitRequestStatus = "processing"
	DebitRequestStatusCompleted  DebitRequestStatus = "completed"
	DebitRequestStatusRejected   DebitRequestStatus = "rejected"
	DebitRequestStatusCancelled  DebitRequestStatus = "cancelled"
)

// DebitRequest represents a direct debit request
type DebitRequest struct {
	ID             string             `json:"id"`
	IdempotencyKey string             `json:"idempotencyKey"`
	AccountNo      string             `json:"accountNo"`
	Amount         string             `json:"amount"`
	Currency       string             `json:"currency"`
	CreditorID     string             `json:"creditorId"`
	CreditorName   string             `json:"creditorName"`
	Reference      string             `json:"reference,omitempty"`
	Description    string             `json:"description,omitempty"`
	WebhookURL     string             `json:"webhookUrl,omitempty"`
	Status         DebitRequestStatus `json:"status"`
	FailureReason  string             `json:"failureReason,omitempty"`
	TransactionID  string             `json:"transactionId,omitempty"`
	AutoApprove    bool               `json:"-"`
	CreatedAt      time.Time          `json:"createdAt"`
	ProcessedAt    *time.Time         `json:"processedAt,omitempty"`
	CancelledAt    *time.Time         `json:"cancelledAt,omitempty"`
}

// CreateDebitRequestInput represents a request to create a debit request
type CreateDebitRequestInput struct {
	IdempotencyKey string `json:"idempotencyKey" binding:"required"`
	AccountNo      string `json:"accountNo" binding:"required"`
	Amount         string `json:"amount" binding:"required"`
	Currency       string `json:"currency" binding:"required"`
	CreditorID     string `json:"creditorId" binding:"required"`
	CreditorName   string `json:"creditorName" binding:"required"`
	Reference      string `json:"reference"`
	Description    string `json:"description"`
	WebhookURL     string `json:"webhookUrl"`
	AutoApprove    bool   `json:"autoApprove"`
}

// IdempotencyRecord tracks idempotency keys
type IdempotencyRecord struct {
	DebitRequestID string    `json:"debitRequestId"`
	CreatedAt      time.Time `json:"createdAt"`
}

// CancelDebitRequestResponse represents the response for cancelling a debit request
type CancelDebitRequestResponse struct {
	ID          string     `json:"id"`
	Status      string     `json:"status"`
	CancelledAt *time.Time `json:"cancelledAt,omitempty"`
}

// ========== Transaction History (BANK-04) ==========

// TransactionView represents a transaction with counterparty info
type TransactionView struct {
	ID            string            `json:"id"`
	AccountNo     string            `json:"accountNo"`
	Type          TransactionType   `json:"type"`
	Amount        string            `json:"amount"`
	BalanceBefore string            `json:"balanceBefore"`
	BalanceAfter  string            `json:"balanceAfter"`
	Reference     string            `json:"reference,omitempty"`
	Description   string            `json:"description,omitempty"`
	Counterparty  *CounterpartyInfo `json:"counterparty,omitempty"`
	CreatedAt     time.Time         `json:"createdAt"`
}

// CounterpartyInfo represents counterparty details for a transaction
type CounterpartyInfo struct {
	AccountNo  string `json:"accountNo,omitempty"`
	Name       string `json:"name,omitempty"`
	CreditorID string `json:"creditorId,omitempty"`
}

// TransactionListResponse represents paginated transaction list
type TransactionListResponse struct {
	Transactions []*TransactionView `json:"transactions"`
	Pagination   PaginationInfo     `json:"pagination"`
}

// PaginationInfo represents cursor-based pagination metadata
type PaginationInfo struct {
	HasMore    bool   `json:"hasMore"`
	NextCursor string `json:"nextCursor,omitempty"`
	TotalCount int    `json:"totalCount"`
}

// TransactionQuery represents query parameters for transaction search
type TransactionQuery struct {
	AccountNo string
	Type      string
	FromDate  string
	ToDate    string
	Limit     int
	Cursor    string
	Order     string // "asc" or "desc"
}

// ========== Account Close (BANK-05) ==========

// CloseAccountRequest represents a request to close an account
type CloseAccountRequest struct {
	Reason string `json:"reason"`
	Force  bool   `json:"force"`
}

// CloseAccountResponse represents the response for account closure
type CloseAccountResponse struct {
	AccountNo      string    `json:"accountNo"`
	Status         string    `json:"status"`
	PreviousStatus string    `json:"previousStatus"`
	ClosedAt       time.Time `json:"closedAt"`
	Reason         string    `json:"reason"`
	FinalBalance   string    `json:"finalBalance"`
}
