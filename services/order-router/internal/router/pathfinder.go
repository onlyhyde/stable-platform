package router

import (
	"context"
	"fmt"
	"math/big"
	"sort"
	"sync"

	"github.com/stablenet/stable-platform/services/order-router/internal/aggregator"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
	"github.com/stablenet/stable-platform/services/order-router/internal/provider"
)

// PathFinder finds optimal swap routes
type PathFinder struct {
	providers   *provider.ProviderRegistry
	aggregators *aggregator.AggregatorRegistry
	maxHops     int
	maxSplits   int
}

// routeWithProvider pairs a route with its provider for split routing
type routeWithProvider struct {
	route    *model.Route
	provider provider.DEXProvider
}

// NewPathFinder creates a new path finder
func NewPathFinder(
	providers *provider.ProviderRegistry,
	aggregators *aggregator.AggregatorRegistry,
	maxHops, maxSplits int,
) *PathFinder {
	return &PathFinder{
		providers:   providers,
		aggregators: aggregators,
		maxHops:     maxHops,
		maxSplits:   maxSplits,
	}
}

// QuoteResult represents a quote result from any source
type QuoteResult struct {
	Route           *model.Route
	AggregatorQuote *model.AggregatorQuote
	Source          string
	AmountOut       *big.Int
	GasEstimate     uint64
	Error           error
}

// FindBestQuote finds the best quote across all sources
func (pf *PathFinder) FindBestQuote(ctx context.Context, req *model.QuoteRequest) (*model.QuoteResponse, error) {
	amountIn, ok := new(big.Int).SetString(req.AmountIn, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.AmountIn)
	}

	// Collect quotes from all sources concurrently
	results := make(chan QuoteResult, 10)
	var wg sync.WaitGroup

	// Get quotes from DEX providers
	providers := pf.providers.Exclude(req.ExcludeDEXs)
	if len(req.Protocols) > 0 {
		providers = pf.providers.GetByNames(req.Protocols)
	}

	for _, p := range providers {
		wg.Add(1)
		go func(prov provider.DEXProvider) {
			defer wg.Done()
			route, err := prov.GetQuote(ctx, req.TokenIn, req.TokenOut, amountIn)
			if err != nil {
				results <- QuoteResult{Error: err, Source: prov.Name()}
				return
			}
			amountOut, _ := new(big.Int).SetString(route.AmountOut, 10)
			results <- QuoteResult{
				Route:       route,
				Source:      prov.Name(),
				AmountOut:   amountOut,
				GasEstimate: route.GasEstimate,
			}
		}(p)
	}

	// Get quotes from aggregators
	for _, agg := range pf.aggregators.GetAvailable() {
		wg.Add(1)
		go func(a aggregator.Aggregator) {
			defer wg.Done()
			quote, err := a.GetQuote(ctx, req)
			if err != nil {
				results <- QuoteResult{Error: err, Source: a.Name()}
				return
			}
			amountOut, _ := new(big.Int).SetString(quote.AmountOut, 10)
			results <- QuoteResult{
				AggregatorQuote: quote,
				Source:          a.Name(),
				AmountOut:       amountOut,
				GasEstimate:     quote.GasEstimate,
			}
		}(agg)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Find best result
	var bestResult *QuoteResult
	for result := range results {
		if result.Error != nil {
			continue
		}
		if bestResult == nil || result.AmountOut.Cmp(bestResult.AmountOut) > 0 {
			r := result
			bestResult = &r
		}
	}

	if bestResult == nil {
		return nil, fmt.Errorf("no valid quotes found")
	}

	// Build response
	response := &model.QuoteResponse{
		TokenIn:     model.Token{Address: req.TokenIn},
		TokenOut:    model.Token{Address: req.TokenOut},
		AmountIn:    req.AmountIn,
		AmountOut:   bestResult.AmountOut.String(),
		GasEstimate: bestResult.GasEstimate,
		Source:      bestResult.Source,
	}

	// Calculate amount out min with slippage
	slippage := req.Slippage
	if slippage == 0 {
		slippage = 50 // Default 0.5%
	}
	slippageFactor := big.NewInt(int64(10000 - slippage))
	amountOutMin := new(big.Int).Mul(bestResult.AmountOut, slippageFactor)
	amountOutMin = new(big.Int).Div(amountOutMin, big.NewInt(10000))
	response.AmountOutMin = amountOutMin.String()

	if bestResult.Route != nil {
		response.Route = bestResult.Route
		response.Protocols = []string{bestResult.Route.Protocol}
	} else if bestResult.AggregatorQuote != nil {
		response.Protocols = bestResult.AggregatorQuote.Protocols
	}

	return response, nil
}

// FindSplitRoute finds optimal split routing
func (pf *PathFinder) FindSplitRoute(ctx context.Context, req *model.QuoteRequest) (*model.SplitRoute, error) {
	amountIn, ok := new(big.Int).SetString(req.AmountIn, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.AmountIn)
	}

	// Get quotes from all providers
	providers := pf.providers.Exclude(req.ExcludeDEXs)
	if len(req.Protocols) > 0 {
		providers = pf.providers.GetByNames(req.Protocols)
	}

	routes := make([]routeWithProvider, 0)

	for _, p := range providers {
		route, err := p.GetQuote(ctx, req.TokenIn, req.TokenOut, amountIn)
		if err != nil {
			continue
		}
		routes = append(routes, routeWithProvider{route: route, provider: p})
	}

	if len(routes) == 0 {
		return nil, fmt.Errorf("no valid routes found")
	}

	// Sort by output amount (descending)
	sort.Slice(routes, func(i, j int) bool {
		amtI, _ := new(big.Int).SetString(routes[i].route.AmountOut, 10)
		amtJ, _ := new(big.Int).SetString(routes[j].route.AmountOut, 10)
		return amtI.Cmp(amtJ) > 0
	})

	// Simple split: use top N routes
	maxSplits := pf.maxSplits
	if req.MaxSplits > 0 && req.MaxSplits < maxSplits {
		maxSplits = req.MaxSplits
	}
	if maxSplits > len(routes) {
		maxSplits = len(routes)
	}

	// Calculate optimal split percentages
	// For PoC: simple equal split among top routes
	percentages := pf.calculateSplitPercentages(routes[:maxSplits], amountIn)

	splitRoute := &model.SplitRoute{
		Routes:      make([]model.Route, 0, maxSplits),
		Percentages: percentages,
		TotalIn:     req.AmountIn,
	}

	totalOut := big.NewInt(0)
	totalGas := uint64(0)

	for i := 0; i < maxSplits; i++ {
		splitAmount := new(big.Int).Mul(amountIn, big.NewInt(int64(percentages[i])))
		splitAmount = new(big.Int).Div(splitAmount, big.NewInt(100))

		// Get quote for split amount
		route, err := routes[i].provider.GetQuote(ctx, req.TokenIn, req.TokenOut, splitAmount)
		if err != nil {
			continue
		}

		splitRoute.Routes = append(splitRoute.Routes, *route)

		amtOut, _ := new(big.Int).SetString(route.AmountOut, 10)
		totalOut = totalOut.Add(totalOut, amtOut)
		totalGas += route.GasEstimate
	}

	splitRoute.TotalOut = totalOut.String()
	splitRoute.GasEstimate = totalGas

	return splitRoute, nil
}

// calculateSplitPercentages calculates optimal split percentages
func (pf *PathFinder) calculateSplitPercentages(routes []routeWithProvider, totalAmount *big.Int) []int {
	n := len(routes)
	if n == 0 {
		return nil
	}
	if n == 1 {
		return []int{100}
	}

	// Simple strategy: weight by output amount
	outputs := make([]*big.Int, n)
	totalOutput := big.NewInt(0)

	for i, r := range routes {
		out, _ := new(big.Int).SetString(r.route.AmountOut, 10)
		outputs[i] = out
		totalOutput = totalOutput.Add(totalOutput, out)
	}

	percentages := make([]int, n)
	remainingPercent := 100

	for i := 0; i < n-1; i++ {
		// Percentage proportional to output
		pct := new(big.Int).Mul(outputs[i], big.NewInt(100))
		pct = pct.Div(pct, totalOutput)
		percentages[i] = int(pct.Int64())
		remainingPercent -= percentages[i]
	}

	// Last route gets the remainder
	percentages[n-1] = remainingPercent

	return percentages
}

// FindMultiHopRoute finds routes with intermediate tokens
func (pf *PathFinder) FindMultiHopRoute(ctx context.Context, req *model.QuoteRequest, intermediateTokens []string) (*model.Route, error) {
	amountIn, ok := new(big.Int).SetString(req.AmountIn, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.AmountIn)
	}

	var bestRoute *model.Route
	var bestAmountOut *big.Int

	providers := pf.providers.Exclude(req.ExcludeDEXs)

	// Try direct route first
	for _, p := range providers {
		route, err := p.GetQuote(ctx, req.TokenIn, req.TokenOut, amountIn)
		if err != nil {
			continue
		}
		amountOut, _ := new(big.Int).SetString(route.AmountOut, 10)
		if bestAmountOut == nil || amountOut.Cmp(bestAmountOut) > 0 {
			bestAmountOut = amountOut
			bestRoute = route
		}
	}

	// Try multi-hop routes through intermediate tokens
	for _, intermediate := range intermediateTokens {
		if intermediate == req.TokenIn || intermediate == req.TokenOut {
			continue
		}

		for _, p := range providers {
			// First hop: tokenIn -> intermediate
			hop1, err := p.GetQuote(ctx, req.TokenIn, intermediate, amountIn)
			if err != nil {
				continue
			}

			hop1Out, _ := new(big.Int).SetString(hop1.AmountOut, 10)

			// Second hop: intermediate -> tokenOut
			hop2, err := p.GetQuote(ctx, intermediate, req.TokenOut, hop1Out)
			if err != nil {
				continue
			}

			amountOut, _ := new(big.Int).SetString(hop2.AmountOut, 10)

			if bestAmountOut == nil || amountOut.Cmp(bestAmountOut) > 0 {
				bestAmountOut = amountOut

				// Combine hops
				bestRoute = &model.Route{
					Hops:        append(hop1.Hops, hop2.Hops...),
					AmountIn:    req.AmountIn,
					AmountOut:   hop2.AmountOut,
					Protocol:    p.Name(),
					GasEstimate: hop1.GasEstimate + hop2.GasEstimate,
				}
			}
		}
	}

	if bestRoute == nil {
		return nil, fmt.Errorf("no valid route found")
	}

	return bestRoute, nil
}
