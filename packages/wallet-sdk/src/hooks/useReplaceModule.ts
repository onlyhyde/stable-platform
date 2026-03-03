/**
 * useReplaceModule - Hook for atomically replacing a module on a Kernel Smart Account
 *
 * Uses Kernel v0.3.3's replaceModule which uninstalls the old module
 * and installs the new module in a single transaction.
 */

import { useCallback, useState } from 'react'
import type { Address, Hash, Hex } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { ModuleType } from '../rpc'

interface UseReplaceModuleOptions {
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
}

interface ReplaceModuleParams {
  /** Address of the module to remove */
  oldAddress: Address
  /** Address of the module to install */
  newAddress: Address
  /** Module type (1=Validator, 2=Executor, 3=Fallback, 4=Hook, 5=Policy, 6=Signer) */
  type: ModuleType
  /** De-initialization data for the old module */
  deInitData: Hex
  /** Initialization data for the new module */
  initData: Hex
}

interface UseReplaceModuleResult {
  /** Execute atomic module replacement */
  replaceModule: (params: ReplaceModuleParams) => Promise<Hash>
  /** Transaction hash after successful submission */
  txHash: Hash | null
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Reset state */
  reset: () => void
}

/**
 * React hook for atomically replacing a module on a Kernel Smart Account
 *
 * @example
 * ```tsx
 * const { replaceModule, txHash, isLoading, error } = useReplaceModule({ provider })
 *
 * async function handleReplace() {
 *   const hash = await replaceModule({
 *     oldAddress: '0xOLD...',
 *     newAddress: '0xNEW...',
 *     type: MODULE_TYPE.VALIDATOR,
 *     deInitData: '0x',
 *     initData: '0x...',
 *   })
 *   console.log('Replace module tx:', hash)
 * }
 * ```
 */
export function useReplaceModule(
  options: UseReplaceModuleOptions = {},
): UseReplaceModuleResult {
  const contextProvider = useOptionalProvider()
  const provider = options.provider ?? contextProvider

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setTxHash(null)
    setIsLoading(false)
    setError(null)
  }, [])

  const replaceModule = useCallback(
    async (params: ReplaceModuleParams): Promise<Hash> => {
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
        const result = await provider.request({
          method: 'wallet_replaceModule',
          params: {
            oldAddress: params.oldAddress,
            newAddress: params.newAddress,
            type: params.type,
            deInitData: params.deInitData,
            initData: params.initData,
          },
        })

        const hash = result as Hash
        setTxHash(hash)
        return hash
      } catch (err) {
        const wrappedError =
          err instanceof Error ? err : new Error('Failed to replace module')
        setError(wrappedError)
        throw wrappedError
      } finally {
        setIsLoading(false)
      }
    },
    [provider],
  )

  return {
    replaceModule,
    txHash,
    isLoading,
    error,
    reset,
  }
}
