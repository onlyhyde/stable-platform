package model

import (
	"math/big"
	"time"
)

// Token represents an ERC20 token
type Token struct {
	Address  string `json:"address"`
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Decimals int    `json:"decimals"`
	ChainID  int    `json:"chainId"`
}

// Pool represents a liquidity pool
type Pool struct {
	Address   string   `json:"address"`
	Protocol  string   `json:"protocol"`  // uniswap_v2, uniswap_v3, curve, etc.
	Token0    Token    `json:"token0"`
	Token1    Token    `json:"token1"`
	Fee       int      `json:"fee"`       // basis points (e.g., 30 = 0.3%)
	Liquidity *big.Int `json:"liquidity"`
	Reserve0  *big.Int `json:"reserve0,omitempty"`
	Reserve1  *big.Int `json:"reserve1,omitempty"`
	SqrtPrice *big.Int `json:"sqrtPrice,omitempty"` // For Uniswap V3
	Tick      int      `json:"tick,omitempty"`       // For Uniswap V3
}

// RouteHop represents a single hop in a route
type RouteHop struct {
	Pool       Pool   `json:"pool"`
	TokenIn    Token  `json:"tokenIn"`
	TokenOut   Token  `json:"tokenOut"`
	AmountIn   string `json:"amountIn"`
	AmountOut  string `json:"amountOut"`
	PriceImpact float64 `json:"priceImpact"` // percentage
}

// Route represents a swap route (can have multiple hops)
type Route struct {
	Hops         []RouteHop `json:"hops"`
	AmountIn     string     `json:"amountIn"`
	AmountOut    string     `json:"amountOut"`
	PriceImpact  float64    `json:"priceImpact"`
	GasEstimate  uint64     `json:"gasEstimate"`
	Protocol     string     `json:"protocol"` // Primary protocol or "split"
}

// SplitRoute represents a route split across multiple paths
type SplitRoute struct {
	Routes      []Route `json:"routes"`
	Percentages []int   `json:"percentages"` // Percentage allocation for each route (sum = 100)
	TotalIn     string  `json:"totalIn"`
	TotalOut    string  `json:"totalOut"`
	GasEstimate uint64  `json:"gasEstimate"`
}

// QuoteRequest represents a request for a price quote
type QuoteRequest struct {
	TokenIn     string `json:"tokenIn" binding:"required"`
	TokenOut    string `json:"tokenOut" binding:"required"`
	AmountIn    string `json:"amountIn,omitempty"`
	AmountOut   string `json:"amountOut,omitempty"` // For exactOut quotes
	Slippage    float64 `json:"slippage,omitempty"` // basis points
	MaxHops     int    `json:"maxHops,omitempty"`
	MaxSplits   int    `json:"maxSplits,omitempty"`
	Protocols   []string `json:"protocols,omitempty"` // Filter by protocol
	ExcludeDEXs []string `json:"excludeDEXs,omitempty"`
}

// QuoteResponse represents a price quote response
type QuoteResponse struct {
	TokenIn       Token       `json:"tokenIn"`
	TokenOut      Token       `json:"tokenOut"`
	AmountIn      string      `json:"amountIn"`
	AmountOut     string      `json:"amountOut"`
	AmountOutMin  string      `json:"amountOutMin"` // After slippage
	PriceImpact   float64     `json:"priceImpact"`
	GasEstimate   uint64      `json:"gasEstimate"`
	GasPrice      string      `json:"gasPrice"`
	Route         *Route      `json:"route,omitempty"`
	SplitRoute    *SplitRoute `json:"splitRoute,omitempty"`
	Protocols     []string    `json:"protocols"`
	Source        string      `json:"source"` // "native", "1inch", "0x"
	ExpiresAt     time.Time   `json:"expiresAt"`
}

// SwapRequest represents a request to execute a swap
type SwapRequest struct {
	TokenIn      string  `json:"tokenIn" binding:"required"`
	TokenOut     string  `json:"tokenOut" binding:"required"`
	AmountIn     string  `json:"amountIn" binding:"required"`
	AmountOutMin string  `json:"amountOutMin" binding:"required"`
	Recipient    string  `json:"recipient" binding:"required"`
	Slippage     float64 `json:"slippage,omitempty"`
	Deadline     int64   `json:"deadline,omitempty"` // Unix timestamp
	Protocols    []string `json:"protocols,omitempty"`
}

// SwapResponse represents a swap execution response
type SwapResponse struct {
	To       string `json:"to"`       // Router/aggregator address
	Data     string `json:"data"`     // Calldata for the swap
	Value    string `json:"value"`    // ETH value (for ETH swaps)
	GasLimit uint64 `json:"gasLimit"`
	Quote    QuoteResponse `json:"quote"`
}

// AggregatorQuote represents a quote from an aggregator
type AggregatorQuote struct {
	Source      string   `json:"source"` // "1inch", "0x"
	AmountOut   string   `json:"amountOut"`
	GasEstimate uint64   `json:"gasEstimate"`
	Protocols   []string `json:"protocols"`
	To          string   `json:"to"`
	Data        string   `json:"data"`
	Value       string   `json:"value"`
}
