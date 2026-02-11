#!/usr/bin/env node

import { serve } from '@hono/node-server'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createApp } from '../app'
import { createConfig, loadConfig } from '../config'
import type { PaymasterProxyConfig } from '../types'
import { createLogger, getGlobalLogger, type LogLevel } from '../utils/logger'

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
 * CLI entry point
 */
async function main() {
  await yargs(hideBin(process.argv))
    .command(
      'run',
      'Start the paymaster proxy server',
      (yargs) => {
        return yargs
          .option('port', {
            alias: 'p',
            type: 'number',
            description: 'Server port',
            default: 3001,
          })
          .option('paymaster', {
            alias: 'm',
            type: 'string',
            description: 'Paymaster contract address',
          })
          .option('signer', {
            alias: 's',
            type: 'string',
            description: 'Signer private key',
          })
          .option('rpc', {
            alias: 'r',
            type: 'string',
            description: 'RPC URL',
          })
          .option('chain-ids', {
            alias: 'c',
            type: 'string',
            description: 'Supported chain IDs (comma-separated)',
          })
          .option('debug', {
            alias: 'd',
            type: 'boolean',
            description: 'Enable debug mode',
            default: false,
          })
          .option('log-level', {
            alias: 'l',
            type: 'string',
            description: 'Log level (debug, info, warn, error)',
            default: 'info',
          })
          .option('env', {
            alias: 'e',
            type: 'boolean',
            description:
              'Load configuration from environment variables (auto-detected when CLI args omitted)',
            default: false,
          })
      },
      async (args) => {
        // Create logger with specified level
        const logLevel = (args.debug ? 'debug' : args['log-level']) as LogLevel
        const logger = createLogger({
          level: logLevel,
          pretty: true,
          name: 'paymaster-proxy',
        })

        try {
          let config: PaymasterProxyConfig

          if (args.paymaster && args.signer && args.rpc) {
            // CLI arguments provided - use them (highest priority)
            config = createConfig({
              port: args.port,
              paymasterAddress: args.paymaster,
              signerPrivateKey: args.signer,
              rpcUrl: args.rpc,
              chainIds: args['chain-ids'],
              debug: args.debug,
            })
            logger.debug('Configuration loaded from CLI arguments')
          } else {
            // Fallback to environment variables
            try {
              config = loadConfig()
              logger.debug('Configuration loaded from environment variables')
            } catch (_envError) {
              logger.error(
                'Missing configuration. Provide CLI arguments (--paymaster, --signer, --rpc) or set environment variables (PAYMASTER_ADDRESS, SIGNER_PRIVATE_KEY, RPC_URL)'
              )
              logger.info('See .env.example for available environment variables')
              process.exit(1)
            }
          }

          // Create app
          const app = createApp(config)

          // Log startup configuration
          logger.info(
            {
              paymaster: config.paymasterAddress,
              supportedChains: config.supportedChainIds,
              debug: config.debug,
            },
            'Starting Paymaster Proxy server'
          )

          // Start server
          serve(
            {
              fetch: app.fetch,
              port: config.port,
            },
            (info) => {
              logger.info(
                {
                  url: `http://localhost:${info.port}`,
                  port: info.port,
                },
                'Paymaster Proxy server started'
              )
            }
          )

          // Handle graceful shutdown
          const shutdown = () => {
            logger.info('Shutting down Paymaster Proxy server...')
            process.exit(0)
          }

          process.on('SIGINT', shutdown)
          process.on('SIGTERM', shutdown)
        } catch (error) {
          logger.fatal(
            {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            'Failed to start server'
          )
          process.exit(1)
        }
      }
    )
    .demandCommand(1, 'Please specify a command')
    .help()
    .parse()
}

main().catch((error) => {
  earlyLogger.fatal(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    'Fatal error during initialization'
  )
  process.exit(1)
})
