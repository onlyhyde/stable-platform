package provider

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// quoterABIJSON defines the Uniswap V3 Quoter contract ABI
const quoterABIJSON = `[{
	"name":"quoteExactInputSingle","type":"function","stateMutability":"nonpayable",
	"inputs":[
		{"name":"tokenIn","type":"address"},
		{"name":"tokenOut","type":"address"},
		{"name":"fee","type":"uint24"},
		{"name":"amountIn","type":"uint256"},
		{"name":"sqrtPriceLimitX96","type":"uint160"}
	],
	"outputs":[{"name":"amountOut","type":"uint256"}]
},{
	"name":"quoteExactOutputSingle","type":"function","stateMutability":"nonpayable",
	"inputs":[
		{"name":"tokenIn","type":"address"},
		{"name":"tokenOut","type":"address"},
		{"name":"fee","type":"uint24"},
		{"name":"amountOut","type":"uint256"},
		{"name":"sqrtPriceLimitX96","type":"uint160"}
	],
	"outputs":[{"name":"amountIn","type":"uint256"}]
}]`

// v3PoolInitCodeHash is the Uniswap V3 pool creation code hash used for CREATE2 address computation
var v3PoolInitCodeHash = common.FromHex("e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54")

// UniswapV3Provider implements DEXProvider for Uniswap V3
type UniswapV3Provider struct {
	rpcURL      string
	routerAddr  string
	quoterAddr  string
	factoryAddr string
	chainID     int
	quoterABI   abi.ABI

	mu        sync.Mutex
	ethClient *ethclient.Client
}

// NewUniswapV3Provider creates a new Uniswap V3 provider
func NewUniswapV3Provider(rpcURL, routerAddr, quoterAddr string, chainID int) *UniswapV3Provider {
	parsedABI, _ := abi.JSON(strings.NewReader(quoterABIJSON))
	return &UniswapV3Provider{
		rpcURL:      rpcURL,
		routerAddr:  routerAddr,
		quoterAddr:  quoterAddr,
		factoryAddr: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3 Factory
		chainID:     chainID,
		quoterABI:   parsedABI,
	}
}

func (p *UniswapV3Provider) getClient() (*ethclient.Client, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.ethClient != nil {
		return p.ethClient, nil
	}
	client, err := ethclient.Dial(p.rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial RPC: %w", err)
	}
	p.ethClient = client
	return client, nil
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
			Token0:   model.Token{Address: tokenIn},
			Token1:   model.Token{Address: tokenOut},
			Fee:      fee,
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

// quoteExactInputSingle calls the Quoter contract via eth_call to get an accurate on-chain quote
func (p *UniswapV3Provider) quoteExactInputSingle(ctx context.Context, tokenIn, tokenOut string, fee int, amountIn *big.Int) (*big.Int, error) {
	client, err := p.getClient()
	if err != nil {
		return nil, err
	}

	data, err := p.quoterABI.Pack("quoteExactInputSingle",
		common.HexToAddress(tokenIn),
		common.HexToAddress(tokenOut),
		big.NewInt(int64(fee)),
		amountIn,
		big.NewInt(0), // sqrtPriceLimitX96 = 0 (no limit)
	)
	if err != nil {
		return nil, fmt.Errorf("pack quoter call: %w", err)
	}

	quoterAddr := common.HexToAddress(p.quoterAddr)
	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &quoterAddr,
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call quoter: %w", err)
	}

	values, err := p.quoterABI.Methods["quoteExactInputSingle"].Outputs.Unpack(result)
	if err != nil {
		return nil, fmt.Errorf("unpack quoter result: %w", err)
	}
	if len(values) == 0 {
		return nil, fmt.Errorf("empty quoter result")
	}

	amountOut, ok := values[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("unexpected quoter result type")
	}

	return amountOut, nil
}

// quoteExactOutputSingle calls the Quoter contract via eth_call for exact output quotes
func (p *UniswapV3Provider) quoteExactOutputSingle(ctx context.Context, tokenIn, tokenOut string, fee int, amountOut *big.Int) (*big.Int, error) {
	client, err := p.getClient()
	if err != nil {
		return nil, err
	}

	data, err := p.quoterABI.Pack("quoteExactOutputSingle",
		common.HexToAddress(tokenIn),
		common.HexToAddress(tokenOut),
		big.NewInt(int64(fee)),
		amountOut,
		big.NewInt(0), // sqrtPriceLimitX96 = 0 (no limit)
	)
	if err != nil {
		return nil, fmt.Errorf("pack quoter call: %w", err)
	}

	quoterAddr := common.HexToAddress(p.quoterAddr)
	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &quoterAddr,
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call quoter: %w", err)
	}

	values, err := p.quoterABI.Methods["quoteExactOutputSingle"].Outputs.Unpack(result)
	if err != nil {
		return nil, fmt.Errorf("unpack quoter result: %w", err)
	}
	if len(values) == 0 {
		return nil, fmt.Errorf("empty quoter result")
	}

	amountIn, ok := values[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("unexpected quoter result type")
	}

	return amountIn, nil
}

// computePoolAddress computes the Uniswap V3 pool address using CREATE2
func (p *UniswapV3Provider) computePoolAddress(tokenA, tokenB string, fee int) string {
	addrA := common.HexToAddress(tokenA)
	addrB := common.HexToAddress(tokenB)

	// Sort tokens (Uniswap convention: token0 < token1)
	var token0, token1 common.Address
	if bytes.Compare(addrA.Bytes(), addrB.Bytes()) < 0 {
		token0, token1 = addrA, addrB
	} else {
		token0, token1 = addrB, addrA
	}

	// Salt: keccak256(abi.encode(token0, token1, fee))
	addressTy, _ := abi.NewType("address", "", nil)
	uint24Ty, _ := abi.NewType("uint24", "", nil)
	args := abi.Arguments{
		{Type: addressTy},
		{Type: addressTy},
		{Type: uint24Ty},
	}
	salt, _ := args.Pack(token0, token1, big.NewInt(int64(fee)))
	saltHash := crypto.Keccak256(salt)

	// CREATE2: keccak256(0xff ++ factory ++ salt ++ init_code_hash)
	factory := common.HexToAddress(p.factoryAddr)
	data := make([]byte, 1+20+32+32)
	data[0] = 0xff
	copy(data[1:21], factory.Bytes())
	copy(data[21:53], saltHash)
	copy(data[53:85], v3PoolInitCodeHash)

	return common.BytesToAddress(crypto.Keccak256(data)[12:]).Hex()
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
