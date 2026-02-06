import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import type {
  CryptoCurrency,
  FiatCurrency,
  OnRampOrder,
  OnRampQuote,
  PaymentMethod,
} from '../../types'

interface UseOnRampResult {
  quote: OnRampQuote | null
  orders: OnRampOrder[]
  isLoadingQuote: boolean
  isLoadingOrders: boolean
  isCreatingOrder: boolean
  error: string | null
  getQuote: (
    fiatCurrency: FiatCurrency,
    cryptoCurrency: CryptoCurrency,
    fiatAmount: number
  ) => Promise<OnRampQuote | null>
  createOrder: (params: {
    quoteId?: string
    fiatCurrency: FiatCurrency
    cryptoCurrency: CryptoCurrency
    fiatAmount: number
    paymentMethod: PaymentMethod
    recipientAddress: Address
    bankAccountNo?: string
  }) => Promise<OnRampOrder | null>
  cancelOrder: (orderId: string) => Promise<boolean>
  refreshOrders: () => Promise<void>
  clearQuote: () => void
}

export function useOnRamp(): UseOnRampResult {
  const [quote, setQuote] = useState<OnRampQuote | null>(null)
  const [orders, setOrders] = useState<OnRampOrder[]>([])
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshOrders = useCallback(async () => {
    setIsLoadingOrders(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ONRAMP_ORDERS',
      })
      if (response?.orders) {
        setOrders(response.orders)
      }
    } catch {
      // Silent fail for orders
    } finally {
      setIsLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    refreshOrders()
  }, [refreshOrders])

  // Quote expiration timer
  useEffect(() => {
    if (!quote) return
    const expiresAt = new Date(quote.expiresAt).getTime()
    const checkExpiration = setInterval(() => {
      if (Date.now() > expiresAt) {
        setQuote(null)
        clearInterval(checkExpiration)
      }
    }, 1000)
    return () => clearInterval(checkExpiration)
  }, [quote])

  const getQuote = useCallback(
    async (
      fiatCurrency: FiatCurrency,
      cryptoCurrency: CryptoCurrency,
      fiatAmount: number
    ): Promise<OnRampQuote | null> => {
      setIsLoadingQuote(true)
      setError(null)
      setQuote(null)
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ONRAMP_QUOTE',
          payload: { fiatCurrency, cryptoCurrency, fiatAmount },
        })
        if (response?.quote) {
          setQuote(response.quote)
          return response.quote
        }
        if (response?.error) {
          setError(response.error)
        }
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get quote')
        return null
      } finally {
        setIsLoadingQuote(false)
      }
    },
    []
  )

  const createOrder = useCallback(
    async (params: {
      quoteId?: string
      fiatCurrency: FiatCurrency
      cryptoCurrency: CryptoCurrency
      fiatAmount: number
      paymentMethod: PaymentMethod
      recipientAddress: Address
      bankAccountNo?: string
    }): Promise<OnRampOrder | null> => {
      setIsCreatingOrder(true)
      setError(null)
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CREATE_ONRAMP_ORDER',
          payload: params,
        })
        if (response?.order) {
          setQuote(null)
          await refreshOrders()
          return response.order
        }
        if (response?.error) {
          setError(response.error)
        }
        return null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create order')
        return null
      } finally {
        setIsCreatingOrder(false)
      }
    },
    [refreshOrders]
  )

  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CANCEL_ONRAMP_ORDER',
          payload: { orderId },
        })
        if (response?.success) {
          await refreshOrders()
          return true
        }
        if (response?.error) {
          setError(response.error)
        }
        return false
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel order')
        return false
      }
    },
    [refreshOrders]
  )

  const clearQuote = useCallback(() => {
    setQuote(null)
  }, [])

  return {
    quote,
    orders,
    isLoadingQuote,
    isLoadingOrders,
    isCreatingOrder,
    error,
    getQuote,
    createOrder,
    cancelOrder,
    refreshOrders,
    clearQuote,
  }
}
