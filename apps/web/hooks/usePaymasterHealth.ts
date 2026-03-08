'use client'

import { useCallback, useEffect, useState } from 'react'
import { useStableNetContext } from '@/providers'

/**
 * Check if the Paymaster proxy service is reachable.
 * Pings pm_supportedTokens as a lightweight health probe.
 */
export function usePaymasterHealth() {
  const { paymasterUrl, chainId } = useStableNetContext()
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_getSupportedTokens',
          params: [`0x${chainId.toString(16)}`],
        }),
        signal: AbortSignal.timeout(5000),
      })
      setIsHealthy(response.ok)
    } catch {
      setIsHealthy(false)
    }
  }, [paymasterUrl, chainId])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30_000)
    return () => clearInterval(interval)
  }, [checkHealth])

  return { isHealthy, checkHealth }
}
