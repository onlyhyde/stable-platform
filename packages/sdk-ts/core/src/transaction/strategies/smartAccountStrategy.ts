/**
 * Smart Account Transaction Strategy
 *
 * Strategy for ERC-4337 Smart Account transactions via bundler.
 * Follows SRP: handles only Smart Account mode transactions.
 */

import type {
  Account,
  MultiModeTransactionRequest,
  TransactionResult,
  UserOperation,
} from '@stablenet/sdk-types'
import {
  ACCOUNT_TYPE,
  ENTRY_POINT_ADDRESS,
  GAS_PAYMENT_TYPE,
  TRANSACTION_MODE,
} from '@stablenet/sdk-types'
import type { Address, Hash, Hex } from 'viem'
import { concat, encodeFunctionData, pad, toHex } from 'viem'
import { ENTRY_POINT_ABI } from '../../abis/entryPoint'
import { KERNEL_ABI } from '../../abis/kernel'
import { createBundlerClient } from '../../clients/bundlerClient'
import {
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_CONFIRMATION_TIMEOUT,
  DEFAULT_MAX_FEE_PER_GAS,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
} from '../../config'
import { createTransactionError } from '../../errors'
import { createPaymasterClient } from '../../paymasterClient'
import { createViemProvider, type RpcProvider } from '../../providers'
import { getUserOperationHash } from '../../utils/userOperation'
import type {
  CombinedSigner,
  SmartAccountStrategyConfig,
  StrategyExecuteOptions,
  StrategyPreparedTransaction,
  TransactionStrategy,
} from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Smart Account specific prepared data
 */
interface SmartAccountPreparedData {
  userOp: Partial<UserOperation>
  paymasterData?: {
    paymaster: Address
    paymasterData: Hex
    paymasterVerificationGasLimit: bigint
    paymasterPostOpGasLimit: bigint
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Default entry point address (ERC-4337) */
const DEFAULT_ENTRY_POINT = ENTRY_POINT_ADDRESS as Address

// ============================================================================
// Strategy Implementation
// ============================================================================

/**
 * Create a Smart Account transaction strategy
 */
export function createSmartAccountStrategy(
  config: SmartAccountStrategyConfig
): TransactionStrategy {
  const {
    rpcUrl,
    chainId,
    bundlerUrl,
    paymasterUrl,
    entryPointAddress = DEFAULT_ENTRY_POINT,
  } = config

  // Create provider for on-chain reads (nonce, etc.)
  const provider: RpcProvider = createViemProvider({ rpcUrl, chainId })

  // Create clients
  const bundlerClient = createBundlerClient({
    url: bundlerUrl,
    entryPoint: entryPointAddress,
    chainId: BigInt(chainId),
  })
  const paymasterClient = paymasterUrl
    ? createPaymasterClient({ url: paymasterUrl, chainId })
    : null

  /**
   * Fetch the current nonce from the EntryPoint contract
   */
  async function getNonce(sender: Address, key = 0n): Promise<bigint> {
    const result = await provider.readContract<bigint>({
      address: entryPointAddress,
      abi: ENTRY_POINT_ABI,
      functionName: 'getNonce',
      args: [sender, key],
    })
    return BigInt(result)
  }

  return {
    mode: TRANSACTION_MODE.SMART_ACCOUNT,

    /**
     * Smart Account mode supports deployed smart accounts
     */
    supports(account: Account): boolean {
      return (
        account.type === ACCOUNT_TYPE.SMART ||
        (account.type === ACCOUNT_TYPE.DELEGATED && account.isDeployed === true)
      )
    },

    /**
     * Validate request for Smart Account mode
     */
    validate(request: MultiModeTransactionRequest, _account: Account): void {
      if (!request.from) {
        throw createTransactionError('Missing "from" address', {
          reason: 'INVALID_REQUEST',
        })
      }

      if (!request.to) {
        throw createTransactionError('Missing "to" address', {
          reason: 'INVALID_REQUEST',
        })
      }

      // Check for paymaster requirement
      if (
        request.gasPayment?.type === GAS_PAYMENT_TYPE.SPONSOR ||
        request.gasPayment?.type === GAS_PAYMENT_TYPE.ERC20
      ) {
        if (!paymasterClient) {
          throw createTransactionError(
            'Paymaster URL is required for sponsored or ERC20 gas payment',
            { reason: 'PAYMASTER_NOT_CONFIGURED' }
          )
        }
      }
    },

    /**
     * Prepare Smart Account transaction
     */
    async prepare(
      request: MultiModeTransactionRequest,
      account: Account
    ): Promise<StrategyPreparedTransaction> {
      this.validate(request, account)

      // Encode calldata for Smart Account
      const callData = encodeSmartAccountCall(request.to, request.value, request.data)

      // Fetch nonce from EntryPoint
      const nonce = await getNonce(request.from)

      // Estimate gas via bundler
      const gasEstimation = await bundlerClient.estimateUserOperationGas({
        sender: request.from,
        callData,
        nonce,
      })

      // Build partial UserOperation
      const userOp: Partial<UserOperation> = {
        sender: request.from,
        nonce,
        callData,
        callGasLimit: gasEstimation.callGasLimit,
        verificationGasLimit: gasEstimation.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
        preVerificationGas: gasEstimation.preVerificationGas ?? DEFAULT_PRE_VERIFICATION_GAS,
        maxFeePerGas: request.maxFeePerGas ?? 0n,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas ?? 0n,
      }

      const preparedData: SmartAccountPreparedData = {
        userOp,
      }

      // Get paymaster data if needed
      if (paymasterClient && request.gasPayment) {
        const paymasterResponse = await paymasterClient.getPaymasterData(
          {
            sender: request.from,
            nonce,
            callData,
            callGasLimit: gasEstimation.callGasLimit,
            verificationGasLimit:
              gasEstimation.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
            preVerificationGas: gasEstimation.preVerificationGas ?? DEFAULT_PRE_VERIFICATION_GAS,
            maxFeePerGas: request.maxFeePerGas ?? 0n,
            maxPriorityFeePerGas: request.maxPriorityFeePerGas ?? 0n,
          },
          request.gasPayment
        )

        if (paymasterResponse) {
          preparedData.paymasterData = paymasterResponse
        }
      }

      // Calculate gas estimate
      const gasLimit =
        gasEstimation.callGasLimit +
        (gasEstimation.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT) +
        (gasEstimation.preVerificationGas ?? DEFAULT_PRE_VERIFICATION_GAS)

      const maxFeePerGas = request.maxFeePerGas ?? DEFAULT_MAX_FEE_PER_GAS
      const estimatedCost = gasLimit * maxFeePerGas

      return {
        mode: TRANSACTION_MODE.SMART_ACCOUNT,
        request: { ...request, mode: TRANSACTION_MODE.SMART_ACCOUNT },
        gasEstimate: {
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas: request.maxPriorityFeePerGas ?? maxFeePerGas,
          estimatedCost,
          callGasLimit: gasEstimation.callGasLimit,
          verificationGasLimit: gasEstimation.verificationGasLimit,
          preVerificationGas: gasEstimation.preVerificationGas,
        },
        strategyData: preparedData,
      }
    },

    /**
     * Execute Smart Account transaction
     */
    async execute(
      prepared: StrategyPreparedTransaction,
      signer: CombinedSigner,
      options?: StrategyExecuteOptions
    ): Promise<TransactionResult> {
      const preparedData = prepared.strategyData as SmartAccountPreparedData

      // Fetch fresh nonce for execution (may have changed since prepare)
      const executionNonce = preparedData.userOp.nonce ?? (await getNonce(prepared.request.from))

      // Build final UserOperation
      const userOp: UserOperation = {
        sender: prepared.request.from,
        nonce: executionNonce,
        callData: preparedData.userOp.callData!,
        callGasLimit:
          preparedData.userOp.callGasLimit ??
          prepared.gasEstimate.callGasLimit ??
          DEFAULT_CALL_GAS_LIMIT,
        verificationGasLimit:
          preparedData.userOp.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
        preVerificationGas: preparedData.userOp.preVerificationGas ?? DEFAULT_PRE_VERIFICATION_GAS,
        maxFeePerGas: prepared.gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: prepared.gasEstimate.maxPriorityFeePerGas,
        signature: '0x' as Hex,
      }

      // Add paymaster data if available
      if (preparedData.paymasterData) {
        userOp.paymaster = preparedData.paymasterData.paymaster
        userOp.paymasterData = preparedData.paymasterData.paymasterData
        userOp.paymasterVerificationGasLimit =
          preparedData.paymasterData.paymasterVerificationGasLimit
        userOp.paymasterPostOpGasLimit = preparedData.paymasterData.paymasterPostOpGasLimit
      }

      // Sign the UserOperation
      const userOpHash = calculateUserOpHash(userOp, entryPointAddress, chainId)
      const signature = await signer.signAuthorization(userOpHash)
      userOp.signature = encodeSignature(signature)

      // Send via bundler
      const hash = await bundlerClient.sendUserOperation(userOp)

      const result: TransactionResult = {
        hash,
        mode: TRANSACTION_MODE.SMART_ACCOUNT,
        chainId,
        timestamp: Date.now(),
      }

      // Wait for confirmation if requested
      if (options?.waitForConfirmation) {
        await this.waitForConfirmation(hash as Hash, {
          timeout: options.timeout,
        })
      }

      return result
    },

    /**
     * Wait for UserOperation confirmation
     */
    async waitForConfirmation(
      hash: Hash,
      options?: { confirmations?: number; timeout?: number }
    ): Promise<void> {
      const timeout = options?.timeout ?? DEFAULT_CONFIRMATION_TIMEOUT

      await bundlerClient.waitForUserOperationReceipt(hash, {
        timeout,
        pollingInterval: 2000,
      })
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Encode Smart Account execute call
 *
 * Encodes a call to Kernel v0.3.3's execute(bytes32 mode, bytes executionCalldata).
 * ExecMode 0x00 = single call, default exec type, padded to 32 bytes.
 * executionCalldata = abi.encodePacked(target, value, callData)
 */
function encodeSmartAccountCall(to: Address, value = 0n, data: Hex = '0x'): Hex {
  // ExecMode: 0x00 (single call), padded to 32 bytes
  const execMode = pad('0x00' as Hex, { size: 32 })

  // executionCalldata: abi.encodePacked(target[20], value[32], callData[variable])
  const executionCalldata = concat([
    to, // 20 bytes: target address
    pad(toHex(value), { size: 32 }), // 32 bytes: value
    data, // variable: callData
  ]) as Hex

  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })
}

/**
 * Calculate UserOperation hash using the already-implemented getUserOperationHash utility
 */
function calculateUserOpHash(userOp: UserOperation, entryPoint: Address, chainId: number): Hex {
  return getUserOperationHash(userOp, entryPoint, BigInt(chainId))
}

/**
 * Encode signature in appropriate format
 */
function encodeSignature(signature: { v: number; r: Hex; s: Hex }): Hex {
  return `${signature.r}${signature.s.slice(2)}${signature.v.toString(16).padStart(2, '0')}` as Hex
}
