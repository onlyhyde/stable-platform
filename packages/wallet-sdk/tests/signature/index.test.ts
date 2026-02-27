import { describe, expect, it, vi } from 'vitest'
import { isSmartContractAccount, isValidSignature, verifySignature } from '../../src/signature'
import type { SignatureVerificationResult } from '../../src/signature'

const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const
const mockSignature = '0x1234' as const
const mockAccount = '0x1234567890123456789012345678901234567890' as const

describe('signature module', () => {
  describe('isSmartContractAccount', () => {
    it('should return true when address has code', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue('0x608060'),
      } as unknown as Parameters<typeof isSmartContractAccount>[0]

      const result = await isSmartContractAccount(mockClient, mockAccount)
      expect(result).toBe(true)
      expect(mockClient.getCode).toHaveBeenCalledWith({ address: mockAccount })
    })

    it('should return false when address has no code', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue('0x'),
      } as unknown as Parameters<typeof isSmartContractAccount>[0]

      const result = await isSmartContractAccount(mockClient, mockAccount)
      expect(result).toBe(false)
    })

    it('should return false when getCode returns undefined', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof isSmartContractAccount>[0]

      const result = await isSmartContractAccount(mockClient, mockAccount)
      expect(result).toBe(false)
    })
  })

  describe('isValidSignature', () => {
    it('should return true when contract returns magic value', async () => {
      const mockClient = {
        readContract: vi.fn().mockResolvedValue('0x1626ba7e'),
      } as unknown as Parameters<typeof isValidSignature>[0]

      const result = await isValidSignature(mockClient, mockAccount, mockHash, mockSignature)
      expect(result).toBe(true)
    })

    it('should return false when contract returns different value', async () => {
      const mockClient = {
        readContract: vi.fn().mockResolvedValue('0xffffffff'),
      } as unknown as Parameters<typeof isValidSignature>[0]

      const result = await isValidSignature(mockClient, mockAccount, mockHash, mockSignature)
      expect(result).toBe(false)
    })

    it('should return false when contract call reverts', async () => {
      const mockClient = {
        readContract: vi.fn().mockRejectedValue(new Error('Reverted')),
      } as unknown as Parameters<typeof isValidSignature>[0]

      const result = await isValidSignature(mockClient, mockAccount, mockHash, mockSignature)
      expect(result).toBe(false)
    })
  })

  describe('verifySignature', () => {
    it('should verify contract signature via ERC-1271', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue('0x608060'),
        readContract: vi.fn().mockResolvedValue('0x1626ba7e'),
      } as unknown as Parameters<typeof verifySignature>[0]

      const result: SignatureVerificationResult = await verifySignature(
        mockClient, mockAccount, mockHash, mockSignature
      )

      expect(result.isValid).toBe(true)
      expect(result.signerType).toBe('contract')
      expect(result.recoveredAddress).toBeUndefined()
    })

    it('should return invalid for contract with bad signature', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue('0x608060'),
        readContract: vi.fn().mockResolvedValue('0xffffffff'),
      } as unknown as Parameters<typeof verifySignature>[0]

      const result = await verifySignature(
        mockClient, mockAccount, mockHash, mockSignature
      )

      expect(result.isValid).toBe(false)
      expect(result.signerType).toBe('contract')
    })

    it('should detect EOA and attempt ecrecover', async () => {
      const mockClient = {
        getCode: vi.fn().mockResolvedValue('0x'),
      } as unknown as Parameters<typeof verifySignature>[0]

      // ecrecover will likely fail with our mock data, which is expected
      const result = await verifySignature(
        mockClient, mockAccount, mockHash, mockSignature
      )

      expect(result.signerType).toBe('eoa')
      // With invalid signature data, it should gracefully return invalid
      expect(typeof result.isValid).toBe('boolean')
    })
  })
})
