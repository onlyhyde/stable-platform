import type { Address, Hex } from 'viem'
import { ERC6538_REGISTRY_ABI } from '../constants'
import type { RegisterStealthMetaAddressParams, StealthClient } from '../types'

/**
 * Register a stealth meta-address in the EIP-6538 registry
 *
 * This action registers the user's stealth meta-address on-chain,
 * making it discoverable by senders who want to send private payments.
 *
 * @example
 * ```typescript
 * import { encodeStealthMetaAddress } from '@stablenet/plugin-stealth'
 *
 * const stealthMetaAddress = encodeStealthMetaAddress(spendingPubKey, viewingPubKey)
 *
 * const txHash = await registerStealthMetaAddress(client, {
 *   schemeId: 1,
 *   stealthMetaAddress,
 * })
 * ```
 *
 * @param client - Stealth client instance
 * @param params - Registration parameters
 * @returns Transaction hash
 */
export async function registerStealthMetaAddress(
  client: StealthClient,
  params: RegisterStealthMetaAddressParams
): Promise<Hex> {
  const { schemeId, stealthMetaAddress } = params

  if (!client.walletClient) {
    throw new Error('Wallet client required for registration')
  }

  const { request } = await client.publicClient.simulateContract({
    address: client.registryAddress,
    abi: ERC6538_REGISTRY_ABI,
    functionName: 'registerKeys',
    args: [BigInt(schemeId), stealthMetaAddress],
    account: client.walletClient.account,
  })

  const txHash = await client.walletClient.writeContract(request)

  return txHash
}

/**
 * Get the stealth meta-address for a registrant
 *
 * @param client - Stealth client instance
 * @param registrant - Address to lookup
 * @param schemeId - Scheme ID to lookup
 * @returns The stealth meta-address or null if not registered
 */
export async function getStealthMetaAddress(
  client: StealthClient,
  registrant: Address,
  schemeId: number
): Promise<Hex | null> {
  const result = await client.publicClient.readContract({
    address: client.registryAddress,
    abi: ERC6538_REGISTRY_ABI,
    functionName: 'stealthMetaAddressOf',
    args: [registrant, BigInt(schemeId)],
  })

  if (!result || result === '0x') {
    return null
  }

  return result as Hex
}
