import type { Validator } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'

/**
 * Tests for KernelAccount's ValidatorRouter support.
 *
 * These tests verify that toKernelSmartAccount accepts both:
 *   1. A single Validator (backward compatible)
 *   2. A ValidatorRouter (multi-validator support)
 *
 * We mock the PublicClient to avoid on-chain calls.
 */

// ============================================================================
// Mock helpers
// ============================================================================

function createMockValidator(address: Address): Validator {
  return {
    address,
    type: 'validator',
    getInitData: async () => address as Hex,
    signHash: async (hash: Hex) => `0x${address.slice(2)}_${hash.slice(2, 10)}`.padEnd(132, '0') as Hex,
    getSignerAddress: () => address,
  }
}

function createMockValidatorRouter(
  rootValidator: Validator,
  activeValidator: Validator,
  nonceKey: bigint
) {
  return {
    getActiveValidator: () => activeValidator,
    getActiveNonceKey: () => nonceKey,
    // These are the extra properties that ValidatorRouter has but we only need
    // the two above for duck typing in kernelAccount
    address: rootValidator.address,
    type: 'validator' as const,
    getInitData: rootValidator.getInitData,
    signHash: activeValidator.signHash,
    getSignerAddress: rootValidator.getSignerAddress,
  }
}

function createMockPublicClient(
  deployedCode: string | undefined = '0x6001',
  factoryAddress: Address = '0x6723b44Abeec4E71eBE3232BD5B455805baDD22f' as Address
) {
  const accountAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address

  return {
    readContract: vi.fn().mockImplementation(({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName === 'getAddress') {
        return accountAddress
      }
      if (functionName === 'getNonce') {
        // Return a mock nonce based on the key
        const key = args[1] as bigint
        return key === 0n ? 42n : 100n + key
      }
      return '0x'
    }),
    getCode: vi.fn().mockResolvedValue(deployedCode),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('KernelAccount with ValidatorRouter', () => {
  const ROOT_ADDR = '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address
  const WEBAUTHN_ADDR = '0x169844994bd5b64c3a264c54d6b0863bb7df0487' as Address

  it('should accept a single Validator (backward compatible)', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const validator = createMockValidator(ROOT_ADDR)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator,
    })

    expect(account.address).toBeDefined()
    expect(account.entryPoint).toBeDefined()
  })

  it('should accept a ValidatorRouter', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const rootValidator = createMockValidator(ROOT_ADDR)
    const router = createMockValidatorRouter(rootValidator, rootValidator, 0n)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator: router,
    })

    expect(account.address).toBeDefined()
  })

  it('should use nonceKey 0n when single Validator is provided', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const validator = createMockValidator(ROOT_ADDR)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator,
    })

    const nonce = await account.getNonce()

    // Mock returns 42n for key=0n
    expect(nonce).toBe(42n)
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getNonce',
        args: expect.arrayContaining([expect.any(String), 0n]),
      })
    )
  })

  it('should use dynamic nonceKey from router', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const rootValidator = createMockValidator(ROOT_ADDR)
    const webAuthnValidator = createMockValidator(WEBAUTHN_ADDR)
    const mockNonceKey = 12345n
    const router = createMockValidatorRouter(rootValidator, webAuthnValidator, mockNonceKey)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator: router,
    })

    const nonce = await account.getNonce()

    // Mock returns 100n + key for non-zero keys
    expect(nonce).toBe(100n + mockNonceKey)
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getNonce',
        args: expect.arrayContaining([expect.any(String), mockNonceKey]),
      })
    )
  })

  it('should sign with the active validator from router', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const rootValidator = createMockValidator(ROOT_ADDR)
    const webAuthnValidator = createMockValidator(WEBAUTHN_ADDR)
    const router = createMockValidatorRouter(rootValidator, webAuthnValidator, 0n)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator: router,
    })

    const signature = await account.signUserOperation('0xdeadbeef' as Hex)

    // Should contain webauthn address, not root address
    expect(signature.toLowerCase()).toContain(WEBAUTHN_ADDR.slice(2).toLowerCase())
  })

  it('should sign with single validator when no router', async () => {
    const { toKernelSmartAccount } = await import('../src/kernel/kernelAccount')
    const validator = createMockValidator(ROOT_ADDR)
    const client = createMockPublicClient()

    const account = await toKernelSmartAccount({
      client: client as any,
      validator,
    })

    const signature = await account.signUserOperation('0xdeadbeef' as Hex)

    // Should contain root address
    expect(signature.toLowerCase()).toContain(ROOT_ADDR.slice(2).toLowerCase())
  })
})
