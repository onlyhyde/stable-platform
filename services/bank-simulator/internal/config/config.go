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

	// Default account settings
	DefaultBalance string // Initial balance for new accounts
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8084"),
		WebhookURL:     getEnv("WEBHOOK_URL", ""),
		WebhookSecret:  getEnv("WEBHOOK_SECRET", "bank-webhook-secret"),
		DefaultBalance: getEnv("DEFAULT_BALANCE", "10000.00"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
