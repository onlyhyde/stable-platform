/**
 * Kernel v3 initData building utilities
 *
 * Kernel's installModule expects initData in a specific format per module type:
 * - Validator: [hook(20 bytes)][ABI-encoded(validatorData, hookData, selectorData)]
 * - Executor: [hook(20 bytes)][ABI-encoded(executorData, hookData)]
 * - Hook/Fallback: module-specific data only
 *
 * See Kernel source:
 *   IHook hook = IHook(address(bytes20(initData[0:20])));
 *   assembly { data := add(initData.offset, 20) }
 */

import type { Hex } from 'viem'
import { concat, encodeAbiParameters, pad } from 'viem/utils'

/**
 * Sentinel hook address meaning "no actual hook, just install the module".
 * address(1) = 0x0000000000000000000000000000000001
 */
const HOOK_MODULE_INSTALLED: Hex = pad('0x01', { size: 20 })

/**
 * Function selector for execute(bytes32,bytes) - grants transaction execution permission
 */
const EXECUTE_SELECTOR: Hex = '0xe9ae5c53'

/**
 * Build Kernel v3 initData for installModule based on module type.
 *
 * @param moduleType - Module type as bigint (1n=Validator, 2n=Executor, 4n=Hook)
 * @param moduleSpecificData - Pre-encoded module-specific initialization data
 * @returns Properly formatted Kernel v3 initData
 */
export function buildKernelInstallData(
  moduleType: bigint,
  moduleSpecificData: Hex
): Hex {
  switch (moduleType) {
    case 1n: // VALIDATOR
      return buildValidatorInstallData(moduleSpecificData)
    case 2n: // EXECUTOR
      return buildExecutorInstallData(moduleSpecificData)
    case 4n: // HOOK
      return buildHookInstallData(moduleSpecificData)
    default:
      // Fallback, Policy, Signer - pass through as-is
      return moduleSpecificData
  }
}

/**
 * Build initData for installModule(VALIDATOR).
 *
 * Layout: [hook(20 bytes)][ABI-encoded InstallValidatorDataFormat]
 *
 * InstallValidatorDataFormat = { validatorData: bytes, hookData: bytes, selectorData: bytes }
 *
 * The selectorData grants the validator access to the execute(bytes32,bytes) function.
 */
function buildValidatorInstallData(validatorData: Hex): Hex {
  const encodedStruct = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }],
    [validatorData, '0x', EXECUTE_SELECTOR]
  )
  return concat([HOOK_MODULE_INSTALLED, encodedStruct])
}

/**
 * Build initData for installModule(EXECUTOR).
 *
 * Layout: [hook(20 bytes)][ABI-encoded InstallExecutorDataFormat]
 *
 * InstallExecutorDataFormat = { executorData: bytes, hookData: bytes }
 */
function buildExecutorInstallData(executorData: Hex): Hex {
  const encodedStruct = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }],
    [executorData, '0x']
  )
  return concat([HOOK_MODULE_INSTALLED, encodedStruct])
}

/**
 * Build initData for installModule(HOOK).
 *
 * Hooks don't use the same wrapper format - just pass module-specific data.
 */
function buildHookInstallData(hookData: Hex): Hex {
  return hookData
}
