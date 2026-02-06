import {
  type MultiModeTransactionRequest,
  TRANSACTION_MODE,
  type TransactionResult,
} from '@stablenet/core'
import { useCallback, useState } from 'react'
import type { Hash } from 'viem'
import { useSelectedNetwork } from '../../../hooks'

interface UseSendTransactionReturn {
  sendTransaction: (request: MultiModeTransactionRequest) => Promise<TransactionResult>
  isPending: boolean
  error: Error | null
  txHash: Hash | null
}

/**
 * Hook for sending multi-mode transactions
 *
 * Supports EOA, EIP-7702, and Smart Account transaction modes
 */
export function useSendTransaction(): UseSendTransactionReturn {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)

  const currentNetwork = useSelectedNetwork()

  const sendTransaction = useCallback(
    async (request: MultiModeTransactionRequest): Promise<TransactionResult> => {
      setIsPending(true)
      setError(null)
      setTxHash(null)

      try {
        let result: TransactionResult

        switch (request.mode) {
          case TRANSACTION_MODE.EOA: {
            // Send via eth_sendTransaction
            const response = await chrome.runtime.sendMessage({
              type: 'RPC_REQUEST',
              id: `send-eoa-${Date.now()}`,
              payload: {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendTransaction',
                params: [
                  {
                    from: request.from,
                    to: request.to,
                    value: `0x${request.value.toString(16)}`,
                    data: request.data,
                  },
                ],
              },
            })

            if (response?.payload?.error) {
              throw new Error(response.payload.error.message || 'Transaction failed')
            }

            const hash = response?.payload?.result as Hash
            result = {
              hash,
              mode: TRANSACTION_MODE.EOA,
              chainId: currentNetwork?.chainId ?? 1,
              timestamp: Date.now(),
            }
            break
          }

          case TRANSACTION_MODE.EIP7702: {
            // Send EIP-7702 SetCode transaction
            const response = await chrome.runtime.sendMessage({
              type: 'RPC_REQUEST',
              id: `send-7702-${Date.now()}`,
              payload: {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendTransaction',
                params: [
                  {
                    from: request.from,
                    to: request.to,
                    value: `0x${request.value.toString(16)}`,
                    data: request.data,
                    type: '0x04', // EIP-7702 type
                    authorizationList: request.authorizationList,
                  },
                ],
              },
            })

            if (response?.payload?.error) {
              throw new Error(response.payload.error.message || 'Transaction failed')
            }

            const hash = response?.payload?.result as Hash
            result = {
              hash,
              mode: TRANSACTION_MODE.EIP7702,
              chainId: currentNetwork?.chainId ?? 1,
              timestamp: Date.now(),
            }
            break
          }

          case TRANSACTION_MODE.SMART_ACCOUNT: {
            // Send via eth_sendUserOperation
            const response = await chrome.runtime.sendMessage({
              type: 'RPC_REQUEST',
              id: `send-userop-${Date.now()}`,
              payload: {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [
                  {
                    sender: request.from,
                    target: request.to,
                    value: `0x${request.value.toString(16)}`,
                    data: request.data,
                    gasPayment: request.gasPayment,
                  },
                  '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint v0.7
                ],
              },
            })

            if (response?.payload?.error) {
              throw new Error(response.payload.error.message || 'Transaction failed')
            }

            const hash = response?.payload?.result as Hash
            result = {
              hash,
              mode: TRANSACTION_MODE.SMART_ACCOUNT,
              chainId: currentNetwork?.chainId ?? 1,
              timestamp: Date.now(),
            }
            break
          }

          default:
            throw new Error(`Unknown transaction mode: ${request.mode}`)
        }

        setTxHash(result.hash)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed')
        setError(error)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [currentNetwork]
  )

  return {
    sendTransaction,
    isPending,
    error,
    txHash,
  }
}
