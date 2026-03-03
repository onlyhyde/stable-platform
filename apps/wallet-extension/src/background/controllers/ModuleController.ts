/**
 * ModuleController
 * Manages ERC-7579 module installation, uninstallation, and lifecycle for smart accounts
 */

/**
 * ERC-7579 module types
 */
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
} as const

export type ModuleTypeValue = (typeof MODULE_TYPE)[keyof typeof MODULE_TYPE]

/**
 * Installed module record
 */
export interface InstalledModule {
  /** Module contract address */
  address: string
  /** Module type (ERC-7579) */
  moduleType: ModuleTypeValue
  /** Module name */
  name: string
  /** Module description */
  description: string
  /** Module version */
  version: string
  /** Registry module ID */
  registryId?: string
  /** Chain ID */
  chainId: number
  /** Installation transaction hash */
  installTxHash?: string
  /** Whether currently active */
  active: boolean
  /** Installation timestamp (ISO) */
  installedAt: string
  /** Init data used during installation */
  initData?: string
}

/**
 * Module installation request
 */
export interface ModuleInstallRequest {
  /** Module contract address */
  moduleAddress: string
  /** Module type */
  moduleType: ModuleTypeValue
  /** Module metadata */
  name: string
  description: string
  version: string
  registryId?: string
  /** Initialization data for the module */
  initData?: string
}

/**
 * Module controller state
 */
export interface ModuleControllerState {
  /** Installed modules keyed by chainId -> accountAddress -> moduleAddress */
  modules: Record<number, Record<string, InstalledModule[]>>
}

/**
 * Provider interface for sending transactions
 */
interface ModuleProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Controller configuration
 */
interface ModuleControllerConfig {
  provider: ModuleProvider
  chainId: number
}

// ERC-7579 module management selectors
const MODULE_SELECTORS = {
  installModule: '0x9517e29f', // installModule(uint256,address,bytes)
  uninstallModule: '0xa4d0a17e', // uninstallModule(uint256,address,bytes)
  isModuleInstalled: '0x112c5bc2', // isModuleInstalled(uint256,address,bytes)
  forceUninstallModule: '0x856b02ec', // forceUninstallModule(uint256,address,bytes)
  replaceModule: '0x166add9c', // replaceModule(uint256,address,bytes,address,bytes)
} as const

/**
 * ModuleController
 * Handles ERC-7579 module lifecycle management
 */
export class ModuleController {
  private state: ModuleControllerState
  private provider: ModuleProvider
  private chainId: number

  constructor(config: ModuleControllerConfig) {
    this.provider = config.provider
    this.chainId = config.chainId
    this.state = { modules: {} }
  }

  /**
   * Install a module on a smart account
   */
  async installModule(
    accountAddress: string,
    request: ModuleInstallRequest
  ): Promise<{ txHash: string; module: InstalledModule }> {
    // Encode install calldata
    const callData = this.encodeInstallModule(
      request.moduleType,
      request.moduleAddress,
      request.initData ?? '0x'
    )

    // Send transaction through the smart account
    const txHash = await this.sendModuleTransaction(accountAddress, callData)

    // Record installation
    const module: InstalledModule = {
      address: request.moduleAddress,
      moduleType: request.moduleType,
      name: request.name,
      description: request.description,
      version: request.version,
      registryId: request.registryId,
      chainId: this.chainId,
      installTxHash: txHash,
      active: true,
      installedAt: new Date().toISOString(),
      initData: request.initData,
    }

    this.addModuleToState(accountAddress, module)

    return { txHash, module }
  }

  /**
   * Uninstall a module from a smart account
   */
  async uninstallModule(
    accountAddress: string,
    moduleAddress: string,
    moduleType: ModuleTypeValue,
    deInitData = '0x'
  ): Promise<{ txHash: string }> {
    // Encode uninstall calldata
    const callData = this.encodeUninstallModule(moduleType, moduleAddress, deInitData)

    // Send transaction
    const txHash = await this.sendModuleTransaction(accountAddress, callData)

    // Mark as inactive
    this.deactivateModule(accountAddress, moduleAddress)

    return { txHash }
  }

  /**
   * Force uninstall a module from a smart account.
   * Uses ExcessivelySafeCall so module onUninstall() revert is ignored.
   */
  async forceUninstallModule(
    accountAddress: string,
    moduleAddress: string,
    moduleType: ModuleTypeValue,
    deInitData = '0x'
  ): Promise<{ txHash: string }> {
    const callData = this.encodeForceUninstallModule(moduleType, moduleAddress, deInitData)
    const txHash = await this.sendModuleTransaction(accountAddress, callData)
    this.deactivateModule(accountAddress, moduleAddress)
    return { txHash }
  }

  /**
   * Atomically replace one module with another.
   * If newModule install fails, the old module is NOT removed.
   */
  async replaceModule(
    accountAddress: string,
    moduleType: ModuleTypeValue,
    oldModuleAddress: string,
    deInitData: string,
    newModuleAddress: string,
    initData: string
  ): Promise<{ txHash: string }> {
    const callData = this.encodeReplaceModule(
      moduleType,
      oldModuleAddress,
      deInitData,
      newModuleAddress,
      initData
    )
    const txHash = await this.sendModuleTransaction(accountAddress, callData)
    this.deactivateModule(accountAddress, oldModuleAddress)
    return { txHash }
  }

  /**
   * Check if a module is installed on an account
   */
  async isModuleInstalled(
    accountAddress: string,
    moduleAddress: string,
    moduleType: ModuleTypeValue
  ): Promise<boolean> {
    const typeHex = moduleType.toString(16).padStart(64, '0')
    const addrHex = moduleAddress.slice(2).toLowerCase().padStart(64, '0')
    const callData = `${MODULE_SELECTORS.isModuleInstalled}${typeHex}${addrHex}${'0'.repeat(64)}`

    try {
      const result = await this.provider.request({
        method: 'eth_call',
        params: [{ to: accountAddress, data: callData }, 'latest'],
      })

      // Decode boolean result
      const hex = typeof result === 'string' ? result : '0x0'
      return hex !== '0x' && hex !== '0x0' && hex.endsWith('1')
    } catch {
      return false
    }
  }

  /**
   * Get installed modules for an account
   */
  getInstalledModules(accountAddress: string): InstalledModule[] {
    const chainModules = this.state.modules[this.chainId]
    if (!chainModules) return []

    const accountModules = chainModules[accountAddress.toLowerCase()]
    if (!accountModules) return []

    return accountModules.filter((m) => m.active)
  }

  /**
   * Get all modules across all accounts
   */
  getAllModules(): Record<string, InstalledModule[]> {
    return this.state.modules[this.chainId] ?? {}
  }

  /**
   * Get module by address
   */
  getModule(accountAddress: string, moduleAddress: string): InstalledModule | undefined {
    const modules = this.getInstalledModules(accountAddress)
    return modules.find((m) => m.address.toLowerCase() === moduleAddress.toLowerCase())
  }

  /**
   * Get modules by type
   */
  getModulesByType(accountAddress: string, moduleType: ModuleTypeValue): InstalledModule[] {
    return this.getInstalledModules(accountAddress).filter((m) => m.moduleType === moduleType)
  }

  /**
   * Update chain ID
   */
  setChainId(chainId: number): void {
    this.chainId = chainId
  }

  /**
   * Get serializable state
   */
  getState(): ModuleControllerState {
    return { ...this.state }
  }

  /**
   * Restore state
   */
  restoreState(state: ModuleControllerState): void {
    this.state = state
  }

  // ─── Private Methods ───

  private addModuleToState(accountAddress: string, module: InstalledModule): void {
    const addr = accountAddress.toLowerCase()

    if (!this.state.modules[this.chainId]) {
      this.state.modules[this.chainId] = {}
    }
    const chainModules = this.state.modules[this.chainId]!
    if (!chainModules[addr]) {
      chainModules[addr] = []
    }

    // Remove existing entry for same address
    const modules = chainModules[addr]!
    const existingIdx = modules.findIndex(
      (m) => m.address.toLowerCase() === module.address.toLowerCase()
    )
    if (existingIdx >= 0) {
      chainModules[addr] = [
        ...modules.slice(0, existingIdx),
        module,
        ...modules.slice(existingIdx + 1),
      ]
    } else {
      chainModules[addr] = [...modules, module]
    }
  }

  private deactivateModule(accountAddress: string, moduleAddress: string): void {
    const addr = accountAddress.toLowerCase()
    const chainModules = this.state.modules[this.chainId]
    if (!chainModules) return
    const modules = chainModules[addr]
    if (!modules) return

    chainModules[addr] = modules.map((m) =>
      m.address.toLowerCase() === moduleAddress.toLowerCase() ? { ...m, active: false } : m
    )
  }

  private encodeInstallModule(
    moduleType: ModuleTypeValue,
    moduleAddress: string,
    initData: string
  ): string {
    const typeHex = moduleType.toString(16).padStart(64, '0')
    const addrHex = moduleAddress.slice(2).toLowerCase().padStart(64, '0')
    const dataOffset = `${'0'.repeat(62)}60` // offset to bytes data
    const cleanData = initData.startsWith('0x') ? initData.slice(2) : initData
    const dataLen = (cleanData.length / 2).toString(16).padStart(64, '0')
    const paddedData = cleanData.padEnd(Math.ceil(cleanData.length / 64) * 64, '0')

    return `${MODULE_SELECTORS.installModule}${typeHex}${addrHex}${dataOffset}${dataLen}${paddedData}`
  }

  private encodeUninstallModule(
    moduleType: ModuleTypeValue,
    moduleAddress: string,
    deInitData: string
  ): string {
    const typeHex = moduleType.toString(16).padStart(64, '0')
    const addrHex = moduleAddress.slice(2).toLowerCase().padStart(64, '0')
    const dataOffset = `${'0'.repeat(62)}60`
    const cleanData = deInitData.startsWith('0x') ? deInitData.slice(2) : deInitData
    const dataLen = (cleanData.length / 2).toString(16).padStart(64, '0')
    const paddedData = cleanData.padEnd(Math.ceil(cleanData.length / 64) * 64, '0')

    return `${MODULE_SELECTORS.uninstallModule}${typeHex}${addrHex}${dataOffset}${dataLen}${paddedData}`
  }

  private encodeForceUninstallModule(
    moduleType: ModuleTypeValue,
    moduleAddress: string,
    deInitData: string
  ): string {
    const typeHex = moduleType.toString(16).padStart(64, '0')
    const addrHex = moduleAddress.slice(2).toLowerCase().padStart(64, '0')
    const dataOffset = `${'0'.repeat(62)}60`
    const cleanData = deInitData.startsWith('0x') ? deInitData.slice(2) : deInitData
    const dataLen = (cleanData.length / 2).toString(16).padStart(64, '0')
    const paddedData = cleanData.padEnd(Math.ceil(cleanData.length / 64) * 64, '0')

    return `${MODULE_SELECTORS.forceUninstallModule}${typeHex}${addrHex}${dataOffset}${dataLen}${paddedData}`
  }

  private encodeReplaceModule(
    moduleType: ModuleTypeValue,
    oldModuleAddress: string,
    deInitData: string,
    newModuleAddress: string,
    initData: string
  ): string {
    const typeHex = moduleType.toString(16).padStart(64, '0')
    const oldAddrHex = oldModuleAddress.slice(2).toLowerCase().padStart(64, '0')

    const cleanDeInit = deInitData.startsWith('0x') ? deInitData.slice(2) : deInitData
    const newAddrHex = newModuleAddress.slice(2).toLowerCase().padStart(64, '0')
    const cleanInit = initData.startsWith('0x') ? initData.slice(2) : initData

    // ABI encoding for replaceModule(uint256,address,bytes,address,bytes)
    // 5 static slots: type, oldAddr, deInitOffset, newAddr, initOffset
    const deInitOffset = (5 * 32).toString(16).padStart(64, '0') // 0xa0
    const deInitLen = (cleanDeInit.length / 2).toString(16).padStart(64, '0')
    const paddedDeInit = cleanDeInit.padEnd(Math.ceil(cleanDeInit.length / 64) * 64, '0')
    const deInitWords = Math.max(Math.ceil(cleanDeInit.length / 64), 1)

    const initOffsetValue = 5 * 32 + 32 + deInitWords * 32
    const initOffset = initOffsetValue.toString(16).padStart(64, '0')
    const initLen = (cleanInit.length / 2).toString(16).padStart(64, '0')
    const paddedInit = cleanInit.padEnd(Math.ceil(cleanInit.length / 64) * 64, '0')

    return `${MODULE_SELECTORS.replaceModule}${typeHex}${oldAddrHex}${deInitOffset}${newAddrHex}${initOffset}${deInitLen}${paddedDeInit}${initLen}${paddedInit}`
  }

  private async sendModuleTransaction(accountAddress: string, callData: string): Promise<string> {
    const txHash = await this.provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: accountAddress,
          to: accountAddress, // Self-call for ERC-7579
          data: `0x${callData}`,
          value: '0x0',
        },
      ],
    })

    if (typeof txHash !== 'string') {
      throw new Error('Failed to send module transaction')
    }

    return txHash
  }
}
