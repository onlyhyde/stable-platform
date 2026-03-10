/**
 * PaymasterHasher Tests
 *
 * T2: Missing paymasterHasher.ts unit tests
 */

import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  computePaymasterDomainSeparator,
  computePaymasterHash,
  computeUserOpCoreHash,
  PAYMASTER_DOMAIN_NAME,
  PAYMASTER_DOMAIN_VERSION,
} from '../../src/paymaster/paymasterHasher'

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const PAYMASTER = '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as Address
const CHAIN_ID = 1n

// accountGasLimits and gasFees are bytes32 (64 hex chars after 0x prefix)
// accountGasLimits = verificationGasLimit(uint128) || callGasLimit(uint128)
// gasFees = maxPriorityFeePerGas(uint128) || maxFeePerGas(uint128)
const MOCK_USER_OP = {
  sender: '0x1234567890123456789012345678901234567890' as Address,
  nonce: 0n,
  initCode: '0x' as Hex,
  callData: '0xdeadbeef' as Hex,
  accountGasLimits: '0x00000000000000000000000000007a120000000000000000000000000000c350' as Hex,
  preVerificationGas: 50000n,
  gasFees: '0x000000000000000000000000003b9aca00000000000000000000000059682f00' as Hex,
}

describe('PaymasterHasher', () => {
  // ========================================================================
  // Constants
  // ========================================================================

  describe('constants', () => {
    it('should export domain name and version', () => {
      expect(PAYMASTER_DOMAIN_NAME).toBe('StableNetPaymaster')
      expect(PAYMASTER_DOMAIN_VERSION).toBe('1')
    })
  })

  // ========================================================================
  // computePaymasterDomainSeparator
  // ========================================================================

  describe('computePaymasterDomainSeparator', () => {
    it('should produce deterministic hash', () => {
      const ds1 = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const ds2 = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)

      expect(ds1).toBe(ds2)
      expect(ds1).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should produce different hash for different chain IDs', () => {
      const ds1 = computePaymasterDomainSeparator(1n, ENTRY_POINT, PAYMASTER)
      const ds2 = computePaymasterDomainSeparator(137n, ENTRY_POINT, PAYMASTER)

      expect(ds1).not.toBe(ds2)
    })

    it('should produce different hash for different entry points', () => {
      const ds1 = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const ds2 = computePaymasterDomainSeparator(
        CHAIN_ID,
        '0x1111111111111111111111111111111111111111' as Address,
        PAYMASTER
      )

      expect(ds1).not.toBe(ds2)
    })

    it('should produce different hash for different paymaster addresses', () => {
      const ds1 = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const ds2 = computePaymasterDomainSeparator(
        CHAIN_ID,
        ENTRY_POINT,
        '0x2222222222222222222222222222222222222222' as Address
      )

      expect(ds1).not.toBe(ds2)
    })
  })

  // ========================================================================
  // computeUserOpCoreHash
  // ========================================================================

  describe('computeUserOpCoreHash', () => {
    it('should produce deterministic hash', () => {
      const hash1 = computeUserOpCoreHash(MOCK_USER_OP)
      const hash2 = computeUserOpCoreHash(MOCK_USER_OP)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should produce different hash for different senders', () => {
      const hash1 = computeUserOpCoreHash(MOCK_USER_OP)
      const hash2 = computeUserOpCoreHash({
        ...MOCK_USER_OP,
        sender: '0x9999999999999999999999999999999999999999' as Address,
      })

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash for different nonces', () => {
      const hash1 = computeUserOpCoreHash(MOCK_USER_OP)
      const hash2 = computeUserOpCoreHash({ ...MOCK_USER_OP, nonce: 1n })

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash for different callData', () => {
      const hash1 = computeUserOpCoreHash(MOCK_USER_OP)
      const hash2 = computeUserOpCoreHash({ ...MOCK_USER_OP, callData: '0xcafebabe' as Hex })

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty initCode', () => {
      const hash = computeUserOpCoreHash({ ...MOCK_USER_OP, initCode: '0x' as Hex })
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })

  // ========================================================================
  // computePaymasterHash
  // ========================================================================

  describe('computePaymasterHash', () => {
    it('should produce deterministic hash', () => {
      const ds = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const userOpHash = computeUserOpCoreHash(MOCK_USER_OP)
      const envelope = '0xaabbccdd' as Hex

      const hash1 = computePaymasterHash(ds, userOpHash, envelope)
      const hash2 = computePaymasterHash(ds, userOpHash, envelope)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should produce different hash for different domain separators', () => {
      const ds1 = computePaymasterDomainSeparator(1n, ENTRY_POINT, PAYMASTER)
      const ds2 = computePaymasterDomainSeparator(137n, ENTRY_POINT, PAYMASTER)
      const userOpHash = computeUserOpCoreHash(MOCK_USER_OP)
      const envelope = '0xaabbccdd' as Hex

      expect(computePaymasterHash(ds1, userOpHash, envelope)).not.toBe(
        computePaymasterHash(ds2, userOpHash, envelope)
      )
    })

    it('should produce different hash for different envelopes', () => {
      const ds = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const userOpHash = computeUserOpCoreHash(MOCK_USER_OP)

      const hash1 = computePaymasterHash(ds, userOpHash, '0xaabbccdd' as Hex)
      const hash2 = computePaymasterHash(ds, userOpHash, '0x11223344' as Hex)

      expect(hash1).not.toBe(hash2)
    })

    it('should compose all three components', () => {
      const ds = computePaymasterDomainSeparator(CHAIN_ID, ENTRY_POINT, PAYMASTER)
      const userOpHash = computeUserOpCoreHash(MOCK_USER_OP)
      const envelope = '0xdeadbeef' as Hex

      const fullHash = computePaymasterHash(ds, userOpHash, envelope)
      expect(fullHash).toMatch(/^0x[a-f0-9]{64}$/)

      // Changing any input should change the output
      const differentOp = computeUserOpCoreHash({ ...MOCK_USER_OP, nonce: 999n })
      expect(computePaymasterHash(ds, differentOp, envelope)).not.toBe(fullHash)
    })
  })
})
