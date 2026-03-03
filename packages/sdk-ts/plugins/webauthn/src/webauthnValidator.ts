import type { Validator } from '@stablenet/sdk-types'
import {
  encodeWebAuthnSignature,
  encodeWebAuthnValidatorInit,
  type WebAuthnSignatureData,
} from '@stablenet/core'
import { getWebAuthnValidator as getWebAuthnValidatorAddress } from '@stablenet/contracts'
import type { Address, Hex } from 'viem'
import { keccak256, toBytes } from 'viem'

/**
 * Configuration for creating a WebAuthn validator
 */
export interface CreateWebAuthnValidatorConfig {
  /** WebAuthn credential public key X coordinate */
  pubKeyX: bigint
  /** WebAuthn credential public key Y coordinate */
  pubKeyY: bigint
  /** WebAuthn credential ID */
  credentialId: Hex
  /**
   * Signing function — provided by the Product layer (browser/extension).
   * Called with the challenge hash, returns raw WebAuthn assertion data.
   */
  signFn: (challenge: Hex) => Promise<WebAuthnSignatureData>
  /** Chain ID for resolving the deployed validator address (default: 8283) */
  chainId?: number
  /** Explicit validator contract address (overrides chainId-based resolution) */
  validatorAddress?: Address
}

/**
 * Resolve the WebAuthn validator address from config.
 * Priority: validatorAddress > chainId lookup
 */
function resolveAddress(config: CreateWebAuthnValidatorConfig): Address {
  if (config.validatorAddress) return config.validatorAddress
  return getWebAuthnValidatorAddress(config.chainId ?? 8283)
}

/**
 * Create a WebAuthn validator for Kernel smart accounts
 *
 * WebAuthn uses passkey/biometric authentication via the FIDO2 protocol.
 * The actual signing happens in the browser through `navigator.credentials.get()`,
 * which is abstracted via the `signFn` callback that the Product layer provides.
 *
 * @example
 * ```ts
 * import { createWebAuthnValidator } from '@stablenet/plugin-webauthn'
 *
 * const validator = await createWebAuthnValidator({
 *   pubKeyX: credential.pubKeyX,
 *   pubKeyY: credential.pubKeyY,
 *   credentialId: credential.credentialId,
 *   chainId: 8283,
 *   signFn: async (challenge) => {
 *     // Call navigator.credentials.get() and return parsed assertion
 *     return await getWebAuthnAssertion(challenge)
 *   },
 * })
 * ```
 */
export async function createWebAuthnValidator(
  config: CreateWebAuthnValidatorConfig
): Promise<Validator> {
  const {
    pubKeyX,
    pubKeyY,
    credentialId,
    signFn,
  } = config

  const address = resolveAddress(config)

  // Derive a deterministic "signer address" from the credential for identification.
  // WebAuthn doesn't have a traditional Ethereum address, so we hash the public key.
  const signerAddress = keccak256(
    new Uint8Array([
      ...toBytes(pubKeyX, { size: 32 }),
      ...toBytes(pubKeyY, { size: 32 }),
    ])
  ).slice(0, 42) as Address

  const getInitData = async (): Promise<Hex> => {
    return encodeWebAuthnValidatorInit({ pubKeyX, pubKeyY, credentialId })
  }

  const signHash = async (hash: Hex): Promise<Hex> => {
    const signatureData = await signFn(hash)
    return encodeWebAuthnSignature(signatureData)
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
