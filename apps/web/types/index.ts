import type { Address, Hex } from 'viem'

/**
 * Network configuration
 */
export interface Network {
  chainId: number
  name: string
  rpcUrl: string
  bundlerUrl: string
  paymasterUrl?: string
  explorerUrl?: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
}

/**
 * Account types
 */
export interface Account {
  address: Address
  name: string
  type: 'smart' | 'eoa'
  isDeployed?: boolean
}

/**
 * Transaction types
 */
export interface Transaction {
  hash: Hex
  from: Address
  to: Address
  value: bigint
  data?: Hex
  chainId: number
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: number
  userOpHash?: Hex
  /** ERC-20 token transfer info (absent for native-only transfers) */
  tokenTransfer?: {
    contractAddress: Address
    symbol?: string
    decimals?: number
    value: bigint
  }
}

/**
 * Token types
 */
export interface Token {
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
  balance?: bigint
}

/**
 * Swap types
 */
export interface SwapQuote {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  amountOut: bigint
  priceImpact: number
  route: Address[]
  gasEstimate: bigint
}

/**
 * Pool types
 */
export interface Pool {
  address: Address
  token0: Token
  token1: Token
  reserve0: bigint
  reserve1: bigint
  fee: number
  tvl: number
  apr: number
}

/**
 * Liquidity Position types
 */
export interface LiquidityPosition {
  poolAddress: Address
  token0: Token
  token1: Token
  liquidity: bigint
  token0Amount: bigint
  token1Amount: bigint
  shareOfPool: number
}

/**
 * Stealth types
 */
export interface StealthMetaAddress {
  prefix: string
  spendingPubKey: Hex
  viewingPubKey: Hex
}

export interface Announcement {
  schemeId: number
  stealthAddress: Address
  ephemeralPubKey: Hex
  viewTag: number
  caller: Address
  blockNumber: bigint
  transactionHash: Hex
  value: bigint
}

/**
 * Enterprise types
 */
export interface PayrollEntry {
  id: string
  recipient: Address
  amount: bigint
  token: Token
  frequency: 'weekly' | 'biweekly' | 'monthly'
  nextPaymentDate: Date
  status: 'active' | 'paused' | 'completed'
}

export interface Expense {
  id: string
  description: string
  amount: bigint
  token: Token
  category: string
  submitter: Address
  approver?: Address
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  submittedAt: Date
}

export interface AuditLog {
  id: string
  action: string
  actor: Address
  target?: Address
  details: string
  timestamp: Date
  txHash?: Hex
}
