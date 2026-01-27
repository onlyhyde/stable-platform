package middleware

import (
	"bytes"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/repository"
)

const (
	// IdempotencyKeyHeader is the HTTP header for idempotency keys
	IdempotencyKeyHeader = "Idempotency-Key"

	// MaxIdempotencyKeyLength is the maximum allowed length for an idempotency key
	MaxIdempotencyKeyLength = 256

	// DefaultIdempotencyTTL is the default time-to-live for idempotency records
	DefaultIdempotencyTTL = 24 * time.Hour
)

// IdempotencyMiddleware provides request-level idempotency for POST endpoints
type IdempotencyMiddleware struct {
	repo repository.SubscriptionRepository
	ttl  time.Duration
}

// NewIdempotencyMiddleware creates a new idempotency middleware
func NewIdempotencyMiddleware(repo repository.SubscriptionRepository) *IdempotencyMiddleware {
	return &IdempotencyMiddleware{
		repo: repo,
		ttl:  DefaultIdempotencyTTL,
	}
}

// Middleware returns a Gin middleware handler
func (m *IdempotencyMiddleware) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only apply to POST requests
		if c.Request.Method != http.MethodPost {
			c.Next()
			return
		}

		key := c.GetHeader(IdempotencyKeyHeader)
		// No header = pass through (backward compatible)
		if key == "" {
			c.Next()
			return
		}

		// Validate key length
		if len(key) > MaxIdempotencyKeyLength {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":   "invalid idempotency key",
				"message": "Idempotency-Key header must be at most 256 characters",
			})
			return
		}

		method := c.Request.Method
		path := c.Request.URL.Path

		// Check for existing cached response
		record, err := m.repo.GetIdempotencyRecord(c.Request.Context(), key, method, path)
		if err != nil {
			log.Printf("Failed to get idempotency record: %v", err)
			// Non-fatal: proceed without idempotency on lookup failure
			c.Next()
			return
		}

		if record != nil {
			// Return cached response
			for k, v := range record.ResponseHeaders {
				c.Header(k, v)
			}
			c.Data(record.StatusCode, "application/json", record.ResponseBody)
			c.Abort()
			return
		}

		// Wrap the response writer to capture the response
		rw := &responseWriter{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = rw

		// Proceed with the request
		c.Next()

		// Only cache successful or client-error responses (not 5xx)
		statusCode := rw.Status()
		if statusCode >= 500 {
			return
		}

		// Capture response headers to cache
		headers := make(map[string]string)
		for k, v := range rw.Header() {
			if len(v) > 0 {
				headers[k] = v[0]
			}
		}

		now := time.Now()
		idempRecord := &model.IdempotencyRecord{
			Key:             key,
			Method:          method,
			Path:            path,
			StatusCode:      statusCode,
			ResponseBody:    rw.body.Bytes(),
			ResponseHeaders: headers,
			CreatedAt:       now,
			ExpiresAt:       now.Add(m.ttl),
		}

		if err := m.repo.SaveIdempotencyRecord(c.Request.Context(), idempRecord); err != nil {
			// Non-fatal: log and continue
			log.Printf("Failed to save idempotency record: %v", err)
		}
	}
}

// responseWriter wraps gin.ResponseWriter to capture the response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func (rw *responseWriter) WriteString(s string) (int, error) {
	rw.body.WriteString(s)
	return rw.ResponseWriter.WriteString(s)
}
