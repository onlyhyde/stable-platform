package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Ensure relevant env vars are cleared
	t.Setenv("PORT", "")
	t.Setenv("WEBHOOK_URL", "")
	t.Setenv("WEBHOOK_SECRET", "")
	t.Setenv("DEFAULT_BALANCE", "")
	t.Setenv("GIN_MODE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Port != "4350" {
		t.Errorf("Port = %q, want %q", cfg.Port, "4350")
	}
	if cfg.WebhookURL != "" {
		t.Errorf("WebhookURL = %q, want empty", cfg.WebhookURL)
	}
	if cfg.WebhookSecret != "bank-webhook-secret-dev" {
		t.Errorf("WebhookSecret = %q, want %q", cfg.WebhookSecret, "bank-webhook-secret-dev")
	}
	if cfg.DefaultBalance != "10000.00" {
		t.Errorf("DefaultBalance = %q, want %q", cfg.DefaultBalance, "10000.00")
	}
}

func TestLoad_CustomValues(t *testing.T) {
	t.Setenv("PORT", "8080")
	t.Setenv("WEBHOOK_URL", "http://localhost:9999/hook")
	t.Setenv("WEBHOOK_SECRET", "my-custom-secret")
	t.Setenv("DEFAULT_BALANCE", "5000.00")
	t.Setenv("GIN_MODE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want %q", cfg.Port, "8080")
	}
	if cfg.WebhookURL != "http://localhost:9999/hook" {
		t.Errorf("WebhookURL = %q, want %q", cfg.WebhookURL, "http://localhost:9999/hook")
	}
	if cfg.WebhookSecret != "my-custom-secret" {
		t.Errorf("WebhookSecret = %q, want %q", cfg.WebhookSecret, "my-custom-secret")
	}
	if cfg.DefaultBalance != "5000.00" {
		t.Errorf("DefaultBalance = %q, want %q", cfg.DefaultBalance, "5000.00")
	}
}

func TestLoad_PartialEnv(t *testing.T) {
	t.Setenv("PORT", "3000")
	t.Setenv("WEBHOOK_URL", "")
	t.Setenv("WEBHOOK_SECRET", "")
	t.Setenv("DEFAULT_BALANCE", "999.99")
	t.Setenv("GIN_MODE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v, want nil", err)
	}

	if cfg.Port != "3000" {
		t.Errorf("Port = %q, want %q", cfg.Port, "3000")
	}
	if cfg.WebhookSecret != "bank-webhook-secret-dev" {
		t.Errorf("WebhookSecret = %q, want default", cfg.WebhookSecret)
	}
	if cfg.DefaultBalance != "999.99" {
		t.Errorf("DefaultBalance = %q, want %q", cfg.DefaultBalance, "999.99")
	}
}

func TestValidate_DevMode(t *testing.T) {
	t.Setenv("GIN_MODE", "debug")

	cfg := &Config{
		Port:           "4350",
		WebhookSecret:  "bank-webhook-secret-dev",
		DefaultBalance: "10000.00",
	}

	if err := cfg.Validate(); err != nil {
		t.Errorf("Validate() error = %v, want nil in dev mode", err)
	}
}

func TestValidate_ProductionWithDefaultSecret(t *testing.T) {
	t.Setenv("GIN_MODE", "release")

	cfg := &Config{
		Port:           "4350",
		WebhookSecret:  "bank-webhook-secret-dev",
		DefaultBalance: "10000.00",
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("Validate() error = nil, want error for default secret in production")
	}

	want := "WEBHOOK_SECRET must be set in production (GIN_MODE=release)"
	if err.Error() != want {
		t.Errorf("Validate() error = %q, want %q", err.Error(), want)
	}
}

func TestValidate_ProductionWithCustomSecret(t *testing.T) {
	t.Setenv("GIN_MODE", "release")

	cfg := &Config{
		Port:           "4350",
		WebhookSecret:  "my-production-secret",
		DefaultBalance: "10000.00",
	}

	if err := cfg.Validate(); err != nil {
		t.Errorf("Validate() error = %v, want nil for custom secret in production", err)
	}
}

func TestValidate_NoGinMode(t *testing.T) {
	t.Setenv("GIN_MODE", "")

	cfg := &Config{
		Port:           "4350",
		WebhookSecret:  "bank-webhook-secret-dev",
		DefaultBalance: "10000.00",
	}

	if err := cfg.Validate(); err != nil {
		t.Errorf("Validate() error = %v, want nil when GIN_MODE not set", err)
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		envValue     string
		defaultValue string
		want         string
	}{
		{"Returns env value", "TEST_KEY_1", "custom", "default", "custom"},
		{"Returns default when empty", "TEST_KEY_2", "", "fallback", "fallback"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(tt.key, tt.envValue)
			got := getEnv(tt.key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnv(%q, %q) = %q, want %q", tt.key, tt.defaultValue, got, tt.want)
			}
		})
	}
}

func TestGetEnvWithWarning(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		envValue     string
		defaultValue string
		want         string
	}{
		{"Returns env value", "TEST_WARN_1", "set-value", "default", "set-value"},
		{"Returns default with warning", "TEST_WARN_2", "", "warn-default", "warn-default"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(tt.key, tt.envValue)
			got := getEnvWithWarning(tt.key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvWithWarning(%q, %q) = %q, want %q", tt.key, tt.defaultValue, got, tt.want)
			}
		})
	}
}

func TestLoad_ProductionRejectsDefaults(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("WEBHOOK_URL", "")
	t.Setenv("WEBHOOK_SECRET", "")
	t.Setenv("DEFAULT_BALANCE", "")
	t.Setenv("GIN_MODE", "release")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want error in production with default secret")
	}

	// Verify Load does not swallow the validation error
	if !contains(err.Error(), "WEBHOOK_SECRET") {
		t.Errorf("Load() error = %q, want mention of WEBHOOK_SECRET", err.Error())
	}
}

// contains is a simple substring check for test assertions
func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstr(s, substr)
}

func searchSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestGetEnv_UnsetVariable(t *testing.T) {
	// Ensure the variable does not exist
	os.Unsetenv("TOTALLY_UNSET_VAR")

	got := getEnv("TOTALLY_UNSET_VAR", "my-default")
	if got != "my-default" {
		t.Errorf("getEnv() = %q, want %q for unset variable", got, "my-default")
	}
}
