import type {
  PaymasterClient,
  PaymasterData,
  PaymasterStubData,
  UserOperation,
} from '@stablenet/sdk-types'
import type { Address, Hex, LocalAccount, PublicClient, TypedDataDomain } from 'viem'
import { concat, pad, toHex } from 'viem'

// Default gas limits for Permit2Paymaster operations
const DEFAULT_PAYMASTER_VERIFICATION_GAS_LIMIT = 150_000n // Higher due to Permit2 verification
const DEFAULT_PAYMASTER_POST_OP_GAS_LIMIT = 80_000n

// Stub signature for gas estimation (65 bytes of zeros)
const STUB_SIGNATURE: Hex = `0x${'00'.repeat(65)}`

// Default validity window (1 hour)
const DEFAULT_VALIDITY_SECONDS = 3600

/**
 * Permit2Paymaster configuration
 */
export interface Permit2PaymasterConfig {
  /** The Permit2Paymaster contract address */
  paymasterAddress: Address
  /** The Permit2 contract address */
  permit2Address: Address
  /** The signer account for signing permits */
  signer: LocalAccount
  /** Chain ID */
  chainId: bigint
  /** The ERC20 token address for gas payment */
  tokenAddress: Address
  /** Optional: Public client for fetching nonce */
  publicClient?: PublicClient
  /** Optional: Permit validity in seconds (default: 3600) */
  validitySeconds?: number
  /** Optional: Custom nonce (auto-fetched if not provided) */
  nonce?: bigint
}

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

    const paymasterData = encodePermit2PaymasterData({
      token: tokenAddress,
      amount,
      expiration,
      nonce: Number(currentNonce),
      signature: STUB_SIGNATURE,
    })

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
    const signature = await signPermit2(signer, permit2Address, chainId, permitSingle)

    // Encode paymaster data
    const paymasterData = encodePermit2PaymasterData({
      token: tokenAddress,
      amount,
      expiration,
      nonce,
      signature,
    })

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
 * Permit2 paymaster data for encoding
 */
interface Permit2PaymasterDataInput {
  token: Address
  amount: bigint
  expiration: number
  nonce: number
  signature: Hex
}

/**
 * Encode Permit2 paymaster data in the format expected by Permit2Paymaster
 * Format: [token (20 bytes)][amount (20 bytes)][expiration (6 bytes)][nonce (6 bytes)][signature (65 bytes)]
 *
 * Note: The contract expects amount as uint160 (20 bytes) for Permit2 compatibility
 */
function encodePermit2PaymasterData(data: Permit2PaymasterDataInput): Hex {
  // Token address (20 bytes)
  const tokenBytes = data.token as Hex

  // Amount as uint160 (20 bytes) - Permit2 uses uint160 for amounts
  const amountBytes = pad(toHex(data.amount), { size: 20 })

  // Expiration as uint48 (6 bytes)
  const expirationBytes = pad(toHex(data.expiration), { size: 6 })

  // Nonce as uint48 (6 bytes)
  const nonceBytes = pad(toHex(data.nonce), { size: 6 })

  // Signature (65 bytes)
  const signatureBytes = data.signature

  return concat([tokenBytes, amountBytes, expirationBytes, nonceBytes, signatureBytes])
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
 * Decode Permit2 paymaster data
 * Useful for debugging and testing
 */
export function decodePermit2PaymasterData(data: Hex): {
  token: Address
  amount: bigint
  expiration: number
  nonce: number
  signature: Hex
} {
  // Remove 0x prefix
  const hex = data.slice(2)

  return {
    token: `0x${hex.slice(0, 40)}` as Address,
    amount: BigInt(`0x${hex.slice(40, 80)}`),
    expiration: Number.parseInt(hex.slice(80, 92), 16),
    nonce: Number.parseInt(hex.slice(92, 104), 16),
    signature: `0x${hex.slice(104)}` as Hex,
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
