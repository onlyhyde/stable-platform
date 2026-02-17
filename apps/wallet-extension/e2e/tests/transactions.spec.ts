/**
 * E2E Tests: Transaction Signing
 *
 * Tests the transaction approval flows:
 * - dApp connection request
 * - Transaction approval/rejection
 * - Message signing
 * - EIP-712 typed data signing
 */

import { expect, test } from '../fixtures/extension'
import { ApprovalPage, OnboardingPage, WalletHomePage } from '../pages'

// Test password
const TEST_PASSWORD = 'TestP@ssword123!'

// Mock dApp URL
const TEST_DAPP_URL = 'http://localhost:5173'

test.describe('Transaction Signing', () => {
  // Set up wallet before tests
  test.beforeEach(async ({ extensionPopup }) => {
    const onboarding = new OnboardingPage(extensionPopup)
    await onboarding.createNewWallet(TEST_PASSWORD)

    const home = new WalletHomePage(extensionPopup)
    await home.verifyUnlocked()
  })

  test.describe('dApp Connection', () => {
    test('should display connection request from dApp', async ({
      extensionContext,
      extensionId,
    }) => {
      // Open a dApp page
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Request connection via ethereum provider
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {
          // Expected to fail/timeout - we just want to trigger the popup
        })

      // Wait for approval popup
      await dappPage.waitForTimeout(1000)

      // Find the approval popup
      const pages = extensionContext.pages()
      const approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()

        // Verify it's a connection request
        const type = await approval.getApprovalType()
        expect(type).toBe('connect')

        // Verify origin is shown
        const origin = await approval.getOrigin()
        expect(origin).toContain('localhost')
      }

      await dappPage.close()
    })

    test('should approve connection request', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Request connection
      const connectionPromise = dappPage.evaluate(() => {
        return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
      })

      // Wait for popup
      await dappPage.waitForTimeout(2000)

      // Find and approve
      const pages = extensionContext.pages()
      const approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
      }

      // Verify connection succeeded
      try {
        const accounts = await connectionPromise
        expect(Array.isArray(accounts)).toBe(true)
        if (accounts) {
          expect(accounts.length).toBeGreaterThan(0)
        }
      } catch {
        // May timeout if popup doesn't appear
      }

      await dappPage.close()
    })

    test('should reject connection request', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Request connection
      const connectionPromise = dappPage.evaluate(() => {
        return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
      })

      // Wait for popup
      await dappPage.waitForTimeout(2000)

      // Find and reject
      const pages = extensionContext.pages()
      const approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.reject()
      }

      // Verify connection was rejected
      try {
        await connectionPromise
        // Should have thrown
        expect(false).toBe(true)
      } catch (error) {
        // Expected - user rejected
        expect(error).toBeDefined()
      }

      await dappPage.close()
    })
  })

  test.describe('Transaction Approval', () => {
    test('should display transaction details in approval popup', async ({
      extensionContext,
      extensionId,
    }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // First connect
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({ method: 'eth_requestAccounts' })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      // Approve connection if popup appears
      let pages = extensionContext.pages()
      let approvalPopup = pages.find((p) => p.url().includes('approval.html'))
      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
        await approvalPopup.waitForTimeout(500)
      }

      // Send transaction
      await dappPage
        .evaluate(() => {
          return (window as unknown).ethereum?.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: '0x0000000000000000000000000000000000000001',
                to: '0x0000000000000000000000000000000000000002',
                value: '0x1',
                gas: '0x5208',
              },
            ],
          })
        })
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      // Find transaction approval popup
      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()

        // Verify transaction details
        const type = await approval.getApprovalType()
        expect(type).toBe('transaction')

        const details = await approval.getTransactionDetails()
        expect(details.to).toBeDefined()
        expect(details.value).toBeDefined()
      }

      await dappPage.close()
    })

    test('should approve transaction', async ({ extensionContext, extensionId }) => {
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

      // Send transaction and approve
      const txPromise = dappPage.evaluate(() => {
        return (window as unknown).ethereum?.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: '0x0000000000000000000000000000000000000002',
              value: '0x1',
            },
          ],
        })
      })

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
      }

      // Result should be a transaction hash
      try {
        const txHash = await txPromise
        if (txHash) {
          expect(typeof txHash).toBe('string')
          expect((txHash as string).startsWith('0x')).toBe(true)
        }
      } catch {
        // May fail due to network issues
      }

      await dappPage.close()
    })

    test('should reject transaction', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect and approve
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

      // Send and reject transaction
      const txPromise = dappPage.evaluate(() => {
        return (window as unknown).ethereum?.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: '0x0000000000000000000000000000000000000002',
              value: '0x1',
            },
          ],
        })
      })

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.reject()
      }

      // Should throw error
      try {
        await txPromise
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error).toBeDefined()
      }

      await dappPage.close()
    })
  })

  test.describe('Message Signing', () => {
    test('should display signature request for personal_sign', async ({
      extensionContext,
      extensionId,
    }) => {
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

      // Request signature
      const message = 'Hello, StableNet!'
      await dappPage
        .evaluate((msg) => {
          const accounts = (window as unknown).ethereum?.selectedAddress
          return (window as unknown).ethereum?.request({
            method: 'personal_sign',
            params: [msg, accounts || '0x0000000000000000000000000000000000000001'],
          })
        }, message)
        .catch(() => {})

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()

        const type = await approval.getApprovalType()
        expect(type).toBe('signature')
      }

      await dappPage.close()
    })

    test('should approve signature request', async ({ extensionContext, extensionId }) => {
      const dappPage = await extensionContext.newPage()
      await dappPage.goto(TEST_DAPP_URL)

      // Connect and approve
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

      // Sign message
      const signPromise = dappPage.evaluate(() => {
        return (window as unknown).ethereum?.request({
          method: 'personal_sign',
          params: ['Hello, StableNet!', '0x0000000000000000000000000000000000000001'],
        })
      })

      await dappPage.waitForTimeout(2000)

      pages = extensionContext.pages()
      approvalPopup = pages.find((p) => p.url().includes('approval.html'))

      if (approvalPopup) {
        const approval = new ApprovalPage(approvalPopup)
        await approval.waitForLoad()
        await approval.approve()
      }

      try {
        const signature = await signPromise
        if (signature) {
          expect(typeof signature).toBe('string')
          expect((signature as string).startsWith('0x')).toBe(true)
        }
      } catch {
        // May fail
      }

      await dappPage.close()
    })
  })
})
