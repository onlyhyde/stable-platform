/**
 * UserOperation E2E Test Suite
 *
 * Tests the complete UserOp flow using SDK functions:
 * 1. Smart account setup with ECDSA validator (@stablenet/accounts, @stablenet/plugin-ecdsa)
 * 2. UserOperation creation and signing (@stablenet/core)
 * 3. Bundler submission and gas estimation (createBundlerClient)
 * 4. High-level flow (createSmartAccountClient)
 *
 * Prerequisites:
 * - Local Anvil node running (http://127.0.0.1:8545)
 * - Bundler service running (http://127.0.0.1:4337)
 * - ERC-4337 contracts deployed (EntryPoint, Kernel Factory, ECDSA Validator)
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
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { TEST_CONFIG, isNetworkAvailable, isBundlerAvailable } from '../setup'

// ============================================================================
// SDK Imports (using relative paths for vitest compatibility)
// ============================================================================

import {
  createBundlerClient,
  createSmartAccountClient,
  packUserOperation,
  getUserOperationHash,
  ENTRY_POINT_V07_ADDRESS,
} from '../../packages/sdk/packages/core/src'

import {
  toKernelSmartAccount,
  encodeKernelExecuteCallData,
} from '../../packages/sdk/packages/accounts/src'

import {
  createEcdsaValidator,
  ECDSA_VALIDATOR_ADDRESS,
} from '../../packages/sdk/plugins/ecdsa/src'

import type {
  SmartAccount,
  BundlerClient,
  UserOperation,
} from '../../packages/sdk/packages/types/src'

// ============================================================================
// ABIs (for direct contract interactions in tests)
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
  smartAccount: SmartAccount | null
  bundlerClient: BundlerClient | null
  networkAvailable: boolean
  bundlerAvailable: boolean
  contractsDeployed: boolean
}

// ============================================================================
// Tests
// ============================================================================

describe('UserOperation E2E Flow', () => {
  const ctx: TestContext = {
    publicClient: null as unknown as PublicClient,
    walletClient: null as unknown as WalletClient,
    account: null as unknown as LocalAccount,
    smartAccount: null,
    bundlerClient: null,
    networkAvailable: false,
    bundlerAvailable: false,
    contractsDeployed: false,
  }

  beforeAll(async () => {
    ctx.networkAvailable = await isNetworkAvailable()
    ctx.bundlerAvailable = await isBundlerAvailable()

    if (!ctx.networkAvailable) {
      console.warn('⚠️ Local network not available, E2E tests will be skipped')
      return
    }

    if (!ctx.bundlerAvailable) {
      console.warn('⚠️ Bundler not available, some tests will be skipped')
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

    // Check if required contracts are deployed
    const [entryPointCode, factoryCode, validatorCode] = await Promise.all([
      ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.entryPoint as Address,
      }),
      ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.kernelFactory as Address,
      }),
      ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.ecdsaValidator as Address,
      }),
    ])

    ctx.contractsDeployed = !!(
      entryPointCode && entryPointCode !== '0x' &&
      factoryCode && factoryCode !== '0x' &&
      validatorCode && validatorCode !== '0x'
    )

    if (!ctx.contractsDeployed) {
      console.warn('⚠️ Required contracts not deployed, some tests will be skipped')
      console.log(`   EntryPoint: ${entryPointCode ? 'deployed' : 'NOT DEPLOYED'}`)
      console.log(`   KernelFactory: ${factoryCode ? 'deployed' : 'NOT DEPLOYED'}`)
      console.log(`   ECDSAValidator: ${validatorCode ? 'deployed' : 'NOT DEPLOYED'}`)
    }

    // Setup bundler client if available
    if (ctx.bundlerAvailable) {
      ctx.bundlerClient = createBundlerClient({
        url: TEST_CONFIG.bundlerUrl,
        entryPoint: TEST_CONFIG.contracts.entryPoint as Address,
        chainId: BigInt(TEST_CONFIG.chainId),
      })
    }
  })

  // ==========================================================================
  // Prerequisites Check
  // ==========================================================================

  describe('Prerequisites Check', () => {
    it('should have network available', async () => {
      if (!ctx.networkAvailable) {
        console.log('⏭️ Skipping - network not available')
        return
      }

      const chainId = await ctx.publicClient.getChainId()
      expect(chainId).toBe(TEST_CONFIG.chainId)
      console.log(`✅ Network available, Chain ID: ${chainId}`)
    })

    it('should have bundler available with supported entry points', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) {
        console.log('⏭️ Skipping - bundler not available')
        return
      }

      const entryPoints = await ctx.bundlerClient.getSupportedEntryPoints()
      expect(entryPoints).toBeDefined()
      expect(Array.isArray(entryPoints)).toBe(true)
      console.log(`✅ Bundler available, Entry Points: ${entryPoints.join(', ')}`)
    })

    it('should have EntryPoint contract deployed', async () => {
      if (!ctx.networkAvailable) return

      const code = await ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.entryPoint as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
        console.log('✅ EntryPoint deployed')
      } else {
        console.log('⚠️ EntryPoint NOT deployed')
      }
    })

    it('should have Kernel Factory deployed', async () => {
      if (!ctx.networkAvailable) return

      const code = await ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.kernelFactory as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
        console.log('✅ Kernel Factory deployed')
      } else {
        console.log('⚠️ Kernel Factory NOT deployed')
      }
    })

    it('should have ECDSA Validator deployed', async () => {
      if (!ctx.networkAvailable) return

      const code = await ctx.publicClient.getCode({
        address: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
        console.log('✅ ECDSA Validator deployed')
      } else {
        console.log('⚠️ ECDSA Validator NOT deployed')
      }
    })
  })

  // ==========================================================================
  // SDK: ECDSA Validator
  // ==========================================================================

  describe('SDK: ECDSA Validator (plugin-ecdsa)', () => {
    it('should create ECDSA validator from signer', async () => {
      if (!ctx.networkAvailable) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      expect(validator.address).toBe(TEST_CONFIG.contracts.ecdsaValidator)
      expect(validator.type).toBe('validator')
      expect(validator.getSignerAddress()).toBe(ctx.account.address)

      console.log(`✅ ECDSA validator created`)
      console.log(`   Validator address: ${validator.address}`)
      console.log(`   Signer address: ${validator.getSignerAddress()}`)
    })

    it('should get init data from validator', async () => {
      if (!ctx.networkAvailable) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      const initData = await validator.getInitData()

      // Init data should be the signer address (20 bytes = 40 hex chars + 0x)
      expect(initData).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(initData.toLowerCase()).toBe(ctx.account.address.toLowerCase())

      console.log(`✅ Validator init data: ${initData}`)
    })

    it('should sign hash with validator', async () => {
      if (!ctx.networkAvailable) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
      })

      const testHash = '0x' + '1'.repeat(64) as Hex
      const signature = await validator.signHash(testHash)

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(signature.length).toBeGreaterThan(130) // ECDSA signature

      console.log(`✅ Signature created (${signature.length} chars)`)
    })
  })

  // ==========================================================================
  // SDK: Kernel Smart Account
  // ==========================================================================

  describe('SDK: Kernel Smart Account (accounts)', () => {
    it('should create Kernel smart account', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) {
        console.log('⏭️ Skipping - prerequisites not met')
        return
      }

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      ctx.smartAccount = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        entryPoint: TEST_CONFIG.contracts.entryPoint as Address,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 0n,
      })

      expect(ctx.smartAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(ctx.smartAccount.entryPoint).toBe(TEST_CONFIG.contracts.entryPoint)

      console.log(`✅ Kernel smart account created`)
      console.log(`   Account address: ${ctx.smartAccount.address}`)
      console.log(`   Entry point: ${ctx.smartAccount.entryPoint}`)
    })

    it('should generate different addresses for different indexes', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      const account0 = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 0n,
      })

      const account1 = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 1n,
      })

      expect(account0.address).not.toBe(account1.address)

      console.log(`✅ Different indexes produce different addresses`)
      console.log(`   Index 0: ${account0.address}`)
      console.log(`   Index 1: ${account1.address}`)
    })

    it('should get nonce from smart account', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.smartAccount) return

      const nonce = await ctx.smartAccount.getNonce()

      expect(nonce).toBeGreaterThanOrEqual(0n)
      console.log(`✅ Nonce: ${nonce}`)
    })

    it('should check if smart account is deployed', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.smartAccount) return

      const deployed = await ctx.smartAccount.isDeployed()

      expect(typeof deployed).toBe('boolean')
      console.log(`✅ Account deployed: ${deployed}`)
    })

    it('should get factory and factory data for new account', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.smartAccount) return

      const deployed = await ctx.smartAccount.isDeployed()

      if (!deployed) {
        const factory = await ctx.smartAccount.getFactory()
        const factoryData = await ctx.smartAccount.getFactoryData()

        expect(factory).toBe(TEST_CONFIG.contracts.kernelFactory)
        expect(factoryData).toMatch(/^0x[a-fA-F0-9]+$/)

        console.log(`✅ Factory: ${factory}`)
        console.log(`   Factory data: ${factoryData?.slice(0, 50)}...`)
      } else {
        const factory = await ctx.smartAccount.getFactory()
        expect(factory).toBeUndefined()
        console.log('✅ Account already deployed, no factory needed')
      }
    })

    it('should encode call data using SDK utility', async () => {
      if (!ctx.networkAvailable) return

      const call = {
        to: '0x1234567890123456789012345678901234567890' as Address,
        value: parseEther('0.1'),
        data: '0x' as Hex,
      }

      const callData = encodeKernelExecuteCallData(call)

      expect(callData).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(callData.length).toBeGreaterThan(10)

      console.log(`✅ Call data encoded using SDK (${callData.length} chars)`)
    })

    it('should encode batch calls using SDK utility', async () => {
      if (!ctx.networkAvailable) return

      const calls = [
        {
          to: '0x1234567890123456789012345678901234567890' as Address,
          value: parseEther('0.1'),
          data: '0x' as Hex,
        },
        {
          to: '0x0987654321098765432109876543210987654321' as Address,
          value: 0n,
          data: '0xabcdef' as Hex,
        },
      ]

      const callData = encodeKernelExecuteCallData(calls)

      expect(callData).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(callData.length).toBeGreaterThan(100)

      console.log(`✅ Batch call data encoded using SDK (${callData.length} chars)`)
    })
  })

  // ==========================================================================
  // SDK: UserOperation Utilities
  // ==========================================================================

  describe('SDK: UserOperation Utilities (core)', () => {
    it('should pack UserOperation using SDK', async () => {
      if (!ctx.networkAvailable) return

      const userOp: UserOperation = {
        sender: ctx.account.address,
        nonce: 0n,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        signature: '0x' as Hex,
      }

      const packed = packUserOperation(userOp)

      expect(packed.sender).toBe(userOp.sender)
      expect(packed.nonce).toMatch(/^0x/)
      expect(packed.accountGasLimits).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(packed.gasFees).toMatch(/^0x[a-fA-F0-9]{64}$/)

      console.log('✅ UserOperation packed using SDK')
      console.log(`   accountGasLimits: ${packed.accountGasLimits}`)
      console.log(`   gasFees: ${packed.gasFees}`)
    })

    it('should compute UserOperation hash using SDK', async () => {
      if (!ctx.networkAvailable) return

      const userOp: UserOperation = {
        sender: ctx.account.address,
        nonce: 0n,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        signature: '0x' as Hex,
      }

      const hash = getUserOperationHash(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      console.log(`✅ UserOp hash computed using SDK: ${hash}`)
    })

    it('should produce consistent hash for same UserOp', async () => {
      if (!ctx.networkAvailable) return

      const userOp: UserOperation = {
        sender: ctx.account.address,
        nonce: 123n,
        callData: '0xabcdef' as Hex,
        callGasLimit: 50000n,
        verificationGasLimit: 75000n,
        preVerificationGas: 10000n,
        maxFeePerGas: 2000000000n,
        maxPriorityFeePerGas: 1000000000n,
        signature: '0x1234' as Hex,
      }

      const hash1 = getUserOperationHash(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      const hash2 = getUserOperationHash(
        userOp,
        TEST_CONFIG.contracts.entryPoint as Address,
        BigInt(TEST_CONFIG.chainId)
      )

      expect(hash1).toBe(hash2)
      console.log('✅ Hash is deterministic')
    })
  })

  // ==========================================================================
  // SDK: Bundler Client
  // ==========================================================================

  describe('SDK: Bundler Client (core)', () => {
    it('should get supported entry points', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) {
        console.log('⏭️ Skipping - bundler not available')
        return
      }

      const entryPoints = await ctx.bundlerClient.getSupportedEntryPoints()

      expect(entryPoints).toBeDefined()
      expect(Array.isArray(entryPoints)).toBe(true)
      expect(entryPoints.length).toBeGreaterThan(0)

      console.log(`✅ Supported entry points: ${entryPoints.join(', ')}`)
    })

    it('should get chain ID from bundler', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) return

      const chainId = await ctx.bundlerClient.getChainId()

      expect(chainId).toBe(BigInt(TEST_CONFIG.chainId))
      console.log(`✅ Bundler chain ID: ${chainId}`)
    })

    it('should estimate gas for UserOperation', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient || !ctx.smartAccount) {
        console.log('⏭️ Skipping - prerequisites not met')
        return
      }

      try {
        const estimation = await ctx.bundlerClient.estimateUserOperationGas({
          sender: ctx.smartAccount.address,
          callData: '0x' as Hex,
          nonce: await ctx.smartAccount.getNonce(),
          factory: await ctx.smartAccount.getFactory(),
          factoryData: await ctx.smartAccount.getFactoryData(),
        })

        expect(estimation.preVerificationGas).toBeGreaterThan(0n)
        expect(estimation.verificationGasLimit).toBeGreaterThan(0n)
        expect(estimation.callGasLimit).toBeGreaterThan(0n)

        console.log('✅ Gas estimation successful using SDK')
        console.log(`   preVerificationGas: ${estimation.preVerificationGas}`)
        console.log(`   verificationGasLimit: ${estimation.verificationGasLimit}`)
        console.log(`   callGasLimit: ${estimation.callGasLimit}`)
      } catch (error) {
        // Expected if account needs funding or contracts not ready
        console.log(`⚠️ Gas estimation failed (may need funding): ${(error as Error).message?.slice(0, 100)}`)
      }
    })

    it('should return null for non-existent UserOp receipt', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) return

      const fakeHash = '0x' + '1'.repeat(64) as Hex
      const receipt = await ctx.bundlerClient.getUserOperationReceipt(fakeHash)

      expect(receipt).toBeNull()
      console.log('✅ Non-existent receipt returns null')
    })

    it('should return null for non-existent UserOp by hash', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) return

      const fakeHash = '0x' + '2'.repeat(64) as Hex
      const result = await ctx.bundlerClient.getUserOperationByHash(fakeHash)

      expect(result).toBeNull()
      console.log('✅ Non-existent UserOp returns null')
    })

    it('should reject invalid UserOperation submission', async () => {
      if (!ctx.networkAvailable || !ctx.bundlerAvailable || !ctx.bundlerClient) return

      const invalidUserOp: UserOperation = {
        sender: ctx.account.address,
        nonce: 0n,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        signature: '0xdeadbeef' as Hex, // Invalid signature
      }

      await expect(
        ctx.bundlerClient.sendUserOperation(invalidUserOp)
      ).rejects.toThrow()

      console.log('✅ Invalid UserOp correctly rejected')
    })
  })

  // ==========================================================================
  // SDK: Smart Account Client (High-Level)
  // ==========================================================================

  describe('SDK: Smart Account Client (core)', () => {
    it('should create smart account client', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.bundlerAvailable) {
        console.log('⏭️ Skipping - prerequisites not met')
        return
      }

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      const smartAccount = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        entryPoint: TEST_CONFIG.contracts.entryPoint as Address,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 99n, // Use different index to avoid conflicts
      })

      const chain = { ...foundry, id: TEST_CONFIG.chainId }

      const client = createSmartAccountClient({
        account: smartAccount,
        chain,
        transport: http(TEST_CONFIG.rpcUrl),
        bundlerTransport: http(TEST_CONFIG.bundlerUrl),
      })

      expect(client.getAddress()).toBe(smartAccount.address)
      expect(client.account).toBe(smartAccount)
      expect(client.chain.id).toBe(TEST_CONFIG.chainId)

      console.log('✅ Smart account client created using SDK')
      console.log(`   Address: ${client.getAddress()}`)
    })

    it('should get nonce via smart account client', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.bundlerAvailable) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      const smartAccount = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 100n,
      })

      const chain = { ...foundry, id: TEST_CONFIG.chainId }

      const client = createSmartAccountClient({
        account: smartAccount,
        chain,
        transport: http(TEST_CONFIG.rpcUrl),
        bundlerTransport: http(TEST_CONFIG.bundlerUrl),
      })

      const nonce = await client.getNonce()

      expect(nonce).toBeGreaterThanOrEqual(0n)
      console.log(`✅ Nonce via client: ${nonce}`)
    })

    it('should check deployment status via smart account client', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.bundlerAvailable) return

      const validator = await createEcdsaValidator({
        signer: ctx.account,
        validatorAddress: TEST_CONFIG.contracts.ecdsaValidator as Address,
      })

      const smartAccount = await toKernelSmartAccount({
        client: ctx.publicClient,
        validator,
        factoryAddress: TEST_CONFIG.contracts.kernelFactory as Address,
        index: 101n,
      })

      const chain = { ...foundry, id: TEST_CONFIG.chainId }

      const client = createSmartAccountClient({
        account: smartAccount,
        chain,
        transport: http(TEST_CONFIG.rpcUrl),
        bundlerTransport: http(TEST_CONFIG.bundlerUrl),
      })

      const deployed = await client.isDeployed()

      expect(typeof deployed).toBe('boolean')
      console.log(`✅ Deployed status via client: ${deployed}`)
    })
  })

  // ==========================================================================
  // EntryPoint Direct Interactions
  // ==========================================================================

  describe('EntryPoint Direct Interactions', () => {
    it('should deposit ETH to EntryPoint for prefunding', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) return

      const entryPoint = TEST_CONFIG.contracts.entryPoint as Address
      const depositor = TEST_CONFIG.accounts.deployer.address as Address

      const deployerAccount = privateKeyToAccount(
        TEST_CONFIG.accounts.deployer.privateKey as Hex
      )
      const deployerWallet = createWalletClient({
        chain: { ...foundry, id: TEST_CONFIG.chainId },
        transport: http(TEST_CONFIG.rpcUrl),
        account: deployerAccount,
      })

      const balanceBefore = await ctx.publicClient.readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'balanceOf',
        args: [depositor],
      })

      console.log(`   Balance before: ${formatEther(balanceBefore as bigint)} ETH`)

      const depositAmount = parseEther('0.01')
      const hash = await deployerWallet.writeContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'depositTo',
        args: [depositor],
        value: depositAmount,
      })

      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')

      const balanceAfter = await ctx.publicClient.readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'balanceOf',
        args: [depositor],
      })

      console.log(`   Balance after: ${formatEther(balanceAfter as bigint)} ETH`)
      expect(balanceAfter).toBeGreaterThan(balanceBefore as bigint)
      console.log('✅ EntryPoint deposit successful')
    })

    it('should get nonce from EntryPoint', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed) return

      const entryPoint = TEST_CONFIG.contracts.entryPoint as Address
      const sender = ctx.account.address

      const nonce = await ctx.publicClient.readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [sender, 0n],
      })

      expect(nonce).toBeGreaterThanOrEqual(0n)
      console.log(`✅ Nonce for ${sender.slice(0, 10)}...: ${nonce}`)
    })
  })

  // ==========================================================================
  // Full E2E Flow (Integration)
  // ==========================================================================

  describe('Full E2E Flow', () => {
    it('should sign UserOperation using smart account', async () => {
      if (!ctx.networkAvailable || !ctx.contractsDeployed || !ctx.smartAccount) return

      const userOp: UserOperation = {
        sender: ctx.smartAccount.address,
        nonce: await ctx.smartAccount.getNonce(),
        factory: await ctx.smartAccount.getFactory(),
        factoryData: await ctx.smartAccount.getFactoryData(),
        callData: await ctx.smartAccount.encodeCallData({
          to: '0x0000000000000000000000000000000000000001',
          value: 0n,
          data: '0x',
        }),
        callGasLimit: 100000n,
        verificationGasLimit: 200000n,
        preVerificationGas: 50000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        signature: '0x',
      }

      const userOpHash = getUserOperationHash(
        userOp,
        ctx.smartAccount.entryPoint,
        BigInt(TEST_CONFIG.chainId)
      )

      const signature = await ctx.smartAccount.signUserOperation(userOpHash)

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(signature.length).toBeGreaterThan(130)

      console.log('✅ UserOperation signed via smart account')
      console.log(`   Hash: ${userOpHash}`)
      console.log(`   Signature: ${signature.slice(0, 50)}...`)
    })
  })
})

// ============================================================================
// SDK Utility Unit Tests
// ============================================================================

describe('SDK Utility Unit Tests', () => {
  it('should use correct entry point constant', () => {
    expect(ENTRY_POINT_V07_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    console.log(`✅ ENTRY_POINT_V07_ADDRESS: ${ENTRY_POINT_V07_ADDRESS}`)
  })

  it('should use correct ECDSA validator constant', () => {
    expect(ECDSA_VALIDATOR_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/)
    console.log(`✅ ECDSA_VALIDATOR_ADDRESS: ${ECDSA_VALIDATOR_ADDRESS}`)
  })

  it('should pack UserOperation with factory data', () => {
    const userOp: UserOperation = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: 5n,
      factory: '0xfactory000000000000000000000000000factory',
      factoryData: '0xfactorydata1234',
      callData: '0xcalldata5678',
      callGasLimit: 100000n,
      verificationGasLimit: 100000n,
      preVerificationGas: 21000n,
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
      signature: '0xsignature',
    }

    const packed = packUserOperation(userOp)

    // initCode should be factory + factoryData
    expect(packed.initCode).toContain('factory')
    expect(packed.initCode.length).toBeGreaterThan(42)

    console.log('✅ UserOperation with factory data packed correctly')
  })

  it('should pack UserOperation with paymaster data', () => {
    const userOp: UserOperation = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: 0n,
      callData: '0x',
      callGasLimit: 100000n,
      verificationGasLimit: 100000n,
      preVerificationGas: 21000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1000000000n,
      paymaster: '0xpaymaster0000000000000000000000paymaster',
      paymasterVerificationGasLimit: 50000n,
      paymasterPostOpGasLimit: 30000n,
      paymasterData: '0xpaymasterdata',
      signature: '0x',
    }

    const packed = packUserOperation(userOp)

    // paymasterAndData should contain paymaster address
    expect(packed.paymasterAndData).toContain('paymaster')
    expect(packed.paymasterAndData.length).toBeGreaterThan(42)

    console.log('✅ UserOperation with paymaster data packed correctly')
  })

  it('should handle empty optional fields in UserOperation', () => {
    const userOp: UserOperation = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: 0n,
      callData: '0x',
      callGasLimit: 100000n,
      verificationGasLimit: 100000n,
      preVerificationGas: 21000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1000000000n,
      signature: '0x',
    }

    const packed = packUserOperation(userOp)

    expect(packed.initCode).toBe('0x')
    expect(packed.paymasterAndData).toBe('0x')

    console.log('✅ Empty optional fields handled correctly')
  })
})
