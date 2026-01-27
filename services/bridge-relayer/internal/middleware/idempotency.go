package middleware

import (
	"bytes"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// IdempotencyKeyHeader is the HTTP header for idempotency keys
	IdempotencyKeyHeader = "Idempotency-Key"

	// MaxIdempotencyKeyLength is the maximum allowed length for an idempotency key
	MaxIdempotencyKeyLength = 256

	// DefaultIdempotencyTTL is the default time-to-live for idempotency records
	DefaultIdempotencyTTL = 24 * time.Hour

	// CleanupInterval is how often to clean up expired records
	CleanupInterval = 1 * time.Hour
)

// IdempotencyRecord stores a cached API response
type IdempotencyRecord struct {
	StatusCode      int
	ResponseBody    []byte
	ResponseHeaders map[string]string
	ExpiresAt       time.Time
}

// IdempotencyStore provides thread-safe in-memory storage for idempotency records
type IdempotencyStore struct {
	mu      sync.RWMutex
	records map[string]*IdempotencyRecord // key: "idempotencyKey|method|path"
	ttl     time.Duration
}

// NewIdempotencyStore creates a new in-memory idempotency store
func NewIdempotencyStore(ttl time.Duration) *IdempotencyStore {
	store := &IdempotencyStore{
		records: make(map[string]*IdempotencyRecord),
		ttl:     ttl,
	}

	// Start cleanup goroutine
	go store.cleanup()

	return store
}

// Get retrieves a non-expired idempotency record
func (s *IdempotencyStore) Get(key, method, path string) *IdempotencyRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	compositeKey := key + "|" + method + "|" + path
	record, exists := s.records[compositeKey]
	if !exists {
		return nil
	}
	if time.Now().After(record.ExpiresAt) {
		return nil
	}
	return record
}

// Set stores an idempotency record (first-writer-wins)
func (s *IdempotencyStore) Set(key, method, path string, record *IdempotencyRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()

	compositeKey := key + "|" + method + "|" + path
	// First-writer-wins: do not overwrite existing record
	if _, exists := s.records[compositeKey]; exists {
		return
	}
	record.ExpiresAt = time.Now().Add(s.ttl)
	s.records[compositeKey] = record
}

// cleanup periodically removes expired records
func (s *IdempotencyStore) cleanup() {
	ticker := time.NewTicker(CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for key, record := range s.records {
			if now.After(record.ExpiresAt) {
				delete(s.records, key)
			}
		}
		s.mu.Unlock()
	}
}

// DeleteExpired removes all expired records and returns count
func (s *IdempotencyStore) DeleteExpired() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	var deleted int64
	now := time.Now()
	for key, record := range s.records {
		if now.After(record.ExpiresAt) {
			delete(s.records, key)
			deleted++
		}
	}
	return deleted
}

// IdempotencyMiddleware returns a Gin middleware for API idempotency
func IdempotencyMiddleware(store *IdempotencyStore) gin.HandlerFunc {
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
		record := store.Get(key, method, path)
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

		idempRecord := &IdempotencyRecord{
			StatusCode:      statusCode,
			ResponseBody:    rw.body.Bytes(),
			ResponseHeaders: headers,
		}

		store.Set(key, method, path, idempRecord)
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

// ProcessedEventTracker tracks processed events to prevent duplicate processing
type ProcessedEventTracker struct {
	mu        sync.RWMutex
	processed map[string]time.Time // key: "requestID|eventType" -> processedAt
	ttl       time.Duration
}

// NewProcessedEventTracker creates a new event tracker
func NewProcessedEventTracker(ttl time.Duration) *ProcessedEventTracker {
	tracker := &ProcessedEventTracker{
		processed: make(map[string]time.Time),
		ttl:       ttl,
	}

	// Start cleanup goroutine
	go tracker.cleanup()

	return tracker
}

// MarkProcessed marks an event as processed, returns false if already processed
func (t *ProcessedEventTracker) MarkProcessed(requestID [32]byte, eventType string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	key := string(requestID[:]) + "|" + eventType
	if processedAt, exists := t.processed[key]; exists {
		// Check if still within TTL
		if time.Since(processedAt) < t.ttl {
			return false // Already processed
		}
	}

	t.processed[key] = time.Now()
	return true
}

// IsProcessed checks if an event was already processed
func (t *ProcessedEventTracker) IsProcessed(requestID [32]byte, eventType string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	key := string(requestID[:]) + "|" + eventType
	processedAt, exists := t.processed[key]
	if !exists {
		return false
	}
	return time.Since(processedAt) < t.ttl
}

// cleanup periodically removes expired entries
func (t *ProcessedEventTracker) cleanup() {
	ticker := time.NewTicker(CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		t.mu.Lock()
		now := time.Now()
		for key, processedAt := range t.processed {
			if now.Sub(processedAt) > t.ttl {
				delete(t.processed, key)
			}
		}
		t.mu.Unlock()
		log.Printf("Cleaned up expired event tracking entries")
	}
}
