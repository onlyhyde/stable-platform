import type {
  PaymasterClient,
  PaymasterData,
  PaymasterStubData,
  UserOperation,
} from '@stablenet/sdk-types'
import type { Address, Hex, LocalAccount, PublicClient, TypedDataDomain } from 'viem'
import {
  encodePaymasterData,
  encodePaymasterDataWithSignature,
  decodePaymasterData,
  PaymasterType,
  encodePermit2Payload,
  decodePermit2Payload,
} from '@stablenet/core'
import type { Permit2PaymasterConfig } from './types'

// Default gas limits for Permit2Paymaster operations
const DEFAULT_PAYMASTER_VERIFICATION_GAS_LIMIT = 150_000n // Higher due to Permit2 verification
const DEFAULT_PAYMASTER_POST_OP_GAS_LIMIT = 80_000n

// Stub signature for gas estimation (65 bytes of zeros)
const STUB_SIGNATURE: Hex = `0x${'00'.repeat(65)}`

// Default validity window (1 hour)
const DEFAULT_VALIDITY_SECONDS = 3600

/**
 * Permit2 permit details for signing
 */
interface PermitDetails {
  token: Address
  amount: bigint
  expiration: number
  nonce: number
}

/**
 * Permit2 single permit structure
 */
interface PermitSingle {
  details: PermitDetails
  spender: Address
  sigDeadline: number
}

/**
 * Permit2 EIP-712 domain
 */
const PERMIT2_DOMAIN_NAME = 'Permit2'

/**
 * Permit2 typed data types for signing
 */
const PERMIT2_TYPES = {
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
} as const

/**
 * Create a Permit2 Paymaster client
 *
 * The Permit2Paymaster uses Uniswap Permit2 for gasless token approvals.
 * Users sign a Permit2 permit to authorize the paymaster to transfer tokens for gas payment.
 *
 * Data is encoded in envelope format (version byte 0x01) with Permit2-specific payloads.
 *
 * @example
 * ```ts
 * import { createPermit2Paymaster } from '@stablenet/plugin-paymaster'
 * import { privateKeyToAccount } from 'viem/accounts'
 *
 * const signer = privateKeyToAccount('0x...')
 * const paymaster = createPermit2Paymaster({
 *   paymasterAddress: '0x...',
 *   permit2Address: '0x...',
 *   tokenAddress: '0x...',
 *   signer,
 *   chainId: 1n,
 * })
 * ```
 */
export function createPermit2Paymaster(config: Permit2PaymasterConfig): PaymasterClient {
  const {
    paymasterAddress,
    permit2Address,
    signer,
    chainId,
    tokenAddress,
    validitySeconds = DEFAULT_VALIDITY_SECONDS,
  } = config

  // Track nonce - will be auto-incremented for each operation
  let currentNonce = config.nonce ?? 0n

  /**
   * Get stub data for gas estimation
   * Uses placeholder signature since actual signature isn't needed for estimation
   */
  const getPaymasterStubData = async (
    _userOperation: UserOperation,
    _entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterStubData> => {
    const expiration = Math.floor(Date.now() / 1000) + validitySeconds
    const amount = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF') // Max uint128
    const validUntil = BigInt(expiration)
    const validAfter = 0n

    // Encode Permit2-specific payload using core encoder
    const payload = encodePermit2Payload({
      token: tokenAddress,
      permitAmount: amount,
      permitExpiration: expiration,
      permitNonce: Number(currentNonce),
      permitSig: STUB_SIGNATURE,
      permit2Extra: '0x',
    })

    // Encode envelope
    const envelope = encodePaymasterData({
      paymasterType: PaymasterType.PERMIT2,
      flags: 0,
      validUntil,
      validAfter,
      nonce: currentNonce,
      payload,
    })

    // Concatenate envelope with stub signature
    const paymasterData = encodePaymasterDataWithSignature(envelope, STUB_SIGNATURE)

    return {
      paymaster: paymasterAddress,
      paymasterData,
      paymasterVerificationGasLimit: DEFAULT_PAYMASTER_VERIFICATION_GAS_LIMIT,
      paymasterPostOpGasLimit: DEFAULT_PAYMASTER_POST_OP_GAS_LIMIT,
    }
  }

  /**
   * Get paymaster data with actual Permit2 signature
   */
  const getPaymasterData = async (
    _userOperation: UserOperation,
    _entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterData> => {
    const expiration = Math.floor(Date.now() / 1000) + validitySeconds
    const amount = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF') // Max uint128
    const nonce = Number(currentNonce)
    const validUntil = BigInt(expiration)
    const validAfter = 0n

    // Create Permit2 permit data
    const permitSingle: PermitSingle = {
      details: {
        token: tokenAddress,
        amount,
        expiration,
        nonce,
      },
      spender: paymasterAddress,
      sigDeadline: expiration,
    }

    // Sign the permit using EIP-712
    const permitSignature = await signPermit2(signer, permit2Address, chainId, permitSingle)

    // Encode Permit2-specific payload using core encoder
    const payload = encodePermit2Payload({
      token: tokenAddress,
      permitAmount: amount,
      permitExpiration: expiration,
      permitNonce: nonce,
      permitSig: permitSignature,
      permit2Extra: '0x',
    })

    // Encode envelope
    const envelope = encodePaymasterData({
      paymasterType: PaymasterType.PERMIT2,
      flags: 0,
      validUntil,
      validAfter,
      nonce: currentNonce,
      payload,
    })

    // For Permit2, the envelope already contains the permit signature in the payload,
    // so we don't need an additional outer signature. Use empty signature.
    const paymasterData = encodePaymasterDataWithSignature(envelope, '0x' as Hex)

    // Increment nonce for next operation
    currentNonce++

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
 * Sign a Permit2 permit using EIP-712 typed data
 */
async function signPermit2(
  signer: LocalAccount,
  permit2Address: Address,
  chainId: bigint,
  permitSingle: PermitSingle
): Promise<Hex> {
  const domain: TypedDataDomain = {
    name: PERMIT2_DOMAIN_NAME,
    chainId: Number(chainId),
    verifyingContract: permit2Address,
  }

  const signature = await signer.signTypedData({
    domain,
    types: PERMIT2_TYPES,
    primaryType: 'PermitSingle',
    message: {
      details: {
        token: permitSingle.details.token,
        amount: permitSingle.details.amount,
        expiration: permitSingle.details.expiration,
        nonce: permitSingle.details.nonce,
      },
      spender: permitSingle.spender,
      sigDeadline: BigInt(permitSingle.sigDeadline),
    },
  })

  return signature
}

/**
 * Decode Permit2 paymaster data from envelope format
 * Useful for debugging and testing
 */
export function decodePermit2PaymasterData(data: Hex): {
  token: Address
  permitAmount: bigint
  permitExpiration: number
  permitNonce: number
  permitSig: Hex
  permit2Extra: Hex
  validUntil: bigint
  validAfter: bigint
  nonce: bigint
} {
  const env = decodePaymasterData(data)
  const payload = decodePermit2Payload(env.payload)

  return {
    ...payload,
    validUntil: env.validUntil,
    validAfter: env.validAfter,
    nonce: env.nonce,
  }
}

/**
 * Create a Permit2 paymaster from a private key
 */
export async function createPermit2PaymasterFromPrivateKey(config: {
  paymasterAddress: Address
  permit2Address: Address
  tokenAddress: Address
  privateKey: Hex
  chainId: bigint
  validitySeconds?: number
  nonce?: bigint
}): Promise<PaymasterClient> {
  const { privateKeyToAccount } = await import('viem/accounts')
  const signer = privateKeyToAccount(config.privateKey)

  return createPermit2Paymaster({
    paymasterAddress: config.paymasterAddress,
    permit2Address: config.permit2Address,
    tokenAddress: config.tokenAddress,
    signer,
    chainId: config.chainId,
    validitySeconds: config.validitySeconds,
    nonce: config.nonce,
  })
}

/**
 * Get current Permit2 nonce for a user/token/spender combination
 * Call this via public client before creating paymaster if nonce tracking is needed
 */
export async function getPermit2Nonce(
  publicClient: PublicClient,
  permit2Address: Address,
  owner: Address,
  token: Address,
  spender: Address
): Promise<{ amount: bigint; expiration: number; nonce: number }> {
  const result = await publicClient.readContract({
    address: permit2Address,
    abi: [
      {
        inputs: [
          { name: 'user', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'allowance',
    args: [owner, token, spender],
  })

  return {
    amount: result[0],
    expiration: Number(result[1]),
    nonce: Number(result[2]),
  }
}
