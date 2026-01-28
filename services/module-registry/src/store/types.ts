/**
 * Module type enum matching ERC-7579 module types
 */
export type ModuleType = 'validator' | 'executor' | 'hook' | 'fallback'

/**
 * Module category for marketplace browsing
 */
export type ModuleCategory =
  | 'security'
  | 'defi'
  | 'governance'
  | 'social-recovery'
  | 'automation'
  | 'privacy'
  | 'identity'
  | 'utility'

/**
 * Module audit status
 */
export type AuditStatus = 'unaudited' | 'community-reviewed' | 'audited' | 'verified'

/**
 * Module metadata stored in the registry
 */
export interface ModuleMetadata {
  /** Unique module ID */
  id: string
  /** Module name */
  name: string
  /** Short description */
  description: string
  /** Module version (semver) */
  version: string
  /** ERC-7579 module type */
  moduleType: ModuleType
  /** Marketplace category */
  category: ModuleCategory
  /** Contract address on each chain */
  addresses: Record<number, string>
  /** Author/publisher */
  author: string
  /** Author's wallet address */
  authorAddress: string
  /** Repository URL */
  repositoryUrl?: string
  /** Documentation URL */
  documentationUrl?: string
  /** Audit status */
  auditStatus: AuditStatus
  /** Audit report URL (if audited) */
  auditReportUrl?: string
  /** Tags for search */
  tags: string[]
  /** Number of installations */
  installCount: number
  /** Average rating (1-5) */
  rating: number
  /** Number of ratings */
  ratingCount: number
  /** ABI JSON (for interaction) */
  abi?: string
  /** Icon URL */
  iconUrl?: string
  /** Whether module is featured */
  featured: boolean
  /** Whether module is deprecated */
  deprecated: boolean
  /** Minimum compatible kernel version */
  minKernelVersion?: string
  /** Created timestamp */
  createdAt: string
  /** Last updated timestamp */
  updatedAt: string
}

/**
 * Module installation record
 */
export interface ModuleInstallation {
  /** Installation ID */
  id: string
  /** Module ID */
  moduleId: string
  /** Smart account address */
  accountAddress: string
  /** Chain ID */
  chainId: number
  /** Installation transaction hash */
  txHash: string
  /** Installation timestamp */
  installedAt: string
  /** Whether currently active */
  active: boolean
}

/**
 * Module review
 */
export interface ModuleReview {
  /** Review ID */
  id: string
  /** Module ID */
  moduleId: string
  /** Reviewer address */
  reviewerAddress: string
  /** Rating (1-5) */
  rating: number
  /** Review text */
  comment: string
  /** Created timestamp */
  createdAt: string
}
