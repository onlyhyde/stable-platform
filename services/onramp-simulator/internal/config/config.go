package config

import (
	"fmt"
	"log"
	"os"
)

// Config holds the application configuration
type Config struct {
	Port    string
	BaseURL string // Base URL for callbacks

	// Webhook settings
	WebhookURL    string
	WebhookSecret string

	// External service URLs
	PGSimulatorURL   string
	BankSimulatorURL string

	// Simulation settings
	ProcessingTime int // Simulated processing time in seconds
	SuccessRate    int // Percentage of successful transactions (0-100)

	// KYC simulation settings
	KYCProcessingTime int // KYC processing time in seconds
	KYCSuccessRate    int // KYC approval success rate (0-100)

	// Transfer simulation settings
	TransferProcessingTime int // Crypto transfer processing time in seconds
	TransferSuccessRate    int // Crypto transfer success rate (0-100)
	RefundProcessingTime   int // Refund processing time in seconds

	// Exchange rate (simulated)
	USDToUSDC string // Exchange rate USD to USDC (e.g., "0.998")
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	port := getEnv("PORT", "4352")
	cfg := &Config{
		Port:                   port,
		BaseURL:                getEnv("BASE_URL", "http://localhost:"+port),
		WebhookURL:             getEnv("WEBHOOK_URL", ""),
		WebhookSecret:          getEnvWithWarning("WEBHOOK_SECRET", "onramp-webhook-secret-dev"),
		PGSimulatorURL:         getEnv("PG_SIMULATOR_URL", "http://localhost:4351"),
		BankSimulatorURL:       getEnv("BANK_SIMULATOR_URL", "http://localhost:4350"),
		ProcessingTime:         getEnvInt("PROCESSING_TIME", 5),
		SuccessRate:            getEnvInt("SUCCESS_RATE", 95),
		KYCProcessingTime:      getEnvInt("KYC_PROCESSING_TIME", 5),
		KYCSuccessRate:         getEnvInt("KYC_SUCCESS_RATE", 90),
		TransferProcessingTime: getEnvInt("TRANSFER_PROCESSING_TIME", 3),
		TransferSuccessRate:    getEnvInt("TRANSFER_SUCCESS_RATE", 95),
		RefundProcessingTime:   getEnvInt("REFUND_PROCESSING_TIME", 5),
		USDToUSDC:              getEnv("USD_TO_USDC", "0.998"),
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
		if c.WebhookSecret == "onramp-webhook-secret-dev" {
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
