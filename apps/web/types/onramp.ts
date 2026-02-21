import type { Address } from 'viem'

// ============================================================================
// Enums / Unions
// ============================================================================

export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'KRW' | 'JPY'
export type CryptoCurrency = 'ETH' | 'USDC' | 'USDT' | 'DAI'
export type PaymentMethod = 'bank_transfer' | 'card' | 'wire'
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected'

// ============================================================================
// Interfaces
// ============================================================================

export interface QuoteFees {
  networkFee: number
  serviceFee: number
  processingFee: number
  total: number
}

export interface OnRampQuote {
  id: string
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount: number
  cryptoAmount: string
  exchangeRate: number
  fees: QuoteFees
  totalFiatAmount: number
  expiresAt: string
  createdAt: string
}

export interface OnRampOrder {
  id: string
  quoteId?: string
  status: OrderStatus
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount: number
  cryptoAmount: string
  exchangeRate: number
  fees: QuoteFees
  totalFiatAmount: number
  paymentMethod: PaymentMethod
  recipientAddress: Address
  bankAccountNo?: string
  txHash?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  failureReason?: string
}

export interface CreateOrderParams {
  quoteId: string
  paymentMethod: PaymentMethod
  recipientAddress: Address
  bankAccountNo?: string
}

export interface SupportedAssets {
  fiat: FiatCurrency[]
  crypto: CryptoCurrency[]
}
