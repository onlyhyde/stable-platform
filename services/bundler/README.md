# @stablenet/bundler

ERC-4337 v0.7 UserOperation Bundler service for the StableNet platform.

## Overview

A production-grade bundler that accepts, validates, pools, and submits UserOperations to the EntryPoint contract. Implements the full ERC-4337 JSON-RPC API with ERC-7562 opcode validation, MEV protection, and configurable bundle strategies.

## Architecture

```
UserOperation → JSON-RPC API → Validation Pipeline → Mempool → Bundle Executor → EntryPoint
                                     │
                    ┌────────────────┴────────────────────┐
                    │  Phase 1: Format Validation (fast)   │
                    │  Phase 2: Reputation Check            │
                    │  Phase 3: State Validation (RPC)      │
                    │  Phase 4: Simulation (EntryPoint)     │
                    │  Phase 5: Simulation Result Checks    │
                    │  Phase 6: Opcode Validation (ERC-7562)│
                    └─────────────────────────────────────┘
```

### Key Components

| Component | Description |
|-----------|-------------|
| **RPC Server** | Fastify-based JSON-RPC server with rate limiting, CORS, health/metrics endpoints |
| **Validation Pipeline** | 6-phase orchestrator with DI for testability (`UserOperationValidator`) |
| **Mempool** | In-memory pool with configurable priority strategies, eviction policies, nonce tracking |
| **Bundle Executor** | Batches ops, handles sender deduplication, storage conflict detection, paymaster deposit validation |
| **Gas Estimator** | Binary search estimation with configurable gas limits |
| **Dependency Tracker** | Cross-operation storage conflict detection using Kahn's topological sort |
| **Reputation Manager** | Entity reputation tracking with ban/throttle mechanics |
| **Opcode Validator** | ERC-7562 banned opcode and storage rule enforcement via `debug_traceCall` |

### Submission Strategies

- **Direct** — Standard mempool submission (default)
- **Flashbots** — MEV-protected submission via Flashbots relay

## Supported RPC Methods

### ERC-4337 Standard

| Method | Description |
|--------|-------------|
| `eth_sendUserOperation` | Submit a UserOperation |
| `eth_estimateUserOperationGas` | Estimate gas for a UserOperation |
| `eth_getUserOperationByHash` | Get UserOperation by hash |
| `eth_getUserOperationReceipt` | Get execution receipt |
| `eth_supportedEntryPoints` | List supported EntryPoint addresses |
| `eth_chainId` | Get chain ID |

### Debug Methods

| Method | Description |
|--------|-------------|
| `debug_bundler_clearState` | Clear mempool |
| `debug_bundler_dumpMempool` | Dump mempool contents |
| `debug_bundler_setReputation` | Set entity reputation |
| `debug_bundler_dumpReputation` | Dump reputation table |
| `debug_bundler_clearReputation` | Clear reputation data |
| `debug_bundler_getUserOperationStatus` | Get operation status |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Access to an Ethereum RPC endpoint

### Installation

```bash
pnpm install
```

### Configuration

Configuration follows priority: **CLI args > Environment variables > Network presets > Defaults**

#### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `BUNDLER_PRIVATE_KEY` | Private key for signing bundle transactions |
| `BUNDLER_BENEFICIARY` | Address to receive bundle fees |
| `BUNDLER_RPC_URL` | RPC URL for the target chain |

#### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUNDLER_PORT` | `4337` | RPC server port |
| `BUNDLER_NETWORK` | `devnet` | Network preset (`local`, `devnet`, `sepolia`, `mainnet`) |
| `BUNDLER_CHAIN_ID` | auto | Override chain ID |
| `BUNDLER_ENTRY_POINT` | auto | EntryPoint address(es), comma-separated |
| `BUNDLER_LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `BUNDLER_DEBUG` | `false` | Enable debug mode (bypasses validation, not for production) |
| `BUNDLER_ENABLE_OPCODE_VALIDATION` | `true` | Enable ERC-7562 opcode validation |
| `BUNDLER_MAX_NONCE_GAP` | `10` | Max nonce gap from on-chain nonce |
| `BUNDLER_CORS_ORIGINS` | localhost only | CORS allowed origins, comma-separated |
| `BUNDLER_SUBMISSION_STRATEGY` | `direct` | Bundle submission: `direct` or `flashbots` |
| `BUNDLER_FLASHBOTS_RELAY_URL` | — | Flashbots relay URL |
| `BUNDLER_FLASHBOTS_AUTH_KEY` | — | Flashbots auth key (hex) |
| `BUNDLER_ENABLE_PROFITABILITY_CHECK` | `false` | Enable bundle profitability gating |
| `BUNDLER_MIN_BUNDLE_PROFIT` | `0` | Minimum bundle profit in wei |

### Running

```bash
# Development (hot-reload)
pnpm dev

# Production
pnpm build && pnpm start

# With CLI options
pnpm start -- run --network sepolia --port 4337 --log-level debug
```

### Health & Monitoring

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with mempool stats |
| `GET /ready` | Kubernetes readiness probe |
| `GET /live` | Kubernetes liveness probe |
| `GET /metrics` | Prometheus metrics |

## Development

### Scripts

```bash
pnpm test              # Run all tests
pnpm test:ci           # Run tests excluding E2E
pnpm test:watch        # Watch mode
pnpm test:anvil        # Anvil fork E2E tests (requires Foundry)
pnpm bench             # Performance benchmarks
pnpm bench:ci          # Benchmarks with JSON output
pnpm profile:memory    # Memory leak detection
pnpm typecheck         # TypeScript type checking
pnpm lint              # Biome linter
pnpm lint:fix          # Auto-fix lint issues
pnpm build             # Build with tsup
pnpm clean             # Remove dist/
```

### Testing

- **Unit tests**: Per-module tests with Vitest mocking
- **E2E tests**: Full RPC server integration tests
- **Anvil fork tests**: Real EntryPoint contract interaction (requires Foundry, skipped by default)
- **Benchmarks**: Mempool, validation, and gas estimation performance via tinybench

### Project Structure

```
src/
├── abi/               # EntryPoint ABI definitions
├── cli/               # CLI entry point and configuration
├── config/            # Constants and environment-aware defaults
├── executor/          # Bundle execution and submission strategies
├── gas/               # Gas estimation (binary search)
├── mempool/           # In-memory pool and dependency tracking
├── metrics/           # Prometheus metrics collection
├── rpc/               # Fastify JSON-RPC server
├── shared/            # UserOp packing utilities
├── types/             # Shared TypeScript types
├── utils/             # Logger (pino)
└── validation/        # 6-phase validation pipeline
tests/
├── bench/             # Performance benchmarks
├── cli/               # Config parsing tests
├── e2e/               # Integration and Anvil fork tests
├── executor/          # Bundle executor tests
├── gas/               # Gas estimator tests
├── mempool/           # Mempool and dependency tracker tests
├── metrics/           # Metrics collector tests
├── rpc/               # RPC endpoint tests
└── validation/        # Validator, tracer, opcode tests
```

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Language**: TypeScript 5.7+
- **HTTP**: Fastify 5
- **Ethereum**: viem
- **Validation**: Zod
- **Logging**: Pino
- **Build**: tsup
- **Test**: Vitest + tinybench
- **Lint**: Biome

## Security

- 6-phase validation pipeline with configurable strictness
- ERC-7562 opcode validation prevents malicious contract behavior
- Entity reputation system with ban/throttle mechanics
- Rate limiting on all RPC endpoints
- CORS origin whitelist (locked down in production)
- Debug mode blocked in production by default
- Internal error details masked in production responses
- Paymaster deposit validation prevents underfunded operations

## License

Private — StableNet
