package aggregator

import (
	"context"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

// Aggregator defines the interface for DEX aggregator APIs
type Aggregator interface {
	// Name returns the aggregator name
	Name() string

	// GetQuote returns a quote from the aggregator
	GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.AggregatorQuote, error)

	// BuildSwap builds swap calldata
	BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error)

	// IsAvailable checks if the aggregator is configured and available
	IsAvailable() bool

	// SupportedChains returns supported chain IDs
	SupportedChains() []int
}

// AggregatorRegistry holds all registered aggregators
type AggregatorRegistry struct {
	aggregators map[string]Aggregator
}

// NewAggregatorRegistry creates a new aggregator registry
func NewAggregatorRegistry() *AggregatorRegistry {
	return &AggregatorRegistry{
		aggregators: make(map[string]Aggregator),
	}
}

// Register adds an aggregator to the registry
func (r *AggregatorRegistry) Register(agg Aggregator) {
	r.aggregators[agg.Name()] = agg
}

// Get returns an aggregator by name
func (r *AggregatorRegistry) Get(name string) (Aggregator, bool) {
	agg, ok := r.aggregators[name]
	return agg, ok
}

// GetAvailable returns all available aggregators
func (r *AggregatorRegistry) GetAvailable() []Aggregator {
	aggregators := make([]Aggregator, 0)
	for _, agg := range r.aggregators {
		if agg.IsAvailable() {
			aggregators = append(aggregators, agg)
		}
	}
	return aggregators
}
