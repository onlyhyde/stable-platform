package resilience

import (
	"errors"
	"testing"
	"time"
)

func TestCircuitBreakerInitialState(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultCircuitBreakerConfig())
	if cb.State() != StateClosed {
		t.Errorf("initial state should be closed, got: %s", cb.State())
	}
}

func TestCircuitBreakerOpensAfterThreshold(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 3,
		ResetTimeout:     1 * time.Second,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	for i := 0; i < 3; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	if cb.State() != StateOpen {
		t.Errorf("should be open after %d failures, got: %s", cfg.FailureThreshold, cb.State())
	}
}

func TestCircuitBreakerRejectsWhenOpen(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		ResetTimeout:     1 * time.Hour,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// Open the circuit
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	// Should reject
	err := cb.Execute(func() error {
		return nil
	})

	if err == nil {
		t.Error("expected error when circuit is open")
	}
}

func TestCircuitBreakerTransitionsToHalfOpen(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		ResetTimeout:     50 * time.Millisecond,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// Open the circuit
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	if cb.State() != StateOpen {
		t.Fatalf("should be open, got: %s", cb.State())
	}

	// Wait for reset timeout
	time.Sleep(100 * time.Millisecond)

	if cb.State() != StateHalfOpen {
		t.Errorf("should be half-open after timeout, got: %s", cb.State())
	}
}

func TestCircuitBreakerClosesOnHalfOpenSuccess(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		ResetTimeout:     50 * time.Millisecond,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// Open the circuit
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	time.Sleep(100 * time.Millisecond)

	// Half-open: success should close it
	err := cb.Execute(func() error {
		return nil
	})

	if err != nil {
		t.Fatalf("half-open call should succeed, got: %v", err)
	}

	if cb.State() != StateClosed {
		t.Errorf("should be closed after successful half-open, got: %s", cb.State())
	}
}

func TestCircuitBreakerReopensOnHalfOpenFailure(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		ResetTimeout:     50 * time.Millisecond,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// Open the circuit
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	time.Sleep(100 * time.Millisecond)

	// Half-open: failure should reopen
	_ = cb.Execute(func() error {
		return errors.New("still failing")
	})

	if cb.State() != StateOpen {
		t.Errorf("should be open after half-open failure, got: %s", cb.State())
	}
}

func TestCircuitBreakerSuccessResetsFailures(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 3,
		ResetTimeout:     1 * time.Second,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// 2 failures (below threshold)
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	// Success resets counter
	_ = cb.Execute(func() error {
		return nil
	})

	// 2 more failures - should still be closed since counter was reset
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	if cb.State() != StateClosed {
		t.Errorf("should still be closed, got: %s", cb.State())
	}
}

func TestCircuitBreakerReset(t *testing.T) {
	cfg := CircuitBreakerConfig{
		FailureThreshold: 2,
		ResetTimeout:     1 * time.Hour,
		HalfOpenMaxCalls: 1,
	}
	cb := NewCircuitBreaker("test", cfg)

	// Open it
	for i := 0; i < 2; i++ {
		_ = cb.Execute(func() error {
			return errors.New("fail")
		})
	}

	if cb.State() != StateOpen {
		t.Fatal("should be open")
	}

	cb.Reset()

	if cb.State() != StateClosed {
		t.Errorf("should be closed after reset, got: %s", cb.State())
	}
}

func TestExecuteWithResult(t *testing.T) {
	cb := NewCircuitBreaker("test", DefaultCircuitBreakerConfig())

	result, err := ExecuteWithResult(cb, func() (string, error) {
		return "hello", nil
	})

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if result != "hello" {
		t.Errorf("expected 'hello', got: %s", result)
	}
}
