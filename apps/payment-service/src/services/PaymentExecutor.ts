import type { Address, PublicClient, WalletClient, Hex } from 'viem'
import type { PaymentJob, PaymentResult, PaymentLog } from '../types/index.js'
import { RECURRING_PAYMENT_EXECUTOR_ABI } from '../config/index.js'
import type { Logger } from 'pino'

/**
 * Service for executing subscription payments on-chain
 */
export class PaymentExecutor {
  private readonly publicClient: PublicClient
  private readonly walletClient: WalletClient
  private readonly executorAddress: Address
  private readonly maxRetries: number
  private readonly retryDelay: number
  private readonly logger: Logger
  private readonly paymentLogs: PaymentLog[] = []

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    executorAddress: Address,
    maxRetries: number,
    retryDelay: number,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.executorAddress = executorAddress
    this.maxRetries = maxRetries
    this.retryDelay = retryDelay
    this.logger = logger.child({ service: 'PaymentExecutor' })
  }

  /**
   * Check if a payment can be executed
   */
  async canExecutePayment(
    subscriber: Address,
    planId: bigint
  ): Promise<{ canExecute: boolean; reason: string }> {
    try {
      const result = await this.publicClient.readContract({
        address: this.executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'canExecutePayment',
        args: [subscriber, planId],
      })

      return {
        canExecute: result[0],
        reason: result[1],
      }
    } catch (error) {
      this.logger.error({ subscriber, planId, error }, 'Failed to check payment eligibility')
      return {
        canExecute: false,
        reason: 'Failed to check eligibility',
      }
    }
  }

  /**
   * Execute a single payment
   */
  async executePayment(job: PaymentJob): Promise<PaymentResult> {
    const { subscriber, planId, plan } = job

    this.logger.info(
      { subscriber, planId, planName: plan.name, amount: plan.price.toString() },
      'Executing payment'
    )

    // Check if payment can be executed
    const { canExecute, reason } = await this.canExecutePayment(subscriber, planId)

    if (!canExecute) {
      this.logger.warn({ subscriber, planId, reason }, 'Payment cannot be executed')
      return {
        success: false,
        error: reason,
        timestamp: Date.now(),
      }
    }

    try {
      // Simulate the transaction first
      const { request } = await this.publicClient.simulateContract({
        address: this.executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'executePayment',
        args: [subscriber, planId],
        account: this.walletClient.account!,
      })

      // Execute the transaction
      const hash = await this.walletClient.writeContract(request)

      this.logger.info({ subscriber, planId, hash }, 'Payment transaction submitted')

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      const result: PaymentResult = {
        success: receipt.status === 'success',
        transactionHash: hash,
        gasUsed: receipt.gasUsed,
        timestamp: Date.now(),
      }

      // Log the payment
      this.logPayment({
        timestamp: Date.now(),
        subscriber,
        planId,
        amount: plan.price,
        token: plan.token,
        transactionHash: hash,
        status: result.success ? 'success' : 'failed',
      })

      this.logger.info(
        { subscriber, planId, hash, success: result.success, gasUsed: receipt.gasUsed?.toString() },
        'Payment completed'
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.logger.error({ subscriber, planId, error: errorMessage }, 'Payment execution failed')

      this.logPayment({
        timestamp: Date.now(),
        subscriber,
        planId,
        amount: plan.price,
        token: plan.token,
        transactionHash: '0x0' as Hex,
        status: 'failed',
        errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Execute a batch of payments
   */
  async executeBatch(jobs: PaymentJob[]): Promise<Map<string, PaymentResult>> {
    const results = new Map<string, PaymentResult>()

    if (jobs.length === 0) {
      return results
    }

    this.logger.info({ count: jobs.length }, 'Executing payment batch')

    // Group by eligibility first
    const eligibleJobs: PaymentJob[] = []
    for (const job of jobs) {
      const { canExecute, reason } = await this.canExecutePayment(job.subscriber, job.planId)
      const key = `${job.subscriber}-${job.planId}`

      if (canExecute) {
        eligibleJobs.push(job)
      } else {
        results.set(key, {
          success: false,
          error: reason,
          timestamp: Date.now(),
        })
      }
    }

    if (eligibleJobs.length === 0) {
      this.logger.info('No eligible payments in batch')
      return results
    }

    try {
      // Try batch execution
      const subscribers = eligibleJobs.map((j) => j.subscriber)
      const planIds = eligibleJobs.map((j) => j.planId)

      const { request } = await this.publicClient.simulateContract({
        address: this.executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'batchExecutePayments',
        args: [subscribers, planIds],
        account: this.walletClient.account!,
      })

      const hash = await this.walletClient.writeContract(request)
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      // Mark all as success if transaction succeeded
      for (const job of eligibleJobs) {
        const key = `${job.subscriber}-${job.planId}`
        results.set(key, {
          success: receipt.status === 'success',
          transactionHash: hash,
          gasUsed: receipt.gasUsed,
          timestamp: Date.now(),
        })

        this.logPayment({
          timestamp: Date.now(),
          subscriber: job.subscriber,
          planId: job.planId,
          amount: job.plan.price,
          token: job.plan.token,
          transactionHash: hash,
          status: receipt.status === 'success' ? 'success' : 'failed',
        })
      }

      this.logger.info(
        { count: eligibleJobs.length, hash, gasUsed: receipt.gasUsed?.toString() },
        'Batch payment completed'
      )
    } catch (error) {
      this.logger.warn({ error }, 'Batch execution failed, falling back to individual execution')

      // Fall back to individual execution
      for (const job of eligibleJobs) {
        const result = await this.executePayment(job)
        results.set(`${job.subscriber}-${job.planId}`, result)
      }
    }

    return results
  }

  /**
   * Execute payment with retry logic
   */
  async executeWithRetry(job: PaymentJob): Promise<PaymentResult> {
    let lastResult: PaymentResult | null = null
    let currentJob = { ...job }

    while (currentJob.retryCount <= this.maxRetries) {
      const result = await this.executePayment(currentJob)

      if (result.success) {
        return result
      }

      lastResult = result
      currentJob.retryCount++

      if (currentJob.retryCount <= this.maxRetries) {
        this.logger.info(
          { subscriber: job.subscriber, planId: job.planId, retryCount: currentJob.retryCount },
          'Retrying payment'
        )
        await this.delay(this.retryDelay)
      }
    }

    this.logger.error(
      { subscriber: job.subscriber, planId: job.planId, retries: this.maxRetries },
      'Payment failed after max retries'
    )

    return lastResult || { success: false, error: 'Max retries exceeded', timestamp: Date.now() }
  }

  /**
   * Get recent payment logs
   */
  getPaymentLogs(limit = 100): PaymentLog[] {
    return this.paymentLogs.slice(-limit)
  }

  /**
   * Log a payment
   */
  private logPayment(log: PaymentLog): void {
    this.paymentLogs.push(log)

    // Keep only last 1000 logs in memory
    if (this.paymentLogs.length > 1000) {
      this.paymentLogs.shift()
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
