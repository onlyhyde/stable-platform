import { createBundlerClient } from '@stablenet/core'
import { getEntryPoint, isChainSupported } from '@stablenet/contracts'
import { ENTRY_POINT_ADDRESS } from '@stablenet/core'
import { createPublicClient, http } from 'viem'
import type { Address, Hex } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import type { PendingTransaction } from '../../types'
import { walletState } from '../state/store'

const logger = createLogger('TransactionWatcher')

const POLL_INTERVAL = 3000 // 3 seconds
const USEROP_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes — matches bundler mempool TTL
const BUNDLER_DROP_CHECK_INTERVAL = 5 // Check bundler mempool every N polls

/**
 * Watches pending/submitted transactions and updates their status.
 *
 * Two distinct tracking paths:
 *
 * 1. **UserOp path** (type='userOp'):
 *    - Poll bundler `getUserOperationReceipt` for on-chain txHash
 *    - If receipt found → extract txHash, update status, move to history
 *    - If receipt not found → check `getUserOperationByHash` for mempool status
 *    - If dropped from mempool (null) → mark as failed
 *    - Time-based expiry after USEROP_MAX_AGE_MS
 *
 * 2. **Direct tx path** (type!='userOp'):
 *    - Poll blockchain `getTransactionReceipt` using txHash
 *    - Standard on-chain receipt confirmation
 */
class TransactionWatcher {
  private timer: ReturnType<typeof setInterval> | null = null
  private pollCount = 0

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.pollPendingTransactions().catch((err) => {
        logger.error('Poll error', err)
      })
    }, POLL_INTERVAL)
    logger.info('TransactionWatcher started')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      logger.info('TransactionWatcher stopped')
    }
  }

  private async pollPendingTransactions(): Promise<void> {
    const state = walletState.getState()
    const pending = state.transactions.pendingTransactions.filter(
      (tx) => tx.status === 'submitted' || tx.status === 'pending'
    )

    if (pending.length === 0) return

    this.pollCount++

    const network = walletState.getCurrentNetwork()
    if (!network) return

    for (const tx of pending) {
      if (tx.type === 'userOp') {
        await this.handleUserOpTransaction(tx, network)
      } else {
        await this.handleDirectTransaction(tx, network)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // UserOp path: bundler → txHash → on-chain receipt
  // ─────────────────────────────────────────────────────────────────────

  private async handleUserOpTransaction(
    tx: PendingTransaction,
    network: { bundlerUrl?: string; rpcUrl: string; chainId: number }
  ): Promise<void> {
    if (!tx.userOpHash) {
      logger.warn(`[UserOp] tx ${tx.id} has type='userOp' but no userOpHash, skipping`)
      return
    }

    // Step 0: Time-based expiry
    if (tx.timestamp) {
      const age = Date.now() - tx.timestamp
      if (age > USEROP_MAX_AGE_MS) {
        logger.warn(
          `[UserOp] ${tx.userOpHash.slice(0, 14)}... expired after ${Math.round(age / 60000)}min`
        )
        await this.finalizeTx(tx.id, 'failed', { error: 'UserOp expired (bundler mempool TTL)' })
        return
      }
    }

    if (!network.bundlerUrl) {
      logger.warn(`[UserOp] No bundler URL for chain ${network.chainId}`)
      return
    }

    const entryPoint = this.getEntryPoint(network.chainId)
    const bundlerClient = createBundlerClient({
      url: network.bundlerUrl,
      entryPoint,
    })

    // Step 1: If we already have a txHash (from a previous poll), check on-chain
    if (tx.txHash) {
      await this.checkOnChainReceipt(tx, network.rpcUrl)
      return
    }

    // Step 2: Query bundler for UserOp receipt (contains txHash + success status)
    try {
      const receipt = await bundlerClient.getUserOperationReceipt(
        tx.userOpHash as `0x${string}`
      )

      if (receipt) {
        // Bundle was submitted on-chain — extract txHash and status
        const txHash = receipt.receipt.transactionHash
        const status = receipt.success ? 'confirmed' : 'failed'

        logger.info(
          `[UserOp] ${tx.userOpHash.slice(0, 14)}... → txHash=${txHash.slice(0, 14)}... status=${status}`
        )

        await this.finalizeTx(tx.id, status, {
          txHash,
          gasUsed: receipt.actualGasUsed,
          blockNumber: receipt.receipt.blockNumber,
        })
        return
      }
    } catch {
      // Bundler RPC error — continue to fallback checks
    }

    // Step 3: Periodically check if UserOp is still in bundler mempool
    // (avoid checking every single poll — getUserOperationByHash is heavier)
    if (this.pollCount % BUNDLER_DROP_CHECK_INTERVAL === 0) {
      try {
        const opInfo = await bundlerClient.getUserOperationByHash(
          tx.userOpHash as `0x${string}`
        )

        if (!opInfo) {
          // UserOp is NOT in mempool AND has no on-chain receipt
          // → Bundler dropped it (validation failure, bundle revert, restart)
          logger.warn(
            `[UserOp] ${tx.userOpHash.slice(0, 14)}... dropped from bundler mempool`
          )
          await this.finalizeTx(tx.id, 'failed', {
            error: 'UserOp dropped by bundler (not in mempool)',
          })
          return
        }

        // If bundler returns a transactionHash in getUserOperationByHash,
        // the UserOp was included in a bundle but receipt isn't ready yet.
        if (opInfo.transactionHash) {
          await walletState.updateTransaction(tx.id, {
            txHash: opInfo.transactionHash,
          })
          logger.info(
            `[UserOp] ${tx.userOpHash.slice(0, 14)}... got txHash=${opInfo.transactionHash.slice(0, 14)}..., waiting for receipt`
          )
        }
      } catch {
        // Bundler query failed — not critical, will retry next cycle
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Direct tx path: txHash → on-chain receipt
  // ─────────────────────────────────────────────────────────────────────

  private async handleDirectTransaction(
    tx: PendingTransaction,
    network: { rpcUrl: string }
  ): Promise<void> {
    if (!tx.txHash) {
      // Direct transactions without txHash can't be tracked
      return
    }

    await this.checkOnChainReceipt(tx, network.rpcUrl)
  }

  // ─────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Check on-chain transaction receipt for a known txHash.
   * Works for both UserOp (after txHash is resolved) and direct transactions.
   */
  private async checkOnChainReceipt(
    tx: PendingTransaction,
    rpcUrl: string
  ): Promise<void> {
    if (!tx.txHash) return

    try {
      const client = createPublicClient({ transport: http(rpcUrl) })
      const receipt = await client.getTransactionReceipt({
        hash: tx.txHash as `0x${string}`,
      })
      if (!receipt) return

      const status = receipt.status === 'success' ? 'confirmed' : 'failed'

      await this.finalizeTx(tx.id, status, {
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber,
      })

      logger.info(
        `[TX] ${tx.txHash.slice(0, 14)}... ${status} at block ${receipt.blockNumber}`
      )
    } catch {
      // Receipt not available yet — tx still in mempool
    }
  }

  /**
   * Finalize a transaction: update status + move to history.
   */
  private async finalizeTx(
    txId: string,
    status: 'confirmed' | 'failed',
    data: {
      txHash?: Hex
      gasUsed?: bigint
      blockNumber?: bigint
      error?: string
    } = {}
  ): Promise<void> {
    await walletState.updateTransaction(txId, {
      status: status as 'confirmed' | 'failed',
      ...(data.txHash && { txHash: data.txHash }),
      ...(data.gasUsed !== undefined && { gasUsed: data.gasUsed }),
      ...(data.blockNumber !== undefined && { blockNumber: data.blockNumber }),
      ...(data.error && { error: data.error }),
    })

    await walletState.moveToHistory(txId)
  }

  private getEntryPoint(chainId: number): Address {
    return (
      isChainSupported(chainId) ? getEntryPoint(chainId) : ENTRY_POINT_ADDRESS
    ) as Address
  }
}

export const transactionWatcher = new TransactionWatcher()
