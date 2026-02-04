'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { getNativeCurrencySymbol } from '@stablenet/wallet-sdk'

interface UseBalanceOptions {
  address?: Address
  token?: Address
  chainId?: number
  watch?: boolean
}

interface BalanceResult {
  balance: bigint
  symbol: string
  decimals: number
  formatted: string
  chainId: number | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<void>
}

/**
 * Hook to get balance for an address using wallet provider directly
 * This allows dynamic network support without hardcoding chains in wagmi config
 */
export function useBalance(options: UseBalanceOptions = {}): BalanceResult {
  const { address, token, watch = false } = options
  const { connector } = useAccount()
  const wagmiChainId = useChainId()

  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [symbol, setSymbol] = useState<string>('ETH')
  const [decimals, setDecimals] = useState<number>(18)
  const [chainId, setChainId] = useState<number | undefined>(wagmiChainId)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setIsError(false)

    try {
      // Get provider from connected wallet
      const provider = await connector?.getProvider() as { request?: Function } | undefined
      if (!provider?.request) {
        // Fallback to window.ethereum
        const windowProvider = (window as { ethereum?: { request: Function } }).ethereum
        if (!windowProvider?.request) {
          throw new Error('No provider available')
        }

        // Get chain ID from provider
        const chainIdHex = await windowProvider.request({ method: 'eth_chainId' }) as string
        const currentChainId = parseInt(chainIdHex, 16)
        setChainId(currentChainId)

        if (token) {
          // ERC-20 token balance
          const balanceResult = await windowProvider.request({
            method: 'eth_call',
            params: [{
              to: token,
              data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf(address)
            }, 'latest'],
          }) as string
          setBalance(BigInt(balanceResult || '0'))

          // Get token symbol and decimals
          const symbolResult = await windowProvider.request({
            method: 'eth_call',
            params: [{ to: token, data: '0x95d89b41' }, 'latest'], // symbol()
          }) as string
          const decimalsResult = await windowProvider.request({
            method: 'eth_call',
            params: [{ to: token, data: '0x313ce567' }, 'latest'], // decimals()
          }) as string

          if (symbolResult && symbolResult !== '0x') {
            // Decode string from ABI
            const symbolHex = symbolResult.slice(130).replace(/00+$/, '')
            setSymbol(Buffer.from(symbolHex, 'hex').toString('utf8') || 'TOKEN')
          }
          if (decimalsResult && decimalsResult !== '0x') {
            setDecimals(parseInt(decimalsResult, 16))
          }
        } else {
          // Native balance
          const balanceHex = await windowProvider.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }) as string
          setBalance(BigInt(balanceHex || '0'))

          // Get native currency symbol from chain info
          const networkSymbol = getNativeCurrencySymbol(currentChainId)
          setSymbol(networkSymbol)
          setDecimals(18)
        }
      } else {
        // Use connector's provider
        const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string
        const currentChainId = parseInt(chainIdHex, 16)
        setChainId(currentChainId)

        if (token) {
          // ERC-20 token balance
          const balanceResult = await provider.request({
            method: 'eth_call',
            params: [{
              to: token,
              data: `0x70a08231000000000000000000000000${address.slice(2)}`,
            }, 'latest'],
          }) as string
          setBalance(BigInt(balanceResult || '0'))
        } else {
          // Native balance
          const balanceHex = await provider.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }) as string
          setBalance(BigInt(balanceHex || '0'))

          const networkSymbol = getNativeCurrencySymbol(currentChainId)
          setSymbol(networkSymbol)
          setDecimals(18)
        }
      }
    } catch (error) {
      console.error('[useBalance] Error fetching balance:', error)
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [address, token, connector])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Watch for changes
  useEffect(() => {
    if (!watch || !address) return

    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [watch, address, fetchBalance])

  // Listen for chain changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const provider = (window as { ethereum?: { on?: Function; removeListener?: Function } }).ethereum
    if (!provider?.on) return

    const handleChainChanged = () => {
      fetchBalance()
    }

    provider.on('chainChanged', handleChainChanged)
    return () => {
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [fetchBalance])

  const formatted = formatUnits(balance, decimals)

  return {
    balance,
    symbol,
    decimals,
    formatted,
    chainId,
    isLoading,
    isError,
    refetch: fetchBalance,
  }
}

