import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGetPaymasterStubData } from '../src/handlers/getPaymasterStubData'
import { handleGetPaymasterData } from '../src/handlers/getPaymasterData'
import { SponsorPolicyManager } from '../src/policy/sponsorPolicy'
import { ReservationTracker } from '../src/settlement/reservationTracker'
import type { PaymasterSigner } from '../src/signer/paymasterSigner'
import type {
  GetPaymasterStubDataParams,
  GetPaymasterDataParams,
  PaymasterAddresses,
  SponsorPolicy,
  UserOperationRpc,
} from '../src/types'

// ============ Test Constants ============

const SENDER = '0x1234567890123456789012345678901234567890' as Address
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const PAYMASTER_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
const ERC20_PAYMASTER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
const PERMIT2_PAYMASTER = '0xcccccccccccccccccccccccccccccccccccccccc' as Address
const SPONSOR_PAYMASTER = '0xdddddddddddddddddddddddddddddddddddddddd' as Address
const TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
const CHAIN_ID = '0x205b' as Hex // 8283

const PAYMASTER_ADDRESSES: PaymasterAddresses = {
  verifying: PAYMASTER_ADDRESS,
  erc20: ERC20_PAYMASTER,
  permit2: PERMIT2_PAYMASTER,
  sponsor: SPONSOR_PAYMASTER,
}

function createTestUserOp(overrides: Partial<UserOperationRpc> = {}): UserOperationRpc {
  return {
    sender: SENDER,
    nonce: '0x0' as Hex,
    callData: '0x' as Hex,
    callGasLimit: '0x10000' as Hex,
    verificationGasLimit: '0x10000' as Hex,
    preVerificationGas: '0x5000' as Hex,
    maxFeePerGas: '0x3B9ACA00' as Hex,
    maxPriorityFeePerGas: '0x5F5E100' as Hex,
    signature: '0x' as Hex,
    ...overrides,
  }
}

// ============ Mock Signer ============

function createMockSigner(): PaymasterSigner {
  const stubPaymasterData = '0xstubdata' as Hex
  const signedPaymasterData = '0xsigneddata' as Hex

  return {
    getSignerAddress: vi.fn(() => PAYMASTER_ADDRESS),
    generateStubData: vi.fn((_type, _payload, _validity?) => ({
      paymasterData: stubPaymasterData,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      validAfter: Math.floor(Date.now() / 1000) - 60,
    })),
    generateSignedData: vi.fn(async (_userOp, _entryPoint, _chainId, _type, _payload, _validity?) => ({
      paymasterData: signedPaymasterData,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      validAfter: Math.floor(Date.now() / 1000) - 60,
    })),
  } as unknown as PaymasterSigner
}

// ============ pm_getPaymasterStubData Tests ============

describe('handleGetPaymasterStubData', () => {
  let policyManager: SponsorPolicyManager
  let signer: PaymasterSigner

  beforeEach(() => {
    const policy: SponsorPolicy = {
      id: 'default',
      name: 'Default',
      active: true,
      maxGasLimit: 10_000_000n,
      maxGasCost: 10n ** 18n,
      dailyLimitPerSender: 10n ** 17n,
      globalDailyLimit: 10n ** 19n,
    }
    policyManager = new SponsorPolicyManager([policy])
    signer = createMockSigner()
  })

  const baseConfig = () => ({
    paymasterAddress: PAYMASTER_ADDRESS,
    paymasterAddresses: PAYMASTER_ADDRESSES,
    signer,
    policyManager,
    supportedChainIds: [8283],
    supportedEntryPoints: [ENTRY_POINT],
  })

  describe('verifying (type 0)', () => {
    it('should return stub data for verifying paymaster', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PAYMASTER_ADDRESS)
        expect(result.data.paymasterData).toBeTruthy()
        expect(result.data.isFinal).toBe(false)
      }
    })

    it('should default to verifying when no context', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PAYMASTER_ADDRESS)
      }
    })

    it('should pass PaymasterType.VERIFYING to signer', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      handleGetPaymasterStubData(params, baseConfig())

      // Verify signer was called with VERIFYING type (0) and a payload
      const generateStubData = signer.generateStubData as ReturnType<typeof vi.fn>
      expect(generateStubData).toHaveBeenCalledTimes(1)
      const [paymasterType, payload] = generateStubData.mock.calls[0]
      expect(paymasterType).toBe(0) // PaymasterType.VERIFYING = 0
      expect(typeof payload).toBe('string')
      expect(payload.startsWith('0x')).toBe(true)
    })
  })

  describe('sponsor (type 1)', () => {
    it('should return stub data for sponsor paymaster', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'sponsor',
          campaignId: ('0x' + '01'.padStart(64, '0')) as Hex,
          perUserLimit: '1000000000000000000',
          targetContract: '0x0000000000000000000000000000000000000000' as Address,
          targetSelector: '0x12345678' as Hex,
        },
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(SPONSOR_PAYMASTER)
        expect(result.data.paymasterData).toBeTruthy()
        expect(result.data.isFinal).toBe(false)
      }
    })

    it('should pass PaymasterType.SPONSOR to signer', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'sponsor' },
      }

      handleGetPaymasterStubData(params, baseConfig())

      const generateStubData = signer.generateStubData as ReturnType<typeof vi.fn>
      expect(generateStubData).toHaveBeenCalledTimes(1)
      const [paymasterType] = generateStubData.mock.calls[0]
      expect(paymasterType).toBe(1) // PaymasterType.SPONSOR = 1
    })
  })

  describe('erc20 (type 2)', () => {
    it('should return stub data for erc20 paymaster', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'erc20',
          tokenAddress: TOKEN_ADDRESS,
          maxTokenCost: '100000000',
          quoteId: '12345',
        },
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(ERC20_PAYMASTER)
        // ERC20 uses encodePaymasterData directly, no signer
        expect(result.data.paymasterData).toBeTruthy()
        expect(result.data.paymasterData.startsWith('0x')).toBe(true)
      }
    })

    it('should reject when tokenAddress is missing', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'erc20' },
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32602)
        expect(result.error.message).toContain('tokenAddress')
      }
    })

    it('should NOT call signer for erc20 (envelope-based)', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'erc20',
          tokenAddress: TOKEN_ADDRESS,
        },
      }

      handleGetPaymasterStubData(params, baseConfig())

      const generateStubData = signer.generateStubData as ReturnType<typeof vi.fn>
      expect(generateStubData).not.toHaveBeenCalled()
    })
  })

  describe('permit2 (type 3)', () => {
    it('should return stub data with empty paymasterData', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'permit2' },
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PERMIT2_PAYMASTER)
        // Permit2 stub returns empty paymasterData (client builds envelope)
        expect(result.data.paymasterData).toBe('0x')
      }
    })

    it('should NOT call signer for permit2', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'permit2' },
      }

      handleGetPaymasterStubData(params, baseConfig())

      const generateStubData = signer.generateStubData as ReturnType<typeof vi.fn>
      expect(generateStubData).not.toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should reject unsupported chain ID', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: '0x1' as Hex, // Mainnet, not in supported list
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32002)
      }
    })

    it('should reject unsupported entry point', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: '0x1111111111111111111111111111111111111111' as Address,
        chainId: CHAIN_ID,
      }

      const result = handleGetPaymasterStubData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32003)
      }
    })

    it('should reject unconfigured paymaster type', () => {
      const params: GetPaymasterStubDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'erc20' },
      }

      const config = {
        ...baseConfig(),
        paymasterAddresses: { verifying: PAYMASTER_ADDRESS }, // Only verifying configured
      }

      const result = handleGetPaymasterStubData(params, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32005)
        expect(result.error.message).toContain("'erc20' not configured")
      }
    })
  })
})

// ============ pm_getPaymasterData Tests ============

describe('handleGetPaymasterData', () => {
  let policyManager: SponsorPolicyManager
  let signer: PaymasterSigner
  let reservationTracker: ReservationTracker

  beforeEach(() => {
    const policy: SponsorPolicy = {
      id: 'default',
      name: 'Default',
      active: true,
      maxGasLimit: 10_000_000n,
      maxGasCost: 10n ** 18n,
      dailyLimitPerSender: 10n ** 17n,
      globalDailyLimit: 10n ** 19n,
    }
    policyManager = new SponsorPolicyManager([policy])
    signer = createMockSigner()
    reservationTracker = new ReservationTracker()
  })

  const baseConfig = () => ({
    paymasterAddress: PAYMASTER_ADDRESS,
    paymasterAddresses: PAYMASTER_ADDRESSES,
    signer,
    policyManager,
    supportedChainIds: [8283],
    supportedEntryPoints: [ENTRY_POINT],
    reservationTracker,
  })

  describe('verifying (type 0)', () => {
    it('should return signed data for verifying paymaster', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PAYMASTER_ADDRESS)
        expect(result.data.paymasterData).toBe('0xsigneddata')
        expect(result.data.reservationId).toBeTruthy()
      }
    })

    it('should pass PaymasterType.VERIFYING and payload to signer', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      await handleGetPaymasterData(params, baseConfig())

      const generateSignedData = signer.generateSignedData as ReturnType<typeof vi.fn>
      expect(generateSignedData).toHaveBeenCalledTimes(1)
      const [, , , paymasterType, payload] = generateSignedData.mock.calls[0]
      expect(paymasterType).toBe(0) // PaymasterType.VERIFYING
      expect(payload.startsWith('0x')).toBe(true)
    })

    it('should track reservation with userOpHash', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        // Verify reservation was tracked
        const pendingHashes = reservationTracker.getPendingHashes()
        expect(pendingHashes.length).toBe(1)
      }
    })

    it('should create reservation in policyManager', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      await handleGetPaymasterData(params, baseConfig())

      const tracker = policyManager.getTracker(SENDER)
      expect(tracker).toBeDefined()
      expect(tracker!.pendingReservations.length).toBe(1)
    })
  })

  describe('sponsor (type 1)', () => {
    it('should return signed data for sponsor paymaster', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'sponsor',
          campaignId: ('0x' + '01'.padStart(64, '0')) as Hex,
          perUserLimit: '1000000000000000000',
          targetContract: '0x0000000000000000000000000000000000000000' as Address,
          targetSelector: '0x12345678' as Hex,
        },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(SPONSOR_PAYMASTER)
        expect(result.data.paymasterData).toBe('0xsigneddata')
        expect(result.data.reservationId).toBeTruthy()
      }
    })

    it('should pass PaymasterType.SPONSOR to signer', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'sponsor' },
      }

      await handleGetPaymasterData(params, baseConfig())

      const generateSignedData = signer.generateSignedData as ReturnType<typeof vi.fn>
      expect(generateSignedData).toHaveBeenCalledTimes(1)
      const [, , , paymasterType] = generateSignedData.mock.calls[0]
      expect(paymasterType).toBe(1) // PaymasterType.SPONSOR
    })

    it('should use default values for missing sponsor context fields', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'sponsor' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
    })
  })

  describe('erc20 (type 2)', () => {
    it('should return envelope-based data for erc20 paymaster', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'erc20',
          tokenAddress: TOKEN_ADDRESS,
          maxTokenCost: '100000000',
          quoteId: '555',
        },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(ERC20_PAYMASTER)
        expect(result.data.paymasterData).toBeTruthy()
        expect(result.data.paymasterData.startsWith('0x')).toBe(true)
        // No reservationId for erc20
        expect(result.data.reservationId).toBeUndefined()
      }
    })

    it('should reject when tokenAddress is missing', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'erc20' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32602)
        expect(result.error.message).toContain('tokenAddress')
      }
    })

    it('should NOT call signer for erc20', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'erc20',
          tokenAddress: TOKEN_ADDRESS,
        },
      }

      await handleGetPaymasterData(params, baseConfig())

      const generateSignedData = signer.generateSignedData as ReturnType<typeof vi.fn>
      expect(generateSignedData).not.toHaveBeenCalled()
    })
  })

  describe('permit2 (type 3)', () => {
    it('should build full envelope when permit fields provided', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'permit2',
          tokenAddress: TOKEN_ADDRESS,
          permitAmount: '1000000000',
          permitExpiration: 1700003600,
          permitNonce: 0,
          permitSig: ('0x' + 'ab'.repeat(65)) as Hex,
        },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PERMIT2_PAYMASTER)
        expect(result.data.paymasterData).toBeTruthy()
        expect(result.data.paymasterData.length).toBeGreaterThan(2)
      }
    })

    it('should return empty paymasterData when permit fields missing', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'permit2' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymaster).toBe(PERMIT2_PAYMASTER)
        expect(result.data.paymasterData).toBe('0x')
      }
    })

    it('should NOT call signer for permit2', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: {
          paymasterType: 'permit2',
          tokenAddress: TOKEN_ADDRESS,
          permitSig: ('0x' + 'ab'.repeat(65)) as Hex,
        },
      }

      await handleGetPaymasterData(params, baseConfig())

      const generateSignedData = signer.generateSignedData as ReturnType<typeof vi.fn>
      expect(generateSignedData).not.toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should reject unsupported chain ID', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: '0x1' as Hex,
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32002)
      }
    })

    it('should reject unsupported entry point', async () => {
      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: '0x1111111111111111111111111111111111111111' as Address,
        chainId: CHAIN_ID,
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(-32003)
      }
    })

    it('should reject when policy check fails', async () => {
      policyManager.setPolicy({
        id: 'default',
        name: 'Default',
        active: false,
      })

      const params: GetPaymasterDataParams = {
        userOp: createTestUserOp(),
        entryPoint: ENTRY_POINT,
        chainId: CHAIN_ID,
        context: { paymasterType: 'verifying' },
      }

      const result = await handleGetPaymasterData(params, baseConfig())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('not active')
      }
    })
  })
})

// ============ ReservationTracker Tests ============

describe('ReservationTracker', () => {
  let tracker: ReservationTracker

  beforeEach(() => {
    tracker = new ReservationTracker()
  })

  it('should track a reservation by userOpHash', () => {
    const hash = '0xabc123' as Hex
    tracker.track(hash, SENDER, 'res-1', 1000n)

    const reservation = tracker.getByUserOpHash(hash)
    expect(reservation).toBeDefined()
    expect(reservation!.reservationId).toBe('res-1')
    expect(reservation!.sender).toBe(SENDER)
    expect(reservation!.estimatedAmount).toBe(1000n)
  })

  it('should look up by reservationId', () => {
    const hash = '0xabc123' as Hex
    tracker.track(hash, SENDER, 'res-1', 1000n)

    const reservation = tracker.getByReservationId('res-1')
    expect(reservation).toBeDefined()
    expect(reservation!.userOpHash).toBe(hash)
  })

  it('should return undefined for unknown hash', () => {
    expect(tracker.getByUserOpHash('0xunknown' as Hex)).toBeUndefined()
  })

  it('should remove a reservation', () => {
    const hash = '0xabc123' as Hex
    tracker.track(hash, SENDER, 'res-1', 1000n)

    expect(tracker.remove(hash)).toBe(true)
    expect(tracker.getByUserOpHash(hash)).toBeUndefined()
    expect(tracker.getByReservationId('res-1')).toBeUndefined()
  })

  it('should return pending hashes', () => {
    tracker.track('0xhash1' as Hex, SENDER, 'res-1', 100n)
    tracker.track('0xhash2' as Hex, SENDER, 'res-2', 200n)

    const pending = tracker.getPendingHashes()
    expect(pending).toHaveLength(2)
    expect(pending).toContain('0xhash1')
    expect(pending).toContain('0xhash2')
  })

  it('should provide stats', () => {
    expect(tracker.getStats()).toEqual({ total: 0, oldest: null })

    tracker.track('0xhash1' as Hex, SENDER, 'res-1', 100n)

    const stats = tracker.getStats()
    expect(stats.total).toBe(1)
    expect(stats.oldest).toBeDefined()
  })

  it('should expire old reservations', async () => {
    tracker.track('0xhash1' as Hex, SENDER, 'res-1', 100n)

    // Should not expire fresh reservations
    expect(tracker.expireOlderThan(60_000)).toBe(0)

    // Wait a tick to ensure createdAt < Date.now() - 1
    await new Promise((r) => setTimeout(r, 5))
    expect(tracker.expireOlderThan(1)).toBe(1)
    expect(tracker.getPendingHashes()).toHaveLength(0)
  })
})

// ============ SettlementWorker Tests ============

describe('SettlementWorker', () => {
  it('should settle successful operations', async () => {
    const reservationTracker = new ReservationTracker()
    const policyManager = new SponsorPolicyManager()

    // Track a reservation
    const reservationId = policyManager.reserveSpending(SENDER, 1000n)
    reservationTracker.track('0xhash1' as Hex, SENDER, reservationId, 1000n)

    // Create mock bundler that returns success receipt
    const mockBundlerClient = {
      getUserOperationReceipt: vi.fn(async () => ({
        userOpHash: '0xhash1' as Hex,
        success: true,
        actualGasCost: 800n,
        actualGasUsed: 400n,
        receipt: { transactionHash: '0xtx1' as Hex, blockNumber: 100n },
      })),
      isAvailable: vi.fn(async () => true),
    }

    const { SettlementWorker } = await import('../src/settlement/settlementWorker')
    const worker = new SettlementWorker(
      reservationTracker,
      policyManager,
      mockBundlerClient as any,
      { pollIntervalMs: 100_000 } // High interval to prevent auto-polling
    )

    // Manually trigger a poll
    // Access private method for testing
    await (worker as any).poll()

    // Verify: reservation settled, tracker cleared
    const stats = worker.getStats()
    expect(stats.settled).toBe(1)
    expect(stats.cancelled).toBe(0)
    expect(reservationTracker.getPendingHashes()).toHaveLength(0)

    // Verify confirmed spending
    const senderTracker = policyManager.getTracker(SENDER)
    expect(senderTracker!.dailyGasSpent).toBe(800n) // actualGasCost, not estimated
    expect(senderTracker!.pendingReservations).toHaveLength(0)
  })

  it('should cancel failed operations', async () => {
    const reservationTracker = new ReservationTracker()
    const policyManager = new SponsorPolicyManager()

    const reservationId = policyManager.reserveSpending(SENDER, 1000n)
    reservationTracker.track('0xhash1' as Hex, SENDER, reservationId, 1000n)

    const mockBundlerClient = {
      getUserOperationReceipt: vi.fn(async () => ({
        userOpHash: '0xhash1' as Hex,
        success: false,
        actualGasCost: 0n,
        actualGasUsed: 0n,
        receipt: { transactionHash: '0xtx1' as Hex, blockNumber: 100n },
      })),
      isAvailable: vi.fn(async () => true),
    }

    const { SettlementWorker } = await import('../src/settlement/settlementWorker')
    const worker = new SettlementWorker(
      reservationTracker,
      policyManager,
      mockBundlerClient as any,
      { pollIntervalMs: 100_000 }
    )

    await (worker as any).poll()

    const stats = worker.getStats()
    expect(stats.settled).toBe(0)
    expect(stats.cancelled).toBe(1)
    expect(reservationTracker.getPendingHashes()).toHaveLength(0)

    // Verify spending was released (not confirmed)
    const senderTracker = policyManager.getTracker(SENDER)
    expect(senderTracker!.dailyGasSpent).toBe(0n)
    expect(senderTracker!.pendingReservations).toHaveLength(0)
  })
})
