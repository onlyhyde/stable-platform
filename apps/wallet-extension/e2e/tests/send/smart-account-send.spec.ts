/**
 * Smart Account Send E2E Tests
 *
 * Tests for sending transactions using Smart Account mode
 * with various gas payment options.
 */

import { expect, test } from '@playwright/test'
import { getExtensionId, setupWalletWithFunds } from '../../fixtures/extension'
import { SendPage, WalletHomePage } from '../../pages'

test.describe('Smart Account Send', () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    // Get extension ID from browser context
    const context = await browser.newContext()
    extensionId = await getExtensionId(context)
    await context.close()
  })

  test.beforeEach(async ({ page, context }) => {
    // Setup wallet with Smart Account enabled
    await setupWalletWithFunds(context, {
      enableSmartAccount: true,
      fundAmount: '1',
    })

    // Navigate to wallet home
    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()
  })

  test('should send ETH with sponsored gas', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    // Go to send page
    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    // Select Smart Account mode
    await sendPage.selectTransactionMode('smartAccount')

    // Fill form
    await sendPage.fillForm({
      recipient: '0x0987654321098765432109876543210987654321',
      amount: '0.01',
    })

    // Select sponsored gas
    await sendPage.selectGasPayment('sponsor')

    // Verify gas estimate shows free
    const gasDisplay = await sendPage.getGasEstimateDisplay()
    expect(gasDisplay.toLowerCase()).toContain('free')

    // Review and submit
    await sendPage.clickReview()
    await sendPage.confirmTransaction()

    // Verify success
    const successMessage = await sendPage.getSuccessMessage()
    expect(successMessage.toLowerCase()).toMatch(/sent|success/)
  })

  test('should send ETH with native gas payment', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    await sendPage.selectTransactionMode('smartAccount')

    await sendPage.fillForm({
      recipient: '0x0987654321098765432109876543210987654321',
      amount: '0.01',
    })

    // Select native gas payment
    await sendPage.selectGasPayment('native')

    // Gas estimate should show ETH amount
    const gasDisplay = await sendPage.getGasEstimateDisplay()
    expect(gasDisplay).toMatch(/ETH|wei/i)

    await sendPage.clickReview()
    await sendPage.confirmTransaction()

    const successMessage = await sendPage.getSuccessMessage()
    expect(successMessage.toLowerCase()).toMatch(/sent|success/)
  })

  test('should show insufficient balance error for ERC20 gas with no balance', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    await sendPage.selectTransactionMode('smartAccount')

    await sendPage.fillForm({
      recipient: '0x0987654321098765432109876543210987654321',
      amount: '0.01',
    })

    // Select ERC20 gas payment with no balance
    await sendPage.selectGasPayment('erc20', { token: 'USDC' })

    // Should show insufficient balance warning
    const warning = await sendPage.getWarningMessage()
    expect(warning?.toLowerCase()).toContain('insufficient')
  })

  test('should show error for invalid recipient address', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    // Fill with invalid address
    await sendPage.fillForm({
      recipient: 'invalid-address',
      amount: '0.01',
    })

    // Try to review
    await sendPage.clickReview()

    // Should show error
    const error = await sendPage.getErrorMessage()
    expect(error?.toLowerCase()).toMatch(/invalid|address/)
  })

  test('should disable Smart Account mode for EOA-only account', async ({ page, context }) => {
    // Setup EOA-only wallet
    await setupWalletWithFunds(context, {
      enableSmartAccount: false,
      fundAmount: '1',
    })

    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()
    await homePage.goToSend()

    // Smart Account option should be disabled or not visible
    const smartAccountOption = sendPage.smartAccountModeOption
    const isDisabled = await smartAccountOption.isDisabled().catch(() => false)
    const isHidden = !(await smartAccountOption.isVisible().catch(() => false))

    expect(isDisabled || isHidden).toBe(true)
  })
})

test.describe('EOA Send', () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    extensionId = await getExtensionId(context)
    await context.close()
  })

  test.beforeEach(async ({ page, context }) => {
    await setupWalletWithFunds(context, {
      enableSmartAccount: false,
      fundAmount: '1',
    })

    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()
  })

  test('should send ETH with EOA mode', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    // EOA mode should be default or selected
    await sendPage.selectTransactionMode('eoa')

    await sendPage.fillForm({
      recipient: '0x0987654321098765432109876543210987654321',
      amount: '0.01',
    })

    await sendPage.clickReview()
    await sendPage.confirmTransaction()

    const successMessage = await sendPage.getSuccessMessage()
    expect(successMessage.toLowerCase()).toMatch(/sent|success/)
  })

  test('should use max amount', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const sendPage = new SendPage(page)

    await homePage.goToSend()
    await sendPage.verifySendFormVisible()

    await sendPage.recipientInput.fill('0x0987654321098765432109876543210987654321')

    // Click max button
    await sendPage.useMaxAmount()

    // Amount should be filled
    const amount = await sendPage.amountInput.inputValue()
    expect(Number.parseFloat(amount)).toBeGreaterThan(0)
  })
})
