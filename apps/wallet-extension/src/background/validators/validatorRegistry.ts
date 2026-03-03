/**
 * ValidatorRegistry — per-account active validator state management.
 *
 * Tracks which validator each smart account currently uses for signing.
 * Persisted to chrome.storage.local for cross-session durability.
 */

import type { Address } from 'viem'
import { getEcdsaValidator } from '@stablenet/contracts'

// ============================================================================
// Types
// ============================================================================

export type ValidatorType = 'ecdsa' | 'webauthn' | 'multisig'

export interface ActiveValidatorConfig {
  /** On-chain validator contract address */
  validatorAddress: Address
  /** Validator type discriminator */
  validatorType: ValidatorType
  /** Type-specific configuration */
  config: ValidatorTypeConfig
}

/** Type-specific config variants */
export type ValidatorTypeConfig =
  | EcdsaConfig
  | WebAuthnConfig
  | MultiSigConfig

export interface EcdsaConfig {
  type: 'ecdsa'
}

export interface WebAuthnConfig {
  type: 'webauthn'
  credentialId: string
  pubKeyX: string
  pubKeyY: string
}

export interface MultiSigConfig {
  type: 'multisig'
  signers: Address[]
  threshold: number
}

/** Storage shape: chainId → accountAddress → config */
type RegistryState = Record<number, Record<string, ActiveValidatorConfig>>

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'stablenet_validator_registry'

// No hardcoded addresses — resolved via @stablenet/contracts at runtime

// ============================================================================
// ValidatorRegistry
// ============================================================================

export interface ValidatorRegistry {
  /** Get the active validator config for an account */
  getActiveValidator(chainId: number, account: Address): ActiveValidatorConfig
  /** Set the active validator for an account */
  setActiveValidator(chainId: number, account: Address, config: ActiveValidatorConfig): Promise<void>
  /** Get the validator type for an account */
  getActiveType(chainId: number, account: Address): ValidatorType
  /** Reset to ECDSA default */
  resetToDefault(chainId: number, account: Address): Promise<void>
  /** Load state from storage */
  load(): Promise<void>
}

export function createValidatorRegistry(): ValidatorRegistry {
  let state: RegistryState = {}

  function getDefaultConfig(chainId: number): ActiveValidatorConfig {
    return {
      validatorAddress: getEcdsaValidator(chainId),
      validatorType: 'ecdsa',
      config: { type: 'ecdsa' },
    }
  }

  const getActiveValidator = (chainId: number, account: Address): ActiveValidatorConfig => {
    const chainState = state[chainId]
    if (!chainState) return getDefaultConfig(chainId)
    const accountConfig = chainState[account.toLowerCase()]
    if (!accountConfig) return getDefaultConfig(chainId)
    return accountConfig
  }

  const setActiveValidator = async (
    chainId: number,
    account: Address,
    config: ActiveValidatorConfig
  ): Promise<void> => {
    if (!state[chainId]) {
      state[chainId] = {}
    }
    state[chainId][account.toLowerCase()] = config
    await persist()
  }

  const getActiveType = (chainId: number, account: Address): ValidatorType => {
    return getActiveValidator(chainId, account).validatorType
  }

  const resetToDefault = async (chainId: number, account: Address): Promise<void> => {
    await setActiveValidator(chainId, account, getDefaultConfig(chainId))
  }

  const load = async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      if (result[STORAGE_KEY]) {
        state = result[STORAGE_KEY] as RegistryState
      }
    } catch {
      // Storage unavailable (e.g., during tests) — use in-memory state
    }
  }

  async function persist(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: state })
    } catch {
      // Storage unavailable — state lives in memory only
    }
  }

  return {
    getActiveValidator,
    setActiveValidator,
    getActiveType,
    resetToDefault,
    load,
  }
}
