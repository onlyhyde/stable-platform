/**
 * TokenController Tests
 * TDD tests for ERC-20 token management
 */

import {
  type Token,
  type TokenBalance,
  TokenController,
  type TokenControllerState,
} from '../../../src/background/controllers/TokenController'

describe('TokenController', () => {
  let controller: TokenController
  let mockProvider: {
    request: jest.Mock
  }

  const mockUSDC: Token = {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
  }

  const mockDAI: Token = {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    chainId: 1,
  }

  const mockAccount = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    mockProvider = {
      request: jest.fn(),
    }
    controller = new TokenController({
      provider: mockProvider,
      chainId: 1,
    })
  })

  describe('constructor', () => {
    it('should create instance with default state', () => {
      expect(controller).toBeInstanceOf(TokenController)
      expect(controller.state.chainId).toBe(1)
    })

    it('should initialize with empty token list', () => {
      expect(controller.state.tokens).toEqual({})
    })

    it('should initialize with empty balances', () => {
      expect(controller.state.balances).toEqual({})
    })
  })

  describe('addToken', () => {
    it('should add token to tracked list', async () => {
      // Mock token metadata call
      mockProvider.request
        .mockResolvedValueOnce('0x' + Buffer.from('USD Coin').toString('hex').padStart(64, '0'))
        .mockResolvedValueOnce('0x' + Buffer.from('USDC').toString('hex').padStart(64, '0'))
        .mockResolvedValueOnce('0x06')

      await controller.addToken(mockUSDC.address)

      const tokens = controller.getTokens()
      expect(tokens).toHaveLength(1)
      expect(tokens[0].address.toLowerCase()).toBe(mockUSDC.address.toLowerCase())
    })

    it('should fetch token metadata automatically', async () => {
      mockProvider.request
        .mockResolvedValueOnce('0x' + Buffer.from('USD Coin').toString('hex').padStart(64, '0'))
        .mockResolvedValueOnce('0x' + Buffer.from('USDC').toString('hex').padStart(64, '0'))
        .mockResolvedValueOnce('0x06')

      await controller.addToken(mockUSDC.address)

      const token = controller.getToken(mockUSDC.address)
      expect(token?.name).toBeDefined()
      expect(token?.symbol).toBeDefined()
      expect(token?.decimals).toBeDefined()
    })

    it('should accept pre-filled token metadata', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      const token = controller.getToken(mockUSDC.address)
      expect(token?.name).toBe('USD Coin')
      expect(token?.symbol).toBe('USDC')
      expect(token?.decimals).toBe(6)
      expect(mockProvider.request).not.toHaveBeenCalled()
    })

    it('should not add duplicate tokens', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      const tokens = controller.getTokens()
      expect(tokens).toHaveLength(1)
    })

    it('should reject invalid token addresses', async () => {
      await expect(controller.addToken('invalid-address')).rejects.toThrow('Invalid token address')
    })
  })

  describe('removeToken', () => {
    it('should remove token from tracked list', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      controller.removeToken(mockUSDC.address)

      const tokens = controller.getTokens()
      expect(tokens).toHaveLength(0)
    })

    it('should also remove token balances', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      // Simulate balance
      controller.state.balances[mockAccount] = {
        [mockUSDC.address.toLowerCase()]: '1000000',
      }

      controller.removeToken(mockUSDC.address)

      expect(
        controller.state.balances[mockAccount]?.[mockUSDC.address.toLowerCase()]
      ).toBeUndefined()
    })

    it('should handle non-existent token gracefully', () => {
      expect(() => controller.removeToken(mockUSDC.address)).not.toThrow()
    })
  })

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })
    })

    it('should fetch token balance for account', async () => {
      // balanceOf call returns 1,000,000 (1 USDC with 6 decimals)
      mockProvider.request.mockResolvedValueOnce(
        '0x00000000000000000000000000000000000000000000000000000000000f4240'
      )

      const balance = await controller.getTokenBalance(mockUSDC.address, mockAccount)

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'eth_call',
        params: [
          expect.objectContaining({
            to: mockUSDC.address,
            data: expect.stringContaining('70a08231'), // balanceOf selector
          }),
          'latest',
        ],
      })
      expect(balance).toBe('1000000')
    })

    it('should update state with fetched balance', async () => {
      mockProvider.request.mockResolvedValueOnce(
        '0x00000000000000000000000000000000000000000000000000000000000f4240'
      )

      await controller.getTokenBalance(mockUSDC.address, mockAccount)

      expect(controller.state.balances[mockAccount]?.[mockUSDC.address.toLowerCase()]).toBe(
        '1000000'
      )
    })

    it('should handle zero balance', async () => {
      mockProvider.request.mockResolvedValueOnce(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )

      const balance = await controller.getTokenBalance(mockUSDC.address, mockAccount)

      expect(balance).toBe('0')
    })

    it('should handle provider errors', async () => {
      mockProvider.request.mockRejectedValueOnce(new Error('Network error'))

      await expect(controller.getTokenBalance(mockUSDC.address, mockAccount)).rejects.toThrow(
        'Failed to fetch token balance'
      )
    })
  })

  describe('getAllTokenBalances', () => {
    beforeEach(async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })
      await controller.addToken(mockDAI.address, {
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        decimals: 18,
      })
    })

    it('should fetch all token balances for account', async () => {
      mockProvider.request
        .mockResolvedValueOnce('0x00000000000000000000000000000000000000000000000000000000000f4240')
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000000000008ac7230489e80000')

      const balances = await controller.getAllTokenBalances(mockAccount)

      expect(balances).toHaveLength(2)
      expect(balances.find((b) => b.symbol === 'USDC')?.balance).toBeDefined()
      expect(balances.find((b) => b.symbol === 'DAI')?.balance).toBeDefined()
    })

    it('should return formatted balances', async () => {
      mockProvider.request
        .mockResolvedValueOnce('0x00000000000000000000000000000000000000000000000000000000000f4240') // 1 USDC
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000000000000de0b6b3a7640000') // 1 DAI

      const balances = await controller.getAllTokenBalances(mockAccount)

      const usdcBalance = balances.find((b) => b.symbol === 'USDC')
      expect(usdcBalance?.formattedBalance).toBe('1')
    })
  })

  describe('getTokenMetadata', () => {
    it('should fetch token name', async () => {
      // name() returns "USD Coin"
      mockProvider.request.mockResolvedValueOnce(
        '0x0000000000000000000000000000000000000000000000000000000000000020' +
          '0000000000000000000000000000000000000000000000000000000000000008' +
          '55534420436f696e000000000000000000000000000000000000000000000000'
      )

      const name = await controller.getTokenName(mockUSDC.address)

      expect(name).toBe('USD Coin')
    })

    it('should fetch token symbol', async () => {
      mockProvider.request.mockResolvedValueOnce(
        '0x0000000000000000000000000000000000000000000000000000000000000020' +
          '0000000000000000000000000000000000000000000000000000000000000004' +
          '5553444300000000000000000000000000000000000000000000000000000000'
      )

      const symbol = await controller.getTokenSymbol(mockUSDC.address)

      expect(symbol).toBe('USDC')
    })

    it('should fetch token decimals', async () => {
      mockProvider.request.mockResolvedValueOnce(
        '0x0000000000000000000000000000000000000000000000000000000000000006'
      )

      const decimals = await controller.getTokenDecimals(mockUSDC.address)

      expect(decimals).toBe(6)
    })
  })

  describe('buildTransferTransaction', () => {
    beforeEach(async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })
    })

    it('should build ERC-20 transfer transaction', () => {
      const recipient = '0xabcdef1234567890abcdef1234567890abcdef12'
      const amount = '1000000' // 1 USDC

      const tx = controller.buildTransferTransaction(mockUSDC.address, recipient, amount)

      expect(tx.to).toBe(mockUSDC.address)
      expect(tx.data).toContain('a9059cbb') // transfer selector
      expect(tx.value).toBe('0x0')
    })

    it('should encode recipient and amount correctly', () => {
      const recipient = '0xabcdef1234567890abcdef1234567890abcdef12'
      const amount = '1000000'

      const tx = controller.buildTransferTransaction(mockUSDC.address, recipient, amount)

      // Data should contain: selector (4 bytes) + recipient (32 bytes) + amount (32 bytes)
      expect(tx.data.length).toBe(2 + 8 + 64 + 64) // 0x + selector + recipient + amount
    })

    it('should handle large amounts', () => {
      const recipient = '0xabcdef1234567890abcdef1234567890abcdef12'
      const amount = '1000000000000000000' // 1 ETH worth

      const tx = controller.buildTransferTransaction(mockUSDC.address, recipient, amount)

      expect(tx.data).toBeDefined()
    })
  })

  describe('formatTokenAmount', () => {
    it('should format amount with correct decimals', () => {
      const formatted = controller.formatTokenAmount('1000000', 6)

      expect(formatted).toBe('1')
    })

    it('should handle amounts smaller than 1', () => {
      const formatted = controller.formatTokenAmount('500000', 6)

      expect(formatted).toBe('0.5')
    })

    it('should handle 18 decimal tokens', () => {
      const formatted = controller.formatTokenAmount('1000000000000000000', 18)

      expect(formatted).toBe('1')
    })

    it('should handle zero amount', () => {
      const formatted = controller.formatTokenAmount('0', 6)

      expect(formatted).toBe('0')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse amount to smallest unit', () => {
      const parsed = controller.parseTokenAmount('1', 6)

      expect(parsed).toBe('1000000')
    })

    it('should handle decimal amounts', () => {
      const parsed = controller.parseTokenAmount('1.5', 6)

      expect(parsed).toBe('1500000')
    })

    it('should handle 18 decimal tokens', () => {
      const parsed = controller.parseTokenAmount('1', 18)

      expect(parsed).toBe('1000000000000000000')
    })
  })

  describe('setChainId', () => {
    it('should update chain ID', () => {
      controller.setChainId(137)

      expect(controller.state.chainId).toBe(137)
    })

    it('should clear tokens and balances on chain change', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      controller.setChainId(137)

      expect(controller.getTokens()).toHaveLength(0)
      expect(controller.state.balances).toEqual({})
    })
  })

  describe('getTokens', () => {
    it('should return all tracked tokens', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })
      await controller.addToken(mockDAI.address, {
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        decimals: 18,
      })

      const tokens = controller.getTokens()

      expect(tokens).toHaveLength(2)
    })

    it('should return empty array when no tokens', () => {
      const tokens = controller.getTokens()

      expect(tokens).toEqual([])
    })
  })

  describe('getToken', () => {
    it('should return token by address', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      const token = controller.getToken(mockUSDC.address)

      expect(token?.symbol).toBe('USDC')
    })

    it('should return undefined for non-existent token', () => {
      const token = controller.getToken(mockUSDC.address)

      expect(token).toBeUndefined()
    })

    it('should be case-insensitive for address', async () => {
      await controller.addToken(mockUSDC.address, {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
      })

      const token = controller.getToken(mockUSDC.address.toLowerCase())

      expect(token?.symbol).toBe('USDC')
    })
  })
})

describe('TokenControllerState', () => {
  it('should have correct state structure', () => {
    const state: TokenControllerState = {
      chainId: 1,
      tokens: {},
      balances: {},
    }

    expect(state.chainId).toBe(1)
    expect(state.tokens).toEqual({})
    expect(state.balances).toEqual({})
  })
})

describe('Token', () => {
  it('should have required properties', () => {
    const token: Token = {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1,
    }

    expect(token.address).toBeDefined()
    expect(token.symbol).toBeDefined()
    expect(token.decimals).toBeDefined()
  })
})

describe('TokenBalance', () => {
  it('should have required properties', () => {
    const balance: TokenBalance = {
      token: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 1,
      },
      balance: '1000000',
      formattedBalance: '1',
      symbol: 'USDC',
    }

    expect(balance.token).toBeDefined()
    expect(balance.balance).toBeDefined()
    expect(balance.formattedBalance).toBeDefined()
  })
})
