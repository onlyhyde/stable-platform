import type { Address } from 'viem'
import type {
  Account,
  Network,
  PendingTransaction,
  ConnectedSite,
  WalletState,
} from '../../types'
import { DEFAULT_NETWORKS, STORAGE_KEYS } from '../../shared/constants'

/**
 * Initial wallet state
 */
const initialState: WalletState = {
  accounts: {
    accounts: [],
    selectedAccount: null,
  },
  networks: {
    networks: DEFAULT_NETWORKS,
    selectedChainId: DEFAULT_NETWORKS[0]?.chainId ?? 31337,
  },
  transactions: {
    pendingTransactions: [],
    history: [],
  },
  connections: {
    connectedSites: [],
  },
  keyring: {
    isUnlocked: false,
    isInitialized: false,
    accounts: [],
    selectedAddress: null,
  },
  ui: {
    isLoading: false,
    error: null,
    currentPage: 'home',
  },
  isInitialized: false,
}

/**
 * State manager for the wallet
 * Uses chrome.storage.local for persistence
 */
class WalletStateManager {
  private state: WalletState = initialState
  private listeners: Set<(state: WalletState) => void> = new Set()

  async initialize(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.WALLET_STATE)
      if (stored[STORAGE_KEYS.WALLET_STATE]) {
        const storedState = stored[STORAGE_KEYS.WALLET_STATE]
        // Deep merge to ensure nested objects have all required properties
        this.state = {
          accounts: {
            ...initialState.accounts,
            ...(storedState.accounts ?? {}),
          },
          networks: {
            ...initialState.networks,
            ...(storedState.networks ?? {}),
          },
          transactions: {
            ...initialState.transactions,
            ...(storedState.transactions ?? {}),
          },
          connections: {
            ...initialState.connections,
            ...(storedState.connections ?? {}),
          },
          keyring: {
            ...initialState.keyring,
            ...(storedState.keyring ?? {}),
          },
          ui: {
            ...initialState.ui,
            ...(storedState.ui ?? {}),
          },
          isInitialized: storedState.isInitialized ?? false,
        }
      }
    } catch {
      // If storage fails, use initial state
      this.state = initialState
    }
  }

  getState(): WalletState {
    return this.state
  }

  async setState(partial: Partial<WalletState>): Promise<void> {
    this.state = { ...this.state, ...partial }
    await this.persist()
    this.notifyListeners()
  }

  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  private async persist(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.WALLET_STATE]: this.state,
      })
    } catch {
      // Silent fail for persistence
    }
  }

  // Account actions
  async addAccount(account: Account): Promise<void> {
    const accounts = [...this.state.accounts.accounts, account]
    await this.setState({
      accounts: {
        ...this.state.accounts,
        accounts,
        selectedAccount: this.state.accounts.selectedAccount ?? account.address,
      },
    })
  }

  async selectAccount(address: Address): Promise<void> {
    await this.setState({
      accounts: {
        ...this.state.accounts,
        selectedAccount: address,
      },
    })
  }

  async clearAccounts(): Promise<void> {
    await this.setState({
      accounts: {
        accounts: [],
        selectedAccount: null,
      },
    })
  }

  // Network actions
  async selectNetwork(chainId: number): Promise<void> {
    await this.setState({
      networks: {
        ...this.state.networks,
        selectedChainId: chainId,
      },
    })
  }

  async addNetwork(network: Network): Promise<void> {
    const networks = [...this.state.networks.networks, network]
    await this.setState({
      networks: {
        ...this.state.networks,
        networks,
      },
    })
  }

  async removeNetwork(chainId: number): Promise<void> {
    // Don't remove default networks
    const network = this.state.networks.networks.find((n) => n.chainId === chainId)
    if (!network?.isCustom) {
      throw new Error('Cannot remove default network')
    }

    const networks = this.state.networks.networks.filter((n) => n.chainId !== chainId)

    // If removing the selected network, switch to first available
    let selectedChainId = this.state.networks.selectedChainId
    if (selectedChainId === chainId && networks.length > 0) {
      selectedChainId = networks[0].chainId
    }

    await this.setState({
      networks: {
        networks,
        selectedChainId,
      },
    })
  }

  // Transaction actions
  async addPendingTransaction(tx: PendingTransaction): Promise<void> {
    const pendingTransactions = [...this.state.transactions.pendingTransactions, tx]
    await this.setState({
      transactions: {
        ...this.state.transactions,
        pendingTransactions,
      },
    })
  }

  async updateTransaction(
    id: string,
    updates: Partial<PendingTransaction>
  ): Promise<void> {
    const pendingTransactions = this.state.transactions.pendingTransactions.map(
      (tx) => (tx.id === id ? { ...tx, ...updates } : tx)
    )
    await this.setState({
      transactions: {
        ...this.state.transactions,
        pendingTransactions,
      },
    })
  }

  async moveToHistory(id: string): Promise<void> {
    const tx = this.state.transactions.pendingTransactions.find((t) => t.id === id)
    if (!tx) return

    const pendingTransactions = this.state.transactions.pendingTransactions.filter(
      (t) => t.id !== id
    )
    const history = [tx, ...this.state.transactions.history]

    await this.setState({
      transactions: {
        pendingTransactions,
        history,
      },
    })
  }

  // Connection actions
  async addConnectedSite(site: ConnectedSite): Promise<void> {
    const existing = this.state.connections.connectedSites.find(
      (s) => s.origin === site.origin
    )
    if (existing) {
      // Update existing
      const connectedSites = this.state.connections.connectedSites.map((s) =>
        s.origin === site.origin ? { ...s, ...site } : s
      )
      await this.setState({
        connections: { connectedSites },
      })
    } else {
      // Add new
      const connectedSites = [...this.state.connections.connectedSites, site]
      await this.setState({
        connections: { connectedSites },
      })
    }
  }

  async removeConnectedSite(origin: string): Promise<void> {
    const connectedSites = this.state.connections.connectedSites.filter(
      (s) => s.origin !== origin
    )
    await this.setState({
      connections: { connectedSites },
    })
  }

  isConnected(origin: string): boolean {
    return this.state.connections.connectedSites.some((s) => s.origin === origin)
  }

  getConnectedAccounts(origin: string): Address[] {
    const site = this.state.connections.connectedSites.find(
      (s) => s.origin === origin
    )
    return site?.accounts ?? []
  }

  // Keyring actions
  async setUnlocked(isUnlocked: boolean): Promise<void> {
    await this.setState({
      keyring: {
        ...this.state.keyring,
        isUnlocked,
      },
    })
  }

  async setInitialized(isInitialized: boolean): Promise<void> {
    await this.setState({ isInitialized })
  }

  // UI actions
  async setLoading(isLoading: boolean): Promise<void> {
    await this.setState({
      ui: {
        ...this.state.ui,
        isLoading,
      },
    })
  }

  async setError(error: string | null): Promise<void> {
    await this.setState({
      ui: {
        ...this.state.ui,
        error,
      },
    })
  }

  // Helper methods
  getCurrentNetwork(): Network | undefined {
    return this.state.networks.networks.find(
      (n) => n.chainId === this.state.networks.selectedChainId
    )
  }

  getCurrentAccount(): Account | undefined {
    return this.state.accounts.accounts.find(
      (a) => a.address === this.state.accounts.selectedAccount
    )
  }
}

// Singleton instance
export const walletState = new WalletStateManager()
