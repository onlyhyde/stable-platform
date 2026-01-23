/**
 * TokenController
 * Manages ERC-20 token tracking, balances, and transfers
 */

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
function decodeString(data: string): string {
  const hex = data.replace('0x', '')

  // Check if it's a dynamic string (starts with offset)
  if (hex.length >= 128) {
    // Dynamic string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = hex.slice(64, 128)
    const length = parseInt(lengthHex, 16)
    const stringHex = hex.slice(128, 128 + length * 2)
    return Buffer.from(stringHex, 'hex').toString('utf8').replace(/\0/g, '')
  }

  // Static bytes32 string
  return Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '')
}

/**
 * Decode uint256 from hex
 */
function decodeUint256(data: string): string {
  const hex = data.replace('0x', '')
  return BigInt('0x' + hex).toString()
}

/**
 * TokenController
 * Manages ERC-20 token tracking and balances
 */
export class TokenController {
  private provider: Provider

  state: TokenControllerState

  constructor(config: TokenControllerConfig) {
    this.provider = config.provider
    this.state = {
      chainId: config.chainId,
      tokens: {},
      balances: {},
    }
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
      const data =
        ERC20_SELECTORS.balanceOf + padAddress(account)

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

    return parseInt(decodeUint256(result), 10)
  }

  /**
   * Build ERC-20 transfer transaction
   */
  buildTransferTransaction(
    tokenAddress: string,
    recipient: string,
    amount: string
  ): TransferTransaction {
    const data =
      ERC20_SELECTORS.transfer +
      padAddress(recipient) +
      padNumber(amount)

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
}
