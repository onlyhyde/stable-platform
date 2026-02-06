import type { Address } from 'viem'
import { getApiConfig } from '../../config'
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CryptoCurrency,
  FiatCurrency,
  GetQuoteRequest,
  GetQuoteResponse,
  OnRampOrder,
  OnRampQuote,
  OrderListResponse,
  PaymentMethod,
  SupportedCurrenciesResponse,
  UpdateOrderRequest,
  UpdateOrderResponse,
} from '../../types'
import { BaseApiClient } from './baseApi'

/**
 * OnRamp Simulator API Client
 * Provides crypto purchase functionality
 */

export class OnRampApiClient extends BaseApiClient {
  constructor(baseUrl: string = getApiConfig().onrampApiUrl) {
    super(baseUrl)
  }

  /**
   * Get a price quote
   */
  async getQuote(data: GetQuoteRequest): Promise<OnRampQuote> {
    const response = await this.post<GetQuoteResponse>('/quotes', data)
    return response.quote
  }

  /**
   * Get a quote by ID
   */
  async getQuoteById(quoteId: string): Promise<OnRampQuote> {
    return this.get<OnRampQuote>(`/quotes/${quoteId}`)
  }

  /**
   * Create a purchase order
   */
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.post<CreateOrderResponse>('/orders', data)
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<OnRampOrder> {
    return this.get<OnRampOrder>(`/orders/${orderId}`)
  }

  /**
   * Update an order (confirm payment, cancel)
   */
  async updateOrder(orderId: string, data: UpdateOrderRequest): Promise<OnRampOrder> {
    const response = await this.put<UpdateOrderResponse>(`/orders/${orderId}`, data)
    return response.order
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<OnRampOrder> {
    return this.updateOrder(orderId, { status: 'cancelled' })
  }

  /**
   * Confirm payment for an order
   */
  async confirmPayment(orderId: string, bankTransactionId?: string): Promise<OnRampOrder> {
    return this.updateOrder(orderId, {
      paymentConfirmed: true,
      bankTransactionId,
    })
  }

  /**
   * Get order history for an address
   */
  async getOrderHistory(address: Address): Promise<OnRampOrder[]> {
    const response = await this.get<OrderListResponse>(`/orders?address=${address}`)
    return response.orders
  }

  /**
   * Get all orders (paginated)
   */
  async getOrders(page = 1, limit = 20): Promise<OrderListResponse> {
    return this.get<OrderListResponse>(`/orders?page=${page}&limit=${limit}`)
  }

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies(): Promise<SupportedCurrenciesResponse> {
    return this.get<SupportedCurrenciesResponse>('/currencies')
  }

  /**
   * Get current exchange rates
   */
  async getExchangeRates(): Promise<Record<string, number>> {
    return this.get<Record<string, number>>('/rates')
  }

  /**
   * Get exchange rate for specific pair
   */
  async getExchangeRate(fiat: FiatCurrency, crypto: CryptoCurrency): Promise<number> {
    const rates = await this.getExchangeRates()
    return rates[`${fiat}_${crypto}`] ?? 0
  }

  /**
   * Estimate crypto amount for fiat
   */
  async estimateCryptoAmount(
    fiatAmount: number,
    fiatCurrency: FiatCurrency,
    cryptoCurrency: CryptoCurrency
  ): Promise<string> {
    const quote = await this.getQuote({
      fiatCurrency,
      cryptoCurrency,
      fiatAmount,
    })
    return quote.cryptoAmount
  }

  /**
   * Estimate fiat amount for crypto
   */
  async estimateFiatAmount(
    cryptoAmount: string,
    fiatCurrency: FiatCurrency,
    cryptoCurrency: CryptoCurrency
  ): Promise<number> {
    const quote = await this.getQuote({
      fiatCurrency,
      cryptoCurrency,
      cryptoAmount,
    })
    return quote.fiatAmount
  }

  /**
   * Get available payment methods for a currency
   */
  async getPaymentMethods(_fiatCurrency: FiatCurrency): Promise<PaymentMethod[]> {
    const currencies = await this.getSupportedCurrencies()
    return currencies.paymentMethods
  }
}

// Singleton instance with default URL
export const onrampApi = new OnRampApiClient()

/**
 * Create a new onramp API client with custom URL
 */
export function createOnRampApi(baseUrl: string): OnRampApiClient {
  return new OnRampApiClient(baseUrl)
}
