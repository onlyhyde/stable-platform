package defi

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Calculation Utilities
// ============================================================================

// CalculateHealthFactor calculates the health factor for a lending position.
// Formula: HF = (collateral * liquidationThreshold * 1e18) / (debt * 10000)
// Returns the health factor scaled by 1e18.
func CalculateHealthFactor(collateralValue, debtValue *big.Int, liquidationThresholdBPS uint64) *big.Int {
	if debtValue == nil || debtValue.Sign() == 0 {
		// No debt = infinite health factor, return max value
		return new(big.Int).Exp(big.NewInt(10), big.NewInt(36), nil) // 1e36
	}

	// numerator = collateral * threshold * 1e18
	numerator := new(big.Int).Mul(collateralValue, big.NewInt(int64(liquidationThresholdBPS)))
	numerator.Mul(numerator, big.NewInt(ScaleWAD))

	// denominator = debt * 10000
	denominator := new(big.Int).Mul(debtValue, big.NewInt(ScaleBPS))

	// healthFactor = numerator / denominator
	return new(big.Int).Div(numerator, denominator)
}

// IsLiquidatable checks if a position is liquidatable.
// A position is liquidatable when health factor < 1e18.
func IsLiquidatable(healthFactor *big.Int) bool {
	oneWAD := big.NewInt(ScaleWAD)
	return healthFactor.Cmp(oneWAD) < 0
}

// CalculateMinOutput calculates the minimum output amount after slippage.
// Formula: minOutput = amount * (10000 - slippageBps) / 10000
func CalculateMinOutput(amount *big.Int, slippageBPS uint64) *big.Int {
	if amount == nil || amount.Sign() == 0 {
		return big.NewInt(0)
	}

	// numerator = amount * (10000 - slippage)
	multiplier := big.NewInt(int64(ScaleBPS - slippageBPS))
	numerator := new(big.Int).Mul(amount, multiplier)

	// result = numerator / 10000
	return new(big.Int).Div(numerator, big.NewInt(ScaleBPS))
}

// CalculateFee calculates the fee amount.
// Formula: fee = amount * feeBps / 10000
func CalculateFee(amount *big.Int, feeBPS uint64) *big.Int {
	if amount == nil || amount.Sign() == 0 {
		return big.NewInt(0)
	}

	// numerator = amount * feeBps
	numerator := new(big.Int).Mul(amount, big.NewInt(int64(feeBPS)))

	// result = numerator / 10000
	return new(big.Int).Div(numerator, big.NewInt(ScaleBPS))
}

// CalculateMaxBorrow calculates the maximum borrow amount based on collateral and LTV.
// Formula: maxBorrow = collateral * ltv / 10000
func CalculateMaxBorrow(collateralValue *big.Int, ltvBPS uint64) *big.Int {
	if collateralValue == nil || collateralValue.Sign() == 0 {
		return big.NewInt(0)
	}

	numerator := new(big.Int).Mul(collateralValue, big.NewInt(int64(ltvBPS)))
	return new(big.Int).Div(numerator, big.NewInt(ScaleBPS))
}

// CalculateLTV calculates the current LTV ratio.
// Formula: ltv = (debt * 10000) / collateral
func CalculateLTV(debtValue, collateralValue *big.Int) uint64 {
	if collateralValue == nil || collateralValue.Sign() == 0 {
		return 0
	}

	numerator := new(big.Int).Mul(debtValue, big.NewInt(ScaleBPS))
	ltv := new(big.Int).Div(numerator, collateralValue)
	return ltv.Uint64()
}

// ============================================================================
// Encoding Utilities
// ============================================================================

// EncodeSwapExecutorInitData encodes initialization data for SwapExecutor.
// Format: abi.encode(uint256 maxSlippageBps, uint256 dailyLimit)
func EncodeSwapExecutorInitData(config *SwapExecutorInitData) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("uint256")},
		{Type: mustType("uint256")},
	}

	dailyLimit := config.DailyLimit
	if dailyLimit == nil {
		dailyLimit = DefaultDailyLimit
	}

	data, err := arguments.Pack(
		big.NewInt(int64(config.MaxSlippageBPS)),
		dailyLimit,
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// EncodeLendingExecutorInitData encodes initialization data for LendingExecutor.
// Format: abi.encode(uint256 maxLtv, uint256 minHealthFactor, uint256 dailyBorrowLimit)
func EncodeLendingExecutorInitData(config *LendingExecutorInitData) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("uint256")},
		{Type: mustType("uint256")},
		{Type: mustType("uint256")},
	}

	minHF := config.MinHealthFactor
	if minHF == nil {
		minHF = DefaultMinHealthFactor
	}

	dailyLimit := config.DailyBorrowLimit
	if dailyLimit == nil {
		dailyLimit = DefaultDailyLimit
	}

	data, err := arguments.Pack(
		big.NewInt(int64(config.MaxLTV)),
		minHF,
		dailyLimit,
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// EncodeStakingExecutorInitData encodes initialization data for StakingExecutor.
// Format: abi.encode(uint256 maxStakePerPool, uint256 dailyStakeLimit)
func EncodeStakingExecutorInitData(config *StakingExecutorInitData) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("uint256")},
		{Type: mustType("uint256")},
	}

	maxStake := config.MaxStakePerPool
	if maxStake == nil {
		maxStake = DefaultDailyLimit
	}

	dailyLimit := config.DailyStakeLimit
	if dailyLimit == nil {
		dailyLimit = DefaultDailyLimit
	}

	data, err := arguments.Pack(maxStake, dailyLimit)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// EncodeHealthFactorHookInitData encodes initialization data for HealthFactorHook.
// Format: abi.encode(uint256 minHealthFactor)
func EncodeHealthFactorHookInitData(config *HealthFactorHookInitData) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("uint256")},
	}

	minHF := config.MinHealthFactor
	if minHF == nil {
		minHF = DefaultMinHealthFactor
	}

	data, err := arguments.Pack(minHF)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// ============================================================================
// Swap Calldata Encoding
// ============================================================================

// EncodeSwapCalldata encodes calldata for a swap operation.
func EncodeSwapCalldata(params *SwapParams) (types.Hex, error) {
	// Simplified encoding - real implementation would match router interface
	arguments := abi.Arguments{
		{Type: mustType("address")}, // tokenIn
		{Type: mustType("address")}, // tokenOut
		{Type: mustType("uint256")}, // amountIn
		{Type: mustType("uint256")}, // minAmountOut
		{Type: mustType("uint256")}, // deadline
	}

	data, err := arguments.Pack(
		common.Address(params.TokenIn),
		common.Address(params.TokenOut),
		params.AmountIn,
		params.MinAmountOut,
		big.NewInt(int64(params.Deadline)),
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// ============================================================================
// Lending Calldata Encoding
// ============================================================================

// EncodeSupplyCalldata encodes calldata for a supply operation.
func EncodeSupplyCalldata(params *SupplyParams) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("address")}, // pool
		{Type: mustType("address")}, // asset
		{Type: mustType("uint256")}, // amount
		{Type: mustType("address")}, // onBehalfOf
	}

	onBehalfOf := params.OnBehalfOf
	if onBehalfOf == nil {
		onBehalfOf = &types.Address{}
	}

	data, err := arguments.Pack(
		common.Address(params.Pool),
		common.Address(params.Asset),
		params.Amount,
		common.Address(*onBehalfOf),
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// EncodeBorrowCalldata encodes calldata for a borrow operation.
func EncodeBorrowCalldata(params *BorrowParams) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("address")}, // pool
		{Type: mustType("address")}, // asset
		{Type: mustType("uint256")}, // amount
		{Type: mustType("uint8")},   // interestRateMode
	}

	data, err := arguments.Pack(
		common.Address(params.Pool),
		common.Address(params.Asset),
		params.Amount,
		params.InterestRateMode,
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// ============================================================================
// Staking Calldata Encoding
// ============================================================================

// EncodeStakeCalldata encodes calldata for a stake operation.
func EncodeStakeCalldata(params *StakeParams) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("address")}, // pool
		{Type: mustType("uint256")}, // amount
	}

	data, err := arguments.Pack(
		common.Address(params.Pool),
		params.Amount,
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// EncodeUnstakeCalldata encodes calldata for an unstake operation.
func EncodeUnstakeCalldata(params *UnstakeParams) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("address")}, // pool
		{Type: mustType("uint256")}, // amount
	}

	data, err := arguments.Pack(
		common.Address(params.Pool),
		params.Amount,
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// mustType creates an ABI type or panics.
func mustType(t string) abi.Type {
	typ, err := abi.NewType(t, "", nil)
	if err != nil {
		panic(err)
	}
	return typ
}

// NewDefaultSwapConfig creates a default swap configuration.
func NewDefaultSwapConfig() *SwapAccountConfig {
	return &SwapAccountConfig{
		MaxSlippageBPS: DefaultMaxSlippageBPS,
		DailyLimit:     new(big.Int).Set(DefaultDailyLimit),
		DailyUsed:      big.NewInt(0),
		LastResetTime:  0,
	}
}

// NewDefaultLendingConfig creates a default lending configuration.
func NewDefaultLendingConfig() *LendingAccountConfig {
	return &LendingAccountConfig{
		MaxLTV:           DefaultMaxLTV,
		MinHealthFactor:  new(big.Int).Set(DefaultMinHealthFactor),
		DailyBorrowLimit: new(big.Int).Set(DefaultDailyLimit),
		DailyBorrowed:    big.NewInt(0),
		LastResetTime:    0,
	}
}

// NewDefaultStakingConfig creates a default staking configuration.
func NewDefaultStakingConfig() *StakingAccountConfig {
	return &StakingAccountConfig{
		MaxStakePerPool: new(big.Int).Set(DefaultDailyLimit),
		DailyStakeLimit: new(big.Int).Set(DefaultDailyLimit),
		DailyStaked:     big.NewInt(0),
		LastResetTime:   0,
	}
}

// NewDefaultHealthFactorConfig creates a default health factor configuration.
func NewDefaultHealthFactorConfig() *HealthFactorAccountConfig {
	return &HealthFactorAccountConfig{
		MinHealthFactor:   new(big.Int).Set(DefaultMinHealthFactor),
		RevertOnViolation: true,
		EmitWarning:       true,
	}
}
