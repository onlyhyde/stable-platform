import type { Address, Hex, PublicClient } from 'viem'
import {
  concat,
  encodeFunctionData,
  getContractAddress,
  keccak256,
} from 'viem'
import type { Call, SmartAccount, Validator } from '@stablenet/types'
import {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from '@stablenet/types'
import { EntryPointAbi, KernelFactoryAbi } from './abi'
import {
  calculateSalt,
  encodeKernelExecuteCallData,
  encodeKernelInitializeData,
} from './utils'

/**
 * Configuration for creating a Kernel smart account
 */
export interface ToKernelSmartAccountConfig {
  /** Public client for chain interaction */
  client: PublicClient
  /** The validator to use for signing */
  validator: Validator
  /** The EntryPoint address (defaults to v0.7) */
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
    validator,
    entryPoint = ENTRY_POINT_V07_ADDRESS,
    factoryAddress = KERNEL_V3_1_FACTORY_ADDRESS,
    index = 0n,
  } = config

  // Get validator initialization data
  const validatorInitData = await validator.getInitData()

  // Encode the initialization data
  const initializeData = encodeKernelInitializeData(validator, validatorInitData)

  // Calculate the salt
  const salt = calculateSalt(index)

  // Calculate the counterfactual address
  const address = await getKernelAddress(client, factoryAddress, initializeData, salt)

  // Cache deployed state
  let isDeployedCache: boolean | undefined

  const getNonce = async (): Promise<bigint> => {
    // Get nonce from EntryPoint
    // The key is validator-specific, for default validator it's 0
    const nonce = await client.readContract({
      address: entryPoint,
      abi: EntryPointAbi,
      functionName: 'getNonce',
      args: [address, 0n],
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
    // Sign with the validator
    const signature = await validator.signHash(userOpHash)

    // For Kernel v3, the signature format is:
    // - 1 byte: mode (0x00 for enable mode, 0x01 for enable with signature, 0x02 for validation mode)
    // - signature data
    // For a simple validator signature, we use mode 0x02 (validation mode)
    const mode = '0x02' as Hex
    return concat([mode, signature])
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
