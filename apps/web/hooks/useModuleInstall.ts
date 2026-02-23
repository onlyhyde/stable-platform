'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Hex } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { getModuleEntry } from '@/lib/moduleAddresses'

import { useModule } from './useModule'
import { useSmartAccount } from './useSmartAccount'

// ============================================================================
// Types
// ============================================================================

export interface ModuleInstallRequest {
  moduleId: string
  initData?: Hex
}

export interface ModuleInstallResult {
  success: boolean
  txHash?: Hex
  error?: string
}

export interface UseModuleInstallReturn {
  /** Install a module on the connected smart account */
  installModule: (request: ModuleInstallRequest) => Promise<ModuleInstallResult>
  /** Uninstall a module from the connected smart account */
  uninstallModule: (request: ModuleInstallRequest) => Promise<ModuleInstallResult>
  /** Check if a specific marketplace module is installed */
  checkInstalled: (moduleId: string) => Promise<boolean>
  /** Load installed status for all known module IDs */
  loadInstalledModules: (moduleIds: string[]) => Promise<void>
  /** Set of currently installed module IDs */
  installedModules: Set<string>
  /** Module ID currently being installed */
  installingModuleId: string | null
  /** Module ID currently being uninstalled */
  uninstallingModuleId: string | null
  /** Whether any install is in progress */
  isInstalling: boolean
  /** Whether any uninstall is in progress */
  isUninstalling: boolean
  /** Whether initial installed-module check is loading */
  isCheckingInstalled: boolean
}

// ============================================================================
// Hook
// ============================================================================

export function useModuleInstall(): UseModuleInstallReturn {
  const { address, isConnected } = useAccount()
  const { status } = useSmartAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { buildInstallModuleCall, buildUninstallModuleCall, isModuleInstalled } = useModule()

  const [installedModules, setInstalledModules] = useState<Set<string>>(new Set())
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null)
  const [uninstallingModuleId, setUninstallingModuleId] = useState<string | null>(null)
  const [isCheckingInstalled, setIsCheckingInstalled] = useState(false)

  const fetchIdRef = useRef(0)

  // ============================================================================
  // Check single module
  // ============================================================================

  const checkInstalled = useCallback(
    async (moduleId: string): Promise<boolean> => {
      if (!address || !status.isSmartAccount) return false

      const entry = getModuleEntry(moduleId)
      if (!entry) return false

      return isModuleInstalled(address, entry.moduleType, entry.address)
    },
    [address, status.isSmartAccount, isModuleInstalled]
  )

  // ============================================================================
  // Batch check all modules
  // ============================================================================

  const loadInstalledModules = useCallback(
    async (moduleIds: string[]) => {
      if (!address || !status.isSmartAccount) {
        setInstalledModules(new Set())
        return
      }

      const id = ++fetchIdRef.current
      setIsCheckingInstalled(true)
      try {
        const results = await Promise.all(
          moduleIds.map(async (mid) => {
            const installed = await checkInstalled(mid)
            return { id: mid, installed }
          })
        )

        if (id !== fetchIdRef.current) return

        const installed = new Set(results.filter((r) => r.installed).map((r) => r.id))
        setInstalledModules(installed)
      } catch {
        // Keep existing state on error
      } finally {
        if (id === fetchIdRef.current) {
          setIsCheckingInstalled(false)
        }
      }
    },
    [address, status.isSmartAccount, checkInstalled]
  )

  // ============================================================================
  // Install module
  // ============================================================================

  const installModule = useCallback(
    async (request: ModuleInstallRequest): Promise<ModuleInstallResult> => {
      if (!isConnected || !address) {
        return { success: false, error: 'Wallet not connected' }
      }

      if (!status.isSmartAccount) {
        return { success: false, error: 'Account is not a Smart Account. Please upgrade first.' }
      }

      if (!walletClient) {
        return { success: false, error: 'Wallet client not available' }
      }

      if (!publicClient) {
        return { success: false, error: 'Public client not available' }
      }

      const entry = getModuleEntry(request.moduleId)
      if (!entry) {
        return { success: false, error: `Unknown module: ${request.moduleId}` }
      }

      // Check if already installed
      const alreadyInstalled = await isModuleInstalled(address, entry.moduleType, entry.address)
      if (alreadyInstalled) {
        setInstalledModules((prev) => new Set([...prev, request.moduleId]))
        return { success: false, error: 'Module is already installed' }
      }

      setInstallingModuleId(request.moduleId)

      try {
        const initData = request.initData ?? entry.defaultInitData

        // Build the installModule calldata (self-call on smart account)
        const callData = buildInstallModuleCall(address, {
          moduleType: entry.moduleType,
          module: entry.address,
          initData,
        })

        // Send transaction via connected wallet (EIP-7702 self-call)
        const txHash = await walletClient.sendTransaction({
          to: callData.to,
          data: callData.data,
          value: callData.value,
        })

        // Wait for confirmation (60s timeout)
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          return { success: false, txHash, error: 'Transaction reverted' }
        }

        // Update installed set
        setInstalledModules((prev) => new Set([...prev, request.moduleId]))

        return { success: true, txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Installation failed'
        // Extract first line for cleaner display
        return { success: false, error: message.split('\n')[0] }
      } finally {
        setInstallingModuleId(null)
      }
    },
    [
      isConnected,
      address,
      status.isSmartAccount,
      walletClient,
      publicClient,
      isModuleInstalled,
      buildInstallModuleCall,
    ]
  )

  // ============================================================================
  // Uninstall module
  // ============================================================================

  const uninstallModule = useCallback(
    async (request: ModuleInstallRequest): Promise<ModuleInstallResult> => {
      if (!isConnected || !address) {
        return { success: false, error: 'Wallet not connected' }
      }

      if (!status.isSmartAccount) {
        return { success: false, error: 'Account is not a Smart Account.' }
      }

      if (!walletClient) {
        return { success: false, error: 'Wallet client not available' }
      }

      if (!publicClient) {
        return { success: false, error: 'Public client not available' }
      }

      const entry = getModuleEntry(request.moduleId)
      if (!entry) {
        return { success: false, error: `Unknown module: ${request.moduleId}` }
      }

      // Check if actually installed
      const currentlyInstalled = await isModuleInstalled(address, entry.moduleType, entry.address)
      if (!currentlyInstalled) {
        setInstalledModules((prev) => {
          const next = new Set(prev)
          next.delete(request.moduleId)
          return next
        })
        return { success: false, error: 'Module is not installed' }
      }

      setUninstallingModuleId(request.moduleId)

      try {
        const deInitData = request.initData ?? '0x'

        // Build the uninstallModule calldata (self-call on smart account)
        const callData = buildUninstallModuleCall(address, {
          moduleType: entry.moduleType,
          module: entry.address,
          deInitData,
        })

        // Send transaction via connected wallet (EIP-7702 self-call)
        const txHash = await walletClient.sendTransaction({
          to: callData.to,
          data: callData.data,
          value: callData.value,
        })

        // Wait for confirmation (60s timeout)
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        })

        if (receipt.status !== 'success') {
          return { success: false, txHash, error: 'Transaction reverted' }
        }

        // Update installed set
        setInstalledModules((prev) => {
          const next = new Set(prev)
          next.delete(request.moduleId)
          return next
        })

        return { success: true, txHash }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Uninstall failed'
        return { success: false, error: message.split('\n')[0] }
      } finally {
        setUninstallingModuleId(null)
      }
    },
    [
      isConnected,
      address,
      status.isSmartAccount,
      walletClient,
      publicClient,
      isModuleInstalled,
      buildUninstallModuleCall,
    ]
  )

  // ============================================================================
  // Reset on account change
  // ============================================================================

  useEffect(() => {
    setInstalledModules(new Set())
    setInstallingModuleId(null)
    setUninstallingModuleId(null)
  }, [])

  return {
    installModule,
    uninstallModule,
    checkInstalled,
    loadInstalledModules,
    installedModules,
    installingModuleId,
    uninstallingModuleId,
    isInstalling: installingModuleId !== null,
    isUninstalling: uninstallingModuleId !== null,
    isCheckingInstalled,
  }
}
