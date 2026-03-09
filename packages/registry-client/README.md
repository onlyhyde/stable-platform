# @stablenet/registry-client

TypeScript SDK for the StableNet Contract Registry. Provides REST API access and real-time WebSocket subscriptions for smart contract address management across multiple chains.

## Features

- **REST API Client** - CRUD operations for contract entries and address sets
- **WebSocket Subscriptions** - Real-time notifications on contract updates and deletions
- **Auto-Reconnection** - Exponential backoff with jitter, configurable attempt limits
- **Heartbeat** - Automatic ping/pong keep-alive for stale connection detection
- **Runtime Validation** - All API responses validated with Zod schemas
- **Input Sanitization** - Chain ID and name validation, URL path injection prevention
- **Structured Errors** - `RegistryClientError` with status codes, error codes, and helpers
- **React Integration** - Context provider and hooks with unmount-safe data fetching
- **Pagination** - Cursor-based pagination for contract listing
- **Tree-Shakeable** - Separate entry points for core and React modules
- **Type-Safe** - Full TypeScript support with strict readonly types

## Installation

```bash
pnpm add @stablenet/registry-client
```

For React integration, ensure `react >= 18.0.0` is installed as a peer dependency.

## Quick Start

### Core Client

```typescript
import { RegistryClient } from '@stablenet/registry-client'

const client = new RegistryClient({
  url: 'https://registry.stablenet.io',
  apiKey: 'your-api-key',          // optional
  autoConnect: true,                // default: true (WebSocket)
  reconnectInterval: 1000,          // default: 1000ms (base for exponential backoff)
  maxReconnectAttempts: 10,         // default: 10
  connectionTimeout: 10000,         // default: 10000ms
  heartbeatInterval: 30000,         // default: 30000ms
})

// Fetch a contract by chain ID and name
const entry = await client.getContract(1, 'USDC')
console.log(entry.address) // 0x...

// List contracts with filters and pagination
const { items, total, cursor } = await client.listContracts(
  { chainId: 1, tag: 'stablecoin' },
  { limit: 20, cursor: 'prev-cursor' }
)

// Resolve an address set (grouped contracts)
const set = await client.getAddressSet(1, 'core-protocol')
console.log(set.contracts) // [{ name: 'Router', address: '0x...' }, ...]

// Register a new contract
await client.createContract({
  chainId: 1,
  name: 'MyToken',
  address: '0x1234...',
  version: '1.0.0',
  tags: ['erc20'],
  metadata: { deployer: '0xdead...' },
})

// Bulk import with partial failure tracking
const result = await client.bulkImport([
  { chainId: 1, name: 'TokenA', address: '0xaaa...' },
  { chainId: 1, name: 'TokenB', address: '0xbbb...' },
])
console.log(result.created, result.errors) // 2, undefined
```

### Error Handling

```typescript
import { RegistryClientError } from '@stablenet/registry-client'

try {
  await client.getContract(1, 'NonExistent')
} catch (err) {
  if (err instanceof RegistryClientError) {
    if (err.isNotFound) console.log('Contract not found')
    if (err.isUnauthorized) console.log('Invalid API key')
    if (err.isServerError) console.log('Server error, retry later')
    console.log(err.statusCode, err.errorCode, err.details)
  }
}
```

### Real-Time Subscriptions

```typescript
// Subscribe to specific contract changes
client.subscribe(['contracts:1:USDC', 'sets:1:core-protocol'])

client.on('contract:updated', (entry) => {
  console.log(`Contract updated: ${entry.name} -> ${entry.address}`)
})

client.on('contract:deleted', ({ chainId, name }) => {
  console.log(`Contract deleted: ${name} on chain ${chainId}`)
})

client.on('set:updated', (set) => {
  console.log(`Address set updated: ${set.name}`)
})

// Connection lifecycle
client.on('connected', () => console.log('WebSocket connected'))
client.on('disconnected', () => console.log('WebSocket disconnected'))
client.on('error', (err) => console.error('Error:', err))

// Cleanup
client.unsubscribe(['contracts:1:USDC'])
client.disconnect()
```

### React Integration

```tsx
import { RegistryProvider, useContract, useAddressSet, useRegistryStatus } from '@stablenet/registry-client/react'

function App() {
  return (
    <RegistryProvider options={{ url: 'https://registry.stablenet.io' }}>
      <ContractDisplay />
    </RegistryProvider>
  )
}

function ContractDisplay() {
  const { isConnected } = useRegistryStatus()
  const { address, entry, isLoading, error, refetch } = useContract(1, 'USDC')
  const { addresses, entries } = useAddressSet(1, 'core-protocol')

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>USDC Address: {address}</p>
      <p>Protocol contracts: {entries.length}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  )
}
```

> **Note:** `RegistryProvider` creates the client once on mount. If you need to change `url` or `apiKey`, remount the provider with a different `key` prop.

## API Reference

### `RegistryClient`

| Method | Description |
|--------|-------------|
| `getContract(chainId, name)` | Fetch a single contract entry |
| `listContracts(filter?, pagination?)` | List contracts with filters and cursor pagination |
| `getAddressSet(chainId, name)` | Fetch a resolved address set |
| `createContract(data)` | Register a new contract entry |
| `bulkImport(contracts)` | Import multiple contracts (returns partial failure details) |
| `connect()` | Manually establish WebSocket connection |
| `disconnect()` | Close WebSocket, stop reconnection, clear subscriptions |
| `subscribe(channels)` | Subscribe to real-time update channels |
| `unsubscribe(channels)` | Unsubscribe from channels |

### `RegistryClientOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | required | Registry server URL (http/https) |
| `apiKey` | `string` | - | API key for authentication |
| `autoConnect` | `boolean` | `true` | Auto-connect WebSocket on creation |
| `reconnectInterval` | `number` | `1000` | Base interval for exponential backoff (ms) |
| `maxReconnectAttempts` | `number` | `10` | Max reconnection attempts |
| `connectionTimeout` | `number` | `10000` | WebSocket connection timeout (ms) |
| `heartbeatInterval` | `number` | `30000` | Ping interval for keep-alive (ms) |

### React Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useContract(chainId, name)` | `{ address, entry, isLoading, error, refetch }` | Fetch and subscribe to a single contract |
| `useAddressSet(chainId, name)` | `{ addresses, entries, isLoading, error, refetch }` | Fetch and subscribe to an address set |
| `useRegistryStatus()` | `{ isConnected }` | Track WebSocket connection status |
| `useRegistryClient()` | `RegistryClient` | Access the client instance directly |

### Error Classes

| Class | Extends | Description |
|-------|---------|-------------|
| `RegistryClientError` | `Error` | HTTP errors with `statusCode`, `errorCode`, `isNotFound`, `isUnauthorized`, `isForbidden`, `isServerError` |
| `WebSocketError` | `Error` | WebSocket connection failures |
| `ConnectionTimeoutError` | `WebSocketError` | Connection timeout |
| `ValidationError` | `Error` | Input validation failures |

### Zod Schemas

All schemas are exported for custom validation:

```typescript
import { ContractEntrySchema, ResolvedAddressSetSchema } from '@stablenet/registry-client'
```

## Channel Format

WebSocket subscription channels follow the pattern:

- `contracts:{chainId}:{name}` - Subscribe to a specific contract
- `sets:{chainId}:{name}` - Subscribe to an address set

## Development

```bash
pnpm build        # Build with tsup
pnpm dev          # Watch mode
pnpm typecheck    # TypeScript type checking
pnpm lint         # Biome linter
pnpm test         # Run tests (80 tests)
pnpm test:watch   # Watch mode tests
```

## Architecture

```
src/
  index.ts              Core entry point
  client.ts             RegistryClient (REST + WebSocket)
  types.ts              Shared type definitions
  schemas.ts            Zod validation schemas
  errors.ts             Structured error classes
  react/
    index.ts            React entry point
    provider.tsx         RegistryProvider context
    hooks/
      useContract.ts     Single contract hook
      useAddressSet.ts   Address set hook
      useRegistryStatus.ts  Connection status hook
tests/
  client.test.ts        Client unit tests (38 tests)
  schemas.test.ts       Schema validation tests (31 tests)
  errors.test.ts        Error class tests (11 tests)
```

The package ships two entry points:
- `@stablenet/registry-client` - Core client (no React dependency)
- `@stablenet/registry-client/react` - React provider and hooks

## License

Private - StableNet
