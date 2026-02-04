import type { Address } from 'viem'

/**
 * Token asset stored in wallet
 */
export interface WalletToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  chainId: number
  logoURI?: string
  /** Whether the token is visible in the wallet UI */
  isVisible: boolean
  /** Timestamp when the token was added */
  addedAt: number
}

/**
 * Token balance with formatting
 */
export interface TokenBalanceInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: string // raw balance in smallest unit
  formattedBalance: string // human-readable balance
  logoURI?: string
}

/**
 * Native currency balance info
 */
export interface NativeBalanceInfo {
  symbol: string
  name: string
  decimals: number
  balance: string // wei
  formattedBalance: string
}

/**
 * Complete asset response for wallet_getAssets RPC
 */
export interface WalletAssetsResponse {
  chainId: number
  account: Address
  native: NativeBalanceInfo
  tokens: TokenBalanceInfo[]
  updatedAt: number
}

/**
 * Asset change reason for assetsChanged event
 */
export type AssetChangeReason =
  | 'token_added'
  | 'token_removed'
  | 'balance_changed'
  | 'chain_switched'

/**
 * assetsChanged event data
 */
export interface AssetsChangedEventData {
  chainId: number
  account: Address
  reason: AssetChangeReason
  timestamp: number
}

/**
 * Request params for wallet_addToken RPC
 */
export interface AddTokenParams {
  address: Address
  symbol?: string
  name?: string
  decimals?: number
  logoURI?: string
}

/**
 * Response for wallet_addToken RPC
 */
export interface AddTokenResponse {
  success: boolean
  token?: WalletToken
  error?: string
}

/**
 * Asset state stored in wallet
 * Managed per chainId and account
 */
export interface AssetState {
  /** Tracked tokens per chainId: chainId -> token address -> WalletToken */
  tokensByChain: Record<number, Record<string, WalletToken>>
  /** Cached balances per account per chainId: chainId -> account -> token address -> balance */
  balanceCache: Record<number, Record<string, Record<string, string>>>
  /** Last balance refresh timestamp per account per chainId */
  lastRefresh: Record<number, Record<string, number>>
}
