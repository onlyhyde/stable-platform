/**
 * ERC-4337 Account Abstraction error code → user-friendly message mapping.
 *
 * AA error codes are returned by EntryPoint when UserOperation validation fails.
 * Each code has a specific meaning documented in the ERC-4337 spec.
 */

export interface AAErrorInfo {
  message: string
  suggestion?: string
  action?: 'deposit' | 'change-mode' | 'refresh' | 'retry'
}

const AA_ERRORS: Record<string, AAErrorInfo> = {
  // === Sender validation errors (AA1x) ===
  AA10: {
    message: 'Sender creation failed. The account factory could not deploy your account.',
    suggestion: 'Please try again or contact support.',
    action: 'retry',
  },
  AA13: {
    message: 'Account initialization failed.',
    suggestion: 'Please try again with a fresh nonce.',
    action: 'refresh',
  },
  AA14: {
    message: 'Account initialization returned an unexpected address.',
    suggestion: 'Check your account factory configuration.',
  },

  // === Sender balance errors (AA2x) ===
  AA21: {
    message: 'Insufficient gas balance. Your EntryPoint deposit cannot cover the gas cost.',
    suggestion: 'Top up your EntryPoint deposit or switch to sponsored gas.',
    action: 'deposit',
  },
  AA22: {
    message: 'Account does not have enough native balance for required prefund.',
    suggestion: 'Add funds to your account or use a paymaster.',
    action: 'deposit',
  },
  AA23: {
    message: 'Transaction validation failed. The account rejected this operation.',
    suggestion: 'Check the transaction parameters and try again.',
    action: 'retry',
  },
  AA24: {
    message: 'Signature verification failed.',
    suggestion: 'Please try signing the transaction again.',
    action: 'retry',
  },
  AA25: {
    message: 'Transaction nonce conflict. Another transaction may be pending.',
    suggestion: 'Please refresh and try again.',
    action: 'refresh',
  },
  AA26: {
    message: 'Account signature is invalid.',
    suggestion: 'Please try signing again.',
    action: 'retry',
  },

  // === Paymaster errors (AA3x) ===
  AA30: {
    message: 'Paymaster contract not deployed on this network.',
    suggestion: 'Switch to a supported network or use self-pay.',
    action: 'change-mode',
  },
  AA31: {
    message: 'Paymaster deposit insufficient to cover gas.',
    suggestion: 'Try again later or switch to self-pay.',
    action: 'change-mode',
  },
  AA32: {
    message: 'Paymaster validity period has expired.',
    suggestion: 'Please try the transaction again for a fresh signature.',
    action: 'retry',
  },
  AA33: {
    message: 'Paymaster rejected this transaction.',
    suggestion: 'The sponsor may have reached their limit. Try a different gas payment method.',
    action: 'change-mode',
  },
  AA34: {
    message: 'Paymaster signature verification failed.',
    suggestion: 'Please retry the transaction.',
    action: 'retry',
  },
  AA36: {
    message: 'Paymaster postOp execution reverted. Token transfer may have failed.',
    suggestion: 'Ensure your token balance is sufficient and approval is set.',
    action: 'change-mode',
  },

  // === Time range errors (AA4x) ===
  AA41: {
    message: 'Transaction expired (validAfter not reached or validUntil passed).',
    suggestion: 'Please retry the transaction.',
    action: 'retry',
  },
}

/**
 * RPC error code → user-friendly message mapping.
 * These are custom error codes from the wallet extension (not AA codes).
 */
const RPC_ERRORS: Record<number, AAErrorInfo> = {
  [-32010]: {
    message: 'Token approval required for ERC-20 gas payment.',
    suggestion: 'Please approve the token for the paymaster before sending.',
    action: 'change-mode',
  },
}

/**
 * Parse an error message for AA error codes and return user-friendly info.
 *
 * AA codes appear in EntryPoint revert messages like:
 * - "AA21 didn't pay prefund"
 * - "FailedOp(0, AA33)"
 * - "execution reverted: AA25"
 */
export function parseAAError(errorMessage: string): AAErrorInfo | null {
  // Match AA followed by 2 digits
  const match = errorMessage.match(/AA(\d{2})/)
  if (!match) return null

  const code = `AA${match[1]}`
  return (
    AA_ERRORS[code] ?? {
      message: `Account Abstraction error (${code}).`,
      suggestion: 'Please try again or switch gas payment method.',
      action: 'retry',
    }
  )
}

/**
 * Parse an RPC error code from the error message.
 * Wallet extension returns errors like: "Token approval required..." with code -32010.
 */
export function parseRpcError(errorMessage: string): AAErrorInfo | null {
  for (const [code, info] of Object.entries(RPC_ERRORS)) {
    const codeNum = Number(code)
    if (errorMessage.includes(String(codeNum)) || errorMessage.includes(info.message)) {
      return info
    }
  }
  // Check for known RPC error patterns
  if (errorMessage.includes('Token approval required') || errorMessage.includes('token approval')) {
    return RPC_ERRORS[-32010]
  }
  return null
}

/**
 * Get a user-friendly error message, falling back to the original if no AA code found.
 */
export function getUserFriendlyError(errorMessage: string): string {
  const aaError = parseAAError(errorMessage)
  if (aaError) {
    return aaError.suggestion ? `${aaError.message} ${aaError.suggestion}` : aaError.message
  }
  const rpcError = parseRpcError(errorMessage)
  if (rpcError) {
    return rpcError.suggestion ? `${rpcError.message} ${rpcError.suggestion}` : rpcError.message
  }
  return errorMessage
}
