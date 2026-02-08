/**
 * TransactionCache Tests
 *
 * Tests for transaction history caching with chrome.storage.local.
 */

import { transactionCache } from '../../../src/background/services/transactionCache'
import type { PendingTransaction } from '../../../src/types'

function createMockPendingTx(overrides: Partial<PendingTransaction> = {}): PendingTransaction {
  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from: '0x1234567890123456789012345678901234567890' as PendingTransaction['from'],
    to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as PendingTransaction['to'],
    value: BigInt('1000000000000000000'), // 1 ETH
    chainId: 1,
    status: 'confirmed',
    type: 'send',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('TransactionCache', () => {
  beforeEach(() => {
    chrome.storage.local.clear()
  })

  describe('save', () => {
    it('should save transactions to chrome storage', async () => {
      const tx = createMockPendingTx()
      await transactionCache.save('0x1234', 1, [tx])

      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      expect(stored['txHistory_0x1234_1']).toBeDefined()
      expect(stored['txHistory_0x1234_1'].transactions).toHaveLength(1)
    })

    it('should serialize bigint values to strings', async () => {
      const tx = createMockPendingTx({
        value: BigInt('2000000000000000000'),
        gasUsed: BigInt(21000),
        gasPrice: BigInt('20000000000'),
      })
      await transactionCache.save('0x1234', 1, [tx])

      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      const serialized = stored['txHistory_0x1234_1'].transactions[0]
      expect(serialized.value).toBe('2000000000000000000')
      expect(serialized.gasUsed).toBe('21000')
      expect(serialized.gasPrice).toBe('20000000000')
    })

    it('should lowercase account address in key', async () => {
      const tx = createMockPendingTx()
      await transactionCache.save('0xABCD', 1, [tx])

      const stored = await chrome.storage.local.get('txHistory_0xabcd_1')
      expect(stored['txHistory_0xabcd_1']).toBeDefined()
    })

    it('should include chainId in cache key', async () => {
      const tx1 = createMockPendingTx({ chainId: 1 })
      const tx2 = createMockPendingTx({ chainId: 137 })

      await transactionCache.save('0x1234', 1, [tx1])
      await transactionCache.save('0x1234', 137, [tx2])

      const stored1 = await chrome.storage.local.get('txHistory_0x1234_1')
      const stored137 = await chrome.storage.local.get('txHistory_0x1234_137')
      expect(stored1['txHistory_0x1234_1']).toBeDefined()
      expect(stored137['txHistory_0x1234_137']).toBeDefined()
    })

    it('should truncate to max 100 transactions', async () => {
      const transactions = Array.from({ length: 120 }, (_, i) =>
        createMockPendingTx({ id: `tx-${i}` })
      )

      await transactionCache.save('0x1234', 1, transactions)

      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      expect(stored['txHistory_0x1234_1'].transactions).toHaveLength(100)
    })

    it('should serialize token transfer info', async () => {
      const tx = createMockPendingTx({
        tokenTransfer: {
          tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as PendingTransaction['from'],
          symbol: 'USDC',
          decimals: 6,
          amount: BigInt(1000000),
          direction: 'out',
        },
      })

      await transactionCache.save('0x1234', 1, [tx])

      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      const serialized = stored['txHistory_0x1234_1'].transactions[0]
      expect(serialized.tokenTransfer).toBeDefined()
      expect(serialized.tokenTransfer.symbol).toBe('USDC')
      expect(serialized.tokenTransfer.amount).toBe('1000000')
    })

    it('should set timestamp on cache entry', async () => {
      const tx = createMockPendingTx()
      const before = Date.now()
      await transactionCache.save('0x1234', 1, [tx])
      const after = Date.now()

      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      expect(stored['txHistory_0x1234_1'].timestamp).toBeGreaterThanOrEqual(before)
      expect(stored['txHistory_0x1234_1'].timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('load', () => {
    it('should load and deserialize transactions', async () => {
      const tx = createMockPendingTx({
        value: BigInt('1500000000000000000'),
        gasUsed: BigInt(21000),
      })
      await transactionCache.save('0x1234', 1, [tx])

      const loaded = await transactionCache.load('0x1234', 1)
      expect(loaded).not.toBeNull()
      expect(loaded).toHaveLength(1)
      expect(loaded![0].value).toBe(BigInt('1500000000000000000'))
      expect(loaded![0].gasUsed).toBe(BigInt(21000))
    })

    it('should return null if no cache exists', async () => {
      const loaded = await transactionCache.load('0xnoexist', 1)
      expect(loaded).toBeNull()
    })

    it('should return null if cache is expired', async () => {
      const tx = createMockPendingTx()
      await transactionCache.save('0x1234', 1, [tx])

      // Manually set old timestamp (31 minutes ago)
      const stored = await chrome.storage.local.get('txHistory_0x1234_1')
      stored['txHistory_0x1234_1'].timestamp = Date.now() - 31 * 60 * 1000
      await chrome.storage.local.set(stored)

      const loaded = await transactionCache.load('0x1234', 1)
      expect(loaded).toBeNull()
    })

    it('should deserialize token transfer with bigint amount', async () => {
      const tx = createMockPendingTx({
        tokenTransfer: {
          tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as PendingTransaction['from'],
          symbol: 'USDT',
          decimals: 6,
          amount: BigInt(5000000),
          direction: 'in',
        },
      })

      await transactionCache.save('0x1234', 1, [tx])
      const loaded = await transactionCache.load('0x1234', 1)

      expect(loaded![0].tokenTransfer).toBeDefined()
      expect(loaded![0].tokenTransfer!.amount).toBe(BigInt(5000000))
      expect(loaded![0].tokenTransfer!.direction).toBe('in')
    })

    it('should deserialize all optional bigint fields', async () => {
      const tx = createMockPendingTx({
        gasUsed: BigInt(50000),
        gasPrice: BigInt('30000000000'),
        maxFeePerGas: BigInt('40000000000'),
        maxPriorityFeePerGas: BigInt('2000000000'),
      })

      await transactionCache.save('0x1234', 1, [tx])
      const loaded = await transactionCache.load('0x1234', 1)

      expect(loaded![0].gasUsed).toBe(BigInt(50000))
      expect(loaded![0].gasPrice).toBe(BigInt('30000000000'))
      expect(loaded![0].maxFeePerGas).toBe(BigInt('40000000000'))
      expect(loaded![0].maxPriorityFeePerGas).toBe(BigInt('2000000000'))
    })
  })

  describe('clear', () => {
    it('should clear cache for specific account and chain', async () => {
      const tx = createMockPendingTx()
      await transactionCache.save('0x1234', 1, [tx])
      await transactionCache.save('0x1234', 137, [tx])

      await transactionCache.clear('0x1234', 1)

      const loaded1 = await transactionCache.load('0x1234', 1)
      const loaded137 = await transactionCache.load('0x1234', 137)
      expect(loaded1).toBeNull()
      expect(loaded137).not.toBeNull()
    })

    it('should clear all transaction caches when no args', async () => {
      const tx = createMockPendingTx()
      await transactionCache.save('0x1234', 1, [tx])
      await transactionCache.save('0x5678', 1, [tx])

      await transactionCache.clear()

      const loaded1 = await transactionCache.load('0x1234', 1)
      const loaded2 = await transactionCache.load('0x5678', 1)
      expect(loaded1).toBeNull()
      expect(loaded2).toBeNull()
    })
  })
})
