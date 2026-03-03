'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { useStableNetContext } from '@/providers'

// ============================================================================
// Types
// ============================================================================

export type ModuleType = 1n | 2n | 3n | 4n

export const MODULE_TYPES = {
  VALIDATOR: 1n,
  EXECUTOR: 2n,
  FALLBACK: 3n,
  HOOK: 4n,
} as const

export interface ModuleInfo {
  address: Address
  type: ModuleType
  isInstalled: boolean
  name?: string
}

export interface InstallModuleParams {
  moduleType: ModuleType
  module: Address
  initData: Hex
}

export interface UninstallModuleParams {
  moduleType: ModuleType
  module: Address
  deInitData: Hex
}

export interface ReplaceModuleParams {
  moduleType: ModuleType
  oldModule: Address
  deInitData: Hex
  newModule: Address
  initData: Hex
}

export interface ForceUninstallModuleParams {
  moduleType: ModuleType
  module: Address
  deInitData: Hex
}

export interface ModuleCallData {
  to: Address
  data: Hex
  value: bigint
}

// Kernel Module ABI (minimal)
const KERNEL_MODULE_ABI = [
  {
    type: 'function',
    name: 'installModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'initData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'uninstallModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'deInitData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'isModuleInstalled',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'additionalContext', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'forceUninstallModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'deInitData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'replaceModule',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'oldModule', type: 'address' },
      { name: 'deInitData', type: 'bytes' },
      { name: 'newModule', type: 'address' },
      { name: 'initData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

// ============================================================================
// Hook Implementation
// ============================================================================

export function useModule() {
  const { publicClient } = useStableNetContext()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Encode install module call data
   */
  const encodeInstallModule = useCallback((params: InstallModuleParams): Hex => {
    return encodeFunctionData({
      abi: KERNEL_MODULE_ABI,
      functionName: 'installModule',
      args: [params.moduleType, params.module, params.initData],
    })
  }, [])

  /**
   * Encode uninstall module call data
   */
  const encodeUninstallModule = useCallback((params: UninstallModuleParams): Hex => {
    return encodeFunctionData({
      abi: KERNEL_MODULE_ABI,
      functionName: 'uninstallModule',
      args: [params.moduleType, params.module, params.deInitData],
    })
  }, [])

  /**
   * Build install module call for smart account
   */
  const buildInstallModuleCall = useCallback(
    (smartAccount: Address, params: InstallModuleParams): ModuleCallData => {
      return {
        to: smartAccount,
        data: encodeInstallModule(params),
        value: 0n,
      }
    },
    [encodeInstallModule]
  )

  /**
   * Build uninstall module call for smart account
   */
  const buildUninstallModuleCall = useCallback(
    (smartAccount: Address, params: UninstallModuleParams): ModuleCallData => {
      return {
        to: smartAccount,
        data: encodeUninstallModule(params),
        value: 0n,
      }
    },
    [encodeUninstallModule]
  )

  /**
   * Encode force uninstall module call data
   */
  const encodeForceUninstallModule = useCallback((params: ForceUninstallModuleParams): Hex => {
    return encodeFunctionData({
      abi: KERNEL_MODULE_ABI,
      functionName: 'forceUninstallModule',
      args: [params.moduleType, params.module, params.deInitData],
    })
  }, [])

  /**
   * Encode replace module call data
   */
  const encodeReplaceModule = useCallback((params: ReplaceModuleParams): Hex => {
    return encodeFunctionData({
      abi: KERNEL_MODULE_ABI,
      functionName: 'replaceModule',
      args: [
        params.moduleType,
        params.oldModule,
        params.deInitData,
        params.newModule,
        params.initData,
      ],
    })
  }, [])

  /**
   * Build force uninstall module call for smart account
   */
  const buildForceUninstallModuleCall = useCallback(
    (smartAccount: Address, params: ForceUninstallModuleParams): ModuleCallData => {
      return {
        to: smartAccount,
        data: encodeForceUninstallModule(params),
        value: 0n,
      }
    },
    [encodeForceUninstallModule]
  )

  /**
   * Build replace module call for smart account
   */
  const buildReplaceModuleCall = useCallback(
    (smartAccount: Address, params: ReplaceModuleParams): ModuleCallData => {
      return {
        to: smartAccount,
        data: encodeReplaceModule(params),
        value: 0n,
      }
    },
    [encodeReplaceModule]
  )

  /**
   * Check if a module is installed
   */
  const isModuleInstalled = useCallback(
    async (smartAccount: Address, moduleType: ModuleType, module: Address): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await publicClient.readContract({
          address: smartAccount,
          abi: KERNEL_MODULE_ABI,
          functionName: 'isModuleInstalled',
          args: [moduleType, module, '0x'],
        })
        return result as boolean
      } catch {
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [publicClient]
  )

  /**
   * Get module type name
   */
  const getModuleTypeName = useCallback((moduleType: ModuleType): string => {
    switch (moduleType) {
      case MODULE_TYPES.VALIDATOR:
        return 'Validator'
      case MODULE_TYPES.EXECUTOR:
        return 'Executor'
      case MODULE_TYPES.FALLBACK:
        return 'Fallback'
      case MODULE_TYPES.HOOK:
        return 'Hook'
      default:
        return 'Unknown'
    }
  }, [])

  // ============================================================================
  // Validator Init Data Encoders
  // ============================================================================

  /**
   * Encode ECDSA validator init data
   */
  const encodeECDSAValidatorInit = useCallback((owner: Address): Hex => {
    return owner.toLowerCase() as Hex
  }, [])

  /**
   * Encode MultiSig validator init data
   */
  const encodeMultiSigValidatorInit = useCallback(
    (config: { signers: Address[]; threshold: number }): Hex => {
      const thresholdHex = config.threshold.toString(16).padStart(64, '0')
      const signerCountHex = config.signers.length.toString(16).padStart(64, '0')
      const signersHex = config.signers
        .map((s) => s.slice(2).toLowerCase().padStart(64, '0'))
        .join('')
      return `0x${thresholdHex}${signerCountHex}${signersHex}` as Hex
    },
    []
  )

  // ============================================================================
  // Executor Init Data Encoders
  // ============================================================================

  /**
   * Encode session key executor init data
   */
  const encodeSessionKeyExecutorInit = useCallback((): Hex => {
    return '0x'
  }, [])

  /**
   * Encode swap executor init data
   */
  const encodeSwapExecutorInit = useCallback(
    (config: { maxSlippageBps: number; dailyLimit: bigint }): Hex => {
      const slippageHex = config.maxSlippageBps.toString(16).padStart(64, '0')
      const limitHex = config.dailyLimit.toString(16).padStart(64, '0')
      return `0x${slippageHex}${limitHex}` as Hex
    },
    []
  )

  /**
   * Encode lending executor init data
   */
  const encodeLendingExecutorInit = useCallback(
    (config: { maxLtv: number; minHealthFactor: bigint; dailyBorrowLimit: bigint }): Hex => {
      const ltvHex = config.maxLtv.toString(16).padStart(64, '0')
      const hfHex = config.minHealthFactor.toString(16).padStart(64, '0')
      const limitHex = config.dailyBorrowLimit.toString(16).padStart(64, '0')
      return `0x${ltvHex}${hfHex}${limitHex}` as Hex
    },
    []
  )

  /**
   * Encode staking executor init data
   */
  const encodeStakingExecutorInit = useCallback(
    (config: { maxStakePerPool: bigint; dailyStakeLimit: bigint }): Hex => {
      const maxStakeHex = config.maxStakePerPool.toString(16).padStart(64, '0')
      const limitHex = config.dailyStakeLimit.toString(16).padStart(64, '0')
      return `0x${maxStakeHex}${limitHex}` as Hex
    },
    []
  )

  // ============================================================================
  // Hook Init Data Encoders
  // ============================================================================

  /**
   * Encode spending limit hook init data
   */
  const encodeSpendingLimitHookInit = useCallback(
    (config: { token: Address; limit: bigint; period: bigint }): Hex => {
      const tokenHex = config.token.slice(2).toLowerCase().padStart(64, '0')
      const limitHex = config.limit.toString(16).padStart(64, '0')
      const periodHex = config.period.toString(16).padStart(64, '0')
      return `0x${tokenHex}${limitHex}${periodHex}` as Hex
    },
    []
  )

  /**
   * Encode health factor hook init data
   */
  const encodeHealthFactorHookInit = useCallback((config: { minHealthFactor: bigint }): Hex => {
    const hfHex = config.minHealthFactor.toString(16).padStart(64, '0')
    return `0x${hfHex}` as Hex
  }, [])

  /**
   * Encode policy hook init data
   */
  const encodePolicyHookInit = useCallback(
    (config: { maxValue: bigint; dailyLimit: bigint }): Hex => {
      const maxValueHex = config.maxValue.toString(16).padStart(64, '0')
      const limitHex = config.dailyLimit.toString(16).padStart(64, '0')
      return `0x${maxValueHex}${limitHex}` as Hex
    },
    []
  )

  return {
    // Module types
    MODULE_TYPES,
    getModuleTypeName,

    // Core functions
    encodeInstallModule,
    encodeUninstallModule,
    encodeForceUninstallModule,
    encodeReplaceModule,
    buildInstallModuleCall,
    buildUninstallModuleCall,
    buildForceUninstallModuleCall,
    buildReplaceModuleCall,
    isModuleInstalled,

    // Validator init data encoders
    encodeECDSAValidatorInit,
    encodeMultiSigValidatorInit,

    // Executor init data encoders
    encodeSessionKeyExecutorInit,
    encodeSwapExecutorInit,
    encodeLendingExecutorInit,
    encodeStakingExecutorInit,

    // Hook init data encoders
    encodeSpendingLimitHookInit,
    encodeHealthFactorHookInit,
    encodePolicyHookInit,

    // State
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
