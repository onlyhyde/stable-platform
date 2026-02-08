/**
 * Test Utility Functions
 * Common helpers for wallet extension tests
 */

import type { Address, Hex } from 'viem'

// Test accounts with known private keys (DO NOT USE IN PRODUCTION)
export const TEST_ACCOUNTS = {
  account1: {
    address: '0x1234567890123456789012345678901234567890' as Address,
    privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex,
  },
  account2: {
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
    privateKey: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210' as Hex,
  },
} as const

// Test mnemonic (BIP39 valid - DO NOT USE IN PRODUCTION)
export const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export const TEST_MNEMONIC_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

// Test passwords
export const TEST_PASSWORD = 'TestPassword123!'
export const TEST_PASSWORD_WEAK = 'weak'

// Test origins
export const TEST_ORIGINS = {
  trusted: 'https://app.example.com',
  untrusted: 'https://suspicious-site.com',
  localhost: 'http://localhost:3000',
} as const

// Test chain IDs
export const TEST_CHAIN_IDS = {
  mainnet: 1,
  sepolia: 11155111,
  localhost: 1337,
} as const

/**
 * Wait for a specified amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await delay(interval)
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Create a mock transaction request
 */
export function createMockTransaction(
  overrides: Partial<{
    from: Address
    to: Address
    value: bigint
    data: Hex
    gas: bigint
    gasPrice: bigint
    nonce: number
  }> = {}
) {
  return {
    from: TEST_ACCOUNTS.account1.address,
    to: TEST_ACCOUNTS.account2.address,
    value: BigInt(1000000000000000000), // 1 ETH
    data: '0x' as Hex,
    gas: BigInt(21000),
    gasPrice: BigInt(20000000000), // 20 Gwei
    nonce: 0,
    ...overrides,
  }
}

/**
 * Create a mock typed data for EIP-712 signing
 * Note: Uses number for chainId to be JSON-serializable
 */
export function createMockTypedData() {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
      ],
    },
    primaryType: 'Mail' as const,
    domain: {
      name: 'Ether Mail',
      version: '1',
      chainId: 1,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' as Address,
    },
    message: {
      from: {
        name: 'Alice',
        wallet: TEST_ACCOUNTS.account1.address,
      },
      to: {
        name: 'Bob',
        wallet: TEST_ACCOUNTS.account2.address,
      },
      contents: 'Hello, Bob!',
    },
  }
}

/**
 * Create a mock RPC request
 */
export function createMockRpcRequest(method: string, params: unknown[] = []) {
  return {
    id: Date.now(),
    jsonrpc: '2.0' as const,
    method,
    params,
  }
}

/**
 * Create a mock connected site
 */
export function createMockConnectedSite(
  overrides: Partial<{
    origin: string
    accounts: Address[]
    chainId: number
    connectedAt: number
  }> = {}
) {
  return {
    origin: TEST_ORIGINS.trusted,
    accounts: [TEST_ACCOUNTS.account1.address],
    chainId: TEST_CHAIN_IDS.mainnet,
    connectedAt: Date.now(),
    ...overrides,
  }
}

/**
 * Generate a random hex string of specified length
 */
export function randomHex(length: number): Hex {
  const chars = '0123456789abcdef'
  let result = '0x'
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result as Hex
}

/**
 * Generate a random address
 */
export function randomAddress(): Address {
  return randomHex(40) as Address
}

/**
 * Assert that a promise rejects with a specific error message
 */
export async function expectRejects(
  promise: Promise<unknown>,
  errorMessage: string | RegExp
): Promise<void> {
  try {
    await promise
    throw new Error('Expected promise to reject')
  } catch (error) {
    if (error instanceof Error) {
      if (typeof errorMessage === 'string') {
        expect(error.message).toContain(errorMessage)
      } else {
        expect(error.message).toMatch(errorMessage)
      }
    } else {
      throw error
    }
  }
}
