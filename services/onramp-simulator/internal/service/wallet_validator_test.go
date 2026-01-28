package service

import (
	"strings"
	"testing"
)

func TestValidateEVMAddress(t *testing.T) {
	tests := []struct {
		name         string
		address      string
		wantValid    bool
		wantChecksum string
		wantWarnings bool
	}{
		// Valid addresses
		{
			name:         "Valid lowercase address",
			address:      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
			wantValid:    true,
			wantChecksum: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			wantWarnings: false,
		},
		{
			name:         "Valid uppercase address",
			address:      "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED",
			wantValid:    true,
			wantChecksum: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			wantWarnings: false,
		},
		{
			name:         "Valid checksummed address",
			address:      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			wantValid:    true,
			wantChecksum: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			wantWarnings: false,
		},
		{
			name:         "Valid address with wrong checksum (mixed case)",
			address:      "0x5aAeb6053f3E94C9b9A09F33669435E7eF1BeAed",
			wantValid:    true,
			wantChecksum: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			wantWarnings: true,
		},
		{
			name:         "Zero address",
			address:      "0x0000000000000000000000000000000000000000",
			wantValid:    true,
			wantChecksum: "0x0000000000000000000000000000000000000000",
			wantWarnings: false,
		},
		// Invalid addresses
		{
			name:         "Missing 0x prefix",
			address:      "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Too short",
			address:      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1bea",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Too long",
			address:      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed1",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Invalid hex characters",
			address:      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaeg",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Empty string",
			address:      "",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Only 0x prefix",
			address:      "0x",
			wantValid:    false,
			wantWarnings: false,
		},
		{
			name:         "Random string",
			address:      "not_an_address",
			wantValid:    false,
			wantWarnings: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid, checksumAddr, warnings := ValidateEVMAddress(tt.address)

			if valid != tt.wantValid {
				t.Errorf("ValidateEVMAddress(%q) valid = %v, want %v", tt.address, valid, tt.wantValid)
			}

			if tt.wantValid && checksumAddr != tt.wantChecksum {
				t.Errorf("ValidateEVMAddress(%q) checksum = %v, want %v", tt.address, checksumAddr, tt.wantChecksum)
			}

			hasWarnings := len(warnings) > 0
			if hasWarnings != tt.wantWarnings {
				t.Errorf("ValidateEVMAddress(%q) hasWarnings = %v, want %v", tt.address, hasWarnings, tt.wantWarnings)
			}
		})
	}
}

func TestToChecksumAddress(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
	}{
		{
			name:  "Standard address 1",
			input: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
			want:  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		},
		{
			name:  "Standard address 2",
			input: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
			want:  "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
		},
		{
			name:  "Standard address 3",
			input: "0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb",
			want:  "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
		},
		{
			name:  "Standard address 4",
			input: "0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb",
			want:  "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
		},
		{
			name:  "Already checksummed",
			input: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			want:  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		},
		{
			name:  "All uppercase",
			input: "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED",
			want:  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		},
		{
			name:  "Zero address",
			input: "0x0000000000000000000000000000000000000000",
			want:  "0x0000000000000000000000000000000000000000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToChecksumAddress(tt.input)
			if result != tt.want {
				t.Errorf("ToChecksumAddress(%q) = %v, want %v", tt.input, result, tt.want)
			}
		})
	}
}

func TestHasMixedCase(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{
			name:    "All lowercase",
			address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
			want:    false,
		},
		{
			name:    "All uppercase",
			address: "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED",
			want:    false,
		},
		{
			name:    "Mixed case",
			address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			want:    true,
		},
		{
			name:    "Only numbers (no letters)",
			address: "0x0000000000000000000000000000000000000000",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := hasMixedCase(tt.address)
			if result != tt.want {
				t.Errorf("hasMixedCase(%q) = %v, want %v", tt.address, result, tt.want)
			}
		})
	}
}

func TestEVMAddressRegex(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{"Valid 42 char address", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", true},
		{"Valid with uppercase", "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED", true},
		{"Valid mixed case", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", true},
		{"Missing 0x", "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", false},
		{"Wrong prefix 0X", "0X5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", false},
		{"Too short", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1bea", false},
		{"Too long", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed1", false},
		{"Contains invalid char g", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaeg", false},
		{"Contains invalid char z", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaez", false},
		{"Empty", "", false},
		{"Just 0x", "0x", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := evmAddressRegex.MatchString(tt.address)
			if result != tt.want {
				t.Errorf("evmAddressRegex.MatchString(%q) = %v, want %v", tt.address, result, tt.want)
			}
		})
	}
}

func TestChecksumAddressIdemptotent(t *testing.T) {
	addresses := []string{
		"0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
		"0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
		"0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb",
		"0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb",
	}

	for _, addr := range addresses {
		// Apply checksum twice - should be same result
		first := ToChecksumAddress(addr)
		second := ToChecksumAddress(first)

		if first != second {
			t.Errorf("ToChecksumAddress is not idempotent: first=%v, second=%v", first, second)
		}
	}
}

func TestChecksumAddressCaseInsensitive(t *testing.T) {
	lower := "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"
	upper := "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED"
	mixed := "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"

	lowerResult := ToChecksumAddress(lower)
	upperResult := ToChecksumAddress(upper)
	mixedResult := ToChecksumAddress(mixed)

	if lowerResult != upperResult {
		t.Errorf("Checksum should be same for lower and upper: lower=%v, upper=%v", lowerResult, upperResult)
	}

	if lowerResult != mixedResult {
		t.Errorf("Checksum should be same for lower and mixed: lower=%v, mixed=%v", lowerResult, mixedResult)
	}
}

func TestValidateEVMAddressWarnings(t *testing.T) {
	// Address with incorrect checksum (mixed case but wrong)
	wrongChecksum := "0x5aAeb6053f3e94C9b9a09F33669435E7eF1BeAed"
	valid, checksumAddr, warnings := ValidateEVMAddress(wrongChecksum)

	if !valid {
		t.Error("Address should be valid despite wrong checksum")
	}

	if len(warnings) == 0 {
		t.Error("Should have checksum warning")
	}

	if !strings.Contains(warnings[0], "checksum") {
		t.Errorf("Warning should mention checksum: %v", warnings[0])
	}

	// Correct checksum should have no warnings
	correctChecksum := checksumAddr
	valid2, _, warnings2 := ValidateEVMAddress(correctChecksum)

	if !valid2 {
		t.Error("Correctly checksummed address should be valid")
	}

	if len(warnings2) > 0 {
		t.Errorf("Correctly checksummed address should have no warnings: %v", warnings2)
	}
}
