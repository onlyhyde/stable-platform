package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRouter(store *IdempotencyStore) *gin.Engine {
	r := gin.New()
	r.Use(IdempotencyMiddleware(store))
	r.POST("/api/v1/bridge/initiate", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"requestId": "0x1234", "status": "pending"})
	})
	r.GET("/api/v1/bridge/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	return r
}

func TestNoHeader(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestFirstRequest(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(IdempotencyKeyHeader, "key-001")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "0x1234") {
		t.Errorf("expected body to contain 0x1234, got %s", w.Body.String())
	}
}

func TestDuplicateRequest(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	// First request
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set(IdempotencyKeyHeader, "key-dup")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("first request: expected 201, got %d", w1.Code)
	}

	// Duplicate request with same key
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(IdempotencyKeyHeader, "key-dup")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Errorf("duplicate request: expected 201 (cached), got %d", w2.Code)
	}
	if w1.Body.String() != w2.Body.String() {
		t.Errorf("duplicate request body mismatch:\n  first:  %s\n  second: %s", w1.Body.String(), w2.Body.String())
	}
}

func TestDifferentKeys(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	// First key
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set(IdempotencyKeyHeader, "key-a")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	// Different key
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(IdempotencyKeyHeader, "key-b")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	// Both should succeed (not cached)
	if w1.Code != http.StatusCreated || w2.Code != http.StatusCreated {
		t.Errorf("expected both 201, got %d and %d", w1.Code, w2.Code)
	}
}

func TestSameKeyDifferentPaths(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := gin.New()
	r.Use(IdempotencyMiddleware(store))
	r.POST("/api/v1/bridge/initiate", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"endpoint": "initiate"})
	})
	r.POST("/api/v1/bridge/complete", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"endpoint": "complete"})
	})

	// Same key, path 1
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set(IdempotencyKeyHeader, "shared-key")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	// Same key, path 2
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/complete", strings.NewReader(`{}`))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(IdempotencyKeyHeader, "shared-key")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w1.Code != http.StatusCreated {
		t.Errorf("path 1: expected 201, got %d", w1.Code)
	}
	if w2.Code != http.StatusOK {
		t.Errorf("path 2: expected 200, got %d", w2.Code)
	}
	if strings.Contains(w2.Body.String(), "initiate") {
		t.Error("path 2 should not return path 1's cached response")
	}
}

func TestKeyTooLong(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	longKey := strings.Repeat("x", MaxIdempotencyKeyLength+1)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/bridge/initiate", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(IdempotencyKeyHeader, longKey)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for too-long key, got %d", w.Code)
	}
}

func TestGetRequestIgnored(t *testing.T) {
	store := NewIdempotencyStore(DefaultIdempotencyTTL)
	r := setupRouter(store)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bridge/status", nil)
	req.Header.Set(IdempotencyKeyHeader, "key-get")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET request should not be affected by idempotency, got %d", w.Code)
	}
}

func TestProcessedEventTracker(t *testing.T) {
	tracker := NewProcessedEventTracker(DefaultIdempotencyTTL)

	var requestID [32]byte
	copy(requestID[:], []byte("test-request-id-1234567890123456"))

	// First mark should succeed
	if !tracker.MarkProcessed(requestID, "BridgeInitiated") {
		t.Error("first MarkProcessed should return true")
	}

	// Check if processed
	if !tracker.IsProcessed(requestID, "BridgeInitiated") {
		t.Error("IsProcessed should return true after marking")
	}

	// Duplicate mark should fail
	if tracker.MarkProcessed(requestID, "BridgeInitiated") {
		t.Error("duplicate MarkProcessed should return false")
	}

	// Different event type should succeed
	if !tracker.MarkProcessed(requestID, "RequestApproved") {
		t.Error("different event type should succeed")
	}

	// Different request ID should succeed
	var requestID2 [32]byte
	copy(requestID2[:], []byte("test-request-id-9876543210123456"))
	if !tracker.MarkProcessed(requestID2, "BridgeInitiated") {
		t.Error("different request ID should succeed")
	}
}

func TestProcessedEventTrackerExpiry(t *testing.T) {
	// Use a very short TTL for testing
	tracker := NewProcessedEventTracker(50 * time.Millisecond)

	var requestID [32]byte
	copy(requestID[:], []byte("test-expiry-id-12345678901234567"))

	// Mark as processed
	if !tracker.MarkProcessed(requestID, "BridgeInitiated") {
		t.Error("first MarkProcessed should return true")
	}

	// Should be processed immediately
	if !tracker.IsProcessed(requestID, "BridgeInitiated") {
		t.Error("should be processed right after marking")
	}

	// Wait for expiry
	time.Sleep(100 * time.Millisecond)

	// Should no longer be processed
	if tracker.IsProcessed(requestID, "BridgeInitiated") {
		t.Error("should not be processed after TTL expiry")
	}

	// Should be able to mark again after expiry
	if !tracker.MarkProcessed(requestID, "BridgeInitiated") {
		t.Error("should be able to mark again after TTL expiry")
	}
}
