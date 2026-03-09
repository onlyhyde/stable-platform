# @stablenet/wallet-sdk

TypeScript SDK for integrating dApps with StableNet Wallet. Provides EIP-1193 compliant provider, React hooks, wagmi v2 connector, and comprehensive ERC-4337 account abstraction utilities.

## Features

- **EIP-1193 Provider** — Standard Ethereum provider interface with typed StableNet extensions
- **EIP-6963 Discovery** — Automatic multi-wallet provider detection
- **React Hooks** — 13 hooks: `useWallet`, `useBalance`, `useNetwork`, `useToken`, `useChainId`, `useContractRead`, `useContractWrite`, `useBundler`, `usePaymaster`, `useNonce`, `useGasEstimation`, `useUserOpReceipt`, `useForceUninstallModule`, `useReplaceModule`
- **WalletProvider** — React Context with auto-injection
- **wagmi v2 Connector** — Native `stableNetWallet()` connector
- **EIP-2255 Permissions** — Permission management with fluent builder API
- **ERC-4337 Suite** — Bundler client, Paymaster client (ERC-7677), nonce management, gas estimation, factory/counterfactual addresses, EntryPoint abstraction, signature verification (ERC-1271), UserOp simulation
- **Custom RPC** — Type-safe methods for EIP-7702, ERC-7579, EIP-4337, session keys, stealth addresses (EIP-5564)
- **Full TypeScript** — Integrated with `@stablenet/core` and `@stablenet/sdk-types`

## Installation

```bash
pnpm add @stablenet/wallet-sdk
```

### Peer Dependencies

| Dependency | Required | Purpose |
|-----------|----------|---------|
| `viem` >= 2.0.0 | Yes | Ethereum client library |
| `@stablenet/core` >= 0.1.0 | Yes | Core ERC-4337 implementations |
| `@stablenet/sdk-types` >= 0.1.0 | Yes | Shared type definitions |
| `react` >= 18.0.0 | Optional | React hooks & context |
| `@wagmi/core` >= 2.0.0 | Optional | wagmi v2 connector |

## Quick Start

### React (with WalletProvider)

```tsx
import { WalletProvider, useWalletContext, useBalance } from '@stablenet/wallet-sdk/react'

function App() {
  return (
    <WalletProvider autoConnect>
      <Dashboard />
    </WalletProvider>
  )
}

function Dashboard() {
  const { connect, disconnect, isConnected, account } = useWalletContext()
  const { balance, isLoading } = useBalance({ account })

  if (!isConnected) {
    return <button onClick={() => connect()}>Connect</button>
  }

  return (
    <div>
      <p>Address: {account}</p>
      <p>Balance: {isLoading ? 'Loading...' : balance?.toString()}</p>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  )
}
```

### React (standalone)

```tsx
import { useWallet, useBalance } from '@stablenet/wallet-sdk/react'

function App() {
  const { connect, isConnected, account, provider } = useWallet()
  const { balance } = useBalance({ provider, account })
  // ...
}
```

### Vanilla TypeScript

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

const provider = await detectProvider()
if (provider) {
  const accounts = await provider.connect()
  const balance = await provider.getBalance(accounts[0])
}
```

### wagmi v2

```typescript
import { stableNetWallet } from '@stablenet/wallet-sdk/wagmi'
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'

const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [stableNetWallet()],
  transports: { [mainnet.id]: http(), [sepolia.id]: http() },
})
```

## Entry Points

The SDK is published as three separate bundles for optimal tree-shaking:

| Import Path | Contents | Required Deps |
|-------------|----------|---------------|
| `@stablenet/wallet-sdk` | Core SDK (provider, types, utilities) | viem, @stablenet/* |
| `@stablenet/wallet-sdk/react` | React hooks & WalletProvider | + react |
| `@stablenet/wallet-sdk/wagmi` | wagmi v2 connector | + @wagmi/core |

## API Reference

### Provider

#### detectProvider

Multi-strategy detection for the StableNet provider. Checks `window.stablenet`, `window.ethereum.isStableNet`, and EIP-6963 events.

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

const provider = await detectProvider({ timeout: 3000 })
```

#### StableNetProvider

EIP-1193 compliant provider wrapper with typed StableNet extensions.

```typescript
// Standard EIP-1193
const result = await provider.request({ method, params })

// Type-safe StableNet custom methods
const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: '0x...', nonce: 0n } }
)

// Events (returns unsubscribe function)
const unsub = provider.on('accountsChanged', (accounts) => {})
unsub()

// Convenience methods
await provider.connect()
await provider.disconnect()
await provider.switchChain(chainId)
await provider.addChain({ chainId, chainName, ... })
```

#### EIP-6963 Registry (multi-wallet)

```typescript
import { createProviderRegistry } from '@stablenet/wallet-sdk'

const registry = createProviderRegistry()
registry.subscribe((event) => {
  if (event.type === 'providerAdded') {
    console.log('New wallet found:', event.provider.info.name)
  }
})
const providers = await registry.discover()
registry.destroy()
```

### React Hooks

All hooks auto-inject `provider` from `<WalletProvider>` when used inside it. You can also pass `provider` explicitly for standalone usage.

#### useWallet

Connection state and account management.

```typescript
const {
  connect,          // () => Promise<Address[]>
  disconnect,       // () => Promise<void>
  switchNetwork,    // (chainId: number) => Promise<void>
  isConnected,      // boolean
  isConnecting,     // boolean
  account,          // Address | null
  chainId,          // number | null
  error,            // Error | null
  provider,         // StableNetProvider | null
} = useWallet()
```

#### useBalance

```typescript
const {
  balance,          // bigint | null (wei)
  isLoading,        // boolean
  error,            // Error | null
  refetch,          // () => Promise<void>
} = useBalance({ account })
```

#### useNetwork

```typescript
const {
  network,          // NetworkInfo | null
  chainId,          // number | null
  isTestnet,        // boolean
  networks,         // NetworkInfo[]
  switchNetwork,    // (chainId: number) => Promise<void>
  addNetwork,       // (network: NetworkInfo) => Promise<void>
  isSupported,      // (chainId: number) => boolean
} = useNetwork({})
```

#### useToken

```typescript
const {
  token,            // TokenInfo | null
  balance,          // BalanceInfo | null
  isLoading,        // boolean
  refetch,          // () => Promise<void>
} = useToken({ tokenAddress: '0x...', account })
```

#### useChainId

```typescript
const { chainId, chainIdHex, isLoading, error } = useChainId({})
```

#### useContractRead

```typescript
const { data, isLoading, error, refetch } = useContractRead({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
  watch: true,       // auto-refresh on account/chain change
})
```

#### useContractWrite

```typescript
const { write, txHash, isLoading, error, reset } = useContractWrite({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'transfer',
})

const hash = await write([recipientAddress, amount])
```

### WalletProvider

React Context Provider that supplies wallet state to child components.

```tsx
<WalletProvider autoConnect timeout={3000}>
  {children}
</WalletProvider>
```

```typescript
const { isConnected, account, connect, provider } = useWalletContext()
```

### ERC-4337 Account Abstraction

#### Bundler Client

```typescript
import { createBundlerClient } from '@stablenet/wallet-sdk'

const bundler = createBundlerClient({
  url: 'https://bundler.example.com',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
})

const hash = await bundler.sendUserOperation(userOp)
const receipt = await bundler.waitForUserOperationReceipt(hash)
const gas = await bundler.estimateUserOperationGas(userOp)
```

#### Paymaster Client (ERC-7677)

```typescript
import { createPaymasterClient, getPaymasterStubData, getPaymasterData } from '@stablenet/wallet-sdk'

const paymaster = createPaymasterClient({ url: 'https://paymaster.example.com' })
const stub = await getPaymasterStubData(paymasterUrl, userOp, entryPoint, chainId)
const data = await getPaymasterData(paymasterUrl, userOp, entryPoint, chainId)
```

#### Multi-Paymaster Fallback

```typescript
import { createPaymasterSelector } from '@stablenet/wallet-sdk'

const selector = createPaymasterSelector([
  { url: 'https://primary-paymaster.com', priority: 1 },
  { url: 'https://fallback-paymaster.com', priority: 2 },
])
```

#### Nonce Management

```typescript
import { getNonce, parseNonce, encodeNonceKey } from '@stablenet/wallet-sdk'

const nonce = await getNonce(publicClient, sender, entryPoint)
const { key, sequence } = parseNonce(nonce)
const encoded = encodeNonceKey(key, sequence)
```

#### Gas Estimation

```typescript
import { estimateUserOperationGas, DEFAULT_CALL_GAS_LIMIT } from '@stablenet/wallet-sdk'

const gas = await estimateUserOperationGas(bundlerClient, userOp)
```

#### Factory / Counterfactual Addresses

```typescript
import { getSenderAddress, predictCounterfactualAddress } from '@stablenet/wallet-sdk'

const address = predictCounterfactualAddress(factory, initCodeHash, salt)
const sender = await getSenderAddress(publicClient, factory, factoryData, entryPoint)
```

#### ERC-1271 Signature Verification

```typescript
import { verifySignature, isSmartContractAccount } from '@stablenet/wallet-sdk'

const isContract = await isSmartContractAccount(publicClient, address)
const result = await verifySignature(publicClient, account, hash, signature)
// result: { isValid: boolean, signerType: 'eoa' | 'contract' }
```

#### UserOp Simulation

```typescript
import { simulateValidation, simulateHandleOp } from '@stablenet/wallet-sdk'

const validation = await simulateValidation(publicClient, userOp, entryPoint)
const execution = await simulateHandleOp(publicClient, userOp, target, callData, entryPoint)
```

#### UserOperation Builder

```typescript
import { UserOperationBuilder } from '@stablenet/wallet-sdk'

const userOp = new UserOperationBuilder()
  .setSender(accountAddress)
  .setCallData(callData)
  .setGasLimits({ callGasLimit, verificationGasLimit, preVerificationGas })
  .setPaymaster(paymasterAddress)
  .build()
```

#### ERC-4337 React Hooks

```typescript
import {
  useBundler,
  usePaymaster,
  useNonce,
  useGasEstimation,
  useUserOpReceipt,
} from '@stablenet/wallet-sdk/react'

const { sendUserOp, estimateGas, getReceipt, isLoading } = useBundler({
  bundlerUrl: 'https://bundler.example.com',
  entryPoint: '0x...',
})

const { getStubData, getData, isLoading } = usePaymaster({
  paymasterUrl: 'https://paymaster.example.com',
})

const { nonce, key, sequence, refetch } = useNonce({ publicClient, sender })
const { gasEstimate, estimate, isLoading } = useGasEstimation({ bundlerClient })
const { receipt, waitForReceipt, pendingOps } = useUserOpReceipt({ bundlerClient })
```

### Permissions (EIP-2255)

```typescript
import { createPermissionManager, permissionRequest } from '@stablenet/wallet-sdk'

const pm = createPermissionManager(provider)

// Check current permissions
const perms = await pm.getPermissions()

// Request with fluent builder
const request = permissionRequest()
  .accounts()
  .signAuthorization()
  .sendUserOperation()
  .build()

await pm.requestPermissions(request)

// StableNet-specific permissions
await pm.requestStableNetPermissions({
  authorization: true,
  userOperation: true,
  sessionKeys: true,
})
```

### Custom RPC Methods

Type-safe access to StableNet-specific RPC methods:

| Category | Methods |
|----------|---------|
| **EIP-7702** | `wallet_signAuthorization`, `wallet_getDelegationStatus`, `wallet_revokeDelegation` |
| **ERC-7579** | `wallet_getInstalledModules`, `wallet_installModule`, `wallet_uninstallModule`, `wallet_forceUninstallModule`, `wallet_replaceModule`, `wallet_isModuleInstalled` |
| **EIP-4337** | `wallet_sendUserOperation`, `wallet_getUserOperationReceipt`, `wallet_estimateUserOperationGas` |
| **Session Keys** | `wallet_createSessionKey`, `wallet_getSessionKeys`, `wallet_revokeSessionKey` |
| **EIP-5564** | `wallet_generateStealthAddress`, `wallet_scanStealthPayments`, `wallet_getStealthMetaAddress` |
| **Paymaster** | `wallet_getPaymasterData`, `wallet_sponsorUserOperation` |

```typescript
import { STABLENET_RPC_METHODS } from '@stablenet/wallet-sdk'

const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: contractAddress, nonce: 0n } }
)

const modules = await provider.stableNetRequest(
  'wallet_getInstalledModules',
  { account: accountAddress }
)
```

### Network Configuration

```typescript
import { DEFAULT_NETWORKS, networkRegistry } from '@stablenet/wallet-sdk'

// List supported networks
console.log(DEFAULT_NETWORKS)

// Get network config by chain ID
const config = networkRegistry.getNetwork(1)

// Add custom network
networkRegistry.addNetwork({
  id: 42161,
  name: 'Arbitrum One',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://arb1.arbitrum.io/rpc'] } },
})
```

## Architecture

```
@stablenet/wallet-sdk
├── provider/          # EIP-1193 & EIP-6963 provider detection
├── hooks/             # 13 React hooks
├── context/           # WalletProvider React Context
├── wagmi.ts           # wagmi v2 connector
├── config/            # Network configuration & registry
├── permissions/       # EIP-2255 permission management
├── bundler/           # ERC-4337 bundler client
├── paymaster/         # ERC-7677 paymaster client & selector
├── userOp/            # UserOperation builder, hash, pack
├── nonce/             # Nonce management
├── gas/               # Gas estimation utilities
├── factory/           # Counterfactual address utilities
├── entrypoint/        # EntryPoint abstraction
├── signature/         # ERC-1271 signature verification
├── simulation/        # UserOp simulation
├── mempool/           # UserOp monitoring
├── execution/         # ERC-7579 execution modes
├── validationData/    # ValidationData parsing
├── errors/            # AA error framework
├── types/             # Comprehensive type definitions
├── rpc/               # Custom RPC type definitions
├── validation.ts      # Input validation utilities
└── logger.ts          # Logging configuration
```

## Development

```bash
pnpm build           # Build with tsup
pnpm dev             # Watch mode build
pnpm typecheck       # TypeScript type checking
pnpm test            # Run all tests
pnpm test:ci         # Run CI subset of tests
pnpm test:watch      # Watch mode testing
pnpm clean           # Remove dist directory
```

## License

MIT
