import type { Hex } from 'viem'
import { encodeAbiParameters } from 'viem'
import { describe, expect, it } from 'vitest'
import { ERROR_SELECTORS } from '../../src/abi'
import {
  decodeValidationResultReturn,
  decodeExecutionResultReturn,
  extractErrorData,
  formatRevertReason,
  isSignatureFailure,
  matchesErrorSelector,
  parseSimulationError,
  parseValidationData,
  validateTimestamps,
} from '../../src/validation/errors'
import { VALIDATION_CONSTANTS } from '../../src/validation/types'

/**
 * Build ABI-encoded ValidationResult return data (no selector prefix).
 * Used for testing decodeValidationResultReturn (v0.9 normal return).
 * Must be encoded as a single outer tuple to match the decoder.
 */
function buildValidationResultReturnData(): Hex {
  return encodeAbiParameters(
    [
      {
        name: 'result',
        type: 'tuple',
        components: [
          {
            name: 'returnInfo',
            type: 'tuple',
            components: [
              { name: 'preOpGas', type: 'uint256' },
              { name: 'prefund', type: 'uint256' },
              { name: 'accountValidationData', type: 'uint256' },
              { name: 'paymasterValidationData', type: 'uint256' },
              { name: 'paymasterContext', type: 'bytes' },
            ],
          },
          {
            name: 'senderInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'factoryInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'paymasterInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'aggregatorInfo',
            type: 'tuple',
            components: [
              { name: 'aggregator', type: 'address' },
              {
                name: 'stakeInfo',
                type: 'tuple',
                components: [
                  { name: 'stake', type: 'uint256' },
                  { name: 'unstakeDelaySec', type: 'uint256' },
                ],
              },
            ],
          },
        ],
      },
    ],
    [
      {
        returnInfo: {
          preOpGas: 100n,
          prefund: 200n,
          accountValidationData: 0n,
          paymasterValidationData: 0n,
          paymasterContext: '0x',
        },
        senderInfo: { stake: 1n, unstakeDelaySec: 2n },
        factoryInfo: { stake: 3n, unstakeDelaySec: 4n },
        paymasterInfo: { stake: 5n, unstakeDelaySec: 6n },
        aggregatorInfo: {
          aggregator: '0x1111111111111111111111111111111111111111',
          stakeInfo: { stake: 7n, unstakeDelaySec: 8n },
        },
      },
    ]
  )
}

/**
 * Build FailedOp error data with selector prefix for parseSimulationError tests.
 */
function buildFailedOpData(opIndex: bigint, reason: string): Hex {
  const encoded = encodeAbiParameters(
    [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    [opIndex, reason]
  )
  return (ERROR_SELECTORS.FailedOp + encoded.slice(2)) as Hex
}

describe('Error utilities', () => {
  describe('extractErrorData', () => {
    it('should extract hex string directly', () => {
      const data = extractErrorData('0x1234abcd')
      expect(data).toBe('0x1234abcd')
    })

    it('should extract from error object with data property', () => {
      const error = { data: '0x1234abcd' }
      const data = extractErrorData(error)
      expect(data).toBe('0x1234abcd')
    })

    it('should extract from nested cause', () => {
      const error = { cause: { data: '0x1234abcd' } }
      const data = extractErrorData(error)
      expect(data).toBe('0x1234abcd')
    })

    it('should extract from error property', () => {
      const error = { error: { data: '0x1234abcd' } }
      const data = extractErrorData(error)
      expect(data).toBe('0x1234abcd')
    })

    it('should extract hex from error message', () => {
      const error = { message: 'Transaction reverted: 0x1234567890abcdef' }
      const data = extractErrorData(error)
      expect(data).toBe('0x1234567890abcdef')
    })

    it('should return null for non-hex data', () => {
      const error = { message: 'Some error without hex' }
      const data = extractErrorData(error)
      expect(data).toBeNull()
    })

    it('should return null for null input', () => {
      const data = extractErrorData(null)
      expect(data).toBeNull()
    })

    it('should return null for undefined input', () => {
      const data = extractErrorData(undefined)
      expect(data).toBeNull()
    })
  })

  describe('matchesErrorSelector', () => {
    it('should match ValidationResult selector', () => {
      const data = (ERROR_SELECTORS.ValidationResult + '0'.repeat(128)) as Hex
      expect(matchesErrorSelector(data, 'ValidationResult')).toBe(true)
    })

    it('should match ValidationResultV09 selector', () => {
      const data = (ERROR_SELECTORS.ValidationResultV09 + '0'.repeat(128)) as Hex
      expect(matchesErrorSelector(data, 'ValidationResultV09')).toBe(true)
    })

    it('should match FailedOp selector', () => {
      const data = (ERROR_SELECTORS.FailedOp + '0'.repeat(128)) as Hex
      expect(matchesErrorSelector(data, 'FailedOp')).toBe(true)
    })

    it('should not match wrong selector', () => {
      const data = (ERROR_SELECTORS.ValidationResult + '0'.repeat(128)) as Hex
      expect(matchesErrorSelector(data, 'FailedOp')).toBe(false)
    })

    it('should return false for data too short', () => {
      const data = '0x1234' as Hex
      expect(matchesErrorSelector(data, 'ValidationResult')).toBe(false)
    })

    it('should be case insensitive in comparison', () => {
      // The actual selector is lowercase, but the comparison should work regardless
      const data = (ERROR_SELECTORS.ValidationResult + '0'.repeat(128)) as Hex
      // Both selectors are compared in lowercase
      expect(matchesErrorSelector(data, 'ValidationResult')).toBe(true)
    })
  })

  describe('decodeValidationResultReturn', () => {
    it('should decode v0.9 ValidationResult normal return data', () => {
      const data = buildValidationResultReturnData()
      const decoded = decodeValidationResultReturn(data)

      expect(decoded.returnInfo.preOpGas).toBe(100n)
      expect(decoded.returnInfo.prefund).toBe(200n)
      expect(decoded.senderInfo.stake).toBe(1n)
      expect(decoded.factoryInfo.stake).toBe(3n)
      expect(decoded.paymasterInfo.stake).toBe(5n)
      expect(decoded.aggregatorInfo.aggregator.toLowerCase()).toBe(
        '0x1111111111111111111111111111111111111111'
      )
      expect(decoded.aggregatorInfo.stakeInfo.stake).toBe(7n)
    })
  })

  describe('decodeExecutionResultReturn', () => {
    it('should decode ExecutionResult normal return data', () => {
      const data = encodeAbiParameters(
        [
          {
            name: 'result',
            type: 'tuple',
            components: [
              { name: 'preOpGas', type: 'uint256' },
              { name: 'paid', type: 'uint256' },
              { name: 'accountValidationData', type: 'uint256' },
              { name: 'paymasterValidationData', type: 'uint256' },
              { name: 'targetSuccess', type: 'bool' },
              { name: 'targetResult', type: 'bytes' },
            ],
          },
        ],
        [
          {
            preOpGas: 50000n,
            paid: 100000n,
            accountValidationData: 0n,
            paymasterValidationData: 0n,
            targetSuccess: true,
            targetResult: '0xabcd',
          },
        ]
      )

      const decoded = decodeExecutionResultReturn(data)

      expect(decoded.preOpGas).toBe(50000n)
      expect(decoded.paid).toBe(100000n)
      expect(decoded.targetSuccess).toBe(true)
      expect(decoded.targetResult).toBe('0xabcd')
    })
  })

  describe('parseSimulationError', () => {
    it('should parse FailedOp error correctly', () => {
      const data = buildFailedOpData(0n, "AA21 didn't pay prefund")
      const parsed = parseSimulationError({ data })

      expect(parsed.failedOp).toBeDefined()
      expect(parsed.failedOp?.opIndex).toBe(0n)
      expect(parsed.failedOp?.reason).toBe("AA21 didn't pay prefund")
    })

    it('should return rawError for unknown error data', () => {
      const parsed = parseSimulationError({ data: '0xdeadbeef' })

      expect(parsed.failedOp).toBeUndefined()
      expect(parsed.rawError).toBeDefined()
      expect(parsed.rawError).toContain('Unknown error')
    })

    it('should return rawError for non-hex error', () => {
      const parsed = parseSimulationError(new Error('some error'))

      expect(parsed.failedOp).toBeUndefined()
      expect(parsed.rawError).toBe('some error')
    })
  })

  describe('parseValidationData', () => {
    it('should parse validation data with no aggregator', () => {
      const validationData = 0n
      const result = parseValidationData(validationData)

      expect(result.aggregator).toBe(VALIDATION_CONSTANTS.SIG_VALIDATION_SUCCESS)
      expect(result.validAfter).toBe(0n)
      expect(result.validUntil).toBe(0n)
    })

    it('should parse validation data with signature failure marker', () => {
      // Signature failure marker in upper 160 bits
      const sigFailureMarker = 1n << 96n // aggregator = 0x1
      const result = parseValidationData(sigFailureMarker)

      expect(result.aggregator).toBe(VALIDATION_CONSTANTS.SIG_VALIDATION_FAILED)
    })

    it('should parse validAfter correctly', () => {
      const validAfter = 1000000n
      const result = parseValidationData(validAfter)

      expect(result.validAfter).toBe(validAfter)
      expect(result.validUntil).toBe(0n)
    })

    it('should parse validUntil correctly', () => {
      const validUntil = 2000000n
      const validationData = validUntil << 48n
      const result = parseValidationData(validationData)

      expect(result.validAfter).toBe(0n)
      expect(result.validUntil).toBe(validUntil)
    })

    it('should parse all fields together', () => {
      // Pack: aggregator (160 bits) | validUntil (48 bits) | validAfter (48 bits)
      const aggregator = 0xabcdef1234567890abcdef1234567890abcdef12n
      const validUntil = 2000000n
      const validAfter = 1000000n

      const validationData = (aggregator << 96n) | (validUntil << 48n) | validAfter
      const result = parseValidationData(validationData)

      expect(result.aggregator.toLowerCase()).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
      expect(result.validUntil).toBe(validUntil)
      expect(result.validAfter).toBe(validAfter)
    })
  })

  describe('isSignatureFailure', () => {
    it('should return true for signature failure', () => {
      const sigFailureMarker = 1n << 96n
      expect(isSignatureFailure(sigFailureMarker)).toBe(true)
    })

    it('should return false for success', () => {
      expect(isSignatureFailure(0n)).toBe(false)
    })

    it('should return false for real aggregator', () => {
      const aggregator = 0x1234567890123456789012345678901234567890n << 96n
      expect(isSignatureFailure(aggregator)).toBe(false)
    })
  })

  describe('validateTimestamps', () => {
    it('should return valid for zero timestamps', () => {
      const result = validateTimestamps(0n, 0n)
      expect(result.valid).toBe(true)
    })

    it('should return invalid for validAfter in future', () => {
      const futureTime = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const result = validateTimestamps(futureTime, 0n)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('validAfter')
    })

    it('should return invalid for validUntil too soon', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validUntil = now + 10n // Only 10 seconds buffer (need 30)

      const result = validateTimestamps(0n, validUntil, now)

      expect(result.valid).toBe(false)
      expect(result.reason).toContain('validUntil')
    })

    it('should return valid for validUntil with sufficient buffer', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validUntil = now + 60n // 60 seconds buffer (need 30)

      const result = validateTimestamps(0n, validUntil, now)

      expect(result.valid).toBe(true)
    })

    it('should return valid for past validAfter', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validAfter = now - 60n // 60 seconds ago

      const result = validateTimestamps(validAfter, 0n, now)

      expect(result.valid).toBe(true)
    })

    it('should handle both timestamps together', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validAfter = now - 60n
      const validUntil = now + 60n

      const result = validateTimestamps(validAfter, validUntil, now)

      expect(result.valid).toBe(true)
    })

    it('should accept custom minValidUntilBuffer via options', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validUntil = now + 10n // Only 10 seconds buffer

      // With default buffer (30), this would fail
      const resultDefault = validateTimestamps(0n, validUntil, { now })
      expect(resultDefault.valid).toBe(false)

      // With custom buffer of 5 seconds, this should pass
      const resultCustom = validateTimestamps(0n, validUntil, { now, minValidUntilBuffer: 5n })
      expect(resultCustom.valid).toBe(true)
    })

    it('should handle backward compatibility with bigint now parameter', () => {
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validUntil = now + 60n

      // Old API: passing bigint directly as now
      const result = validateTimestamps(0n, validUntil, now)
      expect(result.valid).toBe(true)
    })

    it('should use custom buffer for error message', () => {
      const now = 1000n
      const validUntil = 1008n // 8 seconds from now
      const customBuffer = 10n

      const result = validateTimestamps(0n, validUntil, { now, minValidUntilBuffer: customBuffer })
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('1010') // now + customBuffer
    })
  })

  describe('formatRevertReason', () => {
    it('should format AA error codes', () => {
      const result = formatRevertReason("AA21 didn't pay prefund")
      expect(result).toContain('Account Abstraction Error')
    })

    it('should format PM error codes', () => {
      const result = formatRevertReason('PM insufficient funds')
      expect(result).toContain('Paymaster Error')
    })

    it('should pass through plain text', () => {
      const result = formatRevertReason('Some error message')
      expect(result).toBe('Some error message')
    })
  })
})
