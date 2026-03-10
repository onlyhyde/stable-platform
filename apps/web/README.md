# StableNet Web Application

The frontend interface for the **StableNet PoC Platform** — a KRW stablecoin ecosystem built on **ERC-4337 Account Abstraction** with privacy features, modular smart accounts, and DeFi capabilities.

## Overview

StableNet Web is a Next.js 15 App Router application that serves as the user-facing dashboard for the StableNet protocol. It acts as a **thin orchestration layer** — delegating all blockchain logic (UserOperation construction, gas estimation, bundler submission) to the StableNet wallet extension, while providing a rich UI for account management, payments, DeFi, and enterprise features.

### Key Features

- **Smart Account Management** — EIP-7702 upgrade/revoke, ERC-7579 modular accounts
- **Stealth Transfers** — Privacy-preserving payments via stealth addresses
- **DeFi Suite** — Token swap, liquidity pools, lending, and staking
- **Subscription Payments** — Recurring payment plans with Permit2 approval
- **Enterprise Tools** — Payroll, expense tracking, and audit logs
- **Module Marketplace** — Browse and install ERC-7579 modules (validators, executors, hooks)
- **Session Keys** — Delegated signing with time-bound permissions
- **Multi-Chain Support** — StableNet Devnet (8283), Anvil Local (82830), Sepolia

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5 (App Router) |
| UI | React 19, Tailwind CSS 4.2 |
| Blockchain | Wagmi 3.5, Viem 2.46 |
| State | TanStack React Query 5.90 |
| Linting | Biome 2.4 |
| Testing | Vitest 4.0, Testing Library |
| Package Manager | pnpm (workspace) |

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (Header + Sidebar + Footer)
│   ├── page.tsx            # Dashboard homepage
│   ├── bank/               # Bank integration
│   ├── buy/                # Token purchase
│   ├── defi/               # DeFi suite (swap, pool, lend, stake)
│   ├── docs/               # Documentation viewer
│   ├── enterprise/         # Enterprise (payroll, expenses, audit)
│   ├── marketplace/        # Module marketplace
│   ├── payment/            # Send, receive, history
│   ├── privacy/            # Privacy settings
│   ├── session-keys/       # Session key management
│   ├── settings/           # App settings
│   ├── smart-account/      # Smart account upgrade/revoke
│   ├── stealth/            # Stealth address transfers
│   ├── subscription/       # Subscription plans
│   └── terms/              # Terms of service
├── components/             # React components (by feature domain)
│   ├── common/             # Shared primitives (Button, Card, Modal, Toast)
│   ├── layout/             # Header, Sidebar, Footer
│   ├── error/              # ErrorBoundary, ErrorFallback
│   ├── defi/               # DeFi-specific cards
│   ├── enterprise/         # Enterprise cards
│   ├── marketplace/        # Module marketplace cards
│   ├── merchant/           # Merchant dashboard cards
│   ├── payment/            # Payment components
│   ├── session-keys/       # Session key components
│   ├── settings/           # Settings cards
│   ├── smart-account/      # Smart account cards
│   ├── stealth/            # Stealth transfer cards
│   └── subscription/       # Subscription components
├── hooks/                  # 40+ custom React hooks
│   ├── useSmartAccount.ts  # EIP-7702 upgrade/revoke
│   ├── useUserOp.ts        # ERC-4337 UserOperation
│   ├── useWallet.ts        # Wallet connection
│   ├── useStealth.ts       # Stealth address operations
│   ├── usePaymaster.ts     # Gas sponsorship
│   ├── useSwap.ts          # Token swapping
│   └── ...                 # Domain-specific hooks
├── lib/                    # Utilities and configuration
│   ├── chains.ts           # Chain definitions
│   ├── constants.ts        # Contract addresses, service URLs
│   ├── wagmi.ts            # Wagmi client configuration
│   ├── utils.ts            # Formatting, error sanitization
│   ├── eip7702.ts          # EIP-7702 helpers
│   ├── secureKeyStore.ts   # Secure key storage
│   └── config/             # Environment configuration
├── providers/              # React context providers
│   ├── index.tsx           # Provider composition root
│   ├── StableNetProvider.tsx  # Chain-aware contract addresses
│   ├── WalletProvider.tsx  # Wagmi + React Query
│   └── ThemeProvider.tsx   # Dark theme management
├── types/                  # TypeScript type definitions
└── public/                 # Static assets
```

## Monorepo Context

This app is part of the `stable-platform` monorepo:

```
stable-platform/
├── apps/web/                   # This application
├── packages/
│   ├── sdk-ts/                 # TypeScript SDK (core, accounts, crypto, plugins)
│   ├── sdk-go/                 # Go SDK for server-side integration
│   ├── types/                  # Shared type definitions
│   ├── config/                 # Shared configuration
│   ├── contracts/              # Contract addresses and ABIs
│   ├── registry-client/        # Contract registry client
│   └── wallet-sdk/             # dApp integration SDK (EIP-1193)
├── services/
│   ├── bundler/                # ERC-4337 bundler (Fastify, port 4337)
│   ├── paymaster-proxy/        # ERC-7677 paymaster proxy (Hono, port 4338)
│   ├── contract-registry/      # Contract address service (WebSocket)
│   ├── module-registry/        # ERC-7579 module marketplace
│   ├── subscription-executor/  # Subscription execution (Go)
│   ├── bridge-relayer/         # Cross-chain relay (Go)
│   ├── order-router/           # Order routing (Go)
│   ├── bank-simulator/         # Bank simulation (Go)
│   ├── onramp-simulator/       # Fiat on-ramp simulation (Go)
│   └── pg-simulator/           # Payment gateway simulation (Go)
├── infra/                      # Docker, Grafana, Alertmanager
└── docs/                       # Architecture, specs, tutorials
```

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0

### Installation

```bash
# From the monorepo root
pnpm install

# Build shared dependencies
pnpm build

# Start the web app
cd apps/web
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables include RPC endpoints, bundler URL, paymaster URL, and contract addresses. See `.env.example` for the full list.

## Architecture

### Provider Stack

The app wraps all routes in a composed provider stack:

```
ThemeProvider          → Dark theme, localStorage persistence
  WalletProvider       → Wagmi config, React Query (SSR-safe, dynamic import)
    StableNetProvider  → Chain-aware contract addresses, service URLs
      ToastProvider    → Notification system
```

### Hook Architecture

All 40+ hooks follow a consistent contract:

- Return `{ isLoading, error, clearError, ...actions }`
- Stale request cancellation via `useRef` monotonic counter
- Immutable state updates via functional `setState`
- Error normalization to `Error` instances
- Dependency injection for testability (e.g., `useSwap({ sendUserOp? })`)

### Blockchain Interaction Model

The web app is a **thin client** — it does NOT construct UserOperations or interact with the bundler directly. Instead:

1. User triggers action in UI
2. Hook calls `provider.request('eth_sendUserOperation')` or `provider.sendTransaction()`
3. The **StableNet wallet extension** handles: nonce fetching, gas estimation, Kernel calldata wrapping, bundler submission
4. Web app receives the transaction hash and tracks status

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run tests (watch mode) |
| `pnpm test:run` | Run tests (single run) |

## Supported Standards

| Standard | Purpose |
|----------|---------|
| ERC-4337 v0.7 | Account Abstraction (UserOperations) |
| ERC-7579 | Modular Smart Accounts |
| EIP-7702 | Delegate Transactions (smart account upgrade) |
| ERC-7677 | Paymaster RPC interface |
| EIP-1193 | Wallet provider interface |

## License

MIT
