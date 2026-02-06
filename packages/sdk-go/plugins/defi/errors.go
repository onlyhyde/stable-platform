package defi

import "fmt"

// DefiPluginError is the base error type for DeFi plugin errors.
type DefiPluginError struct {
	Code    string
	Message string
	Details interface{}
}

func (e *DefiPluginError) Error() string {
	if e.Details != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// SwapExecutorError represents an error from the SwapExecutor.
type SwapExecutorError struct {
	DefiPluginError
}

// NewSwapExecutorError creates a new SwapExecutorError.
func NewSwapExecutorError(code, message string, details interface{}) *SwapExecutorError {
	return &SwapExecutorError{
		DefiPluginError: DefiPluginError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// LendingExecutorError represents an error from the LendingExecutor.
type LendingExecutorError struct {
	DefiPluginError
}

// NewLendingExecutorError creates a new LendingExecutorError.
func NewLendingExecutorError(code, message string, details interface{}) *LendingExecutorError {
	return &LendingExecutorError{
		DefiPluginError: DefiPluginError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// StakingExecutorError represents an error from the StakingExecutor.
type StakingExecutorError struct {
	DefiPluginError
}

// NewStakingExecutorError creates a new StakingExecutorError.
func NewStakingExecutorError(code, message string, details interface{}) *StakingExecutorError {
	return &StakingExecutorError{
		DefiPluginError: DefiPluginError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// HealthFactorHookError represents an error from the HealthFactorHook.
type HealthFactorHookError struct {
	DefiPluginError
}

// NewHealthFactorHookError creates a new HealthFactorHookError.
func NewHealthFactorHookError(code, message string, details interface{}) *HealthFactorHookError {
	return &HealthFactorHookError{
		DefiPluginError: DefiPluginError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// MerchantRegistryError represents an error from the MerchantRegistry.
type MerchantRegistryError struct {
	DefiPluginError
}

// NewMerchantRegistryError creates a new MerchantRegistryError.
func NewMerchantRegistryError(code, message string, details interface{}) *MerchantRegistryError {
	return &MerchantRegistryError{
		DefiPluginError: DefiPluginError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// Error codes.
const (
	// Swap errors
	ErrCodeSlippageExceeded   = "SLIPPAGE_EXCEEDED"
	ErrCodeDailyLimitExceeded = "DAILY_LIMIT_EXCEEDED"
	ErrCodeTokenNotWhitelisted = "TOKEN_NOT_WHITELISTED"
	ErrCodeInvalidAmount      = "INVALID_AMOUNT"
	ErrCodeDeadlineExpired    = "DEADLINE_EXPIRED"

	// Lending errors
	ErrCodeLTVExceeded           = "LTV_EXCEEDED"
	ErrCodeHealthFactorTooLow    = "HEALTH_FACTOR_TOO_LOW"
	ErrCodePoolNotWhitelisted    = "POOL_NOT_WHITELISTED"
	ErrCodeAssetNotEnabled       = "ASSET_NOT_ENABLED"
	ErrCodeBorrowLimitExceeded   = "BORROW_LIMIT_EXCEEDED"
	ErrCodeInsufficientCollateral = "INSUFFICIENT_COLLATERAL"

	// Staking errors
	ErrCodeStakeLimitExceeded = "STAKE_LIMIT_EXCEEDED"
	ErrCodePoolNotEnabled     = "POOL_NOT_ENABLED"
	ErrCodeMinStakeNotMet     = "MIN_STAKE_NOT_MET"
	ErrCodeMaxStakeExceeded   = "MAX_STAKE_EXCEEDED"

	// Health factor errors
	ErrCodeHealthFactorViolation = "HEALTH_FACTOR_VIOLATION"
	ErrCodeLiquidationRisk       = "LIQUIDATION_RISK"

	// Merchant errors
	ErrCodeMerchantNotFound      = "MERCHANT_NOT_FOUND"
	ErrCodeMerchantNotVerified   = "MERCHANT_NOT_VERIFIED"
	ErrCodeMerchantSuspended     = "MERCHANT_SUSPENDED"
	ErrCodeInvalidMerchantFee    = "INVALID_MERCHANT_FEE"
)
