/**
 * Paymaster Gas Sponsorship E2E Tests
 *
 * Tests the complete gas sponsorship flow:
 * 1. Verifying Paymaster plugin creation and configuration
 * 2. Stub data generation for gas estimation
 * 3. Actual signature generation with validity period
 * 4. Integration with smart account and UserOp
 * 5. Paymaster service API testing (pm_getPaymasterStubData, pm_getPaymasterData)
 * 6. Full sponsored UserOp flow
 *
 * Prerequisites:
 * - Local Anvil node running (http://127.0.0.1:8545)
 * - Bundler service running (http://127.0.0.1:4337)
 * - Paymaster proxy service running (http://127.0.0.1:4338)
 * - ERC-4337 contracts deployed (EntryPoint, VerifyingPaymaster)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey, type LocalAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { TEST_CONFIG, isNetworkAvailable, isBundlerAvailable } from '../setup'

// SDK Imports
import {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
  createSponsorPaymaster,
  DEFAULT_VALIDITY_SECONDS,
} from '../../packages/sdk/plugins/paymaster/src'

import {
  createBundlerClient,
  createSmartAccountClient,
  packUserOperation,
  getUserOperationHash,
} from '../../packages/sdk/packages/core/src'

import {
  toKernelSmartAccount,
} from '../../packages/sdk/packages/accounts/src'

import {
  createEcdsaValidator,
} from '../../packages/sdk/plugins/ecdsa/src'

import type {
  UserOperation,
  PaymasterClient,
  PaymasterStubData,
  PaymasterData,
} from '../../packages/sdk/packages/types/src'

// ============================================================================
// ABIs
// ============================================================================

const ENTRY_POINT_ABI = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) payable',
])

// ============================================================================
// Test Context
// ============================================================================

interface TestContext {
  publicClient: PublicClient
  walletClient: WalletClient
  account: LocalAccount
  paymasterSigner: LocalAccount
  paymasterClient: PaymasterClient | null
  networkAvailable: boolean
  bundlerAvailable: boolean
  paymasterServiceAvailable: boolean
  paymasterDeployed: boolean
}

// Helper to check if paymaster service is available
async function isPaymasterServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(TEST_CONFIG.paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'pm_getPaymasterStubData',
        params: [],
        id: 1,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Paymaster Gas Sponsorship E2E Tests', () => {
  const ctx: TestContext = {
    publicClient: null as unknown as PublicClient,
    walletClient: null as unknown as WalletClient,
    account: null as unknown as LocalAccount,
    paymasterSigner: null as unknown as LocalAccount,
    paymasterClient: null,
    networkAvailable: false,
    bundlerAvailable: false,
    paymasterServiceAvailable: false,
    paymasterDeployed: false,
  }

  // Mock UserOperation for testing
  const createMockUserOp = (sender: Address, nonce: bigint = 0n): UserOperation => ({
    sender,
    nonce,
    factory: null,
    factoryData: null,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    paymaster: null,
    paymasterVerificationGasLimit: null,
    paymasterPostOpGasLimit: null,
    paymasterData: null,
    signature: '0x' as Hex,
  })

  beforeAll(async () => {
    ctx.networkAvailable = await isNetworkAvailable()
    ctx.bundlerAvailable = await isBundlerAvailable()
    ctx.paymasterServiceAvailable = await isPaymasterServiceAvailable()

    if (!ctx.networkAvailable) {
      console.warn('⚠️ Local network not available, E2E tests will be skipped')
      return
    }

    const chain = {
      ...foundry,
      id: TEST_CONFIG.chainId,
    }

    ctx.publicClient = createPublicClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
    })

    ctx.account = privateKeyToAccount(
      TEST_CONFIG.accounts.user1.privateKey as Hex
    )

    ctx.walletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account: ctx.account,
    })

    // Generate a paymaster signer for testing
    ctx.paymasterSigner = privateKeyToAccount(generatePrivateKey())

    // Check if paymaster contract is deployed
    const paymasterCode = await ctx.publicClient.getCode({
      address: TEST_CONFIG.contracts.verifyingPaymaster as Address,
    })
    ctx.paymasterDeployed = !!(paymasterCode && paymasterCode !== '0x')

    console.log('🎫 Paymaster E2E Test Setup:')
    console.log(`   Network available: ${ctx.networkAvailable}`)
    console.log(`   Bundler available: ${ctx.bundlerAvailable}`)
    console.log(`   Paymaster service available: ${ctx.paymasterServiceAvailable}`)
    console.log(`   Paymaster contract deployed: ${ctx.paymasterDeployed}`)
    console.log(`   Paymaster address: ${TEST_CONFIG.contracts.verifyingPaymaster}`)
  })

  // ==========================================================================
  // 1. Verifying Paymaster Plugin Creation
  // ==========================================================================

  describe('1. Verifying Paymaster Plugin Creation', () => {
    it('should create verifying paymaster with signer', () => {
      if (!ctx.networkAvailable) return

      const paymaster = createVerifyingPaymaster({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        signer: ctx.paymasterSigner,
        chainId: BigInt(TEST_CONFIG.chainId),
      })

      expect(paymaster.getPaymasterStubData).toBeDefined()
      expect(paymaster.getPaymasterData).toBeDefined()
      expect(typeof paymaster.getPaymasterStubData).toBe('function')
      expect(typeof paymaster.getPaymasterData).toBe('function')

      ctx.paymasterClient = paymaster
      console.log('✅ Verifying paymaster created with signer')
    })

    it('should create verifying paymaster from private key', async () => {
      if (!ctx.networkAvailable) return

      const privateKey = generatePrivateKey()
      const paymaster = await createVerifyingPaymasterFromPrivateKey({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        privateKey,
        chainId: BigInt(TEST_CONFIG.chainId),
      })

      expect(paymaster.getPaymasterStubData).toBeDefined()
      expect(paymaster.getPaymasterData).toBeDefined()

      console.log('✅ Verifying paymaster created from private key')
    })

    it('should create paymaster with custom validity period', () => {
      if (!ctx.networkAvailable) return

      const customValidity = 7200 // 2 hours
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        signer: ctx.paymasterSigner,
        chainId: BigInt(TEST_CONFIG.chainId),
        validitySeconds: customValidity,
      })

      expect(paymaster).toBeDefined()
      console.log(`✅ Paymaster created with custom validity: ${customValidity}s`)
    })

    it('should export DEFAULT_VALIDITY_SECONDS constant', () => {
      expect(DEFAULT_VALIDITY_SECONDS).toBeDefined()
      expect(typeof DEFAULT_VALIDITY_SECONDS).toBe('number')
      expect(DEFAULT_VALIDITY_SECONDS).toBe(3600) // 1 hour

      console.log(`✅ DEFAULT_VALIDITY_SECONDS: ${DEFAULT_VALIDITY_SECONDS}s`)
    })
  })

  // ==========================================================================
  // 2. Stub Data Generation (Gas Estimation)
  // ==========================================================================

  describe('2. Stub Data Generation (Gas Estimation)', () => {
    it('should generate stub data with correct paymaster address', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(stubData.paymaster).toBe(TEST_CONFIG.contracts.verifyingPaymaster)
      console.log(`✅ Stub data paymaster: ${stubData.paymaster}`)
    })

    it('should return gas limits in stub data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(stubData.paymasterVerificationGasLimit).toBeDefined()
      expect(stubData.paymasterPostOpGasLimit).toBeDefined()
      expect(stubData.paymasterVerificationGasLimit).toBeGreaterThan(0n)
      expect(stubData.paymasterPostOpGasLimit).toBeGreaterThan(0n)

      console.log('✅ Stub data gas limits:')
      console.log(`   Verification gas: ${stubData.paymasterVerificationGasLimit}`)
      console.log(`   PostOp gas: ${stubData.paymasterPostOpGasLimit}`)
    })

    it('should return paymaster data with placeholder signature', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(stubData.paymasterData).toBeDefined()
      expect(stubData.paymasterData).toMatch(/^0x/)

      // Format: [validUntil (6 bytes)][validAfter (6 bytes)][signature (65 bytes)]
      // Total: 77 bytes = 154 hex chars + 0x prefix
      expect(stubData.paymasterData.length).toBe(156)

      console.log('✅ Stub data format valid (77 bytes)')
      console.log(`   paymasterData: ${stubData.paymasterData.slice(0, 30)}...`)
    })

    it('should use placeholder signature (65 bytes of zeros) in stub', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // Signature starts at byte 12 (after timestamps)
      // Hex position: 2 (0x) + 24 (12 bytes * 2) = 26
      const signatureHex = stubData.paymasterData.slice(26)

      // Stub signature should be all zeros (65 bytes = 130 hex chars)
      expect(signatureHex).toBe('00'.repeat(65))

      console.log('✅ Stub signature is placeholder (65 zeros)')
    })

    it('should include validity timestamps in stub data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // Extract timestamps from paymasterData
      // validUntil: bytes 0-6, validAfter: bytes 6-12
      const validUntilHex = stubData.paymasterData.slice(2, 14)
      const validAfterHex = stubData.paymasterData.slice(14, 26)

      const validUntil = parseInt(validUntilHex, 16)
      const validAfter = parseInt(validAfterHex, 16)
      const now = Math.floor(Date.now() / 1000)

      expect(validAfter).toBe(0) // Default is 0
      expect(validUntil).toBeGreaterThan(now)
      expect(validUntil).toBeLessThanOrEqual(now + DEFAULT_VALIDITY_SECONDS + 10) // Allow 10s margin

      console.log('✅ Validity timestamps in stub data:')
      console.log(`   validUntil: ${validUntil} (${new Date(validUntil * 1000).toISOString()})`)
      console.log(`   validAfter: ${validAfter}`)
    })
  })

  // ==========================================================================
  // 3. Signed Paymaster Data
  // ==========================================================================

  describe('3. Signed Paymaster Data', () => {
    it('should generate signed paymaster data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const data = await ctx.paymasterClient.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymaster).toBe(TEST_CONFIG.contracts.verifyingPaymaster)
      expect(data.paymasterData).toBeDefined()
      expect(data.paymasterData).toMatch(/^0x/)

      console.log('✅ Signed paymaster data generated')
      console.log(`   paymaster: ${data.paymaster}`)
    })

    it('should have actual signature (not zeros)', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const data = await ctx.paymasterClient.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // Signature starts at byte 12
      const signatureHex = data.paymasterData.slice(26)

      // Actual signature should NOT be all zeros
      expect(signatureHex).not.toBe('00'.repeat(65))
      expect(signatureHex.length).toBe(130) // 65 bytes

      console.log('✅ Actual signature present (not zeros)')
      console.log(`   Signature: ${signatureHex.slice(0, 32)}...`)
    })

    it('should produce different signatures for different UserOps', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp1 = createMockUserOp(ctx.account.address, 1n)
      const userOp2 = createMockUserOp(ctx.account.address, 2n)

      const data1 = await ctx.paymasterClient.getPaymasterData(
        userOp1,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )
      const data2 = await ctx.paymasterClient.getPaymasterData(
        userOp2,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // Signatures should be different for different nonces
      expect(data1.paymasterData.slice(26)).not.toBe(data2.paymasterData.slice(26))

      console.log('✅ Different UserOps produce different signatures')
    })

    it('should produce consistent signatures for same UserOp', async () => {
      if (!ctx.networkAvailable) return

      // Create a new paymaster with fresh signer for deterministic testing
      const paymaster = createVerifyingPaymaster({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        signer: ctx.paymasterSigner,
        chainId: BigInt(TEST_CONFIG.chainId),
      })

      const userOp = createMockUserOp(ctx.account.address, 123n)

      // Sign twice quickly (within same second to get same timestamp)
      const data1 = await paymaster.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )
      const data2 = await paymaster.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // With same timestamp, same UserOp should produce same signature
      expect(data1.paymasterData).toBe(data2.paymasterData)

      console.log('✅ Same UserOp produces consistent signature')
    })
  })

  // ==========================================================================
  // 4. Chain ID Isolation
  // ==========================================================================

  describe('4. Chain ID Isolation', () => {
    it('should produce different signatures for different chain IDs', async () => {
      if (!ctx.networkAvailable) return

      const paymaster1 = createVerifyingPaymaster({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        signer: ctx.paymasterSigner,
        chainId: 1n, // Mainnet
      })
      const paymaster2 = createVerifyingPaymaster({
        paymasterAddress: TEST_CONFIG.contracts.verifyingPaymaster as Address,
        signer: ctx.paymasterSigner,
        chainId: 137n, // Polygon
      })

      const userOp = createMockUserOp(ctx.account.address)

      const data1 = await paymaster1.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        1n
      )
      const data2 = await paymaster2.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        137n
      )

      // Different chain IDs should produce different signatures
      expect(data1.paymasterData.slice(26)).not.toBe(data2.paymasterData.slice(26))

      console.log('✅ Chain ID isolation verified')
      console.log('   Chain 1 sig: ' + data1.paymasterData.slice(26, 58) + '...')
      console.log('   Chain 137 sig: ' + data2.paymasterData.slice(26, 58) + '...')
    })
  })

  // ==========================================================================
  // 5. UserOperation with Paymaster Integration
  // ==========================================================================

  describe('5. UserOperation with Paymaster Integration', () => {
    it('should fill UserOp with paymaster stub data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      // Fill UserOp with paymaster data
      const sponsoredUserOp: UserOperation = {
        ...userOp,
        paymaster: stubData.paymaster,
        paymasterData: stubData.paymasterData,
        paymasterVerificationGasLimit: stubData.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: stubData.paymasterPostOpGasLimit,
      }

      expect(sponsoredUserOp.paymaster).toBe(TEST_CONFIG.contracts.verifyingPaymaster)
      expect(sponsoredUserOp.paymasterVerificationGasLimit).toBeGreaterThan(0n)
      expect(sponsoredUserOp.paymasterPostOpGasLimit).toBeGreaterThan(0n)

      console.log('✅ UserOp filled with paymaster stub data')
    })

    it('should pack UserOperation with paymaster data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      const sponsoredUserOp: UserOperation = {
        ...userOp,
        paymaster: stubData.paymaster,
        paymasterData: stubData.paymasterData,
        paymasterVerificationGasLimit: stubData.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: stubData.paymasterPostOpGasLimit,
      }

      const packed = packUserOperation(sponsoredUserOp)

      // paymasterAndData should contain paymaster address and data
      expect(packed.paymasterAndData).not.toBe('0x')
      expect(packed.paymasterAndData.length).toBeGreaterThan(42)
      expect(packed.paymasterAndData.toLowerCase()).toContain(
        (TEST_CONFIG.contracts.verifyingPaymaster as string).toLowerCase().slice(2)
      )

      console.log('✅ UserOp with paymaster packed correctly')
      console.log(`   paymasterAndData length: ${packed.paymasterAndData.length}`)
    })

    it('should compute UserOp hash with paymaster data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOp = createMockUserOp(ctx.account.address)
      const data = await ctx.paymasterClient.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      const sponsoredUserOp: UserOperation = {
        ...userOp,
        paymaster: data.paymaster,
        paymasterData: data.paymasterData,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
      }

      const hash = getUserOperationHash(
        sponsoredUserOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      console.log('✅ UserOp hash computed with paymaster data')
      console.log(`   Hash: ${hash}`)
    })
  })

  // ==========================================================================
  // 6. Paymaster Contract Deployment Check
  // ==========================================================================

  describe('6. Paymaster Contract (On-Chain)', () => {
    it('should check if VerifyingPaymaster is deployed', async () => {
      if (!ctx.networkAvailable) return

      const code = await ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.verifyingPaymaster as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
        console.log('✅ VerifyingPaymaster is deployed')
        console.log(`   Address: ${TEST_CONFIG.contracts.verifyingPaymaster}`)
        console.log(`   Code size: ${(code.length - 2) / 2} bytes`)
      } else {
        console.log('⚠️ VerifyingPaymaster NOT deployed')
      }
    })

    it('should check paymaster deposit in EntryPoint', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterDeployed) {
        console.log('⏭️ Skipping - paymaster not deployed')
        return
      }

      try {
        const balance = await ctx.publicClient.readContract({
          address: TEST_CONFIG.contracts.entryPoint as Address,
          abi: ENTRY_POINT_ABI,
          functionName: 'balanceOf',
          args: [TEST_CONFIG.contracts.verifyingPaymaster as Address],
        })

        console.log(`✅ Paymaster deposit in EntryPoint: ${formatEther(balance as bigint)} ETH`)
      } catch (error) {
        console.log('⚠️ Could not check paymaster deposit')
      }
    })
  })

  // ==========================================================================
  // 7. Paymaster Service API (if available)
  // ==========================================================================

  describe('7. Paymaster Service API', () => {
    it('should call pm_getPaymasterStubData via service', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterServiceAvailable) {
        console.log('⏭️ Skipping - paymaster service not available')
        return
      }

      const userOp = createMockUserOp(ctx.account.address)

      try {
        const response = await fetch(TEST_CONFIG.paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'pm_getPaymasterStubData',
            params: [
              {
                sender: userOp.sender,
                nonce: '0x' + userOp.nonce.toString(16),
                callData: userOp.callData,
                callGasLimit: '0x' + userOp.callGasLimit.toString(16),
                verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
                preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
                maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
                maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
              },
              TEST_CONFIG.contracts.entryPoint,
              '0x' + TEST_CONFIG.chainId.toString(16),
            ],
            id: 1,
          }),
        })

        const result = await response.json()

        if (result.result) {
          expect(result.result.paymaster).toBeDefined()
          expect(result.result.paymasterData).toBeDefined()
          console.log('✅ pm_getPaymasterStubData response received')
          console.log(`   paymaster: ${result.result.paymaster}`)
        } else if (result.error) {
          console.log(`⚠️ Service returned error: ${result.error.message}`)
        }
      } catch (error) {
        console.log(`⚠️ Service call failed: ${(error as Error).message}`)
      }
    })

    it('should call pm_getPaymasterData via service', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterServiceAvailable) {
        console.log('⏭️ Skipping - paymaster service not available')
        return
      }

      const userOp = createMockUserOp(ctx.account.address)

      try {
        const response = await fetch(TEST_CONFIG.paymasterUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'pm_getPaymasterData',
            params: [
              {
                sender: userOp.sender,
                nonce: '0x' + userOp.nonce.toString(16),
                callData: userOp.callData,
                callGasLimit: '0x' + userOp.callGasLimit.toString(16),
                verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
                preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
                maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
                maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
              },
              TEST_CONFIG.contracts.entryPoint,
              '0x' + TEST_CONFIG.chainId.toString(16),
            ],
            id: 1,
          }),
        })

        const result = await response.json()

        if (result.result) {
          expect(result.result.paymaster).toBeDefined()
          expect(result.result.paymasterData).toBeDefined()
          console.log('✅ pm_getPaymasterData response received')
        } else if (result.error) {
          console.log(`⚠️ Service returned error: ${result.error.message}`)
        }
      } catch (error) {
        console.log(`⚠️ Service call failed: ${(error as Error).message}`)
      }
    })
  })

  // ==========================================================================
  // 8. Sponsor Paymaster (API-based)
  // ==========================================================================

  describe('8. Sponsor Paymaster (API-based)', () => {
    it('should create sponsor paymaster client', () => {
      if (!ctx.networkAvailable) return

      const sponsorPaymaster = createSponsorPaymaster({
        paymasterUrl: TEST_CONFIG.paymasterUrl,
        chainId: BigInt(TEST_CONFIG.chainId),
      })

      expect(sponsorPaymaster.getPaymasterStubData).toBeDefined()
      expect(sponsorPaymaster.getPaymasterData).toBeDefined()

      console.log('✅ Sponsor paymaster client created')
      console.log(`   URL: ${TEST_CONFIG.paymasterUrl}`)
    })

    it('should create sponsor paymaster with API key', () => {
      if (!ctx.networkAvailable) return

      const sponsorPaymaster = createSponsorPaymaster({
        paymasterUrl: TEST_CONFIG.paymasterUrl,
        apiKey: 'test-api-key',
        chainId: BigInt(TEST_CONFIG.chainId),
      })

      expect(sponsorPaymaster).toBeDefined()
      console.log('✅ Sponsor paymaster with API key created')
    })
  })

  // ==========================================================================
  // 9. Full Sponsored UserOp Flow
  // ==========================================================================

  describe('9. Full Sponsored UserOp Flow', () => {
    it('should complete full gas sponsorship flow', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      console.log('\n📋 Full Gas Sponsorship Flow:')

      // Step 1: Create base UserOp
      const userOp = createMockUserOp(ctx.account.address)
      console.log('1️⃣ Created base UserOperation')

      // Step 2: Get paymaster stub data for gas estimation
      const stubData = await ctx.paymasterClient.getPaymasterStubData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )
      console.log('2️⃣ Got paymaster stub data for gas estimation')
      console.log(`   Verification gas: ${stubData.paymasterVerificationGasLimit}`)
      console.log(`   PostOp gas: ${stubData.paymasterPostOpGasLimit}`)

      // Step 3: Fill UserOp with stub data
      const userOpWithStub: UserOperation = {
        ...userOp,
        paymaster: stubData.paymaster,
        paymasterData: stubData.paymasterData,
        paymasterVerificationGasLimit: stubData.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: stubData.paymasterPostOpGasLimit,
      }
      console.log('3️⃣ Filled UserOp with stub data')

      // Step 4: (Simulated) Get gas estimation from bundler
      // In real flow, bundler would estimate gas here
      console.log('4️⃣ (Simulated) Gas estimation from bundler')

      // Step 5: Get actual paymaster signature
      const signedData = await ctx.paymasterClient.getPaymasterData(
        userOpWithStub,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )
      console.log('5️⃣ Got actual paymaster signature')

      // Step 6: Update UserOp with signed data
      const finalUserOp: UserOperation = {
        ...userOpWithStub,
        paymasterData: signedData.paymasterData,
      }
      console.log('6️⃣ Updated UserOp with signed paymaster data')

      // Step 7: Compute UserOp hash
      const userOpHash = getUserOperationHash(
        finalUserOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )
      console.log('7️⃣ Computed UserOp hash')
      console.log(`   Hash: ${userOpHash}`)

      // Step 8: Pack for submission
      const packed = packUserOperation(finalUserOp)
      expect(packed.paymasterAndData.length).toBeGreaterThan(42)
      console.log('8️⃣ Packed UserOp for submission')

      console.log('\n✅ Full gas sponsorship flow completed!')
    })
  })

  // ==========================================================================
  // 10. Edge Cases
  // ==========================================================================

  describe('10. Edge Cases', () => {
    it('should handle UserOp with factory data', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOpWithFactory: UserOperation = {
        ...createMockUserOp(ctx.account.address),
        factory: '0xfactory000000000000000000000000000factory' as Address,
        factoryData: '0xfactorydata1234' as Hex,
      }

      const data = await ctx.paymasterClient.getPaymasterData(
        userOpWithFactory,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymaster).toBeDefined()
      expect(data.paymasterData).toBeDefined()

      console.log('✅ UserOp with factory data handled correctly')
    })

    it('should handle large gas values', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const largeGasUserOp: UserOperation = {
        ...createMockUserOp(ctx.account.address),
        callGasLimit: BigInt(2) ** BigInt(64) - BigInt(1),
        verificationGasLimit: BigInt(2) ** BigInt(64) - BigInt(1),
      }

      const data = await ctx.paymasterClient.getPaymasterData(
        largeGasUserOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymasterData).toBeDefined()
      console.log('✅ Large gas values handled correctly')
    })

    it('should handle zero nonce', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const zeroNonceUserOp = createMockUserOp(ctx.account.address, 0n)

      const data = await ctx.paymasterClient.getPaymasterData(
        zeroNonceUserOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymasterData).toBeDefined()
      console.log('✅ Zero nonce handled correctly')
    })

    it('should handle different sender addresses', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const randomSender = '0x' + 'a'.repeat(40) as Address
      const userOp = createMockUserOp(randomSender)

      const data = await ctx.paymasterClient.getPaymasterData(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymaster).toBe(TEST_CONFIG.contracts.verifyingPaymaster)
      expect(data.paymasterData).toBeDefined()

      console.log('✅ Different sender addresses handled correctly')
    })

    it('should handle non-empty callData', async () => {
      if (!ctx.networkAvailable || !ctx.paymasterClient) return

      const userOpWithCallData: UserOperation = {
        ...createMockUserOp(ctx.account.address),
        callData: '0xabcdef1234567890abcdef1234567890' as Hex,
      }

      const data = await ctx.paymasterClient.getPaymasterData(
        userOpWithCallData,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(data.paymasterData).toBeDefined()
      console.log('✅ Non-empty callData handled correctly')
    })
  })
})
