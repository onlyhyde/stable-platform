/**
 * ApprovalController Tests
 *
 * Tests for the approval flow: connect, transaction, signature,
 * network switch, authorization, approve/reject, expiry
 */

import type { Address } from 'viem'
import { ApprovalController } from '../../../src/background/controllers/approvalController'
import { TEST_ACCOUNTS, TEST_ORIGINS } from '../../utils/testUtils'

// ============================================================================
// Mocks
// ============================================================================

// Mock config
jest.mock('../../../src/config', () => ({
  getApprovalConfig: () => ({
    expiryMs: 300_000, // 5 min
    historyMaxLength: 50,
  }),
}))

// Mock logger
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}))

// Mock eip7702 utils
jest.mock('../../../src/shared/utils/eip7702', () => ({
  isRevocationAddress: jest.fn(
    (addr: string) => addr === '0x0000000000000000000000000000000000000000'
  ),
}))

// Mock keyring crypto
let hexCounter = 0
jest.mock('../../../src/background/keyring/crypto', () => ({
  generateRandomHex: jest.fn(() => {
    hexCounter++
    return `approval-${hexCounter.toString().padStart(8, '0')}`
  }),
}))

// Mock callDataDecoder
jest.mock('../../../src/background/security/callDataDecoder', () => ({
  decodeCallData: jest.fn(() => null),
}))

// Mock transactionSimulator
jest.mock('../../../src/background/security/transactionSimulator', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({
    success: true,
    warnings: [],
    balanceChanges: [],
    decodedCallData: null,
  }),
}))

// Mock walletState
jest.mock('../../../src/background/state/store', () => ({
  walletState: {
    getState: () => ({
      networks: {
        selectedChainId: 1,
        networks: [
          {
            chainId: 1,
            name: 'Ethereum',
            rpcUrl: 'https://rpc.example.com',
          },
        ],
      },
    }),
  },
}))

// Mock chrome.windows and chrome.tabs APIs
const mockChromeWindows = {
  create: jest.fn().mockResolvedValue({ id: 999 }),
  get: jest.fn().mockRejectedValue(new Error('Window not found')),
  update: jest.fn().mockResolvedValue({}),
}

const mockChromeTabs = {
  query: jest.fn().mockResolvedValue([{ id: 1 }]),
  update: jest.fn().mockResolvedValue({}),
}

const mockChromeRuntime = {
  getURL: jest.fn((path: string) => `chrome-extension://abc/${path}`),
}

// Ensure chrome global is set
beforeAll(() => {
  ;(global as unknown).chrome = {
    ...(global as unknown).chrome,
    windows: mockChromeWindows,
    tabs: mockChromeTabs,
    runtime: {
      ...(global as unknown).chrome?.runtime,
      ...mockChromeRuntime,
    },
  }
})

// ============================================================================
// Tests
// ============================================================================

describe('ApprovalController', () => {
  let controller: ApprovalController

  beforeEach(() => {
    hexCounter = 0
    controller = new ApprovalController()
    jest.clearAllMocks()
    mockChromeWindows.get.mockRejectedValue(new Error('Window not found'))
  })

  describe('getState()', () => {
    it('should return empty state initially', () => {
      const state = controller.getState()
      expect(state.pendingApprovals).toEqual([])
      expect(state.approvalHistory).toEqual([])
    })
  })

  describe('hasPendingApprovals()', () => {
    it('should return false initially', () => {
      expect(controller.hasPendingApprovals()).toBe(false)
    })
  })

  describe('requestConnect()', () => {
    it('should create a pending connect approval', () => {
      // Don't await - it blocks until resolved
      const promise = controller.requestConnect(TEST_ORIGINS.trusted, 'icon.png')

      expect(controller.hasPendingApprovals()).toBe(true)

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('connect')
      expect(state.pendingApprovals[0].origin).toBe(TEST_ORIGINS.trusted)
      expect(state.pendingApprovals[0].status).toBe('pending')

      // Clean up: reject so promise settles
      controller.reject(state.pendingApprovals[0].id, 'test cleanup').catch(() => {})
      promise.catch(() => {}) // Suppress unhandled rejection
    })

    it('should include phishing warnings when provided', () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted, undefined, {
        warnings: ['Suspicious origin'],
        riskLevel: 'high',
      })

      const state = controller.getState()
      const approval = state.pendingApprovals[0]
      expect(approval.type).toBe('connect')
      expect((approval.data as unknown).warnings).toContain('Suspicious origin')
      expect((approval.data as unknown).riskLevel).toBe('high')

      controller.reject(approval.id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('requestTransaction()', () => {
    // requestTransaction is async due to simulateTransaction, so we
    // need to wait for the approval to appear in pending list

    async function waitForPending() {
      // Small delay for the async requestTransaction to add the approval
      await new Promise((r) => setTimeout(r, 50))
    }

    it('should create a pending transaction approval', async () => {
      const promise = controller.requestTransaction(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        TEST_ACCOUNTS.account2.address,
        1000000000000000000n, // 1 ETH
        '0x',
        undefined,
        undefined,
        'icon.png'
      )

      await waitForPending()

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('transaction')

      const data = state.pendingApprovals[0].data as unknown
      expect(data.from).toBe(TEST_ACCOUNTS.account1.address)
      expect(data.to).toBe(TEST_ACCOUNTS.account2.address)
      expect(data.value).toBe(1000000000000000000n)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should detect high-value transactions (>10 ETH)', async () => {
      const promise = controller.requestTransaction(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        TEST_ACCOUNTS.account2.address,
        11n * 10n ** 18n // 11 ETH
      )

      await waitForPending()

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.warnings.some((w: string) => w.includes('High value'))).toBe(true)
      expect(data.riskLevel).toBe('medium')

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should detect critical-value transactions (>=100 ETH)', async () => {
      const promise = controller.requestTransaction(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        TEST_ACCOUNTS.account2.address,
        100n * 10n ** 18n // 100 ETH
      )

      await waitForPending()

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.warnings.some((w: string) => w.includes('Critical'))).toBe(true)
      expect(data.riskLevel).toBe('high')

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should detect zero-address sends', async () => {
      const ZERO = '0x0000000000000000000000000000000000000000' as Address
      const promise = controller.requestTransaction(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        ZERO,
        0n
      )

      await waitForPending()

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.warnings.some((w: string) => w.includes('permanently lost'))).toBe(true)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('requestSignature()', () => {
    it('should create a pending signature approval', () => {
      const promise = controller.requestSignature(
        TEST_ORIGINS.trusted,
        'personal_sign',
        TEST_ACCOUNTS.account1.address,
        '0x48656c6c6f' // "Hello" hex
      )

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('signature')

      const data = state.pendingApprovals[0].data as unknown
      expect(data.method).toBe('personal_sign')
      expect(data.address).toBe(TEST_ACCOUNTS.account1.address)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should detect permit signature risks', () => {
      const typedData = { primaryType: 'Permit' }
      const promise = controller.requestSignature(
        TEST_ORIGINS.trusted,
        'eth_signTypedData_v4',
        TEST_ACCOUNTS.account1.address,
        '',
        typedData
      )

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.riskWarnings.some((w: string) => w.includes('token spending'))).toBe(true)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should decode hex messages for personal_sign', () => {
      const hexMessage = '0x48656c6c6f' // "Hello"
      const promise = controller.requestSignature(
        TEST_ORIGINS.trusted,
        'personal_sign',
        TEST_ACCOUNTS.account1.address,
        hexMessage
      )

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.displayMessage).toBe('Hello')

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('requestSwitchNetwork()', () => {
    it('should create a pending network switch approval', () => {
      const promise = controller.requestSwitchNetwork(TEST_ORIGINS.trusted, 137, 'Polygon')

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('switchNetwork')

      const data = state.pendingApprovals[0].data as unknown
      expect(data.chainId).toBe(137)
      expect(data.chainName).toBe('Polygon')

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('requestAddNetwork()', () => {
    it('should create a pending add network approval', () => {
      const promise = controller.requestAddNetwork(
        TEST_ORIGINS.trusted,
        42161,
        'Arbitrum One',
        'https://arb1.arbitrum.io/rpc',
        { name: 'Ether', symbol: 'ETH', decimals: 18 },
        'https://arbiscan.io'
      )

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('addNetwork')

      const data = state.pendingApprovals[0].data as unknown
      expect(data.chainId).toBe(42161)
      expect(data.chainName).toBe('Arbitrum One')

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('requestAuthorization()', () => {
    it('should create a pending authorization approval', () => {
      const contractAddr = '0xaabbccddee0011223344556677889900aabbccdd' as Address
      const promise = controller.requestAuthorization(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        contractAddr,
        1,
        0n
      )

      const state = controller.getState()
      expect(state.pendingApprovals).toHaveLength(1)
      expect(state.pendingApprovals[0].type).toBe('authorization')

      const data = state.pendingApprovals[0].data as unknown
      expect(data.account).toBe(TEST_ACCOUNTS.account1.address)
      expect(data.contractAddress).toBe(contractAddr)
      expect(data.isRevocation).toBe(false)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })

    it('should detect revocation when zero address', () => {
      const ZERO = '0x0000000000000000000000000000000000000000' as Address
      const promise = controller.requestAuthorization(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        ZERO,
        1,
        0n
      )

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.isRevocation).toBe(true)

      controller.reject(state.pendingApprovals[0].id, 'cleanup').catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('approve()', () => {
    it('should resolve the approval promise with data', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      const approvalData = {
        accounts: [TEST_ACCOUNTS.account1.address],
        permissions: ['eth_accounts'],
      }

      await controller.approve(id, approvalData)

      const result = await promise
      expect(result).toEqual(approvalData)
    })

    it('should move approval to history', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.approve(id, { accounts: [], permissions: [] })
      await promise

      const newState = controller.getState()
      expect(newState.pendingApprovals).toHaveLength(0)
      expect(newState.approvalHistory).toHaveLength(1)
      expect(newState.approvalHistory[0].status).toBe('approved')
    })

    it('should throw for non-existent approval', async () => {
      await expect(controller.approve('nonexistent')).rejects.toThrow('Approval not found')
    })

    it('should emit approvalResolved event', async () => {
      const listener = jest.fn()
      controller.subscribe(listener)

      const promise = controller.requestConnect(TEST_ORIGINS.trusted)
      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      // Clear the 'approvalAdded' call
      listener.mockClear()

      await controller.approve(id, { accounts: [], permissions: [] })
      await promise

      expect(listener).toHaveBeenCalledWith('approvalResolved', expect.any(Object))
    })
  })

  describe('reject()', () => {
    it('should reject the approval promise', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.reject(id, 'User rejected')

      await expect(promise).rejects.toThrow('User rejected')
    })

    it('should use default rejection message', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.reject(id)

      await expect(promise).rejects.toThrow('User rejected the request')
    })

    it('should move rejected approval to history', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.reject(id)
      await promise.catch(() => {}) // Suppress error

      const newState = controller.getState()
      expect(newState.pendingApprovals).toHaveLength(0)
      expect(newState.approvalHistory).toHaveLength(1)
      expect(newState.approvalHistory[0].status).toBe('rejected')
    })

    it('should throw for non-existent approval', async () => {
      await expect(controller.reject('nonexistent')).rejects.toThrow('Approval not found')
    })
  })

  describe('rejectAllForOrigin()', () => {
    it('should reject all approvals for a given origin', async () => {
      const promise1 = controller.requestConnect(TEST_ORIGINS.trusted)
      const promise2 = controller.requestConnect(TEST_ORIGINS.trusted)
      // Different origin
      const promise3 = controller.requestConnect(TEST_ORIGINS.untrusted)

      expect(controller.getState().pendingApprovals).toHaveLength(3)

      await controller.rejectAllForOrigin(TEST_ORIGINS.trusted)

      // Only the untrusted one should remain
      expect(controller.getState().pendingApprovals).toHaveLength(1)
      expect(controller.getState().pendingApprovals[0].origin).toBe(TEST_ORIGINS.untrusted)

      // Cleanup
      await promise1.catch(() => {})
      await promise2.catch(() => {})
      controller.reject(controller.getState().pendingApprovals[0].id).catch(() => {})
      await promise3.catch(() => {})
    })
  })

  describe('subscribe()', () => {
    it('should notify on approval added', () => {
      const listener = jest.fn()
      controller.subscribe(listener)

      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      expect(listener).toHaveBeenCalledWith(
        'approvalAdded',
        expect.objectContaining({
          type: 'connect',
          origin: TEST_ORIGINS.trusted,
        })
      )

      const state = controller.getState()
      controller.reject(state.pendingApprovals[0].id).catch(() => {})
      promise.catch(() => {})
    })

    it('should return unsubscribe function', () => {
      const listener = jest.fn()
      const unsubscribe = controller.subscribe(listener)

      unsubscribe()

      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      expect(listener).not.toHaveBeenCalled()

      const state = controller.getState()
      controller.reject(state.pendingApprovals[0].id).catch(() => {})
      promise.catch(() => {})
    })
  })

  describe('getPendingApproval()', () => {
    it('should return approval by ID', () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      const state = controller.getState()
      const id = state.pendingApprovals[0].id
      const approval = controller.getPendingApproval(id)

      expect(approval).toBeDefined()
      expect(approval!.id).toBe(id)

      controller.reject(id).catch(() => {})
      promise.catch(() => {})
    })

    it('should return undefined for unknown ID', () => {
      expect(controller.getPendingApproval('unknown')).toBeUndefined()
    })
  })

  describe('getPendingApprovalsForOrigin()', () => {
    it('should return only approvals for the given origin', () => {
      const p1 = controller.requestConnect(TEST_ORIGINS.trusted)
      const p2 = controller.requestConnect(TEST_ORIGINS.untrusted)
      const p3 = controller.requestConnect(TEST_ORIGINS.trusted)

      const forTrusted = controller.getPendingApprovalsForOrigin(TEST_ORIGINS.trusted)
      expect(forTrusted).toHaveLength(2)

      const forUntrusted = controller.getPendingApprovalsForOrigin(TEST_ORIGINS.untrusted)
      expect(forUntrusted).toHaveLength(1)

      // Cleanup
      const state = controller.getState()
      for (const a of state.pendingApprovals) {
        controller.reject(a.id).catch(() => {})
      }
      p1.catch(() => {})
      p2.catch(() => {})
      p3.catch(() => {})
    })
  })

  describe('expiry', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should expire approvals after timeout', async () => {
      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      expect(controller.hasPendingApprovals()).toBe(true)

      // Fast-forward past expiry (300_000ms = 5 min)
      jest.advanceTimersByTime(300_001)

      await expect(promise).rejects.toThrow('expired')

      expect(controller.hasPendingApprovals()).toBe(false)
      expect(controller.getState().approvalHistory).toHaveLength(1)
      expect(controller.getState().approvalHistory[0].status).toBe('expired')
    })

    it('should emit approvalExpired event', () => {
      const listener = jest.fn()
      controller.subscribe(listener)

      const promise = controller.requestConnect(TEST_ORIGINS.trusted)

      listener.mockClear()

      jest.advanceTimersByTime(300_001)

      expect(listener).toHaveBeenCalledWith('approvalExpired', expect.any(Object))

      promise.catch(() => {})
    })
  })

  describe('requestSignMessage() (simplified)', () => {
    it('should return { approved: true } when approved', async () => {
      const resultPromise = controller.requestSignMessage({
        origin: TEST_ORIGINS.trusted,
        message: 'Sign this message',
        address: TEST_ACCOUNTS.account1.address,
        method: 'personal_sign',
      })

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.approve(id, { signature: '0xsig' })

      const result = await resultPromise
      expect(result).toEqual({ approved: true })
    })

    it('should return { approved: false } when rejected', async () => {
      const resultPromise = controller.requestSignMessage({
        origin: TEST_ORIGINS.trusted,
        message: 'Sign this message',
        address: TEST_ACCOUNTS.account1.address,
        method: 'personal_sign',
      })

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.reject(id, 'User rejected')

      const result = await resultPromise
      expect(result).toEqual({ approved: false })
    })
  })

  describe('requestSignTypedData() (simplified)', () => {
    it('should return { approved: true } when approved', async () => {
      const resultPromise = controller.requestSignTypedData({
        origin: TEST_ORIGINS.trusted,
        address: TEST_ACCOUNTS.account1.address,
        typedData: { primaryType: 'Mail' },
        method: 'eth_signTypedData_v4',
      })

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.approve(id, { signature: '0xsig' })

      const result = await resultPromise
      expect(result).toEqual({ approved: true })
    })

    it('should return { approved: false } when rejected', async () => {
      const resultPromise = controller.requestSignTypedData({
        origin: TEST_ORIGINS.trusted,
        address: TEST_ACCOUNTS.account1.address,
        typedData: { primaryType: 'Mail' },
        method: 'eth_signTypedData_v4',
      })

      const state = controller.getState()
      const id = state.pendingApprovals[0].id

      await controller.reject(id, 'User rejected')

      const result = await resultPromise
      expect(result).toEqual({ approved: false })
    })
  })

  describe('transaction risk assessment', () => {
    it('should detect contract interaction data', async () => {
      // Mock decodeCallData to return a decoded function
      const { decodeCallData } = require('../../../src/background/security/callDataDecoder')
      ;(decodeCallData as jest.Mock).mockReturnValue({
        functionName: 'approve',
        description: 'Approving token spending',
        args: [
          { name: 'spender', value: '0xabc' },
          { name: 'amount', value: 'UNLIMITED' },
        ],
      })

      const promise = controller.requestTransaction(
        TEST_ORIGINS.trusted,
        TEST_ACCOUNTS.account1.address,
        TEST_ACCOUNTS.account2.address,
        0n,
        '0x095ea7b3000000000000000000000000000000000000000000000000ffffffffffffffff'
      )

      // Wait for async simulation to complete
      await new Promise((r) => setTimeout(r, 50))

      const state = controller.getState()
      const data = state.pendingApprovals[0].data as unknown
      expect(data.warnings.some((w: string) => w.includes('UNLIMITED'))).toBe(true)
      expect(data.riskLevel).toBe('high')

      controller.reject(state.pendingApprovals[0].id).catch(() => {})
      promise.catch(() => {})
    })
  })
})
