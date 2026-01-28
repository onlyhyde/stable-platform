package model

import (
	"math/big"
	"time"
)

// SubscriptionStatus represents the status of a subscription
type SubscriptionStatus string

const (
	StatusActive             SubscriptionStatus = "active"
	StatusPaused             SubscriptionStatus = "paused"
	StatusCancelled          SubscriptionStatus = "cancelled"
	StatusExpired            SubscriptionStatus = "expired"
	StatusPermissionRevoked  SubscriptionStatus = "permission_revoked"
)

// Subscription represents a recurring payment subscription
type Subscription struct {
	ID              string             `json:"id" db:"id"`
	SmartAccount    string             `json:"smartAccount" db:"smart_account"`
	Recipient       string             `json:"recipient" db:"recipient"`
	Token           string             `json:"token" db:"token"`
	Amount          *big.Int           `json:"amount" db:"amount"`
	Interval        int64              `json:"interval" db:"interval_seconds"` // in seconds
	PermissionID    string             `json:"permissionId,omitempty" db:"permission_id"` // ERC-7715 permission ID
	NextExecution   time.Time          `json:"nextExecution" db:"next_execution"`
	LastExecution   *time.Time         `json:"lastExecution,omitempty" db:"last_execution"`
	ExecutionCount  int64              `json:"executionCount" db:"execution_count"`
	MaxExecutions   int64              `json:"maxExecutions" db:"max_executions"` // 0 = unlimited
	Status          SubscriptionStatus `json:"status" db:"status"`
	CreatedAt       time.Time          `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time          `json:"updatedAt" db:"updated_at"`
}

// ExecutionRecord represents a single execution attempt
type ExecutionRecord struct {
	ID             string    `json:"id" db:"id"`
	SubscriptionID string    `json:"subscriptionId" db:"subscription_id"`
	UserOpHash     string    `json:"userOpHash,omitempty" db:"user_op_hash"`
	TxHash         string    `json:"txHash,omitempty" db:"tx_hash"`
	Status         string    `json:"status" db:"status"` // pending, success, failed
	Error          string    `json:"error,omitempty" db:"error"`
	GasUsed        *big.Int  `json:"gasUsed,omitempty" db:"gas_used"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

// CreateSubscriptionRequest represents a request to create a subscription
type CreateSubscriptionRequest struct {
	SmartAccount  string `json:"smartAccount" binding:"required"`
	Recipient     string `json:"recipient" binding:"required"`
	Token         string `json:"token" binding:"required"`
	Amount        string `json:"amount" binding:"required"`
	IntervalDays  int    `json:"intervalDays" binding:"required,min=1"`
	MaxExecutions int64  `json:"maxExecutions"` // 0 = unlimited
}

// SubscriptionResponse represents the API response for a subscription
type SubscriptionResponse struct {
	ID             string    `json:"id"`
	SmartAccount   string    `json:"smartAccount"`
	Recipient      string    `json:"recipient"`
	Token          string    `json:"token"`
	Amount         string    `json:"amount"`
	IntervalDays   int       `json:"intervalDays"`
	NextExecution  string    `json:"nextExecution"`
	LastExecution  string    `json:"lastExecution,omitempty"`
	ExecutionCount int64     `json:"executionCount"`
	MaxExecutions  int64     `json:"maxExecutions"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
}

// ToResponse converts a Subscription to SubscriptionResponse
func (s *Subscription) ToResponse() *SubscriptionResponse {
	resp := &SubscriptionResponse{
		ID:             s.ID,
		SmartAccount:   s.SmartAccount,
		Recipient:      s.Recipient,
		Token:          s.Token,
		Amount:         s.Amount.String(),
		IntervalDays:   int(s.Interval / 86400),
		NextExecution:  s.NextExecution.Format(time.RFC3339),
		ExecutionCount: s.ExecutionCount,
		MaxExecutions:  s.MaxExecutions,
		Status:         string(s.Status),
		CreatedAt:      s.CreatedAt,
	}
	if s.LastExecution != nil {
		resp.LastExecution = s.LastExecution.Format(time.RFC3339)
	}
	return resp
}

// IsDue checks if the subscription is due for execution
func (s *Subscription) IsDue() bool {
	if s.Status != StatusActive {
		return false
	}
	if s.MaxExecutions > 0 && s.ExecutionCount >= s.MaxExecutions {
		return false
	}
	return time.Now().After(s.NextExecution)
}
