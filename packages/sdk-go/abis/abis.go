// Package abis provides contract ABI definitions for StableNet smart contracts.
// This package centralizes all ABI definitions used across the SDK.
package abis

import (
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// MustParseABI parses an ABI JSON string and panics on error.
func MustParseABI(abiJSON string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		panic("failed to parse ABI: " + err.Error())
	}
	return parsed
}

// ============================================================================
// ERC-7579 Module Interface
// ============================================================================

// ModuleInterfaceABIJSON is the ABI for ERC-7579 base module interface.
const ModuleInterfaceABIJSON = `[
	{
		"type": "function",
		"name": "onInstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "onUninstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
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

// ============================================================================
// ERC-4337 Entry Point v0.7
// ============================================================================

// EntryPointABIJSON is the ABI for ERC-4337 Entry Point v0.7.
const EntryPointABIJSON = `[
	{
		"type": "function",
		"name": "handleOps",
		"inputs": [
			{
				"name": "ops",
				"type": "tuple[]",
				"components": [
					{"name": "sender", "type": "address"},
					{"name": "nonce", "type": "uint256"},
					{"name": "initCode", "type": "bytes"},
					{"name": "callData", "type": "bytes"},
					{"name": "accountGasLimits", "type": "bytes32"},
					{"name": "preVerificationGas", "type": "uint256"},
					{"name": "gasFees", "type": "bytes32"},
					{"name": "paymasterAndData", "type": "bytes"},
					{"name": "signature", "type": "bytes"}
				]
			},
			{"name": "beneficiary", "type": "address"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getNonce",
		"inputs": [
			{"name": "sender", "type": "address"},
			{"name": "key", "type": "uint192"}
		],
		"outputs": [{"name": "nonce", "type": "uint256"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getDepositInfo",
		"inputs": [{"name": "account", "type": "address"}],
		"outputs": [
			{
				"name": "info",
				"type": "tuple",
				"components": [
					{"name": "deposit", "type": "uint256"},
					{"name": "staked", "type": "bool"},
					{"name": "stake", "type": "uint112"},
					{"name": "unstakeDelaySec", "type": "uint32"},
					{"name": "withdrawTime", "type": "uint48"}
				]
			}
		],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getUserOpHash",
		"inputs": [
			{
				"name": "userOp",
				"type": "tuple",
				"components": [
					{"name": "sender", "type": "address"},
					{"name": "nonce", "type": "uint256"},
					{"name": "initCode", "type": "bytes"},
					{"name": "callData", "type": "bytes"},
					{"name": "accountGasLimits", "type": "bytes32"},
					{"name": "preVerificationGas", "type": "uint256"},
					{"name": "gasFees", "type": "bytes32"},
					{"name": "paymasterAndData", "type": "bytes"},
					{"name": "signature", "type": "bytes"}
				]
			}
		],
		"outputs": [{"name": "", "type": "bytes32"}],
		"stateMutability": "view"
	},
	{
		"type": "event",
		"name": "UserOperationEvent",
		"inputs": [
			{"name": "userOpHash", "type": "bytes32", "indexed": true},
			{"name": "sender", "type": "address", "indexed": true},
			{"name": "paymaster", "type": "address", "indexed": true},
			{"name": "nonce", "type": "uint256", "indexed": false},
			{"name": "success", "type": "bool", "indexed": false},
			{"name": "actualGasCost", "type": "uint256", "indexed": false},
			{"name": "actualGasUsed", "type": "uint256", "indexed": false}
		]
	},
	{
		"type": "event",
		"name": "UserOperationRevertReason",
		"inputs": [
			{"name": "userOpHash", "type": "bytes32", "indexed": true},
			{"name": "sender", "type": "address", "indexed": true},
			{"name": "nonce", "type": "uint256", "indexed": false},
			{"name": "revertReason", "type": "bytes", "indexed": false}
		]
	}
]`

// ============================================================================
// Kernel Smart Account
// ============================================================================

// KernelABIJSON is the ABI for Kernel smart account.
const KernelABIJSON = `[
	{
		"type": "function",
		"name": "execute",
		"inputs": [
			{"name": "execMode", "type": "bytes32"},
			{"name": "executionCalldata", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
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
		"name": "executeFromExecutor",
		"inputs": [
			{"name": "execMode", "type": "bytes32"},
			{"name": "executionCalldata", "type": "bytes"}
		],
		"outputs": [{"name": "returnData", "type": "bytes[]"}],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "supportsExecutionMode",
		"inputs": [{"name": "mode", "type": "bytes32"}],
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "accountId",
		"inputs": [],
		"outputs": [{"name": "", "type": "string"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "currentNonce",
		"inputs": [],
		"outputs": [{"name": "", "type": "uint32"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "forceUninstallModule",
		"inputs": [
			{"name": "moduleType", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "deInitData", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "replaceModule",
		"inputs": [
			{"name": "moduleType", "type": "uint256"},
			{"name": "oldModule", "type": "address"},
			{"name": "deInitData", "type": "bytes"},
			{"name": "newModule", "type": "address"},
			{"name": "initData", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "setHookGasLimit",
		"inputs": [
			{"name": "hook", "type": "address"},
			{"name": "gasLimit", "type": "uint256"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "setDelegatecallWhitelist",
		"inputs": [
			{"name": "target", "type": "address"},
			{"name": "allowed", "type": "bool"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "setEnforceDelegatecallWhitelist",
		"inputs": [
			{"name": "enforce", "type": "bool"}
		],
		"outputs": [],
		"stateMutability": "payable"
	},
	{
		"type": "event",
		"name": "HookGasLimitSet",
		"inputs": [
			{"name": "hook", "type": "address", "indexed": true},
			{"name": "gasLimit", "type": "uint256", "indexed": false}
		]
	},
	{
		"type": "event",
		"name": "DelegatecallWhitelistUpdated",
		"inputs": [
			{"name": "target", "type": "address", "indexed": true},
			{"name": "allowed", "type": "bool", "indexed": false}
		]
	},
	{
		"type": "event",
		"name": "DelegatecallWhitelistEnforced",
		"inputs": [
			{"name": "enforce", "type": "bool", "indexed": false}
		]
	},
	{
		"type": "error",
		"name": "DelegatecallTargetNotWhitelisted",
		"inputs": [{"name": "target", "type": "address"}]
	},
	{
		"type": "error",
		"name": "Reentrancy",
		"inputs": []
	}
]`

// KernelFactoryABIJSON is the ABI for Kernel factory.
const KernelFactoryABIJSON = `[
	{
		"type": "function",
		"name": "createAccount",
		"inputs": [
			{"name": "initData", "type": "bytes"},
			{"name": "salt", "type": "bytes32"}
		],
		"outputs": [{"name": "account", "type": "address"}],
		"stateMutability": "payable"
	},
	{
		"type": "function",
		"name": "getAccountAddress",
		"inputs": [
			{"name": "initData", "type": "bytes"},
			{"name": "salt", "type": "bytes32"}
		],
		"outputs": [{"name": "", "type": "address"}],
		"stateMutability": "view"
	}
]`

// ============================================================================
// Validators (ERC-7579 Module Type 1)
// ============================================================================

// ECDSAValidatorABIJSON is the ABI for ECDSA validator.
const ECDSAValidatorABIJSON = `[
	{
		"type": "function",
		"name": "onInstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "onUninstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "validateUserOp",
		"inputs": [
			{
				"name": "userOp",
				"type": "tuple",
				"components": [
					{"name": "sender", "type": "address"},
					{"name": "nonce", "type": "uint256"},
					{"name": "initCode", "type": "bytes"},
					{"name": "callData", "type": "bytes"},
					{"name": "accountGasLimits", "type": "bytes32"},
					{"name": "preVerificationGas", "type": "uint256"},
					{"name": "gasFees", "type": "bytes32"},
					{"name": "paymasterAndData", "type": "bytes"},
					{"name": "signature", "type": "bytes"}
				]
			},
			{"name": "userOpHash", "type": "bytes32"}
		],
		"outputs": [{"name": "validationData", "type": "uint256"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "isValidSignatureWithSender",
		"inputs": [
			{"name": "sender", "type": "address"},
			{"name": "hash", "type": "bytes32"},
			{"name": "signature", "type": "bytes"}
		],
		"outputs": [{"name": "", "type": "bytes4"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "signer",
		"inputs": [{"name": "account", "type": "address"}],
		"outputs": [{"name": "", "type": "address"}],
		"stateMutability": "view"
	}
]`

// ============================================================================
// Stealth Addresses (EIP-5564 & EIP-6538)
// ============================================================================

// ERC5564AnnouncerABIJSON is the ABI for EIP-5564 Stealth Address Announcer.
const ERC5564AnnouncerABIJSON = `[
	{
		"type": "function",
		"name": "announce",
		"inputs": [
			{"name": "schemeId", "type": "uint256"},
			{"name": "stealthAddress", "type": "address"},
			{"name": "ephemeralPubKey", "type": "bytes"},
			{"name": "metadata", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "event",
		"name": "Announcement",
		"inputs": [
			{"name": "schemeId", "type": "uint256", "indexed": true},
			{"name": "stealthAddress", "type": "address", "indexed": true},
			{"name": "caller", "type": "address", "indexed": true},
			{"name": "ephemeralPubKey", "type": "bytes", "indexed": false},
			{"name": "metadata", "type": "bytes", "indexed": false}
		]
	}
]`

// ERC6538RegistryABIJSON is the ABI for EIP-6538 Stealth Meta-Address Registry.
const ERC6538RegistryABIJSON = `[
	{
		"type": "function",
		"name": "registerKeys",
		"inputs": [
			{"name": "schemeId", "type": "uint256"},
			{"name": "stealthMetaAddress", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "registerKeysOnBehalf",
		"inputs": [
			{"name": "registrant", "type": "address"},
			{"name": "schemeId", "type": "uint256"},
			{"name": "signature", "type": "bytes"},
			{"name": "stealthMetaAddress", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "stealthMetaAddressOf",
		"inputs": [
			{"name": "registrant", "type": "address"},
			{"name": "schemeId", "type": "uint256"}
		],
		"outputs": [{"name": "", "type": "bytes"}],
		"stateMutability": "view"
	},
	{
		"type": "event",
		"name": "StealthMetaAddressSet",
		"inputs": [
			{"name": "registrant", "type": "address", "indexed": true},
			{"name": "schemeId", "type": "uint256", "indexed": true},
			{"name": "stealthMetaAddress", "type": "bytes", "indexed": false}
		]
	}
]`

// ============================================================================
// Executors (ERC-7579 Module Type 2)
// ============================================================================

// SessionKeyExecutorABIJSON is the ABI for Session Key executor.
const SessionKeyExecutorABIJSON = `[
	{
		"type": "function",
		"name": "onInstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "onUninstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "addSessionKey",
		"inputs": [
			{"name": "sessionKey", "type": "address"},
			{"name": "validAfter", "type": "uint48"},
			{"name": "validUntil", "type": "uint48"},
			{"name": "permissions", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "removeSessionKey",
		"inputs": [{"name": "sessionKey", "type": "address"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "isSessionKeyValid",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "sessionKey", "type": "address"}
		],
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getSessionKeyData",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "sessionKey", "type": "address"}
		],
		"outputs": [
			{
				"name": "",
				"type": "tuple",
				"components": [
					{"name": "validAfter", "type": "uint48"},
					{"name": "validUntil", "type": "uint48"},
					{"name": "permissions", "type": "bytes"}
				]
			}
		],
		"stateMutability": "view"
	}
]`

// ============================================================================
// Hooks (ERC-7579 Module Type 4)
// ============================================================================

// SpendingLimitHookABIJSON is the ABI for Spending Limit hook.
const SpendingLimitHookABIJSON = `[
	{
		"type": "function",
		"name": "onInstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "onUninstall",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "setSpendingLimit",
		"inputs": [
			{"name": "token", "type": "address"},
			{"name": "limit", "type": "uint256"},
			{"name": "period", "type": "uint256"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getSpendingLimit",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "token", "type": "address"}
		],
		"outputs": [
			{
				"name": "",
				"type": "tuple",
				"components": [
					{"name": "limit", "type": "uint256"},
					{"name": "spent", "type": "uint256"},
					{"name": "period", "type": "uint256"},
					{"name": "lastReset", "type": "uint256"}
				]
			}
		],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getRemainingLimit",
		"inputs": [
			{"name": "account", "type": "address"},
			{"name": "token", "type": "address"}
		],
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view"
	}
]`

// ============================================================================
// Parsed ABIs (for convenience)
// ============================================================================

var (
	// ModuleInterfaceABI is the parsed ERC-7579 module interface ABI.
	ModuleInterfaceABI = MustParseABI(ModuleInterfaceABIJSON)

	// EntryPointABI is the parsed ERC-4337 entry point ABI.
	EntryPointABI = MustParseABI(EntryPointABIJSON)

	// KernelABI is the parsed Kernel smart account ABI.
	KernelABI = MustParseABI(KernelABIJSON)

	// KernelFactoryABI is the parsed Kernel factory ABI.
	KernelFactoryABI = MustParseABI(KernelFactoryABIJSON)

	// ECDSAValidatorABI is the parsed ECDSA validator ABI.
	ECDSAValidatorABI = MustParseABI(ECDSAValidatorABIJSON)

	// ERC5564AnnouncerABI is the parsed EIP-5564 announcer ABI.
	ERC5564AnnouncerABI = MustParseABI(ERC5564AnnouncerABIJSON)

	// ERC6538RegistryABI is the parsed EIP-6538 registry ABI.
	ERC6538RegistryABI = MustParseABI(ERC6538RegistryABIJSON)

	// SessionKeyExecutorABI is the parsed session key executor ABI.
	SessionKeyExecutorABI = MustParseABI(SessionKeyExecutorABIJSON)

	// SpendingLimitHookABI is the parsed spending limit hook ABI.
	SpendingLimitHookABI = MustParseABI(SpendingLimitHookABIJSON)
)
