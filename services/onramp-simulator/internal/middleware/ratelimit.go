package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements a simple token bucket rate limiter per IP
type RateLimiter struct {
	mu       sync.RWMutex
	clients  map[string]*clientLimiter
	rate     int           // requests per interval
	interval time.Duration // time window
}

type clientLimiter struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		clients:  make(map[string]*clientLimiter),
		rate:     rate,
		interval: interval,
	}

	// Cleanup old entries periodically
	go rl.cleanup()

	return rl
}

// cleanup removes stale client entries
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, client := range rl.clients {
			if now.Sub(client.lastReset) > rl.interval*2 {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if a request from the given IP is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	client, exists := rl.clients[ip]

	if !exists {
		rl.clients[ip] = &clientLimiter{
			tokens:    rl.rate - 1,
			lastReset: now,
		}
		return true
	}

	// Reset tokens if interval has passed
	if now.Sub(client.lastReset) >= rl.interval {
		client.tokens = rl.rate - 1
		client.lastReset = now
		return true
	}

	// Check if tokens available
	if client.tokens > 0 {
		client.tokens--
		return true
	}

	return false
}

// Middleware returns a Gin middleware function for rate limiting
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		if !rl.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate limit exceeded",
				"message": "Too many requests. Please slow down.",
			})
			return
		}

		c.Next()
	}
}

// DefaultRateLimiter creates a rate limiter with default settings
// 100 requests per minute per IP
func DefaultRateLimiter() *RateLimiter {
	return NewRateLimiter(100, time.Minute)
}
