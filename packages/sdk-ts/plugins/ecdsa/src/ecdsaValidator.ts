import type { Validator } from '@stablenet/sdk-types'
import { ECDSA_VALIDATOR_ADDRESS } from '@stablenet/sdk-types'
import type { Address, Hex, LocalAccount } from 'viem'

/**
 * Configuration for creating an ECDSA validator
 */
export interface CreateEcdsaValidatorConfig {
  /** The signer account (from viem) */
  signer: LocalAccount
  /** The validator contract address (defaults to standard ECDSA validator) */
  validatorAddress?: Address
}

/**
 * Create an ECDSA validator for Kernel smart accounts
 *
 * The ECDSA validator uses standard ECDSA signatures for validation.
 * It's the most common validator type for simple EOA-backed smart accounts.
 *
 * @example
 * ```ts
 * import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
 * import { privateKeyToAccount } from 'viem/accounts'
 *
 * const signer = privateKeyToAccount('0x...')
 * const validator = await createEcdsaValidator({ signer })
 *
 * // Use with Kernel account
 * const account = await toKernelSmartAccount({
 *   client,
 *   validator,
 * })
 * ```
 */
export async function createEcdsaValidator(config: CreateEcdsaValidatorConfig): Promise<Validator> {
  const { signer, validatorAddress = ECDSA_VALIDATOR_ADDRESS } = config

  const address = validatorAddress
  const signerAddress = signer.address

  const getInitData = async (): Promise<Hex> => {
    // For ECDSA validator, init data is just the signer address (20 bytes)
    // This is used during account initialization to set the owner
    return signerAddress as Hex
  }

  const signHash = async (hash: Hex): Promise<Hex> => {
    // Sign the hash with the ECDSA signer
    // For ERC-4337, we sign the userOpHash directly
    const signature = await signer.signMessage({
      message: { raw: hash },
    })
    return signature
  }

  const getSignerAddress = (): Address => {
    return signerAddress
  }

  return {
    address,
    type: 'validator',
    getInitData,
    signHash,
    getSignerAddress,
  }
}

/**
 * Create an ECDSA validator from a private key
 *
 * @example
 * ```ts
 * import { createEcdsaValidatorFromPrivateKey } from '@stablenet/plugin-ecdsa'
 *
 * const validator = await createEcdsaValidatorFromPrivateKey({
 *   privateKey: '0x...',
 * })
 * ```
 */
export async function createEcdsaValidatorFromPrivateKey(config: {
  privateKey: Hex
  validatorAddress?: Address
}): Promise<Validator> {
  // Dynamic import to avoid bundling issues
  const { privateKeyToAccount } = await import('viem/accounts')
  const signer = privateKeyToAccount(config.privateKey)

  return createEcdsaValidator({
    signer,
    validatorAddress: config.validatorAddress,
  })
}

/**
 * Serialize ECDSA validator configuration for storage
 */
export function serializeEcdsaValidator(validator: Validator): {
  address: Address
  signerAddress: Address
} {
  return {
    address: validator.address,
    signerAddress: validator.getSignerAddress(),
  }
}

export type EcdsaValidator = Validator
