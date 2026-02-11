/**
 * Web App Configuration
 *
 * Centralized configuration management for the web application.
 * All values can be overridden via NEXT_PUBLIC_ environment variables.
 */

export {
  getAppConfig,
  getConfigByChainId,
  getContractAddresses,
  getDevnetConfig, // @deprecated - use getLocalConfig
  getLocalConfig,
  getServiceUrls,
  getTestnetConfig,
  WEB_ENV_VARS,
} from './env'
