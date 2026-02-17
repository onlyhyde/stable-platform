import type { Address, Hex, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GasEstimator } from '../src/gas/gasEstimator'
import { RPC_ERROR_CODES, RpcError } from '../src/types'
import { createLogger } from '../src/utils/logger'
import type {
  IFormatValidator,
  IReputationManager,
  ISimulationValidator,
  ReputationConfig,
  ReputationStatus,
  StakeInfo,
  ValidationResult,
} from '../src/validation/types'
import {
  UserOperationValidator,
  type ValidatorConfig,
  type ValidatorDependencies,
} from '../src/validation/validator'

// Test constants
const TEST_SENDER = '0x1234567890123456789012345678901234567890' as Address
const TEST_ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

const mockLogger = createLogger('error', false)

function createTestUserOp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sender: TEST_SENDER,
    nonce: 0n,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 100000000n,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: ('0x' + '00'.repeat(65)) as Hex,
    ...overrides,
  }
}

function createMockValidationResult(): ValidationResult {
  const zeroStakeInfo: StakeInfo = { stake: 0n, unstakeDelaySec: 0n }
  return {
    returnInfo: {
      preOpGas: 50000n,
      prefund: 0n,
      accountValidationData: 0n,
      paymasterValidationData: 0n,
      paymasterContext: '0x',
    },
    senderInfo: zeroStakeInfo,
    factoryInfo: zeroStakeInfo,
    paymasterInfo: zeroStakeInfo,
  }
}

describe('bundler', () => {
  describe('UserOperationValidator', () => {
    let validator: UserOperationValidator
    let mockFormatValidator: IFormatValidator
    let mockSimValidator: ISimulationValidator
    let mockRepManager: IReputationManager

    beforeEach(() => {
      mockFormatValidator = {
        validate: vi.fn(),
      }

      mockSimValidator = {
        simulate: vi.fn().mockResolvedValue(createMockValidationResult()),
        getNonce: vi.fn().mockResolvedValue(0n),
        hasCode: vi.fn().mockResolvedValue(true),
        validateSignature: vi.fn(),
        validateTimestamps: vi.fn(),
        validateAggregator: vi.fn().mockReturnValue(undefined),
        validateStakeInfo: vi.fn(),
      }

      mockRepManager = {
        checkReputation: vi.fn().mockReturnValue('ok' as ReputationStatus),
        updateSeen: vi.fn(),
        updateIncluded: vi.fn(),
        ban: vi.fn(),
        throttle: vi.fn(),
        clearReputation: vi.fn(),
        clearAll: vi.fn(),
        getConfig: vi.fn().mockReturnValue({
          minStake: 0n,
          minUnstakeDelay: 0n,
          minInclusionDenominator: 10n,
          throttlingSlack: 10n,
          banSlack: 50n,
        } as ReputationConfig),
      }

      const config: ValidatorConfig = {
        entryPoint: TEST_ENTRY_POINT,
        skipSimulation: true,
        skipReputation: false,
      }

      const deps: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimValidator,
        reputationManager: mockRepManager,
      }

      validator = new UserOperationValidator(config, mockLogger, deps)
    })

    it('should validate a well-formed user operation', async () => {
      const userOp = createTestUserOp()
      const result = await validator.validate(userOp)

      expect(result).toBeDefined()
      expect(result.returnInfo.preOpGas).toBeGreaterThan(0n)
      expect(mockFormatValidator.validate).toHaveBeenCalledWith(userOp)
    })

    it('should reject operations with invalid format', async () => {
      const error = new RpcError('invalid callData', RPC_ERROR_CODES.INVALID_PARAMS)
      vi.mocked(mockFormatValidator.validate).mockImplementation(() => {
        throw error
      })

      const userOp = createTestUserOp()
      await expect(validator.validate(userOp)).rejects.toThrow('invalid callData')
    })

    it('should reject operations from banned senders', async () => {
      // Re-create with reputation enabled
      const config: ValidatorConfig = {
        entryPoint: TEST_ENTRY_POINT,
        skipSimulation: true,
        skipReputation: false,
      }
      const deps: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimValidator,
        reputationManager: mockRepManager,
      }
      const v = new UserOperationValidator(config, mockLogger, deps)

      vi.mocked(mockRepManager.checkReputation).mockReturnValue('banned' as ReputationStatus)

      const userOp = createTestUserOp()
      await expect(v.validate(userOp)).rejects.toThrow(/banned/)
    })

    it('should skip reputation check when skipReputation is true', async () => {
      const config: ValidatorConfig = {
        entryPoint: TEST_ENTRY_POINT,
        skipSimulation: true,
        skipReputation: true,
      }
      const deps: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimValidator,
        reputationManager: mockRepManager,
      }
      const v = new UserOperationValidator(config, mockLogger, deps)

      vi.mocked(mockRepManager.checkReputation).mockReturnValue('banned' as ReputationStatus)

      const userOp = createTestUserOp()
      // Should succeed despite banned reputation since check is skipped
      const result = await v.validate(userOp)
      expect(result).toBeDefined()
      expect(mockRepManager.checkReputation).not.toHaveBeenCalled()
    })
  })

  describe('GasEstimator', () => {
    it('should be instantiable with required dependencies', () => {
      const mockClient = {
        call: vi.fn(),
        getCode: vi.fn(),
      } as unknown as PublicClient

      const gasEstimator = new GasEstimator(mockClient, TEST_ENTRY_POINT, mockLogger)
      expect(gasEstimator).toBeDefined()
      expect(gasEstimator).toBeInstanceOf(GasEstimator)
    })
  })
})
