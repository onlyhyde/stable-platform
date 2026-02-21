'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { concat, encodeFunctionData, pad, parseEther, toHex } from 'viem'
import { useWalletClient } from 'wagmi'
import { useStableNetContext } from '@/providers'
import {
  getUserOperationHash,
  packUserOperation,
  signUserOpForKernel,
} from '@stablenet/core'
import type { UserOperation } from '@stablenet/core'

interface SendUserOpParams {
  to: Address
  value?: bigint
  data?: Hex
}

type UserOpStatus = 'submitted' | 'confirmed' | 'failed'

interface UserOpResult {
  userOpHash: Hex
  transactionHash?: Hex
  success: boolean
  status: UserOpStatus
}

interface GasEstimate {
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
}

interface GasPrice {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

interface UseUserOpConfig {
  getNonce?: (sender: Address) => Promise<bigint>
  estimateGas?: (userOp: unknown) => Promise<GasEstimate>
  getGasPrice?: () => Promise<GasPrice>
  signUserOp?: (userOp: unknown, entryPoint: Address, chainId: number) => Promise<Hex>
}

// ============================================================================
// Kernel v3 Execute ABI (ERC-7579)
// ============================================================================

const KERNEL_EXECUTE_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'mode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

/** Single call mode: callType=0x00, execMode=0x00 */
const SINGLE_EXEC_MODE = `0x${'00'.repeat(32)}` as Hex

// ============================================================================
// Pending UserOp localStorage
// ============================================================================

const PENDING_OPS_KEY = 'stablenet:pending-user-ops'

export interface PendingUserOp {
  userOpHash: Hex
  timestamp: number
  to?: string
}

function loadPendingOps(): PendingUserOp[] {
  try {
    const stored = localStorage.getItem(PENDING_OPS_KEY)
    if (!stored) return []
    const ops = JSON.parse(stored) as PendingUserOp[]
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return ops.filter((op) => op.timestamp > cutoff)
  } catch {
    return []
  }
}

function savePendingOp(op: PendingUserOp): void {
  try {
    const ops = loadPendingOps()
    ops.push(op)
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops))
  } catch {
    // Ignore storage errors
  }
}

function removePendingOp(userOpHash: Hex): void {
  try {
    const ops = loadPendingOps().filter((op) => op.userOpHash !== userOpHash)
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops))
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Default gas values (fallback if estimation not provided)
// ============================================================================

const DEFAULT_GAS = {
  callGasLimit: 200000n,
  verificationGasLimit: 200000n,
  preVerificationGas: 100000n,
}

const DEFAULT_GAS_PRICE = {
  maxFeePerGas: 1000000000n, // 1 gwei
  maxPriorityFeePerGas: 1000000000n, // 1 gwei
}

// ============================================================================
// Hook
// ============================================================================

export function useUserOp(config: UseUserOpConfig = {}) {
  const { bundlerUrl, entryPoint, chainId } = useStableNetContext()
  const { data: walletClient } = useWalletClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { getNonce, estimateGas, getGasPrice, signUserOp } = config

  /**
   * Poll bundler for UserOp receipt until confirmed or timeout.
   * Returns null if polling times out (tx may still be pending).
   */
  const waitForUserOpReceipt = useCallback(
    async (
      userOpHash: Hex,
      maxAttempts = 15,
      intervalMs = 2000
    ): Promise<{ transactionHash: Hex; success: boolean } | null> => {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const res = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getUserOperationReceipt',
              params: [userOpHash],
            }),
          })
          const json = await res.json()
          if (json.result) {
            return {
              transactionHash: json.result.receipt?.transactionHash ?? json.result.transactionHash,
              success: json.result.success ?? json.result.receipt?.status === '0x1',
            }
          }
        } catch {
          // Bundler may not support this method or is temporarily unreachable
        }
        await new Promise((r) => setTimeout(r, intervalMs))
      }
      return null
    },
    [bundlerUrl]
  )

  /**
   * Build Kernel v3 execute calldata for a single call.
   * Uses execute(bytes32 mode, bytes executionCalldata) with mode=0x00...00 (single call).
   *
   * executionCalldata uses ERC-7579 packed encoding (NOT abi.encode):
   *   abi.encodePacked(address target, uint256 value, bytes callData)
   *   = 20 bytes (address) + 32 bytes (uint256) + raw bytes
   */
  const buildExecuteCalldata = useCallback((to: Address, value: bigint, data: Hex): Hex => {
    const executionCalldata = concat([
      to,                              // 20 bytes: address (packed, no padding)
      pad(toHex(value), { size: 32 }), // 32 bytes: uint256
      data,                            // variable: raw calldata bytes
    ]) as Hex
    return encodeFunctionData({
      abi: KERNEL_EXECUTE_ABI,
      functionName: 'execute',
      args: [SINGLE_EXEC_MODE, executionCalldata],
    })
  }, [])

  /**
   * Send UserOperation to bundler using packed v0.7 RPC format.
   */
  const sendUserOp = useCallback(
    async (sender: Address, params: SendUserOpParams): Promise<UserOpResult | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Fetch nonce from chain
        let nonce = 0n
        if (getNonce) {
          nonce = await getNonce(sender)
        }

        // 2. Build Kernel execute calldata
        const callData = buildExecuteCalldata(
          params.to,
          params.value ?? 0n,
          params.data ?? '0x'
        )

        // 3. Estimate gas
        let gasLimits = DEFAULT_GAS
        if (estimateGas) {
          gasLimits = await estimateGas({
            sender,
            nonce: toHex(nonce),
            callData,
          })
        }

        // 4. Get gas price
        let gasPrices = DEFAULT_GAS_PRICE
        if (getGasPrice) {
          gasPrices = await getGasPrice()
        }

        // 5. Build UserOperation and pack using SDK
        const userOp: UserOperation = {
          sender,
          nonce,
          callData,
          callGasLimit: gasLimits.callGasLimit,
          verificationGasLimit: gasLimits.verificationGasLimit,
          preVerificationGas: gasLimits.preVerificationGas,
          maxFeePerGas: gasPrices.maxFeePerGas,
          maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
          signature: '0x' as Hex,
        }

        const packed = packUserOperation(userOp)

        // 6. Compute EIP-712 hash and sign
        if (signUserOp) {
          packed.signature = await signUserOp(packed, entryPoint, chainId)
        } else if (walletClient) {
          const opHash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
          const rawSignature = await walletClient.signMessage({
            message: { raw: opHash },
          })
          packed.signature = signUserOpForKernel(rawSignature)
        } else {
          throw new Error(
            'No wallet connected. Please connect your wallet to sign transactions.'
          )
        }

        // 7. Send packed UserOp to bundler
        const response = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendUserOperation',
            params: [packed, entryPoint],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message)
        }

        const userOpHash: Hex = result.result

        // 8. Poll for UserOp receipt to confirm on-chain inclusion
        const receipt = await waitForUserOpReceipt(userOpHash)

        // If polling timed out, save to pending ops for later recheck
        if (!receipt) {
          savePendingOp({
            userOpHash,
            timestamp: Date.now(),
            to: params.to,
          })
        }

        return {
          userOpHash,
          transactionHash: receipt?.transactionHash,
          success: receipt ? receipt.success : true,
          status: receipt ? (receipt.success ? 'confirmed' : 'failed') : 'submitted',
        }
      } catch (err) {
        const opError = err instanceof Error ? err : new Error('Failed to send UserOperation')
        setError(opError)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [
      bundlerUrl,
      entryPoint,
      chainId,
      walletClient,
      getNonce,
      estimateGas,
      getGasPrice,
      signUserOp,
      buildExecuteCalldata,
      waitForUserOpReceipt,
    ]
  )

  /**
   * Simple ETH transfer helper
   */
  const sendTransaction = useCallback(
    async (sender: Address, to: Address, value: string): Promise<UserOpResult | null> => {
      return sendUserOp(sender, {
        to,
        value: parseEther(value),
        data: '0x',
      })
    },
    [sendUserOp]
  )

  /**
   * Re-check a previously submitted UserOp that timed out.
   */
  const recheckUserOp = useCallback(
    async (userOpHash: Hex): Promise<UserOpResult> => {
      const receipt = await waitForUserOpReceipt(userOpHash, 10, 3000)
      if (receipt) {
        removePendingOp(userOpHash)
      }
      return {
        userOpHash,
        transactionHash: receipt?.transactionHash,
        success: receipt ? receipt.success : false,
        status: receipt ? (receipt.success ? 'confirmed' : 'failed') : 'submitted',
      }
    },
    [waitForUserOpReceipt]
  )

  return {
    sendUserOp,
    sendTransaction,
    recheckUserOp,
    getPendingUserOps: loadPendingOps,
    removePendingUserOp: removePendingOp,
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
