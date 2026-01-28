'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi'
import type { Address, Hex, Hash } from 'viem'

// Contract address - should come from @stablenet/contracts
const SESSION_KEY_MANAGER = '0x4a679253410272dd5232B3Ff7cF5dbB88f295319' as const

// Session key states
export type SessionKeyState = 'active' | 'expired' | 'revoked' | 'unknown'

// Session key info
export interface SessionKeyInfo {
  /** Session key address */
  sessionKey: Address
  /** Current state */
  state: SessionKeyState
  /** Expiry timestamp (0 = no expiry) */
  expiry: bigint
  /** Remaining spending limit */
  remainingLimit: bigint
  /** Total spending limit */
  totalLimit: bigint
  /** Permissions granted to this session key */
  permissions: SessionKeyPermission[]
  /** Creation timestamp */
  createdAt: bigint
}

// Permission granted to a session key
export interface SessionKeyPermission {
  /** Target contract address */
  target: Address
  /** Function selector */
  selector: Hex
  /** Whether permission is active */
  active: boolean
}

// Parameters for creating a session key
export interface CreateSessionKeyParams {
  /** Expiry timestamp (0 = no expiry) */
  expiry?: bigint
  /** Spending limit (0 = unlimited) */
  spendingLimit?: bigint
  /** Initial permissions to grant */
  permissions?: Array<{
    target: Address
    selector: Hex
  }>
}

// Permission to grant to a session key
export interface Permission {
  /** Target contract address */
  target: Address
  /** Function selector (4 bytes) */
  selector: Hex
  /** Maximum value per call */
  maxValue?: bigint
}

// ABI fragments for SessionKeyManager
const SESSION_KEY_MANAGER_ABI = [
  {
    name: 'createSessionKey',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'expiry', type: 'uint256' },
      { name: 'spendingLimit', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'revokeSessionKey',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'sessionKey', type: 'address' }],
    outputs: [],
  },
  {
    name: 'grantPermission',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'maxValue', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'revokePermission',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
    ],
    outputs: [],
  },
  {
    name: 'getSessionKeyState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [
      { name: 'expiry', type: 'uint256' },
      { name: 'remainingLimit', type: 'uint256' },
      { name: 'totalLimit', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'hasPermission',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getSessionKeys',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getPermissions',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'selector', type: 'bytes4' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
] as const

export interface UseSessionKeyReturn {
  // State
  sessionKeys: SessionKeyInfo[]
  isLoading: boolean
  error: string | null

  // Loading states for individual operations
  isCreating: boolean
  isRevoking: boolean
  isGranting: boolean

  // Operations
  createSessionKey: (params: CreateSessionKeyParams) => Promise<{
    sessionKey: Address
    txHash: Hash
  } | null>
  revokeSessionKey: (sessionKey: Address) => Promise<{ txHash: Hash } | null>
  grantPermission: (
    sessionKey: Address,
    permission: Permission
  ) => Promise<{ txHash: Hash } | null>
  revokePermission: (
    sessionKey: Address,
    target: Address,
    selector: Hex
  ) => Promise<{ txHash: Hash } | null>

  // Queries
  getSessionKeyState: (sessionKey: Address) => Promise<SessionKeyInfo | null>
  checkPermission: (
    sessionKey: Address,
    target: Address,
    selector: Hex
  ) => Promise<boolean>

  // Helpers
  refresh: () => Promise<void>
  clearError: () => void
}

/**
 * Hook for managing ERC-7715 session keys
 * Allows creating, revoking, and managing permissions for session keys
 */
export function useSessionKey(account?: Address): UseSessionKeyReturn {
  const { address: connectedAddress, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Use provided account or connected address
  const targetAccount = account || connectedAddress

  // State
  const [sessionKeys, setSessionKeys] = useState<SessionKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Loading states for operations
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [isGranting, setIsGranting] = useState(false)

  // Clear error helper
  const clearError = useCallback(() => setError(null), [])

  // Fetch session key state from contract
  const getSessionKeyState = useCallback(
    async (sessionKey: Address): Promise<SessionKeyInfo | null> => {
      if (!targetAccount || !publicClient) return null

      try {
        const result = await publicClient.readContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'getSessionKeyState',
          args: [targetAccount, sessionKey],
        })

        const [expiry, remainingLimit, totalLimit, isActive, createdAt] = result as [
          bigint,
          bigint,
          bigint,
          boolean,
          bigint
        ]

        // Fetch permissions for this session key
        const permResult = await publicClient.readContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'getPermissions',
          args: [targetAccount, sessionKey],
        })

        const permissions: SessionKeyPermission[] = (
          permResult as Array<{ target: Address; selector: Hex; active: boolean }>
        ).map((p) => ({
          target: p.target,
          selector: p.selector,
          active: p.active,
        }))

        // Determine state
        let state: SessionKeyState = 'unknown'
        if (!isActive) {
          state = 'revoked'
        } else if (expiry > BigInt(0) && expiry < BigInt(Math.floor(Date.now() / 1000))) {
          state = 'expired'
        } else {
          state = 'active'
        }

        return {
          sessionKey,
          state,
          expiry,
          remainingLimit,
          totalLimit,
          permissions,
          createdAt,
        }
      } catch (err) {
        console.error('Failed to get session key state:', err)
        return null
      }
    },
    [targetAccount, publicClient]
  )

  // Check if session key has specific permission
  const checkPermission = useCallback(
    async (sessionKey: Address, target: Address, selector: Hex): Promise<boolean> => {
      if (!targetAccount || !publicClient) return false

      try {
        const result = await publicClient.readContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'hasPermission',
          args: [targetAccount, sessionKey, target, selector],
        })

        return result as boolean
      } catch (err) {
        console.error('Failed to check permission:', err)
        return false
      }
    },
    [targetAccount, publicClient]
  )

  // Refresh all session keys for the account
  const refresh = useCallback(async () => {
    if (!targetAccount || !publicClient) {
      setSessionKeys([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get all session keys for the account
      const result = await publicClient.readContract({
        address: SESSION_KEY_MANAGER,
        abi: SESSION_KEY_MANAGER_ABI,
        functionName: 'getSessionKeys',
        args: [targetAccount],
      })

      const sessionKeyAddresses = result as Address[]

      // Fetch state for each session key
      const keys: SessionKeyInfo[] = []
      for (const sk of sessionKeyAddresses) {
        const info = await getSessionKeyState(sk)
        if (info) {
          keys.push(info)
        }
      }

      setSessionKeys(keys)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session keys'
      setError(message)
      setSessionKeys([])
    } finally {
      setIsLoading(false)
    }
  }, [targetAccount, publicClient, getSessionKeyState])

  // Load session keys on mount and when account changes
  useEffect(() => {
    if (isConnected && targetAccount) {
      refresh()
    } else {
      setSessionKeys([])
    }
  }, [isConnected, targetAccount, refresh])

  // Create a new session key
  const createSessionKey = useCallback(
    async (
      params: CreateSessionKeyParams
    ): Promise<{ sessionKey: Address; txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsCreating(true)
      setError(null)

      try {
        // Generate a new session key address (in production, this would be a new keypair)
        // For now, we use a deterministic address based on timestamp
        const sessionKey = `0x${Date.now().toString(16).padStart(40, '0')}` as Address

        const expiry = params.expiry ?? BigInt(0)
        const spendingLimit = params.spendingLimit ?? BigInt(0)

        // Create session key transaction using writeContract
        const txHash = await walletClient.writeContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'createSessionKey',
          args: [sessionKey, expiry, spendingLimit],
        })

        // Grant initial permissions if provided
        if (params.permissions && params.permissions.length > 0) {
          for (const perm of params.permissions) {
            await walletClient.writeContract({
              address: SESSION_KEY_MANAGER,
              abi: SESSION_KEY_MANAGER_ABI,
              functionName: 'grantPermission',
              args: [sessionKey, perm.target, perm.selector, BigInt(0)],
            })
          }
        }

        // Refresh session keys
        await refresh()

        return { sessionKey, txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session key'
        setError(message)
        return null
      } finally {
        setIsCreating(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Revoke a session key
  const revokeSessionKey = useCallback(
    async (sessionKey: Address): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsRevoking(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'revokeSessionKey',
          args: [sessionKey],
        })

        // Refresh session keys
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke session key'
        setError(message)
        return null
      } finally {
        setIsRevoking(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Grant permission to a session key
  const grantPermission = useCallback(
    async (
      sessionKey: Address,
      permission: Permission
    ): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsGranting(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'grantPermission',
          args: [
            sessionKey,
            permission.target,
            permission.selector,
            permission.maxValue ?? BigInt(0),
          ],
        })

        // Refresh session keys
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to grant permission'
        setError(message)
        return null
      } finally {
        setIsGranting(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  // Revoke permission from a session key
  const revokePermission = useCallback(
    async (
      sessionKey: Address,
      target: Address,
      selector: Hex
    ): Promise<{ txHash: Hash } | null> => {
      if (!walletClient || !targetAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsGranting(true)
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: SESSION_KEY_MANAGER,
          abi: SESSION_KEY_MANAGER_ABI,
          functionName: 'revokePermission',
          args: [sessionKey, target, selector],
        })

        // Refresh session keys
        await refresh()

        return { txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke permission'
        setError(message)
        return null
      } finally {
        setIsGranting(false)
      }
    },
    [walletClient, targetAccount, refresh]
  )

  return {
    // State
    sessionKeys,
    isLoading,
    error,

    // Loading states
    isCreating,
    isRevoking,
    isGranting,

    // Operations
    createSessionKey,
    revokeSessionKey,
    grantPermission,
    revokePermission,

    // Queries
    getSessionKeyState,
    checkPermission,

    // Helpers
    refresh,
    clearError,
  }
}
