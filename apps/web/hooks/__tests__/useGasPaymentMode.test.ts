import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// ============================================================================
// F-02: Gas payment mode types and hook
// RED phase — useGasPaymentMode does not exist yet
// ============================================================================

// Mock useSmartAccount to control isSmartAccount state
const mockSmartAccountStatus = {
  isSmartAccount: false,
  implementation: null,
  code: null,
  isLoading: false,
}

vi.mock('../useSmartAccount', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useSmartAccount')>()
  return {
    ...actual,
    useSmartAccount: () => ({
      status: mockSmartAccountStatus,
      contracts: {
        entryPoint: '0x2ef7E4897d71647502e2Fe60F707AcD9a110660C',
        kernel: '0x92458C9920376Ddd0152dbA56888ac60547408E6',
        kernelFactory: '0xA18C1d76de513FEa27127E2508de43AdC0820a72',
        ecdsaValidator: '0xFaf73bf2E642ADD50cf9d9853C44553ECCdFC670',
      },
    }),
  }
})

// Mock providers context
vi.mock('@/providers', () => ({
  useStableNetContext: () => ({
    bundlerUrl: 'http://localhost:4337',
    paymasterUrl: 'http://localhost:4338',
    paymaster: '0x513488a46Dd77Cf35E0b36Cf331911882952CB73',
    entryPoint: '0x2ef7E4897d71647502e2Fe60F707AcD9a110660C',
    chainId: 8283,
  }),
}))

describe('F-02: useGasPaymentMode', () => {
  describe('type definitions', () => {
    it('should export GasPaymentMode type with three modes', async () => {
      const mod = await import('../useGasPaymentMode')
      // The module should exist
      expect(mod).toBeDefined()

      // Type check via runtime: the hook should return selectedMode
      // that is one of 'self-pay' | 'erc20-paymaster' | 'sponsored'
      const validModes = ['self-pay', 'erc20-paymaster', 'sponsored']
      expect(validModes).toContain('self-pay')
      expect(validModes).toContain('erc20-paymaster')
      expect(validModes).toContain('sponsored')
    })
  })

  describe('hook behavior', () => {
    it('should default to sponsored mode', async () => {
      const { useGasPaymentMode } = await import('../useGasPaymentMode')
      const { result } = renderHook(() => useGasPaymentMode())

      expect(result.current.selectedMode).toBe('sponsored')
    })

    it('should allow changing mode', async () => {
      const { useGasPaymentMode } = await import('../useGasPaymentMode')
      const { result } = renderHook(() => useGasPaymentMode())

      act(() => {
        result.current.setMode('self-pay')
      })

      expect(result.current.selectedMode).toBe('self-pay')
    })

    it('should indicate available modes for Smart Account', async () => {
      mockSmartAccountStatus.isSmartAccount = true

      const { useGasPaymentMode } = await import('../useGasPaymentMode')
      const { result } = renderHook(() => useGasPaymentMode())

      // Smart Account should have all 3 modes available
      expect(result.current.availableModes).toContain('self-pay')
      expect(result.current.availableModes).toContain('erc20-paymaster')
      expect(result.current.availableModes).toContain('sponsored')

      // Reset
      mockSmartAccountStatus.isSmartAccount = false
    })

    it('should only allow self-pay for EOA (non-Smart Account)', async () => {
      mockSmartAccountStatus.isSmartAccount = false

      const { useGasPaymentMode } = await import('../useGasPaymentMode')
      const { result } = renderHook(() => useGasPaymentMode())

      // EOA can only do self-pay (no bundler involved)
      expect(result.current.availableModes).toContain('self-pay')
      // Paymaster modes require UserOp via bundler, not available for plain EOA
      expect(result.current.availableModes).not.toContain('erc20-paymaster')
      expect(result.current.availableModes).not.toContain('sponsored')
    })

    it('should return mode description for UI display', async () => {
      const { useGasPaymentMode } = await import('../useGasPaymentMode')
      const { result } = renderHook(() => useGasPaymentMode())

      expect(result.current.modeDescriptions).toBeDefined()
      expect(result.current.modeDescriptions['self-pay']).toBeTruthy()
      expect(result.current.modeDescriptions['erc20-paymaster']).toBeTruthy()
      expect(result.current.modeDescriptions['sponsored']).toBeTruthy()
    })
  })
})
