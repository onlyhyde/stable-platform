import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { classifyAccountByCode } from '../../src/eip7702/authorization'

describe('classifyAccountByCode', () => {
  it('returns "eoa" for undefined', () => {
    expect(classifyAccountByCode(undefined)).toBe('eoa')
  })

  it('returns "eoa" for null', () => {
    expect(classifyAccountByCode(null)).toBe('eoa')
  })

  it('returns "eoa" for empty bytecode "0x"', () => {
    expect(classifyAccountByCode('0x' as Hex)).toBe('eoa')
  })

  it('returns "delegated" for EIP-7702 delegation prefix', () => {
    const delegatedCode = '0xef0100aabbccddaabbccddaabbccddaabbccddaabbccdd' as Hex
    expect(classifyAccountByCode(delegatedCode)).toBe('delegated')
  })

  it('returns "delegated" regardless of case', () => {
    const upperCase = '0xEF0100AABBCCDDAABBCCDDAABBCCDDAABBCCDDAABBCCDD' as Hex
    expect(classifyAccountByCode(upperCase)).toBe('delegated')

    const mixedCase = '0xEf0100aAbBcCdDaAbBcCdDaAbBcCdDaAbBcCdDaAbBcCdD' as Hex
    expect(classifyAccountByCode(mixedCase)).toBe('delegated')
  })

  it('returns "smart" for contract bytecode', () => {
    const contractCode = '0x6080604052348015600f57600080fd5b50' as Hex
    expect(classifyAccountByCode(contractCode)).toBe('smart')
  })

  it('returns "smart" for arbitrary non-delegation bytecode', () => {
    const arbitraryCode = '0xdeadbeef' as Hex
    expect(classifyAccountByCode(arbitraryCode)).toBe('smart')
  })
})
