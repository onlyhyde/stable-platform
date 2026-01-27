package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func newTestLimiter(rate int, interval time.Duration) *RateLimiter {
	// Create limiter without starting cleanup goroutine
	return &RateLimiter{
		clients:  make(map[string]*clientLimiter),
		rate:     rate,
		interval: interval,
	}
}

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(50, 30*time.Second)
	if rl == nil {
		t.Fatal("NewRateLimiter() returned nil")
	}
	if rl.rate != 50 {
		t.Errorf("rate = %d, want 50", rl.rate)
	}
	if rl.interval != 30*time.Second {
		t.Errorf("interval = %v, want %v", rl.interval, 30*time.Second)
	}
	if rl.clients == nil {
		t.Error("clients map is nil")
	}
}

func TestAllow_FirstRequest(t *testing.T) {
	rl := newTestLimiter(5, time.Minute)

	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() = false for first request, want true")
	}
}

func TestAllow_WithinLimit(t *testing.T) {
	rl := newTestLimiter(5, time.Minute)

	for i := 0; i < 5; i++ {
		if !rl.Allow("10.0.0.1") {
			t.Errorf("Allow() = false on request %d, want true (within limit)", i+1)
		}
	}
}

func TestAllow_ExceedsLimit(t *testing.T) {
	rl := newTestLimiter(3, time.Minute)

	// Use all 3 tokens
	for i := 0; i < 3; i++ {
		rl.Allow("10.0.0.1")
	}

	// 4th should be denied
	if rl.Allow("10.0.0.1") {
		t.Error("Allow() = true after exceeding limit, want false")
	}
}

func TestAllow_ExactLimit(t *testing.T) {
	rl := newTestLimiter(3, time.Minute)

	// First request: creates entry with tokens = rate - 1 = 2
	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() request 1 = false, want true")
	}
	// Second request: tokens = 1
	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() request 2 = false, want true")
	}
	// Third request: tokens = 0
	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() request 3 = false, want true")
	}
	// Fourth: denied
	if rl.Allow("10.0.0.1") {
		t.Error("Allow() request 4 = true, want false (exceeded limit)")
	}
}

func TestAllow_TokenReset(t *testing.T) {
	rl := newTestLimiter(2, 50*time.Millisecond)

	// Use both tokens
	rl.Allow("10.0.0.1")
	rl.Allow("10.0.0.1")

	// Should be denied
	if rl.Allow("10.0.0.1") {
		t.Error("Allow() = true after exhaustion, want false")
	}

	// Wait for interval to pass
	time.Sleep(60 * time.Millisecond)

	// Tokens should be reset
	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() = false after interval reset, want true")
	}
}

func TestAllow_MultipleIPs(t *testing.T) {
	rl := newTestLimiter(2, time.Minute)

	// Exhaust IP1
	rl.Allow("10.0.0.1")
	rl.Allow("10.0.0.1")

	if rl.Allow("10.0.0.1") {
		t.Error("Allow() IP1 = true after exhaustion, want false")
	}

	// IP2 should still be allowed
	if !rl.Allow("10.0.0.2") {
		t.Error("Allow() IP2 = false, want true (independent limit)")
	}
}

func TestAllow_SingleTokenBucket(t *testing.T) {
	rl := newTestLimiter(1, time.Minute)

	// First request uses the only token
	if !rl.Allow("10.0.0.1") {
		t.Error("Allow() = false for first request with rate=1, want true")
	}
	// Second request should be denied
	if rl.Allow("10.0.0.1") {
		t.Error("Allow() = true for second request with rate=1, want false")
	}
}

func TestMiddleware_AllowedRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rl := newTestLimiter(10, time.Minute)

	router := gin.New()
	router.Use(rl.Middleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestMiddleware_RateLimited(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rl := newTestLimiter(1, time.Minute)

	router := gin.New()
	router.Use(rl.Middleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// First request uses the token
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Errorf("first request status = %d, want %d", w1.Code, http.StatusOK)
	}

	// Second request should be rate limited
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("second request status = %d, want %d", w2.Code, http.StatusTooManyRequests)
	}

	// Verify JSON body
	var body map[string]string
	if err := json.Unmarshal(w2.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}
	if body["error"] != "rate limit exceeded" {
		t.Errorf("error = %q, want %q", body["error"], "rate limit exceeded")
	}
	if body["message"] != "Too many requests. Please slow down." {
		t.Errorf("message = %q, want %q", body["message"], "Too many requests. Please slow down.")
	}
}

func TestMiddleware_DifferentIPs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rl := newTestLimiter(1, time.Minute)

	router := gin.New()
	router.Use(rl.Middleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Exhaust IP1
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w1, req1)

	// IP2 should still work
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "10.0.0.2:12345"
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("IP2 status = %d, want %d", w2.Code, http.StatusOK)
	}
}

func TestDefaultRateLimiter(t *testing.T) {
	rl := DefaultRateLimiter()
	if rl == nil {
		t.Fatal("DefaultRateLimiter() returned nil")
	}
	if rl.rate != 100 {
		t.Errorf("rate = %d, want 100", rl.rate)
	}
	if rl.interval != time.Minute {
		t.Errorf("interval = %v, want %v", rl.interval, time.Minute)
	}
}

func TestAllow_Concurrent(t *testing.T) {
	rl := newTestLimiter(100, time.Minute)

	var wg sync.WaitGroup
	allowed := make(chan bool, 200)

	// 200 concurrent requests from same IP
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			allowed <- rl.Allow("10.0.0.1")
		}()
	}

	wg.Wait()
	close(allowed)

	trueCount := 0
	for result := range allowed {
		if result {
			trueCount++
		}
	}

	// Exactly 100 should be allowed (rate = 100)
	if trueCount != 100 {
		t.Errorf("allowed count = %d, want 100", trueCount)
	}
}
