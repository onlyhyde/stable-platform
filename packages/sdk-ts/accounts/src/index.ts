// Kernel Smart Account
export {
  toKernelSmartAccount,
  type KernelSmartAccountConfig,
  // ABIs
  KernelAccountAbi,
  KernelFactoryAbi,
  EntryPointAbi,
  // Utils
  encodeExecutionMode,
  encodeSingleCall,
  encodeBatchCalls,
  encodeKernelExecuteCallData,
  encodeKernelInitializeData,
  encodeRootValidator,
  calculateSalt,
} from './kernel'

// Re-export types for convenience
export type {
  SmartAccount,
  Call,
  Validator,
  KernelAccountConfig,
} from '@stablenet/sdk-types'

export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  KERNEL_ADDRESSES,
  MODULE_TYPE,
  EXEC_MODE,
  CALL_TYPE,
} from '@stablenet/sdk-types'
