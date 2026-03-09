# @stablenet/types

Shared TypeScript type definitions for the StableNet platform - an ERC-4337 Account Abstraction infrastructure.

## Overview

This package provides the canonical type definitions used across all StableNet packages. It serves as the single source of truth for interfaces, constants, and utility functions related to:

- **ERC-4337** UserOperation types (v0.7 / v0.9)
- **ERC-7579** Modular Smart Account types
- **EIP-7702** Delegation and multi-mode transactions
- **EIP-1193** Provider and RPC error codes
- Network configuration and chain management
- Bundler and Paymaster client interfaces

## Installation

```bash
pnpm add @stablenet/types
```

> This is an internal workspace package (`workspace:*`). It is not published to npm.

## Usage

```typescript
import {
  // ERC-4337 UserOperation
  type UserOperation,
  type PackedUserOperation,
  type UserOperationReceipt,

  // Account types
  ACCOUNT_TYPE,
  type Account,
  getAvailableTransactionModes,

  // ERC-7579 Module system
  MODULE_TYPE,
  type ModuleMetadata,
  type InstalledModule,
  isValidator,

  // Transaction modes
  TRANSACTION_MODE,
  type MultiModeTransactionRequest,
  isSmartAccountMode,

  // Constants
  ENTRY_POINT_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,

  // EIP-7579 Execution Mode
  CALL_TYPE,
  EXEC_TYPE,
  encodeExecutionMode,
  decodeExecutionMode,

  // Validation data (bit packing)
  packValidationData,
  unpackValidationData,

  // RPC error codes
  RPC_ERROR_CODES,
  RpcError,

  // Viem re-exports
  type Address,
  type Hex,
  type Hash,
} from '@stablenet/types'
```

## Module Reference

### Account (`account.ts`)

Account types supporting three modes: EOA, Smart Account, and Delegated (EIP-7702).

| Export | Description |
|--------|-------------|
| `ACCOUNT_TYPE` | Account type constants (`EOA`, `SMART`, `DELEGATED`) |
| `KEYRING_TYPE` | Key management types (`HD`, `SIMPLE`, `HARDWARE`) |
| `Account` | Account interface with address, type, and smart account fields |
| `AccountState` | Wallet account state (accounts list + selected) |
| `getAvailableTransactionModes()` | Returns valid tx modes for an account type |
| `getDefaultTransactionMode()` | Returns the default tx mode |
| `supportsSmartAccount()` | Checks if account supports AA features |
| `canInstallModules()` | Checks if account can install ERC-7579 modules |

### UserOperation (`userOperation.ts`)

ERC-4337 v0.7 UserOperation types using native `bigint` values.

| Export | Description |
|--------|-------------|
| `UserOperation` | Full UserOp with all gas fields (bigint-based) |
| `PartialUserOperation` | Partial UserOp for building (requires `sender` + `callData`) |
| `PackedUserOperation` | Hex-encoded format for RPC transport |
| `UserOperationReceipt` | Receipt after inclusion |
| `UserOperationGasEstimation` | Gas estimation result |
| `ExecutionCall` | Batch call item (`to`, `value`, `data`) |

### Transaction (`transaction.ts`)

Multi-mode transaction system supporting EOA, EIP-7702, and Smart Account paths.

| Export | Description |
|--------|-------------|
| `TRANSACTION_MODE` | Mode constants (`EOA`, `EIP7702`, `SMART_ACCOUNT`) |
| `GAS_PAYMENT_TYPE` | Gas payment strategies (`SPONSOR`, `NATIVE`, `ERC20`) |
| `MultiModeTransactionRequest` | Unified transaction request interface |
| `GasEstimate` | Gas estimation with AA-specific fields |
| `TransactionResult` | Transaction result with hash and mode |
| `isEOAMode()` / `isEIP7702Mode()` / `isSmartAccountMode()` | Type guard functions |

### Module (`module.ts`)

ERC-7579 modular smart account module system with 6 module types.

| Export | Description |
|--------|-------------|
| `MODULE_TYPE` | Module type constants (1n-6n: Validator through Signer) |
| `MODULE_STATUS` | Installation lifecycle states |
| `ModuleMetadata` | Registry metadata (name, version, audit info) |
| `InstalledModule` | Installed module with config and status |
| `ModuleInstallRequest` / `ModuleUninstallRequest` | Install/uninstall payloads |
| `ECDSAValidatorConfig`, `WebAuthnValidatorConfig`, etc. | Module-specific configs |
| `isValidator()`, `isExecutor()`, `isHook()`, etc. | Type guard functions |

### Constants (`constants.ts`)

Contract addresses (re-exported from `@stablenet/contracts`) and EIP-7579 execution mode encoding.

| Export | Description |
|--------|-------------|
| `ENTRY_POINT_ADDRESS` | Current EntryPoint (v0.9) |
| `ENTRY_POINT_V07_ADDRESS` | Legacy v0.7 EntryPoint |
| `KERNEL_V3_1_FACTORY_ADDRESS` | Kernel smart account factory |
| `ECDSA_VALIDATOR_ADDRESS` | Default ECDSA validator module |
| `CALL_TYPE` / `EXEC_TYPE` | EIP-7579 call and execution type bytes |
| `encodeExecutionMode()` / `decodeExecutionMode()` | bytes32 encoding/decoding |

### Validation (`validation.ts`)

EIP-4337 ValidationData bit-packing utilities for the `uint256` validation result.

| Export | Description |
|--------|-------------|
| `ValidationData` | Parsed validation data (authorizer, validUntil, validAfter) |
| `packValidationData()` | Pack into uint256 bigint |
| `unpackValidationData()` | Unpack from uint256 bigint |
| `isBlockNumberMode()` | Check v0.9 block number mode (bit 47 flag) |
| `isValidationFailed()` | Check if signature validation failed |

### Network (`network.ts`)

Chain configuration types and common chain IDs.

| Export | Description |
|--------|-------------|
| `Network` | Network config (RPC, bundler, paymaster URLs) |
| `NetworkState` | Wallet network state |
| `CHAIN_IDS` | Common chain ID constants |
| `ChainAddresses` | Complete contract address set per chain |
| `ChainConfig` | Full chain configuration (addresses + services + tokens) |

### Bundler (`bundler.ts`)

ERC-4337 bundler RPC client interface.

| Export | Description |
|--------|-------------|
| `BundlerClient` | Client interface with all bundler RPC methods |
| `BundlerClientConfig` | Configuration (URL, EntryPoint, chain ID) |
| `BUNDLER_ERROR_CODES` | Standard + ERC-4337 error codes |

### Paymaster (`paymaster.ts`)

Paymaster service types for gas sponsorship and ERC-20 gas payment.

| Export | Description |
|--------|-------------|
| `ExtendedPaymasterData` | Paymaster response data with gas limits |
| `SupportedToken` | Token for ERC-20 gas payment |
| `SponsorPolicy` | Sponsorship availability and limits |
| `PAYMASTER_RPC_METHODS` | Paymaster RPC method names |

### RPC (`rpc.ts`)

Comprehensive RPC error codes combining JSON-RPC, EIP-1193, and ERC-4337.

| Export | Description |
|--------|-------------|
| `RPC_ERROR_CODES` | Combined error code constants |
| `RpcError` | Error class with code, message, and data |
| `RPC_ERRORS` | Pre-defined error objects with default messages |
| `PROVIDER_EVENTS` | EIP-1193 provider event names |

### Token (`token.ts`)

ERC-20 token types and native token utilities.

| Export | Description |
|--------|-------------|
| `TokenDefinition` | Token metadata (address, symbol, decimals) |
| `TokenBalance` | Token balance with formatted string |
| `NATIVE_TOKEN_ADDRESS` | Zero address for native token |
| `isNativeToken()` | Check if address is native token |

## Dependencies

| Package | Purpose |
|---------|---------|
| `viem` | Ethereum types (`Address`, `Hex`, `Hash`, `Chain`, `Transport`) |
| `@stablenet/contracts` | Canonical contract addresses (re-exported) |

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Watch mode
pnpm dev
```

## Build

Built with [tsup](https://tsup.egoist.dev/) producing ESM output with TypeScript declarations and source maps.

## Architecture Notes

- All numeric values use native `bigint` (not hex strings) for type safety
- Constants use `as const` assertions with derived union types
- Contract addresses are re-exported from `@stablenet/contracts` (single source of truth)
- Type guards are provided as pure functions for runtime checking
- `viem` types are re-exported for downstream convenience
