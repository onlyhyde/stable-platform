/**
 * Legacy API Warning System
 *
 * Provides warnings for deprecated or dangerous API methods
 * and suggests safer alternatives.
 */

/**
 * Deprecation status
 */
export const DeprecationStatus = {
  DEPRECATED: 'deprecated',
  DANGEROUS: 'dangerous',
  LEGACY: 'legacy',
  REMOVED: 'removed',
} as const

export type DeprecationStatusType = (typeof DeprecationStatus)[keyof typeof DeprecationStatus]

/**
 * API warning info
 */
export interface ApiWarning {
  method: string
  status: DeprecationStatusType
  message: string
  alternative?: string
  documentationUrl?: string
  /** If true, the method should be blocked entirely */
  shouldBlock: boolean
  /** Risk level for UI display */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Legacy/deprecated API definitions
 */
const LEGACY_APIS: Record<string, Omit<ApiWarning, 'method'>> = {
  // Dangerous methods
  eth_sign: {
    status: DeprecationStatus.DANGEROUS,
    message:
      'eth_sign is dangerous! It signs arbitrary data that could authorize any transaction. ' +
      'This method can be used by malicious dApps to steal your funds.',
    alternative: 'Use personal_sign or eth_signTypedData_v4 instead',
    documentationUrl: 'https://docs.metamask.io/wallet/concepts/signing-methods/',
    shouldBlock: false, // Can be enabled via settings
    riskLevel: 'critical',
  },

  // Legacy typed data methods
  eth_signTypedData: {
    status: DeprecationStatus.LEGACY,
    message:
      'eth_signTypedData (v1) is a legacy format with known security issues. ' +
      'Consider upgrading to eth_signTypedData_v4.',
    alternative: 'Use eth_signTypedData_v4 instead',
    documentationUrl: 'https://eips.ethereum.org/EIPS/eip-712',
    shouldBlock: false,
    riskLevel: 'medium',
  },

  eth_signTypedData_v3: {
    status: DeprecationStatus.LEGACY,
    message:
      'eth_signTypedData_v3 is a legacy version. ' +
      'eth_signTypedData_v4 is the recommended standard.',
    alternative: 'Use eth_signTypedData_v4 instead',
    documentationUrl: 'https://eips.ethereum.org/EIPS/eip-712',
    shouldBlock: false,
    riskLevel: 'low',
  },

  // Deprecated account methods
  eth_accounts: {
    status: DeprecationStatus.DEPRECATED,
    message:
      'eth_accounts is deprecated in favor of eth_requestAccounts. ' +
      'It may return empty array if not previously connected.',
    alternative: 'Use eth_requestAccounts for initial connection',
    documentationUrl: 'https://eips.ethereum.org/EIPS/eip-1102',
    shouldBlock: false,
    riskLevel: 'low',
  },

  // Legacy network methods
  net_version: {
    status: DeprecationStatus.DEPRECATED,
    message:
      'net_version is deprecated. Use eth_chainId instead for reliable chain identification.',
    alternative: 'Use eth_chainId instead',
    documentationUrl: 'https://eips.ethereum.org/EIPS/eip-695',
    shouldBlock: false,
    riskLevel: 'low',
  },

  // Removed methods (will error)
  eth_decrypt: {
    status: DeprecationStatus.REMOVED,
    message:
      'eth_decrypt has been removed due to security concerns. ' +
      'Use application-level encryption instead.',
    shouldBlock: true,
    riskLevel: 'high',
  },

  eth_getEncryptionPublicKey: {
    status: DeprecationStatus.REMOVED,
    message:
      'eth_getEncryptionPublicKey has been removed due to security concerns. ' +
      'Use application-level encryption instead.',
    shouldBlock: true,
    riskLevel: 'high',
  },

  // Wallet-specific deprecated methods
  wallet_registerOnboarding: {
    status: DeprecationStatus.REMOVED,
    message: 'wallet_registerOnboarding is not supported.',
    shouldBlock: true,
    riskLevel: 'low',
  },

  // Personal methods
  personal_ecRecover: {
    status: DeprecationStatus.LEGACY,
    message:
      'personal_ecRecover is a legacy method. ' +
      'Consider using eth_call with ecrecover precompile for on-chain verification.',
    shouldBlock: false,
    riskLevel: 'low',
  },
}

/**
 * Check if a method has warnings
 */
export function hasApiWarning(method: string): boolean {
  return method in LEGACY_APIS
}

/**
 * Get warning info for a method
 */
export function getApiWarning(method: string): ApiWarning | null {
  const warning = LEGACY_APIS[method]
  if (!warning) return null

  return {
    method,
    ...warning,
  }
}

/**
 * Check if a method should be blocked
 */
export function shouldBlockMethod(method: string): boolean {
  const warning = LEGACY_APIS[method]
  return warning?.shouldBlock ?? false
}

/**
 * Get all legacy API warnings
 */
export function getAllApiWarnings(): ApiWarning[] {
  return Object.entries(LEGACY_APIS).map(([method, warning]) => ({
    method,
    ...warning,
  }))
}

/**
 * Get warnings by status
 */
export function getWarningsByStatus(status: DeprecationStatusType): ApiWarning[] {
  return getAllApiWarnings().filter((w) => w.status === status)
}

/**
 * Format warning message for display in approval UI
 */
export function formatWarningForUI(warning: ApiWarning): {
  title: string
  description: string
  severity: 'info' | 'warning' | 'danger'
  action?: string
} {
  const severityMap: Record<string, 'info' | 'warning' | 'danger'> = {
    low: 'info',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  }

  const titles: Record<DeprecationStatusType, string> = {
    [DeprecationStatus.DEPRECATED]: 'Deprecated Method',
    [DeprecationStatus.DANGEROUS]: '⚠️ Dangerous Method',
    [DeprecationStatus.LEGACY]: 'Legacy Method',
    [DeprecationStatus.REMOVED]: 'Unsupported Method',
  }

  return {
    title: titles[warning.status],
    description: warning.message,
    severity: severityMap[warning.riskLevel] || 'warning',
    action: warning.alternative,
  }
}

/**
 * Create a deprecation notice for console
 */
export function createConsoleDeprecationNotice(method: string): string {
  const warning = getApiWarning(method)
  if (!warning) return ''

  const lines = [`[Deprecated] ${warning.status.toUpperCase()}: ${method}`, warning.message]

  if (warning.alternative) {
    lines.push(`Suggested alternative: ${warning.alternative}`)
  }

  if (warning.documentationUrl) {
    lines.push(`Documentation: ${warning.documentationUrl}`)
  }

  return lines.join('\n')
}

/**
 * eth_sign settings interface
 */
export interface EthSignSettings {
  /** Allow eth_sign method (dangerous) */
  allowEthSign: boolean
  /** Show warning before eth_sign */
  showEthSignWarning: boolean
}

const DEFAULT_ETH_SIGN_SETTINGS: EthSignSettings = {
  allowEthSign: false,
  showEthSignWarning: true,
}

let ethSignSettings: EthSignSettings = { ...DEFAULT_ETH_SIGN_SETTINGS }

/**
 * Update eth_sign settings
 */
export function updateEthSignSettings(settings: Partial<EthSignSettings>): void {
  ethSignSettings = { ...ethSignSettings, ...settings }
}

/**
 * Get current eth_sign settings
 */
export function getEthSignSettings(): EthSignSettings {
  return { ...ethSignSettings }
}

/**
 * Check if eth_sign is allowed
 */
export function isEthSignAllowed(): boolean {
  return ethSignSettings.allowEthSign
}

/**
 * Check if eth_sign warning should be shown
 */
export function shouldShowEthSignWarning(): boolean {
  return ethSignSettings.showEthSignWarning
}

/**
 * Reset eth_sign settings to defaults
 */
export function resetEthSignSettings(): void {
  ethSignSettings = { ...DEFAULT_ETH_SIGN_SETTINGS }
}
