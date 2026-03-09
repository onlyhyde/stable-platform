# @stablenet/config

Shared configuration package for the StableNet platform. Provides centralized network definitions, environment-based configuration overrides, and delegates contract addresses to `@stablenet/contracts`.

## Overview

This package sits at the foundation layer of the monorepo, consumed by `@stablenet/sdk-ts`, `@stablenet/wallet-sdk`, and other packages.

### Architecture

```
@stablenet/contracts  ← Single source of truth for contract addresses
       ↑
@stablenet/config     ← Network definitions + env overrides + re-exports
       ↑
@stablenet/sdk-ts, @stablenet/wallet-sdk, etc.
```

### Key Features

- **Multi-chain support**: LOCAL/Testnet (8283), Anvil (31337), Sepolia (11155111), Mainnet (1)
- **Contract delegation**: All contract addresses come from `@stablenet/contracts`
- **ERC-4337 EntryPoint**: v0.9 (current), v0.7/v0.6 (deprecated, backward compat)
- **Environment overrides**: All service URLs configurable per deployment
- **Type-safe**: Built on `viem` Address types

## Usage

### Chain IDs

```typescript
import { CHAIN_IDS } from '@stablenet/config'

CHAIN_IDS.LOCAL    // 8283 (StableNet Local / Testnet)
CHAIN_IDS.ANVIL    // 31337
CHAIN_IDS.SEPOLIA  // 11155111
CHAIN_IDS.MAINNET  // 1
```

### EntryPoint Addresses

```typescript
import {
  ENTRY_POINT_ADDRESS,    // Current recommended (v0.9)
  isEntryPoint,
  getEntryPointVersion,
} from '@stablenet/config'

isEntryPoint(someAddress)          // true if known EntryPoint
getEntryPointVersion(someAddress)  // 'V09' | 'V07' | 'V06' | null
```

### Networks

```typescript
import {
  DEFAULT_NETWORKS,
  getNetworkByChainId,
  isSupportedChainId,
  isTestnet,
  DEFAULT_CHAIN_ID,       // 8283 (configurable via env)
} from '@stablenet/config'

const local = getNetworkByChainId(8283)
// { chainId: 8283, name: 'StableNet Local', currency: WKRC, isTestnet: true, ... }
```

### Chain Configurations (from @stablenet/contracts)

```typescript
import {
  getChainConfig,
  getChainAddresses,
  getServiceUrls,
  getChainTokens,
} from '@stablenet/config'

const config = getChainConfig(8283)
// { addresses: { core, validators, paymasters, privacy, ... }, services, tokens }

const addresses = getChainAddresses(8283)
// { core: { entryPoint, kernel, kernelFactory, ... }, validators: { ... }, ... }
```

### Environment Overrides

```typescript
import { applyEnvOverrides, getNetworkConfigByChainId } from '@stablenet/config/env'

// Reads STABLENET_LOCAL_RPC_URL, STABLENET_LOCAL_BUNDLER_URL, etc.
const config = getNetworkConfigByChainId(8283)
```

## Environment Variables

All service URLs follow the pattern `STABLENET_[CHAIN]_[SERVICE]_URL`.

| Chain | RPC URL | Bundler URL | Paymaster URL |
|-------|---------|-------------|---------------|
| LOCAL (8283) | `STABLENET_LOCAL_RPC_URL` | `STABLENET_LOCAL_BUNDLER_URL` | `STABLENET_LOCAL_PAYMASTER_URL` |
| Anvil (31337) | `STABLENET_ANVIL_RPC_URL` | `STABLENET_ANVIL_BUNDLER_URL` | `STABLENET_ANVIL_PAYMASTER_URL` |
| Sepolia (11155111) | `STABLENET_SEPOLIA_RPC_URL` | `STABLENET_SEPOLIA_BUNDLER_URL` | `STABLENET_SEPOLIA_PAYMASTER_URL` |
| Mainnet (1) | `STABLENET_MAINNET_RPC_URL` | `STABLENET_MAINNET_BUNDLER_URL` | `STABLENET_MAINNET_PAYMASTER_URL` |

Additional: `*_STEALTH_SERVER_URL`, `*_EXPLORER_URL`, `*_INDEXER_URL` (LOCAL only).

`STABLENET_DEFAULT_CHAIN_ID` — Default chain ID for new wallets (default: `8283`).

## Supported Networks

| Network | Chain ID | Currency | Testnet |
|---------|----------|----------|---------|
| StableNet Local/Testnet | 8283 | WKRC | Yes |
| Anvil | 31337 | ETH | Yes |
| Sepolia | 11155111 | ETH | Yes |
| Ethereum Mainnet | 1 | ETH | No |

> LOCAL (8283) reproduces the testnet environment locally for development and testing.

## Development

```bash
pnpm build       # Build with tsup (ESM + DTS)
pnpm dev         # Watch mode
pnpm test        # Run tests (87 tests)
pnpm typecheck   # TypeScript type checking
pnpm lint        # Biome linter
pnpm clean       # Remove dist/
```

## Dependencies

- `@stablenet/contracts` — Contract addresses (single source of truth)
- `@stablenet/types` — Shared type definitions (`Network`, `NativeCurrency`)
- `viem` — Ethereum library (`Address` type)
