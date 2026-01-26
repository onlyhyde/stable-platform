package config

import (
	"fmt"
	"log"
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
func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "4350"),
		WebhookURL:     getEnv("WEBHOOK_URL", ""),
		WebhookSecret:  getEnvWithWarning("WEBHOOK_SECRET", "bank-webhook-secret-dev"),
		DefaultBalance: getEnv("DEFAULT_BALANCE", "10000.00"),
	}

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks that required configuration values are set
func (c *Config) Validate() error {
	// In production (GIN_MODE=release), webhook secret must be explicitly set
	if os.Getenv("GIN_MODE") == "release" {
		if c.WebhookSecret == "bank-webhook-secret-dev" {
			return fmt.Errorf("WEBHOOK_SECRET must be set in production (GIN_MODE=release)")
		}
	}
	return nil
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
