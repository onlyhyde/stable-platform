/**
 * Re-export DeFi ABIs from core for backwards compatibility
 * @deprecated Import directly from @stablenet/core instead
 */
export {
  HEALTH_FACTOR_HOOK_ABI as HealthFactorHookAbi,
  LENDING_EXECUTOR_ABI as LendingExecutorAbi,
  MERCHANT_REGISTRY_ABI as MerchantRegistryAbi,
  STAKING_EXECUTOR_ABI as StakingExecutorAbi,
  SWAP_EXECUTOR_ABI as SwapExecutorAbi,
} from '@stablenet/core'

// Re-export with original names for backwards compatibility
export type { Abi } from 'viem'
