package modules

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Kernel Account ABI (ERC-7579 compatible)
// ============================================================================

const kernelModuleABI = `[
	{
		"type": "function",
		"name": "installModule",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "initData", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "uninstallModule",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "deInitData", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "isModuleInstalled",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "additionalContext", "type": "bytes"}
		],
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "rootValidator",
		"inputs": [],
		"outputs": [{"name": "", "type": "address"}],
		"stateMutability": "view"
	}
]`

const moduleInterfaceABI = `[
	{
		"type": "function",
		"name": "isModuleType",
		"inputs": [{"name": "moduleTypeId", "type": "uint256"}],
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "isInitialized",
		"inputs": [{"name": "smartAccount", "type": "address"}],
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "view"
	}
]`

var (
	kernelABI, _  = abi.JSON(strings.NewReader(kernelModuleABI))
	iModuleABI, _ = abi.JSON(strings.NewReader(moduleInterfaceABI))
)

// ============================================================================
// Module Installation
// ============================================================================

// EncodeInstallModule encodes call data for installing a module.
func EncodeInstallModule(params InstallModuleParams) (types.Hex, error) {
	data, err := kernelABI.Pack(
		"installModule",
		big.NewInt(int64(params.ModuleType)),
		common.Address(params.Module),
		params.InitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode installModule: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeUninstallModule encodes call data for uninstalling a module.
func EncodeUninstallModule(params UninstallModuleParams) (types.Hex, error) {
	data, err := kernelABI.Pack(
		"uninstallModule",
		big.NewInt(int64(params.ModuleType)),
		common.Address(params.Module),
		params.DeInitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode uninstallModule: %w", err)
	}
	return types.Hex(data), nil
}

// BuildInstallModuleCall builds a call for installing a module on a smart account.
func BuildInstallModuleCall(smartAccount types.Address, params InstallModuleParams) (*ModuleOperationCallData, error) {
	data, err := EncodeInstallModule(params)
	if err != nil {
		return nil, err
	}
	return &ModuleOperationCallData{
		To:    smartAccount,
		Data:  data,
		Value: big.NewInt(0),
	}, nil
}

// BuildUninstallModuleCall builds a call for uninstalling a module from a smart account.
func BuildUninstallModuleCall(smartAccount types.Address, params UninstallModuleParams) (*ModuleOperationCallData, error) {
	data, err := EncodeUninstallModule(params)
	if err != nil {
		return nil, err
	}
	return &ModuleOperationCallData{
		To:    smartAccount,
		Data:  data,
		Value: big.NewInt(0),
	}, nil
}

// ============================================================================
// Batch Operations
// ============================================================================

// BuildBatchInstallModuleCalls builds calls for batch module installation.
func BuildBatchInstallModuleCalls(smartAccount types.Address, batch BatchModuleInstallation) ([]*ModuleOperationCallData, error) {
	var calls []*ModuleOperationCallData

	// Install validators
	for _, validator := range batch.Validators {
		call, err := BuildInstallModuleCall(smartAccount, InstallModuleParams{
			ModuleType: MODULE_TYPES.VALIDATOR,
			Module:     validator.Address,
			InitData:   validator.InitData,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to build validator install call: %w", err)
		}
		calls = append(calls, call)
	}

	// Install executors
	for _, executor := range batch.Executors {
		call, err := BuildInstallModuleCall(smartAccount, InstallModuleParams{
			ModuleType: MODULE_TYPES.EXECUTOR,
			Module:     executor.Address,
			InitData:   executor.InitData,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to build executor install call: %w", err)
		}
		calls = append(calls, call)
	}

	// Install hooks
	for _, hook := range batch.Hooks {
		call, err := BuildInstallModuleCall(smartAccount, InstallModuleParams{
			ModuleType: MODULE_TYPES.HOOK,
			Module:     hook.Address,
			InitData:   hook.InitData,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to build hook install call: %w", err)
		}
		calls = append(calls, call)
	}

	// Install fallbacks
	for _, fallback := range batch.Fallbacks {
		call, err := BuildInstallModuleCall(smartAccount, InstallModuleParams{
			ModuleType: MODULE_TYPES.FALLBACK,
			Module:     fallback.Address,
			InitData:   fallback.InitData,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to build fallback install call: %w", err)
		}
		calls = append(calls, call)
	}

	return calls, nil
}

// ============================================================================
// Module Queries
// ============================================================================

// IsModuleInstalled checks if a module is installed on a smart account.
func IsModuleInstalled(ctx context.Context, client *ethclient.Client, smartAccount types.Address, params IsModuleInstalledParams) (bool, error) {
	additionalContext := params.AdditionalContext.Bytes()
	if additionalContext == nil {
		additionalContext = []byte{}
	}

	data, err := kernelABI.Pack(
		"isModuleInstalled",
		big.NewInt(int64(params.ModuleType)),
		common.Address(params.Module),
		additionalContext,
	)
	if err != nil {
		return false, fmt.Errorf("failed to encode isModuleInstalled: %w", err)
	}

	to := common.Address(smartAccount)
	callMsg := ethereum.CallMsg{
		To:   &to,
		Data: data,
	}

	result, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return false, nil // Return false if call fails (account may not exist)
	}

	if len(result) < 32 {
		return false, nil
	}

	// Decode bool result
	return new(big.Int).SetBytes(result).Cmp(big.NewInt(0)) != 0, nil
}

// IsModuleType checks if a module supports a specific module type.
func IsModuleType(ctx context.Context, client *ethclient.Client, moduleAddress types.Address, moduleType types.ModuleType) (bool, error) {
	data, err := iModuleABI.Pack(
		"isModuleType",
		big.NewInt(int64(moduleType)),
	)
	if err != nil {
		return false, fmt.Errorf("failed to encode isModuleType: %w", err)
	}

	to := common.Address(moduleAddress)
	callMsg := ethereum.CallMsg{
		To:   &to,
		Data: data,
	}

	result, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return false, nil
	}

	if len(result) < 32 {
		return false, nil
	}

	return new(big.Int).SetBytes(result).Cmp(big.NewInt(0)) != 0, nil
}

// IsModuleInitialized checks if a module is initialized for a smart account.
func IsModuleInitialized(ctx context.Context, client *ethclient.Client, moduleAddress, smartAccount types.Address) (bool, error) {
	data, err := iModuleABI.Pack(
		"isInitialized",
		common.Address(smartAccount),
	)
	if err != nil {
		return false, fmt.Errorf("failed to encode isInitialized: %w", err)
	}

	to := common.Address(moduleAddress)
	callMsg := ethereum.CallMsg{
		To:   &to,
		Data: data,
	}

	result, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return false, nil
	}

	if len(result) < 32 {
		return false, nil
	}

	return new(big.Int).SetBytes(result).Cmp(big.NewInt(0)) != 0, nil
}

// GetRootValidator gets the root validator address for a smart account.
func GetRootValidator(ctx context.Context, client *ethclient.Client, smartAccount types.Address) (types.Address, error) {
	data, err := kernelABI.Pack("rootValidator")
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to encode rootValidator: %w", err)
	}

	to := common.Address(smartAccount)
	callMsg := ethereum.CallMsg{
		To:   &to,
		Data: data,
	}

	result, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to call rootValidator: %w", err)
	}

	if len(result) < 32 {
		return types.Address{}, fmt.Errorf("invalid response length")
	}

	return common.BytesToAddress(result[12:32]), nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// ValidateModuleType validates that the module type is valid.
func ValidateModuleType(moduleType types.ModuleType) (types.ModuleType, error) {
	if moduleType != types.ModuleTypeValidator &&
		moduleType != types.ModuleTypeExecutor &&
		moduleType != types.ModuleTypeFallback &&
		moduleType != types.ModuleTypeHook {
		return 0, NewInvalidModuleTypeError(
			fmt.Sprintf("Invalid module type: %d", moduleType),
			"INVALID_MODULE_TYPE",
			map[string]any{"moduleType": moduleType},
		)
	}
	return moduleType, nil
}

// GetModuleTypeName returns the name of a module type.
func GetModuleTypeName(moduleType types.ModuleType) string {
	switch moduleType {
	case types.ModuleTypeValidator:
		return "Validator"
	case types.ModuleTypeExecutor:
		return "Executor"
	case types.ModuleTypeFallback:
		return "Fallback"
	case types.ModuleTypeHook:
		return "Hook"
	default:
		return "Unknown"
	}
}

// ============================================================================
// Validator Init Data Encoders
// ============================================================================

// EncodeECDSAValidatorInitData creates ECDSA validator init data.
func EncodeECDSAValidatorInitData(owner types.Address) types.Hex {
	// ECDSA validator expects owner address as init data (20 bytes)
	return types.Hex(owner.Bytes())
}

// EncodeWebAuthnValidatorInitData creates WebAuthn validator init data.
func EncodeWebAuthnValidatorInitData(config WebAuthnValidatorConfig) types.Hex {
	// Encode: pubKeyX (32 bytes) + pubKeyY (32 bytes) + authenticatorIdLength (32 bytes) + authenticatorId
	result := make([]byte, 0, 96+len(config.CredentialId))

	// PubKeyX (32 bytes, big-endian)
	pubKeyXBytes := make([]byte, 32)
	config.PubKeyX.FillBytes(pubKeyXBytes)
	result = append(result, pubKeyXBytes...)

	// PubKeyY (32 bytes, big-endian)
	pubKeyYBytes := make([]byte, 32)
	config.PubKeyY.FillBytes(pubKeyYBytes)
	result = append(result, pubKeyYBytes...)

	// Authenticator ID length (32 bytes, big-endian)
	lengthBytes := make([]byte, 32)
	big.NewInt(int64(len(config.CredentialId))).FillBytes(lengthBytes)
	result = append(result, lengthBytes...)

	// Authenticator ID
	result = append(result, config.CredentialId.Bytes()...)

	return types.Hex(result)
}

// EncodeMultiSigValidatorInitData creates MultiSig validator init data.
func EncodeMultiSigValidatorInitData(config MultiSigValidatorConfig) types.Hex {
	// Encode: threshold (32 bytes) + signerCount (32 bytes) + signers (32 bytes each, padded)
	result := make([]byte, 0, 64+len(config.Signers)*32)

	// Threshold (32 bytes, big-endian)
	thresholdBytes := make([]byte, 32)
	big.NewInt(int64(config.Threshold)).FillBytes(thresholdBytes)
	result = append(result, thresholdBytes...)

	// Signer count (32 bytes, big-endian)
	countBytes := make([]byte, 32)
	big.NewInt(int64(len(config.Signers))).FillBytes(countBytes)
	result = append(result, countBytes...)

	// Signers (32 bytes each, left-padded with zeros)
	for _, signer := range config.Signers {
		signerBytes := make([]byte, 32)
		copy(signerBytes[12:], signer.Bytes()) // 20 bytes address, left-padded
		result = append(result, signerBytes...)
	}

	return types.Hex(result)
}

// ============================================================================
// Executor Init Data Encoders
// ============================================================================

// EncodeSessionKeyExecutorInitData creates session key executor init data.
// For initial installation, empty init data is valid.
func EncodeSessionKeyExecutorInitData() types.Hex {
	return types.Hex{}
}

// EncodeSwapExecutorInitData creates swap executor init data.
func EncodeSwapExecutorInitData(config SwapExecutorConfig) types.Hex {
	result := make([]byte, 64)

	// MaxSlippageBps (32 bytes, big-endian)
	slippageBytes := make([]byte, 32)
	big.NewInt(int64(config.MaxSlippageBps)).FillBytes(slippageBytes)
	copy(result[0:32], slippageBytes)

	// DailyLimit (32 bytes, big-endian)
	if config.DailyLimit != nil {
		config.DailyLimit.FillBytes(result[32:64])
	}

	return types.Hex(result)
}

// EncodeLendingExecutorInitData creates lending executor init data.
func EncodeLendingExecutorInitData(config LendingExecutorConfig) types.Hex {
	result := make([]byte, 96)

	// MaxLtv (32 bytes, big-endian)
	ltvBytes := make([]byte, 32)
	big.NewInt(int64(config.MaxLtv)).FillBytes(ltvBytes)
	copy(result[0:32], ltvBytes)

	// MinHealthFactor (32 bytes, big-endian)
	if config.MinHealthFactor != nil {
		config.MinHealthFactor.FillBytes(result[32:64])
	}

	// DailyBorrowLimit (32 bytes, big-endian)
	if config.DailyBorrowLimit != nil {
		config.DailyBorrowLimit.FillBytes(result[64:96])
	}

	return types.Hex(result)
}

// EncodeStakingExecutorInitData creates staking executor init data.
func EncodeStakingExecutorInitData(config StakingExecutorConfig) types.Hex {
	result := make([]byte, 64)

	// MaxStakePerPool (32 bytes, big-endian)
	if config.MaxStakePerPool != nil {
		config.MaxStakePerPool.FillBytes(result[0:32])
	}

	// DailyStakeLimit (32 bytes, big-endian)
	if config.DailyStakeLimit != nil {
		config.DailyStakeLimit.FillBytes(result[32:64])
	}

	return types.Hex(result)
}

// ============================================================================
// Hook Init Data Encoders
// ============================================================================

// EncodeSpendingLimitHookInitData creates spending limit hook init data.
func EncodeSpendingLimitHookInitData(config SpendingLimitHookConfig) types.Hex {
	result := make([]byte, 96)

	// Token address (32 bytes, left-padded)
	tokenBytes := make([]byte, 32)
	copy(tokenBytes[12:], config.Token.Bytes())
	copy(result[0:32], tokenBytes)

	// Limit (32 bytes, big-endian)
	if config.Limit != nil {
		config.Limit.FillBytes(result[32:64])
	}

	// Period (32 bytes, big-endian)
	periodBytes := make([]byte, 32)
	big.NewInt(int64(config.Period)).FillBytes(periodBytes)
	copy(result[64:96], periodBytes)

	return types.Hex(result)
}

// EncodeHealthFactorHookInitData creates health factor hook init data.
func EncodeHealthFactorHookInitData(config HealthFactorHookConfig) types.Hex {
	result := make([]byte, 32)

	// MinHealthFactor (32 bytes, big-endian)
	if config.MinHealthFactor != nil {
		config.MinHealthFactor.FillBytes(result)
	}

	return types.Hex(result)
}

// EncodePolicyHookInitData creates policy hook init data.
func EncodePolicyHookInitData(config PolicyHookConfig) types.Hex {
	result := make([]byte, 64)

	// MaxValue (32 bytes, big-endian)
	if config.MaxValue != nil {
		config.MaxValue.FillBytes(result[0:32])
	}

	// DailyLimit (32 bytes, big-endian)
	if config.DailyLimit != nil {
		config.DailyLimit.FillBytes(result[32:64])
	}

	return types.Hex(result)
}

