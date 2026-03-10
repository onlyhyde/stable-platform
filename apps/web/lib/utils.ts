import type { Address } from 'viem'
import { formatUnits, parseUnits } from 'viem'

// Re-export storage utilities for backward compatibility
export type { RpcSettings } from './storage'
export {
  getRpcSettings,
  getRpcUrl,
  getBundlerUrl,
  getPaymasterUrl,
  getBlockExplorerUrl,
} from './storage'

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: Address, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint, decimals: number, displayDecimals = 4): string {
  const formatted = formatUnits(amount, decimals)
  const [integer, decimal] = formatted.split('.')

  if (!decimal) return integer

  const trimmed = decimal.slice(0, displayDecimals).replace(/0+$/, '')
  return trimmed ? `${integer}.${trimmed}` : integer
}

/**
 * Parse token amount to bigint
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals)
}

/**
 * Format USD value
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

/**
 * Format date
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Class name utility
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}


/**
 * Error message patterns and their user-friendly equivalents
 */
const ERROR_MESSAGE_MAP: Array<{ pattern: RegExp; message: string }> = [
  // User rejection errors
  { pattern: /user rejected|user denied|user cancel/i, message: 'Transaction was cancelled' },
  // Wallet connection errors
  { pattern: /wallet.*not connected|no.*wallet/i, message: 'Please connect your wallet first' },
  {
    pattern: /eth_sign.*not supported|unsupported.*method/i,
    message: 'This operation is not supported by your wallet',
  },
  // Network errors
  {
    pattern: /network|connection|timeout|fetch/i,
    message: 'Network error. Please check your connection and try again',
  },
  // Insufficient funds
  { pattern: /insufficient.*funds|balance/i, message: 'Insufficient balance for this transaction' },
  // Gas errors
  {
    pattern: /gas.*too low|out of gas/i,
    message: 'Transaction failed due to gas estimation. Please try again',
  },
  // Nonce errors
  { pattern: /nonce.*too|invalid nonce/i, message: 'Transaction failed. Please try again' },
  // Contract errors
  {
    pattern: /execution reverted|revert/i,
    message: 'Transaction failed. The operation could not be completed',
  },
  // Private key errors
  { pattern: /invalid.*private.*key|key.*invalid/i, message: 'Invalid private key format' },
  // Generic errors - keep at the end as fallback patterns
  { pattern: /invalid|malformed/i, message: 'Invalid input provided' },
]

/**
 * Sanitize error messages for user display
 * Maps technical error messages to user-friendly alternatives
 *
 * @param error - The error message or Error object
 * @param fallback - Fallback message if no pattern matches (default: 'An unexpected error occurred')
 * @returns User-friendly error message
 */
export function sanitizeErrorMessage(
  error: string | Error | unknown,
  fallback = 'An unexpected error occurred. Please try again'
): string {
  // Extract error message string
  let errorMessage: string
  if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  } else {
    return fallback
  }

  // Check against known error patterns
  for (const { pattern, message } of ERROR_MESSAGE_MAP) {
    if (pattern.test(errorMessage)) {
      return message
    }
  }

  // If no pattern matches, return the fallback
  // Never expose raw technical error messages to users
  return fallback
}
