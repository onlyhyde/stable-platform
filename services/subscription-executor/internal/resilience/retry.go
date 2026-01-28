package resilience

import (
	"context"
	"fmt"
	"math/rand/v2"
	"time"
)

const (
	DefaultMaxRetries     = 3
	DefaultInitialBackoff = 1 * time.Second
	DefaultMaxBackoff     = 10 * time.Second
)

// RetryConfig configures retry behavior.
type RetryConfig struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	IsRetryable    func(error) bool
}

// DefaultRetryConfig returns a retry config with sensible defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:     DefaultMaxRetries,
		InitialBackoff: DefaultInitialBackoff,
		MaxBackoff:     DefaultMaxBackoff,
		IsRetryable:    defaultIsRetryable,
	}
}

// WithRetry executes an operation with exponential backoff and jitter.
func WithRetry[T any](ctx context.Context, cfg RetryConfig, operation func() (T, error)) (T, error) {
	var zero T
	backoff := cfg.InitialBackoff
	isRetryable := cfg.IsRetryable
	if isRetryable == nil {
		isRetryable = defaultIsRetryable
	}

	var lastErr error
	for attempt := 1; attempt <= cfg.MaxRetries; attempt++ {
		result, err := operation()
		if err == nil {
			return result, nil
		}

		lastErr = err
		if !isRetryable(err) || attempt == cfg.MaxRetries {
			return zero, fmt.Errorf("after %d attempts: %w", attempt, lastErr)
		}

		// Check context before sleeping
		select {
		case <-ctx.Done():
			return zero, fmt.Errorf("context cancelled during retry: %w", ctx.Err())
		default:
		}

		// Add jitter: backoff * (0.5 to 1.5)
		jitter := time.Duration(float64(backoff) * (0.5 + rand.Float64()))
		sleepDuration := min(jitter, cfg.MaxBackoff)

		select {
		case <-ctx.Done():
			return zero, fmt.Errorf("context cancelled during retry: %w", ctx.Err())
		case <-time.After(sleepDuration):
		}

		backoff = min(backoff*2, cfg.MaxBackoff)
	}

	return zero, fmt.Errorf("after %d attempts: %w", cfg.MaxRetries, lastErr)
}

// WithRetryVoid executes a void operation with retry.
func WithRetryVoid(ctx context.Context, cfg RetryConfig, operation func() error) error {
	_, err := WithRetry(ctx, cfg, func() (struct{}, error) {
		return struct{}{}, operation()
	})
	return err
}

// defaultIsRetryable treats all errors as retryable by default.
func defaultIsRetryable(_ error) bool {
	return true
}
