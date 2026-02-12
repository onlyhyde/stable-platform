import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useChainId: () => 8283,
  useAccount: () => ({ isConnected: true }),
}))

// Mock chain config
vi.mock('@/lib/chains', () => ({
  getConfigByChainId: () => ({
    rpcUrl: 'http://127.0.0.1:8501',
  }),
  getStablenetLocal: () => ({
    id: 8283,
    name: 'StableNet Local',
    nativeCurrency: { decimals: 18, name: 'WKRC', symbol: 'WKRC' },
    rpcUrls: { default: { http: ['http://127.0.0.1:8501'] } },
  }),
}))

import { StableNetProvider, useStableNetContext } from '../StableNetProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <StableNetProvider>{children}</StableNetProvider>
}

describe('StableNetProvider', () => {
  it('should provide indexerUrl string', () => {
    const { result } = renderHook(() => useStableNetContext(), { wrapper })

    expect(result.current.indexerUrl).toBeDefined()
    expect(typeof result.current.indexerUrl).toBe('string')
    expect(result.current.indexerUrl.length).toBeGreaterThan(0)
  })

  it('should throw when used outside provider', () => {
    expect(() => {
      renderHook(() => useStableNetContext())
    }).toThrow('useStableNetContext must be used within StableNetProvider')
  })
})
