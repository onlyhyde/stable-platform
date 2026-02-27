/**
 * React hook for ERC-4337 Bundler client management.
 *
 * Creates and memoizes a bundler client instance, provides
 * convenience methods for sending/estimating UserOperations.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { createBundlerClient } from '../bundler'
import type { BundlerClient, UserOperation, UserOperationGasEstimation, UserOperationReceipt } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'

export interface UseBundlerConfig {
  bundlerUrl: string
  entryPoint?: Address
  chainId?: number
}

export interface UseBundlerResult {
  client: BundlerClient
  sendUserOp: (userOp: UserOperation) => Promise<Hex>
  estimateGas: (userOp: Partial<UserOperation> & { sender: Address; callData: Hex }) => Promise<UserOperationGasEstimation>
  getReceipt: (hash: Hex) => Promise<UserOperationReceipt | null>
  waitForReceipt: (hash: Hex) => Promise<UserOperationReceipt>
  isLoading: boolean
  error: Error | null
}

/**
 * React hook for managing an ERC-4337 bundler client.
 *
 * @example
 * ```tsx
 * const { sendUserOp, estimateGas, isLoading } = useBundler({
 *   bundlerUrl: 'https://bundler.example.com',
 * })
 *
 * const hash = await sendUserOp(userOp)
 * ```
 */
export function useBundler(config: UseBundlerConfig): UseBundlerResult {
  const { bundlerUrl, entryPoint } = config
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const loadingCount = useRef(0)

  const client = useMemo(
    () => createBundlerClient({ url: bundlerUrl, entryPoint }),
    [bundlerUrl, entryPoint]
  )

  const sendUserOp = useCallback(async (userOp: UserOperation): Promise<Hex> => {
    loadingCount.current++
    setIsLoading(true)
    setError(null)
    try {
      return await client.sendUserOperation(userOp)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send UserOperation')
      setError(error)
      throw error
    } finally {
      loadingCount.current--
      if (loadingCount.current === 0) setIsLoading(false)
    }
  }, [client])

  const estimateGas = useCallback(async (
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex }
  ): Promise<UserOperationGasEstimation> => {
    loadingCount.current++
    setIsLoading(true)
    setError(null)
    try {
      return await client.estimateUserOperationGas(userOp)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to estimate gas')
      setError(error)
      throw error
    } finally {
      loadingCount.current--
      if (loadingCount.current === 0) setIsLoading(false)
    }
  }, [client])

  const getReceipt = useCallback(async (hash: Hex): Promise<UserOperationReceipt | null> => {
    return client.getUserOperationReceipt(hash)
  }, [client])

  const waitForReceipt = useCallback(async (hash: Hex): Promise<UserOperationReceipt> => {
    loadingCount.current++
    setIsLoading(true)
    setError(null)
    try {
      return await client.waitForUserOperationReceipt(hash)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed waiting for receipt')
      setError(error)
      throw error
    } finally {
      loadingCount.current--
      if (loadingCount.current === 0) setIsLoading(false)
    }
  }, [client])

  return { client, sendUserOp, estimateGas, getReceipt, waitForReceipt, isLoading, error }
}
