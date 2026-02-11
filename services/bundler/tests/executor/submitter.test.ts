import type { Address, Hex, WalletClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectSubmitter } from '../../src/executor/directSubmitter'
import { type FlashbotsConfig, FlashbotsSubmitter } from '../../src/executor/flashbotsSubmitter'
import type { BundleSubmission } from '../../src/executor/submitter'
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('error', false)

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const TEST_TX_HASH = `0x${'aa'.repeat(32)}` as Hex
const TEST_DATA = '0xdeadbeef' as Hex
const AUTH_KEY = `0x${'bb'.repeat(32)}` as Hex

function createSubmission(overrides: Partial<BundleSubmission> = {}): BundleSubmission {
  return {
    data: TEST_DATA,
    to: ENTRY_POINT,
    gasLimit: 500000n,
    ...overrides,
  }
}

describe('DirectSubmitter', () => {
  let mockWalletClient: WalletClient
  let submitter: DirectSubmitter

  beforeEach(() => {
    mockWalletClient = {
      sendTransaction: vi.fn().mockResolvedValue(TEST_TX_HASH),
      account: { address: '0x1234567890123456789012345678901234567890' as Address },
      chain: { id: 1, name: 'mainnet' },
    } as unknown as WalletClient

    submitter = new DirectSubmitter(mockWalletClient, logger)
  })

  it('should submit via walletClient.sendTransaction', async () => {
    const result = await submitter.submit(createSubmission())

    expect(result.hash).toBe(TEST_TX_HASH)
    expect(result.method).toBe('direct')
    expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ENTRY_POINT,
        data: TEST_DATA,
        gas: 500000n,
      })
    )
  })

  it('should return direct method type', () => {
    expect(submitter.getType()).toBe('direct')
  })

  it('should propagate wallet client errors', async () => {
    const error = new Error('insufficient funds')
    ;(mockWalletClient.sendTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(error)

    await expect(submitter.submit(createSubmission())).rejects.toThrow('insufficient funds')
  })
})

describe('FlashbotsSubmitter', () => {
  let submitter: FlashbotsSubmitter
  let config: FlashbotsConfig

  beforeEach(() => {
    config = {
      relayUrl: 'https://relay.flashbots.net',
      authKey: AUTH_KEY,
    }
    submitter = new FlashbotsSubmitter(config, logger)

    // Mock global fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { bundleHash: `0x${'cc'.repeat(32)}` as Hex },
        }),
      })
    )
  })

  it('should build correct eth_sendBundle payload', async () => {
    const submission = createSubmission({ targetBlockNumber: 12345n })
    await submitter.submit(submission)

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toBe('https://relay.flashbots.net')

    const body = JSON.parse(fetchCall[1].body)
    expect(body.method).toBe('eth_sendBundle')
    expect(body.params[0].txs).toEqual([TEST_DATA])
    expect(body.params[0].blockNumber).toBe('0x3039') // 12345 hex
  })

  it('should sign request with auth key', async () => {
    const submission = createSubmission({ targetBlockNumber: 12345n })
    await submitter.submit(submission)

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers = fetchCall[1].headers
    expect(headers['X-Flashbots-Signature']).toBeDefined()
    expect(headers['X-Flashbots-Signature']).toContain(':')
  })

  it('should handle relay errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      })
    )

    await expect(submitter.submit(createSubmission({ targetBlockNumber: 12345n }))).rejects.toThrow(
      'Flashbots relay error: 400'
    )
  })

  it('should handle relay RPC errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'bundle simulation failed' },
        }),
      })
    )

    await expect(submitter.submit(createSubmission({ targetBlockNumber: 12345n }))).rejects.toThrow(
      'Flashbots RPC error: bundle simulation failed'
    )
  })

  it('should target correct block number', async () => {
    const blockNum = 99999n
    await submitter.submit(createSubmission({ targetBlockNumber: blockNum }))

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.params[0].blockNumber).toBe('0x1869f') // 99999 hex
  })

  it('should require targetBlockNumber', async () => {
    await expect(
      submitter.submit(createSubmission({ targetBlockNumber: undefined }))
    ).rejects.toThrow('Flashbots submission requires targetBlockNumber')
  })

  it('should return flashbots method type', () => {
    expect(submitter.getType()).toBe('flashbots')
  })
})
