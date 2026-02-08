import type { Address, Hex, PublicClient } from 'viem'
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import { NATIVE_TOKEN } from './constants'
import type { CreateScheduleParams, PaymentSchedule, RecurringPaymentExecutorConfig } from './types'
import { RECURRING_PAYMENT_EXECUTOR_ABI } from './types'

/**
 * RecurringPaymentExecutor client
 *
 * Provides methods to interact with the RecurringPaymentExecutor ERC-7579 module
 * for creating, managing, and executing recurring payment schedules.
 */
export interface RecurringPaymentExecutorClient {
  /** The executor contract address */
  readonly executorAddress: Address

  // ---- Write encoders ----

  /** Encode calldata to create a new payment schedule */
  encodeCreateSchedule: (params: CreateScheduleParams) => Hex
  /** Encode calldata to cancel a payment schedule */
  encodeCancelSchedule: (scheduleId: bigint) => Hex
  /** Encode calldata to update payment amount */
  encodeUpdateAmount: (scheduleId: bigint, newAmount: bigint) => Hex
  /** Encode calldata to update payment recipient */
  encodeUpdateRecipient: (scheduleId: bigint, newRecipient: Address) => Hex
  /** Encode calldata to execute a due payment */
  encodeExecutePayment: (account: Address, scheduleId: bigint) => Hex
  /** Encode calldata to batch execute payments */
  encodeExecutePaymentBatch: (account: Address, scheduleIds: readonly bigint[]) => Hex
  /** Encode install data for ERC-7579 module installation with initial schedule */
  encodeInstallData: (params: CreateScheduleParams) => Hex

  // ---- Read functions ----

  /** Get a payment schedule */
  getSchedule: (
    client: PublicClient,
    account: Address,
    scheduleId: bigint
  ) => Promise<PaymentSchedule>
  /** Get all active schedule IDs for an account */
  getActiveSchedules: (client: PublicClient, account: Address) => Promise<bigint[]>
  /** Check if a payment is due */
  isPaymentDue: (client: PublicClient, account: Address, scheduleId: bigint) => Promise<boolean>
  /** Get next payment time */
  getNextPaymentTime: (
    client: PublicClient,
    account: Address,
    scheduleId: bigint
  ) => Promise<bigint>
  /** Get remaining payment count */
  getRemainingPayments: (
    client: PublicClient,
    account: Address,
    scheduleId: bigint
  ) => Promise<bigint>
  /** Get total remaining value */
  getTotalRemainingValue: (
    client: PublicClient,
    account: Address,
    scheduleId: bigint
  ) => Promise<bigint>
  /** Check if module is initialized for an account */
  isInitialized: (client: PublicClient, account: Address) => Promise<boolean>
}

/**
 * Create a RecurringPaymentExecutor client
 *
 * @example
 * ```ts
 * import { createRecurringPaymentExecutor } from '@stablenet/plugin-subscription'
 * import { parseEther } from 'viem'
 *
 * const executor = createRecurringPaymentExecutor({
 *   executorAddress: '0x...',
 * })
 *
 * // Encode schedule creation
 * const calldata = executor.encodeCreateSchedule({
 *   recipient: '0x...',
 *   token: '0x0000000000000000000000000000000000000000',
 *   amount: parseEther('1'),
 *   interval: 2592000n, // 30 days
 * })
 *
 * // Check if payment is due
 * const due = await executor.isPaymentDue(publicClient, accountAddress, 0n)
 * ```
 */
export function createRecurringPaymentExecutor(
  config: RecurringPaymentExecutorConfig
): RecurringPaymentExecutorClient {
  const { executorAddress } = config

  return {
    executorAddress,

    // ---- Write encoders ----

    encodeCreateSchedule(params: CreateScheduleParams): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'createSchedule',
        args: [
          params.recipient,
          params.token ?? NATIVE_TOKEN,
          params.amount,
          params.interval,
          params.startTime ?? 0n,
          params.maxPayments ?? 0n,
        ],
      })
    },

    encodeCancelSchedule(scheduleId: bigint): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'cancelSchedule',
        args: [scheduleId],
      })
    },

    encodeUpdateAmount(scheduleId: bigint, newAmount: bigint): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'updateAmount',
        args: [scheduleId, newAmount],
      })
    },

    encodeUpdateRecipient(scheduleId: bigint, newRecipient: Address): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'updateRecipient',
        args: [scheduleId, newRecipient],
      })
    },

    encodeExecutePayment(account: Address, scheduleId: bigint): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'executePayment',
        args: [account, scheduleId],
      })
    },

    encodeExecutePaymentBatch(account: Address, scheduleIds: readonly bigint[]): Hex {
      return encodeFunctionData({
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'executePaymentBatch',
        args: [account, scheduleIds],
      })
    },

    encodeInstallData(params: CreateScheduleParams): Hex {
      return encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
        ],
        [
          params.recipient,
          params.token ?? NATIVE_TOKEN,
          params.amount,
          params.interval,
          params.startTime ?? 0n,
          params.maxPayments ?? 0n,
        ]
      )
    },

    // ---- Read functions ----

    async getSchedule(
      client: PublicClient,
      account: Address,
      scheduleId: bigint
    ): Promise<PaymentSchedule> {
      const result = (await client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'getSchedule',
        args: [account, scheduleId],
      })) as {
        recipient: Address
        token: Address
        amount: bigint
        interval: bigint
        startTime: bigint
        lastPaymentTime: bigint
        maxPayments: bigint
        paymentsMade: bigint
        isActive: boolean
      }

      return {
        recipient: result.recipient,
        token: result.token,
        amount: result.amount,
        interval: result.interval,
        startTime: result.startTime,
        lastPaymentTime: result.lastPaymentTime,
        maxPayments: result.maxPayments,
        paymentsMade: result.paymentsMade,
        isActive: result.isActive,
      }
    },

    async getActiveSchedules(client: PublicClient, account: Address): Promise<bigint[]> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'getActiveSchedules',
        args: [account],
      }) as Promise<bigint[]>
    },

    async isPaymentDue(
      client: PublicClient,
      account: Address,
      scheduleId: bigint
    ): Promise<boolean> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'isPaymentDue',
        args: [account, scheduleId],
      }) as Promise<boolean>
    },

    async getNextPaymentTime(
      client: PublicClient,
      account: Address,
      scheduleId: bigint
    ): Promise<bigint> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'getNextPaymentTime',
        args: [account, scheduleId],
      }) as Promise<bigint>
    },

    async getRemainingPayments(
      client: PublicClient,
      account: Address,
      scheduleId: bigint
    ): Promise<bigint> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'getRemainingPayments',
        args: [account, scheduleId],
      }) as Promise<bigint>
    },

    async getTotalRemainingValue(
      client: PublicClient,
      account: Address,
      scheduleId: bigint
    ): Promise<bigint> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'getTotalRemainingValue',
        args: [account, scheduleId],
      }) as Promise<bigint>
    },

    async isInitialized(client: PublicClient, account: Address): Promise<boolean> {
      return client.readContract({
        address: executorAddress,
        abi: RECURRING_PAYMENT_EXECUTOR_ABI,
        functionName: 'isInitialized',
        args: [account],
      }) as Promise<boolean>
    },
  }
}
