import { keccak_256 } from '@noble/hashes/sha3'
import type { Hex } from 'viem'
import { bytesToHex, hexToBytes } from 'viem'
import { VIEW_TAG_SIZE } from '../constants'

/**
 * Maximum metadata size (prevents oversized transaction data)
 * This is a reasonable limit for on-chain metadata - adjust as needed
 */
const MAX_METADATA_SIZE = 1024 // 1KB

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
  if (!sharedSecret || sharedSecret.length === 0) {
    throw new Error('Shared secret cannot be empty')
  }

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
  if (!metadata || metadata === '0x') {
    throw new Error('Metadata cannot be empty')
  }

  const bytes = hexToBytes(metadata)

  if (bytes.length < VIEW_TAG_SIZE) {
    throw new Error(
      `Metadata too short to contain view tag: expected at least ${VIEW_TAG_SIZE} byte, got ${bytes.length}`
    )
  }

  return bytesToHex(bytes.slice(0, VIEW_TAG_SIZE)) as Hex
}

/**
 * Validate metadata format and size
 *
 * @param metadata - The metadata to validate
 * @throws Error if metadata is invalid
 */
export function validateMetadata(metadata: Hex): void {
  if (!metadata || metadata === '0x') {
    throw new Error('Metadata cannot be empty')
  }

  if (!metadata.startsWith('0x')) {
    throw new Error('Metadata must be a hex string starting with 0x')
  }

  // Check for valid hex characters
  if (!/^0x[a-fA-F0-9]*$/.test(metadata)) {
    throw new Error('Metadata contains invalid hex characters')
  }

  const bytes = hexToBytes(metadata)

  if (bytes.length < VIEW_TAG_SIZE) {
    throw new Error(`Metadata too short: expected at least ${VIEW_TAG_SIZE} byte for view tag`)
  }

  if (bytes.length > MAX_METADATA_SIZE) {
    throw new Error(
      `Metadata too large: maximum ${MAX_METADATA_SIZE} bytes allowed, got ${bytes.length}`
    )
  }
}

/**
 * Create metadata with view tag
 *
 * @param viewTag - The view tag (1 byte)
 * @param extraData - Optional extra data to append
 * @returns The complete metadata
 */
export function createMetadata(viewTag: Hex, extraData?: Hex): Hex {
  if (!viewTag || viewTag === '0x') {
    throw new Error('View tag cannot be empty')
  }

  const viewTagBytes = hexToBytes(viewTag)

  if (viewTagBytes.length !== VIEW_TAG_SIZE) {
    throw new Error(`View tag must be exactly ${VIEW_TAG_SIZE} byte, got ${viewTagBytes.length}`)
  }

  if (!extraData || extraData === '0x') {
    return viewTag
  }

  const extraBytes = hexToBytes(extraData)

  // Validate total size
  const totalSize = VIEW_TAG_SIZE + extraBytes.length
  if (totalSize > MAX_METADATA_SIZE) {
    throw new Error(
      `Combined metadata too large: maximum ${MAX_METADATA_SIZE} bytes allowed, got ${totalSize}`
    )
  }

  const combined = new Uint8Array(totalSize)
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
