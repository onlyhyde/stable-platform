import type { Validator } from '@stablenet/sdk-types'
import type { Address } from 'viem'
import {
  encodeValidatorNonceKey,
  VALIDATION_TYPE,
} from './utils/nonceUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * ValidatorRouter manages multiple installed validators and routes
 * signing/nonce operations to the currently active one.
 */
export interface ValidatorRouter {
  /** Get the currently active validator */
  getActiveValidator(): Validator
  /** Switch the active validator by address */
  setActiveValidator(address: Address): void
  /** Register a new validator */
  registerValidator(validator: Validator): void
  /** Unregister a validator (cannot unregister root) */
  unregisterValidator(address: Address): void
  /** Get all registered validators */
  getValidators(): Validator[]
  /** Check if an address is the root validator */
  isRoot(address: Address): boolean
  /** Get the root validator */
  getRootValidator(): Validator
  /** Get the nonce key for the active validator (0n for root, encoded key for non-root) */
  getActiveNonceKey(): bigint
}

/**
 * Configuration for creating a ValidatorRouter
 */
export interface ValidatorRouterConfig {
  /** The root validator (installed at account creation) */
  rootValidator: Validator
  /** Additional installed validators */
  installedValidators?: Validator[]
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a ValidatorRouter that manages multiple validators.
 *
 * The router defaults to the root validator. Non-root validators
 * produce encoded nonce keys that the EntryPoint uses to route
 * validation to the correct on-chain validator module.
 *
 * @example
 * ```ts
 * const router = createValidatorRouter({
 *   rootValidator: ecdsaValidator,
 *   installedValidators: [webAuthnValidator, multiSigValidator],
 * })
 *
 * router.setActiveValidator(webAuthnValidator.address)
 * const nonceKey = router.getActiveNonceKey() // encoded for EntryPoint
 * ```
 */
export function createValidatorRouter(config: ValidatorRouterConfig): ValidatorRouter {
  const { rootValidator, installedValidators = [] } = config

  const rootAddress = rootValidator.address.toLowerCase()
  const validators = new Map<string, Validator>()
  let activeAddress = rootAddress

  // Register root
  validators.set(rootAddress, rootValidator)

  // Register installed validators
  for (const v of installedValidators) {
    validators.set(v.address.toLowerCase(), v)
  }

  const getActiveValidator = (): Validator => {
    return validators.get(activeAddress)!
  }

  const setActiveValidator = (address: Address): void => {
    const key = address.toLowerCase()
    if (!validators.has(key)) {
      throw new Error(`Validator ${address} is not registered`)
    }
    activeAddress = key
  }

  const registerValidator = (validator: Validator): void => {
    validators.set(validator.address.toLowerCase(), validator)
  }

  const unregisterValidator = (address: Address): void => {
    const key = address.toLowerCase()
    if (key === rootAddress) {
      throw new Error('Cannot unregister root validator')
    }
    if (activeAddress === key) {
      activeAddress = rootAddress
    }
    validators.delete(key)
  }

  const getValidators = (): Validator[] => {
    return Array.from(validators.values())
  }

  const isRoot = (address: Address): boolean => {
    return address.toLowerCase() === rootAddress
  }

  const getRootValidator = (): Validator => {
    return validators.get(rootAddress)!
  }

  const getActiveNonceKey = (): bigint => {
    if (activeAddress === rootAddress) {
      return 0n
    }
    const activeValidator = validators.get(activeAddress)!
    return encodeValidatorNonceKey(activeValidator.address, {
      type: VALIDATION_TYPE.VALIDATOR,
    })
  }

  return {
    getActiveValidator,
    setActiveValidator,
    registerValidator,
    unregisterValidator,
    getValidators,
    isRoot,
    getRootValidator,
    getActiveNonceKey,
  }
}
