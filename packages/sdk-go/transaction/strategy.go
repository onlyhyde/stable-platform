// Package transaction provides multi-mode transaction execution support.
// It implements the Strategy pattern for handling different transaction modes:
// EOA, EIP-7702, and Smart Account.
package transaction

import (
	"context"
	"sync"
	"time"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Strategy Interface
// ============================================================================

// PreparedTransaction represents a transaction prepared for execution.
type PreparedTransaction struct {
	// Mode is the transaction mode.
	Mode types.TransactionMode `json:"mode"`

	// Request is the original transaction request.
	Request *types.MultiModeTransactionRequest `json:"request"`

	// GasEstimate is the gas estimate for this transaction.
	GasEstimate *types.GasEstimate `json:"gasEstimate"`

	// StrategyData holds mode-specific data (opaque to router).
	StrategyData any `json:"strategyData,omitempty"`
}

// ExecuteOptions represents options for executing a prepared transaction.
type ExecuteOptions struct {
	// WaitForConfirmation indicates whether to wait for confirmation.
	WaitForConfirmation bool `json:"waitForConfirmation,omitempty"`

	// Confirmations is the number of confirmations to wait for.
	Confirmations uint64 `json:"confirmations,omitempty"`

	// Timeout is the timeout duration.
	Timeout time.Duration `json:"timeout,omitempty"`
}

// DefaultExecuteOptions returns the default execute options.
func DefaultExecuteOptions() *ExecuteOptions {
	return &ExecuteOptions{
		WaitForConfirmation: true,
		Confirmations:       1,
		Timeout:             60 * time.Second,
	}
}

// Account represents an account that can send transactions.
type Account interface {
	// Address returns the account address.
	Address() types.Address

	// ChainId returns the chain ID.
	ChainId() uint64

	// IsSmartAccount returns true if this is a smart account.
	IsSmartAccount() bool

	// IsDelegated returns true if this EOA has EIP-7702 delegation.
	IsDelegated() bool
}

// Signer represents a transaction signer.
type Signer interface {
	// SignTransaction signs a transaction and returns the raw signed transaction.
	SignTransaction(ctx context.Context, tx *types.MultiModeTransactionRequest) (types.Hex, error)

	// SignAuthorization signs an EIP-7702 authorization.
	SignAuthorization(ctx context.Context, chainId uint64, delegateAddress types.Address, nonce uint64) (*types.EIP7702SignedAuthorization, error)

	// SignUserOperation signs a UserOperation for Smart Account mode.
	SignUserOperation(ctx context.Context, userOpHash types.Hash) (types.Hex, error)
}

// Strategy represents a transaction execution strategy.
// Each strategy handles preparation and execution for a specific transaction mode.
type Strategy interface {
	// Mode returns the transaction mode this strategy handles.
	Mode() types.TransactionMode

	// Supports checks if this strategy supports the given account.
	Supports(account Account) bool

	// Validate validates the request for this mode.
	Validate(request *types.MultiModeTransactionRequest, account Account) error

	// Prepare prepares a transaction for execution.
	Prepare(ctx context.Context, request *types.MultiModeTransactionRequest, account Account) (*PreparedTransaction, error)

	// Execute executes a prepared transaction.
	Execute(ctx context.Context, prepared *PreparedTransaction, signer Signer, options *ExecuteOptions) (*types.TransactionResult, error)

	// WaitForConfirmation waits for transaction confirmation.
	WaitForConfirmation(ctx context.Context, hash types.Hash, confirmations uint64, timeout time.Duration) error
}

// ============================================================================
// Strategy Configuration
// ============================================================================

// BaseStrategyConfig is the base configuration for all strategies.
type BaseStrategyConfig struct {
	// RpcUrl is the RPC URL.
	RpcUrl string `json:"rpcUrl"`

	// ChainId is the chain ID.
	ChainId uint64 `json:"chainId"`
}

// SmartAccountStrategyConfig is the configuration for Smart Account strategy.
type SmartAccountStrategyConfig struct {
	BaseStrategyConfig

	// BundlerUrl is the bundler URL.
	BundlerUrl string `json:"bundlerUrl"`

	// PaymasterUrl is the paymaster URL (optional).
	PaymasterUrl string `json:"paymasterUrl,omitempty"`

	// EntryPointAddress is the entry point address.
	EntryPointAddress *types.Address `json:"entryPointAddress,omitempty"`
}

// ============================================================================
// Strategy Registry
// ============================================================================

// Registry manages available transaction strategies.
type Registry interface {
	// Register registers a strategy.
	Register(strategy Strategy)

	// Get returns the strategy for a mode.
	Get(mode types.TransactionMode) (Strategy, bool)

	// GetAll returns all registered strategies.
	GetAll() []Strategy

	// Supports checks if a mode is supported.
	Supports(mode types.TransactionMode) bool
}

// registry is the default implementation of Registry.
type registry struct {
	mu         sync.RWMutex
	strategies map[types.TransactionMode]Strategy
}

// NewRegistry creates a new strategy registry.
func NewRegistry() Registry {
	return &registry{
		strategies: make(map[types.TransactionMode]Strategy),
	}
}

// Register registers a strategy.
func (r *registry) Register(strategy Strategy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.strategies[strategy.Mode()] = strategy
}

// Get returns the strategy for a mode.
func (r *registry) Get(mode types.TransactionMode) (Strategy, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	strategy, ok := r.strategies[mode]
	return strategy, ok
}

// GetAll returns all registered strategies.
func (r *registry) GetAll() []Strategy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	strategies := make([]Strategy, 0, len(r.strategies))
	for _, s := range r.strategies {
		strategies = append(strategies, s)
	}
	return strategies
}

// Supports checks if a mode is supported.
func (r *registry) Supports(mode types.TransactionMode) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.strategies[mode]
	return ok
}

// ============================================================================
// Transaction Router
// ============================================================================

// Router routes transaction requests to the appropriate strategy.
type Router struct {
	registry Registry
}

// NewRouter creates a new transaction router with the given registry.
func NewRouter(registry Registry) *Router {
	return &Router{registry: registry}
}

// Route prepares and executes a transaction using the appropriate strategy.
func (r *Router) Route(
	ctx context.Context,
	request *types.MultiModeTransactionRequest,
	account Account,
	signer Signer,
	options *ExecuteOptions,
) (*types.TransactionResult, error) {
	// Get strategy for the requested mode
	strategy, ok := r.registry.Get(request.Mode)
	if !ok {
		return nil, &UnsupportedModeError{Mode: request.Mode}
	}

	// Check if strategy supports this account
	if !strategy.Supports(account) {
		return nil, &AccountNotSupportedError{Mode: request.Mode, Account: account.Address()}
	}

	// Validate the request
	if err := strategy.Validate(request, account); err != nil {
		return nil, err
	}

	// Prepare the transaction
	prepared, err := strategy.Prepare(ctx, request, account)
	if err != nil {
		return nil, err
	}

	// Use default options if not provided
	if options == nil {
		options = DefaultExecuteOptions()
	}

	// Execute the transaction
	return strategy.Execute(ctx, prepared, signer, options)
}

// Prepare prepares a transaction without executing it.
func (r *Router) Prepare(
	ctx context.Context,
	request *types.MultiModeTransactionRequest,
	account Account,
) (*PreparedTransaction, error) {
	strategy, ok := r.registry.Get(request.Mode)
	if !ok {
		return nil, &UnsupportedModeError{Mode: request.Mode}
	}

	if !strategy.Supports(account) {
		return nil, &AccountNotSupportedError{Mode: request.Mode, Account: account.Address()}
	}

	if err := strategy.Validate(request, account); err != nil {
		return nil, err
	}

	return strategy.Prepare(ctx, request, account)
}

// Execute executes a prepared transaction.
func (r *Router) Execute(
	ctx context.Context,
	prepared *PreparedTransaction,
	signer Signer,
	options *ExecuteOptions,
) (*types.TransactionResult, error) {
	strategy, ok := r.registry.Get(prepared.Mode)
	if !ok {
		return nil, &UnsupportedModeError{Mode: prepared.Mode}
	}

	if options == nil {
		options = DefaultExecuteOptions()
	}

	return strategy.Execute(ctx, prepared, signer, options)
}

// ============================================================================
// Router Errors
// ============================================================================

// UnsupportedModeError is returned when a transaction mode is not supported.
type UnsupportedModeError struct {
	Mode types.TransactionMode
}

func (e *UnsupportedModeError) Error() string {
	return "unsupported transaction mode: " + string(e.Mode)
}

// AccountNotSupportedError is returned when an account is not supported by a strategy.
type AccountNotSupportedError struct {
	Mode    types.TransactionMode
	Account types.Address
}

func (e *AccountNotSupportedError) Error() string {
	return "account " + e.Account.Hex() + " is not supported for mode " + string(e.Mode)
}
