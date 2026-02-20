/**
 * @stablenet/wallet-sdk/wagmi
 *
 * Wagmi v2 connector for StableNet Wallet
 *
 * @example
 * ```typescript
 * import { stableNetWallet } from '@stablenet/wallet-sdk/wagmi'
 * import { createConfig, http } from 'wagmi'
 * import { mainnet, sepolia } from 'wagmi/chains'
 *
 * const config = createConfig({
 *   chains: [mainnet, sepolia],
 *   connectors: [stableNetWallet()],
 *   transports: {
 *     [mainnet.id]: http(),
 *     [sepolia.id]: http(),
 *   },
 * })
 * ```
 */

import {
  type AddEthereumChainParameter,
  type EIP1193Provider,
  getAddress,
  numberToHex,
  type ProviderConnectInfo,
  type ProviderRpcError,
  ResourceUnavailableRpcError,
  type RpcError,
  SwitchChainError,
  UserRejectedRequestError,
} from 'viem'

import { type Connector, createConnector } from '@wagmi/core'
import { ChainNotConfiguredError } from '@wagmi/core'

import { getProviderRegistry } from './provider/eip6963'

export interface StableNetWalletParameters {
  /**
   * Simulates disconnect by tracking connection status in storage.
   * @default true
   */
  shimDisconnect?: boolean
  /**
   * Provider detection timeout in milliseconds.
   * @default 3000
   */
  timeout?: number
}

stableNetWallet.type = 'stableNetWallet' as const

export function stableNetWallet(parameters: StableNetWalletParameters = {}) {
  const { shimDisconnect = true, timeout = 3000 } = parameters

  type StorageItem = {
    [_ in 'stableNetWallet.connected' | 'stableNetWallet.disconnected']: true
  }

  let accountsChanged: Connector['onAccountsChanged'] | undefined
  let chainChanged: Connector['onChainChanged'] | undefined
  let connectListener: Connector['onConnect'] | undefined
  let disconnectListener: Connector['onDisconnect'] | undefined

  async function getStableNetProvider(): Promise<EIP1193Provider | undefined> {
    if (typeof window === 'undefined') return undefined

    const win = window as Window & {
      stablenet?: EIP1193Provider & { isStableNet?: boolean }
      ethereum?: EIP1193Provider & { isStableNet?: boolean }
    }

    if (win.stablenet?.isStableNet) {
      return win.stablenet
    }
    if (win.ethereum?.isStableNet) {
      return win.ethereum
    }

    // Try EIP-6963 discovery
    const registry = getProviderRegistry()
    await registry.discover(Math.min(timeout, 500))
    const stableNet = registry.getStableNetProvider()
    if (stableNet) {
      return stableNet.provider as unknown as EIP1193Provider
    }

    return undefined
  }

  return createConnector<EIP1193Provider | undefined, Record<string, unknown>, StorageItem>(
    (config) => ({
      id: 'stableNetWallet',
      name: 'StableNet Wallet',
      type: stableNetWallet.type,
      rdns: 'dev.stablenet.wallet',

      async setup() {
        const provider = await getStableNetProvider()
        if (provider) {
          if (!connectListener) {
            connectListener = this.onConnect!.bind(this)
            provider.on('connect', connectListener as (...args: unknown[]) => void)
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            provider.on(
              'accountsChanged',
              accountsChanged as (...args: unknown[]) => void,
            )
          }
        }
      },

      async connect({ chainId, isReconnecting } = {} as {
        chainId?: number
        isReconnecting?: boolean
      }) {
        const provider = await getStableNetProvider()
        if (!provider) throw new Error('StableNet Wallet not found')

        let accounts: readonly `0x${string}`[] = []
        if (isReconnecting) {
          accounts = await this.getAccounts().catch(() => [])
        }

        try {
          if (!accounts?.length && !isReconnecting) {
            const requestedAccounts = await provider.request({
              method: 'eth_requestAccounts',
            })
            accounts = (requestedAccounts as string[]).map((x) => getAddress(x))
          }

          // Manage EIP-1193 event listeners
          if (connectListener) {
            provider.removeListener(
              'connect',
              connectListener as (...args: unknown[]) => void,
            )
            connectListener = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            provider.on(
              'accountsChanged',
              accountsChanged as (...args: unknown[]) => void,
            )
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on('chainChanged', chainChanged as (...args: unknown[]) => void)
          }
          if (!disconnectListener) {
            disconnectListener = this.onDisconnect.bind(this)
            provider.on(
              'disconnect',
              disconnectListener as (...args: unknown[]) => void,
            )
          }

          // Switch to chain if provided
          let currentChainId = await this.getChainId()
          if (chainId && currentChainId !== chainId && this.switchChain) {
            const chain = await this.switchChain({ chainId }).catch(
              (error: RpcError) => {
                if (error.code === UserRejectedRequestError.code) throw error
                return { id: currentChainId }
              },
            )
            currentChainId = chain?.id ?? currentChainId
          }

          // Manage disconnect shim
          if (shimDisconnect) {
            await config.storage?.removeItem('stableNetWallet.disconnected')
          }
          await config.storage?.setItem('stableNetWallet.connected', true)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { accounts, chainId: currentChainId } as any
        } catch (err) {
          const error = err as RpcError
          if (error.code === UserRejectedRequestError.code) {
            throw new UserRejectedRequestError(error)
          }
          if (error.code === ResourceUnavailableRpcError.code) {
            throw new ResourceUnavailableRpcError(error)
          }
          throw error
        }
      },

      async disconnect() {
        const provider = await getStableNetProvider()
        if (!provider) throw new Error('StableNet Wallet not found')

        // Remove event listeners
        if (chainChanged) {
          provider.removeListener(
            'chainChanged',
            chainChanged as (...args: unknown[]) => void,
          )
          chainChanged = undefined
        }
        if (disconnectListener) {
          provider.removeListener(
            'disconnect',
            disconnectListener as (...args: unknown[]) => void,
          )
          disconnectListener = undefined
        }
        if (!connectListener) {
          connectListener = this.onConnect!.bind(this)
          provider.on('connect', connectListener as (...args: unknown[]) => void)
        }

        if (shimDisconnect) {
          await config.storage?.setItem('stableNetWallet.disconnected', true)
        }
        await config.storage?.removeItem('stableNetWallet.connected')
      },

      async getAccounts() {
        const provider = await getStableNetProvider()
        if (!provider) throw new Error('StableNet Wallet not found')
        const accounts = await provider.request({ method: 'eth_accounts' })
        return (accounts as string[]).map((x) => getAddress(x))
      },

      async getChainId() {
        const provider = await getStableNetProvider()
        if (!provider) throw new Error('StableNet Wallet not found')
        const hexChainId = await provider.request({ method: 'eth_chainId' })
        return Number(hexChainId)
      },

      async getProvider() {
        return getStableNetProvider()
      },

      async isAuthorized() {
        try {
          const isDisconnected =
            shimDisconnect &&
            (await config.storage?.getItem('stableNetWallet.disconnected'))
          if (isDisconnected) return false

          const connected = await config.storage?.getItem('stableNetWallet.connected')
          if (!connected) return false

          const provider = await getStableNetProvider()
          if (!provider) return false

          const accounts = await this.getAccounts()
          return accounts.length > 0
        } catch {
          return false
        }
      },

      async switchChain({ addEthereumChainParameter, chainId }) {
        const provider = await getStableNetProvider()
        if (!provider) throw new Error('StableNet Wallet not found')

        const chain = config.chains.find((x) => x.id === chainId)
        if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

        const promise = new Promise<void>((resolve) => {
          const listener = (
            data: Record<string, unknown> & { chainId?: number },
          ) => {
            if ('chainId' in data && data.chainId === chainId) {
              config.emitter.off('change', listener)
              resolve()
            }
          }
          config.emitter.on('change', listener)
        })

        try {
          await Promise.all([
            provider
              .request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: numberToHex(chainId) }],
              })
              .then(async () => {
                const currentChainId = await this.getChainId()
                if (currentChainId === chainId) {
                  config.emitter.emit('change', { chainId })
                }
              }),
            promise,
          ])
          return chain
        } catch (err) {
          const error = err as RpcError

          // Chain not added - try wallet_addEthereumChain
          if (
            error.code === 4902 ||
            (error as ProviderRpcError<{ originalError?: { code: number } }>)?.data
              ?.originalError?.code === 4902
          ) {
            try {
              const { default: blockExplorer, ...blockExplorers } =
                chain.blockExplorers ?? {}
              let blockExplorerUrls: string[] | undefined
              if (addEthereumChainParameter?.blockExplorerUrls) {
                blockExplorerUrls = addEthereumChainParameter.blockExplorerUrls
              } else if (blockExplorer) {
                blockExplorerUrls = [
                  blockExplorer.url,
                  ...Object.values(blockExplorers).map((x) => x.url),
                ]
              }

              let rpcUrls: readonly string[]
              if (addEthereumChainParameter?.rpcUrls?.length) {
                rpcUrls = addEthereumChainParameter.rpcUrls
              } else {
                rpcUrls = [chain.rpcUrls.default?.http[0] ?? '']
              }

              const addEthereumChain = {
                blockExplorerUrls,
                chainId: numberToHex(chainId),
                chainName: addEthereumChainParameter?.chainName ?? chain.name,
                iconUrls: addEthereumChainParameter?.iconUrls,
                nativeCurrency:
                  addEthereumChainParameter?.nativeCurrency ?? chain.nativeCurrency,
                rpcUrls,
              } satisfies AddEthereumChainParameter

              await Promise.all([
                provider
                  .request({
                    method: 'wallet_addEthereumChain',
                    params: [addEthereumChain],
                  })
                  .then(async () => {
                    const currentChainId = await this.getChainId()
                    if (currentChainId === chainId) {
                      config.emitter.emit('change', { chainId })
                    } else {
                      throw new UserRejectedRequestError(
                        new Error('User rejected switch after adding network.'),
                      )
                    }
                  }),
                promise,
              ])

              return chain
            } catch (addError) {
              throw new UserRejectedRequestError(addError as Error)
            }
          }

          if (error.code === UserRejectedRequestError.code) {
            throw new UserRejectedRequestError(error)
          }
          throw new SwitchChainError(error)
        }
      },

      async onAccountsChanged(accounts) {
        if (accounts.length === 0) {
          this.onDisconnect!()
        } else if (config.emitter.listenerCount('connect')) {
          const chainId = (await this.getChainId()).toString()
          this.onConnect!({ chainId })
          if (shimDisconnect) {
            await config.storage?.removeItem('stableNetWallet.disconnected')
          }
        } else {
          config.emitter.emit('change', {
            accounts: accounts.map((x) => getAddress(x)),
          })
        }
      },

      onChainChanged(chain) {
        const chainId = Number(chain)
        config.emitter.emit('change', { chainId })
      },

      async onConnect(connectInfo: ProviderConnectInfo) {
        const accounts = await this.getAccounts()
        if (accounts.length === 0) return

        const chainId = Number(connectInfo.chainId)
        config.emitter.emit('connect', { accounts, chainId })

        const provider = await getStableNetProvider()
        if (provider) {
          if (connectListener) {
            provider.removeListener(
              'connect',
              connectListener as (...args: unknown[]) => void,
            )
            connectListener = undefined
          }
          if (!accountsChanged) {
            accountsChanged = this.onAccountsChanged.bind(this)
            provider.on(
              'accountsChanged',
              accountsChanged as (...args: unknown[]) => void,
            )
          }
          if (!chainChanged) {
            chainChanged = this.onChainChanged.bind(this)
            provider.on('chainChanged', chainChanged as (...args: unknown[]) => void)
          }
          if (!disconnectListener) {
            disconnectListener = this.onDisconnect.bind(this)
            provider.on(
              'disconnect',
              disconnectListener as (...args: unknown[]) => void,
            )
          }
        }
      },

      async onDisconnect(error) {
        const provider = await getStableNetProvider()

        // MetaMask 1013 error - wait for reconnection
        if (error && (error as RpcError<1013>).code === 1013) {
          if (provider && (await this.getAccounts()).length > 0) return
        }

        config.emitter.emit('disconnect')

        if (provider) {
          if (chainChanged) {
            provider.removeListener(
              'chainChanged',
              chainChanged as (...args: unknown[]) => void,
            )
            chainChanged = undefined
          }
          if (disconnectListener) {
            provider.removeListener(
              'disconnect',
              disconnectListener as (...args: unknown[]) => void,
            )
            disconnectListener = undefined
          }
          if (!connectListener) {
            connectListener = this.onConnect!.bind(this)
            provider.on(
              'connect',
              connectListener as (...args: unknown[]) => void,
            )
          }
        }
      },
    }),
  )
}
