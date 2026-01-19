import { create } from 'zustand'
import type { Address } from 'viem'
import type { Account, Network, PendingTransaction, WalletState } from '../../types'
import { DEFAULT_NETWORKS, MESSAGE_TYPES } from '../../shared/constants'

type Page = 'home' | 'send' | 'receive' | 'activity' | 'settings'

interface UIWalletState {
  // Accounts
  accounts: Account[]
  selectedAccount: Address | null

  // Networks
  networks: Network[]
  selectedChainId: number

  // Transactions
  pendingTransactions: PendingTransaction[]
  history: PendingTransaction[]

  // UI State
  currentPage: Page
  isLoading: boolean
  error: string | null

  // Balances (cached)
  balances: Record<Address, bigint>

  // Actions
  setPage: (page: Page) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  selectAccount: (address: Address) => void
  selectNetwork: (chainId: number) => void
  updateBalance: (address: Address, balance: bigint) => void
  syncWithBackground: () => Promise<void>
}

export const useWalletStore = create<UIWalletState>((set) => ({
  // Initial state
  accounts: [],
  selectedAccount: null,
  networks: DEFAULT_NETWORKS,
  selectedChainId: DEFAULT_NETWORKS[0]?.chainId ?? 31337,
  pendingTransactions: [],
  history: [],
  currentPage: 'home',
  isLoading: false,
  error: null,
  balances: {},

  // Actions
  setPage: (page) => set({ currentPage: page }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  selectAccount: async (address) => {
    set({ selectedAccount: address })
    // Sync with background
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: `select-account-${Date.now()}`,
        payload: { action: 'selectAccount', address },
      })
    } catch {
      // Background might not be ready
    }
  },

  selectNetwork: async (chainId) => {
    set({ selectedChainId: chainId })
    // Sync with background
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: `select-network-${Date.now()}`,
        payload: { action: 'selectNetwork', chainId },
      })
    } catch {
      // Background might not be ready
    }
  },

  updateBalance: (address, balance) => {
    set((state) => ({
      balances: { ...state.balances, [address]: balance },
    }))
  },

  syncWithBackground: async () => {
    try {
      set({ isLoading: true })

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: `sync-${Date.now()}`,
        payload: {},
      })

      const state = response?.payload as WalletState | undefined

      if (state) {
        set({
          accounts: state.accounts.accounts,
          selectedAccount: state.accounts.selectedAccount,
          networks: state.networks.networks,
          selectedChainId: state.networks.selectedChainId,
          pendingTransactions: state.transactions.pendingTransactions,
          history: state.transactions.history,
        })
      }
    } catch {
      set({ error: 'Failed to sync with wallet' })
    } finally {
      set({ isLoading: false })
    }
  },
}))

// Initialize sync on first load
if (typeof chrome !== 'undefined' && chrome.runtime) {
  useWalletStore.getState().syncWithBackground()
}
