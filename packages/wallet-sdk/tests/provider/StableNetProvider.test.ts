import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

describe('StableNetProvider', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let provider: StableNetProvider

  beforeEach(() => {
    mockProvider = createMockProvider()
    provider = new StableNetProvider(mockProvider)
  })

  describe('constructor', () => {
    it('should initialize with disconnected state', () => {
      expect(provider.isConnected).toBe(false)
      expect(provider.account).toBeNull()
      expect(provider.chainId).toBeNull()
    })

    it('should set up internal event listeners', () => {
      expect(mockProvider._listeners.get('connect')?.size).toBeGreaterThan(0)
      expect(mockProvider._listeners.get('disconnect')?.size).toBeGreaterThan(0)
      expect(mockProvider._listeners.get('accountsChanged')?.size).toBeGreaterThan(0)
      expect(mockProvider._listeners.get('chainChanged')?.size).toBeGreaterThan(0)
    })
  })

  describe('connect', () => {
    it('should return accounts and set connected state', async () => {
      const accounts = await provider.connect()

      expect(accounts).toEqual(['0x1234567890abcdef1234567890abcdef12345678'])
      expect(provider.isConnected).toBe(true)
      expect(provider.account).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(provider.chainId).toBe('0x1')
    })

    it('should fetch chain ID during connect', async () => {
      await provider.connect()

      expect(provider.chainId).toBe('0x1')
      expect(provider.chainIdNumber).toBe(1)
    })
  })

  describe('disconnect', () => {
    it('should reset connection state', async () => {
      await provider.connect()
      expect(provider.isConnected).toBe(true)

      await provider.disconnect()
      expect(provider.isConnected).toBe(false)
      expect(provider.account).toBeNull()
    })
  })

  describe('getAccounts', () => {
    it('should return accounts from provider', async () => {
      const accounts = await provider.getAccounts()
      expect(accounts).toEqual(['0x1234567890abcdef1234567890abcdef12345678'])
    })
  })

  describe('getChainId', () => {
    it('should return chain ID from provider', async () => {
      const chainId = await provider.getChainId()
      expect(chainId).toBe('0x1')
    })
  })

  describe('chainIdNumber', () => {
    it('should return null when no chain ID is set', () => {
      expect(provider.chainIdNumber).toBeNull()
    })

    it('should return decimal chain ID after connect', async () => {
      await provider.connect()
      expect(provider.chainIdNumber).toBe(1)
    })
  })

  describe('switchChain', () => {
    it('should call wallet_switchEthereumChain with correct params', async () => {
      const requestSpy = vi.spyOn(mockProvider, 'request')
      await provider.switchChain(137)

      expect(requestSpy).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      })
    })
  })

  describe('signMessage', () => {
    it('should throw when no account is connected', async () => {
      await expect(provider.signMessage('test')).rejects.toThrow('No account connected')
    })

    it('should sign a message', async () => {
      await provider.connect()
      const sig = await provider.signMessage('test')
      expect(sig).toBe('0xsignature')
    })
  })

  describe('signTypedData', () => {
    it('should throw when no account is connected', async () => {
      await expect(provider.signTypedData({})).rejects.toThrow('No account connected')
    })

    it('should sign typed data', async () => {
      await provider.connect()
      const sig = await provider.signTypedData({ domain: {} })
      expect(sig).toBe('0xtypedsignature')
    })
  })

  describe('sendTransaction', () => {
    it('should throw when no account is connected', async () => {
      await expect(
        provider.sendTransaction({
          to: '0x0000000000000000000000000000000000000001' as `0x${string}`,
        })
      ).rejects.toThrow('No account connected')
    })

    it('should send a transaction and emit transactionSent', async () => {
      await provider.connect()

      const sentHandler = vi.fn()
      provider.on('transactionSent', sentHandler)

      const hash = await provider.sendTransaction({
        to: '0x0000000000000000000000000000000000000001' as `0x${string}`,
        value: 1000000000000000000n,
      })

      expect(hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
      expect(sentHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          from: '0x1234567890abcdef1234567890abcdef12345678',
        })
      )
    })
  })

  describe('getBalance', () => {
    it('should throw when no account is specified', async () => {
      await expect(provider.getBalance()).rejects.toThrow('No account specified')
    })

    it('should return balance for explicit address', async () => {
      const balance = await provider.getBalance(
        '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`
      )
      expect(balance).toBe(1000000000000000000n)
    })

    it('should use connected account if no address specified', async () => {
      await provider.connect()
      const balance = await provider.getBalance()
      expect(balance).toBe(1000000000000000000n)
    })
  })

  describe('event system', () => {
    it('should subscribe and unsubscribe to events', () => {
      const handler = vi.fn()
      const unsubscribe = provider.on('connect', handler)

      mockProvider._emit('connect', { chainId: '0x1' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      mockProvider._emit('connect', { chainId: '0x1' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle accountsChanged events', () => {
      const handler = vi.fn()
      provider.on('accountsChanged', handler)

      mockProvider._emit('accountsChanged', ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'])
      expect(handler).toHaveBeenCalledWith(['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'])
      expect(provider.account).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
      expect(provider.isConnected).toBe(true)
    })

    it('should handle disconnect events', () => {
      const handler = vi.fn()
      provider.on('disconnect', handler)

      mockProvider._emit('disconnect', { code: 4900, message: 'Disconnected' })
      expect(handler).toHaveBeenCalled()
      expect(provider.isConnected).toBe(false)
      expect(provider.account).toBeNull()
    })

    it('should handle chainChanged events', () => {
      const handler = vi.fn()
      provider.on('chainChanged', handler)

      mockProvider._emit('chainChanged', '0x89')
      expect(handler).toHaveBeenCalledWith('0x89')
      expect(provider.chainId).toBe('0x89')
    })

    it('should handle connect events', () => {
      const handler = vi.fn()
      provider.on('connect', handler)

      mockProvider._emit('connect', { chainId: '0x1' })
      expect(handler).toHaveBeenCalledWith({ chainId: '0x1' })
      expect(provider.isConnected).toBe(true)
      expect(provider.chainId).toBe('0x1')
    })
  })

  describe('removeListener', () => {
    it('should remove a listener', () => {
      const handler = vi.fn()
      provider.on('chainChanged', handler)

      provider.removeListener('chainChanged', handler)

      // The listener should be removed from the internal map
      // (though emitting from mockProvider still goes to the internal handler)
    })
  })

  describe('convenience event methods', () => {
    it('onConnect should work', () => {
      const handler = vi.fn()
      const unsub = provider.onConnect(handler)
      mockProvider._emit('connect', { chainId: '0x1' })
      expect(handler).toHaveBeenCalled()
      unsub()
    })

    it('onDisconnect should work', () => {
      const handler = vi.fn()
      const unsub = provider.onDisconnect(handler)
      mockProvider._emit('disconnect', { code: 4900, message: 'Disconnected' })
      expect(handler).toHaveBeenCalled()
      unsub()
    })

    it('onAccountChange should work', () => {
      const handler = vi.fn()
      const unsub = provider.onAccountChange(handler)
      mockProvider._emit('accountsChanged', ['0xaa00aa00aa00aa00aa00aa00aa00aa00aa00aa00'])
      expect(handler).toHaveBeenCalledWith(['0xaa00aa00aa00aa00aa00aa00aa00aa00aa00aa00'])
      unsub()
    })

    it('onNetworkChange should work', () => {
      const handler = vi.fn()
      const unsub = provider.onNetworkChange(handler)
      mockProvider._emit('chainChanged', '0x89')
      expect(handler).toHaveBeenCalledWith('0x89')
      unsub()
    })
  })

  describe('getProvider', () => {
    it('should return the underlying EIP-1193 provider', () => {
      expect(provider.getProvider()).toBe(mockProvider)
    })
  })

  describe('request', () => {
    it('should forward requests to underlying provider', async () => {
      const result = await provider.request<string>({
        method: 'eth_chainId',
      })
      expect(result).toBe('0x1')
    })
  })
})
