'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createModuleRegistry, MODULE_TYPE, type ModuleRegistryEntry } from '@stablenet/core'
import { useChainId } from 'wagmi'
import type { ModuleCardData } from '@/components/marketplace/ModuleCard'

// Fallback hardcoded catalog (used when SDK registry is unavailable)
const FALLBACK_CATALOG: ModuleCardData[] = [
  {
    id: 'ecdsa-validator',
    name: 'ECDSA Validator',
    description:
      'Standard ECDSA signature validation for smart accounts. Essential security module for transaction signing.',
    version: '1.0.0',
    moduleType: 'validator',
    category: 'security',
    author: 'StableNet',
    installCount: 1250,
    rating: 4.8,
    ratingCount: 89,
    auditStatus: 'verified',
    featured: true,
    tags: ['ecdsa', 'signature', 'security', 'core'],
  },
  {
    id: 'session-key-validator',
    name: 'Session Key Validator',
    description:
      'Temporary session keys with permission scoping. Enables gasless dApp interactions without repeated signing.',
    version: '1.0.0',
    moduleType: 'validator',
    category: 'security',
    author: 'StableNet',
    installCount: 830,
    rating: 4.6,
    ratingCount: 52,
    auditStatus: 'audited',
    featured: true,
    tags: ['session', 'temporary', 'gasless', 'permissions'],
  },
  {
    id: 'subscription-executor',
    name: 'Subscription Executor',
    description:
      'Automated recurring payments executor. Schedule DCA, subscriptions, and periodic transfers.',
    version: '1.0.0',
    moduleType: 'executor',
    category: 'automation',
    author: 'StableNet',
    installCount: 620,
    rating: 4.5,
    ratingCount: 41,
    auditStatus: 'audited',
    featured: true,
    tags: ['subscription', 'recurring', 'dca', 'automation'],
  },
  {
    id: 'spending-limit-hook',
    name: 'Spending Limit Hook',
    description:
      'Enforce per-transaction and daily spending limits. Protect against unauthorized large transfers.',
    version: '1.0.0',
    moduleType: 'hook',
    category: 'security',
    author: 'StableNet',
    installCount: 510,
    rating: 4.7,
    ratingCount: 38,
    auditStatus: 'audited',
    featured: false,
    tags: ['spending', 'limit', 'security', 'protection'],
  },
  {
    id: 'social-recovery',
    name: 'Social Recovery',
    description:
      'Recover account access using trusted guardians. Set threshold-based recovery with timelock protection.',
    version: '1.0.0',
    moduleType: 'validator',
    category: 'social-recovery',
    author: 'StableNet',
    installCount: 470,
    rating: 4.4,
    ratingCount: 35,
    auditStatus: 'community-reviewed',
    featured: true,
    tags: ['recovery', 'guardian', 'social', 'backup'],
  },
  {
    id: 'dex-swap-executor',
    name: 'DEX Swap Executor',
    description:
      'Execute token swaps through Uniswap V3 directly from your smart account with built-in slippage protection.',
    version: '1.0.0',
    moduleType: 'executor',
    category: 'defi',
    author: 'StableNet',
    installCount: 390,
    rating: 4.3,
    ratingCount: 28,
    auditStatus: 'community-reviewed',
    featured: false,
    tags: ['dex', 'swap', 'uniswap', 'defi'],
  },
  {
    id: 'stealth-address-fallback',
    name: 'Stealth Address Fallback',
    description: 'Privacy-preserving receive addresses using stealth address protocol (ERC-5564).',
    version: '1.0.0',
    moduleType: 'fallback',
    category: 'privacy',
    author: 'StableNet',
    installCount: 280,
    rating: 4.2,
    ratingCount: 19,
    auditStatus: 'community-reviewed',
    featured: false,
    tags: ['stealth', 'privacy', 'erc5564', 'anonymous'],
  },
  {
    id: 'multisig-validator',
    name: 'Multisig Validator',
    description: 'Multi-signature validation requiring M-of-N signatures for transaction approval.',
    version: '1.0.0',
    moduleType: 'validator',
    category: 'governance',
    author: 'StableNet',
    installCount: 340,
    rating: 4.5,
    ratingCount: 24,
    auditStatus: 'audited',
    featured: false,
    tags: ['multisig', 'governance', 'threshold', 'team'],
  },
]

// Map SDK ModuleType (bigint) to display string
function mapModuleType(type: bigint): ModuleCardData['moduleType'] {
  switch (type) {
    case MODULE_TYPE.VALIDATOR:
      return 'validator'
    case MODULE_TYPE.EXECUTOR:
      return 'executor'
    case MODULE_TYPE.HOOK:
      return 'hook'
    case MODULE_TYPE.FALLBACK:
      return 'fallback'
    default:
      return 'validator'
  }
}

// Map SDK module tags to a category
function inferCategory(tags: string[]): string {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()))
  if (tagSet.has('security') || tagSet.has('ecdsa') || tagSet.has('signature')) return 'security'
  if (tagSet.has('defi') || tagSet.has('swap') || tagSet.has('lending')) return 'defi'
  if (tagSet.has('recovery') || tagSet.has('guardian') || tagSet.has('social')) return 'social-recovery'
  if (tagSet.has('governance') || tagSet.has('multisig') || tagSet.has('threshold')) return 'governance'
  if (tagSet.has('privacy') || tagSet.has('stealth') || tagSet.has('anonymous')) return 'privacy'
  if (tagSet.has('automation') || tagSet.has('subscription') || tagSet.has('recurring')) return 'automation'
  return 'utility'
}

// Map SDK module ID from name (kebab-case)
function nameToId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

// Map a registry entry to the display format
function registryEntryToCardData(entry: ModuleRegistryEntry): ModuleCardData {
  const meta = entry.metadata
  return {
    id: nameToId(meta.name),
    name: meta.name,
    description: meta.description,
    version: meta.version,
    moduleType: mapModuleType(meta.type),
    category: inferCategory(meta.tags),
    author: meta.author ?? 'StableNet',
    installCount: 0, // Not tracked on-chain
    rating: meta.isVerified ? 4.5 : 4.0,
    ratingCount: 0,
    auditStatus: meta.isVerified ? 'verified' : meta.auditUrl ? 'audited' : 'community-reviewed',
    featured: meta.isVerified,
    tags: meta.tags,
  }
}

export interface UseModuleRegistryReturn {
  modules: ModuleCardData[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useModuleRegistry(): UseModuleRegistryReturn {
  const chainId = useChainId()
  const [registryModules, setRegistryModules] = useState<ModuleCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadModules = useCallback(() => {
    setIsLoading(true)
    setError(null)

    try {
      const registry = createModuleRegistry({ chainId })
      const entries = registry.getAll()

      if (entries.length > 0) {
        const mapped = entries.map(registryEntryToCardData)

        // Merge with fallback data for install counts, ratings, etc.
        const enriched = mapped.map((mod) => {
          const fallback = FALLBACK_CATALOG.find((f) => f.id === mod.id)
          if (fallback) {
            return {
              ...mod,
              installCount: fallback.installCount,
              rating: fallback.rating,
              ratingCount: fallback.ratingCount,
              auditStatus: fallback.auditStatus,
              featured: fallback.featured,
              category: fallback.category,
            }
          }
          return mod
        })

        setRegistryModules(enriched)
      } else {
        // No registry modules available, use fallback
        setRegistryModules(FALLBACK_CATALOG)
      }
    } catch {
      // Registry unavailable, use fallback catalog
      setRegistryModules(FALLBACK_CATALOG)
      setError('Failed to load module registry, using cached modules')
    } finally {
      setIsLoading(false)
    }
  }, [chainId])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  // Return registry modules, or fallback if empty
  const modules = registryModules.length > 0 ? registryModules : FALLBACK_CATALOG

  return {
    modules,
    isLoading,
    error,
    refetch: loadModules,
  }
}

// Re-export the fallback catalog for use elsewhere if needed
export { FALLBACK_CATALOG }
