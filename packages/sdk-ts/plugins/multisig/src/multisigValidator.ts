import type { Validator } from '@stablenet/sdk-types'
import { encodeMultiSigValidatorInit } from '@stablenet/core'
import { getMultiSigValidator as getMultiSigValidatorAddress } from '@stablenet/contracts'
import type { Address, Hex } from 'viem'
import { concat, keccak256, toBytes } from 'viem'

/**
 * A collected signature from a single signer
 */
export interface CollectedSignature {
  signer: Address
  signature: Hex
}

/**
 * Configuration for creating a MultiSig validator
 */
export interface CreateMultiSigValidatorConfig {
  /** List of authorized signer addresses */
  signers: Address[]
  /** Required number of signatures (M-of-N) */
  threshold: number
  /**
   * Signature collection function — provided by the Product layer.
   * Called with the hash to sign, must return at least `threshold` signatures.
   */
  collectSignatures: (hash: Hex) => Promise<CollectedSignature[]>
  /** Chain ID for resolving the deployed validator address (default: 8283) */
  chainId?: number
  /** Explicit validator contract address (overrides chainId-based resolution) */
  validatorAddress?: Address
}

/**
 * Resolve the MultiSig validator address from config.
 * Priority: validatorAddress > chainId lookup
 */
function resolveAddress(config: CreateMultiSigValidatorConfig): Address {
  if (config.validatorAddress) return config.validatorAddress
  return getMultiSigValidatorAddress(config.chainId ?? 8283)
}

/**
 * Create a MultiSig validator for Kernel smart accounts
 *
 * MultiSig requires M-of-N signatures from a pre-defined set of signers.
 * The actual signature collection is abstracted via the `collectSignatures`
 * callback that the Product layer provides.
 *
 * @example
 * ```ts
 * import { createMultiSigValidator } from '@stablenet/plugin-multisig'
 *
 * const validator = await createMultiSigValidator({
 *   signers: [alice, bob, charlie],
 *   threshold: 2,
 *   chainId: 8283,
 *   collectSignatures: async (hash) => {
 *     // Collect signatures from UI or backend coordination service
 *     return await gatherSignatures(hash)
 *   },
 * })
 * ```
 */
export async function createMultiSigValidator(
  config: CreateMultiSigValidatorConfig
): Promise<Validator> {
  const {
    signers,
    threshold,
    collectSignatures,
  } = config

  const address = resolveAddress(config)

  // Derive a deterministic "signer address" from the multisig configuration.
  // Hash sorted signers + threshold to produce a unique identifier.
  const sortedSigners = [...signers].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
  const signerAddress = keccak256(
    new Uint8Array([
      ...sortedSigners.flatMap((s) => [...toBytes(s)]),
      ...toBytes(BigInt(threshold), { size: 1 }),
    ])
  ).slice(0, 42) as Address

  const getInitData = async (): Promise<Hex> => {
    return encodeMultiSigValidatorInit({ signers, threshold })
  }

  const signHash = async (hash: Hex): Promise<Hex> => {
    const collected = await collectSignatures(hash)

    // Check for duplicate signers
    const uniqueSigners = new Set(collected.map((s) => s.signer.toLowerCase()))
    if (uniqueSigners.size !== collected.length) {
      throw new Error('Duplicate signer detected in collected signatures')
    }

    // Verify threshold
    if (collected.length < threshold) {
      throw new Error(
        `Insufficient signatures: got ${collected.length}, threshold requires ${threshold}`
      )
    }

    // Sort by signer address ascending and concatenate raw signatures
    const sorted = [...collected].sort((a, b) =>
      a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
    )

    return concat(sorted.map((s) => s.signature))
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
