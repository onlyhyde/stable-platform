/**
 * Page Object for Lock Screen
 *
 * Handles:
 * - Password entry
 * - Unlock flow
 * - Forgot password link
 */

import { expect, type Locator, type Page } from '@playwright/test'

export class LockPage {
  readonly page: Page

  // Lock screen elements
  readonly passwordInput: Locator
  readonly unlockButton: Locator
  readonly forgotPasswordLink: Locator
  readonly errorMessage: Locator
  readonly logo: Locator

  constructor(page: Page) {
    this.page = page

    // Lock screen
    this.passwordInput = page.getByPlaceholder(/password/i)
    this.unlockButton = page.getByRole('button', { name: /unlock/i })
    this.forgotPasswordLink = page.getByText(/forgot.*password/i)
    this.errorMessage = page.locator('[data-testid="error-message"]')
    this.logo = page.locator('[data-testid="logo"]')
  }

  /**
   * Navigate to lock page
   */
  async goto(extensionId: string) {
    await this.page.goto(`chrome-extension://${extensionId}/src/ui/index.html`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Check if on lock screen
   */
  async isLocked(): Promise<boolean> {
    return this.passwordInput.isVisible()
  }

  /**
   * Enter password
   */
  async enterPassword(password: string) {
    await this.passwordInput.fill(password)
  }

  /**
   * Click unlock button
   */
  async clickUnlock() {
    await this.unlockButton.click()
  }

  /**
   * Unlock wallet with password
   */
  async unlock(password: string) {
    await this.enterPassword(password)
    await this.clickUnlock()

    // Wait for unlock to complete (either success or error)
    await this.page.waitForTimeout(1000)
  }

  /**
   * Verify unlock was successful
   */
  async verifyUnlocked() {
    // Password input should no longer be visible after successful unlock
    await expect(this.passwordInput).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible()
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.hasError()) {
      const text = await this.errorMessage.textContent()
      return text?.trim() ?? ''
    }
    return ''
  }

  /**
   * Try unlock with wrong password and verify error
   */
  async verifyWrongPasswordError(wrongPassword: string) {
    await this.unlock(wrongPassword)
    await expect(this.errorMessage).toBeVisible({ timeout: 3000 })
    await expect(this.passwordInput).toBeVisible() // Still on lock screen
  }
}
