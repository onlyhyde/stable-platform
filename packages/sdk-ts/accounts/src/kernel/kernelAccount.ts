import type { Call, SmartAccount, Validator } from '@stablenet/sdk-types'
import { ENTRY_POINT_ADDRESS, KERNEL_V3_1_FACTORY_ADDRESS } from '@stablenet/sdk-types'
import type { Address, Hex, PublicClient } from 'viem'
import { concat, encodeFunctionData, getContractAddress, keccak256 } from 'viem'
import { EntryPointAbi, KernelFactoryAbi } from './abi'
import { calculateSalt, encodeKernelExecuteCallData, encodeKernelInitializeData } from './utils'

/**
 * ValidatorRouter interface (duck-typed to avoid circular dependency with @stablenet/core).
 * If the validator object has `getActiveValidator`, it's treated as a router.
 */
interface ValidatorRouterLike {
  getActiveValidator(): Validator
  getActiveNonceKey(): bigint
}

/**
 * Configuration for creating a Kernel smart account
 */
export interface ToKernelSmartAccountConfig {
  /** Public client for chain interaction */
  client: PublicClient
  /**
   * The validator to use for signing.
   * Accepts a single Validator or a ValidatorRouter for multi-validator support.
   */
  validator: Validator | ValidatorRouterLike
  /** The EntryPoint address */
  entryPoint?: Address
  /** The Kernel factory address (defaults to v3.1) */
  factoryAddress?: Address
  /** Optional index for counterfactual address generation */
  index?: bigint
}

/**
 * Create a Kernel smart account instance
 *
 * @example
 * ```ts
 * import { toKernelSmartAccount } from '@stablenet/accounts'
 * import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
 *
 * const validator = await createEcdsaValidator({
 *   signer: privateKeyToAccount('0x...')
 * })
 *
 * const account = await toKernelSmartAccount({
 *   client: publicClient,
 *   validator,
 * })
 * ```
 */
export async function toKernelSmartAccount(
  config: ToKernelSmartAccountConfig
): Promise<SmartAccount> {
  const {
    client,
    validator: validatorOrRouter,
    entryPoint = ENTRY_POINT_ADDRESS,
    factoryAddress = KERNEL_V3_1_FACTORY_ADDRESS,
    index = 0n,
  } = config

  // Duck-type detection: ValidatorRouter has getActiveValidator method
  const isRouter = 'getActiveValidator' in validatorOrRouter
    && typeof (validatorOrRouter as ValidatorRouterLike).getActiveValidator === 'function'

  // For initialization, always use the root/primary validator
  const initValidator: Validator = isRouter
    ? (validatorOrRouter as ValidatorRouterLike).getActiveValidator()
    : (validatorOrRouter as Validator)

  // Get validator initialization data
  const validatorInitData = await initValidator.getInitData()

  // Encode the initialization data
  const initializeData = encodeKernelInitializeData(initValidator, validatorInitData)

  // Calculate the salt
  const salt = calculateSalt(index)

  // Calculate the counterfactual address
  const address = await getKernelAddress(client, factoryAddress, initializeData, salt)

  // Cache deployed state
  let isDeployedCache: boolean | undefined

  const getNonce = async (): Promise<bigint> => {
    // Get nonce from EntryPoint
    // The key is validator-specific: 0n for root, encoded key for non-root
    const nonceKey = isRouter
      ? (validatorOrRouter as ValidatorRouterLike).getActiveNonceKey()
      : 0n

    const nonce = await client.readContract({
      address: entryPoint,
      abi: EntryPointAbi,
      functionName: 'getNonce',
      args: [address, nonceKey],
    })
    return nonce
  }

  const getInitCode = async (): Promise<Hex> => {
    const deployed = await isDeployed()
    if (deployed) {
      return '0x'
    }

    const factoryData = await getFactoryData()
    if (!factoryData) {
      return '0x'
    }

    return concat([factoryAddress, factoryData])
  }

  const encodeCallData = async (calls: Call | Call[]): Promise<Hex> => {
    return encodeKernelExecuteCallData(calls)
  }

  const signUserOperation = async (userOpHash: Hex): Promise<Hex> => {
    // Resolve the currently active validator (supports dynamic switching via router)
    const activeValidator: Validator = isRouter
      ? (validatorOrRouter as ValidatorRouterLike).getActiveValidator()
      : (validatorOrRouter as Validator)

    // Sign with the active validator
    const signature = await activeValidator.signHash(userOpHash)

    // For Kernel v3 (ERC-7579), the validation mode is encoded in the nonce,
    // not in the signature. The signature format depends on the validator type.
    return signature
  }

  const getFactory = async (): Promise<Address | undefined> => {
    const deployed = await isDeployed()
    if (deployed) {
      return undefined
    }
    return factoryAddress
  }

  const getFactoryData = async (): Promise<Hex | undefined> => {
    const deployed = await isDeployed()
    if (deployed) {
      return undefined
    }

    // Encode createAccount(bytes initData, bytes32 salt)
    return encodeFunctionData({
      abi: KernelFactoryAbi,
      functionName: 'createAccount',
      args: [initializeData, salt],
    })
  }

  const isDeployed = async (): Promise<boolean> => {
    if (isDeployedCache !== undefined) {
      return isDeployedCache
    }

    const code = await client.getCode({ address })
    isDeployedCache = code !== undefined && code !== '0x'
    return isDeployedCache
  }

  return {
    address,
    entryPoint,
    getNonce,
    getInitCode,
    encodeCallData,
    signUserOperation,
    getFactory,
    getFactoryData,
    isDeployed,
  }
}

/**
 * Get the counterfactual address for a Kernel account
 */
async function getKernelAddress(
  client: PublicClient,
  factoryAddress: Address,
  initData: Hex,
  salt: Hex
): Promise<Address> {
  try {
    // Try to get address from factory
    const address = await client.readContract({
      address: factoryAddress,
      abi: KernelFactoryAbi,
      functionName: 'getAddress',
      args: [initData, salt],
    })
    return address
  } catch {
    // If factory call fails, calculate using CREATE2
    // This is a fallback for when the factory is not deployed yet
    const initCodeHash = keccak256(initData)
    return getContractAddress({
      bytecodeHash: initCodeHash,
      from: factoryAddress,
      opcode: 'CREATE2',
      salt,
    })
  }
}

export type { ToKernelSmartAccountConfig as KernelSmartAccountConfig }
