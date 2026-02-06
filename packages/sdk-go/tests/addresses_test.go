package tests

import (
	"testing"

	"github.com/stablenet/sdk-go/addresses"
	"github.com/stablenet/sdk-go/types"
)

func TestIsChainSupported(t *testing.T) {
	tests := []struct {
		chainID  types.ChainID
		expected bool
	}{
		{types.ChainIDLocal, true},
		{types.ChainIDSepolia, true},
		{types.ChainIDPolygonAmoy, true},
		{types.ChainID(999999), false},
	}

	for _, tt := range tests {
		result := addresses.IsChainSupported(tt.chainID)
		if result != tt.expected {
			t.Errorf("IsChainSupported(%d) = %v, expected %v", tt.chainID, result, tt.expected)
		}
	}
}

func TestGetChainAddresses(t *testing.T) {
	addrs, err := addresses.GetChainAddresses(types.ChainIDLocal)
	if err != nil {
		t.Fatalf("failed to get chain addresses: %v", err)
	}

	if addrs.ChainID != types.ChainIDLocal {
		t.Errorf("expected chain ID %d, got %d", types.ChainIDLocal, addrs.ChainID)
	}
}

func TestGetChainAddressesUnsupported(t *testing.T) {
	_, err := addresses.GetChainAddresses(types.ChainID(999999))
	if err == nil {
		t.Error("expected error for unsupported chain")
	}
}

func TestGetServiceURLs(t *testing.T) {
	urls, err := addresses.GetServiceURLs(types.ChainIDLocal)
	if err != nil {
		t.Fatalf("failed to get service URLs: %v", err)
	}

	if urls.Bundler == "" {
		t.Error("expected bundler URL to be set")
	}
	if urls.Paymaster == "" {
		t.Error("expected paymaster URL to be set")
	}
}

func TestGetDefaultTokens(t *testing.T) {
	tokens := addresses.GetDefaultTokens(types.ChainIDLocal)
	if len(tokens) == 0 {
		t.Error("expected at least one token")
	}

	// Find ETH token
	var foundETH bool
	for _, token := range tokens {
		if token.Symbol == "ETH" {
			foundETH = true
			break
		}
	}
	if !foundETH {
		t.Error("expected to find ETH token")
	}
}

func TestIsZeroAddress(t *testing.T) {
	if !addresses.IsZeroAddress(addresses.ZeroAddress) {
		t.Error("expected ZeroAddress to be zero")
	}

	nonZero, _ := types.AddressFromHex("0x1234567890abcdef1234567890abcdef12345678")
	if addresses.IsZeroAddress(nonZero) {
		t.Error("expected non-zero address not to be zero")
	}
}

func TestSupportedChainIDs(t *testing.T) {
	ids := addresses.SupportedChainIDs()
	if len(ids) == 0 {
		t.Error("expected at least one supported chain")
	}
}
