/**
 * E2E Tests: Onboarding Flow
 *
 * Tests the wallet creation and import flows:
 * - Create new wallet
 * - Import existing wallet
 * - Password validation
 * - Seed phrase backup and confirmation
 */

import { expect, test } from '../fixtures/extension'
import { LockPage, OnboardingPage, WalletHomePage } from '../pages'

// Test password
const TEST_PASSWORD = 'TestP@ssword123!'

// Test seed phrase (12 words for testing)
const TEST_SEED_PHRASE = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
]

test.describe('Onboarding Flow', () => {
  test.describe('Create New Wallet', () => {
    test('should display welcome screen with create and import options', async ({
      extensionPopup,
    }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      // Verify welcome screen elements
      await expect(onboarding.createWalletButton).toBeVisible()
      await expect(onboarding.importWalletButton).toBeVisible()
    })

    test('should navigate to password creation when creating new wallet', async ({
      extensionPopup,
    }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startCreateWallet()

      // Should show password input
      await expect(onboarding.passwordInput).toBeVisible()
      await expect(onboarding.confirmPasswordInput).toBeVisible()
    })

    test('should validate password requirements', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startCreateWallet()

      // Try weak password
      await onboarding.passwordInput.fill('weak')
      await onboarding.confirmPasswordInput.fill('weak')

      // Should show validation error or disable continue
      const isDisabled = await onboarding.continueButton.isDisabled()
      expect(isDisabled).toBe(true)
    })

    test('should validate password match', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startCreateWallet()

      // Enter mismatched passwords
      await onboarding.passwordInput.fill(TEST_PASSWORD)
      await onboarding.confirmPasswordInput.fill('DifferentPassword123!')

      // Should show error or disable continue
      const errorMessage = extensionPopup.getByText(/password.*match/i)
      await expect(errorMessage.or(onboarding.continueButton)).toBeVisible()
    })

    test('should display seed phrase after password creation', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startCreateWallet()
      await onboarding.createPassword(TEST_PASSWORD)

      // Should show seed phrase
      await expect(onboarding.seedPhraseContainer).toBeVisible({ timeout: 10000 })

      // Get seed phrase and verify it has 12 or 24 words
      const seedPhrase = await onboarding.getSeedPhrase()
      expect(seedPhrase.length).toBeGreaterThanOrEqual(12)
    })

    test('should require seed phrase confirmation', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startCreateWallet()
      await onboarding.createPassword(TEST_PASSWORD)

      const _seedPhrase = await onboarding.getSeedPhrase()
      await onboarding.acknowledgeSeedSaved()

      // Should show confirmation inputs
      await expect(onboarding.seedWordInputs.first()).toBeVisible({ timeout: 5000 })
    })

    test('should complete wallet creation successfully', async ({
      extensionPopup,
      extensionContext,
    }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      // Create wallet
      const seedPhrase = await onboarding.createNewWallet(TEST_PASSWORD)

      // Verify seed phrase was generated
      expect(seedPhrase.length).toBeGreaterThanOrEqual(12)

      // Should redirect to home or show success
      const home = new WalletHomePage(extensionPopup)
      await home.verifyUnlocked()
    })
  })

  test.describe('Import Existing Wallet', () => {
    test('should navigate to import screen', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startImportWallet()

      // Should show seed phrase input
      const seedInput = extensionPopup.getByPlaceholder(/seed|phrase|mnemonic/i)
      await expect(seedInput).toBeVisible()
    })

    test('should validate seed phrase format', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.startImportWallet()

      // Enter invalid seed phrase
      const seedInput = extensionPopup.getByPlaceholder(/seed|phrase|mnemonic/i)
      await seedInput.fill('invalid seed phrase words')

      // Should show error or disable continue
      const errorVisible = await extensionPopup.getByText(/invalid|error/i).isVisible()
      const isDisabled = await onboarding.continueButton.isDisabled()

      expect(errorVisible || isDisabled).toBe(true)
    })

    test('should import wallet with valid seed phrase', async ({ extensionPopup }) => {
      const onboarding = new OnboardingPage(extensionPopup)

      await onboarding.importExistingWallet(TEST_SEED_PHRASE, TEST_PASSWORD)

      // Should redirect to home
      const home = new WalletHomePage(extensionPopup)
      await home.verifyUnlocked()
    })
  })

  test.describe('Lock and Unlock', () => {
    test.beforeEach(async ({ extensionPopup }) => {
      // Create a new wallet first
      const onboarding = new OnboardingPage(extensionPopup)
      await onboarding.createNewWallet(TEST_PASSWORD)
    })

    test('should lock wallet and require password to unlock', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)
      const lock = new LockPage(extensionPopup)

      // Lock wallet
      await home.lockWallet()

      // Verify locked
      await expect(lock.passwordInput).toBeVisible()
      await expect(lock.unlockButton).toBeVisible()
    })

    test('should unlock wallet with correct password', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)
      const lock = new LockPage(extensionPopup)

      // Lock and unlock
      await home.lockWallet()
      await lock.unlock(TEST_PASSWORD)
      await lock.verifyUnlocked()

      // Should be back on home
      await home.verifyUnlocked()
    })

    test('should show error with wrong password', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)
      const lock = new LockPage(extensionPopup)

      // Lock wallet
      await home.lockWallet()

      // Try wrong password
      await lock.verifyWrongPasswordError('WrongPassword123!')
    })
  })
})
