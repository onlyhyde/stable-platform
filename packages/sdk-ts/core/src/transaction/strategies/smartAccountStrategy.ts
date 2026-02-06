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
import { ACCOUNT_TYPE, GAS_PAYMENT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import type { Address, Hash, Hex } from 'viem'
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

/** Default entry point address (ERC-4337 v0.7) */
const DEFAULT_ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

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
    rpcUrl: _rpcUrl,
    chainId,
    bundlerUrl,
    paymasterUrl,
    entryPointAddress = DEFAULT_ENTRY_POINT,
  } = config

  // Create clients
  const bundlerClient = createBundlerClient({
    url: bundlerUrl,
    entryPoint: entryPointAddress,
    chainId: BigInt(chainId),
  })
  const paymasterClient = paymasterUrl
    ? createPaymasterClient({ url: paymasterUrl, chainId })
    : null

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

      // Estimate gas via bundler
      const gasEstimation = await bundlerClient.estimateUserOperationGas({
        sender: request.from,
        callData,
        nonce: 0n, // Will be fetched properly
      })

      // Build partial UserOperation
      const userOp: Partial<UserOperation> = {
        sender: request.from,
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
            nonce: 0n,
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

      // Build final UserOperation
      const userOp: UserOperation = {
        sender: prepared.request.from,
        nonce: 0n, // Should be fetched from entry point
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
      const userOpHash = await calculateUserOpHash(userOp, entryPointAddress, chainId)
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
 */
function encodeSmartAccountCall(_to: Address, _value: bigint, _data: Hex): Hex {
  // Kernel's execute function encoding
  // This is a placeholder - actual implementation would use viem's encodeFunctionData
  return '0x' as Hex
}

/**
 * Calculate UserOperation hash
 */
async function calculateUserOpHash(
  _userOp: UserOperation,
  _entryPoint: Address,
  _chainId: number
): Promise<Hex> {
  // This is a placeholder - actual implementation would hash the UserOp
  return '0x' as Hex
}

/**
 * Encode signature in appropriate format
 */
function encodeSignature(signature: { v: number; r: Hex; s: Hex }): Hex {
  return `${signature.r}${signature.s.slice(2)}${signature.v.toString(16).padStart(2, '0')}` as Hex
}
