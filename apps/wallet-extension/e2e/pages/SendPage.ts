/**
 * Page Object for Send Transaction Screen
 *
 * Handles:
 * - Recipient input
 * - Amount input
 * - Transaction mode selection
 * - Gas payment selection
 * - Transaction review and confirmation
 */

import { expect, type Locator, type Page } from '@playwright/test'

export type TransactionMode = 'eoa' | 'eip7702' | 'smartAccount'
export type GasPaymentType = 'native' | 'sponsor' | 'erc20'

export class SendPage {
  readonly page: Page

  // Header
  readonly backButton: Locator
  readonly title: Locator

  // Form inputs
  readonly recipientInput: Locator
  readonly amountInput: Locator
  readonly maxButton: Locator

  // Transaction mode selector
  readonly modeSelector: Locator
  readonly eoaModeOption: Locator
  readonly eip7702ModeOption: Locator
  readonly smartAccountModeOption: Locator

  // Gas payment selector
  readonly gasPaymentSelector: Locator
  readonly nativePaymentOption: Locator
  readonly sponsorPaymentOption: Locator
  readonly erc20PaymentOption: Locator

  // Gas estimate display
  readonly gasEstimate: Locator
  readonly gasEstimateAmount: Locator
  readonly gasFreeLabel: Locator

  // Action buttons
  readonly reviewButton: Locator
  readonly confirmButton: Locator
  readonly cancelButton: Locator

  // Errors and warnings
  readonly errorMessage: Locator
  readonly warningMessage: Locator
  readonly insufficientBalanceWarning: Locator

  // Confirmation modal
  readonly confirmationModal: Locator
  readonly confirmationRecipient: Locator
  readonly confirmationAmount: Locator
  readonly confirmationGas: Locator

  // Success/Pending states
  readonly pendingIndicator: Locator
  readonly successMessage: Locator
  readonly transactionHash: Locator

  constructor(page: Page) {
    this.page = page

    // Header
    this.backButton = page.getByRole('button', { name: /back|←/i })
    this.title = page.getByRole('heading', { name: /send/i })

    // Form inputs
    this.recipientInput = page.locator('[data-testid="recipient-input"], input[placeholder*="0x"]')
    this.amountInput = page.locator('[data-testid="amount-input"], input[type="number"]')
    this.maxButton = page.getByRole('button', { name: /max/i })

    // Transaction mode
    this.modeSelector = page.locator('[data-testid="transaction-mode-selector"]')
    this.eoaModeOption = page.locator('[data-mode="eoa"], [data-testid="mode-eoa"]')
    this.eip7702ModeOption = page.locator('[data-mode="eip7702"], [data-testid="mode-eip7702"]')
    this.smartAccountModeOption = page.locator(
      '[data-mode="smartAccount"], [data-testid="mode-smart-account"]'
    )

    // Gas payment
    this.gasPaymentSelector = page.locator('[data-testid="gas-payment-selector"]')
    this.nativePaymentOption = page.locator('[data-payment="native"], [data-testid="gas-native"]')
    this.sponsorPaymentOption = page.locator(
      '[data-payment="sponsor"], [data-testid="gas-sponsor"]'
    )
    this.erc20PaymentOption = page.locator('[data-payment="erc20"], [data-testid="gas-erc20"]')

    // Gas estimate
    this.gasEstimate = page.locator('[data-testid="gas-estimate"]')
    this.gasEstimateAmount = page.locator('[data-testid="gas-estimate-amount"]')
    this.gasFreeLabel = page.locator('text=/free|sponsored/i')

    // Actions
    this.reviewButton = page.getByRole('button', { name: /review|next|continue/i })
    this.confirmButton = page.getByRole('button', { name: /confirm|send/i })
    this.cancelButton = page.getByRole('button', { name: /cancel/i })

    // Errors/warnings
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message')
    this.warningMessage = page.locator('[data-testid="warning-message"], .warning-message')
    this.insufficientBalanceWarning = page.locator('text=/insufficient/i')

    // Confirmation modal
    this.confirmationModal = page.locator('[data-testid="confirmation-modal"], .confirmation-modal')
    this.confirmationRecipient = page.locator('[data-testid="confirmation-recipient"]')
    this.confirmationAmount = page.locator('[data-testid="confirmation-amount"]')
    this.confirmationGas = page.locator('[data-testid="confirmation-gas"]')

    // Success/Pending
    this.pendingIndicator = page.locator('[data-testid="pending-indicator"], .pending')
    this.successMessage = page.locator('[data-testid="success-message"], text=/sent|success/i')
    this.transactionHash = page.locator('[data-testid="transaction-hash"]')
  }

  /**
   * Fill the send form
   */
  async fillForm(params: { recipient: string; amount: string }) {
    await this.recipientInput.fill(params.recipient)
    await this.amountInput.fill(params.amount)
  }

  /**
   * Select transaction mode
   */
  async selectTransactionMode(mode: TransactionMode) {
    switch (mode) {
      case 'eoa':
        await this.eoaModeOption.click()
        break
      case 'eip7702':
        await this.eip7702ModeOption.click()
        break
      case 'smartAccount':
        await this.smartAccountModeOption.click()
        break
    }
  }

  /**
   * Select gas payment type
   */
  async selectGasPayment(type: GasPaymentType, options?: { token?: string }) {
    switch (type) {
      case 'native':
        await this.nativePaymentOption.click()
        break
      case 'sponsor':
        await this.sponsorPaymentOption.click()
        break
      case 'erc20':
        await this.erc20PaymentOption.click()
        if (options?.token) {
          // Select specific token
          await this.page.locator(`[data-token="${options.token}"]`).click()
        }
        break
    }
  }

  /**
   * Get gas estimate display text
   */
  async getGasEstimateDisplay(): Promise<string> {
    const freeLabel = await this.gasFreeLabel.isVisible().catch(() => false)
    if (freeLabel) {
      return 'Free'
    }
    return (await this.gasEstimateAmount.textContent()) ?? ''
  }

  /**
   * Click review button to proceed to confirmation
   */
  async clickReview() {
    await this.reviewButton.click()
    await this.confirmationModal.waitFor({ state: 'visible' }).catch(() => {
      // Some flows might not have a modal
    })
  }

  /**
   * Confirm and send the transaction
   */
  async confirmTransaction() {
    await this.confirmButton.click()
    // Wait for either success or error
    await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 30000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 30000 }),
    ])
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string> {
    return (await this.successMessage.textContent()) ?? ''
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string | null> {
    const isVisible = await this.errorMessage.isVisible().catch(() => false)
    if (!isVisible) return null
    return await this.errorMessage.textContent()
  }

  /**
   * Get warning message
   */
  async getWarningMessage(): Promise<string | null> {
    const isVisible = await this.warningMessage.isVisible().catch(() => false)
    if (!isVisible) return null
    return await this.warningMessage.textContent()
  }

  /**
   * Verify send form is displayed
   */
  async verifySendFormVisible() {
    await expect(this.recipientInput).toBeVisible()
    await expect(this.amountInput).toBeVisible()
  }

  /**
   * Use max amount
   */
  async useMaxAmount() {
    await this.maxButton.click()
  }

  /**
   * Go back to previous page
   */
  async goBack() {
    await this.backButton.click()
  }
}
