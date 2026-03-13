/**
 * MultiModeTransactionController Tests
 * Tests transaction lifecycle: add, approve, reject, sign, submit, confirm
 */

import type { Address, Hex } from 'viem'
import { MultiModeTransactionController } from '../../../src/background/controllers/MultiModeTransactionController'
import type {
  MultiModeTransactionControllerOptions,
  TransactionAccountInfo,
} from '../../../src/background/controllers/multiModeTransactionController.types'

// The mock for @stablenet/core is already provided by jest.config.js moduleNameMapper
// We need to add the missing exports used by MultiModeTransactionController
jest.mock('@stablenet/core', () => {
  const actual = jest.requireActual('@stablenet/core')
  return {
    ...actual,
    TRANSACTION_MODE: {
      EOA: 'eoa',
      EIP7702: 'eip7702',
      SMART_ACCOUNT: 'smartAccount',
    },
    ENTRY_POINT_ADDRESS: '0xD23Ee0D8E8DfabE76AA52a872Ce015B0BcAED6Ce',
    DEFAULT_CALL_GAS_LIMIT: 100000n,
    DEFAULT_VERIFICATION_GAS_LIMIT: 200000n,
    DEFAULT_PRE_VERIFICATION_GAS: 50000n,
    getDefaultTransactionMode: jest.fn().mockReturnValue('eoa'),
    getAvailableTransactionModes: jest.fn().mockReturnValue(['eoa', 'eip7702']),
    getUserOperationHash: jest.fn().mockReturnValue('0x' + 'ab'.repeat(32)),
    createTransactionRouter: jest.fn().mockReturnValue({
      getSupportedModes: jest.fn().mockReturnValue(['eoa', 'eip7702', 'smartAccount']),
      isSupported: jest.fn().mockReturnValue(true),
      prepare: jest.fn().mockResolvedValue({
        gasEstimate: {
          gasLimit: 21000n,
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 100000000n,
          estimatedCost: 21000000000000n,
        },
        strategyData: {},
      }),
      getAvailableModesWithEstimates: jest.fn().mockResolvedValue([
        {
          mode: 'eoa',
          available: true,
          estimate: {
            gasLimit: 21000n,
            maxFeePerGas: 1000000000n,
            maxPriorityFeePerGas: 100000000n,
            estimatedCost: 21000000000000n,
          },
        },
      ]),
    }),
    createBundlerClient: jest.fn().mockReturnValue({
      sendUserOperation: jest.fn().mockResolvedValue('0x' + 'cc'.repeat(32)),
    }),
  }
})

jest.mock('@stablenet/contracts', () => ({
  isChainSupported: jest.fn().mockReturnValue(true),
  getEntryPoint: jest.fn().mockReturnValue('0xD23Ee0D8E8DfabE76AA52a872Ce015B0BcAED6Ce'),
}))

const mockAccount: TransactionAccountInfo = {
  address: '0x1234567890123456789012345678901234567890' as Address,
  type: 'eoa',
}

function createMockOptions(
  overrides: Partial<MultiModeTransactionControllerOptions> = {}
): MultiModeTransactionControllerOptions {
  return {
    chainId: 1,
    rpcUrl: 'https://rpc.example.com',
    getSelectedAccount: jest.fn().mockReturnValue(mockAccount),
    signTransaction: jest.fn().mockResolvedValue('0x' + 'aa'.repeat(32)),
    signUserOperation: jest.fn().mockResolvedValue('0x' + 'bb'.repeat(32)),
    signAuthorization: jest.fn().mockResolvedValue({
      r: '0x' + '11'.repeat(32),
      s: '0x' + '22'.repeat(32),
      v: 27,
    }),
    publishTransaction: jest.fn().mockResolvedValue('0x' + 'dd'.repeat(32)),
    ...overrides,
  }
}

describe('MultiModeTransactionController', () => {
  let controller: MultiModeTransactionController
  let options: MultiModeTransactionControllerOptions

  beforeEach(() => {
    options = createMockOptions()
    controller = new MultiModeTransactionController(options)
  })

  describe('constructor', () => {
    it('should initialize with empty state', () => {
      const state = controller.getState()
      expect(state.transactions).toEqual({})
      expect(state.pendingTransactions).toEqual([])
      expect(state.confirmedTransactions).toEqual([])
    })

    it('should expose supported modes from router', () => {
      const modes = controller.getSupportedModes()
      expect(modes).toContain('eoa')
    })
  })

  describe('addTransaction', () => {
    it('should add a transaction with unapproved status', async () => {
      const txMeta = await controller.addTransaction(
        {
          from: mockAccount.address,
          to: '0x2222222222222222222222222222222222222222' as Address,
          value: 1000n,
        },
        'https://dapp.com'
      )

      expect(txMeta.status).toBe('unapproved')
      expect(txMeta.origin).toBe('https://dapp.com')
      expect(txMeta.mode).toBe('eoa')
      expect(txMeta.id).toBeDefined()
      expect(txMeta.time).toBeDefined()
    })

    it('should add transaction to pending list', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      const state = controller.getState()
      expect(state.pendingTransactions).toContain(txMeta.id)
      expect(state.transactions[txMeta.id]).toBeDefined()
    })

    it('should throw when no account is selected', async () => {
      const noAccountOptions = createMockOptions({
        getSelectedAccount: jest.fn().mockReturnValue(null),
      })
      const ctrl = new MultiModeTransactionController(noAccountOptions)

      await expect(
        ctrl.addTransaction({ from: mockAccount.address }, 'https://dapp.com')
      ).rejects.toThrow('No account selected')
    })

    it('should detect contract deployment type (no to, has data)', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, data: '0x6060604052' as Hex },
        'https://dapp.com'
      )

      expect(txMeta.type).toBe('contractDeployment')
    })

    it('should detect contract interaction type (has data)', async () => {
      const txMeta = await controller.addTransaction(
        {
          from: mockAccount.address,
          to: '0x2222222222222222222222222222222222222222' as Address,
          data: '0xa9059cbb' as Hex,
        },
        'https://dapp.com'
      )

      expect(txMeta.type).toBe('contractInteraction')
    })

    it('should detect standard transfer type', async () => {
      const txMeta = await controller.addTransaction(
        {
          from: mockAccount.address,
          to: '0x2222222222222222222222222222222222222222' as Address,
          value: 1000n,
        },
        'https://dapp.com'
      )

      expect(txMeta.type).toBe('standard')
    })

    it('should emit transaction:added event', async () => {
      const handler = jest.fn()
      controller.on('transaction:added', handler)

      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should use default gas estimate on prepare failure', async () => {
      const { createTransactionRouter } = jest.requireMock('@stablenet/core')
      createTransactionRouter.mockReturnValueOnce({
        getSupportedModes: jest.fn().mockReturnValue(['eoa']),
        isSupported: jest.fn().mockReturnValue(true),
        prepare: jest.fn().mockRejectedValue(new Error('Gas estimation failed')),
      })

      const ctrl = new MultiModeTransactionController(createMockOptions())
      const txMeta = await ctrl.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      expect(txMeta.gasEstimate).toBeDefined()
      expect(txMeta.gasEstimate!.gasLimit).toBe(21000n)
    })
  })

  describe('approveTransaction', () => {
    it('should change status to approved', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('approved')
    })

    it('should throw for non-existent transaction', async () => {
      await expect(controller.approveTransaction('nonexistent')).rejects.toThrow(
        'Transaction not found'
      )
    })

    it('should throw for non-unapproved transaction', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)

      await expect(controller.approveTransaction(txMeta.id)).rejects.toThrow('Cannot approve')
    })

    it('should emit transaction:approved event', async () => {
      const handler = jest.fn()
      controller.on('transaction:approved', handler)

      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('rejectTransaction', () => {
    it('should change status to rejected and remove from state', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.rejectTransaction(txMeta.id)

      // Transaction should be removed from in-memory state after rejection
      const state = controller.getState()
      expect(state.pendingTransactions).not.toContain(txMeta.id)
      expect(state.transactions[txMeta.id]).toBeUndefined()
    })

    it('should throw for non-existent transaction', async () => {
      await expect(controller.rejectTransaction('nonexistent')).rejects.toThrow(
        'Transaction not found'
      )
    })

    it('should emit transaction:rejected event', async () => {
      const handler = jest.fn()
      controller.on('transaction:rejected', handler)

      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.rejectTransaction(txMeta.id)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('signTransaction', () => {
    it('should sign an approved EOA transaction', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('signed')
      expect(updated?.rawTx).toBeDefined()
    })

    it('should throw if not approved', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await expect(controller.signTransaction(txMeta.id)).rejects.toThrow('must be approved')
    })

    it('should handle signing failure', async () => {
      const failOptions = createMockOptions({
        signTransaction: jest.fn().mockRejectedValue(new Error('User cancelled')),
      })
      const ctrl = new MultiModeTransactionController(failOptions)

      const txMeta = await ctrl.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await ctrl.approveTransaction(txMeta.id)

      await expect(ctrl.signTransaction(txMeta.id)).rejects.toThrow('User cancelled')

      // Transaction should be removed (failed state is terminal)
      const state = ctrl.getState()
      expect(state.transactions[txMeta.id]).toBeUndefined()
    })
  })

  describe('submitTransaction', () => {
    it('should submit a signed transaction', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('submitted')
      expect(updated?.hash).toBeDefined()
      expect(updated?.submittedTime).toBeDefined()
    })

    it('should throw if not signed', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)

      await expect(controller.submitTransaction(txMeta.id)).rejects.toThrow('must be signed')
    })

    it('should handle publish failure', async () => {
      const failOptions = createMockOptions({
        publishTransaction: jest.fn().mockRejectedValue(new Error('Nonce too low')),
      })
      const ctrl = new MultiModeTransactionController(failOptions)

      const txMeta = await ctrl.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await ctrl.approveTransaction(txMeta.id)
      await ctrl.signTransaction(txMeta.id)

      await expect(ctrl.submitTransaction(txMeta.id)).rejects.toThrow('Nonce too low')
    })
  })

  describe('confirmTransaction', () => {
    it('should confirm a submitted transaction', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)

      await controller.confirmTransaction(txMeta.id, {
        blockNumber: 12345,
        blockHash: ('0x' + 'ff'.repeat(32)) as Hex,
        gasUsed: 21000n,
      })

      const state = controller.getState()
      expect(state.confirmedTransactions).toContain(txMeta.id)
      expect(state.pendingTransactions).not.toContain(txMeta.id)
    })

    it('should throw for non-existent transaction', async () => {
      await expect(
        controller.confirmTransaction('nonexistent', {
          blockNumber: 1,
          blockHash: '0x00' as Hex,
          gasUsed: 0n,
        })
      ).rejects.toThrow('Transaction not found')
    })
  })

  describe('processTransaction (full lifecycle)', () => {
    it('should process through approve -> sign -> submit', async () => {
      const txMeta = await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      const hash = await controller.processTransaction(txMeta.id)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })
  })

  describe('query methods', () => {
    it('should get transactions by status', async () => {
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x3333333333333333333333333333333333333333' as Address },
        'https://dapp.com'
      )

      const unapproved = controller.getTransactionsByStatus('unapproved')
      expect(unapproved).toHaveLength(2)
    })

    it('should get transactions by origin', async () => {
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp1.com'
      )
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x3333333333333333333333333333333333333333' as Address },
        'https://dapp2.com'
      )

      const dapp1Txs = controller.getTransactionsForOrigin('https://dapp1.com')
      expect(dapp1Txs).toHaveLength(1)
    })
  })

  describe('event handling', () => {
    it('should subscribe and unsubscribe from events', async () => {
      const handler = jest.fn()
      controller.on('transaction:added', handler)

      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      expect(handler).toHaveBeenCalledTimes(1)

      controller.off('transaction:added', handler)

      await controller.addTransaction(
        { from: mockAccount.address, to: '0x3333333333333333333333333333333333333333' as Address },
        'https://dapp.com'
      )

      // Handler should not be called again after unsubscribe
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('immutable state patterns', () => {
    it('should create new state objects on updates', async () => {
      const stateBefore = controller.getState()

      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )

      const stateAfter = controller.getState()

      expect(stateBefore).not.toBe(stateAfter)
      expect(stateBefore.transactions).not.toBe(stateAfter.transactions)
      expect(stateBefore.pendingTransactions).not.toBe(stateAfter.pendingTransactions)
    })
  })

  describe('clearUnapprovedTransactions', () => {
    it('should reject all unapproved transactions', async () => {
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x2222222222222222222222222222222222222222' as Address },
        'https://dapp.com'
      )
      await controller.addTransaction(
        { from: mockAccount.address, to: '0x3333333333333333333333333333333333333333' as Address },
        'https://dapp.com'
      )

      await controller.clearUnapprovedTransactions()

      const unapproved = controller.getTransactionsByStatus('unapproved')
      expect(unapproved).toHaveLength(0)
    })
  })

  describe('updateConfig', () => {
    it('should update options and recreate router on chainId change', () => {
      controller.updateConfig({ chainId: 137 })

      // Router should be recreated
      const { createTransactionRouter } = jest.requireMock('@stablenet/core')
      expect(createTransactionRouter).toHaveBeenCalled()
    })
  })
})
