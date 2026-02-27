import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type CliOptions, parseConfig } from '../../src/cli/config'
import { getReputationPersistenceConfig } from '../../src/config/constants'

// Minimal valid options for parseConfig
const VALID_BASE_OPTIONS: CliOptions = {
  network: 'local',
  beneficiary: '0x1234567890123456789012345678901234567890',
  privateKey: '0x' + 'ab'.repeat(32),
  rpcUrl: 'http://localhost:8545',
  entryPoint: ['0x0000000071727De22E5E9d8BAf0edAc6f37da032'],
}

describe('enableOpcodeValidation config', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clean up env vars before each test
    delete process.env.BUNDLER_ENABLE_OPCODE_VALIDATION
    delete process.env.ENABLE_OPCODE_VALIDATION
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should default to true when not specified', () => {
    const config = parseConfig({ ...VALID_BASE_OPTIONS })
    expect(config.enableOpcodeValidation).toBe(true)
  })

  it('should read from BUNDLER_ENABLE_OPCODE_VALIDATION env var', () => {
    process.env.BUNDLER_ENABLE_OPCODE_VALIDATION = 'false'
    const config = parseConfig({ ...VALID_BASE_OPTIONS })
    expect(config.enableOpcodeValidation).toBe(false)
  })

  it('should read from ENABLE_OPCODE_VALIDATION env var as fallback', () => {
    process.env.ENABLE_OPCODE_VALIDATION = 'false'
    const config = parseConfig({ ...VALID_BASE_OPTIONS })
    expect(config.enableOpcodeValidation).toBe(false)
  })

  it('should prefer CLI option over env var', () => {
    process.env.BUNDLER_ENABLE_OPCODE_VALIDATION = 'true'
    const config = parseConfig({
      ...VALID_BASE_OPTIONS,
      enableOpcodeValidation: false,
    })
    expect(config.enableOpcodeValidation).toBe(false)
  })
})

describe('reputation persistence config (Section 7.5)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.BUNDLER_REP_PERSISTENCE_ENABLED
    delete process.env.BUNDLER_REP_PERSISTENCE_PATH
    delete process.env.BUNDLER_REP_PERSISTENCE_INTERVAL_MS
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should default to enabled=true', () => {
    const config = getReputationPersistenceConfig()
    expect(config.enabled).toBe(true)
  })

  it('should have default file path', () => {
    const config = getReputationPersistenceConfig()
    expect(config.filePath).toBe('./data/reputation.json')
  })

  it('should have default save interval of 60s', () => {
    const config = getReputationPersistenceConfig()
    expect(config.saveIntervalMs).toBe(60_000)
  })

  it('should respect BUNDLER_REP_PERSISTENCE_ENABLED env var', () => {
    process.env.BUNDLER_REP_PERSISTENCE_ENABLED = 'false'
    const config = getReputationPersistenceConfig()
    expect(config.enabled).toBe(false)
  })

  it('should respect BUNDLER_REP_PERSISTENCE_PATH env var', () => {
    process.env.BUNDLER_REP_PERSISTENCE_PATH = '/tmp/rep.json'
    const config = getReputationPersistenceConfig()
    expect(config.filePath).toBe('/tmp/rep.json')
  })

  it('should respect BUNDLER_REP_PERSISTENCE_INTERVAL_MS env var', () => {
    process.env.BUNDLER_REP_PERSISTENCE_INTERVAL_MS = '30000'
    const config = getReputationPersistenceConfig()
    expect(config.saveIntervalMs).toBe(30000)
  })
})
