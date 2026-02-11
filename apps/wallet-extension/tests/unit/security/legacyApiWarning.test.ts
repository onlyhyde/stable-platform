/**
 * Legacy API Warning Tests (SEC-18)
 */

// Unmock to test real implementation
jest.unmock('@stablenet/core')

import {
  createConsoleDeprecationNotice,
  DeprecationStatus,
  formatApiWarningForUI as formatWarningForUI,
  getAllApiWarnings,
  getApiWarning,
  getEthSignSettings,
  getWarningsByStatus,
  hasApiWarning,
  isEthSignAllowed,
  shouldBlockMethod,
  shouldShowEthSignWarning,
  updateEthSignSettings,
} from '@stablenet/core'

describe('legacyApiWarning', () => {
  describe('hasApiWarning', () => {
    it('should return true for known legacy methods', () => {
      expect(hasApiWarning('eth_sign')).toBe(true)
      expect(hasApiWarning('eth_signTypedData')).toBe(true)
      expect(hasApiWarning('eth_accounts')).toBe(true)
      expect(hasApiWarning('net_version')).toBe(true)
    })

    it('should return false for standard methods', () => {
      expect(hasApiWarning('eth_sendTransaction')).toBe(false)
      expect(hasApiWarning('eth_call')).toBe(false)
      expect(hasApiWarning('eth_getBalance')).toBe(false)
      expect(hasApiWarning('eth_signTypedData_v4')).toBe(false)
    })
  })

  describe('getApiWarning', () => {
    it('should return warning info for eth_sign', () => {
      const warning = getApiWarning('eth_sign')

      expect(warning).not.toBeNull()
      expect(warning?.method).toBe('eth_sign')
      expect(warning?.status).toBe(DeprecationStatus.DANGEROUS)
      expect(warning?.riskLevel).toBe('critical')
      expect(warning?.message).toContain('dangerous')
      expect(warning?.alternative).toBeDefined()
    })

    it('should return warning info for legacy typed data', () => {
      const warning = getApiWarning('eth_signTypedData')

      expect(warning).not.toBeNull()
      expect(warning?.status).toBe(DeprecationStatus.LEGACY)
      expect(warning?.alternative).toContain('eth_signTypedData_v4')
    })

    it('should return warning info for deprecated eth_accounts', () => {
      const warning = getApiWarning('eth_accounts')

      expect(warning).not.toBeNull()
      expect(warning?.status).toBe(DeprecationStatus.DEPRECATED)
      expect(warning?.alternative).toContain('eth_requestAccounts')
    })

    it('should return warning info for removed methods', () => {
      const warning = getApiWarning('eth_decrypt')

      expect(warning).not.toBeNull()
      expect(warning?.status).toBe(DeprecationStatus.REMOVED)
      expect(warning?.shouldBlock).toBe(true)
    })

    it('should return null for standard methods', () => {
      expect(getApiWarning('eth_call')).toBeNull()
      expect(getApiWarning('eth_sendTransaction')).toBeNull()
    })
  })

  describe('shouldBlockMethod', () => {
    it('should return true for removed methods', () => {
      expect(shouldBlockMethod('eth_decrypt')).toBe(true)
      expect(shouldBlockMethod('eth_getEncryptionPublicKey')).toBe(true)
      expect(shouldBlockMethod('wallet_registerOnboarding')).toBe(true)
    })

    it('should return false for legacy but allowed methods', () => {
      expect(shouldBlockMethod('eth_sign')).toBe(false)
      expect(shouldBlockMethod('eth_signTypedData')).toBe(false)
      expect(shouldBlockMethod('eth_accounts')).toBe(false)
    })

    it('should return false for unknown methods', () => {
      expect(shouldBlockMethod('unknown_method')).toBe(false)
    })
  })

  describe('getAllApiWarnings', () => {
    it('should return all defined warnings', () => {
      const warnings = getAllApiWarnings()

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.method === 'eth_sign')).toBe(true)
      expect(warnings.some((w) => w.method === 'eth_accounts')).toBe(true)
    })
  })

  describe('getWarningsByStatus', () => {
    it('should filter by DANGEROUS status', () => {
      const warnings = getWarningsByStatus(DeprecationStatus.DANGEROUS)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.every((w) => w.status === DeprecationStatus.DANGEROUS)).toBe(true)
      expect(warnings.some((w) => w.method === 'eth_sign')).toBe(true)
    })

    it('should filter by DEPRECATED status', () => {
      const warnings = getWarningsByStatus(DeprecationStatus.DEPRECATED)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.every((w) => w.status === DeprecationStatus.DEPRECATED)).toBe(true)
    })

    it('should filter by REMOVED status', () => {
      const warnings = getWarningsByStatus(DeprecationStatus.REMOVED)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.every((w) => w.status === DeprecationStatus.REMOVED)).toBe(true)
    })
  })

  describe('formatWarningForUI', () => {
    it('should format dangerous method warning', () => {
      const warning = getApiWarning('eth_sign')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.title).toContain('Dangerous')
      expect(formatted.severity).toBe('danger')
      expect(formatted.description).toBeDefined()
      expect(formatted.action).toBeDefined()
    })

    it('should format deprecated method warning', () => {
      const warning = getApiWarning('eth_accounts')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.title).toContain('Deprecated')
      expect(formatted.severity).toBe('info')
    })

    it('should format legacy method warning', () => {
      const warning = getApiWarning('eth_signTypedData')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.title).toContain('Legacy')
      expect(formatted.severity).toBe('warning')
    })

    it('should format removed method warning', () => {
      const warning = getApiWarning('eth_decrypt')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.title).toContain('Unsupported')
      expect(formatted.severity).toBe('danger')
    })
  })

  describe('createConsoleDeprecationNotice', () => {
    it('should create notice for known methods', () => {
      const notice = createConsoleDeprecationNotice('eth_sign')

      expect(notice).toContain('[Deprecated]')
      expect(notice).toContain('DANGEROUS')
      expect(notice).toContain('eth_sign')
    })

    it('should include alternative when available', () => {
      const notice = createConsoleDeprecationNotice('eth_accounts')

      expect(notice).toContain('eth_requestAccounts')
    })

    it('should include documentation URL when available', () => {
      const notice = createConsoleDeprecationNotice('eth_sign')

      expect(notice).toContain('Documentation:')
    })

    it('should return empty string for unknown methods', () => {
      const notice = createConsoleDeprecationNotice('unknown_method')

      expect(notice).toBe('')
    })
  })

  describe('eth_sign settings', () => {
    beforeEach(() => {
      // Reset to defaults
      updateEthSignSettings({
        allowEthSign: false,
        showEthSignWarning: true,
      })
    })

    it('should return default settings', () => {
      const settings = getEthSignSettings()

      expect(settings.allowEthSign).toBe(false)
      expect(settings.showEthSignWarning).toBe(true)
    })

    it('should update settings', () => {
      updateEthSignSettings({ allowEthSign: true })

      const settings = getEthSignSettings()
      expect(settings.allowEthSign).toBe(true)
      expect(settings.showEthSignWarning).toBe(true) // Not changed
    })

    it('should check if eth_sign is allowed', () => {
      expect(isEthSignAllowed()).toBe(false)

      updateEthSignSettings({ allowEthSign: true })
      expect(isEthSignAllowed()).toBe(true)
    })

    it('should check if warning should be shown', () => {
      expect(shouldShowEthSignWarning()).toBe(true)

      updateEthSignSettings({ showEthSignWarning: false })
      expect(shouldShowEthSignWarning()).toBe(false)
    })
  })

  describe('risk levels', () => {
    it('should have critical risk for eth_sign', () => {
      const warning = getApiWarning('eth_sign')
      expect(warning?.riskLevel).toBe('critical')
    })

    it('should have high risk for removed methods', () => {
      const warning = getApiWarning('eth_decrypt')
      expect(warning?.riskLevel).toBe('high')
    })

    it('should have medium risk for legacy typed data', () => {
      const warning = getApiWarning('eth_signTypedData')
      expect(warning?.riskLevel).toBe('medium')
    })

    it('should have low risk for deprecated methods', () => {
      const warning = getApiWarning('eth_accounts')
      expect(warning?.riskLevel).toBe('low')
    })
  })

  describe('documentation URLs', () => {
    it('should have documentation for eth_sign', () => {
      const warning = getApiWarning('eth_sign')
      expect(warning?.documentationUrl).toBeDefined()
      expect(warning?.documentationUrl).toContain('https://')
    })

    it('should have documentation for EIP-712 related methods', () => {
      const warning = getApiWarning('eth_signTypedData')
      expect(warning?.documentationUrl).toContain('eip-712')
    })
  })
})
