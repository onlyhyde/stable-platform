/**
 * Signature Risk Analyzer
 * Analyzes signing requests for potential security risks
 */

/**
 * Signature method enumeration
 */
export const SignatureMethod = {
  ETH_SIGN: 'eth_sign',
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
} as const

export type SignatureMethodType = (typeof SignatureMethod)[keyof typeof SignatureMethod]

/**
 * Risk level enumeration
 */
export const SignatureRiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type SignatureRiskLevelType = (typeof SignatureRiskLevel)[keyof typeof SignatureRiskLevel]

/**
 * Risk type enumeration
 */
export const SignatureRiskType = {
  BLIND_SIGNING: 'blind_signing',
  TOKEN_APPROVAL: 'token_approval',
  UNLIMITED_APPROVAL: 'unlimited_approval',
  NFT_APPROVAL_ALL: 'nft_approval_all',
  MALFORMED_DATA: 'malformed_data',
  SUSPICIOUS_MESSAGE: 'suspicious_message',
  LEGACY_FORMAT: 'legacy_format',
} as const

export type SignatureRiskTypeValue = (typeof SignatureRiskType)[keyof typeof SignatureRiskType]

/**
 * EIP-712 Typed Data structure
 */
export interface EIP712TypedData {
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  domain: Record<string, unknown>
  message: Record<string, unknown>
}

/**
 * Contract interaction info
 */
export interface ContractInteraction {
  verifyingContract?: string
  spender?: string
  operator?: string
}

/**
 * Signature risk analysis result
 */
export interface SignatureRiskResult {
  method: SignatureMethodType
  riskLevel: SignatureRiskLevelType
  riskScore: number
  riskTypes: SignatureRiskTypeValue[]
  warnings: string[]
  summary: string
  decodedMessage?: string
  parsedTypedData?: EIP712TypedData
  contractInteraction?: ContractInteraction
}

/**
 * Max uint256 value (unlimited approval)
 */
const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

/**
 * Dangerous keywords in messages
 */
const DANGEROUS_KEYWORDS = [
  'approve',
  'unlimited',
  'transfer',
  'withdraw',
  'all tokens',
  'all nft',
  'full access',
  'spending',
]

/**
 * Risk score mappings
 */
const RISK_SCORES: Record<SignatureRiskLevelType, number> = {
  [SignatureRiskLevel.SAFE]: 0,
  [SignatureRiskLevel.LOW]: 20,
  [SignatureRiskLevel.MEDIUM]: 50,
  [SignatureRiskLevel.HIGH]: 75,
  [SignatureRiskLevel.CRITICAL]: 95,
}

/**
 * Signature Risk Analyzer
 * Analyzes signature requests for potential security risks
 */
export class SignatureRiskAnalyzer {
  /**
   * Analyze a signature request
   */
  analyzeSignature(method: SignatureMethodType, data: string): SignatureRiskResult {
    switch (method) {
      case SignatureMethod.ETH_SIGN:
        return this.analyzeEthSign(data)

      case SignatureMethod.PERSONAL_SIGN:
        return this.analyzePersonalSign(data)

      case SignatureMethod.ETH_SIGN_TYPED_DATA:
        return this.analyzeLegacyTypedData(data)

      case SignatureMethod.ETH_SIGN_TYPED_DATA_V3:
      case SignatureMethod.ETH_SIGN_TYPED_DATA_V4:
        return this.analyzeTypedDataV4(data, method)

      default:
        return this.createResult(
          method,
          SignatureRiskLevel.MEDIUM,
          [],
          ['Unknown signature method']
        )
    }
  }

  /**
   * Analyze eth_sign (blind signing - always dangerous)
   */
  private analyzeEthSign(_data: string): SignatureRiskResult {
    const warnings = [
      'eth_sign signs arbitrary data without human-readable context',
      'This method can be used to sign malicious transactions',
      'Consider using personal_sign or eth_signTypedData instead',
    ]

    return this.createResult(
      SignatureMethod.ETH_SIGN,
      SignatureRiskLevel.CRITICAL,
      [SignatureRiskType.BLIND_SIGNING],
      warnings,
      {
        summary:
          'CRITICAL: Blind signing requested. This signs raw data that could authorize any transaction.',
      }
    )
  }

  /**
   * Analyze personal_sign
   */
  private analyzePersonalSign(data: string): SignatureRiskResult {
    const decodedMessage = this.decodeMessage(data)
    const warnings: string[] = []
    const riskTypes: SignatureRiskTypeValue[] = []
    let riskLevel: SignatureRiskLevelType = SignatureRiskLevel.LOW

    // Check for dangerous keywords
    const lowerMessage = decodedMessage.toLowerCase()
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        warnings.push(`Message contains potentially dangerous keyword: "${keyword}"`)
        riskTypes.push(SignatureRiskType.SUSPICIOUS_MESSAGE)
        riskLevel = SignatureRiskLevel.MEDIUM
      }
    }

    return this.createResult(SignatureMethod.PERSONAL_SIGN, riskLevel, riskTypes, warnings, {
      decodedMessage,
      summary:
        riskLevel === SignatureRiskLevel.LOW
          ? 'Low risk: Signing a text message for authentication or verification.'
          : 'Medium risk: Message contains potentially dangerous content.',
    })
  }

  /**
   * Analyze legacy typed data (v1/v3)
   */
  private analyzeLegacyTypedData(data: string): SignatureRiskResult {
    const warnings = ['Using legacy typed data format']
    const riskTypes: SignatureRiskTypeValue[] = [SignatureRiskType.LEGACY_FORMAT]

    try {
      JSON.parse(data)
    } catch {
      warnings.push('Could not parse typed data')
      riskTypes.push(SignatureRiskType.MALFORMED_DATA)
    }

    return this.createResult(
      SignatureMethod.ETH_SIGN_TYPED_DATA,
      SignatureRiskLevel.MEDIUM,
      riskTypes,
      warnings,
      {
        summary: 'Medium risk: Using legacy typed data format. Consider upgrading to v4.',
      }
    )
  }

  /**
   * Analyze EIP-712 typed data v4
   */
  private analyzeTypedDataV4(data: string, method: SignatureMethodType): SignatureRiskResult {
    const warnings: string[] = []
    const riskTypes: SignatureRiskTypeValue[] = []
    let riskLevel: SignatureRiskLevelType = SignatureRiskLevel.LOW
    let parsedTypedData: EIP712TypedData | undefined
    let contractInteraction: ContractInteraction | undefined

    // Try to parse typed data
    try {
      parsedTypedData = JSON.parse(data) as EIP712TypedData
    } catch {
      return this.createResult(
        method,
        SignatureRiskLevel.HIGH,
        [SignatureRiskType.MALFORMED_DATA],
        ['Could not parse typed data'],
        {
          summary: 'High risk: Could not parse the typed data structure.',
        }
      )
    }

    // Extract contract interaction info
    if (parsedTypedData.domain) {
      contractInteraction = {
        verifyingContract: parsedTypedData.domain.verifyingContract as string | undefined,
      }
    }

    // Analyze based on primary type
    const primaryType = parsedTypedData.primaryType?.toLowerCase() || ''
    const message = parsedTypedData.message || {}

    // Check for Permit (ERC-20 approval)
    if (primaryType === 'permit') {
      riskTypes.push(SignatureRiskType.TOKEN_APPROVAL)
      warnings.push('This signature will approve token spending')

      // Check for unlimited approval
      const value = message.value as string | undefined
      if (value === MAX_UINT256) {
        riskLevel = SignatureRiskLevel.HIGH
        riskTypes.push(SignatureRiskType.UNLIMITED_APPROVAL)
        warnings.push('Unlimited token approval requested')
      } else {
        riskLevel = SignatureRiskLevel.MEDIUM
      }

      // Add spender info
      if (message.spender && contractInteraction) {
        contractInteraction.spender = message.spender as string
      }
    }

    // Check for setApprovalForAll (NFT bulk approval)
    if (primaryType === 'setapprovalforall') {
      riskLevel = SignatureRiskLevel.HIGH
      riskTypes.push(SignatureRiskType.NFT_APPROVAL_ALL)
      warnings.push('Approving operator access to all NFTs in this collection')

      if (message.operator && contractInteraction) {
        contractInteraction.operator = message.operator as string
      }
    }

    return this.createResult(method, riskLevel, riskTypes, warnings, {
      parsedTypedData,
      contractInteraction,
      summary: this.generateTypedDataSummary(parsedTypedData, riskLevel),
    })
  }

  /**
   * Decode hex-encoded message to string
   */
  private decodeMessage(data: string): string {
    if (data.startsWith('0x')) {
      try {
        const hex = data.slice(2)
        let str = ''
        for (let i = 0; i < hex.length; i += 2) {
          const charCode = Number.parseInt(hex.substr(i, 2), 16)
          str += String.fromCharCode(charCode)
        }
        return str
      } catch {
        return data
      }
    }
    return data
  }

  /**
   * Generate summary for typed data
   */
  private generateTypedDataSummary(
    typedData: EIP712TypedData,
    riskLevel: SignatureRiskLevelType
  ): string {
    const primaryType = typedData.primaryType || 'Unknown'
    const domain = typedData.domain?.name || 'Unknown contract'

    const riskText = {
      [SignatureRiskLevel.SAFE]: 'Safe',
      [SignatureRiskLevel.LOW]: 'Low risk',
      [SignatureRiskLevel.MEDIUM]: 'Medium risk',
      [SignatureRiskLevel.HIGH]: 'High risk',
      [SignatureRiskLevel.CRITICAL]: 'CRITICAL',
    }

    return `${riskText[riskLevel]}: ${primaryType} signature requested by ${domain}.`
  }

  /**
   * Create a risk result object
   */
  private createResult(
    method: SignatureMethodType,
    riskLevel: SignatureRiskLevelType,
    riskTypes: SignatureRiskTypeValue[],
    warnings: string[],
    extra: Partial<SignatureRiskResult> = {}
  ): SignatureRiskResult {
    return {
      method,
      riskLevel,
      riskScore: RISK_SCORES[riskLevel],
      riskTypes,
      warnings,
      summary: extra.summary || `${riskLevel.toUpperCase()} risk signature request.`,
      ...extra,
    }
  }
}

/**
 * Create a new SignatureRiskAnalyzer instance
 */
export function createSignatureRiskAnalyzer(): SignatureRiskAnalyzer {
  return new SignatureRiskAnalyzer()
}
