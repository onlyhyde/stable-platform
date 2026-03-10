# StableNet Wallet Extension

Chrome extension wallet for StableNet — an ERC-4337 compatible smart account wallet with EIP-7702 support, modular account architecture, and MetaMask compatibility mode.

## Features

- **ERC-4337 Smart Accounts** — UserOperation-based transactions with bundler and paymaster integration
- **EIP-7702 Authorization** — Delegate EOA execution to smart account logic
- **EIP-1193 Provider** — Standard Ethereum provider at `window.stablenet` and `window.ethereum`
- **EIP-6963 Multi-Wallet Discovery** — Automatic wallet announcement for dApp discovery
- **MetaMask Compatibility Mode** — Appear as MetaMask for legacy dApp support (dynamic toggle, no reload)
- **Modular Account Architecture** — Install/uninstall validator, executor, hook, and fallback modules (ERC-7579)
- **Multi-Validator Support** — Pluggable validator registry for ECDSA, Passkey, and custom validators
- **HD Wallet & Imported Keys** — BIP-39 mnemonic + individual private key import
- **Ledger Hardware Wallet** — WebHID-based Ledger integration
- **Stealth Addresses** — Privacy-preserving transactions via `@stablenet/plugin-stealth`
- **On-Ramp Integration** — Fiat-to-crypto purchase flow with bank account linking
- **Internationalization** — English and Korean (`i18next`)
- **Side Panel Support** — Chrome Side Panel API for persistent wallet access

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Web Page                                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Inpage Provider (window.ethereum / window.stablenet)│  │
│  │ EIP-1193 + EIP-6963 + Legacy web3 shim            │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ postMessage                    │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │ Content Script (message relay + origin isolation)  │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ chrome.runtime.sendMessage
┌─────────────────────────┼───────────────────────────────┐
│  Background Service Worker (MV3)                        │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │ RPC Handler (5100+ lines)                          │  │
│  │ eth_*, wallet_*, stablenet_* methods               │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Controllers          │ Security                    │  │
│  │ • Transaction        │ • Origin Verifier (SEC-3)   │  │
│  │ • Network            │ • Phishing Guard            │  │
│  │ • Permission         │ • Call Data Decoder         │  │
│  │ • Approval           │ • Error Sanitizer           │  │
│  │ • MultiMode TX       │ • Memory Sanitizer          │  │
│  │ • Gas Fee            │ • Audit Logger              │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Keyring              │ State                       │  │
│  │ • HD Keyring (BIP-39)│ • WalletStateManager        │  │
│  │ • Simple Keyring     │ • chrome.storage.local       │  │
│  │ • Session Crypto     │ • Migration system           │  │
│  │ • AES-256-GCM + PBKDF2                             │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │ chrome.runtime.sendMessage
┌─────────────────────────┼───────────────────────────────┐
│  UI Layer (React 19 + Zustand + Tailwind CSS 4)         │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │ Popup / Side Panel / Approval Window               │  │
│  │ Pages: Home, Send, Modules, Onboarding, Lock, Buy  │  │
│  │ Hooks: useAssets, useApproval, useGasEstimate, etc. │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Messaging Flow

1. **Inpage → Content Script**: `window.postMessage` with target `stablenet-contentscript`
2. **Content Script → Background**: `chrome.runtime.sendMessage` (origin derived from `sender.tab.url`, not message payload)
3. **Background → Content Script → Inpage**: Response relayed back with target `stablenet-inpage`
4. **Background → UI**: State updates via `chrome.storage.onChanged` and direct messaging

### Security Model

| Control | Implementation |
|---------|---------------|
| Origin verification | Derived from `chrome.runtime.MessageSender`, never from message payload (SEC-3) |
| Settings storage | `chrome.storage.local` instead of `localStorage` to prevent page script access (SEC-2) |
| Key encryption | AES-256-GCM with PBKDF2 (100k iterations) via `@noble/hashes` |
| Password verification | Constant-time comparison to prevent timing attacks |
| Memory sanitization | Explicit zeroing of private keys on wallet lock |
| Message validation | Schema validation for all cross-boundary messages |
| Input validation | `InputValidator` + `TypedDataValidator` for all RPC inputs |
| Rate limiting | Per-origin rate limiting on RPC requests |
| Phishing detection | Origin-based phishing guard before RPC processing |

## Project Structure

```
src/
├── background/           # Service worker (MV3)
│   ├── controllers/      # Transaction, Network, Permission, Approval, MultiMode TX
│   ├── keyring/           # HD Keyring, Simple Keyring, Crypto (AES-256-GCM), Session
│   ├── rpc/               # RPC handler, validation, paymaster, kernel init
│   ├── security/          # Phishing guard, call data decoder
│   ├── services/          # Token price service, transaction cache
│   ├── state/             # WalletStateManager, migrations, utilities
│   ├── utils/             # Event broadcaster
│   └── validators/        # Validator registry (multi-validator support)
├── contentscript/         # Message relay bridge
├── inpage/                # EIP-1193 provider (window.ethereum)
├── approval/              # Transaction approval popup
│   ├── components/        # ApprovalWarnings, TransactionSimulation
│   └── pages/             # Approval page
├── ui/                    # React UI layer
│   ├── components/        # Common (Button, Card, Modal, etc.), Bank, OnRamp
│   ├── hooks/             # useAssets, useApproval, useGasEstimate, useOnRamp, etc.
│   ├── pages/             # Home, Send, Modules, Onboarding, Lock
│   └── styles/            # Tailwind CSS
├── shared/                # Cross-layer utilities
│   ├── api/               # Base API client
│   ├── errors/            # WalletError, RPC errors
│   ├── security/          # Origin verifier, memory sanitizer, audit logger, error sanitizer
│   ├── utils/             # Logger, account naming, EIP-7702 helpers
│   └── validation/        # Message schema validation
├── lib/                   # External API clients (bank, onramp)
├── config/                # Build-time configuration
├── i18n/                  # Internationalization (en, ko)
└── types/                 # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (workspace root)
- Chrome 120+ (for Manifest V3 + Side Panel support)

### Setup

```bash
# From monorepo root
pnpm install

# Build workspace dependencies first
pnpm build --filter=@stablenet/wallet-extension...

# Copy and configure environment
cp apps/wallet-extension/.env.example apps/wallet-extension/.env
```

### Development

```bash
# Watch mode (rebuilds on changes)
pnpm --filter @stablenet/wallet-extension dev

# Load in Chrome:
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist/ directory
```

### Testing

```bash
# Unit tests
pnpm --filter @stablenet/wallet-extension test

# Unit tests (CI subset)
pnpm --filter @stablenet/wallet-extension test:ci

# Watch mode
pnpm --filter @stablenet/wallet-extension test:watch

# Coverage report
pnpm --filter @stablenet/wallet-extension test:coverage

# E2E tests (Playwright)
pnpm --filter @stablenet/wallet-extension test:e2e

# E2E with UI
pnpm --filter @stablenet/wallet-extension test:e2e:ui
```

### Build

```bash
# Production build
pnpm --filter @stablenet/wallet-extension build

# Output: dist/
# ├── manifest.json      (version synced from package.json)
# ├── background.js      (ES module, standalone)
# ├── contentscript.js   (IIFE, standalone)
# ├── inpage.js           (IIFE, standalone)
# ├── popup.js / sidepanel.js / approval.js
# ├── chunks/             (shared UI chunks)
# ├── assets/             (CSS, fonts)
# └── icons/              (extension icons)
```

## Configuration

Environment variables are injected at build time via Vite. See `.env.example` for all options.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_WALLET_LOCAL_RPC_URL` | Local chain RPC URL | `http://localhost:8501` |
| `VITE_WALLET_LOCAL_BUNDLER_URL` | Local bundler URL | `http://localhost:4337` |
| `VITE_WALLET_LOCAL_PAYMASTER_URL` | Local paymaster URL | `http://localhost:4338` |
| `VITE_WALLET_AUTO_LOCK_MINUTES` | Auto-lock timeout | `5` |
| `VITE_WALLET_PBKDF2_ITERATIONS` | Key derivation iterations | `100000` |
| `VITE_WALLET_BANK_API_URL` | Bank simulator API | `http://localhost:4350/api/v1` |
| `VITE_WALLET_ONRAMP_API_URL` | OnRamp simulator API | `http://localhost:4352/api/v1` |

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| `@stablenet/core` | SDK: bundler client, UserOperation, security utilities, module operations |
| `@stablenet/contracts` | Contract addresses, ABIs, chain support detection |
| `@stablenet/plugin-stealth` | Stealth address privacy transactions |
| `viem` | Ethereum interactions, ABI encoding, address utilities |
| `react` / `react-dom` | UI rendering (v19) |
| `zustand` | Lightweight state management |
| `i18next` / `react-i18next` | Internationalization |
| `@noble/hashes` | Cryptographic primitives (PBKDF2, SHA-256) |
| `@scure/bip39` | BIP-39 mnemonic generation and validation |
| `@ledgerhq/hw-app-eth` | Ledger hardware wallet integration |

### Development

| Package | Purpose |
|---------|---------|
| `vite` + `@vitejs/plugin-react` | Build toolchain |
| `tailwindcss` v4 | Utility-first CSS |
| `typescript` | Type safety |
| `jest` + `@testing-library/react` | Unit testing |
| `@playwright/test` | E2E browser testing |
| `@biomejs/biome` | Linting |

## Supported RPC Methods

### Standard Ethereum

`eth_chainId`, `eth_accounts`, `eth_requestAccounts`, `eth_getBalance`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_call`, `eth_estimateGas`, `eth_sendTransaction`, `eth_signTypedData_v4`, `personal_sign`, `net_version`, `web3_clientVersion`

### Wallet Methods

`wallet_switchEthereumChain`, `wallet_addEthereumChain`, `wallet_getPermissions`, `wallet_requestPermissions`, `wallet_revokePermissions`

### StableNet Custom

`stablenet_sendUserOperation`, `stablenet_getModules`, `stablenet_installModule`, `stablenet_uninstallModule`, `stablenet_getSmartAccountInfo`, `stablenet_switchValidator`

## License

Private — StableNet
