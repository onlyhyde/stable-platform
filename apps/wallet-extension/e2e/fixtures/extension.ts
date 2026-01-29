/**
 * Playwright Test Fixtures for Chrome Extension Testing
 *
 * Provides custom fixtures for:
 * - Loading the wallet extension
 * - Getting extension pages (popup, approval)
 * - Managing extension state
 */

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
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
  extensionContext: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
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

  // Get extension ID from service worker
  extensionId: async ({ extensionContext }, use) => {
    // Wait for service worker to be registered
    let extensionId = ''

    // Get background service worker to find extension ID
    const serviceWorkers = extensionContext.serviceWorkers()
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url()
      const match = url.match(/chrome-extension:\/\/([^/]+)/)
      if (match) {
        extensionId = match[1]
      }
    }

    // If not found from service workers, try from pages
    if (!extensionId) {
      // Open a page and check for extension
      const page = await extensionContext.newPage()
      await page.goto('chrome://extensions/')
      await page.waitForTimeout(1000)

      // Try to get extension ID from manifest
      const backgroundPages = extensionContext.backgroundPages()
      if (backgroundPages.length > 0) {
        const url = backgroundPages[0].url()
        const match = url.match(/chrome-extension:\/\/([^/]+)/)
        if (match) {
          extensionId = match[1]
        }
      }

      await page.close()
    }

    // Fallback: wait for service worker and retry
    if (!extensionId) {
      await extensionContext.waitForEvent('serviceworker', { timeout: 10000 })
      const workers = extensionContext.serviceWorkers()
      if (workers.length > 0) {
        const url = workers[0].url()
        const match = url.match(/chrome-extension:\/\/([^/]+)/)
        if (match) {
          extensionId = match[1]
        }
      }
    }

    if (!extensionId) {
      throw new Error('Could not find extension ID')
    }

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
