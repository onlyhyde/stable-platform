/**
 * Viem Mock Utilities
 * Mock implementations for viem library functions
 */

import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { TEST_ACCOUNTS, TEST_CHAIN_IDS } from './testUtils'

/**
 * Create a mock public client
 */
export function createMockPublicClient(
  overrides: Partial<{
    chainId: number
    getBalance: (args: { address: Address }) => Promise<bigint>
    getTransactionCount: (args: { address: Address }) => Promise<number>
    estimateGas: (args: unknown) => Promise<bigint>
    call: (args: unknown) => Promise<Hex>
    getBlockNumber: () => Promise<bigint>
    getGasPrice: () => Promise<bigint>
    getTransaction: (args: { hash: Hex }) => Promise<unknown>
    getTransactionReceipt: (args: { hash: Hex }) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: Hex }) => Promise<unknown>
  }> = {}
): Partial<PublicClient> {
  return {
    chain: { id: overrides.chainId ?? TEST_CHAIN_IDS.mainnet } as PublicClient['chain'],
    getBalance: overrides.getBalance ?? jest.fn(() => Promise.resolve(BigInt(1000000000000000000))),
    getTransactionCount: overrides.getTransactionCount ?? jest.fn(() => Promise.resolve(0)),
    estimateGas: overrides.estimateGas ?? jest.fn(() => Promise.resolve(BigInt(21000))),
    call: overrides.call ?? jest.fn(() => Promise.resolve('0x' as Hex)),
    getBlockNumber: overrides.getBlockNumber ?? jest.fn(() => Promise.resolve(BigInt(1000000))),
    getGasPrice: overrides.getGasPrice ?? jest.fn(() => Promise.resolve(BigInt(20000000000))),
    getTransaction: overrides.getTransaction ?? jest.fn(() => Promise.resolve(null)),
    getTransactionReceipt: overrides.getTransactionReceipt ?? jest.fn(() => Promise.resolve(null)),
    waitForTransactionReceipt:
      overrides.waitForTransactionReceipt ??
      jest.fn(() =>
        Promise.resolve({
          status: 'success',
          blockNumber: BigInt(1000001),
          transactionHash: ('0x' + '1'.repeat(64)) as Hex,
        })
      ),
  } as Partial<PublicClient>
}

/**
 * Create a mock wallet client
 */
export function createMockWalletClient(
  overrides: Partial<{
    account: { address: Address }
    chainId: number
    signMessage: (args: { message: string }) => Promise<Hex>
    signTypedData: (args: unknown) => Promise<Hex>
    signTransaction: (args: unknown) => Promise<Hex>
    sendTransaction: (args: unknown) => Promise<Hex>
  }> = {}
): Partial<WalletClient> {
  const mockSignature = ('0x' + '1'.repeat(130)) as Hex
  const mockTxHash = ('0x' + '2'.repeat(64)) as Hex

  return {
    account: overrides.account ?? { address: TEST_ACCOUNTS.account1.address },
    chain: { id: overrides.chainId ?? TEST_CHAIN_IDS.mainnet } as WalletClient['chain'],
    signMessage: overrides.signMessage ?? jest.fn(() => Promise.resolve(mockSignature)),
    signTypedData: overrides.signTypedData ?? jest.fn(() => Promise.resolve(mockSignature)),
    signTransaction: overrides.signTransaction ?? jest.fn(() => Promise.resolve(mockSignature)),
    sendTransaction: overrides.sendTransaction ?? jest.fn(() => Promise.resolve(mockTxHash)),
  } as Partial<WalletClient>
}

/**
 * Mock viem account functions
 */
export const mockViemAccount = {
  privateKeyToAccount: jest.fn((privateKey: Hex) => ({
    address: TEST_ACCOUNTS.account1.address,
    publicKey: ('0x04' + '1'.repeat(128)) as Hex,
    signMessage: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    signTypedData: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    signTransaction: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    source: 'privateKey' as const,
    type: 'local' as const,
  })),

  mnemonicToAccount: jest.fn((mnemonic: string, options?: { addressIndex?: number }) => ({
    address: TEST_ACCOUNTS.account1.address,
    publicKey: ('0x04' + '1'.repeat(128)) as Hex,
    signMessage: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    signTypedData: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    signTransaction: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(130)) as Hex)),
    source: 'mnemonic' as const,
    type: 'local' as const,
  })),

  generateMnemonic: jest.fn(
    () =>
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  ),

  generatePrivateKey: jest.fn(
    () => '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex
  ),
}

/**
 * Mock viem utility functions
 */
export const mockViemUtils = {
  isAddress: jest.fn((address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)),
  getAddress: jest.fn((address: string) => address as Address),
  isHex: jest.fn((value: string) => /^0x[a-fA-F0-9]*$/.test(value)),
  toHex: jest.fn((value: string | number | bigint) => {
    if (typeof value === 'string') return value as Hex
    return ('0x' + value.toString(16)) as Hex
  }),
  fromHex: jest.fn((hex: Hex, to: 'string' | 'number' | 'bigint') => {
    const value = hex.slice(2)
    if (to === 'string') return Buffer.from(value, 'hex').toString()
    if (to === 'number') return Number.parseInt(value, 16)
    return BigInt('0x' + value)
  }),
  parseEther: jest.fn((ether: string) => BigInt(Number.parseFloat(ether) * 1e18)),
  formatEther: jest.fn((wei: bigint) => (Number(wei) / 1e18).toString()),
  parseGwei: jest.fn((gwei: string) => BigInt(Number.parseFloat(gwei) * 1e9)),
  formatGwei: jest.fn((wei: bigint) => (Number(wei) / 1e9).toString()),
  keccak256: jest.fn(() => ('0x' + '3'.repeat(64)) as Hex),
  hashMessage: jest.fn(() => ('0x' + '4'.repeat(64)) as Hex),
  hashTypedData: jest.fn(() => ('0x' + '5'.repeat(64)) as Hex),
  recoverMessageAddress: jest.fn(() => Promise.resolve(TEST_ACCOUNTS.account1.address)),
  verifyMessage: jest.fn(() => Promise.resolve(true)),
  verifyTypedData: jest.fn(() => Promise.resolve(true)),
}

/**
 * Reset all viem mocks
 */
export function resetViemMocks(): void {
  Object.values(mockViemAccount).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear()
    }
  })
  Object.values(mockViemUtils).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear()
    }
  })
}
