package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the bridge relayer
type Config struct {
	// Server configuration
	Server ServerConfig

	// Ethereum configuration
	Ethereum EthereumConfig

	// MPC configuration
	MPC MPCConfig

	// Bridge contract addresses
	Contracts ContractConfig

	// Monitor configuration
	Monitor MonitorConfig

	// Rate limiting
	RateLimit RateLimitConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	Mode         string // "debug", "release", "test"
}

// EthereumConfig holds Ethereum node configuration
type EthereumConfig struct {
	SourceRPCURL    string
	TargetRPCURL    string
	SourceChainID   uint64
	TargetChainID   uint64
	PrivateKey      string // Relayer's private key for signing transactions
	GasLimitBuffer  uint64 // Buffer to add to estimated gas
	MaxGasPrice     uint64 // Maximum gas price in gwei
	ConfirmBlocks   uint64 // Number of blocks to wait for confirmation
}

// MPCConfig holds MPC signer configuration
type MPCConfig struct {
	SignerEndpoints []string      // URLs of MPC signer nodes
	Threshold       int           // Required signatures (e.g., 5 of 7)
	TotalSigners    int           // Total number of signers
	Timeout         time.Duration // Timeout for collecting signatures
}

// ContractConfig holds contract addresses
type ContractConfig struct {
	SecureBridge       string
	BridgeValidator    string
	BridgeRateLimiter  string
	OptimisticVerifier string
	FraudProofVerifier string
	BridgeGuardian     string
}

// MonitorConfig holds event monitoring configuration
type MonitorConfig struct {
	PollInterval       time.Duration
	BlockConfirmations uint64
	MaxBlockRange      uint64 // Maximum blocks to query at once
	RetryAttempts      int
	RetryDelay         time.Duration
}

// RateLimitConfig holds API rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			ReadTimeout:  getDurationEnv("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout: getDurationEnv("SERVER_WRITE_TIMEOUT", 30*time.Second),
			Mode:         getEnv("GIN_MODE", "debug"),
		},
		Ethereum: EthereumConfig{
			SourceRPCURL:   getEnv("SOURCE_RPC_URL", "http://localhost:8545"),
			TargetRPCURL:   getEnv("TARGET_RPC_URL", "http://localhost:8546"),
			SourceChainID:  getUint64Env("SOURCE_CHAIN_ID", 1),
			TargetChainID:  getUint64Env("TARGET_CHAIN_ID", 137),
			PrivateKey:     getEnv("RELAYER_PRIVATE_KEY", ""),
			GasLimitBuffer: getUint64Env("GAS_LIMIT_BUFFER", 50000),
			MaxGasPrice:    getUint64Env("MAX_GAS_PRICE_GWEI", 500),
			ConfirmBlocks:  getUint64Env("CONFIRM_BLOCKS", 12),
		},
		MPC: MPCConfig{
			SignerEndpoints: getSliceEnv("MPC_SIGNER_ENDPOINTS", []string{}),
			Threshold:       getIntEnv("MPC_THRESHOLD", 5),
			TotalSigners:    getIntEnv("MPC_TOTAL_SIGNERS", 7),
			Timeout:         getDurationEnv("MPC_TIMEOUT", 30*time.Second),
		},
		Contracts: ContractConfig{
			SecureBridge:       getEnv("CONTRACT_SECURE_BRIDGE", ""),
			BridgeValidator:    getEnv("CONTRACT_BRIDGE_VALIDATOR", ""),
			BridgeRateLimiter:  getEnv("CONTRACT_BRIDGE_RATE_LIMITER", ""),
			OptimisticVerifier: getEnv("CONTRACT_OPTIMISTIC_VERIFIER", ""),
			FraudProofVerifier: getEnv("CONTRACT_FRAUD_PROOF_VERIFIER", ""),
			BridgeGuardian:     getEnv("CONTRACT_BRIDGE_GUARDIAN", ""),
		},
		Monitor: MonitorConfig{
			PollInterval:       getDurationEnv("MONITOR_POLL_INTERVAL", 5*time.Second),
			BlockConfirmations: getUint64Env("MONITOR_BLOCK_CONFIRMATIONS", 12),
			MaxBlockRange:      getUint64Env("MONITOR_MAX_BLOCK_RANGE", 1000),
			RetryAttempts:      getIntEnv("MONITOR_RETRY_ATTEMPTS", 3),
			RetryDelay:         getDurationEnv("MONITOR_RETRY_DELAY", 5*time.Second),
		},
		RateLimit: RateLimitConfig{
			RequestsPerSecond: getFloat64Env("RATE_LIMIT_RPS", 10.0),
			Burst:             getIntEnv("RATE_LIMIT_BURST", 20),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Ethereum.SourceRPCURL == "" {
		return fmt.Errorf("SOURCE_RPC_URL is required")
	}
	if c.Ethereum.TargetRPCURL == "" {
		return fmt.Errorf("TARGET_RPC_URL is required")
	}
	if c.MPC.Threshold > c.MPC.TotalSigners {
		return fmt.Errorf("MPC_THRESHOLD cannot be greater than MPC_TOTAL_SIGNERS")
	}
	if c.MPC.Threshold < 1 {
		return fmt.Errorf("MPC_THRESHOLD must be at least 1")
	}
	return nil
}

// Helper functions for environment variables

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getUint64Env(key string, defaultValue uint64) uint64 {
	if value := os.Getenv(key); value != "" {
		if uint64Value, err := strconv.ParseUint(value, 10, 64); err == nil {
			return uint64Value
		}
	}
	return defaultValue
}

func getFloat64Env(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getSliceEnv(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
