#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { RegistryServer } from '../server/index'
import { createLogger, getGlobalLogger } from '../utils/logger'
import { FileWatcher } from '../watcher/index'
import { getEnvHelp, parseConfig } from './config'

const earlyLogger = getGlobalLogger()

process.on('unhandledRejection', (reason, promise) => {
  earlyLogger.error({ reason, promise: String(promise) }, 'Unhandled Promise Rejection')
})

process.on('uncaughtException', (error) => {
  earlyLogger.fatal({ error: error.message, stack: error.stack }, 'Uncaught Exception')
  process.exit(1)
})

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName('registry')
    .usage('$0 <command> [options]')
    .command(
      'run',
      'Start the contract registry server',
      (yargs) => {
        return yargs
          .option('port', {
            alias: 'p',
            type: 'number',
            description: 'Server port',
          })
          .option('data-dir', {
            type: 'string',
            description: 'Data directory for JSON persistence',
          })
          .option('watch-dir', {
            type: 'string',
            description: 'Foundry broadcast directory to watch',
          })
          .option('api-key', {
            type: 'string',
            description: 'API key for write operations',
          })
          .option('log-level', {
            alias: 'l',
            type: 'string',
            description: 'Log level (debug, info, warn, error)',
          })
          .epilog(getEnvHelp())
      },
      async (argv) => {
        await runServer(argv)
      }
    )
    .command(
      'import <file>',
      'Import contracts from a JSON file',
      (yargs) => {
        return yargs
          .positional('file', {
            type: 'string',
            description: 'Path to JSON file',
            demandOption: true,
          })
          .option('api-key', { type: 'string', description: 'API key' })
          .option('url', {
            type: 'string',
            description: 'Registry URL',
            default: 'http://localhost:4400',
          })
      },
      async (argv) => {
        await importContracts(argv)
      }
    )
    .command(
      'export',
      'Export contracts to JSON',
      (yargs) => {
        return yargs
          .option('chain', { type: 'number', description: 'Filter by chain ID' })
          .option('url', {
            type: 'string',
            description: 'Registry URL',
            default: 'http://localhost:4400',
          })
      },
      async (argv) => {
        await exportContracts(argv)
      }
    )
    .command(
      'list',
      'List registered contracts',
      (yargs) => {
        return yargs
          .option('chain', { type: 'number', description: 'Filter by chain ID' })
          .option('tag', { type: 'string', description: 'Filter by tag' })
          .option('url', {
            type: 'string',
            description: 'Registry URL',
            default: 'http://localhost:4400',
          })
      },
      async (argv) => {
        await listContracts(argv)
      }
    )
    .demandCommand(1, 'Please specify a command')
    .help()
    .version()
    .parse()
}

async function runServer(argv: {
  port?: number
  dataDir?: string
  watchDir?: string
  apiKey?: string
  logLevel?: string
}) {
  const config = parseConfig({
    port: argv.port,
    dataDir: argv.dataDir,
    watchDir: argv.watchDir,
    apiKey: argv.apiKey,
    logLevel: argv.logLevel,
  })

  const logger = createLogger(config.logLevel, config.pretty)
  logger.info({ port: config.port, dataDir: config.dataDir }, 'Starting contract registry')

  const server = new RegistryServer(config, logger)

  let watcher: FileWatcher | null = null
  if (config.watchDir) {
    watcher = new FileWatcher({
      watchDir: config.watchDir,
      store: server.getStore(),
      logger,
      onImport: () => {
        // Persistence is handled via store events in the server
      },
    })
  }

  const shutdown = async () => {
    logger.info('Shutting down registry...')
    if (watcher) await watcher.stop()
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await server.start()

  if (watcher) {
    await watcher.start()
    logger.info({ watchDir: config.watchDir }, 'File watcher started')
  }
}

async function importContracts(argv: { file: string; apiKey?: string; url: string }) {
  const { readFile } = await import('node:fs/promises')
  const content = await readFile(argv.file, 'utf-8')
  const data = JSON.parse(content) as unknown

  const contracts = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>).contracts ?? [data])

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (argv.apiKey) headers['X-API-Key'] = argv.apiKey

  const res = await fetch(`${argv.url}/api/v1/bulk/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contracts }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(`Import failed: ${body.message ?? res.statusText}`)
  }

  const result = (await res.json()) as { created: number; updated: number }
  process.stdout.write(`Imported: ${result.created} created, ${result.updated} updated\n`)
}

async function exportContracts(argv: { chain?: number; url: string }) {
  const params = argv.chain !== undefined ? `?chainId=${argv.chain}` : ''
  const res = await fetch(`${argv.url}/api/v1/contracts${params}`)

  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`)

  const contracts = await res.json()
  process.stdout.write(`${JSON.stringify(contracts, null, 2)}\n`)
}

async function listContracts(argv: { chain?: number; tag?: string; url: string }) {
  const params = new URLSearchParams()
  if (argv.chain !== undefined) params.set('chainId', String(argv.chain))
  if (argv.tag) params.set('tag', argv.tag)

  const query = params.toString()
  const res = await fetch(`${argv.url}/api/v1/contracts${query ? `?${query}` : ''}`)

  if (!res.ok) throw new Error(`List failed: ${res.statusText}`)

  const contracts = (await res.json()) as Array<{
    chainId: number
    name: string
    address: string
    version: string
    tags: string[]
  }>

  if (contracts.length === 0) {
    process.stdout.write('No contracts found\n')
    return
  }

  process.stdout.write(`Found ${contracts.length} contract(s):\n\n`)
  for (const c of contracts) {
    process.stdout.write(`  ${c.name} (chain: ${c.chainId})\n`)
    process.stdout.write(`    address: ${c.address}\n`)
    process.stdout.write(`    version: ${c.version}\n`)
    if (c.tags.length > 0) {
      process.stdout.write(`    tags: ${c.tags.join(', ')}\n`)
    }
    process.stdout.write('\n')
  }
}

main().catch((err) => {
  earlyLogger.fatal(
    {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    'Fatal error'
  )
  process.exit(1)
})
