/**
 * EIP-7702 Transaction Strategy
 *
 * Strategy for EIP-7702 (Set Code) transactions that enable EOA delegation.
 * Follows SRP: handles only EIP-7702 mode transactions.
 */

import type { Account, MultiModeTransactionRequest, TransactionResult } from '@stablenet/sdk-types'
import { ACCOUNT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import type { Hash } from 'viem'
import {
  BASE_TRANSFER_GAS,
  EIP7702_AUTH_GAS,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  GAS_PER_AUTHORIZATION,
} from '../../config'
import { createTransactionError } from '../../errors'
import { createEIP7702TransactionBuilder } from '../eip7702Transaction'
import type {
  BaseStrategyConfig,
  CombinedSigner,
  StrategyExecuteOptions,
  StrategyPreparedTransaction,
  TransactionStrategy,
} from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * EIP-7702 specific prepared data
 */
interface EIP7702PreparedData {
  delegateAddress: string
  isRevocation: boolean
}

// ============================================================================
// Strategy Implementation
// ============================================================================

/**
 * Create an EIP-7702 transaction strategy
 */
export function createEIP7702Strategy(config: BaseStrategyConfig): TransactionStrategy {
  const { rpcUrl, chainId } = config

  // Create the underlying builder
  const builder = createEIP7702TransactionBuilder({ rpcUrl, chainId })

  return {
    mode: TRANSACTION_MODE.EIP7702,

    /**
     * EIP-7702 mode supports EOA and delegated accounts
     */
    supports(account: Account): boolean {
      return account.type === ACCOUNT_TYPE.EOA || account.type === ACCOUNT_TYPE.DELEGATED
    },

    /**
     * Validate request for EIP-7702 mode
     */
    validate(request: MultiModeTransactionRequest, _account: Account): void {
      if (!request.from) {
        throw createTransactionError('Missing "from" address', {
          reason: 'INVALID_REQUEST',
        })
      }

      if (!request.to) {
        throw createTransactionError('Missing "to" (delegate) address', {
          reason: 'INVALID_REQUEST',
        })
      }
    },

    /**
     * Prepare EIP-7702 transaction
     */
    async prepare(
      request: MultiModeTransactionRequest,
      account: Account
    ): Promise<StrategyPreparedTransaction> {
      this.validate(request, account)

      // Get gas prices for estimation
      const { maxFeePerGas, maxPriorityFeePerGas } = await builder.getGasPrices()

      // Gas estimation aligned with eip7702GasStrategy:
      // base transfer (21K) + auth overhead (25K) + per-auth cost (12.5K × count) + 10% buffer
      const authCount = BigInt(request.authorizationList?.length ?? 1)
      const baseGas = BASE_TRANSFER_GAS + EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * authCount
      const gasLimit = (baseGas * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      const gasEstimate = {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost: gasLimit * maxFeePerGas,
      }

      const preparedData: EIP7702PreparedData = {
        delegateAddress: request.to,
        isRevocation: request.to === '0x0000000000000000000000000000000000000000',
      }

      return {
        mode: TRANSACTION_MODE.EIP7702,
        request: { ...request, mode: TRANSACTION_MODE.EIP7702 },
        gasEstimate,
        strategyData: preparedData,
      }
    },

    /**
     * Execute EIP-7702 transaction
     */
    async execute(
      prepared: StrategyPreparedTransaction,
      signer: CombinedSigner,
      _options?: StrategyExecuteOptions
    ): Promise<TransactionResult> {
      const preparedData = prepared.strategyData as EIP7702PreparedData

      // Build the delegation/revocation
      const built = preparedData.isRevocation
        ? await builder.buildRevocation({ account: prepared.request.from }, signer)
        : await builder.buildDelegation(
            {
              account: prepared.request.from,
              delegateAddress: prepared.request.to,
            },
            signer
          )

      // Send the transaction
      return builder.send(built, signer)
    },

    /**
     * Wait for transaction confirmation
     *
     * Delegates to the EIP-7702 transaction builder's waitForReceipt,
     * following the same pattern as EOA strategy.
     */
    async waitForConfirmation(
      hash: Hash,
      options?: { confirmations?: number; timeout?: number }
    ): Promise<void> {
      await builder.waitForReceipt(hash, options)
    },
  }
}
