import type { Address, Hex } from 'viem'
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { Logger } from '../utils/logger'

/**
 * ERC-7562 Banned opcodes list
 * These opcodes are not allowed during UserOperation validation
 */
export const BANNED_OPCODES = [
  // Block information (can be manipulated by block producers)
  'GASPRICE',
  'GASLIMIT',
  'DIFFICULTY',
  'TIMESTAMP',
  'BASEFEE',
  'BLOCKHASH',
  'NUMBER',
  'COINBASE',
  'PREVRANDAO',
  'RANDOM',

  // External state access
  'SELFBALANCE',
  'BALANCE',
  'ORIGIN',
  'GAS',

  // Contract creation (except CREATE2 for factory)
  'CREATE',

  // Destructive operations
  'SELFDESTRUCT',
  'INVALID',
] as const

/**
 * Opcodes that are conditionally allowed
 */
export const CONDITIONAL_OPCODES = {
  // CREATE2 is only allowed for factory during account deployment
  CREATE2: 'factory',
} as const

/**
 * Trace call structure from debug_traceCall
 */
export interface TraceCall {
  from: Address
  to: Address
  type: string
  gas: Hex
  gasUsed: Hex
  input: Hex
  output: Hex
  opcodes: string[]
  storage: Record<Address, string[]>
  calls?: TraceCall[]
}

/**
 * Trace result structure
 */
export interface TraceResult {
  calls: TraceCall[]
  logs: Array<{
    address: Address
    topics: Hex[]
    data: Hex
  }>
}

/**
 * Tracer interface for dependency injection
 */
export interface ITracer {
  trace(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Promise<TraceResult>
}

/**
 * Opcode validator configuration
 */
export interface OpcodeValidatorConfig {
  /** Opcodes to allow (override banned list) */
  allowedOpcodes?: string[]
  /** Enable strict storage access validation */
  strictStorageAccess?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<OpcodeValidatorConfig> = {
  allowedOpcodes: [],
  strictStorageAccess: true,
}

/**
 * Entity type for error messages
 */
type EntityType = 'sender' | 'factory' | 'paymaster' | 'unknown'

/**
 * Opcode validator for ERC-7562 compliance
 * Validates that UserOperations don't use banned opcodes or access unauthorized storage
 */
export class OpcodeValidator {
  private readonly tracer: ITracer
  private readonly logger: Logger
  private readonly config: Required<OpcodeValidatorConfig>
  private readonly bannedOpcodes: Set<string>
  private lastTrace: TraceResult | null = null

  constructor(
    tracer: ITracer,
    entryPoint: Address,
    logger: Logger,
    config: OpcodeValidatorConfig = {}
  ) {
    this.tracer = tracer
    this.logger = logger.child({ module: 'opcodeValidator' })
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Build banned opcodes set excluding allowed ones
    this.bannedOpcodes = new Set(
      BANNED_OPCODES.filter((op) => !this.config.allowedOpcodes.includes(op))
    )
  }

  /**
   * Validate opcodes and storage access for a UserOperation
   */
  async validate(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Promise<void> {
    this.logger.debug({ sender, factory, paymaster }, 'Starting opcode validation')

    // Get trace from tracer
    let trace: TraceResult
    try {
      trace = await this.tracer.trace(sender, factory, paymaster)
      this.lastTrace = trace
    } catch (error) {
      this.logger.error({ error }, 'Failed to get trace')
      throw new RpcError('Failed to trace UserOperation validation', RPC_ERROR_CODES.INTERNAL_ERROR)
    }

    // Build entity set for identification
    const entities = this.buildEntitySet(sender, factory, paymaster)

    // Validate all calls recursively
    for (const call of trace.calls) {
      this.validateCall(call, sender, factory, paymaster, entities)
    }

    this.logger.debug({ sender }, 'Opcode validation passed')
  }

  /**
   * Build a set of entities for quick lookup
   */
  private buildEntitySet(
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): Map<string, EntityType> {
    const entities = new Map<string, EntityType>()
    entities.set(sender.toLowerCase(), 'sender')
    if (factory) {
      entities.set(factory.toLowerCase(), 'factory')
    }
    if (paymaster) {
      entities.set(paymaster.toLowerCase(), 'paymaster')
    }
    return entities
  }

  /**
   * Get entity type for an address
   */
  private getEntityType(address: Address, entities: Map<string, EntityType>): EntityType {
    return entities.get(address.toLowerCase()) ?? 'unknown'
  }

  /**
   * Validate a single call and its nested calls
   */
  private validateCall(
    call: TraceCall,
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined,
    entities: Map<string, EntityType>
  ): void {
    const entityType = this.getEntityType(call.from, entities)

    // Validate opcodes
    this.validateOpcodes(call.opcodes, entityType, call.from, factory)

    // Validate storage access
    if (this.config.strictStorageAccess) {
      this.validateStorageAccess(call.storage, entityType, call.from, sender, factory, paymaster)
    }

    // Recursively validate nested calls
    if (call.calls) {
      for (const nestedCall of call.calls) {
        this.validateCall(nestedCall, sender, factory, paymaster, entities)
      }
    }
  }

  /**
   * Validate opcodes used in a call
   */
  private validateOpcodes(
    opcodes: string[],
    entityType: EntityType,
    from: Address,
    factory: Address | undefined
  ): void {
    for (const opcode of opcodes) {
      const upperOpcode = opcode.toUpperCase()

      // Check banned opcodes
      if (this.bannedOpcodes.has(upperOpcode)) {
        throw new RpcError(
          `${entityType} ${from} used banned opcode: ${upperOpcode}`,
          RPC_ERROR_CODES.BANNED_OPCODE
        )
      }

      // Check conditional opcodes
      if (upperOpcode === 'CREATE2') {
        // CREATE2 is only allowed for factory
        const isFactory = factory && from.toLowerCase() === factory.toLowerCase()
        if (!isFactory) {
          throw new RpcError(
            `${entityType} ${from} used CREATE2 opcode (only allowed for factory)`,
            RPC_ERROR_CODES.BANNED_OPCODE
          )
        }
      }
    }
  }

  /**
   * Validate storage access rules per ERC-7562
   */
  private validateStorageAccess(
    storage: Record<Address, string[]>,
    entityType: EntityType,
    from: Address,
    sender: Address,
    factory: Address | undefined,
    paymaster: Address | undefined
  ): void {
    for (const [storageAddress, slots] of Object.entries(storage)) {
      if (slots.length === 0) continue

      const normalizedStorageAddr = storageAddress.toLowerCase()
      const normalizedFrom = from.toLowerCase()
      const normalizedSender = sender.toLowerCase()
      const normalizedFactory = factory?.toLowerCase()
      const normalizedPaymaster = paymaster?.toLowerCase()

      // Check if access is allowed based on entity type, storage owner, and slots
      const isAllowed = this.isStorageAccessAllowed(
        normalizedStorageAddr,
        normalizedFrom,
        normalizedSender,
        normalizedFactory,
        normalizedPaymaster,
        entityType,
        slots
      )

      if (!isAllowed) {
        throw new RpcError(
          `${entityType} ${from} accessed storage of ${storageAddress} (not allowed)`,
          RPC_ERROR_CODES.BANNED_OPCODE
        )
      }
    }
  }

  /**
   * Get the last trace result from validation.
   * Used by DependencyTracker to capture storage access data
   * without re-tracing.
   */
  getLastTraceResult(): TraceResult | null {
    return this.lastTrace
  }

  /**
   * Check if storage access is allowed per ERC-7562 rules.
   * Validates both at address level and at slot level (associated storage).
   */
  private isStorageAccessAllowed(
    storageAddress: string,
    from: string,
    sender: string,
    _factory: string | undefined,
    paymaster: string | undefined,
    entityType: EntityType,
    slots?: string[]
  ): boolean {
    // Entity can always access its own storage
    if (storageAddress === from) {
      return true
    }

    // Special rules based on entity type
    switch (entityType) {
      case 'sender':
        // Sender can only access own storage
        return storageAddress === sender

      case 'factory':
        // Factory can access sender's storage during deployment
        return storageAddress === sender || storageAddress === from

      case 'paymaster':
        // Paymaster can access own storage
        if (storageAddress === paymaster || storageAddress === from) {
          return true
        }
        // Paymaster can also access "associated storage" of the sender,
        // i.e., slots of the form keccak256(sender || i) in external contracts.
        // Per ERC-7562 §2.2: entity may access associated storage of the sender.
        if (slots && slots.length > 0) {
          return slots.every((slot) =>
            this.isAssociatedSlot(slot, sender) ||
            this.isAssociatedSlot(slot, paymaster ?? from)
          )
        }
        return false

      default:
        // Unknown entities can only access own storage
        return storageAddress === from
    }
  }

  /**
   * Check if a storage slot is "associated" with the given address.
   * Per ERC-7562, an associated slot is keccak256(address || X) where X is a
   * mapping base slot index (0..MAX_SLOT_SCAN). This covers Solidity
   * mapping(address => ...) patterns like ERC-20 balances.
   */
  private isAssociatedSlot(slot: string, address: string): boolean {
    const normalizedSlot = slot.toLowerCase()
    const normalizedAddr = address.toLowerCase() as Address
    // Scan the first few mapping base slots (covers most ERC-20 and common contracts)
    for (let i = 0; i < MAX_ASSOCIATED_SLOT_SCAN; i++) {
      const computed = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, uint256'),
          [normalizedAddr, BigInt(i)]
        )
      )
      if (computed.toLowerCase() === normalizedSlot) {
        return true
      }
    }
    return false
  }
}

/**
 * Number of base mapping slots to scan for associated storage validation.
 * Most common contracts (ERC-20) use slots 0-10 for their mappings.
 */
const MAX_ASSOCIATED_SLOT_SCAN = 20
