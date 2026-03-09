'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useStableNetContext } from '@/providers'
import { useSmartAccount } from './useSmartAccount'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas payment modes for Smart Account transactions.
 *
 * - self-pay: Sender pays gas in native coin via EntryPoint deposit (or EOA direct)
 * - erc20-paymaster: Paymaster pays gas, recovers cost from sender's ERC-20 tokens in postOp
 * - sponsored: Third-party sponsor covers gas via Paymaster (zero cost to sender)
 */
export type GasPaymentMode = 'self-pay' | 'erc20-paymaster' | 'sponsored'

export interface TokenCostEstimate {
  tokenAddress: Address
  estimatedAmount: string
  exchangeRate: string
  tokenSymbol: string
  tokenDecimals: number
  formattedAmount: string
}

export interface GasPaymentModeState {
  selectedMode: GasPaymentMode
  availableModes: GasPaymentMode[]
  setMode: (mode: GasPaymentMode) => void
  modeDescriptions: Record<GasPaymentMode, string>
  isSmartAccount: boolean
  // Token cost estimation (F-05)
  selectedTokenAddress: Address | null
  setTokenAddress: (address: Address | null) => void
  estimatedTokenCost: TokenCostEstimate | null
  isEstimatingTokenCost: boolean
  tokenCostError: Error | null
}

// ============================================================================
// Constants
// ============================================================================

const MODE_DESCRIPTIONS: Record<GasPaymentMode, string> = {
  'self-pay': 'Pay gas with native coin (from EntryPoint deposit or EOA balance)',
  'erc20-paymaster': 'Pay gas with ERC-20 tokens via Paymaster',
  sponsored: 'Gas sponsored by a third party (zero cost)',
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manage gas payment mode selection and token cost estimation.
 *
 * - Smart Account: all 3 modes available (self-pay, erc20-paymaster, sponsored)
 * - EOA: only self-pay (native coin direct, no bundler/paymaster)
 *
 * When erc20-paymaster mode is selected with a token, automatically estimates
 * the gas cost in that token via pm_estimateTokenPayment RPC.
 */
export function useGasPaymentMode(sender?: Address): GasPaymentModeState {
  const { status } = useSmartAccount()
  const { paymasterUrl, entryPoint, chainId } = useStableNetContext()
  const [selectedMode, setSelectedMode] = useState<GasPaymentMode>('sponsored')
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address | null>(null)
  const [estimatedTokenCost, setEstimatedTokenCost] = useState<TokenCostEstimate | null>(null)
  const [isEstimatingTokenCost, setIsEstimatingTokenCost] = useState(false)
  const [tokenCostError, setTokenCostError] = useState<Error | null>(null)

  const availableModes = useMemo<GasPaymentMode[]>(() => {
    if (status.isSmartAccount) {
      return ['self-pay', 'erc20-paymaster', 'sponsored']
    }
    // EOA: can only pay gas directly
    return ['self-pay']
  }, [status.isSmartAccount])

  const setMode = useCallback(
    (mode: GasPaymentMode) => {
      if (availableModes.includes(mode)) {
        setSelectedMode(mode)
        // Clear token state when leaving erc20 mode
        if (mode !== 'erc20-paymaster') {
          setSelectedTokenAddress(null)
          setEstimatedTokenCost(null)
          setTokenCostError(null)
        }
      }
    },
    [availableModes]
  )

  const setTokenAddress = useCallback((address: Address | null) => {
    setSelectedTokenAddress(address)
    setEstimatedTokenCost(null)
    setTokenCostError(null)
  }, [])

  // Auto-estimate token cost when erc20 mode + token selected
  useEffect(() => {
    if (selectedMode !== 'erc20-paymaster' || !selectedTokenAddress || !sender) {
      return
    }

    let cancelled = false
    setIsEstimatingTokenCost(true)
    setTokenCostError(null)

    async function estimate() {
      try {
        const response = await fetch(paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_estimateTokenPayment',
            params: [
              { sender },
              entryPoint,
              `0x${chainId.toString(16)}`,
              selectedTokenAddress,
            ],
          }),
        })

        const result = await response.json()

        if (cancelled) return

        if (result.error) {
          throw new Error(result.error.message)
        }

        const data = result.result
        setEstimatedTokenCost({
          tokenAddress: data.tokenAddress,
          estimatedAmount: data.tokenAmount ?? data.estimatedAmount,
          exchangeRate: data.exchangeRate,
          tokenSymbol: data.tokenSymbol ?? '',
          tokenDecimals: data.tokenDecimals ?? 18,
          formattedAmount: formatUnits(
            BigInt(data.tokenAmount ?? data.estimatedAmount ?? '0'),
            data.tokenDecimals ?? 18
          ),
        })
      } catch (err) {
        if (!cancelled) {
          setTokenCostError(err instanceof Error ? err : new Error('Failed to estimate token cost'))
          setEstimatedTokenCost(null)
        }
      } finally {
        if (!cancelled) {
          setIsEstimatingTokenCost(false)
        }
      }
    }

    estimate()
    return () => {
      cancelled = true
    }
  }, [selectedMode, selectedTokenAddress, sender, paymasterUrl, entryPoint, chainId])

  return {
    selectedMode,
    availableModes,
    setMode,
    modeDescriptions: MODE_DESCRIPTIONS,
    isSmartAccount: status.isSmartAccount,
    selectedTokenAddress,
    setTokenAddress,
    estimatedTokenCost,
    isEstimatingTokenCost,
    tokenCostError,
  }
}
