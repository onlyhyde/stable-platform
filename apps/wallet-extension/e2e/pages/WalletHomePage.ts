/**
 * Page Object for Wallet Home Screen
 *
 * Handles:
 * - Account display
 * - Balance display
 * - Send/Receive buttons
 * - Network selection
 * - Settings access
 */

import { expect, type Locator, type Page } from '@playwright/test'

export class WalletHomePage {
  readonly page: Page

  // Header elements
  readonly accountSelector: Locator
  readonly networkSelector: Locator
  readonly lockButton: Locator
  readonly settingsButton: Locator

  // Balance display
  readonly balanceAmount: Locator
  readonly balanceCurrency: Locator

  // Action buttons
  readonly sendButton: Locator
  readonly receiveButton: Locator
  readonly buyButton: Locator

  // Navigation
  readonly homeTab: Locator
  readonly activityTab: Locator
  readonly bankTab: Locator

  // Account list (when expanded)
  readonly accountList: Locator
  readonly addAccountButton: Locator

  // Network list (when expanded)
  readonly networkList: Locator
  readonly addNetworkButton: Locator

  constructor(page: Page) {
    this.page = page

    // Header
    this.accountSelector = page.locator('[data-testid="account-selector"]')
    this.networkSelector = page.locator('[data-testid="network-selector"]')
    this.lockButton = page.getByRole('button', { name: /lock/i })
    this.settingsButton = page.getByRole('button', { name: /settings/i })

    // Balance
    this.balanceAmount = page.locator('[data-testid="balance-amount"]')
    this.balanceCurrency = page.locator('[data-testid="balance-currency"]')

    // Actions
    this.sendButton = page.getByRole('button', { name: /send/i })
    this.receiveButton = page.getByRole('button', { name: /receive/i })
    this.buyButton = page.getByRole('button', { name: /buy/i })

    // Navigation tabs
    this.homeTab = page.getByRole('tab', { name: /home/i })
    this.activityTab = page.getByRole('tab', { name: /activity/i })
    this.bankTab = page.getByRole('tab', { name: /bank/i })

    // Account list
    this.accountList = page.locator('[data-testid="account-list"]')
    this.addAccountButton = page.getByRole('button', { name: /add.*account/i })

    // Network list
    this.networkList = page.locator('[data-testid="network-list"]')
    this.addNetworkButton = page.getByRole('button', { name: /add.*network/i })
  }

  /**
   * Navigate to wallet home
   */
  async goto(extensionId: string) {
    await this.page.goto(`chrome-extension://${extensionId}/src/ui/index.html`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Get current account address
   */
  async getCurrentAddress(): Promise<string> {
    const addressElement = this.page.locator('[data-testid="current-address"]')
    const address = await addressElement.textContent()
    return address?.trim() ?? ''
  }

  /**
   * Get current account name
   */
  async getCurrentAccountName(): Promise<string> {
    const nameElement = this.accountSelector.locator('[data-testid="account-name"]')
    const name = await nameElement.textContent()
    return name?.trim() ?? ''
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<{ amount: string; currency: string }> {
    const amount = await this.balanceAmount.textContent()
    const currency = await this.balanceCurrency.textContent()
    return {
      amount: amount?.trim() ?? '0',
      currency: currency?.trim() ?? 'ETH',
    }
  }

  /**
   * Get current network name
   */
  async getCurrentNetwork(): Promise<string> {
    const networkName = this.networkSelector.locator('[data-testid="network-name"]')
    const name = await networkName.textContent()
    return name?.trim() ?? ''
  }

  /**
   * Open account selector
   */
  async openAccountSelector() {
    await this.accountSelector.click()
    await this.accountList.waitFor({ state: 'visible' })
  }

  /**
   * Select account by name
   */
  async selectAccount(name: string) {
    await this.openAccountSelector()
    await this.page.getByText(name, { exact: false }).click()
    await this.accountList.waitFor({ state: 'hidden' })
  }

  /**
   * Add new account
   */
  async addNewAccount() {
    await this.openAccountSelector()
    await this.addAccountButton.click()
  }

  /**
   * Open network selector
   */
  async openNetworkSelector() {
    await this.networkSelector.click()
    await this.networkList.waitFor({ state: 'visible' })
  }

  /**
   * Select network by name
   */
  async selectNetwork(name: string) {
    await this.openNetworkSelector()
    await this.page.getByText(name, { exact: false }).click()
    await this.networkList.waitFor({ state: 'hidden' })
  }

  /**
   * Navigate to send page
   */
  async goToSend() {
    await this.sendButton.click()
    await this.page.waitForURL(/send/i)
  }

  /**
   * Navigate to receive page
   */
  async goToReceive() {
    await this.receiveButton.click()
    await this.page.waitForURL(/receive/i)
  }

  /**
   * Navigate to settings
   */
  async goToSettings() {
    await this.settingsButton.click()
    await this.page.waitForURL(/settings/i)
  }

  /**
   * Lock wallet
   */
  async lockWallet() {
    await this.lockButton.click()
    // Wait for lock screen
    await this.page.waitForURL(/lock/i)
  }

  /**
   * Navigate to activity tab
   */
  async goToActivity() {
    await this.activityTab.click()
  }

  /**
   * Navigate to bank tab
   */
  async goToBank() {
    await this.bankTab.click()
  }

  /**
   * Verify wallet is unlocked and on home page
   */
  async verifyUnlocked() {
    await expect(this.balanceAmount).toBeVisible({ timeout: 10000 })
    await expect(this.sendButton).toBeVisible()
    await expect(this.receiveButton).toBeVisible()
  }
}
