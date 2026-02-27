import type { Address, Hex } from 'viem'
import { isAddress, isHex } from 'viem'
import { z } from 'zod'
import type { UserOperation } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { IFormatValidator } from './types'
import { VALIDATION_CONSTANTS } from './types'

/**
 * Zod schema for validating address format
 */
const addressSchema = z
  .string()
  .refine((val): val is Address => isAddress(val), { message: 'Invalid address format' })

/**
 * Zod schema for validating hex format
 */
const hexSchema = z
  .string()
  .refine((val): val is Hex => isHex(val), { message: 'Invalid hex format' })

/**
 * Zod schema for validating optional address
 */
const optionalAddressSchema = z
  .string()
  .optional()
  .refine((val): val is Address | undefined => val === undefined || isAddress(val), {
    message: 'Invalid address format',
  })

/**
 * Zod schema for validating optional hex
 */
const optionalHexSchema = z
  .string()
  .optional()
  .refine((val): val is Hex | undefined => val === undefined || isHex(val), {
    message: 'Invalid hex format',
  })

/**
 * Zod schema for UserOperation validation with bounds checking
 */
export const userOperationSchema = z.object({
  sender: addressSchema,
  nonce: z.bigint().nonnegative({
    message: 'nonce must be non-negative',
  }),
  factory: optionalAddressSchema,
  factoryData: optionalHexSchema.refine(
    (val) => val === undefined || val.length <= VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH,
    {
      message: `factoryData exceeds maximum length of ${VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH} characters (${(VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH - 2) / 2} bytes)`,
    }
  ),
  callData: hexSchema.refine((val) => val.length <= VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH, {
    message: `callData exceeds maximum length of ${VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH} characters (${(VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH - 2) / 2} bytes)`,
  }),
  callGasLimit: z.bigint().min(VALIDATION_CONSTANTS.MIN_CALL_GAS_LIMIT, {
    message: `callGasLimit must be at least ${VALIDATION_CONSTANTS.MIN_CALL_GAS_LIMIT}`,
  }),
  verificationGasLimit: z.bigint().min(VALIDATION_CONSTANTS.MIN_VERIFICATION_GAS_LIMIT, {
    message: `verificationGasLimit must be at least ${VALIDATION_CONSTANTS.MIN_VERIFICATION_GAS_LIMIT}`,
  }),
  preVerificationGas: z.bigint().min(VALIDATION_CONSTANTS.MIN_PRE_VERIFICATION_GAS, {
    message: `preVerificationGas must be at least ${VALIDATION_CONSTANTS.MIN_PRE_VERIFICATION_GAS}`,
  }),
  maxFeePerGas: z.bigint().positive({
    message: 'maxFeePerGas must be positive',
  }),
  maxPriorityFeePerGas: z.bigint().nonnegative({
    message: 'maxPriorityFeePerGas must be non-negative',
  }),
  paymaster: optionalAddressSchema,
  paymasterVerificationGasLimit: z.bigint().optional(),
  paymasterPostOpGasLimit: z.bigint().optional(),
  paymasterData: optionalHexSchema.refine(
    (val) => val === undefined || val.length <= VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH,
    {
      message: `paymasterData exceeds maximum length of ${VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH} characters (${(VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH - 2) / 2} bytes)`,
    }
  ),
  signature: hexSchema
    .refine((val) => val.length >= VALIDATION_CONSTANTS.MIN_SIGNATURE_LENGTH, {
      message: `signature must be at least ${VALIDATION_CONSTANTS.MIN_SIGNATURE_LENGTH} characters (65 bytes)`,
    })
    .refine((val) => val.length <= VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH, {
      message: `signature exceeds maximum length of ${VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH} characters (${(VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH - 2) / 2} bytes)`,
    }),
})

/**
 * Configuration for per-entity calldata length limits
 */
export interface FormatValidatorConfig {
  /** Max callData length in hex chars (default: VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH) */
  maxCalldataLength?: number
  /** Max factoryData length in hex chars (default: VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH) */
  maxFactoryDataLength?: number
  /** Max paymasterData length in hex chars (default: VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH) */
  maxPaymasterDataLength?: number
}

/**
 * Format validator for UserOperations
 * Performs fast, static validation without RPC calls
 */
export class FormatValidator implements IFormatValidator {
  private readonly limits: Required<FormatValidatorConfig>

  constructor(config: FormatValidatorConfig = {}) {
    this.limits = {
      maxCalldataLength: config.maxCalldataLength ?? VALIDATION_CONSTANTS.MAX_CALLDATA_LENGTH,
      maxFactoryDataLength:
        config.maxFactoryDataLength ?? VALIDATION_CONSTANTS.MAX_FACTORY_DATA_LENGTH,
      maxPaymasterDataLength:
        config.maxPaymasterDataLength ?? VALIDATION_CONSTANTS.MAX_PAYMASTER_DATA_LENGTH,
    }
  }

  /**
   * Validate a UserOperation format
   * @throws RpcError if validation fails
   */
  validate(userOp: UserOperation): void {
    // 1. Data length bounds check (early rejection for oversized data)
    this.validateDataLengths(userOp)

    // 2. Schema validation
    this.validateSchema(userOp)

    // 3. Gas relationship check
    this.validateGasRelationships(userOp)

    // 4. Factory/factoryData consistency
    this.validateFactoryConsistency(userOp)

    // 5. Paymaster field consistency
    this.validatePaymasterConsistency(userOp)

    // 6. Gas limits sanity check
    this.validateGasLimits(userOp)
  }

  /**
   * Validate data field lengths to prevent oversized UserOperations
   * This is a security measure against DoS attacks with large payloads
   */
  private validateDataLengths(userOp: UserOperation): void {
    // Check callData length (uses configurable limit)
    if (userOp.callData && userOp.callData.length > this.limits.maxCalldataLength) {
      throw new RpcError(
        `callData too large: ${userOp.callData.length} chars (max: ${this.limits.maxCalldataLength}, ${(this.limits.maxCalldataLength - 2) / 2} bytes)`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Check factoryData length (uses configurable limit)
    if (userOp.factoryData && userOp.factoryData.length > this.limits.maxFactoryDataLength) {
      throw new RpcError(
        `factoryData too large: ${userOp.factoryData.length} chars (max: ${this.limits.maxFactoryDataLength}, ${(this.limits.maxFactoryDataLength - 2) / 2} bytes)`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Check paymasterData length (uses configurable limit)
    if (userOp.paymasterData && userOp.paymasterData.length > this.limits.maxPaymasterDataLength) {
      throw new RpcError(
        `paymasterData too large: ${userOp.paymasterData.length} chars (max: ${this.limits.maxPaymasterDataLength}, ${(this.limits.maxPaymasterDataLength - 2) / 2} bytes)`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Check signature length (min and max)
    if (userOp.signature) {
      if (userOp.signature.length < VALIDATION_CONSTANTS.MIN_SIGNATURE_LENGTH) {
        throw new RpcError(
          `signature too short: ${userOp.signature.length} chars (min: ${VALIDATION_CONSTANTS.MIN_SIGNATURE_LENGTH}, 65 bytes)`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
      if (userOp.signature.length > VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH) {
        throw new RpcError(
          `signature too large: ${userOp.signature.length} chars (max: ${VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH}, ${(VALIDATION_CONSTANTS.MAX_SIGNATURE_LENGTH - 2) / 2} bytes)`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    }
  }

  /**
   * Validate UserOperation against Zod schema
   */
  private validateSchema(userOp: UserOperation): void {
    const result = userOperationSchema.safeParse(userOp)

    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')

      throw new RpcError(`Invalid UserOperation format: ${errors}`, RPC_ERROR_CODES.INVALID_PARAMS)
    }
  }

  /**
   * Validate gas fee relationships and minimum gas price policy (EIP-4337 Section 7.1)
   */
  private validateGasRelationships(userOp: UserOperation): void {
    // maxPriorityFeePerGas cannot exceed maxFeePerGas
    if (userOp.maxPriorityFeePerGas > userOp.maxFeePerGas) {
      throw new RpcError(
        `maxPriorityFeePerGas (${userOp.maxPriorityFeePerGas}) cannot exceed maxFeePerGas (${userOp.maxFeePerGas})`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Configurable minimum maxFeePerGas (EIP-4337 Section 7.1)
    if (VALIDATION_CONSTANTS.MIN_MAX_FEE_PER_GAS > 0n) {
      if (userOp.maxFeePerGas < VALIDATION_CONSTANTS.MIN_MAX_FEE_PER_GAS) {
        throw new RpcError(
          `maxFeePerGas (${userOp.maxFeePerGas}) below minimum (${VALIDATION_CONSTANTS.MIN_MAX_FEE_PER_GAS})`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    }

    // Configurable minimum maxPriorityFeePerGas
    if (VALIDATION_CONSTANTS.MIN_MAX_PRIORITY_FEE_PER_GAS > 0n) {
      if (userOp.maxPriorityFeePerGas < VALIDATION_CONSTANTS.MIN_MAX_PRIORITY_FEE_PER_GAS) {
        throw new RpcError(
          `maxPriorityFeePerGas (${userOp.maxPriorityFeePerGas}) below minimum (${VALIDATION_CONSTANTS.MIN_MAX_PRIORITY_FEE_PER_GAS})`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    }
  }

  /**
   * Validate factory and factoryData consistency
   */
  private validateFactoryConsistency(userOp: UserOperation): void {
    const hasFactory = userOp.factory !== undefined && userOp.factory !== '0x'
    const hasFactoryData = userOp.factoryData !== undefined && userOp.factoryData !== '0x'

    // If factory is specified, factoryData must also be specified
    if (hasFactory && !hasFactoryData) {
      throw new RpcError('factory specified without factoryData', RPC_ERROR_CODES.INVALID_PARAMS)
    }

    // If factoryData is specified, factory must also be specified
    if (hasFactoryData && !hasFactory) {
      throw new RpcError('factoryData specified without factory', RPC_ERROR_CODES.INVALID_PARAMS)
    }
  }

  /**
   * Validate paymaster field consistency
   */
  private validatePaymasterConsistency(userOp: UserOperation): void {
    const hasPaymaster = userOp.paymaster !== undefined && userOp.paymaster !== '0x'
    const hasPaymasterVerificationGas = userOp.paymasterVerificationGasLimit !== undefined
    const hasPaymasterPostOpGas = userOp.paymasterPostOpGasLimit !== undefined

    if (hasPaymaster) {
      // If paymaster is specified, verification gas limit must be specified
      if (!hasPaymasterVerificationGas) {
        throw new RpcError(
          'paymaster specified without paymasterVerificationGasLimit',
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }

      // If paymaster is specified, post-op gas limit must be specified
      if (!hasPaymasterPostOpGas) {
        throw new RpcError(
          'paymaster specified without paymasterPostOpGasLimit',
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }

      // Validate paymaster gas limits
      if (userOp.paymasterVerificationGasLimit! < VALIDATION_CONSTANTS.MIN_VERIFICATION_GAS_LIMIT) {
        throw new RpcError(
          `paymasterVerificationGasLimit must be at least ${VALIDATION_CONSTANTS.MIN_VERIFICATION_GAS_LIMIT}`,
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    } else {
      // If no paymaster, these fields should not be set
      if (hasPaymasterVerificationGas || hasPaymasterPostOpGas) {
        throw new RpcError(
          'paymaster gas limits specified without paymaster',
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }

      // paymasterData should not be set without paymaster
      if (userOp.paymasterData !== undefined && userOp.paymasterData !== '0x') {
        throw new RpcError(
          'paymasterData specified without paymaster',
          RPC_ERROR_CODES.INVALID_PARAMS
        )
      }
    }
  }

  /**
   * Validate gas limits per EIP-4337 Section 7.1:
   * - Each entity's verificationGasLimit must be < MAX_VERIFICATION_GAS (500,000)
   * - Total gas for the operation must be < MAX_BUNDLE_GAS
   */
  private validateGasLimits(userOp: UserOperation): void {
    // Per-entity verification gas checks (EIP-4337 Section 7.1)
    if (userOp.verificationGasLimit > VALIDATION_CONSTANTS.MAX_VERIFICATION_GAS) {
      throw new RpcError(
        `verificationGasLimit (${userOp.verificationGasLimit}) exceeds maximum (${VALIDATION_CONSTANTS.MAX_VERIFICATION_GAS})`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    if (userOp.paymasterVerificationGasLimit && userOp.paymasterVerificationGasLimit > VALIDATION_CONSTANTS.MAX_VERIFICATION_GAS) {
      throw new RpcError(
        `paymasterVerificationGasLimit (${userOp.paymasterVerificationGasLimit}) exceeds maximum (${VALIDATION_CONSTANTS.MAX_VERIFICATION_GAS})`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }

    // Calculate total verification gas for bundle gas check
    let totalVerificationGas = userOp.verificationGasLimit

    if (userOp.paymasterVerificationGasLimit) {
      totalVerificationGas += userOp.paymasterVerificationGasLimit
    }
    if (userOp.paymasterPostOpGasLimit) {
      totalVerificationGas += userOp.paymasterPostOpGasLimit
    }

    // Calculate total gas for the operation
    const totalGas = userOp.preVerificationGas + totalVerificationGas + userOp.callGasLimit

    // Check total gas is within bounds
    if (totalGas > VALIDATION_CONSTANTS.MAX_BUNDLE_GAS) {
      throw new RpcError(
        `total gas (${totalGas}) exceeds maximum bundle gas (${VALIDATION_CONSTANTS.MAX_BUNDLE_GAS})`,
        RPC_ERROR_CODES.INVALID_PARAMS
      )
    }
  }

  /**
   * Quick check if signature looks valid (length only, not cryptographic)
   */
  validateSignatureFormat(signature: Hex): boolean {
    // Minimum 65 bytes (r: 32, s: 32, v: 1)
    // As hex string: 0x + 130 characters = 132 total
    return signature.length >= VALIDATION_CONSTANTS.MIN_SIGNATURE_LENGTH
  }

  /**
   * Quick check if address is valid
   */
  validateAddressFormat(address: string): address is Address {
    return isAddress(address)
  }

  /**
   * Quick check if hex is valid
   */
  validateHexFormat(hex: string): hex is Hex {
    return isHex(hex)
  }
}
