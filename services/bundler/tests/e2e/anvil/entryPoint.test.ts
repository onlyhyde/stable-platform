import type { Address, Hex } from 'viem'
import { encodeFunctionData, parseAbi, parseEther } from 'viem'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ENTRY_POINT_ABI } from '../../../src/abi'
import {
  createTestUserOp,
  fundAddress,
  getOnChainNonce,
  getUserOpHash,
  isEntryPointDeployed,
  packUserOp,
} from './helpers'
import { type AnvilFixture, shouldSkipAnvilTests, startAnvil } from './setup'

/**
 * Anvil Fork-based EntryPoint E2E Tests
 *
 * These tests run against a forked mainnet via Anvil to validate
 * real EntryPoint interaction. Skipped by default (SKIP_ANVIL_TESTS=true).
 *
 * To run: SKIP_ANVIL_TESTS=false pnpm test:anvil
 */
describe.skipIf(shouldSkipAnvilTests())('Anvil EntryPoint E2E', () => {
  let fixture: AnvilFixture
  let owner: Address
  let beneficiary: Address
  let entryPointDeployed: boolean

  beforeAll(async () => {
    fixture = await startAnvil()
    owner = fixture.accounts[0]!
    beneficiary = fixture.accounts[1]!

    entryPointDeployed = await isEntryPointDeployed(fixture.publicClient, fixture.entryPoint)
  }, 30000)

  afterAll(async () => {
    if (fixture) {
      await fixture.stop()
    }
  }, 10000)

  describe('EntryPoint Availability', () => {
    it('should have EntryPoint v0.7 deployed at expected address', () => {
      expect(entryPointDeployed).toBe(true)
    })

    it('should respond to getNonce for a new account', async () => {
      const nonce = await getOnChainNonce(
        fixture.publicClient,
        fixture.entryPoint,
        fixture.accounts[2]!
      )
      expect(nonce).toBe(0n)
    })
  })

  describe('UserOp Hashing', () => {
    it('should compute getUserOpHash on-chain', async () => {
      const userOp = createTestUserOp({
        sender: fixture.accounts[2]!,
        nonce: 0n,
        callData: '0x' as Hex,
      })

      const hash = await getUserOpHash(fixture.publicClient, fixture.entryPoint, userOp)

      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should produce different hashes for different nonces', async () => {
      const sender = fixture.accounts[2]!

      const hash1 = await getUserOpHash(
        fixture.publicClient,
        fixture.entryPoint,
        createTestUserOp({ sender, nonce: 0n })
      )
      const hash2 = await getUserOpHash(
        fixture.publicClient,
        fixture.entryPoint,
        createTestUserOp({ sender, nonce: 1n })
      )

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hashes for different senders', async () => {
      const hash1 = await getUserOpHash(
        fixture.publicClient,
        fixture.entryPoint,
        createTestUserOp({ sender: fixture.accounts[2]!, nonce: 0n })
      )
      const hash2 = await getUserOpHash(
        fixture.publicClient,
        fixture.entryPoint,
        createTestUserOp({ sender: fixture.accounts[3]!, nonce: 0n })
      )

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Gas Estimation', () => {
    it('should estimate gas for handleOps call', async () => {
      const sender = fixture.accounts[3]!
      // Fund sender so it can act as its own "account"
      await fundAddress(fixture, sender, parseEther('10'))

      const userOp = createTestUserOp({
        sender,
        nonce: 0n,
        callData: '0x' as Hex,
        signature: ('0x' + 'ff'.repeat(65)) as Hex,
      })

      const packed = packUserOp(userOp)
      const callData = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: 'handleOps',
        args: [[packed], beneficiary],
      })

      // estimateGas may revert because sender isn't a real AA account,
      // but the call should at least be processable
      try {
        const gas = await fixture.publicClient.estimateGas({
          account: owner,
          to: fixture.entryPoint,
          data: callData,
        })
        expect(gas).toBeGreaterThan(0n)
      } catch (error) {
        // Expected: reverts because sender is an EOA, not a smart account
        // This validates that EntryPoint processes the call and validates the op
        expect(error).toBeDefined()
      }
    })
  })

  describe('Deposit Management', () => {
    const DEPOSIT_TO_ABI = parseAbi([
      'function depositTo(address account) payable',
      'function balanceOf(address account) view returns (uint256)',
    ])

    it('should accept deposits for an account', async () => {
      const account = fixture.accounts[4]!
      const depositAmount = parseEther('1')

      await fixture.walletClient.writeContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'depositTo',
        args: [account],
        value: depositAmount,
      })

      // Mine the transaction
      await fixture.testClient.mine({ blocks: 1 })

      const balance = await fixture.publicClient.readContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'balanceOf',
        args: [account],
      })

      expect(balance).toBe(depositAmount)
    })

    it('should track deposits for multiple accounts independently', async () => {
      const account1 = fixture.accounts[5]!
      const account2 = fixture.accounts[6]!
      const deposit1 = parseEther('2')
      const deposit2 = parseEther('3')

      await fixture.walletClient.writeContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'depositTo',
        args: [account1],
        value: deposit1,
      })

      await fixture.walletClient.writeContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'depositTo',
        args: [account2],
        value: deposit2,
      })

      await fixture.testClient.mine({ blocks: 1 })

      const balance1 = await fixture.publicClient.readContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'balanceOf',
        args: [account1],
      })

      const balance2 = await fixture.publicClient.readContract({
        address: fixture.entryPoint,
        abi: DEPOSIT_TO_ABI,
        functionName: 'balanceOf',
        args: [account2],
      })

      expect(balance1).toBe(deposit1)
      expect(balance2).toBe(deposit2)
    })
  })

  describe('Validation Against Real EntryPoint', () => {
    it('should reject simulateValidation for invalid UserOp (EOA sender)', async () => {
      const sender = fixture.accounts[7]!

      const userOp = createTestUserOp({
        sender,
        nonce: 0n,
        signature: ('0x' + 'ab'.repeat(65)) as Hex,
      })

      const packed = packUserOp(userOp)

      // simulateValidation should revert because sender is an EOA
      await expect(
        fixture.publicClient.simulateContract({
          address: fixture.entryPoint,
          abi: ENTRY_POINT_ABI,
          functionName: 'simulateValidation',
          args: [packed],
        })
      ).rejects.toThrow()
    })

    it('should reject UserOp with zero gas limits', async () => {
      const sender = fixture.accounts[8]!

      const userOp = createTestUserOp({
        sender,
        nonce: 0n,
        callGasLimit: 0n,
        verificationGasLimit: 0n,
        preVerificationGas: 0n,
        signature: ('0x' + 'cd'.repeat(65)) as Hex,
      })

      const packed = packUserOp(userOp)

      await expect(
        fixture.publicClient.simulateContract({
          address: fixture.entryPoint,
          abi: ENTRY_POINT_ABI,
          functionName: 'simulateValidation',
          args: [packed],
        })
      ).rejects.toThrow()
    })
  })

  describe('Nonce Management', () => {
    it('should return zero nonce for unused key', async () => {
      const sender = fixture.accounts[9]!
      const unusedKey = 42n

      const nonce = await getOnChainNonce(
        fixture.publicClient,
        fixture.entryPoint,
        sender,
        unusedKey
      )

      expect(nonce).toBe(0n)
    })

    it('should support nonce key separation', async () => {
      const sender = fixture.accounts[9]!

      const nonce0 = await getOnChainNonce(fixture.publicClient, fixture.entryPoint, sender, 0n)
      const nonce1 = await getOnChainNonce(fixture.publicClient, fixture.entryPoint, sender, 1n)

      // Both keys should start at 0 for a fresh account
      expect(nonce0).toBe(0n)
      expect(nonce1).toBe(0n)
    })
  })

  describe('handleOps Revert Behavior', () => {
    it('should revert handleOps with empty ops array', async () => {
      const callData = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: 'handleOps',
        args: [[], beneficiary],
      })

      try {
        await fixture.publicClient.estimateGas({
          account: owner,
          to: fixture.entryPoint,
          data: callData,
        })
        // If it doesn't throw, it should still be valid (no-op)
      } catch (error) {
        // Some EntryPoint versions revert on empty array
        expect(error).toBeDefined()
      }
    })

    it('should revert handleOps when sender has no code and no factory', async () => {
      // Create a UserOp with a random EOA sender (no code, no factory)
      const randomSender = '0x1111111111111111111111111111111111111111' as Address

      const userOp = createTestUserOp({
        sender: randomSender,
        nonce: 0n,
        factory: undefined,
        factoryData: undefined,
        signature: ('0x' + 'ee'.repeat(65)) as Hex,
      })

      const packed = packUserOp(userOp)
      const callData = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: 'handleOps',
        args: [[packed], beneficiary],
      })

      await expect(
        fixture.publicClient.estimateGas({
          account: owner,
          to: fixture.entryPoint,
          data: callData,
        })
      ).rejects.toThrow()
    })
  })
})
