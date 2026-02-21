import { describe, expect, it, vi } from 'vitest'

// Track http() calls to verify URLs
const httpCalls: string[] = []

// Mock wagmi before importing
vi.mock('wagmi', () => ({
  createConfig: vi.fn((config: unknown) => config),
  http: vi.fn((url: string) => {
    httpCalls.push(url)
    return { url }
  }),
}))

vi.mock('wagmi/connectors', () => ({
  injected: vi.fn(() => ({ type: 'injected' })),
}))

// Mock config functions to return known URLs
const MOCK_LOCAL_RPC = 'http://config-local:8501'
const MOCK_TESTNET_RPC = 'https://config-testnet.stablenet.dev'

vi.mock('../config', () => ({
  getLocalConfig: vi.fn(() => ({ rpcUrl: MOCK_LOCAL_RPC })),
  getTestnetConfig: vi.fn(() => ({ rpcUrl: MOCK_TESTNET_RPC })),
}))

// Mock chains
vi.mock('../chains', () => {
  const anvilLocal = { id: 31337, name: 'Anvil (Local)' }
  const stablenetLocal = { id: 8283, name: 'StableNet Local' }
  const stablenetTestnet = { id: 82830, name: 'StableNet Testnet' }
  return {
    anvilLocal,
    stablenetLocal,
    stablenetTestnet,
    supportedChains: [anvilLocal, stablenetLocal, stablenetTestnet],
  }
})

describe('wagmiConfig', () => {
  it('should include all 3 supported chains', async () => {
    const { wagmiConfig } = await import('../wagmi')

    const config = wagmiConfig as unknown as { chains: { id: number }[] }
    const chainIds = config.chains.map((c) => c.id)

    expect(chainIds).toContain(31337)
    expect(chainIds).toContain(8283)
    expect(chainIds).toContain(82830)
  })

  it('should use config system RPC URLs for transports', async () => {
    // The wagmi module was already loaded in the previous test, check httpCalls
    // StableNet Local transport should use config-based URL
    expect(httpCalls).toContain(MOCK_LOCAL_RPC)
    // StableNet Testnet transport should use config-based URL
    expect(httpCalls).toContain(MOCK_TESTNET_RPC)
  })
})
