import {
  type Address,
  type Hex,
  concat,
  encodeAbiParameters,
  keccak256,
  toHex,
} from 'viem'
import { privateKeyToAccount, signMessage } from 'viem/accounts'
import type { UserOperationRpc, PackedUserOperationRpc } from '../types'
import { getSignerConfig } from '../config/constants'

/**
 * Paymaster signature mode
 */
export const PAYMASTER_MODE = {
  // Mode 0: Timestamp-based validity
  TIMESTAMP: 0,
  // Mode 1: User-specific sponsorship
  USER_SPECIFIC: 1,
} as const

/**
 * Paymaster data structure
 */
export interface PaymasterData {
  mode: number
  validUntil: number
  validAfter: number
  signature?: Hex
}

/**
 * Paymaster Signer for generating paymaster signatures
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
   * Generate stub paymaster data (without signature)
   * Configurable via:
   * - PAYMASTER_VALIDITY_SECONDS: Signature validity (default: 3600 = 1 hour)
   * - PAYMASTER_CLOCK_SKEW_SECONDS: Allowed clock skew (default: 60)
   */
  generateStubData(
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
    const validAfter = now - signerConfig.clockSkewSeconds // Allow clock skew

    // Encode paymaster data without signature
    // Format: mode (1 byte) + validUntil (6 bytes) + validAfter (6 bytes) + stub signature (65 bytes)
    const paymasterData = concat([
      toHex(PAYMASTER_MODE.TIMESTAMP, { size: 1 }),
      toHex(validUntil, { size: 6 }),
      toHex(validAfter, { size: 6 }),
      // Stub signature (65 bytes of zeros)
      `0x${'00'.repeat(65)}` as Hex,
    ]) as Hex

    return {
      paymasterData,
      validUntil,
      validAfter,
    }
  }

  /**
   * Generate signed paymaster data
   * Configurable via:
   * - PAYMASTER_VALIDITY_SECONDS: Signature validity (default: 3600 = 1 hour)
   * - PAYMASTER_CLOCK_SKEW_SECONDS: Allowed clock skew (default: 60)
   */
  async generateSignedData(
    userOp: UserOperationRpc | PackedUserOperationRpc,
    entryPoint: Address,
    chainId: bigint,
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

    // Create hash for signing
    const hash = this.createPaymasterHash(
      userOp,
      entryPoint,
      chainId,
      validUntil,
      validAfter
    )

    // Sign the hash
    const signature = await signMessage({
      message: { raw: hash },
      privateKey: this.privateKey,
    })

    // Encode paymaster data with signature
    const paymasterData = concat([
      toHex(PAYMASTER_MODE.TIMESTAMP, { size: 1 }),
      toHex(validUntil, { size: 6 }),
      toHex(validAfter, { size: 6 }),
      signature,
    ]) as Hex

    return {
      paymasterData,
      validUntil,
      validAfter,
    }
  }

  /**
   * Create hash for paymaster signature
   */
  private createPaymasterHash(
    userOp: UserOperationRpc | PackedUserOperationRpc,
    entryPoint: Address,
    chainId: bigint,
    validUntil: number,
    validAfter: number
  ): Hex {
    // Pack UserOperation fields for hashing
    const packed = this.packUserOpForHash(userOp)

    // Create the message to sign
    const encoded = encodeAbiParameters(
      [
        { type: 'address' }, // sender
        { type: 'uint256' }, // nonce
        { type: 'bytes32' }, // initCode hash
        { type: 'bytes32' }, // callData hash
        { type: 'uint256' }, // callGasLimit
        { type: 'uint256' }, // verificationGasLimit
        { type: 'uint256' }, // preVerificationGas
        { type: 'uint256' }, // maxFeePerGas
        { type: 'uint256' }, // maxPriorityFeePerGas
        { type: 'address' }, // paymaster
        { type: 'uint48' }, // validUntil
        { type: 'uint48' }, // validAfter
        { type: 'address' }, // entryPoint
        { type: 'uint256' }, // chainId
      ],
      [
        packed.sender,
        packed.nonce,
        packed.initCodeHash,
        packed.callDataHash,
        packed.callGasLimit,
        packed.verificationGasLimit,
        packed.preVerificationGas,
        packed.maxFeePerGas,
        packed.maxPriorityFeePerGas,
        this.paymasterAddress,
        validUntil,
        validAfter,
        entryPoint,
        chainId,
      ]
    )

    return keccak256(encoded)
  }

  /**
   * Pack UserOperation fields for hashing
   */
  private packUserOpForHash(userOp: UserOperationRpc | PackedUserOperationRpc): {
    sender: Address
    nonce: bigint
    initCodeHash: Hex
    callDataHash: Hex
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  } {
    // Check if it's a packed UserOperation
    if ('initCode' in userOp) {
      // Packed format
      return {
        sender: userOp.sender,
        nonce: BigInt(userOp.nonce),
        initCodeHash: keccak256(userOp.initCode),
        callDataHash: keccak256(userOp.callData),
        callGasLimit: this.extractCallGasLimit(userOp.accountGasLimits),
        verificationGasLimit: this.extractVerificationGasLimit(userOp.accountGasLimits),
        preVerificationGas: BigInt(userOp.preVerificationGas),
        maxFeePerGas: this.extractMaxFeePerGas(userOp.gasFees),
        maxPriorityFeePerGas: this.extractMaxPriorityFeePerGas(userOp.gasFees),
      }
    }

    // Unpacked format
    const initCode =
      userOp.factory && userOp.factoryData
        ? concat([userOp.factory, userOp.factoryData])
        : '0x'

    return {
      sender: userOp.sender,
      nonce: BigInt(userOp.nonce),
      initCodeHash: keccak256(initCode as Hex),
      callDataHash: keccak256(userOp.callData),
      callGasLimit: BigInt(userOp.callGasLimit),
      verificationGasLimit: BigInt(userOp.verificationGasLimit),
      preVerificationGas: BigInt(userOp.preVerificationGas),
      maxFeePerGas: BigInt(userOp.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
    }
  }

  /**
   * Extract verificationGasLimit from accountGasLimits (first 16 bytes)
   */
  private extractVerificationGasLimit(accountGasLimits: Hex): bigint {
    const hex = accountGasLimits.slice(2, 34) // First 16 bytes
    return BigInt(`0x${hex}`)
  }

  /**
   * Extract callGasLimit from accountGasLimits (last 16 bytes)
   */
  private extractCallGasLimit(accountGasLimits: Hex): bigint {
    const hex = accountGasLimits.slice(34, 66) // Last 16 bytes
    return BigInt(`0x${hex}`)
  }

  /**
   * Extract maxPriorityFeePerGas from gasFees (first 16 bytes)
   */
  private extractMaxPriorityFeePerGas(gasFees: Hex): bigint {
    const hex = gasFees.slice(2, 34) // First 16 bytes
    return BigInt(`0x${hex}`)
  }

  /**
   * Extract maxFeePerGas from gasFees (last 16 bytes)
   */
  private extractMaxFeePerGas(gasFees: Hex): bigint {
    const hex = gasFees.slice(34, 66) // Last 16 bytes
    return BigInt(`0x${hex}`)
  }
}
