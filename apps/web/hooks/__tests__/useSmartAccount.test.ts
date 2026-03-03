import { describe, expect, it, vi } from 'vitest'

// ============================================================================
// F-01: Dynamic contract address resolution
// RED phase — tests for getSmartAccountAddresses (not yet exported)
// ============================================================================

// We don't mock @stablenet/contracts here — we want to test that the real
// chain-aware getters are used by the function under test.

// The function getSmartAccountAddresses does not exist yet → import will fail → RED
describe('F-01: Dynamic contract address resolution', () => {
  describe('getSmartAccountAddresses', () => {
    it('should return StableNet Local addresses for chain 8283', async () => {
      // Dynamic import to catch missing export
      const mod = await import('../useSmartAccount')
      const fn = (mod as Record<string, unknown>).getSmartAccountAddresses as
        | ((chainId: number) => {
            entryPoint: string
            kernel: string
            kernelFactory: string
            ecdsaValidator: string
          })
        | undefined

      expect(fn).toBeDefined()
      if (!fn) return

      const addresses = fn(8283)

      expect(addresses.entryPoint).toBe('0x2ef7E4897d71647502e2Fe60F707AcD9a110660C')
      expect(addresses.kernel).toBe('0x92458C9920376Ddd0152dbA56888ac60547408E6')
      expect(addresses.kernelFactory).toBe('0xA18C1d76de513FEa27127E2508de43AdC0820a72')
      expect(addresses.ecdsaValidator).toBe('0xFaf73bf2E642ADD50cf9d9853C44553ECCdFC670')
    })

    it('should NOT return hardcoded Anvil addresses for chain 8283', async () => {
      const mod = await import('../useSmartAccount')
      const fn = (mod as Record<string, unknown>).getSmartAccountAddresses as
        | ((chainId: number) => {
            entryPoint: string
            kernel: string
            kernelFactory: string
            ecdsaValidator: string
          })
        | undefined

      expect(fn).toBeDefined()
      if (!fn) return

      const addresses = fn(8283)

      // These are the OLD hardcoded Anvil addresses — must NOT be returned for 8283
      expect(addresses.entryPoint).not.toBe('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0')
      expect(addresses.kernel).not.toBe('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9')
      expect(addresses.ecdsaValidator).not.toBe('0x5FC8d32690cc91D4c39d9d3abcBD16989F875707')
      expect(addresses.kernelFactory).not.toBe('0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9')
    })

    it('should return fallback addresses for unsupported chain', async () => {
      const mod = await import('../useSmartAccount')
      const fn = (mod as Record<string, unknown>).getSmartAccountAddresses as
        | ((chainId: number) => {
            entryPoint: string
            kernel: string
            kernelFactory: string
            ecdsaValidator: string
          })
        | undefined

      expect(fn).toBeDefined()
      if (!fn) return

      // Should not throw for unsupported chain — returns fallbacks
      const addresses = fn(99999)
      expect(addresses.entryPoint).toBeDefined()
      expect(addresses.kernel).toBeDefined()
    })
  })
})
