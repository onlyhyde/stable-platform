import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type CliOptions, parseConfig } from '../../src/cli/config'

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
