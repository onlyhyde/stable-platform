import type { Hex } from 'viem'
import { ERC5564_ANNOUNCER_ABI } from '../constants'
import type { AnnounceParams, StealthClient } from '../types'

/**
 * Announce a stealth payment via the EIP-5564 Announcer
 *
 * This action publishes the ephemeral public key and metadata
 * so that the recipient can discover the stealth address.
 *
 * @example
 * ```typescript
 * const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
 *   stealthMetaAddressUri: 'st:eth:0x...',
 * })
 *
 * // Send tokens to stealthAddress first, then announce
 * const txHash = await announce(client, {
 *   schemeId: 1,
 *   stealthAddress,
 *   ephemeralPubKey,
 *   metadata: viewTag, // or include additional data
 * })
 * ```
 *
 * @param client - Stealth client instance
 * @param params - Announcement parameters
 * @returns Transaction hash
 */
export async function announce(client: StealthClient, params: AnnounceParams): Promise<Hex> {
  const { schemeId, stealthAddress, ephemeralPubKey, metadata } = params

  if (!client.walletClient) {
    throw new Error('Wallet client required for announcement')
  }

  const { request } = await client.publicClient.simulateContract({
    address: client.announcerAddress,
    abi: ERC5564_ANNOUNCER_ABI,
    functionName: 'announce',
    args: [BigInt(schemeId), stealthAddress, ephemeralPubKey, metadata],
    account: client.walletClient.account,
  })

  const txHash = await client.walletClient.writeContract(request)

  return txHash
}
