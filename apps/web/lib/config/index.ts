/**
 * Web App Configuration
 *
 * Centralized configuration management for the web application.
 * All values can be overridden via NEXT_PUBLIC_ environment variables.
 */

export {
  WEB_ENV_VARS,
  getLocalConfig,
  getDevnetConfig, // @deprecated - use getLocalConfig
  getTestnetConfig,
  getAppConfig,
  getConfigByChainId,
  getContractAddresses,
  getServiceUrls,
} from './env'
