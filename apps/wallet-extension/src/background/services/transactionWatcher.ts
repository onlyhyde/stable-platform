import { createBundlerClient } from '@stablenet/core'
import { getEntryPoint, isChainSupported } from '@stablenet/contracts'
import { ENTRY_POINT_V07_ADDRESS } from '@stablenet/core'
import { createPublicClient, http } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import { walletState } from '../state/store'

const logger = createLogger('TransactionWatcher')

const POLL_INTERVAL = 3000 // 3 seconds

/**
 * Watches pending/submitted transactions and updates their status
 * when a receipt is available on-chain.
 *
 * For UserOp transactions (type='userOp'), polls the bundler via
 * eth_getUserOperationReceipt to retrieve the actual on-chain txHash
 * once the bundle is confirmed.
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
      // UserOp transactions: poll bundler for txHash, then confirm on-chain
      if (tx.type === 'userOp' && tx.userOpHash && !tx.txHash) {
        await this.pollUserOpReceipt(tx.id, tx.userOpHash, network)
        continue
      }

      // Regular transactions: poll on-chain receipt directly
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

  /**
   * Poll the bundler for a UserOperation receipt.
   * When the bundler returns a receipt, extract the on-chain txHash
   * and update the pending transaction.
   */
  private async pollUserOpReceipt(
    txId: string,
    userOpHash: `0x${string}`,
    network: { bundlerUrl?: string; chainId: number }
  ): Promise<void> {
    if (!network.bundlerUrl) return

    try {
      const entryPoint = isChainSupported(network.chainId)
        ? getEntryPoint(network.chainId)
        : ENTRY_POINT_V07_ADDRESS

      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint,
      })

      const receipt = await bundlerClient.getUserOperationReceipt(userOpHash)
      if (!receipt) return // Not yet included in a bundle

      // Extract the on-chain txHash from the receipt
      const txHash = receipt.receipt.transactionHash
      const newStatus = receipt.success ? 'confirmed' : 'failed'

      await walletState.updateTransaction(txId, {
        txHash,
        status: newStatus as 'confirmed' | 'failed',
        gasUsed: receipt.actualGasUsed,
        blockNumber: receipt.receipt.blockNumber,
      })

      await walletState.moveToHistory(txId)

      logger.info(`UserOp ${userOpHash.slice(0, 10)}... confirmed, txHash: ${txHash.slice(0, 10)}...`)
    } catch {
      // Receipt not available yet — UserOp still pending in bundler mempool
    }
  }
}

export const transactionWatcher = new TransactionWatcher()
