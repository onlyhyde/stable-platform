import { describe, expect, it } from 'vitest'
import { mapArtifactName } from '../../src/watcher/artifact-mapper'
import { parseFoundryBroadcast } from '../../src/watcher/foundry-parser'

describe('Foundry Parser', () => {
  it('should parse valid broadcast JSON', () => {
    const content = JSON.stringify({
      chain: 31337,
      transactions: [
        {
          hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          contractName: 'EntryPoint',
          contractAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          transactionType: 'CREATE',
        },
        {
          hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
          contractName: 'Kernel',
          contractAddress: '0x1234567890123456789012345678901234567890',
          transactionType: 'CREATE2',
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          contractName: 'SomeCall',
          contractAddress: '0x0000000000000000000000000000000000000000',
          transactionType: 'CALL',
        },
      ],
    })

    const result = parseFoundryBroadcast(content)

    expect(result).not.toBeNull()
    expect(result?.chain).toBe(31337)
    expect(result?.transactions).toHaveLength(2) // CALL filtered out
    expect(result?.transactions[0]?.contractName).toBe('EntryPoint')
    expect(result?.transactions[1]?.contractName).toBe('Kernel')
  })

  it('should return null for invalid JSON', () => {
    const result = parseFoundryBroadcast('not json')
    expect(result).toBeNull()
  })

  it('should return null for missing chain', () => {
    const content = JSON.stringify({
      transactions: [],
    })
    const result = parseFoundryBroadcast(content)
    expect(result).toBeNull()
  })

  it('should return null for invalid chain', () => {
    const content = JSON.stringify({
      chain: 'not-a-number',
      transactions: [],
    })
    const result = parseFoundryBroadcast(content)
    expect(result).toBeNull()
  })
})

describe('Artifact Mapper', () => {
  it('should map known contract names', () => {
    expect(mapArtifactName('EntryPoint')).toBe('entryPoint')
    expect(mapArtifactName('Kernel')).toBe('kernel')
    expect(mapArtifactName('KernelFactory')).toBe('kernelFactory')
    expect(mapArtifactName('ECDSAValidator')).toBe('ecdsaValidator')
    expect(mapArtifactName('VerifyingPaymaster')).toBe('verifyingPaymaster')
  })

  it('should use camelCase for unknown names', () => {
    expect(mapArtifactName('MyCustomContract')).toBe('myCustomContract')
    expect(mapArtifactName('SomeOtherThing')).toBe('someOtherThing')
  })

  it('should allow custom mappings to override defaults', () => {
    const result = mapArtifactName('EntryPoint', { EntryPoint: 'customEntryPoint' })
    expect(result).toBe('customEntryPoint')
  })
})
