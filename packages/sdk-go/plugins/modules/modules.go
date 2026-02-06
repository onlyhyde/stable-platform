// Package modules provides ERC-7579 module management plugin for StableNet smart accounts.
//
// This plugin offers high-level functions for installing, uninstalling, and querying ERC-7579 modules
// on Kernel Smart Accounts. It is compatible with the TypeScript SDK's @stablenet/plugin-modules package.
//
// # Usage
//
//	import (
//	    "github.com/stablenet/sdk-go/plugins/modules"
//	    "github.com/stablenet/sdk-go/types"
//	)
//
//	// Install an ECDSA validator
//	installCall, err := modules.BuildInstallModuleCall(smartAccountAddress, modules.InstallModuleParams{
//	    ModuleType: modules.MODULE_TYPES.VALIDATOR,
//	    Module:     ecdsaValidatorAddress,
//	    InitData:   modules.EncodeECDSAValidatorInitData(ownerAddress),
//	})
//
//	// Check if module is installed
//	installed, err := modules.IsModuleInstalled(ctx, client, smartAccountAddress, modules.IsModuleInstalledParams{
//	    ModuleType: modules.MODULE_TYPES.VALIDATOR,
//	    Module:     ecdsaValidatorAddress,
//	})
//
// # Features
//
// Module Installation:
//   - EncodeInstallModule: Encode call data for installing a module
//   - EncodeUninstallModule: Encode call data for uninstalling a module
//   - BuildInstallModuleCall: Build a call for installing a module on a smart account
//   - BuildUninstallModuleCall: Build a call for uninstalling a module from a smart account
//   - BuildBatchInstallModuleCalls: Build calls for batch module installation
//
// Module Queries:
//   - IsModuleInstalled: Check if a module is installed on a smart account
//   - IsModuleType: Check if a module supports a specific module type
//   - IsModuleInitialized: Check if a module is initialized for a smart account
//   - GetRootValidator: Get the root validator address for a smart account
//
// Init Data Encoders:
//   - Validators: EncodeECDSAValidatorInitData, EncodeWebAuthnValidatorInitData, EncodeMultiSigValidatorInitData
//   - Executors: EncodeSessionKeyExecutorInitData, EncodeSwapExecutorInitData, EncodeLendingExecutorInitData, EncodeStakingExecutorInitData
//   - Hooks: EncodeSpendingLimitHookInitData, EncodeHealthFactorHookInitData, EncodePolicyHookInitData
//
// # Integration with Core Modules
//
// This plugin provides a simplified, TypeScript-compatible API. For more comprehensive
// module management, use the core modules package:
//
//	import "github.com/stablenet/sdk-go/modules"
//	import "github.com/stablenet/sdk-go/modules/utils"
//
// The core modules package provides:
//   - ModuleRegistry for discovering available modules
//   - QueryClient for querying installed modules with additional features
//   - OperationClient for preparing module operations with validation
//   - Utils for encoding/decoding module configurations
package modules

// Re-export core module utils for convenience
import (
	coremodules "github.com/stablenet/sdk-go/modules"
	"github.com/stablenet/sdk-go/modules/utils"
)

// Module registry access
var (
	// ECDSAValidator is the built-in ECDSA validator module entry.
	ECDSAValidator = coremodules.ECDSAValidator
	// WebAuthnValidator is the built-in WebAuthn validator module entry.
	WebAuthnValidator = coremodules.WebAuthnValidator
	// MultiSigValidator is the built-in MultiSig validator module entry.
	MultiSigValidator = coremodules.MultiSigValidator

	// SessionKeyExecutor is the built-in session key executor module entry.
	SessionKeyExecutor = coremodules.SessionKeyExecutor
	// RecurringPaymentExecutor is the built-in recurring payment executor module entry.
	RecurringPaymentExecutor = coremodules.RecurringPaymentExecutor
	// SwapExecutor is the built-in swap executor module entry.
	SwapExecutor = coremodules.SwapExecutor
	// StakingExecutor is the built-in staking executor module entry.
	StakingExecutor = coremodules.StakingExecutor
	// LendingExecutor is the built-in lending executor module entry.
	LendingExecutor = coremodules.LendingExecutor

	// SpendingLimitHook is the built-in spending limit hook module entry.
	SpendingLimitHook = coremodules.SpendingLimitHook
	// AuditHook is the built-in audit hook module entry.
	AuditHook = coremodules.AuditHook
	// WhitelistHook is the built-in whitelist hook module entry.
	WhitelistHook = coremodules.WhitelistHook
	// TimelockHook is the built-in timelock hook module entry.
	TimelockHook = coremodules.TimelockHook

	// TokenReceiverFallback is the built-in token receiver fallback module entry.
	TokenReceiverFallback = coremodules.TokenReceiverFallback
	// FlashLoanReceiverFallback is the built-in flash loan receiver fallback module entry.
	FlashLoanReceiverFallback = coremodules.FlashLoanReceiverFallback
	// ERC777ReceiverFallback is the built-in ERC-777 receiver fallback module entry.
	ERC777ReceiverFallback = coremodules.ERC777ReceiverFallback
)

// Utility function aliases for encoding/validation
var (
	// EncodeECDSAValidatorInit encodes ECDSA validator initialization data.
	EncodeECDSAValidatorInit = utils.EncodeECDSAValidatorInit
	// ValidateECDSAValidatorConfig validates ECDSA validator configuration.
	ValidateECDSAValidatorConfig = utils.ValidateECDSAValidatorConfig

	// EncodeWebAuthnValidatorInit encodes WebAuthn validator initialization data.
	EncodeWebAuthnValidatorInit = utils.EncodeWebAuthnValidatorInit
	// ValidateWebAuthnValidatorConfig validates WebAuthn validator configuration.
	ValidateWebAuthnValidatorConfig = utils.ValidateWebAuthnValidatorConfig

	// EncodeMultiSigValidatorInit encodes MultiSig validator initialization data.
	EncodeMultiSigValidatorInit = utils.EncodeMultiSigValidatorInit
	// ValidateMultiSigValidatorConfig validates MultiSig validator configuration.
	ValidateMultiSigValidatorConfig = utils.ValidateMultiSigValidatorConfig

	// EncodeSessionKeyInit encodes session key executor initialization data.
	EncodeSessionKeyInit = utils.EncodeSessionKeyInit
	// ValidateSessionKeyConfig validates session key configuration.
	ValidateSessionKeyConfig = utils.ValidateSessionKeyConfig

	// EncodeSpendingLimitInit encodes spending limit hook initialization data.
	EncodeSpendingLimitInit = utils.EncodeSpendingLimitInit
	// ValidateSpendingLimitConfig validates spending limit configuration.
	ValidateSpendingLimitConfig = utils.ValidateSpendingLimitConfig
)

// ValidationResult re-export from utils.
type ValidationResult = utils.ValidationResult
