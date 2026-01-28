import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil, mainnet, sepolia } from 'viem/chains'
import pino from 'pino'
import { loadConfig } from './config/index.js'
import { SubscriptionService, PaymentExecutor, PaymentScheduler } from './services/index.js'

// Chain mapping
const chains: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  31337: anvil,
}

async function main() {
  // Create logger
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  })

  logger.info('Starting StableNet Payment Service')

  // Load configuration
  const config = loadConfig()

  logger.info({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    subscriptionManager: config.subscriptionManagerAddress,
    permissionManager: config.permissionManagerAddress,
    executor: config.recurringPaymentExecutorAddress,
    pollInterval: config.pollInterval,
  }, 'Configuration loaded')

  // Get chain
  const chain = chains[config.chainId] || anvil

  // Create viem clients
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  // Create wallet from private key
  const account = privateKeyToAccount(config.executorPrivateKey)

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  })

  logger.info({ executorAddress: account.address }, 'Executor wallet initialized')

  // Create services
  const subscriptionService = new SubscriptionService(
    publicClient,
    config.subscriptionManagerAddress,
    config.permissionManagerAddress,
    logger
  )

  const paymentExecutor = new PaymentExecutor(
    publicClient,
    walletClient,
    config.recurringPaymentExecutorAddress,
    config.maxRetries,
    config.retryDelay,
    logger
  )

  const scheduler = new PaymentScheduler(
    subscriptionService,
    paymentExecutor,
    config.pollInterval,
    config.batchSize,
    logger
  )

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    scheduler.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start the scheduler
  scheduler.start()

  // Log stats periodically
  setInterval(() => {
    const stats = scheduler.getStats()
    logger.info(stats, 'Scheduler stats')
  }, 60000) // Every minute

  logger.info('Payment service started successfully')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
