// Package security provides security utilities for wallet operations.
package security

import (
	"sync"
	"time"
)

// ============================================================================
// Rate Limiter
// ============================================================================

// RateLimitCategory represents a category of rate-limited operations.
type RateLimitCategory string

const (
	// RateLimitCategoryTransaction limits transaction operations.
	RateLimitCategoryTransaction RateLimitCategory = "transaction"

	// RateLimitCategorySignature limits signature operations.
	RateLimitCategorySignature RateLimitCategory = "signature"

	// RateLimitCategoryRPC limits RPC calls.
	RateLimitCategoryRPC RateLimitCategory = "rpc"

	// RateLimitCategorySensitive limits sensitive operations.
	RateLimitCategorySensitive RateLimitCategory = "sensitive"
)

// RateLimitConfig configures rate limiting for a category.
type RateLimitConfig struct {
	// MaxRequests is the maximum number of requests allowed.
	MaxRequests int

	// Window is the time window for the limit.
	Window time.Duration

	// BurstSize is the maximum burst size.
	BurstSize int
}

// RateLimitResult contains the result of a rate limit check.
type RateLimitResult struct {
	// Allowed indicates if the request is allowed.
	Allowed bool `json:"allowed"`

	// Remaining is the number of remaining requests.
	Remaining int `json:"remaining"`

	// ResetAt is when the limit resets.
	ResetAt time.Time `json:"resetAt"`

	// RetryAfter is the duration to wait before retrying.
	RetryAfter time.Duration `json:"retryAfter,omitempty"`
}

// RateLimiter implements rate limiting for wallet operations.
type RateLimiter struct {
	mu       sync.RWMutex
	configs  map[RateLimitCategory]*RateLimitConfig
	counters map[string]*rateLimitCounter
	methods  map[string]RateLimitCategory
}

// rateLimitCounter tracks request counts for rate limiting.
type rateLimitCounter struct {
	count     int
	windowEnd time.Time
}

// NewRateLimiter creates a new RateLimiter with default configurations.
func NewRateLimiter() *RateLimiter {
	limiter := &RateLimiter{
		configs:  make(map[RateLimitCategory]*RateLimitConfig),
		counters: make(map[string]*rateLimitCounter),
		methods:  make(map[string]RateLimitCategory),
	}

	// Set default configurations
	limiter.SetConfig(RateLimitCategoryTransaction, &RateLimitConfig{
		MaxRequests: 10,
		Window:      time.Minute,
		BurstSize:   3,
	})

	limiter.SetConfig(RateLimitCategorySignature, &RateLimitConfig{
		MaxRequests: 20,
		Window:      time.Minute,
		BurstSize:   5,
	})

	limiter.SetConfig(RateLimitCategoryRPC, &RateLimitConfig{
		MaxRequests: 100,
		Window:      time.Minute,
		BurstSize:   20,
	})

	limiter.SetConfig(RateLimitCategorySensitive, &RateLimitConfig{
		MaxRequests: 5,
		Window:      time.Minute,
		BurstSize:   1,
	})

	// Register default method categorizations
	limiter.registerDefaultMethods()

	return limiter
}

// SetConfig sets the rate limit configuration for a category.
func (r *RateLimiter) SetConfig(category RateLimitCategory, config *RateLimitConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.configs[category] = config
}

// GetConfig returns the rate limit configuration for a category.
func (r *RateLimiter) GetConfig(category RateLimitCategory) *RateLimitConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.configs[category]
}

// RegisterMethod registers a method with a rate limit category.
func (r *RateLimiter) RegisterMethod(method string, category RateLimitCategory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.methods[method] = category
}

// Check checks if a request is allowed for a method.
func (r *RateLimiter) Check(method string) *RateLimitResult {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Get category for method
	category, ok := r.methods[method]
	if !ok {
		category = RateLimitCategoryRPC // Default category
	}

	// Get config for category
	config, ok := r.configs[category]
	if !ok {
		// No config, allow by default
		return &RateLimitResult{
			Allowed:   true,
			Remaining: -1,
		}
	}

	// Get or create counter
	key := string(category) + ":" + method
	counter, ok := r.counters[key]
	now := time.Now()

	if !ok || now.After(counter.windowEnd) {
		// New window
		counter = &rateLimitCounter{
			count:     0,
			windowEnd: now.Add(config.Window),
		}
		r.counters[key] = counter
	}

	// Check if allowed
	if counter.count >= config.MaxRequests {
		return &RateLimitResult{
			Allowed:    false,
			Remaining:  0,
			ResetAt:    counter.windowEnd,
			RetryAfter: counter.windowEnd.Sub(now),
		}
	}

	// Increment counter
	counter.count++

	return &RateLimitResult{
		Allowed:   true,
		Remaining: config.MaxRequests - counter.count,
		ResetAt:   counter.windowEnd,
	}
}

// CheckCategory checks if a request is allowed for a category.
func (r *RateLimiter) CheckCategory(category RateLimitCategory) *RateLimitResult {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Get config for category
	config, ok := r.configs[category]
	if !ok {
		return &RateLimitResult{
			Allowed:   true,
			Remaining: -1,
		}
	}

	// Get or create counter
	key := string(category)
	counter, ok := r.counters[key]
	now := time.Now()

	if !ok || now.After(counter.windowEnd) {
		counter = &rateLimitCounter{
			count:     0,
			windowEnd: now.Add(config.Window),
		}
		r.counters[key] = counter
	}

	// Check if allowed
	if counter.count >= config.MaxRequests {
		return &RateLimitResult{
			Allowed:    false,
			Remaining:  0,
			ResetAt:    counter.windowEnd,
			RetryAfter: counter.windowEnd.Sub(now),
		}
	}

	// Increment counter
	counter.count++

	return &RateLimitResult{
		Allowed:   true,
		Remaining: config.MaxRequests - counter.count,
		ResetAt:   counter.windowEnd,
	}
}

// Reset resets the rate limit counters for a category.
func (r *RateLimiter) Reset(category RateLimitCategory) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Remove all counters for this category
	prefix := string(category)
	for key := range r.counters {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(r.counters, key)
		}
	}
}

// ResetAll resets all rate limit counters.
func (r *RateLimiter) ResetAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.counters = make(map[string]*rateLimitCounter)
}

// registerDefaultMethods registers the default method categorizations.
func (r *RateLimiter) registerDefaultMethods() {
	// Transaction methods
	transactionMethods := []string{
		"eth_sendTransaction",
		"eth_sendRawTransaction",
		"eth_sendUserOperation",
	}
	for _, method := range transactionMethods {
		r.methods[method] = RateLimitCategoryTransaction
	}

	// Signature methods
	signatureMethods := []string{
		"personal_sign",
		"eth_sign",
		"eth_signTypedData",
		"eth_signTypedData_v4",
	}
	for _, method := range signatureMethods {
		r.methods[method] = RateLimitCategorySignature
	}

	// Sensitive methods
	sensitiveMethods := []string{
		"eth_accounts",
		"eth_requestAccounts",
		"wallet_requestPermissions",
		"wallet_addEthereumChain",
		"wallet_switchEthereumChain",
	}
	for _, method := range sensitiveMethods {
		r.methods[method] = RateLimitCategorySensitive
	}
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

// SlidingWindowLimiter implements a sliding window rate limiter.
type SlidingWindowLimiter struct {
	mu        sync.Mutex
	window    time.Duration
	maxCount  int
	timestamps []time.Time
}

// NewSlidingWindowLimiter creates a new sliding window rate limiter.
func NewSlidingWindowLimiter(maxCount int, window time.Duration) *SlidingWindowLimiter {
	return &SlidingWindowLimiter{
		window:    window,
		maxCount:  maxCount,
		timestamps: make([]time.Time, 0, maxCount),
	}
}

// Allow checks if a request is allowed and records it if so.
func (l *SlidingWindowLimiter) Allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-l.window)

	// Remove expired timestamps
	validTimestamps := make([]time.Time, 0, l.maxCount)
	for _, ts := range l.timestamps {
		if ts.After(windowStart) {
			validTimestamps = append(validTimestamps, ts)
		}
	}
	l.timestamps = validTimestamps

	// Check if allowed
	if len(l.timestamps) >= l.maxCount {
		return false
	}

	// Record this request
	l.timestamps = append(l.timestamps, now)
	return true
}

// Remaining returns the number of remaining requests.
func (l *SlidingWindowLimiter) Remaining() int {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-l.window)

	count := 0
	for _, ts := range l.timestamps {
		if ts.After(windowStart) {
			count++
		}
	}

	return l.maxCount - count
}

// Reset resets the limiter.
func (l *SlidingWindowLimiter) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.timestamps = make([]time.Time, 0, l.maxCount)
}

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

// TokenBucketLimiter implements a token bucket rate limiter.
type TokenBucketLimiter struct {
	mu         sync.Mutex
	capacity   int
	tokens     int
	refillRate time.Duration
	lastRefill time.Time
}

// NewTokenBucketLimiter creates a new token bucket rate limiter.
func NewTokenBucketLimiter(capacity int, refillRate time.Duration) *TokenBucketLimiter {
	return &TokenBucketLimiter{
		capacity:   capacity,
		tokens:     capacity,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow checks if a request is allowed and consumes a token if so.
func (l *TokenBucketLimiter) Allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(l.lastRefill)
	newTokens := int(elapsed / l.refillRate)

	if newTokens > 0 {
		l.tokens = minInt2(l.tokens+newTokens, l.capacity)
		l.lastRefill = now
	}

	// Check if token available
	if l.tokens <= 0 {
		return false
	}

	// Consume token
	l.tokens--
	return true
}

// AllowN checks if n requests are allowed and consumes tokens if so.
func (l *TokenBucketLimiter) AllowN(n int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(l.lastRefill)
	newTokens := int(elapsed / l.refillRate)

	if newTokens > 0 {
		l.tokens = minInt2(l.tokens+newTokens, l.capacity)
		l.lastRefill = now
	}

	// Check if enough tokens
	if l.tokens < n {
		return false
	}

	// Consume tokens
	l.tokens -= n
	return true
}

// Tokens returns the current number of tokens.
func (l *TokenBucketLimiter) Tokens() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.tokens
}

func minInt2(a, b int) int {
	if a < b {
		return a
	}
	return b
}
