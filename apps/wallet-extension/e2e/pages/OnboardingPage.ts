/**
 * Page Object for Onboarding Flow
 *
 * Handles:
 * - Welcome screen
 * - Create/Import wallet selection
 * - Seed phrase display and confirmation
 * - Password creation
 * - Completion
 */

import { expect, type Locator, type Page } from '@playwright/test'

export class OnboardingPage {
  readonly page: Page

  // Welcome screen
  readonly createWalletButton: Locator
  readonly importWalletButton: Locator

  // Password creation
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly agreeCheckbox: Locator
  readonly continueButton: Locator

  // Seed phrase display
  readonly seedPhraseContainer: Locator
  readonly copySeedButton: Locator
  readonly savedSeedCheckbox: Locator
  readonly nextButton: Locator

  // Seed phrase confirmation
  readonly seedWordInputs: Locator
  readonly confirmSeedButton: Locator

  // Completion
  readonly completeButton: Locator
  readonly successMessage: Locator

  constructor(page: Page) {
    this.page = page

    // Welcome screen selectors
    this.createWalletButton = page.getByRole('button', { name: /create.*wallet/i })
    this.importWalletButton = page.getByRole('button', { name: /import.*wallet/i })

    // Password creation selectors
    this.passwordInput = page.getByPlaceholder(/^password/i).first()
    this.confirmPasswordInput = page.getByPlaceholder(/confirm/i)
    this.agreeCheckbox = page.getByRole('checkbox')
    this.continueButton = page.getByRole('button', { name: /continue/i })

    // Seed phrase display selectors
    this.seedPhraseContainer = page.locator('[data-testid="seed-phrase"]')
    this.copySeedButton = page.getByRole('button', { name: /copy/i })
    this.savedSeedCheckbox = page.getByRole('checkbox')
    this.nextButton = page.getByRole('button', { name: /next|continue/i })

    // Seed phrase confirmation selectors
    this.seedWordInputs = page.locator('input[data-testid^="seed-word-"]')
    this.confirmSeedButton = page.getByRole('button', { name: /confirm|verify/i })

    // Completion selectors
    this.completeButton = page.getByRole('button', { name: /complete|done|finish/i })
    this.successMessage = page.getByText(/wallet.*created|success/i)
  }

  /**
   * Navigate to onboarding page
   */
  async goto(extensionId: string) {
    await this.page.goto(`chrome-extension://${extensionId}/src/ui/index.html`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Start wallet creation flow
   */
  async startCreateWallet() {
    await this.createWalletButton.click()
    await this.page.waitForURL(/password|create/i)
  }

  /**
   * Start wallet import flow
   */
  async startImportWallet() {
    await this.importWalletButton.click()
    await this.page.waitForURL(/import/i)
  }

  /**
   * Create password
   */
  async createPassword(password: string) {
    await this.passwordInput.fill(password)
    await this.confirmPasswordInput.fill(password)

    // Check agreement if visible
    if (await this.agreeCheckbox.isVisible()) {
      await this.agreeCheckbox.check()
    }

    await this.continueButton.click()
  }

  /**
   * Get seed phrase words from display
   */
  async getSeedPhrase(): Promise<string[]> {
    await this.seedPhraseContainer.waitFor({ state: 'visible' })

    // Get all word elements
    const wordElements = this.page.locator('[data-testid="seed-phrase"] [data-testid^="word-"]')
    const count = await wordElements.count()

    const words: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await wordElements.nth(i).textContent()
      if (text) {
        // Extract just the word (remove index if present)
        const word = text.replace(/^\d+\.\s*/, '').trim()
        words.push(word)
      }
    }

    return words
  }

  /**
   * Acknowledge seed phrase saved
   */
  async acknowledgeSeedSaved() {
    if (await this.savedSeedCheckbox.isVisible()) {
      await this.savedSeedCheckbox.check()
    }
    await this.nextButton.click()
  }

  /**
   * Confirm seed phrase by entering requested words
   */
  async confirmSeedPhrase(seedPhrase: string[]) {
    // Find which word indices are being requested
    const inputCount = await this.seedWordInputs.count()

    for (let i = 0; i < inputCount; i++) {
      const input = this.seedWordInputs.nth(i)
      const testId = await input.getAttribute('data-testid')
      if (testId) {
        // Extract word index from data-testid (e.g., "seed-word-3" -> 3)
        const match = testId.match(/seed-word-(\d+)/)
        if (match) {
          const wordIndex = Number.parseInt(match[1], 10) - 1 // Convert to 0-based
          if (wordIndex >= 0 && wordIndex < seedPhrase.length) {
            await input.fill(seedPhrase[wordIndex])
          }
        }
      }
    }

    await this.confirmSeedButton.click()
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding() {
    await this.completeButton.click()
  }

  /**
   * Full create wallet flow
   */
  async createNewWallet(password: string): Promise<string[]> {
    await this.startCreateWallet()
    await this.createPassword(password)

    const seedPhrase = await this.getSeedPhrase()
    await this.acknowledgeSeedSaved()
    await this.confirmSeedPhrase(seedPhrase)
    await this.completeOnboarding()

    return seedPhrase
  }

  /**
   * Import wallet with seed phrase
   */
  async importExistingWallet(seedPhrase: string[], password: string) {
    await this.startImportWallet()

    // Fill seed phrase
    const seedInput = this.page.getByPlaceholder(/seed|phrase|mnemonic/i)
    await seedInput.fill(seedPhrase.join(' '))

    await this.continueButton.click()
    await this.createPassword(password)
    await this.completeOnboarding()
  }

  /**
   * Verify onboarding is complete
   */
  async verifyOnboardingComplete() {
    await expect(this.successMessage).toBeVisible({ timeout: 10000 })
  }
}
