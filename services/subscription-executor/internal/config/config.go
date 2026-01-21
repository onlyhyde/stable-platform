package config

import (
	"os"
)

// Config holds the application configuration
type Config struct {
	// Server settings
	Port string

	// Blockchain settings
	RPCURL                      string
	ChainID                     int
	SubscriptionManagerAddress  string
	RecurringPaymentExecutorAddr string
	EntryPointAddress           string

	// Bundler settings
	BundlerURL string

	// Executor wallet (for gas)
	ExecutorPrivateKey string

	// Database
	DatabaseURL string

	// Polling interval in seconds
	PollingInterval int
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:                         getEnv("PORT", "8083"),
		RPCURL:                       getEnv("RPC_URL", "http://localhost:8545"),
		ChainID:                      getEnvInt("CHAIN_ID", 31337),
		SubscriptionManagerAddress:   getEnv("SUBSCRIPTION_MANAGER_ADDRESS", ""),
		RecurringPaymentExecutorAddr: getEnv("RECURRING_PAYMENT_EXECUTOR_ADDRESS", ""),
		EntryPointAddress:            getEnv("ENTRYPOINT_ADDRESS", "0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
		BundlerURL:                   getEnv("BUNDLER_URL", "http://localhost:4337"),
		ExecutorPrivateKey:           getEnv("EXECUTOR_PRIVATE_KEY", ""),
		DatabaseURL:                  getEnv("DATABASE_URL", "postgres://localhost:5432/subscription_executor?sslmode=disable"),
		PollingInterval:              getEnvInt("POLLING_INTERVAL", 60),
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
