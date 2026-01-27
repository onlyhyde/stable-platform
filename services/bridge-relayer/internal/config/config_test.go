package config

import (
	"os"
	"testing"
	"time"
)

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: &Config{
				Ethereum: EthereumConfig{
					SourceRPCURL: "http://localhost:8545",
					TargetRPCURL: "http://localhost:8546",
				},
				MPC: MPCConfig{
					Threshold:    5,
					TotalSigners: 7,
				},
			},
			wantErr: false,
		},
		{
			name: "missing source RPC URL",
			config: &Config{
				Ethereum: EthereumConfig{
					SourceRPCURL: "",
					TargetRPCURL: "http://localhost:8546",
				},
				MPC: MPCConfig{
					Threshold:    5,
					TotalSigners: 7,
				},
			},
			wantErr: true,
		},
		{
			name: "missing target RPC URL",
			config: &Config{
				Ethereum: EthereumConfig{
					SourceRPCURL: "http://localhost:8545",
					TargetRPCURL: "",
				},
				MPC: MPCConfig{
					Threshold:    5,
					TotalSigners: 7,
				},
			},
			wantErr: true,
		},
		{
			name: "threshold greater than total signers",
			config: &Config{
				Ethereum: EthereumConfig{
					SourceRPCURL: "http://localhost:8545",
					TargetRPCURL: "http://localhost:8546",
				},
				MPC: MPCConfig{
					Threshold:    8,
					TotalSigners: 7,
				},
			},
			wantErr: true,
		},
		{
			name: "threshold less than 1",
			config: &Config{
				Ethereum: EthereumConfig{
					SourceRPCURL: "http://localhost:8545",
					TargetRPCURL: "http://localhost:8546",
				},
				MPC: MPCConfig{
					Threshold:    0,
					TotalSigners: 7,
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	// Set test environment variable
	os.Setenv("TEST_ENV_VAR", "test_value")
	defer os.Unsetenv("TEST_ENV_VAR")

	// Test with existing env var
	if got := getEnv("TEST_ENV_VAR", "default"); got != "test_value" {
		t.Errorf("getEnv() = %s, want test_value", got)
	}

	// Test with non-existing env var
	if got := getEnv("NON_EXISTING_VAR", "default"); got != "default" {
		t.Errorf("getEnv() = %s, want default", got)
	}
}

func TestGetIntEnv(t *testing.T) {
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")

	// Test with valid int
	if got := getIntEnv("TEST_INT", 0); got != 42 {
		t.Errorf("getIntEnv() = %d, want 42", got)
	}

	// Test with non-existing
	if got := getIntEnv("NON_EXISTING", 10); got != 10 {
		t.Errorf("getIntEnv() = %d, want 10", got)
	}

	// Test with invalid int
	os.Setenv("TEST_INVALID_INT", "not_a_number")
	defer os.Unsetenv("TEST_INVALID_INT")
	if got := getIntEnv("TEST_INVALID_INT", 5); got != 5 {
		t.Errorf("getIntEnv() = %d, want 5 (default)", got)
	}
}

func TestGetUint64Env(t *testing.T) {
	os.Setenv("TEST_UINT64", "1234567890")
	defer os.Unsetenv("TEST_UINT64")

	// Test with valid uint64
	if got := getUint64Env("TEST_UINT64", 0); got != 1234567890 {
		t.Errorf("getUint64Env() = %d, want 1234567890", got)
	}

	// Test with non-existing
	if got := getUint64Env("NON_EXISTING", 100); got != 100 {
		t.Errorf("getUint64Env() = %d, want 100", got)
	}

	// Test with invalid uint64
	os.Setenv("TEST_INVALID_UINT", "-1")
	defer os.Unsetenv("TEST_INVALID_UINT")
	if got := getUint64Env("TEST_INVALID_UINT", 50); got != 50 {
		t.Errorf("getUint64Env() = %d, want 50 (default)", got)
	}
}

func TestGetFloat64Env(t *testing.T) {
	os.Setenv("TEST_FLOAT", "3.14")
	defer os.Unsetenv("TEST_FLOAT")

	// Test with valid float
	if got := getFloat64Env("TEST_FLOAT", 0.0); got != 3.14 {
		t.Errorf("getFloat64Env() = %f, want 3.14", got)
	}

	// Test with non-existing
	if got := getFloat64Env("NON_EXISTING", 1.5); got != 1.5 {
		t.Errorf("getFloat64Env() = %f, want 1.5", got)
	}

	// Test with invalid float
	os.Setenv("TEST_INVALID_FLOAT", "not_a_float")
	defer os.Unsetenv("TEST_INVALID_FLOAT")
	if got := getFloat64Env("TEST_INVALID_FLOAT", 2.5); got != 2.5 {
		t.Errorf("getFloat64Env() = %f, want 2.5 (default)", got)
	}
}

func TestGetDurationEnv(t *testing.T) {
	os.Setenv("TEST_DURATION", "5s")
	defer os.Unsetenv("TEST_DURATION")

	// Test with valid duration
	if got := getDurationEnv("TEST_DURATION", time.Second); got != 5*time.Second {
		t.Errorf("getDurationEnv() = %v, want 5s", got)
	}

	// Test with non-existing
	if got := getDurationEnv("NON_EXISTING", 10*time.Second); got != 10*time.Second {
		t.Errorf("getDurationEnv() = %v, want 10s", got)
	}

	// Test with invalid duration
	os.Setenv("TEST_INVALID_DURATION", "not_a_duration")
	defer os.Unsetenv("TEST_INVALID_DURATION")
	if got := getDurationEnv("TEST_INVALID_DURATION", 30*time.Second); got != 30*time.Second {
		t.Errorf("getDurationEnv() = %v, want 30s (default)", got)
	}

	// Test with minutes
	os.Setenv("TEST_DURATION_MIN", "5m")
	defer os.Unsetenv("TEST_DURATION_MIN")
	if got := getDurationEnv("TEST_DURATION_MIN", time.Minute); got != 5*time.Minute {
		t.Errorf("getDurationEnv() = %v, want 5m", got)
	}
}

func TestGetSliceEnv(t *testing.T) {
	os.Setenv("TEST_SLICE", "a,b,c")
	defer os.Unsetenv("TEST_SLICE")

	// Test with valid slice
	got := getSliceEnv("TEST_SLICE", []string{})
	if len(got) != 3 || got[0] != "a" || got[1] != "b" || got[2] != "c" {
		t.Errorf("getSliceEnv() = %v, want [a, b, c]", got)
	}

	// Test with non-existing
	got = getSliceEnv("NON_EXISTING", []string{"default"})
	if len(got) != 1 || got[0] != "default" {
		t.Errorf("getSliceEnv() = %v, want [default]", got)
	}

	// Test with single element
	os.Setenv("TEST_SLICE_SINGLE", "single")
	defer os.Unsetenv("TEST_SLICE_SINGLE")
	got = getSliceEnv("TEST_SLICE_SINGLE", []string{})
	if len(got) != 1 || got[0] != "single" {
		t.Errorf("getSliceEnv() = %v, want [single]", got)
	}
}

func TestLoad_WithDefaults(t *testing.T) {
	// Clear any existing environment variables
	os.Unsetenv("SOURCE_RPC_URL")
	os.Unsetenv("TARGET_RPC_URL")

	// Set minimum required environment variables
	os.Setenv("SOURCE_RPC_URL", "http://test-source:8545")
	os.Setenv("TARGET_RPC_URL", "http://test-target:8546")
	defer func() {
		os.Unsetenv("SOURCE_RPC_URL")
		os.Unsetenv("TARGET_RPC_URL")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	// Check defaults
	if cfg.Server.Port != "8080" {
		t.Errorf("default Port = %s, want 8080", cfg.Server.Port)
	}
	if cfg.Server.ReadTimeout != 30*time.Second {
		t.Errorf("default ReadTimeout = %v, want 30s", cfg.Server.ReadTimeout)
	}
	if cfg.MPC.Threshold != 5 {
		t.Errorf("default MPC.Threshold = %d, want 5", cfg.MPC.Threshold)
	}
	if cfg.MPC.TotalSigners != 7 {
		t.Errorf("default MPC.TotalSigners = %d, want 7", cfg.MPC.TotalSigners)
	}
	if cfg.Ethereum.ConfirmBlocks != 12 {
		t.Errorf("default Ethereum.ConfirmBlocks = %d, want 12", cfg.Ethereum.ConfirmBlocks)
	}
}

func TestLoad_WithCustomValues(t *testing.T) {
	// Set custom environment variables
	envVars := map[string]string{
		"PORT":                        "9090",
		"SOURCE_RPC_URL":              "http://custom-source:8545",
		"TARGET_RPC_URL":              "http://custom-target:8546",
		"SOURCE_CHAIN_ID":             "5",
		"TARGET_CHAIN_ID":             "80001",
		"MPC_THRESHOLD":               "3",
		"MPC_TOTAL_SIGNERS":           "5",
		"MONITOR_POLL_INTERVAL":       "10s",
		"RATE_LIMIT_RPS":              "20.0",
		"RATE_LIMIT_BURST":            "50",
	}

	for k, v := range envVars {
		os.Setenv(k, v)
	}
	defer func() {
		for k := range envVars {
			os.Unsetenv(k)
		}
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != "9090" {
		t.Errorf("Port = %s, want 9090", cfg.Server.Port)
	}
	if cfg.Ethereum.SourceChainID != 5 {
		t.Errorf("SourceChainID = %d, want 5", cfg.Ethereum.SourceChainID)
	}
	if cfg.Ethereum.TargetChainID != 80001 {
		t.Errorf("TargetChainID = %d, want 80001", cfg.Ethereum.TargetChainID)
	}
	if cfg.MPC.Threshold != 3 {
		t.Errorf("MPC.Threshold = %d, want 3", cfg.MPC.Threshold)
	}
	if cfg.MPC.TotalSigners != 5 {
		t.Errorf("MPC.TotalSigners = %d, want 5", cfg.MPC.TotalSigners)
	}
	if cfg.Monitor.PollInterval != 10*time.Second {
		t.Errorf("Monitor.PollInterval = %v, want 10s", cfg.Monitor.PollInterval)
	}
	if cfg.RateLimit.RequestsPerSecond != 20.0 {
		t.Errorf("RateLimit.RequestsPerSecond = %f, want 20.0", cfg.RateLimit.RequestsPerSecond)
	}
	if cfg.RateLimit.Burst != 50 {
		t.Errorf("RateLimit.Burst = %d, want 50", cfg.RateLimit.Burst)
	}
}

func TestServerConfig_Fields(t *testing.T) {
	cfg := ServerConfig{
		Port:         "8080",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		Mode:         "release",
	}

	if cfg.Mode != "release" {
		t.Errorf("Mode = %s, want release", cfg.Mode)
	}
	if cfg.ReadTimeout != cfg.WriteTimeout {
		t.Error("expected ReadTimeout == WriteTimeout")
	}
}

func TestEthereumConfig_Fields(t *testing.T) {
	cfg := EthereumConfig{
		SourceRPCURL:   "http://localhost:8545",
		TargetRPCURL:   "http://localhost:8546",
		SourceChainID:  1,
		TargetChainID:  137,
		PrivateKey:     "0x123",
		GasLimitBuffer: 50000,
		MaxGasPrice:    500,
		ConfirmBlocks:  12,
	}

	if cfg.SourceChainID != 1 {
		t.Errorf("SourceChainID = %d, want 1", cfg.SourceChainID)
	}
	if cfg.TargetChainID != 137 {
		t.Errorf("TargetChainID = %d, want 137", cfg.TargetChainID)
	}
}

func TestMPCConfig_Fields(t *testing.T) {
	cfg := MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080"},
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         30 * time.Second,
	}

	if len(cfg.SignerEndpoints) != 2 {
		t.Errorf("expected 2 signer endpoints, got %d", len(cfg.SignerEndpoints))
	}
	if cfg.Threshold != 2 {
		t.Errorf("Threshold = %d, want 2", cfg.Threshold)
	}
}

func TestContractConfig_Fields(t *testing.T) {
	cfg := ContractConfig{
		SecureBridge:       "0x1111111111111111111111111111111111111111",
		BridgeValidator:    "0x2222222222222222222222222222222222222222",
		BridgeRateLimiter:  "0x3333333333333333333333333333333333333333",
		OptimisticVerifier: "0x4444444444444444444444444444444444444444",
		FraudProofVerifier: "0x5555555555555555555555555555555555555555",
		BridgeGuardian:     "0x6666666666666666666666666666666666666666",
	}

	if cfg.SecureBridge == "" {
		t.Error("SecureBridge should not be empty")
	}
	if cfg.FraudProofVerifier == "" {
		t.Error("FraudProofVerifier should not be empty")
	}
}

func TestMonitorConfig_Fields(t *testing.T) {
	cfg := MonitorConfig{
		PollInterval:       5 * time.Second,
		BlockConfirmations: 12,
		MaxBlockRange:      1000,
		RetryAttempts:      3,
		RetryDelay:         5 * time.Second,
	}

	if cfg.BlockConfirmations != 12 {
		t.Errorf("BlockConfirmations = %d, want 12", cfg.BlockConfirmations)
	}
	if cfg.MaxBlockRange != 1000 {
		t.Errorf("MaxBlockRange = %d, want 1000", cfg.MaxBlockRange)
	}
}

func TestRateLimitConfig_Fields(t *testing.T) {
	cfg := RateLimitConfig{
		RequestsPerSecond: 10.0,
		Burst:             20,
	}

	if cfg.RequestsPerSecond != 10.0 {
		t.Errorf("RequestsPerSecond = %f, want 10.0", cfg.RequestsPerSecond)
	}
	if cfg.Burst != 20 {
		t.Errorf("Burst = %d, want 20", cfg.Burst)
	}
}
