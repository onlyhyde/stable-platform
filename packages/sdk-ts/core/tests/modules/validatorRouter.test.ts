import type { Validator } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createValidatorRouter,
  type ValidatorRouter,
} from '../../src/modules/validatorRouter'
import { VALIDATION_TYPE } from '../../src/modules/utils/nonceUtils'

// ============================================================================
// Test fixtures
// ============================================================================

function createMockValidator(address: Address, name: string): Validator {
  return {
    address,
    type: 'validator',
    getInitData: async () => `0x${name}` as Hex,
    signHash: async (hash: Hex) => `0x${name}_signed_${hash.slice(2, 10)}` as Hex,
    getSignerAddress: () => `0x${name.padStart(40, '0')}` as Address,
  }
}

const ROOT_ADDR = '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address
const WEBAUTHN_ADDR = '0x169844994bd5b64c3a264c54d6b0863bb7df0487' as Address
const MULTISIG_ADDR = '0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5' as Address

describe('ValidatorRouter', () => {
  let rootValidator: Validator
  let webAuthnValidator: Validator
  let multiSigValidator: Validator
  let router: ValidatorRouter

  beforeEach(() => {
    rootValidator = createMockValidator(ROOT_ADDR, 'ecdsa')
    webAuthnValidator = createMockValidator(WEBAUTHN_ADDR, 'webauthn')
    multiSigValidator = createMockValidator(MULTISIG_ADDR, 'multisig')

    router = createValidatorRouter({
      rootValidator,
      installedValidators: [webAuthnValidator, multiSigValidator],
    })
  })

  describe('creation', () => {
    it('should create router with root validator as default active', () => {
      expect(router.getActiveValidator()).toBe(rootValidator)
    })

    it('should register root and installed validators', () => {
      const validators = router.getValidators()
      expect(validators).toHaveLength(3)
    })

    it('should work with only root validator', () => {
      const minRouter = createValidatorRouter({ rootValidator })
      expect(minRouter.getActiveValidator()).toBe(rootValidator)
      expect(minRouter.getValidators()).toHaveLength(1)
    })
  })

  describe('setActiveValidator', () => {
    it('should switch active to a registered non-root validator', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      expect(router.getActiveValidator()).toBe(webAuthnValidator)
    })

    it('should switch back to root validator', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      router.setActiveValidator(ROOT_ADDR)
      expect(router.getActiveValidator()).toBe(rootValidator)
    })

    it('should throw for unregistered validator address', () => {
      const unknownAddr = '0x0000000000000000000000000000000000000099' as Address
      expect(() => router.setActiveValidator(unknownAddr)).toThrow(/not registered/i)
    })
  })

  describe('registerValidator', () => {
    it('should register a new validator', () => {
      const newAddr = '0x4444444444444444444444444444444444444444' as Address
      const newValidator = createMockValidator(newAddr, 'new')

      router.registerValidator(newValidator)

      expect(router.getValidators()).toHaveLength(4)
    })

    it('should allow switching to newly registered validator', () => {
      const newAddr = '0x4444444444444444444444444444444444444444' as Address
      const newValidator = createMockValidator(newAddr, 'new')

      router.registerValidator(newValidator)
      router.setActiveValidator(newAddr)

      expect(router.getActiveValidator()).toBe(newValidator)
    })
  })

  describe('unregisterValidator', () => {
    it('should remove a non-active validator', () => {
      router.unregisterValidator(MULTISIG_ADDR)
      expect(router.getValidators()).toHaveLength(2)
    })

    it('should revert to root when unregistering active validator', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      router.unregisterValidator(WEBAUTHN_ADDR)

      expect(router.getActiveValidator()).toBe(rootValidator)
      expect(router.getValidators()).toHaveLength(2)
    })

    it('should throw when trying to unregister root validator', () => {
      expect(() => router.unregisterValidator(ROOT_ADDR)).toThrow(/root/i)
    })
  })

  describe('isRoot', () => {
    it('should return true for root validator address', () => {
      expect(router.isRoot(ROOT_ADDR)).toBe(true)
    })

    it('should return false for non-root validator address', () => {
      expect(router.isRoot(WEBAUTHN_ADDR)).toBe(false)
    })
  })

  describe('getActiveNonceKey', () => {
    it('should return 0n when root is active', () => {
      expect(router.getActiveNonceKey()).toBe(0n)
    })

    it('should return encoded nonce key for non-root active validator', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      const key = router.getActiveNonceKey()

      expect(key).not.toBe(0n)
      // Should be a valid uint192
      const MAX_UINT192 = (1n << 192n) - 1n
      expect(key).toBeLessThanOrEqual(MAX_UINT192)
    })

    it('should encode the active validator address in nonce key', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      const key = router.getActiveNonceKey()

      // Verify the address is embedded by converting key to hex
      const hex = key.toString(16).padStart(48, '0')
      // bytes 2-22 (chars 4-44) should contain the validator address
      const encodedAddr = `0x${hex.slice(4, 44)}`
      expect(encodedAddr.toLowerCase()).toBe(WEBAUTHN_ADDR.toLowerCase())
    })
  })

  describe('getRootValidator', () => {
    it('should always return the root validator', () => {
      expect(router.getRootValidator()).toBe(rootValidator)
    })

    it('should return root even when non-root is active', () => {
      router.setActiveValidator(WEBAUTHN_ADDR)
      expect(router.getRootValidator()).toBe(rootValidator)
    })
  })

  describe('Validator interface delegation', () => {
    it('should delegate signHash through active validator', async () => {
      const testHash = '0xdeadbeef' as Hex

      // Root is active
      const sig1 = await router.getActiveValidator().signHash(testHash)
      expect(sig1).toContain('ecdsa')

      // Switch to webauthn
      router.setActiveValidator(WEBAUTHN_ADDR)
      const sig2 = await router.getActiveValidator().signHash(testHash)
      expect(sig2).toContain('webauthn')
    })
  })
})
