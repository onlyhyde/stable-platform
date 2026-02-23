'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { MODULE_TYPES, useModule } from './useModule'
import { useSmartAccount } from './useSmartAccount'

// ============================================================================
// Constants
// ============================================================================

const SOCIAL_RECOVERY_VALIDATOR = '0x38fb544beee122a2ea593e7d9c8f019751273287' as const

const STORAGE_KEY = 'stablenet_recovery_guardians'

// WeightedECDSA Validator ABI (minimal)
const WEIGHTED_ECDSA_ABI = [
  {
    type: 'function',
    name: 'getGuardians',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'guardians', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getThreshold',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addGuardian',
    inputs: [
      { name: 'guardian', type: 'address' },
      { name: 'weight', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeGuardian',
    inputs: [{ name: 'guardian', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setThreshold',
    inputs: [{ name: 'threshold', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// ============================================================================
// Types
// ============================================================================

export interface Guardian {
  address: Address
  weight: number
  label?: string
}

export interface RecoveryConfig {
  guardians: Guardian[]
  threshold: number
  isInstalled: boolean
}

export interface UseRecoveryModuleReturn {
  config: RecoveryConfig
  isLoading: boolean
  isInstalling: boolean
  error: string | null

  /** Install social recovery module with initial guardians */
  setupRecovery: (guardians: Guardian[], threshold: number) => Promise<boolean>
  /** Add a guardian to existing setup */
  addGuardian: (guardian: Guardian) => Promise<boolean>
  /** Remove a guardian */
  removeGuardian: (address: Address) => Promise<boolean>
  /** Update threshold */
  updateThreshold: (threshold: number) => Promise<boolean>
  /** Check if module is installed */
  checkInstalled: () => Promise<boolean>
  /** Refresh guardian list from chain */
  refresh: () => Promise<void>
  /** Update local guardian label */
  setGuardianLabel: (address: Address, label: string) => void
}

// ============================================================================
// Helper: encode init data for WeightedECDSA
// ============================================================================

function encodeWeightedECDSAInit(guardians: Guardian[], threshold: number): Hex {
  const thresholdHex = threshold.toString(16).padStart(64, '0')
  const countHex = guardians.length.toString(16).padStart(64, '0')
  const guardiansHex = guardians
    .map((g) => {
      const addrHex = g.address.slice(2).toLowerCase().padStart(64, '0')
      const weightHex = g.weight.toString(16).padStart(64, '0')
      return `${addrHex}${weightHex}`
    })
    .join('')
  return `0x${thresholdHex}${countHex}${guardiansHex}` as Hex
}

// ============================================================================
// Hook
// ============================================================================

export function useRecoveryModule(): UseRecoveryModuleReturn {
  const { address } = useAccount()
  const { status } = useSmartAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { buildInstallModuleCall, isModuleInstalled } = useModule()

  const [config, setConfig] = useState<RecoveryConfig>({
    guardians: [],
    threshold: 0,
    isInstalled: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isInstalling, setIsInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  // Load guardian labels from localStorage
  const loadLabels = useCallback((): Record<string, string> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {
      // ignore
    }
    return {}
  }, [])

  const saveLabels = useCallback((labels: Record<string, string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels))
  }, [])

  // Check if social recovery module is installed
  const checkInstalled = useCallback(async (): Promise<boolean> => {
    if (!address || !status.isSmartAccount) return false
    try {
      return await isModuleInstalled(address, MODULE_TYPES.VALIDATOR, SOCIAL_RECOVERY_VALIDATOR)
    } catch {
      return false
    }
  }, [address, status.isSmartAccount, isModuleInstalled])

  // Fetch guardians from chain
  const fetchGuardians = useCallback(async () => {
    if (!address || !publicClient) return

    try {
      const result = await publicClient.readContract({
        address: SOCIAL_RECOVERY_VALIDATOR,
        abi: WEIGHTED_ECDSA_ABI,
        functionName: 'getGuardians',
        args: [address],
      })

      const [addresses, weights] = result as [Address[], bigint[]]
      const labels = loadLabels()

      const guardians: Guardian[] = addresses.map((addr, i) => ({
        address: addr,
        weight: Number(weights[i]),
        label: labels[addr.toLowerCase()] || undefined,
      }))

      const thresholdResult = await publicClient.readContract({
        address: SOCIAL_RECOVERY_VALIDATOR,
        abi: WEIGHTED_ECDSA_ABI,
        functionName: 'getThreshold',
        args: [address],
      })

      setConfig({
        guardians,
        threshold: Number(thresholdResult),
        isInstalled: true,
      })
    } catch {
      // Contract may not support getGuardians, or module not installed
      // Keep localStorage-based config as fallback
    }
  }, [address, publicClient, loadLabels])

  // Refresh from chain
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const id = ++fetchIdRef.current
    try {
      const installed = await checkInstalled()
      if (installed) {
        await fetchGuardians()
      } else {
        if (id !== fetchIdRef.current) return
        setConfig({ guardians: [], threshold: 0, isInstalled: false })
      }
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [checkInstalled, fetchGuardians])

  // Setup recovery (install module)
  const setupRecovery = useCallback(
    async (guardians: Guardian[], threshold: number): Promise<boolean> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return false
      }
      if (!status.isSmartAccount) {
        setError('Account must be a Smart Account')
        return false
      }

      setIsInstalling(true)
      setError(null)

      try {
        const initData = encodeWeightedECDSAInit(guardians, threshold)

        const callData = buildInstallModuleCall(address, {
          moduleType: MODULE_TYPES.VALIDATOR,
          module: SOCIAL_RECOVERY_VALIDATOR,
          initData,
        })

        const txHash = await walletClient.sendTransaction({
          to: callData.to,
          data: callData.data,
          value: callData.value,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          setError('Transaction reverted')
          return false
        }

        // Save labels locally
        const labels = loadLabels()
        for (const g of guardians) {
          if (g.label) {
            labels[g.address.toLowerCase()] = g.label
          }
        }
        saveLabels(labels)

        setConfig({ guardians, threshold, isInstalled: true })
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message.split('\n')[0] : 'Setup failed')
        return false
      } finally {
        setIsInstalling(false)
      }
    },
    [
      address,
      walletClient,
      publicClient,
      status.isSmartAccount,
      buildInstallModuleCall,
      loadLabels,
      saveLabels,
    ]
  )

  // Add guardian
  const addGuardian = useCallback(
    async (guardian: Guardian): Promise<boolean> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return false
      }

      setIsInstalling(true)
      setError(null)

      try {
        const data = encodeFunctionData({
          abi: WEIGHTED_ECDSA_ABI,
          functionName: 'addGuardian',
          args: [guardian.address, BigInt(guardian.weight)],
        })

        const txHash = await walletClient.sendTransaction({
          to: SOCIAL_RECOVERY_VALIDATOR,
          data,
          value: 0n,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          setError('Transaction reverted')
          return false
        }

        // Save label locally
        if (guardian.label) {
          const labels = loadLabels()
          labels[guardian.address.toLowerCase()] = guardian.label
          saveLabels(labels)
        }

        setConfig((prev) => ({
          ...prev,
          guardians: [...prev.guardians, guardian],
        }))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message.split('\n')[0] : 'Add guardian failed')
        return false
      } finally {
        setIsInstalling(false)
      }
    },
    [address, walletClient, publicClient, loadLabels, saveLabels]
  )

  // Remove guardian
  const removeGuardian = useCallback(
    async (guardianAddress: Address): Promise<boolean> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return false
      }

      setIsInstalling(true)
      setError(null)

      try {
        const data = encodeFunctionData({
          abi: WEIGHTED_ECDSA_ABI,
          functionName: 'removeGuardian',
          args: [guardianAddress],
        })

        const txHash = await walletClient.sendTransaction({
          to: SOCIAL_RECOVERY_VALIDATOR,
          data,
          value: 0n,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          setError('Transaction reverted')
          return false
        }

        setConfig((prev) => ({
          ...prev,
          guardians: prev.guardians.filter(
            (g) => g.address.toLowerCase() !== guardianAddress.toLowerCase()
          ),
        }))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message.split('\n')[0] : 'Remove guardian failed')
        return false
      } finally {
        setIsInstalling(false)
      }
    },
    [address, walletClient, publicClient]
  )

  // Update threshold
  const updateThreshold = useCallback(
    async (threshold: number): Promise<boolean> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return false
      }

      setIsInstalling(true)
      setError(null)

      try {
        const data = encodeFunctionData({
          abi: WEIGHTED_ECDSA_ABI,
          functionName: 'setThreshold',
          args: [BigInt(threshold)],
        })

        const txHash = await walletClient.sendTransaction({
          to: SOCIAL_RECOVERY_VALIDATOR,
          data,
          value: 0n,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          setError('Transaction reverted')
          return false
        }

        setConfig((prev) => ({ ...prev, threshold }))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message.split('\n')[0] : 'Update threshold failed')
        return false
      } finally {
        setIsInstalling(false)
      }
    },
    [address, walletClient, publicClient]
  )

  // Set guardian label (local only)
  const setGuardianLabel = useCallback(
    (guardianAddress: Address, label: string) => {
      const labels = loadLabels()
      labels[guardianAddress.toLowerCase()] = label
      saveLabels(labels)

      setConfig((prev) => ({
        ...prev,
        guardians: prev.guardians.map((g) =>
          g.address.toLowerCase() === guardianAddress.toLowerCase() ? { ...g, label } : g
        ),
      }))
    },
    [loadLabels, saveLabels]
  )

  // Auto-check on mount
  useEffect(() => {
    if (address && status.isSmartAccount) {
      refresh()
    }
  }, [address, status.isSmartAccount, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    config,
    isLoading,
    isInstalling,
    error,
    setupRecovery,
    addGuardian,
    removeGuardian,
    updateThreshold,
    checkInstalled,
    refresh,
    setGuardianLabel,
  }
}
