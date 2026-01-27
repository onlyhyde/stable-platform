package aggregator

import (
	"context"
	"testing"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// MockAggregator is a mock implementation of the Aggregator interface
type MockAggregator struct {
	name            string
	available       bool
	supportedChains []int
	quoteResult     *model.AggregatorQuote
	quoteErr        error
	swapResult      *model.SwapResponse
	swapErr         error
}

func (m *MockAggregator) Name() string {
	return m.name
}

func (m *MockAggregator) GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.AggregatorQuote, error) {
	if m.quoteErr != nil {
		return nil, m.quoteErr
	}
	return m.quoteResult, nil
}

func (m *MockAggregator) BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error) {
	if m.swapErr != nil {
		return nil, m.swapErr
	}
	return m.swapResult, nil
}

func (m *MockAggregator) IsAvailable() bool {
	return m.available
}

func (m *MockAggregator) SupportedChains() []int {
	return m.supportedChains
}

func TestNewAggregatorRegistry(t *testing.T) {
	registry := NewAggregatorRegistry()
	if registry == nil {
		t.Fatal("expected registry to be created")
	}
	if registry.aggregators == nil {
		t.Fatal("expected aggregators map to be initialized")
	}
}

func TestAggregatorRegistry_Register(t *testing.T) {
	registry := NewAggregatorRegistry()

	mock := &MockAggregator{name: "1inch", available: true}
	registry.Register(mock)

	agg, ok := registry.Get("1inch")
	if !ok {
		t.Fatal("expected aggregator to be registered")
	}
	if agg.Name() != "1inch" {
		t.Errorf("expected name '1inch', got %s", agg.Name())
	}
}

func TestAggregatorRegistry_Get(t *testing.T) {
	registry := NewAggregatorRegistry()

	// Test get non-existent
	_, ok := registry.Get("nonexistent")
	if ok {
		t.Fatal("expected aggregator not found")
	}

	// Register and get
	mock := &MockAggregator{name: "0x", available: true}
	registry.Register(mock)

	agg, ok := registry.Get("0x")
	if !ok {
		t.Fatal("expected aggregator to be found")
	}
	if agg.Name() != "0x" {
		t.Errorf("expected name '0x', got %s", agg.Name())
	}
}

func TestAggregatorRegistry_GetAvailable(t *testing.T) {
	registry := NewAggregatorRegistry()

	// Register both available and unavailable aggregators
	available1 := &MockAggregator{name: "1inch", available: true}
	available2 := &MockAggregator{name: "0x", available: true}
	unavailable := &MockAggregator{name: "paraswap", available: false}

	registry.Register(available1)
	registry.Register(available2)
	registry.Register(unavailable)

	available := registry.GetAvailable()
	if len(available) != 2 {
		t.Errorf("expected 2 available aggregators, got %d", len(available))
	}

	// Verify only available ones are returned
	names := make(map[string]bool)
	for _, agg := range available {
		names[agg.Name()] = true
	}
	if names["paraswap"] {
		t.Error("unavailable aggregator should not be in available list")
	}
	if !names["1inch"] || !names["0x"] {
		t.Error("available aggregators should be in available list")
	}
}

func TestAggregatorRegistry_RegisterOverwrite(t *testing.T) {
	registry := NewAggregatorRegistry()

	// Register initial
	mock1 := &MockAggregator{name: "1inch", available: true, supportedChains: []int{1}}
	registry.Register(mock1)

	// Overwrite with new version
	mock2 := &MockAggregator{name: "1inch", available: true, supportedChains: []int{1, 137}}
	registry.Register(mock2)

	agg, ok := registry.Get("1inch")
	if !ok {
		t.Fatal("expected aggregator to be found")
	}

	chains := agg.SupportedChains()
	if len(chains) != 2 {
		t.Errorf("expected 2 supported chains (overwritten), got %d", len(chains))
	}
}

func TestAggregatorRegistry_Empty(t *testing.T) {
	registry := NewAggregatorRegistry()

	available := registry.GetAvailable()
	if len(available) != 0 {
		t.Errorf("expected 0 available aggregators, got %d", len(available))
	}
}

func TestMockAggregator_GetQuote(t *testing.T) {
	mock := &MockAggregator{
		name:      "1inch",
		available: true,
		quoteResult: &model.AggregatorQuote{
			Source:      "1inch",
			AmountOut:   "1800000000",
			GasEstimate: 150000,
		},
	}

	ctx := context.Background()
	req := &model.QuoteRequest{
		TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
		TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		AmountIn: "1000000000000000000",
	}

	quote, err := mock.GetQuote(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if quote.Source != "1inch" {
		t.Errorf("expected source '1inch', got %s", quote.Source)
	}
	if quote.AmountOut != "1800000000" {
		t.Errorf("expected amountOut '1800000000', got %s", quote.AmountOut)
	}
}

func TestMockAggregator_BuildSwap(t *testing.T) {
	mock := &MockAggregator{
		name:      "0x",
		available: true,
		swapResult: &model.SwapResponse{
			To:       "0x1234567890abcdef1234567890abcdef12345678",
			Data:     "0xabcdef",
			Value:    "0",
			GasLimit: 200000,
		},
	}

	ctx := context.Background()
	req := &model.SwapRequest{
		TokenIn:      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
		TokenOut:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		AmountIn:     "1000000000000000000",
		AmountOutMin: "1700000000",
		Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
	}

	swap, err := mock.BuildSwap(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if swap.To != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("unexpected 'to' address: %s", swap.To)
	}
	if swap.GasLimit != 200000 {
		t.Errorf("expected gasLimit 200000, got %d", swap.GasLimit)
	}
}
