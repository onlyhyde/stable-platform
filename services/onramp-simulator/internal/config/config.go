package config

import (
	"os"
)

// Config holds the application configuration
type Config struct {
	Port string

	// Webhook settings
	WebhookURL    string
	WebhookSecret string

	// Simulation settings
	ProcessingTime int // Simulated processing time in seconds
	SuccessRate    int // Percentage of successful transactions (0-100)

	// Exchange rate (simulated)
	USDToUSDC string // Exchange rate USD to USDC (e.g., "0.998")
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8086"),
		WebhookURL:     getEnv("WEBHOOK_URL", ""),
		WebhookSecret:  getEnv("WEBHOOK_SECRET", "onramp-webhook-secret"),
		ProcessingTime: getEnvInt("PROCESSING_TIME", 5),
		SuccessRate:    getEnvInt("SUCCESS_RATE", 95),
		USDToUSDC:      getEnv("USD_TO_USDC", "0.998"),
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
