import type { Address, Hex } from 'viem'
import type {
  TransactionMode,
  MultiModeTransactionRequest,
  TransactionResult,
  GasEstimate,
  Account,
} from '@stablenet/sdk-types'
import {
  TRANSACTION_MODE,
  GAS_PAYMENT_TYPE,
  getAvailableTransactionModes,
  getDefaultTransactionMode,
} from '@stablenet/sdk-types'
import {
  createEOATransactionBuilder,
  type TransactionSigner,
} from './eoaTransaction'
import {
  createEIP7702TransactionBuilder,
  type AuthorizationSigner,
} from './eip7702Transaction'
import { createGasEstimator, type GasEstimator } from '../gas'
import { createTransactionError } from '../errors'

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction router configuration
 */
export interface TransactionRouterConfig {
  /** RPC URL for the network */
  rpcUrl: string

  /** Chain ID */
  chainId: number

  /** Bundler RPC URL (required for Smart Account mode) */
  bundlerUrl?: string

  /** Paymaster RPC URL (required for sponsored/ERC20 gas) */
  paymasterUrl?: string

  /** Entry point address for ERC-4337 */
  entryPointAddress?: Address
}

/**
 * Prepared transaction ready for execution
 */
export interface PreparedTransaction {
  /** Original request */
  request: MultiModeTransactionRequest

  /** Resolved transaction mode */
  mode: TransactionMode

  /** Gas estimate */
  gasEstimate: GasEstimate

  /** Paymaster data (if applicable) */
  paymasterData?: {
    paymaster: Address
    paymasterData: Hex
    paymasterVerificationGasLimit: bigint
    paymasterPostOpGasLimit: bigint
  }

  /** Authorization list for EIP-7702 */
  authorizationList?: Array<{
    chainId: bigint
    address: Address
    nonce: bigint
    v: number
    r: Hex
    s: Hex
  }>
}

/**
 * Transaction execution options
 */
export interface ExecuteOptions {
  /** Wait for confirmation */
  waitForConfirmation?: boolean

  /** Number of confirmations to wait for */
  confirmations?: number

  /** Timeout in milliseconds */
  timeout?: number
}

// ============================================================================
// Constants
// ============================================================================

/** Default entry point address (ERC-4337 v0.7) */
const DEFAULT_ENTRY_POINT =
  '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

/** Default confirmation timeout */
const DEFAULT_CONFIRMATION_TIMEOUT = 60_000

// ============================================================================
// Transaction Router
// ============================================================================

/**
 * Create a multi-mode transaction router
 *
 * @example
 * ```typescript
 * const router = createTransactionRouter({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 *   bundlerUrl: 'https://bundler.example.com',
 *   paymasterUrl: 'https://paymaster.example.com',
 * })
 *
 * // Prepare and execute
 * const prepared = await router.prepare(request, account)
 * const result = await router.execute(prepared, signer)
 * ```
 */
export function createTransactionRouter(config: TransactionRouterConfig) {
  const {
    rpcUrl,
    chainId,
    bundlerUrl,
    paymasterUrl,
    entryPointAddress = DEFAULT_ENTRY_POINT,
  } = config

  // Initialize builders
  const eoaBuilder = createEOATransactionBuilder({ rpcUrl, chainId })
  const eip7702Builder = createEIP7702TransactionBuilder({ rpcUrl, chainId })
  const gasEstimator = createGasEstimator({
    rpcUrl,
    chainId,
    bundlerUrl,
    paymasterUrl,
  })

  /**
   * Validate that the requested mode is available for the account
   */
  function validateMode(mode: TransactionMode, account: Account): void {
    const availableModes = getAvailableTransactionModes(account)

    if (!availableModes.includes(mode)) {
      throw createTransactionError(
        `Transaction mode '${mode}' is not available for account type '${account.type}'. ` +
          `Available modes: ${availableModes.join(', ')}`,
        { reason: 'INVALID_MODE' }
      )
    }

    // Additional validation for Smart Account mode
    if (mode === TRANSACTION_MODE.SMART_ACCOUNT && !bundlerUrl) {
      throw createTransactionError(
        'Bundler URL is required for Smart Account mode',
        { reason: 'BUNDLER_NOT_CONFIGURED' }
      )
    }
  }

  /**
   * Resolve the transaction mode based on account state and preferences
   */
  function resolveMode(
    request: MultiModeTransactionRequest,
    account: Account
  ): TransactionMode {
    // If mode is explicitly specified, validate and use it
    if (request.mode) {
      validateMode(request.mode, account)
      return request.mode
    }

    // Otherwise, use default for account type
    return getDefaultTransactionMode(account)
  }

  /**
   * Prepare a transaction for execution
   */
  async function prepare(
    request: MultiModeTransactionRequest,
    account: Account
  ): Promise<PreparedTransaction> {
    // Resolve mode
    const mode = resolveMode(request, account)

    // Get gas estimate
    const requestWithMode = { ...request, mode }
    const gasEstimate = await gasEstimator.estimate(requestWithMode)

    // Build prepared transaction
    const prepared: PreparedTransaction = {
      request: requestWithMode,
      mode,
      gasEstimate,
    }

    // Mode-specific preparation
    switch (mode) {
      case TRANSACTION_MODE.EOA:
        // No additional preparation needed
        break

      case TRANSACTION_MODE.EIP7702:
        // Authorization list is built during execution with signer
        break

      case TRANSACTION_MODE.SMART_ACCOUNT:
        // Prepare paymaster data if needed
        if (
          request.gasPayment?.type === GAS_PAYMENT_TYPE.SPONSOR ||
          request.gasPayment?.type === GAS_PAYMENT_TYPE.ERC20
        ) {
          // Paymaster data would be fetched here
          // This is a placeholder - actual implementation calls PaymasterClient
          if (paymasterUrl) {
            // TODO: Fetch paymaster data from PaymasterClient
          }
        }
        break
    }

    return prepared
  }

  /**
   * Execute a prepared transaction
   */
  async function execute(
    prepared: PreparedTransaction,
    signer: TransactionSigner & AuthorizationSigner,
    options: ExecuteOptions = {}
  ): Promise<TransactionResult> {
    const {
      waitForConfirmation = false,
      confirmations = 1,
      timeout = DEFAULT_CONFIRMATION_TIMEOUT,
    } = options

    let result: TransactionResult

    switch (prepared.mode) {
      case TRANSACTION_MODE.EOA: {
        const built = await eoaBuilder.build(prepared.request)
        result = await eoaBuilder.send(built, signer)

        if (waitForConfirmation) {
          await eoaBuilder.waitForReceipt(result.hash, { confirmations, timeout })
        }
        break
      }

      case TRANSACTION_MODE.EIP7702: {
        const built = await eip7702Builder.buildDelegation(
          {
            account: prepared.request.from,
            delegateAddress: prepared.request.to,
          },
          signer
        )
        result = await eip7702Builder.send(built, signer)
        break
      }

      case TRANSACTION_MODE.SMART_ACCOUNT: {
        // Smart Account execution via Bundler
        // This is a simplified implementation
        // Real implementation would use BundlerClient
        if (!bundlerUrl) {
          throw createTransactionError(
            'Bundler URL is required for Smart Account execution',
            { reason: 'BUNDLER_NOT_CONFIGURED' }
          )
        }

        // Build UserOperation
        const userOp = await buildUserOperation(prepared, signer)

        // Send via bundler
        result = await sendUserOperation(userOp)

        if (waitForConfirmation) {
          await waitForUserOperationReceipt(result.hash, { timeout })
        }
        break
      }

      default:
        throw createTransactionError(
          `Unknown transaction mode: ${prepared.mode}`,
          { reason: 'INVALID_MODE' }
        )
    }

    return result
  }

  /**
   * Build a UserOperation from prepared transaction
   */
  async function buildUserOperation(
    prepared: PreparedTransaction,
    signer: TransactionSigner & AuthorizationSigner
  ): Promise<UserOperation> {
    const { request, gasEstimate, paymasterData } = prepared

    // Encode calldata for Smart Account
    const callData = encodeSmartAccountCall(
      request.to,
      request.value,
      request.data
    )

    // Get nonce from entry point
    const nonce = await getSmartAccountNonce(request.from)

    // Build UserOperation
    const userOp: UserOperation = {
      sender: request.from,
      nonce,
      callData,
      callGasLimit: gasEstimate.callGasLimit ?? gasEstimate.gasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit ?? 150_000n,
      preVerificationGas: gasEstimate.preVerificationGas ?? 50_000n,
      maxFeePerGas: gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
      signature: '0x' as Hex, // Will be filled after signing
    }

    // Add paymaster data if applicable
    if (paymasterData) {
      userOp.paymaster = paymasterData.paymaster
      userOp.paymasterData = paymasterData.paymasterData
      userOp.paymasterVerificationGasLimit =
        paymasterData.paymasterVerificationGasLimit
      userOp.paymasterPostOpGasLimit = paymasterData.paymasterPostOpGasLimit
    }

    // Sign the UserOperation
    const userOpHash = getUserOpHash(userOp, entryPointAddress, chainId)
    const signature = await signer.signAuthorization(userOpHash)
    userOp.signature = encodeSignature(signature)

    return userOp
  }

  /**
   * Send UserOperation to bundler
   */
  async function sendUserOperation(
    userOp: UserOperation
  ): Promise<TransactionResult> {
    // RPC call to bundler
    const response = await fetch(bundlerUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendUserOperation',
        params: [userOp, entryPointAddress],
        id: 1,
      }),
    })

    const result = await response.json()

    if (result.error) {
      throw createTransactionError(`Bundler error: ${result.error.message}`, {
        reason: 'BUNDLER_ERROR',
      })
    }

    return {
      hash: result.result as Hex,
      mode: TRANSACTION_MODE.SMART_ACCOUNT,
      chainId,
      timestamp: Date.now(),
    }
  }

  /**
   * Wait for UserOperation receipt
   */
  async function waitForUserOperationReceipt(
    userOpHash: Hex,
    options: { timeout?: number } = {}
  ): Promise<void> {
    const { timeout = DEFAULT_CONFIRMATION_TIMEOUT } = options

    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const response = await fetch(bundlerUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
          id: 1,
        }),
      })

      const result = await response.json()

      if (result.result) {
        return // Receipt found
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw createTransactionError(
      `UserOperation confirmation timeout after ${timeout}ms`,
      { reason: 'CONFIRMATION_TIMEOUT' }
    )
  }

  /**
   * Get all available modes for an account with gas estimates
   */
  async function getAvailableModesWithEstimates(
    request: Omit<MultiModeTransactionRequest, 'mode'>,
    account: Account
  ): Promise<
    Array<{ mode: TransactionMode; estimate: GasEstimate; available: boolean }>
  > {
    const availableModes = getAvailableTransactionModes(account)
    const estimates = await gasEstimator.estimateAllModes(request)

    return Object.entries(estimates).map(([mode, estimate]) => ({
      mode: mode as TransactionMode,
      estimate: estimate ?? {
        gasLimit: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        estimatedCost: 0n,
      },
      available:
        availableModes.includes(mode as TransactionMode) && estimate !== null,
    }))
  }

  return {
    prepare,
    execute,
    resolveMode,
    validateMode,
    getAvailableModesWithEstimates,
    // Expose sub-builders for advanced usage
    eoaBuilder,
    eip7702Builder,
    gasEstimator,
  }
}

// ============================================================================
// Helper Functions (Stubs - Real implementation in separate files)
// ============================================================================

interface UserOperation {
  sender: Address
  nonce: bigint
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  signature: Hex
  paymaster?: Address
  paymasterData?: Hex
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
}

function encodeSmartAccountCall(
  _to: Address,
  _value: bigint,
  _data: Hex
): Hex {
  // Kernel's execute function encoding
  // This should use viem's encodeFunctionData with proper ABI
  return '0x' as Hex
}

async function getSmartAccountNonce(_account: Address): Promise<bigint> {
  // Get nonce from entry point
  return 0n
}

function getUserOpHash(
  _userOp: UserOperation,
  _entryPoint: Address,
  _chainId: number
): Hex {
  // Calculate UserOperation hash
  return '0x' as Hex
}

function encodeSignature(signature: { v: number; r: Hex; s: Hex }): Hex {
  // Encode signature in appropriate format
  return `${signature.r}${signature.s.slice(2)}${signature.v.toString(16).padStart(2, '0')}` as Hex
}

// ============================================================================
// Exports
// ============================================================================

export type TransactionRouter = ReturnType<typeof createTransactionRouter>
