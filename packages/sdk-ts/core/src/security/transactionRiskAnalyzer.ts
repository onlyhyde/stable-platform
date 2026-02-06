/**
 * Transaction Risk Analyzer
 *
 * Comprehensive transaction risk assessment to detect:
 * - High-value transactions
 * - Token approvals and transfers
 * - Contract interactions with known malicious patterns
 * - Suspicious recipient addresses
 * - Gas price manipulation
 */

import type { Address } from 'viem'

/**
 * Risk level enumeration
 */
export const TransactionRiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type TransactionRiskLevelType =
  (typeof TransactionRiskLevel)[keyof typeof TransactionRiskLevel]

/**
 * Risk type enumeration
 */
export const TransactionRiskType = {
  HIGH_VALUE: 'high_value',
  TOKEN_APPROVAL: 'token_approval',
  UNLIMITED_APPROVAL: 'unlimited_approval',
  NFT_APPROVAL_ALL: 'nft_approval_all',
  TOKEN_TRANSFER: 'token_transfer',
  CONTRACT_INTERACTION: 'contract_interaction',
  ZERO_ADDRESS: 'zero_address',
  SELF_TRANSFER: 'self_transfer',
  HIGH_GAS_PRICE: 'high_gas_price',
  SUSPICIOUS_DATA: 'suspicious_data',
  UNKNOWN_CONTRACT: 'unknown_contract',
  EMPTY_DATA_WITH_VALUE: 'empty_data_with_value',
  POSSIBLE_PHISHING: 'possible_phishing',
} as const

export type TransactionRiskTypeValue =
  (typeof TransactionRiskType)[keyof typeof TransactionRiskType]

/**
 * Transaction analysis result
 */
export interface TransactionRiskResult {
  riskLevel: TransactionRiskLevelType
  riskScore: number
  riskTypes: TransactionRiskTypeValue[]
  warnings: string[]
  summary: string
  decodedMethod?: DecodedMethod
}

/**
 * Decoded method info
 */
export interface DecodedMethod {
  selector: string
  name: string
  params?: Record<string, unknown>
}

/**
 * Transaction parameters for risk analysis
 */
export interface TransactionRiskParams {
  from: Address
  to: Address | null
  value: bigint
  data?: string
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

/**
 * Risk score mappings
 */
const RISK_SCORES: Record<TransactionRiskLevelType, number> = {
  [TransactionRiskLevel.SAFE]: 0,
  [TransactionRiskLevel.LOW]: 20,
  [TransactionRiskLevel.MEDIUM]: 50,
  [TransactionRiskLevel.HIGH]: 75,
  [TransactionRiskLevel.CRITICAL]: 95,
}

/**
 * Known ERC-20 method selectors
 */
const ERC20_SELECTORS = {
  // transfer(address,uint256)
  TRANSFER: '0xa9059cbb',
  // approve(address,uint256)
  APPROVE: '0x095ea7b3',
  // transferFrom(address,address,uint256)
  TRANSFER_FROM: '0x23b872dd',
  // increaseAllowance(address,uint256)
  INCREASE_ALLOWANCE: '0x39509351',
  // decreaseAllowance(address,uint256)
  DECREASE_ALLOWANCE: '0xa457c2d7',
} as const

/**
 * Known ERC-721/1155 method selectors
 */
const NFT_SELECTORS = {
  // setApprovalForAll(address,bool)
  SET_APPROVAL_FOR_ALL: '0xa22cb465',
  // safeTransferFrom(address,address,uint256)
  SAFE_TRANSFER_FROM_721: '0x42842e0e',
  // safeTransferFrom(address,address,uint256,bytes)
  SAFE_TRANSFER_FROM_721_DATA: '0xb88d4fde',
  // safeTransferFrom(address,address,uint256,uint256,bytes)
  SAFE_TRANSFER_FROM_1155: '0xf242432a',
  // safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)
  SAFE_BATCH_TRANSFER_FROM_1155: '0x2eb2c2d6',
} as const

/**
 * Dangerous/suspicious selectors
 */
const DANGEROUS_SELECTORS = {
  // multicall(bytes[])
  MULTICALL: '0xac9650d8',
  // execute(address,uint256,bytes)
  EXECUTE: '0xb61d27f6',
  // delegatecall patterns
  DELEGATE: '0x5c19a95c',
  // selfdestruct trigger patterns
  SELFDESTRUCT: '0xff',
} as const

/**
 * Max uint256 value (unlimited approval)
 */
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

/**
 * Zero address
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Value thresholds (in wei)
 */
const VALUE_THRESHOLDS = {
  // 1 ETH
  MEDIUM: BigInt(10) ** BigInt(18),
  // 10 ETH
  HIGH: BigInt(10) * BigInt(10) ** BigInt(18),
  // 100 ETH
  CRITICAL: BigInt(100) * BigInt(10) ** BigInt(18),
}

/**
 * Gas price thresholds (in gwei)
 */
const GAS_PRICE_THRESHOLDS = {
  // 100 gwei
  HIGH: BigInt(100) * BigInt(10) ** BigInt(9),
  // 500 gwei
  VERY_HIGH: BigInt(500) * BigInt(10) ** BigInt(9),
}

/**
 * Transaction Risk Analyzer
 */
export class TransactionRiskAnalyzer {
  /**
   * Analyze a transaction for risks
   */
  analyzeTransaction(params: TransactionRiskParams): TransactionRiskResult {
    const warnings: string[] = []
    const riskTypes: TransactionRiskTypeValue[] = []
    let maxRiskLevel: TransactionRiskLevelType = TransactionRiskLevel.SAFE

    const { from, to, value, data, gasPrice, maxFeePerGas } = params

    // Helper to upgrade risk level
    const upgradeRisk = (level: TransactionRiskLevelType) => {
      const levels = Object.values(TransactionRiskLevel)
      if (levels.indexOf(level) > levels.indexOf(maxRiskLevel)) {
        maxRiskLevel = level
      }
    }

    // 1. Check for null/zero address recipient
    if (!to || to.toLowerCase() === ZERO_ADDRESS) {
      riskTypes.push(TransactionRiskType.ZERO_ADDRESS)
      if (!to) {
        warnings.push('Contract deployment transaction')
        upgradeRisk(TransactionRiskLevel.MEDIUM)
      } else {
        warnings.push('Sending to zero address - funds will be lost!')
        upgradeRisk(TransactionRiskLevel.CRITICAL)
      }
    }

    // 2. Check for self-transfer
    if (to && from.toLowerCase() === to.toLowerCase()) {
      riskTypes.push(TransactionRiskType.SELF_TRANSFER)
      warnings.push('Sending to your own address')
      upgradeRisk(TransactionRiskLevel.LOW)
    }

    // 3. Check transaction value
    if (value > 0n) {
      if (value >= VALUE_THRESHOLDS.CRITICAL) {
        riskTypes.push(TransactionRiskType.HIGH_VALUE)
        warnings.push('Very high value transaction (≥100 ETH equivalent)')
        upgradeRisk(TransactionRiskLevel.CRITICAL)
      } else if (value >= VALUE_THRESHOLDS.HIGH) {
        riskTypes.push(TransactionRiskType.HIGH_VALUE)
        warnings.push('High value transaction (≥10 ETH equivalent)')
        upgradeRisk(TransactionRiskLevel.HIGH)
      } else if (value >= VALUE_THRESHOLDS.MEDIUM) {
        riskTypes.push(TransactionRiskType.HIGH_VALUE)
        warnings.push('Moderate value transaction (≥1 ETH equivalent)')
        upgradeRisk(TransactionRiskLevel.MEDIUM)
      }
    }

    // 4. Check gas price
    const effectiveGasPrice = maxFeePerGas || gasPrice
    if (effectiveGasPrice) {
      if (effectiveGasPrice >= GAS_PRICE_THRESHOLDS.VERY_HIGH) {
        riskTypes.push(TransactionRiskType.HIGH_GAS_PRICE)
        warnings.push('Extremely high gas price (≥500 gwei)')
        upgradeRisk(TransactionRiskLevel.HIGH)
      } else if (effectiveGasPrice >= GAS_PRICE_THRESHOLDS.HIGH) {
        riskTypes.push(TransactionRiskType.HIGH_GAS_PRICE)
        warnings.push('High gas price (≥100 gwei)')
        upgradeRisk(TransactionRiskLevel.MEDIUM)
      }
    }

    // 5. Analyze contract interaction data
    if (data && data !== '0x' && data.length > 2) {
      const dataAnalysis = this.analyzeData(data)
      riskTypes.push(...dataAnalysis.riskTypes)
      warnings.push(...dataAnalysis.warnings)
      upgradeRisk(dataAnalysis.riskLevel)
    } else if (value === 0n && to) {
      // No data and no value - suspicious
      riskTypes.push(TransactionRiskType.SUSPICIOUS_DATA)
      warnings.push('Transaction has no value and no data')
      upgradeRisk(TransactionRiskLevel.LOW)
    }

    return {
      riskLevel: maxRiskLevel,
      riskScore: RISK_SCORES[maxRiskLevel],
      riskTypes,
      warnings,
      summary: this.generateSummary(maxRiskLevel, riskTypes),
      decodedMethod: data ? this.decodeMethod(data) : undefined,
    }
  }

  /**
   * Analyze transaction data for contract interaction risks
   */
  private analyzeData(data: string): {
    riskLevel: TransactionRiskLevelType
    riskTypes: TransactionRiskTypeValue[]
    warnings: string[]
  } {
    const warnings: string[] = []
    const riskTypes: TransactionRiskTypeValue[] = []
    let riskLevel: TransactionRiskLevelType = TransactionRiskLevel.LOW

    // Get function selector (first 4 bytes)
    const selector = data.slice(0, 10).toLowerCase()

    // Mark as contract interaction
    riskTypes.push(TransactionRiskType.CONTRACT_INTERACTION)
    warnings.push('Transaction interacts with a smart contract')

    // Check for ERC-20 approve
    if (selector === ERC20_SELECTORS.APPROVE) {
      riskTypes.push(TransactionRiskType.TOKEN_APPROVAL)
      warnings.push('Token approval requested')
      riskLevel = TransactionRiskLevel.MEDIUM

      // Check for unlimited approval
      if (this.isUnlimitedApproval(data)) {
        riskTypes.push(TransactionRiskType.UNLIMITED_APPROVAL)
        warnings.push('UNLIMITED token approval - spender can take all tokens!')
        riskLevel = TransactionRiskLevel.HIGH
      }
    }

    // Check for ERC-20 transfer
    if (selector === ERC20_SELECTORS.TRANSFER || selector === ERC20_SELECTORS.TRANSFER_FROM) {
      riskTypes.push(TransactionRiskType.TOKEN_TRANSFER)
      warnings.push('Token transfer requested')
      riskLevel = TransactionRiskLevel.MEDIUM
    }

    // Check for NFT setApprovalForAll
    if (selector === NFT_SELECTORS.SET_APPROVAL_FOR_ALL) {
      riskTypes.push(TransactionRiskType.NFT_APPROVAL_ALL)
      warnings.push('NFT approval for ALL tokens in collection!')
      riskLevel = TransactionRiskLevel.HIGH

      // Check if enabling (true) or disabling (false)
      if (this.isApprovalEnabled(data)) {
        warnings.push('This grants full access to all your NFTs in this collection')
        riskLevel = TransactionRiskLevel.CRITICAL
      }
    }

    // Check for NFT transfers
    if (
      selector === NFT_SELECTORS.SAFE_TRANSFER_FROM_721 ||
      selector === NFT_SELECTORS.SAFE_TRANSFER_FROM_721_DATA ||
      selector === NFT_SELECTORS.SAFE_TRANSFER_FROM_1155 ||
      selector === NFT_SELECTORS.SAFE_BATCH_TRANSFER_FROM_1155
    ) {
      riskTypes.push(TransactionRiskType.TOKEN_TRANSFER)
      warnings.push('NFT transfer requested')
      riskLevel = TransactionRiskLevel.MEDIUM
    }

    // Check for dangerous selectors
    if (selector === DANGEROUS_SELECTORS.MULTICALL) {
      warnings.push('Multicall transaction - multiple actions in one')
      riskLevel = TransactionRiskLevel.HIGH
    }

    if (selector === DANGEROUS_SELECTORS.EXECUTE) {
      warnings.push('Execute function - may perform arbitrary actions')
      riskLevel = TransactionRiskLevel.HIGH
    }

    return { riskLevel, riskTypes, warnings }
  }

  /**
   * Check if approval amount is unlimited (max uint256)
   */
  private isUnlimitedApproval(data: string): boolean {
    // approve(address,uint256) - amount is last 32 bytes
    if (data.length < 74) return false // 10 + 64 = 74 (selector + address + amount)

    const amountHex = `0x${data.slice(74, 138)}`
    return amountHex.toLowerCase() === MAX_UINT256.toLowerCase()
  }

  /**
   * Check if setApprovalForAll is enabling (true) approval
   */
  private isApprovalEnabled(data: string): boolean {
    // setApprovalForAll(address,bool) - bool is last 32 bytes
    if (data.length < 138) return true // Assume true if can't parse

    const boolHex = data.slice(138, 202)
    // Last byte indicates true/false
    return boolHex.endsWith('1')
  }

  /**
   * Decode method selector to human-readable name
   */
  private decodeMethod(data: string): DecodedMethod | undefined {
    if (data.length < 10) return undefined

    const selector = data.slice(0, 10).toLowerCase()

    const KNOWN_METHODS: Record<string, string> = {
      [ERC20_SELECTORS.TRANSFER]: 'transfer',
      [ERC20_SELECTORS.APPROVE]: 'approve',
      [ERC20_SELECTORS.TRANSFER_FROM]: 'transferFrom',
      [ERC20_SELECTORS.INCREASE_ALLOWANCE]: 'increaseAllowance',
      [ERC20_SELECTORS.DECREASE_ALLOWANCE]: 'decreaseAllowance',
      [NFT_SELECTORS.SET_APPROVAL_FOR_ALL]: 'setApprovalForAll',
      [NFT_SELECTORS.SAFE_TRANSFER_FROM_721]: 'safeTransferFrom',
      [NFT_SELECTORS.SAFE_TRANSFER_FROM_721_DATA]: 'safeTransferFrom',
      [NFT_SELECTORS.SAFE_TRANSFER_FROM_1155]: 'safeTransferFrom',
      [NFT_SELECTORS.SAFE_BATCH_TRANSFER_FROM_1155]: 'safeBatchTransferFrom',
      [DANGEROUS_SELECTORS.MULTICALL]: 'multicall',
      [DANGEROUS_SELECTORS.EXECUTE]: 'execute',
    }

    return {
      selector,
      name: KNOWN_METHODS[selector] || 'unknown',
    }
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    riskLevel: TransactionRiskLevelType,
    riskTypes: TransactionRiskTypeValue[]
  ): string {
    const riskText: Record<TransactionRiskLevelType, string> = {
      [TransactionRiskLevel.SAFE]: 'Safe',
      [TransactionRiskLevel.LOW]: 'Low risk',
      [TransactionRiskLevel.MEDIUM]: 'Medium risk',
      [TransactionRiskLevel.HIGH]: 'High risk',
      [TransactionRiskLevel.CRITICAL]: 'CRITICAL RISK',
    }

    if (riskTypes.length === 0) {
      return `${riskText[riskLevel]}: Simple value transfer`
    }

    const typeDescriptions: Record<TransactionRiskTypeValue, string> = {
      [TransactionRiskType.HIGH_VALUE]: 'high value',
      [TransactionRiskType.TOKEN_APPROVAL]: 'token approval',
      [TransactionRiskType.UNLIMITED_APPROVAL]: 'unlimited approval',
      [TransactionRiskType.NFT_APPROVAL_ALL]: 'NFT collection approval',
      [TransactionRiskType.TOKEN_TRANSFER]: 'token transfer',
      [TransactionRiskType.CONTRACT_INTERACTION]: 'contract interaction',
      [TransactionRiskType.ZERO_ADDRESS]: 'zero address',
      [TransactionRiskType.SELF_TRANSFER]: 'self transfer',
      [TransactionRiskType.HIGH_GAS_PRICE]: 'high gas',
      [TransactionRiskType.SUSPICIOUS_DATA]: 'suspicious',
      [TransactionRiskType.UNKNOWN_CONTRACT]: 'unknown contract',
      [TransactionRiskType.EMPTY_DATA_WITH_VALUE]: 'unusual',
      [TransactionRiskType.POSSIBLE_PHISHING]: 'possible phishing',
    }

    const descriptions = riskTypes
      .filter((t) => typeDescriptions[t])
      .map((t) => typeDescriptions[t])
      .slice(0, 3) // Limit to 3 descriptions

    return `${riskText[riskLevel]}: ${descriptions.join(', ')}`
  }
}

/**
 * Create a new TransactionRiskAnalyzer instance
 */
export function createTransactionRiskAnalyzer(): TransactionRiskAnalyzer {
  return new TransactionRiskAnalyzer()
}
