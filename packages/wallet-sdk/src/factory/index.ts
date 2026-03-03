/**
 * Factory / Counterfactual Address Module
 *
 * Utilities for computing smart account addresses before deployment.
 * Supports EntryPoint getSenderAddress and CREATE2 prediction.
 */

import { ENTRY_POINT_ADDRESS } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, getContractAddress, type PublicClient } from 'viem'

// Re-export factory address from core
export { KERNEL_V3_1_FACTORY_ADDRESS } from '@stablenet/sdk-types'

/**
 * Get the counterfactual sender address from the EntryPoint.
 *
 * Calls EntryPoint with initCode and parses the SenderAddressResult revert.
 * This is the standard way to determine the smart account address before deployment.
 *
 * @param publicClient - Viem public client
 * @param factory - Factory contract address
 * @param factoryData - Encoded factory call data
 * @param entryPoint - EntryPoint address
 */
export async function getSenderAddress(
  publicClient: PublicClient,
  factory: Address,
  factoryData: Hex,
  entryPoint: Address = ENTRY_POINT_ADDRESS
): Promise<Address> {
  const initCode = concat([factory, factoryData])

  try {
    // EntryPoint.getSenderAddress always reverts
    // SenderAddressResult(address) on success, or FailedOp on error
    await publicClient.call({
      to: entryPoint,
      data: encodeAbiParameters(
        [{ type: 'bytes' }],
        [initCode]
      ),
    })
    throw new Error('Expected revert from getSenderAddress')
  } catch (error: unknown) {
    const errorData = extractRevertData(error)
    if (!errorData) {
      throw error
    }

    // SenderAddressResult selector: 0x6ca7b806
    if (errorData.startsWith('0x6ca7b806')) {
      const addressHex = `0x${errorData.slice(34, 74)}` as Address
      return addressHex
    }

    throw new Error(`Unexpected revert data from getSenderAddress: ${errorData}`)
  }
}

/**
 * Predict a counterfactual address using CREATE2.
 *
 * @param factory - Factory contract address (deployer)
 * @param initCodeHash - Keccak256 of the init code (creation bytecode + constructor args)
 * @param salt - Salt for CREATE2
 */
export function predictCounterfactualAddress(
  factory: Address,
  initCodeHash: Hex,
  salt: Hex
): Address {
  return getContractAddress({
    from: factory,
    salt,
    bytecodeHash: initCodeHash,
    opcode: 'CREATE2',
  })
}

/**
 * Extract revert data from a call error
 */
function extractRevertData(error: unknown): Hex | undefined {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>
    if (typeof err.data === 'string' && err.data.startsWith('0x')) {
      return err.data as Hex
    }
    if (err.cause && typeof err.cause === 'object') {
      return extractRevertData(err.cause)
    }
  }
  return undefined
}
