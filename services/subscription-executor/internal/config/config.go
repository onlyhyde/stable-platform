package config

import (
	"os"
	"time"
)

// Config holds the application configuration
type Config struct {
	// Server settings
	Port string

	// Blockchain settings
	RPCURL                       string
	ChainID                      int
	SubscriptionManagerAddress   string
	RecurringPaymentExecutorAddr string
	EntryPointAddress            string

	// Bundler settings
	BundlerURL string

	// Paymaster settings
	PaymasterURL string

	// Executor wallet (for gas)
	ExecutorPrivateKey string

	// Database settings
	Database DatabaseConfig

	// Polling interval in seconds
	PollingInterval int
}

// DatabaseConfig holds database-specific configuration
// Following Supabase/Postgres Best Practices for connection management
type DatabaseConfig struct {
	// Connection URL
	URL string

	// Connection pool settings
	MaxConns        int32         // Maximum connections in pool (default: 10)
	MinConns        int32         // Minimum connections in pool (default: 2)
	MaxConnLifetime time.Duration // Maximum connection lifetime (default: 30m)
	MaxConnIdleTime time.Duration // Maximum idle time before connection is closed (default: 10m)

	// Timeout settings
	ConnectTimeout   time.Duration // Connection timeout (default: 30s)
	StatementTimeout time.Duration // Query timeout (default: 30s)

	// Health check
	HealthCheckPeriod time.Duration // How often to check connection health (default: 1m)

	// Enable in-memory mode (for development/testing)
	UseInMemory bool
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:                         getEnv("PORT", "8083"),
		RPCURL:                       getEnv("RPC_URL", "http://localhost:8545"),
		ChainID:                      getEnvInt("CHAIN_ID", 31337),
		SubscriptionManagerAddress:   getEnv("SUBSCRIPTION_MANAGER_ADDRESS", ""),
		RecurringPaymentExecutorAddr: getEnv("RECURRING_PAYMENT_EXECUTOR_ADDRESS", ""),
		EntryPointAddress:            getEnv("ENTRY_POINT_ADDRESS", "0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
		BundlerURL:                   getEnv("BUNDLER_URL", "http://localhost:4337"),
		PaymasterURL:                 getEnv("PAYMASTER_URL", "http://localhost:3001"),
		ExecutorPrivateKey:           getEnv("EXECUTOR_PRIVATE_KEY", ""),
		Database: DatabaseConfig{
			URL:               getEnv("DATABASE_URL", "postgres://localhost:5432/subscription_executor?sslmode=disable"),
			MaxConns:          int32(getEnvInt("DATABASE_MAX_CONNS", 10)),
			MinConns:          int32(getEnvInt("DATABASE_MIN_CONNS", 2)),
			MaxConnLifetime:   time.Duration(getEnvInt("DATABASE_MAX_CONN_LIFETIME_MINS", 30)) * time.Minute,
			MaxConnIdleTime:   time.Duration(getEnvInt("DATABASE_MAX_CONN_IDLE_MINS", 10)) * time.Minute,
			ConnectTimeout:    time.Duration(getEnvInt("DATABASE_CONNECT_TIMEOUT_SECS", 30)) * time.Second,
			StatementTimeout:  time.Duration(getEnvInt("DATABASE_STATEMENT_TIMEOUT_SECS", 30)) * time.Second,
			HealthCheckPeriod: time.Duration(getEnvInt("DATABASE_HEALTH_CHECK_SECS", 60)) * time.Second,
			UseInMemory:       getEnv("DATABASE_USE_INMEMORY", "false") == "true",
		},
		PollingInterval: getEnvInt("POLLING_INTERVAL", 60),
	}
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
		if _, err := parseIntFromString(value, &result); err == nil {
			return result
		}
	}
	return defaultValue
}

func parseIntFromString(s string, result *int) (int, error) {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, nil
		}
		n = n*10 + int(c-'0')
	}
	*result = n
	return n, nil
}
