package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Clear environment
	clearEnv()
	defer clearEnv()

	t.Run("default values", func(t *testing.T) {
		cfg, err := Load()
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if cfg.Port != "8087" {
			t.Errorf("expected port 8087, got %s", cfg.Port)
		}
		if cfg.RPCURL != "http://localhost:8545" {
			t.Errorf("expected default RPC URL, got %s", cfg.RPCURL)
		}
		if cfg.ChainID != 1 {
			t.Errorf("expected chain ID 1, got %d", cfg.ChainID)
		}
		if cfg.MaxHops != 3 {
			t.Errorf("expected maxHops 3, got %d", cfg.MaxHops)
		}
		if cfg.MaxSplits != 5 {
			t.Errorf("expected maxSplits 5, got %d", cfg.MaxSplits)
		}
		if cfg.DefaultSlippage != 50 {
			t.Errorf("expected defaultSlippage 50, got %f", cfg.DefaultSlippage)
		}
		if cfg.PriceCacheTTL != 30 {
			t.Errorf("expected priceCacheTTL 30, got %d", cfg.PriceCacheTTL)
		}
	})

	t.Run("custom values", func(t *testing.T) {
		os.Setenv("PORT", "9000")
		os.Setenv("RPC_URL", "https://mainnet.infura.io/v3/key")
		os.Setenv("CHAIN_ID", "137")
		os.Setenv("MAX_HOPS", "5")
		os.Setenv("MAX_SPLITS", "3")
		os.Setenv("DEFAULT_SLIPPAGE", "100")
		os.Setenv("PRICE_CACHE_TTL", "60")
		os.Setenv("ONEINCH_API_KEY", "test-api-key")
		os.Setenv("ZEROX_API_KEY", "test-0x-key")
		defer clearEnv()

		cfg, err := Load()
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if cfg.Port != "9000" {
			t.Errorf("expected port 9000, got %s", cfg.Port)
		}
		if cfg.RPCURL != "https://mainnet.infura.io/v3/key" {
			t.Errorf("expected custom RPC URL, got %s", cfg.RPCURL)
		}
		if cfg.ChainID != 137 {
			t.Errorf("expected chain ID 137, got %d", cfg.ChainID)
		}
		if cfg.MaxHops != 5 {
			t.Errorf("expected maxHops 5, got %d", cfg.MaxHops)
		}
		if cfg.MaxSplits != 3 {
			t.Errorf("expected maxSplits 3, got %d", cfg.MaxSplits)
		}
		if cfg.DefaultSlippage != 100 {
			t.Errorf("expected defaultSlippage 100, got %f", cfg.DefaultSlippage)
		}
		if cfg.PriceCacheTTL != 60 {
			t.Errorf("expected priceCacheTTL 60, got %d", cfg.PriceCacheTTL)
		}
		if cfg.OneInchAPIKey != "test-api-key" {
			t.Errorf("expected OneInchAPIKey, got %s", cfg.OneInchAPIKey)
		}
		if cfg.ZeroXAPIKey != "test-0x-key" {
			t.Errorf("expected ZeroXAPIKey, got %s", cfg.ZeroXAPIKey)
		}
	})
}

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid config",
			config: &Config{
				Port:      "8080",
				RPCURL:    "http://localhost:8545",
				ChainID:   1,
				MaxHops:   3,
				MaxSplits: 5,
			},
			wantErr: false,
		},
		{
			name: "empty RPC URL",
			config: &Config{
				Port:      "8080",
				RPCURL:    "",
				ChainID:   1,
				MaxHops:   3,
				MaxSplits: 5,
			},
			wantErr: true,
			errMsg:  "RPC_URL is required",
		},
		{
			name: "empty port",
			config: &Config{
				Port:      "",
				RPCURL:    "http://localhost:8545",
				ChainID:   1,
				MaxHops:   3,
				MaxSplits: 5,
			},
			wantErr: true,
			errMsg:  "PORT is required",
		},
		{
			name: "invalid chain ID",
			config: &Config{
				Port:      "8080",
				RPCURL:    "http://localhost:8545",
				ChainID:   0,
				MaxHops:   3,
				MaxSplits: 5,
			},
			wantErr: true,
			errMsg:  "CHAIN_ID must be a positive integer",
		},
		{
			name: "negative chain ID",
			config: &Config{
				Port:      "8080",
				RPCURL:    "http://localhost:8545",
				ChainID:   -1,
				MaxHops:   3,
				MaxSplits: 5,
			},
			wantErr: true,
			errMsg:  "CHAIN_ID must be a positive integer",
		},
		{
			name: "invalid maxHops",
			config: &Config{
				Port:      "8080",
				RPCURL:    "http://localhost:8545",
				ChainID:   1,
				MaxHops:   0,
				MaxSplits: 5,
			},
			wantErr: true,
			errMsg:  "MAX_HOPS must be a positive integer",
		},
		{
			name: "invalid maxSplits",
			config: &Config{
				Port:      "8080",
				RPCURL:    "http://localhost:8545",
				ChainID:   1,
				MaxHops:   3,
				MaxSplits: 0,
			},
			wantErr: true,
			errMsg:  "MAX_SPLITS must be a positive integer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				} else if err.Error() != tt.errMsg {
					t.Errorf("expected error %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestConfig_SupportedProtocols(t *testing.T) {
	cfg := &Config{}
	protocols := cfg.SupportedProtocols()

	expected := []string{"uniswap_v2", "uniswap_v3", "sushiswap", "curve"}
	if len(protocols) != len(expected) {
		t.Errorf("expected %d protocols, got %d", len(expected), len(protocols))
	}

	for i, p := range expected {
		if protocols[i] != p {
			t.Errorf("expected protocol %s at index %d, got %s", p, i, protocols[i])
		}
	}
}

func TestConfig_SupportedAggregators(t *testing.T) {
	t.Run("no API keys", func(t *testing.T) {
		cfg := &Config{}
		aggregators := cfg.SupportedAggregators()
		if len(aggregators) != 0 {
			t.Errorf("expected 0 aggregators, got %d", len(aggregators))
		}
	})

	t.Run("with 1inch API key", func(t *testing.T) {
		cfg := &Config{OneInchAPIKey: "test-key"}
		aggregators := cfg.SupportedAggregators()
		if len(aggregators) != 1 {
			t.Errorf("expected 1 aggregator, got %d", len(aggregators))
		}
		if aggregators[0] != "1inch" {
			t.Errorf("expected '1inch', got %s", aggregators[0])
		}
	})

	t.Run("with 0x API key", func(t *testing.T) {
		cfg := &Config{ZeroXAPIKey: "test-key"}
		aggregators := cfg.SupportedAggregators()
		if len(aggregators) != 1 {
			t.Errorf("expected 1 aggregator, got %d", len(aggregators))
		}
		if aggregators[0] != "0x" {
			t.Errorf("expected '0x', got %s", aggregators[0])
		}
	})

	t.Run("with both API keys", func(t *testing.T) {
		cfg := &Config{
			OneInchAPIKey: "test-key",
			ZeroXAPIKey:   "test-key",
		}
		aggregators := cfg.SupportedAggregators()
		if len(aggregators) != 2 {
			t.Errorf("expected 2 aggregators, got %d", len(aggregators))
		}
	})
}

func TestGetEnvInt(t *testing.T) {
	tests := []struct {
		name         string
		envValue     string
		defaultValue int
		want         int
	}{
		{"valid int", "42", 0, 42},
		{"empty uses default", "", 10, 10},
		{"invalid uses default", "abc", 10, 10},
		{"mixed uses default", "12abc", 10, 10},
		{"zero", "0", 10, 0},
		{"large number", "12345", 0, 12345},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := "TEST_ENV_INT"
			if tt.envValue != "" {
				os.Setenv(key, tt.envValue)
				defer os.Unsetenv(key)
			} else {
				os.Unsetenv(key)
			}

			got := getEnvInt(key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvInt() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestGetEnvFloat(t *testing.T) {
	tests := []struct {
		name         string
		envValue     string
		defaultValue float64
		want         float64
	}{
		{"valid float", "3.14", 0, 3.14},
		{"valid int", "42", 0, 42.0},
		{"empty uses default", "", 1.5, 1.5},
		{"invalid uses default", "abc", 1.5, 1.5},
		{"multiple dots uses default", "1.2.3", 1.5, 1.5},
		{"zero", "0", 1.5, 0.0},
		{"decimal only", "0.5", 0, 0.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := "TEST_ENV_FLOAT"
			if tt.envValue != "" {
				os.Setenv(key, tt.envValue)
				defer os.Unsetenv(key)
			} else {
				os.Unsetenv(key)
			}

			got := getEnvFloat(key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvFloat() = %f, want %f", got, tt.want)
			}
		})
	}
}

func clearEnv() {
	os.Unsetenv("PORT")
	os.Unsetenv("RPC_URL")
	os.Unsetenv("CHAIN_ID")
	os.Unsetenv("MAX_HOPS")
	os.Unsetenv("MAX_SPLITS")
	os.Unsetenv("DEFAULT_SLIPPAGE")
	os.Unsetenv("PRICE_CACHE_TTL")
	os.Unsetenv("ONEINCH_API_KEY")
	os.Unsetenv("ZEROX_API_KEY")
}
