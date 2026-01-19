/**
 * StableNet Stealth SDK
 *
 * A TypeScript SDK for EIP-5564 and EIP-6538 stealth address functionality.
 *
 * ## Features
 * - Generate stealth addresses for private payments
 * - Register stealth meta-addresses on-chain
 * - Scan and watch for stealth announcements
 * - Compute stealth private keys for spending
 * - View tag filtering for efficient scanning
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   createStealthClient,
 *   generateStealthAddress,
 *   computeStealthKey,
 *   watchAnnouncementsWithKey,
 * } from '@stablenet/stealth-sdk'
 *
 * // Create client
 * const client = createStealthClient({
 *   publicClient,
 *   walletClient, // optional, for write operations
 * })
 *
 * // Generate stealth address for recipient
 * const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
 *   stealthMetaAddressUri: 'st:eth:0x...',
 * })
 *
 * // Watch for incoming payments
 * const unwatch = watchAnnouncementsWithKey({
 *   client,
 *   spendingPrivateKey: '0x...',
 *   viewingPrivateKey: '0x...',
 *   onAnnouncement: (announcement, stealthKey) => {
 *     console.log('Received payment at:', stealthKey.stealthAddress)
 *   },
 * })
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  SchemeId,
  StealthMetaAddress,
  ParsedStealthMetaAddressUri,
  GeneratedStealthAddress,
  StealthAnnouncement,
  AnnouncementFilterOptions,
  StealthKeyPair,
  StealthKeys,
  ComputedStealthKey,
  RegistryEntry,
  StealthClientConfig,
  StealthClient,
  WatchAnnouncementsOptions,
  GenerateStealthAddressParams,
  ComputeStealthKeyParams,
  RegisterStealthMetaAddressParams,
  AnnounceParams,
  CheckAnnouncementParams,
} from './types'

// Constants
export {
  SCHEME_ID,
  DEFAULT_SCHEME_ID,
  VIEW_TAG_SIZE,
  COMPRESSED_PUBKEY_SIZE,
  UNCOMPRESSED_PUBKEY_SIZE,
  STEALTH_META_ADDRESS_PREFIX,
  CHAIN_PREFIX,
  type ChainPrefix,
  ANNOUNCER_ADDRESSES,
  REGISTRY_ADDRESSES,
  getAnnouncerAddress,
  getRegistryAddress,
  ERC5564_ANNOUNCER_ABI,
  ERC6538_REGISTRY_ABI,
} from './constants'

// Config
export {
  type NetworkConfig,
  NETWORKS,
  getNetworkConfig,
  getNetworkByPrefix,
  isChainSupported,
} from './config'

// Crypto utilities
export {
  generatePrivateKey,
  derivePublicKey,
  generateStealthKeyPair,
  generateStealthAddress as generateStealthAddressCrypto,
  computeStealthPrivateKey,
  checkViewTag,
  parseStealthMetaAddress,
  encodeStealthMetaAddress,
  parseStealthMetaAddressUri,
  encodeStealthMetaAddressUri,
  computeViewTag,
  extractViewTag,
  createMetadata,
  viewTagsMatch,
} from './crypto'

// Client
export { createStealthClient, extendWithStealth } from './client'

// Actions
export {
  generateStealthAddress,
  computeStealthKey,
  registerStealthMetaAddress,
  getStealthMetaAddress,
  announce,
  checkAnnouncement,
  filterByViewTag,
  fetchAnnouncements,
  fetchAnnouncementsBatched,
  getCurrentBlock,
  watchAnnouncements,
  watchAnnouncementsWithKey,
} from './actions'
