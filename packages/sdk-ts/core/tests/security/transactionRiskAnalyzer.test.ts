/**
 * Transaction Risk Analyzer Tests
 */

import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  createTransactionRiskAnalyzer,
  TransactionRiskAnalyzer,
  TransactionRiskLevel,
  TransactionRiskType,
} from '../../src/security/transactionRiskAnalyzer'

const FROM: Address = '0x1234567890abcdef1234567890abcdef12345678'
const TO: Address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const ZERO_ADDR: Address = '0x0000000000000000000000000000000000000000'

// Helper to build calldata with selector + padded args
function buildCalldata(selector: string, ...args: string[]): string {
  return selector + args.map((a) => a.padStart(64, '0')).join('')
}

describe('TransactionRiskAnalyzer', () => {
  const analyzer = new TransactionRiskAnalyzer()

  describe('factory function', () => {
    it('should create a TransactionRiskAnalyzer instance', () => {
      const a = createTransactionRiskAnalyzer()
      expect(a).toBeInstanceOf(TransactionRiskAnalyzer)
    })
  })

  describe('basic value transfers', () => {
    it('should rate simple low-value transfer as safe', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: 100000n, // tiny amount
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.SAFE)
      expect(result.riskScore).toBe(0)
    })

    it('should detect medium-value transactions (>= 1 ETH)', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: BigInt(10) ** BigInt(18), // 1 ETH
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.MEDIUM)
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_VALUE)
    })

    it('should detect high-value transactions (>= 10 ETH)', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: BigInt(10) * BigInt(10) ** BigInt(18), // 10 ETH
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_VALUE)
    })

    it('should detect critical-value transactions (>= 100 ETH)', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: BigInt(100) * BigInt(10) ** BigInt(18), // 100 ETH
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_VALUE)
    })
  })

  describe('zero address detection', () => {
    it('should detect sending to zero address as critical', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: ZERO_ADDR,
        value: 1000n,
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
      expect(result.riskTypes).toContain(TransactionRiskType.ZERO_ADDRESS)
      expect(result.warnings.some((w) => w.includes('zero address'))).toBe(true)
    })

    it('should detect null to (contract deployment) as medium', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: null,
        value: 0n,
        data: '0x60806040',
      })
      expect(result.riskTypes).toContain(TransactionRiskType.ZERO_ADDRESS)
      expect(result.warnings.some((w) => w.includes('Contract deployment'))).toBe(true)
    })
  })

  describe('self-transfer detection', () => {
    it('should detect self-transfer', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: FROM,
        value: 1000n,
      })
      expect(result.riskTypes).toContain(TransactionRiskType.SELF_TRANSFER)
    })

    it('should detect case-insensitive self-transfer', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: FROM.toUpperCase() as Address,
        value: 1000n,
      })
      expect(result.riskTypes).toContain(TransactionRiskType.SELF_TRANSFER)
    })
  })

  describe('gas price analysis', () => {
    it('should detect high gas price (>= 100 gwei)', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: 0n,
        data: '0x',
        gasPrice: BigInt(100) * BigInt(10) ** BigInt(9), // 100 gwei
      })
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_GAS_PRICE)
    })

    it('should detect very high gas price (>= 500 gwei)', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: 0n,
        data: '0x',
        maxFeePerGas: BigInt(500) * BigInt(10) ** BigInt(9), // 500 gwei
      })
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_GAS_PRICE)
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
    })
  })

  describe('ERC-20 operations', () => {
    it('should detect token approve', () => {
      // approve(address,uint256) = 0x095ea7b3
      const data = buildCalldata(
        '0x095ea7b3',
        TO.slice(2),
        '1000' // small approval amount
      )
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_APPROVAL)
      expect(result.riskTypes).toContain(TransactionRiskType.CONTRACT_INTERACTION)
    })

    it('should detect unlimited token approval', () => {
      // approve(address, MAX_UINT256)
      const data = buildCalldata(
        '0x095ea7b3',
        TO.slice(2),
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.UNLIMITED_APPROVAL)
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.warnings.some((w) => w.includes('UNLIMITED'))).toBe(true)
    })

    it('should detect ERC-20 transfer', () => {
      // transfer(address,uint256) = 0xa9059cbb
      const data = buildCalldata('0xa9059cbb', TO.slice(2), '100')
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_TRANSFER)
    })

    it('should detect ERC-20 transferFrom', () => {
      // transferFrom(address,address,uint256) = 0x23b872dd
      const data = buildCalldata('0x23b872dd', FROM.slice(2), TO.slice(2), '100')
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_TRANSFER)
    })
  })

  describe('NFT operations', () => {
    it('should detect setApprovalForAll', () => {
      // setApprovalForAll(address,bool) = 0xa22cb465
      const addressPadded = TO.slice(2).padStart(64, '0')
      const boolTrue = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = '0xa22cb465' + addressPadded + boolTrue
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.NFT_APPROVAL_ALL)
      // Standard encoded calldata detected as HIGH
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
    })

    it('should detect setApprovalForAll with short calldata as critical', () => {
      // When calldata is too short to parse the bool param, isApprovalEnabled assumes true → CRITICAL
      const data = '0xa22cb465' + TO.slice(2).padStart(64, '0')
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.NFT_APPROVAL_ALL)
      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
    })

    it('should detect NFT safeTransferFrom', () => {
      // safeTransferFrom(address,address,uint256) = 0x42842e0e
      const data = buildCalldata('0x42842e0e', FROM.slice(2), TO.slice(2), '1')
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_TRANSFER)
    })
  })

  describe('dangerous selectors', () => {
    it('should detect multicall', () => {
      // multicall(bytes[]) = 0xac9650d8
      const data = '0xac9650d8' + '0'.repeat(64)
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.warnings.some((w) => w.includes('Multicall'))).toBe(true)
    })

    it('should detect execute function', () => {
      // execute(address,uint256,bytes) = 0xb61d27f6
      const data = '0xb61d27f6' + '0'.repeat(192)
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.warnings.some((w) => w.includes('Execute'))).toBe(true)
    })
  })

  describe('suspicious data', () => {
    it('should flag zero value with no data as suspicious', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: 0n,
      })
      expect(result.riskTypes).toContain(TransactionRiskType.SUSPICIOUS_DATA)
      expect(result.riskLevel).toBe(TransactionRiskLevel.LOW)
    })
  })

  describe('summary generation', () => {
    it('should generate summary with risk level', () => {
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: BigInt(10) ** BigInt(18),
      })
      expect(result.summary).toContain('Medium risk')
    })

    it('should include risk type descriptions', () => {
      const data = buildCalldata(
        '0x095ea7b3',
        TO.slice(2),
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.summary).toContain('token approval')
    })
  })

  describe('decoded method', () => {
    it('should decode known method selectors', () => {
      const data = buildCalldata('0xa9059cbb', TO.slice(2), '100')
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.decodedMethod).toBeDefined()
      expect(result.decodedMethod?.name).toBe('transfer')
      expect(result.decodedMethod?.selector).toBe('0xa9059cbb')
    })

    it('should return unknown for unrecognized selectors', () => {
      const data = '0xdeadbeef' + '0'.repeat(64)
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 0n, data })
      expect(result.decodedMethod?.name).toBe('unknown')
    })

    it('should not decode when no data', () => {
      const result = analyzer.analyzeTransaction({ from: FROM, to: TO, value: 1000n })
      expect(result.decodedMethod).toBeUndefined()
    })
  })

  describe('combined risks', () => {
    it('should take highest risk level when multiple risks exist', () => {
      // High value + unlimited approval = should be CRITICAL (from high value 100 ETH)
      const data = buildCalldata(
        '0x095ea7b3',
        TO.slice(2),
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
      const result = analyzer.analyzeTransaction({
        from: FROM,
        to: TO,
        value: BigInt(100) * BigInt(10) ** BigInt(18), // 100 ETH
        data,
      })
      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
    })
  })
})
