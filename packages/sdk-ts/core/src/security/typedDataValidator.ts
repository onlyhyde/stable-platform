/**
 * EIP-712 Typed Data Domain Validator
 *
 * Validates typed data domain parameters to prevent phishing attacks:
 * - Domain structure validation
 * - Chain ID matching with current network
 * - Verifying contract address validation
 * - Origin/domain name mismatch detection
 * - Suspicious pattern detection
 */

import { isAddress } from 'viem'

export interface TypedDataDomain {
  name?: string
  version?: string
  chainId?: number | string
  verifyingContract?: string
  salt?: string
}

export interface TypedData {
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  domain: TypedDataDomain
  message: Record<string, unknown>
}

export interface DomainValidationResult {
  isValid: boolean
  warnings: DomainWarning[]
  errors: string[]
}

export interface DomainWarning {
  type: DomainWarningType
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export type DomainWarningType =
  | 'chain_mismatch'
  | 'domain_origin_mismatch'
  | 'missing_chain_id'
  | 'missing_verifying_contract'
  | 'invalid_verifying_contract'
  | 'suspicious_domain_name'
  | 'empty_domain'
  | 'permit_signature'
  | 'high_value_approval'

/**
 * Known legitimate domain names for common protocols
 */
const KNOWN_PROTOCOL_DOMAINS: Record<string, string[]> = {
  uniswap: ['app.uniswap.org', 'uniswap.org'],
  opensea: ['opensea.io'],
  aave: ['app.aave.com', 'aave.com'],
  compound: ['app.compound.finance', 'compound.finance'],
  '1inch': ['app.1inch.io', '1inch.io'],
  sushiswap: ['app.sushi.com', 'sushi.com'],
  curve: ['curve.fi'],
  balancer: ['app.balancer.fi', 'balancer.fi'],
  lido: ['stake.lido.fi', 'lido.fi'],
}

/**
 * Suspicious patterns in domain names (potential phishing)
 */
const SUSPICIOUS_PATTERNS = [
  /uniswap[^.]/i, // uniswapx, uniswaps, etc.
  /opensea[^.]/i,
  /metamask/i, // MetaMask doesn't use typed data domains
  /wallet.*connect/i,
  /airdrop/i,
  /claim.*reward/i,
  /free.*nft/i,
  /urgent/i,
]

/**
 * EIP-712 Typed Data Domain Validator
 */
export class TypedDataValidator {
  /**
   * Validate typed data structure and domain
   */
  validateTypedData(
    typedData: unknown,
    currentChainId: number,
    requestOrigin: string
  ): DomainValidationResult {
    const errors: string[] = []
    const warnings: DomainWarning[] = []

    // Basic structure validation
    if (!typedData || typeof typedData !== 'object') {
      errors.push('Typed data must be an object')
      return { isValid: false, warnings, errors }
    }

    const data = typedData as Partial<TypedData>

    // Validate required fields
    if (!data.types || typeof data.types !== 'object') {
      errors.push('Typed data must have "types" field')
    }

    if (!data.primaryType || typeof data.primaryType !== 'string') {
      errors.push('Typed data must have "primaryType" field')
    }

    if (!data.message || typeof data.message !== 'object') {
      errors.push('Typed data must have "message" field')
    }

    // Domain validation
    if (!data.domain || typeof data.domain !== 'object') {
      errors.push('Typed data must have "domain" field')
      return { isValid: errors.length === 0, warnings, errors }
    }

    // Validate domain fields
    const domainWarnings = this.validateDomain(data.domain, currentChainId, requestOrigin)
    warnings.push(...domainWarnings)

    // Check for permit signatures (high risk)
    if (this.isPermitSignature(data)) {
      warnings.push({
        type: 'permit_signature',
        message: 'This is a token permit signature that grants spending approval',
        severity: 'high',
      })
    }

    // Check for high value approvals
    const highValueWarning = this.checkHighValueApproval(data)
    if (highValueWarning) {
      warnings.push(highValueWarning)
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    }
  }

  /**
   * Validate domain fields
   */
  private validateDomain(
    domain: TypedDataDomain,
    currentChainId: number,
    requestOrigin: string
  ): DomainWarning[] {
    const warnings: DomainWarning[] = []

    // Check for empty domain
    if (Object.keys(domain).length === 0) {
      warnings.push({
        type: 'empty_domain',
        message: 'Domain is empty - signature may be replayable across different contexts',
        severity: 'medium',
      })
      return warnings
    }

    // Validate chain ID
    if (domain.chainId !== undefined) {
      const domainChainId =
        typeof domain.chainId === 'string'
          ? Number.parseInt(domain.chainId, domain.chainId.startsWith('0x') ? 16 : 10)
          : domain.chainId

      if (domainChainId !== currentChainId) {
        warnings.push({
          type: 'chain_mismatch',
          message: `Domain chain ID (${domainChainId}) does not match current network (${currentChainId})`,
          severity: 'critical',
        })
      }
    } else {
      warnings.push({
        type: 'missing_chain_id',
        message: 'Domain does not specify chain ID - signature may be valid on multiple chains',
        severity: 'medium',
      })
    }

    // Validate verifying contract
    if (domain.verifyingContract) {
      if (!isAddress(domain.verifyingContract)) {
        warnings.push({
          type: 'invalid_verifying_contract',
          message: 'Verifying contract is not a valid address',
          severity: 'high',
        })
      }
    } else {
      warnings.push({
        type: 'missing_verifying_contract',
        message: 'Domain does not specify verifying contract',
        severity: 'low',
      })
    }

    // Check domain name against origin
    if (domain.name) {
      const originMismatchWarning = this.checkDomainOriginMismatch(domain.name, requestOrigin)
      if (originMismatchWarning) {
        warnings.push(originMismatchWarning)
      }

      // Check for suspicious patterns
      const suspiciousWarning = this.checkSuspiciousDomainName(domain.name)
      if (suspiciousWarning) {
        warnings.push(suspiciousWarning)
      }
    }

    return warnings
  }

  /**
   * Check if domain name matches the requesting origin
   */
  private checkDomainOriginMismatch(
    domainName: string,
    requestOrigin: string
  ): DomainWarning | null {
    const normalizedDomainName = domainName.toLowerCase()
    const normalizedOrigin = requestOrigin.toLowerCase()

    // Extract hostname from origin
    let originHost: string
    try {
      const url = new URL(normalizedOrigin)
      originHost = url.hostname
    } catch {
      originHost = normalizedOrigin
    }

    // Check if domain name matches origin
    const domainNameParts = normalizedDomainName.split(/[\s-_]/)
    const originParts = originHost.split('.')

    // Check for known protocols
    for (const [protocol, domains] of Object.entries(KNOWN_PROTOCOL_DOMAINS)) {
      if (normalizedDomainName.includes(protocol)) {
        const isFromLegitimateOrigin = domains.some(
          (d) => originHost.includes(d) || originHost.endsWith(d)
        )
        if (!isFromLegitimateOrigin) {
          return {
            type: 'domain_origin_mismatch',
            message: `Domain claims to be "${domainName}" but request is from ${originHost}. This may be a phishing attempt.`,
            severity: 'critical',
          }
        }
      }
    }

    // Generic mismatch check - warn if domain name doesn't seem related to origin
    const hasMatchingPart = domainNameParts.some((part) =>
      originParts.some((originPart) => originPart.includes(part) || part.includes(originPart))
    )

    if (!hasMatchingPart && domainName.length > 3) {
      return {
        type: 'domain_origin_mismatch',
        message: `Domain name "${domainName}" does not match the requesting site (${originHost})`,
        severity: 'medium',
      }
    }

    return null
  }

  /**
   * Check for suspicious patterns in domain name
   */
  private checkSuspiciousDomainName(domainName: string): DomainWarning | null {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(domainName)) {
        return {
          type: 'suspicious_domain_name',
          message: `Domain name "${domainName}" contains suspicious patterns commonly used in phishing`,
          severity: 'high',
        }
      }
    }
    return null
  }

  /**
   * Check if this is a permit signature (EIP-2612)
   */
  private isPermitSignature(data: Partial<TypedData>): boolean {
    if (!data.primaryType || !data.types) {
      return false
    }

    const primaryType = data.primaryType.toLowerCase()

    // Common permit type names
    if (primaryType === 'permit' || primaryType === 'permit2') {
      return true
    }

    // Check message fields for permit-like structure
    if (data.message) {
      const messageKeys = Object.keys(data.message).map((k) => k.toLowerCase())
      const permitIndicators = ['spender', 'value', 'nonce', 'deadline', 'allowed']
      const matchCount = permitIndicators.filter((ind) => messageKeys.includes(ind)).length

      if (matchCount >= 3) {
        return true
      }
    }

    return false
  }

  /**
   * Check for high value approval in message
   */
  private checkHighValueApproval(data: Partial<TypedData>): DomainWarning | null {
    if (!data.message) {
      return null
    }

    const message = data.message as Record<string, unknown>

    // Check for max uint256 value (unlimited approval)
    const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    const MAX_UINT256_DEC =
      '115792089237316195423570985008687907853269984665640564039457584007913129639935'

    const valueFields = ['value', 'amount', 'allowed', 'allowance']

    for (const field of valueFields) {
      const value = message[field]
      if (value !== undefined) {
        const strValue = String(value).toLowerCase()
        if (strValue === MAX_UINT256 || strValue === MAX_UINT256_DEC) {
          return {
            type: 'high_value_approval',
            message: 'This signature grants unlimited token spending approval',
            severity: 'critical',
          }
        }
      }
    }

    return null
  }

  /**
   * Get overall risk level from warnings
   */
  getRiskLevel(warnings: DomainWarning[]): 'low' | 'medium' | 'high' | 'critical' {
    if (warnings.some((w) => w.severity === 'critical')) {
      return 'critical'
    }
    if (warnings.some((w) => w.severity === 'high')) {
      return 'high'
    }
    if (warnings.some((w) => w.severity === 'medium')) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * Format warnings for user display
   */
  formatWarningsForDisplay(warnings: DomainWarning[]): string[] {
    return warnings
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })
      .map((w) => {
        const prefix =
          w.severity === 'critical'
            ? '🚨'
            : w.severity === 'high'
              ? '⚠️'
              : w.severity === 'medium'
                ? '⚡'
                : 'ℹ️'
        return `${prefix} ${w.message}`
      })
  }
}

/**
 * Create a new TypedDataValidator instance
 */
export function createTypedDataValidator(): TypedDataValidator {
  return new TypedDataValidator()
}
