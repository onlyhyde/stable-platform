// Package health provides standardized health check endpoints for Go services.
package health

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Status represents the health status of a service or component.
type Status string

const (
	StatusOK       Status = "ok"
	StatusDegraded Status = "degraded"
	StatusDown     Status = "down"
)

// CheckResult represents the result of a health check.
type CheckResult struct {
	Status  Status `json:"status"`
	Message string `json:"message,omitempty"`
	Latency string `json:"latency,omitempty"`
}

// HealthResponse is the standardized health check response.
type HealthResponse struct {
	Status    Status                 `json:"status"`
	Service   string                 `json:"service"`
	Version   string                 `json:"version"`
	Timestamp string                 `json:"timestamp"`
	Uptime    string                 `json:"uptime"`
	Checks    map[string]CheckResult `json:"checks,omitempty"`
}

// ReadyResponse is the readiness probe response.
type ReadyResponse struct {
	Ready   bool   `json:"ready"`
	Service string `json:"service"`
}

// LiveResponse is the liveness probe response.
type LiveResponse struct {
	Alive   bool   `json:"alive"`
	Service string `json:"service"`
}

// CheckFunc is a function that performs a health check.
type CheckFunc func() CheckResult

// Checker manages health checks for a service.
type Checker struct {
	service   string
	version   string
	startTime time.Time
	checks    map[string]CheckFunc
	mu        sync.RWMutex
	ready     bool
}

// NewChecker creates a new health checker.
func NewChecker(service, version string) *Checker {
	return &Checker{
		service:   service,
		version:   version,
		startTime: time.Now(),
		checks:    make(map[string]CheckFunc),
		ready:     true,
	}
}

// AddCheck registers a health check.
func (c *Checker) AddCheck(name string, check CheckFunc) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.checks[name] = check
}

// SetReady sets the readiness status.
func (c *Checker) SetReady(ready bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.ready = ready
}

// IsReady returns the current readiness status.
func (c *Checker) IsReady() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.ready
}

// runChecks executes all registered health checks.
func (c *Checker) runChecks() (Status, map[string]CheckResult) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	results := make(map[string]CheckResult)
	overallStatus := StatusOK

	for name, check := range c.checks {
		start := time.Now()
		result := check()
		result.Latency = time.Since(start).String()
		results[name] = result

		if result.Status == StatusDown {
			overallStatus = StatusDown
		} else if result.Status == StatusDegraded && overallStatus != StatusDown {
			overallStatus = StatusDegraded
		}
	}

	return overallStatus, results
}

// Health returns the health check handler.
func (c *Checker) Health() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		status, checks := c.runChecks()

		response := HealthResponse{
			Status:    status,
			Service:   c.service,
			Version:   c.version,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Uptime:    time.Since(c.startTime).String(),
			Checks:    checks,
		}

		statusCode := http.StatusOK
		if status == StatusDown {
			statusCode = http.StatusServiceUnavailable
		}

		ctx.JSON(statusCode, response)
	}
}

// Ready returns the readiness probe handler.
func (c *Checker) Ready() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ready := c.IsReady()
		status, _ := c.runChecks()

		// Not ready if any check is down
		if status == StatusDown {
			ready = false
		}

		response := ReadyResponse{
			Ready:   ready,
			Service: c.service,
		}

		statusCode := http.StatusOK
		if !ready {
			statusCode = http.StatusServiceUnavailable
		}

		ctx.JSON(statusCode, response)
	}
}

// Live returns the liveness probe handler.
func (c *Checker) Live() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// Liveness is always true if the service can respond
		response := LiveResponse{
			Alive:   true,
			Service: c.service,
		}
		ctx.JSON(http.StatusOK, response)
	}
}

// RegisterRoutes registers health check routes on a Gin engine.
func (c *Checker) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", c.Health())
	r.GET("/ready", c.Ready())
	r.GET("/live", c.Live())
}

// DatabaseCheck creates a database health check function.
func DatabaseCheck(pingFunc func() error) CheckFunc {
	return func() CheckResult {
		if err := pingFunc(); err != nil {
			return CheckResult{
				Status:  StatusDown,
				Message: "database connection failed: " + err.Error(),
			}
		}
		return CheckResult{
			Status:  StatusOK,
			Message: "database connected",
		}
	}
}

// HTTPCheck creates an HTTP endpoint health check function.
func HTTPCheck(url string, timeout time.Duration) CheckFunc {
	client := &http.Client{Timeout: timeout}
	return func() CheckResult {
		resp, err := client.Get(url)
		if err != nil {
			return CheckResult{
				Status:  StatusDown,
				Message: "http check failed: " + err.Error(),
			}
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return CheckResult{
				Status:  StatusOK,
				Message: "endpoint healthy",
			}
		}
		return CheckResult{
			Status:  StatusDegraded,
			Message: "endpoint returned status " + resp.Status,
		}
	}
}
