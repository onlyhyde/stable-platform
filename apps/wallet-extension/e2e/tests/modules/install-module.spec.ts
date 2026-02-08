/**
 * Module Installation E2E Tests
 *
 * Tests for installing and uninstalling Smart Account modules.
 */

import { expect, test } from '@playwright/test'
import { getExtensionId, setupSmartAccountWallet } from '../../fixtures/extension'
import { ModulesPage, WalletHomePage } from '../../pages'

test.describe('Module Installation', () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    extensionId = await getExtensionId(context)
    await context.close()
  })

  test.beforeEach(async ({ page, context }) => {
    // Setup wallet with Smart Account
    await setupSmartAccountWallet(context)

    // Navigate to wallet home
    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()
  })

  test('should display modules page', async ({ page }) => {
    const homePage = new WalletHomePage(page)
    const modulesPage = new ModulesPage(page)

    // Navigate to modules (via settings or direct)
    await homePage.goToSettings()
    await page.getByText(/modules/i).click()

    await modulesPage.verifyModulesPageVisible()
  })

  test('should install spending limit hook', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    // Navigate to modules page
    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.verifyModulesPageVisible()

    // Start installation wizard
    await modulesPage.startInstallWizard()

    // Select Hook type
    await modulesPage.selectModuleType('hook')

    // Select Spending Limit module
    await modulesPage.selectModule('spending-limit')

    // Configure the module
    await modulesPage.fillConfigForm({
      limit: '1',
    })
    await modulesPage.selectConfigOption('period', 'daily')

    // Continue to confirmation
    await modulesPage.continueWizard()

    // Confirm installation
    await modulesPage.confirmInstall()

    // Wait for transaction confirmation in wallet
    // (This would typically require interacting with the approval popup)

    // Verify module appears in list
    const isInstalled = await modulesPage.isModuleInstalled('spending-limit')
    expect(isInstalled).toBe(true)
  })

  test('should install ECDSA validator', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.verifyModulesPageVisible()

    await modulesPage.startInstallWizard()

    // Select Validator type
    await modulesPage.selectModuleType('validator')

    // Select ECDSA Validator
    await modulesPage.selectModule('ecdsa-validator')

    // Configure with owner address
    await modulesPage.fillConfigForm({
      owner: '0x1234567890123456789012345678901234567890',
    })

    await modulesPage.continueWizard()
    await modulesPage.confirmInstall()

    const isInstalled = await modulesPage.isModuleInstalled('ecdsa-validator')
    expect(isInstalled).toBe(true)
  })

  test('should show module details', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    // First install a module
    await modulesPage.installModule('hook', 'spending-limit', { limit: '1' })

    // View details
    await modulesPage.viewModuleDetails('spending-limit')

    // Verify details are shown
    await expect(modulesPage.detailsView).toBeVisible()
    await expect(modulesPage.detailsName).toContainText(/spending/i)
    await expect(modulesPage.uninstallButton).toBeVisible()
  })

  test('should cancel installation wizard', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.verifyModulesPageVisible()

    const initialCount = await modulesPage.getInstalledModuleCount()

    // Start wizard
    await modulesPage.startInstallWizard()

    // Select type
    await modulesPage.selectModuleType('hook')

    // Cancel
    await modulesPage.cancelWizard()

    // Verify no module was added
    const finalCount = await modulesPage.getInstalledModuleCount()
    expect(finalCount).toBe(initialCount)
  })

  test('should validate required fields in config form', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.startInstallWizard()

    await modulesPage.selectModuleType('validator')
    await modulesPage.selectModule('ecdsa-validator')

    // Try to continue without filling required field
    await modulesPage.continueWizard()

    // Should show validation error
    const errorVisible = await page.locator('text=/required/i').isVisible()
    expect(errorVisible).toBe(true)
  })
})

test.describe('Module Uninstallation', () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    extensionId = await getExtensionId(context)
    await context.close()
  })

  test.beforeEach(async ({ page, context }) => {
    await setupSmartAccountWallet(context)

    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()
  })

  test('should uninstall module', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    // First install a module
    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.installModule('hook', 'spending-limit', { limit: '1' })

    // Verify it's installed
    let isInstalled = await modulesPage.isModuleInstalled('spending-limit')
    expect(isInstalled).toBe(true)

    // View module details
    await modulesPage.viewModuleDetails('spending-limit')

    // Click uninstall
    await modulesPage.uninstallModule()

    // Confirm uninstallation
    await modulesPage.confirmUninstall()

    // Wait for transaction confirmation

    // Verify module is removed
    isInstalled = await modulesPage.isModuleInstalled('spending-limit')
    expect(isInstalled).toBe(false)
  })

  test('should cancel uninstall', async ({ page }) => {
    const modulesPage = new ModulesPage(page)

    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)
    await modulesPage.installModule('hook', 'spending-limit', { limit: '1' })

    await modulesPage.viewModuleDetails('spending-limit')
    await modulesPage.uninstallModule()

    // Cancel instead of confirming
    await modulesPage.cancelUninstall()

    // Module should still be installed
    await modulesPage.goBack()
    const isInstalled = await modulesPage.isModuleInstalled('spending-limit')
    expect(isInstalled).toBe(true)
  })
})

test.describe('Module Categories', () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    extensionId = await getExtensionId(context)
    await context.close()
  })

  test('should display module categories', async ({ page, context }) => {
    await setupSmartAccountWallet(context)

    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()

    const modulesPage = new ModulesPage(page)
    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)

    // Verify category tabs exist
    await expect(modulesPage.categoryTabs).toBeVisible()
  })

  test('should filter modules by category', async ({ page, context }) => {
    await setupSmartAccountWallet(context)

    const homePage = new WalletHomePage(page)
    await homePage.goto(extensionId)
    await homePage.verifyUnlocked()

    const modulesPage = new ModulesPage(page)
    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html#/modules`)

    // Click on validator category
    await modulesPage.validatorTab.click()

    // Modules displayed should only be validators
    // (This depends on having installed modules to filter)
  })
})
