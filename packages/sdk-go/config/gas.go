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
	EIP7702AuthGas      *big.Int // Additional gas per EIP-7702 authorization
	GasPerAuthorization *big.Int // 3200 - Gas per authorization in list

	// Smart Account defaults
	DefaultVerificationGasLimit *big.Int // 100000
	DefaultPreVerificationGas   *big.Int // 75000
	DefaultCallGasLimit         *big.Int // 200000

	// Paymaster defaults
	PaymasterVerificationGas *big.Int // 75000
	PaymasterPostOpGas       *big.Int // 50000

	// Buffer settings
	GasBufferMultiplier *big.Int // 12 (1.2x)
	GasBufferDivisor    *big.Int // 10

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
	EIP7702AuthGas:      big.NewInt(4),
	GasPerAuthorization: big.NewInt(3200),

	// Smart Account defaults
	DefaultVerificationGasLimit: big.NewInt(100000),
	DefaultPreVerificationGas:   big.NewInt(75000),
	DefaultCallGasLimit:         big.NewInt(200000),

	// Paymaster defaults
	PaymasterVerificationGas: big.NewInt(75000),
	PaymasterPostOpGas:       big.NewInt(50000),

	// Buffer settings (1.2x = 12/10)
	GasBufferMultiplier: big.NewInt(12),
	GasBufferDivisor:    big.NewInt(10),

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
	// Maximum limits
	MaxVerificationGasLimit: big.NewInt(10_000_000),  // 10M
	MaxCallGasLimit:         big.NewInt(30_000_000),  // 30M
	MaxPreVerificationGas:   big.NewInt(1_000_000),   // 1M
	MaxTotalGas:             big.NewInt(50_000_000),  // 50M

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

// GasError represents a gas validation error.
type GasError struct {
	Field   string
	Message string
}

func (e *GasError) Error() string {
	return e.Field + ": " + e.Message
}
