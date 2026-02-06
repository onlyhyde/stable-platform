import type { Address, PublicClient, WalletClient } from 'viem'
import { getAnnouncerAddress, getRegistryAddress } from '../constants'
import type { StealthClient, StealthClientConfig } from '../types'

/**
 * Create a Stealth Client instance
 *
 * The Stealth Client provides a high-level interface for interacting
 * with the EIP-5564 and EIP-6538 contracts.
 *
 * @example
 * ```typescript
 * import { createPublicClient, createWalletClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createStealthClient } from '@stablenet/plugin-stealth'
 *
 * const publicClient = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const stealthClient = createStealthClient({
 *   publicClient,
 * })
 *
 * // For write operations, include a wallet client
 * const walletClient = createWalletClient({
 *   chain: mainnet,
 *   transport: http(),
 *   account: privateKeyToAccount('0x...'),
 * })
 *
 * const stealthClientWithWallet = createStealthClient({
 *   publicClient,
 *   walletClient,
 * })
 * ```
 *
 * @param config - Client configuration
 * @returns Stealth client instance
 */
export function createStealthClient(config: StealthClientConfig): StealthClient {
  const { publicClient, walletClient, announcerAddress, registryAddress } = config

  // Get chain ID from public client
  const chainId = publicClient.chain?.id

  if (!chainId) {
    throw new Error('Public client must have a chain configured')
  }

  // Resolve contract addresses
  const resolvedAnnouncerAddress = announcerAddress ?? getAnnouncerAddress(chainId)
  const resolvedRegistryAddress = registryAddress ?? getRegistryAddress(chainId)

  if (!resolvedAnnouncerAddress) {
    throw new Error(
      `No announcer address configured for chain ${chainId}. Please provide announcerAddress in config.`
    )
  }

  if (!resolvedRegistryAddress) {
    throw new Error(
      `No registry address configured for chain ${chainId}. Please provide registryAddress in config.`
    )
  }

  return {
    config,
    publicClient,
    walletClient,
    announcerAddress: resolvedAnnouncerAddress,
    registryAddress: resolvedRegistryAddress,
  }
}

/**
 * Extend an existing public client with stealth functionality
 *
 * @param publicClient - Existing public client
 * @param options - Optional overrides
 * @returns Stealth client instance
 */
export function extendWithStealth(
  publicClient: PublicClient,
  options?: {
    walletClient?: WalletClient
    announcerAddress?: Address
    registryAddress?: Address
  }
): StealthClient {
  return createStealthClient({
    publicClient,
    ...options,
  })
}
