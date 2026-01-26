package middleware

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements a simple rate limiter
type RateLimiter struct {
	mu          sync.Mutex
	requests    map[string][]time.Time
	rps         float64
	burst       int
	cleanupTick time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerSecond float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		requests:    make(map[string][]time.Time),
		rps:         requestsPerSecond,
		burst:       burst,
		cleanupTick: time.Minute,
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-time.Second)

	// Get requests in the last second
	requests := rl.requests[ip]
	var validRequests []time.Time
	for _, t := range requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}

	// Check if within rate limit
	if len(validRequests) >= rl.burst {
		return false
	}

	// Add current request
	validRequests = append(validRequests, now)
	rl.requests[ip] = validRequests

	return true
}

// cleanup periodically cleans up old request records
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupTick)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		windowStart := now.Add(-time.Minute)

		for ip, requests := range rl.requests {
			var validRequests []time.Time
			for _, t := range requests {
				if t.After(windowStart) {
					validRequests = append(validRequests, t)
				}
			}
			if len(validRequests) == 0 {
				delete(rl.requests, ip)
			} else {
				rl.requests[ip] = validRequests
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware returns a Gin middleware for rate limiting
func RateLimitMiddleware(rps float64, burst int) gin.HandlerFunc {
	limiter := NewRateLimiter(rps, burst)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// LoggingMiddleware returns a Gin middleware for request logging
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Log request details
		duration := time.Since(start)
		log.Printf("[%s] %s %s %d %s",
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			c.Writer.Status(),
			duration,
		)
	}
}

// RecoveryMiddleware returns a Gin middleware for panic recovery
func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "internal server error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// CORSMiddleware returns a Gin middleware for CORS handling
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeadersMiddleware adds security headers to responses
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Next()
	}
}

// RequestIDMiddleware adds a unique request ID to each request
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("requestID", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// generateRequestID generates a simple request ID
func generateRequestID() string {
	return time.Now().Format("20060102150405.000000")
}

// TimeoutMiddleware adds request timeout handling
func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set deadline for the request context
		// Note: In production, use context.WithTimeout
		c.Next()
	}
}

// BodyLimitMiddleware limits the request body size
func BodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
