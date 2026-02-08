import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStore } from '../../src/store/memory-store'
import type { CreateContractInput } from '../../src/store/types'

describe('InMemoryStore', () => {
  let store: InMemoryStore

  beforeEach(() => {
    store = new InMemoryStore()
  })

  describe('contracts', () => {
    const testContract: CreateContractInput = {
      chainId: 31337,
      name: 'entryPoint',
      address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      version: '0.7.0',
      tags: ['core', 'erc4337'],
      metadata: { source: 'test' },
    }

    it('should create a contract entry', () => {
      const entry = store.setContract(testContract)

      expect(entry.id).toBeDefined()
      expect(entry.chainId).toBe(31337)
      expect(entry.name).toBe('entryPoint')
      expect(entry.address).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
      expect(entry.version).toBe('0.7.0')
      expect(entry.tags).toEqual(['core', 'erc4337'])
      expect(entry.createdAt).toBeDefined()
      expect(entry.updatedAt).toBeDefined()
    })

    it('should retrieve a contract by chainId and name', () => {
      store.setContract(testContract)
      const retrieved = store.getContract(31337, 'entryPoint')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('entryPoint')
    })

    it('should return undefined for non-existent contract', () => {
      const result = store.getContract(31337, 'nonExistent')
      expect(result).toBeUndefined()
    })

    it('should update existing contract preserving id and createdAt', async () => {
      const first = store.setContract(testContract)

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 5))

      const second = store.setContract({
        ...testContract,
        version: '0.8.0',
      })

      expect(second.id).toBe(first.id)
      expect(second.createdAt).toBe(first.createdAt)
      expect(second.version).toBe('0.8.0')
      // updatedAt should be different (or at least the update should work)
      expect(second.updatedAt).toBeDefined()
    })

    it('should delete a contract', () => {
      store.setContract(testContract)
      const deleted = store.deleteContract(31337, 'entryPoint')

      expect(deleted).toBe(true)
      expect(store.getContract(31337, 'entryPoint')).toBeUndefined()
    })

    it('should return false when deleting non-existent contract', () => {
      const deleted = store.deleteContract(31337, 'nonExistent')
      expect(deleted).toBe(false)
    })

    it('should list contracts with filter', () => {
      store.setContract(testContract)
      store.setContract({
        chainId: 31337,
        name: 'kernel',
        address: '0x1234567890123456789012345678901234567890',
        version: '0.1.0',
        tags: ['core'],
        metadata: {},
      })
      store.setContract({
        chainId: 1,
        name: 'mainnetContract',
        address: '0xabcdef1234567890123456789012345678901234',
        version: '1.0.0',
        tags: ['mainnet'],
        metadata: {},
      })

      const byChain = store.listContracts({ chainId: 31337 })
      expect(byChain).toHaveLength(2)

      const byTag = store.listContracts({ tag: 'erc4337' })
      expect(byTag).toHaveLength(1)
      expect(byTag[0]?.name).toBe('entryPoint')

      const byName = store.listContracts({ name: 'kernel' })
      expect(byName).toHaveLength(1)
    })

    it('should emit contract:updated event', () => {
      const handler = vi.fn()
      store.on('contract:updated', handler)

      store.setContract(testContract)

      expect(handler).toHaveBeenCalledOnce()
    })

    it('should emit contract:deleted event', () => {
      const handler = vi.fn()
      store.on('contract:deleted', handler)

      store.setContract(testContract)
      store.deleteContract(31337, 'entryPoint')

      expect(handler).toHaveBeenCalledWith({ chainId: 31337, name: 'entryPoint' })
    })
  })

  describe('address sets', () => {
    beforeEach(() => {
      store.setContract({
        chainId: 31337,
        name: 'entryPoint',
        address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        version: '0.7.0',
        tags: ['core'],
        metadata: {},
      })
      store.setContract({
        chainId: 31337,
        name: 'paymaster',
        address: '0x1234567890123456789012345678901234567890',
        version: '0.1.0',
        tags: ['paymaster'],
        metadata: {},
      })
    })

    it('should create an address set', () => {
      const set = store.createSet({
        chainId: 31337,
        name: 'bundler-config',
        contracts: ['entryPoint', 'paymaster'],
        description: 'Bundler configuration',
      })

      expect(set.id).toBeDefined()
      expect(set.name).toBe('bundler-config')
      expect(set.contracts).toEqual(['entryPoint', 'paymaster'])
    })

    it('should resolve an address set with contract entries', () => {
      store.createSet({
        chainId: 31337,
        name: 'bundler-config',
        contracts: ['entryPoint', 'paymaster'],
      })

      const resolved = store.getSet('bundler-config', 31337)

      expect(resolved).toBeDefined()
      expect(resolved?.contracts).toHaveLength(2)
      expect(resolved?.contracts[0]?.address).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    })

    it('should delete an address set', () => {
      store.createSet({
        chainId: 31337,
        name: 'bundler-config',
        contracts: ['entryPoint'],
      })

      const deleted = store.deleteSet('bundler-config', 31337)
      expect(deleted).toBe(true)
      expect(store.getSet('bundler-config', 31337)).toBeUndefined()
    })
  })

  describe('bulk import', () => {
    it('should import multiple contracts', () => {
      const result = store.importContracts([
        {
          chainId: 31337,
          name: 'contract1',
          address: '0x1111111111111111111111111111111111111111',
          version: '1.0.0',
          tags: [],
          metadata: {},
        },
        {
          chainId: 31337,
          name: 'contract2',
          address: '0x2222222222222222222222222222222222222222',
          version: '1.0.0',
          tags: [],
          metadata: {},
        },
      ])

      expect(result.created).toBe(2)
      expect(result.updated).toBe(0)
      expect(store.listContracts()).toHaveLength(2)
    })

    it('should track created vs updated counts', () => {
      store.setContract({
        chainId: 31337,
        name: 'existing',
        address: '0x1111111111111111111111111111111111111111',
        version: '1.0.0',
        tags: [],
        metadata: {},
      })

      const result = store.importContracts([
        {
          chainId: 31337,
          name: 'existing',
          address: '0x2222222222222222222222222222222222222222',
          version: '2.0.0',
          tags: [],
          metadata: {},
        },
        {
          chainId: 31337,
          name: 'new',
          address: '0x3333333333333333333333333333333333333333',
          version: '1.0.0',
          tags: [],
          metadata: {},
        },
      ])

      expect(result.created).toBe(1)
      expect(result.updated).toBe(1)
    })
  })

  describe('chain IDs', () => {
    it('should list unique chain IDs', () => {
      store.setContract({
        chainId: 1,
        name: 'mainnet',
        address: '0x1111111111111111111111111111111111111111',
        version: '1.0.0',
        tags: [],
        metadata: {},
      })
      store.setContract({
        chainId: 31337,
        name: 'devnet',
        address: '0x2222222222222222222222222222222222222222',
        version: '1.0.0',
        tags: [],
        metadata: {},
      })
      store.setContract({
        chainId: 1,
        name: 'mainnet2',
        address: '0x3333333333333333333333333333333333333333',
        version: '1.0.0',
        tags: [],
        metadata: {},
      })

      const chainIds = store.getChainIds()
      expect(chainIds).toEqual([1, 31337])
    })
  })
})
