package router

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/stablenet/stable-platform/services/order-router/internal/aggregator"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
	"github.com/stablenet/stable-platform/services/order-router/internal/provider"
)

// MockDEXProvider for testing
type MockDEXProvider struct {
	name     string
	quote    *model.Route
	quoteErr error
}

func (m *MockDEXProvider) Name() string { return m.name }

func (m *MockDEXProvider) GetPools(ctx context.Context, tokenIn, tokenOut string) ([]model.Pool, error) {
	return nil, nil
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
	if m.quote != nil {
		return m.quote.GasEstimate, nil
	}
	return 150000, nil
}

func (m *MockDEXProvider) SupportedFees() []int { return []int{3000} }
func (m *MockDEXProvider) IsV3Style() bool      { return false }

// MockAggregator for testing
type MockAggregator struct {
	name      string
	available bool
	quote     *model.AggregatorQuote
	quoteErr  error
}

func (m *MockAggregator) Name() string { return m.name }

func (m *MockAggregator) GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.AggregatorQuote, error) {
	if m.quoteErr != nil {
		return nil, m.quoteErr
	}
	return m.quote, nil
}

func (m *MockAggregator) BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error) {
	return nil, nil
}

func (m *MockAggregator) IsAvailable() bool       { return m.available }
func (m *MockAggregator) SupportedChains() []int { return []int{1} }

func TestNewPathFinder(t *testing.T) {
	providers := provider.NewProviderRegistry()
	aggregators := aggregator.NewAggregatorRegistry()

	pf := NewPathFinder(providers, aggregators, 3, 5)

	if pf == nil {
		t.Fatal("expected pathfinder to be created")
	}
	if pf.maxHops != 3 {
		t.Errorf("expected maxHops 3, got %d", pf.maxHops)
	}
	if pf.maxSplits != 5 {
		t.Errorf("expected maxSplits 5, got %d", pf.maxSplits)
	}
}

func TestPathFinder_FindBestQuote(t *testing.T) {
	t.Run("single provider success", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1800000000",
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		quote, err := pf.FindBestQuote(ctx, req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if quote.AmountOut != "1800000000" {
			t.Errorf("expected amountOut 1800000000, got %s", quote.AmountOut)
		}
		if quote.Source != "uniswap_v3" {
			t.Errorf("expected source uniswap_v3, got %s", quote.Source)
		}
	})

	t.Run("multiple providers best quote wins", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1800000000",
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})
		providers.Register(&MockDEXProvider{
			name: "sushiswap",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1850000000", // Better rate
				GasEstimate: 160000,
				Protocol:    "sushiswap",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		quote, err := pf.FindBestQuote(ctx, req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if quote.AmountOut != "1850000000" {
			t.Errorf("expected best amountOut 1850000000, got %s", quote.AmountOut)
		}
		if quote.Source != "sushiswap" {
			t.Errorf("expected source sushiswap, got %s", quote.Source)
		}
	})

	t.Run("aggregator wins over provider", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1800000000",
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		aggregators.Register(&MockAggregator{
			name:      "1inch",
			available: true,
			quote: &model.AggregatorQuote{
				Source:      "1inch",
				AmountOut:   "1900000000", // Best rate
				GasEstimate: 180000,
			},
		})

		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		quote, err := pf.FindBestQuote(ctx, req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if quote.AmountOut != "1900000000" {
			t.Errorf("expected amountOut 1900000000, got %s", quote.AmountOut)
		}
		if quote.Source != "1inch" {
			t.Errorf("expected source 1inch, got %s", quote.Source)
		}
	})

	t.Run("all providers fail", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name:     "uniswap_v3",
			quoteErr: errors.New("no liquidity"),
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		_, err := pf.FindBestQuote(ctx, req)

		if err == nil {
			t.Fatal("expected error when all providers fail")
		}
	})

	t.Run("invalid amount", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "invalid",
		}

		ctx := context.Background()
		_, err := pf.FindBestQuote(ctx, req)

		if err == nil {
			t.Fatal("expected error for invalid amount")
		}
	})

	t.Run("slippage calculation", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1000000000", // 1000 USDC
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
			Slippage: 100, // 1%
		}

		ctx := context.Background()
		quote, err := pf.FindBestQuote(ctx, req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// 1% slippage on 1000000000 = 990000000
		if quote.AmountOutMin != "990000000" {
			t.Errorf("expected amountOutMin 990000000 (1%% slippage), got %s", quote.AmountOutMin)
		}
	})
}

func TestPathFinder_FindSplitRoute(t *testing.T) {
	t.Run("split across providers", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "500000000000000000",
				AmountOut:   "900000000",
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})
		providers.Register(&MockDEXProvider{
			name: "sushiswap",
			quote: &model.Route{
				AmountIn:    "500000000000000000",
				AmountOut:   "850000000",
				GasEstimate: 160000,
				Protocol:    "sushiswap",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 2)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		splitRoute, err := pf.FindSplitRoute(ctx, req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(splitRoute.Routes) == 0 {
			t.Fatal("expected routes in split route")
		}
		if splitRoute.TotalIn != "1000000000000000000" {
			t.Errorf("expected totalIn 1000000000000000000, got %s", splitRoute.TotalIn)
		}
	})

	t.Run("no valid routes", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name:     "uniswap_v3",
			quoteErr: errors.New("no liquidity"),
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		_, err := pf.FindSplitRoute(ctx, req)

		if err == nil {
			t.Fatal("expected error when no valid routes")
		}
	})
}

func TestPathFinder_FindMultiHopRoute(t *testing.T) {
	t.Run("direct route better than multi-hop", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name: "uniswap_v3",
			quote: &model.Route{
				AmountIn:    "1000000000000000000",
				AmountOut:   "1800000000",
				GasEstimate: 150000,
				Protocol:    "uniswap_v3",
			},
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		intermediates := []string{
			"0x6B175474E89094C44Da98b954EesdfcdFB59F", // DAI
		}

		ctx := context.Background()
		route, err := pf.FindMultiHopRoute(ctx, req, intermediates)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if route.AmountOut != "1800000000" {
			t.Errorf("expected amountOut 1800000000, got %s", route.AmountOut)
		}
	})

	t.Run("no valid route", func(t *testing.T) {
		providers := provider.NewProviderRegistry()
		providers.Register(&MockDEXProvider{
			name:     "uniswap_v3",
			quoteErr: errors.New("no liquidity"),
		})

		aggregators := aggregator.NewAggregatorRegistry()
		pf := NewPathFinder(providers, aggregators, 3, 5)

		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}

		ctx := context.Background()
		_, err := pf.FindMultiHopRoute(ctx, req, nil)

		if err == nil {
			t.Fatal("expected error when no valid route")
		}
	})
}

func TestPathFinder_calculateSplitPercentages(t *testing.T) {
	providers := provider.NewProviderRegistry()
	aggregators := aggregator.NewAggregatorRegistry()
	pf := NewPathFinder(providers, aggregators, 3, 5)

	t.Run("single route", func(t *testing.T) {
		routes := []routeWithProvider{
			{route: &model.Route{AmountOut: "1000000"}},
		}
		percentages := pf.calculateSplitPercentages(routes, big.NewInt(1000000))

		if len(percentages) != 1 {
			t.Fatalf("expected 1 percentage, got %d", len(percentages))
		}
		if percentages[0] != 100 {
			t.Errorf("expected 100%%, got %d%%", percentages[0])
		}
	})

	t.Run("empty routes", func(t *testing.T) {
		percentages := pf.calculateSplitPercentages(nil, big.NewInt(1000000))
		if percentages != nil {
			t.Errorf("expected nil for empty routes, got %v", percentages)
		}
	})

	t.Run("two routes equal output", func(t *testing.T) {
		routes := []routeWithProvider{
			{route: &model.Route{AmountOut: "1000000"}},
			{route: &model.Route{AmountOut: "1000000"}},
		}
		percentages := pf.calculateSplitPercentages(routes, big.NewInt(2000000))

		if len(percentages) != 2 {
			t.Fatalf("expected 2 percentages, got %d", len(percentages))
		}
		// Should be roughly 50/50
		total := percentages[0] + percentages[1]
		if total != 100 {
			t.Errorf("expected total 100%%, got %d%%", total)
		}
	})

	t.Run("three routes different outputs", func(t *testing.T) {
		routes := []routeWithProvider{
			{route: &model.Route{AmountOut: "6000000"}}, // 60%
			{route: &model.Route{AmountOut: "3000000"}}, // 30%
			{route: &model.Route{AmountOut: "1000000"}}, // 10%
		}
		percentages := pf.calculateSplitPercentages(routes, big.NewInt(10000000))

		if len(percentages) != 3 {
			t.Fatalf("expected 3 percentages, got %d", len(percentages))
		}

		total := 0
		for _, p := range percentages {
			total += p
		}
		if total != 100 {
			t.Errorf("expected total 100%%, got %d%%", total)
		}
	})
}
