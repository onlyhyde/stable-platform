package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(10.0, 20)

	if rl == nil {
		t.Fatal("expected rate limiter to be created")
	}
	if rl.rps != 10.0 {
		t.Errorf("rps = %f, want 10.0", rl.rps)
	}
	if rl.burst != 20 {
		t.Errorf("burst = %d, want 20", rl.burst)
	}
	if rl.requests == nil {
		t.Fatal("expected requests map to be initialized")
	}
}

func TestRateLimiter_Allow(t *testing.T) {
	rl := NewRateLimiter(10.0, 5)
	ip := "192.168.1.1"

	// First 5 requests should be allowed
	for i := 0; i < 5; i++ {
		if !rl.Allow(ip) {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	// 6th request should be denied
	if rl.Allow(ip) {
		t.Error("6th request should be denied")
	}

	// Different IP should still be allowed
	if !rl.Allow("192.168.1.2") {
		t.Error("different IP should be allowed")
	}
}

func TestRateLimiter_AllowAfterWindow(t *testing.T) {
	rl := NewRateLimiter(10.0, 2)
	ip := "192.168.1.1"

	// Use up the burst limit
	rl.Allow(ip)
	rl.Allow(ip)

	// Should be denied
	if rl.Allow(ip) {
		t.Error("should be denied after burst")
	}

	// Manually clear the requests to simulate time passing
	rl.mu.Lock()
	rl.requests[ip] = nil
	rl.mu.Unlock()

	// Should be allowed again
	if !rl.Allow(ip) {
		t.Error("should be allowed after window reset")
	}
}

func TestRateLimiter_Concurrency(t *testing.T) {
	rl := NewRateLimiter(100.0, 50)
	ip := "192.168.1.1"

	var wg sync.WaitGroup
	allowed := 0
	denied := 0
	var mu sync.Mutex

	// Launch 100 concurrent requests
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result := rl.Allow(ip)
			mu.Lock()
			if result {
				allowed++
			} else {
				denied++
			}
			mu.Unlock()
		}()
	}

	wg.Wait()

	// Should have allowed at most 50 (burst limit)
	if allowed > 50 {
		t.Errorf("allowed %d requests, expected at most 50", allowed)
	}
	// Total should be 100
	if allowed+denied != 100 {
		t.Errorf("total = %d, expected 100", allowed+denied)
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(RateLimitMiddleware(10.0, 3))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// First 3 requests should succeed
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("request %d: expected status 200, got %d", i+1, w.Code)
		}
	}

	// 4th request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("4th request: expected status 429, got %d", w.Code)
	}
}

func TestLoggingMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(LoggingMiddleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	// Should not panic and return 200
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestRecoveryMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(RecoveryMiddleware())
	router.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})
	router.GET("/ok", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Test panic recovery
	req := httptest.NewRequest("GET", "/panic", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("panic route: expected status 500, got %d", w.Code)
	}

	// Test normal request
	req = httptest.NewRequest("GET", "/ok", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("ok route: expected status 200, got %d", w.Code)
	}
}

func TestCORSMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Test regular request
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("expected Access-Control-Allow-Origin header")
	}
	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("expected Access-Control-Allow-Methods header")
	}

	// Test OPTIONS request
	req = httptest.NewRequest("OPTIONS", "/test", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS: expected status 204, got %d", w.Code)
	}
}

func TestSecurityHeadersMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(SecurityHeadersMiddleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	expectedHeaders := map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"X-XSS-Protection":          "1; mode=block",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	}

	for header, expected := range expectedHeaders {
		if got := w.Header().Get(header); got != expected {
			t.Errorf("%s = %s, want %s", header, got, expected)
		}
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.GET("/test", func(c *gin.Context) {
		requestID, _ := c.Get("requestID")
		c.JSON(http.StatusOK, gin.H{"requestId": requestID})
	})

	// Test without X-Request-ID header
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("X-Request-ID") == "" {
		t.Error("expected X-Request-ID header to be generated")
	}

	// Test with X-Request-ID header
	req = httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "custom-request-id")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("X-Request-ID") != "custom-request-id" {
		t.Errorf("expected X-Request-ID to be preserved, got %s", w.Header().Get("X-Request-ID"))
	}
}

func TestGenerateRequestID(t *testing.T) {
	id1 := generateRequestID()
	time.Sleep(time.Millisecond)
	id2 := generateRequestID()

	if id1 == "" {
		t.Error("expected non-empty request ID")
	}
	if id1 == id2 {
		t.Error("expected unique request IDs")
	}
}

func TestTimeoutMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(TimeoutMiddleware(5 * time.Second))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestBodyLimitMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(BodyLimitMiddleware(100)) // 100 bytes limit
	router.POST("/test", func(c *gin.Context) {
		body := make([]byte, 1024)
		n, err := c.Request.Body.Read(body)
		if err != nil && err.Error() != "http: request body too large" && err.Error() != "EOF" {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "body too large"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"bytes": n})
	})

	// Test small body
	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("small body: expected status 200, got %d", w.Code)
	}
}

func TestMiddlewareChain(t *testing.T) {
	router := gin.New()
	router.Use(
		RecoveryMiddleware(),
		LoggingMiddleware(),
		CORSMiddleware(),
		SecurityHeadersMiddleware(),
		RequestIDMiddleware(),
	)
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	// Verify all headers are set
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Error("missing CORS header")
	}
	if w.Header().Get("X-Content-Type-Options") == "" {
		t.Error("missing security header")
	}
	if w.Header().Get("X-Request-ID") == "" {
		t.Error("missing request ID header")
	}
}

func TestRateLimiter_MultipleIPs(t *testing.T) {
	rl := NewRateLimiter(10.0, 2)

	ips := []string{"192.168.1.1", "192.168.1.2", "192.168.1.3"}

	// Each IP should get its own bucket
	for _, ip := range ips {
		if !rl.Allow(ip) {
			t.Errorf("first request from %s should be allowed", ip)
		}
		if !rl.Allow(ip) {
			t.Errorf("second request from %s should be allowed", ip)
		}
		if rl.Allow(ip) {
			t.Errorf("third request from %s should be denied", ip)
		}
	}
}
