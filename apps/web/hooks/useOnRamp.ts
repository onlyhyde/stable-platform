'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import type {
  CreateOrderParams,
  CryptoCurrency,
  FiatCurrency,
  KycStatus,
  OnRampOrder,
  OnRampQuote,
  SupportedAssets,
} from '@/types/onramp'

// ============================================================================
// Config
// ============================================================================

const ONRAMP_API_BASE = 'http://localhost:3002/api/v1'

// ============================================================================
// Types
// ============================================================================

export interface UseOnRampReturn {
  quote: OnRampQuote | null
  orders: OnRampOrder[]
  kycStatus: KycStatus
  supportedAssets: SupportedAssets
  isLoadingQuote: boolean
  isLoadingOrders: boolean
  isCreatingOrder: boolean
  error: string | null
  getQuote: (
    fiat: FiatCurrency,
    crypto: CryptoCurrency,
    amount: number
  ) => Promise<OnRampQuote | null>
  createOrder: (params: CreateOrderParams) => Promise<OnRampOrder | null>
  cancelOrder: (orderId: string) => Promise<boolean>
  refreshOrders: () => Promise<void>
  checkKycStatus: (address: Address) => Promise<KycStatus>
  clearQuote: () => void
  clearError: () => void
}

// ============================================================================
// Helper
// ============================================================================

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ONRAMP_API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `API error: ${res.status}`)
  }
  return res.json()
}

// ============================================================================
// Hook
// ============================================================================

export function useOnRamp(): UseOnRampReturn {
  const [quote, setQuote] = useState<OnRampQuote | null>(null)
  const [orders, setOrders] = useState<OnRampOrder[]>([])
  const [kycStatus, setKycStatus] = useState<KycStatus>('none')
  const [supportedAssets, setSupportedAssets] = useState<SupportedAssets>({
    fiat: ['USD', 'EUR', 'KRW'],
    crypto: ['ETH', 'USDC', 'USDT'],
  })
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  // Load supported assets on mount
  useEffect(() => {
    apiCall<SupportedAssets>('/supported-assets')
      .then(setSupportedAssets)
      .catch(() => {
        // Keep defaults on failure
      })
  }, [])

  const getQuote = useCallback(
    async (
      fiat: FiatCurrency,
      crypto: CryptoCurrency,
      amount: number
    ): Promise<OnRampQuote | null> => {
      const id = ++fetchIdRef.current
      setIsLoadingQuote(true)
      setError(null)
      try {
        const result = await apiCall<OnRampQuote>('/quotes', {
          method: 'POST',
          body: JSON.stringify({ fiatCurrency: fiat, cryptoCurrency: crypto, fiatAmount: amount }),
        })
        if (id !== fetchIdRef.current) return null
        setQuote(result)
        return result
      } catch (err) {
        if (id !== fetchIdRef.current) return null
        const msg = err instanceof Error ? err.message : 'Failed to get quote'
        setError(msg)
        return null
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoadingQuote(false)
        }
      }
    },
    []
  )

  const createOrder = useCallback(
    async (params: CreateOrderParams): Promise<OnRampOrder | null> => {
      setIsCreatingOrder(true)
      setError(null)
      try {
        const result = await apiCall<OnRampOrder>('/orders', {
          method: 'POST',
          body: JSON.stringify(params),
        })
        setOrders((prev) => [result, ...prev])
        setQuote(null) // Clear used quote
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create order'
        setError(msg)
        return null
      } finally {
        setIsCreatingOrder(false)
      }
    },
    []
  )

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setError(null)
    try {
      await apiCall(`/orders/${orderId}/cancel`, { method: 'POST' })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o))
      )
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel order'
      setError(msg)
      return false
    }
  }, [])

  const refreshOrders = useCallback(async () => {
    const id = ++fetchIdRef.current
    setIsLoadingOrders(true)
    try {
      const result = await apiCall<OnRampOrder[]>('/orders')
      if (id !== fetchIdRef.current) return
      setOrders(Array.isArray(result) ? result : [])
    } catch {
      // Keep existing orders on error
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoadingOrders(false)
      }
    }
  }, [])

  const checkKycStatus = useCallback(async (address: Address): Promise<KycStatus> => {
    try {
      const result = await apiCall<{ status: KycStatus }>(`/kyc/status/${address}`)
      setKycStatus(result.status)
      return result.status
    } catch {
      return 'none'
    }
  }, [])

  return {
    quote,
    orders,
    kycStatus,
    supportedAssets,
    isLoadingQuote,
    isLoadingOrders,
    isCreatingOrder,
    error,
    getQuote,
    createOrder,
    cancelOrder,
    refreshOrders,
    checkKycStatus,
    clearQuote: () => setQuote(null),
    clearError: () => setError(null),
  }
}
