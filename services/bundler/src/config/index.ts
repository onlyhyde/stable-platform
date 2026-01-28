/**
 * Bundler configuration module
 *
 * This module provides centralized configuration management for the bundler service.
 * All configuration values can be overridden via environment variables.
 *
 * @example
 * ```typescript
 * import { getValidationConstants, getReputationConfig, getMempoolConfig } from './config'
 *
 * const validationConfig = getValidationConstants()
 * const repConfig = getReputationConfig()
 * const mempoolConfig = getMempoolConfig()
 * ```
 */

export {
  CONSTANTS_ENV_VARS,
  getValidationConstants,
  getReputationConfig,
  getMempoolConfig,
  getServerConfig,
  getConstantsEnvHelp,
} from './constants'

// Re-export CLI config utilities
export {
  ENV_VARS,
  DEFAULT_CONFIG,
  DEFAULT_CORS_ORIGINS,
  NETWORK_PRESETS,
  parseConfig,
  getEnvHelp,
  type CliOptions,
} from '../cli/config'
