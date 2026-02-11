/**
 * @stablenet/plugin-stealth
 *
 * Stealth Address plugin for StableNet SDK - EIP-5564 and EIP-6538 implementation.
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
 * } from '@stablenet/plugin-stealth'
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

// Actions
export {
  announce,
  type ComputeStealthKeyResult,
  checkAnnouncement,
  computeStealthKey,
  computeStealthKeyWithResult,
  type FetchAnnouncementsBatchedOptions,
  fetchAnnouncements,
  fetchAnnouncementsBatched,
  filterByViewTag,
  generateStealthAddress,
  getCurrentBlock,
  getStealthMetaAddress,
  registerStealthMetaAddress,
  StealthKeyComputationError,
  verifyAnnouncement,
  watchAnnouncements,
  watchAnnouncementsWithKey,
} from './actions'
// Client
export { createStealthClient, extendWithStealth } from './client'

// Config
export {
  getNetworkByPrefix,
  getNetworkConfig,
  isChainSupported,
  NETWORKS,
  type NetworkConfig,
} from './config'
// Constants
export {
  ANNOUNCER_ADDRESSES,
  CHAIN_PREFIX,
  type ChainPrefix,
  COMPRESSED_PUBKEY_SIZE,
  DEFAULT_SCHEME_ID,
  ERC5564_ANNOUNCER_ABI,
  ERC6538_REGISTRY_ABI,
  getAnnouncerAddress,
  getRegistryAddress,
  REGISTRY_ADDRESSES,
  SCHEME_ID,
  STEALTH_META_ADDRESS_PREFIX,
  UNCOMPRESSED_PUBKEY_SIZE,
  VIEW_TAG_SIZE,
} from './constants'
// Crypto utilities
export {
  checkViewTag,
  computeStealthPrivateKey,
  computeViewTag,
  createMetadata,
  derivePublicKey,
  encodeStealthMetaAddress,
  encodeStealthMetaAddressUri,
  extractViewTag,
  generatePrivateKey,
  generateStealthAddress as generateStealthAddressCrypto,
  generateStealthKeyPair,
  parseStealthMetaAddress,
  parseStealthMetaAddressUri,
  validateMetadata,
  viewTagsMatch,
} from './crypto'
// Types
export type {
  AnnouncementFilterOptions,
  AnnounceParams,
  CheckAnnouncementParams,
  ComputedStealthKey,
  ComputeStealthKeyParams,
  GeneratedStealthAddress,
  GenerateStealthAddressParams,
  ParsedStealthMetaAddressUri,
  RegisterStealthMetaAddressParams,
  RegistryEntry,
  SchemeId,
  StealthAnnouncement,
  StealthClient,
  StealthClientConfig,
  StealthKeyPair,
  StealthKeys,
  StealthMetaAddress,
  WatchAnnouncementsOptions,
} from './types'
