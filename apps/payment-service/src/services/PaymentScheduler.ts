import type { PaymentJob, PaymentResult } from '../types/index.js'
import type { SubscriptionService } from './SubscriptionService.js'
import type { PaymentExecutor } from './PaymentExecutor.js'
import type { Logger } from 'pino'

/**
 * Scheduler that orchestrates payment processing
 */
export class PaymentScheduler {
  private readonly subscriptionService: SubscriptionService
  private readonly paymentExecutor: PaymentExecutor
  private readonly pollInterval: number
  private readonly batchSize: number
  private readonly logger: Logger
  private isRunning = false
  private pollTimer: NodeJS.Timeout | null = null
  private pendingJobs: Map<string, PaymentJob> = new Map()
  private processingJobs: Set<string> = new Set()

  // Stats
  private stats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    lastRunTime: 0,
    lastRunDuration: 0,
  }

  constructor(
    subscriptionService: SubscriptionService,
    paymentExecutor: PaymentExecutor,
    pollInterval: number,
    batchSize: number,
    logger: Logger
  ) {
    this.subscriptionService = subscriptionService
    this.paymentExecutor = paymentExecutor
    this.pollInterval = pollInterval
    this.batchSize = batchSize
    this.logger = logger.child({ service: 'PaymentScheduler' })
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler already running')
      return
    }

    this.isRunning = true
    this.logger.info({ pollInterval: this.pollInterval }, 'Starting payment scheduler')

    // Run immediately
    this.runProcessingCycle()

    // Schedule periodic runs
    this.pollTimer = setInterval(() => {
      this.runProcessingCycle()
    }, this.pollInterval)
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    this.logger.info('Payment scheduler stopped')
  }

  /**
   * Run a single processing cycle
   */
  private async runProcessingCycle(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    const startTime = Date.now()
    this.logger.debug('Starting processing cycle')

    try {
      // Fetch due payments
      const currentTime = Math.floor(Date.now() / 1000)
      const duePayments = await this.subscriptionService.getPaymentsDue(currentTime)

      // Add new jobs to pending queue
      for (const job of duePayments) {
        const key = `${job.subscriber}-${job.planId}`

        // Skip if already in queue or being processed
        if (this.pendingJobs.has(key) || this.processingJobs.has(key)) {
          continue
        }

        this.pendingJobs.set(key, job)
      }

      // Process pending jobs in batches
      await this.processPendingJobs()

      // Update stats
      this.stats.lastRunTime = startTime
      this.stats.lastRunDuration = Date.now() - startTime

      this.logger.debug(
        {
          duration: this.stats.lastRunDuration,
          pending: this.pendingJobs.size,
          processing: this.processingJobs.size,
        },
        'Processing cycle completed'
      )
    } catch (error) {
      this.logger.error({ error }, 'Error in processing cycle')
    }
  }

  /**
   * Process pending jobs
   */
  private async processPendingJobs(): Promise<void> {
    if (this.pendingJobs.size === 0) {
      return
    }

    // Get jobs to process (up to batch size)
    const jobsToProcess: PaymentJob[] = []
    const keys = Array.from(this.pendingJobs.keys()).slice(0, this.batchSize)

    for (const key of keys) {
      const job = this.pendingJobs.get(key)
      if (job) {
        jobsToProcess.push(job)
        this.pendingJobs.delete(key)
        this.processingJobs.add(key)
      }
    }

    if (jobsToProcess.length === 0) {
      return
    }

    this.logger.info({ count: jobsToProcess.length }, 'Processing payment batch')

    try {
      // Execute payments
      const results = await this.paymentExecutor.executeBatch(jobsToProcess)

      // Process results
      for (const job of jobsToProcess) {
        const key = `${job.subscriber}-${job.planId}`
        const result = results.get(key)

        this.processingJobs.delete(key)
        this.stats.totalProcessed++

        if (result?.success) {
          this.stats.successCount++
          this.logger.info(
            { subscriber: job.subscriber, planId: job.planId, hash: result.transactionHash },
            'Payment succeeded'
          )
        } else {
          this.stats.failureCount++

          // Re-queue for retry if not at max retries
          if (job.retryCount < 3) {
            // Max retries from config
            job.retryCount++
            this.pendingJobs.set(key, job)
            this.logger.warn(
              { subscriber: job.subscriber, planId: job.planId, retryCount: job.retryCount },
              'Payment failed, requeued for retry'
            )
          } else {
            this.logger.error(
              { subscriber: job.subscriber, planId: job.planId, error: result?.error },
              'Payment permanently failed'
            )
          }
        }
      }
    } catch (error) {
      // Mark all jobs as failed and requeue
      for (const job of jobsToProcess) {
        const key = `${job.subscriber}-${job.planId}`
        this.processingJobs.delete(key)
        this.stats.failureCount++

        if (job.retryCount < 3) {
          job.retryCount++
          this.pendingJobs.set(key, job)
        }
      }

      this.logger.error({ error }, 'Batch processing failed')
    }
  }

  /**
   * Get scheduler stats
   */
  getStats(): typeof this.stats & { pendingJobs: number; processingJobs: number } {
    return {
      ...this.stats,
      pendingJobs: this.pendingJobs.size,
      processingJobs: this.processingJobs.size,
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Force process all pending jobs immediately
   */
  async processNow(): Promise<void> {
    this.logger.info('Force processing triggered')
    await this.runProcessingCycle()
  }
}
