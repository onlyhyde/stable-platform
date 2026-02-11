import {
  generateStealthAddress as generateStealthAddressCrypto,
  parseStealthMetaAddressUri,
} from '../crypto'
import type { GeneratedStealthAddress, GenerateStealthAddressParams } from '../types'

/**
 * Generate a stealth address for a recipient
 *
 * This action parses the stealth meta-address URI and generates
 * a one-time stealth address that only the recipient can spend from.
 *
 * @example
 * ```typescript
 * const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
 *   stealthMetaAddressUri: 'st:eth:0x...',
 * })
 *
 * // Send funds to stealthAddress
 * // Announce ephemeralPubKey with viewTag as metadata
 * ```
 *
 * @param params - Generation parameters
 * @returns The stealth address, ephemeral public key, and view tag
 */
export function generateStealthAddress(
  params: GenerateStealthAddressParams
): GeneratedStealthAddress {
  const { stealthMetaAddressUri } = params

  // Parse the stealth meta-address URI
  const { stealthMetaAddress } = parseStealthMetaAddressUri(stealthMetaAddressUri)

  // Generate the stealth address
  return generateStealthAddressCrypto(
    stealthMetaAddress.spendingPubKey,
    stealthMetaAddress.viewingPubKey
  )
}
