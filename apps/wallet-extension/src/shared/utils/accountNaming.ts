/**
 * Account Naming Utilities
 *
 * Provides consistent account naming across the wallet extension.
 * Centralizes naming logic for HD accounts and imported accounts.
 */

/**
 * Account type for naming purposes
 */
export type AccountType = 'hd' | 'imported'

/**
 * Account naming configuration
 */
export const ACCOUNT_NAMING = {
  /** Prefix for HD wallet accounts */
  HD_PREFIX: 'Account',
  /** Prefix for imported accounts */
  IMPORTED_PREFIX: 'Imported',
  /** Default name when no information available */
  DEFAULT_NAME: 'Account',
} as const

/**
 * Generate account name based on type and index
 *
 * @param type - Account type ('hd' or 'imported')
 * @param index - Zero-based index of the account
 * @returns Formatted account name
 *
 * @example
 * generateAccountName('hd', 0) // 'Account 1'
 * generateAccountName('hd', 4) // 'Account 5'
 * generateAccountName('imported', 0) // 'Imported 1'
 * generateAccountName('imported', 2) // 'Imported 3'
 */
export function generateAccountName(type: AccountType, index: number): string {
  const displayIndex = index + 1 // 1-based display

  switch (type) {
    case 'hd':
      return `${ACCOUNT_NAMING.HD_PREFIX} ${displayIndex}`
    case 'imported':
      return `${ACCOUNT_NAMING.IMPORTED_PREFIX} ${displayIndex}`
    default:
      return `${ACCOUNT_NAMING.DEFAULT_NAME} ${displayIndex}`
  }
}

/**
 * Get the first character of an account name for avatar display
 *
 * @param name - Account name
 * @returns Uppercase first character, or 'A' if empty
 *
 * @example
 * getAccountInitial('Account 1') // 'A'
 * getAccountInitial('Imported 2') // 'I'
 * getAccountInitial('My Custom Wallet') // 'M'
 */
export function getAccountInitial(name: string | undefined | null): string {
  if (!name || name.length === 0) {
    return 'A'
  }
  return name.charAt(0).toUpperCase()
}

/**
 * Validate account name
 *
 * @param name - Account name to validate
 * @returns Validation result with error message if invalid
 */
export function validateAccountName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Account name cannot be empty' }
  }

  if (name.length > 50) {
    return { valid: false, error: 'Account name cannot exceed 50 characters' }
  }

  // Allow alphanumeric, spaces, and common punctuation
  const validPattern = /^[\w\s\-_.]+$/
  if (!validPattern.test(name)) {
    return { valid: false, error: 'Account name contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Parse account name to extract type and index if it follows the standard pattern
 *
 * @param name - Account name to parse
 * @returns Parsed info or null if doesn't match pattern
 *
 * @example
 * parseAccountName('Account 5') // { type: 'hd', index: 4 }
 * parseAccountName('Imported 3') // { type: 'imported', index: 2 }
 * parseAccountName('My Wallet') // null
 */
export function parseAccountName(name: string): { type: AccountType; index: number } | null {
  const hdMatch = name.match(/^Account\s+(\d+)$/i)
  if (hdMatch?.[1]) {
    return { type: 'hd', index: Number.parseInt(hdMatch[1], 10) - 1 }
  }

  const importedMatch = name.match(/^Imported\s+(\d+)$/i)
  if (importedMatch?.[1]) {
    return { type: 'imported', index: Number.parseInt(importedMatch[1], 10) - 1 }
  }

  return null
}

/**
 * Format account name for display (trim and normalize whitespace)
 *
 * @param name - Raw account name
 * @returns Formatted account name
 */
export function formatAccountName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}
