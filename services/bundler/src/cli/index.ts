#!/usr/bin/env node
import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { RpcServer } from '../rpc/server'
import { createLogger, getGlobalLogger } from '../utils/logger'
import { getEnvHelp, parseConfig } from './config'

// Get early logger for error handling before full initialization
const earlyLogger = getGlobalLogger()

// Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  earlyLogger.error({ reason, promise: String(promise) }, 'Unhandled Promise Rejection')
})

process.on('uncaughtException', (error) => {
  earlyLogger.fatal({ error: error.message, stack: error.stack }, 'Uncaught Exception')
  process.exit(1)
})

/**
 * StableNet Bundler CLI
 */
async function main() {
  await yargs(hideBin(process.argv))
    .scriptName('bundler')
    .usage('$0 <command> [options]')
    .command(
      'run',
      'Start the bundler service',
      (yargs) => {
        return yargs
          .option('network', {
            alias: 'n',
            type: 'string',
            description: 'Network name (local, devnet, sepolia, mainnet)',
          })
          .option('chain-id', {
            alias: 'c',
            type: 'number',
            description: 'Chain ID (overrides RPC-reported chainId)',
          })
          .option('port', {
            alias: 'p',
            type: 'number',
            description: 'RPC server port',
          })
          .option('entry-point', {
            alias: 'e',
            type: 'array',
            description: 'EntryPoint address(es)',
          })
          .option('beneficiary', {
            alias: 'b',
            type: 'string',
            description: 'Beneficiary address for bundle fees',
          })
          .option('rpc-url', {
            alias: 'r',
            type: 'string',
            description: 'RPC URL for the chain',
          })
          .option('private-key', {
            alias: 'k',
            type: 'string',
            description: 'Private key for signing bundles',
          })
          .option('min-balance', {
            type: 'string',
            description: 'Minimum balance for executor wallet (in wei)',
          })
          .option('bundle-interval', {
            type: 'number',
            description: 'Bundle interval in milliseconds',
          })
          .option('max-bundle-size', {
            type: 'number',
            description: 'Maximum operations per bundle',
          })
          .option('log-level', {
            alias: 'l',
            type: 'string',
            description: 'Log level (debug, info, warn, error)',
          })
          .option('debug', {
            alias: 'd',
            type: 'boolean',
            description: 'Enable debug mode',
          })
          .option('max-nonce-gap', {
            type: 'number',
            description: 'Maximum allowed nonce gap from on-chain nonce (default: 10)',
          })
          .option('min-valid-until-buffer', {
            type: 'number',
            description: 'Minimum seconds before validUntil for valid operation (default: 30)',
          })
          .option('validate-nonce-continuity', {
            type: 'boolean',
            description: 'Enable mempool nonce continuity validation (default: false)',
          })
          .option('mempool-max-nonce-gap', {
            type: 'number',
            description:
              'Maximum nonce gap in mempool when continuity validation enabled (default: 0)',
          })
          .option('enable-opcode-validation', {
            type: 'boolean',
            description:
              'Enable ERC-7562 opcode validation (requires debug_traceCall support, default: true)',
          })
          .epilog(getEnvHelp())
      },
      async (argv) => {
        await runBundler(argv)
      }
    )
    .help()
    .version()
    .parse()
}

/**
 * Run the bundler service
 */
async function runBundler(argv: {
  network?: string
  chainId?: number
  port?: number
  entryPoint?: (string | number)[]
  beneficiary?: string
  rpcUrl?: string
  privateKey?: string
  minBalance?: string
  bundleInterval?: number
  maxBundleSize?: number
  logLevel?: string
  debug?: boolean
  maxNonceGap?: number
  minValidUntilBuffer?: number
  validateNonceContinuity?: boolean
  mempoolMaxNonceGap?: number
  enableOpcodeValidation?: boolean
}) {
  // Parse configuration (handles env vars automatically)
  const config = parseConfig({
    network: argv.network,
    chainId: argv.chainId,
    port: argv.port,
    entryPoint: argv.entryPoint?.map(String),
    beneficiary: argv.beneficiary,
    rpcUrl: argv.rpcUrl,
    privateKey: argv.privateKey,
    minBalance: argv.minBalance,
    bundleInterval: argv.bundleInterval,
    maxBundleSize: argv.maxBundleSize,
    logLevel: argv.logLevel,
    debug: argv.debug,
    enableOpcodeValidation: argv.enableOpcodeValidation,
  })

  // Create logger
  const logger = createLogger(config.logLevel, true)

  logger.info(
    { network: config.network, chainId: config.chainId, port: config.port },
    'Starting bundler'
  )

  // Create viem clients
  const account = privateKeyToAccount(config.privateKey)

  // Define custom chain if chainId is explicitly set
  const chain = config.chainId
    ? defineChain({
        id: config.chainId,
        name: config.network,
        nativeCurrency: {
          name: config.nativeCurrencySymbol,
          symbol: config.nativeCurrencySymbol,
          decimals: 18,
        },
        rpcUrls: { default: { http: [config.rpcUrl] } },
      })
    : undefined

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  })

  // Check executor balance
  const balance = await publicClient.getBalance({ address: account.address })
  if (balance < config.minBalance) {
    logger.warn(
      {
        address: account.address,
        balance: balance.toString(),
        required: config.minBalance.toString(),
      },
      'Executor balance below minimum'
    )
  }

  logger.info(
    {
      executor: account.address,
      balance: `${Number(balance) / 1e18} ${config.nativeCurrencySymbol}`,
      entryPoints: config.entryPoints,
      beneficiary: config.beneficiary,
    },
    'Bundler configuration'
  )

  // Create and start RPC server
  const server = new RpcServer(publicClient, walletClient, config, logger)

  // Handle shutdown
  const shutdown = async () => {
    logger.info('Shutting down bundler...')
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start server
  await server.start()
}

// Run main
main().catch((err) => {
  earlyLogger.fatal(
    {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    'Fatal error during initialization'
  )
  process.exit(1)
})
