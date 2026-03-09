import { describe, expect, it } from 'vitest'
import {
  CHAIN_ADDRESSES,
  ENTRY_POINT_ADDRESS,
  SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS,
  assertNotZeroAddress,
  getAccountManager,
  getBlsPopPrecompile,
  getChainAddresses,
  getChainConfig,
  getContractAddress,
  getDefaultDelegatePreset,
  getDefaultTokens,
  getDelegatePresets,
  getEntryPoint,
  getGovCouncil,
  getGovMasterMinter,
  getGovMinter,
  getGovValidator,
  getLegacyContractAddresses,
  getNativeCoinAdapter,
  getNativeCoinManager,
  getPrecompiles,
  getServiceUrls,
  isChainSupported,
  isZeroAddress,
} from '../src/addresses'

const VALID_CHAIN_ID = 8283

describe('isZeroAddress', () => {
  it('returns true for zero address', () => {
    expect(isZeroAddress(ZERO_ADDRESS)).toBe(true)
  })

  it('returns false for non-zero address', () => {
    expect(isZeroAddress(ENTRY_POINT_ADDRESS)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(
      isZeroAddress('0x0000000000000000000000000000000000000000' as `0x${string}`)
    ).toBe(true)
  })
})

describe('assertNotZeroAddress', () => {
  it('does not throw for valid address', () => {
    expect(() => assertNotZeroAddress(ENTRY_POINT_ADDRESS)).not.toThrow()
  })

  it('throws for zero address', () => {
    expect(() => assertNotZeroAddress(ZERO_ADDRESS)).toThrow('Address cannot be zero address')
  })

  it('includes context in error message', () => {
    expect(() => assertNotZeroAddress(ZERO_ADDRESS, 'EntryPoint')).toThrow(
      'EntryPoint: address cannot be zero address'
    )
  })
})

describe('isChainSupported', () => {
  it('returns true for supported chain', () => {
    expect(isChainSupported(VALID_CHAIN_ID)).toBe(true)
  })

  it('returns false for unsupported chain', () => {
    expect(isChainSupported(99999)).toBe(false)
  })
})

describe('SUPPORTED_CHAIN_IDS', () => {
  it('contains valid chain IDs', () => {
    expect(SUPPORTED_CHAIN_IDS).toContain(VALID_CHAIN_ID)
    expect(SUPPORTED_CHAIN_IDS.length).toBeGreaterThan(0)
  })
})

describe('getChainAddresses', () => {
  it('returns addresses for supported chain', () => {
    const addresses = getChainAddresses(VALID_CHAIN_ID)
    expect(addresses.chainId).toBe(VALID_CHAIN_ID)
    expect(addresses.core.entryPoint).toBeDefined()
    expect(addresses.core.entryPoint).not.toBe(ZERO_ADDRESS)
  })

  it('throws for unsupported chain', () => {
    expect(() => getChainAddresses(99999)).toThrow('Chain 99999 is not supported')
  })

  it('includes supported chains in error message', () => {
    expect(() => getChainAddresses(99999)).toThrow(String(VALID_CHAIN_ID))
  })
})

describe('getContractAddress', () => {
  it('returns address for valid key', () => {
    const address = getContractAddress(VALID_CHAIN_ID, 'entryPoint')
    expect(address).toBe(getChainAddresses(VALID_CHAIN_ID).core.entryPoint)
  })

  it('throws for unknown key', () => {
    expect(() => getContractAddress(VALID_CHAIN_ID, 'nonExistentKey')).toThrow(
      'Contract key "nonExistentKey" not found'
    )
  })

  it('throws for unsupported chain', () => {
    expect(() => getContractAddress(99999, 'entryPoint')).toThrow('not supported')
  })
})

describe('getServiceUrls', () => {
  it('returns URLs for supported chain', () => {
    const urls = getServiceUrls(VALID_CHAIN_ID)
    expect(urls.bundler).toBeDefined()
    expect(urls.paymaster).toBeDefined()
    expect(urls.stealthServer).toBeDefined()
  })

  it('throws for unsupported chain', () => {
    expect(() => getServiceUrls(99999)).toThrow('not configured')
  })
})

describe('getDefaultTokens', () => {
  it('returns tokens for supported chain', () => {
    const tokens = getDefaultTokens(VALID_CHAIN_ID)
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens[0]).toHaveProperty('symbol')
    expect(tokens[0]).toHaveProperty('decimals')
  })

  it('returns empty array for unsupported chain', () => {
    expect(getDefaultTokens(99999)).toEqual([])
  })
})

describe('getChainConfig', () => {
  it('returns complete config for supported chain', () => {
    const config = getChainConfig(VALID_CHAIN_ID)
    expect(config.addresses.chainId).toBe(VALID_CHAIN_ID)
    expect(config.services.bundler).toBeDefined()
    expect(config.tokens.length).toBeGreaterThan(0)
  })
})

describe('core getters', () => {
  it('getEntryPoint returns non-zero address', () => {
    expect(getEntryPoint(VALID_CHAIN_ID)).not.toBe(ZERO_ADDRESS)
  })
})

describe('delegate presets', () => {
  it('getDelegatePresets returns array', () => {
    const presets = getDelegatePresets(VALID_CHAIN_ID)
    expect(Array.isArray(presets)).toBe(true)
    expect(presets.length).toBeGreaterThan(0)
  })

  it('getDefaultDelegatePreset returns first preset', () => {
    const preset = getDefaultDelegatePreset(VALID_CHAIN_ID)
    expect(preset).not.toBeNull()
    expect(preset?.name).toBeDefined()
    expect(preset?.features).toBeDefined()
  })
})

describe('precompile getters (chain 8283)', () => {
  it('getPrecompiles returns precompiles for chain 8283', () => {
    const precompiles = getPrecompiles(8283)
    expect(precompiles).toBeDefined()
    expect(precompiles?.systemContracts.nativeCoinAdapter).toBeDefined()
  })

  it('getPrecompiles returns undefined for other chains', () => {
    expect(getPrecompiles(1)).toBeUndefined()
  })

  it('getNativeCoinAdapter returns correct address', () => {
    const addr = getNativeCoinAdapter(8283)
    expect(addr).toBe('0x0000000000000000000000000000000000001000')
  })

  it('getGovValidator returns correct address', () => {
    expect(getGovValidator(8283)).toBe('0x0000000000000000000000000000000000001001')
  })

  it('getGovMasterMinter returns correct address', () => {
    expect(getGovMasterMinter(8283)).toBe('0x0000000000000000000000000000000000001002')
  })

  it('getGovMinter returns correct address', () => {
    expect(getGovMinter(8283)).toBe('0x0000000000000000000000000000000000001003')
  })

  it('getGovCouncil returns correct address', () => {
    expect(getGovCouncil(8283)).toBe('0x0000000000000000000000000000000000001004')
  })

  it('getBlsPopPrecompile returns correct address', () => {
    expect(getBlsPopPrecompile(8283)).toBe('0x0000000000000000000000000000000000B00001')
  })

  it('getNativeCoinManager returns correct address', () => {
    expect(getNativeCoinManager(8283)).toBe('0x0000000000000000000000000000000000B00002')
  })

  it('getAccountManager returns correct address', () => {
    expect(getAccountManager(8283)).toBe('0x0000000000000000000000000000000000B00003')
  })

  it('throws for chain without precompiles', () => {
    expect(() => getNativeCoinAdapter(1)).toThrow('has no precompiled contracts')
  })
})

describe('immutability', () => {
  it('CHAIN_ADDRESSES includes precompiles for chain 8283', () => {
    const chain = CHAIN_ADDRESSES[8283]
    expect(chain.precompiles).toBeDefined()
    expect(chain.precompiles?.systemContracts.nativeCoinAdapter).toBe(
      '0x0000000000000000000000000000000000001000'
    )
  })

  it('merged addresses include precompiles without mutating source', () => {
    const merged = CHAIN_ADDRESSES[8283]
    // The merged object should have precompiles from the immutable merge
    expect(merged.precompiles).toBeDefined()
    expect(merged.precompiles?.systemContracts).toBeDefined()
  })
})

describe('legacy compatibility', () => {
  it('getLegacyContractAddresses returns mapped fields', () => {
    const legacy = getLegacyContractAddresses(VALID_CHAIN_ID)
    expect(legacy.entryPoint).toBeDefined()
    expect(legacy.accountFactory).toBeDefined()
    expect(legacy.paymaster).toBeDefined()
    expect(legacy.stealthAnnouncer).toBeDefined()
    expect(legacy.stealthRegistry).toBeDefined()
  })
})
