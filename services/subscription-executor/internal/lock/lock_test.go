package lock

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestInMemoryLock_TryAcquire(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	// Acquire lock
	lock, err := store.TryAcquire(ctx, "test-key", time.Minute)
	if err != nil {
		t.Fatalf("TryAcquire() error = %v", err)
	}
	if lock == nil {
		t.Fatal("TryAcquire() returned nil lock")
	}

	// Verify lock properties
	if lock.Key() != "test-key" {
		t.Errorf("Key() = %v, want test-key", lock.Key())
	}
	if lock.Token() == "" {
		t.Error("Token() is empty")
	}
	if lock.ExpiresAt().Before(time.Now()) {
		t.Error("ExpiresAt() is in the past")
	}

	// Try to acquire same lock again (should fail)
	_, err = store.TryAcquire(ctx, "test-key", time.Minute)
	if err != ErrLockNotAcquired {
		t.Errorf("TryAcquire() error = %v, want ErrLockNotAcquired", err)
	}

	// Release lock
	if err := lock.Release(ctx); err != nil {
		t.Errorf("Release() error = %v", err)
	}

	// Now should be able to acquire again
	lock2, err := store.TryAcquire(ctx, "test-key", time.Minute)
	if err != nil {
		t.Fatalf("TryAcquire() after release error = %v", err)
	}
	lock2.Release(ctx)
}

func TestInMemoryLock_Acquire_Blocking(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	// Acquire lock
	lock1, err := store.TryAcquire(ctx, "blocking-key", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("TryAcquire() error = %v", err)
	}

	// Start goroutine to acquire same lock (will block)
	done := make(chan struct{})
	var lock2 Lock
	go func() {
		var err error
		lock2, err = store.Acquire(ctx, "blocking-key", time.Minute)
		if err != nil {
			t.Errorf("Acquire() error = %v", err)
		}
		close(done)
	}()

	// Wait a bit, then release first lock
	time.Sleep(50 * time.Millisecond)
	lock1.Release(ctx)

	// Second acquire should complete
	select {
	case <-done:
		if lock2 == nil {
			t.Error("Acquire() returned nil lock")
		} else {
			lock2.Release(ctx)
		}
	case <-time.After(time.Second):
		t.Error("Acquire() did not complete after lock release")
	}
}

func TestInMemoryLock_AcquireWithRetry(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	// Acquire lock
	lock1, _ := store.TryAcquire(ctx, "retry-key", time.Minute)

	// Try to acquire with limited retries (should fail)
	opts := RetryOptions{
		MaxRetries: 3,
		RetryDelay: 10 * time.Millisecond,
	}

	_, err := store.AcquireWithRetry(ctx, "retry-key", time.Minute, opts)
	if err != ErrLockNotAcquired {
		t.Errorf("AcquireWithRetry() error = %v, want ErrLockNotAcquired", err)
	}

	lock1.Release(ctx)
}

func TestInMemoryLock_Extend(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	lock, _ := store.TryAcquire(ctx, "extend-key", 100*time.Millisecond)
	originalExpiry := lock.ExpiresAt()

	time.Sleep(50 * time.Millisecond)

	// Extend lock
	if err := lock.Extend(ctx, time.Minute); err != nil {
		t.Errorf("Extend() error = %v", err)
	}

	newExpiry := lock.ExpiresAt()
	if !newExpiry.After(originalExpiry) {
		t.Error("Extend() did not extend expiry time")
	}

	lock.Release(ctx)
}

func TestInMemoryLock_Release_NotHeld(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	lock, _ := store.TryAcquire(ctx, "release-key", time.Minute)

	// Release once
	if err := lock.Release(ctx); err != nil {
		t.Errorf("Release() error = %v", err)
	}

	// Release again (should fail)
	if err := lock.Release(ctx); err != ErrLockNotHeld {
		t.Errorf("Release() error = %v, want ErrLockNotHeld", err)
	}
}

func TestInMemoryLock_Expiration(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	// Acquire lock with short TTL
	_, err := store.TryAcquire(ctx, "expire-key", 50*time.Millisecond)
	if err != nil {
		t.Fatalf("TryAcquire() error = %v", err)
	}

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Should be able to acquire again
	lock2, err := store.TryAcquire(ctx, "expire-key", time.Minute)
	if err != nil {
		t.Errorf("TryAcquire() after expiration error = %v", err)
	}
	if lock2 != nil {
		lock2.Release(ctx)
	}
}

func TestInMemoryLock_ContextCancellation(t *testing.T) {
	store := NewInMemoryLock()
	ctx, cancel := context.WithCancel(context.Background())

	// Hold a lock
	lock1, _ := store.TryAcquire(ctx, "cancel-key", time.Minute)

	// Start goroutine trying to acquire
	done := make(chan error)
	go func() {
		_, err := store.Acquire(ctx, "cancel-key", time.Minute)
		done <- err
	}()

	// Cancel context
	time.Sleep(50 * time.Millisecond)
	cancel()

	// Should receive context error
	select {
	case err := <-done:
		if err != context.Canceled {
			t.Errorf("Acquire() error = %v, want context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Error("Acquire() did not respect context cancellation")
	}

	lock1.Release(context.Background())
}

func TestInMemoryLock_Concurrent(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	const numGoroutines = 10
	const numIterations = 100

	var counter int64
	var wg sync.WaitGroup

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < numIterations; j++ {
				lock, err := store.Acquire(ctx, "concurrent-key", time.Second)
				if err != nil {
					t.Errorf("Acquire() error = %v", err)
					return
				}

				// Critical section - increment counter
				current := atomic.LoadInt64(&counter)
				time.Sleep(time.Microsecond) // Simulate work
				atomic.StoreInt64(&counter, current+1)

				lock.Release(ctx)
			}
		}()
	}

	wg.Wait()

	expected := int64(numGoroutines * numIterations)
	if counter != expected {
		t.Errorf("Counter = %d, want %d (race condition detected)", counter, expected)
	}
}

func TestInMemoryLock_MultipleLocks(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	// Acquire multiple different locks
	lock1, err := store.TryAcquire(ctx, "key1", time.Minute)
	if err != nil {
		t.Fatalf("TryAcquire(key1) error = %v", err)
	}

	lock2, err := store.TryAcquire(ctx, "key2", time.Minute)
	if err != nil {
		t.Fatalf("TryAcquire(key2) error = %v", err)
	}

	lock3, err := store.TryAcquire(ctx, "key3", time.Minute)
	if err != nil {
		t.Fatalf("TryAcquire(key3) error = %v", err)
	}

	// All locks should be independent
	if lock1.Key() == lock2.Key() {
		t.Error("Different locks have same key")
	}

	lock1.Release(ctx)
	lock2.Release(ctx)
	lock3.Release(ctx)
}

func TestDefaultRetryOptions(t *testing.T) {
	opts := DefaultRetryOptions()

	if opts.MaxRetries <= 0 {
		t.Error("MaxRetries should be positive")
	}
	if opts.RetryDelay <= 0 {
		t.Error("RetryDelay should be positive")
	}
	if opts.MaxRetryDelay <= 0 {
		t.Error("MaxRetryDelay should be positive")
	}
	if !opts.UseExponentialBackoff {
		t.Error("UseExponentialBackoff should be true by default")
	}
}

func TestInMemoryLock_ExtendAfterExpiry(t *testing.T) {
	store := NewInMemoryLock()
	ctx := context.Background()

	lock, _ := store.TryAcquire(ctx, "extend-expire-key", 50*time.Millisecond)

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Extend should fail
	err := lock.Extend(ctx, time.Minute)
	if err != ErrLockExpired {
		t.Errorf("Extend() error = %v, want ErrLockExpired", err)
	}
}
