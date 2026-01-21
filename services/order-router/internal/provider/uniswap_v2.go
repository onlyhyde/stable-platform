package provider

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// UniswapV2Provider implements DEXProvider for Uniswap V2 and forks
type UniswapV2Provider struct {
	name        string
	rpcURL      string
	routerAddr  string
	factoryAddr string
	chainID     int
}

// NewUniswapV2Provider creates a new Uniswap V2 provider
func NewUniswapV2Provider(name, rpcURL, routerAddr, factoryAddr string, chainID int) *UniswapV2Provider {
	return &UniswapV2Provider{
		name:        name,
		rpcURL:      rpcURL,
		routerAddr:  routerAddr,
		factoryAddr: factoryAddr,
		chainID:     chainID,
	}
}

// NewSushiSwapProvider creates a SushiSwap provider (Uniswap V2 fork)
func NewSushiSwapProvider(rpcURL, routerAddr string, chainID int) *UniswapV2Provider {
	return &UniswapV2Provider{
		name:        "sushiswap",
		rpcURL:      rpcURL,
		routerAddr:  routerAddr,
		factoryAddr: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac", // SushiSwap Factory
		chainID:     chainID,
	}
}

func (p *UniswapV2Provider) Name() string {
	return p.name
}

func (p *UniswapV2Provider) SupportedFees() []int {
	return []int{30} // 0.3% fixed fee for V2
}

func (p *UniswapV2Provider) IsV3Style() bool {
	return false
}

func (p *UniswapV2Provider) GetPools(ctx context.Context, tokenIn, tokenOut string) ([]model.Pool, error) {
	poolAddr := p.computePairAddress(tokenIn, tokenOut)

	pool := model.Pool{
		Address:  poolAddr,
		Protocol: p.name,
		Token0:   model.Token{Address: tokenIn},
		Token1:   model.Token{Address: tokenOut},
		Fee:      30, // 0.3%
	}

	return []model.Pool{pool}, nil
}

func (p *UniswapV2Provider) GetQuote(ctx context.Context, tokenIn, tokenOut string, amountIn *big.Int) (*model.Route, error) {
	// Get reserves (simulated for PoC)
	reserve0 := big.NewInt(1000000000000000000) // 1 token with 18 decimals
	reserve1 := big.NewInt(1000000000000000000)

	amountOut := p.getAmountOut(amountIn, reserve0, reserve1)

	poolAddr := p.computePairAddress(tokenIn, tokenOut)

	route := &model.Route{
		Hops: []model.RouteHop{
			{
				Pool: model.Pool{
					Address:  poolAddr,
					Protocol: p.name,
					Token0:   model.Token{Address: tokenIn},
					Token1:   model.Token{Address: tokenOut},
					Fee:      30,
					Reserve0: reserve0,
					Reserve1: reserve1,
				},
				TokenIn:   model.Token{Address: tokenIn},
				TokenOut:  model.Token{Address: tokenOut},
				AmountIn:  amountIn.String(),
				AmountOut: amountOut.String(),
			},
		},
		AmountIn:    amountIn.String(),
		AmountOut:   amountOut.String(),
		Protocol:    p.name,
		GasEstimate: 120000, // Estimated gas for V2 swap
	}

	return route, nil
}

func (p *UniswapV2Provider) GetQuoteExactOut(ctx context.Context, tokenIn, tokenOut string, amountOut *big.Int) (*model.Route, error) {
	reserve0 := big.NewInt(1000000000000000000)
	reserve1 := big.NewInt(1000000000000000000)

	amountIn := p.getAmountIn(amountOut, reserve0, reserve1)

	poolAddr := p.computePairAddress(tokenIn, tokenOut)

	route := &model.Route{
		Hops: []model.RouteHop{
			{
				Pool: model.Pool{
					Address:  poolAddr,
					Protocol: p.name,
					Fee:      30,
				},
				TokenIn:   model.Token{Address: tokenIn},
				TokenOut:  model.Token{Address: tokenOut},
				AmountIn:  amountIn.String(),
				AmountOut: amountOut.String(),
			},
		},
		AmountIn:    amountIn.String(),
		AmountOut:   amountOut.String(),
		Protocol:    p.name,
		GasEstimate: 120000,
	}

	return route, nil
}

func (p *UniswapV2Provider) BuildSwapCalldata(ctx context.Context, route *model.Route, recipient string, deadline int64, slippage float64) (string, string, string, error) {
	if len(route.Hops) == 0 {
		return "", "", "", fmt.Errorf("empty route")
	}

	// Calculate minimum amount out with slippage
	amountOut, _ := new(big.Int).SetString(route.AmountOut, 10)
	slippageFactor := big.NewInt(int64(10000 - slippage))
	amountOutMin := new(big.Int).Mul(amountOut, slippageFactor)
	amountOutMin = new(big.Int).Div(amountOutMin, big.NewInt(10000))

	amountIn, _ := new(big.Int).SetString(route.AmountIn, 10)

	// Build path
	path := make([]string, 0, len(route.Hops)+1)
	for i, hop := range route.Hops {
		path = append(path, hop.TokenIn.Address)
		if i == len(route.Hops)-1 {
			path = append(path, hop.TokenOut.Address)
		}
	}

	calldata := p.encodeSwapExactTokensForTokens(amountIn, amountOutMin, path, recipient, deadline)
	return p.routerAddr, calldata, "0", nil
}

func (p *UniswapV2Provider) EstimateGas(ctx context.Context, route *model.Route) (uint64, error) {
	baseGas := uint64(90000)
	hopGas := uint64(30000)
	return baseGas + hopGas*uint64(len(route.Hops)), nil
}

// Internal helper functions

// getAmountOut calculates output amount using constant product formula
func (p *UniswapV2Provider) getAmountOut(amountIn, reserveIn, reserveOut *big.Int) *big.Int {
	// amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
	amountInWithFee := new(big.Int).Mul(amountIn, big.NewInt(997))
	numerator := new(big.Int).Mul(amountInWithFee, reserveOut)
	denominator := new(big.Int).Mul(reserveIn, big.NewInt(1000))
	denominator = denominator.Add(denominator, amountInWithFee)

	return new(big.Int).Div(numerator, denominator)
}

// getAmountIn calculates input amount for desired output
func (p *UniswapV2Provider) getAmountIn(amountOut, reserveIn, reserveOut *big.Int) *big.Int {
	// amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
	numerator := new(big.Int).Mul(reserveIn, amountOut)
	numerator = numerator.Mul(numerator, big.NewInt(1000))

	denominator := new(big.Int).Sub(reserveOut, amountOut)
	denominator = denominator.Mul(denominator, big.NewInt(997))

	result := new(big.Int).Div(numerator, denominator)
	return result.Add(result, big.NewInt(1))
}

func (p *UniswapV2Provider) computePairAddress(tokenA, tokenB string) string {
	// In production, compute CREATE2 address
	return fmt.Sprintf("0x%s", strings.Repeat("0", 38)+"02")
}

func (p *UniswapV2Provider) encodeSwapExactTokensForTokens(amountIn, amountOutMin *big.Int, path []string, to string, deadline int64) string {
	// Function selector: swapExactTokensForTokens(uint256,uint256,address[],address,uint256)
	selector := "38ed1739"

	// Encode path array
	pathOffset := 160 // 5 * 32 bytes for other params
	pathLen := len(path)

	params := fmt.Sprintf(
		"%064x%064x%064x%064s%064x%064x",
		amountIn,
		amountOutMin,
		pathOffset,
		strings.TrimPrefix(to, "0x"),
		deadline,
		pathLen,
	)

	// Append path addresses
	for _, addr := range path {
		params += fmt.Sprintf("%064s", strings.TrimPrefix(addr, "0x"))
	}

	return "0x" + selector + params
}
