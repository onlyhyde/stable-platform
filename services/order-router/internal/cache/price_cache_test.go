package cache

import (
	"sync"
	"testing"
	"time"
)

func TestNewPriceCache(t *testing.T) {
	cache := NewPriceCache(60)
	if cache == nil {
		t.Fatal("expected cache to be created")
	}
	if cache.cache == nil {
		t.Fatal("expected cache map to be initialized")
	}
	if cache.ttl != 60*time.Second {
		t.Errorf("expected TTL 60s, got %v", cache.ttl)
	}
}

func TestPriceCache_SetAndGet(t *testing.T) {
	cache := NewPriceCache(60)

	// Test set and get
	cache.Set("ETH-USDC-uniswap_v3", "1800.50")

	price, ok := cache.Get("ETH-USDC-uniswap_v3")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if price != "1800.50" {
		t.Errorf("expected price 1800.50, got %s", price)
	}
}

func TestPriceCache_GetMiss(t *testing.T) {
	cache := NewPriceCache(60)

	price, ok := cache.Get("nonexistent-key")
	if ok {
		t.Fatal("expected cache miss")
	}
	if price != "" {
		t.Errorf("expected empty price, got %s", price)
	}
}

func TestPriceCache_Expiration(t *testing.T) {
	// Use a very short TTL for testing
	cache := &PriceCache{
		cache: make(map[string]PriceEntry),
		ttl:   50 * time.Millisecond,
	}

	cache.Set("ETH-USDC", "1800.00")

	// Should get the value immediately
	price, ok := cache.Get("ETH-USDC")
	if !ok {
		t.Fatal("expected cache hit before expiration")
	}
	if price != "1800.00" {
		t.Errorf("expected price 1800.00, got %s", price)
	}

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Should miss after expiration
	_, ok = cache.Get("ETH-USDC")
	if ok {
		t.Fatal("expected cache miss after expiration")
	}
}

func TestPriceCache_Delete(t *testing.T) {
	cache := NewPriceCache(60)

	cache.Set("ETH-USDC", "1800.00")
	cache.Delete("ETH-USDC")

	_, ok := cache.Get("ETH-USDC")
	if ok {
		t.Fatal("expected cache miss after delete")
	}
}

func TestPriceCache_Clear(t *testing.T) {
	cache := NewPriceCache(60)

	cache.Set("ETH-USDC", "1800.00")
	cache.Set("BTC-USDC", "35000.00")
	cache.Clear()

	_, ok1 := cache.Get("ETH-USDC")
	_, ok2 := cache.Get("BTC-USDC")

	if ok1 || ok2 {
		t.Fatal("expected cache to be empty after clear")
	}
}

func TestPriceCache_Overwrite(t *testing.T) {
	cache := NewPriceCache(60)

	cache.Set("ETH-USDC", "1800.00")
	cache.Set("ETH-USDC", "1850.00")

	price, ok := cache.Get("ETH-USDC")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if price != "1850.00" {
		t.Errorf("expected overwritten price 1850.00, got %s", price)
	}
}

func TestPriceCache_Concurrency(t *testing.T) {
	cache := NewPriceCache(60)
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			cache.Set("key", "value")
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cache.Get("key")
		}()
	}

	wg.Wait()
	// If we get here without deadlock or panic, test passes
}

func TestMakeCacheKey(t *testing.T) {
	tests := []struct {
		name     string
		tokenIn  string
		tokenOut string
		protocol string
		want     string
	}{
		{
			name:     "basic tokens",
			tokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			protocol: "uniswap_v3",
			want:     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48-uniswap_v3",
		},
		{
			name:     "different protocol",
			tokenIn:  "ETH",
			tokenOut: "USDC",
			protocol: "1inch",
			want:     "ETH-USDC-1inch",
		},
		{
			name:     "empty protocol",
			tokenIn:  "ETH",
			tokenOut: "USDC",
			protocol: "",
			want:     "ETH-USDC-",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MakeCacheKey(tt.tokenIn, tt.tokenOut, tt.protocol)
			if got != tt.want {
				t.Errorf("MakeCacheKey() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPriceCache_MultipleKeys(t *testing.T) {
	cache := NewPriceCache(60)

	// Set multiple different keys
	keys := []struct {
		key   string
		price string
	}{
		{"ETH-USDC-uniswap_v3", "1800.00"},
		{"BTC-USDC-uniswap_v3", "35000.00"},
		{"ETH-DAI-sushiswap", "1799.50"},
		{"WBTC-ETH-uniswap_v2", "19.5"},
	}

	for _, k := range keys {
		cache.Set(k.key, k.price)
	}

	// Verify all keys are accessible
	for _, k := range keys {
		price, ok := cache.Get(k.key)
		if !ok {
			t.Errorf("expected cache hit for key %s", k.key)
		}
		if price != k.price {
			t.Errorf("expected price %s for key %s, got %s", k.price, k.key, price)
		}
	}
}
