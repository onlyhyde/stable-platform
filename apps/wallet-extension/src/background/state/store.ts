import type { Address } from 'viem'
import type {
  Account,
  Network,
  PendingTransaction,
  ConnectedSite,
  WalletState,
  WalletToken,
  AssetState,
} from '../../types'
import { DEFAULT_NETWORKS, STORAGE_KEYS } from '../../shared/constants'
import { deepMerge, normalizeOrigin, originsMatch } from './utils'

/**
 * Initial asset state
 */
const initialAssetState: AssetState = {
  tokensByChain: {},
  balanceCache: {},
  lastRefresh: {},
}

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
  assets: initialAssetState,
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
          assets: {
            ...initialAssetState,
            ...(storedState.assets ?? {}),
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

  /**
   * Update state with deep merge
   * Nested objects are merged recursively, arrays are replaced
   */
  async setState(partial: Partial<WalletState>): Promise<void> {
    this.state = deepMerge(this.state, partial)
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
    const firstNetwork = networks[0]
    if (selectedChainId === chainId && networks.length > 0 && firstNetwork) {
      selectedChainId = firstNetwork.chainId
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
  /**
   * Add or update a connected site
   * Origin is normalized for consistent matching
   */
  async addConnectedSite(site: ConnectedSite): Promise<void> {
    // Normalize origin before storing
    const normalizedSite = {
      ...site,
      origin: normalizeOrigin(site.origin),
    }

    const existing = this.state.connections.connectedSites.find((s) =>
      originsMatch(s.origin, site.origin)
    )

    if (existing) {
      // Update existing
      const connectedSites = this.state.connections.connectedSites.map((s) =>
        originsMatch(s.origin, site.origin) ? { ...s, ...normalizedSite } : s
      )
      await this.setState({
        connections: { connectedSites },
      })
    } else {
      // Add new
      const connectedSites = [
        ...this.state.connections.connectedSites,
        normalizedSite,
      ]
      await this.setState({
        connections: { connectedSites },
      })
    }
  }

  /**
   * Remove a connected site by origin
   * Origin is normalized for consistent matching
   */
  async removeConnectedSite(origin: string): Promise<void> {
    const connectedSites = this.state.connections.connectedSites.filter(
      (s) => !originsMatch(s.origin, origin)
    )
    await this.setState({
      connections: { connectedSites },
    })
  }

  /**
   * Check if an origin is connected
   * Origin is normalized for consistent matching
   */
  isConnected(origin: string): boolean {
    return this.state.connections.connectedSites.some((s) =>
      originsMatch(s.origin, origin)
    )
  }

  /**
   * Get connected accounts for an origin
   * Returns accounts with the currently selected account first
   */
  getConnectedAccounts(origin: string): Address[] {
    const site = this.state.connections.connectedSites.find((s) =>
      originsMatch(s.origin, origin)
    )

    if (!site?.accounts || site.accounts.length === 0) {
      return []
    }

    const accounts = [...site.accounts]
    const selectedAccount = this.state.accounts.selectedAccount

    // Move selected account to first position if it's connected to this site
    if (selectedAccount && accounts.includes(selectedAccount)) {
      return [selectedAccount, ...accounts.filter((a) => a !== selectedAccount)]
    }

    return accounts
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

  // Asset actions

  /**
   * Add a token to the tracked tokens for a chain
   */
  async addToken(chainId: number, token: WalletToken): Promise<void> {
    const normalizedAddress = token.address.toLowerCase() as Address
    const tokensByChain = { ...this.state.assets.tokensByChain }

    if (!tokensByChain[chainId]) {
      tokensByChain[chainId] = {}
    }

    tokensByChain[chainId] = {
      ...tokensByChain[chainId],
      [normalizedAddress]: {
        ...token,
        address: normalizedAddress,
      },
    }

    await this.setState({
      assets: {
        ...this.state.assets,
        tokensByChain,
      },
    })
  }

  /**
   * Remove a token from tracked tokens
   */
  async removeToken(chainId: number, tokenAddress: Address): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase()
    const tokensByChain = { ...this.state.assets.tokensByChain }

    if (tokensByChain[chainId]) {
      const chainTokens = { ...tokensByChain[chainId] }
      delete chainTokens[normalizedAddress]
      tokensByChain[chainId] = chainTokens
    }

    await this.setState({
      assets: {
        ...this.state.assets,
        tokensByChain,
      },
    })
  }

  /**
   * Get all tokens for a chain
   */
  getTokensForChain(chainId: number): WalletToken[] {
    const chainTokens = this.state.assets.tokensByChain[chainId]
    if (!chainTokens) return []
    return Object.values(chainTokens).filter((t) => t.isVisible)
  }

  /**
   * Get a specific token
   */
  getToken(chainId: number, tokenAddress: Address): WalletToken | undefined {
    const normalizedAddress = tokenAddress.toLowerCase()
    return this.state.assets.tokensByChain[chainId]?.[normalizedAddress]
  }

  /**
   * Update token visibility
   */
  async setTokenVisibility(
    chainId: number,
    tokenAddress: Address,
    isVisible: boolean
  ): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase()
    const token = this.state.assets.tokensByChain[chainId]?.[normalizedAddress]

    if (!token) return

    await this.addToken(chainId, { ...token, isVisible })
  }

  /**
   * Update cached balance for a token
   */
  async updateTokenBalance(
    chainId: number,
    account: Address,
    tokenAddress: Address,
    balance: string
  ): Promise<void> {
    const normalizedToken = tokenAddress.toLowerCase()
    const normalizedAccount = account.toLowerCase()

    const balanceCache = { ...this.state.assets.balanceCache }
    if (!balanceCache[chainId]) {
      balanceCache[chainId] = {}
    }
    if (!balanceCache[chainId][normalizedAccount]) {
      balanceCache[chainId][normalizedAccount] = {}
    }
    balanceCache[chainId][normalizedAccount] = {
      ...balanceCache[chainId][normalizedAccount],
      [normalizedToken]: balance,
    }

    const lastRefresh = { ...this.state.assets.lastRefresh }
    if (!lastRefresh[chainId]) {
      lastRefresh[chainId] = {}
    }
    lastRefresh[chainId][normalizedAccount] = Date.now()

    await this.setState({
      assets: {
        ...this.state.assets,
        balanceCache,
        lastRefresh,
      },
    })
  }

  /**
   * Get cached balance for a token
   */
  getCachedBalance(
    chainId: number,
    account: Address,
    tokenAddress: Address
  ): string | undefined {
    const normalizedToken = tokenAddress.toLowerCase()
    const normalizedAccount = account.toLowerCase()
    return this.state.assets.balanceCache[chainId]?.[normalizedAccount]?.[
      normalizedToken
    ]
  }

  /**
   * Clear balance cache for a chain (e.g., on chain switch)
   */
  async clearBalanceCache(chainId?: number): Promise<void> {
    if (chainId !== undefined) {
      const balanceCache = { ...this.state.assets.balanceCache }
      delete balanceCache[chainId]
      const lastRefresh = { ...this.state.assets.lastRefresh }
      delete lastRefresh[chainId]

      await this.setState({
        assets: {
          ...this.state.assets,
          balanceCache,
          lastRefresh,
        },
      })
    } else {
      await this.setState({
        assets: {
          ...this.state.assets,
          balanceCache: {},
          lastRefresh: {},
        },
      })
    }
  }
}

// Singleton instance
export const walletState = new WalletStateManager()
