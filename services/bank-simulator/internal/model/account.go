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
