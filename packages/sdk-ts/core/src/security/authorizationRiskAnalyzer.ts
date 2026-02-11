/**
 * EIP-7702 Authorization Risk Analyzer
 *
 * Analyzes EIP-7702 authorization requests for potential risks
 * and provides warnings to users.
 */

import type { Address } from 'viem'
import { DELEGATE_PRESETS, ZERO_ADDRESS } from '../eip7702'

/**
 * Check if an address is the zero address (revocation)
 */
function isRevocationAddress(address: Address): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
}

export type AuthorizationRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface AuthorizationRiskResult {
  riskLevel: AuthorizationRiskLevel
  warnings: string[]
  isKnownContract: boolean
  contractInfo?: {
    name: string
    description: string
    features: string[]
  }
}

export interface AuthorizationRiskParams {
  account: Address
  contractAddress: Address
  chainId: number
  origin: string
}

/**
 * Analyze an EIP-7702 authorization request for risks
 */
export function analyzeAuthorizationRisk(params: AuthorizationRiskParams): AuthorizationRiskResult {
  const { contractAddress, chainId, origin } = params
  const warnings: string[] = []
  let riskLevel: AuthorizationRiskLevel = 'low'
  let isKnownContract = false
  let contractInfo: AuthorizationRiskResult['contractInfo']

  // Check if this is a revocation
  if (isRevocationAddress(contractAddress)) {
    return {
      riskLevel: 'low',
      warnings: ['This will revoke your smart account delegation and return to a regular EOA.'],
      isKnownContract: true,
      contractInfo: {
        name: 'Revocation',
        description: 'Remove smart account delegation',
        features: ['Return to EOA'],
      },
    }
  }

  // Check if contract is in known presets
  const presets = DELEGATE_PRESETS[chainId] || []
  const knownContract = presets.find(
    (p) => p.address.toLowerCase() === contractAddress.toLowerCase()
  )

  if (knownContract) {
    isKnownContract = true
    contractInfo = {
      name: knownContract.name,
      description: knownContract.description,
      features: knownContract.features,
    }
  } else {
    // Unknown contract - higher risk
    riskLevel = 'high'
    warnings.push(
      'This contract is not recognized. Delegating to an unknown contract may put your funds at risk.'
    )
  }

  // Check for suspicious patterns in origin
  if (origin && !origin.includes('localhost') && !origin.includes('stablenet')) {
    if (!isKnownContract) {
      warnings.push(
        `Request from ${origin}. Verify this is a trusted application before proceeding.`
      )
    }
  }

  // Warn about implications of delegation
  warnings.push(
    'By signing this authorization, your account will be able to execute smart contract logic. ' +
      'This enables features like gas sponsorship and batch transactions, but also means ' +
      'the delegate contract controls how your account behaves.'
  )

  // Check for mainnet (extra caution)
  if (chainId === 1) {
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
    warnings.push(
      'This is a mainnet authorization. Proceed with extra caution as real funds are involved.'
    )
  }

  // Check for zero address (should not happen but catch it)
  if (contractAddress === ZERO_ADDRESS) {
    return {
      riskLevel: 'low',
      warnings: ['This will revoke your smart account delegation.'],
      isKnownContract: true,
    }
  }

  return {
    riskLevel,
    warnings,
    isKnownContract,
    contractInfo,
  }
}

/**
 * Get a human-readable summary of the authorization
 */
export function getAuthorizationSummary(params: {
  contractAddress: Address
  chainId: number
  isKnownContract: boolean
  contractInfo?: { name: string }
}): string {
  const { contractAddress, chainId, isKnownContract, contractInfo } = params

  if (isRevocationAddress(contractAddress)) {
    return 'Revoke Smart Account'
  }

  if (isKnownContract && contractInfo) {
    return `Upgrade to ${contractInfo.name}`
  }

  const shortAddress = `${contractAddress.slice(0, 8)}...${contractAddress.slice(-6)}`
  return `Delegate to ${shortAddress} (Chain ${chainId})`
}

/**
 * Format risk warnings for display in UI
 */
export function formatRiskWarningsForUI(result: AuthorizationRiskResult): Array<{
  type: 'info' | 'warning' | 'danger'
  message: string
}> {
  return result.warnings.map((warning) => {
    let type: 'info' | 'warning' | 'danger' = 'info'

    if (
      warning.includes('not recognized') ||
      warning.includes('unknown') ||
      warning.includes('risk')
    ) {
      type = 'danger'
    } else if (
      warning.includes('caution') ||
      warning.includes('verify') ||
      warning.includes('mainnet')
    ) {
      type = 'warning'
    }

    return { type, message: warning }
  })
}
