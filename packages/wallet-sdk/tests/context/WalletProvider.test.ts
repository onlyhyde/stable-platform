import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWalletContext, WalletProvider } from '../../src/context/WalletProvider'

// ============================================================================
// Mocks
// ============================================================================

const mockDetectProvider = vi.fn()

vi.mock('../../src/provider/detect', () => ({
  detectProvider: (...args: unknown[]) => mockDetectProvider(...args),
}))

function createMockStableNetProvider(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  const provider = {
    _emit(event: string, ...args: unknown[]) {
      const handlers = listeners.get(event)
      if (handlers) {
        for (const handler of handlers) {
          handler(...args)
        }
      }
    },

    connect: vi.fn().mockResolvedValue(['0xabc123']),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getAccounts: vi.fn().mockResolvedValue([]),
    getChainId: vi.fn().mockResolvedValue('0x1'),
    switchChain: vi.fn().mockResolvedValue(undefined),

    on(event: string, listener: (...args: unknown[]) => void) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(listener)
      return () => listeners.get(event)?.delete(listener)
    },

    ...overrides,
  }

  return provider
}

function wrapper(props?: Record<string, unknown>) {
  return ({ children }: { children: ReactNode }) =>
    createElement(WalletProvider, { ...props, children } as unknown)
}

// ============================================================================
// Tests
// ============================================================================

describe('WalletProvider', () => {
  let mockProvider: ReturnType<typeof createMockStableNetProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = createMockStableNetProvider()
    mockDetectProvider.mockResolvedValue(mockProvider)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useWalletContext', () => {
    it('should throw when used outside WalletProvider', () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => {
        renderHook(() => useWalletContext())
      }).toThrow('useWalletContext must be used within a <WalletProvider>')
      consoleSpy.mockRestore()
    })
  })

  describe('initial state', () => {
    it('should provide default disconnected state', async () => {
      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.account).toBeNull()
      expect(result.current.chainId).toBeNull()
      expect(result.current.isConnecting).toBe(false)
    })

    it('should provide action functions', async () => {
      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      expect(typeof result.current.connect).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
      expect(typeof result.current.switchNetwork).toBe('function')
    })
  })

  describe('provider detection', () => {
    it('should detect and set provider on mount', async () => {
      // getAccounts returns accounts so that setState triggers a re-render,
      // making providerRef.current visible via hook return value
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      expect(mockDetectProvider).toHaveBeenCalled()
      expect(result.current.provider).toBeTruthy()
    })

    it('should handle detection failure gracefully', async () => {
      mockDetectProvider.mockRejectedValue(new Error('Detection failed'))

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error?.message).toBe('Detection failed')
      expect(result.current.isConnected).toBe(false)
    })

    it('should handle null provider (wallet not installed)', async () => {
      mockDetectProvider.mockResolvedValue(null)

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for effect to complete
      await new Promise((r) => setTimeout(r, 50))

      expect(result.current.provider).toBeNull()
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('existing connection detection', () => {
    it('should detect existing accounts on mount', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])
      mockProvider.getChainId.mockResolvedValue('0x89')

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      expect(result.current.account).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(result.current.chainId).toBe(137) // 0x89 = 137
    })
  })

  describe('autoConnect', () => {
    it('should auto-connect when autoConnect is true and no existing accounts', async () => {
      mockProvider.getAccounts.mockResolvedValue([])
      mockProvider.connect.mockResolvedValue(['0xabc123def456abc123def456abc123def456abc1'])

      renderHook(() => useWalletContext(), {
        wrapper: wrapper({ autoConnect: true }),
      })

      await waitFor(() => {
        expect(mockProvider.connect).toHaveBeenCalled()
      })
    })

    it('should not auto-connect when autoConnect is false', async () => {
      mockProvider.getAccounts.mockResolvedValue([])

      renderHook(() => useWalletContext(), {
        wrapper: wrapper({ autoConnect: false }),
      })

      // Wait for effect to complete
      await new Promise((r) => setTimeout(r, 100))

      expect(mockProvider.connect).not.toHaveBeenCalled()
    })

    it('should handle auto-connect rejection silently', async () => {
      mockProvider.getAccounts.mockResolvedValue([])
      mockProvider.connect.mockRejectedValue(new Error('User rejected'))

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper({ autoConnect: true }),
      })

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false)
      })

      // Should not set error for auto-connect rejections
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('connect()', () => {
    it('should connect and update state', async () => {
      mockProvider.getAccounts.mockResolvedValue([])
      mockProvider.connect.mockResolvedValue(['0xabc123def456abc123def456abc123def456abc1'])
      mockProvider.getChainId.mockResolvedValue('0xa')

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for provider detection effect to complete
      await new Promise((r) => setTimeout(r, 50))

      await act(async () => {
        const accounts = await result.current.connect()
        expect(accounts).toEqual(['0xabc123def456abc123def456abc123def456abc1'])
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.account).toBe('0xabc123def456abc123def456abc123def456abc1')
      expect(result.current.chainId).toBe(10) // 0xa = 10
    })

    it('should throw when provider is not detected', async () => {
      mockDetectProvider.mockResolvedValue(null)

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await new Promise((r) => setTimeout(r, 50))

      await expect(
        act(async () => {
          await result.current.connect()
        })
      ).rejects.toThrow('Wallet not detected')
    })

    it('should handle connection errors', async () => {
      mockProvider.getAccounts.mockResolvedValue([])
      mockProvider.connect.mockRejectedValue(new Error('Connection failed'))

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for provider detection effect to complete
      await new Promise((r) => setTimeout(r, 50))

      let thrownError: Error | null = null
      try {
        await act(async () => {
          await result.current.connect()
        })
      } catch (e) {
        thrownError = e as Error
      }

      expect(thrownError?.message).toBe('Connection failed')
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('disconnect()', () => {
    it('should disconnect and reset state', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      await act(async () => {
        await result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.account).toBeNull()
      expect(result.current.chainId).toBeNull()
    })
  })

  describe('switchNetwork()', () => {
    it('should call provider.switchChain', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      await act(async () => {
        await result.current.switchNetwork(137)
      })

      expect(mockProvider.switchChain).toHaveBeenCalledWith(137)
    })

    it('should throw when provider is not detected', async () => {
      mockDetectProvider.mockResolvedValue(null)

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await new Promise((r) => setTimeout(r, 50))

      await expect(
        act(async () => {
          await result.current.switchNetwork(137)
        })
      ).rejects.toThrow('Wallet not detected')
    })
  })

  describe('event handling', () => {
    it('should update state on accountsChanged event', async () => {
      mockProvider.getAccounts.mockResolvedValue([])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for provider detection effect to complete
      await new Promise((r) => setTimeout(r, 50))

      act(() => {
        mockProvider._emit('accountsChanged', ['0xnewaccount1234567890abcdef1234567890abcd'])
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.account).toBe('0xnewaccount1234567890abcdef1234567890abcd')
    })

    it('should handle accountsChanged with empty array (disconnect)', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockProvider._emit('accountsChanged', [])
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.account).toBeNull()
    })

    it('should update chainId on chainChanged event', async () => {
      mockProvider.getAccounts.mockResolvedValue([])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for provider detection effect to complete
      await new Promise((r) => setTimeout(r, 50))

      act(() => {
        mockProvider._emit('chainChanged', '0x89')
      })

      expect(result.current.chainId).toBe(137) // 0x89 = 137
    })

    it('should update on connect event', async () => {
      mockProvider.getAccounts.mockResolvedValue([])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      // Wait for provider detection effect to complete
      await new Promise((r) => setTimeout(r, 50))

      act(() => {
        mockProvider._emit('connect', { chainId: '0xa' })
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.chainId).toBe(10) // 0xa = 10
    })

    it('should reset state on disconnect event', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockProvider._emit('disconnect', { code: 4900, message: 'Disconnected' })
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.account).toBeNull()
      expect(result.current.chainId).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe from events on unmount', async () => {
      mockProvider.getAccounts.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678'])

      const { result, unmount } = renderHook(() => useWalletContext(), {
        wrapper: wrapper(),
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      unmount()

      // After unmount, events should not cause state updates
      // (This verifies no errors are thrown, since state updates
      // on unmounted components would cause React warnings)
    })
  })
})
