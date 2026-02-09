import type { Address, Hex, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RPC_ERROR_CODES, RpcError } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import type {
  IFormatValidator,
  IOpcodeValidator,
  IReputationManager,
  ISimulationValidator,
  ReputationConfig,
  ReputationStatus,
  StakeInfo,
  ValidationResult,
} from '../../src/validation/types'
import { UserOperationValidator, type ValidatorDependencies } from '../../src/validation/validator'

// Test addresses
const TEST_SENDER = '0x1234567890123456789012345678901234567890' as Address
const TEST_FACTORY = '0x2345678901234567890123456789012345678901' as Address
const TEST_PAYMASTER = '0x3456789012345678901234567890123456789012' as Address
const TEST_ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

// Create test user operation
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

// Create mock validation result
function createMockValidationResult(): ValidationResult {
  const zeroStakeInfo: StakeInfo = {
    stake: 0n,
    unstakeDelaySec: 0n,
  }
  return {
    returnInfo: {
      preOpGas: 50000n,
      prefund: 0n,
      accountValidationData: 0n,
      paymasterValidationData: 0n,
      paymasterContext: '0x' as Hex,
    },
    senderInfo: zeroStakeInfo,
    factoryInfo: zeroStakeInfo,
    paymasterInfo: zeroStakeInfo,
  }
}

// Create logger for tests (suppress output)
const mockLogger = createLogger('error', false)

describe('UserOperationValidator', () => {
  let mockFormatValidator: IFormatValidator
  let mockSimulationValidator: ISimulationValidator
  let mockReputationManager: IReputationManager
  let mockOpcodeValidator: IOpcodeValidator

  beforeEach(() => {
    // Create mock format validator
    mockFormatValidator = {
      validate: vi.fn(),
      validateSignatureFormat: vi.fn().mockReturnValue(true),
      validateAddressFormat: vi.fn().mockReturnValue(true),
      validateHexFormat: vi.fn().mockReturnValue(true),
    }

    // Create mock simulation validator
    mockSimulationValidator = {
      simulate: vi.fn().mockResolvedValue(createMockValidationResult()),
      simulateExecution: vi.fn().mockResolvedValue({
        preOpGas: 50000n,
        paid: 0n,
        accountValidationData: 0n,
        paymasterValidationData: 0n,
        targetSuccess: true,
        targetResult: '0x' as Hex,
      }),
      validateTimestamps: vi.fn(),
      validateSignature: vi.fn(),
      validateAggregator: vi.fn().mockReturnValue(null),
      validateStakeInfo: vi.fn(),
      getNonce: vi.fn().mockResolvedValue(0n),
      getDepositInfo: vi.fn().mockResolvedValue({
        deposit: 1000000000000000000n,
        staked: false,
        stake: 0n,
        unstakeDelaySec: 0,
        withdrawTime: 0,
      }),
      getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
      hasCode: vi.fn().mockResolvedValue(true),
    }

    // Create mock reputation manager
    mockReputationManager = {
      checkReputation: vi.fn().mockReturnValue('ok' as ReputationStatus),
      checkReputationWithStake: vi.fn().mockReturnValue({ status: 'ok', isStaked: false }),
      isStaked: vi.fn().mockReturnValue(false),
      updateSeen: vi.fn(),
      updateIncluded: vi.fn(),
      ban: vi.fn(),
      throttle: vi.fn(),
      clearReputation: vi.fn(),
      clearAll: vi.fn(),
      getEntry: vi.fn().mockReturnValue(undefined),
      getAllEntries: vi.fn().mockReturnValue([]),
      getBannedAddresses: vi.fn().mockReturnValue([]),
      getThrottledAddresses: vi.fn().mockReturnValue([]),
      setReputation: vi.fn(),
      dump: vi.fn().mockReturnValue([]),
      getConfig: vi.fn().mockReturnValue({
        minInclusionDenominator: 10,
        throttlingSlack: 10,
        banSlack: 50,
        minStake: 100000000000000000n,
        minUnstakeDelay: 86400,
      } as ReputationConfig),
      updateConfig: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 0, ok: 0, throttled: 0, banned: 0 }),
    }

    // Create mock opcode validator
    mockOpcodeValidator = {
      validate: vi.fn().mockResolvedValue(undefined),
    }
  })

  describe('Opcode Validation Integration', () => {
    it('should call opcodeValidator when provided and not skipped', async () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          skipOpcodeValidation: false,
        },
        mockLogger,
        dependencies
      )

      const userOp = createTestUserOp()
      await validator.validate(userOp)

      expect(mockOpcodeValidator.validate).toHaveBeenCalledWith(
        userOp.sender,
        userOp.factory,
        userOp.paymaster
      )
    })

    it('should not call opcodeValidator when skipOpcodeValidation is true', async () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          skipOpcodeValidation: true,
        },
        mockLogger,
        dependencies
      )

      const userOp = createTestUserOp()
      await validator.validate(userOp)

      expect(mockOpcodeValidator.validate).not.toHaveBeenCalled()
    })

    it('should not fail when opcodeValidator is not provided', async () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        // opcodeValidator not provided
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
        },
        mockLogger,
        dependencies
      )

      const userOp = createTestUserOp()
      const result = await validator.validate(userOp)

      expect(result).toBeDefined()
      expect(result.returnInfo).toBeDefined()
    })

    it('should throw when opcodeValidator detects banned opcode', async () => {
      mockOpcodeValidator.validate = vi
        .fn()
        .mockRejectedValue(
          new RpcError('sender used banned opcode: GASPRICE', RPC_ERROR_CODES.BANNED_OPCODE)
        )

      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          skipOpcodeValidation: false,
        },
        mockLogger,
        dependencies
      )

      const userOp = createTestUserOp()

      await expect(validator.validate(userOp)).rejects.toThrow(RpcError)
      await expect(validator.validate(userOp)).rejects.toMatchObject({
        code: RPC_ERROR_CODES.BANNED_OPCODE,
      })
    })

    it('should pass factory and paymaster to opcodeValidator', async () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          skipOpcodeValidation: false,
        },
        mockLogger,
        dependencies
      )

      // User op with factory
      const userOpWithFactory = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
      })
      await validator.validate(userOpWithFactory)

      expect(mockOpcodeValidator.validate).toHaveBeenCalledWith(
        TEST_SENDER,
        TEST_FACTORY,
        undefined
      )

      // Reset mock
      vi.clearAllMocks()

      // User op with paymaster
      const userOpWithPaymaster = createTestUserOp({
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x' as Hex,
      })
      await validator.validate(userOpWithPaymaster)

      expect(mockOpcodeValidator.validate).toHaveBeenCalledWith(
        TEST_SENDER,
        undefined,
        TEST_PAYMASTER
      )

      // Reset mock
      vi.clearAllMocks()

      // User op with both factory and paymaster
      const userOpWithBoth = createTestUserOp({
        factory: TEST_FACTORY,
        factoryData: '0x1234' as Hex,
        paymaster: TEST_PAYMASTER,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 50000n,
        paymasterData: '0x' as Hex,
      })
      await validator.validate(userOpWithBoth)

      expect(mockOpcodeValidator.validate).toHaveBeenCalledWith(
        TEST_SENDER,
        TEST_FACTORY,
        TEST_PAYMASTER
      )
    })

    it('should expose opcodeValidator through getter', () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
        },
        mockLogger,
        dependencies
      )

      expect(validator.getOpcodeValidator()).toBe(mockOpcodeValidator)
    })

    it('should return undefined when opcodeValidator is not provided', () => {
      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
        },
        mockLogger,
        dependencies
      )

      expect(validator.getOpcodeValidator()).toBeUndefined()
    })
  })

  describe('Validation Phase Order', () => {
    it('should run opcode validation after simulation result validation', async () => {
      const callOrder: string[] = []

      mockFormatValidator.validate = vi.fn(() => {
        callOrder.push('format')
      })

      mockReputationManager.checkReputation = vi.fn(() => {
        callOrder.push('reputation')
        return 'ok' as ReputationStatus
      })

      mockSimulationValidator.hasCode = vi.fn().mockImplementation(() => {
        callOrder.push('state')
        return Promise.resolve(true)
      })

      mockSimulationValidator.validateSignature = vi.fn(() => {
        callOrder.push('simulation-result')
      })

      mockOpcodeValidator.validate = vi.fn().mockImplementation(() => {
        callOrder.push('opcode')
        return Promise.resolve()
      })

      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
        opcodeValidator: mockOpcodeValidator,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          skipOpcodeValidation: false,
        },
        mockLogger,
        dependencies
      )

      const userOp = createTestUserOp()
      await validator.validate(userOp)

      // Verify opcode validation runs after simulation result validation
      const simulationResultIndex = callOrder.indexOf('simulation-result')
      const opcodeIndex = callOrder.indexOf('opcode')

      expect(opcodeIndex).toBeGreaterThan(simulationResultIndex)
    })
  })

  describe('Configurable Constants', () => {
    it('should use default maxNonceGap of 10', async () => {
      // Mock getNonce to return on-chain nonce 0
      mockSimulationValidator.getNonce = vi.fn().mockResolvedValue(0n)

      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          // maxNonceGap not specified, should use default of 10
        },
        mockLogger,
        dependencies
      )

      // Nonce 10 should pass (0 + 10 = 10, within gap)
      const userOp10 = createTestUserOp({ nonce: 10n })
      await expect(validator.validate(userOp10)).resolves.toBeDefined()

      // Nonce 11 should fail (0 + 10 = 10, gap exceeded)
      const userOp11 = createTestUserOp({ nonce: 11n })
      await expect(validator.validate(userOp11)).rejects.toThrow('nonce too high')
    })

    it('should accept custom maxNonceGap', async () => {
      // Mock getNonce to return on-chain nonce 0
      mockSimulationValidator.getNonce = vi.fn().mockResolvedValue(0n)

      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          maxNonceGap: 5n, // Custom: only allow gap of 5
        },
        mockLogger,
        dependencies
      )

      // Nonce 5 should pass (0 + 5 = 5, within gap)
      const userOp5 = createTestUserOp({ nonce: 5n })
      await expect(validator.validate(userOp5)).resolves.toBeDefined()

      // Nonce 6 should fail (0 + 5 = 5, gap exceeded)
      const userOp6 = createTestUserOp({ nonce: 6n })
      await expect(validator.validate(userOp6)).rejects.toThrow('nonce too high')
    })

    it('should allow large maxNonceGap for specific use cases', async () => {
      // Mock getNonce to return on-chain nonce 0
      mockSimulationValidator.getNonce = vi.fn().mockResolvedValue(0n)

      const dependencies: ValidatorDependencies = {
        formatValidator: mockFormatValidator,
        simulationValidator: mockSimulationValidator,
        reputationManager: mockReputationManager,
      }

      const validator = new UserOperationValidator(
        {
          entryPoint: TEST_ENTRY_POINT,
          skipSimulation: true,
          maxNonceGap: 100n, // Large gap for batch processing
        },
        mockLogger,
        dependencies
      )

      // Nonce 100 should pass
      const userOp100 = createTestUserOp({ nonce: 100n })
      await expect(validator.validate(userOp100)).resolves.toBeDefined()
    })
  })

  describe('create() factory with OpcodeValidator', () => {
    const mockPublicClient = {
      request: vi.fn(),
      readContract: vi.fn(),
      getCode: vi.fn(),
      simulateContract: vi.fn(),
      getBalance: vi.fn(),
    } as unknown as PublicClient

    it('should create OpcodeValidator when skipOpcodeValidation is not set', () => {
      const validator = UserOperationValidator.create(
        mockPublicClient,
        { entryPoint: TEST_ENTRY_POINT },
        mockLogger
      )

      expect(validator.getOpcodeValidator()).toBeDefined()
    })

    it('should NOT create OpcodeValidator when skipOpcodeValidation is true', () => {
      const validator = UserOperationValidator.create(
        mockPublicClient,
        { entryPoint: TEST_ENTRY_POINT, skipOpcodeValidation: true },
        mockLogger
      )

      expect(validator.getOpcodeValidator()).toBeUndefined()
    })

    it('should return OpcodeValidator via getOpcodeValidator()', () => {
      const validator = UserOperationValidator.create(
        mockPublicClient,
        { entryPoint: TEST_ENTRY_POINT },
        mockLogger
      )

      const opcodeValidator = validator.getOpcodeValidator()
      expect(opcodeValidator).toBeDefined()
      expect(typeof opcodeValidator!.validate).toBe('function')
    })

    it('should still create validator without OpcodeValidator when skipped', () => {
      const validator = UserOperationValidator.create(
        mockPublicClient,
        { entryPoint: TEST_ENTRY_POINT, skipOpcodeValidation: true },
        mockLogger
      )

      // Validator itself should still be functional
      expect(validator).toBeInstanceOf(UserOperationValidator)
      expect(validator.getFormatValidator()).toBeDefined()
      expect(validator.getReputationManager()).toBeDefined()
      expect(validator.getSimulationValidator()).toBeDefined()
    })
  })
})
