/**
 * CallDataDecoder Tests
 * Tests for ERC-20/721/1155 calldata decoding
 */

import { decodeCallData } from '../../../src/background/security/callDataDecoder'

describe('callDataDecoder', () => {
  describe('decodeCallData - null/empty cases', () => {
    it('should return null for empty string', () => {
      expect(decodeCallData('')).toBeNull()
    })

    it('should return null for "0x"', () => {
      expect(decodeCallData('0x')).toBeNull()
    })

    it('should return null for data shorter than 10 chars (4-byte selector)', () => {
      expect(decodeCallData('0xa905')).toBeNull()
    })

    it('should return null for null/undefined input', () => {
      expect(decodeCallData(null as unknown as string)).toBeNull()
      expect(decodeCallData(undefined as unknown as string)).toBeNull()
    })
  })

  describe('decodeCallData - unknown selector', () => {
    it('should return unknown for unrecognized selector', () => {
      const data = '0xdeadbeef' + '00'.repeat(64)
      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('unknown')
      expect(result!.selector).toBe('0xdeadbeef')
      expect(result!.args).toEqual([])
      expect(result!.description).toContain('Unknown function call')
    })

    it('should return unknown for selector-only data (no params)', () => {
      const result = decodeCallData('0xdeadbeef')

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('unknown')
    })
  })

  describe('decodeCallData - ERC-20 transfer (0xa9059cbb)', () => {
    it('should decode transfer with address and amount', () => {
      const to = '0000000000000000000000001234567890abcdef1234567890abcdef12345678'
      const amount = '00000000000000000000000000000000000000000000000000000000000f4240' // 1,000,000
      const data = '0xa9059cbb' + to + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('transfer')
      expect(result!.selector).toBe('0xa9059cbb')
      expect(result!.args).toHaveLength(2)
      expect(result!.args[0]!.name).toBe('to')
      expect(result!.args[0]!.type).toBe('address')
      expect(result!.args[0]!.value).toContain('abcdef12345678')
      expect(result!.args[1]!.name).toBe('amount')
      expect(result!.args[1]!.value).toBe('1000000')
      expect(result!.description).toContain('Transfer')
      expect(result!.description).toContain('1000000')
    })
  })

  describe('decodeCallData - ERC-20 approve (0x095ea7b3)', () => {
    it('should decode approve with spender and amount', () => {
      const spender = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const amount = '0000000000000000000000000000000000000000000000000000000000000064' // 100
      const data = '0x095ea7b3' + spender + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('approve')
      expect(result!.args).toHaveLength(2)
      expect(result!.args[0]!.name).toBe('spender')
      expect(result!.args[1]!.name).toBe('amount')
      expect(result!.args[1]!.value).toBe('100')
      expect(result!.description).toContain('Approve')
      expect(result!.description).toContain('100')
    })

    it('should decode UNLIMITED approval (max uint256)', () => {
      const spender = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const maxUint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const data = '0x095ea7b3' + spender + maxUint

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.args[1]!.value).toBe('UNLIMITED')
      expect(result!.description).toContain('UNLIMITED')
    })
  })

  describe('decodeCallData - ERC-20 transferFrom (0x23b872dd)', () => {
    it('should decode transferFrom with from, to, and amount', () => {
      const from = '0000000000000000000000001111111111111111111111111111111111111111'
      const to = '0000000000000000000000002222222222222222222222222222222222222222'
      const amount = '00000000000000000000000000000000000000000000000000000000000003e8' // 1000
      const data = '0x23b872dd' + from + to + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('transferFrom')
      expect(result!.args).toHaveLength(3)
      expect(result!.args[0]!.name).toBe('from')
      expect(result!.args[1]!.name).toBe('to')
      expect(result!.args[2]!.name).toBe('amount')
      expect(result!.args[2]!.value).toBe('1000')
      expect(result!.description).toContain('Transfer')
      expect(result!.description).toContain('from')
    })
  })

  describe('decodeCallData - increaseAllowance (0x39509351)', () => {
    it('should decode increaseAllowance', () => {
      const spender = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const amount = '0000000000000000000000000000000000000000000000000000000000000032' // 50
      const data = '0x39509351' + spender + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('increaseAllowance')
      expect(result!.description).toContain('Increase allowance')
      expect(result!.description).toContain('50')
    })
  })

  describe('decodeCallData - decreaseAllowance (0xa457c2d7)', () => {
    it('should decode decreaseAllowance', () => {
      const spender = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const amount = '0000000000000000000000000000000000000000000000000000000000000019' // 25
      const data = '0xa457c2d7' + spender + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('decreaseAllowance')
      expect(result!.description).toContain('Decrease allowance')
      expect(result!.description).toContain('25')
    })
  })

  describe('decodeCallData - ERC-721 setApprovalForAll (0xa22cb465)', () => {
    it('should decode setApprovalForAll with approved=true', () => {
      const operator = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const approved = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = '0xa22cb465' + operator + approved

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('setApprovalForAll')
      expect(result!.args).toHaveLength(2)
      expect(result!.args[0]!.name).toBe('operator')
      expect(result!.args[1]!.name).toBe('approved')
      expect(result!.args[1]!.value).toBe('true')
      expect(result!.description).toContain('Grant full collection access')
    })

    it('should decode setApprovalForAll with approved=false (revoke)', () => {
      const operator = '000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const approved = '0000000000000000000000000000000000000000000000000000000000000000'
      const data = '0xa22cb465' + operator + approved

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.args[1]!.value).toBe('false')
      expect(result!.description).toContain('Revoke collection access')
    })
  })

  describe('decodeCallData - ERC-721 safeTransferFrom (0x42842e0e)', () => {
    it('should decode 3-param safeTransferFrom', () => {
      const from = '0000000000000000000000001111111111111111111111111111111111111111'
      const to = '0000000000000000000000002222222222222222222222222222222222222222'
      const tokenId = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = '0x42842e0e' + from + to + tokenId

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('safeTransferFrom')
      expect(result!.args).toHaveLength(3)
      expect(result!.args[2]!.name).toBe('tokenId')
      expect(result!.description).toContain('Transfer NFT')
    })
  })

  describe('decodeCallData - ERC-1155 safeTransferFrom (0xf242432a)', () => {
    it('should decode 5-param safeTransferFrom', () => {
      const from = '0000000000000000000000001111111111111111111111111111111111111111'
      const to = '0000000000000000000000002222222222222222222222222222222222222222'
      const id = '0000000000000000000000000000000000000000000000000000000000000005'
      const amount = '000000000000000000000000000000000000000000000000000000000000000a'
      const bytesData = '0000000000000000000000000000000000000000000000000000000000000000'
      const data = '0xf242432a' + from + to + id + amount + bytesData

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('safeTransferFrom')
      expect(result!.args).toHaveLength(5)
      expect(result!.args[2]!.name).toBe('id')
      expect(result!.args[3]!.name).toBe('amount')
      expect(result!.args[4]!.name).toBe('data')
    })
  })

  describe('decodeCallData - edge cases', () => {
    it('should handle data with insufficient bytes for params', () => {
      // transfer selector but only partial params
      const data = '0xa9059cbb' + '00'.repeat(20)
      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('transfer')
      // Should handle gracefully - may have partial or empty decoded values
    })

    it('should handle uppercase selector', () => {
      const to = '0000000000000000000000001234567890abcdef1234567890abcdef12345678'
      const amount = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = '0xA9059CBB' + to + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      expect(result!.functionName).toBe('transfer')
    })

    it('should shorten addresses in descriptions', () => {
      const to = '0000000000000000000000001234567890abcdef1234567890abcdef12345678'
      const amount = '0000000000000000000000000000000000000000000000000000000000000001'
      const data = '0xa9059cbb' + to + amount

      const result = decodeCallData(data)

      expect(result).not.toBeNull()
      // Description should contain shortened address format (0x1234...5678)
      expect(result!.description).toMatch(/0x[a-f0-9]{4}\.\.\./)
    })
  })
})
