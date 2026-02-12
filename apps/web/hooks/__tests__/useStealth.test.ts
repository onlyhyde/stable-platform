import { act, renderHook } from '@testing-library/react'
import type { Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStealth } from '../useStealth'

// Mock the context provider
const mockContext = {
  stealthServerUrl: 'http://localhost:4339',
  stealthAnnouncer: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
  chainId: 31337,
  bundlerUrl: 'http://localhost:4337',
  entryPoint: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}

vi.mock('@/providers', () => ({
  useStableNetContext: () => mockContext,
}))

// Mock wallet signing
const _mockSignMessage = vi.fn()
const _mockGetSpendingKey = vi.fn()
const _mockGetViewingKey = vi.fn()

describe('useStealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateOwnMetaAddress', () => {
    it('should derive stealth keys from wallet', async () => {
      // Mock wallet functions to return deterministic keys
      const mockSpendingPubKey = `0x${'11'.repeat(33)}` as Hex
      const mockViewingPubKey = `0x${'22'.repeat(33)}` as Hex

      const { result } = renderHook(() =>
        useStealth({
          getSpendingPublicKey: async () => mockSpendingPubKey,
          getViewingPublicKey: async () => mockViewingPubKey,
        })
      )

      await act(async () => {
        await result.current.generateOwnMetaAddress()
      })

      expect(result.current.stealthMetaAddress).not.toBeNull()
      expect(result.current.stealthMetaAddress?.spendingPubKey).toBe(mockSpendingPubKey)
      expect(result.current.stealthMetaAddress?.viewingPubKey).toBe(mockViewingPubKey)
      expect(result.current.stealthMetaAddress?.prefix).toBe('st:eth')
    })

    it('should handle key derivation errors', async () => {
      const { result } = renderHook(() =>
        useStealth({
          getSpendingPublicKey: async () => {
            throw new Error('Wallet locked')
          },
          getViewingPublicKey: async () => `0x${'22'.repeat(33)}` as Hex,
        })
      )

      await act(async () => {
        await result.current.generateOwnMetaAddress()
      })

      expect(result.current.stealthMetaAddress).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toContain('Wallet locked')
    })

    it('should generate valid stealth meta address URI', async () => {
      const mockSpendingPubKey = `0x${'aa'.repeat(33)}` as Hex
      const mockViewingPubKey = `0x${'bb'.repeat(33)}` as Hex

      const { result } = renderHook(() =>
        useStealth({
          getSpendingPublicKey: async () => mockSpendingPubKey,
          getViewingPublicKey: async () => mockViewingPubKey,
        })
      )

      await act(async () => {
        await result.current.generateOwnMetaAddress()
      })

      const uri = result.current.getStealthMetaAddressURI()
      expect(uri).toMatch(/^st:eth:0x[a-fA-F0-9]+$/)
      // URI should contain both keys
      expect(uri).toContain('aa'.repeat(33))
      expect(uri).toContain('bb'.repeat(33))
    })
  })

  describe('registerStealthMetaAddress', () => {
    it('should sign and register meta address on-chain', async () => {
      const mockSpendingPubKey = `0x${'11'.repeat(33)}` as Hex
      const mockViewingPubKey = `0x${'22'.repeat(33)}` as Hex
      const mockSignature = `0x${'ff'.repeat(65)}` as Hex

      const mockSignTypedData = vi.fn().mockResolvedValue(mockSignature)
      const mockRegisterOnChain = vi.fn().mockResolvedValue({
        transactionHash: `0x${'ab'.repeat(32)}`,
      })

      const { result } = renderHook(() =>
        useStealth({
          getSpendingPublicKey: async () => mockSpendingPubKey,
          getViewingPublicKey: async () => mockViewingPubKey,
          signTypedData: mockSignTypedData,
          registerOnChain: mockRegisterOnChain,
        })
      )

      // First generate the meta address
      await act(async () => {
        await result.current.generateOwnMetaAddress()
      })

      // Then register it
      let success: boolean
      await act(async () => {
        success = await result.current.registerStealthMetaAddress()
      })

      expect(success!).toBe(true)
      expect(mockSignTypedData).toHaveBeenCalled()
      expect(mockRegisterOnChain).toHaveBeenCalledWith(
        expect.objectContaining({
          metaAddress: expect.any(String),
          signature: mockSignature,
        })
      )
    })

    it('should handle registration failure', async () => {
      const mockSpendingPubKey = `0x${'11'.repeat(33)}` as Hex
      const mockViewingPubKey = `0x${'22'.repeat(33)}` as Hex
      const mockSignature = `0x${'ff'.repeat(65)}` as Hex

      const mockSignTypedData = vi.fn().mockResolvedValue(mockSignature)
      const mockRegisterOnChain = vi.fn().mockRejectedValue(new Error('Transaction failed'))

      const { result } = renderHook(() =>
        useStealth({
          getSpendingPublicKey: async () => mockSpendingPubKey,
          getViewingPublicKey: async () => mockViewingPubKey,
          signTypedData: mockSignTypedData,
          registerOnChain: mockRegisterOnChain,
        })
      )

      await act(async () => {
        await result.current.generateOwnMetaAddress()
      })

      let success: boolean
      await act(async () => {
        success = await result.current.registerStealthMetaAddress()
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBeTruthy()
    })

    it('should not register if meta address not generated', async () => {
      const { result } = renderHook(() => useStealth({}))

      let success: boolean
      await act(async () => {
        success = await result.current.registerStealthMetaAddress()
      })

      expect(success!).toBe(false)
    })
  })

  describe('generateStealthAddress', () => {
    it('should call stealth server to generate address', async () => {
      const mockStealthAddress = '0x1234567890123456789012345678901234567890'
      const mockEphemeralPubKey = `0x${'cc'.repeat(33)}` as Hex
      const mockViewTag = 42

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stealthAddress: mockStealthAddress,
          ephemeralPubKey: mockEphemeralPubKey,
          viewTag: mockViewTag,
        }),
      } as Response)

      const { result } = renderHook(() => useStealth({}))

      const recipientMetaAddress = `st:eth:0x${'aa'.repeat(33)}${'bb'.repeat(33)}`

      let stealthResult: unknown
      await act(async () => {
        stealthResult = await result.current.generateStealthAddress(recipientMetaAddress)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4339/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(recipientMetaAddress),
        })
      )

      expect(stealthResult).toMatchObject({
        stealthAddress: mockStealthAddress,
        ephemeralPubKey: mockEphemeralPubKey,
        viewTag: mockViewTag,
      })
    })
  })

  describe('parseStealthMetaAddress', () => {
    it('should parse valid stealth meta address URI', () => {
      const { result } = renderHook(() => useStealth({}))

      const spendingKey = 'aa'.repeat(33)
      const viewingKey = 'bb'.repeat(33)
      const uri = `st:eth:0x${spendingKey}${viewingKey}`

      const parsed = result.current.parseStealthMetaAddress(uri)

      expect(parsed).not.toBeNull()
      expect(parsed?.prefix).toBe('st:eth')
      expect(parsed?.spendingPubKey).toBe(`0x${spendingKey}`)
      expect(parsed?.viewingPubKey).toBe(`0x${viewingKey}`)
    })

    it('should return null for invalid URI format', () => {
      const { result } = renderHook(() => useStealth({}))

      expect(result.current.parseStealthMetaAddress('invalid')).toBeNull()
      expect(result.current.parseStealthMetaAddress('st:btc:0x123')).toBeNull()
      expect(result.current.parseStealthMetaAddress('st:eth:0x123')).toBeNull() // Too short
    })
  })

  describe('sendToStealthAddress - ERC-5564 announcement', () => {
    it('should send transaction to stealthAnnouncer contract', async () => {
      const mockSendTransaction = vi.fn().mockResolvedValue({
        hash: `0x${'dd'.repeat(32)}` as Hex,
      })

      // Mock the stealth server /announce call
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      const { result } = renderHook(() =>
        useStealth({
          sendTransaction: mockSendTransaction,
        })
      )

      await act(async () => {
        await result.current.sendToStealthAddress({
          stealthAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          ephemeralPubKey: `0x${'ee'.repeat(33)}` as Hex,
          value: BigInt('1000000000000000000'),
        })
      })

      // Should call sendTransaction with stealthAnnouncer as `to` (not the stealth address)
      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockContext.stealthAnnouncer,
        })
      )
    })

    it('should encode ERC-5564 announce calldata', async () => {
      const mockSendTransaction = vi.fn().mockResolvedValue({
        hash: `0x${'dd'.repeat(32)}` as Hex,
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      const { result } = renderHook(() =>
        useStealth({
          sendTransaction: mockSendTransaction,
        })
      )

      await act(async () => {
        await result.current.sendToStealthAddress({
          stealthAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          ephemeralPubKey: `0x${'ee'.repeat(33)}` as Hex,
          value: BigInt('1000000000000000000'),
        })
      })

      // calldata should contain announce function selector and encoded params
      const callArgs = mockSendTransaction.mock.calls[0][0]
      expect(callArgs.data).toBeDefined()
      expect(callArgs.data.startsWith('0x')).toBe(true)
    })

    it('should pass value to announcer contract for ETH stealth sends', async () => {
      const mockSendTransaction = vi.fn().mockResolvedValue({
        hash: `0x${'dd'.repeat(32)}` as Hex,
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      const { result } = renderHook(() =>
        useStealth({
          sendTransaction: mockSendTransaction,
        })
      )

      const sendValue = BigInt('1000000000000000000')

      await act(async () => {
        await result.current.sendToStealthAddress({
          stealthAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          ephemeralPubKey: `0x${'ee'.repeat(33)}` as Hex,
          value: sendValue,
        })
      })

      // Value should be forwarded to the announcer contract
      const callArgs = mockSendTransaction.mock.calls[0][0]
      expect(callArgs.value).toBe(sendValue)
    })

    it('should still register with stealth server as fallback', async () => {
      const mockSendTransaction = vi.fn().mockResolvedValue({
        hash: `0x${'dd'.repeat(32)}` as Hex,
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      const { result } = renderHook(() =>
        useStealth({
          sendTransaction: mockSendTransaction,
        })
      )

      await act(async () => {
        await result.current.sendToStealthAddress({
          stealthAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          ephemeralPubKey: `0x${'ee'.repeat(33)}` as Hex,
          value: BigInt('1000000000000000000'),
        })
      })

      // Should still call the stealth server /announce
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4339/announce',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  describe('scanAnnouncements', () => {
    it('should fetch and filter announcements for user', async () => {
      const mockAnnouncements = [
        {
          schemeId: 1,
          stealthAddress: '0x1111111111111111111111111111111111111111',
          ephemeralPubKey: `0x${'aa'.repeat(33)}`,
          viewTag: 42,
          caller: '0x2222222222222222222222222222222222222222',
          blockNumber: '1000',
          transactionHash: `0x${'bb'.repeat(32)}`,
          value: '1000000000000000000',
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ announcements: mockAnnouncements }),
      } as Response)

      const { result } = renderHook(() => useStealth({}))

      await act(async () => {
        await result.current.scanAnnouncements()
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/announcements'),
        expect.anything()
      )
      expect(result.current.announcements).toHaveLength(1)
    })
  })
})
