// Package config provides centralized configuration constants for the SDK.
package config

import "time"

// ============================================================================
// Timeout Settings
// ============================================================================

const (
	// DefaultRPCTimeout is the default RPC request timeout (10 seconds).
	// Used for standard JSON-RPC calls to bundlers/paymasters.
	DefaultRPCTimeout = 10 * time.Second

	// DefaultProviderTimeout is the default provider request timeout (30 seconds).
	// Used for blockchain RPC provider calls (may need longer for complex queries).
	DefaultProviderTimeout = 30 * time.Second

	// DefaultConfirmationTimeout is the default transaction confirmation timeout (60 seconds).
	// Maximum wait time for transaction to be confirmed.
	DefaultConfirmationTimeout = 60 * time.Second

	// DefaultIndexerTimeout is the default indexer request timeout (30 seconds).
	// Used for indexer API calls.
	DefaultIndexerTimeout = 30 * time.Second
)

// ============================================================================
// Retry Settings
// ============================================================================

const (
	// DefaultMaxRetries is the default maximum retry attempts.
	// Number of times to retry a failed request.
	DefaultMaxRetries = 3

	// DefaultRetryDelay is the default retry delay (1 second).
	// Base delay between retries (used with exponential backoff).
	DefaultRetryDelay = 1 * time.Second

	// RetryBackoffMultiplier is the backoff multiplier for exponential retry.
	// Each retry waits: baseDelay * (multiplier ^ attemptNumber).
	RetryBackoffMultiplier = 2
)

// ============================================================================
// Polling Settings
// ============================================================================

const (
	// DefaultPollingInterval is the default polling interval (1 second).
	// How often to check for transaction receipt.
	DefaultPollingInterval = 1 * time.Second

	// UserOpPollingInterval is the UserOperation receipt polling interval.
	UserOpPollingInterval = 1 * time.Second
)

// ============================================================================
// Confirmation Settings
// ============================================================================

const (
	// DefaultConfirmations is the default confirmation count.
	// Number of block confirmations to wait for.
	DefaultConfirmations = 1
)

// ============================================================================
// Client Config Types
// ============================================================================

// TimeoutConfig contains timeout settings.
type TimeoutConfig struct {
	// RPC is the RPC request timeout.
	RPC time.Duration
	// Provider is the provider request timeout.
	Provider time.Duration
	// Confirmation is the transaction confirmation timeout.
	Confirmation time.Duration
	// Indexer is the indexer request timeout.
	Indexer time.Duration
}

// RetryConfig contains retry settings.
type RetryConfig struct {
	// MaxAttempts is the maximum retry attempts.
	MaxAttempts int
	// Delay is the base delay between retries.
	Delay time.Duration
	// BackoffMultiplier is the exponential backoff multiplier.
	BackoffMultiplier int
}

// PollingConfig contains polling settings.
type PollingConfig struct {
	// Interval is the polling interval.
	Interval time.Duration
	// UserOp is the UserOperation polling interval.
	UserOp time.Duration
}

// ConfirmationConfig contains confirmation settings.
type ConfirmationConfig struct {
	// Count is the number of confirmations to wait for.
	Count int
}

// ClientConfig contains complete client configuration.
type ClientConfig struct {
	Timeout      TimeoutConfig
	Retry        RetryConfig
	Polling      PollingConfig
	Confirmation ConfirmationConfig
}

// ============================================================================
// Default Configuration
// ============================================================================

// DefaultClientConfig returns the default client configuration.
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		Timeout: TimeoutConfig{
			RPC:          DefaultRPCTimeout,
			Provider:     DefaultProviderTimeout,
			Confirmation: DefaultConfirmationTimeout,
			Indexer:      DefaultIndexerTimeout,
		},
		Retry: RetryConfig{
			MaxAttempts:       DefaultMaxRetries,
			Delay:             DefaultRetryDelay,
			BackoffMultiplier: RetryBackoffMultiplier,
		},
		Polling: PollingConfig{
			Interval: DefaultPollingInterval,
			UserOp:   UserOpPollingInterval,
		},
		Confirmation: ConfirmationConfig{
			Count: DefaultConfirmations,
		},
	}
}

// DefaultTimeoutConfig returns the default timeout configuration.
func DefaultTimeoutConfig() TimeoutConfig {
	return TimeoutConfig{
		RPC:          DefaultRPCTimeout,
		Provider:     DefaultProviderTimeout,
		Confirmation: DefaultConfirmationTimeout,
		Indexer:      DefaultIndexerTimeout,
	}
}

// DefaultRetryConfig returns the default retry configuration.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:       DefaultMaxRetries,
		Delay:             DefaultRetryDelay,
		BackoffMultiplier: RetryBackoffMultiplier,
	}
}
