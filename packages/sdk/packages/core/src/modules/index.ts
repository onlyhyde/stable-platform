/**
 * Module System
 * Module registry and utilities for ERC-7579 modular Smart Accounts
 */

export {
  createModuleRegistry,
  type ModuleRegistry,
  type ModuleRegistryEntry,
  type ModuleSearchFilters,
  type ModuleRegistryConfig,
  // Built-in modules
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  BUILT_IN_MODULES,
} from './moduleRegistry'
