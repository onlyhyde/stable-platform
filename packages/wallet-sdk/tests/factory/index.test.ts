import { describe, expect, it, vi } from 'vitest'
import { predictCounterfactualAddress, getSenderAddress } from '../../src/factory'

describe('factory module', () => {
  describe('predictCounterfactualAddress', () => {
    it('should compute a deterministic CREATE2 address', () => {
      const factory = '0x1234567890123456789012345678901234567890' as const
      const initCodeHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const
      const salt = '0x0000000000000000000000000000000000000000000000000000000000000001' as const

      const address = predictCounterfactualAddress(factory, initCodeHash, salt)
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should return different addresses for different salts', () => {
      const factory = '0x1234567890123456789012345678901234567890' as const
      const initCodeHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const
      const salt1 = '0x0000000000000000000000000000000000000000000000000000000000000001' as const
      const salt2 = '0x0000000000000000000000000000000000000000000000000000000000000002' as const

      const address1 = predictCounterfactualAddress(factory, initCodeHash, salt1)
      const address2 = predictCounterfactualAddress(factory, initCodeHash, salt2)
      expect(address1).not.toBe(address2)
    })

    it('should return same address for same inputs', () => {
      const factory = '0x1234567890123456789012345678901234567890' as const
      const initCodeHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const
      const salt = '0x0000000000000000000000000000000000000000000000000000000000000001' as const

      const address1 = predictCounterfactualAddress(factory, initCodeHash, salt)
      const address2 = predictCounterfactualAddress(factory, initCodeHash, salt)
      expect(address1).toBe(address2)
    })
  })

  describe('getSenderAddress', () => {
    it('should parse SenderAddressResult revert data', async () => {
      const expectedAddress = '0xABcdEF1234567890ABCDef1234567890AbCdEf12'
      // SenderAddressResult selector (0x6ca7b806) + padded address
      const revertData = '0x6ca7b806000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'

      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: revertData }),
      } as unknown as Parameters<typeof getSenderAddress>[0]

      const result = await getSenderAddress(
        mockClient,
        '0x0000000000000000000000000000000000000001',
        '0xabcd'
      )

      expect(result.toLowerCase()).toBe(expectedAddress.toLowerCase())
    })

    it('should throw on unexpected revert data', async () => {
      const mockClient = {
        call: vi.fn().mockRejectedValue({ data: '0x12345678aabbccdd' }),
      } as unknown as Parameters<typeof getSenderAddress>[0]

      await expect(
        getSenderAddress(
          mockClient,
          '0x0000000000000000000000000000000000000001',
          '0xabcd'
        )
      ).rejects.toThrow('Unexpected revert data')
    })

    it('should throw on non-revert error', async () => {
      const mockClient = {
        call: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as Parameters<typeof getSenderAddress>[0]

      await expect(
        getSenderAddress(
          mockClient,
          '0x0000000000000000000000000000000000000001',
          '0xabcd'
        )
      ).rejects.toThrow('Network error')
    })
  })
})
