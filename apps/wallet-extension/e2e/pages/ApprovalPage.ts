/**
 * Page Object for Approval Popup
 *
 * Handles:
 * - Connection requests
 * - Transaction approval
 * - Signature requests
 */

import { expect, type Locator, type Page } from '@playwright/test'

export class ApprovalPage {
  readonly page: Page

  // Common elements
  readonly approveButton: Locator
  readonly rejectButton: Locator
  readonly closeButton: Locator

  // Connection request
  readonly originUrl: Locator
  readonly connectTitle: Locator
  readonly permissionList: Locator

  // Transaction approval
  readonly transactionTitle: Locator
  readonly fromAddress: Locator
  readonly toAddress: Locator
  readonly valueAmount: Locator
  readonly gasEstimate: Locator
  readonly totalCost: Locator
  readonly dataPreview: Locator

  // Signature request
  readonly signatureTitle: Locator
  readonly messagePreview: Locator
  readonly riskWarning: Locator

  // Network switch
  readonly networkSwitchTitle: Locator
  readonly newNetworkName: Locator
  readonly newNetworkChainId: Locator

  constructor(page: Page) {
    this.page = page

    // Common buttons
    this.approveButton = page.getByRole('button', { name: /approve|confirm|connect|sign|switch/i })
    this.rejectButton = page.getByRole('button', { name: /reject|cancel|deny/i })
    this.closeButton = page.getByRole('button', { name: /close/i })

    // Connection request
    this.originUrl = page.locator('[data-testid="origin-url"]')
    this.connectTitle = page.getByText(/connect.*request|connection.*request/i)
    this.permissionList = page.locator('[data-testid="permission-list"]')

    // Transaction approval
    this.transactionTitle = page.getByText(/transaction.*request|confirm.*transaction/i)
    this.fromAddress = page.locator('[data-testid="from-address"]')
    this.toAddress = page.locator('[data-testid="to-address"]')
    this.valueAmount = page.locator('[data-testid="value-amount"]')
    this.gasEstimate = page.locator('[data-testid="gas-estimate"]')
    this.totalCost = page.locator('[data-testid="total-cost"]')
    this.dataPreview = page.locator('[data-testid="data-preview"]')

    // Signature request
    this.signatureTitle = page.getByText(/sign.*request|signature.*request/i)
    this.messagePreview = page.locator('[data-testid="message-preview"]')
    this.riskWarning = page.locator('[data-testid="risk-warning"]')

    // Network switch
    this.networkSwitchTitle = page.getByText(/switch.*network|network.*switch/i)
    this.newNetworkName = page.locator('[data-testid="new-network-name"]')
    this.newNetworkChainId = page.locator('[data-testid="new-chain-id"]')
  }

  /**
   * Wait for approval popup to load
   */
  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    // Wait for either approve or reject button to be visible
    await expect(this.approveButton.or(this.rejectButton)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Get the type of approval request
   */
  async getApprovalType(): Promise<
    'connect' | 'transaction' | 'signature' | 'network' | 'unknown'
  > {
    if (await this.connectTitle.isVisible()) return 'connect'
    if (await this.transactionTitle.isVisible()) return 'transaction'
    if (await this.signatureTitle.isVisible()) return 'signature'
    if (await this.networkSwitchTitle.isVisible()) return 'network'
    return 'unknown'
  }

  /**
   * Get origin URL for connection request
   */
  async getOrigin(): Promise<string> {
    const origin = await this.originUrl.textContent()
    return origin?.trim() ?? ''
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(): Promise<{
    from: string
    to: string
    value: string
    gas: string
    total: string
  }> {
    return {
      from: (await this.fromAddress.textContent())?.trim() ?? '',
      to: (await this.toAddress.textContent())?.trim() ?? '',
      value: (await this.valueAmount.textContent())?.trim() ?? '',
      gas: (await this.gasEstimate.textContent())?.trim() ?? '',
      total: (await this.totalCost.textContent())?.trim() ?? '',
    }
  }

  /**
   * Get signature message preview
   */
  async getSignatureMessage(): Promise<string> {
    const message = await this.messagePreview.textContent()
    return message?.trim() ?? ''
  }

  /**
   * Check if risk warning is displayed
   */
  async hasRiskWarning(): Promise<boolean> {
    return this.riskWarning.isVisible()
  }

  /**
   * Get risk warning text
   */
  async getRiskWarningText(): Promise<string> {
    if (await this.hasRiskWarning()) {
      const text = await this.riskWarning.textContent()
      return text?.trim() ?? ''
    }
    return ''
  }

  /**
   * Approve the request
   */
  async approve() {
    await this.approveButton.click()
    // Wait for popup to close or redirect
    await this.page.waitForTimeout(500)
  }

  /**
   * Reject the request
   */
  async reject() {
    await this.rejectButton.click()
    // Wait for popup to close or redirect
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if approval was successful (popup closed)
   */
  async isApprovalComplete(): Promise<boolean> {
    try {
      // Check if the approval buttons are gone
      await expect(this.approveButton).not.toBeVisible({ timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get new network details for network switch
   */
  async getNetworkSwitchDetails(): Promise<{ name: string; chainId: string }> {
    return {
      name: (await this.newNetworkName.textContent())?.trim() ?? '',
      chainId: (await this.newNetworkChainId.textContent())?.trim() ?? '',
    }
  }
}
