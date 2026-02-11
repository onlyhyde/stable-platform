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

// Re-export CLI config utilities
export {
  type CliOptions,
  DEFAULT_CONFIG,
  DEFAULT_CORS_ORIGINS,
  ENV_VARS,
  getEnvHelp,
  NETWORK_PRESETS,
  parseConfig,
} from '../cli/config'
export {
  CONSTANTS_ENV_VARS,
  getConstantsEnvHelp,
  getMempoolConfig,
  getReputationConfig,
  getServerConfig,
  getValidationConstants,
} from './constants'
