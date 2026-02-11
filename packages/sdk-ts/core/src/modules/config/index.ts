/**
 * Module Configuration
 *
 * Consolidated module definitions for the ERC-7579 module registry.
 * Follows SRP: configuration is separated from registry logic.
 */

// Executors
export {
  EXECUTOR_MODULES,
  RECURRING_PAYMENT_EXECUTOR,
  SESSION_KEY_EXECUTOR,
} from './executors'
// Fallbacks
export {
  FALLBACK_MODULES,
  TOKEN_RECEIVER_FALLBACK,
} from './fallbacks'
// Hooks
export {
  HOOK_MODULES,
  SPENDING_LIMIT_HOOK,
} from './hooks'
// Types
export {
  createModuleEntry,
  DEFAULT_SUPPORTED_CHAINS,
  type ModuleRegistryEntry,
  SUPPORTED_CHAIN_IDS,
} from './types'
// Validators
export {
  ECDSA_VALIDATOR,
  MULTISIG_VALIDATOR,
  VALIDATOR_MODULES,
  WEBAUTHN_VALIDATOR,
} from './validators'

// ============================================================================
// All Built-in Modules
// ============================================================================

import { EXECUTOR_MODULES } from './executors'
import { FALLBACK_MODULES } from './fallbacks'
import { HOOK_MODULES } from './hooks'
import type { ModuleRegistryEntry } from './types'
import { VALIDATOR_MODULES } from './validators'

/**
 * All built-in modules
 */
export const BUILT_IN_MODULES: ModuleRegistryEntry[] = [
  ...VALIDATOR_MODULES,
  ...EXECUTOR_MODULES,
  ...HOOK_MODULES,
  ...FALLBACK_MODULES,
]
