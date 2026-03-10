import type { Address, PublicClient, WalletClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { DepositMonitor, type DepositMonitorConfig } from '../src/deposit/depositMonitor'

// Mock logger
vi.mock('../src/utils/logger', () => ({
  getGlobalLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

const ENTRY_POINT = '0xEf6817fe73741A8F10088f9511c64b666a338A14' as Address
const PAYMASTER_ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address

function createMockClient(balance: bigint): PublicClient {
  return {
    readContract: vi.fn(async () => balance),
  } as unknown as PublicClient
}

function createDefaultConfig(overrides?: Partial<DepositMonitorConfig>): DepositMonitorConfig {
  return {
    entryPoint: ENTRY_POINT,
    paymasterAddresses: { verifying: PAYMASTER_ADDR },
    minDepositThreshold: 10n ** 16n, // 0.01 ETH
    pollIntervalMs: 30_000,
    rejectOnLowDeposit: false,
    ...overrides,
  }
}

describe('DepositMonitor', () => {
  describe('poll', () => {
    it('should fetch balance for each paymaster', async () => {
      const client = createMockClient(10n ** 18n) // 1 ETH
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()

      expect(client.readContract).toHaveBeenCalledTimes(1)

      const info = monitor.getDepositInfo(PAYMASTER_ADDR)
      expect(info).toBeDefined()
      expect(info!.deposit).toBe(10n ** 18n)
      expect(info!.isLow).toBe(false)
    })

    it('should detect low deposit', async () => {
      const client = createMockClient(1000n) // very low
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()

      const info = monitor.getDepositInfo(PAYMASTER_ADDR)
      expect(info!.isLow).toBe(true)
    })

    it('should handle readContract errors gracefully', async () => {
      const client = {
        readContract: vi.fn(async () => {
          throw new Error('RPC unavailable')
        }),
      } as unknown as PublicClient

      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      // Should not throw
      await monitor.poll()

      // Should have no deposit info stored
      expect(monitor.getDepositInfo(PAYMASTER_ADDR)).toBeUndefined()
    })
  })

  describe('hasSufficientDeposit', () => {
    it('should return true for unknown addresses (conservative)', () => {
      const client = createMockClient(0n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      expect(monitor.hasSufficientDeposit('0xdead' as Address)).toBe(true)
    })

    it('should return false when deposit is low', async () => {
      const client = createMockClient(100n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()
      expect(monitor.hasSufficientDeposit(PAYMASTER_ADDR)).toBe(false)
    })

    it('should return true when deposit is sufficient', async () => {
      const client = createMockClient(10n ** 18n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()
      expect(monitor.hasSufficientDeposit(PAYMASTER_ADDR)).toBe(true)
    })
  })

  describe('shouldRejectSigning', () => {
    it('should return false when rejectOnLowDeposit is disabled', async () => {
      const client = createMockClient(100n)
      const config = createDefaultConfig({ rejectOnLowDeposit: false })
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()
      expect(monitor.shouldRejectSigning(PAYMASTER_ADDR)).toBe(false)
    })

    it('should return true when rejectOnLowDeposit is enabled and deposit is low', async () => {
      const client = createMockClient(100n)
      const config = createDefaultConfig({ rejectOnLowDeposit: true })
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()
      expect(monitor.shouldRejectSigning(PAYMASTER_ADDR)).toBe(true)
    })

    it('should return false when deposit is sufficient even with reject enabled', async () => {
      const client = createMockClient(10n ** 18n)
      const config = createDefaultConfig({ rejectOnLowDeposit: true })
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()
      expect(monitor.shouldRejectSigning(PAYMASTER_ADDR)).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return empty stats before polling', () => {
      const client = createMockClient(0n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      const stats = monitor.getStats()
      expect(stats.anyLow).toBe(false)
      expect(stats.lastPollAt).toBeNull()
      expect(Object.keys(stats.deposits)).toHaveLength(0)
    })

    it('should return populated stats after polling', async () => {
      const client = createMockClient(10n ** 18n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()

      const stats = monitor.getStats()
      expect(stats.lastPollAt).not.toBeNull()
      expect(stats.anyLow).toBe(false)
      const depositEntries = Object.values(stats.deposits)
      expect(depositEntries).toHaveLength(1)
      expect(depositEntries[0]!.type).toBe('verifying')
    })

    it('should report anyLow when deposit is low', async () => {
      const client = createMockClient(100n)
      const config = createDefaultConfig()
      const monitor = new DepositMonitor(client, config)

      await monitor.poll()

      expect(monitor.getStats().anyLow).toBe(true)
    })
  })

  describe('auto-deposit', () => {
    it('should trigger auto-deposit on low balance', async () => {
      const writeContractFn = vi.fn(async () => '0xtxhash')
      const walletClient = {
        account: { address: '0x' + 'ee'.repeat(20) },
        writeContract: writeContractFn,
      } as unknown as WalletClient

      const client = createMockClient(100n) // low balance
      const config = createDefaultConfig({
        autoDepositEnabled: true,
        autoDepositAmount: 10n ** 17n,
        autoDepositCooldownMs: 1000,
      })

      const monitor = new DepositMonitor(client, config, walletClient)
      await monitor.poll()

      // Wait for the async auto-deposit to fire
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(writeContractFn).toHaveBeenCalledTimes(1)
      expect(writeContractFn).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'depositTo',
          args: [PAYMASTER_ADDR],
          value: 10n ** 17n,
        })
      )
    })

    it('should not auto-deposit when disabled', async () => {
      const writeContractFn = vi.fn(async () => '0xtxhash')
      const walletClient = {
        account: { address: '0x' + 'ee'.repeat(20) },
        writeContract: writeContractFn,
      } as unknown as WalletClient

      const client = createMockClient(100n)
      const config = createDefaultConfig({ autoDepositEnabled: false })

      const monitor = new DepositMonitor(client, config, walletClient)
      await monitor.poll()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(writeContractFn).not.toHaveBeenCalled()
    })

    it('should respect cooldown between auto-deposits', async () => {
      const writeContractFn = vi.fn(async () => '0xtxhash')
      const walletClient = {
        account: { address: '0x' + 'ee'.repeat(20) },
        writeContract: writeContractFn,
      } as unknown as WalletClient

      const client = createMockClient(100n)
      const config = createDefaultConfig({
        autoDepositEnabled: true,
        autoDepositAmount: 10n ** 17n,
        autoDepositCooldownMs: 60_000, // 1 minute cooldown
      })

      const monitor = new DepositMonitor(client, config, walletClient)

      // First poll triggers auto-deposit
      await monitor.poll()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Second poll should be throttled by cooldown
      await monitor.poll()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(writeContractFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('start and stop', () => {
    it('should start and stop polling', () => {
      const client = createMockClient(10n ** 18n)
      const config = createDefaultConfig({ pollIntervalMs: 100_000 })
      const monitor = new DepositMonitor(client, config)

      monitor.start()
      // Starting again should be no-op
      monitor.start()
      monitor.stop()
      // Stopping again should be no-op
      monitor.stop()
    })
  })
})
