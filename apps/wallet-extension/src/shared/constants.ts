import type { Network } from '../types'

/**
 * Default networks configuration
 */
export const DEFAULT_NETWORKS: Network[] = [
  {
    chainId: 31337,
    name: 'Anvil (Local)',
    rpcUrl: 'http://127.0.0.1:8545',
    bundlerUrl: 'http://127.0.0.1:8545',
    currency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
  {
    chainId: 8283,
    name: 'StableNet Local',
    rpcUrl: 'http://127.0.0.1:8501',
    bundlerUrl: 'http://127.0.0.1:4337',
    paymasterUrl: 'http://127.0.0.1:4338',
    explorerUrl: 'http://127.0.0.1:3000',
    indexerUrl: 'http://127.0.0.1:8080',
    currency: {
      name: 'WKRC Coin',
      symbol: 'WKRC',
      decimals: 18,
    },
    isTestnet: true,
  },
  {
    chainId: 82830,
    name: 'StableNet Testnet',
    rpcUrl: 'https://rpc.testnet.stablenet.dev',
    bundlerUrl: 'https://bundler.testnet.stablenet.dev',
    paymasterUrl: 'https://paymaster.testnet.stablenet.dev',
    explorerUrl: 'https://explorer.testnet.stablenet.dev',
    indexerUrl: 'https://indexer.testnet.stablenet.dev',
    currency: {
      name: 'WKRC Coin',
      symbol: 'WKRC',
      decimals: 18,
    },
    isTestnet: true,
  },
]

/**
 * Load default networks from the bundled networks.json file.
 * Falls back to the hardcoded DEFAULT_NETWORKS if the file cannot be loaded.
 * This should only be called from the background service worker context.
 */
export async function loadDefaultNetworks(): Promise<Network[]> {
  try {
    const url = chrome.runtime.getURL('networks.json')
    const response = await fetch(url)
    const config = await response.json()
    if (Array.isArray(config.networks) && config.networks.length > 0) {
      return config.networks
    }
    return DEFAULT_NETWORKS
  } catch {
    return DEFAULT_NETWORKS
  }
}

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  WALLET_STATE: 'stablenet_wallet_state',
  ENCRYPTED_VAULT: 'stablenet_encrypted_vault',
  CONNECTED_SITES: 'stablenet_connected_sites',
  PREFERENCES: 'stablenet_preferences',
} as const

/**
 * Session storage keys (for service worker persistence)
 * These are stored in chrome.storage.session which persists across
 * service worker restarts but is cleared when browser closes
 */
export const SESSION_KEYS = {
  VAULT_SESSION: 'stablenet_vault_session',
  SESSION_TIMESTAMP: 'stablenet_session_timestamp',
} as const

/**
 * Message types for extension communication
 */
export const MESSAGE_TYPES = {
  RPC_REQUEST: 'RPC_REQUEST',
  RPC_RESPONSE: 'RPC_RESPONSE',
  STATE_UPDATE: 'STATE_UPDATE',
  CONNECT_REQUEST: 'CONNECT_REQUEST',
  CONNECT_RESPONSE: 'CONNECT_RESPONSE',
  DISCONNECT: 'DISCONNECT',
  APPROVAL_RESPONSE: 'APPROVAL_RESPONSE',
  PROVIDER_EVENT: 'PROVIDER_EVENT',
  // Ledger hardware wallet messages
  LEDGER_CONNECT: 'LEDGER_CONNECT',
  LEDGER_DISCONNECT: 'LEDGER_DISCONNECT',
  LEDGER_DISCOVER_ACCOUNTS: 'LEDGER_DISCOVER_ACCOUNTS',
  LEDGER_ADD_ACCOUNT: 'LEDGER_ADD_ACCOUNT',
} as const

/**
 * Provider events (EIP-1193)
 */
export const PROVIDER_EVENTS = {
  ACCOUNTS_CHANGED: 'accountsChanged',
  CHAIN_CHANGED: 'chainChanged',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
} as const

/**
 * RPC error codes
 */
export const RPC_ERRORS = {
  INVALID_INPUT: { code: -32000, message: 'Invalid input' },
  RESOURCE_NOT_FOUND: { code: -32001, message: 'Resource not found' },
  RESOURCE_UNAVAILABLE: { code: -32002, message: 'Resource unavailable' },
  TRANSACTION_REJECTED: { code: -32003, message: 'Transaction rejected' },
  METHOD_NOT_SUPPORTED: { code: -32004, message: 'Method not supported' },
  LIMIT_EXCEEDED: { code: -32005, message: 'Limit exceeded' },
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'The requested account has not been authorized' },
  UNSUPPORTED_METHOD: { code: 4200, message: 'The requested method is not supported' },
  DISCONNECTED: { code: 4900, message: 'The provider is disconnected from all chains' },
  CHAIN_DISCONNECTED: {
    code: 4901,
    message: 'The provider is disconnected from the specified chain',
  },
} as const

/**
 * Popup dimensions
 */
export const POPUP_DIMENSIONS = {
  WIDTH: 360,
  HEIGHT: 600,
} as const

/**
 * Timing constants
 */
export const TIMING = {
  /** RPC request timeout in milliseconds (60 seconds) */
  RPC_REQUEST_TIMEOUT_MS: 60000,
  /** Toast notification duration in milliseconds (5 seconds) */
  TOAST_DURATION_MS: 5000,
  /** API request timeout in milliseconds (30 seconds) */
  API_TIMEOUT_MS: 30000,
} as const

/**
 * Default values for various operations
 */
export const DEFAULT_VALUES = {
  /** Default gas limit for simple transfers */
  GAS_LIMIT: 21000n,
  /** Default chain ID (Ethereum mainnet) */
  CHAIN_ID_HEX: '0x1',
  /** Wallet UUID for EIP-6963 */
  WALLET_UUID: 'd8f3b2a1-5c4e-4f6d-9a8b-7e1c2d3f4a5b',
  /** StableNet provider RDNS identifier */
  PROVIDER_RDNS: 'dev.stablenet.wallet',
} as const
