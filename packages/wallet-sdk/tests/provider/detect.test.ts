import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectProvider, getProvider, isWalletInstalled } from '../../src/provider/detect'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

describe('detectProvider', () => {
  const _originalWindow = { ...window }

  beforeEach(() => {
    // Reset window.stablenet and window.ethereum
    delete (window as Record<string, unknown>).stablenet
    delete (window as Record<string, unknown>).ethereum
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).stablenet
    delete (window as Record<string, unknown>).ethereum
  })

  describe('synchronous detection', () => {
    it('should detect window.stablenet provider', async () => {
      const mockProv = createMockProvider()
      ;(window as Record<string, unknown>).stablenet = mockProv

      const provider = await detectProvider({ timeout: 100 })
      expect(provider).toBeInstanceOf(StableNetProvider)
    })

    it('should detect window.ethereum when isStableNet is true', async () => {
      const mockProv = createMockProvider()
      ;(window as Record<string, unknown>).ethereum = mockProv

      const provider = await detectProvider({ timeout: 100 })
      expect(provider).toBeInstanceOf(StableNetProvider)
    })

    it('should not detect window.ethereum when isStableNet is false', async () => {
      const mockProv = createMockProvider()
      ;(mockProv as Record<string, unknown>).isStableNet = false
      ;(window as Record<string, unknown>).ethereum = mockProv

      // Will try EIP-6963 discovery which won't find StableNet
      const provider = await detectProvider({ timeout: 100 })
      expect(provider).toBeNull()
    })
  })

  describe('getProvider', () => {
    it('should return provider when available', () => {
      const mockProv = createMockProvider()
      ;(window as Record<string, unknown>).stablenet = mockProv

      const provider = getProvider()
      expect(provider).toBeInstanceOf(StableNetProvider)
    })

    it('should throw when provider is not available', () => {
      expect(() => getProvider()).toThrow('StableNet wallet not detected')
    })
  })

  describe('isWalletInstalled', () => {
    it('should return true when wallet is available', () => {
      const mockProv = createMockProvider()
      ;(window as Record<string, unknown>).stablenet = mockProv

      expect(isWalletInstalled()).toBe(true)
    })

    it('should return false when wallet is not available', () => {
      expect(isWalletInstalled()).toBe(false)
    })
  })
})
