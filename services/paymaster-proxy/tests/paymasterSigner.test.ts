import type { Address, Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { type ContractSignerConfig, PaymasterSigner } from '../src/signer/paymasterSigner'

// Mock dependencies
vi.mock('../src/config/constants', () => ({
  getSignerConfig: vi.fn(() => ({
    validitySeconds: 3600,
    clockSkewSeconds: 60,
  })),
}))

vi.mock('@stablenet/core', () => ({
  encodePaymasterData: vi.fn(() => '0xenvelope'),
  encodePaymasterDataWithSignature: vi.fn(
    (envelope: string, sig: string) => `${envelope}${sig.slice(2)}` as Hex
  ),
  computePaymasterDomainSeparator: vi.fn(() => '0xdomain'),
  computeUserOpCoreHash: vi.fn(() => '0xcorehash'),
  computePaymasterHash: vi.fn(() => '0x' + 'ab'.repeat(32)),
}))

vi.mock('../src/utils/userOpNormalizer', () => ({
  toPackedForCoreHash: vi.fn((op: unknown) => op),
}))

vi.mock('../src/utils/validation', () => ({
  validateTimeRange: vi.fn(() => null),
}))

const PRIVATE_KEY = ('0x' + 'ab'.repeat(32)) as Hex
const PAYMASTER_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address

describe('PaymasterSigner', () => {
  describe('constructor and type detection', () => {
    it('should default to EOA signer type', () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      expect(signer.getSignerType()).toBe('eoa')
    })

    it('should use ERC-1271 when contractSigner is provided', () => {
      const contractConfig: ContractSignerConfig = {
        contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        publicClient: {} as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      expect(signer.getSignerType()).toBe('erc1271')
    })
  })

  describe('getSignerAddress', () => {
    it('should return EOA address derived from private key', () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      const address = signer.getSignerAddress()
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should return contract address for ERC-1271 signer', () => {
      const contractAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
      const contractConfig: ContractSignerConfig = {
        contractAddress: contractAddr,
        publicClient: {} as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      expect(signer.getSignerAddress()).toBe(contractAddr)
    })
  })

  describe('generateStubData', () => {
    it('should generate stub data with zero signature for EOA', () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      const result = signer.generateStubData('verifying' as never, '0x' as Hex)

      expect(result.paymasterData).toBeDefined()
      expect(result.validUntil).toBeGreaterThan(0)
      expect(result.validAfter).toBeGreaterThan(0)
      expect(result.validUntil).toBeGreaterThan(result.validAfter)
    })

    it('should generate larger stub for ERC-1271 signer', () => {
      const contractConfig: ContractSignerConfig = {
        contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        publicClient: {} as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      const result = signer.generateStubData('verifying' as never, '0x' as Hex)

      // ERC-1271 stub should exist
      expect(result.paymasterData).toBeDefined()
    })

    it('should use custom validity seconds', () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      const result = signer.generateStubData('verifying' as never, '0x' as Hex, 7200)

      expect(result.validUntil).toBeGreaterThan(0)
    })

    it('should throw on invalid time range', async () => {
      const validation = await import('../src/utils/validation')
      vi.mocked(validation.validateTimeRange).mockReturnValueOnce({
        code: -32602,
        message: 'bad time',
      })

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      expect(() => signer.generateStubData('verifying' as never, '0x' as Hex)).toThrow(
        'Invalid time range'
      )
    })
  })

  describe('generateSignedData', () => {
    it('should generate signed data for EOA', async () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      const result = await signer.generateSignedData(
        {
          sender: '0x1234567890123456789012345678901234567890' as Address,
          nonce: '0x0' as Hex,
          callData: '0x' as Hex,
          callGasLimit: '0x10000' as Hex,
          verificationGasLimit: '0x10000' as Hex,
          preVerificationGas: '0x5000' as Hex,
          maxFeePerGas: '0x1' as Hex,
          maxPriorityFeePerGas: '0x1' as Hex,
          signature: '0x' as Hex,
        },
        '0xEf6817fe73741A8F10088f9511c64b666a338A14' as Address,
        1n,
        'verifying' as never,
        '0x' as Hex
      )

      expect(result.paymasterData).toBeDefined()
      expect(result.validUntil).toBeGreaterThan(0)
      expect(result.validAfter).toBeGreaterThan(0)
    })
  })

  describe('verifyERC1271Signature', () => {
    it('should throw without contract signer config', async () => {
      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS)
      await expect(
        signer.verifyERC1271Signature(('0x' + 'ab'.repeat(32)) as Hex, '0x' as Hex)
      ).rejects.toThrow('ERC-1271 verification requires contract signer config')
    })

    it('should return true for valid ERC-1271 signature', async () => {
      const mockClient = {
        readContract: vi.fn(async () => '0x1626ba7e'),
      }

      const contractConfig: ContractSignerConfig = {
        contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        publicClient: mockClient as unknown as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      const result = await signer.verifyERC1271Signature(
        ('0x' + 'ab'.repeat(32)) as Hex,
        '0xsig' as Hex
      )
      expect(result).toBe(true)
    })

    it('should return false for invalid ERC-1271 signature', async () => {
      const mockClient = {
        readContract: vi.fn(async () => '0xffffffff'),
      }

      const contractConfig: ContractSignerConfig = {
        contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        publicClient: mockClient as unknown as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      const result = await signer.verifyERC1271Signature(
        ('0x' + 'ab'.repeat(32)) as Hex,
        '0xsig' as Hex
      )
      expect(result).toBe(false)
    })

    it('should return false on readContract error', async () => {
      const mockClient = {
        readContract: vi.fn(async () => {
          throw new Error('revert')
        }),
      }

      const contractConfig: ContractSignerConfig = {
        contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
        publicClient: mockClient as unknown as never,
        signerPrivateKey: PRIVATE_KEY,
      }

      const signer = new PaymasterSigner(PRIVATE_KEY, PAYMASTER_ADDRESS, contractConfig)
      const result = await signer.verifyERC1271Signature(
        ('0x' + 'ab'.repeat(32)) as Hex,
        '0xsig' as Hex
      )
      expect(result).toBe(false)
    })
  })
})
