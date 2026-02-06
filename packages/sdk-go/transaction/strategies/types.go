// Package strategies provides transaction execution strategies for different modes.
//
// The package implements three transaction strategies:
//   - EOAStrategy: Direct EOA transactions via eth_sendTransaction
//   - EIP7702Strategy: EIP-7702 SetCode transactions for delegation
//   - SmartAccountStrategy: ERC-4337 UserOperations via bundler
//
// Each strategy implements the transaction.Strategy interface, providing:
//   - Mode identification
//   - Account support checking
//   - Request validation
//   - Transaction preparation
//   - Transaction execution
//   - Confirmation waiting
//
// Usage:
//
//	// Create a strategy registry
//	registry := transaction.NewRegistry()
//
//	// Register strategies
//	eoaStrategy, _ := strategies.NewEOAStrategy(strategies.EOAStrategyConfig{
//	    RpcUrl:  "https://eth-mainnet.g.alchemy.com/v2/...",
//	    ChainId: 1,
//	})
//	registry.Register(eoaStrategy)
//
//	eip7702Strategy, _ := strategies.NewEIP7702Strategy(strategies.EIP7702StrategyConfig{
//	    RpcUrl:  "https://eth-mainnet.g.alchemy.com/v2/...",
//	    ChainId: 1,
//	})
//	registry.Register(eip7702Strategy)
//
//	smartAccountStrategy, _ := strategies.NewSmartAccountStrategy(strategies.SmartAccountStrategyConfig{
//	    RpcUrl:     "https://eth-mainnet.g.alchemy.com/v2/...",
//	    ChainId:    1,
//	    BundlerUrl: "https://api.pimlico.io/v2/1/rpc?apikey=...",
//	})
//	registry.Register(smartAccountStrategy)
//
//	// Create router and execute transactions
//	router := transaction.NewRouter(registry)
//	result, err := router.Route(ctx, request, account, signer, nil)
package strategies

import (
	"github.com/stablenet/sdk-go/transaction"
	sdktypes "github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Strategy Factory Functions
// ============================================================================

// StrategyType represents the type of transaction strategy.
type StrategyType string

// Strategy type constants.
const (
	StrategyTypeEOA          StrategyType = "eoa"
	StrategyTypeEIP7702      StrategyType = "eip7702"
	StrategyTypeSmartAccount StrategyType = "smartAccount"
)

// StrategyConfig is a common interface for strategy configurations.
type StrategyConfig interface {
	// GetRpcUrl returns the RPC URL.
	GetRpcUrl() string
	// GetChainId returns the chain ID.
	GetChainId() uint64
}

// GetRpcUrl returns the RPC URL.
func (c EOAStrategyConfig) GetRpcUrl() string { return c.RpcUrl }

// GetChainId returns the chain ID.
func (c EOAStrategyConfig) GetChainId() uint64 { return c.ChainId }

// GetRpcUrl returns the RPC URL.
func (c EIP7702StrategyConfig) GetRpcUrl() string { return c.RpcUrl }

// GetChainId returns the chain ID.
func (c EIP7702StrategyConfig) GetChainId() uint64 { return c.ChainId }

// GetRpcUrl returns the RPC URL.
func (c SmartAccountStrategyConfig) GetRpcUrl() string { return c.RpcUrl }

// GetChainId returns the chain ID.
func (c SmartAccountStrategyConfig) GetChainId() uint64 { return c.ChainId }

// ============================================================================
// Mode Detection
// ============================================================================

// DetectMode determines the appropriate transaction mode based on account type.
func DetectMode(account transaction.Account) sdktypes.TransactionMode {
	if account.IsSmartAccount() {
		return sdktypes.TransactionModeSmartAccount
	}
	if account.IsDelegated() {
		return sdktypes.TransactionModeEIP7702
	}
	return sdktypes.TransactionModeEOA
}

// ============================================================================
// Registry Helpers
// ============================================================================

// RegisterAllStrategies registers all strategies with the given registry.
func RegisterAllStrategies(registry transaction.Registry, rpcUrl string, chainId uint64, bundlerUrl string) error {
	// Register EOA strategy
	eoaStrategy, err := NewEOAStrategy(EOAStrategyConfig{
		RpcUrl:  rpcUrl,
		ChainId: chainId,
	})
	if err != nil {
		return err
	}
	registry.Register(eoaStrategy)

	// Register EIP-7702 strategy
	eip7702Strategy, err := NewEIP7702Strategy(EIP7702StrategyConfig{
		RpcUrl:  rpcUrl,
		ChainId: chainId,
	})
	if err != nil {
		return err
	}
	registry.Register(eip7702Strategy)

	// Register Smart Account strategy if bundler URL is provided
	if bundlerUrl != "" {
		smartAccountStrategy, err := NewSmartAccountStrategy(SmartAccountStrategyConfig{
			RpcUrl:     rpcUrl,
			ChainId:    chainId,
			BundlerUrl: bundlerUrl,
		})
		if err != nil {
			return err
		}
		registry.Register(smartAccountStrategy)
	}

	return nil
}

// SupportedModes returns the list of supported transaction modes.
func SupportedModes() []sdktypes.TransactionMode {
	return []sdktypes.TransactionMode{
		sdktypes.TransactionModeEOA,
		sdktypes.TransactionModeEIP7702,
		sdktypes.TransactionModeSmartAccount,
	}
}

// IsModeSupported checks if a transaction mode is supported.
func IsModeSupported(mode sdktypes.TransactionMode) bool {
	for _, m := range SupportedModes() {
		if m == mode {
			return true
		}
	}
	return false
}
