// Package gas provides multi-mode gas estimation for transactions.
package gas

import (
	"context"
	"fmt"
	"math/big"
	"sync"

	"github.com/stablenet/sdk-go/config"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Gas Price Info
// ============================================================================

// GasPriceInfo contains current gas price information.
type GasPriceInfo struct {
	// BaseFee is the base fee per gas.
	BaseFee *big.Int `json:"baseFee"`

	// MaxPriorityFeePerGas is the max priority fee per gas.
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`

	// MaxFeePerGas is the max fee per gas (recommended).
	MaxFeePerGas *big.Int `json:"maxFeePerGas"`

	// GasPrice is the gas price for legacy transactions.
	GasPrice *big.Int `json:"gasPrice"`
}

// ============================================================================
// ERC20 Gas Estimate
// ============================================================================

// ERC20GasEstimate extends GasEstimate with ERC20 payment info.
type ERC20GasEstimate struct {
	types.GasEstimate

	// TokenAddress is the token address for payment.
	TokenAddress types.Address `json:"tokenAddress"`

	// TokenSymbol is the token symbol.
	TokenSymbol string `json:"tokenSymbol"`

	// TokenDecimals is the token decimals.
	TokenDecimals uint8 `json:"tokenDecimals"`

	// TokenAmount is the estimated token amount for gas.
	TokenAmount *big.Int `json:"tokenAmount"`

	// ExchangeRate is the tokens per 1 ETH.
	ExchangeRate *big.Int `json:"exchangeRate"`
}

// ============================================================================
// Gas Strategy Interface
// ============================================================================

// Strategy represents a gas estimation strategy for a specific transaction mode.
type Strategy interface {
	// Mode returns the transaction mode this strategy handles.
	Mode() types.TransactionMode

	// Supports checks if this strategy supports the given request.
	Supports(request *types.MultiModeTransactionRequest) bool

	// Estimate estimates gas for the given request.
	Estimate(ctx context.Context, request *types.MultiModeTransactionRequest, gasPrices *GasPriceInfo) (*types.GasEstimate, error)
}

// ============================================================================
// Strategy Registry
// ============================================================================

// StrategyRegistry manages gas estimation strategies.
type StrategyRegistry struct {
	mu         sync.RWMutex
	strategies map[types.TransactionMode]Strategy
}

// NewStrategyRegistry creates a new strategy registry.
func NewStrategyRegistry() *StrategyRegistry {
	return &StrategyRegistry{
		strategies: make(map[types.TransactionMode]Strategy),
	}
}

// Register registers a strategy.
func (r *StrategyRegistry) Register(strategy Strategy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.strategies[strategy.Mode()] = strategy
}

// GetStrategy returns the strategy for a mode.
func (r *StrategyRegistry) GetStrategy(mode types.TransactionMode) (Strategy, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	strategy, ok := r.strategies[mode]
	return strategy, ok
}

// GetAllStrategies returns all registered strategies.
func (r *StrategyRegistry) GetAllStrategies() []Strategy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	strategies := make([]Strategy, 0, len(r.strategies))
	for _, s := range r.strategies {
		strategies = append(strategies, s)
	}
	return strategies
}

// ============================================================================
// Gas Estimator Config
// ============================================================================

// EstimatorConfig configures the gas estimator.
type EstimatorConfig struct {
	// RpcUrl is the RPC URL for the network.
	RpcUrl string

	// ChainId is the chain ID.
	ChainId uint64

	// BundlerUrl is the bundler RPC URL (for Smart Account mode).
	BundlerUrl string

	// PaymasterUrl is the paymaster RPC URL (for sponsored/ERC20 gas).
	PaymasterUrl string
}

// ============================================================================
// Gas Estimator
// ============================================================================

// Estimator provides multi-mode gas estimation.
type Estimator struct {
	config   EstimatorConfig
	registry *StrategyRegistry
}

// NewEstimator creates a new gas estimator.
func NewEstimator(cfg EstimatorConfig) *Estimator {
	registry := NewStrategyRegistry()

	// Register built-in strategies
	registry.Register(NewEOAStrategy(cfg))
	registry.Register(NewEIP7702Strategy(cfg))
	registry.Register(NewSmartAccountStrategy(cfg))

	return &Estimator{
		config:   cfg,
		registry: registry,
	}
}

// GetGasPrices gets current gas prices from the network.
func (e *Estimator) GetGasPrices(ctx context.Context) (*GasPriceInfo, error) {
	// In production, this should query the RPC endpoint
	// For now, return default values
	baseFee := new(big.Int).Mul(big.NewInt(30), big.NewInt(1e9)) // 30 gwei
	maxPriorityFee := new(big.Int).Mul(big.NewInt(2), big.NewInt(1e9)) // 2 gwei
	maxFee := new(big.Int).Add(
		new(big.Int).Mul(baseFee, big.NewInt(2)),
		maxPriorityFee,
	) // 2 * baseFee + priorityFee

	return &GasPriceInfo{
		BaseFee:              baseFee,
		MaxPriorityFeePerGas: maxPriorityFee,
		MaxFeePerGas:         maxFee,
		GasPrice:             new(big.Int).Add(baseFee, maxPriorityFee),
	}, nil
}

// Estimate estimates gas based on transaction mode.
func (e *Estimator) Estimate(ctx context.Context, request *types.MultiModeTransactionRequest) (*types.GasEstimate, error) {
	strategy, ok := e.registry.GetStrategy(request.Mode)
	if !ok {
		return nil, fmt.Errorf("unknown transaction mode: %s", request.Mode)
	}

	gasPrices, err := e.GetGasPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas prices: %w", err)
	}

	return strategy.Estimate(ctx, request, gasPrices)
}

// EstimateAllModes estimates gas for all available modes.
func (e *Estimator) EstimateAllModes(ctx context.Context, request *types.MultiModeTransactionRequest) map[types.TransactionMode]*types.GasEstimate {
	results := make(map[types.TransactionMode]*types.GasEstimate)

	gasPrices, err := e.GetGasPrices(ctx)
	if err != nil {
		return results
	}

	// Run all estimations
	strategies := e.registry.GetAllStrategies()
	for _, strategy := range strategies {
		req := *request
		req.Mode = strategy.Mode()

		if strategy.Supports(&req) {
			estimate, err := strategy.Estimate(ctx, &req, gasPrices)
			if err == nil {
				results[strategy.Mode()] = estimate
			}
		}
	}

	return results
}

// RegisterStrategy registers a custom gas estimation strategy.
func (e *Estimator) RegisterStrategy(strategy Strategy) {
	e.registry.Register(strategy)
}

// FormatEstimate formats a gas estimate for display.
func FormatEstimate(estimate *types.GasEstimate) map[string]string {
	ethCost := new(big.Float).Quo(
		new(big.Float).SetInt(estimate.EstimatedCost),
		new(big.Float).SetInt64(1e18),
	)

	return map[string]string{
		"gasLimit":         estimate.GasLimit.String(),
		"maxFeePerGas":     formatGwei(estimate.MaxFeePerGas) + " gwei",
		"estimatedCost":    estimate.EstimatedCost.String() + " wei",
		"estimatedCostEth": ethCost.Text('f', 6) + " ETH",
	}
}

// formatGwei formats a value in gwei.
func formatGwei(wei *big.Int) string {
	gwei := new(big.Float).Quo(
		new(big.Float).SetInt(wei),
		new(big.Float).SetInt64(1e9),
	)
	return gwei.Text('f', 2)
}

// ============================================================================
// EOA Strategy
// ============================================================================

// EOAStrategy estimates gas for EOA transactions.
type EOAStrategy struct {
	config EstimatorConfig
}

// NewEOAStrategy creates a new EOA gas strategy.
func NewEOAStrategy(cfg EstimatorConfig) *EOAStrategy {
	return &EOAStrategy{config: cfg}
}

// Mode returns the transaction mode.
func (s *EOAStrategy) Mode() types.TransactionMode {
	return types.TransactionModeEOA
}

// Supports checks if this strategy supports the request.
func (s *EOAStrategy) Supports(request *types.MultiModeTransactionRequest) bool {
	return request.Mode == types.TransactionModeEOA
}

// Estimate estimates gas for EOA transaction.
func (s *EOAStrategy) Estimate(ctx context.Context, request *types.MultiModeTransactionRequest, gasPrices *GasPriceInfo) (*types.GasEstimate, error) {
	// Calculate gas limit based on data size
	gasLimit := new(big.Int).Set(config.GasConfig.BaseTransferGas)

	if len(request.Data) > 0 {
		calldataGas := config.CalculateCalldataGas(request.Data)
		gasLimit.Add(gasLimit, calldataGas)
	}

	// Apply buffer
	gasLimit = config.ApplyGasBuffer(gasLimit)

	// Calculate estimated cost
	estimatedCost := new(big.Int).Mul(gasLimit, gasPrices.MaxFeePerGas)

	return &types.GasEstimate{
		GasLimit:             gasLimit,
		MaxFeePerGas:         gasPrices.MaxFeePerGas,
		MaxPriorityFeePerGas: gasPrices.MaxPriorityFeePerGas,
		EstimatedCost:        estimatedCost,
	}, nil
}

// ============================================================================
// EIP-7702 Strategy
// ============================================================================

// EIP7702Strategy estimates gas for EIP-7702 transactions.
type EIP7702Strategy struct {
	config EstimatorConfig
}

// NewEIP7702Strategy creates a new EIP-7702 gas strategy.
func NewEIP7702Strategy(cfg EstimatorConfig) *EIP7702Strategy {
	return &EIP7702Strategy{config: cfg}
}

// Mode returns the transaction mode.
func (s *EIP7702Strategy) Mode() types.TransactionMode {
	return types.TransactionModeEIP7702
}

// Supports checks if this strategy supports the request.
func (s *EIP7702Strategy) Supports(request *types.MultiModeTransactionRequest) bool {
	return request.Mode == types.TransactionModeEIP7702
}

// Estimate estimates gas for EIP-7702 transaction.
func (s *EIP7702Strategy) Estimate(ctx context.Context, request *types.MultiModeTransactionRequest, gasPrices *GasPriceInfo) (*types.GasEstimate, error) {
	// Base gas
	gasLimit := new(big.Int).Set(config.GasConfig.BaseTransferGas)

	// Add delegation gas
	gasLimit.Add(gasLimit, config.GasConfig.EIP7702DelegationGas)

	// Add authorization gas
	numAuthorizations := len(request.AuthorizationList)
	if numAuthorizations > 0 {
		authGas := config.CalculateEIP7702Gas(numAuthorizations)
		gasLimit.Add(gasLimit, authGas)
	}

	// Add calldata gas
	if len(request.Data) > 0 {
		calldataGas := config.CalculateCalldataGas(request.Data)
		gasLimit.Add(gasLimit, calldataGas)
	}

	// Apply buffer
	gasLimit = config.ApplyGasBuffer(gasLimit)

	// Calculate estimated cost
	estimatedCost := new(big.Int).Mul(gasLimit, gasPrices.MaxFeePerGas)

	return &types.GasEstimate{
		GasLimit:             gasLimit,
		MaxFeePerGas:         gasPrices.MaxFeePerGas,
		MaxPriorityFeePerGas: gasPrices.MaxPriorityFeePerGas,
		EstimatedCost:        estimatedCost,
	}, nil
}

// ============================================================================
// Smart Account Strategy
// ============================================================================

// SmartAccountStrategy estimates gas for Smart Account transactions.
type SmartAccountStrategy struct {
	config EstimatorConfig
}

// NewSmartAccountStrategy creates a new Smart Account gas strategy.
func NewSmartAccountStrategy(cfg EstimatorConfig) *SmartAccountStrategy {
	return &SmartAccountStrategy{config: cfg}
}

// Mode returns the transaction mode.
func (s *SmartAccountStrategy) Mode() types.TransactionMode {
	return types.TransactionModeSmartAccount
}

// Supports checks if this strategy supports the request.
func (s *SmartAccountStrategy) Supports(request *types.MultiModeTransactionRequest) bool {
	return request.Mode == types.TransactionModeSmartAccount
}

// Estimate estimates gas for Smart Account transaction.
func (s *SmartAccountStrategy) Estimate(ctx context.Context, request *types.MultiModeTransactionRequest, gasPrices *GasPriceInfo) (*types.GasEstimate, error) {
	// For Smart Account, we need to estimate UserOperation gas
	// In production, this should call the bundler's eth_estimateUserOperationGas

	// Use default values
	preVerificationGas := new(big.Int).Set(config.GasConfig.DefaultPreVerificationGas)
	verificationGasLimit := new(big.Int).Set(config.GasConfig.DefaultVerificationGasLimit)
	callGasLimit := new(big.Int).Set(config.GasConfig.DefaultCallGasLimit)

	// Add calldata gas to call gas limit
	if len(request.Data) > 0 {
		calldataGas := config.CalculateCalldataGas(request.Data)
		callGasLimit.Add(callGasLimit, calldataGas)
	}

	// Total gas
	totalGas := new(big.Int).Add(preVerificationGas, verificationGasLimit)
	totalGas.Add(totalGas, callGasLimit)

	// Check for sponsored gas
	var estimatedCost *big.Int
	if request.GasPayment != nil && types.IsSponsoredGas(request.GasPayment) {
		// Sponsored - no cost to user
		estimatedCost = big.NewInt(0)
	} else {
		// User pays
		estimatedCost = new(big.Int).Mul(totalGas, gasPrices.MaxFeePerGas)
	}

	// Add paymaster gas if applicable
	var pmVerificationGas, pmPostOpGas *big.Int
	if request.GasPayment != nil && !types.IsNativeGas(request.GasPayment) {
		pmVerificationGas = new(big.Int).Set(config.GasConfig.PaymasterVerificationGas)
		pmPostOpGas = new(big.Int).Set(config.GasConfig.PaymasterPostOpGas)
	}

	return &types.GasEstimate{
		GasLimit:                      totalGas,
		MaxFeePerGas:                  gasPrices.MaxFeePerGas,
		MaxPriorityFeePerGas:          gasPrices.MaxPriorityFeePerGas,
		EstimatedCost:                 estimatedCost,
		PreVerificationGas:            preVerificationGas,
		VerificationGasLimit:          verificationGasLimit,
		CallGasLimit:                  callGasLimit,
		PaymasterVerificationGasLimit: pmVerificationGas,
		PaymasterPostOpGasLimit:       pmPostOpGas,
	}, nil
}
