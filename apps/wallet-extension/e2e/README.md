# E2E Tests for Wallet Extension

End-to-end tests using Playwright for testing the Chrome extension.

## Setup

### 1. Install Playwright Browsers

```bash
# From wallet-extension directory
pnpm exec playwright install chromium
```

### 2. Build the Extension

```bash
pnpm build
```

### 3. Run Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI (interactive mode)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Debug mode
pnpm test:e2e:debug
```

## Test Structure

```
e2e/
├── fixtures/           # Playwright test fixtures
│   └── extension.ts    # Extension loading and helper fixtures
├── pages/              # Page Object Models
│   ├── OnboardingPage.ts
│   ├── WalletHomePage.ts
│   ├── ApprovalPage.ts
│   ├── LockPage.ts
│   └── index.ts
├── tests/              # Test specs
│   ├── onboarding.spec.ts   # Wallet creation/import tests
│   ├── transactions.spec.ts # Transaction signing tests
│   └── network.spec.ts      # Network switching tests
├── test-server.js      # Simple dApp server for testing
└── README.md
```

## Test Suites

### Onboarding Flow (`onboarding.spec.ts`)
- Create new wallet
- Import existing wallet
- Password validation
- Seed phrase backup and confirmation
- Lock/unlock functionality

### Transaction Signing (`transactions.spec.ts`)
- dApp connection request
- Connection approval/rejection
- Transaction approval/rejection
- Message signing (personal_sign)
- EIP-712 typed data signing

### Network Management (`network.spec.ts`)
- View current network
- Switch networks from UI
- Network switch via dApp request
- Add custom network via dApp

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- **Test timeout**: 60 seconds
- **Assertion timeout**: 10 seconds
- **Browser**: Chromium with extension loaded
- **Artifacts**: Screenshots, videos, and traces on failure

## Test Server

The test server (`test-server.js`) provides a simple dApp page for testing wallet interactions:

```bash
# Start the test server manually
node e2e/test-server.js
```

The server runs on `http://localhost:5173` and provides buttons for:
- Connect wallet
- Send transaction
- Sign message
- Sign typed data
- Switch network

## Writing New Tests

1. Use the `test` and `expect` exports from `./fixtures/extension`
2. Use Page Objects for UI interactions
3. Access extension via fixtures: `extensionContext`, `extensionId`, `extensionPopup`

Example:

```typescript
import { test, expect } from '../fixtures/extension'
import { WalletHomePage } from '../pages'

test('should display balance', async ({ extensionPopup }) => {
  const home = new WalletHomePage(extensionPopup)
  await home.verifyUnlocked()

  const balance = await home.getBalance()
  expect(balance.amount).toBeDefined()
})
```

## CI/CD Integration

For CI environments:

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium --with-deps

# Build extension
pnpm build

# Run tests
pnpm test:e2e
```

## Troubleshooting

### Extension not loading
- Ensure extension is built: `pnpm build`
- Check `dist/` directory exists

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if extension pages are loading correctly

### Browser not installing
- Try: `npx playwright install chromium --with-deps`
- Check network/proxy settings
