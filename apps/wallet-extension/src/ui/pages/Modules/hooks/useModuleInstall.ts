import type { GasPaymentConfig, ModuleRegistryEntry } from '@stablenet/core'
import { useCallback, useState } from 'react'
import type { Address, Hash, Hex } from 'viem'
import { useSelectedNetwork } from '../../../hooks'

interface InstallModuleParams {
  account: Address
  module: ModuleRegistryEntry
  config: Record<string, unknown>
  /** Pre-encoded init data (e.g., from WebAuthn registration) */
  initData?: Hex
  /** Gas payment mode (native, sponsor, erc20) */
  gasPayment?: GasPaymentConfig
}

interface InstallCustomModuleParams {
  account: Address
  moduleAddress: Address
  moduleType: string
  initData?: Hex
  name?: string
  /** Gas payment mode (native, sponsor, erc20) */
  gasPayment?: GasPaymentConfig
}

interface UseModuleInstallReturn {
  installModule: (params: InstallModuleParams) => Promise<Hash>
  installCustomModule: (params: InstallCustomModuleParams) => Promise<Hash>
  uninstallModule: (params: {
    account: Address
    moduleAddress: Address
    moduleType: bigint
  }) => Promise<Hash>
  forceUninstallModule: (params: {
    account: Address
    moduleAddress: Address
    moduleType: bigint
  }) => Promise<Hash>
  isPending: boolean
  error: Error | null
}

/**
 * Hook for installing and uninstalling modules on a Smart Account
 */
export function useModuleInstall(): UseModuleInstallReturn {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  const installModule = useCallback(
    async (params: InstallModuleParams): Promise<Hash> => {
      if (!currentNetwork) {
        throw new Error('No network selected')
      }

      setIsPending(true)
      setError(null)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `install-module-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'stablenet_installModule',
            params: [
              {
                account: params.account,
                moduleAddress: params.module.metadata.address,
                moduleType: params.module.metadata.type.toString(),
                // Use pre-encoded initData if provided, otherwise pass config for encoding
                initData: params.initData ?? params.config,
                initDataEncoded: !!params.initData,
                chainId: currentNetwork.chainId,
                gasPaymentMode: params.gasPayment?.type ?? 'sponsor',
                gasPaymentTokenAddress: params.gasPayment?.tokenAddress,
              },
            ],
          },
        })

        if (response?.payload?.error) {
          throw new Error(response.payload.error.message || 'Module installation failed')
        }

        return response?.payload?.result?.hash as Hash
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Module installation failed')
        setError(error)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [currentNetwork]
  )

  const installCustomModule = useCallback(
    async (params: InstallCustomModuleParams): Promise<Hash> => {
      if (!currentNetwork) {
        throw new Error('No network selected')
      }

      setIsPending(true)
      setError(null)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `install-module-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'stablenet_installModule',
            params: [
              {
                account: params.account,
                moduleAddress: params.moduleAddress,
                moduleType: params.moduleType,
                initData: params.initData ?? '0x',
                initDataEncoded: true,
                chainId: currentNetwork.chainId,
                gasPaymentMode: params.gasPayment?.type ?? 'sponsor',
                gasPaymentTokenAddress: params.gasPayment?.tokenAddress,
              },
            ],
          },
        })

        if (response?.payload?.error) {
          throw new Error(response.payload.error.message || 'Module installation failed')
        }

        return response?.payload?.result?.hash as Hash
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Module installation failed')
        setError(error)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [currentNetwork]
  )

  const uninstallModule = useCallback(
    async (params: {
      account: Address
      moduleAddress: Address
      moduleType: bigint
    }): Promise<Hash> => {
      if (!currentNetwork) {
        throw new Error('No network selected')
      }

      setIsPending(true)
      setError(null)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `uninstall-module-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'stablenet_uninstallModule',
            params: [
              {
                account: params.account,
                moduleAddress: params.moduleAddress,
                moduleType: params.moduleType.toString(),
                chainId: currentNetwork.chainId,
              },
            ],
          },
        })

        if (response?.payload?.error) {
          throw new Error(response.payload.error.message || 'Module uninstallation failed')
        }

        return response?.payload?.result?.hash as Hash
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Module uninstallation failed')
        setError(error)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [currentNetwork]
  )

  const forceUninstallModule = useCallback(
    async (params: {
      account: Address
      moduleAddress: Address
      moduleType: bigint
    }): Promise<Hash> => {
      if (!currentNetwork) {
        throw new Error('No network selected')
      }

      setIsPending(true)
      setError(null)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `force-uninstall-module-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'stablenet_forceUninstallModule',
            params: [
              {
                account: params.account,
                moduleAddress: params.moduleAddress,
                moduleType: params.moduleType.toString(),
                chainId: currentNetwork.chainId,
              },
            ],
          },
        })

        if (response?.payload?.error) {
          throw new Error(response.payload.error.message || 'Module force uninstallation failed')
        }

        return response?.payload?.result?.hash as Hash
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Module force uninstallation failed')
        setError(error)
        throw error
      } finally {
        setIsPending(false)
      }
    },
    [currentNetwork]
  )

  return {
    installModule,
    installCustomModule,
    uninstallModule,
    forceUninstallModule,
    isPending,
    error,
  }
}
