// Package config provides SDK configuration constants.
package config

import "math/big"

// ============================================================================
// Gas Configuration
// ============================================================================

// GasConfig contains gas-related constants and configurations.
var GasConfig = struct {
	// Base costs
	BaseTransferGas     *big.Int // 21000 - Base gas for ETH transfer
	EIP7702AuthGas      *big.Int // 25000 - PER_EMPTY_ACCOUNT_COST per EIP-7702
	GasPerAuthorization *big.Int // 12500 - PER_AUTH_BASE_COST per EIP-7702

	// Smart Account defaults (aligned with sdk-ts)
	DefaultVerificationGasLimit *big.Int // 150000
	DefaultPreVerificationGas   *big.Int // 50000
	DefaultCallGasLimit         *big.Int // 200000

	// Paymaster defaults
	PaymasterVerificationGas *big.Int // 75000
	PaymasterPostOpGas       *big.Int // 50000

	// Buffer settings
	GasBufferMultiplier *big.Int // 110 (1.1x = 10% buffer)
	GasBufferDivisor    *big.Int // 100

	// UserOperation overhead
	UserOpFixedGas           *big.Int // Fixed overhead for UserOp processing
	UserOpPerByteGas         *big.Int // Gas per byte of calldata
	UserOpPerZeroByteGas     *big.Int // Gas per zero byte of calldata
	UserOpPerNonZeroByteGas  *big.Int // Gas per non-zero byte of calldata

	// EIP-7702 specific
	EIP7702DelegationGas *big.Int // Gas for delegation setup
}{
	// Base costs
	BaseTransferGas:     big.NewInt(21000),
	EIP7702AuthGas:      big.NewInt(25000), // PER_EMPTY_ACCOUNT_COST per EIP-7702
	GasPerAuthorization: big.NewInt(12500), // PER_AUTH_BASE_COST per EIP-7702

	// Smart Account defaults (aligned with sdk-ts)
	DefaultVerificationGasLimit: big.NewInt(150000), // Kernel module dispatch + ECDSA
	DefaultPreVerificationGas:   big.NewInt(50000),  // Spec formula ~44K for typical op
	DefaultCallGasLimit:         big.NewInt(200000),

	// Paymaster defaults
	PaymasterVerificationGas: big.NewInt(75000),
	PaymasterPostOpGas:       big.NewInt(50000),

	// Buffer settings (1.1x = 110/100, industry standard 10%)
	GasBufferMultiplier: big.NewInt(110),
	GasBufferDivisor:    big.NewInt(100),

	// UserOperation overhead
	UserOpFixedGas:          big.NewInt(21000),
	UserOpPerByteGas:        big.NewInt(16),
	UserOpPerZeroByteGas:    big.NewInt(4),
	UserOpPerNonZeroByteGas: big.NewInt(16),

	// EIP-7702 specific
	EIP7702DelegationGas: big.NewInt(25000),
}

// ============================================================================
// Gas Limits
// ============================================================================

// GasLimits contains maximum and minimum gas limits.
var GasLimits = struct {
	// Maximum limits
	MaxVerificationGasLimit *big.Int
	MaxCallGasLimit         *big.Int
	MaxPreVerificationGas   *big.Int
	MaxTotalGas             *big.Int

	// Minimum limits
	MinVerificationGasLimit *big.Int
	MinCallGasLimit         *big.Int
	MinPreVerificationGas   *big.Int
}{
	// Maximum limits (aligned with StableNet genesis block gas limit 105M)
	MaxVerificationGasLimit: big.NewInt(10_000_000),   // 10M
	MaxCallGasLimit:         big.NewInt(105_000_000),  // 105M
	MaxPreVerificationGas:   big.NewInt(1_000_000),    // 1M
	MaxTotalGas:             big.NewInt(105_000_000),  // 105M

	// Minimum limits
	MinVerificationGasLimit: big.NewInt(10_000),
	MinCallGasLimit:         big.NewInt(21_000),
	MinPreVerificationGas:   big.NewInt(21_000),
}

// ============================================================================
// Gas Price Configuration
// ============================================================================

// GasPriceConfig contains gas price related settings.
var GasPriceConfig = struct {
	// Price limits (in wei)
	MaxFeePerGas         *big.Int // Maximum acceptable max fee per gas
	MaxPriorityFeePerGas *big.Int // Maximum acceptable priority fee

	// Default prices for estimation (in wei)
	DefaultMaxFeePerGas         *big.Int // Default max fee if not provided
	DefaultMaxPriorityFeePerGas *big.Int // Default priority fee if not provided

	// Price increase percentage for urgency (in basis points, 10000 = 100%)
	UrgentPriceMultiplier uint64 // 125% = 12500 basis points
	FastPriceMultiplier   uint64 // 110% = 11000 basis points
}{
	// Price limits
	MaxFeePerGas:         new(big.Int).Mul(big.NewInt(500), big.NewInt(1e9)), // 500 gwei
	MaxPriorityFeePerGas: new(big.Int).Mul(big.NewInt(50), big.NewInt(1e9)),  // 50 gwei

	// Default prices
	DefaultMaxFeePerGas:         new(big.Int).Mul(big.NewInt(50), big.NewInt(1e9)), // 50 gwei
	DefaultMaxPriorityFeePerGas: new(big.Int).Mul(big.NewInt(2), big.NewInt(1e9)),  // 2 gwei

	// Price multipliers
	UrgentPriceMultiplier: 12500, // 125%
	FastPriceMultiplier:   11000, // 110%
}

// ============================================================================
// Helper Functions
// ============================================================================

// ApplyGasBuffer applies the gas buffer to a gas value.
func ApplyGasBuffer(gas *big.Int) *big.Int {
	if gas == nil {
		return big.NewInt(0)
	}
	result := new(big.Int).Mul(gas, GasConfig.GasBufferMultiplier)
	return result.Div(result, GasConfig.GasBufferDivisor)
}

// CalculateCalldataGas calculates gas for calldata.
func CalculateCalldataGas(data []byte) *big.Int {
	zeroBytes := 0
	nonZeroBytes := 0

	for _, b := range data {
		if b == 0 {
			zeroBytes++
		} else {
			nonZeroBytes++
		}
	}

	zeroGas := new(big.Int).Mul(big.NewInt(int64(zeroBytes)), GasConfig.UserOpPerZeroByteGas)
	nonZeroGas := new(big.Int).Mul(big.NewInt(int64(nonZeroBytes)), GasConfig.UserOpPerNonZeroByteGas)

	return new(big.Int).Add(zeroGas, nonZeroGas)
}

// CalculateEIP7702Gas calculates gas for EIP-7702 authorizations.
func CalculateEIP7702Gas(numAuthorizations int) *big.Int {
	return new(big.Int).Mul(
		big.NewInt(int64(numAuthorizations)),
		GasConfig.GasPerAuthorization,
	)
}

// UnusedGasPenaltyThreshold is the threshold (40,000 gas) above which
// the 10% unused gas penalty applies per EIP-4337 v0.9.
var UnusedGasPenaltyThreshold = big.NewInt(40_000)

// UnusedGasPenaltyDivisor represents the 10% penalty (divide by 10).
var UnusedGasPenaltyDivisor = big.NewInt(10)

// CalculateUnusedGasPenalty computes the 10% unused gas penalty per EIP-4337 v0.9.
//
// If unused (callGasLimit + paymasterPostOpGasLimit) exceeds 40,000 gas,
// 10% of the unused amount is charged as penalty to prevent bundler griefing.
func CalculateUnusedGasPenalty(allocatedCallGas, estimatedCallGas, allocatedPostOpGas, estimatedPostOpGas *big.Int) *big.Int {
	unusedCallGas := new(big.Int)
	if allocatedCallGas != nil && estimatedCallGas != nil && allocatedCallGas.Cmp(estimatedCallGas) > 0 {
		unusedCallGas.Sub(allocatedCallGas, estimatedCallGas)
	}

	unusedPostOpGas := new(big.Int)
	if allocatedPostOpGas != nil && estimatedPostOpGas != nil && allocatedPostOpGas.Cmp(estimatedPostOpGas) > 0 {
		unusedPostOpGas.Sub(allocatedPostOpGas, estimatedPostOpGas)
	}

	totalUnused := new(big.Int).Add(unusedCallGas, unusedPostOpGas)

	if totalUnused.Cmp(UnusedGasPenaltyThreshold) > 0 {
		return new(big.Int).Div(totalUnused, UnusedGasPenaltyDivisor)
	}
	return big.NewInt(0)
}

// ValidateGasLimits validates that gas limits are within acceptable range.
func ValidateGasLimits(verificationGas, callGas, preVerificationGas *big.Int) error {
	if verificationGas != nil {
		if verificationGas.Cmp(GasLimits.MinVerificationGasLimit) < 0 {
			return &GasError{Field: "verificationGasLimit", Message: "below minimum"}
		}
		if verificationGas.Cmp(GasLimits.MaxVerificationGasLimit) > 0 {
			return &GasError{Field: "verificationGasLimit", Message: "exceeds maximum"}
		}
	}

	if callGas != nil {
		if callGas.Cmp(GasLimits.MinCallGasLimit) < 0 {
			return &GasError{Field: "callGasLimit", Message: "below minimum"}
		}
		if callGas.Cmp(GasLimits.MaxCallGasLimit) > 0 {
			return &GasError{Field: "callGasLimit", Message: "exceeds maximum"}
		}
	}

	if preVerificationGas != nil {
		if preVerificationGas.Cmp(GasLimits.MinPreVerificationGas) < 0 {
			return &GasError{Field: "preVerificationGas", Message: "below minimum"}
		}
		if preVerificationGas.Cmp(GasLimits.MaxPreVerificationGas) > 0 {
			return &GasError{Field: "preVerificationGas", Message: "exceeds maximum"}
		}
	}

	// Check total gas
	if verificationGas != nil && callGas != nil && preVerificationGas != nil {
		total := new(big.Int).Add(verificationGas, callGas)
		total.Add(total, preVerificationGas)
		if total.Cmp(GasLimits.MaxTotalGas) > 0 {
			return &GasError{Field: "totalGas", Message: "total exceeds maximum"}
		}
	}

	return nil
}

// CalculatePreVerificationGas computes preVerificationGas per EIP-4337 Section 13.
//
// Formula: calldataGas + perOpOverhead + (baseBundleCost / bundleSize)
//
// Where:
//   - calldataGas = sum of (4 gas per zero byte + 16 gas per non-zero byte) per EIP-2028
//   - perOpOverhead = 18,300 (fixed per-UserOp overhead)
//   - baseBundleCost = 21,000 (base transaction cost shared among bundle)
//   - bundleSize = assumed number of ops in bundle (default: 1)
//   - eip7702AuthCost = 25,000 if EIP-7702 authorization is present
//
// The userOpBytes should be the serialized UserOperation (all fields concatenated).
// If bundleSize is 0 or negative, defaults to 1.
func CalculatePreVerificationGas(userOpBytes []byte, bundleSize int, hasEIP7702Auth bool) *big.Int {
	if bundleSize <= 0 {
		bundleSize = 1
	}

	// 1. Calldata gas (EIP-2028)
	calldataGas := CalculateCalldataGas(userOpBytes)

	// 2. Per-operation overhead (18,300)
	perOpOverhead := big.NewInt(18300)

	// 3. Base bundle cost shared among operations (21,000 / bundleSize)
	baseBundleCost := new(big.Int).Div(big.NewInt(21000), big.NewInt(int64(bundleSize)))

	// 4. Total = calldataGas + perOpOverhead + baseBundleCost
	total := new(big.Int).Add(calldataGas, perOpOverhead)
	total.Add(total, baseBundleCost)

	// 5. EIP-7702 authorization cost (25,000 if applicable)
	if hasEIP7702Auth {
		total.Add(total, big.NewInt(25000))
	}

	return total
}

// GasError represents a gas validation error.
type GasError struct {
	Field   string
	Message string
}

func (e *GasError) Error() string {
	return e.Field + ": " + e.Message
}
