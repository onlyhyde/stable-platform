/**
 * Gas Estimator Tests
 */

import { describe, expect, it, vi } from 'vitest'
import { createGasEstimator } from '../../src/gas/gasEstimator'
import { createGasStrategyRegistry } from '../../src/gas/strategies/types'
import type { RpcProvider } from '../../src/providers'

/**
 * Create a mock RPC provider for testing
 */
function createMockProvider(overrides?: Partial<RpcProvider>): RpcProvider {
  return {
    chainId: 1,
    rpcUrl: 'https://rpc.mock.com',
    getBlock: vi.fn().mockResolvedValue({
      number: 1000n,
      hash: '0x' + '0'.repeat(64),
      parentHash: '0x' + '0'.repeat(64),
      timestamp: BigInt(Date.now()),
      baseFeePerGas: 30000000000n, // 30 gwei
    }),
    getGasPrice: vi.fn().mockResolvedValue(35000000000n), // 35 gwei
    getGasPrices: vi.fn().mockResolvedValue({
      baseFee: 30000000000n,
      maxPriorityFeePerGas: 1500000000n,
      maxFeePerGas: 61500000000n,
    }),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    estimateMaxPriorityFeePerGas: vi.fn().mockResolvedValue(1500000000n), // 1.5 gwei
    getBalance: vi.fn().mockResolvedValue(BigInt(10) ** BigInt(18)),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getCode: vi.fn().mockResolvedValue('0x'),
    call: vi.fn().mockResolvedValue('0x'),
    getChainId: vi.fn().mockResolvedValue(1),
    sendRawTransaction: vi.fn().mockResolvedValue('0x' + 'a'.repeat(64)),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      transactionHash: '0x' + 'a'.repeat(64),
      status: 'success' as const,
    }),
    ...overrides,
  } as unknown as RpcProvider
}

describe('createGasEstimator', () => {
  describe('initialization', () => {
    it('should create estimator with injected provider', () => {
      const provider = createMockProvider()
      const estimator = createGasEstimator({ provider, chainId: 1 })
      expect(estimator).toBeDefined()
      expect(typeof estimator.estimate).toBe('function')
      expect(typeof estimator.getGasPrices).toBe('function')
      expect(typeof estimator.estimateAllModes).toBe('function')
      expect(typeof estimator.formatEstimate).toBe('function')
    })

    it('should create estimator with rpcUrl', () => {
      const estimator = createGasEstimator({ rpcUrl: 'https://rpc.example.com', chainId: 1 })
      expect(estimator).toBeDefined()
    })

    it('should throw if neither provider nor rpcUrl provided', () => {
      expect(() => createGasEstimator({ chainId: 1 })).toThrow(
        'Either provider or rpcUrl must be provided'
      )
    })
  })

  describe('getGasPrices', () => {
    it('should return gas price info from provider', async () => {
      const provider = createMockProvider()
      const estimator = createGasEstimator({ provider, chainId: 1 })

      const prices = await estimator.getGasPrices()
      expect(prices.baseFee).toBe(30000000000n) // 30 gwei
      expect(prices.gasPrice).toBe(35000000000n) // 35 gwei
      expect(prices.maxPriorityFeePerGas).toBeGreaterThan(0n)
      expect(prices.maxFeePerGas).toBeGreaterThan(prices.baseFee)
    })

    it('should calculate maxFeePerGas as 2*baseFee + priorityFee', async () => {
      const provider = createMockProvider()
      const estimator = createGasEstimator({ provider, chainId: 1 })

      const prices = await estimator.getGasPrices()
      // maxFeePerGas = baseFee * 2 + maxPriorityFeePerGas
      expect(prices.maxFeePerGas).toBe(prices.baseFee * 2n + prices.maxPriorityFeePerGas)
    })

    it('should use fallback priority fee on estimation failure', async () => {
      const provider = createMockProvider({
        estimateMaxPriorityFeePerGas: vi.fn().mockRejectedValue(new Error('Not supported')),
      } as unknown as Partial<RpcProvider>)

      const estimator = createGasEstimator({ provider, chainId: 1 })
      const prices = await estimator.getGasPrices()
      // Should still return valid prices using MIN_PRIORITY_FEE fallback
      expect(prices.maxPriorityFeePerGas).toBeGreaterThan(0n)
    })
  })

  describe('estimate', () => {
    it('should throw for unknown transaction mode', async () => {
      const provider = createMockProvider()
      const estimator = createGasEstimator({ provider, chainId: 1 })

      await expect(
        estimator.estimate({
          mode: 'nonexistent' as unknown,
          from: '0x1234567890abcdef1234567890abcdef12345678',
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          value: 0n,
        })
      ).rejects.toThrow('Unknown transaction mode')
    })
  })

  describe('formatEstimate', () => {
    it('should format gas estimate for display', () => {
      const provider = createMockProvider()
      const estimator = createGasEstimator({ provider, chainId: 1 })

      const formatted = estimator.formatEstimate({
        gasLimit: 21000n,
        maxFeePerGas: 30000000000n, // 30 gwei
        maxPriorityFeePerGas: 1500000000n,
        estimatedCost: 630000000000000n, // 21000 * 30 gwei
      })

      expect(formatted.gasLimit).toBe('21000')
      expect(formatted.maxFeePerGas).toContain('gwei')
      expect(formatted.estimatedCost).toContain('wei')
      expect(formatted.estimatedCostEth).toContain('ETH')
    })
  })
})

describe('GasStrategyRegistry', () => {
  it('should register and retrieve strategies', () => {
    const registry = createGasStrategyRegistry()
    const mockStrategy = {
      mode: 'eoa' as const,
      supports: () => true,
      estimate: vi.fn(),
    }
    registry.register(mockStrategy)
    expect(registry.getStrategy('eoa')).toBe(mockStrategy)
  })

  it('should return undefined for unregistered mode', () => {
    const registry = createGasStrategyRegistry()
    expect(registry.getStrategy('eoa')).toBeUndefined()
  })

  it('should return all registered strategies', () => {
    const registry = createGasStrategyRegistry()
    const strategy1 = { mode: 'eoa' as const, supports: () => true, estimate: vi.fn() }
    const strategy2 = { mode: 'eip7702' as const, supports: () => true, estimate: vi.fn() }
    registry.register(strategy1)
    registry.register(strategy2)
    expect(registry.getAllStrategies()).toHaveLength(2)
  })

  it('should overwrite strategy when re-registering same mode', () => {
    const registry = createGasStrategyRegistry()
    const strategy1 = { mode: 'eoa' as const, supports: () => true, estimate: vi.fn() }
    const strategy2 = { mode: 'eoa' as const, supports: () => false, estimate: vi.fn() }
    registry.register(strategy1)
    registry.register(strategy2)
    expect(registry.getStrategy('eoa')).toBe(strategy2)
  })
})
