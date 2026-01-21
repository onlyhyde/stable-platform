package service

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/stablenet/stable-platform/services/order-router/internal/aggregator"
	"github.com/stablenet/stable-platform/services/order-router/internal/cache"
	"github.com/stablenet/stable-platform/services/order-router/internal/config"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
	"github.com/stablenet/stable-platform/services/order-router/internal/provider"
	"github.com/stablenet/stable-platform/services/order-router/internal/router"
)

// RouterService orchestrates quote and swap operations
type RouterService struct {
	cfg         *config.Config
	providers   *provider.ProviderRegistry
	aggregators *aggregator.AggregatorRegistry
	pathFinder  *router.PathFinder
	priceCache  *cache.PriceCache
}

// NewRouterService creates a new router service
func NewRouterService(cfg *config.Config) *RouterService {
	// Initialize provider registry
	providers := provider.NewProviderRegistry()

	// Register Uniswap V3
	uniV3 := provider.NewUniswapV3Provider(
		cfg.RPCURL,
		cfg.UniswapV3Router,
		cfg.UniswapV3Quoter,
		cfg.ChainID,
	)
	providers.Register(uniV3)

	// Register Uniswap V2
	uniV2 := provider.NewUniswapV2Provider(
		"uniswap_v2",
		cfg.RPCURL,
		cfg.UniswapV2Router,
		"0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // Uniswap V2 Factory
		cfg.ChainID,
	)
	providers.Register(uniV2)

	// Register SushiSwap
	sushi := provider.NewSushiSwapProvider(cfg.RPCURL, cfg.SushiSwapRouter, cfg.ChainID)
	providers.Register(sushi)

	// Initialize aggregator registry
	aggregators := aggregator.NewAggregatorRegistry()

	// Register 1inch
	if cfg.OneInchAPIKey != "" {
		oneInch := aggregator.NewOneInchAggregator(cfg.OneInchAPIKey, cfg.ChainID)
		aggregators.Register(oneInch)
		log.Println("1inch aggregator registered")
	}

	// Register 0x
	if cfg.ZeroXAPIKey != "" {
		zeroX := aggregator.NewZeroXAggregator(cfg.ZeroXAPIKey, cfg.ChainID)
		aggregators.Register(zeroX)
		log.Println("0x aggregator registered")
	}

	// Initialize path finder
	pathFinder := router.NewPathFinder(
		providers,
		aggregators,
		cfg.MaxHops,
		cfg.MaxSplits,
	)

	// Initialize price cache
	priceCache := cache.NewPriceCache(cfg.PriceCacheTTL)

	return &RouterService{
		cfg:         cfg,
		providers:   providers,
		aggregators: aggregators,
		pathFinder:  pathFinder,
		priceCache:  priceCache,
	}
}

// GetQuote returns the best quote for a swap
func (s *RouterService) GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.QuoteResponse, error) {
	// Validate request
	if req.TokenIn == "" || req.TokenOut == "" {
		return nil, fmt.Errorf("tokenIn and tokenOut are required")
	}
	if req.AmountIn == "" && req.AmountOut == "" {
		return nil, fmt.Errorf("amountIn or amountOut is required")
	}

	// Set defaults
	if req.Slippage == 0 {
		req.Slippage = s.cfg.DefaultSlippage
	}
	if req.MaxHops == 0 {
		req.MaxHops = s.cfg.MaxHops
	}

	// Find best quote
	quote, err := s.pathFinder.FindBestQuote(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to find quote: %w", err)
	}

	// Set expiration
	quote.ExpiresAt = time.Now().Add(5 * time.Minute)

	log.Printf("Quote: %s %s -> %s %s (source: %s)",
		quote.AmountIn, req.TokenIn[:10],
		quote.AmountOut, req.TokenOut[:10],
		quote.Source)

	return quote, nil
}

// GetSplitQuote returns a quote with split routing
func (s *RouterService) GetSplitQuote(ctx context.Context, req *model.QuoteRequest) (*model.QuoteResponse, error) {
	// Set defaults
	if req.MaxSplits == 0 {
		req.MaxSplits = s.cfg.MaxSplits
	}

	splitRoute, err := s.pathFinder.FindSplitRoute(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to find split route: %w", err)
	}

	// Calculate amount out min with slippage
	slippage := req.Slippage
	if slippage == 0 {
		slippage = s.cfg.DefaultSlippage
	}

	totalOut, _ := new(big.Int).SetString(splitRoute.TotalOut, 10)
	slippageFactor := big.NewInt(int64(10000 - slippage))
	amountOutMin := new(big.Int).Mul(totalOut, slippageFactor)
	amountOutMin = new(big.Int).Div(amountOutMin, big.NewInt(10000))

	// Collect protocols used
	protocols := make([]string, 0)
	for _, route := range splitRoute.Routes {
		protocols = append(protocols, route.Protocol)
	}

	quote := &model.QuoteResponse{
		TokenIn:     model.Token{Address: req.TokenIn},
		TokenOut:    model.Token{Address: req.TokenOut},
		AmountIn:    req.AmountIn,
		AmountOut:   splitRoute.TotalOut,
		AmountOutMin: amountOutMin.String(),
		GasEstimate: splitRoute.GasEstimate,
		SplitRoute:  splitRoute,
		Protocols:   protocols,
		Source:      "split",
		ExpiresAt:   time.Now().Add(5 * time.Minute),
	}

	return quote, nil
}

// BuildSwap builds swap calldata for execution
func (s *RouterService) BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error) {
	// Validate request
	if req.TokenIn == "" || req.TokenOut == "" {
		return nil, fmt.Errorf("tokenIn and tokenOut are required")
	}
	if req.AmountIn == "" || req.AmountOutMin == "" {
		return nil, fmt.Errorf("amountIn and amountOutMin are required")
	}
	if req.Recipient == "" {
		return nil, fmt.Errorf("recipient is required")
	}

	// Set defaults
	if req.Slippage == 0 {
		req.Slippage = s.cfg.DefaultSlippage
	}
	if req.Deadline == 0 {
		req.Deadline = time.Now().Add(20 * time.Minute).Unix()
	}

	// Get quote first
	quoteReq := &model.QuoteRequest{
		TokenIn:   req.TokenIn,
		TokenOut:  req.TokenOut,
		AmountIn:  req.AmountIn,
		Slippage:  req.Slippage,
		Protocols: req.Protocols,
	}

	quote, err := s.pathFinder.FindBestQuote(ctx, quoteReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote: %w", err)
	}

	// If aggregator quote, use aggregator to build swap
	for _, agg := range s.aggregators.GetAvailable() {
		if agg.Name() == quote.Source {
			return agg.BuildSwap(ctx, req)
		}
	}

	// Otherwise, use native provider
	if quote.Route == nil {
		return nil, fmt.Errorf("no route available for swap")
	}

	prov, ok := s.providers.Get(quote.Route.Protocol)
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", quote.Route.Protocol)
	}

	to, data, value, err := prov.BuildSwapCalldata(ctx, quote.Route, req.Recipient, req.Deadline, req.Slippage)
	if err != nil {
		return nil, fmt.Errorf("failed to build calldata: %w", err)
	}

	gasEstimate, _ := prov.EstimateGas(ctx, quote.Route)

	return &model.SwapResponse{
		To:       to,
		Data:     data,
		Value:    value,
		GasLimit: gasEstimate,
		Quote:    *quote,
	}, nil
}

// GetSupportedProtocols returns list of supported protocols
func (s *RouterService) GetSupportedProtocols() []string {
	protocols := make([]string, 0)
	for _, p := range s.providers.GetAll() {
		protocols = append(protocols, p.Name())
	}
	for _, a := range s.aggregators.GetAvailable() {
		protocols = append(protocols, a.Name())
	}
	return protocols
}
