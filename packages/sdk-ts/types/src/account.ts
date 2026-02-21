import type { Address } from 'viem'
import type { InstalledModule } from './module'
import type { TransactionMode } from './transaction'

// ============================================================================
// Constants
// ============================================================================

/**
 * Account types
 */
export const ACCOUNT_TYPE = {
  /** Standard Externally Owned Account */
  EOA: 'eoa',
  /** Pure Smart Account (contract wallet) */
  SMART: 'smart',
  /** EOA with EIP-7702 delegation to Smart Account */
  DELEGATED: 'delegated',
} as const

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE]

/**
 * Keyring types for key management
 */
export const KEYRING_TYPE = {
  /** HD Wallet derived keys */
  HD: 'hd',
  /** Imported private key */
  SIMPLE: 'simple',
  /** Hardware wallet (Ledger, Trezor) */
  HARDWARE: 'hardware',
} as const

export type KeyringType = (typeof KEYRING_TYPE)[keyof typeof KEYRING_TYPE]

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Account information
 */
export interface Account {
  /** Account address */
  address: Address

  /** Display name */
  name: string

  /** Account type */
  type: AccountType

  /** Keyring type (how keys are managed) */
  keyringType?: KeyringType

  /** HD path index (for HD keyring) */
  index?: number

  // ---- Smart Account / Delegated specific ----

  /** Delegate contract address (Kernel) for delegated EOA */
  delegateAddress?: Address

  /** Whether smart account is deployed on-chain */
  isDeployed?: boolean

  /** Installed ERC-7579 modules */
  installedModules?: InstalledModule[]

  // ---- Metadata ----

  /** Creation timestamp */
  createdAt?: number

  /** Last activity timestamp */
  lastActivity?: number
}

/**
 * Account state for wallet
 */
export interface AccountState {
  /** All accounts */
  accounts: Account[]

  /** Currently selected account address */
  selectedAccount: Address | null
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get available transaction modes for an account type
 *
 * @param account - Account to check
 * @returns Array of available transaction modes
 *
 * @example
 * ```typescript
 * const modes = getAvailableTransactionModes({ type: 'delegated', ... })
 * // Returns: ['eoa', 'smartAccount']
 * ```
 */
export function getAvailableTransactionModes(account: Account): TransactionMode[] {
  // Import the constants at runtime to avoid circular dependency
  const MODES = {
    EOA: 'eoa' as TransactionMode,
    EIP7702: 'eip7702' as TransactionMode,
    SMART_ACCOUNT: 'smartAccount' as TransactionMode,
  }

  switch (account.type) {
    case ACCOUNT_TYPE.EOA:
      // Plain EOA can only send direct transactions
      return [MODES.EOA]

    case ACCOUNT_TYPE.DELEGATED:
      // Delegated EOA can use direct EOA mode or Smart Account mode
      return [MODES.EOA, MODES.SMART_ACCOUNT]

    case ACCOUNT_TYPE.SMART:
      // Pure Smart Account can only use UserOperations
      return [MODES.SMART_ACCOUNT]

    default:
      return [MODES.EOA]
  }
}

/**
 * Get default transaction mode for an account
 *
 * @param account - Account to check
 * @returns Default transaction mode
 */
export function getDefaultTransactionMode(account: Account): TransactionMode {
  switch (account.type) {
    case ACCOUNT_TYPE.DELEGATED:
    case ACCOUNT_TYPE.SMART:
      return 'smartAccount'

    default:
      return 'eoa'
  }
}

/**
 * Check if account supports Smart Account features
 */
export function supportsSmartAccount(account: Account): boolean {
  return account.type === ACCOUNT_TYPE.SMART || account.type === ACCOUNT_TYPE.DELEGATED
}

/**
 * Check if account can install modules
 */
export function canInstallModules(account: Account): boolean {
  return supportsSmartAccount(account) && (account.isDeployed ?? false)
}
