/**
 * Transaction Risk Analyzer Tests (SEC-14)
 */

// Unmock to test real implementation
jest.unmock('@stablenet/core')

import {
  createTransactionRiskAnalyzer,
  TransactionRiskAnalyzer,
  TransactionRiskLevel,
  TransactionRiskType,
} from '@stablenet/core'

const transactionRiskAnalyzer = createTransactionRiskAnalyzer()

describe('TransactionRiskAnalyzer', () => {
  let analyzer: TransactionRiskAnalyzer

  beforeEach(() => {
    analyzer = new TransactionRiskAnalyzer()
  })

  describe('basic transactions', () => {
    it('should analyze simple ETH transfer as low risk', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(10) ** BigInt(17), // 0.1 ETH
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.SAFE)
      expect(result.warnings.length).toBe(0)
    })

    it('should detect high value transactions (>10 ETH)', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(15) * BigInt(10) ** BigInt(18), // 15 ETH
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_VALUE)
      expect(result.warnings.some((w) => w.includes('High value'))).toBe(true)
    })

    it('should detect very high value transactions (>100 ETH)', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(150) * BigInt(10) ** BigInt(18), // 150 ETH
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_VALUE)
    })
  })

  describe('zero address detection', () => {
    it('should detect sending to zero address as critical', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0000000000000000000000000000000000000000',
        value: BigInt(10) ** BigInt(18),
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
      expect(result.riskTypes).toContain(TransactionRiskType.ZERO_ADDRESS)
      expect(result.warnings.some((w) => w.includes('zero address'))).toBe(true)
    })

    it('should detect contract deployment (null to)', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: null,
        value: 0n,
        data: '0x608060405234801561001057600080fd5b50',
      })

      expect(result.riskTypes).toContain(TransactionRiskType.ZERO_ADDRESS)
      expect(result.warnings.some((w) => w.includes('Contract deployment'))).toBe(true)
    })
  })

  describe('self-transfer detection', () => {
    it('should detect self-transfer', () => {
      const address = '0x1234567890123456789012345678901234567890'
      const result = analyzer.analyzeTransaction({
        from: address,
        to: address,
        value: BigInt(10) ** BigInt(18),
      })

      expect(result.riskTypes).toContain(TransactionRiskType.SELF_TRANSFER)
      expect(result.warnings.some((w) => w.includes('own address'))).toBe(true)
    })
  })

  describe('ERC-20 interactions', () => {
    it('should detect ERC-20 approve', () => {
      // approve(address,uint256) with normal amount
      const data =
        '0x095ea7b3' +
        '000000000000000000000000spenderaddress00000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000064' // 100 tokens

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xTokenContractAddress0000000000000000000',
        value: 0n,
        data,
      })

      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_APPROVAL)
      expect(result.riskTypes).toContain(TransactionRiskType.CONTRACT_INTERACTION)
      expect(result.warnings.some((w) => w.includes('Token approval'))).toBe(true)
    })

    it('should detect unlimited ERC-20 approval', () => {
      // approve(address,uint256) with max uint256
      // selector (4 bytes) + address (32 bytes padded) + amount (32 bytes)
      const data =
        '0x095ea7b3' + // selector
        '0000000000000000000000001234567890123456789012345678901234567890' + // spender (padded address)
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' // max uint256

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xTokenContractAddress0000000000000000000',
        value: 0n,
        data,
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.HIGH)
      expect(result.riskTypes).toContain(TransactionRiskType.UNLIMITED_APPROVAL)
      expect(result.warnings.some((w) => w.includes('UNLIMITED'))).toBe(true)
    })

    it('should detect ERC-20 transfer', () => {
      // transfer(address,uint256)
      const data =
        '0xa9059cbb' +
        '000000000000000000000000recipientaddress000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000064'

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xTokenContractAddress0000000000000000000',
        value: 0n,
        data,
      })

      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_TRANSFER)
      expect(result.warnings.some((w) => w.includes('Token transfer'))).toBe(true)
    })
  })

  describe('NFT interactions', () => {
    it('should detect setApprovalForAll', () => {
      // setApprovalForAll(address,bool) with true
      const data =
        '0xa22cb465' +
        '000000000000000000000000operatoraddress00000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000001'

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xNFTContractAddress00000000000000000000',
        value: 0n,
        data,
      })

      expect(result.riskLevel).toBe(TransactionRiskLevel.CRITICAL)
      expect(result.riskTypes).toContain(TransactionRiskType.NFT_APPROVAL_ALL)
      expect(result.warnings.some((w) => w.includes('NFT approval'))).toBe(true)
    })

    it('should detect NFT safeTransferFrom', () => {
      // safeTransferFrom(address,address,uint256)
      const data =
        '0x42842e0e' +
        '000000000000000000000000fromaddress00000000000000000000000' +
        '000000000000000000000000toaddress000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000001'

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xNFTContractAddress00000000000000000000',
        value: 0n,
        data,
      })

      expect(result.riskTypes).toContain(TransactionRiskType.TOKEN_TRANSFER)
      expect(result.warnings.some((w) => w.includes('NFT transfer'))).toBe(true)
    })
  })

  describe('gas price analysis', () => {
    it('should detect high gas price', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(10) ** BigInt(17),
        gasPrice: BigInt(150) * BigInt(10) ** BigInt(9), // 150 gwei
      })

      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_GAS_PRICE)
      expect(result.warnings.some((w) => w.includes('High gas price'))).toBe(true)
    })

    it('should detect very high gas price', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(10) ** BigInt(17),
        maxFeePerGas: BigInt(600) * BigInt(10) ** BigInt(9), // 600 gwei
      })

      expect(result.riskTypes).toContain(TransactionRiskType.HIGH_GAS_PRICE)
      expect(result.warnings.some((w) => w.includes('Extremely high gas'))).toBe(true)
    })
  })

  describe('dangerous selectors', () => {
    it('should detect multicall', () => {
      // multicall(bytes[])
      const data = '0xac9650d8' + '0'.repeat(128)

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xContractAddress000000000000000000000000',
        value: 0n,
        data,
      })

      expect(result.warnings.some((w) => w.includes('Multicall'))).toBe(true)
    })

    it('should detect execute function', () => {
      // execute(address,uint256,bytes)
      const data = '0xb61d27f6' + '0'.repeat(192)

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xContractAddress000000000000000000000000',
        value: 0n,
        data,
      })

      expect(result.warnings.some((w) => w.includes('Execute function'))).toBe(true)
    })
  })

  describe('method decoding', () => {
    it('should decode known method selectors', () => {
      const data = '0xa9059cbb' + '0'.repeat(128)

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xContractAddress000000000000000000000000',
        value: 0n,
        data,
      })

      expect(result.decodedMethod).toBeDefined()
      expect(result.decodedMethod?.name).toBe('transfer')
      expect(result.decodedMethod?.selector).toBe('0xa9059cbb')
    })

    it('should handle unknown method selectors', () => {
      const data = '0xdeadbeef' + '0'.repeat(64)

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xContractAddress000000000000000000000000',
        value: 0n,
        data,
      })

      expect(result.decodedMethod).toBeDefined()
      expect(result.decodedMethod?.name).toBe('unknown')
    })
  })

  describe('summary generation', () => {
    it('should generate appropriate summary for simple transfer', () => {
      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt(10) ** BigInt(17),
      })

      expect(result.summary).toContain('Safe')
    })

    it('should generate appropriate summary for high risk', () => {
      const data =
        '0xa22cb465' +
        '000000000000000000000000operatoraddress00000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000001'

      const result = analyzer.analyzeTransaction({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xNFTContract0000000000000000000000000000',
        value: 0n,
        data,
      })

      expect(result.summary).toContain('CRITICAL')
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(transactionRiskAnalyzer).toBeInstanceOf(TransactionRiskAnalyzer)
    })
  })
})
