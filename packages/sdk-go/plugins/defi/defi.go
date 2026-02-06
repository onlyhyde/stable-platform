// Package defi provides DeFi-related module types and utilities for StableNet smart accounts.
//
// This package implements support for:
//   - SwapExecutor: DEX swap operations with slippage control and daily limits
//   - LendingExecutor: DeFi lending operations (Aave V3, Compound V3, Morpho)
//   - StakingExecutor: Staking operations with per-pool and daily limits
//   - HealthFactorHook: Pre/post transaction health factor monitoring
//   - MerchantRegistry: Merchant management for subscription payments
//
// # Calculation Utilities
//
// The package provides various calculation utilities:
//
//	// Calculate health factor for a lending position
//	hf := defi.CalculateHealthFactor(collateral, debt, 8000) // 80% threshold
//
//	// Check if position is liquidatable
//	if defi.IsLiquidatable(hf) {
//	    // Handle liquidation risk
//	}
//
//	// Calculate minimum output with slippage
//	minOut := defi.CalculateMinOutput(amountIn, 100) // 1% slippage
//
//	// Calculate fee
//	fee := defi.CalculateFee(amount, 250) // 2.5% fee
//
// # Encoding Utilities
//
// Encode module initialization data:
//
//	// Encode SwapExecutor init data
//	initData, _ := defi.EncodeSwapExecutorInitData(&defi.SwapExecutorInitData{
//	    MaxSlippageBPS: 100,
//	    DailyLimit:     big.NewInt(10e18),
//	})
//
//	// Encode LendingExecutor init data
//	initData, _ := defi.EncodeLendingExecutorInitData(&defi.LendingExecutorInitData{
//	    MaxLTV:           8000,
//	    MinHealthFactor:  big.NewInt(1.2e18),
//	    DailyBorrowLimit: big.NewInt(10e18),
//	})
//
// # Default Configurations
//
// Create default configurations:
//
//	swapConfig := defi.NewDefaultSwapConfig()
//	lendingConfig := defi.NewDefaultLendingConfig()
//	stakingConfig := defi.NewDefaultStakingConfig()
//	healthFactorConfig := defi.NewDefaultHealthFactorConfig()
package defi

// Re-exports for convenient access at package level.

// Module types for ERC-7579 compatibility.
const (
	ModuleTypeValidator = 1
	ModuleTypeExecutor  = 2
	ModuleTypeFallback  = 3
	ModuleTypeHook      = 4
)
