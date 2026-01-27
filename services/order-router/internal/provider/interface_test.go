package provider

import (
	"context"
	"math/big"
	"testing"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// MockDEXProvider is a mock implementation of DEXProvider interface
type MockDEXProvider struct {
	name          string
	isV3          bool
	supportedFees []int
	pools         []model.Pool
	poolsErr      error
	quote         *model.Route
	quoteErr      error
	gasEstimate   uint64
}

func (m *MockDEXProvider) Name() string {
	return m.name
}

func (m *MockDEXProvider) GetPools(ctx context.Context, tokenIn, tokenOut string) ([]model.Pool, error) {
	if m.poolsErr != nil {
		return nil, m.poolsErr
	}
	return m.pools, nil
}

func (m *MockDEXProvider) GetQuote(ctx context.Context, tokenIn, tokenOut string, amountIn *big.Int) (*model.Route, error) {
	if m.quoteErr != nil {
		return nil, m.quoteErr
	}
	return m.quote, nil
}

func (m *MockDEXProvider) GetQuoteExactOut(ctx context.Context, tokenIn, tokenOut string, amountOut *big.Int) (*model.Route, error) {
	if m.quoteErr != nil {
		return nil, m.quoteErr
	}
	return m.quote, nil
}

func (m *MockDEXProvider) BuildSwapCalldata(ctx context.Context, route *model.Route, recipient string, deadline int64, slippage float64) (string, string, string, error) {
	return "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "0x38ed1739", "0", nil
}

func (m *MockDEXProvider) EstimateGas(ctx context.Context, route *model.Route) (uint64, error) {
	return m.gasEstimate, nil
}

func (m *MockDEXProvider) SupportedFees() []int {
	return m.supportedFees
}

func (m *MockDEXProvider) IsV3Style() bool {
	return m.isV3
}

func TestNewProviderRegistry(t *testing.T) {
	registry := NewProviderRegistry()
	if registry == nil {
		t.Fatal("expected registry to be created")
	}
	if registry.providers == nil {
		t.Fatal("expected providers map to be initialized")
	}
}

func TestProviderRegistry_Register(t *testing.T) {
	registry := NewProviderRegistry()

	mock := &MockDEXProvider{name: "uniswap_v3"}
	registry.Register(mock)

	provider, ok := registry.Get("uniswap_v3")
	if !ok {
		t.Fatal("expected provider to be registered")
	}
	if provider.Name() != "uniswap_v3" {
		t.Errorf("expected name 'uniswap_v3', got %s", provider.Name())
	}
}

func TestProviderRegistry_Get(t *testing.T) {
	registry := NewProviderRegistry()

	// Test get non-existent
	_, ok := registry.Get("nonexistent")
	if ok {
		t.Fatal("expected provider not found")
	}

	// Register and get
	mock := &MockDEXProvider{name: "sushiswap"}
	registry.Register(mock)

	provider, ok := registry.Get("sushiswap")
	if !ok {
		t.Fatal("expected provider to be found")
	}
	if provider.Name() != "sushiswap" {
		t.Errorf("expected name 'sushiswap', got %s", provider.Name())
	}
}

func TestProviderRegistry_GetAll(t *testing.T) {
	registry := NewProviderRegistry()

	mock1 := &MockDEXProvider{name: "uniswap_v3"}
	mock2 := &MockDEXProvider{name: "uniswap_v2"}
	mock3 := &MockDEXProvider{name: "sushiswap"}

	registry.Register(mock1)
	registry.Register(mock2)
	registry.Register(mock3)

	all := registry.GetAll()
	if len(all) != 3 {
		t.Errorf("expected 3 providers, got %d", len(all))
	}
}

func TestProviderRegistry_GetByNames(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})
	registry.Register(&MockDEXProvider{name: "uniswap_v2"})
	registry.Register(&MockDEXProvider{name: "sushiswap"})
	registry.Register(&MockDEXProvider{name: "curve"})

	// Filter by specific names
	filtered := registry.GetByNames([]string{"uniswap_v3", "sushiswap"})
	if len(filtered) != 2 {
		t.Errorf("expected 2 providers, got %d", len(filtered))
	}

	names := make(map[string]bool)
	for _, p := range filtered {
		names[p.Name()] = true
	}
	if !names["uniswap_v3"] || !names["sushiswap"] {
		t.Error("expected uniswap_v3 and sushiswap in filtered list")
	}
}

func TestProviderRegistry_GetByNames_Empty(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})
	registry.Register(&MockDEXProvider{name: "uniswap_v2"})

	// Empty names should return all
	all := registry.GetByNames([]string{})
	if len(all) != 2 {
		t.Errorf("expected 2 providers when filtering with empty names, got %d", len(all))
	}
}

func TestProviderRegistry_GetByNames_NonExistent(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})

	// Non-existent names should return empty
	filtered := registry.GetByNames([]string{"nonexistent"})
	if len(filtered) != 0 {
		t.Errorf("expected 0 providers for non-existent name, got %d", len(filtered))
	}
}

func TestProviderRegistry_Exclude(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})
	registry.Register(&MockDEXProvider{name: "uniswap_v2"})
	registry.Register(&MockDEXProvider{name: "sushiswap"})
	registry.Register(&MockDEXProvider{name: "curve"})

	// Exclude specific providers
	remaining := registry.Exclude([]string{"uniswap_v3", "curve"})
	if len(remaining) != 2 {
		t.Errorf("expected 2 providers after exclusion, got %d", len(remaining))
	}

	names := make(map[string]bool)
	for _, p := range remaining {
		names[p.Name()] = true
	}
	if names["uniswap_v3"] || names["curve"] {
		t.Error("excluded providers should not be in remaining list")
	}
	if !names["uniswap_v2"] || !names["sushiswap"] {
		t.Error("non-excluded providers should be in remaining list")
	}
}

func TestProviderRegistry_Exclude_Empty(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})
	registry.Register(&MockDEXProvider{name: "uniswap_v2"})

	// Empty exclusion should return all
	all := registry.Exclude([]string{})
	if len(all) != 2 {
		t.Errorf("expected 2 providers when excluding nothing, got %d", len(all))
	}
}

func TestProviderRegistry_Exclude_All(t *testing.T) {
	registry := NewProviderRegistry()

	registry.Register(&MockDEXProvider{name: "uniswap_v3"})
	registry.Register(&MockDEXProvider{name: "uniswap_v2"})

	// Exclude all should return empty
	remaining := registry.Exclude([]string{"uniswap_v3", "uniswap_v2"})
	if len(remaining) != 0 {
		t.Errorf("expected 0 providers after excluding all, got %d", len(remaining))
	}
}

func TestMockDEXProvider_GetQuote(t *testing.T) {
	mock := &MockDEXProvider{
		name:  "uniswap_v3",
		isV3:  true,
		quote: &model.Route{
			AmountIn:    "1000000000000000000",
			AmountOut:   "1800000000",
			GasEstimate: 150000,
			Protocol:    "uniswap_v3",
		},
	}

	ctx := context.Background()
	amountIn := big.NewInt(1000000000000000000)

	quote, err := mock.GetQuote(ctx, "0xWETH", "0xUSDC", amountIn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if quote.Protocol != "uniswap_v3" {
		t.Errorf("expected protocol 'uniswap_v3', got %s", quote.Protocol)
	}
	if quote.AmountOut != "1800000000" {
		t.Errorf("expected amountOut '1800000000', got %s", quote.AmountOut)
	}
}

func TestMockDEXProvider_IsV3Style(t *testing.T) {
	v3Provider := &MockDEXProvider{name: "uniswap_v3", isV3: true}
	v2Provider := &MockDEXProvider{name: "uniswap_v2", isV3: false}

	if !v3Provider.IsV3Style() {
		t.Error("expected uniswap_v3 to be V3 style")
	}
	if v2Provider.IsV3Style() {
		t.Error("expected uniswap_v2 to not be V3 style")
	}
}

func TestMockDEXProvider_SupportedFees(t *testing.T) {
	mock := &MockDEXProvider{
		name:          "uniswap_v3",
		supportedFees: []int{100, 500, 3000, 10000},
	}

	fees := mock.SupportedFees()
	if len(fees) != 4 {
		t.Errorf("expected 4 fee tiers, got %d", len(fees))
	}
	if fees[0] != 100 || fees[1] != 500 || fees[2] != 3000 || fees[3] != 10000 {
		t.Errorf("unexpected fee tiers: %v", fees)
	}
}

func TestMockDEXProvider_EstimateGas(t *testing.T) {
	mock := &MockDEXProvider{
		name:        "uniswap_v3",
		gasEstimate: 180000,
	}

	ctx := context.Background()
	gas, err := mock.EstimateGas(ctx, &model.Route{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gas != 180000 {
		t.Errorf("expected gas estimate 180000, got %d", gas)
	}
}
