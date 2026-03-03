// Types

// Aggregator validator
export {
  AggregatorValidator,
  type UserOpWithAggregator,
} from './aggregatorValidator'
// Error utilities
export {
  decodeExecutionResult,
  decodeExecutionResultReturn,
  decodeFailedOp,
  decodeFailedOpWithRevert,
  decodeValidationResult,
  decodeValidationResultReturn,
  decodeValidationResultWithAggregation,
  extractErrorData,
  formatRevertReason,
  isExecutionResultError,
  isFailedOpError,
  isFailedOpWithRevertError,
  isSignatureFailure,
  isValidationResultError,
  isValidationResultWithAggregationError,
  matchesErrorSelector,
  parseSimulationError,
  parseValidationData,
  type ValidateTimestampsOptions,
  validateTimestamps,
} from './errors'
// Format validator
export { FormatValidator, type FormatValidatorConfig, userOperationSchema } from './formatValidator'
// Opcode validator
export {
  BANNED_OPCODES,
  CONDITIONAL_OPCODES,
  type ITracer,
  OpcodeValidator,
  type OpcodeValidatorConfig,
  type TraceCall,
  type TraceResult,
} from './opcodeValidator'

// Reputation manager
export { ReputationManager } from './reputationManager'

// Reputation persistence
export { ReputationPersistence } from './reputationPersistence'

// Simulation validator
export { SimulationValidator } from './simulationValidator'
// Tracer
export {
  DebugTraceCallTracer,
  type TracerConfig,
} from './tracer'
export type {
  AccountDeployedEventData,
  AggregatorInfo,
  AggregatorValidationResult,
  DepositInfo,
  EntityType,
  ExecutionResult,
  IAggregatorValidator,
  // Interfaces for DI
  IFormatValidator,
  IOpcodeValidator,
  IReputationManager,
  ISimulationValidator,
  PackedUserOperation,
  ParsedValidationData,
  ReputationCheckResult,
  ReputationConfig,
  ReputationEntry,
  ReputationStatus,
  ReturnInfo,
  StakeInfo,
  UserOperationEventData,
  UserOperationRevertReasonData,
  // Aggregator types
  UserOpsPerAggregator,
  ValidationErrorDetails,
  ValidationPhase,
  ValidationResult,
  ValidationResultWithAggregation,
} from './types'
export {
  DEFAULT_REPUTATION_CONFIG,
  VALIDATION_CONSTANTS,
} from './types'
// Main validator
export {
  DEFAULT_VALIDATOR_CONFIG,
  UserOperationValidator,
  type ValidatorConfig,
  type ValidatorDependencies,
} from './validator'
