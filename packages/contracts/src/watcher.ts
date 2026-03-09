/**
 * File watcher for hot-reload of contract addresses
 * Used in development to automatically reload addresses when deployment changes
 */

import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { type FSWatcher, watch } from 'chokidar'
import type { AddressUpdateEvent, ChainAddresses, WatcherOptions } from './types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

/**
 * Validate that a value is a valid Ethereum address (0x + 40 hex chars)
 */
function isValidAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && ADDRESS_REGEX.test(value)
}

/**
 * Coerce a value to a validated address, falling back to zero address for invalid values
 */
function toAddress(value: unknown): `0x${string}` {
  return isValidAddress(value) ? value : ZERO_ADDRESS
}

/**
 * Contract address watcher for hot-reload in development
 */
export class ContractAddressWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private readonly watchPath: string
  private readonly debounceMs: number
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

      if (typeof data !== 'object' || data === null) {
        throw new Error(`Invalid deployment file: expected object, got ${typeof data}`)
      }

      // Handle both single chain and multi-chain format
      if (data.chainId !== undefined) {
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
          if (!Number.isFinite(chainId) || chainId <= 0) continue

          if (typeof chainData !== 'object' || chainData === null) continue

          const addresses = this.parseChainAddresses({ chainId, ...(chainData as object) })
          const oldAddresses = this.currentAddresses.get(chainId)

          if (!this.addressesEqual(oldAddresses, addresses)) {
            this.currentAddresses.set(chainId, addresses)
            this.emitUpdate(addresses)
          }
        }
      }
    } catch (error) {
      // File might not exist yet during initial setup
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  private parseChainAddresses(data: Record<string, unknown>): ChainAddresses {
    const rawChainId = Number(data.chainId)
    if (!Number.isFinite(rawChainId) || rawChainId <= 0) {
      throw new Error(`Invalid chainId: ${String(data.chainId)}`)
    }
    const chainId = rawChainId

    // Build raw record from flat keys, validating address format
    const raw: Record<string, `0x${string}`> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_') || key === 'chainId' || typeof value !== 'string') continue
      if (isValidAddress(value)) {
        raw[key] = value
      }
    }

    return {
      chainId,
      core: {
        entryPoint: toAddress(data.entryPoint),
        kernel: toAddress(data.kernel),
        kernelFactory: toAddress(data.kernelFactory || data.accountFactory),
        factoryStaker: toAddress(data.factoryStaker),
      },
      validators: {
        ecdsaValidator: toAddress(data.ecdsaValidator),
        webAuthnValidator: toAddress(data.webAuthnValidator),
        multiChainValidator: toAddress(data.multiChainValidator),
        multiSigValidator: toAddress(data.multiSigValidator),
        weightedEcdsaValidator: toAddress(data.weightedEcdsaValidator),
      },
      executors: {
        sessionKeyExecutor: toAddress(data.sessionKeyExecutor),
      },
      hooks: {
        spendingLimitHook: toAddress(data.spendingLimitHook),
      },
      paymasters: {
        verifyingPaymaster: toAddress(data.verifyingPaymaster || data.paymaster),
        erc20Paymaster: toAddress(data.erc20Paymaster),
        permit2Paymaster: toAddress(data.permit2Paymaster),
        sponsorPaymaster: toAddress(data.sponsorPaymaster),
      },
      privacy: {
        stealthAnnouncer: toAddress(data.erc5564Announcer || data.stealthAnnouncer),
        stealthRegistry: toAddress(data.erc6538Registry || data.stealthRegistry),
      },
      compliance: {
        kycRegistry: toAddress(data.kycRegistry),
        regulatoryRegistry: toAddress(data.regulatoryRegistry),
        auditHook: toAddress(data.auditHook),
        auditLogger: toAddress(data.auditLogger),
      },
      subscriptions: {
        subscriptionManager: toAddress(data.subscriptionManager),
        recurringPaymentExecutor: toAddress(data.recurringPaymentExecutor),
        permissionManager: toAddress(data.erc7715PermissionManager || data.permissionManager),
      },
      tokens: {
        wkrc: toAddress(data.wkrc),
        usdc: toAddress(data.usdc),
      },
      defi: {
        lendingPool: toAddress(data.lendingPool),
        stakingVault: toAddress(data.stakingVault),
        priceOracle: toAddress(data.priceOracle),
        proofOfReserve: toAddress(data.proofOfReserve),
        privateBank: toAddress(data.privateBank),
        permit2: toAddress(data.permit2),
      },
      uniswap: {
        factory: toAddress(data.uniswapV3Factory),
        swapRouter: toAddress(data.uniswapV3SwapRouter),
        quoter: toAddress(data.uniswapV3Quoter),
        nftPositionManager: toAddress(data.uniswapV3NftPositionManager),
        wkrcUsdcPool: toAddress(data.uniswapV3WkrcUsdcPool),
      },
      fallbacks: {
        flashLoanFallback: toAddress(data.flashLoanFallback),
        tokenReceiverFallback: toAddress(data.tokenReceiverFallback),
      },
      delegatePresets: Array.isArray(data.delegatePresets)
        ? (data.delegatePresets as ChainAddresses['delegatePresets'])
        : [],
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

  // Validate CHAIN_ID is numeric to prevent path traversal
  if (!/^\d+$/.test(chainId)) {
    throw new Error(`Invalid CHAIN_ID: must be numeric, got "${chainId}"`)
  }

  const defaultPath = options?.watchPath ?? resolve(deploymentDir, chainId, 'addresses.json')
  return new ContractAddressWatcher({
    watchPath: defaultPath,
    ...options,
  })
}
