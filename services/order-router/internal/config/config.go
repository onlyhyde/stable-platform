package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// Config holds the application configuration
type Config struct {
	Port string

	// RPC endpoints
	RPCURL  string
	ChainID int

	// Aggregator API keys
	OneInchAPIKey string
	ZeroXAPIKey   string

	// DEX settings
	UniswapV2Router    string
	UniswapV3Router    string
	UniswapV3Quoter    string
	SushiSwapRouter    string
	CurveRegistry      string

	// Cache settings
	PriceCacheTTL int // seconds

	// Routing settings
	MaxHops         int
	MaxSplits       int
	DefaultSlippage float64 // basis points (e.g., 50 = 0.5%)
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		Port:    getEnv("PORT", "8087"),
		RPCURL:  getEnv("RPC_URL", "http://localhost:8545"),
		ChainID: getEnvInt("CHAIN_ID", 1),

		// Aggregator APIs
		OneInchAPIKey: getEnv("ONEINCH_API_KEY", ""),
		ZeroXAPIKey:   getEnv("ZEROX_API_KEY", ""),

		// DEX Routers (Mainnet defaults)
		UniswapV2Router: getEnv("UNISWAP_V2_ROUTER", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"),
		UniswapV3Router: getEnv("UNISWAP_V3_ROUTER", "0xE592427A0AEce92De3Edee1F18E0157C05861564"),
		UniswapV3Quoter: getEnv("UNISWAP_V3_QUOTER", "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"),
		SushiSwapRouter: getEnv("SUSHISWAP_ROUTER", "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"),
		CurveRegistry:   getEnv("CURVE_REGISTRY", "0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5"),

		// Cache
		PriceCacheTTL: getEnvInt("PRICE_CACHE_TTL", 30),

		// Routing
		MaxHops:         getEnvInt("MAX_HOPS", 3),
		MaxSplits:       getEnvInt("MAX_SPLITS", 5),
		DefaultSlippage: getEnvFloat("DEFAULT_SLIPPAGE", 50), // 0.5%
	}

	// Validate required configuration
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks that required configuration values are set and valid
func (c *Config) Validate() error {
	// Validate RPC URL format
	if c.RPCURL == "" {
		return fmt.Errorf("RPC_URL is required")
	}
	if _, err := url.Parse(c.RPCURL); err != nil {
		return fmt.Errorf("invalid RPC_URL format: %w", err)
	}

	// Validate port
	if c.Port == "" {
		return fmt.Errorf("PORT is required")
	}

	// Validate chain ID is positive
	if c.ChainID <= 0 {
		return fmt.Errorf("CHAIN_ID must be a positive integer")
	}

	// Validate routing settings
	if c.MaxHops <= 0 {
		return fmt.Errorf("MAX_HOPS must be a positive integer")
	}
	if c.MaxSplits <= 0 {
		return fmt.Errorf("MAX_SPLITS must be a positive integer")
	}

	return nil
}

// SupportedProtocols returns list of supported DEX protocols
func (c *Config) SupportedProtocols() []string {
	return []string{
		"uniswap_v2",
		"uniswap_v3",
		"sushiswap",
		"curve",
	}
}

// SupportedAggregators returns list of supported aggregators
func (c *Config) SupportedAggregators() []string {
	aggregators := []string{}
	if c.OneInchAPIKey != "" {
		aggregators = append(aggregators, "1inch")
	}
	if c.ZeroXAPIKey != "" {
		aggregators = append(aggregators, "0x")
	}
	return aggregators
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		for _, c := range value {
			if c < '0' || c > '9' {
				return defaultValue
			}
			result = result*10 + int(c-'0')
		}
		return result
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		// Simple float parsing
		parts := strings.Split(value, ".")
		if len(parts) > 2 {
			return defaultValue
		}
		intPart := 0
		for _, c := range parts[0] {
			if c < '0' || c > '9' {
				return defaultValue
			}
			intPart = intPart*10 + int(c-'0')
		}
		if len(parts) == 1 {
			return float64(intPart)
		}
		fracPart := 0
		divisor := 1
		for _, c := range parts[1] {
			if c < '0' || c > '9' {
				return defaultValue
			}
			fracPart = fracPart*10 + int(c-'0')
			divisor *= 10
		}
		return float64(intPart) + float64(fracPart)/float64(divisor)
	}
	return defaultValue
}
