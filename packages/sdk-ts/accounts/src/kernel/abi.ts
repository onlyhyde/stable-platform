/**
 * Re-export Kernel ABIs from core for backwards compatibility
 * @deprecated Import directly from @stablenet/core instead
 */
export {
  ENTRY_POINT_ABI as EntryPointAbi,
  KERNEL_ABI as KernelAccountAbi,
  KERNEL_FACTORY_ABI as KernelFactoryAbi,
} from '@stablenet/core'

export type { Abi } from 'viem'
