/**
 * EIP-7702 Authorization Tests
 *
 * T3: parseSignature edge cases + other authorization functions
 */

import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  classifyAccountByCode,
  createAuthorization,
  createAuthorizationHash,
  createRevocationAuthorization,
  createSignedAuthorization,
  extractDelegateAddress,
  formatAuthorization,
  getDelegationStatus,
  isDelegatedAccount,
  isEIP7702InitCode,
  isRevocationAuthorization,
  isValidAddress,
  parseEIP7702InitCode,
  parseSignature,
} from '../../src/eip7702/authorization'
import { EIP7702_INIT_CODE_ADDRESS, ZERO_ADDRESS } from '../../src/eip7702/constants'

// ============================================================================
// parseSignature
// ============================================================================

describe('parseSignature', () => {
  // 65-byte signature (r=32 + s=32 + v=1)
  const validR = 'aa'.repeat(32) // 64 hex chars
  const validS = 'bb'.repeat(32) // 64 hex chars

  it('should parse a valid signature with v=27 (EIP-155)', () => {
    const sig = `0x${validR}${validS}1b` as Hex // 0x1b = 27
    const result = parseSignature(sig)

    expect(result.r).toBe(`0x${validR}`)
    expect(result.s).toBe(`0x${validS}`)
    expect(result.v).toBe(0) // 27 - 27 = 0
  })

  it('should parse a valid signature with v=28 (EIP-155)', () => {
    const sig = `0x${validR}${validS}1c` as Hex // 0x1c = 28
    const result = parseSignature(sig)

    expect(result.v).toBe(1) // 28 - 27 = 1
  })

  it('should parse a valid signature with v=0 (non-EIP-155)', () => {
    const sig = `0x${validR}${validS}00` as Hex
    const result = parseSignature(sig)

    expect(result.v).toBe(0) // stays 0
  })

  it('should parse a valid signature with v=1 (non-EIP-155)', () => {
    const sig = `0x${validR}${validS}01` as Hex
    const result = parseSignature(sig)

    expect(result.v).toBe(1) // stays 1
  })

  it('should throw for too-short signature', () => {
    const shortSig = `0x${'aa'.repeat(30)}` as Hex // only 60 hex chars
    expect(() => parseSignature(shortSig)).toThrow('Invalid signature length')
  })

  it('should throw for empty hex', () => {
    expect(() => parseSignature('0x' as Hex)).toThrow('Invalid signature length')
  })

  it('should throw for minimal invalid length (64 hex chars = 32 bytes)', () => {
    const sig = `0x${validR}` as Hex // only r component, 64 chars
    expect(() => parseSignature(sig)).toThrow('Invalid signature length')
  })

  it('should accept signature longer than 65 bytes (extra data ignored)', () => {
    const sig = `0x${validR}${validS}1bff` as Hex // 66 bytes
    const result = parseSignature(sig)

    expect(result.r).toBe(`0x${validR}`)
    expect(result.s).toBe(`0x${validS}`)
    expect(result.v).toBe(0) // 27 - 27
  })

  it('should include actual length in error message', () => {
    const sig = `0x${'ab'.repeat(10)}` as Hex // 20 hex chars
    expect(() => parseSignature(sig)).toThrow('got 20')
  })
})

// ============================================================================
// createAuthorization
// ============================================================================

describe('createAuthorization', () => {
  it('should create authorization with number inputs', () => {
    const auth = createAuthorization(1, '0x1234567890123456789012345678901234567890', 5)

    expect(auth.chainId).toBe(1n)
    expect(auth.address).toBe('0x1234567890123456789012345678901234567890')
    expect(auth.nonce).toBe(5n)
  })

  it('should create authorization with bigint inputs', () => {
    const auth = createAuthorization(137n, '0x1234567890123456789012345678901234567890', 100n)

    expect(auth.chainId).toBe(137n)
    expect(auth.nonce).toBe(100n)
  })
})

// ============================================================================
// createRevocationAuthorization
// ============================================================================

describe('createRevocationAuthorization', () => {
  it('should create revocation with zero address', () => {
    const auth = createRevocationAuthorization(1, 0)

    expect(auth.address).toBe(ZERO_ADDRESS)
    expect(auth.chainId).toBe(1n)
    expect(auth.nonce).toBe(0n)
  })
})

// ============================================================================
// isRevocationAuthorization
// ============================================================================

describe('isRevocationAuthorization', () => {
  it('should return true for zero address delegation', () => {
    const auth = createRevocationAuthorization(1, 0)
    expect(isRevocationAuthorization(auth)).toBe(true)
  })

  it('should return false for non-zero address delegation', () => {
    const auth = createAuthorization(1, '0x1234567890123456789012345678901234567890', 0)
    expect(isRevocationAuthorization(auth)).toBe(false)
  })
})

// ============================================================================
// createAuthorizationHash
// ============================================================================

describe('createAuthorizationHash', () => {
  it('should produce deterministic hash', () => {
    const auth = createAuthorization(1, '0x1234567890123456789012345678901234567890', 0)
    const hash1 = createAuthorizationHash(auth)
    const hash2 = createAuthorizationHash(auth)

    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('should produce different hashes for different chain IDs', () => {
    const auth1 = createAuthorization(1, '0x1234567890123456789012345678901234567890', 0)
    const auth2 = createAuthorization(2, '0x1234567890123456789012345678901234567890', 0)

    expect(createAuthorizationHash(auth1)).not.toBe(createAuthorizationHash(auth2))
  })

  it('should handle zero chainId and nonce', () => {
    const auth = createAuthorization(0, '0x1234567890123456789012345678901234567890', 0)
    const hash = createAuthorizationHash(auth)

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
  })
})

// ============================================================================
// createSignedAuthorization
// ============================================================================

describe('createSignedAuthorization', () => {
  it('should create signed authorization from auth + signature', () => {
    const auth = createAuthorization(1, '0x1234567890123456789012345678901234567890', 0)
    const r = 'aa'.repeat(32)
    const s = 'bb'.repeat(32)
    const sig = `0x${r}${s}1b` as Hex

    const signed = createSignedAuthorization(auth, sig)

    expect(signed.chainId).toBe(1n)
    expect(signed.address).toBe('0x1234567890123456789012345678901234567890')
    expect(signed.v).toBe(0)
    expect(signed.r).toBe(`0x${r}`)
    expect(signed.s).toBe(`0x${s}`)
  })
})

// ============================================================================
// isDelegatedAccount / extractDelegateAddress / getDelegationStatus
// ============================================================================

describe('isDelegatedAccount', () => {
  const delegatedCode = '0xef0100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex

  it('should return true for valid delegation code', () => {
    expect(isDelegatedAccount(delegatedCode)).toBe(true)
  })

  it('should return false for null/undefined/empty', () => {
    expect(isDelegatedAccount(null)).toBe(false)
    expect(isDelegatedAccount(undefined)).toBe(false)
    expect(isDelegatedAccount('0x' as Hex)).toBe(false)
  })

  it('should return false for regular contract code', () => {
    expect(isDelegatedAccount('0x608060405234801561001057600080fd5b50' as Hex)).toBe(false)
  })

  it('should return false for too-short code', () => {
    expect(isDelegatedAccount('0xef0100aabb' as Hex)).toBe(false)
  })
})

describe('extractDelegateAddress', () => {
  it('should extract address from delegation code', () => {
    const addr = '1234567890abcdef1234567890abcdef12345678'
    const code = `0xef0100${addr}` as Hex
    expect(extractDelegateAddress(code)).toBe(`0x${addr}`)
  })

  it('should return null for non-delegated', () => {
    expect(extractDelegateAddress('0x' as Hex)).toBeNull()
  })
})

describe('getDelegationStatus', () => {
  it('should return delegation status for delegated account', () => {
    const addr = '1234567890abcdef1234567890abcdef12345678'
    const code = `0xef0100${addr}` as Hex
    const status = getDelegationStatus(code)

    expect(status.isDelegated).toBe(true)
    expect(status.delegateAddress).toBe(`0x${addr}`)
    expect(status.code).toBe(code)
  })

  it('should return non-delegated status for null', () => {
    const status = getDelegationStatus(null)
    expect(status.isDelegated).toBe(false)
    expect(status.delegateAddress).toBeNull()
  })
})

// ============================================================================
// isValidAddress
// ============================================================================

describe('isValidAddress', () => {
  it('should validate correct addresses', () => {
    expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
  })

  it('should reject invalid addresses', () => {
    expect(isValidAddress('0x123')).toBe(false)
    expect(isValidAddress('not-an-address')).toBe(false)
    expect(isValidAddress('')).toBe(false)
  })
})

// ============================================================================
// classifyAccountByCode (extends existing test coverage)
// ============================================================================

describe('classifyAccountByCode', () => {
  it('should classify EOA (no code)', () => {
    expect(classifyAccountByCode(null)).toBe('eoa')
    expect(classifyAccountByCode(undefined)).toBe('eoa')
    expect(classifyAccountByCode('0x' as Hex)).toBe('eoa')
  })

  it('should classify delegated account', () => {
    const code = '0xef0100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex
    expect(classifyAccountByCode(code)).toBe('delegated')
  })

  it('should classify smart contract', () => {
    const code = '0x608060405234801561001057600080fd5b50' as Hex
    expect(classifyAccountByCode(code)).toBe('smart')
  })
})

// ============================================================================
// formatAuthorization
// ============================================================================

describe('formatAuthorization', () => {
  it('should format authorization for display', () => {
    const auth = createAuthorization(1, '0x1234567890123456789012345678901234567890', 5)
    const formatted = formatAuthorization(auth)

    expect(formatted).toContain('chainId: 1')
    expect(formatted).toContain('nonce: 5')
    expect(formatted).toContain('0x1234567890123456789012345678901234567890')
  })
})

// ============================================================================
// isEIP7702InitCode / parseEIP7702InitCode
// ============================================================================

describe('isEIP7702InitCode', () => {
  it('should detect EIP-7702 initCode', () => {
    const initCode = `${EIP7702_INIT_CODE_ADDRESS}deadbeef` as Hex
    expect(isEIP7702InitCode(initCode)).toBe(true)
  })

  it('should return false for empty/short initCode', () => {
    expect(isEIP7702InitCode('0x' as Hex)).toBe(false)
    expect(isEIP7702InitCode('' as Hex)).toBe(false)
  })

  it('should return false for non-7702 initCode', () => {
    expect(isEIP7702InitCode('0x1234567890123456789012345678901234567890' as Hex)).toBe(false)
  })
})

describe('parseEIP7702InitCode', () => {
  it('should parse initCode with init data', () => {
    const initCode = `${EIP7702_INIT_CODE_ADDRESS}deadbeef` as Hex
    const result = parseEIP7702InitCode(initCode)

    expect(result).not.toBeNull()
    expect(result!.isEIP7702).toBe(true)
    expect(result!.initData).toBe('0xdeadbeef')
  })

  it('should parse initCode without init data', () => {
    const initCode = EIP7702_INIT_CODE_ADDRESS as Hex
    const result = parseEIP7702InitCode(initCode)

    expect(result).not.toBeNull()
    expect(result!.initData).toBe('0x')
  })

  it('should return null for non-7702 initCode', () => {
    expect(parseEIP7702InitCode('0x1234567890123456789012345678901234567890' as Hex)).toBeNull()
  })
})
