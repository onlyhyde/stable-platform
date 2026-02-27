import { describe, expect, it } from 'vitest'
import { createBundlerClient, ENTRY_POINT_V07_ADDRESS } from '../../src/bundler'

describe('bundler module', () => {
  it('should re-export createBundlerClient', () => {
    expect(typeof createBundlerClient).toBe('function')
  })

  it('should re-export ENTRY_POINT_V07_ADDRESS', () => {
    expect(ENTRY_POINT_V07_ADDRESS).toBeDefined()
    expect(ENTRY_POINT_V07_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('should create a bundler client with valid config', () => {
    const client = createBundlerClient({
      url: 'https://bundler.example.com',
    })
    expect(client).toBeDefined()
    expect(typeof client.sendUserOperation).toBe('function')
    expect(typeof client.estimateUserOperationGas).toBe('function')
    expect(typeof client.getUserOperationByHash).toBe('function')
    expect(typeof client.getUserOperationReceipt).toBe('function')
    expect(typeof client.getSupportedEntryPoints).toBe('function')
    expect(typeof client.getChainId).toBe('function')
    expect(typeof client.waitForUserOperationReceipt).toBe('function')
  })
})
