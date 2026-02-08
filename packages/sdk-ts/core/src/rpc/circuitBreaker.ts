/**
 * Circuit Breaker
 *
 * Prevents cascading failures by stopping requests to unhealthy RPC endpoints.
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery).
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /** Number of consecutive failures to trip the circuit (default: 5) */
  failureThreshold?: number
  /** Time in ms to wait before testing recovery (default: 30000) */
  resetTimeout?: number
  /** Number of successes needed to close from HALF_OPEN (default: 2) */
  halfOpenSuccessThreshold?: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0

  private readonly failureThreshold: number
  private readonly resetTimeout: number
  private readonly halfOpenSuccessThreshold: number

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5
    this.resetTimeout = config.resetTimeout ?? 30_000
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold ?? 2
  }

  /**
   * Check if the circuit allows requests.
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true

      case 'OPEN': {
        // Check if reset timeout has passed
        if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
          this.state = 'HALF_OPEN'
          this.successCount = 0
          return true
        }
        return false
      }

      case 'HALF_OPEN':
        return true
    }
  }

  /**
   * Record a successful request.
   */
  onSuccess(): void {
    switch (this.state) {
      case 'CLOSED':
        this.failureCount = 0
        break

      case 'HALF_OPEN':
        this.successCount++
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.state = 'CLOSED'
          this.failureCount = 0
          this.successCount = 0
        }
        break
    }
  }

  /**
   * Record a failed request.
   */
  onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    switch (this.state) {
      case 'CLOSED':
        if (this.failureCount >= this.failureThreshold) {
          this.state = 'OPEN'
        }
        break

      case 'HALF_OPEN':
        // Any failure in half-open goes back to open
        this.state = 'OPEN'
        this.successCount = 0
        break
    }
  }

  /**
   * Reset the circuit breaker to closed state.
   */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
  }

  /**
   * Current state of the circuit.
   */
  getState(): CircuitState {
    // Check for automatic state transition
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.resetTimeout) {
      return 'HALF_OPEN'
    }
    return this.state
  }
}
