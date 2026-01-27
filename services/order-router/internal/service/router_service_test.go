package service

import (
	"context"
	"testing"

	"github.com/stablenet/stable-platform/services/order-router/internal/config"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

func newTestConfig() *config.Config {
	return &config.Config{
		Port:            "8087",
		RPCURL:          "http://localhost:8545",
		ChainID:         1,
		UniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
		UniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		UniswapV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		SushiSwapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
		PriceCacheTTL:   30,
		MaxHops:         3,
		MaxSplits:       5,
		DefaultSlippage: 50,
	}
}

func TestNewRouterService(t *testing.T) {
	cfg := newTestConfig()
	svc := NewRouterService(cfg)

	if svc == nil {
		t.Fatal("expected service to be created")
	}
	if svc.cfg != cfg {
		t.Error("expected config to be set")
	}
	if svc.providers == nil {
		t.Error("expected providers to be initialized")
	}
	if svc.aggregators == nil {
		t.Error("expected aggregators to be initialized")
	}
	if svc.pathFinder == nil {
		t.Error("expected pathFinder to be initialized")
	}
	if svc.priceCache == nil {
		t.Error("expected priceCache to be initialized")
	}
}

func TestRouterService_GetQuote_Validation(t *testing.T) {
	cfg := newTestConfig()
	svc := NewRouterService(cfg)
	ctx := context.Background()

	t.Run("missing tokenIn", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}
		_, err := svc.GetQuote(ctx, req)
		if err == nil {
			t.Error("expected error for missing tokenIn")
		}
	})

	t.Run("missing tokenOut", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			AmountIn: "1000000000000000000",
		}
		_, err := svc.GetQuote(ctx, req)
		if err == nil {
			t.Error("expected error for missing tokenOut")
		}
	})

	t.Run("missing amount", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		}
		_, err := svc.GetQuote(ctx, req)
		if err == nil {
			t.Error("expected error for missing amount")
		}
	})

	t.Run("default slippage applied", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}
		// This will fail because we don't have real RPC, but slippage should be set
		_, _ = svc.GetQuote(ctx, req)
		if req.Slippage != cfg.DefaultSlippage {
			t.Errorf("expected default slippage %f, got %f", cfg.DefaultSlippage, req.Slippage)
		}
	})

	t.Run("default maxHops applied", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}
		_, _ = svc.GetQuote(ctx, req)
		if req.MaxHops != cfg.MaxHops {
			t.Errorf("expected default maxHops %d, got %d", cfg.MaxHops, req.MaxHops)
		}
	})
}

func TestRouterService_GetSplitQuote_Validation(t *testing.T) {
	cfg := newTestConfig()
	svc := NewRouterService(cfg)
	ctx := context.Background()

	t.Run("default maxSplits applied", func(t *testing.T) {
		req := &model.QuoteRequest{
			TokenIn:  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn: "1000000000000000000",
		}
		_, _ = svc.GetSplitQuote(ctx, req)
		if req.MaxSplits != cfg.MaxSplits {
			t.Errorf("expected default maxSplits %d, got %d", cfg.MaxSplits, req.MaxSplits)
		}
	})
}

func TestRouterService_BuildSwap_Validation(t *testing.T) {
	cfg := newTestConfig()
	svc := NewRouterService(cfg)
	ctx := context.Background()

	t.Run("missing tokenIn", func(t *testing.T) {
		req := &model.SwapRequest{
			TokenOut:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn:     "1000000000000000000",
			AmountOutMin: "1800000000",
			Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
		}
		_, err := svc.BuildSwap(ctx, req)
		if err == nil {
			t.Error("expected error for missing tokenIn")
		}
	})

	t.Run("missing tokenOut", func(t *testing.T) {
		req := &model.SwapRequest{
			TokenIn:      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			AmountIn:     "1000000000000000000",
			AmountOutMin: "1800000000",
			Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
		}
		_, err := svc.BuildSwap(ctx, req)
		if err == nil {
			t.Error("expected error for missing tokenOut")
		}
	})

	t.Run("missing amountIn", func(t *testing.T) {
		req := &model.SwapRequest{
			TokenIn:      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountOutMin: "1800000000",
			Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
		}
		_, err := svc.BuildSwap(ctx, req)
		if err == nil {
			t.Error("expected error for missing amountIn")
		}
	})

	t.Run("missing amountOutMin", func(t *testing.T) {
		req := &model.SwapRequest{
			TokenIn:   "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn:  "1000000000000000000",
			Recipient: "0x9876543210fedcba9876543210fedcba98765432",
		}
		_, err := svc.BuildSwap(ctx, req)
		if err == nil {
			t.Error("expected error for missing amountOutMin")
		}
	})

	t.Run("missing recipient", func(t *testing.T) {
		req := &model.SwapRequest{
			TokenIn:      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			TokenOut:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			AmountIn:     "1000000000000000000",
			AmountOutMin: "1800000000",
		}
		_, err := svc.BuildSwap(ctx, req)
		if err == nil {
			t.Error("expected error for missing recipient")
		}
	})
}

func TestRouterService_GetSupportedProtocols(t *testing.T) {
	cfg := newTestConfig()
	svc := NewRouterService(cfg)

	protocols := svc.GetSupportedProtocols()

	if len(protocols) < 3 {
		t.Errorf("expected at least 3 protocols, got %d", len(protocols))
	}

	// Check that native DEXs are included
	hasUniV3 := false
	hasUniV2 := false
	hasSushi := false

	for _, p := range protocols {
		switch p {
		case "uniswap_v3":
			hasUniV3 = true
		case "uniswap_v2":
			hasUniV2 = true
		case "sushiswap":
			hasSushi = true
		}
	}

	if !hasUniV3 {
		t.Error("expected uniswap_v3 in protocols")
	}
	if !hasUniV2 {
		t.Error("expected uniswap_v2 in protocols")
	}
	if !hasSushi {
		t.Error("expected sushiswap in protocols")
	}
}

func TestRouterService_WithAggregators(t *testing.T) {
	cfg := newTestConfig()
	cfg.OneInchAPIKey = "test-api-key"
	cfg.ZeroXAPIKey = "test-0x-key"

	svc := NewRouterService(cfg)
	protocols := svc.GetSupportedProtocols()

	// Should include aggregators when API keys are provided
	has1inch := false
	hasZeroX := false

	for _, p := range protocols {
		switch p {
		case "1inch":
			has1inch = true
		case "0x":
			hasZeroX = true
		}
	}

	if !has1inch {
		t.Error("expected 1inch in protocols when API key is set")
	}
	if !hasZeroX {
		t.Error("expected 0x in protocols when API key is set")
	}
}
