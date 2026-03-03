'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useStableNetContext } from '@/providers'
import {
  getPaymasterStubData as sdkGetPaymasterStubData,
  getPaymasterData as sdkGetPaymasterData,
} from '@stablenet/wallet-sdk'

// ============================================================================
// Types
// ============================================================================

export type PaymasterType = 'none' | 'verifying' | 'sponsor' | 'erc20' | 'permit2'

export interface PaymasterConfig {
  type: PaymasterType
  address: Address
  /** For ERC20/Permit2 paymaster */
  tokenAddress?: Address
  /** For sponsor paymaster */
  policyId?: string
}

export interface PaymasterStubData {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

export interface PaymasterData {
  paymaster: Address
  paymasterData: Hex
}

export interface SponsorshipPolicy {
  id: string
  name: string
  maxGasPerOp: bigint
  maxOpsPerDay: number
  allowedTargets: Address[]
  active: boolean
}

export interface SupportedToken {
  address: Address
  symbol: string
  decimals: number
  exchangeRate?: string
}

export interface PaymasterBalance {
  balance: bigint
  deposited: bigint
  staked: bigint
}

export interface UsePaymasterConfig {
  defaultType?: PaymasterType
  tokenAddress?: Address
  policyId?: string
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePaymaster(config: UsePaymasterConfig = {}) {
  const { paymasterUrl, paymaster: defaultPaymasterAddress, chainId } = useStableNetContext()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedType, setSelectedType] = useState<PaymasterType>(config.defaultType ?? 'verifying')
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address | undefined>(config.tokenAddress)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | undefined>(config.policyId)

  // Current paymaster config
  const paymasterConfig = useMemo<PaymasterConfig>(
    () => ({
      type: selectedType,
      address: defaultPaymasterAddress,
      tokenAddress: selectedTokenAddress,
      policyId: selectedPolicyId,
    }),
    [selectedType, defaultPaymasterAddress, selectedTokenAddress, selectedPolicyId]
  )

  /**
   * Get paymaster stub data (for gas estimation)
   * Delegates to wallet-sdk's ERC-7677 implementation.
   */
  const getPaymasterStubData = useCallback(
    async (
      userOp: Record<string, unknown>,
      entryPoint: Address
    ): Promise<PaymasterStubData | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await sdkGetPaymasterStubData(
          paymasterUrl,
          userOp as unknown as Parameters<typeof sdkGetPaymasterStubData>[1],
          entryPoint,
          `0x${chainId.toString(16)}` as Hex
        )

        return {
          paymaster: result.paymaster,
          paymasterData: result.paymasterData,
          paymasterVerificationGasLimit: result.paymasterVerificationGasLimit,
          paymasterPostOpGasLimit: result.paymasterPostOpGasLimit,
        }
      } catch (err) {
        const paymasterError =
          err instanceof Error ? err : new Error('Failed to get paymaster stub data')
        setError(paymasterError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, chainId]
  )

  /**
   * Get final paymaster data (after gas estimation)
   * Delegates to wallet-sdk's ERC-7677 implementation.
   */
  const getPaymasterData = useCallback(
    async (userOp: Record<string, unknown>, entryPoint: Address): Promise<PaymasterData | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await sdkGetPaymasterData(
          paymasterUrl,
          userOp as unknown as Parameters<typeof sdkGetPaymasterData>[1],
          entryPoint,
          `0x${chainId.toString(16)}` as Hex
        )

        return {
          paymaster: result.paymaster,
          paymasterData: result.paymasterData,
        }
      } catch (err) {
        const paymasterError =
          err instanceof Error ? err : new Error('Failed to get paymaster data')
        setError(paymasterError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, chainId]
  )

  /**
   * Check if sender is eligible for sponsorship
   */
  const checkSponsorshipEligibility = useCallback(
    async (sender: Address): Promise<{ eligible: boolean; reason?: string } | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_checkEligibility',
            params: [
              {
                sender,
                policyId: config.policyId,
                chainId: `0x${chainId.toString(16)}`,
              },
            ],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message)
        }

        return {
          eligible: result.result.eligible,
          reason: result.result.reason,
        }
      } catch (err) {
        const paymasterError = err instanceof Error ? err : new Error('Failed to check eligibility')
        setError(paymasterError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, chainId, config.policyId]
  )

  /**
   * Get available sponsorship policies
   */
  const getSponsorshipPolicies = useCallback(async (): Promise<SponsorshipPolicy[] | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_getSponsorshipPolicies',
          params: [`0x${chainId.toString(16)}`],
        }),
      })

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message)
      }

      return result.result.policies.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        maxGasPerOp: BigInt(p.maxGasPerOp as string),
        maxOpsPerDay: Number(p.maxOpsPerDay),
        allowedTargets: p.allowedTargets as Address[],
        active: p.active as boolean,
      }))
    } catch (err) {
      const paymasterError = err instanceof Error ? err : new Error('Failed to get policies')
      setError(paymasterError)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [paymasterUrl, chainId])

  /**
   * Get paymaster balance info
   */
  const getPaymasterBalance = useCallback(
    async (paymasterAddress?: Address): Promise<PaymasterBalance | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const targetPaymaster = paymasterAddress ?? defaultPaymasterAddress

        const response = await fetch(paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_getBalance',
            params: [targetPaymaster, `0x${chainId.toString(16)}`],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message)
        }

        return {
          balance: BigInt(result.result.balance),
          deposited: BigInt(result.result.deposited),
          staked: BigInt(result.result.staked),
        }
      } catch (err) {
        const paymasterError =
          err instanceof Error ? err : new Error('Failed to get paymaster balance')
        setError(paymasterError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [paymasterUrl, chainId, defaultPaymasterAddress]
  )

  /**
   * Get supported ERC20 tokens for token paymaster
   */
  const getSupportedTokens = useCallback(async (): Promise<SupportedToken[] | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_getSupportedTokens',
          params: [`0x${chainId.toString(16)}`],
        }),
      })

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message)
      }

      return result.result.tokens.map((t: Record<string, unknown>) => ({
        address: t.address as Address,
        symbol: (t.symbol as string) ?? 'Unknown',
        decimals: Number(t.decimals ?? 18),
        exchangeRate: t.exchangeRate as string | undefined,
      }))
    } catch (err) {
      const paymasterError =
        err instanceof Error ? err : new Error('Failed to get supported tokens')
      setError(paymasterError)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [paymasterUrl, chainId])

  return {
    // Config
    paymasterConfig,
    paymasterAddress: defaultPaymasterAddress,
    selectedType,
    setSelectedType,

    // Token & policy selection
    selectedTokenAddress,
    setSelectedTokenAddress,
    selectedPolicyId,
    setSelectedPolicyId,

    // Core functions
    getPaymasterStubData,
    getPaymasterData,

    // Sponsorship
    checkSponsorshipEligibility,
    getSponsorshipPolicies,

    // Balance & tokens
    getPaymasterBalance,
    getSupportedTokens,

    // State
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
