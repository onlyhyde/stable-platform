import { createPublicClient, http } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import { walletState } from '../state/store'

const logger = createLogger('TransactionWatcher')

const POLL_INTERVAL = 3000 // 3 seconds

/**
 * Watches pending/submitted transactions and updates their status
 * when a receipt is available on-chain.
 */
class TransactionWatcher {
  private timer: ReturnType<typeof setInterval> | null = null

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.pollPendingTransactions().catch((err) => {
        logger.error('Poll error', err)
      })
    }, POLL_INTERVAL)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async pollPendingTransactions(): Promise<void> {
    const state = walletState.getState()
    const pending = state.transactions.pendingTransactions.filter(
      (tx) => tx.status === 'submitted' || tx.status === 'pending'
    )

    if (pending.length === 0) return

    const network = walletState.getCurrentNetwork()
    if (!network) return

    const client = createPublicClient({ transport: http(network.rpcUrl) })

    for (const tx of pending) {
      if (!tx.txHash) continue

      try {
        const receipt = await client.getTransactionReceipt({ hash: tx.txHash })
        if (!receipt) continue

        const newStatus = receipt.status === 'success' ? 'confirmed' : 'failed'

        await walletState.updateTransaction(tx.id, {
          status: newStatus as 'confirmed' | 'failed',
          gasUsed: receipt.gasUsed,
          blockNumber: receipt.blockNumber,
        })

        // Move confirmed/failed txs to history
        await walletState.moveToHistory(tx.id)
      } catch {
        // Receipt not available yet — tx still in mempool
      }
    }
  }
}

export const transactionWatcher = new TransactionWatcher()
