import type { Address, PublicClient, WalletClient } from 'viem'
import type { PaymasterAddresses, PaymasterType } from '../types'
import { getGlobalLogger } from '../utils/logger'

/**
 * EntryPoint ABI — balanceOf (IStakeManager)
 */
const ENTRY_POINT_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
] as const

/**
 * Deposit info for a single paymaster
 */
export interface PaymasterDepositInfo {
  address: Address
  type: PaymasterType
  deposit: bigint
  isLow: boolean
  lastCheckedAt: number
}

/**
 * Deposit monitor configuration
 */
export interface DepositMonitorConfig {
  /** EntryPoint contract address */
  entryPoint: Address
  /** Paymaster addresses by type */
  paymasterAddresses: PaymasterAddresses
  /** Minimum deposit threshold in wei (default: 0.01 WKRC) */
  minDepositThreshold: bigint
  /** Polling interval in ms (default: 30000) */
  pollIntervalMs: number
  /** Reject signing when deposit is below threshold (default: false) */
  rejectOnLowDeposit: boolean
  /** Enable automatic deposit when balance is low (default: false) */
  autoDepositEnabled?: boolean
  /** Amount to deposit in wei (default: 0.1 WKRC) */
  autoDepositAmount?: bigint
  /** Cooldown between auto-deposits in ms (default: 300000 = 5 min) */
  autoDepositCooldownMs?: number
}

/**
 * Deposit monitor stats for health endpoint
 */
export interface DepositMonitorStats {
  deposits: Record<
    string,
    {
      type: PaymasterType
      deposit: string
      isLow: boolean
      lastCheckedAt: string | null
    }
  >
  anyLow: boolean
  lastPollAt: string | null
}

/**
 * Monitors EntryPoint deposits for all configured paymasters.
 * Periodically queries balanceOf() and warns when deposit is below threshold.
 */
/**
 * EntryPoint ABI — depositTo (IStakeManager)
 */
const ENTRY_POINT_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'depositTo',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

export class DepositMonitor {
  private client: PublicClient
  private config: DepositMonitorConfig
  private deposits = new Map<string, PaymasterDepositInfo>()
  private timer: ReturnType<typeof setInterval> | null = null
  private lastPollAt: number | null = null
  private walletClient?: WalletClient
  /** Timestamp of last auto-deposit per address (for cooldown) */
  private lastAutoDepositAt = new Map<string, number>()
  /** Addresses currently in-flight for auto-deposit (single-flight guard) */
  private autoDepositInFlight = new Set<string>()

  constructor(client: PublicClient, config: DepositMonitorConfig, walletClient?: WalletClient) {
    this.client = client
    this.config = config
    this.walletClient = walletClient
  }

  /**
   * Start periodic deposit monitoring
   */
  start(): void {
    if (this.timer) return

    // Initial poll
    this.poll().catch((err) => {
      getGlobalLogger().error({ err }, 'Deposit monitor initial poll failed')
    })

    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        getGlobalLogger().error({ err }, 'Deposit monitor poll failed')
      })
    }, this.config.pollIntervalMs)

    if (this.timer.unref) {
      this.timer.unref()
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Poll all paymaster deposits
   */
  async poll(): Promise<void> {
    const entries = Object.entries(this.config.paymasterAddresses) as [
      PaymasterType,
      Address | undefined,
    ][]

    const promises = entries
      .filter((entry): entry is [PaymasterType, Address] => entry[1] !== undefined)
      .map(async ([type, address]) => {
        try {
          const deposit = (await this.client.readContract({
            address: this.config.entryPoint,
            abi: ENTRY_POINT_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          })) as bigint

          const isLow = deposit < this.config.minDepositThreshold

          if (isLow) {
            getGlobalLogger().warn(
              {
                type,
                address,
                deposit: deposit.toString(),
                threshold: this.config.minDepositThreshold.toString(),
              },
              'Low paymaster deposit detected'
            )
            this.tryAutoDeposit(address)
          }

          this.deposits.set(address.toLowerCase(), {
            address,
            type,
            deposit,
            isLow,
            lastCheckedAt: Date.now(),
          })
        } catch (err) {
          getGlobalLogger().error({ type, address, err }, 'Failed to check deposit')
        }
      })

    await Promise.all(promises)
    this.lastPollAt = Date.now()
  }

  /**
   * Check if a specific paymaster has sufficient deposit
   */
  hasSufficientDeposit(paymasterAddress: Address): boolean {
    const info = this.deposits.get(paymasterAddress.toLowerCase())
    if (!info) return true // unknown = allow (conservative only when rejectOnLowDeposit is true)
    return !info.isLow
  }

  /**
   * Check if signing should be rejected due to low deposit
   */
  shouldRejectSigning(paymasterAddress: Address): boolean {
    if (!this.config.rejectOnLowDeposit) return false
    return !this.hasSufficientDeposit(paymasterAddress)
  }

  /**
   * Get deposit info for a specific paymaster
   */
  getDepositInfo(paymasterAddress: Address): PaymasterDepositInfo | undefined {
    return this.deposits.get(paymasterAddress.toLowerCase())
  }

  /**
   * Attempt automatic deposit for a low-balance paymaster.
   * Guards: enabled + walletClient + cooldown elapsed + not in-flight.
   */
  private tryAutoDeposit(address: Address): void {
    if (!this.config.autoDepositEnabled) return
    if (!this.walletClient) return

    const key = address.toLowerCase()
    const cooldown = this.config.autoDepositCooldownMs ?? 300_000
    const lastDeposit = this.lastAutoDepositAt.get(key)
    if (lastDeposit && Date.now() - lastDeposit < cooldown) return
    if (this.autoDepositInFlight.has(key)) return

    const amount = this.config.autoDepositAmount ?? 10n ** 17n // 0.1 WKRC

    this.autoDepositInFlight.add(key)

    const account = this.walletClient.account
    if (!account) {
      getGlobalLogger().error('WalletClient has no account configured for auto-deposit')
      this.autoDepositInFlight.delete(key)
      return
    }

    this.walletClient
      .writeContract({
        address: this.config.entryPoint,
        abi: ENTRY_POINT_DEPOSIT_ABI,
        functionName: 'depositTo',
        args: [address],
        value: amount,
        chain: null,
        account,
      })
      .then((txHash) => {
        this.lastAutoDepositAt.set(key, Date.now())
      })
      .catch((err) => {
        getGlobalLogger().error({ address, err }, 'Auto-deposit failed')
      })
      .finally(() => {
        this.autoDepositInFlight.delete(key)
      })
  }

  /**
   * Get stats for health endpoint
   */
  getStats(): DepositMonitorStats {
    const deposits: DepositMonitorStats['deposits'] = {}
    let anyLow = false

    for (const info of this.deposits.values()) {
      deposits[info.address] = {
        type: info.type,
        deposit: info.deposit.toString(),
        isLow: info.isLow,
        lastCheckedAt: new Date(info.lastCheckedAt).toISOString(),
      }
      if (info.isLow) anyLow = true
    }

    return {
      deposits,
      anyLow,
      lastPollAt: this.lastPollAt ? new Date(this.lastPollAt).toISOString() : null,
    }
  }
}
