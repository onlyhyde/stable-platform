/**
 * GasFeeController Tests
 * TDD tests for gas fee estimation and management
 */

import {
  GasFeeController,
  type GasFeeState,
} from '../../../src/background/controllers/GasFeeController'

describe('GasFeeController', () => {
  let controller: GasFeeController
  let mockProvider: {
    request: jest.Mock
  }

  beforeEach(() => {
    mockProvider = {
      request: jest.fn(),
    }
    controller = new GasFeeController({
      provider: mockProvider,
      chainId: 1,
    })
  })

  describe('constructor', () => {
    it('should create instance with default state', () => {
      expect(controller).toBeInstanceOf(GasFeeController)
      expect(controller.state.chainId).toBe(1)
    })

    it('should initialize with empty gas price history', () => {
      expect(controller.state.gasPriceHistory).toEqual([])
    })

    it('should set default polling interval', () => {
      expect(controller.state.pollingInterval).toBe(15000)
    })
  })

  describe('getGasPrice', () => {
    it('should fetch current gas price from provider', async () => {
      mockProvider.request.mockResolvedValueOnce('0x3b9aca00') // 1 Gwei

      const gasPrice = await controller.getGasPrice()

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'eth_gasPrice',
      })
      expect(gasPrice).toBe('0x3b9aca00')
    })

    it('should update state with fetched gas price', async () => {
      mockProvider.request.mockResolvedValueOnce('0x3b9aca00')

      await controller.getGasPrice()

      expect(controller.state.gasPrice).toBe('0x3b9aca00')
    })

    it('should handle provider errors gracefully', async () => {
      mockProvider.request.mockRejectedValueOnce(new Error('Network error'))

      await expect(controller.getGasPrice()).rejects.toThrow('Failed to fetch gas price')
    })
  })

  describe('getEIP1559GasFees', () => {
    it('should fetch EIP-1559 fee data', async () => {
      // Mock eth_feeHistory response
      mockProvider.request.mockResolvedValueOnce({
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
        gasUsedRatio: [0.5],
        reward: [['0x59682f00', '0x77359400', '0xb2d05e00']], // 1.5, 2, 3 Gwei
      })

      const fees = await controller.getEIP1559GasFees()

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'eth_feeHistory',
        params: ['0x5', 'latest', [25, 50, 75]],
      })
      expect(fees.baseFeePerGas).toBeDefined()
      expect(fees.maxPriorityFeePerGas).toBeDefined()
      expect(fees.maxFeePerGas).toBeDefined()
    })

    it('should calculate suggested fees for different speeds', async () => {
      mockProvider.request.mockResolvedValueOnce({
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'], // 1 Gwei
        gasUsedRatio: [0.5],
        reward: [['0x59682f00', '0x77359400', '0xb2d05e00']],
      })

      const fees = await controller.getEIP1559GasFees()

      expect(fees.slow).toBeDefined()
      expect(fees.average).toBeDefined()
      expect(fees.fast).toBeDefined()
    })

    it('should include estimated time for each speed', async () => {
      mockProvider.request.mockResolvedValueOnce({
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
        gasUsedRatio: [0.5],
        reward: [['0x59682f00', '0x77359400', '0xb2d05e00']],
      })

      const fees = await controller.getEIP1559GasFees()

      expect(fees.slow.estimatedTime).toBeDefined()
      expect(fees.average.estimatedTime).toBeDefined()
      expect(fees.fast.estimatedTime).toBeDefined()
    })

    it('should fall back to legacy gas price on non-EIP1559 chains', async () => {
      mockProvider.request
        .mockRejectedValueOnce(new Error('Method not supported'))
        .mockResolvedValueOnce('0x3b9aca00')

      const fees = await controller.getEIP1559GasFees()

      expect(fees.isLegacy).toBe(true)
      expect(fees.gasPrice).toBe('0x3b9aca00')
    })
  })

  describe('estimateGas', () => {
    it('should estimate gas for transaction', async () => {
      mockProvider.request.mockResolvedValueOnce('0x5208') // 21000

      const gas = await controller.estimateGas({
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
        value: '0x0',
      })

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'eth_estimateGas',
        params: [
          expect.objectContaining({
            from: '0x1234567890123456789012345678901234567890',
            to: '0xabcdef1234567890abcdef1234567890abcdef12',
          }),
        ],
      })
      expect(gas).toBe('0x5208')
    })

    it('should add buffer to estimated gas', async () => {
      mockProvider.request.mockResolvedValueOnce('0x5208') // 21000

      const gas = await controller.estimateGas(
        {
          from: '0x1234567890123456789012345678901234567890',
          to: '0xabcdef1234567890abcdef1234567890abcdef12',
        },
        { addBuffer: true, bufferPercentage: 20 }
      )

      // 21000 * 1.2 = 25200 = 0x6270
      expect(Number.parseInt(gas, 16)).toBeGreaterThan(21000)
    })

    it('should handle estimation errors', async () => {
      mockProvider.request.mockRejectedValueOnce(new Error('execution reverted'))

      await expect(
        controller.estimateGas({
          from: '0x1234567890123456789012345678901234567890',
          to: '0xabcdef1234567890abcdef1234567890abcdef12',
        })
      ).rejects.toThrow('Gas estimation failed')
    })
  })

  describe('getSuggestedGasFees', () => {
    it('should return suggested fees for transaction', async () => {
      // Mock EIP-1559 fees
      mockProvider.request.mockResolvedValueOnce({
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
        gasUsedRatio: [0.5],
        reward: [['0x59682f00', '0x77359400', '0xb2d05e00']],
      })

      const suggestions = await controller.getSuggestedGasFees()

      expect(suggestions.low).toBeDefined()
      expect(suggestions.medium).toBeDefined()
      expect(suggestions.high).toBeDefined()
    })

    it('should include total cost estimate in native currency', async () => {
      mockProvider.request.mockResolvedValueOnce({
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
        gasUsedRatio: [0.5],
        reward: [['0x59682f00', '0x77359400', '0xb2d05e00']],
      })

      const gasLimit = '0x5208' // 21000
      const suggestions = await controller.getSuggestedGasFees(gasLimit)

      expect(suggestions.low.totalCost).toBeDefined()
      expect(suggestions.medium.totalCost).toBeDefined()
      expect(suggestions.high.totalCost).toBeDefined()
    })
  })

  describe('setChainId', () => {
    it('should update chain ID', () => {
      controller.setChainId(137)

      expect(controller.state.chainId).toBe(137)
    })

    it('should clear gas price history on chain change', () => {
      controller.state.gasPriceHistory = [{ timestamp: 1, gasPrice: '0x1' }]

      controller.setChainId(137)

      expect(controller.state.gasPriceHistory).toEqual([])
    })
  })

  describe('startPolling', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
      controller.stopPolling()
    })

    it('should start polling for gas prices', async () => {
      mockProvider.request.mockResolvedValue('0x3b9aca00')

      controller.startPolling()

      expect(controller.state.isPolling).toBe(true)
    })

    it('should update gas prices at interval', async () => {
      mockProvider.request.mockResolvedValue('0x3b9aca00')

      controller.startPolling()

      // Fast forward time
      jest.advanceTimersByTime(15000)

      expect(mockProvider.request).toHaveBeenCalled()
    })

    it('should not start multiple polling loops', () => {
      mockProvider.request.mockResolvedValue('0x3b9aca00')

      controller.startPolling()
      controller.startPolling()

      expect(controller.state.isPolling).toBe(true)
    })
  })

  describe('stopPolling', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should stop polling for gas prices', () => {
      mockProvider.request.mockResolvedValue('0x3b9aca00')

      controller.startPolling()
      controller.stopPolling()

      expect(controller.state.isPolling).toBe(false)
    })
  })

  describe('getGasPriceHistory', () => {
    it('should return gas price history', () => {
      controller.state.gasPriceHistory = [
        { timestamp: 1000, gasPrice: '0x1' },
        { timestamp: 2000, gasPrice: '0x2' },
      ]

      const history = controller.getGasPriceHistory()

      expect(history).toHaveLength(2)
      expect(history[0].timestamp).toBe(1000)
    })

    it('should limit history length', () => {
      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        controller.state.gasPriceHistory.push({
          timestamp: i * 1000,
          gasPrice: `0x${i.toString(16)}`,
        })
      }

      const history = controller.getGasPriceHistory(10)

      expect(history).toHaveLength(10)
    })
  })

  describe('calculateTotalFee', () => {
    it('should calculate total fee for legacy transaction', () => {
      const total = controller.calculateTotalFee({
        gasLimit: '0x5208', // 21000
        gasPrice: '0x3b9aca00', // 1 Gwei
      })

      // 21000 * 1 Gwei = 21000 * 10^9 wei = 21,000,000,000,000 wei
      expect(total).toBe('0x1319718a5000')
    })

    it('should calculate total fee for EIP-1559 transaction', () => {
      const total = controller.calculateTotalFee({
        gasLimit: '0x5208', // 21000
        maxFeePerGas: '0x77359400', // 2 Gwei
      })

      // 21000 * 2 Gwei = 21000 * 2 * 10^9 wei = 42,000,000,000,000 wei
      expect(total).toBe('0x2632e314a000')
    })
  })

  describe('formatGasPrice', () => {
    it('should format gas price to Gwei', () => {
      const formatted = controller.formatGasPrice('0x3b9aca00') // 1 Gwei

      expect(formatted).toBe('1')
    })

    it('should handle decimal Gwei values', () => {
      const formatted = controller.formatGasPrice('0x5d21dba00') // 25 Gwei

      expect(formatted).toBe('25')
    })

    it('should format with specified decimals', () => {
      const formatted = controller.formatGasPrice('0x4190ab00', 2) // 1.1 Gwei

      expect(formatted).toContain('.')
    })
  })
})

describe('GasFeeState', () => {
  it('should have correct initial state structure', () => {
    const state: GasFeeState = {
      chainId: 1,
      gasPrice: null,
      baseFeePerGas: null,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
      gasPriceHistory: [],
      isPolling: false,
      pollingInterval: 15000,
      lastUpdated: null,
    }

    expect(state.chainId).toBe(1)
    expect(state.gasPrice).toBeNull()
    expect(state.gasPriceHistory).toEqual([])
  })
})
