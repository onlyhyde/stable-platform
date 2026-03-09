# @stablenet/sdk-ts

TypeScript SDK for **StableNet** — a modular Account Abstraction platform built on ERC-4337, EIP-7702, and ERC-7579.

## Overview

`sdk-ts` is a monorepo of 14 TypeScript packages providing a comprehensive smart account SDK. It supports multiple transaction modes (EOA, Smart Account, EIP-7702), an extensible ERC-7579 module system, and privacy-preserving stealth addresses.

### Key Features

- **ERC-4337 v0.7/v0.9** — Full UserOperation lifecycle (build, sign, send, wait)
- **EIP-7702** — EOA code delegation with authorization signing and risk analysis
- **ERC-7579 Modules** — Pluggable validators, executors, hooks, and fallbacks
- **Multi-Mode Transactions** — Unified routing across EOA, Smart Account, and EIP-7702
- **Stealth Addresses** — EIP-5564/EIP-6538 private payments with view tag filtering
- **Subscription Payments** — Recurring payments with EIP-7715 permission management
- **Security Layer** — Phishing detection, transaction risk analysis, input validation
- **Paymaster Support** — Verifying, Sponsor, and Permit2 gas sponsorship strategies

## Package Structure

```
packages/sdk-ts/
├── types/           @stablenet/sdk-types          Shared type definitions
├── crypto/          @stablenet/sdk-crypto          Cryptographic abstraction layer
├── addresses/       @stablenet/sdk-addresses       Contract address registry
├── core/            @stablenet/core                Smart account client, gas, modules, RPC, security
├── accounts/        @stablenet/accounts            Kernel Smart Account implementation
└── plugins/
    ├── ecdsa/       @stablenet/plugin-ecdsa        ECDSA signature validation
    ├── webauthn/    @stablenet/plugin-webauthn     Passkey/WebAuthn validation
    ├── multisig/    @stablenet/plugin-multisig     M-of-N multi-signature validation
    ├── session-keys/@stablenet/plugin-session-keys Delegated execution with spending limits
    ├── stealth/     @stablenet/plugin-stealth      EIP-5564/6538 stealth addresses
    ├── subscription/@stablenet/plugin-subscription Recurring payments (EIP-7715)
    ├── paymaster/   @stablenet/plugin-paymaster    Gas sponsorship strategies
    ├── defi/        @stablenet/plugin-defi         DeFi executors and hooks
    └── modules/     @stablenet/plugin-modules      ERC-7579 module management utilities
```

## Dependency Graph

```
@stablenet/sdk-types          (leaf — no internal deps)
    │
@stablenet/sdk-crypto         (standalone — @noble/hashes, viem)
    │
@stablenet/core               ← @stablenet/sdk-types, viem
    │
@stablenet/accounts           ← @stablenet/core, @stablenet/sdk-types
    │
plugins/*                     ← @stablenet/core, @stablenet/sdk-types
```

## Quick Start

### Create a Smart Account Client

```typescript
import { createSmartAccountClient } from '@stablenet/core'
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// 1. Create a public client
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

// 2. Create an ECDSA validator
const validator = createEcdsaValidator({
  signer: account, // viem LocalAccount
})

// 3. Create a Kernel smart account
const smartAccount = await toKernelSmartAccount({
  client: publicClient,
  validator,
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
})

// 4. Create the SDK client
const client = createSmartAccountClient({
  account: smartAccount,
  chain: sepolia,
  bundlerTransport: http('https://bundler.example.com'),
})

// 5. Send a transaction
const hash = await client.sendTransaction({
  to: '0x...',
  value: 1000000000000000000n,
  data: '0x',
})
```

### Multi-Mode Transaction Routing

```typescript
import { createTransactionRouter } from '@stablenet/core'

const router = createTransactionRouter({
  strategies: {
    eoa: createEOATransactionBuilder(),
    smartAccount: createSmartAccountStrategy(),
    eip7702: createEIP7702Strategy(),
  },
})

// Router selects the optimal strategy based on account type
const result = await router.execute(transactionRequest)
```

### Install an ERC-7579 Module

```typescript
import { createModuleClient } from '@stablenet/core'
import { encodeSessionKeyInit } from '@stablenet/core'

const moduleClient = createModuleClient({ account: smartAccount })

// Install a session key executor
const installCall = moduleClient.prepareInstall({
  moduleType: 2, // Executor
  moduleAddress: sessionKeyAddress,
  initData: encodeSessionKeyInit({
    sessionKey: delegateAddress,
    validAfter: Math.floor(Date.now() / 1000),
    validUntil: Math.floor(Date.now() / 1000) + 86400, // 24h
    spendingLimit: 1000000000000000000n, // 1 ETH
  }),
})

await client.sendTransaction(installCall)
```

### Stealth Address Payment

```typescript
import { generateStealthAddress, computeStealthKey } from '@stablenet/plugin-stealth'

// Sender generates a stealth address for the receiver
const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({
  spendingPublicKey: receiverSpendingPubKey,
  viewingPublicKey: receiverViewingPubKey,
})

// Receiver scans announcements and derives the private key
const stealthPrivateKey = computeStealthKey({
  ephemeralPublicKey,
  viewingPrivateKey: receiverViewingPrivKey,
  spendingPrivateKey: receiverSpendingPrivKey,
})
```

## Architecture

### Design Patterns

| Pattern | Usage |
|---------|-------|
| **Strategy** | Gas estimation, transaction routing, module execution |
| **Dependency Injection** | `RpcProvider` abstraction, crypto provider injection |
| **Factory** | `createSmartAccountClient()`, `createBundlerClient()`, etc. |
| **Adapter** | Viem provider wrapper, crypto provider abstraction |
| **Registry** | Module registry, gas strategy registry |
| **Circuit Breaker** | RPC failure isolation with state transitions |
| **Composition** | `ModuleClient` = `QueryClient` + `OperationClient` |
| **Envelope** | Paymaster data encoding (header + payload + signature) |

### ERC/EIP Standards

| Standard | Coverage |
|----------|----------|
| **ERC-4337** | Full — UserOperation v0.7/v0.9, EntryPoint, Bundler RPC |
| **ERC-7579** | Full — Module types 1–6, install/uninstall, 6 built-in modules |
| **EIP-7702** | Partial — Authorization creation, signing, risk analysis |
| **EIP-712** | Full — TypedData hashing, domain separator, validation |
| **EIP-5564** | Full — Stealth address generation, view tag filtering |
| **EIP-6538** | Full — Stealth registry, meta-address registration |
| **EIP-7715** | Partial — Permission management for subscriptions |

### Built-in Modules

| Module | Type | Description |
|--------|------|-------------|
| ECDSA Validator | Validator (1) | Single-sig ECDSA signing |
| WebAuthn Validator | Validator (1) | Passkey/biometric authentication |
| MultiSig Validator | Validator (1) | M-of-N multi-signature |
| Session Key Executor | Executor (2) | Delegated execution with time/value limits |
| Recurring Payment Executor | Executor (2) | Automated recurring transactions |
| Spending Limit Hook | Hook (4) | Per-token spending caps |

### Error Handling

The SDK provides a structured error hierarchy:

```
SdkError (base)
├── BundlerError      — Bundler RPC errors (retryability detection)
├── PaymasterError    — Paymaster-specific errors
├── TransactionError  — Transaction execution failures
├── UserOperationError — UserOp lifecycle failures
├── ValidationError   — Input/schema validation errors
└── GasEstimationError — Gas estimation failures
```

All errors include typed error codes, timestamps, context tracking, and serialization support.

### Security

The SDK includes a built-in security layer:

- **Input Validation** — Address format, chain ID, RPC request validation
- **Transaction Risk Analysis** — Suspicious pattern detection with severity levels
- **Signature Risk Analysis** — Method detection (eth_sign, personal_sign, etc.)
- **Phishing Detection** — Domain spoofing, homograph attacks, confusable characters
- **EIP-712 Validation** — Typed data domain and type safety checks
- **Rate Limiting** — Request-level rate limiting with configurable windows
- **EIP-7702 Risk Analysis** — Authorization delegation risk scoring

## Development

### Prerequisites

- Node.js >= 18
- pnpm (workspace manager)

### Scripts

Each package supports the following scripts:

```bash
pnpm build         # Build with tsup
pnpm dev           # Watch mode
pnpm lint          # Lint with Biome
pnpm lint:fix      # Auto-fix lint issues
pnpm typecheck     # TypeScript type checking
pnpm test          # Run tests with Vitest
pnpm test:watch    # Watch mode tests
pnpm clean         # Remove dist/
```

### Tech Stack

- **Runtime**: TypeScript (ES Modules)
- **Ethereum**: [viem](https://viem.sh/) ^2.46.3
- **Crypto**: [@noble/hashes](https://github.com/paulmillr/noble-hashes), [@noble/curves](https://github.com/paulmillr/noble-curves)
- **Build**: [tsup](https://tsup.egoist.dev/)
- **Lint**: [Biome](https://biomejs.dev/) ^2.4.6
- **Test**: [Vitest](https://vitest.dev/) ^4.0.18

## License

Private — All rights reserved.
