import type { Address, Hex } from 'viem'
import type {
  GasEstimate,
  TransactionResult,
  SignedAuthorization,
} from '@stablenet/sdk-types'
import {
  createAuthorizationHash,
  ZERO_ADDRESS,
} from '../eip7702'
import { createTransactionError } from '../errors'
import { createViemProvider, type RpcProvider } from '../providers'
import {
  EIP7702_AUTH_GAS,
  SETCODE_BASE_GAS,
  GAS_PER_AUTHORIZATION,
  MIN_PRIORITY_FEE,
} from '../config'

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
export function createEIP7702TransactionBuilder(
  config: EIP7702TransactionConfig
) {
  const { rpcUrl, chainId, provider: injectedProvider } = config

  // DIP: Use injected provider or create one from rpcUrl
  if (!injectedProvider && !rpcUrl) {
    throw createTransactionError('Either provider or rpcUrl must be provided', {
      reason: 'MISSING_PROVIDER',
    })
  }

  const provider: RpcProvider = injectedProvider ?? createViemProvider({
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
    return (
      SETCODE_BASE_GAS +
      EIP7702_AUTH_GAS +
      GAS_PER_AUTHORIZATION * BigInt(authCount)
    )
  }

  /**
   * Build a delegation transaction
   */
  async function buildDelegation(
    request: DelegationRequest,
    signer: AuthorizationSigner
  ): Promise<BuiltEIP7702Transaction> {
    // Validate
    if (request.delegateAddress === ZERO_ADDRESS) {
      throw createTransactionError(
        'Use buildRevocation() to revoke delegation',
        { reason: 'INVALID_REQUEST' }
      )
    }

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

    return {
      serializedTransaction: '0x' as Hex, // Placeholder - needs actual serialization with viem 2.22+
      authorizationList: [authorization],
      gasEstimate,
      account: request.account,
      delegateAddress: request.delegateAddress,
      isRevocation: false,
    }
  }

  /**
   * Build a revocation transaction
   */
  async function buildRevocation(
    request: Omit<DelegationRequest, 'delegateAddress'>,
    signer: AuthorizationSigner
  ): Promise<BuiltEIP7702Transaction> {
    const built = await buildDelegation(
      {
        ...request,
        delegateAddress: ZERO_ADDRESS,
      },
      signer
    )

    return {
      ...built,
      isRevocation: true,
    }
  }

  /**
   * Send EIP-7702 transaction
   *
   * Note: This requires a node that supports EIP-7702 (Type 4 transactions)
   */
  async function send(
    _built: BuiltEIP7702Transaction,
    _txSigner: AuthorizationSigner
  ): Promise<TransactionResult> {
    // For now, this is a placeholder
    // Actual implementation depends on node support for EIP-7702
    // When EIP-7702 is fully supported:
    // 1. Build the Type 4 transaction
    // 2. Sign the transaction envelope
    // 3. Send via eth_sendRawTransaction

    throw createTransactionError(
      'EIP-7702 transaction sending requires node support',
      { reason: 'NOT_IMPLEMENTED' }
    )
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

  return {
    createAuthorization,
    buildDelegation,
    buildRevocation,
    send,
    isDelegated,
    getDelegateAddress,
    getAccountNonce,
    getGasPrices,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type EIP7702TransactionBuilder = ReturnType<
  typeof createEIP7702TransactionBuilder
>
