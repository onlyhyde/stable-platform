package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	once     sync.Once
	registry *prometheus.Registry
	metrics  *Metrics
)

// Metrics holds all Prometheus metrics for the subscription executor service
type Metrics struct {
	// Subscription execution metrics
	ExecutionsTotal   *prometheus.CounterVec
	ExecutionDuration *prometheus.HistogramVec
	ExecutionErrors   *prometheus.CounterVec

	// Subscription state metrics
	PendingSubscriptions   prometheus.Gauge
	ActiveSubscriptions    prometheus.Gauge
	CancelledSubscriptions prometheus.Gauge
	ExpiredSubscriptions   prometheus.Gauge

	// Payment metrics
	PaymentsProcessed *prometheus.CounterVec
	PaymentAmount     *prometheus.HistogramVec
	PaymentErrors     *prometheus.CounterVec

	// Permission metrics
	PermissionChecks *prometheus.CounterVec
	PermissionErrors *prometheus.CounterVec

	// External service metrics
	BundlerRequests  *prometheus.CounterVec
	BundlerLatency   *prometheus.HistogramVec
	PaymasterRequests *prometheus.CounterVec
	PaymasterLatency  *prometheus.HistogramVec
	RPCRequests       *prometheus.CounterVec
	RPCLatency        *prometheus.HistogramVec

	// Circuit breaker metrics
	CircuitBreakerState  *prometheus.GaugeVec
	CircuitBreakerTrips  *prometheus.CounterVec

	// HTTP metrics
	HTTPRequestsTotal   *prometheus.CounterVec
	HTTPRequestDuration *prometheus.HistogramVec
	HTTPRequestSize     *prometheus.HistogramVec
	HTTPResponseSize    *prometheus.HistogramVec

	// System metrics
	ServiceUp    prometheus.Gauge
	ServiceInfo  *prometheus.GaugeVec
	GoroutineNum prometheus.Gauge
}

// NewMetrics creates and registers all Prometheus metrics
func NewMetrics() *Metrics {
	once.Do(func() {
		registry = prometheus.NewRegistry()
		metrics = createMetrics()
	})
	return metrics
}

// GetRegistry returns the Prometheus registry
func GetRegistry() *prometheus.Registry {
	return registry
}

// DefaultMetrics returns the default metrics instance
func DefaultMetrics() *Metrics {
	return NewMetrics()
}

func createMetrics() *Metrics {
	m := &Metrics{
		// Subscription execution metrics
		ExecutionsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "executions_total",
				Help:      "Total number of subscription executions",
			},
			[]string{"status"}, // success, failed, skipped, permission_revoked
		),

		ExecutionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "execution_duration_seconds",
				Help:      "Duration of subscription execution in seconds",
				Buckets:   []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
			},
			[]string{"status"},
		),

		ExecutionErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "execution_errors_total",
				Help:      "Total number of subscription execution errors",
			},
			[]string{"error_type"}, // permission_check, userOp_build, bundler_submit, etc.
		),

		// Subscription state metrics
		PendingSubscriptions: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "pending_subscriptions",
				Help:      "Number of pending subscriptions",
			},
		),

		ActiveSubscriptions: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "active_subscriptions",
				Help:      "Number of active subscriptions",
			},
		),

		CancelledSubscriptions: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "cancelled_subscriptions",
				Help:      "Number of cancelled subscriptions",
			},
		),

		ExpiredSubscriptions: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "expired_subscriptions",
				Help:      "Number of expired subscriptions",
			},
		),

		// Payment metrics
		PaymentsProcessed: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "payments_processed_total",
				Help:      "Total number of payments processed",
			},
			[]string{"token", "status"}, // token: ETH/USDC/etc, status: success/failed
		),

		PaymentAmount: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "payment_amount",
				Help:      "Payment amounts processed (in token units)",
				Buckets:   []float64{1, 10, 100, 1000, 10000, 100000},
			},
			[]string{"token"},
		),

		PaymentErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "payment_errors_total",
				Help:      "Total number of payment errors",
			},
			[]string{"error_type"},
		),

		// Permission metrics
		PermissionChecks: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "permission_checks_total",
				Help:      "Total number of permission validation checks",
			},
			[]string{"result"}, // valid, invalid, expired, revoked
		),

		PermissionErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "permission_errors_total",
				Help:      "Total number of permission check errors",
			},
			[]string{"error_type"},
		),

		// External service metrics
		BundlerRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "bundler_requests_total",
				Help:      "Total number of bundler requests",
			},
			[]string{"method", "status"}, // status: success, error, timeout
		),

		BundlerLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "bundler_latency_seconds",
				Help:      "Bundler request latency in seconds",
				Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"method"},
		),

		PaymasterRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "paymaster_requests_total",
				Help:      "Total number of paymaster requests",
			},
			[]string{"method", "status"},
		),

		PaymasterLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "paymaster_latency_seconds",
				Help:      "Paymaster request latency in seconds",
				Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"method"},
		),

		RPCRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "rpc_requests_total",
				Help:      "Total number of RPC requests",
			},
			[]string{"method", "status"},
		),

		RPCLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "rpc_latency_seconds",
				Help:      "RPC request latency in seconds",
				Buckets:   []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5},
			},
			[]string{"method"},
		),

		// Circuit breaker metrics
		CircuitBreakerState: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "circuit_breaker_state",
				Help:      "Circuit breaker state (0=closed, 1=half-open, 2=open)",
			},
			[]string{"name"},
		),

		CircuitBreakerTrips: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "circuit_breaker_trips_total",
				Help:      "Total number of circuit breaker trips",
			},
			[]string{"name"},
		),

		// HTTP metrics
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "subscription_executor",
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "path", "status"},
		),

		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "path"},
		),

		HTTPRequestSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "http_request_size_bytes",
				Help:      "HTTP request size in bytes",
				Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "path"},
		),

		HTTPResponseSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "subscription_executor",
				Name:      "http_response_size_bytes",
				Help:      "HTTP response size in bytes",
				Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "path"},
		),

		// System metrics
		ServiceUp: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "up",
				Help:      "Service up status (1=up, 0=down)",
			},
		),

		ServiceInfo: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "info",
				Help:      "Service information",
			},
			[]string{"version", "go_version"},
		),

		GoroutineNum: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: "subscription_executor",
				Name:      "goroutines",
				Help:      "Number of goroutines",
			},
		),
	}

	// Set service as up
	m.ServiceUp.Set(1)

	return m
}

// RecordExecution records a subscription execution
func (m *Metrics) RecordExecution(status string, duration float64) {
	m.ExecutionsTotal.WithLabelValues(status).Inc()
	m.ExecutionDuration.WithLabelValues(status).Observe(duration)
}

// RecordExecutionError records a subscription execution error
func (m *Metrics) RecordExecutionError(errorType string) {
	m.ExecutionErrors.WithLabelValues(errorType).Inc()
}

// RecordPayment records a payment
func (m *Metrics) RecordPayment(token, status string, amount float64) {
	m.PaymentsProcessed.WithLabelValues(token, status).Inc()
	if amount > 0 {
		m.PaymentAmount.WithLabelValues(token).Observe(amount)
	}
}

// RecordPermissionCheck records a permission check result
func (m *Metrics) RecordPermissionCheck(result string) {
	m.PermissionChecks.WithLabelValues(result).Inc()
}

// RecordBundlerRequest records a bundler request
func (m *Metrics) RecordBundlerRequest(method, status string, latency float64) {
	m.BundlerRequests.WithLabelValues(method, status).Inc()
	m.BundlerLatency.WithLabelValues(method).Observe(latency)
}

// RecordPaymasterRequest records a paymaster request
func (m *Metrics) RecordPaymasterRequest(method, status string, latency float64) {
	m.PaymasterRequests.WithLabelValues(method, status).Inc()
	m.PaymasterLatency.WithLabelValues(method).Observe(latency)
}

// RecordRPCRequest records an RPC request
func (m *Metrics) RecordRPCRequest(method, status string, latency float64) {
	m.RPCRequests.WithLabelValues(method, status).Inc()
	m.RPCLatency.WithLabelValues(method).Observe(latency)
}

// SetCircuitBreakerState sets the circuit breaker state
func (m *Metrics) SetCircuitBreakerState(name string, state int) {
	m.CircuitBreakerState.WithLabelValues(name).Set(float64(state))
}

// RecordCircuitBreakerTrip records a circuit breaker trip
func (m *Metrics) RecordCircuitBreakerTrip(name string) {
	m.CircuitBreakerTrips.WithLabelValues(name).Inc()
}

// UpdateSubscriptionCounts updates subscription state gauges
func (m *Metrics) UpdateSubscriptionCounts(pending, active, cancelled, expired int) {
	m.PendingSubscriptions.Set(float64(pending))
	m.ActiveSubscriptions.Set(float64(active))
	m.CancelledSubscriptions.Set(float64(cancelled))
	m.ExpiredSubscriptions.Set(float64(expired))
}

// SetGoroutineNum sets the current number of goroutines
func (m *Metrics) SetGoroutineNum(num int) {
	m.GoroutineNum.Set(float64(num))
}
