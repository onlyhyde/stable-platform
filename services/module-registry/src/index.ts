import { ModuleRegistryServer } from './server/index'
import { createLogger } from './utils/logger'

const PORT = Number.parseInt(process.env.PORT ?? '4340', 10)
const HOST = process.env.HOST ?? '0.0.0.0'
const SEED_DATA = process.env.SEED_DATA !== 'false'
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info'
const API_KEY = process.env.MODULE_REGISTRY_API_KEY

const logger = createLogger(LOG_LEVEL)

if (!API_KEY && process.env.NODE_ENV === 'production') {
  logger.warn('MODULE_REGISTRY_API_KEY not set - write endpoints will be unavailable')
}

const server = new ModuleRegistryServer(
  { port: PORT, host: HOST, seedData: SEED_DATA, apiKey: API_KEY },
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
