package cache

import (
	"sync"
	"time"
)

// PriceEntry represents a cached price entry
type PriceEntry struct {
	Price     string
	Timestamp time.Time
}

// PriceCache provides in-memory caching for price data
type PriceCache struct {
	cache map[string]PriceEntry
	ttl   time.Duration
	mu    sync.RWMutex
}

// NewPriceCache creates a new price cache
func NewPriceCache(ttlSeconds int) *PriceCache {
	cache := &PriceCache{
		cache: make(map[string]PriceEntry),
		ttl:   time.Duration(ttlSeconds) * time.Second,
	}

	// Start cleanup goroutine
	go cache.cleanup()

	return cache
}

// Get retrieves a price from cache
func (c *PriceCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.cache[key]
	if !ok {
		return "", false
	}

	// Check if expired
	if time.Since(entry.Timestamp) > c.ttl {
		return "", false
	}

	return entry.Price, true
}

// Set stores a price in cache
func (c *PriceCache) Set(key, price string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache[key] = PriceEntry{
		Price:     price,
		Timestamp: time.Now(),
	}
}

// Delete removes a price from cache
func (c *PriceCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, key)
}

// Clear removes all entries from cache
func (c *PriceCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]PriceEntry)
}

// cleanup periodically removes expired entries
func (c *PriceCache) cleanup() {
	ticker := time.NewTicker(c.ttl)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for key, entry := range c.cache {
			if now.Sub(entry.Timestamp) > c.ttl {
				delete(c.cache, key)
			}
		}
		c.mu.Unlock()
	}
}

// MakeCacheKey creates a cache key from token pair
func MakeCacheKey(tokenIn, tokenOut, protocol string) string {
	return tokenIn + "-" + tokenOut + "-" + protocol
}
