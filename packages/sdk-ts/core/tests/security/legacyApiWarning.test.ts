/**
 * Legacy API Warning Tests
 *
 * T1: Security module coverage - deprecated API warnings
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
  createConsoleDeprecationNotice,
  DeprecationStatus,
  formatWarningForUI,
  getAllApiWarnings,
  getApiWarning,
  getEthSignSettings,
  getWarningsByStatus,
  hasApiWarning,
  isEthSignAllowed,
  resetEthSignSettings,
  shouldBlockMethod,
  shouldShowEthSignWarning,
  updateEthSignSettings,
} from '../../src/security/legacyApiWarning'

describe('LegacyApiWarning', () => {
  afterEach(() => {
    resetEthSignSettings()
  })

  // ========================================================================
  // hasApiWarning
  // ========================================================================

  describe('hasApiWarning', () => {
    it('should return true for known legacy methods', () => {
      expect(hasApiWarning('eth_sign')).toBe(true)
      expect(hasApiWarning('eth_signTypedData')).toBe(true)
      expect(hasApiWarning('eth_accounts')).toBe(true)
      expect(hasApiWarning('net_version')).toBe(true)
      expect(hasApiWarning('eth_decrypt')).toBe(true)
    })

    it('should return false for non-legacy methods', () => {
      expect(hasApiWarning('eth_chainId')).toBe(false)
      expect(hasApiWarning('eth_sendTransaction')).toBe(false)
      expect(hasApiWarning('unknown_method')).toBe(false)
    })
  })

  // ========================================================================
  // getApiWarning
  // ========================================================================

  describe('getApiWarning', () => {
    it('should return warning info for known method', () => {
      const warning = getApiWarning('eth_sign')

      expect(warning).not.toBeNull()
      expect(warning!.method).toBe('eth_sign')
      expect(warning!.status).toBe(DeprecationStatus.DANGEROUS)
      expect(warning!.riskLevel).toBe('critical')
      expect(warning!.message).toBeTruthy()
    })

    it('should return null for unknown method', () => {
      expect(getApiWarning('eth_chainId')).toBeNull()
    })

    it('should include alternative when available', () => {
      const warning = getApiWarning('eth_sign')
      expect(warning!.alternative).toBeTruthy()
    })
  })

  // ========================================================================
  // shouldBlockMethod
  // ========================================================================

  describe('shouldBlockMethod', () => {
    it('should block removed methods', () => {
      expect(shouldBlockMethod('eth_decrypt')).toBe(true)
      expect(shouldBlockMethod('eth_getEncryptionPublicKey')).toBe(true)
      expect(shouldBlockMethod('wallet_registerOnboarding')).toBe(true)
    })

    it('should not block deprecated/legacy methods', () => {
      expect(shouldBlockMethod('eth_sign')).toBe(false)
      expect(shouldBlockMethod('eth_signTypedData')).toBe(false)
      expect(shouldBlockMethod('eth_accounts')).toBe(false)
    })

    it('should not block unknown methods', () => {
      expect(shouldBlockMethod('eth_chainId')).toBe(false)
    })
  })

  // ========================================================================
  // getAllApiWarnings
  // ========================================================================

  describe('getAllApiWarnings', () => {
    it('should return all warnings', () => {
      const warnings = getAllApiWarnings()

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.every((w) => w.method && w.status && w.message)).toBe(true)
    })
  })

  // ========================================================================
  // getWarningsByStatus
  // ========================================================================

  describe('getWarningsByStatus', () => {
    it('should filter by DEPRECATED', () => {
      const deprecated = getWarningsByStatus(DeprecationStatus.DEPRECATED)
      expect(deprecated.every((w) => w.status === DeprecationStatus.DEPRECATED)).toBe(true)
      expect(deprecated.some((w) => w.method === 'eth_accounts')).toBe(true)
    })

    it('should filter by DANGEROUS', () => {
      const dangerous = getWarningsByStatus(DeprecationStatus.DANGEROUS)
      expect(dangerous.some((w) => w.method === 'eth_sign')).toBe(true)
    })

    it('should filter by REMOVED', () => {
      const removed = getWarningsByStatus(DeprecationStatus.REMOVED)
      expect(removed.some((w) => w.method === 'eth_decrypt')).toBe(true)
    })

    it('should filter by LEGACY', () => {
      const legacy = getWarningsByStatus(DeprecationStatus.LEGACY)
      expect(legacy.some((w) => w.method === 'eth_signTypedData')).toBe(true)
    })
  })

  // ========================================================================
  // formatWarningForUI
  // ========================================================================

  describe('formatWarningForUI', () => {
    it('should format dangerous method as danger severity', () => {
      const warning = getApiWarning('eth_sign')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.severity).toBe('danger')
      expect(formatted.title).toContain('Dangerous')
      expect(formatted.description).toBeTruthy()
      expect(formatted.action).toBeTruthy()
    })

    it('should format deprecated method as info severity', () => {
      const warning = getApiWarning('eth_accounts')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.severity).toBe('info')
      expect(formatted.title).toContain('Deprecated')
    })

    it('should format removed method as danger severity', () => {
      const warning = getApiWarning('eth_decrypt')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.severity).toBe('danger')
      expect(formatted.title).toContain('Unsupported')
    })

    it('should format legacy method as warning severity', () => {
      const warning = getApiWarning('eth_signTypedData')!
      const formatted = formatWarningForUI(warning)

      expect(formatted.severity).toBe('warning')
      expect(formatted.title).toContain('Legacy')
    })
  })

  // ========================================================================
  // createConsoleDeprecationNotice
  // ========================================================================

  describe('createConsoleDeprecationNotice', () => {
    it('should create formatted notice', () => {
      const notice = createConsoleDeprecationNotice('eth_sign')

      expect(notice).toContain('[Deprecated]')
      expect(notice).toContain('DANGEROUS')
      expect(notice).toContain('eth_sign')
      expect(notice).toContain('Suggested alternative')
    })

    it('should include documentation URL when available', () => {
      const notice = createConsoleDeprecationNotice('eth_sign')
      expect(notice).toContain('Documentation:')
    })

    it('should return empty string for unknown method', () => {
      expect(createConsoleDeprecationNotice('eth_chainId')).toBe('')
    })
  })

  // ========================================================================
  // EthSign Settings
  // ========================================================================

  describe('ethSign settings', () => {
    it('should have safe defaults', () => {
      const settings = getEthSignSettings()
      expect(settings.allowEthSign).toBe(false)
      expect(settings.showEthSignWarning).toBe(true)
    })

    it('should disallow eth_sign by default', () => {
      expect(isEthSignAllowed()).toBe(false)
    })

    it('should show warning by default', () => {
      expect(shouldShowEthSignWarning()).toBe(true)
    })

    it('should update settings', () => {
      updateEthSignSettings({ allowEthSign: true })

      expect(isEthSignAllowed()).toBe(true)
      expect(shouldShowEthSignWarning()).toBe(true) // unchanged
    })

    it('should partially update settings', () => {
      updateEthSignSettings({ showEthSignWarning: false })

      expect(isEthSignAllowed()).toBe(false) // unchanged
      expect(shouldShowEthSignWarning()).toBe(false)
    })

    it('should reset to defaults', () => {
      updateEthSignSettings({ allowEthSign: true, showEthSignWarning: false })
      resetEthSignSettings()

      expect(isEthSignAllowed()).toBe(false)
      expect(shouldShowEthSignWarning()).toBe(true)
    })

    it('should return copy of settings (immutable)', () => {
      const settings = getEthSignSettings()
      settings.allowEthSign = true

      expect(isEthSignAllowed()).toBe(false) // original unchanged
    })
  })
})
