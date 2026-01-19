import type { Address } from 'viem'

/**
 * EIP-5564 Announcer contract addresses
 * These are the canonical deployment addresses for each network
 */
export const ANNOUNCER_ADDRESSES: Record<number, Address> = {
  // Mainnet
  1: '0x55649E01B5Df198D18D95b5cc5051630cfD45564' as Address,
  // Sepolia
  11155111: '0x55649E01B5Df198D18D95b5cc5051630cfD45564' as Address,
  // Base Sepolia
  84532: '0x55649E01B5Df198D18D95b5cc5051630cfD45564' as Address,
  // StableNet DevNet (placeholder - to be updated after deployment)
  8453: '0x0000000000000000000000000000000000005564' as Address,
}

/**
 * EIP-6538 Registry contract addresses
 * These are the canonical deployment addresses for each network
 */
export const REGISTRY_ADDRESSES: Record<number, Address> = {
  // Mainnet
  1: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538' as Address,
  // Sepolia
  11155111: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538' as Address,
  // Base Sepolia
  84532: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538' as Address,
  // StableNet DevNet (placeholder - to be updated after deployment)
  8453: '0x0000000000000000000000000000000000006538' as Address,
}

/**
 * Get Announcer contract address for a chain
 */
export function getAnnouncerAddress(chainId: number): Address | undefined {
  return ANNOUNCER_ADDRESSES[chainId]
}

/**
 * Get Registry contract address for a chain
 */
export function getRegistryAddress(chainId: number): Address | undefined {
  return REGISTRY_ADDRESSES[chainId]
}
