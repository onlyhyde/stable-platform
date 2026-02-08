import type { Address } from 'viem'
import { create } from 'zustand'
import { DEFAULT_NETWORKS, MESSAGE_TYPES } from '../../shared/constants'
import type { Account, Network, PendingTransaction, WalletState } from '../../types'

type Page =
  | 'home'
  | 'send'
  | 'receive'
  | 'activity'
  | 'settings'
  | 'bank'
  | 'buy'
  | 'modules'
  | 'dashboard'
  | 'swap'
  | 'txDetail'

interface UIWalletState {
  // Keyring state
  isInitialized: boolean
  isUnlocked: boolean

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

  // Transaction detail
  selectedTxId: string | null

  // Balances (cached)
  balances: Record<Address, bigint>

  // Actions
  setPage: (page: Page) => void
  setSelectedTxId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  selectAccount: (address: Address) => void
  selectNetwork: (chainId: number) => void
  updateBalance: (address: Address, balance: bigint) => void
  syncWithBackground: () => Promise<void>

  // Wallet actions
  createWallet: (password: string) => Promise<{ mnemonic: string; address: Address }>
  restoreWallet: (password: string, mnemonic: string) => Promise<Address>
  unlockWallet: (password: string) => Promise<boolean>
  lockWallet: () => Promise<void>
  importPrivateKey: (privateKey: string) => Promise<Address>
  addAccount: () => Promise<Address>

  // Network actions
  addNetwork: (network: Network) => Promise<void>
  removeNetwork: (chainId: number) => Promise<void>
}

export const useWalletStore = create<UIWalletState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isUnlocked: false,
  accounts: [],
  selectedAccount: null,
  networks: DEFAULT_NETWORKS,
  selectedChainId: DEFAULT_NETWORKS[0]?.chainId ?? 31337,
  pendingTransactions: [],
  history: [],
  selectedTxId: null,
  currentPage: 'home',
  isLoading: true,
  error: null,
  balances: {},

  // Actions
  setPage: (page) => set({ currentPage: page }),
  setSelectedTxId: (id) => set({ selectedTxId: id }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  selectAccount: async (address) => {
    set({ selectedAccount: address })
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

      // Get keyring state first
      const keyringResponse = await chrome.runtime.sendMessage({
        type: 'GET_KEYRING_STATE',
        id: `keyring-${Date.now()}`,
        payload: {},
      })

      const keyringState = keyringResponse?.payload
      if (keyringState) {
        set({
          isInitialized: keyringState.isInitialized ?? false,
          isUnlocked: keyringState.isUnlocked ?? false,
        })
      }

      // Get wallet state
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_UPDATE,
        id: `sync-${Date.now()}`,
        payload: {},
      })

      const state = response?.payload as WalletState | undefined

      if (state) {
        // Defensive checks for nested properties
        const accounts = state.accounts?.accounts ?? []
        const selectedAccount = state.accounts?.selectedAccount ?? null
        const networks = state.networks?.networks ?? DEFAULT_NETWORKS
        const selectedChainId =
          state.networks?.selectedChainId ?? DEFAULT_NETWORKS[0]?.chainId ?? 31337
        const pendingTransactions = state.transactions?.pendingTransactions ?? []
        const history = state.transactions?.history ?? []

        set({
          accounts,
          selectedAccount,
          networks,
          selectedChainId,
          pendingTransactions,
          history,
        })
      }
    } catch {
      set({ error: 'Failed to sync with wallet' })
    } finally {
      set({ isLoading: false })
    }
  },

  // Wallet management actions
  createWallet: async (password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_NEW_WALLET',
        id: `create-${Date.now()}`,
        payload: { password },
      })

      if (response?.payload?.mnemonic && response?.payload?.address) {
        set({
          isInitialized: true,
          isUnlocked: true,
        })
        await get().syncWithBackground()
        return {
          mnemonic: response.payload.mnemonic,
          address: response.payload.address as Address,
        }
      }
      throw new Error('Failed to create wallet')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create wallet'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  restoreWallet: async (password: string, mnemonic: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RESTORE_WALLET',
        id: `restore-${Date.now()}`,
        payload: { password, mnemonic },
      })

      if (response?.payload?.address) {
        set({
          isInitialized: true,
          isUnlocked: true,
        })
        await get().syncWithBackground()
        return response.payload.address as Address
      }
      throw new Error('Failed to restore wallet')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore wallet'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  unlockWallet: async (password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UNLOCK_WALLET',
        id: `unlock-${Date.now()}`,
        payload: { password },
      })

      if (response?.payload?.success) {
        set({ isUnlocked: true })
        await get().syncWithBackground()
        return true
      }
      throw new Error('Invalid password')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock wallet'
      set({ error: message })
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  lockWallet: async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'LOCK_WALLET',
        id: `lock-${Date.now()}`,
        payload: {},
      })
      set({ isUnlocked: false })
    } catch {
      // Silent fail
    }
  },

  importPrivateKey: async (privateKey: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_PRIVATE_KEY',
        id: `import-${Date.now()}`,
        payload: { privateKey },
      })

      if (response?.payload?.address) {
        await get().syncWithBackground()
        return response.payload.address as Address
      }
      throw new Error('Failed to import account')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import account'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  addAccount: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_HD_ACCOUNT',
        id: `add-account-${Date.now()}`,
        payload: {},
      })

      if (response?.payload?.address) {
        await get().syncWithBackground()
        return response.payload.address as Address
      }
      throw new Error('Failed to add account')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add account'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  addNetwork: async (network: Network) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_NETWORK',
        id: `add-network-${Date.now()}`,
        payload: { network },
      })

      if (response?.payload?.success) {
        await get().syncWithBackground()
      } else {
        throw new Error(response?.payload?.error ?? 'Failed to add network')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add network'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  removeNetwork: async (chainId: number) => {
    set({ isLoading: true, error: null })
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REMOVE_NETWORK',
        id: `remove-network-${Date.now()}`,
        payload: { chainId },
      })

      if (response?.payload?.success) {
        await get().syncWithBackground()
      } else {
        throw new Error(response?.payload?.error ?? 'Failed to remove network')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove network'
      set({ error: message })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },
}))

// Initialize sync on first load
if (typeof chrome !== 'undefined' && chrome.runtime) {
  useWalletStore.getState().syncWithBackground()
}
