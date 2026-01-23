// Types
export type {
  ValidationPhase,
  ReturnInfo,
  StakeInfo,
  ValidationResult,
  AggregatorInfo,
  ValidationResultWithAggregation,
  DepositInfo,
  ReputationStatus,
  ReputationEntry,
  ReputationConfig,
  ParsedValidationData,
  ValidationErrorDetails,
  ExecutionResult,
  UserOperationEventData,
  AccountDeployedEventData,
  UserOperationRevertReasonData,
  // Interfaces for DI
  IFormatValidator,
  ISimulationValidator,
  IReputationManager,
  IOpcodeValidator,
  EntityType,
  ReputationCheckResult,
  // Aggregator types
  UserOpsPerAggregator,
  PackedUserOperation,
  AggregatorValidationResult,
  IAggregatorValidator,
} from './types'

export {
  VALIDATION_CONSTANTS,
  DEFAULT_REPUTATION_CONFIG,
} from './types'

// Error utilities
export {
  matchesErrorSelector,
  isValidationResultError,
  isValidationResultWithAggregationError,
  isFailedOpError,
  isFailedOpWithRevertError,
  isExecutionResultError,
  extractErrorData,
  decodeValidationResult,
  decodeValidationResultWithAggregation,
  decodeFailedOp,
  decodeFailedOpWithRevert,
  decodeExecutionResult,
  parseValidationData,
  isSignatureFailure,
  validateTimestamps,
  formatRevertReason,
  parseSimulationError,
  type ValidateTimestampsOptions,
} from './errors'

// Format validator
export { FormatValidator, userOperationSchema } from './formatValidator'

// Reputation manager
export { ReputationManager } from './reputationManager'

// Simulation validator
export { SimulationValidator } from './simulationValidator'

// Opcode validator
export {
  OpcodeValidator,
  BANNED_OPCODES,
  CONDITIONAL_OPCODES,
  type TraceCall,
  type TraceResult,
  type ITracer,
  type OpcodeValidatorConfig,
} from './opcodeValidator'

// Main validator
export {
  UserOperationValidator,
  DEFAULT_VALIDATOR_CONFIG,
  type ValidatorConfig,
  type ValidatorDependencies,
} from './validator'

// Aggregator validator
export {
  AggregatorValidator,
  type UserOpWithAggregator,
} from './aggregatorValidator'
