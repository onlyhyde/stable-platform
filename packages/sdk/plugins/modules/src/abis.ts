/**
 * @stablenet/plugin-modules - ABIs
 * Kernel Smart Account module management ABIs
 */

/**
 * Kernel Smart Account Module Interface ABI
 * Functions for installing, uninstalling, and querying modules
 */
export const KernelModuleAbi = [
  // ============================================================================
  // Module Installation
  // ============================================================================
  {
    type: 'function',
    name: 'installModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256', internalType: 'uint256' },
      { name: 'module', type: 'address', internalType: 'address' },
      { name: 'initData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'uninstallModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256', internalType: 'uint256' },
      { name: 'module', type: 'address', internalType: 'address' },
      { name: 'deInitData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },

  // ============================================================================
  // Module Queries
  // ============================================================================
  {
    type: 'function',
    name: 'isModuleInstalled',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256', internalType: 'uint256' },
      { name: 'module', type: 'address', internalType: 'address' },
      { name: 'additionalContext', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },

  // ============================================================================
  // Root Validator (Special handling)
  // ============================================================================
  {
    type: 'function',
    name: 'setRootValidator',
    inputs: [
      { name: 'validator', type: 'address', internalType: 'address' },
      { name: 'validatorData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rootValidator',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },

  // ============================================================================
  // Execution (for module operations)
  // ============================================================================
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'mode', type: 'bytes32', internalType: 'ExecMode' },
      { name: 'executionCalldata', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'executeFromExecutor',
    inputs: [
      { name: 'mode', type: 'bytes32', internalType: 'ExecMode' },
      { name: 'executionCalldata', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'returnData', type: 'bytes[]', internalType: 'bytes[]' },
    ],
    stateMutability: 'payable',
  },

  // ============================================================================
  // Events
  // ============================================================================
  {
    type: 'event',
    name: 'ModuleInstalled',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'module', type: 'address', indexed: false, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ModuleUninstalled',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'module', type: 'address', indexed: false, internalType: 'address' },
    ],
    anonymous: false,
  },

  // ============================================================================
  // Errors
  // ============================================================================
  {
    type: 'error',
    name: 'InvalidModuleType',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ModuleAlreadyInstalled',
    inputs: [{ name: 'module', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ModuleNotInstalled',
    inputs: [{ name: 'module', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'InvalidModule',
    inputs: [{ name: 'module', type: 'address', internalType: 'address' }],
  },
] as const

/**
 * IModule Interface ABI
 * Standard ERC-7579 module interface
 */
export const IModuleAbi = [
  {
    type: 'function',
    name: 'onInstall',
    inputs: [{ name: 'data', type: 'bytes', internalType: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onUninstall',
    inputs: [{ name: 'data', type: 'bytes', internalType: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isModuleType',
    inputs: [{ name: 'moduleTypeId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isInitialized',
    inputs: [{ name: 'smartAccount', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
] as const

/**
 * ECDSA Validator ABI
 */
export const ECDSAValidatorAbi = [
  ...IModuleAbi,
  {
    type: 'function',
    name: 'validateUserOp',
    inputs: [
      { name: 'userOp', type: 'tuple', internalType: 'struct PackedUserOperation', components: [
        { name: 'sender', type: 'address', internalType: 'address' },
        { name: 'nonce', type: 'uint256', internalType: 'uint256' },
        { name: 'initCode', type: 'bytes', internalType: 'bytes' },
        { name: 'callData', type: 'bytes', internalType: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32', internalType: 'bytes32' },
        { name: 'preVerificationGas', type: 'uint256', internalType: 'uint256' },
        { name: 'gasFees', type: 'bytes32', internalType: 'bytes32' },
        { name: 'paymasterAndData', type: 'bytes', internalType: 'bytes' },
        { name: 'signature', type: 'bytes', internalType: 'bytes' },
      ]},
      { name: 'userOpHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validateSignature',
    inputs: [
      { name: 'hash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOwner',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const

/**
 * Session Key Executor ABI
 */
export const SessionKeyExecutorAbi = [
  ...IModuleAbi,
  {
    type: 'function',
    name: 'addSessionKey',
    inputs: [
      { name: 'sessionKey', type: 'address', internalType: 'address' },
      { name: 'allowedTargets', type: 'address[]', internalType: 'address[]' },
      { name: 'spendLimit', type: 'uint256', internalType: 'uint256' },
      { name: 'validAfter', type: 'uint48', internalType: 'uint48' },
      { name: 'validUntil', type: 'uint48', internalType: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeSessionKey',
    inputs: [{ name: 'sessionKey', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSessionKeyValid',
    inputs: [
      { name: 'account', type: 'address', internalType: 'address' },
      { name: 'sessionKey', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSessionKey',
    inputs: [
      { name: 'account', type: 'address', internalType: 'address' },
      { name: 'sessionKey', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'allowedTargets', type: 'address[]', internalType: 'address[]' },
      { name: 'spendLimit', type: 'uint256', internalType: 'uint256' },
      { name: 'validAfter', type: 'uint48', internalType: 'uint48' },
      { name: 'validUntil', type: 'uint48', internalType: 'uint48' },
      { name: 'isActive', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const

/**
 * Spending Limit Hook ABI
 */
export const SpendingLimitHookAbi = [
  ...IModuleAbi,
  {
    type: 'function',
    name: 'preCheck',
    inputs: [
      { name: 'msgSender', type: 'address', internalType: 'address' },
      { name: 'msgValue', type: 'uint256', internalType: 'uint256' },
      { name: 'msgData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'hookData', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'postCheck',
    inputs: [{ name: 'hookData', type: 'bytes', internalType: 'bytes' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'setLimit',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
      { name: 'period', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLimit',
    inputs: [
      { name: 'account', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
      { name: 'used', type: 'uint256', internalType: 'uint256' },
      { name: 'period', type: 'uint256', internalType: 'uint256' },
      { name: 'lastReset', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const
