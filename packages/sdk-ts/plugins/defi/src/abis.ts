/**
 * Re-export DeFi ABIs from core for backwards compatibility
 * @deprecated Import directly from @stablenet/core instead
 */
export {
  SWAP_EXECUTOR_ABI as SwapExecutorAbi,
  LENDING_EXECUTOR_ABI as LendingExecutorAbi,
  STAKING_EXECUTOR_ABI as StakingExecutorAbi,
  HEALTH_FACTOR_HOOK_ABI as HealthFactorHookAbi,
  MERCHANT_REGISTRY_ABI as MerchantRegistryAbi,
} from '@stablenet/core'

// Re-export with original names for backwards compatibility
export type { Abi } from 'viem'
