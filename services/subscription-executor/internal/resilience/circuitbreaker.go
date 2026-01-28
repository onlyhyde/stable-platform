package resilience

import (
	"fmt"
	"sync"
	"time"
)

// State represents the circuit breaker state.
type State int

const (
	StateClosed   State = iota // Normal operation
	StateOpen                  // Rejecting requests
	StateHalfOpen              // Testing if service recovered
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreakerConfig configures the circuit breaker.
type CircuitBreakerConfig struct {
	FailureThreshold int           // Consecutive failures before opening (default: 5)
	ResetTimeout     time.Duration // Time before attempting half-open (default: 30s)
	HalfOpenMaxCalls int           // Max calls in half-open state (default: 1)
}

// DefaultCircuitBreakerConfig returns a config with sensible defaults.
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold: 5,
		ResetTimeout:     30 * time.Second,
		HalfOpenMaxCalls: 1,
	}
}

// CircuitBreaker implements the circuit breaker pattern.
type CircuitBreaker struct {
	mu              sync.Mutex
	name            string
	cfg             CircuitBreakerConfig
	state           State
	failures        int
	lastFailureTime time.Time
	halfOpenCalls   int
}

// NewCircuitBreaker creates a new circuit breaker.
func NewCircuitBreaker(name string, cfg CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		name:  name,
		cfg:   cfg,
		state: StateClosed,
	}
}

// Execute runs the operation through the circuit breaker.
func (cb *CircuitBreaker) Execute(operation func() error) error {
	if err := cb.canExecute(); err != nil {
		return err
	}

	err := operation()
	cb.recordResult(err)
	return err
}

// ExecuteWithResult runs an operation that returns a value through the circuit breaker.
func ExecuteWithResult[T any](cb *CircuitBreaker, operation func() (T, error)) (T, error) {
	var zero T
	if err := cb.canExecute(); err != nil {
		return zero, err
	}

	result, err := operation()
	cb.recordResult(err)
	return result, err
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// Check if open circuit should transition to half-open
	if cb.state == StateOpen && time.Since(cb.lastFailureTime) >= cb.cfg.ResetTimeout {
		return StateHalfOpen
	}
	return cb.state
}

// canExecute checks if the circuit breaker allows execution.
func (cb *CircuitBreaker) canExecute() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return nil

	case StateOpen:
		if time.Since(cb.lastFailureTime) >= cb.cfg.ResetTimeout {
			cb.state = StateHalfOpen
			cb.halfOpenCalls = 0
			return nil
		}
		return fmt.Errorf("circuit breaker '%s' is open", cb.name)

	case StateHalfOpen:
		if cb.halfOpenCalls >= cb.cfg.HalfOpenMaxCalls {
			return fmt.Errorf("circuit breaker '%s' is half-open, max test calls reached", cb.name)
		}
		cb.halfOpenCalls++
		return nil
	}

	return nil
}

// recordResult records the result of an operation.
func (cb *CircuitBreaker) recordResult(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err == nil {
		cb.recordSuccess()
	} else {
		cb.recordFailure()
	}
}

func (cb *CircuitBreaker) recordSuccess() {
	switch cb.state {
	case StateClosed:
		cb.failures = 0

	case StateHalfOpen:
		// Recovery confirmed - close the circuit
		cb.state = StateClosed
		cb.failures = 0
		cb.halfOpenCalls = 0
	}
}

func (cb *CircuitBreaker) recordFailure() {
	cb.lastFailureTime = time.Now()

	switch cb.state {
	case StateClosed:
		cb.failures++
		if cb.failures >= cb.cfg.FailureThreshold {
			cb.state = StateOpen
		}

	case StateHalfOpen:
		// Recovery failed - reopen the circuit
		cb.state = StateOpen
		cb.halfOpenCalls = 0
	}
}

// Reset manually resets the circuit breaker to closed state.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = StateClosed
	cb.failures = 0
	cb.halfOpenCalls = 0
}
