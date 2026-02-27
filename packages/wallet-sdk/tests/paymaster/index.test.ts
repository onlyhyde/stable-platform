import { describe, expect, it, vi } from 'vitest'
import { createPaymasterClient, getPaymasterStubData, getPaymasterData } from '../../src/paymaster'

describe('paymaster module', () => {
  it('should re-export createPaymasterClient', () => {
    expect(typeof createPaymasterClient).toBe('function')
  })

  it('should create a paymaster client with valid config', () => {
    const client = createPaymasterClient({
      url: 'https://paymaster.example.com',
      chainId: 1,
    })
    expect(client).toBeDefined()
    expect(typeof client.getSponsorPolicy).toBe('function')
    expect(typeof client.getSponsoredPaymasterData).toBe('function')
    expect(typeof client.getSupportedTokens).toBe('function')
    expect(typeof client.estimateERC20Payment).toBe('function')
    expect(typeof client.getERC20PaymasterData).toBe('function')
    expect(typeof client.getPaymasterData).toBe('function')
    expect(typeof client.isAvailable).toBe('function')
  })

  describe('ERC-7677 getPaymasterStubData', () => {
    it('should call pm_getPaymasterStubData RPC', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          paymaster: '0x1234567890123456789012345678901234567890',
          paymasterData: '0xabcd',
          paymasterVerificationGasLimit: '0x7530',
          paymasterPostOpGasLimit: '0xc350',
          isFinal: false,
        },
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      }))

      const result = await getPaymasterStubData(
        'https://paymaster.example.com',
        {
          sender: '0x1234567890123456789012345678901234567890',
          nonce: '0x1',
          callData: '0x',
          callGasLimit: '0x0',
          verificationGasLimit: '0x0',
          preVerificationGas: '0x0',
          maxFeePerGas: '0x0',
          maxPriorityFeePerGas: '0x0',
        },
        '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        '0x1'
      )

      expect(result.paymaster).toBe('0x1234567890123456789012345678901234567890')
      expect(result.paymasterData).toBe('0xabcd')
      expect(result.paymasterVerificationGasLimit).toBe(30000n)
      expect(result.paymasterPostOpGasLimit).toBe(50000n)
      expect(result.isFinal).toBe(false)

      vi.unstubAllGlobals()
    })

    it('should throw on RPC error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'Policy rejected' },
        }),
      }))

      await expect(
        getPaymasterStubData(
          'https://paymaster.example.com',
          {
            sender: '0x1234567890123456789012345678901234567890',
            nonce: '0x1',
            callData: '0x',
            callGasLimit: '0x0',
            verificationGasLimit: '0x0',
            preVerificationGas: '0x0',
            maxFeePerGas: '0x0',
            maxPriorityFeePerGas: '0x0',
          },
          '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          '0x1'
        )
      ).rejects.toThrow('pm_getPaymasterStubData failed')

      vi.unstubAllGlobals()
    })
  })

  describe('ERC-7677 getPaymasterData', () => {
    it('should call pm_getPaymasterData RPC', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {
            paymaster: '0x1234567890123456789012345678901234567890',
            paymasterData: '0xfinaldata',
          },
        }),
      }))

      const result = await getPaymasterData(
        'https://paymaster.example.com',
        {
          sender: '0x1234567890123456789012345678901234567890',
          nonce: '0x1',
          callData: '0x',
          callGasLimit: '0x186a0',
          verificationGasLimit: '0x249f0',
          preVerificationGas: '0x5208',
          maxFeePerGas: '0x3b9aca00',
          maxPriorityFeePerGas: '0x5f5e100',
        },
        '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        '0x1'
      )

      expect(result.paymaster).toBe('0x1234567890123456789012345678901234567890')
      expect(result.paymasterData).toBe('0xfinaldata')

      vi.unstubAllGlobals()
    })
  })
})
