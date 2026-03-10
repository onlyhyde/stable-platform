# @stablenet/paymaster-proxy

ERC-7677 Paymaster Proxy Service for StableNet. A JSON-RPC server that sits between ERC-4337 smart account wallets and on-chain paymaster contracts, handling gas sponsorship, policy enforcement, and settlement tracking.

## Features

- **Multi-Paymaster Routing** — Supports 4 paymaster types: Verifying, Sponsor, ERC-20 Token, and Permit2
- **ERC-7677 Compliance** — Implements `pm_getPaymasterStubData` and `pm_getPaymasterData` JSON-RPC methods
- **Policy Engine** — Per-sender spending limits, whitelist/blacklist, time windows, and risk scoring
- **Settlement Tracking** — Polls bundler for UserOperation receipts, confirms or cancels spending reservations
- **Deposit Monitoring** — Watches EntryPoint balances and auto-replenishes when deposits fall below threshold
- **Reservation Persistence** — Optional disk-based persistence for spending reservations across restarts
- **EOA + ERC-1271 Signing** — Supports both ECDSA and smart contract-based paymaster signatures

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your paymaster address, signer key, and RPC URL

# Development
pnpm dev

# Production
pnpm build && pnpm start
```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNER_PRIVATE_KEY` | Hex-encoded private key for signing paymaster data |
| `RPC_URL` | JSON-RPC URL for chain interaction |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYMASTER_ADDRESS` | Auto-resolved | Verifying paymaster contract address |
| `PAYMASTER_PORT` | `4338` | Server port |
| `PAYMASTER_DEBUG` | `false` | Enable request logging |
| `PAYMASTER_SUPPORTED_CHAIN_IDS` | `8283,1,11155111,84532` | Comma-separated supported chain IDs |
| `PAYMASTER_SPONSOR_NAME` | `StableNet Paymaster` | Sponsor name in responses |
| `PAYMASTER_VALIDITY_SECONDS` | `3600` | Signature validity duration (seconds) |
| `PAYMASTER_CLOCK_SKEW_SECONDS` | `60` | Allowed clock skew (seconds) |
| `BUNDLER_RPC_URL` | — | Bundler URL (enables settlement tracking) |
| `PAYMASTER_ADMIN_TOKEN` | Auto-generated | Bearer token for admin API |

### Multi-Paymaster Addresses

Addresses are auto-resolved from `@stablenet/contracts` by chain ID. Override with:

| Variable | Description |
|----------|-------------|
| `VERIFYING_PAYMASTER_ADDRESS` | Verifying paymaster override |
| `ERC20_PAYMASTER_ADDRESS` | ERC-20 paymaster override |
| `PERMIT2_PAYMASTER_ADDRESS` | Permit2 paymaster override |
| `SPONSOR_PAYMASTER_ADDRESS` | Sponsor paymaster override |
| `PRICE_ORACLE_ADDRESS` | Price oracle contract override |

### Policy Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYMASTER_DEFAULT_MAX_GAS_LIMIT` | `5000000` | Max gas limit per operation |
| `PAYMASTER_DEFAULT_MAX_GAS_COST` | `1 ETH` | Max gas cost per operation (wei) |
| `PAYMASTER_DEFAULT_DAILY_LIMIT_PER_SENDER` | `0.1 ETH` | Daily limit per sender (wei) |
| `PAYMASTER_DEFAULT_GLOBAL_DAILY_LIMIT` | `10 ETH` | Global daily spending limit (wei) |

### Deposit Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYMASTER_DEPOSIT_MONITOR_ENABLED` | `true` | Enable deposit monitoring |
| `PAYMASTER_DEPOSIT_MIN_THRESHOLD` | `0.01 ETH` | Low-deposit warning threshold (wei) |
| `PAYMASTER_DEPOSIT_REJECT_ON_LOW` | `false` | Reject signing on low deposit |
| `PAYMASTER_DEPOSIT_AUTO_ENABLED` | `false` | Auto-deposit when balance is low |
| `PAYMASTER_DEPOSIT_AUTO_AMOUNT` | `0.1 ETH` | Amount to auto-deposit (wei) |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYMASTER_RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `PAYMASTER_RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window duration (ms) |

Rate limiting is applied to JSON-RPC endpoints (`/` and `/rpc`) using a per-IP sliding window.
Returns HTTP 429 with a JSON-RPC error (`code: -32005`) and `Retry-After` header when exceeded.
Standard `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers are included on all responses.

> **Note**: The rate limiter is in-memory and per-instance. For multi-instance deployments behind a load balancer, use an external rate limiter (e.g., nginx, Cloudflare, or Redis-backed middleware).

## API

### JSON-RPC Methods

All methods are available at `POST /` and `POST /rpc`.

#### `pm_getPaymasterStubData`

Returns stub paymaster data for gas estimation (zero signature).

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pm_getPaymasterStubData",
  "params": [userOp, entryPoint, chainId, context?]
}
```

#### `pm_getPaymasterData`

Returns signed paymaster data for submission. Enforces policy checks and creates a spending reservation.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pm_getPaymasterData",
  "params": [userOp, entryPoint, chainId, context?]
}
```

#### Context Parameter

Route to different paymaster types via the `context` field:

```json
{
  "paymasterType": "verifying" | "sponsor" | "erc20" | "permit2",
  "policyId": "default",
  "tokenAddress": "0x...",
  "campaignId": "0x...",
  "maxTokenCost": "1000000"
}
```

#### Other Methods

| Method | Description |
|--------|-------------|
| `pm_supportedChainIds` | Returns supported chain IDs |
| `pm_supportedPaymasterTypes` | Returns configured paymaster types |
| `pm_supportedTokens` | Returns supported ERC-20 tokens with exchange rates |
| `pm_estimateTokenPayment` | Estimates token cost for a UserOperation |
| `pm_getSponsorPolicy` | Queries sponsor policy for a sender |
| `pm_sponsorUserOperation` | Alias for `pm_getPaymasterData` |

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with paymaster, signer, settlement, and deposit status |
| `GET /ready` | Kubernetes readiness probe |
| `GET /live` | Kubernetes liveness probe |
| `GET /metrics` | Prometheus metrics (request/error counters, uptime) |

### Admin API (Bearer Auth)

| Endpoint | Description |
|----------|-------------|
| `GET /admin/policies` | List all sponsor policies |
| `GET /admin/policies/:id` | Get a specific policy |
| `POST /admin/policies` | Create/update a policy (Zod-validated) |
| `DELETE /admin/policies/:id` | Delete a policy |

> **Note**: Admin API serializes `BigInt` policy fields (e.g., `maxGasLimit`, `maxGasCost`) as strings in JSON responses, since `JSON.stringify` does not support `BigInt` natively.

## Architecture

```
Client (Wallet/SDK)
       │
       ▼
  ┌──────────────────────────────────────┐
  │          Hono HTTP Server            │
  │  (JSON-RPC dispatcher + middleware)  │
  └──────────┬───────────────────────────┘
             │
     ┌───────┼───────┬──────────┐
     ▼       ▼       ▼          ▼
  Handlers  Policy  Signer   Settlement
  (stub/    Engine  (ECDSA/  Worker
   sign)    + Risk  ERC1271) (polling)
            Scorer
     │       │       │          │
     └───────┼───────┘          │
             ▼                  ▼
       Chain Client          Bundler
       (viem)                Client
             │                  │
             ▼                  ▼
       EntryPoint +          Bundler
       Paymaster             RPC
       Contracts
```

### Key Components

- **Handlers** — Pure functions implementing each JSON-RPC method
- **SponsorPolicyManager** — Manages policies, spending trackers, and reservations with TOCTOU-safe `checkAndReserve()`
- **RiskScorer** — Weighted risk assessment (calldata patterns, gas anomalies, sender reputation, factory usage)
- **PaymasterSigner** — Envelope-based signing using `@stablenet/core` hash computation
- **SettlementWorker** — Async polling loop that settles/cancels reservations based on bundler receipts
- **DepositMonitor** — Periodic EntryPoint balance checks with auto-deposit capability
- **ReservationTracker** — In-memory + optional disk persistence for userOpHash → reservation mapping

## Development

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Build
pnpm build
```

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: [Hono](https://hono.dev) (lightweight HTTP)
- **Ethereum**: [viem](https://viem.sh) (chain interaction)
- **Validation**: [Zod](https://zod.dev) (schema validation)
- **Logging**: [Pino](https://github.com/pinojs/pino)
- **Build**: [tsup](https://tsup.egoist.dev) (TypeScript bundler)
- **Test**: [Vitest](https://vitest.dev)
- **Lint**: [Biome](https://biomejs.dev)
