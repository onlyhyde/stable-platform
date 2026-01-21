import type { Address } from 'viem'

/**
 * OnRamp simulator types
 */

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

/**
 * Price quote
 */
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

export interface QuoteFees {
  networkFee: number
  serviceFee: number
  processingFee: number
  total: number
}

/**
 * Purchase order
 */
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

/**
 * Get quote request
 */
export interface GetQuoteRequest {
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount?: number
  cryptoAmount?: string
}

/**
 * Get quote response
 */
export interface GetQuoteResponse {
  quote: OnRampQuote
}

/**
 * Create order request
 */
export interface CreateOrderRequest {
  quoteId?: string
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount: number
  paymentMethod: PaymentMethod
  recipientAddress: Address
  bankAccountNo?: string
}

/**
 * Create order response
 */
export interface CreateOrderResponse {
  order: OnRampOrder
  paymentInstructions?: PaymentInstructions
}

export interface PaymentInstructions {
  type: PaymentMethod
  // Bank transfer
  bankName?: string
  bankAccountNo?: string
  routingNumber?: string
  swiftCode?: string
  reference?: string
  // Card payment
  paymentUrl?: string
  // Expiration
  expiresAt: string
}

/**
 * Update order request (confirm payment)
 */
export interface UpdateOrderRequest {
  status?: 'processing' | 'cancelled'
  paymentConfirmed?: boolean
  bankTransactionId?: string
}

/**
 * Update order response
 */
export interface UpdateOrderResponse {
  order: OnRampOrder
}

/**
 * Order list response
 */
export interface OrderListResponse {
  orders: OnRampOrder[]
  total: number
}

/**
 * Supported currencies response
 */
export interface SupportedCurrenciesResponse {
  fiatCurrencies: FiatCurrency[]
  cryptoCurrencies: CryptoCurrency[]
  paymentMethods: PaymentMethod[]
}

/**
 * OnRamp API error
 */
export interface OnRampApiError {
  code: string
  message: string
  details?: unknown
}

/**
 * Exchange rates
 */
export interface ExchangeRates {
  [pair: string]: number // e.g., "USD_ETH": 0.0003
}
