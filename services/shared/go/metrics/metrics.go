// Package metrics provides Prometheus metrics for Go services.
package metrics

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Counter represents a monotonically increasing counter.
type Counter struct {
	value  uint64
	labels map[string]string
	mu     sync.RWMutex
}

// Gauge represents a value that can go up and down.
type Gauge struct {
	value  float64
	labels map[string]string
	mu     sync.RWMutex
}

// Histogram represents a distribution of values.
type Histogram struct {
	buckets []float64
	counts  []uint64
	sum     float64
	count   uint64
	labels  map[string]string
	mu      sync.RWMutex
}

// DefaultHistogramBuckets provides standard latency buckets in seconds.
var DefaultHistogramBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0}

// Collector manages metrics for a service.
type Collector struct {
	service   string
	counters  map[string]*Counter
	gauges    map[string]*Gauge
	histograms map[string]*Histogram
	mu        sync.RWMutex
}

// NewCollector creates a new metrics collector.
func NewCollector(service string) *Collector {
	c := &Collector{
		service:    service,
		counters:   make(map[string]*Counter),
		gauges:     make(map[string]*Gauge),
		histograms: make(map[string]*Histogram),
	}

	// Register default metrics
	c.RegisterCounter("http_requests_total", nil)
	c.RegisterCounter("http_errors_total", nil)
	c.RegisterHistogram("http_request_duration_seconds", nil, DefaultHistogramBuckets)
	c.RegisterGauge("http_requests_in_flight", nil)

	return c
}

// RegisterCounter registers a new counter metric.
func (c *Collector) RegisterCounter(name string, labels map[string]string) *Counter {
	c.mu.Lock()
	defer c.mu.Unlock()

	counter := &Counter{labels: labels}
	c.counters[name] = counter
	return counter
}

// RegisterGauge registers a new gauge metric.
func (c *Collector) RegisterGauge(name string, labels map[string]string) *Gauge {
	c.mu.Lock()
	defer c.mu.Unlock()

	gauge := &Gauge{labels: labels}
	c.gauges[name] = gauge
	return gauge
}

// RegisterHistogram registers a new histogram metric.
func (c *Collector) RegisterHistogram(name string, labels map[string]string, buckets []float64) *Histogram {
	c.mu.Lock()
	defer c.mu.Unlock()

	histogram := &Histogram{
		buckets: buckets,
		counts:  make([]uint64, len(buckets)),
		labels:  labels,
	}
	c.histograms[name] = histogram
	return histogram
}

// Inc increments a counter by 1.
func (c *Counter) Inc() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value++
}

// Add adds a value to a counter.
func (c *Counter) Add(delta uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value += delta
}

// Value returns the current counter value.
func (c *Counter) Value() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.value
}

// Set sets a gauge value.
func (g *Gauge) Set(value float64) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.value = value
}

// Inc increments a gauge by 1.
func (g *Gauge) Inc() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.value++
}

// Dec decrements a gauge by 1.
func (g *Gauge) Dec() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.value--
}

// Value returns the current gauge value.
func (g *Gauge) Value() float64 {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.value
}

// Observe records a value in the histogram.
func (h *Histogram) Observe(value float64) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.sum += value
	h.count++

	for i, bucket := range h.buckets {
		if value <= bucket {
			h.counts[i]++
		}
	}
}

// GetCounter returns a counter by name.
func (c *Collector) GetCounter(name string) *Counter {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.counters[name]
}

// GetGauge returns a gauge by name.
func (c *Collector) GetGauge(name string) *Gauge {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.gauges[name]
}

// GetHistogram returns a histogram by name.
func (c *Collector) GetHistogram(name string) *Histogram {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.histograms[name]
}

// formatLabels formats labels for Prometheus output.
func formatLabels(labels map[string]string, extra ...string) string {
	if len(labels) == 0 && len(extra) == 0 {
		return ""
	}

	result := "{"
	first := true
	for k, v := range labels {
		if !first {
			result += ","
		}
		result += fmt.Sprintf(`%s="%s"`, k, v)
		first = false
	}
	for i := 0; i < len(extra); i += 2 {
		if !first {
			result += ","
		}
		result += fmt.Sprintf(`%s="%s"`, extra[i], extra[i+1])
		first = false
	}
	result += "}"
	return result
}

// ToPrometheus returns metrics in Prometheus text format.
func (c *Collector) ToPrometheus() string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var output string

	// Counters
	for name, counter := range c.counters {
		counter.mu.RLock()
		labels := formatLabels(counter.labels, "service", c.service)
		output += fmt.Sprintf("# TYPE %s counter\n", name)
		output += fmt.Sprintf("%s%s %d\n", name, labels, counter.value)
		counter.mu.RUnlock()
	}

	// Gauges
	for name, gauge := range c.gauges {
		gauge.mu.RLock()
		labels := formatLabels(gauge.labels, "service", c.service)
		output += fmt.Sprintf("# TYPE %s gauge\n", name)
		output += fmt.Sprintf("%s%s %f\n", name, labels, gauge.value)
		gauge.mu.RUnlock()
	}

	// Histograms
	for name, hist := range c.histograms {
		hist.mu.RLock()
		baseLabels := formatLabels(hist.labels, "service", c.service)
		output += fmt.Sprintf("# TYPE %s histogram\n", name)

		cumCount := uint64(0)
		for i, bucket := range hist.buckets {
			cumCount += hist.counts[i]
			bucketLabels := formatLabels(hist.labels, "service", c.service, "le", fmt.Sprintf("%g", bucket))
			output += fmt.Sprintf("%s_bucket%s %d\n", name, bucketLabels, cumCount)
		}
		infLabels := formatLabels(hist.labels, "service", c.service, "le", "+Inf")
		output += fmt.Sprintf("%s_bucket%s %d\n", name, infLabels, hist.count)
		output += fmt.Sprintf("%s_sum%s %f\n", name, baseLabels, hist.sum)
		output += fmt.Sprintf("%s_count%s %d\n", name, baseLabels, hist.count)
		hist.mu.RUnlock()
	}

	return output
}

// MetricsHandler returns the Prometheus metrics endpoint handler.
func (c *Collector) MetricsHandler() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Header("Content-Type", "text/plain; charset=utf-8")
		ctx.String(http.StatusOK, c.ToPrometheus())
	}
}

// HTTPMiddleware returns middleware that records HTTP metrics.
func (c *Collector) HTTPMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		start := time.Now()

		// Increment in-flight requests
		if g := c.GetGauge("http_requests_in_flight"); g != nil {
			g.Inc()
		}

		// Process request
		ctx.Next()

		// Decrement in-flight requests
		if g := c.GetGauge("http_requests_in_flight"); g != nil {
			g.Dec()
		}

		// Record metrics
		duration := time.Since(start).Seconds()

		if counter := c.GetCounter("http_requests_total"); counter != nil {
			counter.Inc()
		}

		if ctx.Writer.Status() >= 400 {
			if counter := c.GetCounter("http_errors_total"); counter != nil {
				counter.Inc()
			}
		}

		if hist := c.GetHistogram("http_request_duration_seconds"); hist != nil {
			hist.Observe(duration)
		}
	}
}

// RegisterRoutes registers the metrics endpoint.
func (c *Collector) RegisterRoutes(r *gin.Engine) {
	r.GET("/metrics", c.MetricsHandler())
}
