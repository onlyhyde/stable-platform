/**
 * Transaction Router Tests
 */

import { describe, expect, it, vi } from 'vitest'
import { createTransactionRouter } from '../../src/transaction/transactionRouter'

// Note: transactionRouter depends on multiple external modules (strategies, gasEstimator, providers)
// These tests focus on the router's configuration and mode resolution logic

describe('createTransactionRouter', () => {
  describe('initialization', () => {
    it('should create a router with basic config', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(router).toBeDefined()
      expect(typeof router.prepare).toBe('function')
      expect(typeof router.execute).toBe('function')
      expect(typeof router.resolveMode).toBe('function')
      expect(typeof router.validateMode).toBe('function')
      expect(typeof router.getSupportedModes).toBe('function')
      expect(typeof router.isSupported).toBe('function')
      expect(typeof router.registerStrategy).toBe('function')
    })

    it('should register eoa and eip7702 strategies by default', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      const modes = router.getSupportedModes()
      expect(modes).toContain('eoa')
      expect(modes).toContain('eip7702')
    })

    it('should register smartAccount strategy when bundlerUrl provided', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
        bundlerUrl: 'https://bundler.example.com',
      })
      const modes = router.getSupportedModes()
      expect(modes).toContain('smartAccount')
    })

    it('should not register smartAccount strategy without bundlerUrl', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      const modes = router.getSupportedModes()
      expect(modes).not.toContain('smartAccount')
    })
  })

  describe('isSupported', () => {
    it('should return true for registered modes', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(router.isSupported('eoa')).toBe(true)
      expect(router.isSupported('eip7702')).toBe(true)
    })

    it('should return false for unregistered modes', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(router.isSupported('smartAccount')).toBe(false)
    })
  })

  describe('resolveMode', () => {
    const router = createTransactionRouter({
      rpcUrl: 'https://rpc.example.com',
      chainId: 1,
      bundlerUrl: 'https://bundler.example.com',
    })

    it('should use explicit mode when provided and valid', () => {
      const mode = router.resolveMode(
        { mode: 'eoa', from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), value: 0n },
        { type: 'eoa', address: ('0x' + '1'.repeat(40)) as `0x${string}` }
      )
      expect(mode).toBe('eoa')
    })

    it('should use default mode when not specified', () => {
      const mode = router.resolveMode(
        { from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), value: 0n } as unknown,
        { type: 'eoa', address: ('0x' + '1'.repeat(40)) as `0x${string}` }
      )
      // Default for EOA account should be 'eoa'
      expect(mode).toBe('eoa')
    })
  })

  describe('validateMode', () => {
    it('should throw for unsupported mode', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(() =>
        router.validateMode('smartAccount', {
          type: 'eoa',
          address: ('0x' + '1'.repeat(40)) as `0x${string}`,
        })
      ).toThrow()
    })
  })

  describe('registerStrategy', () => {
    it('should allow registering custom strategies', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      const customStrategy = {
        mode: 'smartAccount' as const,
        supports: () => true,
        prepare: vi.fn(),
        execute: vi.fn(),
      }
      router.registerStrategy(customStrategy as unknown)
      expect(router.isSupported('smartAccount')).toBe(true)
    })
  })

  describe('gasEstimator', () => {
    it('should expose gasEstimator', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(router.gasEstimator).toBeDefined()
      expect(typeof router.gasEstimator.estimate).toBe('function')
    })
  })

  describe('strategyRegistry', () => {
    it('should expose strategyRegistry', () => {
      const router = createTransactionRouter({
        rpcUrl: 'https://rpc.example.com',
        chainId: 1,
      })
      expect(router.strategyRegistry).toBeDefined()
    })
  })
})
