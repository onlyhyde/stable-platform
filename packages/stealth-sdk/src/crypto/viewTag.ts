import { keccak_256 } from '@noble/hashes/sha3'
import type { Hex } from 'viem'
import { bytesToHex, hexToBytes } from 'viem'
import { VIEW_TAG_SIZE } from '../constants'

/**
 * Compute a view tag from a shared secret
 *
 * The view tag is the first byte of keccak256(sharedSecret).
 * This enables efficient filtering of announcements - recipients can
 * quickly discard ~99.6% of announcements that don't match their view tag.
 *
 * @param sharedSecret - The shared secret bytes (compressed point)
 * @returns The view tag as a hex string (1 byte)
 */
export function computeViewTag(sharedSecret: Uint8Array): Hex {
  // Hash the shared secret
  const hash = keccak_256(sharedSecret)

  // Take the first byte as the view tag
  const viewTagBytes = hash.slice(0, VIEW_TAG_SIZE)

  return bytesToHex(viewTagBytes) as Hex
}

/**
 * Extract view tag from metadata
 *
 * In EIP-5564, metadata typically starts with the view tag byte,
 * followed by any additional application-specific data.
 *
 * @param metadata - The full metadata from announcement
 * @returns The view tag (first byte)
 */
export function extractViewTag(metadata: Hex): Hex {
  const bytes = hexToBytes(metadata)

  if (bytes.length < VIEW_TAG_SIZE) {
    throw new Error('Metadata too short to contain view tag')
  }

  return bytesToHex(bytes.slice(0, VIEW_TAG_SIZE)) as Hex
}

/**
 * Create metadata with view tag
 *
 * @param viewTag - The view tag (1 byte)
 * @param extraData - Optional extra data to append
 * @returns The complete metadata
 */
export function createMetadata(viewTag: Hex, extraData?: Hex): Hex {
  const viewTagBytes = hexToBytes(viewTag)

  if (viewTagBytes.length !== VIEW_TAG_SIZE) {
    throw new Error(`View tag must be exactly ${VIEW_TAG_SIZE} byte`)
  }

  if (!extraData || extraData === '0x') {
    return viewTag
  }

  const extraBytes = hexToBytes(extraData)
  const combined = new Uint8Array(VIEW_TAG_SIZE + extraBytes.length)
  combined.set(viewTagBytes, 0)
  combined.set(extraBytes, VIEW_TAG_SIZE)

  return bytesToHex(combined) as Hex
}

/**
 * Compare two view tags
 *
 * @param viewTag1 - First view tag
 * @param viewTag2 - Second view tag
 * @returns True if they match
 */
export function viewTagsMatch(viewTag1: Hex, viewTag2: Hex): boolean {
  return viewTag1.toLowerCase() === viewTag2.toLowerCase()
}
