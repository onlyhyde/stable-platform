/**
 * Chain/network management.
 *
 * Handles switchChain, addChain, chain change events, and caches chainId.
 */
import type { EIP1193Provider } from 'viem'
import { parseChainIdHex } from '../validation'
import { createLogger } from './logger'

const log = createLogger('Chain')

export interface ChainManagerCallbacks {
  onChainChange: (chainId: string) => void
  onSessionChainUpdate: (chainId: string) => void
}

export class ChainManager {
  private readonly provider: EIP1193Provider
  private readonly callbacks: ChainManagerCallbacks

  private _chainId: string | null = null

  constructor(provider: EIP1193Provider, callbacks: ChainManagerCallbacks) {
    this.provider = provider
    this.callbacks = callbacks
  }

  get chainId(): string | null {
    return this._chainId
  }

  get chainIdNumber(): number | null {
    if (!this._chainId) return null
    const parsed = parseChainIdHex(this._chainId)
    return Number.isNaN(parsed) ? null : parsed
  }

  /**
   * Set chain ID (called during connect or from chainChanged event).
   */
  setChainId(chainId: string): void {
    this._chainId = chainId
  }

  /**
   * Handle external chainChanged event from the provider.
   */
  handleChainChanged(chainId: string): void {
    this._chainId = chainId
    this.callbacks.onChainChange(chainId)
    this.callbacks.onSessionChainUpdate(chainId)
    log.debug('Chain changed', { chainId })
  }

  /**
   * Fetch current chain ID from the provider.
   */
  async getChainId(): Promise<string> {
    // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
    const result = await (this.provider as any).request({ method: 'eth_chainId' })
    const chainId = typeof result === 'string' ? result : String(result)
    this._chainId = chainId
    return chainId
  }

  /**
   * Switch to a different chain.
   * Auto-adds the chain (4902 error) if addChainConfig is provided.
   */
  async switchChain(
    chainId: number,
    addChainConfig?: {
      chainName: string
      nativeCurrency: { name: string; symbol: string; decimals: number }
      rpcUrls: readonly string[]
      blockExplorerUrls?: string[]
      iconUrls?: string[]
    }
  ): Promise<void> {
    const hexChainId = `0x${chainId.toString(16)}`

    try {
      // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
      await (this.provider as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
    } catch (err) {
      const error = err as { code?: number; data?: { originalError?: { code?: number } } }
      const isChainNotAdded = error.code === 4902 || error.data?.originalError?.code === 4902

      if (isChainNotAdded && addChainConfig) {
        await this.addChain({ chainId, ...addChainConfig })
        return
      }

      throw err
    }
  }

  /**
   * Add a new chain to the wallet.
   */
  async addChain(chain: {
    chainId: number
    chainName: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    rpcUrls: readonly string[]
    blockExplorerUrls?: string[]
    iconUrls?: string[]
  }): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: arbitrary RPC
    await (this.provider as any).request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${chain.chainId.toString(16)}`,
          chainName: chain.chainName,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls,
          blockExplorerUrls: chain.blockExplorerUrls,
          iconUrls: chain.iconUrls,
        },
      ],
    })
    log.info('Chain added', { chainId: chain.chainId, name: chain.chainName })
  }

  /**
   * Reset chain state.
   */
  reset(): void {
    this._chainId = null
  }
}
