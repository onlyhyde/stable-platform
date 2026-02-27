/**
 * Nonce Management Utilities
 *
 * Helpers for ERC-4337 nonce management via EntryPoint.getNonce().
 * Supports parallel nonce keys (ERC-4337 v0.7 nonce structure).
 */

import { ENTRY_POINT_ABI, ENTRY_POINT_V07_ADDRESS } from '@stablenet/core'
import type { Address } from 'viem'
import type { PublicClient } from 'viem'

/**
 * Get the current nonce for a smart account from the EntryPoint.
 *
 * @param publicClient - Viem public client
 * @param sender - Smart account address
 * @param key - Nonce key for parallel nonce support (default: 0n)
 * @param entryPoint - EntryPoint address (default: v0.7)
 */
export async function getNonce(
  publicClient: PublicClient,
  sender: Address,
  key: bigint = 0n,
  entryPoint: Address = ENTRY_POINT_V07_ADDRESS
): Promise<bigint> {
  const nonce = await publicClient.readContract({
    address: entryPoint,
    abi: ENTRY_POINT_ABI,
    functionName: 'getNonce',
    args: [sender, key],
  })
  return nonce as bigint
}

/**
 * Parse an ERC-4337 nonce into its key and sequence components.
 *
 * Nonce structure: key (192 bits) | sequence (64 bits)
 * The key allows parallel nonce channels, sequence is auto-incrementing.
 */
export function parseNonce(nonce: bigint): { key: bigint; sequence: bigint } {
  const sequence = nonce & ((1n << 64n) - 1n)
  const key = nonce >> 64n
  return { key, sequence }
}

/**
 * Encode a nonce key and sequence into a full ERC-4337 nonce.
 *
 * @param key - Nonce key (192 bits)
 * @param sequence - Sequence number (64 bits)
 */
export function encodeNonceKey(key: bigint, sequence: bigint): bigint {
  return (key << 64n) | (sequence & ((1n << 64n) - 1n))
}
