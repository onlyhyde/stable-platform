/**
 * EIP-4337 Account Abstraction Error Framework
 *
 * Provides structured error handling for AA error codes returned by bundlers
 * and EntryPoint contracts. Maps cryptic AA error codes to human-readable
 * messages with actionable recovery suggestions.
 *
 * Error code ranges (EIP-4337):
 * - AA1x: Account validation errors (sender/initCode issues)
 * - AA2x: Account execution errors (deployment, payment, signature)
 * - AA3x: Paymaster validation errors
 * - AA4x: Paymaster execution errors (gas overuse)
 * - AA5x: Stake/deposit errors (factory/paymaster staking)
 */

import { AA_ERROR_CODES, type AAErrorCode } from '../rpc'

/**
 * Severity level for AA errors
 */
export type AAErrorSeverity = 'fatal' | 'recoverable' | 'transient'

/**
 * Human-readable AA error metadata
 */
export interface AAErrorInfo {
  /** The raw AA error code (e.g., 'AA21') */
  code: AAErrorCode
  /** Error category */
  category: 'account_validation' | 'account_execution' | 'paymaster_validation' | 'paymaster_execution' | 'stake'
  /** One-line human-readable summary */
  message: string
  /** Detailed explanation of what went wrong */
  description: string
  /** Actionable recovery suggestions */
  suggestions: string[]
  /** Whether this error is fatal, recoverable, or transient */
  severity: AAErrorSeverity
}

/**
 * Mapping of AA error codes to human-readable error info
 */
const AA_ERROR_MAP: Record<AAErrorCode, AAErrorInfo> = {
  // AA1x: Account validation
  [AA_ERROR_CODES.AA10_SENDER_ALREADY_CONSTRUCTED]: {
    code: 'AA10',
    category: 'account_validation',
    message: 'Account already deployed',
    description: 'The initCode was provided but the sender account already has code deployed.',
    suggestions: ['Remove factory and factoryData from the UserOperation since the account is already deployed.'],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA13_INIT_CODE_FAILED]: {
    code: 'AA13',
    category: 'account_validation',
    message: 'Account deployment failed',
    description: 'The initCode execution reverted during account creation.',
    suggestions: [
      'Verify the factory address is correct and deployed.',
      'Check that factoryData is properly encoded.',
      'Ensure the factory has sufficient gas to deploy the account.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA14_INIT_CODE_LENGTH]: {
    code: 'AA14',
    category: 'account_validation',
    message: 'Invalid initCode length',
    description: 'The initCode is too short (must be at least 20 bytes for factory address).',
    suggestions: ['Ensure initCode contains factory address (20 bytes) followed by factory call data.'],
    severity: 'fatal',
  },
  [AA_ERROR_CODES.AA15_INIT_CODE_CREATE_ADDR]: {
    code: 'AA15',
    category: 'account_validation',
    message: 'Factory created wrong address',
    description: 'The factory created an account at a different address than expected (sender).',
    suggestions: [
      'Verify the counterfactual address calculation matches the factory output.',
      'Check that the salt and initialization data are consistent.',
    ],
    severity: 'fatal',
  },

  // AA2x: Account execution
  [AA_ERROR_CODES.AA20_ACCOUNT_NOT_DEPLOYED]: {
    code: 'AA20',
    category: 'account_execution',
    message: 'Account not deployed',
    description: 'The sender account has no code and no initCode was provided.',
    suggestions: ['Include factory and factoryData to deploy the account with the first UserOperation.'],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA21_DIDNT_PAY_PREFUND]: {
    code: 'AA21',
    category: 'account_execution',
    message: 'Insufficient prefund',
    description: 'The account did not pay the required prefund to the EntryPoint.',
    suggestions: [
      'Deposit ETH to the account or to EntryPoint via depositTo().',
      'Use a paymaster to sponsor gas fees.',
      'Reduce gas limits to lower the required prefund.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA22_EXPIRED_OR_NOT_DUE]: {
    code: 'AA22',
    category: 'account_execution',
    message: 'Operation expired or not yet valid',
    description: 'The UserOperation time range (validAfter/validUntil) is invalid.',
    suggestions: [
      'Check that validUntil is in the future.',
      'Check that validAfter is in the past.',
      'Account for clock skew between client and blockchain.',
    ],
    severity: 'transient',
  },
  [AA_ERROR_CODES.AA23_REVERTED]: {
    code: 'AA23',
    category: 'account_execution',
    message: 'Account validation reverted',
    description: 'The account\'s validateUserOp function reverted.',
    suggestions: [
      'Check that the signature is valid for this account.',
      'Verify the account\'s validation logic accepts this operation.',
      'Ensure the validator module is correctly installed.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA24_SIGNATURE_ERROR]: {
    code: 'AA24',
    category: 'account_execution',
    message: 'Invalid signature',
    description: 'The account signature check failed (returned SIG_VALIDATION_FAILED).',
    suggestions: [
      'Re-sign the UserOperation with the correct private key.',
      'Verify the userOpHash computation matches the EntryPoint version.',
      'Check that the signature format matches the validator\'s expectations.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA25_INVALID_NONCE]: {
    code: 'AA25',
    category: 'account_execution',
    message: 'Invalid nonce',
    description: 'The nonce does not match the expected value in the EntryPoint.',
    suggestions: [
      'Fetch the current nonce from EntryPoint.getNonce(sender, key).',
      'If using parallel nonces, ensure the nonce key is correct.',
      'A previous operation with this nonce may have already been included.',
    ],
    severity: 'transient',
  },
  [AA_ERROR_CODES.AA26_OVER_VERIFICATION_GAS]: {
    code: 'AA26',
    category: 'account_execution',
    message: 'Verification gas limit exceeded',
    description: 'The account used more gas during validateUserOp than the verificationGasLimit.',
    suggestions: [
      'Increase verificationGasLimit in the UserOperation.',
      'Simplify the account validation logic if possible.',
    ],
    severity: 'recoverable',
  },

  // AA3x: Paymaster validation
  [AA_ERROR_CODES.AA30_PAYMASTER_NOT_DEPLOYED]: {
    code: 'AA30',
    category: 'paymaster_validation',
    message: 'Paymaster not deployed',
    description: 'The specified paymaster address has no code on-chain.',
    suggestions: [
      'Verify the paymaster address is correct.',
      'Ensure the paymaster contract is deployed on this chain.',
    ],
    severity: 'fatal',
  },
  [AA_ERROR_CODES.AA31_PAYMASTER_DEPOSIT_LOW]: {
    code: 'AA31',
    category: 'paymaster_validation',
    message: 'Paymaster deposit too low',
    description: 'The paymaster does not have sufficient deposit in the EntryPoint to cover gas.',
    suggestions: [
      'Contact the paymaster operator to top up the deposit.',
      'Try a different paymaster or pay gas directly from the account.',
    ],
    severity: 'transient',
  },
  [AA_ERROR_CODES.AA32_PAYMASTER_EXPIRED]: {
    code: 'AA32',
    category: 'paymaster_validation',
    message: 'Paymaster signature expired',
    description: 'The paymaster validation time range has expired.',
    suggestions: [
      'Request fresh paymaster data from the paymaster service.',
      'The pm_getPaymasterData response may have expired; re-fetch it.',
    ],
    severity: 'transient',
  },
  [AA_ERROR_CODES.AA33_REVERTED]: {
    code: 'AA33',
    category: 'paymaster_validation',
    message: 'Paymaster validation reverted',
    description: 'The paymaster\'s validatePaymasterUserOp function reverted.',
    suggestions: [
      'The paymaster may have rejected this operation (policy violation).',
      'Verify the paymasterData is correctly formatted.',
      'Check paymaster-specific requirements (token approval, policy compliance).',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA34_SIGNATURE_ERROR]: {
    code: 'AA34',
    category: 'paymaster_validation',
    message: 'Paymaster signature invalid',
    description: 'The paymaster returned SIG_VALIDATION_FAILED.',
    suggestions: [
      'Request new paymaster data with a fresh signature.',
      'Ensure the UserOperation fields haven\'t changed after paymaster signing.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA36_OVER_PAYMASTER_VERIFICATION_GAS]: {
    code: 'AA36',
    category: 'paymaster_validation',
    message: 'Paymaster verification gas exceeded',
    description: 'The paymaster used more gas during validatePaymasterUserOp than the paymasterVerificationGasLimit.',
    suggestions: [
      'Increase paymasterVerificationGasLimit in the UserOperation.',
      'The paymaster may need optimization for complex validation logic.',
    ],
    severity: 'recoverable',
  },

  // AA4x: Paymaster execution
  [AA_ERROR_CODES.AA40_OVER_VERIFICATION_GAS]: {
    code: 'AA40',
    category: 'paymaster_execution',
    message: 'Verification gas exceeded',
    description: 'The operation used more gas during verification than the allowed limit.',
    suggestions: [
      'Increase verificationGasLimit or paymasterVerificationGasLimit.',
      'Simplify the validation logic if possible.',
    ],
    severity: 'recoverable',
  },
  [AA_ERROR_CODES.AA41_TOO_LITTLE_GAS]: {
    code: 'AA41',
    category: 'paymaster_execution',
    message: 'Insufficient gas for postOp',
    description: 'Not enough gas remained for the paymaster\'s postOp callback.',
    suggestions: [
      'Increase paymasterPostOpGasLimit.',
      'Reduce callGasLimit if the main execution is over-estimated.',
    ],
    severity: 'recoverable',
  },

  // AA5x: Stake/deposit
  [AA_ERROR_CODES.AA50_FACTORY_NOT_STAKED]: {
    code: 'AA50',
    category: 'stake',
    message: 'Factory not staked',
    description: 'The factory does not have sufficient stake in the EntryPoint.',
    suggestions: [
      'The factory operator needs to call EntryPoint.addStake().',
      'This is a configuration issue on the factory side.',
    ],
    severity: 'fatal',
  },
  [AA_ERROR_CODES.AA51_FACTORY_NOT_DEPLOYED]: {
    code: 'AA51',
    category: 'stake',
    message: 'Factory not deployed',
    description: 'The specified factory address has no code on-chain.',
    suggestions: [
      'Verify the factory address is correct for this chain.',
      'Ensure the factory contract is deployed.',
    ],
    severity: 'fatal',
  },
}

/**
 * Custom error class for EIP-4337 Account Abstraction errors.
 * Wraps bundler/EntryPoint errors with human-readable context.
 */
export class AAError extends Error {
  /** Structured error information */
  readonly info: AAErrorInfo
  /** Original error message from the bundler/EntryPoint */
  readonly originalMessage: string
  /** Extracted revert reason (if available) */
  readonly revertReason?: string

  constructor(info: AAErrorInfo, originalMessage: string, revertReason?: string) {
    super(`[${info.code}] ${info.message}: ${originalMessage}`)
    this.name = 'AAError'
    this.info = info
    this.originalMessage = originalMessage
    this.revertReason = revertReason
  }

  /** Whether this error can be recovered from by retrying or adjusting parameters */
  get isRecoverable(): boolean {
    return this.info.severity === 'recoverable' || this.info.severity === 'transient'
  }

  /** Whether this is a temporary condition that may resolve on its own */
  get isTransient(): boolean {
    return this.info.severity === 'transient'
  }
}

/**
 * Extract AA error code from an error message string.
 * Bundlers return error messages containing codes like "AA21 didn't pay prefund".
 *
 * @returns The matched AAErrorCode or undefined if no AA code found
 */
export function extractAAErrorCode(message: string): AAErrorCode | undefined {
  // Match AA followed by 2 digits at word boundary
  const match = message.match(/\bAA(\d{2})\b/)
  if (!match) return undefined

  const code = `AA${match[1]}` as string
  // Check if this is a known code
  const knownCodes = Object.values(AA_ERROR_CODES) as string[]
  if (knownCodes.includes(code)) {
    return code as AAErrorCode
  }
  return undefined
}

/**
 * Extract revert reason from an error message.
 * Bundler errors often embed the revert reason in the message.
 */
export function extractRevertReason(message: string): string | undefined {
  // Common patterns: "reverted with reason: ...", "revert: ...", "reason: ..."
  const patterns = [
    /reverted with reason:?\s*"?([^"]+)"?/i,
    /revert:?\s*"?([^"]+)"?/i,
    /reason:?\s*"?([^"]+)"?/i,
    /execution reverted:?\s*"?([^"]+)"?/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }
  return undefined
}

/**
 * Get structured error info for an AA error code.
 */
export function getAAErrorInfo(code: AAErrorCode): AAErrorInfo {
  return AA_ERROR_MAP[code]
}

/**
 * Parse a bundler/EntryPoint error into a structured AAError.
 * If the error contains a recognized AA code, returns an AAError with full context.
 * Otherwise returns undefined (not an AA error).
 *
 * @example
 * ```typescript
 * try {
 *   await bundler.sendUserOperation(userOp)
 * } catch (err) {
 *   const aaError = parseAAError(err)
 *   if (aaError) {
 *     console.log(aaError.info.suggestions) // actionable recovery steps
 *   }
 * }
 * ```
 */
export function parseAAError(error: unknown): AAError | undefined {
  const message = error instanceof Error ? error.message : String(error)

  const code = extractAAErrorCode(message)
  if (!code) return undefined

  const info = getAAErrorInfo(code)
  const revertReason = extractRevertReason(message)

  return new AAError(info, message, revertReason)
}
