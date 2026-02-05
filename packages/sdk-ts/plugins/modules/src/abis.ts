/**
 * Re-export Module ABIs from core for backwards compatibility
 * @deprecated Import directly from @stablenet/core instead
 */
export {
  KERNEL_ABI as KernelModuleAbi,
  MODULE_INTERFACE_ABI as IModuleAbi,
  ECDSA_VALIDATOR_ABI as ECDSAValidatorAbi,
  SESSION_KEY_EXECUTOR_ABI as SessionKeyExecutorAbi,
  SPENDING_LIMIT_HOOK_ABI as SpendingLimitHookAbi,
} from '@stablenet/core'
