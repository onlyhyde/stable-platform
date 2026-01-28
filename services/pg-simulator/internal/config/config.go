package config

import (
	"fmt"
	"log"
	"os"
)

// Config holds the application configuration
type Config struct {
	Port    string
	BaseURL string // Base URL for 3DS challenge redirects

	// Webhook settings
	WebhookURL    string
	WebhookSecret string

	// Simulation settings
	SuccessRate int // Percentage of successful payments (0-100)

	// Bank simulator integration
	BankSimulatorURL string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	port := getEnv("PORT", "4351")
	cfg := &Config{
		Port:             port,
		BaseURL:          getEnv("BASE_URL", "http://localhost:"+port),
		WebhookURL:       getEnv("WEBHOOK_URL", ""),
		WebhookSecret:    getEnvWithWarning("WEBHOOK_SECRET", "pg-webhook-secret-dev"),
		SuccessRate:      getEnvInt("SUCCESS_RATE", 95),
		BankSimulatorURL: getEnv("BANK_SIMULATOR_URL", "http://localhost:4350"),
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
		if c.WebhookSecret == "pg-webhook-secret-dev" {
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
