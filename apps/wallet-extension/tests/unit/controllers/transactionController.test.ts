/**
 * TransactionController Tests
 * TDD tests for transaction lifecycle management
 */

import type { Hex } from 'viem'
import { TransactionController } from '../../../src/background/controllers/transactionController'
import type {
  TransactionControllerOptions,
  TransactionParams,
} from '../../../src/background/controllers/transactionController.types'
import { TEST_ACCOUNTS, TEST_CHAIN_IDS, TEST_ORIGINS } from '../../utils/testUtils'

describe('TransactionController', () => {
  let controller: TransactionController
  let mockOptions: TransactionControllerOptions
  const testAddress = TEST_ACCOUNTS.account1.address
  const testToAddress = TEST_ACCOUNTS.account2.address
  const testOrigin = TEST_ORIGINS.trusted

  beforeEach(() => {
    mockOptions = {
      chainId: TEST_CHAIN_IDS.mainnet,
      getSelectedAddress: jest.fn(() => testAddress),
      signTransaction: jest.fn(() => Promise.resolve(('0x' + '1'.repeat(200)) as Hex)),
      publishTransaction: jest.fn(() => Promise.resolve(('0x' + '2'.repeat(64)) as Hex)),
      getTransactionCount: jest.fn(() => Promise.resolve(0)),
      estimateGas: jest.fn(() => Promise.resolve(BigInt(21000))),
      getGasPrice: jest.fn(() => Promise.resolve(BigInt(20000000000))),
    }

    controller = new TransactionController(mockOptions)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('addTransaction', () => {
    it('should create transaction with unapproved status', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000), // 1 ETH
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      expect(txMeta.status).toBe('unapproved')
      expect(txMeta.txParams.from).toBe(testAddress)
      expect(txMeta.txParams.to).toBe(testToAddress)
      expect(txMeta.origin).toBe(testOrigin)
    })

    it('should generate unique transaction ID', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const tx1 = await controller.addTransaction(txParams, testOrigin)
      const tx2 = await controller.addTransaction(txParams, testOrigin)

      expect(tx1.id).not.toBe(tx2.id)
    })

    it('should emit transaction:added event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:added', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      await controller.addTransaction(txParams, testOrigin)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unapproved',
        })
      )
    })

    it('should estimate gas if not provided', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      expect(mockOptions.estimateGas).toHaveBeenCalled()
      expect(txMeta.gasFeeEstimates?.gasLimit).toBe(BigInt(21000))
    })

    it('should use provided gas value', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
        gas: BigInt(50000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      expect(txMeta.txParams.gas).toBe(BigInt(50000))
    })

    it('should detect contract deployment', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        data: '0x60806040' as Hex, // Contract bytecode
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      expect(txMeta.type).toBe('contractDeployment')
    })

    it('should detect contract interaction', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        data: '0xa9059cbb' as Hex, // transfer function selector
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      expect(txMeta.type).toBe('contractInteraction')
    })

    it('should add to pending transactions list', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      const state = controller.getState()

      expect(state.pendingTransactions).toContain(txMeta.id)
    })
  })

  describe('approveTransaction', () => {
    it('should change status to approved', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('approved')
    })

    it('should emit transaction:approved event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:approved', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: txMeta.id,
          status: 'approved',
        })
      )
    })

    it('should throw if transaction not found', async () => {
      await expect(controller.approveTransaction('nonexistent')).rejects.toThrow(
        'Transaction not found'
      )
    })

    it('should throw if transaction already processed', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)

      await expect(controller.approveTransaction(txMeta.id)).rejects.toThrow()
    })
  })

  describe('rejectTransaction', () => {
    it('should change status to rejected', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.rejectTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('rejected')
    })

    it('should emit transaction:rejected event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:rejected', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.rejectTransaction(txMeta.id)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: txMeta.id,
          status: 'rejected',
        })
      )
    })

    it('should remove from pending transactions', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.rejectTransaction(txMeta.id)

      const state = controller.getState()
      expect(state.pendingTransactions).not.toContain(txMeta.id)
    })
  })

  describe('signTransaction', () => {
    it('should sign approved transaction', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)

      expect(mockOptions.signTransaction).toHaveBeenCalled()
      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('signed')
      expect(updated?.rawTx).toBeDefined()
    })

    it('should emit transaction:signed event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:signed', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: txMeta.id,
          status: 'signed',
        })
      )
    })

    it('should throw if transaction not approved', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)

      await expect(controller.signTransaction(txMeta.id)).rejects.toThrow(
        'Transaction must be approved before signing'
      )
    })

    it('should handle signing errors', async () => {
      mockOptions.signTransaction = jest.fn(() => Promise.reject(new Error('Signing failed')))
      controller = new TransactionController(mockOptions)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)

      await expect(controller.signTransaction(txMeta.id)).rejects.toThrow('Signing failed')

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('failed')
    })
  })

  describe('submitTransaction', () => {
    it('should broadcast signed transaction', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)

      expect(mockOptions.publishTransaction).toHaveBeenCalled()
      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('submitted')
      expect(updated?.hash).toBeDefined()
    })

    it('should emit transaction:submitted event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:submitted', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: txMeta.id,
          status: 'submitted',
        })
      )
    })

    it('should record submitted time', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.submittedTime).toBeDefined()
    })

    it('should handle broadcast errors', async () => {
      mockOptions.publishTransaction = jest.fn(() => Promise.reject(new Error('Broadcast failed')))
      controller = new TransactionController(mockOptions)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)

      await expect(controller.submitTransaction(txMeta.id)).rejects.toThrow('Broadcast failed')

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('failed')
    })
  })

  describe('confirmTransaction', () => {
    it('should update status to confirmed', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)
      await controller.confirmTransaction(txMeta.id, {
        blockNumber: 12345,
        blockHash: ('0x' + '3'.repeat(64)) as Hex,
        gasUsed: BigInt(21000),
      })

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('confirmed')
      expect(updated?.blockNumber).toBe(12345)
    })

    it('should emit transaction:confirmed event', async () => {
      const eventHandler = jest.fn()
      controller.on('transaction:confirmed', eventHandler)

      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)
      await controller.confirmTransaction(txMeta.id, {
        blockNumber: 12345,
        blockHash: ('0x' + '3'.repeat(64)) as Hex,
        gasUsed: BigInt(21000),
      })

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: txMeta.id,
          status: 'confirmed',
        })
      )
    })

    it('should move to confirmed transactions list', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)
      await controller.confirmTransaction(txMeta.id, {
        blockNumber: 12345,
        blockHash: ('0x' + '3'.repeat(64)) as Hex,
        gasUsed: BigInt(21000),
      })

      const state = controller.getState()
      expect(state.pendingTransactions).not.toContain(txMeta.id)
      expect(state.confirmedTransactions).toContain(txMeta.id)
    })

    it('should record confirmed time', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      await controller.approveTransaction(txMeta.id)
      await controller.signTransaction(txMeta.id)
      await controller.submitTransaction(txMeta.id)
      await controller.confirmTransaction(txMeta.id, {
        blockNumber: 12345,
        blockHash: ('0x' + '3'.repeat(64)) as Hex,
        gasUsed: BigInt(21000),
      })

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.confirmedTime).toBeDefined()
    })
  })

  describe('getTransaction', () => {
    it('should return transaction by id', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      const retrieved = controller.getTransaction(txMeta.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(txMeta.id)
    })

    it('should return undefined for nonexistent transaction', () => {
      const retrieved = controller.getTransaction('nonexistent')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('getTransactionsByStatus', () => {
    it('should return transactions filtered by status', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      await controller.addTransaction(txParams, testOrigin)
      await controller.addTransaction(txParams, testOrigin)

      const unapproved = controller.getTransactionsByStatus('unapproved')
      expect(unapproved.length).toBe(2)
    })
  })

  describe('getTransactionsForOrigin', () => {
    it('should return transactions filtered by origin', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      await controller.addTransaction(txParams, testOrigin)
      await controller.addTransaction(txParams, TEST_ORIGINS.untrusted)

      const transactions = controller.getTransactionsForOrigin(testOrigin)
      expect(transactions.length).toBe(1)
      expect(transactions[0].origin).toBe(testOrigin)
    })
  })

  describe('clearUnapprovedTransactions', () => {
    it('should reject all unapproved transactions', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const tx1 = await controller.addTransaction(txParams, testOrigin)
      const tx2 = await controller.addTransaction(txParams, testOrigin)

      await controller.clearUnapprovedTransactions()

      expect(controller.getTransaction(tx1.id)?.status).toBe('rejected')
      expect(controller.getTransaction(tx2.id)?.status).toBe('rejected')
    })
  })

  describe('processTransaction', () => {
    it('should process transaction through full lifecycle', async () => {
      const txParams: TransactionParams = {
        from: testAddress,
        to: testToAddress,
        value: BigInt(1000000000000000000),
      }

      const txMeta = await controller.addTransaction(txParams, testOrigin)
      const hash = await controller.processTransaction(txMeta.id)

      expect(hash).toBeDefined()
      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      const updated = controller.getTransaction(txMeta.id)
      expect(updated?.status).toBe('submitted')
    })
  })
})
