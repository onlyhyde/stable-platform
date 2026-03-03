'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useWalletClient } from 'wagmi'
import {
  createValidatorRouter,
  type ValidatorRouter,
  type Validator,
} from '@stablenet/core'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
import type { LocalAccount } from 'viem'

// ============================================================================
// Types
// ============================================================================

export type ValidatorType = 'ecdsa' | 'webauthn' | 'multisig'

export interface InstalledValidatorInfo {
  address: Address
  type: ValidatorType
  label: string
  isRoot: boolean
}

export interface UseValidatorRouterConfig {
  /** The ECDSA signer (root validator). If not provided, uses walletClient. */
  signer?: LocalAccount
  /** Pre-installed validators to register (WebAuthn, MultiSig) */
  installedValidators?: Validator[]
  /** Type mapping for installed validators — address (lowercase) → ValidatorType */
  validatorTypes?: Record<string, ValidatorType>
}

export interface UseValidatorRouterReturn {
  /** The currently active validator address */
  activeValidator: Address | null
  /** The active validator type */
  activeType: ValidatorType
  /** List of all registered validators */
  validators: InstalledValidatorInfo[]
  /** Switch the active validator */
  switchValidator: (address: Address) => void
  /** Sign a hash with the active validator */
  signHash: (hash: Hex) => Promise<Hex>
  /** Get the nonce key for the active validator */
  getNonceKey: () => bigint
  /** The underlying router instance (for advanced usage) */
  router: ValidatorRouter | null
  /** Whether the root validator is active */
  isRootActive: boolean
}

// Stable empty array reference to avoid infinite re-render from default param
const EMPTY_VALIDATORS: Validator[] = []

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing multiple validators on a Kernel smart account.
 *
 * Wraps the SDK's `createValidatorRouter` for React integration.
 * Provides active validator switching, signing delegation, and nonce key computation.
 *
 * @example
 * ```tsx
 * const { activeType, validators, switchValidator, signHash, getNonceKey } =
 *   useValidatorRouter({
 *     signer: localAccount,
 *     installedValidators: [webAuthnValidator, multiSigValidator],
 *     validatorTypes: {
 *       [webAuthnValidator.address.toLowerCase()]: 'webauthn',
 *       [multiSigValidator.address.toLowerCase()]: 'multisig',
 *     },
 *   })
 * ```
 */
export function useValidatorRouter(
  config: UseValidatorRouterConfig = {}
): UseValidatorRouterReturn {
  const { signer, installedValidators = EMPTY_VALIDATORS, validatorTypes } = config
  const { data: walletClient } = useWalletClient()

  const [activeAddress, setActiveAddress] = useState<Address | null>(null)
  const [router, setRouter] = useState<ValidatorRouter | null>(null)

  // Use ref to track initialization and avoid duplicate async calls
  const initRef = useRef<LocalAccount | null>(null)

  // Initialize router when signer changes — useEffect (not useMemo) for async + setState
  useEffect(() => {
    if (!signer) {
      setRouter(null)
      setActiveAddress(null)
      return
    }

    // Avoid re-initializing for the same signer
    if (initRef.current === signer) return
    initRef.current = signer

    let cancelled = false

    createEcdsaValidator({ signer }).then((rootValidator) => {
      if (cancelled) return
      const r = createValidatorRouter({
        rootValidator,
        installedValidators,
      })
      setRouter(r)
      setActiveAddress(rootValidator.address)
    })

    return () => {
      cancelled = true
    }
  }, [signer, installedValidators])

  const inferType = useCallback(
    (address: Address, isRoot: boolean): ValidatorType => {
      if (isRoot) return 'ecdsa'
      const key = address.toLowerCase()
      if (validatorTypes && key in validatorTypes) {
        return validatorTypes[key]
      }
      return 'ecdsa'
    },
    [validatorTypes]
  )

  const activeType: ValidatorType = useMemo(() => {
    if (!router || !activeAddress) return 'ecdsa'
    return inferType(activeAddress, router.isRoot(activeAddress))
  }, [router, activeAddress, inferType])

  const validators: InstalledValidatorInfo[] = useMemo(() => {
    if (!router) return []
    return router.getValidators().map((v) => {
      const isRoot = router.isRoot(v.address)
      const type = inferType(v.address, isRoot)
      return {
        address: v.address,
        type,
        label: isRoot ? 'ECDSA (Root)' : `${type.charAt(0).toUpperCase() + type.slice(1)} ${v.address.slice(0, 8)}...`,
        isRoot,
      }
    })
  }, [router, inferType])

  const switchValidator = useCallback(
    (address: Address) => {
      if (!router) return
      router.setActiveValidator(address)
      setActiveAddress(address)
    },
    [router]
  )

  const signHash = useCallback(
    async (hash: Hex): Promise<Hex> => {
      if (router) {
        return router.getActiveValidator().signHash(hash)
      }
      if (walletClient) {
        return walletClient.signMessage({ message: { raw: hash } })
      }
      throw new Error('No validator or wallet connected')
    },
    [router, walletClient]
  )

  const getNonceKey = useCallback((): bigint => {
    if (!router) return 0n
    return router.getActiveNonceKey()
  }, [router])

  const isRootActive = useMemo(() => {
    if (!router || !activeAddress) return true
    return router.isRoot(activeAddress)
  }, [router, activeAddress])

  return {
    activeValidator: activeAddress,
    activeType,
    validators,
    switchValidator,
    signHash,
    getNonceKey,
    router,
    isRootActive,
  }
}
