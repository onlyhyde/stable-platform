/**
 * File watcher for hot-reload of contract addresses
 * Used in development to automatically reload addresses when deployment changes
 */

import { watch, type FSWatcher } from 'chokidar'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
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

  private handleChange(path: string): void {
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

          const addresses = this.parseChainAddresses({ chainId, ...chainData as object })
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
      return ((primary as string) || (secondary as string) || (tertiary as string) || ZERO) as `0x${string}`
    }

    const coreData = data.core as Record<string, string> | undefined
    const validatorsData = data.validators as Record<string, string> | undefined
    const executorsData = data.executors as Record<string, string> | undefined
    const hooksData = data.hooks as Record<string, string> | undefined
    const paymastersData = data.paymasters as Record<string, string> | undefined
    const privacyData = data.privacy as Record<string, string> | undefined
    const complianceData = data.compliance as Record<string, string> | undefined

    return {
      chainId,
      core: {
        entryPoint: getAddr(data.entryPoint, coreData?.entryPoint),
        kernel: getAddr(data.kernel, coreData?.kernel),
        kernelFactory: getAddr(data.kernelFactory, data.accountFactory, coreData?.kernelFactory),
      },
      validators: {
        ecdsaValidator: getAddr(data.ecdsaValidator, validatorsData?.ecdsaValidator),
        webAuthnValidator: getAddr(data.webAuthnValidator, validatorsData?.webAuthnValidator),
        multiEcdsaValidator: getAddr(data.multiEcdsaValidator, validatorsData?.multiEcdsaValidator),
      },
      executors: {
        ownableExecutor: getAddr(data.ownableExecutor, executorsData?.ownableExecutor),
      },
      hooks: {
        spendingLimitHook: getAddr(data.spendingLimitHook, hooksData?.spendingLimitHook),
      },
      paymasters: {
        verifyingPaymaster: getAddr(data.verifyingPaymaster, data.paymaster, paymastersData?.verifyingPaymaster),
        tokenPaymaster: getAddr(data.tokenPaymaster, paymastersData?.tokenPaymaster),
      },
      privacy: {
        stealthAnnouncer: getAddr(data.stealthAnnouncer, privacyData?.stealthAnnouncer),
        stealthRegistry: getAddr(data.stealthRegistry, privacyData?.stealthRegistry),
      },
      compliance: {
        kycRegistry: getAddr(data.kycRegistry, complianceData?.kycRegistry),
        complianceValidator: getAddr(data.complianceValidator, complianceData?.complianceValidator),
      },
      delegatePresets: (data.delegatePresets as ChainAddresses['delegatePresets']) || [],
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
 * Create a watcher instance for the default deployment output path
 */
export function createAddressWatcher(options?: Partial<WatcherOptions>): ContractAddressWatcher {
  const defaultPath = options?.watchPath ?? '../../poc-contract/deployments/31337/addresses.json'
  return new ContractAddressWatcher({
    watchPath: defaultPath,
    ...options,
  })
}
