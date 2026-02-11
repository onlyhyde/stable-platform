/**
 * Tests for @stablenet/plugin-defi
 */

import { describe, expect, it } from 'vitest'
import {
  calculateFee,
  // Helper Functions
  calculateHealthFactor,
  calculateMinOutput,
  DEFAULTS,
  DefiPluginError,
  encodeHealthFactorHookInitData,
  encodeLendingExecutorInitData,
  encodeStakingExecutorInitData,
  encodeSwapExecutorInitData,
  HealthFactorHookAbi,
  HealthFactorHookError,
  isLiquidatable,
  LendingExecutorAbi,
  LendingExecutorError,
  // Types
  LendingPoolType,
  MerchantRegistryAbi,
  MerchantRegistryError,
  // Constants
  MODULE_TYPE,
  SCALE,
  StakingExecutorAbi,
  StakingExecutorError,
  // ABIs
  SwapExecutorAbi,
  SwapExecutorError,
} from '../src'
import { TEST_VALUES } from './setup'

describe('@stablenet/plugin-defi', () => {
  describe('ABIs', () => {
    it('should export SwapExecutorAbi', () => {
      expect(SwapExecutorAbi).toBeDefined()
      expect(Array.isArray(SwapExecutorAbi)).toBe(true)
      expect(SwapExecutorAbi.length).toBeGreaterThan(0)
    })

    it('should export LendingExecutorAbi', () => {
      expect(LendingExecutorAbi).toBeDefined()
      expect(Array.isArray(LendingExecutorAbi)).toBe(true)
      expect(LendingExecutorAbi.length).toBeGreaterThan(0)
    })

    it('should export StakingExecutorAbi', () => {
      expect(StakingExecutorAbi).toBeDefined()
      expect(Array.isArray(StakingExecutorAbi)).toBe(true)
      expect(StakingExecutorAbi.length).toBeGreaterThan(0)
    })

    it('should export HealthFactorHookAbi', () => {
      expect(HealthFactorHookAbi).toBeDefined()
      expect(Array.isArray(HealthFactorHookAbi)).toBe(true)
      expect(HealthFactorHookAbi.length).toBeGreaterThan(0)
    })

    it('should export MerchantRegistryAbi', () => {
      expect(MerchantRegistryAbi).toBeDefined()
      expect(Array.isArray(MerchantRegistryAbi)).toBe(true)
      expect(MerchantRegistryAbi.length).toBeGreaterThan(0)
    })
  })

  describe('Constants', () => {
    it('should have correct MODULE_TYPE values', () => {
      expect(MODULE_TYPE.VALIDATOR).toBe(1)
      expect(MODULE_TYPE.EXECUTOR).toBe(2)
      expect(MODULE_TYPE.FALLBACK).toBe(3)
      expect(MODULE_TYPE.HOOK).toBe(4)
    })

    it('should have correct DEFAULTS values', () => {
      expect(DEFAULTS.MAX_SLIPPAGE_BPS).toBe(100)
      expect(DEFAULTS.DAILY_LIMIT).toBe(BigInt('10000000000000000000'))
      expect(DEFAULTS.MAX_LTV).toBe(8000)
      expect(DEFAULTS.MIN_HEALTH_FACTOR).toBe(BigInt('1200000000000000000'))
      expect(DEFAULTS.DEFAULT_MERCHANT_FEE_BPS).toBe(250)
      expect(DEFAULTS.MAX_MERCHANT_FEE_BPS).toBe(1000)
    })

    it('should have correct SCALE values', () => {
      expect(SCALE.BPS).toBe(10000)
      expect(SCALE.WAD).toBe(BigInt('1000000000000000000'))
      expect(SCALE.RAY).toBe(BigInt('1000000000000000000000000000'))
    })
  })

  describe('Enums', () => {
    it('should have correct LendingPoolType values', () => {
      expect(LendingPoolType.UNKNOWN).toBe(0)
      expect(LendingPoolType.AAVE_V3).toBe(1)
      expect(LendingPoolType.COMPOUND_V3).toBe(2)
      expect(LendingPoolType.MORPHO).toBe(3)
    })
  })

  describe('Error Classes', () => {
    it('should create DefiPluginError correctly', () => {
      const error = new DefiPluginError('Test error', 'TEST_CODE', { detail: 'value' })
      expect(error.name).toBe('DefiPluginError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.details).toEqual({ detail: 'value' })
    })

    it('should create SwapExecutorError correctly', () => {
      const error = new SwapExecutorError('Swap failed', 'SWAP_FAILED')
      expect(error.name).toBe('SwapExecutorError')
      expect(error.message).toBe('Swap failed')
      expect(error.code).toBe('SWAP_FAILED')
    })

    it('should create LendingExecutorError correctly', () => {
      const error = new LendingExecutorError('Borrow failed', 'BORROW_FAILED')
      expect(error.name).toBe('LendingExecutorError')
      expect(error.message).toBe('Borrow failed')
    })

    it('should create StakingExecutorError correctly', () => {
      const error = new StakingExecutorError('Stake failed', 'STAKE_FAILED')
      expect(error.name).toBe('StakingExecutorError')
    })

    it('should create HealthFactorHookError correctly', () => {
      const error = new HealthFactorHookError('Health check failed', 'HF_FAILED')
      expect(error.name).toBe('HealthFactorHookError')
    })

    it('should create MerchantRegistryError correctly', () => {
      const error = new MerchantRegistryError('Registration failed', 'REG_FAILED')
      expect(error.name).toBe('MerchantRegistryError')
    })
  })

  describe('Helper Functions', () => {
    describe('calculateHealthFactor', () => {
      it('should return max uint256 when debt is zero', () => {
        const result = calculateHealthFactor(TEST_VALUES.ONE_ETH, 0n, 8000)
        expect(result).toBe(TEST_VALUES.MAX_UINT256)
      })

      it('should calculate health factor correctly', () => {
        // Collateral: 100 ETH, Debt: 50 ETH, LT: 80%
        // HF = (100 * 0.80) / 50 = 1.6
        const collateral = BigInt('100000000000000000000') // 100 ETH
        const debt = BigInt('50000000000000000000') // 50 ETH
        const lt = 8000 // 80%

        const hf = calculateHealthFactor(collateral, debt, lt)
        // Expected: 1.6 * 1e18 = 1600000000000000000
        expect(hf).toBe(BigInt('1600000000000000000'))
      })

      it('should return health factor < 1 when underwater', () => {
        // Collateral: 50 ETH, Debt: 50 ETH, LT: 80%
        // HF = (50 * 0.80) / 50 = 0.8
        const collateral = BigInt('50000000000000000000')
        const debt = BigInt('50000000000000000000')
        const lt = 8000

        const hf = calculateHealthFactor(collateral, debt, lt)
        expect(hf).toBe(BigInt('800000000000000000'))
        expect(isLiquidatable(hf)).toBe(true)
      })
    })

    describe('isLiquidatable', () => {
      it('should return true when health factor < 1', () => {
        expect(isLiquidatable(BigInt('999999999999999999'))).toBe(true)
        expect(isLiquidatable(BigInt('500000000000000000'))).toBe(true)
        expect(isLiquidatable(0n)).toBe(true)
      })

      it('should return false when health factor >= 1', () => {
        expect(isLiquidatable(SCALE.WAD)).toBe(false)
        expect(isLiquidatable(TEST_VALUES.HEALTH_FACTOR_1_2)).toBe(false)
        expect(isLiquidatable(TEST_VALUES.HEALTH_FACTOR_2_0)).toBe(false)
      })
    })

    describe('calculateMinOutput', () => {
      it('should calculate min output with 1% slippage', () => {
        const amount = BigInt('1000000000000000000') // 1 ETH
        const slippageBps = 100 // 1%

        const minOutput = calculateMinOutput(amount, slippageBps)
        // Expected: 1 ETH * 99% = 0.99 ETH
        expect(minOutput).toBe(BigInt('990000000000000000'))
      })

      it('should calculate min output with 0.5% slippage', () => {
        const amount = BigInt('1000000000000000000')
        const slippageBps = 50 // 0.5%

        const minOutput = calculateMinOutput(amount, slippageBps)
        expect(minOutput).toBe(BigInt('995000000000000000'))
      })

      it('should return full amount with 0% slippage', () => {
        const amount = BigInt('1000000000000000000')
        const minOutput = calculateMinOutput(amount, 0)
        expect(minOutput).toBe(amount)
      })
    })

    describe('calculateFee', () => {
      it('should calculate 2.5% fee correctly', () => {
        const amount = BigInt('1000000000000000000') // 1 ETH
        const feeBps = 250 // 2.5%

        const fee = calculateFee(amount, feeBps)
        expect(fee).toBe(BigInt('25000000000000000')) // 0.025 ETH
      })

      it('should calculate 10% fee correctly', () => {
        const amount = BigInt('1000000000000000000')
        const feeBps = 1000 // 10%

        const fee = calculateFee(amount, feeBps)
        expect(fee).toBe(BigInt('100000000000000000')) // 0.1 ETH
      })

      it('should return 0 for 0% fee', () => {
        const amount = BigInt('1000000000000000000')
        const fee = calculateFee(amount, 0)
        expect(fee).toBe(0n)
      })
    })

    describe('encodeSwapExecutorInitData', () => {
      it('should encode init data correctly', () => {
        const encoded = encodeSwapExecutorInitData({
          maxSlippageBps: 100,
          dailyLimit: TEST_VALUES.TEN_ETH,
        })

        expect(encoded).toMatch(/^0x[a-f0-9]+$/)
        expect(encoded.length).toBe(2 + 64 + 64) // 0x + 2 * 32 bytes
      })
    })

    describe('encodeLendingExecutorInitData', () => {
      it('should encode init data correctly', () => {
        const encoded = encodeLendingExecutorInitData({
          maxLtv: 8000,
          minHealthFactor: TEST_VALUES.HEALTH_FACTOR_1_2,
          dailyBorrowLimit: TEST_VALUES.TEN_ETH,
        })

        expect(encoded).toMatch(/^0x[a-f0-9]+$/)
        expect(encoded.length).toBe(2 + 64 + 64 + 64) // 0x + 3 * 32 bytes
      })
    })

    describe('encodeStakingExecutorInitData', () => {
      it('should encode init data correctly', () => {
        const encoded = encodeStakingExecutorInitData({
          maxStakePerPool: TEST_VALUES.HUNDRED_ETH,
          dailyStakeLimit: TEST_VALUES.TEN_ETH,
        })

        expect(encoded).toMatch(/^0x[a-f0-9]+$/)
        expect(encoded.length).toBe(2 + 64 + 64) // 0x + 2 * 32 bytes
      })
    })

    describe('encodeHealthFactorHookInitData', () => {
      it('should encode init data correctly', () => {
        const encoded = encodeHealthFactorHookInitData({
          minHealthFactor: TEST_VALUES.HEALTH_FACTOR_1_5,
        })

        expect(encoded).toMatch(/^0x[a-f0-9]+$/)
        expect(encoded.length).toBe(2 + 64) // 0x + 1 * 32 bytes
      })
    })
  })
})
