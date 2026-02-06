package transaction

import (
	"context"
	"fmt"
	"math/big"
	"sort"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Enhanced Router
// ============================================================================

// EnhancedRouter extends Router with additional functionality for mode resolution
// and multi-mode estimation.
type EnhancedRouter struct {
	*Router
}

// NewEnhancedRouter creates a new enhanced transaction router.
func NewEnhancedRouter(registry Registry) *EnhancedRouter {
	return &EnhancedRouter{
		Router: NewRouter(registry),
	}
}

// ModeWithEstimate contains a transaction mode with its gas estimate.
type ModeWithEstimate struct {
	// Mode is the transaction mode.
	Mode types.TransactionMode `json:"mode"`
	// GasEstimate is the gas estimate for this mode.
	GasEstimate *types.GasEstimate `json:"gasEstimate"`
	// Supported indicates if this mode is supported for the account.
	Supported bool `json:"supported"`
	// Error contains any error that occurred during estimation.
	Error string `json:"error,omitempty"`
}

// ResolveMode determines the best transaction mode for the given account.
// It returns the most appropriate mode based on account type.
func (r *EnhancedRouter) ResolveMode(account Account) (types.TransactionMode, error) {
	// Check modes in order of preference
	// Smart Account mode is preferred for deployed smart accounts
	if account.IsSmartAccount() {
		if strategy, ok := r.registry.Get(types.TransactionModeSmartAccount); ok {
			if strategy.Supports(account) {
				return types.TransactionModeSmartAccount, nil
			}
		}
	}

	// EIP-7702 mode for delegated EOAs
	if account.IsDelegated() {
		if strategy, ok := r.registry.Get(types.TransactionModeEIP7702); ok {
			if strategy.Supports(account) {
				return types.TransactionModeEIP7702, nil
			}
		}
	}

	// Fall back to EOA mode
	if strategy, ok := r.registry.Get(types.TransactionModeEOA); ok {
		if strategy.Supports(account) {
			return types.TransactionModeEOA, nil
		}
	}

	return "", fmt.Errorf("no supported transaction mode found for account")
}

// GetAvailableModesWithEstimates returns all available modes with their gas estimates.
func (r *EnhancedRouter) GetAvailableModesWithEstimates(
	ctx context.Context,
	request *types.MultiModeTransactionRequest,
	account Account,
) ([]ModeWithEstimate, error) {
	strategies := r.registry.GetAll()
	results := make([]ModeWithEstimate, 0, len(strategies))

	for _, strategy := range strategies {
		result := ModeWithEstimate{
			Mode:      strategy.Mode(),
			Supported: strategy.Supports(account),
		}

		if !result.Supported {
			result.Error = "account type not supported"
			results = append(results, result)
			continue
		}

		// Create a copy of the request with this mode
		modifiedRequest := *request
		modifiedRequest.Mode = strategy.Mode()

		// Validate
		if err := strategy.Validate(&modifiedRequest, account); err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		// Prepare to get gas estimate
		prepared, err := strategy.Prepare(ctx, &modifiedRequest, account)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		result.GasEstimate = prepared.GasEstimate
		results = append(results, result)
	}

	// Sort by estimated cost (lowest first)
	sort.Slice(results, func(i, j int) bool {
		// Unsupported modes go last
		if !results[i].Supported {
			return false
		}
		if !results[j].Supported {
			return true
		}

		// Modes with errors go after supported modes without errors
		if results[i].Error != "" && results[j].Error == "" {
			return false
		}
		if results[i].Error == "" && results[j].Error != "" {
			return true
		}

		// Sort by estimated cost
		if results[i].GasEstimate != nil && results[j].GasEstimate != nil {
			return results[i].GasEstimate.EstimatedCost.Cmp(results[j].GasEstimate.EstimatedCost) < 0
		}

		return false
	})

	return results, nil
}

// GetSupportedModes returns all modes supported for the given account.
func (r *EnhancedRouter) GetSupportedModes(account Account) []types.TransactionMode {
	strategies := r.registry.GetAll()
	modes := make([]types.TransactionMode, 0, len(strategies))

	for _, strategy := range strategies {
		if strategy.Supports(account) {
			modes = append(modes, strategy.Mode())
		}
	}

	return modes
}

// RouteAuto automatically determines the best mode and executes the transaction.
func (r *EnhancedRouter) RouteAuto(
	ctx context.Context,
	request *types.MultiModeTransactionRequest,
	account Account,
	signer Signer,
	options *ExecuteOptions,
) (*types.TransactionResult, error) {
	// Resolve the best mode
	mode, err := r.ResolveMode(account)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve transaction mode: %w", err)
	}

	// Update request with resolved mode
	request.Mode = mode

	// Route the transaction
	return r.Route(ctx, request, account, signer, options)
}

// PrepareAuto automatically determines the best mode and prepares the transaction.
func (r *EnhancedRouter) PrepareAuto(
	ctx context.Context,
	request *types.MultiModeTransactionRequest,
	account Account,
) (*PreparedTransaction, error) {
	// Resolve the best mode
	mode, err := r.ResolveMode(account)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve transaction mode: %w", err)
	}

	// Update request with resolved mode
	request.Mode = mode

	// Prepare the transaction
	return r.Prepare(ctx, request, account)
}

// ============================================================================
// Transaction Builder
// ============================================================================

// TransactionBuilder provides a fluent API for building and executing transactions.
type TransactionBuilder struct {
	router  *EnhancedRouter
	request *types.MultiModeTransactionRequest
	account Account
	signer  Signer
	options *ExecuteOptions
}

// NewTransactionBuilder creates a new transaction builder.
func NewTransactionBuilder(router *EnhancedRouter) *TransactionBuilder {
	return &TransactionBuilder{
		router:  router,
		request: &types.MultiModeTransactionRequest{},
		options: DefaultExecuteOptions(),
	}
}

// From sets the sender address.
func (b *TransactionBuilder) From(from types.Address) *TransactionBuilder {
	b.request.From = from
	return b
}

// To sets the recipient address.
func (b *TransactionBuilder) To(to types.Address) *TransactionBuilder {
	b.request.To = to
	return b
}

// Value sets the value to send.
func (b *TransactionBuilder) Value(value interface{}) *TransactionBuilder {
	switch v := value.(type) {
	case uint64:
		b.request.Value = new(big.Int).SetUint64(v)
	case int64:
		b.request.Value = big.NewInt(v)
	case *big.Int:
		b.request.Value = v
	}
	return b
}

// Data sets the transaction data.
func (b *TransactionBuilder) Data(data types.Hex) *TransactionBuilder {
	b.request.Data = data
	return b
}

// Mode sets the transaction mode.
func (b *TransactionBuilder) Mode(mode types.TransactionMode) *TransactionBuilder {
	b.request.Mode = mode
	return b
}

// GasPayment sets the gas payment configuration (for Smart Account mode).
func (b *TransactionBuilder) GasPayment(config *types.GasPaymentConfig) *TransactionBuilder {
	b.request.GasPayment = config
	return b
}

// Account sets the account for the transaction.
func (b *TransactionBuilder) Account(account Account) *TransactionBuilder {
	b.account = account
	return b
}

// Signer sets the signer for the transaction.
func (b *TransactionBuilder) Signer(signer Signer) *TransactionBuilder {
	b.signer = signer
	return b
}

// WaitForConfirmation sets whether to wait for confirmation.
func (b *TransactionBuilder) WaitForConfirmation(wait bool) *TransactionBuilder {
	b.options.WaitForConfirmation = wait
	return b
}

// Confirmations sets the number of confirmations to wait for.
func (b *TransactionBuilder) Confirmations(n uint64) *TransactionBuilder {
	b.options.Confirmations = n
	return b
}

// Prepare prepares the transaction without executing.
func (b *TransactionBuilder) Prepare(ctx context.Context) (*PreparedTransaction, error) {
	if b.request.Mode == "" {
		return b.router.PrepareAuto(ctx, b.request, b.account)
	}
	return b.router.Prepare(ctx, b.request, b.account)
}

// Execute executes the transaction.
func (b *TransactionBuilder) Execute(ctx context.Context) (*types.TransactionResult, error) {
	if b.signer == nil {
		return nil, fmt.Errorf("signer is required")
	}

	if b.request.Mode == "" {
		return b.router.RouteAuto(ctx, b.request, b.account, b.signer, b.options)
	}
	return b.router.Route(ctx, b.request, b.account, b.signer, b.options)
}
