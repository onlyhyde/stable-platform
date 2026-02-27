import { describe, expect, it } from 'vitest'
import {
  ENTRY_POINT_V07_ADDRESS,
  ENTRY_POINT_ABI,
  getEntryPointVersion,
  isEntryPointV07,
  isEntryPointV06,
} from '../../src/entrypoint'

describe('entrypoint module', () => {
  it('should export ENTRY_POINT_V07_ADDRESS', () => {
    expect(ENTRY_POINT_V07_ADDRESS).toBeDefined()
    expect(ENTRY_POINT_V07_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('should export ENTRY_POINT_ABI', () => {
    expect(ENTRY_POINT_ABI).toBeDefined()
    expect(Array.isArray(ENTRY_POINT_ABI)).toBe(true)
    expect(ENTRY_POINT_ABI.length).toBeGreaterThan(0)
  })

  describe('getEntryPointVersion', () => {
    it('should detect v0.7', () => {
      expect(getEntryPointVersion('0x0000000071727De22E5E9d8BAf0edAc6f37da032')).toBe('v0.7')
    })

    it('should detect v0.7 case-insensitive', () => {
      expect(getEntryPointVersion('0x0000000071727de22e5e9d8baf0edac6f37da032')).toBe('v0.7')
    })

    it('should detect v0.6', () => {
      expect(getEntryPointVersion('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')).toBe('v0.6')
    })

    it('should detect v0.6 case-insensitive', () => {
      expect(getEntryPointVersion('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')).toBe('v0.6')
    })

    it('should return unknown for other addresses', () => {
      expect(getEntryPointVersion('0x1234567890123456789012345678901234567890')).toBe('unknown')
    })
  })

  describe('isEntryPointV07', () => {
    it('should return true for v0.7 address', () => {
      expect(isEntryPointV07('0x0000000071727De22E5E9d8BAf0edAc6f37da032')).toBe(true)
    })

    it('should return false for v0.6 address', () => {
      expect(isEntryPointV07('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')).toBe(false)
    })

    it('should return false for unknown address', () => {
      expect(isEntryPointV07('0x1234567890123456789012345678901234567890')).toBe(false)
    })
  })

  describe('isEntryPointV06', () => {
    it('should return true for v0.6 address', () => {
      expect(isEntryPointV06('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')).toBe(true)
    })

    it('should return false for v0.7 address', () => {
      expect(isEntryPointV06('0x0000000071727De22E5E9d8BAf0edAc6f37da032')).toBe(false)
    })

    it('should return false for unknown address', () => {
      expect(isEntryPointV06('0x1234567890123456789012345678901234567890')).toBe(false)
    })
  })
})
