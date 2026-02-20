/**
 * TokenController
 * Manages ERC-20 token tracking, balances, and transfers
 * Integrates with indexer-go for token discovery and transfer history
 */

import { createLogger } from '../../shared/utils/logger'
import type { IndexerClient } from '../services/IndexerClient'

const logger = createLogger('TokenController')

/**
 * Token interface
 */
export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  chainId: number
  logoURI?: string
}

/**
 * Token balance with formatting
 */
export interface TokenBalance {
  token: Token
  balance: string
  formattedBalance: string
  symbol: string
}

/**
 * Token metadata for adding tokens
 */
export interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  logoURI?: string
}

/**
 * Token controller state
 */
export interface TokenControllerState {
  chainId: number
  tokens: Record<string, Token> // keyed by lowercase address
  balances: Record<string, Record<string, string>> // account -> token address -> balance
}

/**
 * Transaction object
 */
export interface TransferTransaction {
  to: string
  data: string
  value: string
}

/**
 * Provider interface
 */
export interface Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Controller configuration
 */
export interface TokenControllerConfig {
  provider: Provider
  chainId: number
  indexerClient?: IndexerClient
}

/**
 * Token transfer history entry
 */
export interface TokenTransferEntry {
  contractAddress: string
  from: string
  to: string
  value: string
  formattedValue?: string
  transactionHash: string
  blockNumber: number
  timestamp: number
  direction: 'in' | 'out'
  token?: Token
}

/**
 * Discovered token from indexer
 */
export interface DiscoveredToken {
  address: string
  balance: string
  symbol?: string
  name?: string
  decimals?: number
  needsMetadata: boolean
}

// ERC-20 function selectors
const ERC20_SELECTORS = {
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  balanceOf: '0x70a08231',
  transfer: '0xa9059cbb',
}

/**
 * Validate Ethereum address
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Pad address to 32 bytes
 */
function padAddress(address: string): string {
  return address.toLowerCase().replace('0x', '').padStart(64, '0')
}

/**
 * Pad number to 32 bytes hex
 */
function padNumber(value: string): string {
  const bn = BigInt(value)
  return bn.toString(16).padStart(64, '0')
}

/**
 * Decode string from ABI-encoded data
 */
function hexToUtf8(hexStr: string): string {
  const bytes = new Uint8Array(
    (hexStr.match(/.{2}/g) ?? []).map((b) => Number.parseInt(b, 16))
  )
  return new TextDecoder().decode(bytes).replace(/\0/g, '')
}

function decodeString(data: string): string {
  const hex = data.replace('0x', '')

  // Check if it's a dynamic string (starts with offset)
  if (hex.length >= 128) {
    // Dynamic string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = hex.slice(64, 128)
    const length = Number.parseInt(lengthHex, 16)
    const stringHex = hex.slice(128, 128 + length * 2)
    return hexToUtf8(stringHex)
  }

  // Static bytes32 string
  return hexToUtf8(hex)
}

/**
 * Decode uint256 from hex
 */
function decodeUint256(data: string): string {
  const hex = data.replace('0x', '')
  return BigInt(`0x${hex}`).toString()
}

/**
 * TokenController
 * Manages ERC-20 token tracking and balances
 */
export class TokenController {
  private provider: Provider
  private indexerClient: IndexerClient | null = null

  state: TokenControllerState

  constructor(config: TokenControllerConfig) {
    this.provider = config.provider
    this.indexerClient = config.indexerClient ?? null
    this.state = {
      chainId: config.chainId,
      tokens: {},
      balances: {},
    }
  }

  /**
   * Set indexer client (for deferred initialization)
   */
  setIndexerClient(client: IndexerClient): void {
    this.indexerClient = client
  }

  /**
   * Add a token to track
   */
  async addToken(address: string, metadata?: TokenMetadata): Promise<Token> {
    if (!isValidAddress(address)) {
      throw new Error('Invalid token address')
    }

    const normalizedAddress = address.toLowerCase()

    // Check if already tracked
    if (this.state.tokens[normalizedAddress]) {
      return this.state.tokens[normalizedAddress]
    }

    let token: Token

    if (metadata) {
      // Use provided metadata
      token = {
        address,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        chainId: this.state.chainId,
        logoURI: metadata.logoURI,
      }
    } else {
      // Fetch metadata from contract
      const [name, symbol, decimals] = await Promise.all([
        this.getTokenName(address),
        this.getTokenSymbol(address),
        this.getTokenDecimals(address),
      ])

      token = {
        address,
        name,
        symbol,
        decimals,
        chainId: this.state.chainId,
      }
    }

    this.state.tokens[normalizedAddress] = token
    return token
  }

  /**
   * Remove a token from tracking
   */
  removeToken(address: string): void {
    const normalizedAddress = address.toLowerCase()

    delete this.state.tokens[normalizedAddress]

    // Remove balances for this token
    for (const account of Object.keys(this.state.balances)) {
      delete this.state.balances[account]?.[normalizedAddress]
    }
  }

  /**
   * Get all tracked tokens
   */
  getTokens(): Token[] {
    return Object.values(this.state.tokens)
  }

  /**
   * Get token by address
   */
  getToken(address: string): Token | undefined {
    return this.state.tokens[address.toLowerCase()]
  }

  /**
   * Get token balance for an account
   */
  async getTokenBalance(tokenAddress: string, account: string): Promise<string> {
    try {
      const data = ERC20_SELECTORS.balanceOf + padAddress(account)

      const result = (await this.provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest'],
      })) as string

      const balance = decodeUint256(result)

      // Update state
      const normalizedToken = tokenAddress.toLowerCase()
      if (!this.state.balances[account]) {
        this.state.balances[account] = {}
      }
      this.state.balances[account][normalizedToken] = balance

      return balance
    } catch {
      throw new Error('Failed to fetch token balance')
    }
  }

  /**
   * Get all token balances for an account
   */
  async getAllTokenBalances(account: string): Promise<TokenBalance[]> {
    const tokens = this.getTokens()
    const balances: TokenBalance[] = []

    for (const token of tokens) {
      try {
        const balance = await this.getTokenBalance(token.address, account)
        balances.push({
          token,
          balance,
          formattedBalance: this.formatTokenAmount(balance, token.decimals),
          symbol: token.symbol,
        })
      } catch {
        // Skip tokens that fail to fetch
        balances.push({
          token,
          balance: '0',
          formattedBalance: '0',
          symbol: token.symbol,
        })
      }
    }

    return balances
  }

  /**
   * Get token name from contract
   */
  async getTokenName(address: string): Promise<string> {
    const result = (await this.provider.request({
      method: 'eth_call',
      params: [{ to: address, data: ERC20_SELECTORS.name }, 'latest'],
    })) as string

    return decodeString(result)
  }

  /**
   * Get token symbol from contract
   */
  async getTokenSymbol(address: string): Promise<string> {
    const result = (await this.provider.request({
      method: 'eth_call',
      params: [{ to: address, data: ERC20_SELECTORS.symbol }, 'latest'],
    })) as string

    return decodeString(result)
  }

  /**
   * Get token decimals from contract
   */
  async getTokenDecimals(address: string): Promise<number> {
    const result = (await this.provider.request({
      method: 'eth_call',
      params: [{ to: address, data: ERC20_SELECTORS.decimals }, 'latest'],
    })) as string

    return Number.parseInt(decodeUint256(result), 10)
  }

  /**
   * Build ERC-20 transfer transaction
   */
  buildTransferTransaction(
    tokenAddress: string,
    recipient: string,
    amount: string
  ): TransferTransaction {
    const data = ERC20_SELECTORS.transfer + padAddress(recipient) + padNumber(amount)

    return {
      to: tokenAddress,
      data,
      value: '0x0',
    }
  }

  /**
   * Format token amount with decimals
   */
  formatTokenAmount(amount: string, decimals: number): string {
    if (amount === '0') return '0'

    const bn = BigInt(amount)
    const divisor = BigInt(10 ** decimals)
    const whole = bn / divisor
    const remainder = bn % divisor

    if (remainder === 0n) {
      return whole.toString()
    }

    const remainderStr = remainder.toString().padStart(decimals, '0')
    const trimmed = remainderStr.replace(/0+$/, '')

    return `${whole}.${trimmed}`
  }

  /**
   * Parse token amount to smallest unit
   */
  parseTokenAmount(amount: string, decimals: number): string {
    const [whole, fraction = ''] = amount.split('.')
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
    const combined = whole + paddedFraction

    return BigInt(combined).toString()
  }

  /**
   * Set chain ID and clear state
   */
  setChainId(chainId: number): void {
    this.state.chainId = chainId
    this.state.tokens = {}
    this.state.balances = {}
  }

  // ============================================
  // Indexer Integration Methods
  // ============================================

  /**
   * Discover tokens held by an address using indexer
   * Returns tokens that need metadata to be fetched from RPC
   */
  async discoverTokens(account: string): Promise<DiscoveredToken[]> {
    if (!this.indexerClient) {
      logger.debug('Indexer client not configured, skipping token discovery')
      return []
    }

    try {
      const balances = await this.indexerClient.getTokenBalances(account, 'ERC20')

      const discovered: DiscoveredToken[] = balances
        .filter((b) => BigInt(b.balance) > 0n)
        .map((b) => ({
          address: b.address,
          balance: b.balance,
          symbol: b.symbol,
          name: b.name,
          decimals: b.decimals,
          needsMetadata: !b.symbol || !b.name || b.decimals === undefined,
        }))

      return discovered
    } catch (error) {
      logger.warn('Failed to discover tokens from indexer', { error })
      return []
    }
  }

  /**
   * Auto-add discovered tokens
   * Discovers tokens from indexer and adds them to tracking
   */
  async autoAddTokens(account: string): Promise<Token[]> {
    const discovered = await this.discoverTokens(account)
    const addedTokens: Token[] = []

    for (const token of discovered) {
      try {
        // Check if already tracked
        if (this.state.tokens[token.address.toLowerCase()]) {
          continue
        }

        let metadata: TokenMetadata | undefined

        // Use indexer metadata if complete
        if (!token.needsMetadata && token.symbol && token.name && token.decimals !== undefined) {
          metadata = {
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
          }
        }

        // Add token (will fetch metadata from RPC if not provided)
        const addedToken = await this.addToken(token.address, metadata)
        addedTokens.push(addedToken)

        // Update balance from indexer data
        const normalizedAddress = token.address.toLowerCase()
        if (!this.state.balances[account]) {
          this.state.balances[account] = {}
        }
        this.state.balances[account][normalizedAddress] = token.balance
      } catch (error) {
        logger.warn('Failed to add discovered token', { address: token.address, error })
      }
    }

    return addedTokens
  }

  /**
   * Get token transfer history for an account
   */
  async getTransferHistory(account: string, limit = 50): Promise<TokenTransferEntry[]> {
    if (!this.indexerClient) {
      logger.debug('Indexer client not configured, no transfer history available')
      return []
    }

    try {
      const transfers = await this.indexerClient.getAllERC20Transfers(account, limit)

      return transfers.map((t) => {
        const normalizedAccount = account.toLowerCase()
        const direction = t.from.toLowerCase() === normalizedAccount ? 'out' : 'in'
        const token = this.state.tokens[t.contractAddress.toLowerCase()]

        return {
          contractAddress: t.contractAddress,
          from: t.from,
          to: t.to,
          value: t.value,
          formattedValue: token ? this.formatTokenAmount(t.value, token.decimals) : undefined,
          transactionHash: t.transactionHash,
          blockNumber: t.blockNumber,
          timestamp: t.timestamp,
          direction,
          token,
        }
      })
    } catch (error) {
      logger.warn('Failed to get transfer history from indexer', { error })
      return []
    }
  }

  /**
   * Get transfer history for a specific token
   */
  async getTokenTransferHistory(
    tokenAddress: string,
    account: string,
    limit = 50
  ): Promise<TokenTransferEntry[]> {
    const allHistory = await this.getTransferHistory(account, limit * 2)

    return allHistory
      .filter((t) => t.contractAddress.toLowerCase() === tokenAddress.toLowerCase())
      .slice(0, limit)
  }

  /**
   * Refresh all token balances using a combination of indexer and RPC
   * Indexer provides quick discovery, RPC provides accurate current balance
   */
  async refreshAllBalances(account: string): Promise<TokenBalance[]> {
    // First, discover any new tokens from indexer
    await this.autoAddTokens(account)

    // Then fetch accurate balances from RPC for all tracked tokens
    return this.getAllTokenBalances(account)
  }
}
