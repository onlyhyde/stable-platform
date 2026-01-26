package config

import (
	"log"
	"os"
)

// Config holds the application configuration
type Config struct {
	Port string

	// Webhook settings
	WebhookURL    string
	WebhookSecret string

	// Simulation settings
	SuccessRate int // Percentage of successful payments (0-100)
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "4351"),
		WebhookURL:    getEnv("WEBHOOK_URL", ""),
		WebhookSecret: getEnvWithWarning("WEBHOOK_SECRET", "pg-webhook-secret-dev"),
		SuccessRate:   getEnvInt("SUCCESS_RATE", 95),
	}
}

// getEnvWithWarning returns environment variable value with a warning if using default
// SECURITY: Default values should only be used in development environments
func getEnvWithWarning(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	log.Printf("WARNING: %s not set, using insecure default. Set this in production!", key)
	return defaultValue
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
