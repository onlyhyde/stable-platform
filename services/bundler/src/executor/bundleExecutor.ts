import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { concat, encodeFunctionData, pad, toHex } from 'viem'
import type { MempoolEntry, UserOperation } from '../types'
import type { Mempool } from '../mempool/mempool'
import type { Logger } from '../utils/logger'

/**
 * EntryPoint v0.7 ABI for handleOps
 */
const ENTRY_POINT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
        name: 'ops',
        type: 'tuple[]',
      },
      { name: 'beneficiary', type: 'address' },
    ],
    name: 'handleOps',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * Bundle executor configuration
 */
export interface BundleExecutorConfig {
  entryPoint: Address
  beneficiary: Address
  maxBundleSize: number
  bundleInterval: number
}

/**
 * Bundle executor for submitting UserOperations to EntryPoint
 */
export class BundleExecutor {
  private publicClient: PublicClient
  private walletClient: WalletClient
  private mempool: Mempool
  private config: BundleExecutorConfig
  private logger: Logger
  private bundleTimer: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    mempool: Mempool,
    config: BundleExecutorConfig,
    logger: Logger
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.mempool = mempool
    this.config = config
    this.logger = logger.child({ module: 'executor' })
  }

  /**
   * Start the bundle executor
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.bundleTimer = setInterval(() => {
      this.tryBundle().catch((err) => {
        this.logger.error({ err }, 'Bundle execution failed')
      })
    }, this.config.bundleInterval)

    this.logger.info(
      { interval: this.config.bundleInterval },
      'Bundle executor started'
    )
  }

  /**
   * Stop the bundle executor
   */
  stop(): void {
    if (this.bundleTimer) {
      clearInterval(this.bundleTimer)
      this.bundleTimer = null
    }
    this.isRunning = false
    this.logger.info('Bundle executor stopped')
  }

  /**
   * Try to create and submit a bundle
   */
  async tryBundle(): Promise<Hex | null> {
    const pending = this.mempool.getPending(
      this.config.entryPoint,
      this.config.maxBundleSize
    )

    if (pending.length === 0) {
      return null
    }

    this.logger.debug(
      { count: pending.length },
      'Creating bundle from pending operations'
    )

    return this.submitBundle(pending)
  }

  /**
   * Submit a bundle of UserOperations
   */
  async submitBundle(entries: MempoolEntry[]): Promise<Hex> {
    const userOps = entries.map((e) => e.userOp)

    // Pack UserOperations for EntryPoint
    const packedOps = userOps.map((op) => this.packUserOp(op))

    // Encode handleOps call
    const data = encodeFunctionData({
      abi: ENTRY_POINT_ABI,
      functionName: 'handleOps',
      args: [packedOps, this.config.beneficiary],
    })

    // Mark operations as submitted
    for (const entry of entries) {
      this.mempool.updateStatus(entry.userOpHash, 'submitted')
    }

    try {
      // Estimate gas for the bundle
      const gasEstimate = await this.publicClient.estimateGas({
        account: this.walletClient.account!,
        to: this.config.entryPoint,
        data,
      })

      // Add 20% buffer
      const gasLimit = (gasEstimate * 120n) / 100n

      // Submit transaction
      const hash = await this.walletClient.sendTransaction({
        account: this.walletClient.account!,
        chain: this.walletClient.chain,
        to: this.config.entryPoint,
        data,
        gas: gasLimit,
      })

      this.logger.info(
        { hash, opCount: entries.length },
        'Bundle submitted successfully'
      )

      // Update transaction hash for all operations
      for (const entry of entries) {
        this.mempool.updateStatus(entry.userOpHash, 'submitted', hash)
      }

      // Wait for receipt and update status
      this.waitForReceipt(hash, entries).catch((err) => {
        this.logger.error({ err, hash }, 'Failed to get bundle receipt')
      })

      return hash
    } catch (error) {
      this.logger.error({ error }, 'Bundle submission failed')

      // Mark operations as failed
      for (const entry of entries) {
        this.mempool.updateStatus(
          entry.userOpHash,
          'failed',
          undefined,
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }

      throw error
    }
  }

  /**
   * Wait for bundle transaction receipt and update statuses
   */
  private async waitForReceipt(
    hash: Hex,
    entries: MempoolEntry[]
  ): Promise<void> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60000,
      })

      const status = receipt.status === 'success' ? 'included' : 'failed'
      const blockNumber = receipt.blockNumber

      for (const entry of entries) {
        this.mempool.updateStatus(
          entry.userOpHash,
          status,
          hash,
          blockNumber,
          status === 'failed' ? 'Transaction reverted' : undefined
        )
      }

      this.logger.info(
        { hash, status, blockNumber: blockNumber.toString() },
        'Bundle confirmed'
      )
    } catch (error) {
      this.logger.error({ error, hash }, 'Failed to get transaction receipt')
    }
  }

  /**
   * Pack a UserOperation for EntryPoint v0.7
   */
  private packUserOp(userOp: UserOperation): {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    accountGasLimits: Hex
    preVerificationGas: bigint
    gasFees: Hex
    paymasterAndData: Hex
    signature: Hex
  } {
    // Build initCode
    const initCode =
      userOp.factory && userOp.factoryData
        ? concat([userOp.factory, userOp.factoryData])
        : '0x'

    // Build accountGasLimits (verificationGasLimit + callGasLimit)
    const accountGasLimits = concat([
      pad(toHex(userOp.verificationGasLimit), { size: 16 }),
      pad(toHex(userOp.callGasLimit), { size: 16 }),
    ]) as Hex

    // Build gasFees (maxPriorityFeePerGas + maxFeePerGas)
    const gasFees = concat([
      pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
      pad(toHex(userOp.maxFeePerGas), { size: 16 }),
    ]) as Hex

    // Build paymasterAndData
    let paymasterAndData: Hex = '0x'
    if (userOp.paymaster) {
      paymasterAndData = concat([
        userOp.paymaster,
        pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
        pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
        userOp.paymasterData ?? '0x',
      ]) as Hex
    }

    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode,
      callData: userOp.callData,
      accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: userOp.signature,
    }
  }
}
