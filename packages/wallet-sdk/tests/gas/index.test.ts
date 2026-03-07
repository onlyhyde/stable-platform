import { describe, expect, it } from 'vitest'
import {
  createGasEstimator,
  createSmartAccountGasStrategy,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  estimateUserOperationGas,
  PAYMASTER_POST_OP_GAS,
  PAYMASTER_VERIFICATION_GAS,
} from '../../src/gas'

describe('gas module', () => {
  it('should re-export createGasEstimator', () => {
    expect(typeof createGasEstimator).toBe('function')
  })

  it('should re-export createSmartAccountGasStrategy', () => {
    expect(typeof createSmartAccountGasStrategy).toBe('function')
  })

  it('should re-export estimateUserOperationGas', () => {
    expect(typeof estimateUserOperationGas).toBe('function')
  })

  it('should export gas constants with correct values', () => {
    expect(DEFAULT_CALL_GAS_LIMIT).toBe(200_000n)
    expect(DEFAULT_VERIFICATION_GAS_LIMIT).toBe(150_000n)
    expect(DEFAULT_PRE_VERIFICATION_GAS).toBe(50_000n)
    expect(PAYMASTER_VERIFICATION_GAS).toBe(75_000n)
    expect(PAYMASTER_POST_OP_GAS).toBe(50_000n)
  })
})
