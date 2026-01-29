package lock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// InMemoryLock provides an in-memory distributed lock implementation.
// Suitable for single-instance deployments or testing.
type InMemoryLock struct {
	mu    sync.Mutex
	locks map[string]*lockEntry
}

type lockEntry struct {
	token     string
	expiresAt time.Time
}

// NewInMemoryLock creates a new in-memory lock store.
func NewInMemoryLock() *InMemoryLock {
	l := &InMemoryLock{
		locks: make(map[string]*lockEntry),
	}
	// Start cleanup goroutine
	go l.cleanupLoop()
	return l
}

// Acquire blocks until the lock is acquired or context is cancelled.
func (l *InMemoryLock) Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error) {
	return l.AcquireWithRetry(ctx, key, ttl, RetryOptions{
		MaxRetries:            -1, // Infinite retries
		RetryDelay:            50 * time.Millisecond,
		MaxRetryDelay:         time.Second,
		UseExponentialBackoff: true,
	})
}

// TryAcquire attempts to acquire the lock without blocking.
func (l *InMemoryLock) TryAcquire(ctx context.Context, key string, ttl time.Duration) (Lock, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Check if lock exists and is not expired
	if entry, exists := l.locks[key]; exists {
		if time.Now().Before(entry.expiresAt) {
			return nil, ErrLockNotAcquired
		}
	}

	// Acquire the lock
	token := generateToken()
	expiresAt := time.Now().Add(ttl)

	l.locks[key] = &lockEntry{
		token:     token,
		expiresAt: expiresAt,
	}

	return &inMemoryLockHandle{
		store:     l,
		key:       key,
		token:     token,
		expiresAt: expiresAt,
	}, nil
}

// AcquireWithRetry attempts to acquire the lock with retries.
func (l *InMemoryLock) AcquireWithRetry(ctx context.Context, key string, ttl time.Duration, opts RetryOptions) (Lock, error) {
	delay := opts.RetryDelay
	attempts := 0

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		lock, err := l.TryAcquire(ctx, key, ttl)
		if err == nil {
			return lock, nil
		}

		if err != ErrLockNotAcquired {
			return nil, err
		}

		attempts++
		if opts.MaxRetries >= 0 && attempts >= opts.MaxRetries {
			return nil, ErrLockNotAcquired
		}

		// Wait before retry
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}

		// Exponential backoff
		if opts.UseExponentialBackoff {
			delay *= 2
			if delay > opts.MaxRetryDelay {
				delay = opts.MaxRetryDelay
			}
		}
	}
}

// release releases the lock if held by the given token.
func (l *InMemoryLock) release(key, token string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.locks[key]
	if !exists {
		return ErrLockNotHeld
	}

	if entry.token != token {
		return ErrLockNotHeld
	}

	delete(l.locks, key)
	return nil
}

// extend extends the lock's TTL if held by the given token.
func (l *InMemoryLock) extend(key, token string, ttl time.Duration) (time.Time, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.locks[key]
	if !exists {
		return time.Time{}, ErrLockNotHeld
	}

	if entry.token != token {
		return time.Time{}, ErrLockNotHeld
	}

	if time.Now().After(entry.expiresAt) {
		delete(l.locks, key)
		return time.Time{}, ErrLockExpired
	}

	entry.expiresAt = time.Now().Add(ttl)
	return entry.expiresAt, nil
}

// cleanupLoop periodically removes expired locks.
func (l *InMemoryLock) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		l.cleanup()
	}
}

func (l *InMemoryLock) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for key, entry := range l.locks {
		if now.After(entry.expiresAt) {
			delete(l.locks, key)
		}
	}
}

// inMemoryLockHandle represents an acquired lock.
type inMemoryLockHandle struct {
	store     *InMemoryLock
	key       string
	token     string
	expiresAt time.Time
	released  bool
	mu        sync.Mutex
}

// Release releases the lock.
func (h *inMemoryLockHandle) Release(ctx context.Context) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.released {
		return ErrLockNotHeld
	}

	err := h.store.release(h.key, h.token)
	if err == nil {
		h.released = true
	}
	return err
}

// Extend extends the lock's TTL.
func (h *inMemoryLockHandle) Extend(ctx context.Context, ttl time.Duration) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.released {
		return ErrLockNotHeld
	}

	newExpiry, err := h.store.extend(h.key, h.token, ttl)
	if err != nil {
		return err
	}

	h.expiresAt = newExpiry
	return nil
}

// Key returns the lock key.
func (h *inMemoryLockHandle) Key() string {
	return h.key
}

// Token returns the unique token for this lock holder.
func (h *inMemoryLockHandle) Token() string {
	return h.token
}

// ExpiresAt returns the expiration time of the lock.
func (h *inMemoryLockHandle) ExpiresAt() time.Time {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.expiresAt
}

// generateToken generates a random token for lock ownership.
func generateToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
