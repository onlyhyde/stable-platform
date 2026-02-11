/**
 * Playwright Configuration for Wallet Extension E2E Tests
 *
 * This configuration is specifically designed for testing Chrome extensions.
 * It uses a persistent context with the extension loaded.
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// Path to the built extension
const EXTENSION_PATH = path.join(__dirname, 'dist')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Extensions require sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: [['html', { outputFolder: 'e2e-report' }], ['list']],
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  use: {
    // Base URL for test pages
    baseURL: 'http://localhost:5173',

    // Trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome extension testing requires launching with specific args
        launchOptions: {
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'e2e-results',

  // Web server to serve test pages (optional - for dApp simulation)
  webServer: {
    command: 'pnpm run dev:test-server',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
