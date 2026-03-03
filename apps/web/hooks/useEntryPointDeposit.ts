'use client'

import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { formatEther } from 'viem'
import { useChainId } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { wagmiConfig } from '@/lib/wagmi'
import { getSmartAccountAddresses } from './useSmartAccount'

// ============================================================================
// EntryPoint ABI (balanceOf only)
// ============================================================================

const ENTRY_POINT_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// ============================================================================
// Hook
// ============================================================================

export interface EntryPointDepositState {
  deposit: bigint | null
  formattedDeposit: string | null
  isLoading: boolean
  error: Error | null
  fetchDeposit: () => Promise<void>
}

/**
 * Query sender's deposit balance at EntryPoint.
 * Used for self-pay gas mode where the sender prefunds their own gas.
 */
export function useEntryPointDeposit(sender: Address | undefined): EntryPointDepositState {
  const chainId = useChainId()
  const [deposit, setDeposit] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchDeposit = useCallback(async () => {
    if (!sender) return

    setIsLoading(true)
    setError(null)

    try {
      const { entryPoint } = getSmartAccountAddresses(chainId)
      const publicClient = getPublicClient(wagmiConfig, { chainId })

      if (!publicClient) {
        throw new Error('Public client not available')
      }

      const balance = await publicClient.readContract({
        address: entryPoint,
        abi: ENTRY_POINT_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [sender],
      })

      setDeposit(balance)
    } catch (err) {
      setDeposit(null)
      setError(err instanceof Error ? err : new Error('Failed to fetch EntryPoint deposit'))
    } finally {
      setIsLoading(false)
    }
  }, [sender, chainId])

  const formattedDeposit = deposit !== null ? formatEther(deposit) : null

  return {
    deposit,
    formattedDeposit,
    isLoading,
    error,
    fetchDeposit,
  }
}
