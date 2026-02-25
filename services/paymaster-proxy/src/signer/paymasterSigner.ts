import type { Address, Hex } from 'viem'
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

const STUB_SIGNATURE = `0x${'00'.repeat(65)}` as Hex

/**
 * Paymaster Signer for generating paymaster signatures using envelope format
 */
export class PaymasterSigner {
  private privateKey: Hex
  private paymasterAddress: Address

  constructor(privateKey: Hex, paymasterAddress: Address) {
    this.privateKey = privateKey
    this.paymasterAddress = paymasterAddress
  }

  /**
   * Get the signer address
   */
  getSignerAddress(): Address {
    const account = privateKeyToAccount(this.privateKey)
    return account.address
  }

  /**
   * Generate stub paymaster data (with zero signature) for gas estimation
   */
  generateStubData(
    paymasterType: PaymasterType,
    payload: Hex,
    validitySeconds?: number
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

    const envelope = encodePaymasterData({
      paymasterType,
      flags: 0,
      validUntil: BigInt(validUntil),
      validAfter: BigInt(validAfter),
      nonce: 0n,
      payload,
    })

    const paymasterData = encodePaymasterDataWithSignature(envelope, STUB_SIGNATURE)

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
    validitySeconds?: number
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

    // Build envelope
    const envelope = encodePaymasterData({
      paymasterType,
      flags: 0,
      validUntil: BigInt(validUntil),
      validAfter: BigInt(validAfter),
      nonce: 0n,
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

    // Sign the hash
    const signature = await signMessage({
      message: { raw: hash },
      privateKey: this.privateKey,
    })

    // Encode envelope + signature
    const paymasterData = encodePaymasterDataWithSignature(envelope, signature)

    return { paymasterData, validUntil, validAfter }
  }
}
