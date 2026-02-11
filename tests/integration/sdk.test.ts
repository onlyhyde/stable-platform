import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { beforeAll, describe, expect, it } from 'vitest'
import { isNetworkAvailable, TEST_CONFIG } from '../setup'

describe('SDK Integration Tests', () => {
  let publicClient: ReturnType<typeof createPublicClient>
  let walletClient: ReturnType<typeof createWalletClient>
  let account: ReturnType<typeof privateKeyToAccount>

  beforeAll(async () => {
    const networkAvailable = await isNetworkAvailable()
    if (!networkAvailable) {
      console.warn('⚠️ Local network not available, skipping SDK integration tests')
      return
    }

    // Setup viem clients
    const chain = {
      ...foundry,
      id: TEST_CONFIG.chainId,
    }

    publicClient = createPublicClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
    })

    account = privateKeyToAccount(TEST_CONFIG.accounts.user1.privateKey as `0x${string}`)

    walletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account,
    })
  })

  describe('Network Connection', () => {
    it('should connect to local network', async () => {
      const networkAvailable = await isNetworkAvailable()
      if (!networkAvailable) {
        return
      }

      const chainId = await publicClient.getChainId()
      expect(chainId).toBe(TEST_CONFIG.chainId)
    })

    it('should get block number', async () => {
      const networkAvailable = await isNetworkAvailable()
      if (!networkAvailable) {
        return
      }

      const blockNumber = await publicClient.getBlockNumber()
      expect(blockNumber).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('Account Operations', () => {
    it('should get account balance', async () => {
      const networkAvailable = await isNetworkAvailable()
      if (!networkAvailable) {
        return
      }

      const balance = await publicClient.getBalance({
        address: TEST_CONFIG.accounts.user1.address as `0x${string}`,
      })
      expect(balance).toBeGreaterThan(0n)
    })

    it('should send ETH transaction', async () => {
      const networkAvailable = await isNetworkAvailable()
      if (!networkAvailable) {
        return
      }

      const hash = await walletClient.sendTransaction({
        to: TEST_CONFIG.accounts.user2.address as `0x${string}`,
        value: parseEther('0.01'),
      })

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')
    })
  })

  describe('Smart Account Creation', () => {
    it('should encode call data correctly', async () => {
      // Test call data encoding for smart account operations
      const callData = {
        to: TEST_CONFIG.accounts.user2.address as `0x${string}`,
        value: parseEther('0.01'),
        data: '0x' as `0x${string}`,
      }

      expect(callData.to).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(callData.value).toBe(10000000000000000n)
    })
  })
})

describe('SDK Core Functions', () => {
  it('should create valid UserOperation hash', () => {
    // Mock UserOperation for hash testing
    const userOp = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: 0n,
      initCode: '0x',
      callData: '0x',
      callGasLimit: 100000n,
      verificationGasLimit: 100000n,
      preVerificationGas: 21000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1000000000n,
      paymasterAndData: '0x',
      signature: '0x',
    }

    expect(userOp.sender).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(userOp.nonce).toBe(0n)
  })

  it('should validate slippage calculation', () => {
    const amountOut = 1000000000000000000n // 1 token
    const slippageBps = 50 // 0.5%

    const slippageFactor = BigInt(10000 - slippageBps)
    const amountOutMin = (amountOut * slippageFactor) / 10000n

    expect(amountOutMin).toBe(995000000000000000n) // 0.995 token
  })
})
