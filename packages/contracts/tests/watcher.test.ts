import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ContractAddressWatcher, createAddressWatcher } from '../src/watcher'

const VALID_ADDRESS = '0xEf6817fe73741A8F10088f9511c64b666a338A14'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `contracts-test-${Date.now()}`)
  await mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

function makeAddressFile(chainId: number, addresses: Record<string, string> = {}) {
  return JSON.stringify({
    chainId,
    entryPoint: VALID_ADDRESS,
    kernel: VALID_ADDRESS,
    ...addresses,
  })
}

describe('ContractAddressWatcher', () => {
  it('loads addresses from valid file', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, makeAddressFile(8283))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()

    const addresses = watcher.getAddresses(8283)
    expect(addresses).toBeDefined()
    expect(addresses?.chainId).toBe(8283)
    expect(addresses?.core.entryPoint).toBe(VALID_ADDRESS)

    await watcher.stop()
  })

  it('handles missing file gracefully', async () => {
    const filePath = join(testDir, 'nonexistent.json')
    const watcher = new ContractAddressWatcher({ watchPath: filePath })

    // Should not throw for ENOENT
    await watcher.start()
    expect(watcher.getAddresses(8283)).toBeUndefined()

    await watcher.stop()
  })

  it('validates address format - invalid addresses become zero', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(
      filePath,
      JSON.stringify({
        chainId: 8283,
        entryPoint: 'not-an-address',
        kernel: VALID_ADDRESS,
      })
    )

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()

    const addresses = watcher.getAddresses(8283)
    expect(addresses?.core.entryPoint).toBe(ZERO_ADDRESS)
    expect(addresses?.core.kernel).toBe(VALID_ADDRESS)

    await watcher.stop()
  })

  it('validates chainId - rejects non-numeric', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, JSON.stringify({ chainId: 'abc', entryPoint: VALID_ADDRESS }))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await expect(watcher.start()).rejects.toThrow('Invalid chainId')

    await watcher.stop()
  })

  it('validates chainId - rejects negative', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, JSON.stringify({ chainId: -1, entryPoint: VALID_ADDRESS }))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await expect(watcher.start()).rejects.toThrow('Invalid chainId')

    await watcher.stop()
  })

  it('rejects invalid JSON with proper error', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, 'not json')

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await expect(watcher.start()).rejects.toThrow()

    await watcher.stop()
  })

  it('filters invalid addresses from raw map', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(
      filePath,
      JSON.stringify({
        chainId: 8283,
        validKey: VALID_ADDRESS,
        invalidKey: 'not-hex',
        tooShort: '0x1234',
      })
    )

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()

    const addresses = watcher.getAddresses(8283)
    expect(addresses?.raw['validKey']).toBe(VALID_ADDRESS)
    expect(addresses?.raw['invalidKey']).toBeUndefined()
    expect(addresses?.raw['tooShort']).toBeUndefined()

    await watcher.stop()
  })

  it('getAllAddresses returns defensive copy', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, makeAddressFile(8283))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()

    const map1 = watcher.getAllAddresses()
    const map2 = watcher.getAllAddresses()
    expect(map1).not.toBe(map2)
    expect(map1.size).toBe(map2.size)

    await watcher.stop()
  })

  it('handles multi-chain format', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(
      filePath,
      JSON.stringify({
        8283: { entryPoint: VALID_ADDRESS },
        31337: { entryPoint: VALID_ADDRESS },
      })
    )

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()

    expect(watcher.getAddresses(8283)).toBeDefined()
    expect(watcher.getAddresses(31337)).toBeDefined()

    await watcher.stop()
  })

  it('start is idempotent', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, makeAddressFile(8283))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()
    await watcher.start() // should not throw

    await watcher.stop()
  })

  it('stop is idempotent', async () => {
    const filePath = join(testDir, 'addresses.json')
    await writeFile(filePath, makeAddressFile(8283))

    const watcher = new ContractAddressWatcher({ watchPath: filePath })
    await watcher.start()
    await watcher.stop()
    await watcher.stop() // should not throw
  })
})

describe('createAddressWatcher', () => {
  it('validates CHAIN_ID is numeric', () => {
    const original = process.env.CHAIN_ID
    process.env.CHAIN_ID = '../../../etc/passwd'

    expect(() => createAddressWatcher()).toThrow('Invalid CHAIN_ID: must be numeric')

    if (original !== undefined) {
      process.env.CHAIN_ID = original
    } else {
      delete process.env.CHAIN_ID
    }
  })

  it('accepts valid numeric CHAIN_ID', () => {
    const original = process.env.CHAIN_ID
    process.env.CHAIN_ID = '8283'

    expect(() => createAddressWatcher()).not.toThrow()

    if (original !== undefined) {
      process.env.CHAIN_ID = original
    } else {
      delete process.env.CHAIN_ID
    }
  })

  it('accepts custom watchPath', () => {
    const watcher = createAddressWatcher({ watchPath: '/tmp/test.json' })
    expect(watcher).toBeDefined()
  })
})
