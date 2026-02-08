import type {
  ModuleCategory,
  ModuleInstallation,
  ModuleMetadata,
  ModuleReview,
  ModuleType,
} from './types'

/**
 * In-memory store for module registry data
 */
export class ModuleStore {
  private readonly modules = new Map<string, ModuleMetadata>()
  private readonly installations = new Map<string, ModuleInstallation>()
  private readonly reviews = new Map<string, ModuleReview>()

  // ─── Modules ───

  addModule(module: ModuleMetadata): void {
    this.modules.set(module.id, module)
  }

  getModule(id: string): ModuleMetadata | undefined {
    return this.modules.get(id)
  }

  updateModule(id: string, updates: Partial<ModuleMetadata>): ModuleMetadata | undefined {
    const existing = this.modules.get(id)
    if (!existing) return undefined
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    this.modules.set(id, updated)
    return updated
  }

  deleteModule(id: string): boolean {
    return this.modules.delete(id)
  }

  listModules(filters?: {
    moduleType?: ModuleType
    category?: ModuleCategory
    featured?: boolean
    deprecated?: boolean
    chainId?: number
  }): ModuleMetadata[] {
    let results = Array.from(this.modules.values())

    if (filters) {
      if (filters.moduleType) {
        results = results.filter((m) => m.moduleType === filters.moduleType)
      }
      if (filters.category) {
        results = results.filter((m) => m.category === filters.category)
      }
      if (filters.featured !== undefined) {
        results = results.filter((m) => m.featured === filters.featured)
      }
      if (filters.deprecated !== undefined) {
        results = results.filter((m) => m.deprecated === filters.deprecated)
      }
      if (filters.chainId !== undefined) {
        results = results.filter((m) => m.addresses[filters.chainId!] !== undefined)
      }
    }

    return results
  }

  searchModules(query: string): ModuleMetadata[] {
    const lower = query.toLowerCase()
    return Array.from(this.modules.values()).filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.description.toLowerCase().includes(lower) ||
        m.tags.some((t) => t.toLowerCase().includes(lower)) ||
        m.author.toLowerCase().includes(lower)
    )
  }

  getModuleCount(): number {
    return this.modules.size
  }

  getFeaturedModules(): ModuleMetadata[] {
    return Array.from(this.modules.values())
      .filter((m) => m.featured && !m.deprecated)
      .sort((a, b) => b.installCount - a.installCount)
  }

  getPopularModules(limit = 10): ModuleMetadata[] {
    return Array.from(this.modules.values())
      .filter((m) => !m.deprecated)
      .sort((a, b) => b.installCount - a.installCount)
      .slice(0, limit)
  }

  // ─── Installations ───

  addInstallation(installation: ModuleInstallation): void {
    this.installations.set(installation.id, installation)
    // Increment module install count
    const module = this.modules.get(installation.moduleId)
    if (module) {
      this.modules.set(module.id, { ...module, installCount: module.installCount + 1 })
    }
  }

  getInstallation(id: string): ModuleInstallation | undefined {
    return this.installations.get(id)
  }

  listInstallationsForAccount(accountAddress: string): ModuleInstallation[] {
    return Array.from(this.installations.values()).filter(
      (i) => i.accountAddress.toLowerCase() === accountAddress.toLowerCase() && i.active
    )
  }

  listInstallationsForModule(moduleId: string): ModuleInstallation[] {
    return Array.from(this.installations.values()).filter(
      (i) => i.moduleId === moduleId && i.active
    )
  }

  deactivateInstallation(id: string): boolean {
    const installation = this.installations.get(id)
    if (!installation) return false
    this.installations.set(id, { ...installation, active: false })
    return true
  }

  getInstallationCount(): number {
    return Array.from(this.installations.values()).filter((i) => i.active).length
  }

  // ─── Reviews ───

  addReview(review: ModuleReview): void {
    this.reviews.set(review.id, review)
    this.recalculateRating(review.moduleId)
  }

  getReviewsForModule(moduleId: string): ModuleReview[] {
    return Array.from(this.reviews.values())
      .filter((r) => r.moduleId === moduleId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  private recalculateRating(moduleId: string): void {
    const reviews = this.getReviewsForModule(moduleId)
    if (reviews.length === 0) return

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
    const avg = sum / reviews.length
    const module = this.modules.get(moduleId)
    if (module) {
      this.modules.set(moduleId, {
        ...module,
        rating: Math.round(avg * 10) / 10,
        ratingCount: reviews.length,
      })
    }
  }

  // ─── Seed Data ───

  seedDefaults(): void {
    const now = new Date().toISOString()

    const defaultModules: ModuleMetadata[] = [
      {
        id: 'ecdsa-validator',
        name: 'ECDSA Validator',
        description:
          'Standard ECDSA signature validation for smart accounts. Essential security module for transaction signing.',
        version: '1.0.0',
        moduleType: 'validator',
        category: 'security',
        addresses: { 31337: '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['ecdsa', 'signature', 'security', 'core'],
        installCount: 1250,
        rating: 4.8,
        ratingCount: 89,
        auditStatus: 'verified',
        featured: true,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'session-key-validator',
        name: 'Session Key Validator',
        description:
          'Temporary session keys with permission scoping. Enables gasless dApp interactions without repeated signing.',
        version: '1.0.0',
        moduleType: 'validator',
        category: 'security',
        addresses: { 31337: '0x7969c5eD335650692Bc04293B07F5a2f3AC1b7b7' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['session', 'temporary', 'gasless', 'permissions'],
        installCount: 830,
        rating: 4.6,
        ratingCount: 52,
        auditStatus: 'audited',
        featured: true,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'subscription-executor',
        name: 'Subscription Executor',
        description:
          'Automated recurring payments executor. Schedule DCA, subscriptions, and periodic transfers.',
        version: '1.0.0',
        moduleType: 'executor',
        category: 'automation',
        addresses: { 31337: '0x9A676e781A523b5d0C0e43731313A708CB607508' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['subscription', 'recurring', 'dca', 'automation'],
        installCount: 620,
        rating: 4.5,
        ratingCount: 41,
        auditStatus: 'audited',
        featured: true,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'spending-limit-hook',
        name: 'Spending Limit Hook',
        description:
          'Enforce per-transaction and daily spending limits. Protect against unauthorized large transfers.',
        version: '1.0.0',
        moduleType: 'hook',
        category: 'security',
        addresses: { 31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['spending', 'limit', 'security', 'protection'],
        installCount: 510,
        rating: 4.7,
        ratingCount: 38,
        auditStatus: 'audited',
        featured: false,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'social-recovery',
        name: 'Social Recovery',
        description:
          'Recover account access using trusted guardians. Set threshold-based recovery with timelock protection.',
        version: '1.0.0',
        moduleType: 'validator',
        category: 'social-recovery',
        addresses: { 31337: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['recovery', 'guardian', 'social', 'backup'],
        installCount: 470,
        rating: 4.4,
        ratingCount: 35,
        auditStatus: 'community-reviewed',
        featured: true,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dex-swap-executor',
        name: 'DEX Swap Executor',
        description:
          'Execute token swaps through Uniswap V3 directly from your smart account with built-in slippage protection.',
        version: '1.0.0',
        moduleType: 'executor',
        category: 'defi',
        addresses: { 31337: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['dex', 'swap', 'uniswap', 'defi'],
        installCount: 390,
        rating: 4.3,
        ratingCount: 28,
        auditStatus: 'community-reviewed',
        featured: false,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'stealth-address-fallback',
        name: 'Stealth Address Fallback',
        description:
          'Privacy-preserving receive addresses using stealth address protocol (ERC-5564).',
        version: '1.0.0',
        moduleType: 'fallback',
        category: 'privacy',
        addresses: { 31337: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['stealth', 'privacy', 'erc5564', 'anonymous'],
        installCount: 280,
        rating: 4.2,
        ratingCount: 19,
        auditStatus: 'community-reviewed',
        featured: false,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'multisig-validator',
        name: 'Multisig Validator',
        description:
          'Multi-signature validation requiring M-of-N signatures for transaction approval.',
        version: '1.0.0',
        moduleType: 'validator',
        category: 'governance',
        addresses: { 31337: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' },
        author: 'StableNet',
        authorAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        tags: ['multisig', 'governance', 'threshold', 'team'],
        installCount: 340,
        rating: 4.5,
        ratingCount: 24,
        auditStatus: 'audited',
        featured: false,
        deprecated: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    for (const module of defaultModules) {
      this.addModule(module)
    }
  }
}
