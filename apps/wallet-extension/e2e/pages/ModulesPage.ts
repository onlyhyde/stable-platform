/**
 * Page Object for Module Management Screen
 *
 * Handles:
 * - Module list display
 * - Module installation wizard
 * - Module details view
 * - Module uninstallation
 */

import { expect, type Locator, type Page } from '@playwright/test'

export type ModuleType = 'validator' | 'executor' | 'hook' | 'fallback'

export class ModulesPage {
  readonly page: Page

  // Header
  readonly backButton: Locator
  readonly title: Locator
  readonly addModuleButton: Locator

  // Category tabs
  readonly categoryTabs: Locator
  readonly validatorTab: Locator
  readonly executorTab: Locator
  readonly hookTab: Locator
  readonly fallbackTab: Locator

  // Module list
  readonly moduleList: Locator
  readonly moduleCards: Locator
  readonly emptyState: Locator

  // Module card elements
  readonly moduleStatusBadge: Locator

  // Install wizard
  readonly wizardModal: Locator
  readonly typeSelector: Locator
  readonly moduleSelector: Locator
  readonly configForm: Locator
  readonly confirmationStep: Locator

  // Install wizard actions
  readonly continueButton: Locator
  readonly installButton: Locator
  readonly wizardBackButton: Locator
  readonly wizardCancelButton: Locator

  // Module details
  readonly detailsView: Locator
  readonly detailsName: Locator
  readonly detailsDescription: Locator
  readonly detailsAddress: Locator
  readonly uninstallButton: Locator

  // Uninstall confirmation
  readonly uninstallConfirmDialog: Locator
  readonly confirmUninstallButton: Locator
  readonly cancelUninstallButton: Locator

  // Status indicators
  readonly installingIndicator: Locator
  readonly successMessage: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page

    // Header
    this.backButton = page.getByRole('button', { name: /back|←/i })
    this.title = page.getByRole('heading', { name: /modules/i })
    this.addModuleButton = page.getByRole('button', { name: /add.*module|\+/i })

    // Category tabs
    this.categoryTabs = page.locator('[data-testid="module-categories"]')
    this.validatorTab = page.locator('[data-type="validator"]')
    this.executorTab = page.locator('[data-type="executor"]')
    this.hookTab = page.locator('[data-type="hook"]')
    this.fallbackTab = page.locator('[data-type="fallback"]')

    // Module list
    this.moduleList = page.locator('[data-testid="module-list"], .module-list')
    this.moduleCards = page.locator('[data-testid="module-card"], .module-card')
    this.emptyState = page.locator('[data-testid="empty-state"], text=/no modules/i')

    // Module card elements
    this.moduleStatusBadge = page.locator('[data-module-status]')

    // Install wizard
    this.wizardModal = page.locator('.install-module-wizard')
    this.typeSelector = page.locator('.type-selector')
    this.moduleSelector = page.locator('.module-selector')
    this.configForm = page.locator('.module-config-form')
    this.confirmationStep = page.locator('.install-confirmation')

    // Install wizard actions
    this.continueButton = page.getByRole('button', { name: /continue|next/i })
    this.installButton = page.getByRole('button', { name: /install.*module/i })
    this.wizardBackButton = this.wizardModal.getByRole('button', { name: /back|←/i })
    this.wizardCancelButton = page.getByRole('button', { name: /cancel/i })

    // Module details
    this.detailsView = page.locator('.module-details')
    this.detailsName = page.locator('[data-testid="module-name"]')
    this.detailsDescription = page.locator('[data-testid="module-description"]')
    this.detailsAddress = page.locator('[data-testid="module-address"]')
    this.uninstallButton = page.getByRole('button', { name: /uninstall/i })

    // Uninstall confirmation
    this.uninstallConfirmDialog = page.locator('[data-testid="uninstall-confirm"]')
    this.confirmUninstallButton = page.getByRole('button', { name: /confirm.*uninstall/i })
    this.cancelUninstallButton = this.uninstallConfirmDialog.getByRole('button', {
      name: /cancel/i,
    })

    // Status
    this.installingIndicator = page.locator('.pending-state, text=/installing/i')
    this.successMessage = page.locator('[data-testid="success-message"], text=/success|installed/i')
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message')
  }

  /**
   * Click add module button to start installation wizard
   */
  async startInstallWizard() {
    await this.addModuleButton.click()
    await this.wizardModal.waitFor({ state: 'visible' })
  }

  /**
   * Select module type in wizard
   */
  async selectModuleType(type: ModuleType) {
    await this.page.locator(`[data-type="${type}"]`).click()
  }

  /**
   * Select specific module by name
   */
  async selectModule(moduleName: string) {
    await this.page.locator(`[data-module="${moduleName}"], text=${moduleName}`).click()
  }

  /**
   * Fill configuration form
   */
  async fillConfigForm(config: Record<string, string>) {
    for (const [name, value] of Object.entries(config)) {
      await this.page.locator(`[name="${name}"]`).fill(value)
    }
  }

  /**
   * Select dropdown option in config form
   */
  async selectConfigOption(name: string, value: string) {
    await this.page.locator(`[name="${name}"]`).selectOption(value)
  }

  /**
   * Continue to next step in wizard
   */
  async continueWizard() {
    await this.continueButton.click()
  }

  /**
   * Confirm module installation
   */
  async confirmInstall() {
    await this.installButton.click()
    // Wait for either success or error
    await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 60000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 60000 }),
    ]).catch(() => {
      // May redirect back to list
    })
  }

  /**
   * Install a module (full flow)
   */
  async installModule(type: ModuleType, moduleName: string, config?: Record<string, string>) {
    await this.startInstallWizard()
    await this.selectModuleType(type)
    await this.selectModule(moduleName)

    if (config && Object.keys(config).length > 0) {
      await this.fillConfigForm(config)
      await this.continueWizard()
    }

    await this.confirmInstall()
  }

  /**
   * Click on a module card to view details
   */
  async viewModuleDetails(moduleName: string) {
    await this.page.locator(`[data-module="${moduleName}"], text=${moduleName}`).click()
    await this.detailsView.waitFor({ state: 'visible' })
  }

  /**
   * Uninstall current module (from details view)
   */
  async uninstallModule() {
    await this.uninstallButton.click()
    // Wait for confirmation dialog
    await expect(this.confirmUninstallButton).toBeVisible()
  }

  /**
   * Confirm module uninstallation
   */
  async confirmUninstall() {
    await this.confirmUninstallButton.click()
    // Wait for completion
    await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 60000 }),
      this.moduleList.waitFor({ state: 'visible', timeout: 60000 }),
    ]).catch(() => {})
  }

  /**
   * Cancel uninstallation
   */
  async cancelUninstall() {
    await this.cancelUninstallButton.click()
  }

  /**
   * Get installed module count
   */
  async getInstalledModuleCount(): Promise<number> {
    return await this.moduleCards.count()
  }

  /**
   * Check if a specific module is installed
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    const moduleCard = this.page.locator(
      `[data-module="${moduleName}"][data-module-status="installed"]`
    )
    return await moduleCard.isVisible().catch(() => false)
  }

  /**
   * Get module status
   */
  async getModuleStatus(moduleName: string): Promise<string | null> {
    const moduleCard = this.page.locator(`[data-module="${moduleName}"]`)
    return await moduleCard.getAttribute('data-module-status')
  }

  /**
   * Verify modules page is displayed
   */
  async verifyModulesPageVisible() {
    await expect(this.title).toBeVisible()
    await expect(this.addModuleButton).toBeVisible()
  }

  /**
   * Go back to previous page
   */
  async goBack() {
    await this.backButton.click()
  }

  /**
   * Cancel installation wizard
   */
  async cancelWizard() {
    await this.wizardCancelButton.click()
    await this.wizardModal.waitFor({ state: 'hidden' })
  }
}
