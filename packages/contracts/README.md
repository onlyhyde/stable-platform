# @stablenet/contracts

Type-safe contract address registry for the StableNet platform. Provides a single source of truth for all deployed contract addresses, service URLs, and chain configuration across the monorepo.

## Overview

This package bridges Foundry deployment outputs and TypeScript consumers by:

1. **Auto-generating** typed address constants from `addresses.json` deployment files
2. **Exposing** chain-aware getter functions with full TypeScript type safety
3. **Supporting** hot-reload during development via file watching
4. **Generating** `.env.contracts` files for Docker Compose and Go services

### Supported Domains

| Domain | Examples |
|--------|----------|
| **Core (ERC-4337)** | EntryPoint, Kernel, KernelFactory, FactoryStaker |
| **Validators** | ECDSA, WebAuthn, MultiChain, MultiSig, WeightedECDSA |
| **Paymasters** | Verifying, ERC-20, Permit2, Sponsor |
| **Privacy** | Stealth Announcer (ERC-5564), Stealth Registry (ERC-6538) |
| **Compliance** | KYC Registry, Regulatory Registry, Audit Hook/Logger |
| **Subscriptions** | Subscription Manager, Recurring Payments, Permissions (ERC-7715) |
| **DeFi** | Lending Pool, Staking Vault, Price Oracle, Proof of Reserve |
| **DEX** | Uniswap V3 (Factory, Router, Quoter, NFT Position Manager) |
| **Tokens** | WKRC, USDC |
| **System (Chain 8283)** | Governance contracts, BLS precompile, Native Coin Manager |

## Installation

```bash
pnpm add @stablenet/contracts
```

**Peer dependency:** `viem ^2.0.0`

## Usage

### Import Contract Addresses

```typescript
import {
  getEntryPoint,
  getChainAddresses,
  getChainConfig,
  isChainSupported,
  ENTRY_POINT_ADDRESS,
} from '@stablenet/contracts'

// Chain-aware getter (returns chain-specific deployed address)
const entryPoint = getEntryPoint(8283)

// Full chain configuration (addresses + services + tokens)
const config = getChainConfig(8283)

// Check chain support
if (isChainSupported(8283)) {
  const addresses = getChainAddresses(8283)
  console.log(addresses.core.entryPoint)
  console.log(addresses.paymasters.verifyingPaymaster)
}
```

### Dynamic Address Access

```typescript
import { getContractAddress } from '@stablenet/contracts'

// Access by raw key name (matches addresses.json keys)
const address = getContractAddress(8283, 'ecdsaValidator')
```

### Precompile Addresses (Chain 8283)

```typescript
import {
  getPrecompiles,
  getNativeCoinAdapter,
  getGovValidator,
  PRECOMPILED_ADDRESSES,
} from '@stablenet/contracts'

// System contracts embedded in chain genesis
const precompiles = getPrecompiles(8283)
const adapter = getNativeCoinAdapter(8283)
```

### Service URLs

```typescript
import { getServiceUrls } from '@stablenet/contracts'

const services = getServiceUrls(8283)
// { bundler: 'http://localhost:4337', paymaster: '...', stealthServer: '...' }
```

### Hot-Reload Watcher (Development)

```typescript
import { ContractAddressWatcher } from '@stablenet/contracts/watcher'

const watcher = new ContractAddressWatcher({
  watchPath: './deployments/8283/addresses.json',
  onUpdate: (event) => {
    console.log(`Chain ${event.chainId} addresses updated`)
  },
})

await watcher.start()
// ... later
await watcher.stop()
```

## Package Exports

| Export Path | Description |
|-------------|-------------|
| `@stablenet/contracts` | All address constants, getters, types |
| `@stablenet/contracts/addresses` | Address utilities only (tree-shakeable) |
| `@stablenet/contracts/watcher` | File watcher (Node.js only, uses chokidar) |

## Code Generation

Regenerate typed addresses from Foundry deployment outputs:

```bash
# Default: reads from DEPLOYMENT_DIR in .env
pnpm generate

# Specify chain
pnpm generate -- --chain 8283

# Custom deployment directory
pnpm generate -- --input /path/to/deployments

# All chains
pnpm generate -- --all
```

### What Gets Generated

| Output | Path | Purpose |
|--------|------|---------|
| TypeScript addresses | `src/generated/addresses.ts` | Typed constants for TS consumers |
| Environment file | `../../.env.contracts` | Contract addresses for Docker/Go services |
| Merged `.env` | `../../.env` | Auto-merged addresses for `docker compose` |

### Generation Pipeline

```
Foundry deploy → addresses.json → generate-addresses.ts → {
  src/generated/addresses.ts  (TypeScript)
  .env.contracts              (Shell/Docker)
  .env                        (Auto-merged)
}
```

## Project Structure

```
packages/contracts/
  src/
    index.ts                  # Barrel exports (public API)
    types.ts                  # TypeScript interfaces (ChainAddresses, etc.)
    addresses.ts              # Address constants, validators, chain-aware getters
    precompiles.ts            # Chain 8283 system contract addresses
    watcher.ts                # Hot-reload file watcher (chokidar)
    generated/
      addresses.ts            # Auto-generated (DO NOT EDIT)
  scripts/
    generate-addresses.ts     # Code generation from Foundry outputs
  dist/                       # Built output (ESM + declarations)
  package.json
  tsconfig.json
  tsup.config.ts              # Build configuration (tsup)
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Regenerate addresses
pnpm generate

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## Architecture Notes

- **Immutable constants**: All address objects use `as const` assertions
- **Chain-aware API**: Every getter takes `chainId` and resolves from the per-chain registry
- **Canonical fallbacks**: Well-known ERC-4337 addresses (EntryPoint, Kernel Factory) are exported as SDK defaults for chains without local deployment data
- **Zero-address safety**: `isZeroAddress()` and `assertNotZeroAddress()` utilities for validation
- **Tree-shakeable**: Separate export paths prevent bundling unnecessary code (e.g., chokidar in browsers)
- **EIP-7702 ready**: Delegate presets for account delegation scenarios
