import type { GasEstimate, SignedAuthorization, TransactionResult } from '@stablenet/sdk-types'
import type { Address, Hash, Hex } from 'viem'
import { keccak256, serializeTransaction } from 'viem'
import {
  EIP7702_AUTH_GAS,
  GAS_PER_AUTHORIZATION,
  MIN_PRIORITY_FEE,
  SETCODE_BASE_GAS,
} from '../config'
import { createAuthorizationHash, ZERO_ADDRESS } from '../eip7702'
import { createTransactionError } from '../errors'
import { createViemProvider, type RpcProvider } from '../providers'

// ============================================================================
// Types
// ============================================================================

/**
 * EIP-7702 Transaction configuration
 */
export interface EIP7702TransactionConfig {
  /** RPC URL for the network (used if provider not specified) */
  rpcUrl?: string

  /** Chain ID */
  chainId: number

  /** RPC Provider instance (DIP: allows dependency injection) */
  provider?: RpcProvider
}

/**
 * Authorization signer interface
 */
export interface AuthorizationSigner {
  /** Sign an authorization hash */
  signAuthorization(hash: Hex): Promise<{ v: number; r: Hex; s: Hex }>

  /** Get the signer's address */
  getAddress(): Promise<Address>
}

/**
 * Delegation request parameters
 */
export interface DelegationRequest {
  /** EOA address to delegate */
  account: Address

  /** Contract address to delegate to (use ZERO_ADDRESS for revocation) */
  delegateAddress: Address

  /** Optional: specific chain ID (defaults to current chain, use 0 for any chain) */
  chainId?: bigint

  /** Optional: specific nonce (defaults to current account nonce) */
  nonce?: bigint
}

/**
 * Built EIP-7702 transaction
 */
export interface BuiltEIP7702Transaction {
  /** Serialized transaction for sending */
  serializedTransaction: Hex

  /** Authorization list */
  authorizationList: SignedAuthorization[]

  /** Gas estimate */
  gasEstimate: GasEstimate

  /** Account being delegated */
  account: Address

  /** Delegate address */
  delegateAddress: Address

  /** Is this a revocation? */
  isRevocation: boolean
}

// ============================================================================
// EIP-7702 Transaction Builder
// ============================================================================

/**
 * Create an EIP-7702 transaction builder
 *
 * @example
 * ```typescript
 * const builder = createEIP7702TransactionBuilder({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 * })
 *
 * // Set up delegation
 * const built = await builder.buildDelegation({
 *   account: '0xUserEOA...',
 *   delegateAddress: '0xKernel...',
 * }, signer)
 *
 * // Revoke delegation
 * const revoke = await builder.buildRevocation({
 *   account: '0xUserEOA...',
 * }, signer)
 * ```
 */
export function createEIP7702TransactionBuilder(config: EIP7702TransactionConfig) {
  const { rpcUrl, chainId, provider: injectedProvider } = config

  // DIP: Use injected provider or create one from rpcUrl
  if (!injectedProvider && !rpcUrl) {
    throw createTransactionError('Either provider or rpcUrl must be provided', {
      reason: 'MISSING_PROVIDER',
    })
  }

  const provider: RpcProvider =
    injectedProvider ??
    createViemProvider({
      rpcUrl: rpcUrl!,
      chainId,
    })

  /**
   * Get current nonce for account
   */
  async function getAccountNonce(address: Address): Promise<bigint> {
    const nonce = await provider.getTransactionCount(address, 'pending')
    return BigInt(nonce)
  }

  /**
   * Get current gas prices
   */
  async function getGasPrices(): Promise<{
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }> {
    const block = await provider.getBlock('latest')
    const baseFee = block.baseFeePerGas ?? 0n

    let maxPriorityFeePerGas: bigint
    try {
      maxPriorityFeePerGas = await provider.estimateMaxPriorityFeePerGas()
    } catch {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }

    if (maxPriorityFeePerGas < MIN_PRIORITY_FEE) {
      maxPriorityFeePerGas = MIN_PRIORITY_FEE
    }

    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

    return { maxFeePerGas, maxPriorityFeePerGas }
  }

  /**
   * Create a signed authorization
   */
  async function createAuthorization(
    request: DelegationRequest,
    signer: AuthorizationSigner
  ): Promise<SignedAuthorization> {
    // Get nonce if not provided
    const nonce = request.nonce ?? (await getAccountNonce(request.account))

    // Use current chain ID if not specified
    const authChainId = request.chainId ?? BigInt(chainId)

    // Create authorization hash
    const authHash = createAuthorizationHash({
      chainId: authChainId,
      address: request.delegateAddress,
      nonce,
    })

    // Sign the authorization
    const signature = await signer.signAuthorization(authHash)

    return {
      chainId: Number(authChainId),
      address: request.delegateAddress,
      nonce,
      r: signature.r,
      s: signature.s,
      yParity: signature.v % 2, // Convert v to yParity (0 or 1)
    }
  }

  /**
   * Calculate gas for EIP-7702 transaction
   */
  function calculateGas(authCount: number): bigint {
    return SETCODE_BASE_GAS + EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * BigInt(authCount)
  }

  /**
   * Internal: build a delegation/revocation transaction (no ZERO_ADDRESS check)
   */
  async function buildDelegationInternal(
    request: DelegationRequest,
    signer: AuthorizationSigner
  ): Promise<BuiltEIP7702Transaction> {
    // Create signed authorization
    const authorization = await createAuthorization(request, signer)

    // Calculate gas
    const gas = calculateGas(1)
    const { maxFeePerGas, maxPriorityFeePerGas } = await getGasPrices()

    const gasEstimate: GasEstimate = {
      gasLimit: gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedCost: gas * maxFeePerGas,
    }

    // Serialize the EIP-7702 (Type 4) transaction using viem
    const serializedTransaction = serializeTransaction({
      type: 'eip7702',
      to: request.account,
      value: 0n,
      chainId,
      nonce: Number(request.nonce ?? (await getAccountNonce(request.account))),
      maxFeePerGas,
      maxPriorityFeePerGas,
      gas: gas,
      authorizationList: [
        {
          chainId: authorization.chainId,
          address: authorization.address,
          nonce: Number(authorization.nonce),
          r: authorization.r,
          s: authorization.s,
          yParity: authorization.yParity,
        },
      ],
    })

    return {
      serializedTransaction,
      authorizationList: [authorization],
      gasEstimate,
      account: request.account,
      delegateAddress: request.delegateAddress,
      isRevocation: false,
    }
  }

  /**
   * Build a delegation transaction
   */
  async function buildDelegation(
    request: DelegationRequest,
    signer: AuthorizationSigner
  ): Promise<BuiltEIP7702Transaction> {
    if (request.delegateAddress === ZERO_ADDRESS) {
      throw createTransactionError('Use buildRevocation() to revoke delegation', {
        reason: 'INVALID_REQUEST',
      })
    }
    return buildDelegationInternal(request, signer)
  }

  /**
   * Build a revocation transaction
   */
  async function buildRevocation(
    request: Omit<DelegationRequest, 'delegateAddress'>,
    signer: AuthorizationSigner
  ): Promise<BuiltEIP7702Transaction> {
    const built = await buildDelegationInternal(
      { ...request, delegateAddress: ZERO_ADDRESS },
      signer
    )
    return { ...built, isRevocation: true }
  }

  /**
   * Send EIP-7702 transaction
   *
   * Note: This requires a node that supports EIP-7702 (Type 4 transactions)
   */
  async function send(
    built: BuiltEIP7702Transaction,
    txSigner: AuthorizationSigner
  ): Promise<TransactionResult> {
    // Sign the transaction envelope
    const txHash = keccak256(built.serializedTransaction)
    const signature = await txSigner.signAuthorization(txHash)

    // Re-serialize with the transaction signature
    const nonce = await getAccountNonce(built.account)
    const signedTransaction = serializeTransaction(
      {
        type: 'eip7702',
        to: built.account,
        value: 0n,
        chainId,
        nonce: Number(nonce),
        maxFeePerGas: built.gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: built.gasEstimate.maxPriorityFeePerGas,
        gas: built.gasEstimate.gasLimit,
        authorizationList: built.authorizationList.map((auth) => ({
          chainId: auth.chainId,
          address: auth.address,
          nonce: Number(auth.nonce),
          r: auth.r,
          s: auth.s,
          yParity: auth.yParity,
        })),
      },
      {
        r: signature.r,
        s: signature.s,
        yParity: signature.v % 2 === 0 ? 0 : 1,
      }
    )

    // Send the signed transaction
    const hash = await provider.sendRawTransaction(signedTransaction)

    return {
      hash,
      mode: 'eip7702',
      chainId,
      timestamp: Date.now(),
    }
  }

  /**
   * Check if an account is currently delegated
   */
  async function isDelegated(account: Address): Promise<boolean> {
    const code = await provider.getCode(account)
    if (!code || code === '0x') return false

    // Check for delegation prefix (0xef0100)
    return code.toLowerCase().startsWith('0xef0100')
  }

  /**
   * Get the delegate address for a delegated account
   */
  async function getDelegateAddress(account: Address): Promise<Address | null> {
    const code = await provider.getCode(account)
    if (!code || code === '0x') return null

    // Check for delegation prefix
    if (!code.toLowerCase().startsWith('0xef0100')) return null

    // Extract address (bytes 4-24 after prefix)
    const addressHex = code.slice(8, 48)
    return `0x${addressHex}` as Address
  }

  /**
   * Wait for a transaction receipt
   */
  async function waitForReceipt(
    hash: Hash,
    options: { confirmations?: number; timeout?: number } = {}
  ) {
    const { confirmations = 1, timeout = 60_000 } = options
    return provider.waitForTransactionReceipt(hash, {
      confirmations,
      timeout,
    })
  }

  return {
    createAuthorization,
    buildDelegation,
    buildRevocation,
    send,
    isDelegated,
    getDelegateAddress,
    getAccountNonce,
    getGasPrices,
    waitForReceipt,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type EIP7702TransactionBuilder = ReturnType<typeof createEIP7702TransactionBuilder>
