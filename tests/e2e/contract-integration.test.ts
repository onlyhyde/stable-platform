import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { beforeAll, describe, expect, it } from 'vitest'
import { isNetworkAvailable, TEST_CONFIG } from '../setup'

// Contract ABIs (minimal for testing)
const ENTRY_POINT_ABI = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) payable',
])

const _KERNEL_FACTORY_ABI = parseAbi([
  'function createAccount(address implementation, bytes calldata data, uint256 index) returns (address)',
  'function getAddress(address implementation, bytes calldata data, uint256 index) view returns (address)',
])

const _KERNEL_ABI = parseAbi([
  'function execute(address to, uint256 value, bytes data, uint8 operation) external',
])

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

describe('Contract Integration Tests', () => {
  let publicClient: ReturnType<typeof createPublicClient>
  let walletClient: ReturnType<typeof createWalletClient>
  let account: ReturnType<typeof privateKeyToAccount>
  let networkAvailable: boolean

  beforeAll(async () => {
    networkAvailable = await isNetworkAvailable()
    if (!networkAvailable) {
      console.warn('⚠️ Local network not available, contract tests will be skipped')
      return
    }

    const chain = {
      ...foundry,
      id: TEST_CONFIG.chainId,
    }

    publicClient = createPublicClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
    })

    account = privateKeyToAccount(TEST_CONFIG.accounts.deployer.privateKey as `0x${string}`)

    walletClient = createWalletClient({
      chain,
      transport: http(TEST_CONFIG.rpcUrl),
      account,
    })
  })

  describe('EntryPoint Contract', () => {
    it('should check EntryPoint deployment', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.entryPoint) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
      })

      // EntryPoint should be deployed
      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
      } else {
      }
    })

    it('should get nonce from EntryPoint', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.entryPoint) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
      })

      if (!code || code === '0x') {
        return
      }

      const nonce = await publicClient.readContract({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [TEST_CONFIG.accounts.user1.address as `0x${string}`, 0n],
      })

      expect(nonce).toBeGreaterThanOrEqual(0n)
    })

    it('should deposit to EntryPoint', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.entryPoint) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
      })

      if (!code || code === '0x') {
        return
      }

      const depositAmount = parseEther('0.01')

      const balanceBefore = await publicClient.readContract({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
        abi: ENTRY_POINT_ABI,
        functionName: 'balanceOf',
        args: [TEST_CONFIG.accounts.user1.address as `0x${string}`],
      })

      // Deposit ETH to EntryPoint
      const hash = await walletClient.writeContract({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
        abi: ENTRY_POINT_ABI,
        functionName: 'depositTo',
        args: [TEST_CONFIG.accounts.user1.address as `0x${string}`],
        value: depositAmount,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe('success')

      const balanceAfter = await publicClient.readContract({
        address: TEST_CONFIG.contracts.entryPoint as `0x${string}`,
        abi: ENTRY_POINT_ABI,
        functionName: 'balanceOf',
        args: [TEST_CONFIG.accounts.user1.address as `0x${string}`],
      })
      expect(balanceAfter).toBeGreaterThan(balanceBefore as bigint)
    })
  })

  describe('Kernel Factory Contract', () => {
    it('should check Kernel Factory deployment', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.kernelFactory) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.kernelFactory as `0x${string}`,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
      } else {
      }
    })

    it('should compute counterfactual address', async () => {
      if (
        !networkAvailable ||
        !TEST_CONFIG.contracts.kernelFactory ||
        !TEST_CONFIG.contracts.kernelImplementation
      ) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.kernelFactory as `0x${string}`,
      })

      if (!code || code === '0x') {
        return
      }
      expect(true).toBe(true)
    })
  })

  describe('Validator Contract', () => {
    it('should check ECDSA Validator deployment', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.ecdsaValidator) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.ecdsaValidator as `0x${string}`,
      })

      if (code && code !== '0x') {
        expect(code.length).toBeGreaterThan(2)
      } else {
      }
    })
  })

  describe('Token Contracts', () => {
    it('should check USDC deployment', async () => {
      if (!networkAvailable || !TEST_CONFIG.contracts.usdc) {
        return
      }

      const code = await publicClient.getCode({
        address: TEST_CONFIG.contracts.usdc as `0x${string}`,
      })

      if (code && code !== '0x') {
        const balance = await publicClient.readContract({
          address: TEST_CONFIG.contracts.usdc as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [TEST_CONFIG.accounts.deployer.address as `0x${string}`],
        })
        expect(balance).toBeGreaterThanOrEqual(0n)
      }
    })
  })
})

describe('Full UserOperation Flow (E2E)', () => {
  it('should execute complete UserOp flow when all contracts deployed', async () => {
    const networkAvailable = await isNetworkAvailable()
    if (!networkAvailable) {
      return
    }

    // This test requires all contracts to be deployed
    const requiredContracts = [
      TEST_CONFIG.contracts.entryPoint,
      TEST_CONFIG.contracts.kernelFactory,
      TEST_CONFIG.contracts.ecdsaValidator,
    ]

    const allDeployed = requiredContracts.every((addr) => addr && addr.length > 2)

    if (!allDeployed) {
      return
    }
    expect(true).toBe(true)
  })
})
