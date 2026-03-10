'use client'

import { detectProvider, type StableNetProvider } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useState } from 'react'
import type { Address, Hex } from 'viem'
import {
  encodeAbiParameters,
  encodeFunctionData,
  isAddress,
  parseAbiParameters,
  parseUnits,
} from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useStableNetContext } from '@/providers'
import { useSmartAccount } from './useSmartAccount'
import type { GasPaymentContext } from './useUserOp'

// ============================================================================
// Constants
// ============================================================================

/** Multicall3 deployed address (same on all EVM chains) */
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

/** Minimal Multicall3 ABI for aggregate3Value */
const MULTICALL3_ABI = [
  {
    name: 'aggregate3Value',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const

/** ERC-7579 batch execution mode */
const EXEC_MODE_BATCH = '0x0100000000000000000000000000000000000000000000000000000000000000' as Hex

/** ERC-7579 execute function ABI (bytes32 mode, bytes executionCalldata) */
const KERNEL_EXECUTE_ABI = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'mode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

/** Minimal ERC-20 transfer ABI */
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/** Estimated gas per native transfer */
const GAS_PER_NATIVE_TX = 21000n
/** Estimated gas per ERC-20 transfer */
const GAS_PER_ERC20_TX = 65000n

// ============================================================================
// Types
// ============================================================================

export interface BatchRecipient {
  id: string
  address: string
  amount: string
}

export interface BatchTransactionResult {
  success: boolean
  txHash?: Hex
  error?: string
}

export interface GasSavingsEstimate {
  individual: bigint
  batch: bigint
  savingsPercent: number
}

export interface UseBatchTransactionReturn {
  recipients: BatchRecipient[]
  addRecipient: () => void
  removeRecipient: (id: string) => void
  updateRecipient: (id: string, field: 'address' | 'amount', value: string) => void
  clearRecipients: () => void
  executeBatch: (params: ExecuteBatchParams) => Promise<BatchTransactionResult>
  estimateGasSavings: (recipientCount: number, isNative: boolean) => GasSavingsEstimate
  isExecuting: boolean
  error: string | null
  clearError: () => void
}

interface ExecuteBatchParams {
  isNative: boolean
  tokenAddress?: Address
  decimals: number
  /** Gas payment context for Smart Account UserOp path */
  gasPayment?: GasPaymentContext
}

// ============================================================================
// Helper
// ============================================================================

let nextId = 0
function createRecipient(): BatchRecipient {
  return { id: `batch-${++nextId}`, address: '', amount: '' }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Batch multiple transfers into a single transaction.
 *
 * - Smart Account: Uses ERC-7579 batch execute via eth_sendUserOperation
 *   through the wallet extension, enabling paymaster gas payment.
 * - EOA: Uses Multicall3 aggregate3Value via regular transaction.
 */
export function useBatchTransaction(): UseBatchTransactionReturn {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { status } = useSmartAccount()
  const { entryPoint } = useStableNetContext()

  const [provider, setProvider] = useState<StableNetProvider | null>(null)
  const [recipients, setRecipients] = useState<BatchRecipient[]>([
    createRecipient(),
    createRecipient(),
  ])
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect wallet-sdk provider on mount (for Smart Account UserOp path)
  useEffect(() => {
    detectProvider({ timeout: 2000 })
      .then((p) => {
        if (p) setProvider(p)
      })
      .catch(() => {
        // Provider not available
      })
  }, [])

  const addRecipient = useCallback(() => {
    setRecipients((prev) => [...prev, createRecipient()])
  }, [])

  const removeRecipient = useCallback((id: string) => {
    setRecipients((prev) => {
      if (prev.length <= 2) return prev
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  const updateRecipient = useCallback((id: string, field: 'address' | 'amount', value: string) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])

  const clearRecipients = useCallback(() => {
    setRecipients([createRecipient(), createRecipient()])
  }, [])

  const executeBatch = useCallback(
    async (params: ExecuteBatchParams): Promise<BatchTransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' }
      }

      const valid = recipients.filter(
        (r) => isAddress(r.address) && r.amount && Number(r.amount) > 0
      )
      if (valid.length < 2) {
        return { success: false, error: 'At least 2 valid recipients required for batch' }
      }

      setIsExecuting(true)
      setError(null)

      try {
        // Build per-recipient calls
        const calls = valid.map((r) => {
          const to = r.address as Address
          if (params.isNative) {
            return { target: to, data: '0x' as Hex, value: parseUnits(r.amount, params.decimals) }
          }
          return {
            target: params.tokenAddress!,
            data: encodeFunctionData({
              abi: ERC20_TRANSFER_ABI,
              functionName: 'transfer',
              args: [to, parseUnits(r.amount, params.decimals)],
            }),
            value: 0n,
          }
        })

        let txHash: Hex

        if (status.isSmartAccount && provider) {
          // Smart Account: ERC-7579 batch execute via eth_sendUserOperation
          // The extension handler accepts pre-encoded callData — it skips
          // encodeKernelExecute() wrapping when callData is already present.
          const executionCalldata = encodeAbiParameters(
            parseAbiParameters('(address target, uint256 value, bytes callData)[]'),
            [calls.map((c) => ({ target: c.target, value: c.value, callData: c.data }))]
          )

          const callData = encodeFunctionData({
            abi: KERNEL_EXECUTE_ABI,
            functionName: 'execute',
            args: [EXEC_MODE_BATCH, executionCalldata],
          })

          // Send through extension's eth_sendUserOperation with pre-encoded callData
          const hash = await provider.request<Hex>({
            method: 'eth_sendUserOperation',
            params: [
              {
                sender: address,
                callData,
                gasPayment: params.gasPayment,
              },
              entryPoint,
            ],
          })

          return { success: true, txHash: hash as Hex }
        }

        if (!walletClient || !publicClient) {
          return { success: false, error: 'Wallet client not available' }
        }

        // EOA: Multicall3 aggregate3Value
        const totalNativeValue = calls.reduce((sum, c) => sum + c.value, 0n)
        const data = encodeFunctionData({
          abi: MULTICALL3_ABI,
          functionName: 'aggregate3Value',
          args: [
            calls.map((c) => ({
              target: c.target,
              allowFailure: false,
              value: c.value,
              callData: c.data,
            })),
          ],
        })

        txHash = await walletClient.sendTransaction({
          to: MULTICALL3_ADDRESS,
          data,
          value: totalNativeValue,
        })

        // Wait for on-chain confirmation
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          return { success: false, txHash, error: 'Batch transaction reverted' }
        }

        return { success: true, txHash }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Batch transaction failed'
        const firstLine = msg.split('\n')[0]
        setError(firstLine)
        return { success: false, error: firstLine }
      } finally {
        setIsExecuting(false)
      }
    },
    [address, walletClient, publicClient, recipients, status.isSmartAccount, provider, entryPoint]
  )

  const estimateGasSavings = useCallback(
    (recipientCount: number, isNative: boolean): GasSavingsEstimate => {
      const perTx = isNative ? GAS_PER_NATIVE_TX : GAS_PER_ERC20_TX
      const individual = perTx * BigInt(recipientCount)
      // Batch: 1 base tx + ~30% of per-call gas as overhead
      const batch = GAS_PER_NATIVE_TX + (perTx * 30n * BigInt(recipientCount)) / 100n
      const pct = individual > 0n ? Number(((individual - batch) * 100n) / individual) : 0
      return { individual, batch, savingsPercent: Math.max(0, pct) }
    },
    []
  )

  return {
    recipients,
    addRecipient,
    removeRecipient,
    updateRecipient,
    clearRecipients,
    executeBatch,
    estimateGasSavings,
    isExecuting,
    error,
    clearError: () => setError(null),
  }
}
