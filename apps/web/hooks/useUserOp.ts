'use client'

import { useStableNetContext } from '@/providers'
import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, parseEther, toHex } from 'viem'

interface SendUserOpParams {
  to: Address
  value?: bigint
  data?: Hex
}

interface UserOpResult {
  userOpHash: Hex
  transactionHash?: Hex
  success: boolean
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

// Execute ABI for simple account
const EXECUTE_ABI = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'dest', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'func', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

// Default gas values (fallback if estimation not provided)
const DEFAULT_GAS = {
  callGasLimit: BigInt(100000),
  verificationGasLimit: BigInt(150000),
  preVerificationGas: BigInt(50000),
}

const DEFAULT_GAS_PRICE = {
  maxFeePerGas: BigInt(1000000000), // 1 gwei
  maxPriorityFeePerGas: BigInt(1000000000), // 1 gwei
}

export function useUserOp(config: UseUserOpConfig = {}) {
  const { bundlerUrl, entryPoint, chainId } = useStableNetContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { getNonce, estimateGas, getGasPrice, signUserOp } = config

  /**
   * Build execute calldata for account
   */
  const buildExecuteCalldata = useCallback((to: Address, value: bigint, data: Hex): Hex => {
    return encodeFunctionData({
      abi: EXECUTE_ABI,
      functionName: 'execute',
      args: [to, value, data],
    })
  }, [])

  /**
   * Send UserOperation to bundler
   */
  const sendUserOp = useCallback(
    async (sender: Address, params: SendUserOpParams): Promise<UserOpResult | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Fetch nonce from chain
        let nonce = BigInt(0)
        if (getNonce) {
          nonce = await getNonce(sender)
        }

        // 2. Build calldata
        const callData = buildExecuteCalldata(
          params.to,
          params.value ?? BigInt(0),
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

        // 5. Build UserOperation
        const userOp = {
          sender,
          nonce: toHex(nonce),
          initCode: '0x' as Hex,
          callData,
          callGasLimit: toHex(gasLimits.callGasLimit),
          verificationGasLimit: toHex(gasLimits.verificationGasLimit),
          preVerificationGas: toHex(gasLimits.preVerificationGas),
          maxFeePerGas: toHex(gasPrices.maxFeePerGas),
          maxPriorityFeePerGas: toHex(gasPrices.maxPriorityFeePerGas),
          paymasterAndData: '0x' as Hex,
          signature: '0x' as Hex,
        }

        // 6. Sign UserOperation
        if (signUserOp) {
          userOp.signature = await signUserOp(userOp, entryPoint, chainId)
        }

        // 7. Send to bundler
        const response = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendUserOperation',
            params: [userOp, entryPoint],
          }),
        })

        const result = await response.json()

        if (result.error) {
          throw new Error(result.error.message)
        }

        return {
          userOpHash: result.result,
          success: true,
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
      getNonce,
      estimateGas,
      getGasPrice,
      signUserOp,
      buildExecuteCalldata,
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

  return {
    sendUserOp,
    sendTransaction,
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
