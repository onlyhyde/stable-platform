import type { Abi } from 'viem'

/**
 * EntryPoint v0.7 ABI
 * https://github.com/eth-infinitism/account-abstraction/blob/v0.7.0/contracts/interfaces/IEntryPoint.sol
 */
export const ENTRY_POINT_V07_ABI = [
  // ============ Core Functions ============
  {
    type: 'function',
    name: 'handleOps',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============ Simulation Functions ============
  {
    type: 'function',
    name: 'simulateValidation',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'simulateHandleOp',
    inputs: [
      {
        name: 'op',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'target', type: 'address' },
      { name: 'targetCallData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============ View Functions ============
  {
    type: 'function',
    name: 'getUserOpHash',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNonce',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDepositInfo',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'deposit', type: 'uint256' },
          { name: 'staked', type: 'bool' },
          { name: 'stake', type: 'uint112' },
          { name: 'unstakeDelaySec', type: 'uint32' },
          { name: 'withdrawTime', type: 'uint48' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // ============ Deposit/Stake Functions ============
  {
    type: 'function',
    name: 'depositTo',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'addStake',
    inputs: [{ name: 'unstakeDelaySec', type: 'uint32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unlockStake',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawStake',
    inputs: [{ name: 'withdrawAddress', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawTo',
    inputs: [
      { name: 'withdrawAddress', type: 'address' },
      { name: 'withdrawAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============ Error Types ============
  {
    type: 'error',
    name: 'FailedOp',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    type: 'error',
    name: 'FailedOpWithRevert',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'inner', type: 'bytes' },
    ],
  },
  {
    type: 'error',
    name: 'ValidationResult',
    inputs: [
      {
        name: 'returnInfo',
        type: 'tuple',
        components: [
          { name: 'preOpGas', type: 'uint256' },
          { name: 'prefund', type: 'uint256' },
          { name: 'accountValidationData', type: 'uint256' },
          { name: 'paymasterValidationData', type: 'uint256' },
          { name: 'paymasterContext', type: 'bytes' },
        ],
      },
      {
        name: 'senderInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'factoryInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'paymasterInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'error',
    name: 'ValidationResultWithAggregation',
    inputs: [
      {
        name: 'returnInfo',
        type: 'tuple',
        components: [
          { name: 'preOpGas', type: 'uint256' },
          { name: 'prefund', type: 'uint256' },
          { name: 'accountValidationData', type: 'uint256' },
          { name: 'paymasterValidationData', type: 'uint256' },
          { name: 'paymasterContext', type: 'bytes' },
        ],
      },
      {
        name: 'senderInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'factoryInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'paymasterInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'aggregatorInfo',
        type: 'tuple',
        components: [
          { name: 'aggregator', type: 'address' },
          {
            name: 'stakeInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'error',
    name: 'ExecutionResult',
    inputs: [
      { name: 'preOpGas', type: 'uint256' },
      { name: 'paid', type: 'uint256' },
      { name: 'accountValidationData', type: 'uint256' },
      { name: 'paymasterValidationData', type: 'uint256' },
      { name: 'targetSuccess', type: 'bool' },
      { name: 'targetResult', type: 'bytes' },
    ],
  },
  {
    type: 'error',
    name: 'SignatureValidationFailed',
    inputs: [{ name: 'aggregator', type: 'address' }],
  },
  {
    type: 'error',
    name: 'SenderAddressResult',
    inputs: [{ name: 'sender', type: 'address' }],
  },

  // ============ Events ============
  {
    type: 'event',
    name: 'UserOperationEvent',
    inputs: [
      { name: 'userOpHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'paymaster', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'success', type: 'bool', indexed: false },
      { name: 'actualGasCost', type: 'uint256', indexed: false },
      { name: 'actualGasUsed', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AccountDeployed',
    inputs: [
      { name: 'userOpHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'factory', type: 'address', indexed: false },
      { name: 'paymaster', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UserOperationRevertReason',
    inputs: [
      { name: 'userOpHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'revertReason', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UserOperationPrefundTooLow',
    inputs: [
      { name: 'userOpHash', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BeforeExecution',
    inputs: [],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'totalDeposit', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'withdrawAddress', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakeLocked',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'totalStaked', type: 'uint256', indexed: false },
      { name: 'unstakeDelaySec', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakeUnlocked',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'withdrawTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakeWithdrawn',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'withdrawAddress', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi

/**
 * handleAggregatedOps function for aggregator support
 */
export const HANDLE_AGGREGATED_OPS_ABI = [
  {
    type: 'function',
    name: 'handleAggregatedOps',
    inputs: [
      {
        name: 'opsPerAggregator',
        type: 'tuple[]',
        components: [
          {
            name: 'userOps',
            type: 'tuple[]',
            components: [
              { name: 'sender', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'initCode', type: 'bytes' },
              { name: 'callData', type: 'bytes' },
              { name: 'accountGasLimits', type: 'bytes32' },
              { name: 'preVerificationGas', type: 'uint256' },
              { name: 'gasFees', type: 'bytes32' },
              { name: 'paymasterAndData', type: 'bytes' },
              { name: 'signature', type: 'bytes' },
            ],
          },
          { name: 'aggregator', type: 'address' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * IAggregator interface ABI
 * https://github.com/eth-infinitism/account-abstraction/blob/v0.7.0/contracts/interfaces/IAggregator.sol
 */
export const AGGREGATOR_ABI = [
  {
    type: 'function',
    name: 'validateSignatures',
    inputs: [
      {
        name: 'userOps',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'validateUserOpSignature',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'sigForUserOp', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'aggregateSignatures',
    inputs: [
      {
        name: 'userOps',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'aggregatedSignature', type: 'bytes' }],
    stateMutability: 'view',
  },
] as const

/**
 * Error selectors for quick matching
 */
export const ERROR_SELECTORS = {
  ValidationResult: '0xe0cff05f',
  ValidationResultWithAggregation: '0x8a1a02cd',
  FailedOp: '0x220266b6',
  FailedOpWithRevert: '0x65c8fd4d',
  ExecutionResult: '0x8b7ac980',
  SignatureValidationFailed: '0x86a9f750',
  SenderAddressResult: '0x6ca7b806',
} as const

/**
 * Event signatures for log parsing
 */
export const EVENT_SIGNATURES = {
  UserOperationEvent:
    '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f',
  AccountDeployed:
    '0xd51a9c61267aa6196961883ecf5ff2da6619c37dac0fa92122513fb32c032d2d',
  UserOperationRevertReason:
    '0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201',
  UserOperationPrefundTooLow:
    '0x5e0f9bcb94d3d5e5cfe0c6eecb2f1c26c89f31fca7d32bd2be3f7b4b8f2cac1a',
} as const
