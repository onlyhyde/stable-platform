'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi'
import type { Address, Hex, Hash } from 'viem'

// Contract address - should come from @stablenet/contracts
const RECURRING_PAYMENT_MANAGER = '0x5678901234567890123456789012345678901234' as const

// Payment schedule status
export type PaymentScheduleStatus = 'active' | 'paused' | 'cancelled' | 'completed'

// Token info for payments
export interface PaymentToken {
  /** Token contract address */
  address: Address
  /** Token symbol */
  symbol: string
  /** Token decimals */
  decimals: number
}

// Payment schedule info
export interface PaymentScheduleInfo {
  /** Schedule ID */
  scheduleId: bigint
  /** Payer address */
  payer: Address
  /** Recipient address */
  recipient: Address
  /** Payment amount per interval */
  amount: bigint
  /** Payment token */
  token: PaymentToken
  /** Interval in seconds */
  interval: bigint
  /** Next payment timestamp */
  nextPaymentTime: bigint
  /** Total payments made */
  paymentsMade: bigint
  /** Max payments (0 = unlimited) */
  maxPayments: bigint
  /** Current status */
  status: PaymentScheduleStatus
  /** Creation timestamp */
  createdAt: bigint
}

// Parameters for creating a payment schedule
export interface CreateScheduleParams {
  /** Recipient address */
  recipient: Address
  /** Payment amount */
  amount: bigint
  /** Token address (address(0) for native) */
  token: Address
  /** Interval in seconds */
  interval: bigint
  /** Max payments (0 = unlimited) */
  maxPayments?: bigint
  /** Start timestamp (0 = now) */
  startTime?: bigint
}

// ABI fragments for RecurringPaymentManager
const RECURRING_PAYMENT_MANAGER_ABI = [
  {
    name: 'createSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'interval', type: 'uint256' },
      { name: 'maxPayments', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
    ],
    outputs: [{ name: 'scheduleId', type: 'uint256' }],
  },
  {
    name: 'cancelSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'pauseSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'resumeSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'updateAmount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'scheduleId', type: 'uint256' },
      { name: 'newAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getSchedule',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'interval', type: 'uint256' },
      { name: 'nextPaymentTime', type: 'uint256' },
      { name: 'paymentsMade', type: 'uint256' },
      { name: 'maxPayments', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'getSchedulesByPayer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'payer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'isPaymentDue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getNextPaymentTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'scheduleId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ERC20 ABI for token info
const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

// Convert status number to enum
function parseStatus(status: number): PaymentScheduleStatus {
  switch (status) {
    case 0:
      return 'active'
    case 1:
      return 'paused'
    case 2:
      return 'cancelled'
    case 3:
      return 'completed'
    default:
      return 'active'
  }
}

export interface UseRecurringPaymentReturn {
  // State
  schedules: PaymentScheduleInfo[]
  isLoading: boolean
  error: string | null

  // Loading states for individual operations
  isCreating: boolean
  isCancelling: boolean
  isUpdating: boolean

  // Operations
  createSchedule: (params: CreateScheduleParams) => Promise<{
    scheduleId: bigint
    txHash: Hash
  } | null>
  cancelSchedule: (scheduleId: bigint) => Promise<{ txHash: Hash } | null>
  pauseSchedule: (scheduleId: bigint) => Promise<{ txHash: Hash } | null>
  resumeSchedule: (scheduleId: bigint) => Promise<{ txHash: Hash } | null>
  updateAmount: (scheduleId: bigint, newAmount: bigint) => Promise<{ txHash: Hash } | null>

  // Queries
  getSchedule: (scheduleId: bigint) => Promise<PaymentScheduleInfo | null>
  isPaymentDue: (scheduleId: bigint) => Promise<boolean>
  getNextPaymentTime: (scheduleId: bigint) => Promise<bigint | null>

  // Helpers
  refresh: () => Promise<void>
  clearError: () => void
}

/**
 * Hook for managing recurring payment schedules
 * Allows creating, cancelling, and managing payment schedules
 */
export function useRecurringPayment(account?: Address): UseRecurringPaymentReturn {
  const { address: connectedAddress, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Use provided account or connected address
  const targetAccount = account || connectedAddress

  // State
  const [schedules, setSchedules] = useState<PaymentScheduleInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Loading states for operations
  const [isCreating, setIsCreating] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Clear error helper
  const clearError = useCallback(() => setError(null), [])

  // Fetch token info
  const getTokenInfo = useCallback(
    async (tokenAddress: Address): Promise<PaymentToken> => {
      // Native token
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return {
          address: tokenAddress,
          symbol: 'ETH',
          decimals: 18,
        }
      }

      if (!publicClient) {
        return {
          address: tokenAddress,
          symbol: 'UNKNOWN',
          decimals: 18,
        }
      }

      try {
        const [symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }),
        ])

        return {
          address: tokenAddress,
          symbol: symbol as string,
          decimals: decimals as number,
        }
      } catch (err) {
        console.error('Failed to get token info:', err)
        return {
          address: tokenAddress,
          symbol: 'UNKNOWN',
          decimals: 18,
        }
      }
    },
    [publicClient]
  )

  // Fetch schedule info from contract
  const getSchedule = useCallback(
    async (scheduleId: bigint): Promise<PaymentScheduleInfo | null> => {
      if (!publicClient) return null

      try {
        const result = await publicClient.readContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'getSchedule',
          args: [scheduleId],
        })

        const [
          payer,
          recipient,
          amount,
          token,
          interval,
          nextPaymentTime,
          paymentsMade,
          maxPayments,
          status,
          createdAt,
        ] = result as [Address, Address, bigint, Address, bigint, bigint, bigint, bigint, number, bigint]

        const tokenInfo = await getTokenInfo(token)

        return {
          scheduleId,
          payer,
          recipient,
          amount,
          token: tokenInfo,
          interval,
          nextPaymentTime,
          paymentsMade,
          maxPayments,
          status: parseStatus(status),
          createdAt,
        }
      } catch (err) {
        console.error('Failed to get schedule:', err)
        return null
      }
    },
    [publicClient, getTokenInfo]
  )

  // Check if payment is due
  const isPaymentDue = useCallback(
    async (scheduleId: bigint): Promise<boolean> => {
      if (!publicClient) return false

      try {
        const result = await publicClient.readContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'isPaymentDue',
          args: [scheduleId],
        })

        return result as boolean
      } catch (err) {
        console.error('Failed to check if payment is due:', err)
        return false
      }
    },
    [publicClient]
  )

  // Get next payment time
  const getNextPaymentTime = useCallback(
    async (scheduleId: bigint): Promise<bigint | null> => {
      if (!publicClient) return null

      try {
        const result = await publicClient.readContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'getNextPaymentTime',
          args: [scheduleId],
        })

        return result as bigint
      } catch (err) {
        console.error('Failed to get next payment time:', err)
        return null
      }
    },
    [publicClient]
  )

  // Refresh all schedules for the account
  const refresh = useCallback(async () => {
    if (!targetAccount || !publicClient) {
      setSchedules([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get all schedule IDs for the payer
      const result = await publicClient.readContract({
        address: RECURRING_PAYMENT_MANAGER,
        abi: RECURRING_PAYMENT_MANAGER_ABI,
        functionName: 'getSchedulesByPayer',
        args: [targetAccount],
      })

      const scheduleIds = result as bigint[]

      // Fetch details for each schedule
      const scheduleInfos: PaymentScheduleInfo[] = []
      for (const scheduleId of scheduleIds) {
        const info = await getSchedule(scheduleId)
        if (info) {
          scheduleInfos.push(info)
        }
      }

      setSchedules(scheduleInfos)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch schedules'
      setError(message)
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }, [targetAccount, publicClient, getSchedule])

  // Load schedules on mount and when account changes
  useEffect(() => {
    if (isConnected && targetAccount) {
      refresh()
    } else {
      setSchedules([])
    }
  }, [isConnected, targetAccount, refresh])

  // Create a new payment schedule
  const createSchedule = useCallback(
    async (
      params: CreateScheduleParams
    ): Promise<{ scheduleId: bigint; txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsCreating(true)
      setError(null)

      try {
        const maxPayments = params.maxPayments ?? BigInt(0)
        const startTime = params.startTime ?? BigInt(0)

        const txHash = await walletClient.writeContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'createSchedule',
          args: [
            params.recipient,
            params.amount,
            params.token,
            params.interval,
            maxPayments,
            startTime,
          ],
        })

        // For now, return a placeholder scheduleId
        // In production, we'd wait for the transaction and get the actual ID from events
        const scheduleId = BigInt(Date.now())

        // Refresh schedules
        await refresh()

        return { scheduleId, txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create schedule'
        setError(message)
        return null
      } finally {
        setIsCreating(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Cancel a payment schedule
  const cancelSchedule = useCallback(
    async (scheduleId: bigint): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsCancelling(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'cancelSchedule',
          args: [scheduleId],
        })

        // Refresh schedules
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel schedule'
        setError(message)
        return null
      } finally {
        setIsCancelling(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Pause a payment schedule
  const pauseSchedule = useCallback(
    async (scheduleId: bigint): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsUpdating(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'pauseSchedule',
          args: [scheduleId],
        })

        // Refresh schedules
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to pause schedule'
        setError(message)
        return null
      } finally {
        setIsUpdating(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Resume a payment schedule
  const resumeSchedule = useCallback(
    async (scheduleId: bigint): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsUpdating(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'resumeSchedule',
          args: [scheduleId],
        })

        // Refresh schedules
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resume schedule'
        setError(message)
        return null
      } finally {
        setIsUpdating(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Update payment amount
  const updateAmount = useCallback(
    async (scheduleId: bigint, newAmount: bigint): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsUpdating(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: RECURRING_PAYMENT_MANAGER,
          abi: RECURRING_PAYMENT_MANAGER_ABI,
          functionName: 'updateAmount',
          args: [scheduleId, newAmount],
        })

        // Refresh schedules
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update amount'
        setError(message)
        return null
      } finally {
        setIsUpdating(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  return {
    // State
    schedules,
    isLoading,
    error,

    // Loading states
    isCreating,
    isCancelling,
    isUpdating,

    // Operations
    createSchedule,
    cancelSchedule,
    pauseSchedule,
    resumeSchedule,
    updateAmount,

    // Queries
    getSchedule,
    isPaymentDue,
    getNextPaymentTime,

    // Helpers
    refresh,
    clearError,
  }
}
