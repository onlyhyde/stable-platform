package service

import (
	"testing"
)

func TestNewRateManager(t *testing.T) {
	rm := NewRateManager()

	if rm == nil {
		t.Fatal("NewRateManager() returned nil")
	}

	// Verify initialized data
	if len(rm.assets) == 0 {
		t.Error("assets should not be empty")
	}
	if len(rm.chains) == 0 {
		t.Error("chains should not be empty")
	}
	if len(rm.fiats) == 0 {
		t.Error("fiats should not be empty")
	}
	if len(rm.pairs) == 0 {
		t.Error("pairs should not be empty")
	}
	if len(rm.rates) == 0 {
		t.Error("rates should not be empty")
	}
	if len(rm.fees) == 0 {
		t.Error("fees should not be empty")
	}
}

func TestGetRate(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name         string
		fiatCode     string
		cryptoSymbol string
		wantErr      bool
	}{
		{"USD/USDC", "USD", "USDC", false},
		{"USD/USDT", "USD", "USDT", false},
		{"USD/ETH", "USD", "ETH", false},
		{"KRW/USDC", "KRW", "USDC", false},
		{"EUR/USDC", "EUR", "USDC", false},
		{"JPY/USDC", "JPY", "USDC", false},
		{"Invalid pair", "XXX", "YYY", true},
		{"Unsupported fiat", "GBP", "USDC", true},
		{"Unsupported crypto", "USD", "BTC", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rate, err := rm.GetRate(tt.fiatCode, tt.cryptoSymbol)

			if tt.wantErr {
				if err == nil {
					t.Errorf("GetRate(%s, %s) expected error, got nil", tt.fiatCode, tt.cryptoSymbol)
				}
				return
			}

			if err != nil {
				t.Fatalf("GetRate(%s, %s) unexpected error: %v", tt.fiatCode, tt.cryptoSymbol, err)
			}

			if rate == nil {
				t.Error("rate should not be nil")
			}

			if rate.Sign() <= 0 {
				t.Error("rate should be positive")
			}
		})
	}
}

func TestGetFeePercent(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name         string
		fiatCode     string
		cryptoSymbol string
		wantFee      string
		wantErr      bool
	}{
		{"USD/USDC stablecoin fee", "USD", "USDC", "1.5", false},
		{"USD/ETH non-stablecoin fee", "USD", "ETH", "2.0", false},
		{"KRW/USDT stablecoin fee", "KRW", "USDT", "1.5", false},
		{"Invalid pair", "XXX", "YYY", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fee, err := rm.GetFeePercent(tt.fiatCode, tt.cryptoSymbol)

			if tt.wantErr {
				if err == nil {
					t.Errorf("GetFeePercent(%s, %s) expected error, got nil", tt.fiatCode, tt.cryptoSymbol)
				}
				return
			}

			if err != nil {
				t.Fatalf("GetFeePercent(%s, %s) unexpected error: %v", tt.fiatCode, tt.cryptoSymbol, err)
			}

			if fee != tt.wantFee {
				t.Errorf("GetFeePercent(%s, %s) = %v, want %v", tt.fiatCode, tt.cryptoSymbol, fee, tt.wantFee)
			}
		})
	}
}

func TestGetSupportedAssets(t *testing.T) {
	rm := NewRateManager()
	assets := rm.GetSupportedAssets()

	if len(assets) == 0 {
		t.Error("GetSupportedAssets() should return assets")
	}

	// Check for expected assets
	expectedAssets := map[string]bool{
		"USDC":  false,
		"USDT":  false,
		"ETH":   false,
		"MATIC": false,
	}

	for _, asset := range assets {
		if _, ok := expectedAssets[asset.Symbol]; ok {
			expectedAssets[asset.Symbol] = true
		}
	}

	for symbol, found := range expectedAssets {
		if !found {
			t.Errorf("Expected asset %s not found", symbol)
		}
	}
}

func TestGetSupportedChains(t *testing.T) {
	rm := NewRateManager()
	chains := rm.GetSupportedChains()

	if len(chains) == 0 {
		t.Error("GetSupportedChains() should return chains")
	}

	// Check for expected chains
	expectedChains := map[int]bool{
		1:        false, // Ethereum
		137:      false, // Polygon
		42161:    false, // Arbitrum
		10:       false, // Optimism
		8453:     false, // Base
		11155111: false, // Sepolia
	}

	for _, chain := range chains {
		if _, ok := expectedChains[chain.ChainID]; ok {
			expectedChains[chain.ChainID] = true
		}
	}

	for chainID, found := range expectedChains {
		if !found {
			t.Errorf("Expected chain %d not found", chainID)
		}
	}
}

func TestGetChainByID(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name     string
		chainID  int
		wantNil  bool
		wantName string
	}{
		{"Ethereum Mainnet", 1, false, "Ethereum Mainnet"},
		{"Polygon", 137, false, "Polygon"},
		{"Arbitrum", 42161, false, "Arbitrum One"},
		{"Optimism", 10, false, "OP Mainnet"},
		{"Base", 8453, false, "Base"},
		{"Sepolia", 11155111, false, "Sepolia Testnet"},
		{"Non-existent chain", 99999, true, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chain := rm.GetChainByID(tt.chainID)

			if tt.wantNil {
				if chain != nil {
					t.Errorf("GetChainByID(%d) should return nil", tt.chainID)
				}
				return
			}

			if chain == nil {
				t.Fatalf("GetChainByID(%d) returned nil, want chain", tt.chainID)
			}

			if chain.Name != tt.wantName {
				t.Errorf("GetChainByID(%d).Name = %v, want %v", tt.chainID, chain.Name, tt.wantName)
			}
		})
	}
}

func TestGetSupportedFiats(t *testing.T) {
	rm := NewRateManager()
	fiats := rm.GetSupportedFiats()

	if len(fiats) == 0 {
		t.Error("GetSupportedFiats() should return fiats")
	}

	// Check for expected fiats
	expectedFiats := map[string]bool{
		"USD": false,
		"KRW": false,
		"EUR": false,
		"JPY": false,
	}

	for _, fiat := range fiats {
		if _, ok := expectedFiats[fiat.Code]; ok {
			expectedFiats[fiat.Code] = true
		}
	}

	for code, found := range expectedFiats {
		if !found {
			t.Errorf("Expected fiat %s not found", code)
		}
	}
}

func TestGetTradingPairs(t *testing.T) {
	rm := NewRateManager()
	pairs := rm.GetTradingPairs()

	if len(pairs) == 0 {
		t.Error("GetTradingPairs() should return pairs")
	}

	// Verify all pairs are available
	for _, pair := range pairs {
		if !pair.Available {
			t.Errorf("Trading pair %s/%s should be available", pair.FiatCode, pair.CryptoSymbol)
		}
	}
}

func TestGetAllRates(t *testing.T) {
	rm := NewRateManager()
	rates := rm.GetAllRates()

	if len(rates) == 0 {
		t.Error("GetAllRates() should return rates")
	}

	for _, rate := range rates {
		if rate.FiatCode == "" {
			t.Error("rate.FiatCode should not be empty")
		}
		if rate.CryptoSymbol == "" {
			t.Error("rate.CryptoSymbol should not be empty")
		}
		if rate.Rate == "" {
			t.Error("rate.Rate should not be empty")
		}
		if rate.InverseRate == "" {
			t.Error("rate.InverseRate should not be empty")
		}
		if rate.UpdatedAt == "" {
			t.Error("rate.UpdatedAt should not be empty")
		}
	}
}

func TestGetAllFees(t *testing.T) {
	rm := NewRateManager()
	fees := rm.GetAllFees()

	if len(fees) == 0 {
		t.Error("GetAllFees() should return fees")
	}

	for _, fee := range fees {
		if fee.FiatCode == "" {
			t.Error("fee.FiatCode should not be empty")
		}
		if fee.CryptoSymbol == "" {
			t.Error("fee.CryptoSymbol should not be empty")
		}
		if fee.FeePercent == "" {
			t.Error("fee.FeePercent should not be empty")
		}
	}
}

func TestValidateAssetAndChain(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name         string
		cryptoSymbol string
		chainID      int
		wantErr      bool
	}{
		// Valid combinations
		{"USDC on Ethereum", "USDC", 1, false},
		{"USDC on Polygon", "USDC", 137, false},
		{"USDC on Arbitrum", "USDC", 42161, false},
		{"USDC on Optimism", "USDC", 10, false},
		{"USDC on Base", "USDC", 8453, false},
		{"USDT on Ethereum", "USDT", 1, false},
		{"ETH on Ethereum", "ETH", 1, false},
		{"MATIC on Polygon", "MATIC", 137, false},

		// Invalid combinations
		{"USDC on unsupported chain", "USDC", 56, true},   // BSC not supported
		{"MATIC on Ethereum", "MATIC", 1, true},           // MATIC only on Polygon
		{"ETH on Polygon", "ETH", 137, true},              // ETH not on Polygon
		{"Unknown asset", "BTC", 1, true},                 // BTC not supported
		{"Unknown asset on unknown chain", "BTC", 56, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rm.ValidateAssetAndChain(tt.cryptoSymbol, tt.chainID)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateAssetAndChain(%s, %d) expected error, got nil", tt.cryptoSymbol, tt.chainID)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateAssetAndChain(%s, %d) unexpected error: %v", tt.cryptoSymbol, tt.chainID, err)
				}
			}
		})
	}
}

func TestValidateFiatCurrency(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name     string
		fiatCode string
		wantErr  bool
	}{
		{"USD", "USD", false},
		{"KRW", "KRW", false},
		{"EUR", "EUR", false},
		{"JPY", "JPY", false},
		{"Unsupported GBP", "GBP", true},
		{"Unsupported CNY", "CNY", true},
		{"Empty", "", true},
		{"Invalid", "XXX", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rm.ValidateFiatCurrency(tt.fiatCode)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateFiatCurrency(%s) expected error, got nil", tt.fiatCode)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateFiatCurrency(%s) unexpected error: %v", tt.fiatCode, err)
				}
			}
		})
	}
}

func TestValidateTradingPair(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name         string
		fiatCode     string
		cryptoSymbol string
		wantErr      bool
	}{
		// Valid pairs
		{"USD/USDC", "USD", "USDC", false},
		{"USD/USDT", "USD", "USDT", false},
		{"USD/ETH", "USD", "ETH", false},
		{"KRW/USDC", "KRW", "USDC", false},
		{"EUR/ETH", "EUR", "ETH", false},
		{"JPY/USDT", "JPY", "USDT", false},

		// Invalid pairs
		{"USD/BTC (unsupported crypto)", "USD", "BTC", true},
		{"GBP/USDC (unsupported fiat)", "GBP", "USDC", true},
		{"Empty fiat", "", "USDC", true},
		{"Empty crypto", "USD", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rm.ValidateTradingPair(tt.fiatCode, tt.cryptoSymbol)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateTradingPair(%s, %s) expected error, got nil", tt.fiatCode, tt.cryptoSymbol)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateTradingPair(%s, %s) unexpected error: %v", tt.fiatCode, tt.cryptoSymbol, err)
				}
			}
		})
	}
}

func TestParseRateKey(t *testing.T) {
	tests := []struct {
		name       string
		key        string
		wantFiat   string
		wantCrypto string
	}{
		{"USD/USDC", "USD/USDC", "USD", "USDC"},
		{"KRW/ETH", "KRW/ETH", "KRW", "ETH"},
		{"EUR/USDT", "EUR/USDT", "EUR", "USDT"},
		{"No slash", "USDUSD", "USDUSD", ""},
		{"Empty", "", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fiat, crypto := parseRateKey(tt.key)

			if fiat != tt.wantFiat {
				t.Errorf("parseRateKey(%q) fiat = %v, want %v", tt.key, fiat, tt.wantFiat)
			}

			if crypto != tt.wantCrypto {
				t.Errorf("parseRateKey(%q) crypto = %v, want %v", tt.key, crypto, tt.wantCrypto)
			}
		})
	}
}

func TestMinFeeForFiat(t *testing.T) {
	rm := NewRateManager()

	tests := []struct {
		name    string
		fiat    string
		wantFee string
	}{
		{"USD min fee", "USD", "0.50"},
		{"KRW min fee", "KRW", "500"},
		{"EUR min fee", "EUR", "0.50"},
		{"JPY min fee", "JPY", "100"},
		{"Unknown fiat default", "XXX", "0.50"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fee := rm.minFeeForFiat(tt.fiat)

			if fee != tt.wantFee {
				t.Errorf("minFeeForFiat(%s) = %v, want %v", tt.fiat, fee, tt.wantFee)
			}
		})
	}
}

func TestConcurrentAccess(t *testing.T) {
	rm := NewRateManager()

	// Test concurrent reads (should not panic or deadlock)
	done := make(chan bool)

	for i := 0; i < 10; i++ {
		go func() {
			rm.GetRate("USD", "USDC")
			rm.GetFeePercent("USD", "USDC")
			rm.GetAllRates()
			rm.GetAllFees()
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}
