import { describe, expect, it } from 'vitest'
import { getBlockExplorerUrl } from '../utils'

describe('getBlockExplorerUrl', () => {
  it('should return local explorer URL for chainId 8283', () => {
    const url = getBlockExplorerUrl(8283)
    expect(url).toContain('127.0.0.1')
  })

  it('should return testnet explorer URL for chainId 82830', () => {
    const url = getBlockExplorerUrl(82830)
    expect(url).toContain('testnet.stablenet')
  })

  it('should append /tx/{hash} for txHash option', () => {
    const hash = '0xabc123'
    const url = getBlockExplorerUrl(8283, { txHash: hash })
    expect(url).toContain(`/tx/${hash}`)
  })

  it('should append /address/{addr} for address option', () => {
    const addr = '0x1234567890123456789012345678901234567890'
    const url = getBlockExplorerUrl(8283, { address: addr })
    expect(url).toContain(`/address/${addr}`)
  })

  it('should return fallback URL for unsupported chainId', () => {
    const url = getBlockExplorerUrl(99999)
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })

  it('should return base URL when no options provided', () => {
    const url = getBlockExplorerUrl(8283)
    expect(url).not.toContain('/tx/')
    expect(url).not.toContain('/address/')
  })
})
