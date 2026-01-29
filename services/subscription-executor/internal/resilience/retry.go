package resilience

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"
)

// Common non-retryable errors
var (
	// ErrValidation indicates a validation error that should not be retried
	ErrValidation = errors.New("validation error")
	// ErrUnauthorized indicates an authentication/authorization error
	ErrUnauthorized = errors.New("unauthorized")
	// ErrNotFound indicates a resource not found error
	ErrNotFound = errors.New("not found")
	// ErrInvalidInput indicates invalid user input
	ErrInvalidInput = errors.New("invalid input")
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

// defaultIsRetryable determines if an error should be retried.
// It returns false for validation errors, authorization errors, and context cancellation.
func defaultIsRetryable(err error) bool {
	if err == nil {
		return false
	}

	// Don't retry on context cancellation or timeout
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	// Don't retry on validation or input errors
	if errors.Is(err, ErrValidation) || errors.Is(err, ErrInvalidInput) {
		return false
	}

	// Don't retry on authorization errors
	if errors.Is(err, ErrUnauthorized) {
		return false
	}

	// Don't retry on not found errors
	if errors.Is(err, ErrNotFound) {
		return false
	}

	// Check for common non-retryable error patterns in the error message
	errMsg := strings.ToLower(err.Error())
	nonRetryablePatterns := []string{
		"invalid",
		"unauthorized",
		"forbidden",
		"not found",
		"validation",
		"permission denied",
	}
	for _, pattern := range nonRetryablePatterns {
		if strings.Contains(errMsg, pattern) {
			return false
		}
	}

	// Default: retry the error
	return true
}
