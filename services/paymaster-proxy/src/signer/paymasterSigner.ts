import type { Address, Hex, PublicClient } from 'viem'
import { privateKeyToAccount, signMessage } from 'viem/accounts'
import {
  PaymasterType,
  encodePaymasterData,
  encodePaymasterDataWithSignature,
  computePaymasterDomainSeparator,
  computeUserOpCoreHash,
  computePaymasterHash,
} from '@stablenet/core'
import { getSignerConfig } from '../config/constants'
import type { PackedUserOperationRpc, UserOperationRpc } from '../types'
import { toPackedForCoreHash } from '../utils/userOpNormalizer'
import { validateTimeRange } from '../utils/validation'

const STUB_SIGNATURE = `0x${'00'.repeat(65)}` as Hex

/** ERC-1271 magic value returned by isValidSignature on success */
const ERC1271_MAGIC_VALUE = '0x1626ba7e' as const

/**
 * Signer type discriminator
 */
export type SignerType = 'eoa' | 'erc1271'

/**
 * Configuration for ERC-1271 contract-based signer
 */
export interface ContractSignerConfig {
  /** Smart contract signer address */
  contractAddress: Address
  /** Public client for on-chain isValidSignature calls */
  publicClient: PublicClient
  /** The EOA key that signs on behalf of the contract */
  signerPrivateKey: Hex
}

/**
 * Paymaster Signer for generating paymaster signatures using envelope format.
 * Supports both EOA (ECDSA) and ERC-1271 (smart contract) signing.
 */
export class PaymasterSigner {
  private privateKey: Hex
  private paymasterAddress: Address
  private readonly signerType: SignerType
  private readonly contractSignerConfig?: ContractSignerConfig

  constructor(privateKey: Hex, paymasterAddress: Address, contractSigner?: ContractSignerConfig) {
    this.privateKey = privateKey
    this.paymasterAddress = paymasterAddress

    if (contractSigner) {
      this.signerType = 'erc1271'
      this.contractSignerConfig = contractSigner
    } else {
      this.signerType = 'eoa'
    }
  }

  /**
   * Get the signer address
   */
  getSignerAddress(): Address {
    if (this.signerType === 'erc1271' && this.contractSignerConfig) {
      return this.contractSignerConfig.contractAddress
    }
    const account = privateKeyToAccount(this.privateKey)
    return account.address
  }

  /**
   * Get the signer type
   */
  getSignerType(): SignerType {
    return this.signerType
  }

  /**
   * Verify an ERC-1271 signature on-chain
   * Calls isValidSignature(bytes32 hash, bytes signature) on the contract
   */
  async verifyERC1271Signature(hash: Hex, signature: Hex): Promise<boolean> {
    if (!this.contractSignerConfig) {
      throw new Error('ERC-1271 verification requires contract signer config')
    }

    const { contractAddress, publicClient } = this.contractSignerConfig

    try {
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: [
          {
            type: 'function',
            name: 'isValidSignature',
            inputs: [
              { name: 'hash', type: 'bytes32' },
              { name: 'signature', type: 'bytes' },
            ],
            outputs: [{ name: 'magicValue', type: 'bytes4' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'isValidSignature',
        args: [hash, signature],
      })

      return result === ERC1271_MAGIC_VALUE
    } catch {
      return false
    }
  }

  /**
   * Generate stub paymaster data (with zero signature) for gas estimation.
   * For ERC-1271, the stub is larger to account for the contract signature overhead.
   */
  generateStubData(
    paymasterType: PaymasterType,
    payload: Hex,
    validitySeconds?: number,
    nonce?: bigint
  ): {
    paymasterData: Hex
    validUntil: number
    validAfter: number
  } {
    const signerConfig = getSignerConfig()
    const validity = validitySeconds ?? signerConfig.validitySeconds
    const now = Math.floor(Date.now() / 1000)
    const validUntil = now + validity
    const validAfter = now - signerConfig.clockSkewSeconds

    const timeError = validateTimeRange(validUntil, validAfter, now)
    if (timeError) {
      throw new Error(`Invalid time range: ${timeError.message}`)
    }

    const envelope = encodePaymasterData({
      paymasterType,
      flags: 0,
      validUntil: BigInt(validUntil),
      validAfter: BigInt(validAfter),
      nonce: nonce ?? 0n,
      payload,
    })

    // ERC-1271 stub includes extra bytes for the contract signature wrapper
    // Format: 0x00 (EOA mode byte) + 65 bytes ECDSA = 66 bytes for EOA
    // Format: 0x01 (ERC-1271 mode byte) + 20 bytes signer + 65 bytes ECDSA = 86 bytes for ERC-1271
    const stubSig = this.signerType === 'erc1271'
      ? (`0x01${'00'.repeat(20)}${'00'.repeat(65)}` as Hex)
      : STUB_SIGNATURE

    const paymasterData = encodePaymasterDataWithSignature(envelope, stubSig)

    return { paymasterData, validUntil, validAfter }
  }

  /**
   * Generate signed paymaster data with actual ECDSA signature
   */
  async generateSignedData(
    userOp: UserOperationRpc | PackedUserOperationRpc,
    entryPoint: Address,
    chainId: bigint,
    paymasterType: PaymasterType,
    payload: Hex,
    validitySeconds?: number,
    nonce?: bigint
  ): Promise<{
    paymasterData: Hex
    validUntil: number
    validAfter: number
  }> {
    const signerConfig = getSignerConfig()
    const validity = validitySeconds ?? signerConfig.validitySeconds
    const now = Math.floor(Date.now() / 1000)
    const validUntil = now + validity
    const validAfter = now - signerConfig.clockSkewSeconds

    const timeError = validateTimeRange(validUntil, validAfter, now)
    if (timeError) {
      throw new Error(`Invalid time range: ${timeError.message}`)
    }

    // Build envelope — nonce must match the on-chain senderNonce for
    // VerifyingPaymaster/SponsorPaymaster to accept the signature.
    const envelope = encodePaymasterData({
      paymasterType,
      flags: 0,
      validUntil: BigInt(validUntil),
      validAfter: BigInt(validAfter),
      nonce: nonce ?? 0n,
      payload,
    })

    // Compute hash using SDK core
    const domainSeparator = computePaymasterDomainSeparator(
      chainId,
      entryPoint,
      this.paymasterAddress
    )
    const packedUserOp = toPackedForCoreHash(userOp)
    const userOpCoreHash = computeUserOpCoreHash(packedUserOp)
    const hash = computePaymasterHash(domainSeparator, userOpCoreHash, envelope)

    // Sign the hash with ECDSA (used for both EOA and ERC-1271 modes)
    const ecdsaKey = this.contractSignerConfig?.signerPrivateKey ?? this.privateKey
    const ecdsaSignature = await signMessage({
      message: { raw: hash },
      privateKey: ecdsaKey,
    })

    let finalSignature: Hex
    if (this.signerType === 'erc1271' && this.contractSignerConfig) {
      // ERC-1271 signature format: 0x01 + signer address (20 bytes) + ECDSA signature (65 bytes)
      // The contract's isValidSignature will verify the inner ECDSA signature
      const signerAddr = this.contractSignerConfig.contractAddress.slice(2)
      finalSignature = `0x01${signerAddr}${ecdsaSignature.slice(2)}` as Hex
    } else {
      finalSignature = ecdsaSignature
    }

    // Encode envelope + signature
    const paymasterData = encodePaymasterDataWithSignature(envelope, finalSignature)

    return { paymasterData, validUntil, validAfter }
  }
}
