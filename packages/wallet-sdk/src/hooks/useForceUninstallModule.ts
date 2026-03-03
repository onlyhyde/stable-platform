/**
 * useForceUninstallModule - Hook for force-uninstalling a module from a Kernel Smart Account
 *
 * Uses Kernel v0.3.3's forceUninstallModule which calls the module's
 * onUninstall via excessivelySafeCall — module revert is ignored.
 * Use this when normal uninstallModule fails with ModuleOnUninstallFailed.
 */

import { useCallback, useState } from 'react'
import type { Address, Hash, Hex } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { ModuleType } from '../rpc'

interface UseForceUninstallModuleOptions {
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
}

interface ForceUninstallModuleParams {
  /** Module contract address */
  address: Address
  /** Module type (1=Validator, 2=Executor, 3=Fallback, 4=Hook, 5=Policy, 6=Signer) */
  type: ModuleType
  /** De-initialization data for the module */
  deInitData: Hex
}

interface UseForceUninstallModuleResult {
  /** Execute force-uninstall for the given module */
  forceUninstall: (params: ForceUninstallModuleParams) => Promise<Hash>
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
 * React hook for force-uninstalling a module from a Kernel Smart Account
 *
 * @example
 * ```tsx
 * const { forceUninstall, txHash, isLoading, error } = useForceUninstallModule({ provider })
 *
 * async function handleForceUninstall() {
 *   const hash = await forceUninstall({
 *     address: '0x...',
 *     type: MODULE_TYPE.VALIDATOR,
 *     deInitData: '0x',
 *   })
 *   console.log('Force uninstall tx:', hash)
 * }
 * ```
 */
export function useForceUninstallModule(
  options: UseForceUninstallModuleOptions = {},
): UseForceUninstallModuleResult {
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

  const forceUninstall = useCallback(
    async (params: ForceUninstallModuleParams): Promise<Hash> => {
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
          method: 'wallet_forceUninstallModule',
          params: {
            address: params.address,
            type: params.type,
            deInitData: params.deInitData,
          },
        })

        const hash = result as Hash
        setTxHash(hash)
        return hash
      } catch (err) {
        const wrappedError =
          err instanceof Error ? err : new Error('Failed to force-uninstall module')
        setError(wrappedError)
        throw wrappedError
      } finally {
        setIsLoading(false)
      }
    },
    [provider],
  )

  return {
    forceUninstall,
    txHash,
    isLoading,
    error,
    reset,
  }
}
