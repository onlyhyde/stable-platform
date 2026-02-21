import type { Address } from 'viem'
import { create } from 'zustand'
import { DEFAULT_NETWORKS, MESSAGE_TYPES } from '../../shared/constants'
import { SYNC_TIMEOUT_MS, sendMessageWithTimeout } from '../../shared/utils/messaging'
import type { Account, Network, PendingTransaction, WalletState } from '../../types'

/**
 * Convert a serialized transaction (BigInt fields as strings) back to
 * a proper PendingTransaction with bigint values.
 *
 * `sanitizeForMessage` in the background converts bigint → string for
 * JSON-safe message passing. This reverses that conversion.
 */
function deserializeTransaction(raw: Record<string, unknown>): PendingTransaction {
  const toBigInt = (v: unknown): bigint | undefined => {
    if (v === undefined || v === null) return undefined
    if (typeof v === 'bigint') return v
    if (typeof v === 'string' || typeof v === 'number') return BigInt(v)
    return undefined
  }

  const tokenTransfer = raw.tokenTransfer as Record<string, unknown> | undefined

  return {
    id: raw.id as string,
    from: raw.from as PendingTransaction['from'],
    to: raw.to as PendingTransaction['to'],
    value: toBigInt(raw.value) ?? 0n,
    data: raw.data as PendingTransaction['data'],
    chainId: raw.chainId as number,
    status: raw.status as PendingTransaction['status'],
    type: raw.type as PendingTransaction['type'],
    userOpHash: raw.userOpHash as PendingTransaction['userOpHash'],
    txHash: raw.txHash as PendingTransaction['txHash'],
    timestamp: raw.timestamp as number,
    gasUsed: toBigInt(raw.gasUsed),
    gasPrice: toBigInt(raw.gasPrice),
    maxFeePerGas: toBigInt(raw.maxFeePerGas),
    maxPriorityFeePerGas: toBigInt(raw.maxPriorityFeePerGas),
    blockNumber: toBigInt(raw.blockNumber),
    methodName: raw.methodName as string | undefined,
    tokenTransfer: tokenTransfer
      ? {
          tokenAddress: tokenTransfer.tokenAddress as PendingTransaction['from'],
          symbol: tokenTransfer.symbol as string,
          decimals: tokenTransfer.decimals as number,
          amount: toBigInt(tokenTransfer.amount) ?? 0n,
          direction: tokenTransfer.direction as 'in' | 'out',
        }
      : undefined,
    error: raw.error as string | undefined,
  }
}

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

  // Token selected for send (from Home token click)
  selectedSendToken: unknown | null

  // Balances (cached)
  balances: Record<Address, bigint>

  // Actions
  setPage: (page: Page) => void
  setSelectedTxId: (id: string | null) => void
  setSelectedSendToken: (token: unknown | null) => void
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
  updateNetwork: (chainId: number, updates: Partial<Network>) => Promise<void>
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
  selectedSendToken: null,
  currentPage: 'home',
  isLoading: true,
  error: null,
  balances: {},

  // Actions
  setPage: (page) => set({ currentPage: page }),
  setSelectedTxId: (id) => set({ selectedTxId: id }),
  setSelectedSendToken: (token) => set({ selectedSendToken: token }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  selectAccount: async (address) => {
    set({ selectedAccount: address })
    try {
      await sendMessageWithTimeout(
        {
          type: MESSAGE_TYPES.STATE_UPDATE,
          id: `select-account-${Date.now()}`,
          payload: { action: 'selectAccount', address },
        },
        SYNC_TIMEOUT_MS
      )
    } catch {
      // Background might not be ready
    }
  },

  selectNetwork: async (chainId) => {
    set({ selectedChainId: chainId })
    try {
      await sendMessageWithTimeout(
        {
          type: MESSAGE_TYPES.STATE_UPDATE,
          id: `select-network-${Date.now()}`,
          payload: { action: 'selectNetwork', chainId },
        },
        SYNC_TIMEOUT_MS
      )
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
      const keyringResponse = await sendMessageWithTimeout<{
        payload?: { isInitialized?: boolean; isUnlocked?: boolean }
      }>(
        {
          type: 'GET_KEYRING_STATE',
          id: `keyring-${Date.now()}`,
          payload: {},
        },
        SYNC_TIMEOUT_MS
      )

      const keyringState = keyringResponse?.payload
      if (keyringState) {
        set({
          isInitialized: keyringState.isInitialized ?? false,
          isUnlocked: keyringState.isUnlocked ?? false,
        })
      }

      // Get wallet state
      const response = await sendMessageWithTimeout<{
        payload?: WalletState
      }>(
        {
          type: MESSAGE_TYPES.STATE_UPDATE,
          id: `sync-${Date.now()}`,
          payload: {},
        },
        SYNC_TIMEOUT_MS
      )

      const state = response?.payload as WalletState | undefined

      if (state) {
        // Defensive checks for nested properties
        const accounts = state.accounts?.accounts ?? []
        const selectedAccount = state.accounts?.selectedAccount ?? null
        const networks = state.networks?.networks ?? DEFAULT_NETWORKS
        const selectedChainId =
          state.networks?.selectedChainId ?? DEFAULT_NETWORKS[0]?.chainId ?? 31337
        const pendingTransactions = (state.transactions?.pendingTransactions ?? []).map(
          (tx: unknown) => deserializeTransaction(tx as Record<string, unknown>)
        )
        const history = (state.transactions?.history ?? []).map(
          (tx: unknown) => deserializeTransaction(tx as Record<string, unknown>)
        )

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
      const response = await sendMessageWithTimeout<{
        payload?: { mnemonic?: string; address?: string }
      }>(
        {
          type: 'CREATE_NEW_WALLET',
          id: `create-${Date.now()}`,
          payload: { password },
        },
        SYNC_TIMEOUT_MS
      )

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
      const response = await sendMessageWithTimeout<{
        payload?: { address?: string }
      }>(
        {
          type: 'RESTORE_WALLET',
          id: `restore-${Date.now()}`,
          payload: { password, mnemonic },
        },
        SYNC_TIMEOUT_MS
      )

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
      const response = await sendMessageWithTimeout<{
        payload?: { success?: boolean }
      }>(
        {
          type: 'UNLOCK_WALLET',
          id: `unlock-${Date.now()}`,
          payload: { password },
        },
        SYNC_TIMEOUT_MS
      )

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
      await sendMessageWithTimeout(
        {
          type: 'LOCK_WALLET',
          id: `lock-${Date.now()}`,
          payload: {},
        },
        SYNC_TIMEOUT_MS
      )
      set({ isUnlocked: false })
    } catch {
      // Silent fail
    }
  },

  importPrivateKey: async (privateKey: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await sendMessageWithTimeout<{
        payload?: { address?: string; error?: { message?: string } }
      }>(
        {
          type: 'IMPORT_PRIVATE_KEY',
          id: `import-${Date.now()}`,
          payload: { privateKey },
        },
        SYNC_TIMEOUT_MS
      )

      if (response?.payload?.address) {
        await get().syncWithBackground()
        return response.payload.address as Address
      }
      const bgError = response?.payload?.error?.message
      throw new Error(bgError || 'Failed to import account')
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
      const response = await sendMessageWithTimeout<{
        payload?: { address?: string }
      }>(
        {
          type: 'ADD_HD_ACCOUNT',
          id: `add-account-${Date.now()}`,
          payload: {},
        },
        SYNC_TIMEOUT_MS
      )

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
      const response = await sendMessageWithTimeout<{
        payload?: { success?: boolean; error?: string }
      }>(
        {
          type: 'ADD_NETWORK',
          id: `add-network-${Date.now()}`,
          payload: { network },
        },
        SYNC_TIMEOUT_MS
      )

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
      const response = await sendMessageWithTimeout<{
        payload?: { success?: boolean; error?: string }
      }>(
        {
          type: 'REMOVE_NETWORK',
          id: `remove-network-${Date.now()}`,
          payload: { chainId },
        },
        SYNC_TIMEOUT_MS
      )

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

  updateNetwork: async (chainId: number, updates: Partial<Network>) => {
    set({ isLoading: true, error: null })
    try {
      const response = await sendMessageWithTimeout<{
        payload?: { success?: boolean; error?: string }
      }>(
        {
          type: 'UPDATE_NETWORK',
          id: `update-network-${Date.now()}`,
          payload: { chainId, updates },
        },
        SYNC_TIMEOUT_MS
      )

      if (response?.payload?.success) {
        await get().syncWithBackground()
      } else {
        throw new Error(response?.payload?.error ?? 'Failed to update network')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update network'
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
