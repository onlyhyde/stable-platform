package provider

import (
	"context"
	"math/big"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// DEXProvider defines the interface for DEX protocol providers
type DEXProvider interface {
	// Name returns the protocol name
	Name() string

	// GetPools returns available pools for a token pair
	GetPools(ctx context.Context, tokenIn, tokenOut string) ([]model.Pool, error)

	// GetQuote returns a quote for a swap
	GetQuote(ctx context.Context, tokenIn, tokenOut string, amountIn *big.Int) (*model.Route, error)

	// GetQuoteExactOut returns a quote for exact output amount
	GetQuoteExactOut(ctx context.Context, tokenIn, tokenOut string, amountOut *big.Int) (*model.Route, error)

	// BuildSwapCalldata builds the calldata for executing a swap
	BuildSwapCalldata(ctx context.Context, route *model.Route, recipient string, deadline int64, slippage float64) (to string, data string, value string, err error)

	// EstimateGas estimates gas for a swap
	EstimateGas(ctx context.Context, route *model.Route) (uint64, error)

	// SupportedFees returns supported fee tiers (for V3-style DEXs)
	SupportedFees() []int

	// IsV3Style returns true if the DEX uses concentrated liquidity
	IsV3Style() bool
}

// ProviderRegistry holds all registered DEX providers
type ProviderRegistry struct {
	providers map[string]DEXProvider
}

// NewProviderRegistry creates a new provider registry
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[string]DEXProvider),
	}
}

// Register adds a provider to the registry
func (r *ProviderRegistry) Register(provider DEXProvider) {
	r.providers[provider.Name()] = provider
}

// Get returns a provider by name
func (r *ProviderRegistry) Get(name string) (DEXProvider, bool) {
	p, ok := r.providers[name]
	return p, ok
}

// GetAll returns all registered providers
func (r *ProviderRegistry) GetAll() []DEXProvider {
	providers := make([]DEXProvider, 0, len(r.providers))
	for _, p := range r.providers {
		providers = append(providers, p)
	}
	return providers
}

// GetByNames returns providers filtered by names
func (r *ProviderRegistry) GetByNames(names []string) []DEXProvider {
	if len(names) == 0 {
		return r.GetAll()
	}

	providers := make([]DEXProvider, 0)
	for _, name := range names {
		if p, ok := r.providers[name]; ok {
			providers = append(providers, p)
		}
	}
	return providers
}

// Exclude returns providers excluding specified names
func (r *ProviderRegistry) Exclude(names []string) []DEXProvider {
	if len(names) == 0 {
		return r.GetAll()
	}

	excludeMap := make(map[string]bool)
	for _, name := range names {
		excludeMap[name] = true
	}

	providers := make([]DEXProvider, 0)
	for name, p := range r.providers {
		if !excludeMap[name] {
			providers = append(providers, p)
		}
	}
	return providers
}
