// Package defi provides DeFi-related module types and utilities for StableNet smart accounts.
//
// This package implements types and encoding functions for:
//   - SwapExecutor: DEX swap operations with slippage control
//   - LendingExecutor: DeFi lending operations (Aave, Compound, Morpho)
//   - StakingExecutor: Staking operations with limits
//   - HealthFactorHook: Position health monitoring
//   - MerchantRegistry: Merchant management for payments
package defi

import (
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Constants
// ============================================================================

// Scale constants for calculations.
const (
	// ScaleBPS is the basis points scale (10000 = 100%).
	ScaleBPS = 10000
	// ScaleWAD is the WAD scale (1e18).
	ScaleWAD = 1e18
	// ScaleRAY is the RAY scale (1e27).
	ScaleRAY = 1e27
)

// Default values.
var (
	// DefaultMaxSlippageBPS is the default maximum slippage (100 = 1%).
	DefaultMaxSlippageBPS = uint64(100)
	// DefaultDailyLimit is the default daily limit (10 ETH).
	DefaultDailyLimit = new(big.Int).Mul(big.NewInt(10), big.NewInt(ScaleWAD))
	// DefaultMaxLTV is the default maximum LTV (8000 = 80%).
	DefaultMaxLTV = uint64(8000)
	// DefaultMinHealthFactor is the default minimum health factor (1.2e18).
	DefaultMinHealthFactor = new(big.Int).Mul(big.NewInt(12), new(big.Int).Div(big.NewInt(ScaleWAD), big.NewInt(10)))
	// DefaultMerchantFeeBPS is the default merchant fee (250 = 2.5%).
	DefaultMerchantFeeBPS = uint64(250)
	// MaxMerchantFeeBPS is the maximum allowed merchant fee (1000 = 10%).
	MaxMerchantFeeBPS = uint64(1000)
)

// LendingPoolType represents supported lending protocols.
type LendingPoolType uint8

// Lending pool type constants.
const (
	LendingPoolUnknown    LendingPoolType = 0
	LendingPoolAaveV3     LendingPoolType = 1
	LendingPoolCompoundV3 LendingPoolType = 2
	LendingPoolMorpho     LendingPoolType = 3
)

// String returns the string representation of the lending pool type.
func (t LendingPoolType) String() string {
	switch t {
	case LendingPoolAaveV3:
		return "Aave V3"
	case LendingPoolCompoundV3:
		return "Compound V3"
	case LendingPoolMorpho:
		return "Morpho"
	default:
		return "Unknown"
	}
}

// ============================================================================
// Swap Executor Types
// ============================================================================

// SwapAccountConfig represents swap configuration for an account.
type SwapAccountConfig struct {
	// MaxSlippageBPS is the maximum allowed slippage in basis points.
	MaxSlippageBPS uint64 `json:"maxSlippageBps"`
	// DailyLimit is the daily swap limit in wei.
	DailyLimit *big.Int `json:"dailyLimit"`
	// DailyUsed is the amount used today in wei.
	DailyUsed *big.Int `json:"dailyUsed"`
	// LastResetTime is the timestamp of the last daily reset.
	LastResetTime uint64 `json:"lastResetTime"`
}

// SwapTokenConfig represents token-specific swap configuration.
type SwapTokenConfig struct {
	// Whitelisted indicates if the token is allowed for swaps.
	Whitelisted bool `json:"whitelisted"`
	// MinAmount is the minimum swap amount.
	MinAmount *big.Int `json:"minAmount"`
	// MaxAmount is the maximum swap amount.
	MaxAmount *big.Int `json:"maxAmount"`
}

// SwapParams represents parameters for a swap operation.
type SwapParams struct {
	// TokenIn is the input token address.
	TokenIn types.Address `json:"tokenIn"`
	// TokenOut is the output token address.
	TokenOut types.Address `json:"tokenOut"`
	// AmountIn is the input amount.
	AmountIn *big.Int `json:"amountIn"`
	// MinAmountOut is the minimum output amount.
	MinAmountOut *big.Int `json:"minAmountOut"`
	// SlippageBPS is the slippage tolerance in basis points.
	SlippageBPS uint64 `json:"slippageBps"`
	// Router is the DEX router address.
	Router types.Address `json:"router"`
	// Deadline is the transaction deadline timestamp.
	Deadline uint64 `json:"deadline"`
	// Path is the swap path (optional, for multi-hop).
	Path []types.Address `json:"path,omitempty"`
}

// SwapExecutorInitData represents initialization data for SwapExecutor.
type SwapExecutorInitData struct {
	// MaxSlippageBPS is the maximum allowed slippage.
	MaxSlippageBPS uint64 `json:"maxSlippageBps"`
	// DailyLimit is the daily swap limit.
	DailyLimit *big.Int `json:"dailyLimit"`
}

// SwapExecutedEvent represents a swap execution event.
type SwapExecutedEvent struct {
	// Account is the smart account address.
	Account types.Address `json:"account"`
	// TokenIn is the input token.
	TokenIn types.Address `json:"tokenIn"`
	// TokenOut is the output token.
	TokenOut types.Address `json:"tokenOut"`
	// AmountIn is the input amount.
	AmountIn *big.Int `json:"amountIn"`
	// AmountOut is the output amount.
	AmountOut *big.Int `json:"amountOut"`
	// Router is the DEX router used.
	Router types.Address `json:"router"`
}

// ============================================================================
// Lending Executor Types
// ============================================================================

// LendingAccountConfig represents lending configuration for an account.
type LendingAccountConfig struct {
	// MaxLTV is the maximum loan-to-value ratio in basis points (8000 = 80%).
	MaxLTV uint64 `json:"maxLtv"`
	// MinHealthFactor is the minimum health factor (scaled by 1e18).
	MinHealthFactor *big.Int `json:"minHealthFactor"`
	// DailyBorrowLimit is the daily borrow limit.
	DailyBorrowLimit *big.Int `json:"dailyBorrowLimit"`
	// DailyBorrowed is the amount borrowed today.
	DailyBorrowed *big.Int `json:"dailyBorrowed"`
	// LastResetTime is the timestamp of the last daily reset.
	LastResetTime uint64 `json:"lastResetTime"`
}

// LendingPoolConfig represents configuration for a lending pool.
type LendingPoolConfig struct {
	// Pool is the pool contract address.
	Pool types.Address `json:"pool"`
	// PoolType is the type of lending protocol.
	PoolType LendingPoolType `json:"poolType"`
	// Whitelisted indicates if the pool is allowed.
	Whitelisted bool `json:"whitelisted"`
}

// LendingAssetConfig represents per-asset lending configuration.
type LendingAssetConfig struct {
	// Asset is the asset address.
	Asset types.Address `json:"asset"`
	// MaxSupply is the maximum supply amount.
	MaxSupply *big.Int `json:"maxSupply"`
	// MaxBorrow is the maximum borrow amount.
	MaxBorrow *big.Int `json:"maxBorrow"`
	// Enabled indicates if the asset is enabled.
	Enabled bool `json:"enabled"`
}

// SupplyParams represents parameters for a supply operation.
type SupplyParams struct {
	// Pool is the lending pool address.
	Pool types.Address `json:"pool"`
	// Asset is the asset to supply.
	Asset types.Address `json:"asset"`
	// Amount is the supply amount.
	Amount *big.Int `json:"amount"`
	// OnBehalfOf is the beneficiary (optional, defaults to sender).
	OnBehalfOf *types.Address `json:"onBehalfOf,omitempty"`
}

// WithdrawParams represents parameters for a withdraw operation.
type WithdrawParams struct {
	// Pool is the lending pool address.
	Pool types.Address `json:"pool"`
	// Asset is the asset to withdraw.
	Asset types.Address `json:"asset"`
	// Amount is the withdraw amount (use MaxUint256 for max).
	Amount *big.Int `json:"amount"`
	// To is the recipient address.
	To types.Address `json:"to"`
}

// BorrowParams represents parameters for a borrow operation.
type BorrowParams struct {
	// Pool is the lending pool address.
	Pool types.Address `json:"pool"`
	// Asset is the asset to borrow.
	Asset types.Address `json:"asset"`
	// Amount is the borrow amount.
	Amount *big.Int `json:"amount"`
	// InterestRateMode is the interest rate mode (1 = stable, 2 = variable).
	InterestRateMode uint8 `json:"interestRateMode"`
	// OnBehalfOf is the debt holder (optional).
	OnBehalfOf *types.Address `json:"onBehalfOf,omitempty"`
}

// RepayParams represents parameters for a repay operation.
type RepayParams struct {
	// Pool is the lending pool address.
	Pool types.Address `json:"pool"`
	// Asset is the asset to repay.
	Asset types.Address `json:"asset"`
	// Amount is the repay amount (use MaxUint256 for max).
	Amount *big.Int `json:"amount"`
	// InterestRateMode is the interest rate mode.
	InterestRateMode uint8 `json:"interestRateMode"`
	// OnBehalfOf is the debt holder.
	OnBehalfOf *types.Address `json:"onBehalfOf,omitempty"`
}

// LendingExecutorInitData represents initialization data for LendingExecutor.
type LendingExecutorInitData struct {
	// MaxLTV is the maximum LTV in basis points.
	MaxLTV uint64 `json:"maxLtv"`
	// MinHealthFactor is the minimum health factor.
	MinHealthFactor *big.Int `json:"minHealthFactor"`
	// DailyBorrowLimit is the daily borrow limit.
	DailyBorrowLimit *big.Int `json:"dailyBorrowLimit"`
}

// ============================================================================
// Staking Executor Types
// ============================================================================

// StakingAccountConfig represents staking configuration for an account.
type StakingAccountConfig struct {
	// MaxStakePerPool is the maximum stake per pool.
	MaxStakePerPool *big.Int `json:"maxStakePerPool"`
	// DailyStakeLimit is the daily stake limit.
	DailyStakeLimit *big.Int `json:"dailyStakeLimit"`
	// DailyStaked is the amount staked today.
	DailyStaked *big.Int `json:"dailyStaked"`
	// LastResetTime is the timestamp of the last daily reset.
	LastResetTime uint64 `json:"lastResetTime"`
}

// StakingPoolInfo represents information about a staking pool.
type StakingPoolInfo struct {
	// Pool is the staking pool address.
	Pool types.Address `json:"pool"`
	// StakeToken is the token to stake.
	StakeToken types.Address `json:"stakeToken"`
	// RewardToken is the reward token.
	RewardToken types.Address `json:"rewardToken"`
	// MinStake is the minimum stake amount.
	MinStake *big.Int `json:"minStake"`
	// MaxStake is the maximum stake amount.
	MaxStake *big.Int `json:"maxStake"`
	// Enabled indicates if the pool is enabled.
	Enabled bool `json:"enabled"`
}

// StakeParams represents parameters for a stake operation.
type StakeParams struct {
	// Pool is the staking pool address.
	Pool types.Address `json:"pool"`
	// Amount is the stake amount.
	Amount *big.Int `json:"amount"`
}

// UnstakeParams represents parameters for an unstake operation.
type UnstakeParams struct {
	// Pool is the staking pool address.
	Pool types.Address `json:"pool"`
	// Amount is the unstake amount.
	Amount *big.Int `json:"amount"`
}

// ClaimRewardsParams represents parameters for claiming rewards.
type ClaimRewardsParams struct {
	// Pool is the staking pool address.
	Pool types.Address `json:"pool"`
}

// CompoundRewardsParams represents parameters for compounding rewards.
type CompoundRewardsParams struct {
	// Pool is the staking pool address.
	Pool types.Address `json:"pool"`
}

// StakingExecutorInitData represents initialization data for StakingExecutor.
type StakingExecutorInitData struct {
	// MaxStakePerPool is the maximum stake per pool.
	MaxStakePerPool *big.Int `json:"maxStakePerPool"`
	// DailyStakeLimit is the daily stake limit.
	DailyStakeLimit *big.Int `json:"dailyStakeLimit"`
}

// ============================================================================
// Health Factor Hook Types
// ============================================================================

// HealthFactorAccountConfig represents health factor configuration.
type HealthFactorAccountConfig struct {
	// MinHealthFactor is the minimum allowed health factor (scaled by 1e18).
	MinHealthFactor *big.Int `json:"minHealthFactor"`
	// RevertOnViolation indicates whether to revert on violation.
	RevertOnViolation bool `json:"revertOnViolation"`
	// EmitWarning indicates whether to emit a warning event.
	EmitWarning bool `json:"emitWarning"`
}

// HealthFactorCheckResult represents the result of a health factor check.
type HealthFactorCheckResult struct {
	// PreHealthFactor is the health factor before the operation.
	PreHealthFactor *big.Int `json:"preHealthFactor"`
	// PostHealthFactor is the health factor after the operation.
	PostHealthFactor *big.Int `json:"postHealthFactor"`
	// IsValid indicates if the operation maintains valid health.
	IsValid bool `json:"isValid"`
	// WouldLiquidate indicates if this would trigger liquidation.
	WouldLiquidate bool `json:"wouldLiquidate"`
}

// HealthFactorHookInitData represents initialization data for HealthFactorHook.
type HealthFactorHookInitData struct {
	// MinHealthFactor is the minimum health factor threshold.
	MinHealthFactor *big.Int `json:"minHealthFactor"`
	// MonitoredTargets are the addresses to monitor.
	MonitoredTargets []types.Address `json:"monitoredTargets,omitempty"`
}

// ============================================================================
// Merchant Registry Types
// ============================================================================

// Merchant represents a registered merchant.
type Merchant struct {
	// ID is the merchant identifier.
	ID *big.Int `json:"id"`
	// Owner is the merchant owner address.
	Owner types.Address `json:"owner"`
	// Name is the merchant name.
	Name string `json:"name"`
	// Website is the merchant website.
	Website string `json:"website"`
	// Email is the merchant email.
	Email string `json:"email"`
	// Verified indicates if the merchant is verified.
	Verified bool `json:"verified"`
	// Active indicates if the merchant is active.
	Active bool `json:"active"`
	// CustomFeeBPS is the custom fee in basis points.
	CustomFeeBPS uint64 `json:"customFeeBps"`
	// CreatedAt is the creation timestamp.
	CreatedAt uint64 `json:"createdAt"`
}

// MerchantRegistration represents data for registering a merchant.
type MerchantRegistration struct {
	// Name is the merchant name.
	Name string `json:"name"`
	// Website is the merchant website.
	Website string `json:"website"`
	// Email is the merchant email.
	Email string `json:"email"`
}

// MerchantStats represents aggregate merchant statistics.
type MerchantStats struct {
	// TotalMerchants is the total number of merchants.
	TotalMerchants uint64 `json:"totalMerchants"`
	// VerifiedMerchants is the number of verified merchants.
	VerifiedMerchants uint64 `json:"verifiedMerchants"`
	// ActiveMerchants is the number of active merchants.
	ActiveMerchants uint64 `json:"activeMerchants"`
}

// ============================================================================
// Event Types
// ============================================================================

// SuppliedEvent represents a supply event.
type SuppliedEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Asset   types.Address `json:"asset"`
	Amount  *big.Int      `json:"amount"`
}

// WithdrawnEvent represents a withdraw event.
type WithdrawnEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Asset   types.Address `json:"asset"`
	Amount  *big.Int      `json:"amount"`
	To      types.Address `json:"to"`
}

// BorrowedEvent represents a borrow event.
type BorrowedEvent struct {
	Account          types.Address `json:"account"`
	Pool             types.Address `json:"pool"`
	Asset            types.Address `json:"asset"`
	Amount           *big.Int      `json:"amount"`
	InterestRateMode uint8         `json:"interestRateMode"`
}

// RepaidEvent represents a repay event.
type RepaidEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Asset   types.Address `json:"asset"`
	Amount  *big.Int      `json:"amount"`
}

// StakedEvent represents a stake event.
type StakedEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Amount  *big.Int      `json:"amount"`
}

// UnstakedEvent represents an unstake event.
type UnstakedEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Amount  *big.Int      `json:"amount"`
}

// RewardsClaimedEvent represents a rewards claimed event.
type RewardsClaimedEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Amount  *big.Int      `json:"amount"`
}

// RewardsCompoundedEvent represents a rewards compounded event.
type RewardsCompoundedEvent struct {
	Account types.Address `json:"account"`
	Pool    types.Address `json:"pool"`
	Amount  *big.Int      `json:"amount"`
}

// MerchantRegisteredEvent represents a merchant registration event.
type MerchantRegisteredEvent struct {
	MerchantID *big.Int      `json:"merchantId"`
	Owner      types.Address `json:"owner"`
	Name       string        `json:"name"`
}

// MerchantVerifiedEvent represents a merchant verification event.
type MerchantVerifiedEvent struct {
	MerchantID *big.Int `json:"merchantId"`
}

// MerchantSuspendedEvent represents a merchant suspension event.
type MerchantSuspendedEvent struct {
	MerchantID *big.Int `json:"merchantId"`
	Reason     string   `json:"reason"`
}
