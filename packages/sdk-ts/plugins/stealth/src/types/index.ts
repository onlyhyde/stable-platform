import type { Address, Hex, PublicClient, WalletClient } from 'viem'

/**
 * Stealth scheme identifier (EIP-5564)
 * - 0: Reserved
 * - 1: secp256k1 with view tags
 */
export type SchemeId = 0 | 1

/**
 * Stealth meta-address format (EIP-5564)
 * st:<chain>:<stealthMetaAddress>
 */
export interface StealthMetaAddress {
  /** Spending public key */
  spendingPubKey: Hex
  /** Viewing public key */
  viewingPubKey: Hex
  /** Scheme ID */
  schemeId: SchemeId
}

/**
 * Parsed stealth meta-address URI
 */
export interface ParsedStealthMetaAddressUri {
  /** Chain prefix (e.g., 'eth', 'stablenet') */
  chainPrefix: string
  /** Stealth meta address */
  stealthMetaAddress: StealthMetaAddress
  /** Raw hex string */
  raw: Hex
}

/**
 * Generated stealth address result
 */
export interface GeneratedStealthAddress {
  /** The stealth address */
  stealthAddress: Address
  /** Ephemeral public key to be announced */
  ephemeralPubKey: Hex
  /** View tag for efficient scanning */
  viewTag: Hex
}

/**
 * Stealth announcement (EIP-5564)
 */
export interface StealthAnnouncement {
  /** Scheme ID used */
  schemeId: SchemeId
  /** Stealth address */
  stealthAddress: Address
  /** Caller address */
  caller: Address
  /** Ephemeral public key */
  ephemeralPubKey: Hex
  /** Metadata (view tag + extra data) */
  metadata: Hex
  /** Block number */
  blockNumber: bigint
  /** Transaction hash */
  txHash: Hex
  /** Log index */
  logIndex: number
}

/**
 * Stealth announcement filter options
 */
export interface AnnouncementFilterOptions {
  /** Starting block number */
  fromBlock?: bigint
  /** Ending block number */
  toBlock?: bigint | 'latest'
  /** Filter by scheme ID */
  schemeId?: SchemeId
  /** Filter by caller */
  caller?: Address
}

/**
 * Stealth key pair
 */
export interface StealthKeyPair {
  /** Private key */
  privateKey: Hex
  /** Public key */
  publicKey: Hex
}

/**
 * Full stealth keys for receiving
 */
export interface StealthKeys {
  /** Spending key pair */
  spending: StealthKeyPair
  /** Viewing key pair */
  viewing: StealthKeyPair
}

/**
 * Computed stealth key result
 */
export interface ComputedStealthKey {
  /** Stealth address */
  stealthAddress: Address
  /** Stealth private key */
  stealthPrivateKey: Hex
}

/**
 * Stealth registry entry (EIP-6538)
 */
export interface RegistryEntry {
  /** Registrant address */
  registrant: Address
  /** Scheme ID */
  schemeId: SchemeId
  /** Stealth meta address */
  stealthMetaAddress: Hex
  /** Block number when registered */
  blockNumber: bigint
}

/**
 * Stealth client configuration
 */
export interface StealthClientConfig {
  /** Public client for reading */
  publicClient: PublicClient
  /** Wallet client for writing (optional) */
  walletClient?: WalletClient
  /** EIP-5564 Announcer contract address */
  announcerAddress?: Address
  /** EIP-6538 Registry contract address */
  registryAddress?: Address
}

/**
 * Stealth client instance
 */
export interface StealthClient {
  /** Configuration */
  config: StealthClientConfig
  /** Public client */
  publicClient: PublicClient
  /** Wallet client (optional) */
  walletClient?: WalletClient
  /** Announcer contract address */
  announcerAddress: Address
  /** Registry contract address */
  registryAddress: Address
}

/**
 * Watch announcements options
 */
export interface WatchAnnouncementsOptions {
  /** Stealth client */
  client: StealthClient
  /** Spending public key */
  spendingPubKey: Hex
  /** Viewing private key for scanning */
  viewingPrivateKey: Hex
  /** Starting block (default: current block) */
  fromBlock?: bigint
  /** Scheme ID filter */
  schemeId?: SchemeId
  /** Polling interval in milliseconds */
  pollingInterval?: number
  /** Callback when announcement is found */
  onAnnouncement: (
    announcement: StealthAnnouncement,
    stealthKey: ComputedStealthKey
  ) => void | Promise<void>
  /** Callback on error */
  onError?: (error: Error) => void
}

/**
 * Generate stealth address params
 */
export interface GenerateStealthAddressParams {
  /** Stealth meta address URI (st:eth:0x...) */
  stealthMetaAddressUri: string
}

/**
 * Compute stealth key params
 */
export interface ComputeStealthKeyParams {
  /** Announcement to process */
  announcement: StealthAnnouncement
  /** Spending private key */
  spendingPrivateKey: Hex
  /** Viewing private key */
  viewingPrivateKey: Hex
}

/**
 * Register stealth meta address params
 */
export interface RegisterStealthMetaAddressParams {
  /** Scheme ID */
  schemeId: SchemeId
  /** Stealth meta address (spending + viewing public keys) */
  stealthMetaAddress: Hex
}

/**
 * Announce params
 */
export interface AnnounceParams {
  /** Scheme ID */
  schemeId: SchemeId
  /** Stealth address */
  stealthAddress: Address
  /** Ephemeral public key */
  ephemeralPubKey: Hex
  /** Metadata (view tag + extra data) */
  metadata: Hex
}

/**
 * Check announcement params
 */
export interface CheckAnnouncementParams {
  /** Announcement to check */
  announcement: StealthAnnouncement
  /** Viewing private key */
  viewingPrivateKey: Hex
  /** Spending public key */
  spendingPubKey: Hex
}
