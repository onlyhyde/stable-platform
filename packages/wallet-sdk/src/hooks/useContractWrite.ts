/**
 * useContractWrite - Hook for writing to smart contracts
 *
 * Encodes function calls using viem's encodeFunctionData and sends
 * transactions through StableNetProvider.sendTransaction(), which
 * handles hex encoding and emits transaction lifecycle events.
 */

import { useCallback, useState } from 'react'
import { type Abi, type Address, encodeFunctionData, type Hash } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'

interface UseContractWriteOptions<TAbi extends Abi = Abi, TFunctionName extends string = string> {
  /** Contract address */
  address: Address
  /** Contract ABI */
  abi: TAbi
  /** Function name to call */
  functionName: TFunctionName
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
  /** Value in wei to send with the transaction */
  value?: bigint
  /** Gas limit override (auto-estimated if not provided) */
  gas?: bigint
  /** Gas price override */
  gasPrice?: bigint
  /** EIP-1559 max fee per gas override */
  maxFeePerGas?: bigint
  /** EIP-1559 max priority fee per gas override */
  maxPriorityFeePerGas?: bigint
}

interface UseContractWriteResult {
  /** Execute the contract write with the given arguments */
  write: (args?: readonly unknown[]) => Promise<Hash>
  /** Transaction hash after successful submission */
  txHash: Hash | null
  /** Loading state (transaction is being submitted) */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Reset state to allow a new write */
  reset: () => void
}

/**
 * React hook for writing to a smart contract
 *
 * @example
 * ```tsx
 * const { write, txHash, isLoading, error } = useContractWrite({
 *   address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *   abi: erc20Abi,
 *   functionName: 'transfer',
 *   provider,
 * })
 *
 * async function handleTransfer() {
 *   const hash = await write([recipientAddress, amount])
 *   console.log('Transaction sent:', hash)
 * }
 *
 * return (
 *   <div>
 *     <button onClick={handleTransfer} disabled={isLoading}>
 *       {isLoading ? 'Sending...' : 'Transfer'}
 *     </button>
 *     {txHash && <p>TX: {txHash}</p>}
 *     {error && <p>Error: {error.message}</p>}
 *   </div>
 * )
 * ```
 */
export function useContractWrite<TAbi extends Abi = Abi, TFunctionName extends string = string>(
  options: UseContractWriteOptions<TAbi, TFunctionName>,
): UseContractWriteResult {
  const contextProvider = useOptionalProvider()
  const {
    address,
    abi,
    functionName,
    provider: explicitProvider,
    value,
    gas,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
  } = options
  const provider = explicitProvider ?? contextProvider

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setTxHash(null)
    setIsLoading(false)
    setError(null)
  }, [])

  const write = useCallback(
    async (args?: readonly unknown[]): Promise<Hash> => {
      if (!provider) {
        throw new Error('Provider not available')
      }

      if (!provider.account) {
        throw new Error('No account connected')
      }

      setIsLoading(true)
      setError(null)
      setTxHash(null)

      try {
        // Encode the function call
        // Cast required: viem's generics need concrete ABI types at compile time,
        // but this hook accepts any ABI via generic parameter
        const calldata = encodeFunctionData({
          abi,
          functionName,
          args,
        } as Parameters<typeof encodeFunctionData>[0])

        // Send via StableNetProvider.sendTransaction()
        // This handles hex conversion and emits transaction lifecycle events
        const hash = await provider.sendTransaction({
          to: address,
          data: calldata,
          value,
          gas,
          gasPrice,
          maxFeePerGas,
          maxPriorityFeePerGas,
        })

        setTxHash(hash)
        return hash
      } catch (err) {
        const wrappedError = err instanceof Error ? err : new Error('Failed to write contract')
        setError(wrappedError)
        throw wrappedError
      } finally {
        setIsLoading(false)
      }
    },
    [provider, address, abi, functionName, value, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas],
  )

  return {
    write,
    txHash,
    isLoading,
    error,
    reset,
  }
}
