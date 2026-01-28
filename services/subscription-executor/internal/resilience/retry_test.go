package resilience

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWithRetrySuccess(t *testing.T) {
	cfg := RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 10 * time.Millisecond,
		MaxBackoff:     100 * time.Millisecond,
	}

	result, err := WithRetry(context.Background(), cfg, func() (string, error) {
		return "ok", nil
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if result != "ok" {
		t.Errorf("expected 'ok', got: %s", result)
	}
}

func TestWithRetryEventualSuccess(t *testing.T) {
	cfg := RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 10 * time.Millisecond,
		MaxBackoff:     50 * time.Millisecond,
	}

	attempt := 0
	result, err := WithRetry(context.Background(), cfg, func() (string, error) {
		attempt++
		if attempt < 3 {
			return "", errors.New("temporary error")
		}
		return "ok", nil
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if result != "ok" {
		t.Errorf("expected 'ok', got: %s", result)
	}
	if attempt != 3 {
		t.Errorf("expected 3 attempts, got: %d", attempt)
	}
}

func TestWithRetryAllFail(t *testing.T) {
	cfg := RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 10 * time.Millisecond,
		MaxBackoff:     50 * time.Millisecond,
	}

	attempt := 0
	_, err := WithRetry(context.Background(), cfg, func() (string, error) {
		attempt++
		return "", errors.New("persistent error")
	})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if attempt != 3 {
		t.Errorf("expected 3 attempts, got: %d", attempt)
	}
}

func TestWithRetryNonRetryable(t *testing.T) {
	cfg := RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 10 * time.Millisecond,
		MaxBackoff:     50 * time.Millisecond,
		IsRetryable: func(err error) bool {
			return false
		},
	}

	attempt := 0
	_, err := WithRetry(context.Background(), cfg, func() (string, error) {
		attempt++
		return "", errors.New("non-retryable")
	})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if attempt != 1 {
		t.Errorf("expected 1 attempt for non-retryable, got: %d", attempt)
	}
}

func TestWithRetryContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	cfg := RetryConfig{
		MaxRetries:     10,
		InitialBackoff: 5 * time.Second,
		MaxBackoff:     10 * time.Second,
	}

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	_, err := WithRetry(ctx, cfg, func() (string, error) {
		return "", errors.New("error")
	})

	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}

func TestWithRetryVoid(t *testing.T) {
	cfg := DefaultRetryConfig()
	cfg.InitialBackoff = 10 * time.Millisecond

	called := false
	err := WithRetryVoid(context.Background(), cfg, func() error {
		called = true
		return nil
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !called {
		t.Error("operation was not called")
	}
}
