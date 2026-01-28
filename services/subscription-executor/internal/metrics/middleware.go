package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// HTTPMetricsMiddleware returns a Gin middleware that records HTTP metrics
func HTTPMetricsMiddleware(m *Metrics) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Get request size
		reqSize := float64(c.Request.ContentLength)
		if reqSize < 0 {
			reqSize = 0
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()

		// Get response size (approximate)
		respSize := float64(c.Writer.Size())
		if respSize < 0 {
			respSize = 0
		}

		// Get status code
		status := strconv.Itoa(c.Writer.Status())

		// Get path - use route pattern if available, otherwise use path
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		// Skip metrics endpoint to avoid infinite loop
		if path == "/metrics" {
			return
		}

		// Record metrics
		m.HTTPRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		m.HTTPRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
		m.HTTPRequestSize.WithLabelValues(c.Request.Method, path).Observe(reqSize)
		m.HTTPResponseSize.WithLabelValues(c.Request.Method, path).Observe(respSize)
	}
}

// MetricsHandler returns the Prometheus metrics HTTP handler
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// GinMetricsHandler wraps the Prometheus handler for Gin
func GinMetricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
