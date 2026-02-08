import type { Address, Hex, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcError } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import { AggregatorValidator } from '../../src/validation/aggregatorValidator'
import type { PackedUserOperation, StakeInfo } from '../../src/validation/types'

describe('AggregatorValidator', () => {
  const logger = createLogger('error', false)
  let validator: AggregatorValidator
  let mockPublicClient: PublicClient

  const entryPoint = '0x0000000071727de22e5e9d8baf0edac6f37da032' as Address
  const aggregatorAddress = '0x1111111111111111111111111111111111111111' as Address
  const aggregatorAddress2 = '0x2222222222222222222222222222222222222222' as Address

  const createMockUserOp = (
    sender: Address = '0x3333333333333333333333333333333333333333' as Address,
    nonce = 0n
  ): PackedUserOperation => ({
    sender,
    nonce,
    initCode: '0x' as Hex,
    callData: '0xdeadbeef' as Hex,
    accountGasLimits: '0x00000000000000000000000000030d40000000000000000000000000000493e0' as Hex,
    preVerificationGas: 21000n,
    gasFees: '0x000000000000000000000000000000010000000000000000000000000000000a' as Hex,
    paymasterAndData: '0x' as Hex,
    signature: ('0x' + 'ab'.repeat(65)) as Hex,
  })

  beforeEach(() => {
    mockPublicClient = {
      readContract: vi.fn(),
      simulateContract: vi.fn(),
      getCode: vi.fn(),
    } as unknown as PublicClient

    validator = new AggregatorValidator(mockPublicClient, entryPoint, logger)
  })

  describe('validateUserOpSignature', () => {
    it('should call aggregator.validateUserOpSignature and return sigForUserOp', async () => {
      const userOp = createMockUserOp()
      const expectedSigForUserOp = ('0x' + 'cd'.repeat(32)) as Hex

      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(expectedSigForUserOp)

      const result = await validator.validateUserOpSignature(aggregatorAddress, userOp)

      expect(result).toBe(expectedSigForUserOp)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: aggregatorAddress,
        abi: expect.any(Array),
        functionName: 'validateUserOpSignature',
        args: [expect.any(Object)],
      })
    })

    it('should throw RpcError on aggregator validation failure', async () => {
      const userOp = createMockUserOp()

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Aggregator rejected signature')
      )

      await expect(validator.validateUserOpSignature(aggregatorAddress, userOp)).rejects.toThrow(
        RpcError
      )
    })

    it('should throw RpcError with correct code for invalid aggregator', async () => {
      const userOp = createMockUserOp()

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Invalid aggregator')
      )

      await expect(
        validator.validateUserOpSignature(aggregatorAddress, userOp)
      ).rejects.toMatchObject({
        code: -32506, // UNSUPPORTED_AGGREGATOR
      })
    })
  })

  describe('aggregateSignatures', () => {
    it('should call aggregator.aggregateSignatures and return aggregated signature', async () => {
      const userOps = [createMockUserOp(), createMockUserOp()]
      const expectedAggregatedSig = ('0x' + 'ef'.repeat(96)) as Hex

      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(expectedAggregatedSig)

      const result = await validator.aggregateSignatures(aggregatorAddress, userOps)

      expect(result).toBe(expectedAggregatedSig)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: aggregatorAddress,
        abi: expect.any(Array),
        functionName: 'aggregateSignatures',
        args: [expect.any(Array)],
      })
    })

    it('should handle empty userOps array', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce('0x' as Hex)

      const result = await validator.aggregateSignatures(aggregatorAddress, [])

      expect(result).toBe('0x')
    })

    it('should throw RpcError on aggregation failure', async () => {
      const userOps = [createMockUserOp()]

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Failed to aggregate')
      )

      await expect(validator.aggregateSignatures(aggregatorAddress, userOps)).rejects.toThrow(
        RpcError
      )
    })
  })

  describe('validateSignatures', () => {
    it('should call aggregator.validateSignatures successfully', async () => {
      const userOps = [createMockUserOp(), createMockUserOp()]
      const aggregatedSig = ('0x' + 'ef'.repeat(96)) as Hex

      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(undefined)

      await expect(
        validator.validateSignatures(aggregatorAddress, userOps, aggregatedSig)
      ).resolves.not.toThrow()

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: aggregatorAddress,
        abi: expect.any(Array),
        functionName: 'validateSignatures',
        args: [expect.any(Array), aggregatedSig],
      })
    })

    it('should throw RpcError when aggregated signature validation fails', async () => {
      const userOps = [createMockUserOp()]
      const invalidSig = ('0x' + '00'.repeat(32)) as Hex

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Invalid aggregated signature')
      )

      await expect(
        validator.validateSignatures(aggregatorAddress, userOps, invalidSig)
      ).rejects.toThrow(RpcError)
    })

    it('should throw with INVALID_SIGNATURE code on validation failure', async () => {
      const userOps = [createMockUserOp()]
      const invalidSig = ('0x' + '00'.repeat(32)) as Hex

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Signature mismatch')
      )

      await expect(
        validator.validateSignatures(aggregatorAddress, userOps, invalidSig)
      ).rejects.toMatchObject({
        code: -32507, // INVALID_SIGNATURE
      })
    })
  })

  describe('getAggregatorStakeInfo', () => {
    it('should return aggregator stake info from EntryPoint', async () => {
      const expectedStakeInfo: StakeInfo = {
        stake: 100000000000000000n, // 0.1 ETH
        unstakeDelaySec: 86400n, // 1 day
      }

      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce({
        deposit: 200000000000000000n,
        staked: true,
        stake: 100000000000000000n,
        unstakeDelaySec: 86400,
        withdrawTime: 0,
      })

      const result = await validator.getAggregatorStakeInfo(aggregatorAddress)

      expect(result).toEqual(expectedStakeInfo)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: entryPoint,
        abi: expect.any(Array),
        functionName: 'getDepositInfo',
        args: [aggregatorAddress],
      })
    })

    it('should return zero stake for unstaked aggregator', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce({
        deposit: 0n,
        staked: false,
        stake: 0n,
        unstakeDelaySec: 0,
        withdrawTime: 0,
      })

      const result = await validator.getAggregatorStakeInfo(aggregatorAddress)

      expect(result.stake).toBe(0n)
      expect(result.unstakeDelaySec).toBe(0n)
    })
  })

  describe('isValidAggregator', () => {
    it('should return true for valid aggregator with code', async () => {
      vi.mocked(mockPublicClient.getCode).mockResolvedValueOnce('0xdeadbeef' as Hex)

      const result = await validator.isValidAggregator(aggregatorAddress)

      expect(result).toBe(true)
    })

    it('should return false for address without code (EOA)', async () => {
      vi.mocked(mockPublicClient.getCode).mockResolvedValueOnce(undefined)

      const result = await validator.isValidAggregator(aggregatorAddress)

      expect(result).toBe(false)
    })

    it('should return false for zero address', async () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000' as Address

      const result = await validator.isValidAggregator(zeroAddress)

      expect(result).toBe(false)
      expect(mockPublicClient.getCode).not.toHaveBeenCalled()
    })

    it('should return false for SIG_VALIDATION_FAILED address', async () => {
      const sigFailedAddress = '0x0000000000000000000000000000000000000001' as Address

      const result = await validator.isValidAggregator(sigFailedAddress)

      expect(result).toBe(false)
    })
  })

  describe('groupByAggregator', () => {
    it('should group userOps by their aggregator address', () => {
      const userOps = [
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
        { userOp: createMockUserOp(), aggregator: aggregatorAddress2 },
      ]

      const result = validator.groupByAggregator(userOps)

      expect(result.size).toBe(2)
      expect(result.get(aggregatorAddress)?.length).toBe(2)
      expect(result.get(aggregatorAddress2)?.length).toBe(1)
    })

    it('should handle userOps without aggregator (null aggregator)', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000' as Address
      const userOps = [
        { userOp: createMockUserOp(), aggregator: zeroAddress },
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
      ]

      const result = validator.groupByAggregator(userOps)

      // Zero address ops should be grouped separately or handled as non-aggregated
      expect(result.get(zeroAddress)?.length).toBe(1)
      expect(result.get(aggregatorAddress)?.length).toBe(1)
    })

    it('should return empty map for empty input', () => {
      const result = validator.groupByAggregator([])

      expect(result.size).toBe(0)
    })
  })

  describe('prepareAggregatedOps', () => {
    it('should prepare UserOpsPerAggregator array for handleAggregatedOps', async () => {
      const userOps = [
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
      ]

      const aggregatedSig = ('0x' + 'ef'.repeat(96)) as Hex
      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(aggregatedSig)

      const result = await validator.prepareAggregatedOps(userOps)

      expect(result.length).toBe(1)
      expect(result[0].aggregator).toBe(aggregatorAddress)
      expect(result[0].userOps.length).toBe(2)
      expect(result[0].signature).toBe(aggregatedSig)
    })

    it('should handle multiple aggregators', async () => {
      const userOps = [
        { userOp: createMockUserOp(), aggregator: aggregatorAddress },
        { userOp: createMockUserOp(), aggregator: aggregatorAddress2 },
      ]

      const aggregatedSig1 = ('0x' + 'aa'.repeat(96)) as Hex
      const aggregatedSig2 = ('0x' + 'bb'.repeat(96)) as Hex

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(aggregatedSig1)
        .mockResolvedValueOnce(aggregatedSig2)

      const result = await validator.prepareAggregatedOps(userOps)

      expect(result.length).toBe(2)
      expect(result.map((r) => r.aggregator)).toContain(aggregatorAddress)
      expect(result.map((r) => r.aggregator)).toContain(aggregatorAddress2)
    })

    it('should throw if aggregation fails for any group', async () => {
      const userOps = [{ userOp: createMockUserOp(), aggregator: aggregatorAddress }]

      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Aggregation failed')
      )

      await expect(validator.prepareAggregatedOps(userOps)).rejects.toThrow()
    })
  })
})
