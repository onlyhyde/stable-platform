'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { maxUint256 } from 'viem'
import { useChainId } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { wagmiConfig } from '@/lib/wagmi'
import { useUserOp } from './useUserOp'

// ============================================================================
// Types
// ============================================================================

export type ApprovalStatus = 'unknown' | 'checking' | 'needs-approval' | 'approving' | 'approved'

export interface TokenApprovalState {
  status: ApprovalStatus
  currentAllowance: bigint | null
  error: Error | null
  checkAllowance: (tokenAddress: Address, owner: Address, spender: Address) => Promise<void>
  approve: (
    tokenAddress: Address,
    owner: Address,
    spender: Address,
    amount?: bigint
  ) => Promise<boolean>
  reset: () => void
}

// ============================================================================
// ABI
// ============================================================================

const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

// ============================================================================
// Hook
// ============================================================================

/**
 * Manage ERC-20 token approval for paymaster gas payments.
 *
 * Flow: checkAllowance → (needs-approval → approve) → approved → ready to send
 */
export function useTokenApproval(): TokenApprovalState {
  const chainId = useChainId()
  const { sendUserOp } = useUserOp()
  const [status, setStatus] = useState<ApprovalStatus>('unknown')
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const checkAllowance = useCallback(
    async (tokenAddress: Address, owner: Address, spender: Address) => {
      setStatus('checking')
      setError(null)

      try {
        const publicClient = getPublicClient(wagmiConfig, { chainId })
        if (!publicClient) {
          throw new Error('Public client not available')
        }

        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [owner, spender],
        })

        setCurrentAllowance(allowance)
        // Consider "approved" if allowance > 0 (any amount approved to paymaster)
        // In practice, paymaster will pull the exact amount needed in postOp
        setStatus(allowance > 0n ? 'approved' : 'needs-approval')
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to check allowance'))
        setStatus('unknown')
      }
    },
    [chainId]
  )

  const approve = useCallback(
    async (
      tokenAddress: Address,
      owner: Address,
      spender: Address,
      amount?: bigint
    ): Promise<boolean> => {
      setStatus('approving')
      setError(null)

      try {
        // Encode approve(spender, amount) calldata
        // Default to max approval to avoid repeated approve txns
        const approveAmount = amount ?? maxUint256
        const { encodeFunctionData } = await import('viem')
        const calldata = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spender, approveAmount],
        })

        const result = await sendUserOp(owner, {
          to: tokenAddress,
          data: calldata as Hex,
        })

        if (result?.success) {
          setStatus('approved')
          setCurrentAllowance(approveAmount)
          return true
        }

        setStatus('needs-approval')
        return false
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Approval failed'))
        setStatus('needs-approval')
        return false
      }
    },
    [sendUserOp]
  )

  const reset = useCallback(() => {
    setStatus('unknown')
    setCurrentAllowance(null)
    setError(null)
  }, [])

  return {
    status,
    currentAllowance,
    error,
    checkAllowance,
    approve,
    reset,
  }
}
