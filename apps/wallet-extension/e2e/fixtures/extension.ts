/**
 * Playwright Test Fixtures for Chrome Extension Testing
 *
 * Provides custom fixtures for:
 * - Loading the wallet extension
 * - Getting extension pages (popup, approval)
 * - Managing extension state
 */

import { type BrowserContext, test as base, chromium, type Page } from '@playwright/test'
import path from 'path'

// Extension paths
const EXTENSION_PATH = path.join(__dirname, '../../dist')

/**
 * Extension test fixtures
 */
export interface ExtensionFixtures {
  /** Browser context with extension loaded */
  extensionContext: BrowserContext
  /** Extension ID (needed for accessing extension pages) */
  extensionId: string
  /** Extension popup page */
  extensionPopup: Page
  /** Helper to open approval popup */
  openApprovalPopup: (approvalId: string) => Promise<Page>
  /** Helper to get extension URL */
  getExtensionUrl: (path: string) => string
}

/**
 * Extended test with extension fixtures
 */
export const test = base.extend<ExtensionFixtures>({
  // Create a browser context with the extension loaded
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
  extensionContext: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    await use(context)
    await context.close()
  },

  // Get extension ID from service worker (Playwright 1.58 official pattern)
  extensionId: async ({ extensionContext }, use) => {
    let [serviceWorker] = extensionContext.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await extensionContext.waitForEvent('serviceworker')
    }
    const extensionId = serviceWorker.url().split('/')[2]
    await use(extensionId)
  },

  // Open extension popup
  extensionPopup: async ({ extensionContext, extensionId }, use) => {
    const popupUrl = `chrome-extension://${extensionId}/src/ui/index.html`
    const popup = await extensionContext.newPage()
    await popup.goto(popupUrl)
    await popup.waitForLoadState('domcontentloaded')

    await use(popup)
    await popup.close()
  },

  // Helper to open approval popup
  openApprovalPopup: async ({ extensionContext, extensionId }, use) => {
    const openApproval = async (approvalId: string): Promise<Page> => {
      const approvalUrl = `chrome-extension://${extensionId}/src/approval/approval.html?id=${encodeURIComponent(approvalId)}`
      const page = await extensionContext.newPage()
      await page.goto(approvalUrl)
      await page.waitForLoadState('domcontentloaded')
      return page
    }

    await use(openApproval)
  },

  // Helper to get extension URL
  getExtensionUrl: async ({ extensionId }, use) => {
    const getUrl = (urlPath: string): string => {
      return `chrome-extension://${extensionId}/${urlPath}`
    }

    await use(getUrl)
  },
})

export { expect } from '@playwright/test'

/**
 * Standalone helper to get extension ID from a browser context
 * Useful when not using the full test fixtures
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  let [serviceWorker] = context.serviceWorkers()
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10000 })
  }
  return serviceWorker.url().split('/')[2]
}

/**
 * Options for setting up a wallet with funds
 */
export interface SetupWalletOptions {
  /** Enable Smart Account mode */
  enableSmartAccount?: boolean
  /** Amount of ETH to fund (for testnet) */
  fundAmount?: string
  /** Mnemonic phrase to use (optional, generates new if not provided) */
  mnemonic?: string
}

/**
 * Setup a wallet with funds for testing
 * This is a placeholder that should be implemented based on your test environment
 */
export async function setupWalletWithFunds(
  context: BrowserContext,
  options: SetupWalletOptions = {}
): Promise<void> {
  const { enableSmartAccount = false, fundAmount: _fundAmount = '1', mnemonic: _mnemonic } = options

  const extensionId = await getExtensionId(context)
  const page = await context.newPage()

  try {
    // Navigate to extension
    await page.goto(`chrome-extension://${extensionId}/src/ui/index.html`)
    await page.waitForLoadState('domcontentloaded')

    // TODO: Implement actual wallet setup logic based on your onboarding flow
    // This typically involves:
    // 1. Creating or importing a wallet
    // 2. Setting up the password
    // 3. Configuring Smart Account mode if enabled
    // 4. Funding the wallet (for testnet environments)

    // For now, we'll just wait for the extension to load
    await page.waitForTimeout(1000)

    // If mnemonic is provided, import wallet
    // If not, create new wallet

    // Configure Smart Account if enabled
    if (enableSmartAccount) {
      // Navigate to settings and enable Smart Account
      // This depends on your UI implementation
    }

    // Fund wallet if on testnet
    // This typically involves calling a faucet or using pre-funded accounts
  } finally {
    await page.close()
  }
}

/**
 * Setup a wallet with Smart Account enabled
 * Convenience wrapper around setupWalletWithFunds
 */
export async function setupSmartAccountWallet(context: BrowserContext): Promise<void> {
  await setupWalletWithFunds(context, {
    enableSmartAccount: true,
    fundAmount: '1',
  })
}
