'use client'

import { useState, useCallback } from 'react'
import type { Address, Hex } from 'viem'
import { parseEther } from 'viem'
import { useStableNetContext } from '@/providers'

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

export function useUserOp() {
  const { bundlerUrl, entryPoint } = useStableNetContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sendUserOp = useCallback(async (
    sender: Address,
    params: SendUserOpParams
  ): Promise<UserOpResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Build UserOperation
      const userOp = {
        sender,
        nonce: '0x0', // Will be fetched from chain
        initCode: '0x',
        callData: params.data ?? '0x',
        callGasLimit: '0x50000',
        verificationGasLimit: '0x50000',
        preVerificationGas: '0x10000',
        maxFeePerGas: '0x3B9ACA00', // 1 gwei
        maxPriorityFeePerGas: '0x3B9ACA00',
        paymasterAndData: '0x',
        signature: '0x',
      }

      // Send to bundler
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
      const error = err instanceof Error ? err : new Error('Failed to send UserOperation')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [bundlerUrl, entryPoint])

  const sendTransaction = useCallback(async (
    sender: Address,
    to: Address,
    value: string
  ): Promise<UserOpResult | null> => {
    return sendUserOp(sender, {
      to,
      value: parseEther(value),
      data: '0x',
    })
  }, [sendUserOp])

  return {
    sendUserOp,
    sendTransaction,
    isLoading,
    error,
  }
}
