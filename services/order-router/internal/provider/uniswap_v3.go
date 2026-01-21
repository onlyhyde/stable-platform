package provider

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// UniswapV3Provider implements DEXProvider for Uniswap V3
type UniswapV3Provider struct {
	rpcURL       string
	routerAddr   string
	quoterAddr   string
	factoryAddr  string
	chainID      int
}

// NewUniswapV3Provider creates a new Uniswap V3 provider
func NewUniswapV3Provider(rpcURL, routerAddr, quoterAddr string, chainID int) *UniswapV3Provider {
	return &UniswapV3Provider{
		rpcURL:      rpcURL,
		routerAddr:  routerAddr,
		quoterAddr:  quoterAddr,
		factoryAddr: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3 Factory
		chainID:     chainID,
	}
}

func (p *UniswapV3Provider) Name() string {
	return "uniswap_v3"
}

func (p *UniswapV3Provider) SupportedFees() []int {
	return []int{100, 500, 3000, 10000} // 0.01%, 0.05%, 0.3%, 1%
}

func (p *UniswapV3Provider) IsV3Style() bool {
	return true
}

func (p *UniswapV3Provider) GetPools(ctx context.Context, tokenIn, tokenOut string) ([]model.Pool, error) {
	// Get pools for all fee tiers
	pools := make([]model.Pool, 0)
	fees := p.SupportedFees()

	for _, fee := range fees {
		poolAddr := p.computePoolAddress(tokenIn, tokenOut, fee)
		pool := model.Pool{
			Address:  poolAddr,
			Protocol: p.Name(),
			Token0: model.Token{Address: tokenIn},
			Token1: model.Token{Address: tokenOut},
			Fee:    fee,
		}
		pools = append(pools, pool)
	}

	return pools, nil
}

func (p *UniswapV3Provider) GetQuote(ctx context.Context, tokenIn, tokenOut string, amountIn *big.Int) (*model.Route, error) {
	// Try all fee tiers and return the best quote
	var bestRoute *model.Route
	var bestAmountOut *big.Int

	for _, fee := range p.SupportedFees() {
		amountOut, err := p.quoteExactInputSingle(ctx, tokenIn, tokenOut, fee, amountIn)
		if err != nil {
			continue
		}

		if bestAmountOut == nil || amountOut.Cmp(bestAmountOut) > 0 {
			bestAmountOut = amountOut
			poolAddr := p.computePoolAddress(tokenIn, tokenOut, fee)

			bestRoute = &model.Route{
				Hops: []model.RouteHop{
					{
						Pool: model.Pool{
							Address:  poolAddr,
							Protocol: p.Name(),
							Token0:   model.Token{Address: tokenIn},
							Token1:   model.Token{Address: tokenOut},
							Fee:      fee,
						},
						TokenIn:   model.Token{Address: tokenIn},
						TokenOut:  model.Token{Address: tokenOut},
						AmountIn:  amountIn.String(),
						AmountOut: amountOut.String(),
					},
				},
				AmountIn:    amountIn.String(),
				AmountOut:   amountOut.String(),
				Protocol:    p.Name(),
				GasEstimate: 150000, // Estimated gas for single hop V3 swap
			}
		}
	}

	if bestRoute == nil {
		return nil, fmt.Errorf("no valid quote found for %s -> %s", tokenIn, tokenOut)
	}

	return bestRoute, nil
}

func (p *UniswapV3Provider) GetQuoteExactOut(ctx context.Context, tokenIn, tokenOut string, amountOut *big.Int) (*model.Route, error) {
	var bestRoute *model.Route
	var bestAmountIn *big.Int

	for _, fee := range p.SupportedFees() {
		amountIn, err := p.quoteExactOutputSingle(ctx, tokenIn, tokenOut, fee, amountOut)
		if err != nil {
			continue
		}

		if bestAmountIn == nil || amountIn.Cmp(bestAmountIn) < 0 {
			bestAmountIn = amountIn
			poolAddr := p.computePoolAddress(tokenIn, tokenOut, fee)

			bestRoute = &model.Route{
				Hops: []model.RouteHop{
					{
						Pool: model.Pool{
							Address:  poolAddr,
							Protocol: p.Name(),
							Fee:      fee,
						},
						TokenIn:   model.Token{Address: tokenIn},
						TokenOut:  model.Token{Address: tokenOut},
						AmountIn:  amountIn.String(),
						AmountOut: amountOut.String(),
					},
				},
				AmountIn:    amountIn.String(),
				AmountOut:   amountOut.String(),
				Protocol:    p.Name(),
				GasEstimate: 150000,
			}
		}
	}

	if bestRoute == nil {
		return nil, fmt.Errorf("no valid quote found")
	}

	return bestRoute, nil
}

func (p *UniswapV3Provider) BuildSwapCalldata(ctx context.Context, route *model.Route, recipient string, deadline int64, slippage float64) (string, string, string, error) {
	if len(route.Hops) == 0 {
		return "", "", "", fmt.Errorf("empty route")
	}

	// Calculate minimum amount out with slippage
	amountOut, _ := new(big.Int).SetString(route.AmountOut, 10)
	slippageFactor := big.NewInt(int64(10000 - slippage))
	amountOutMin := new(big.Int).Mul(amountOut, slippageFactor)
	amountOutMin = new(big.Int).Div(amountOutMin, big.NewInt(10000))

	amountIn, _ := new(big.Int).SetString(route.AmountIn, 10)

	if len(route.Hops) == 1 {
		// Single hop: exactInputSingle
		hop := route.Hops[0]
		calldata := p.encodeExactInputSingle(
			hop.TokenIn.Address,
			hop.TokenOut.Address,
			hop.Pool.Fee,
			recipient,
			deadline,
			amountIn,
			amountOutMin,
		)
		return p.routerAddr, calldata, "0", nil
	}

	// Multi-hop: exactInput with path
	path := p.encodePath(route)
	calldata := p.encodeExactInput(path, recipient, deadline, amountIn, amountOutMin)
	return p.routerAddr, calldata, "0", nil
}

func (p *UniswapV3Provider) EstimateGas(ctx context.Context, route *model.Route) (uint64, error) {
	// Base gas + gas per hop
	baseGas := uint64(100000)
	hopGas := uint64(50000)
	return baseGas + hopGas*uint64(len(route.Hops)), nil
}

// Internal helper functions

func (p *UniswapV3Provider) quoteExactInputSingle(ctx context.Context, tokenIn, tokenOut string, fee int, amountIn *big.Int) (*big.Int, error) {
	// In production, this would call the Quoter contract
	// For PoC, we simulate with a simple calculation
	// amountOut = amountIn * (1 - fee/1000000)

	feeFactor := big.NewInt(int64(1000000 - fee))
	amountOut := new(big.Int).Mul(amountIn, feeFactor)
	amountOut = new(big.Int).Div(amountOut, big.NewInt(1000000))

	return amountOut, nil
}

func (p *UniswapV3Provider) quoteExactOutputSingle(ctx context.Context, tokenIn, tokenOut string, fee int, amountOut *big.Int) (*big.Int, error) {
	// amountIn = amountOut / (1 - fee/1000000)
	feeFactor := big.NewInt(int64(1000000 - fee))
	amountIn := new(big.Int).Mul(amountOut, big.NewInt(1000000))
	amountIn = new(big.Int).Div(amountIn, feeFactor)

	return amountIn, nil
}

func (p *UniswapV3Provider) computePoolAddress(tokenA, tokenB string, fee int) string {
	// In production, compute CREATE2 address
	// For PoC, return a deterministic fake address
	return fmt.Sprintf("0x%s", strings.Repeat("0", 38)+"01")
}

func (p *UniswapV3Provider) encodeExactInputSingle(tokenIn, tokenOut string, fee int, recipient string, deadline int64, amountIn, amountOutMin *big.Int) string {
	// Function selector for exactInputSingle
	// exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))
	selector := "414bf389"

	// Encode parameters (simplified - in production use proper ABI encoding)
	params := fmt.Sprintf(
		"%064s%064s%064x%064s%064x%064x%064x%064x",
		strings.TrimPrefix(tokenIn, "0x"),
		strings.TrimPrefix(tokenOut, "0x"),
		fee,
		strings.TrimPrefix(recipient, "0x"),
		deadline,
		amountIn,
		amountOutMin,
		0, // sqrtPriceLimitX96
	)

	return "0x" + selector + params
}

func (p *UniswapV3Provider) encodePath(route *model.Route) []byte {
	// Encode path as: token0 + fee + token1 + fee + token2 ...
	path := make([]byte, 0)

	for i, hop := range route.Hops {
		tokenIn := strings.TrimPrefix(hop.TokenIn.Address, "0x")
		tokenInBytes, _ := hex.DecodeString(tokenIn)
		path = append(path, tokenInBytes...)

		// Fee as 3 bytes
		fee := hop.Pool.Fee
		path = append(path, byte(fee>>16), byte(fee>>8), byte(fee))

		if i == len(route.Hops)-1 {
			tokenOut := strings.TrimPrefix(hop.TokenOut.Address, "0x")
			tokenOutBytes, _ := hex.DecodeString(tokenOut)
			path = append(path, tokenOutBytes...)
		}
	}

	return path
}

func (p *UniswapV3Provider) encodeExactInput(path []byte, recipient string, deadline int64, amountIn, amountOutMin *big.Int) string {
	// Function selector for exactInput
	selector := "c04b8d59"

	// Simplified encoding
	pathHex := hex.EncodeToString(path)
	params := fmt.Sprintf(
		"%064x%064s%064x%064x%064x%s",
		0x20, // offset to path
		strings.TrimPrefix(recipient, "0x"),
		deadline,
		amountIn,
		amountOutMin,
		pathHex,
	)

	return "0x" + selector + params
}
