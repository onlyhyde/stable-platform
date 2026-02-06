import { ModuleRegistryServer } from './server/index'
import { createLogger } from './utils/logger'

const PORT = Number.parseInt(process.env.PORT ?? '4340', 10)
const HOST = process.env.HOST ?? '0.0.0.0'
const SEED_DATA = process.env.SEED_DATA !== 'false'
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info'

const logger = createLogger(LOG_LEVEL)

const server = new ModuleRegistryServer(
  { port: PORT, host: HOST, seedData: SEED_DATA },
  logger
)

async function main() {
  try {
    await server.start()
  } catch (err) {
    logger.error(err, 'Failed to start Module Registry')
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down...')
  await server.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down...')
  await server.stop()
  process.exit(0)
})

main()
