import type { Web3WalletTypes } from '@walletconnect/web3wallet'
import { STORAGE_KEYS } from '../../shared/constants'
import { createLogger } from '../../shared/utils/logger'
import type { WalletConnectSession } from '../../types'
import { walletState } from '../state/store'
import { approvalController } from './approvalController'

const logger = createLogger('WalletConnectController')

// The wallet instance is created via dynamic import, so we use the awaited return type
type Web3WalletInstance = Awaited<
  ReturnType<(typeof import('@walletconnect/web3wallet'))['Web3Wallet']['init']>
>

/**
 * WalletConnect v2 Controller
 *
 * Manages WalletConnect Web3Wallet instance, session lifecycle,
 * and bridges WC requests to the existing approval + RPC handler flow.
 */
class WalletConnectController {
  private wallet: Web3WalletInstance | null = null
  private initialized = false

  /**
   * Initialize the Web3Wallet instance.
   * Must be called once during background service worker startup.
   */
  async init(projectId: string): Promise<void> {
    if (this.initialized || !projectId) {
      return
    }

    try {
      // Dynamic import to avoid loading WC code when not configured
      const { Web3Wallet } = await import('@walletconnect/web3wallet')
      const { Core } = await import('@walletconnect/core')

      const core = new Core({ projectId })

      this.wallet = await Web3Wallet.init({
        core,
        metadata: {
          name: 'StableNet Wallet',
          description: 'ERC-4337 Smart Account Wallet',
          url: 'https://stablenet.dev',
          icons: ['https://stablenet.dev/icon.png'],
        },
      })

      this.registerEventHandlers()
      this.initialized = true
      logger.info('WalletConnect initialized')
    } catch (error) {
      logger.error('Failed to initialize WalletConnect', error)
    }
  }

  /**
   * Pair with a dApp via WalletConnect URI (from QR code or paste)
   */
  async pair(uri: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      await this.wallet.pair({ uri })
      logger.info('WalletConnect pairing initiated')
    } catch (error) {
      logger.error('Failed to pair', error)
      throw error
    }
  }

  /**
   * Get all active WalletConnect sessions
   */
  async getSessions(): Promise<WalletConnectSession[]> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.WALLETCONNECT_SESSIONS)
      return (stored[STORAGE_KEYS.WALLETCONNECT_SESSIONS] as WalletConnectSession[]) ?? []
    } catch {
      return []
    }
  }

  /**
   * Disconnect a WalletConnect session by topic
   */
  async disconnectSession(topic: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      await this.wallet.disconnectSession({
        topic,
        reason: { code: 6000, message: 'User disconnected' },
      })
    } catch (error) {
      // Session may already be disconnected on the relay
      logger.warn('Error disconnecting WC session', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    await this.removeSessionFromStorage(topic)
    logger.info('WalletConnect session disconnected', { topic })
  }

  /**
   * Register WalletConnect event handlers
   */
  private registerEventHandlers(): void {
    if (!this.wallet) return

    this.wallet.on('session_proposal', (proposal: Web3WalletTypes.SessionProposal) => {
      this.handleSessionProposal(proposal).catch((error) => {
        logger.error('Error handling session proposal', error)
      })
    })

    this.wallet.on('session_request', (event: Web3WalletTypes.SessionRequest) => {
      this.handleSessionRequest(event).catch((error) => {
        logger.error('Error handling session request', error)
      })
    })

    this.wallet.on('session_delete', (event: Web3WalletTypes.SessionDelete) => {
      this.handleSessionDelete(event).catch((error) => {
        logger.error('Error handling session delete', error)
      })
    })
  }

  /**
   * Handle incoming session proposal from a dApp.
   * Creates an approval request via ApprovalController.
   */
  private async handleSessionProposal(
    proposal: Web3WalletTypes.SessionProposal
  ): Promise<void> {
    const { id, params } = proposal
    const { proposer, requiredNamespaces, optionalNamespaces } = params

    const requiredEip155 = requiredNamespaces.eip155
    const optionalEip155 = optionalNamespaces?.eip155

    try {
      const result = await approvalController.requestWalletConnectSession({
        proposalId: id,
        proposerName: proposer.metadata.name,
        proposerUrl: proposer.metadata.url,
        proposerDescription: proposer.metadata.description,
        proposerIcon: proposer.metadata.icons?.[0],
        requiredChains: requiredEip155?.chains ?? [],
        requiredMethods: requiredEip155?.methods ?? [],
        requiredEvents: requiredEip155?.events ?? [],
        optionalChains: optionalEip155?.chains,
        optionalMethods: optionalEip155?.methods,
        optionalEvents: optionalEip155?.events,
      })

      // User approved — build namespaces and approve
      const state = walletState.getState()
      const selectedChainId = state.networks.selectedChainId
      const accounts = result.accounts

      const eip155Accounts = accounts.map(
        (addr: string) => `eip155:${selectedChainId}:${addr}`
      )

      const supportedMethods = [
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData_v4',
        'eth_chainId',
        'eth_accounts',
        'eth_requestAccounts',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ]

      const supportedEvents = ['accountsChanged', 'chainChanged']

      const approvedNamespaces = {
        eip155: {
          accounts: eip155Accounts,
          methods: supportedMethods,
          events: supportedEvents,
          chains: [`eip155:${selectedChainId}`],
        },
      }

      const session = await this.wallet!.approveSession({
        id,
        namespaces: approvedNamespaces,
      })

      // Persist session
      await this.saveSessionToStorage({
        topic: session.topic,
        peerMeta: {
          name: proposer.metadata.name,
          url: proposer.metadata.url,
          description: proposer.metadata.description,
          icons: proposer.metadata.icons,
        },
        namespaces: approvedNamespaces,
        expiry: session.expiry,
        connectedAt: Date.now(),
      })

      logger.info('WalletConnect session approved', { topic: session.topic })
    } catch {
      // User rejected or error occurred
      try {
        await this.wallet!.rejectSession({
          id,
          reason: { code: 5000, message: 'User rejected' },
        })
      } catch (rejectError) {
        logger.error('Error rejecting WC session', rejectError)
      }
    }
  }

  /**
   * Handle incoming JSON-RPC request from a connected dApp.
   * Routes through the existing handleRpcRequest flow.
   */
  private async handleSessionRequest(
    event: Web3WalletTypes.SessionRequest
  ): Promise<void> {
    const { id, topic, params } = event
    const { request } = params

    // Derive origin from session peer metadata for SEC-3 compliance
    const sessions = this.wallet!.getActiveSessions()
    const session = sessions[topic]
    const peerUrl = session?.peer?.metadata?.url ?? 'unknown'
    const origin = `wc:${peerUrl}`

    try {
      // Dynamic import to avoid circular dependencies
      const { handleRpcRequest } = await import('../rpc/handler')

      const response = await handleRpcRequest(
        {
          jsonrpc: '2.0',
          id,
          method: request.method,
          params: request.params as unknown[],
        },
        origin,
        false // not from extension
      )

      if (response.error) {
        await this.wallet!.respondSessionRequest({
          topic,
          response: {
            id,
            jsonrpc: '2.0',
            error: {
              code: response.error.code ?? -32603,
              message: response.error.message ?? 'Internal error',
            },
          },
        })
      } else {
        await this.wallet!.respondSessionRequest({
          topic,
          response: {
            id,
            jsonrpc: '2.0',
            result: response.result,
          },
        })
      }
    } catch (error) {
      logger.error('Error handling WC session request', error)
      await this.wallet!.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        },
      })
    }
  }

  /**
   * Handle session delete (remote disconnect)
   */
  private async handleSessionDelete(
    event: Web3WalletTypes.SessionDelete
  ): Promise<void> {
    await this.removeSessionFromStorage(event.topic)
    logger.info('WalletConnect session deleted by peer', { topic: event.topic })
  }

  /**
   * Persist a session to chrome.storage.local
   */
  private async saveSessionToStorage(session: WalletConnectSession): Promise<void> {
    const sessions = await this.getSessions()
    // Replace if same topic exists, otherwise append
    const filtered = sessions.filter((s) => s.topic !== session.topic)
    filtered.push(session)
    await chrome.storage.local.set({
      [STORAGE_KEYS.WALLETCONNECT_SESSIONS]: filtered,
    })
  }

  /**
   * Remove a session from chrome.storage.local
   */
  private async removeSessionFromStorage(topic: string): Promise<void> {
    const sessions = await this.getSessions()
    const filtered = sessions.filter((s) => s.topic !== topic)
    await chrome.storage.local.set({
      [STORAGE_KEYS.WALLETCONNECT_SESSIONS]: filtered,
    })
  }
}

// Singleton instance
export const walletConnectController = new WalletConnectController()
