/**
 * Input Validator
 * Comprehensive input validation for wallet security
 */

import { getAddress, isAddress } from 'viem'

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
  normalizedValue?: unknown
}

/**
 * Hex validation options
 */
export interface HexValidationOptions {
  requirePrefix?: boolean
  exactLength?: number
  minLength?: number
  maxLength?: number
}

/**
 * String sanitization options
 */
export interface SanitizeOptions {
  maxLength?: number
  escapeHtml?: boolean
}

/**
 * Transaction object interface
 */
export interface TransactionObject {
  from?: string
  to?: string
  value?: string
  gas?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  data?: string
  nonce?: string
}

/**
 * RPC request interface
 */
export interface RpcRequestObject {
  jsonrpc?: string
  method?: unknown
  params?: unknown
  id?: unknown
}

/**
 * EIP-55 checksum address conversion using viem's keccak256-based implementation
 * Returns the checksummed address or null if invalid
 */
function toChecksumAddress(address: string): string | null {
  try {
    return getAddress(address)
  } catch {
    return null
  }
}

/**
 * Check if address has valid EIP-55 checksum using viem's strict validation
 */
function hasValidChecksum(address: string): boolean {
  // All lowercase or all uppercase is valid (no checksum to verify)
  const hexPart = address.slice(2)
  const lowerCase = hexPart.toLowerCase()
  const upperCase = hexPart.toUpperCase()

  if (hexPart === lowerCase || hexPart === upperCase) {
    return true
  }

  // For mixed case, verify checksum using viem's strict mode
  // isAddress with strict: true validates EIP-55 checksum
  return isAddress(address, { strict: true })
}

/**
 * Input Validator class
 */
export class InputValidator {
  /**
   * Validate Ethereum address
   */
  validateAddress(address: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for null/undefined
    if (!address || typeof address !== 'string') {
      return {
        isValid: false,
        errors: ['Address is required and must be a string'],
      }
    }

    // Check prefix
    if (!address.startsWith('0x')) {
      errors.push('Address must start with 0x')
    }

    // Check length
    if (address.length !== 42) {
      errors.push('Address must be 42 characters')
    }

    // Check for valid hex characters
    const hexPart = address.slice(2)
    if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
      errors.push('Address contains invalid characters')
    }

    // Validate EIP-55 checksum for mixed case addresses
    if (errors.length === 0) {
      const hexPart = address.slice(2)
      const lowerCase = hexPart.toLowerCase()
      const upperCase = hexPart.toUpperCase()
      const isMixedCase = hexPart !== lowerCase && hexPart !== upperCase

      if (!hasValidChecksum(address)) {
        // Mixed case with invalid checksum - add warning
        if (isMixedCase) {
          warnings.push('Address has mixed case but invalid EIP-55 checksum')
        }
        errors.push('Address has invalid EIP-55 checksum')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      // Return EIP-55 checksummed address as normalized value
      normalizedValue: errors.length === 0 ? toChecksumAddress(address) : undefined,
    }
  }

  /**
   * Validate hex string
   */
  validateHex(hex: string, options: HexValidationOptions = {}): ValidationResult {
    const errors: string[] = []
    const { requirePrefix = true, exactLength, minLength, maxLength } = options

    // Check for null/undefined
    if (!hex || typeof hex !== 'string') {
      return {
        isValid: false,
        errors: ['Hex string is required'],
      }
    }

    // Check prefix
    const hasPrefix = hex.startsWith('0x')
    if (requirePrefix && !hasPrefix) {
      errors.push('Hex string must start with 0x')
    }

    // Get hex content
    const hexContent = hasPrefix ? hex.slice(2) : hex
    const fullLength = hasPrefix ? hex.length : hex.length + 2

    // Check for valid hex characters
    if (!/^[0-9a-fA-F]*$/.test(hexContent)) {
      errors.push('Invalid hex characters')
    }

    // Check exact length
    if (exactLength !== undefined && fullLength !== exactLength) {
      errors.push(`Hex string must be exactly ${exactLength} characters`)
    }

    // Check minimum length
    if (minLength !== undefined && fullLength < minLength) {
      errors.push(`Hex string must be at least ${minLength} characters`)
    }

    // Check maximum length
    if (maxLength !== undefined && fullLength > maxLength) {
      errors.push(`Hex string must be at most ${maxLength} characters`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedValue:
        errors.length === 0 ? (hasPrefix ? hex : `0x${hex}`).toLowerCase() : undefined,
    }
  }

  /**
   * Validate chain ID
   */
  validateChainId(chainId: unknown): ValidationResult {
    const errors: string[] = []
    let normalizedValue: number | undefined

    // Handle string input
    if (typeof chainId === 'string') {
      // Try hex format
      if (chainId.startsWith('0x')) {
        normalizedValue = Number.parseInt(chainId, 16)
      } else {
        normalizedValue = Number.parseInt(chainId, 10)
      }
    } else if (typeof chainId === 'number') {
      normalizedValue = chainId
    } else {
      return {
        isValid: false,
        errors: ['Chain ID must be a number or string'],
      }
    }

    // Check if parsing succeeded
    if (Number.isNaN(normalizedValue)) {
      return {
        isValid: false,
        errors: ['Invalid chain ID format'],
      }
    }

    // Check if positive
    if (normalizedValue <= 0) {
      errors.push('Chain ID must be positive')
    }

    // Check if integer
    if (!Number.isInteger(normalizedValue)) {
      errors.push('Chain ID must be an integer')
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedValue: errors.length === 0 ? normalizedValue : undefined,
    }
  }

  /**
   * Validate transaction object
   */
  validateTransaction(tx: TransactionObject): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for from address (required)
    if (!tx.from) {
      errors.push('Transaction must have a from address')
    } else {
      const fromResult = this.validateAddress(tx.from)
      if (!fromResult.isValid) {
        errors.push(`Invalid from address: ${fromResult.errors.join(', ')}`)
      }
    }

    // Check to address (optional for contract deployment)
    if (tx.to) {
      const toResult = this.validateAddress(tx.to)
      if (!toResult.isValid) {
        errors.push(`Invalid to address: ${toResult.errors.join(', ')}`)
      }
    } else if (!tx.data || tx.data === '0x') {
      warnings.push('Transaction has no to address and no data - this may fail')
    }

    // Validate value if present
    if (tx.value !== undefined) {
      const valueResult = this.validateHex(tx.value)
      if (!valueResult.isValid) {
        errors.push(`Invalid value: ${valueResult.errors.join(', ')}`)
      }
    }

    // Validate gas if present
    if (tx.gas !== undefined) {
      const gasResult = this.validateHex(tx.gas)
      if (!gasResult.isValid) {
        errors.push(`Invalid gas: ${gasResult.errors.join(', ')}`)
      }
    }

    // Validate gasPrice if present
    if (tx.gasPrice !== undefined) {
      const gasPriceResult = this.validateHex(tx.gasPrice)
      if (!gasPriceResult.isValid) {
        errors.push(`Invalid gasPrice: ${gasPriceResult.errors.join(', ')}`)
      }
    }

    // Validate maxFeePerGas if present
    if (tx.maxFeePerGas !== undefined) {
      const maxFeeResult = this.validateHex(tx.maxFeePerGas)
      if (!maxFeeResult.isValid) {
        errors.push(`Invalid maxFeePerGas: ${maxFeeResult.errors.join(', ')}`)
      }
    }

    // Validate maxPriorityFeePerGas if present
    if (tx.maxPriorityFeePerGas !== undefined) {
      const maxPriorityResult = this.validateHex(tx.maxPriorityFeePerGas)
      if (!maxPriorityResult.isValid) {
        errors.push(`Invalid maxPriorityFeePerGas: ${maxPriorityResult.errors.join(', ')}`)
      }
    }

    // Validate data if present
    if (tx.data !== undefined && tx.data !== '0x') {
      const dataResult = this.validateHex(tx.data)
      if (!dataResult.isValid) {
        errors.push(`Invalid data: ${dataResult.errors.join(', ')}`)
      }
    }

    // Validate nonce if present
    if (tx.nonce !== undefined) {
      const nonceResult = this.validateHex(tx.nonce)
      if (!nonceResult.isValid) {
        errors.push(`Invalid nonce: ${nonceResult.errors.join(', ')}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Validate RPC request object
   */
  validateRpcRequest(request: RpcRequestObject): ValidationResult {
    const errors: string[] = []

    // Check for method (required)
    if (!request.method) {
      errors.push('RPC request must have a method')
    } else if (typeof request.method !== 'string') {
      errors.push('Method must be a string')
    }

    // Check params if present
    if (request.params !== undefined && !Array.isArray(request.params)) {
      errors.push('Params must be an array')
    }

    // Check id if present
    if (request.id !== undefined) {
      if (typeof request.id !== 'number' && typeof request.id !== 'string') {
        errors.push('ID must be a number or string')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string, options: SanitizeOptions = {}): string {
    const { maxLength = 10000, escapeHtml = true } = options

    if (typeof input !== 'string') {
      return ''
    }

    let result = input

    // Remove null bytes
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally removing null bytes for security
    result = result.replace(/\x00/g, '')

    // Trim whitespace
    result = result.trim()

    // Limit length
    if (result.length > maxLength) {
      result = result.slice(0, maxLength)
    }

    // Escape HTML if enabled
    if (escapeHtml) {
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }

    return result
  }
}

/**
 * Create a new InputValidator instance
 */
export function createInputValidator(): InputValidator {
  return new InputValidator()
}

// =============================================================================
// Utility Functions
// =============================================================================

const defaultValidator = new InputValidator()

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return defaultValidator.validateAddress(address).isValid
}

/**
 * Check if hex string is valid
 */
export function isValidHex(hex: string, options?: HexValidationOptions): boolean {
  return defaultValidator.validateHex(hex, options).isValid
}

/**
 * Check if chain ID is valid
 */
export function isValidChainId(chainId: unknown): boolean {
  return defaultValidator.validateChainId(chainId).isValid
}

/**
 * Check if transaction object is valid
 */
export function isValidTransactionObject(tx: TransactionObject): boolean {
  return defaultValidator.validateTransaction(tx).isValid
}

/**
 * Check if RPC request is valid
 */
export function isValidRpcRequest(request: RpcRequestObject): boolean {
  return defaultValidator.validateRpcRequest(request).isValid
}

/**
 * Sanitize string
 */
export function sanitizeString(input: string, options?: SanitizeOptions): string {
  return defaultValidator.sanitizeString(input, options)
}
