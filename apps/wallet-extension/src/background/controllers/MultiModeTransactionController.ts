/**
 * MultiModeTransactionController
 *
 * Extends transaction management with multi-mode support using SDK TransactionRouter.
 * Supports EOA, EIP-7702, and Smart Account transaction modes.
 *
 * Uses SDK's Strategy pattern for extensible transaction handling.
 */

import {
  type Account,
  type BundlerClient,
  createBundlerClient,
  createTransactionRouter,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  ENTRY_POINT_ADDRESS,
  type GasEstimate,
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  getUserOperationHash,
  type MultiModeTransactionRequest,
  TRANSACTION_MODE,
  type TransactionMode,
  type TransactionRouter,
  type UserOperation,
} from '@stablenet/core'
import { getEntryPoint, isChainSupported } from '@stablenet/contracts'
import type { Address, Hex } from 'viem'
import { createLogger } from '../../shared/utils/logger'
import type {
  ModeComparisonResult,
  MultiModeTransactionControllerOptions,
  MultiModeTransactionControllerState,
  MultiModeTransactionMeta,
  MultiModeTransactionParams,
  TransactionAccountInfo,
} from './multiModeTransactionController.types'
import type { TransactionStatus, TransactionType } from './transactionController.types'

const logger = createLogger('MultiModeTransactionController')

function resolveEntryPoint(chainId: number, explicit?: Address): Address {
  if (explicit) return explicit
  if (isChainSupported(chainId)) return getEntryPoint(chainId) as Address
  return ENTRY_POINT_ADDRESS as Address
}

type TransactionEventType =
  | 'transaction:added'
  | 'transaction:updated'
  | 'transaction:approved'
  | 'transaction:rejected'
  | 'transaction:signed'
  | 'transaction:submitted'
  | 'transaction:confirmed'
  | 'transaction:failed'
  | 'transaction:modeChanged'

type EventHandler = (transaction: MultiModeTransactionMeta, extra?: unknown) => void

interface ConfirmationReceipt {
  blockNumber: number
  blockHash: Hex
  gasUsed: bigint
  effectiveGasPrice?: bigint
}

/**
 * MultiModeTransactionController
 *
 * Manages multi-mode transaction lifecycle using SDK's TransactionRouter.
 * Provides unified interface for EOA, EIP-7702, and Smart Account transactions.
 */
export class MultiModeTransactionController {
  private state: MultiModeTransactionControllerState
  private options: MultiModeTransactionControllerOptions
  private eventHandlers: Map<TransactionEventType, Set<EventHandler>>
  private router: TransactionRouter
  private bundlerClient: BundlerClient | null

  constructor(options: MultiModeTransactionControllerOptions) {
    this.options = options
    this.state = {
      transactions: {},
      pendingTransactions: [],
      confirmedTransactions: [],
    }
    this.eventHandlers = new Map()

    // Initialize SDK TransactionRouter
    this.router = createTransactionRouter({
      rpcUrl: options.rpcUrl,
      chainId: options.chainId,
      bundlerUrl: options.bundlerUrl,
      paymasterUrl: options.paymasterUrl,
      entryPointAddress: options.entryPointAddress,
    })

    // Initialize bundler client for Smart Account UserOp submission
    this.bundlerClient = options.bundlerUrl
      ? createBundlerClient({
          url: options.bundlerUrl,
          entryPoint: resolveEntryPoint(options.chainId, options.entryPointAddress),
          chainId: BigInt(options.chainId),
        })
      : null

    logger.debug('MultiModeTransactionController initialized', {
      chainId: options.chainId,
      supportedModes: this.router.getSupportedModes(),
    })
  }

  // ============================================
  // Transaction Lifecycle
  // ============================================

  /**
   * Add a new multi-mode transaction
   */
  async addTransaction(
    txParams: MultiModeTransactionParams,
    origin: string
  ): Promise<MultiModeTransactionMeta> {
    const id = this.generateId()
    const account = this.options.getSelectedAccount()

    if (!account) {
      throw new Error('No account selected')
    }

    // Convert to SDK Account type
    const sdkAccount = this.toSDKAccount(account)

    // Resolve transaction mode
    const mode = txParams.mode ?? getDefaultTransactionMode(sdkAccount)

    // Build SDK request
    const sdkRequest = this.toSDKRequest(txParams, mode)

    // Get gas estimate from SDK router
    let gasEstimate: GasEstimate
    try {
      const prepared = await this.router.prepare(sdkRequest, sdkAccount)
      gasEstimate = prepared.gasEstimate
    } catch (error) {
      logger.warn('Gas estimation failed, using defaults', { error })
      gasEstimate = {
        gasLimit: 21000n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        estimatedCost: 0n,
      }
    }

    const type = this.detectTransactionType(txParams)

    const txMeta: MultiModeTransactionMeta = {
      id,
      chainId: this.options.chainId,
      status: 'unapproved',
      type,
      mode,
      time: Date.now(),
      origin,
      txParams,
      gasEstimate,
    }

    this.state.transactions[id] = txMeta
    this.state.pendingTransactions.push(id)

    this.emit('transaction:added', txMeta)

    logger.debug('Transaction added', { id, mode, type })

    return txMeta
  }

  /**
   * Change transaction mode before approval
   */
  async changeTransactionMode(
    id: string,
    newMode: TransactionMode
  ): Promise<MultiModeTransactionMeta> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'unapproved') {
      throw new Error('Can only change mode for unapproved transactions')
    }

    const account = this.options.getSelectedAccount()
    if (!account) {
      throw new Error('No account selected')
    }

    const sdkAccount = this.toSDKAccount(account)
    const availableModes = getAvailableTransactionModes(sdkAccount)

    if (!availableModes.includes(newMode)) {
      throw new Error(`Mode '${newMode}' is not available for this account`)
    }

    const previousMode = txMeta.mode

    // Re-estimate gas for new mode
    const sdkRequest = this.toSDKRequest(txMeta.txParams, newMode)
    let gasEstimate: GasEstimate

    try {
      const prepared = await this.router.prepare(sdkRequest, sdkAccount)
      gasEstimate = prepared.gasEstimate
    } catch (error) {
      throw new Error(`Failed to prepare transaction for mode '${newMode}': ${error}`)
    }

    const updated: MultiModeTransactionMeta = {
      ...txMeta,
      mode: newMode,
      gasEstimate,
      txParams: { ...txMeta.txParams, mode: newMode },
    }

    this.updateTransaction(updated)
    this.emit('transaction:modeChanged', updated, previousMode)

    logger.debug('Transaction mode changed', { id, previousMode, newMode })

    return updated
  }

  /**
   * Get available modes with gas estimates for comparison
   */
  async getAvailableModesForTransaction(id: string): Promise<ModeComparisonResult[]> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    const account = this.options.getSelectedAccount()
    if (!account) {
      throw new Error('No account selected')
    }

    const sdkAccount = this.toSDKAccount(account)
    const baseRequest = {
      from: txMeta.txParams.from,
      to: txMeta.txParams.to ?? ('0x0000000000000000000000000000000000000000' as Address),
      value: txMeta.txParams.value ?? 0n,
      data: txMeta.txParams.data ?? '0x',
      gasPayment: txMeta.txParams.gasPayment,
    }

    const modesWithEstimates = await this.router.getAvailableModesWithEstimates(
      baseRequest,
      sdkAccount
    )

    // Find EOA estimate for savings calculation
    const eoaEstimate = modesWithEstimates.find((m) => m.mode === 'eoa')?.estimate

    return modesWithEstimates.map((result) => {
      const savings =
        eoaEstimate && result.estimate && result.mode !== 'eoa'
          ? {
              vsEOA: eoaEstimate.estimatedCost - result.estimate.estimatedCost,
              percentage:
                eoaEstimate.estimatedCost > 0n
                  ? Number(
                      ((eoaEstimate.estimatedCost - result.estimate.estimatedCost) * 100n) /
                        eoaEstimate.estimatedCost
                    )
                  : 0,
            }
          : undefined

      return {
        mode: result.mode,
        available: result.available,
        estimate: result.estimate,
        savings,
        features: this.getModeFeatures(result.mode),
      }
    })
  }

  /**
   * Approve a transaction for signing
   */
  async approveTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'unapproved') {
      throw new Error(`Cannot approve transaction with status: ${txMeta.status}`)
    }

    const updated: MultiModeTransactionMeta = {
      ...txMeta,
      status: 'approved',
    }

    this.updateTransaction(updated)
    this.emit('transaction:approved', updated)

    logger.debug('Transaction approved', { id, mode: txMeta.mode })
  }

  /**
   * Reject a transaction
   */
  async rejectTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    const updated: MultiModeTransactionMeta = {
      ...txMeta,
      status: 'rejected',
    }

    this.updateTransaction(updated)
    this.removeFromPending(id)
    this.emit('transaction:rejected', updated)

    logger.debug('Transaction rejected', { id })
  }

  /**
   * Sign an approved transaction
   */
  async signTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'approved') {
      throw new Error('Transaction must be approved before signing')
    }

    try {
      let rawTx: Hex | undefined
      let userOpHash: Hex | undefined
      let authorizationHash: Hex | undefined

      switch (txMeta.mode) {
        case TRANSACTION_MODE.EOA:
          rawTx = await this.options.signTransaction(txMeta.txParams.from, txMeta.txParams)
          break

        case TRANSACTION_MODE.EIP7702:
          // Sign both authorization and transaction
          if (txMeta.txParams.delegateTo) {
            const authResult = await this.options.signAuthorization(
              txMeta.txParams.from,
              txMeta.txParams.delegateTo as Hex
            )
            authorizationHash =
              `0x${authResult.r.slice(2)}${authResult.s.slice(2)}${authResult.v.toString(16).padStart(2, '0')}` as Hex
          }
          rawTx = await this.options.signTransaction(txMeta.txParams.from, txMeta.txParams)
          break

        case TRANSACTION_MODE.SMART_ACCOUNT: {
          // For Smart Account, we sign the UserOperation hash
          // The actual UserOp is built by the SDK strategy
          userOpHash = await this.buildUserOpHash(txMeta)
          const signature = await this.options.signUserOperation(txMeta.txParams.from, userOpHash)
          // Store signature in rawTx for now
          rawTx = signature
          break
        }

        default:
          throw new Error(`Unsupported transaction mode: ${txMeta.mode}`)
      }

      const updated: MultiModeTransactionMeta = {
        ...txMeta,
        status: 'signed',
        rawTx,
        userOpHash,
        authorizationHash,
      }

      this.updateTransaction(updated)
      this.emit('transaction:signed', updated)

      logger.debug('Transaction signed', { id, mode: txMeta.mode })
    } catch (error) {
      const failed: MultiModeTransactionMeta = {
        ...txMeta,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Signing failed',
        },
      }
      this.updateTransaction(failed)
      this.emit('transaction:failed', failed)
      throw error
    }
  }

  /**
   * Submit a signed transaction to the network
   */
  async submitTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'signed') {
      throw new Error('Transaction must be signed before submitting')
    }

    try {
      let hash: Hex

      switch (txMeta.mode) {
        case TRANSACTION_MODE.EOA:
        case TRANSACTION_MODE.EIP7702:
          if (!txMeta.rawTx) {
            throw new Error('No signed transaction found')
          }
          hash = await this.options.publishTransaction(txMeta.rawTx)
          break

        case TRANSACTION_MODE.SMART_ACCOUNT:
          // For Smart Account, submit UserOperation to bundler
          // This would typically be handled by the SDK's bundler client
          hash = await this.submitUserOperation(txMeta)
          break

        default:
          throw new Error(`Unsupported transaction mode: ${txMeta.mode}`)
      }

      const updated: MultiModeTransactionMeta = {
        ...txMeta,
        status: 'submitted',
        hash,
        submittedTime: Date.now(),
      }

      this.updateTransaction(updated)
      this.emit('transaction:submitted', updated)

      logger.debug('Transaction submitted', { id, mode: txMeta.mode, hash })
    } catch (error) {
      const failed: MultiModeTransactionMeta = {
        ...txMeta,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Broadcast failed',
        },
      }
      this.updateTransaction(failed)
      this.emit('transaction:failed', failed)
      throw error
    }
  }

  /**
   * Confirm a submitted transaction
   */
  async confirmTransaction(id: string, receipt: ConfirmationReceipt): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    const updated: MultiModeTransactionMeta = {
      ...txMeta,
      status: 'confirmed',
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      confirmedTime: Date.now(),
    }

    this.updateTransaction(updated)
    this.removeFromPending(id)
    this.state.confirmedTransactions.push(id)
    this.emit('transaction:confirmed', updated)

    logger.debug('Transaction confirmed', { id, blockNumber: receipt.blockNumber })
  }

  /**
   * Process a transaction through the full lifecycle
   */
  async processTransaction(id: string): Promise<Hex> {
    await this.approveTransaction(id)
    await this.signTransaction(id)
    await this.submitTransaction(id)

    const txMeta = this.getTransaction(id)
    if (!txMeta?.hash) {
      throw new Error('Transaction hash not found after submission')
    }

    return txMeta.hash
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get a transaction by ID
   */
  getTransaction(id: string): MultiModeTransactionMeta | undefined {
    return this.state.transactions[id]
  }

  /**
   * Get transactions filtered by status
   */
  getTransactionsByStatus(status: TransactionStatus): MultiModeTransactionMeta[] {
    return Object.values(this.state.transactions).filter((tx) => tx.status === status)
  }

  /**
   * Get transactions filtered by mode
   */
  getTransactionsByMode(mode: TransactionMode): MultiModeTransactionMeta[] {
    return Object.values(this.state.transactions).filter((tx) => tx.mode === mode)
  }

  /**
   * Get transactions filtered by origin
   */
  getTransactionsForOrigin(origin: string): MultiModeTransactionMeta[] {
    return Object.values(this.state.transactions).filter((tx) => tx.origin === origin)
  }

  /**
   * Get the current state
   */
  getState(): MultiModeTransactionControllerState {
    return { ...this.state }
  }

  /**
   * Get supported transaction modes
   */
  getSupportedModes(): TransactionMode[] {
    return this.router.getSupportedModes()
  }

  /**
   * Check if a mode is supported
   */
  isModeSupported(mode: TransactionMode): boolean {
    return this.router.isSupported(mode)
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Update configuration (e.g., when network changes)
   */
  updateConfig(config: Partial<MultiModeTransactionControllerOptions>): void {
    this.options = { ...this.options, ...config }

    // Recreate router and bundler client with new config
    if (config.chainId || config.rpcUrl || config.bundlerUrl || config.paymasterUrl) {
      this.router = createTransactionRouter({
        rpcUrl: this.options.rpcUrl,
        chainId: this.options.chainId,
        bundlerUrl: this.options.bundlerUrl,
        paymasterUrl: this.options.paymasterUrl,
        entryPointAddress: this.options.entryPointAddress,
      })

      this.bundlerClient = this.options.bundlerUrl
        ? createBundlerClient({
            url: this.options.bundlerUrl,
            entryPoint: resolveEntryPoint(this.options.chainId, this.options.entryPointAddress),
            chainId: BigInt(this.options.chainId),
          })
        : null

      logger.debug('TransactionRouter reconfigured', {
        chainId: this.options.chainId,
        supportedModes: this.router.getSupportedModes(),
      })
    }
  }

  /**
   * Clear all unapproved transactions
   */
  async clearUnapprovedTransactions(): Promise<void> {
    const unapproved = this.getTransactionsByStatus('unapproved')
    for (const tx of unapproved) {
      await this.rejectTransaction(tx.id)
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Subscribe to transaction events
   */
  on(event: TransactionEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Unsubscribe from transaction events
   */
  off(event: TransactionEventType, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  // ============================================
  // Accessors
  // ============================================

  /**
   * Get the SDK TransactionRouter instance
   */
  getRouter(): TransactionRouter {
    return this.router
  }

  // ============================================
  // Private Methods
  // ============================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private detectTransactionType(txParams: MultiModeTransactionParams): TransactionType {
    // Contract deployment: no 'to' address with data
    if (!txParams.to && txParams.data) {
      return 'contractDeployment'
    }

    // Contract interaction: has data
    if (txParams.data && txParams.data !== '0x') {
      return 'contractInteraction'
    }

    return 'standard'
  }

  private toSDKAccount(account: TransactionAccountInfo): Account {
    return {
      address: account.address,
      name: `Account ${account.address.slice(0, 6)}`, // Generate display name
      type: account.type,
      delegateAddress: account.delegateTo,
      isDeployed: account.isDelegated,
    }
  }

  private toSDKRequest(
    txParams: MultiModeTransactionParams,
    mode: TransactionMode
  ): MultiModeTransactionRequest {
    return {
      mode,
      from: txParams.from,
      to: txParams.to ?? ('0x0000000000000000000000000000000000000000' as Address),
      value: txParams.value ?? 0n,
      data: txParams.data ?? '0x',
      gasPayment: txParams.gasPayment,
    }
  }

  private getModeFeatures(mode: TransactionMode): string[] {
    switch (mode) {
      case TRANSACTION_MODE.EOA:
        return ['Simple', 'Fastest', 'Most compatible']
      case TRANSACTION_MODE.EIP7702:
        return ['Batched transactions', 'Sponsored gas', 'Session keys']
      case TRANSACTION_MODE.SMART_ACCOUNT:
        return ['Batched transactions', 'Sponsored gas', 'Social recovery', 'Spending limits']
      default:
        return []
    }
  }

  private async buildUserOpHash(txMeta: MultiModeTransactionMeta): Promise<Hex> {
    const account = this.options.getSelectedAccount()
    if (!account) {
      throw new Error('No account selected')
    }

    const sdkAccount = this.toSDKAccount(account)
    const sdkRequest = this.toSDKRequest(txMeta.txParams, txMeta.mode)
    const prepared = await this.router.prepare(sdkRequest, sdkAccount)

    // Extract the partial UserOp from the strategy's prepared data
    const strategyData = prepared.strategyData as { userOp: Partial<UserOperation> } | undefined
    if (!strategyData?.userOp) {
      throw new Error('Strategy did not produce UserOperation data')
    }

    const partialUserOp = strategyData.userOp

    // Build a full UserOperation with defaults for missing fields
    const userOp: UserOperation = {
      sender: partialUserOp.sender ?? txMeta.txParams.from,
      nonce: partialUserOp.nonce ?? 0n,
      callData: partialUserOp.callData ?? (txMeta.txParams.data as Hex) ?? '0x',
      callGasLimit:
        partialUserOp.callGasLimit ?? prepared.gasEstimate.callGasLimit ?? DEFAULT_CALL_GAS_LIMIT,
      verificationGasLimit:
        partialUserOp.verificationGasLimit ??
        prepared.gasEstimate.verificationGasLimit ??
        DEFAULT_VERIFICATION_GAS_LIMIT,
      preVerificationGas:
        partialUserOp.preVerificationGas ??
        prepared.gasEstimate.preVerificationGas ??
        DEFAULT_PRE_VERIFICATION_GAS,
      maxFeePerGas: partialUserOp.maxFeePerGas ?? prepared.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas:
        partialUserOp.maxPriorityFeePerGas ?? prepared.gasEstimate.maxPriorityFeePerGas,
      signature: '0x' as Hex,
    }

    // Add optional fields if present
    if (partialUserOp.factory) userOp.factory = partialUserOp.factory
    if (partialUserOp.factoryData) userOp.factoryData = partialUserOp.factoryData
    if (partialUserOp.paymaster) userOp.paymaster = partialUserOp.paymaster
    if (partialUserOp.paymasterData) userOp.paymasterData = partialUserOp.paymasterData
    if (partialUserOp.paymasterVerificationGasLimit)
      userOp.paymasterVerificationGasLimit = partialUserOp.paymasterVerificationGasLimit
    if (partialUserOp.paymasterPostOpGasLimit)
      userOp.paymasterPostOpGasLimit = partialUserOp.paymasterPostOpGasLimit

    const entryPoint = resolveEntryPoint(this.options.chainId, this.options.entryPointAddress)
    return getUserOperationHash(userOp, entryPoint, BigInt(this.options.chainId))
  }

  private async submitUserOperation(txMeta: MultiModeTransactionMeta): Promise<Hex> {
    if (!txMeta.rawTx) {
      throw new Error('No signed UserOperation found')
    }

    // If bundler client is available, submit via ERC-4337 bundler
    if (this.bundlerClient) {
      const account = this.options.getSelectedAccount()
      if (!account) {
        throw new Error('No account selected')
      }

      const sdkAccount = this.toSDKAccount(account)
      const sdkRequest = this.toSDKRequest(txMeta.txParams, txMeta.mode)
      const prepared = await this.router.prepare(sdkRequest, sdkAccount)

      const strategyData = prepared.strategyData as { userOp: Partial<UserOperation> } | undefined
      if (!strategyData?.userOp) {
        throw new Error('Strategy did not produce UserOperation data')
      }

      const partialUserOp = strategyData.userOp

      // Build full UserOperation with the signed signature
      const userOp: UserOperation = {
        sender: partialUserOp.sender ?? txMeta.txParams.from,
        nonce: partialUserOp.nonce ?? 0n,
        callData: partialUserOp.callData ?? (txMeta.txParams.data as Hex) ?? '0x',
        callGasLimit:
          partialUserOp.callGasLimit ?? prepared.gasEstimate.callGasLimit ?? DEFAULT_CALL_GAS_LIMIT,
        verificationGasLimit:
          partialUserOp.verificationGasLimit ??
          prepared.gasEstimate.verificationGasLimit ??
          DEFAULT_VERIFICATION_GAS_LIMIT,
        preVerificationGas:
          partialUserOp.preVerificationGas ??
          prepared.gasEstimate.preVerificationGas ??
          DEFAULT_PRE_VERIFICATION_GAS,
        maxFeePerGas: partialUserOp.maxFeePerGas ?? prepared.gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas:
          partialUserOp.maxPriorityFeePerGas ?? prepared.gasEstimate.maxPriorityFeePerGas,
        signature: txMeta.rawTx, // The signed signature from signTransaction step
      }

      // Add optional paymaster fields
      if (partialUserOp.paymaster) userOp.paymaster = partialUserOp.paymaster
      if (partialUserOp.paymasterData) userOp.paymasterData = partialUserOp.paymasterData
      if (partialUserOp.paymasterVerificationGasLimit)
        userOp.paymasterVerificationGasLimit = partialUserOp.paymasterVerificationGasLimit
      if (partialUserOp.paymasterPostOpGasLimit)
        userOp.paymasterPostOpGasLimit = partialUserOp.paymasterPostOpGasLimit

      return this.bundlerClient.sendUserOperation(userOp)
    }

    // Fallback: publish as standard transaction if no bundler configured
    logger.warn('No bundler client configured, falling back to standard publish for UserOp')
    return this.options.publishTransaction(txMeta.rawTx)
  }

  private updateTransaction(txMeta: MultiModeTransactionMeta): void {
    this.state.transactions[txMeta.id] = txMeta
    this.emit('transaction:updated', txMeta)
  }

  private removeFromPending(id: string): void {
    const index = this.state.pendingTransactions.indexOf(id)
    if (index > -1) {
      this.state.pendingTransactions.splice(index, 1)
    }
  }

  private emit(
    event: TransactionEventType,
    transaction: MultiModeTransactionMeta,
    extra?: unknown
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(transaction, extra)
      }
    }
  }
}
