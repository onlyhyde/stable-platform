import type {
  PaymasterClient,
  PaymasterData,
  PaymasterStubData,
  UserOperation,
} from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { concat, encodeAbiParameters, keccak256, pad, toHex } from 'viem'
import type { VerifyingPaymasterConfig } from './types'
import { DEFAULT_VALIDITY_SECONDS } from './types'

// Default gas limits for paymaster operations
const DEFAULT_PAYMASTER_VERIFICATION_GAS_LIMIT = 100_000n
const DEFAULT_PAYMASTER_POST_OP_GAS_LIMIT = 50_000n

// Stub signature for gas estimation (65 bytes of zeros)
const STUB_SIGNATURE: Hex = `0x${'00'.repeat(65)}`

/**
 * Create a Verifying Paymaster client
 *
 * The VerifyingPaymaster uses an off-chain signature to approve gas sponsorship.
 * The signer signs a hash of the user operation data to determine which operations to sponsor.
 *
 * @example
 * ```ts
 * import { createVerifyingPaymaster } from '@stablenet/plugin-paymaster'
 * import { privateKeyToAccount } from 'viem/accounts'
 *
 * const signer = privateKeyToAccount('0x...')
 * const paymaster = createVerifyingPaymaster({
 *   paymasterAddress: '0x...',
 *   signer,
 *   chainId: 1n,
 * })
 * ```
 */
export function createVerifyingPaymaster(config: VerifyingPaymasterConfig): PaymasterClient {
  const { paymasterAddress, signer, chainId, validitySeconds = DEFAULT_VALIDITY_SECONDS } = config

  /**
   * Get stub data for gas estimation
   * Uses placeholder signature since actual signature isn't needed for estimation
   */
  const getPaymasterStubData = async (
    _userOperation: UserOperation,
    _entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterStubData> => {
    // Create stub paymaster data with placeholder timestamps and signature
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + validitySeconds)
    const validAfter = 0n

    const paymasterData = encodePaymasterData(validUntil, validAfter, STUB_SIGNATURE)

    return {
      paymaster: paymasterAddress,
      paymasterData,
      paymasterVerificationGasLimit: DEFAULT_PAYMASTER_VERIFICATION_GAS_LIMIT,
      paymasterPostOpGasLimit: DEFAULT_PAYMASTER_POST_OP_GAS_LIMIT,
    }
  }

  /**
   * Get paymaster data with actual signature
   */
  const getPaymasterData = async (
    userOperation: UserOperation,
    _entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterData> => {
    // Set validity window (configurable, default: 1 hour)
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + validitySeconds)
    const validAfter = 0n

    // Compute the hash that needs to be signed
    const hash = computePaymasterHash(
      userOperation,
      paymasterAddress,
      chainId,
      validUntil,
      validAfter
    )

    // Sign the hash
    const signature = await signer.signMessage({
      message: { raw: hash },
    })

    // Encode paymaster data
    const paymasterData = encodePaymasterData(validUntil, validAfter, signature)

    return {
      paymaster: paymasterAddress,
      paymasterData,
    }
  }

  return {
    getPaymasterStubData,
    getPaymasterData,
  }
}

/**
 * Encode paymaster data in the format expected by VerifyingPaymaster
 * Format: [validUntil (6 bytes)][validAfter (6 bytes)][signature (65 bytes)]
 */
function encodePaymasterData(validUntil: bigint, validAfter: bigint, signature: Hex): Hex {
  // Convert timestamps to 6 bytes each (uint48)
  const validUntilBytes = pad(toHex(validUntil), { size: 6 })
  const validAfterBytes = pad(toHex(validAfter), { size: 6 })

  return concat([validUntilBytes, validAfterBytes, signature])
}

/**
 * Compute the hash that needs to be signed by the paymaster
 * This matches the getHash function in VerifyingPaymaster.sol
 * Includes senderNonce for replay prevention
 */
function computePaymasterHash(
  userOp: UserOperation,
  paymasterAddress: Address,
  chainId: bigint,
  validUntil: bigint,
  validAfter: bigint,
  senderNonce: bigint = 0n
): Hex {
  // Pack initCode from factory + factoryData
  const initCode =
    userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

  // Pack accountGasLimits (verificationGasLimit + callGasLimit)
  const accountGasLimits = packGasLimits(userOp.verificationGasLimit, userOp.callGasLimit)

  // Pack gasFees (maxPriorityFeePerGas + maxFeePerGas)
  const gasFees = packGasLimits(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas)

  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint48' },
        { type: 'uint48' },
        { type: 'uint256' },
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(initCode),
        keccak256(userOp.callData),
        accountGasLimits,
        userOp.preVerificationGas,
        gasFees,
        chainId,
        paymasterAddress,
        Number(validUntil),
        Number(validAfter),
        senderNonce,
      ]
    )
  )
}

/**
 * Pack two gas values into a single bytes32
 */
function packGasLimits(a: bigint, b: bigint): Hex {
  // Pack as uint128 + uint128
  const aHex = pad(toHex(a), { size: 16 })
  const bHex = pad(toHex(b), { size: 16 })
  return concat([aHex, bHex])
}

/**
 * Create a verifying paymaster from a private key
 */
export async function createVerifyingPaymasterFromPrivateKey(config: {
  paymasterAddress: Address
  privateKey: Hex
  chainId: bigint
}): Promise<PaymasterClient> {
  const { privateKeyToAccount } = await import('viem/accounts')
  const signer = privateKeyToAccount(config.privateKey)

  return createVerifyingPaymaster({
    paymasterAddress: config.paymasterAddress,
    signer,
    chainId: config.chainId,
  })
}
