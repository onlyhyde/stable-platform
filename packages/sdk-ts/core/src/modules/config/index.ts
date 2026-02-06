/**
 * Module Configuration
 *
 * Consolidated module definitions for the ERC-7579 module registry.
 * Follows SRP: configuration is separated from registry logic.
 */

// Types
export {
  type ModuleRegistryEntry,
  SUPPORTED_CHAIN_IDS,
  DEFAULT_SUPPORTED_CHAINS,
  createModuleEntry,
} from './types'

// Validators
export {
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  VALIDATOR_MODULES,
} from './validators'

// Executors
export {
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  EXECUTOR_MODULES,
} from './executors'

// Hooks
export {
  SPENDING_LIMIT_HOOK,
  HOOK_MODULES,
} from './hooks'

// Fallbacks
export {
  TOKEN_RECEIVER_FALLBACK,
  FALLBACK_MODULES,
} from './fallbacks'

// ============================================================================
// All Built-in Modules
// ============================================================================

import { VALIDATOR_MODULES } from './validators'
import { EXECUTOR_MODULES } from './executors'
import { HOOK_MODULES } from './hooks'
import { FALLBACK_MODULES } from './fallbacks'
import type { ModuleRegistryEntry } from './types'

/**
 * All built-in modules
 */
export const BUILT_IN_MODULES: ModuleRegistryEntry[] = [
  ...VALIDATOR_MODULES,
  ...EXECUTOR_MODULES,
  ...HOOK_MODULES,
  ...FALLBACK_MODULES,
]
