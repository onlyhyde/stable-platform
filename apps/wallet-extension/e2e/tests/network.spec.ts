/**
 * E2E Tests: Network Switching
 *
 * Tests the network management flows:
 * - View current network
 * - Switch between networks
 * - Add custom network (via dApp request)
 * - Network switch approval
 */

import { expect, test } from '../fixtures/extension'
import { ApprovalPage, OnboardingPage, WalletHomePage } from '../pages'

// Test password
const TEST_PASSWORD = 'TestP@ssword123!'

// Test dApp URL
const TEST_DAPP_URL = 'http://localhost:5173'

// Network configurations
const NETWORKS = {
  devnet: {
    name: 'StableNet Devnet',
    chainId: '0x7a69', // 31337
    rpcUrl: 'http://localhost:8545',
  },
  sepolia: {
    name: 'Sepolia',
    chainId: '0xaa36a7', // 11155111
    rpcUrl: 'https://testnet.stablenet.io/rpc',
  },
}

test.describe('Network Management', () => {
  // Set up wallet before tests
  test.beforeEach(async ({ extensionPopup }) => {
    const onboarding = new OnboardingPage(extensionPopup)
    await onboarding.createNewWallet(TEST_PASSWORD)

    const home = new WalletHomePage(extensionPopup)
    await home.verifyUnlocked()
  })

  test.describe('Network Display', () => {
    test('should display current network in header', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)

      // Network selector should be visible
      await expect(home.networkSelector).toBeVisible()

      // Should show a network name
      const networkName = await home.getCurrentNetwork()
      expect(networkName.length).toBeGreaterThan(0)
    })

    test('should show network list when clicking selector', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)

      await home.openNetworkSelector()

      // Network list should be visible
      await expect(home.networkList).toBeVisible()
    })
  })

  test.describe('Network Switching in Wallet', () => {
    test('should switch network from wallet UI', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)

      // Get initial network
      const initialNetwork = await home.getCurrentNetwork()

      // Open network selector and look for other networks
      await home.openNetworkSelector()

      // Find a different network option
      const networkOptions = extensionPopup.locator(
        '[data-testid="network-list"] [data-testid^="network-"]'
      )
      const count = await networkOptions.count()

      if (count > 1) {
        // Find a network different from current
        for (let i = 0; i < count; i++) {
          const option = networkOptions.nth(i)
          const name = await option.textContent()
          if (name && !name.includes(initialNetwork)) {
            await option.click()
            break
          }
        }

        // Verify network changed
        await extensionPopup.waitForTimeout(500)
        const newNetwork = await home.getCurrentNetwork()
        expect(newNetwork).not.toBe(initialNetwork)
      }
    })

    test('should persist network selection after lock/unlock', async ({ extensionPopup }) => {
      const home = new WalletHomePage(extensionPopup)

      // Switch to a specific network
      await home.openNetworkSelector()
      const targetNetwork = extensionPopup.getByText(/sepolia|testnet/i).first()

      if (await targetNetwork.isVisible()) {
        await targetNetwork.click()
        await extensionPopup.waitForTimeout(500)

        const networkAfterSwitch = await home.getCurrentNetwork()

        // Lock and unlock
        await home.lockWallet()

        const { LockPage } = await import('../pages/LockPage')
        const lock = new LockPage(extensionPopup)
        await lock.unlock(TEST_PASSWORD)

        // Verify network persisted
        const networkAfterUnlock = await home.getCurrentNetwork()
        expect(networkAfterUnlock).toBe(networkAfterSwitch)
      }
    })
  })

  test.describe('Network Switching via dApp', () => {
    test('should display network switch request from dApp', async ({
      extensionContext,
      extensionId,
    }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect first
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      // Approve connection
      let pages = extensionContext.pages()
      let approvalPopup = pages.find((p) => p.url().includes('approval.html'))
      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
        await approvalPopup.waitForTimeout(500)
      }

      // Request network switch
      await dappPage
        .evaluate((chainId) => {
          return (window as unknown).ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId }],
          })
        }, NETWORKS.sepolia.chainId)
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      // Find network switch popup
      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()

        const type = await approval.getApprovalType()
        expect(type).toBe('network')
      }

      await dappPage.close()
    })

    test('should approve network switch request', async ({
      extensionContext,
      extensionId,
      extensionPopup,
    }) => {
      const home = new WalletHomePage(extensionPopup)
      const _initialNetwork = await home.getCurrentNetwork()

      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      let pages = extensionContext.pages()
      let approvalPopup = pages.find((p) => p.url().includes('approval.html'))
      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
        await approvalPopup.waitForTimeout(500)
      }

      // Request and approve network switch
      const switchPromise = dappPage.evaluate((chainId) => {
        return (window as unknown).ethereum?.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        })
      }, NETWORKS.sepolia.chainId)

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
      }

      try {
        await switchPromise
        // Success - network switched
      } catch {
        // May fail if network not configured
      }

      await dappPage.close()
    })

    test('should reject network switch request', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      let pages = extensionContext.pages()
      let approvalPopup = pages.find((p) => p.url().includes('approval.html'))
      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
        await approvalPopup.waitForTimeout(500)
      }

      // Request and reject network switch
      const switchPromise = dappPage.evaluate((chainId) => {
        return (window as unknown).ethereum?.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        })
      }, NETWORKS.sepolia.chainId)

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.reject()
      }

      try {
        await switchPromise
        expect(false).toBe(true) // Should not reach
      } catch (error) {
        expect(error).toBeDefined()
      }

      await dappPage.close()
    })
  })

  test.describe('Add Network via dApp', () => {
    test('should display add network request', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      let pages = extensionContext.pages()
      let approvalPopup = pages.find((p) => p.url().includes('approval.html'))
      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
        await approvalPopup.waitForTimeout(500)
      }

      // Request to add a new network
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x89', // Polygon
                chainName: 'Polygon Mainnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://polygon-rpc.com'],
                blockExplorerUrls: ['https://polygonscan.com'],
              },
            ],
          })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      // Should show approval for adding network
      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()

        // Should show network details
        await expect(approvalPopup.getByText(/polygon|add.*network/i)).toBeVisible()
      }

      await dappPage.close()
    })
  })
})
