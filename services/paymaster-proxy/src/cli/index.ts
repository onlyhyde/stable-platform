#!/usr/bin/env node

import { serve } from '@hono/node-server'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createApp } from '../app'
import { loadConfig, createConfig } from '../config'
import type { PaymasterProxyConfig } from '../types'

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
          .option('env', {
            alias: 'e',
            type: 'boolean',
            description: 'Load configuration from environment variables',
            default: false,
          })
      },
      async (args) => {
        try {
          let config: PaymasterProxyConfig

          if (args.env) {
            // Load from environment
            config = loadConfig()
          } else {
            // Validate required arguments
            if (!args.paymaster || !args.signer || !args.rpc) {
              console.error('Error: --paymaster, --signer, and --rpc are required')
              console.error('Or use --env to load from environment variables')
              process.exit(1)
            }

            config = createConfig({
              port: args.port,
              paymasterAddress: args.paymaster,
              signerPrivateKey: args.signer,
              rpcUrl: args.rpc,
              chainIds: args['chain-ids'],
              debug: args.debug,
            })
          }

          // Create app
          const app = createApp(config)

          // Start server
          console.info('Starting Paymaster Proxy server...')
          console.info(`  Paymaster: ${config.paymasterAddress}`)
          console.info(`  Supported chains: ${config.supportedChainIds.join(', ')}`)
          console.info(`  Debug: ${config.debug}`)

          serve({
            fetch: app.fetch,
            port: config.port,
          }, (info) => {
            console.info(`Paymaster Proxy listening on http://localhost:${info.port}`)
          })
        } catch (error) {
          console.error('Failed to start server:', error)
          process.exit(1)
        }
      }
    )
    .demandCommand(1, 'Please specify a command')
    .help()
    .parse()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
