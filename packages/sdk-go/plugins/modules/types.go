// Package modules provides ERC-7579 module management plugin for StableNet smart accounts.
// This plugin offers convenient functions for installing, uninstalling, and querying modules.
package modules

import (
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Module Types (ERC-7579)
// ============================================================================

// ModuleType constants for ERC-7579 module types.
const (
	ModuleTypeValidator = types.ModuleTypeValidator // Type 1
	ModuleTypeExecutor  = types.ModuleTypeExecutor  // Type 2
	ModuleTypeFallback  = types.ModuleTypeFallback  // Type 3
	ModuleTypeHook      = types.ModuleTypeHook      // Type 4
)

// MODULE_TYPES provides module type constants compatible with TypeScript SDK.
var MODULE_TYPES = struct {
	VALIDATOR types.ModuleType
	EXECUTOR  types.ModuleType
	FALLBACK  types.ModuleType
	HOOK      types.ModuleType
}{
	VALIDATOR: types.ModuleTypeValidator,
	EXECUTOR:  types.ModuleTypeExecutor,
	FALLBACK:  types.ModuleTypeFallback,
	HOOK:      types.ModuleTypeHook,
}

// ============================================================================
// Installation Parameters
// ============================================================================

// InstallModuleParams contains parameters for installing a module.
type InstallModuleParams struct {
	// ModuleType is the ERC-7579 module type.
	ModuleType types.ModuleType
	// Module is the module contract address.
	Module types.Address
	// InitData is the module initialization data.
	InitData types.Hex
}

// UninstallModuleParams contains parameters for uninstalling a module.
type UninstallModuleParams struct {
	// ModuleType is the ERC-7579 module type.
	ModuleType types.ModuleType
	// Module is the module contract address.
	Module types.Address
	// DeInitData is the module de-initialization data.
	DeInitData types.Hex
}

// IsModuleInstalledParams contains parameters for checking module installation.
type IsModuleInstalledParams struct {
	// ModuleType is the ERC-7579 module type.
	ModuleType types.ModuleType
	// Module is the module contract address.
	Module types.Address
	// AdditionalContext is optional additional data for the check.
	AdditionalContext types.Hex
}

// ============================================================================
// Batch Installation
// ============================================================================

// ModuleConfig represents a module configuration for installation.
type ModuleConfig struct {
	// Address is the module contract address.
	Address types.Address
	// InitData is the module initialization data.
	InitData types.Hex
}

// BatchModuleInstallation contains modules to install in batch.
type BatchModuleInstallation struct {
	// Validators are validator modules to install.
	Validators []ModuleConfig
	// Executors are executor modules to install.
	Executors []ModuleConfig
	// Hooks are hook modules to install.
	Hooks []ModuleConfig
	// Fallbacks are fallback modules to install.
	Fallbacks []ModuleConfig
}

// ============================================================================
// Operation Results
// ============================================================================

// ModuleOperationCallData contains encoded calldata for module operations.
type ModuleOperationCallData struct {
	// To is the target address (smart account).
	To types.Address
	// Data is the encoded calldata.
	Data types.Hex
	// Value is the ETH value to send (usually 0).
	Value *big.Int
}

// ModuleInstallationResult contains the result of module installation check.
type ModuleInstallationResult struct {
	// Module is the module address.
	Module types.Address
	// ModuleType is the module type.
	ModuleType types.ModuleType
	// IsInstalled indicates if the module is installed.
	IsInstalled bool
}

// ============================================================================
// Validator Configurations
// ============================================================================

// ECDSAValidatorConfig for ECDSA validator initialization.
type ECDSAValidatorConfig = types.ECDSAValidatorConfig

// WebAuthnValidatorConfig for WebAuthn validator initialization.
type WebAuthnValidatorConfig = types.WebAuthnValidatorConfig

// MultiSigValidatorConfig for MultiSig validator initialization.
type MultiSigValidatorConfig = types.MultiSigValidatorConfig

// ============================================================================
// Executor Configurations
// ============================================================================

// SessionKeyConfig for session key executor initialization.
type SessionKeyConfig = types.SessionKeyConfig

// SwapExecutorConfig for swap executor initialization.
type SwapExecutorConfig struct {
	// MaxSlippageBps is the maximum slippage in basis points.
	MaxSlippageBps uint16
	// DailyLimit is the daily swap limit.
	DailyLimit *big.Int
}

// LendingExecutorConfig for lending executor initialization.
type LendingExecutorConfig struct {
	// MaxLtv is the maximum loan-to-value ratio (basis points).
	MaxLtv uint16
	// MinHealthFactor is the minimum health factor (scaled by 1e18).
	MinHealthFactor *big.Int
	// DailyBorrowLimit is the daily borrow limit.
	DailyBorrowLimit *big.Int
}

// StakingExecutorConfig for staking executor initialization.
type StakingExecutorConfig struct {
	// MaxStakePerPool is the maximum stake per pool.
	MaxStakePerPool *big.Int
	// DailyStakeLimit is the daily stake limit.
	DailyStakeLimit *big.Int
}

// ============================================================================
// Hook Configurations
// ============================================================================

// SpendingLimitHookConfig for spending limit hook initialization.
type SpendingLimitHookConfig = types.SpendingLimitConfig

// HealthFactorHookConfig for health factor hook initialization.
type HealthFactorHookConfig struct {
	// MinHealthFactor is the minimum health factor (scaled by 1e18).
	MinHealthFactor *big.Int
}

// PolicyHookConfig for policy hook initialization.
type PolicyHookConfig struct {
	// MaxValue is the maximum transaction value.
	MaxValue *big.Int
	// DailyLimit is the daily transaction limit.
	DailyLimit *big.Int
}

// ============================================================================
// Error Types
// ============================================================================

// ModuleError is the base error type for module operations.
type ModuleError struct {
	Message string
	Code    string
	Details any
}

// Error implements the error interface.
func (e *ModuleError) Error() string {
	return e.Message
}

// NewModuleError creates a new ModuleError.
func NewModuleError(message, code string, details any) *ModuleError {
	return &ModuleError{
		Message: message,
		Code:    code,
		Details: details,
	}
}

// ModuleInstallationError is returned when module installation fails.
type ModuleInstallationError struct {
	ModuleError
}

// NewModuleInstallationError creates a new ModuleInstallationError.
func NewModuleInstallationError(message, code string, details any) *ModuleInstallationError {
	return &ModuleInstallationError{
		ModuleError: ModuleError{
			Message: message,
			Code:    code,
			Details: details,
		},
	}
}

// ModuleNotInstalledError is returned when a module is not installed.
type ModuleNotInstalledError struct {
	ModuleError
}

// NewModuleNotInstalledError creates a new ModuleNotInstalledError.
func NewModuleNotInstalledError(message, code string, details any) *ModuleNotInstalledError {
	return &ModuleNotInstalledError{
		ModuleError: ModuleError{
			Message: message,
			Code:    code,
			Details: details,
		},
	}
}

// InvalidModuleTypeError is returned when a module type is invalid.
type InvalidModuleTypeError struct {
	ModuleError
}

// NewInvalidModuleTypeError creates a new InvalidModuleTypeError.
func NewInvalidModuleTypeError(message, code string, details any) *InvalidModuleTypeError {
	return &InvalidModuleTypeError{
		ModuleError: ModuleError{
			Message: message,
			Code:    code,
			Details: details,
		},
	}
}
