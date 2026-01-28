package service

import (
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

// RateManager manages exchange rates and supported assets/networks
type RateManager struct {
	assets       []model.SupportedAsset
	chains       []model.SupportedChain
	fiats        []model.SupportedFiat
	pairs        []model.TradingPair
	rates        map[string]*big.Float // "USD/USDC" -> rate
	fees         map[string]model.FeeStructure // "USD/USDC" -> fee structure
	mu           sync.RWMutex
	lastUpdated  time.Time
}

// NewRateManager creates a new rate manager with default data
func NewRateManager() *RateManager {
	rm := &RateManager{
		rates: make(map[string]*big.Float),
		fees:  make(map[string]model.FeeStructure),
	}
	rm.initSupportedData()
	rm.initRates()
	rm.initFees()
	return rm
}

// initSupportedData initializes the supported assets, chains, fiats, and pairs
func (rm *RateManager) initSupportedData() {
	rm.assets = []model.SupportedAsset{
		{
			Symbol:   "USDC",
			Name:     "USD Coin",
			Decimals: 6,
			IsNative: false,
			ChainIDs: []int{1, 137, 42161, 10, 8453, 11155111},
			MinAmount: "1.00",
			MaxAmount: "100000.00",
		},
		{
			Symbol:   "USDT",
			Name:     "Tether USD",
			Decimals: 6,
			IsNative: false,
			ChainIDs: []int{1, 137, 42161, 10},
			MinAmount: "1.00",
			MaxAmount: "100000.00",
		},
		{
			Symbol:   "ETH",
			Name:     "Ethereum",
			Decimals: 18,
			IsNative: true,
			ChainIDs: []int{1, 11155111},
			MinAmount: "0.001",
			MaxAmount: "50.00",
		},
		{
			Symbol:   "MATIC",
			Name:     "Polygon",
			Decimals: 18,
			IsNative: true,
			ChainIDs: []int{137},
			MinAmount: "1.00",
			MaxAmount: "100000.00",
		},
	}

	rm.chains = []model.SupportedChain{
		{
			ChainID:   1,
			Name:      "Ethereum Mainnet",
			ShortName: "ethereum",
			NativeCurrency: model.NativeCurrency{Name: "Ether", Symbol: "ETH", Decimals: 18},
			ExplorerURL: "https://etherscan.io",
			IsTestnet:   false,
			Assets:      []string{"USDC", "USDT", "ETH"},
		},
		{
			ChainID:   137,
			Name:      "Polygon",
			ShortName: "polygon",
			NativeCurrency: model.NativeCurrency{Name: "MATIC", Symbol: "MATIC", Decimals: 18},
			ExplorerURL: "https://polygonscan.com",
			IsTestnet:   false,
			Assets:      []string{"USDC", "USDT", "MATIC"},
		},
		{
			ChainID:   42161,
			Name:      "Arbitrum One",
			ShortName: "arbitrum",
			NativeCurrency: model.NativeCurrency{Name: "Ether", Symbol: "ETH", Decimals: 18},
			ExplorerURL: "https://arbiscan.io",
			IsTestnet:   false,
			Assets:      []string{"USDC", "USDT"},
		},
		{
			ChainID:   10,
			Name:      "OP Mainnet",
			ShortName: "optimism",
			NativeCurrency: model.NativeCurrency{Name: "Ether", Symbol: "ETH", Decimals: 18},
			ExplorerURL: "https://optimistic.etherscan.io",
			IsTestnet:   false,
			Assets:      []string{"USDC", "USDT"},
		},
		{
			ChainID:   8453,
			Name:      "Base",
			ShortName: "base",
			NativeCurrency: model.NativeCurrency{Name: "Ether", Symbol: "ETH", Decimals: 18},
			ExplorerURL: "https://basescan.org",
			IsTestnet:   false,
			Assets:      []string{"USDC"},
		},
		{
			ChainID:   11155111,
			Name:      "Sepolia Testnet",
			ShortName: "sepolia",
			NativeCurrency: model.NativeCurrency{Name: "Sepolia ETH", Symbol: "ETH", Decimals: 18},
			ExplorerURL: "https://sepolia.etherscan.io",
			IsTestnet:   true,
			Assets:      []string{"USDC", "ETH"},
		},
	}

	rm.fiats = []model.SupportedFiat{
		{Code: "USD", Name: "US Dollar", Symbol: "$", MinOrder: "10.00", MaxOrder: "50000.00"},
		{Code: "KRW", Name: "Korean Won", Symbol: "₩", MinOrder: "10000", MaxOrder: "50000000"},
		{Code: "EUR", Name: "Euro", Symbol: "€", MinOrder: "10.00", MaxOrder: "50000.00"},
		{Code: "JPY", Name: "Japanese Yen", Symbol: "¥", MinOrder: "1000", MaxOrder: "5000000"},
	}

	rm.pairs = []model.TradingPair{
		// USD pairs
		{FiatCode: "USD", CryptoSymbol: "USDC", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "1.5", Available: true},
		{FiatCode: "USD", CryptoSymbol: "USDT", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "1.5", Available: true},
		{FiatCode: "USD", CryptoSymbol: "ETH", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "2.0", Available: true},
		{FiatCode: "USD", CryptoSymbol: "MATIC", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "2.0", Available: true},
		// KRW pairs
		{FiatCode: "KRW", CryptoSymbol: "USDC", MinFiatAmount: "10000", MaxFiatAmount: "50000000", FeePercent: "1.5", Available: true},
		{FiatCode: "KRW", CryptoSymbol: "USDT", MinFiatAmount: "10000", MaxFiatAmount: "50000000", FeePercent: "1.5", Available: true},
		{FiatCode: "KRW", CryptoSymbol: "ETH", MinFiatAmount: "10000", MaxFiatAmount: "50000000", FeePercent: "2.0", Available: true},
		{FiatCode: "KRW", CryptoSymbol: "MATIC", MinFiatAmount: "10000", MaxFiatAmount: "50000000", FeePercent: "2.0", Available: true},
		// EUR pairs
		{FiatCode: "EUR", CryptoSymbol: "USDC", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "1.5", Available: true},
		{FiatCode: "EUR", CryptoSymbol: "USDT", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "1.5", Available: true},
		{FiatCode: "EUR", CryptoSymbol: "ETH", MinFiatAmount: "10.00", MaxFiatAmount: "50000.00", FeePercent: "2.0", Available: true},
		// JPY pairs
		{FiatCode: "JPY", CryptoSymbol: "USDC", MinFiatAmount: "1000", MaxFiatAmount: "5000000", FeePercent: "1.5", Available: true},
		{FiatCode: "JPY", CryptoSymbol: "USDT", MinFiatAmount: "1000", MaxFiatAmount: "5000000", FeePercent: "1.5", Available: true},
		{FiatCode: "JPY", CryptoSymbol: "ETH", MinFiatAmount: "1000", MaxFiatAmount: "5000000", FeePercent: "2.0", Available: true},
	}
}

// initRates initializes exchange rates
func (rm *RateManager) initRates() {
	rm.lastUpdated = time.Now()

	// Stablecoin rates (close to 1:1 for USD-pegged)
	rm.rates["USD/USDC"], _ = new(big.Float).SetString("0.998")
	rm.rates["USD/USDT"], _ = new(big.Float).SetString("0.999")
	rm.rates["USD/ETH"], _ = new(big.Float).SetString("0.000303") // ~$3300/ETH
	rm.rates["USD/MATIC"], _ = new(big.Float).SetString("2.5")     // ~$0.40/MATIC

	// KRW rates
	rm.rates["KRW/USDC"], _ = new(big.Float).SetString("0.000714") // ~1400 KRW/USD
	rm.rates["KRW/USDT"], _ = new(big.Float).SetString("0.000715")
	rm.rates["KRW/ETH"], _ = new(big.Float).SetString("0.000000216") // ~1400 * 3300
	rm.rates["KRW/MATIC"], _ = new(big.Float).SetString("0.00179")

	// EUR rates
	rm.rates["EUR/USDC"], _ = new(big.Float).SetString("1.08")  // EUR stronger than USD
	rm.rates["EUR/USDT"], _ = new(big.Float).SetString("1.081")
	rm.rates["EUR/ETH"], _ = new(big.Float).SetString("0.000327") // EUR/ETH

	// JPY rates
	rm.rates["JPY/USDC"], _ = new(big.Float).SetString("0.00667") // ~150 JPY/USD
	rm.rates["JPY/USDT"], _ = new(big.Float).SetString("0.00668")
	rm.rates["JPY/ETH"], _ = new(big.Float).SetString("0.00000202")
}

// initFees initializes fee structures
func (rm *RateManager) initFees() {
	// Stablecoin pairs (lower fee)
	for _, fiat := range []string{"USD", "KRW", "EUR", "JPY"} {
		for _, crypto := range []string{"USDC", "USDT"} {
			key := fiat + "/" + crypto
			rm.fees[key] = model.FeeStructure{
				FiatCode:     fiat,
				CryptoSymbol: crypto,
				FeePercent:   "1.5",
				MinFee:       rm.minFeeForFiat(fiat),
			}
		}
	}

	// Non-stablecoin pairs (higher fee)
	for _, fiat := range []string{"USD", "KRW", "EUR", "JPY"} {
		for _, crypto := range []string{"ETH", "MATIC"} {
			key := fiat + "/" + crypto
			rm.fees[key] = model.FeeStructure{
				FiatCode:     fiat,
				CryptoSymbol: crypto,
				FeePercent:   "2.0",
				MinFee:       rm.minFeeForFiat(fiat),
			}
		}
	}
}

func (rm *RateManager) minFeeForFiat(fiat string) string {
	switch fiat {
	case "USD":
		return "0.50"
	case "KRW":
		return "500"
	case "EUR":
		return "0.50"
	case "JPY":
		return "100"
	default:
		return "0.50"
	}
}

// GetRate returns the exchange rate for a fiat/crypto pair
func (rm *RateManager) GetRate(fiatCode, cryptoSymbol string) (*big.Float, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	key := fiatCode + "/" + cryptoSymbol
	rate, exists := rm.rates[key]
	if !exists {
		return nil, fmt.Errorf("unsupported trading pair: %s/%s", fiatCode, cryptoSymbol)
	}
	return new(big.Float).Copy(rate), nil
}

// GetFeePercent returns the fee percentage for a fiat/crypto pair
func (rm *RateManager) GetFeePercent(fiatCode, cryptoSymbol string) (string, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	key := fiatCode + "/" + cryptoSymbol
	fee, exists := rm.fees[key]
	if !exists {
		return "", fmt.Errorf("unsupported trading pair: %s/%s", fiatCode, cryptoSymbol)
	}
	return fee.FeePercent, nil
}

// GetSupportedAssets returns all supported assets
func (rm *RateManager) GetSupportedAssets() []model.SupportedAsset {
	return rm.assets
}

// GetSupportedChains returns all supported chains
func (rm *RateManager) GetSupportedChains() []model.SupportedChain {
	return rm.chains
}

// GetChainByID returns a chain by its ID, or nil if not found
func (rm *RateManager) GetChainByID(chainID int) *model.SupportedChain {
	for i := range rm.chains {
		if rm.chains[i].ChainID == chainID {
			return &rm.chains[i]
		}
	}
	return nil
}

// GetSupportedFiats returns all supported fiat currencies
func (rm *RateManager) GetSupportedFiats() []model.SupportedFiat {
	return rm.fiats
}

// GetTradingPairs returns all trading pairs
func (rm *RateManager) GetTradingPairs() []model.TradingPair {
	return rm.pairs
}

// GetAllRates returns all exchange rates
func (rm *RateManager) GetAllRates() []model.ExchangeRate {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	updatedAt := rm.lastUpdated.Format(time.RFC3339)
	var rates []model.ExchangeRate

	for key, rate := range rm.rates {
		fiat, crypto := parseRateKey(key)
		inverseRate := new(big.Float).Quo(big.NewFloat(1), rate)

		rates = append(rates, model.ExchangeRate{
			FiatCode:     fiat,
			CryptoSymbol: crypto,
			Rate:         rate.Text('f', 8),
			InverseRate:  inverseRate.Text('f', 2),
			UpdatedAt:    updatedAt,
		})
	}

	return rates
}

// GetAllFees returns all fee structures
func (rm *RateManager) GetAllFees() []model.FeeStructure {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	fees := make([]model.FeeStructure, 0, len(rm.fees))
	for _, fee := range rm.fees {
		fees = append(fees, fee)
	}
	return fees
}

// ValidateAssetAndChain validates that the crypto asset is supported on the given chain
func (rm *RateManager) ValidateAssetAndChain(cryptoSymbol string, chainID int) error {
	// Check asset exists
	var found bool
	for _, asset := range rm.assets {
		if asset.Symbol == cryptoSymbol {
			found = true
			// Check chain support
			for _, cid := range asset.ChainIDs {
				if cid == chainID {
					return nil
				}
			}
			return fmt.Errorf("asset %s is not supported on chain %d", cryptoSymbol, chainID)
		}
	}
	if !found {
		return fmt.Errorf("unsupported asset: %s", cryptoSymbol)
	}
	return fmt.Errorf("asset %s is not supported on chain %d", cryptoSymbol, chainID)
}

// ValidateFiatCurrency validates that the fiat currency is supported
func (rm *RateManager) ValidateFiatCurrency(fiatCode string) error {
	for _, fiat := range rm.fiats {
		if fiat.Code == fiatCode {
			return nil
		}
	}
	return fmt.Errorf("unsupported fiat currency: %s", fiatCode)
}

// ValidateTradingPair validates that the fiat/crypto pair is supported
func (rm *RateManager) ValidateTradingPair(fiatCode, cryptoSymbol string) error {
	for _, pair := range rm.pairs {
		if pair.FiatCode == fiatCode && pair.CryptoSymbol == cryptoSymbol {
			if !pair.Available {
				return fmt.Errorf("trading pair %s/%s is currently unavailable", fiatCode, cryptoSymbol)
			}
			return nil
		}
	}
	return fmt.Errorf("unsupported trading pair: %s/%s", fiatCode, cryptoSymbol)
}

// parseRateKey parses "FIAT/CRYPTO" into fiat and crypto parts
func parseRateKey(key string) (string, string) {
	for i, c := range key {
		if c == '/' {
			return key[:i], key[i+1:]
		}
	}
	return key, ""
}
