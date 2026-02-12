import { describe, expect, it } from 'vitest'
import { getServiceUrls } from '../constants'

describe('getServiceUrls', () => {
  it('should return indexer field for StableNet Local (8283)', () => {
    const urls = getServiceUrls(8283)
    expect(urls).toBeDefined()
    expect(urls).toHaveProperty('indexer')
    expect(typeof urls!.indexer).toBe('string')
    expect(urls!.indexer.length).toBeGreaterThan(0)
  })

  it('should return indexer field for StableNet Testnet (82830)', () => {
    const urls = getServiceUrls(82830)
    expect(urls).toBeDefined()
    expect(urls).toHaveProperty('indexer')
    expect(typeof urls!.indexer).toBe('string')
    expect(urls!.indexer.length).toBeGreaterThan(0)
  })

  it('should return undefined for unsupported chain', () => {
    const urls = getServiceUrls(99999)
    expect(urls).toBeUndefined()
  })
})
