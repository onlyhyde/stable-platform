import type { SupportedToken } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'

import { useSelectedNetwork } from '../../../hooks'

// ============================================================================
// Types
// ============================================================================

export interface PaymasterSponsorPolicy {
  isAvailable: boolean
  reason?: string
  sponsor?: { name: string }
  dailyLimit?: string
  maxGas?: string
  dailyLimitRemaining?: string | bigint
  perTxLimit?: string | bigint
}

interface PaymasterAccountStatus {
  isRegistered: boolean
  registeredAt?: string
  policy?: {
    dailyLimit: string
    dailyUsed: string
    perTxLimit: string
  }
}

interface UsePaymasterStatusReturn {
  sponsorPolicy: PaymasterSponsorPolicy | null
  supportedTokens: SupportedToken[] | null
  accountStatus: PaymasterAccountStatus | null
  isLoading: boolean
  isRegistering: boolean
  registerAccount: () => Promise<{ success: boolean; error?: string }>
  refetch: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Paymaster registration and status management hook.
 * Integrates usePaymasterClient data with pm_registerAccount / pm_accountStatus RPCs.
 */
export function usePaymasterStatus(accountAddress?: Address): UsePaymasterStatusReturn {
  const [sponsorPolicy, setSponsorPolicy] = useState<PaymasterSponsorPolicy | null>(null)
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [accountStatus, setAccountStatus] = useState<PaymasterAccountStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [fetchTrigger, setFetchTrigger] = useState(0)

  const currentNetwork = useSelectedNetwork()

  // Fetch all paymaster data
  useEffect(() => {
    if (!currentNetwork || !accountAddress) return

    setIsLoading(true)

    const fetchAll = async () => {
      // Fetch sponsor policy
      try {
        const policyResponse = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `pm-policy-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_sponsorPolicy',
            params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
          },
        })
        if (policyResponse?.payload?.result) {
          setSponsorPolicy(policyResponse.payload.result)
        } else {
          setSponsorPolicy({ isAvailable: false, reason: 'Sponsorship not available' })
        }
      } catch {
        setSponsorPolicy({ isAvailable: false, reason: 'Could not check sponsorship' })
      }

      // Fetch supported tokens
      try {
        const tokensResponse = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `pm-tokens-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_supportedTokens',
            params: [currentNetwork.chainId],
          },
        })
        if (tokensResponse?.payload?.result?.tokens) {
          setSupportedTokens(tokensResponse.payload.result.tokens)
        }
      } catch {
        // Silently fail
      }

      // Fetch account status
      try {
        const statusResponse = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `pm-status-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_accountStatus',
            params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
          },
        })
        if (statusResponse?.payload?.result) {
          setAccountStatus(statusResponse.payload.result)
        } else {
          setAccountStatus({ isRegistered: false })
        }
      } catch {
        setAccountStatus({ isRegistered: false })
      }

      setIsLoading(false)
    }

    fetchAll()
  }, [currentNetwork, accountAddress, fetchTrigger])

  // Register account with paymaster
  const registerAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentNetwork || !accountAddress) {
      return { success: false, error: 'No account or network selected' }
    }

    setIsRegistering(true)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `pm-register-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_registerAccount',
          params: [{ account: accountAddress, chainId: currentNetwork.chainId }],
        },
      })

      if (response?.payload?.error) {
        return { success: false, error: response.payload.error.message }
      }

      // Refetch status after registration
      setFetchTrigger((prev) => prev + 1)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Registration failed',
      }
    } finally {
      setIsRegistering(false)
    }
  }, [currentNetwork, accountAddress])

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1)
  }, [])

  return {
    sponsorPolicy,
    supportedTokens,
    accountStatus,
    isLoading,
    isRegistering,
    registerAccount,
    refetch,
  }
}
