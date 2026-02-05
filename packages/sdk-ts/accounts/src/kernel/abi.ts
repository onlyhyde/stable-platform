/**
 * Re-export Kernel ABIs from core for backwards compatibility
 * @deprecated Import directly from @stablenet/core instead
 */
export {
  KERNEL_ABI as KernelAccountAbi,
  KERNEL_FACTORY_ABI as KernelFactoryAbi,
  ENTRY_POINT_ABI as EntryPointAbi,
} from '@stablenet/core'

export type { Abi } from 'viem'
