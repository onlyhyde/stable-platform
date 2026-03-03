import type { Address, Hex } from 'viem'
import { encodeAbiParameters, encodeFunctionData, keccak256, parseAbiParameters } from 'viem'

// ============================================================================
// Types
// ============================================================================

/**
 * Fallback validation result
 */
export interface FallbackValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Token receiver capability
 *
 * NOTE: ERC-721 and ERC-1155 are handled by Kernel's built-in pure functions
 * and cannot be overridden via fallback modules. Only ERC-777 (tokensReceived)
 * reaches the fallback path. supportsERC721/supportsERC1155 are retained for
 * informational/query purposes but have no effect on fallback handler registration.
 */
export interface TokenReceiverCapability {
  /**
   * @deprecated Kernel handles ERC-721 natively via built-in pure function.
   * This flag has no effect on fallback handler registration.
   */
  supportsERC721: boolean

  /**
   * @deprecated Kernel handles ERC-1155 natively via built-in pure function.
   * This flag has no effect on fallback handler registration.
   */
  supportsERC1155: boolean

  /** Supports ERC777 (Advanced tokens) — routed through fallback module */
  supportsERC777: boolean

  /** Supports ETH receive */
  supportsETH: boolean
}

/**
 * Flash loan callback configuration
 */
export interface FlashLoanCallbackConfig {
  /** Allowed flash loan providers */
  allowedProviders: Address[]

  /** Maximum flash loan amount (0 for unlimited) */
  maxLoanAmount: bigint

  /** Allowed callback executors */
  allowedExecutors: Address[]
}

/**
 * Fallback handler registration
 */
export interface FallbackHandlerRegistration {
  /** Function selector (4 bytes) */
  selector: Hex

  /** Handler address */
  handler: Address

  /** Handler type (static call, delegate call, call) */
  callType: 'static' | 'delegate' | 'call'
}

// ============================================================================
// Constants
// ============================================================================

/** Address validation regex */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Zero address */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

/** Standard interface selectors */
export const INTERFACE_SELECTORS = {
  /** ERC721 onERC721Received */
  ERC721_RECEIVED: '0x150b7a02' as Hex,

  /** ERC1155 onERC1155Received */
  ERC1155_RECEIVED: '0xf23a6e61' as Hex,

  /** ERC1155 onERC1155BatchReceived */
  ERC1155_BATCH_RECEIVED: '0xbc197c81' as Hex,

  /** ERC777 tokensReceived */
  ERC777_RECEIVED: '0x0023de29' as Hex,

  /** ERC165 supportsInterface */
  SUPPORTS_INTERFACE: '0x01ffc9a7' as Hex,
} as const

/** Standard interface IDs for ERC165 */
export const INTERFACE_IDS = {
  /** ERC165 */
  ERC165: '0x01ffc9a7' as Hex,

  /** ERC721 Token Receiver */
  ERC721_RECEIVER: '0x150b7a02' as Hex,

  /** ERC1155 Token Receiver */
  ERC1155_RECEIVER: '0x4e2312e0' as Hex,

  /** ERC777 Token Recipient */
  ERC777_RECIPIENT: '0xb0202a11' as Hex,
} as const

// ============================================================================
// Token Receiver Fallback Utils
// ============================================================================

/**
 * Encode Token Receiver fallback initialization data
 *
 * Token Receiver fallback requires no initialization data
 * but we encode supported interfaces for clarity
 *
 * @example
 * ```typescript
 * const initData = encodeTokenReceiverInit({
 *   supportsERC721: true,
 *   supportsERC1155: true,
 *   supportsERC777: false,
 *   supportsETH: true,
 * })
 * ```
 */
export function encodeTokenReceiverInit(config: TokenReceiverCapability): Hex {
  // Encode as flags bitmap
  let flags = 0
  if (config.supportsERC721) flags |= 1
  if (config.supportsERC1155) flags |= 2
  if (config.supportsERC777) flags |= 4
  if (config.supportsETH) flags |= 8

  return encodeAbiParameters(parseAbiParameters('uint8 flags'), [flags])
}

/**
 * Decode Token Receiver flags
 */
export function decodeTokenReceiverFlags(flags: number): TokenReceiverCapability {
  return {
    supportsERC721: (flags & 1) !== 0,
    supportsERC1155: (flags & 2) !== 0,
    supportsERC777: (flags & 4) !== 0,
    supportsETH: (flags & 8) !== 0,
  }
}

/**
 * Validate Token Receiver configuration
 */
export function validateTokenReceiverConfig(
  config: TokenReceiverCapability
): FallbackValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // At least one capability should be enabled
  if (
    !config.supportsERC721 &&
    !config.supportsERC1155 &&
    !config.supportsERC777 &&
    !config.supportsETH
  ) {
    errors.push('At least one token standard must be supported')
  }

  // Warnings
  if (config.supportsERC777) {
    warnings.push('ERC777 support may introduce reentrancy risks - ensure proper guards')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Get required fallback handlers for token receiver
 */
export function getTokenReceiverHandlers(
  config: TokenReceiverCapability,
  handlerAddress: Address
): FallbackHandlerRegistration[] {
  const handlers: FallbackHandlerRegistration[] = []

  // NOTE: ERC-721 and ERC-1155 handlers are NOT registered because Kernel
  // declares onERC721Received/onERC1155Received/onERC1155BatchReceived as
  // explicit pure functions. Solidity dispatches these before fallback(),
  // so registering handlers for these selectors has no effect.

  if (config.supportsERC777) {
    handlers.push({
      selector: INTERFACE_SELECTORS.ERC777_RECEIVED,
      handler: handlerAddress,
      callType: 'call', // ERC777 may need state changes
    })
  }

  return handlers
}

/**
 * Encode ERC721 onERC721Received return value
 */
export function encodeERC721ReceivedReturn(): Hex {
  return INTERFACE_SELECTORS.ERC721_RECEIVED
}

/**
 * Encode ERC1155 onERC1155Received return value
 */
export function encodeERC1155ReceivedReturn(): Hex {
  return INTERFACE_SELECTORS.ERC1155_RECEIVED
}

/**
 * Encode ERC1155 onERC1155BatchReceived return value
 */
export function encodeERC1155BatchReceivedReturn(): Hex {
  return INTERFACE_SELECTORS.ERC1155_BATCH_RECEIVED
}

// ============================================================================
// Flash Loan Fallback Utils
// ============================================================================

/**
 * Encode Flash Loan fallback initialization data
 *
 * @example
 * ```typescript
 * const initData = encodeFlashLoanInit({
 *   allowedProviders: [AAVE_POOL_ADDRESS, UNISWAP_V3_FACTORY],
 *   maxLoanAmount: parseEther('1000'),
 *   allowedExecutors: [ARBITRAGE_CONTRACT],
 * })
 * ```
 */
export function encodeFlashLoanInit(config: FlashLoanCallbackConfig): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address[] allowedProviders, uint256 maxLoanAmount, address[] allowedExecutors'
    ),
    [config.allowedProviders, config.maxLoanAmount, config.allowedExecutors]
  )
}

/**
 * Validate Flash Loan configuration
 */
export function validateFlashLoanConfig(config: FlashLoanCallbackConfig): FallbackValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate providers
  if (!config.allowedProviders || config.allowedProviders.length === 0) {
    errors.push('At least one flash loan provider is required')
  } else {
    config.allowedProviders.forEach((provider, index) => {
      if (!ADDRESS_REGEX.test(provider)) {
        errors.push(`Provider ${index + 1} must be a valid address`)
      }
      if (provider === ZERO_ADDRESS) {
        errors.push(`Provider ${index + 1} cannot be zero address`)
      }
    })
  }

  // Validate executors
  if (!config.allowedExecutors || config.allowedExecutors.length === 0) {
    errors.push('At least one executor is required')
  } else {
    config.allowedExecutors.forEach((executor, index) => {
      if (!ADDRESS_REGEX.test(executor)) {
        errors.push(`Executor ${index + 1} must be a valid address`)
      }
    })
  }

  // Warnings
  if (config.maxLoanAmount === 0n) {
    warnings.push('Unlimited loan amount - consider setting a maximum for safety')
  }

  if (config.maxLoanAmount > 10n ** 24n) {
    warnings.push('Very high max loan amount (>1M ETH equivalent) - verify this is intentional')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Check if a flash loan callback is authorized
 */
export function isFlashLoanAuthorized(
  config: FlashLoanCallbackConfig,
  provider: Address,
  executor: Address,
  amount: bigint
): { authorized: boolean; reason?: string } {
  // Check provider
  const providerAllowed = config.allowedProviders.some(
    (allowed) => allowed.toLowerCase() === provider.toLowerCase()
  )

  if (!providerAllowed) {
    return {
      authorized: false,
      reason: `Provider ${provider} is not in allowed list`,
    }
  }

  // Check executor
  const executorAllowed = config.allowedExecutors.some(
    (allowed) => allowed.toLowerCase() === executor.toLowerCase()
  )

  if (!executorAllowed) {
    return {
      authorized: false,
      reason: `Executor ${executor} is not in allowed list`,
    }
  }

  // Check amount
  if (config.maxLoanAmount > 0n && amount > config.maxLoanAmount) {
    return {
      authorized: false,
      reason: `Loan amount ${amount} exceeds maximum ${config.maxLoanAmount}`,
    }
  }

  return { authorized: true }
}

// ============================================================================
// Generic Fallback Utils
// ============================================================================

/**
 * Encode fallback handler registration
 */
export function encodeFallbackHandlerRegistration(registration: FallbackHandlerRegistration): Hex {
  const callTypeValue =
    registration.callType === 'static' ? 0 : registration.callType === 'delegate' ? 1 : 2

  return encodeAbiParameters(
    parseAbiParameters('bytes4 selector, address handler, uint8 callType'),
    [registration.selector as `0x${string}`, registration.handler, callTypeValue]
  )
}

/**
 * Encode multiple fallback handler registrations
 */
export function encodeBatchFallbackRegistration(registrations: FallbackHandlerRegistration[]): Hex {
  const encoded = registrations.map((r) => {
    const callTypeValue = r.callType === 'static' ? 0 : r.callType === 'delegate' ? 1 : 2
    return { selector: r.selector as `0x${string}`, handler: r.handler, callType: callTypeValue }
  })

  return encodeAbiParameters(
    parseAbiParameters('(bytes4 selector, address handler, uint8 callType)[]'),
    [encoded]
  )
}

/**
 * Calculate function selector from signature
 */
export function calculateSelector(signature: string): Hex {
  const hash = keccak256(new TextEncoder().encode(signature))
  return hash.slice(0, 10) as Hex
}

/**
 * Check if account supports an interface (ERC165)
 */
export function encodeSupportsInterfaceCall(interfaceId: Hex): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'supportsInterface',
        inputs: [{ name: 'interfaceId', type: 'bytes4' }],
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'supportsInterface',
    args: [interfaceId as `0x${string}`],
  })
}

/**
 * Get all supported interface IDs for a token receiver config
 */
export function getSupportedInterfaceIds(config: TokenReceiverCapability): Hex[] {
  const interfaces: Hex[] = [INTERFACE_IDS.ERC165]

  if (config.supportsERC721) {
    interfaces.push(INTERFACE_IDS.ERC721_RECEIVER)
  }

  if (config.supportsERC1155) {
    interfaces.push(INTERFACE_IDS.ERC1155_RECEIVER)
  }

  if (config.supportsERC777) {
    interfaces.push(INTERFACE_IDS.ERC777_RECIPIENT)
  }

  return interfaces
}

// ============================================================================
// Exports
// ============================================================================

export const fallbackUtils = {
  // Token Receiver
  encodeTokenReceiverInit,
  decodeTokenReceiverFlags,
  validateTokenReceiverConfig,
  getTokenReceiverHandlers,
  encodeERC721ReceivedReturn,
  encodeERC1155ReceivedReturn,
  encodeERC1155BatchReceivedReturn,

  // Flash Loan
  encodeFlashLoanInit,
  validateFlashLoanConfig,
  isFlashLoanAuthorized,

  // Generic
  encodeFallbackHandlerRegistration,
  encodeBatchFallbackRegistration,
  calculateSelector,
  encodeSupportsInterfaceCall,
  getSupportedInterfaceIds,

  // Constants
  INTERFACE_SELECTORS,
  INTERFACE_IDS,
}
