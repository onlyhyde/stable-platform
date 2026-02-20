/**
 * File watcher for hot-reload of contract addresses
 * Used in development to automatically reload addresses when deployment changes
 */

import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { type FSWatcher, watch } from 'chokidar'
import type { AddressUpdateEvent, ChainAddresses, WatcherOptions } from './types'

/**
 * Contract address watcher for hot-reload in development
 */
export class ContractAddressWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private watchPath: string
  private debounceMs: number
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private currentAddresses: Map<number, ChainAddresses> = new Map()

  constructor(options: WatcherOptions) {
    super()
    this.watchPath = options.watchPath
    this.debounceMs = options.debounceMs ?? 100

    if (options.onUpdate) {
      this.on('update', options.onUpdate)
    }
    if (options.onError) {
      this.on('error', options.onError)
    }
  }

  /**
   * Start watching for address file changes
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return
    }

    // Load initial addresses
    await this.loadAddresses()

    // Start watching
    this.watcher = watch(this.watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    })

    this.watcher.on('change', (path) => {
      this.handleChange(path)
    })

    this.watcher.on('add', (path) => {
      this.handleChange(path)
    })

    this.watcher.on('error', (error) => {
      this.emit('error', error)
    })
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }

  /**
   * Get current addresses for a chain
   */
  getAddresses(chainId: number): ChainAddresses | undefined {
    return this.currentAddresses.get(chainId)
  }

  /**
   * Get all loaded addresses
   */
  getAllAddresses(): Map<number, ChainAddresses> {
    return new Map(this.currentAddresses)
  }

  private handleChange(_path: string): void {
    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        await this.loadAddresses()
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)))
      }
    }, this.debounceMs)
  }

  private async loadAddresses(): Promise<void> {
    try {
      const content = await readFile(this.watchPath, 'utf-8')
      const data = JSON.parse(content)

      // Handle both single chain and multi-chain format
      if (data.chainId) {
        // Single chain format
        const addresses = this.parseChainAddresses(data)
        const oldAddresses = this.currentAddresses.get(addresses.chainId)

        if (!this.addressesEqual(oldAddresses, addresses)) {
          this.currentAddresses.set(addresses.chainId, addresses)
          this.emitUpdate(addresses)
        }
      } else {
        // Multi-chain format (keyed by chain ID)
        for (const [chainIdStr, chainData] of Object.entries(data)) {
          const chainId = Number.parseInt(chainIdStr, 10)
          if (Number.isNaN(chainId)) continue

          const addresses = this.parseChainAddresses({ chainId, ...(chainData as object) })
          const oldAddresses = this.currentAddresses.get(chainId)

          if (!this.addressesEqual(oldAddresses, addresses)) {
            this.currentAddresses.set(chainId, addresses)
            this.emitUpdate(addresses)
          }
        }
      }
    } catch (error) {
      // File might not exist yet or be invalid JSON
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  private parseChainAddresses(data: Record<string, unknown>): ChainAddresses {
    const chainId = data.chainId as number
    const ZERO = '0x0000000000000000000000000000000000000000' as const

    const getAddr = (primary: unknown, secondary?: unknown, tertiary?: unknown) => {
      return ((primary as string) ||
        (secondary as string) ||
        (tertiary as string) ||
        ZERO) as `0x${string}`
    }

    // Build raw record from flat keys
    const raw: Record<string, `0x${string}`> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_') || key === 'chainId' || typeof value !== 'string') continue
      raw[key] = value as `0x${string}`
    }

    return {
      chainId,
      core: {
        entryPoint: getAddr(data.entryPoint),
        kernel: getAddr(data.kernel),
        kernelFactory: getAddr(data.kernelFactory, data.accountFactory),
        factoryStaker: getAddr(data.factoryStaker),
      },
      validators: {
        ecdsaValidator: getAddr(data.ecdsaValidator),
        webAuthnValidator: getAddr(data.webAuthnValidator),
        multiChainValidator: getAddr(data.multiChainValidator),
        multiSigValidator: getAddr(data.multiSigValidator),
        weightedEcdsaValidator: getAddr(data.weightedEcdsaValidator),
      },
      executors: {
        sessionKeyExecutor: getAddr(data.sessionKeyExecutor),
      },
      hooks: {
        spendingLimitHook: getAddr(data.spendingLimitHook),
      },
      paymasters: {
        verifyingPaymaster: getAddr(data.verifyingPaymaster, data.paymaster),
        erc20Paymaster: getAddr(data.erc20Paymaster),
        permit2Paymaster: getAddr(data.permit2Paymaster),
        sponsorPaymaster: getAddr(data.sponsorPaymaster),
      },
      privacy: {
        stealthAnnouncer: getAddr(data.erc5564Announcer, data.stealthAnnouncer),
        stealthRegistry: getAddr(data.erc6538Registry, data.stealthRegistry),
      },
      compliance: {
        kycRegistry: getAddr(data.kycRegistry),
        regulatoryRegistry: getAddr(data.regulatoryRegistry),
        auditHook: getAddr(data.auditHook),
        auditLogger: getAddr(data.auditLogger),
      },
      subscriptions: {
        subscriptionManager: getAddr(data.subscriptionManager),
        recurringPaymentExecutor: getAddr(data.recurringPaymentExecutor),
        permissionManager: getAddr(data.erc7715PermissionManager, data.permissionManager),
      },
      tokens: {
        wkrc: getAddr(data.wkrc),
        usdc: getAddr(data.usdc),
      },
      defi: {
        lendingPool: getAddr(data.lendingPool),
        stakingVault: getAddr(data.stakingVault),
        priceOracle: getAddr(data.priceOracle),
        proofOfReserve: getAddr(data.proofOfReserve),
        privateBank: getAddr(data.privateBank),
        permit2: getAddr(data.permit2),
      },
      uniswap: {
        factory: getAddr(data.uniswapV3Factory),
        swapRouter: getAddr(data.uniswapV3SwapRouter),
        quoter: getAddr(data.uniswapV3Quoter),
        nftPositionManager: getAddr(data.uniswapV3NftPositionManager),
        wkrcUsdcPool: getAddr(data.uniswapV3WkrcUsdcPool),
      },
      fallbacks: {
        flashLoanFallback: getAddr(data.flashLoanFallback),
        tokenReceiverFallback: getAddr(data.tokenReceiverFallback),
      },
      delegatePresets: (data.delegatePresets as ChainAddresses['delegatePresets']) || [],
      raw,
    }
  }

  private addressesEqual(a: ChainAddresses | undefined, b: ChainAddresses): boolean {
    if (!a) return false
    return JSON.stringify(a) === JSON.stringify(b)
  }

  private emitUpdate(addresses: ChainAddresses): void {
    const event: AddressUpdateEvent = {
      chainId: addresses.chainId,
      timestamp: Date.now(),
      addresses,
    }
    this.emit('update', event)
  }
}

/**
 * Create a watcher instance for the default deployment output path.
 * Reads DEPLOYMENT_DIR and CHAIN_ID from environment if available.
 */
export function createAddressWatcher(options?: Partial<WatcherOptions>): ContractAddressWatcher {
  const deploymentDir = process.env.DEPLOYMENT_DIR ?? '../../poc-contract/deployments'
  const chainId = process.env.CHAIN_ID ?? '31337'
  const defaultPath = options?.watchPath ?? `${deploymentDir}/${chainId}/addresses.json`
  return new ContractAddressWatcher({
    watchPath: defaultPath,
    ...options,
  })
}
