package lock

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	ErrLockNotAcquired = errors.New("lock not acquired")
	ErrLockNotHeld     = errors.New("lock not held")
	ErrLockExpired     = errors.New("lock expired")
)

// DistributedLock represents a distributed lock interface.
type DistributedLock interface {
	// Acquire attempts to acquire the lock with the given key.
	// Returns a Lock that must be released when done.
	Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error)

	// TryAcquire attempts to acquire the lock without blocking.
	// Returns ErrLockNotAcquired if the lock is already held.
	TryAcquire(ctx context.Context, key string, ttl time.Duration) (Lock, error)

	// AcquireWithRetry attempts to acquire the lock with retries.
	AcquireWithRetry(ctx context.Context, key string, ttl time.Duration, opts RetryOptions) (Lock, error)
}

// Lock represents an acquired lock.
type Lock interface {
	// Release releases the lock.
	Release(ctx context.Context) error

	// Extend extends the lock's TTL.
	Extend(ctx context.Context, ttl time.Duration) error

	// Key returns the lock key.
	Key() string

	// Token returns the unique token for this lock holder.
	Token() string

	// ExpiresAt returns the expiration time of the lock.
	ExpiresAt() time.Time
}

// RetryOptions configures lock acquisition retry behavior.
type RetryOptions struct {
	// MaxRetries is the maximum number of retry attempts.
	MaxRetries int
	// RetryDelay is the delay between retries.
	RetryDelay time.Duration
	// MaxRetryDelay is the maximum delay between retries (for exponential backoff).
	MaxRetryDelay time.Duration
	// UseExponentialBackoff enables exponential backoff for retries.
	UseExponentialBackoff bool
}

// DefaultRetryOptions returns sensible default retry options.
func DefaultRetryOptions() RetryOptions {
	return RetryOptions{
		MaxRetries:            5,
		RetryDelay:            100 * time.Millisecond,
		MaxRetryDelay:         2 * time.Second,
		UseExponentialBackoff: true,
	}
}

// LockInfo contains information about a lock.
type LockInfo struct {
	Key       string
	Token     string
	HeldBy    string
	AcquiredAt time.Time
	ExpiresAt time.Time
}
