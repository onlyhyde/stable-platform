/**
 * EOA Transaction Strategy
 *
 * Strategy for standard EOA (Externally Owned Account) transactions.
 * Follows SRP: handles only EOA mode transactions.
 */

import type { Account, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { ACCOUNT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import type { Hash } from 'viem'
import { createTransactionError } from '../../errors'
import { createEOATransactionBuilder } from '../eoaTransaction'
import type {
  BaseStrategyConfig,
  CombinedSigner,
  StrategyExecuteOptions,
  StrategyPreparedTransaction,
  TransactionStrategy,
} from './types'

// ============================================================================
// Strategy Implementation
// ============================================================================

/**
 * Create an EOA transaction strategy
 */
export function createEOAStrategy(config: BaseStrategyConfig): TransactionStrategy {
  const { rpcUrl, chainId } = config

  // Create the underlying builder
  const builder = createEOATransactionBuilder({ rpcUrl, chainId })

  return {
    mode: TRANSACTION_MODE.EOA,

    /**
     * EOA mode supports all EOA accounts
     */
    supports(account: Account): boolean {
      return account.type === ACCOUNT_TYPE.EOA
    },

    /**
     * Validate request for EOA mode
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
    },

    /**
     * Prepare EOA transaction
     */
    async prepare(
      request: MultiModeTransactionRequest,
      account: Account
    ): Promise<StrategyPreparedTransaction> {
      this.validate(request, account)

      // Build the transaction
      const built = await builder.build(request)

      return {
        mode: TRANSACTION_MODE.EOA,
        request: { ...request, mode: TRANSACTION_MODE.EOA },
        gasEstimate: built.gasEstimate,
        strategyData: built,
      }
    },

    /**
     * Execute EOA transaction
     */
    async execute(
      prepared: StrategyPreparedTransaction,
      signer: CombinedSigner,
      options?: StrategyExecuteOptions
    ) {
      const built = prepared.strategyData as Awaited<ReturnType<typeof builder.build>>

      // Send the transaction
      const result = await builder.send(built, signer)

      // Wait for confirmation if requested
      if (options?.waitForConfirmation) {
        await this.waitForConfirmation(result.hash as Hash, {
          confirmations: options.confirmations,
          timeout: options.timeout,
        })
      }

      return result
    },

    /**
     * Wait for transaction confirmation
     */
    async waitForConfirmation(
      hash: Hash,
      options?: { confirmations?: number; timeout?: number }
    ): Promise<void> {
      await builder.waitForReceipt(hash, options)
    },
  }
}
