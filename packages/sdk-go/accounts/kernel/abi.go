package kernel

import (
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// KernelAccountABI is the ABI for Kernel smart account.
var KernelAccountABI abi.ABI

// KernelFactoryABI is the ABI for Kernel factory.
var KernelFactoryABI abi.ABI

// EntryPointABI is the ABI for EntryPoint v0.7.
var EntryPointABI abi.ABI

func init() {
	var err error

	KernelAccountABI, err = abi.JSON(strings.NewReader(kernelAccountABIJSON))
	if err != nil {
		panic("failed to parse Kernel account ABI: " + err.Error())
	}

	KernelFactoryABI, err = abi.JSON(strings.NewReader(kernelFactoryABIJSON))
	if err != nil {
		panic("failed to parse Kernel factory ABI: " + err.Error())
	}

	EntryPointABI, err = abi.JSON(strings.NewReader(entryPointABIJSON))
	if err != nil {
		panic("failed to parse EntryPoint ABI: " + err.Error())
	}
}

const kernelAccountABIJSON = `[
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {"name": "rootValidator", "type": "bytes21"},
      {"name": "hook", "type": "address"},
      {"name": "validatorData", "type": "bytes"},
      {"name": "hookData", "type": "bytes"},
      {"name": "initConfig", "type": "bytes[]"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {"name": "mode", "type": "bytes32"},
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
    "name": "rootValidator",
    "inputs": [],
    "outputs": [{"name": "", "type": "bytes21"}],
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
  }
]`

const kernelFactoryABIJSON = `[
  {
    "type": "function",
    "name": "createAccount",
    "inputs": [
      {"name": "initData", "type": "bytes"},
      {"name": "salt", "type": "bytes32"}
    ],
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getAddress",
    "inputs": [
      {"name": "initData", "type": "bytes"},
      {"name": "salt", "type": "bytes32"}
    ],
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view"
  }
]`

const entryPointABIJSON = `[
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
    "type": "function",
    "name": "getSenderAddress",
    "inputs": [{"name": "initCode", "type": "bytes"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "error",
    "name": "SenderAddressResult",
    "inputs": [{"name": "sender", "type": "address"}]
  }
]`
