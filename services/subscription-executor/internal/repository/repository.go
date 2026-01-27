package repository

import (
	"context"
	"time"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
)

// SubscriptionRepository defines the interface for subscription persistence
type SubscriptionRepository interface {
	// Subscription CRUD
	Create(ctx context.Context, sub *model.Subscription) error
	GetByID(ctx context.Context, id string) (*model.Subscription, error)
	GetByAccount(ctx context.Context, account string) ([]*model.Subscription, error)
	Update(ctx context.Context, sub *model.Subscription) error
	UpdateStatus(ctx context.Context, id string, status model.SubscriptionStatus) error

	// Query methods
	GetDueSubscriptions(ctx context.Context, limit int) ([]*model.Subscription, error)
	GetDueSubscriptionsWithLock(ctx context.Context, limit int) ([]*model.Subscription, error)

	// Execution records
	CreateExecutionRecord(ctx context.Context, record *model.ExecutionRecord) error
	UpdateExecutionRecord(ctx context.Context, id int64, status, txHash, errMsg string, gasUsed string) error
	GetExecutionRecords(ctx context.Context, subscriptionID string, limit int) ([]*model.ExecutionRecord, error)

	// Idempotency
	GetIdempotencyRecord(ctx context.Context, key, method, path string) (*model.IdempotencyRecord, error)
	SaveIdempotencyRecord(ctx context.Context, record *model.IdempotencyRecord) error
	DeleteExpiredIdempotencyRecords(ctx context.Context) (int64, error)

	// Health check
	Ping(ctx context.Context) error

	// Close connection pool
	Close()
}

// Cursor represents a pagination cursor
type Cursor struct {
	CreatedAt time.Time
	ID        string
}

// ListOptions represents options for listing subscriptions
type ListOptions struct {
	Limit  int
	Cursor *Cursor
	Status *model.SubscriptionStatus
}
