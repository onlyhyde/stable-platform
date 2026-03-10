import { describe, expect, it } from 'vitest'
import {
  ContractEntryListSchema,
  ContractEntrySchema,
  ImportResultSchema,
  ResolvedAddressSetSchema,
  ServerMessageSchema,
  validateChainId,
  validateName,
} from '../src/schemas'

const validContract = {
  id: 'c1',
  chainId: 1,
  name: 'USDC',
  address: '0x' + 'a'.repeat(40),
  version: '1.0.0',
  tags: ['stablecoin'],
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('ContractEntrySchema', () => {
  it('parses a valid contract entry', () => {
    const result = ContractEntrySchema.parse(validContract)
    expect(result.chainId).toBe(1)
    expect(result.address).toBe('0x' + 'a'.repeat(40))
  })

  it('accepts optional fields', () => {
    const result = ContractEntrySchema.parse({
      ...validContract,
      abi: '[{"type":"function"}]',
      deployedAt: 1234567,
      txHash: '0x' + 'b'.repeat(64),
    })
    expect(result.abi).toBe('[{"type":"function"}]')
    expect(result.txHash).toBe('0x' + 'b'.repeat(64))
  })

  it('rejects invalid address format', () => {
    expect(() =>
      ContractEntrySchema.parse({ ...validContract, address: 'not-an-address' })
    ).toThrow()
  })

  it('rejects address with wrong length', () => {
    expect(() => ContractEntrySchema.parse({ ...validContract, address: '0x123' })).toThrow()
  })

  it('rejects invalid txHash', () => {
    expect(() => ContractEntrySchema.parse({ ...validContract, txHash: '0xshort' })).toThrow()
  })

  it('rejects negative chainId', () => {
    expect(() => ContractEntrySchema.parse({ ...validContract, chainId: -1 })).toThrow()
  })

  it('rejects non-integer chainId', () => {
    expect(() => ContractEntrySchema.parse({ ...validContract, chainId: 1.5 })).toThrow()
  })
})

describe('ContractEntryListSchema', () => {
  it('parses an array of contracts', () => {
    const result = ContractEntryListSchema.parse([
      validContract,
      { ...validContract, id: 'c2', name: 'DAI' },
    ])
    expect(result).toHaveLength(2)
  })

  it('parses empty array', () => {
    expect(ContractEntryListSchema.parse([])).toEqual([])
  })

  it('rejects non-array', () => {
    expect(() => ContractEntryListSchema.parse('not-array')).toThrow()
  })
})

describe('ResolvedAddressSetSchema', () => {
  it('parses a valid address set', () => {
    const result = ResolvedAddressSetSchema.parse({
      id: 's1',
      name: 'core-protocol',
      chainId: 1,
      contracts: [validContract],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.contracts).toHaveLength(1)
  })

  it('accepts optional description', () => {
    const result = ResolvedAddressSetSchema.parse({
      id: 's1',
      name: 'core',
      chainId: 1,
      contracts: [],
      description: 'Core contracts',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.description).toBe('Core contracts')
  })
})

describe('ImportResultSchema', () => {
  it('parses basic result', () => {
    const result = ImportResultSchema.parse({ created: 3, updated: 1 })
    expect(result.created).toBe(3)
    expect(result.errors).toBeUndefined()
  })

  it('parses result with errors', () => {
    const result = ImportResultSchema.parse({
      created: 2,
      updated: 0,
      errors: [{ index: 1, name: 'BadContract', message: 'Invalid address' }],
    })
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].name).toBe('BadContract')
  })

  it('rejects negative counts', () => {
    expect(() => ImportResultSchema.parse({ created: -1, updated: 0 })).toThrow()
  })
})

describe('ServerMessageSchema', () => {
  it('parses contract:updated', () => {
    const msg = ServerMessageSchema.parse({
      type: 'contract:updated',
      data: validContract,
    })
    expect(msg.type).toBe('contract:updated')
  })

  it('parses contract:deleted', () => {
    const msg = ServerMessageSchema.parse({
      type: 'contract:deleted',
      chainId: 1,
      name: 'USDC',
    })
    expect(msg.type).toBe('contract:deleted')
  })

  it('parses set:updated', () => {
    const msg = ServerMessageSchema.parse({
      type: 'set:updated',
      data: {
        id: 's1',
        name: 'core',
        chainId: 1,
        contracts: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    })
    expect(msg.type).toBe('set:updated')
  })

  it('parses pong', () => {
    const msg = ServerMessageSchema.parse({ type: 'pong' })
    expect(msg.type).toBe('pong')
  })

  it('parses error', () => {
    const msg = ServerMessageSchema.parse({ type: 'error', message: 'bad request' })
    expect(msg.type).toBe('error')
  })

  it('rejects unknown type', () => {
    expect(() => ServerMessageSchema.parse({ type: 'unknown' })).toThrow()
  })
})

describe('validateChainId', () => {
  it('accepts positive integers', () => {
    expect(() => validateChainId(1)).not.toThrow()
    expect(() => validateChainId(137)).not.toThrow()
    expect(() => validateChainId(42161)).not.toThrow()
  })

  it('rejects zero', () => {
    expect(() => validateChainId(0)).toThrow('Invalid chainId')
  })

  it('rejects negative numbers', () => {
    expect(() => validateChainId(-1)).toThrow('Invalid chainId')
  })

  it('rejects NaN', () => {
    expect(() => validateChainId(NaN)).toThrow('Invalid chainId')
  })

  it('rejects Infinity', () => {
    expect(() => validateChainId(Infinity)).toThrow('Invalid chainId')
  })

  it('rejects floats', () => {
    expect(() => validateChainId(1.5)).toThrow('Invalid chainId')
  })
})

describe('validateName', () => {
  it('accepts valid names', () => {
    expect(() => validateName('USDC')).not.toThrow()
    expect(() => validateName('my-contract')).not.toThrow()
    expect(() => validateName('Contract_v2')).not.toThrow()
  })

  it('rejects empty string', () => {
    expect(() => validateName('')).toThrow('Invalid name')
  })

  it('rejects names with forward slash', () => {
    expect(() => validateName('../../admin')).toThrow('Invalid name')
  })

  it('rejects names with backslash', () => {
    expect(() => validateName('foo\\bar')).toThrow('Invalid name')
  })
})
