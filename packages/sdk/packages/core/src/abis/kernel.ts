/**
 * Kernel v0.3.3 Smart Account ABI
 * @see https://github.com/zerodevapp/kernel
 */
export const KERNEL_ABI = [
  // ============================================================================
  // ERC-7579 Module Management
  // ============================================================================

  /**
   * Install a module
   * @param moduleType - Module type (1=Validator, 2=Executor, etc.)
   * @param module - Module contract address
   * @param initData - Module initialization data
   */
  {
    type: 'function',
    name: 'installModule',
    inputs: [
      { name: 'moduleType', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'initData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  /**
   * Uninstall a module
   * @param moduleType - Module type
   * @param module - Module contract address
   * @param deInitData - Module de-initialization data
   */
  {
    type: 'function',
    name: 'uninstallModule',
    inputs: [
      { name: 'moduleType', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'deInitData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  /**
   * Check if a module is installed
   * @param moduleType - Module type
   * @param module - Module contract address
   * @param additionalContext - Additional context for the check
   * @returns true if installed
   */
  {
    type: 'function',
    name: 'isModuleInstalled',
    inputs: [
      { name: 'moduleType', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'additionalContext', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Execute a single call
   * @param target - Target contract address
   * @param value - ETH value to send
   * @param callData - Calldata for the call
   */
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ],
    outputs: [{ name: 'result', type: 'bytes' }],
    stateMutability: 'payable',
  },

  /**
   * Execute a batch of calls
   * @param calls - Array of Call structs
   */
  {
    type: 'function',
    name: 'executeBatch',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
  },

  /**
   * Execute from an executor module
   * @param execMode - Execution mode
   * @param executionCalldata - Execution calldata
   */
  {
    type: 'function',
    name: 'executeFromExecutor',
    inputs: [
      { name: 'execMode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
  },

  // ============================================================================
  // Account Info
  // ============================================================================

  /**
   * Get account implementation ID
   */
  {
    type: 'function',
    name: 'accountId',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },

  /**
   * Check if account supports a specific execution mode
   */
  {
    type: 'function',
    name: 'supportsExecutionMode',
    inputs: [{ name: 'mode', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },

  /**
   * Check if account supports a specific module type
   */
  {
    type: 'function',
    name: 'supportsModuleType',
    inputs: [{ name: 'moduleType', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },

  // ============================================================================
  // Events
  // ============================================================================

  {
    type: 'event',
    name: 'ModuleInstalled',
    inputs: [
      { name: 'moduleType', type: 'uint256', indexed: true },
      { name: 'module', type: 'address', indexed: true },
    ],
  },

  {
    type: 'event',
    name: 'ModuleUninstalled',
    inputs: [
      { name: 'moduleType', type: 'uint256', indexed: true },
      { name: 'module', type: 'address', indexed: true },
    ],
  },

  {
    type: 'event',
    name: 'Executed',
    inputs: [
      { name: 'target', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ],
  },
] as const
