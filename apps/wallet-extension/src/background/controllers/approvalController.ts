import { analyzeAuthorizationRisk } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { getApprovalConfig } from '../../config'
import { isRevocationAddress } from '../../shared/utils/eip7702'
import { createLogger } from '../../shared/utils/logger'
import type {
  AddNetworkApprovalRequest,
  ApprovalControllerState,
  ApprovalRequest,
  ApprovalResult,
  AuthorizationApprovalRequest,
  ConnectApprovalRequest,
  SignatureApprovalRequest,
  SwitchNetworkApprovalRequest,
  TransactionApprovalRequest,
} from '../../types'
import { generateRandomHex } from '../keyring/crypto'

const logger = createLogger('ApprovalController')

/**
 * Approval Controller
 * Manages user consent flows for dApp interactions
 */

type ApprovalListener = (
  event: 'approvalAdded' | 'approvalResolved' | 'approvalExpired',
  approval: ApprovalRequest
) => void

/**
 * Get approval expiry time from config
 */
function getApprovalExpiryMs(): number {
  return getApprovalConfig().expiryMs
}

export class ApprovalController {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map()
  private approvalHistory: ApprovalRequest[] = []
  private resolvers: Map<
    string,
    { resolve: (result: ApprovalResult) => void; reject: (error: Error) => void }
  > = new Map()
  private listeners: Set<ApprovalListener> = new Set()
  private expiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /**
   * Get current state
   */
  getState(): ApprovalControllerState {
    return {
      pendingApprovals: Array.from(this.pendingApprovals.values()),
      approvalHistory: this.approvalHistory.slice(0, getApprovalConfig().historyMaxLength),
    }
  }

  /**
   * Check if there are pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0
  }

  /**
   * Get pending approval by ID
   */
  getPendingApproval(id: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(id)
  }

  /**
   * Get all pending approvals for an origin
   */
  getPendingApprovalsForOrigin(origin: string): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter((a) => a.origin === origin)
  }

  /**
   * Request connection approval
   */
  async requestConnect(
    origin: string,
    favicon?: string
  ): Promise<{ accounts: Address[]; permissions: string[] }> {
    const approval: ConnectApprovalRequest = {
      id: generateRandomHex(16),
      type: 'connect',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        requestedPermissions: ['eth_accounts'],
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{
      accounts: Address[]
      permissions: string[]
    }>
  }

  /**
   * Request sign message approval (simplified interface for personal_sign)
   */
  async requestSignMessage(params: {
    origin: string
    message: string
    address: Address
    method: 'personal_sign' | 'eth_signTypedData_v4'
    favicon?: string
  }): Promise<{ approved: boolean }> {
    return this.requestSignature(
      params.origin,
      params.method,
      params.address,
      params.message,
      undefined,
      params.favicon
    )
      .then(() => ({ approved: true }))
      .catch(() => ({ approved: false }))
  }

  /**
   * Request typed data signing approval (simplified interface for eth_signTypedData_v4)
   */
  async requestSignTypedData(params: {
    origin: string
    address: Address
    typedData: unknown
    method: 'eth_signTypedData_v4'
    favicon?: string
    domainValidation?: {
      warnings: Array<{ type: string; message: string; severity: string }>
      riskLevel: 'low' | 'medium' | 'high' | 'critical'
      warningMessages: string[]
    }
  }): Promise<{ approved: boolean }> {
    return this.requestSignature(
      params.origin,
      params.method,
      params.address,
      '', // No plain message for typed data
      params.typedData,
      params.favicon,
      params.domainValidation
    )
      .then(() => ({ approved: true }))
      .catch(() => ({ approved: false }))
  }

  /**
   * Request signature approval
   */
  async requestSignature(
    origin: string,
    method: 'personal_sign' | 'eth_signTypedData_v4',
    address: Address,
    message: string,
    typedData?: unknown,
    favicon?: string,
    domainValidation?: {
      warnings: Array<{ type: string; message: string; severity: string }>
      riskLevel: 'low' | 'medium' | 'high' | 'critical'
      warningMessages: string[]
    }
  ): Promise<{ signature: string }> {
    const displayMessage = this.formatMessageForDisplay(message, method)
    const signatureRiskWarnings = this.assessSignatureRisk(message, typedData)

    // Merge signature risk warnings with domain validation warnings (SEC-5)
    const allWarnings = [...signatureRiskWarnings, ...(domainValidation?.warningMessages ?? [])]

    // Determine overall risk level (domain validation takes precedence if critical)
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (domainValidation?.riskLevel === 'critical' || domainValidation?.riskLevel === 'high') {
      riskLevel = 'high'
    } else if (domainValidation?.riskLevel === 'medium' || signatureRiskWarnings.length > 0) {
      riskLevel = signatureRiskWarnings.length > 0 ? 'high' : 'medium'
    }

    const approval: SignatureApprovalRequest = {
      id: generateRandomHex(16),
      type: 'signature',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        method,
        address,
        message,
        typedData,
        displayMessage,
        riskLevel,
        riskWarnings: allWarnings,
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{ signature: string }>
  }

  /**
   * Request transaction approval
   */
  async requestTransaction(
    origin: string,
    from: Address,
    to: Address,
    value: bigint,
    data?: string,
    estimatedGasCost?: bigint,
    methodName?: string,
    favicon?: string
  ): Promise<{ txHash?: string; userOpHash?: string }> {
    const warnings = this.assessTransactionRisk(to, value, data)

    const approval: TransactionApprovalRequest = {
      id: generateRandomHex(16),
      type: 'transaction',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        from,
        to,
        value,
        data: data as `0x${string}` | undefined,
        methodName,
        estimatedGasCost,
        riskLevel: warnings.length > 0 ? 'medium' : 'low',
        warnings,
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{
      txHash?: string
      userOpHash?: string
    }>
  }

  /**
   * Request network switch approval
   */
  async requestSwitchNetwork(
    origin: string,
    chainId: number,
    chainName?: string,
    favicon?: string
  ): Promise<{ switched: boolean }> {
    const approval: SwitchNetworkApprovalRequest = {
      id: generateRandomHex(16),
      type: 'switchNetwork',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        chainId,
        chainName,
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{ switched: boolean }>
  }

  /**
   * Request add network approval
   */
  async requestAddNetwork(
    origin: string,
    chainId: number,
    chainName: string,
    rpcUrl: string,
    nativeCurrency: { name: string; symbol: string; decimals: number },
    blockExplorerUrl?: string,
    favicon?: string
  ): Promise<{ added: boolean }> {
    const approval: AddNetworkApprovalRequest = {
      id: generateRandomHex(16),
      type: 'addNetwork',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        chainId,
        chainName,
        rpcUrl,
        nativeCurrency,
        blockExplorerUrl,
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{ added: boolean }>
  }

  /**
   * Request EIP-7702 authorization approval
   */
  async requestAuthorization(
    origin: string,
    account: Address,
    contractAddress: Address,
    chainId: number,
    nonce: bigint,
    favicon?: string
  ): Promise<{
    signedAuthorization: {
      chainId: bigint
      address: Address
      nonce: bigint
      v: number
      r: Hex
      s: Hex
    }
    authorizationHash: Hex
  }> {
    // Analyze authorization risk
    const riskResult = analyzeAuthorizationRisk({
      account,
      contractAddress,
      chainId,
      origin,
    })

    const approval: AuthorizationApprovalRequest = {
      id: generateRandomHex(16),
      type: 'authorization',
      status: 'pending',
      origin,
      favicon,
      timestamp: Date.now(),
      expiresAt: Date.now() + getApprovalExpiryMs(),
      data: {
        account,
        contractAddress,
        chainId,
        nonce,
        isRevocation: isRevocationAddress(contractAddress),
        riskLevel: riskResult.riskLevel,
        warnings: riskResult.warnings,
        contractInfo: riskResult.contractInfo,
      },
    }

    return this.addApprovalAndWait(approval) as Promise<{
      signedAuthorization: {
        chainId: bigint
        address: Address
        nonce: bigint
        v: number
        r: Hex
        s: Hex
      }
      authorizationHash: Hex
    }>
  }

  /**
   * Approve a pending approval
   */
  async approve<T>(id: string, data?: T): Promise<void> {
    const approval = this.pendingApprovals.get(id)
    if (!approval) {
      throw new Error('Approval not found')
    }

    const resolver = this.resolvers.get(id)
    if (!resolver) {
      throw new Error('Resolver not found')
    }

    // Update approval status
    approval.status = 'approved'
    this.pendingApprovals.delete(id)
    this.approvalHistory.unshift(approval)
    this.clearExpiryTimer(id)

    // Resolve the promise
    resolver.resolve({ id, approved: true, data })
    this.resolvers.delete(id)

    this.emit('approvalResolved', approval)
  }

  /**
   * Reject a pending approval
   */
  async reject(id: string, reason?: string): Promise<void> {
    const approval = this.pendingApprovals.get(id)
    if (!approval) {
      throw new Error('Approval not found')
    }

    const resolver = this.resolvers.get(id)
    if (!resolver) {
      throw new Error('Resolver not found')
    }

    // Update approval status
    approval.status = 'rejected'
    this.pendingApprovals.delete(id)
    this.approvalHistory.unshift(approval)
    this.clearExpiryTimer(id)

    // Reject the promise
    resolver.reject(new Error(reason ?? 'User rejected the request'))
    this.resolvers.delete(id)

    this.emit('approvalResolved', approval)
  }

  /**
   * Reject all pending approvals for an origin
   */
  async rejectAllForOrigin(origin: string): Promise<void> {
    const approvals = this.getPendingApprovalsForOrigin(origin)
    for (const approval of approvals) {
      await this.reject(approval.id, 'Connection terminated')
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: ApprovalListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Add approval and wait for resolution
   */
  private async addApprovalAndWait<T>(approval: ApprovalRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingApprovals.set(approval.id, approval)
      this.resolvers.set(approval.id, {
        resolve: (result) => resolve(result.data as T),
        reject,
      })

      // Set expiry timer
      this.setExpiryTimer(approval)

      // Notify listeners
      this.emit('approvalAdded', approval)

      // Open approval popup
      this.openApprovalPopup(approval)
    })
  }

  /**
   * Open approval popup window
   */
  private async openApprovalPopup(approval: ApprovalRequest): Promise<void> {
    try {
      // Check if popup already exists
      const windows = await chrome.windows.getAll({ populate: false })
      const existingPopup = windows.find((w) => w.type === 'popup')

      if (existingPopup?.id) {
        // Focus existing popup
        await chrome.windows.update(existingPopup.id, { focused: true })
        return
      }

      // Create new popup using chrome.runtime.getURL for proper extension URL
      // SEC-12: URL encode the approval ID to prevent injection attacks
      const popupUrl = chrome.runtime.getURL(
        `src/approval/approval.html?id=${encodeURIComponent(approval.id)}`
      )
      logger.info('Opening approval popup', { url: popupUrl, approvalId: approval.id })

      const popup = await chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 400,
        height: 600,
        focused: true,
      })

      if (!popup?.id) {
        logger.error('Failed to create approval popup window')
      }
    } catch (error) {
      logger.error('Failed to open approval popup', error)
      // Reject the approval if popup fails to open
      const resolver = this.resolvers.get(approval.id)
      if (resolver) {
        resolver.reject(new Error('Failed to open approval popup'))
        this.resolvers.delete(approval.id)
        this.pendingApprovals.delete(approval.id)
        this.clearExpiryTimer(approval.id)
      }
    }
  }

  /**
   * Set expiry timer for approval
   */
  private setExpiryTimer(approval: ApprovalRequest): void {
    if (!approval.expiresAt) return

    const timeout = approval.expiresAt - Date.now()
    if (timeout <= 0) return

    const timer = setTimeout(() => {
      this.expireApproval(approval.id)
    }, timeout)

    this.expiryTimers.set(approval.id, timer)
  }

  /**
   * Clear expiry timer
   */
  private clearExpiryTimer(id: string): void {
    const timer = this.expiryTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.expiryTimers.delete(id)
    }
  }

  /**
   * Expire an approval
   */
  private expireApproval(id: string): void {
    const approval = this.pendingApprovals.get(id)
    if (!approval) return

    const resolver = this.resolvers.get(id)
    if (resolver) {
      resolver.reject(new Error('Approval request expired'))
      this.resolvers.delete(id)
    }

    approval.status = 'expired'
    this.pendingApprovals.delete(id)
    this.approvalHistory.unshift(approval)

    this.emit('approvalExpired', approval)
  }

  /**
   * Emit event
   */
  private emit(
    event: 'approvalAdded' | 'approvalResolved' | 'approvalExpired',
    approval: ApprovalRequest
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(event, approval)
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Format message for display
   */
  private formatMessageForDisplay(message: string, method: string): string {
    if (method === 'personal_sign') {
      // Try to decode hex message
      try {
        if (message.startsWith('0x')) {
          const hex = message.slice(2)
          const bytes = new Uint8Array(
            hex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16))
          )
          return new TextDecoder().decode(bytes)
        }
      } catch {
        // Return as-is if decoding fails
      }
    }
    return message
  }

  /**
   * Assess signature risk
   */
  private assessSignatureRisk(_message: string, typedData?: unknown): string[] {
    const warnings: string[] = []

    if (typedData) {
      // Check for permit signatures
      const data = typedData as { primaryType?: string }
      if (data.primaryType === 'Permit') {
        warnings.push('This signature grants token spending approval')
      }
    }

    return warnings
  }

  /**
   * Assess transaction risk
   */
  private assessTransactionRisk(to: Address, value: bigint, data?: string): string[] {
    const warnings: string[] = []

    // Check for high value transactions
    if (value > BigInt(10) * BigInt(10 ** 18)) {
      warnings.push('High value transaction (>10 ETH)')
    }

    // Check for contract interaction
    if (data && data !== '0x' && data.length > 2) {
      warnings.push('This transaction includes contract interaction')
    }

    return warnings
  }
}

// Singleton instance
export const approvalController = new ApprovalController()
