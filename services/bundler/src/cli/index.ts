#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { parseConfig } from './config'
import { RpcServer } from '../rpc/server'
import { createLogger } from '../utils/logger'

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
            description: 'Network name (devnet, sepolia, mainnet)',
            default: 'devnet',
          })
          .option('port', {
            alias: 'p',
            type: 'number',
            description: 'RPC server port',
            default: 4337,
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
            demandOption: true,
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
            demandOption: true,
          })
          .option('min-balance', {
            type: 'string',
            description: 'Minimum balance for executor wallet (in wei)',
          })
          .option('bundle-interval', {
            type: 'number',
            description: 'Bundle interval in milliseconds',
            default: 1000,
          })
          .option('max-bundle-size', {
            type: 'number',
            description: 'Maximum operations per bundle',
            default: 10,
          })
          .option('log-level', {
            alias: 'l',
            type: 'string',
            description: 'Log level (debug, info, warn, error)',
            default: 'info',
          })
          .option('debug', {
            alias: 'd',
            type: 'boolean',
            description: 'Enable debug mode',
            default: false,
          })
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
}) {
  // Parse configuration
  const config = parseConfig({
    network: argv.network,
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
  })

  // Create logger
  const logger = createLogger(config.logLevel, true)

  logger.info({ network: config.network, port: config.port }, 'Starting bundler')

  // Create viem clients
  const account = privateKeyToAccount(config.privateKey)

  const publicClient = createPublicClient({
    transport: http(config.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
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
      balance: `${Number(balance) / 1e18} ETH`,
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
  console.error('Fatal error:', err)
  process.exit(1)
})
