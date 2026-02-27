# @stablenet/wallet-sdk

> [한국어 문서는 아래에 있습니다 / Korean documentation below](#한국어)

TypeScript SDK for integrating dApps with StableNet Wallet.

## Features

- EIP-1193 compliant Provider
- EIP-6963 automatic provider discovery (multi-wallet)
- React hooks: `useWallet`, `useBalance`, `useNetwork`, `useToken`, `useChainId`, `useContractRead`, `useContractWrite`
- **ERC-4337 hooks**: `useBundler`, `usePaymaster`, `useNonce`, `useGasEstimation`, `useUserOpReceipt`
- `WalletProvider` React Context with auto-injection
- wagmi v2 Connector (`stableNetWallet`)
- EIP-2255 permission management with fluent builder
- StableNet custom RPC methods (EIP-7702, ERC-7579, EIP-4337, session keys, stealth addresses)
- **ERC-4337 utilities**: Bundler client, Paymaster client (ERC-7677), Nonce management, Gas estimation, Factory/counterfactual addresses, EntryPoint abstraction, ERC-1271 signature verification, UserOp simulation
- Full TypeScript support (integrated with `@stablenet/core`)

## Installation

```bash
pnpm add @stablenet/wallet-sdk
```

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

## React Hooks

All hooks auto-inject `provider` from `<WalletProvider>` when used inside it.
You can also pass `provider` explicitly for standalone usage.

### useWallet

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

### useBalance

Query the current account balance.

```typescript
const {
  balance,          // bigint | null (wei)
  isLoading,        // boolean
  error,            // Error | null
  refetch,          // () => Promise<void>
} = useBalance({ account })
```

### useNetwork

Network info and switching.

```typescript
const {
  network,          // NetworkInfo | null
  chainId,          // number | null
  isTestnet,        // boolean
  networks,         // NetworkInfo[]
  isLoading,        // boolean
  error,            // Error | null
  switchNetwork,    // (chainId: number) => Promise<void>
  addNetwork,       // (network: NetworkInfo) => Promise<void>
  isSupported,      // (chainId: number) => boolean
} = useNetwork({})
```

### useToken

Query ERC-20 token info.

```typescript
const {
  token,            // TokenInfo | null
  balance,          // BalanceInfo | null
  isLoading,        // boolean
  error,            // Error | null
  refetch,          // () => Promise<void>
} = useToken({ tokenAddress: '0x...', account })
```

### useChainId

Get the current chain ID.

```typescript
const {
  chainId,          // number | null
  chainIdHex,       // string | null
  isLoading,        // boolean
  error,            // Error | null
} = useChainId({})
```

### useContractRead

Read data from smart contracts (eth_call).

```tsx
import { useContractRead } from '@stablenet/wallet-sdk/react'

const { data, isLoading, error, refetch } = useContractRead({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
  watch: true,       // auto-refresh on account/chain change
})
```

### useContractWrite

Write to smart contracts (via sendTransaction).

```tsx
import { useContractWrite } from '@stablenet/wallet-sdk/react'

const { write, txHash, isLoading, error, reset } = useContractWrite({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'transfer',
})

const hash = await write([recipientAddress, amount])
```

## WalletProvider

React Context Provider that supplies wallet state to child components.

```tsx
<WalletProvider autoConnect timeout={3000}>
  {children}
</WalletProvider>
```

Child components access state via `useWalletContext()`:

```typescript
const { isConnected, account, connect, provider } = useWalletContext()
```

## Provider API

Follows the EIP-1193 standard with typed StableNet extensions.

```typescript
// Standard EIP-1193
const result = await provider.request({ method, params })

// Typed StableNet custom methods
const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: '0x...', nonce: 0n } }
)

// Events (returns unsubscribe function)
const unsub = provider.on('accountsChanged', (accounts) => {})
unsub() // cleanup

// Convenience methods
await provider.connect()
await provider.disconnect()
await provider.switchChain(chainId)
await provider.addChain({ chainId, chainName, ... })
```

## Provider Detection

### EIP-6963 (recommended)

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

// Automatically discovers StableNet Wallet via EIP-6963 events
const provider = await detectProvider({ timeout: 3000 })
```

### EIP-6963 Registry (multi-wallet)

```typescript
import { createProviderRegistry } from '@stablenet/wallet-sdk'

const registry = createProviderRegistry()
registry.subscribe((event) => {
  if (event.type === 'providerAdded') {
    console.log('New wallet found:', event.provider.info.name)
  }
})
const providers = await registry.discover()

// Cleanup when done
registry.destroy()
```

### Legacy (window.stablenet)

```typescript
if (window.stablenet) {
  const provider = window.stablenet
}
```

## Permissions (EIP-2255)

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

## Network Configuration

```typescript
import { DEFAULT_NETWORKS, networkRegistry } from '@stablenet/wallet-sdk'

// Supported network list
console.log(DEFAULT_NETWORKS)

// Get network config by chain ID
const config = networkRegistry.getNetwork(1)
```

## StableNet Custom RPC

The SDK exports TypeScript types for StableNet-specific RPC methods:

- **EIP-7702**: `Authorization`, `SignedAuthorization`, `DelegationStatus`
- **ERC-7579**: `ModuleType`, `InstalledModule`, `ModuleInstallRequest`
- **EIP-4337**: `UserOperationRequest`, `UserOperationReceipt`
- **Session Keys**: `SessionKeyPermission`, `SessionKeyConfig`
- **Stealth Addresses**: `StealthMetaAddress`, `StealthAddressResult`
- **Paymaster**: `PaymasterData`, `SponsorshipRequest`

```typescript
import { STABLENET_RPC_METHODS } from '@stablenet/wallet-sdk'

// Type-safe custom RPC (recommended)
const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: contractAddress, nonce: 0n } }
)

const modules = await provider.stableNetRequest(
  'wallet_getInstalledModules',
  { account: accountAddress }
)
```

## ERC-4337 Account Abstraction

The SDK provides comprehensive ERC-4337 support via `@stablenet/core` integration.

### Bundler Client

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

### Paymaster Client (ERC-7677)

```typescript
import { createPaymasterClient, getPaymasterStubData, getPaymasterData } from '@stablenet/wallet-sdk'

// Full paymaster client
const paymaster = createPaymasterClient({ url: 'https://paymaster.example.com' })

// ERC-7677 stub data (for gas estimation)
const stub = await getPaymasterStubData(paymasterUrl, userOp, entryPoint, chainId)

// ERC-7677 final data (after gas estimation)
const data = await getPaymasterData(paymasterUrl, userOp, entryPoint, chainId)
```

### Nonce Management

```typescript
import { getNonce, parseNonce, encodeNonceKey } from '@stablenet/wallet-sdk'

const nonce = await getNonce(publicClient, sender, entryPoint)
const { key, sequence } = parseNonce(nonce)
const encoded = encodeNonceKey(key, sequence)
```

### Gas Estimation

```typescript
import { estimateUserOperationGas, DEFAULT_CALL_GAS_LIMIT } from '@stablenet/wallet-sdk'

const gas = await estimateUserOperationGas(bundlerClient, userOp)
```

### Factory / Counterfactual Addresses

```typescript
import { getSenderAddress, predictCounterfactualAddress } from '@stablenet/wallet-sdk'

const address = predictCounterfactualAddress(factory, initCodeHash, salt)
const sender = await getSenderAddress(publicClient, factory, factoryData, entryPoint)
```

### ERC-1271 Signature Verification

```typescript
import { verifySignature, isSmartContractAccount } from '@stablenet/wallet-sdk'

const isContract = await isSmartContractAccount(publicClient, address)
const result = await verifySignature(publicClient, account, hash, signature)
// result: { isValid: boolean, signerType: 'eoa' | 'contract' }
```

### UserOp Simulation

```typescript
import { simulateValidation, simulateHandleOp } from '@stablenet/wallet-sdk'

const validation = await simulateValidation(publicClient, userOp, entryPoint)
const execution = await simulateHandleOp(publicClient, userOp, target, callData, entryPoint)
```

### ERC-4337 React Hooks

```typescript
import {
  useBundler,
  usePaymaster,
  useNonce,
  useGasEstimation,
  useUserOpReceipt,
} from '@stablenet/wallet-sdk/react'

// Bundler hook
const { sendUserOp, estimateGas, getReceipt, isLoading } = useBundler({
  bundlerUrl: 'https://bundler.example.com',
  entryPoint: '0x...',
})

// Paymaster hook
const { getStubData, getData, isLoading } = usePaymaster({
  paymasterUrl: 'https://paymaster.example.com',
})

// Nonce hook
const { nonce, key, sequence, refetch } = useNonce({ publicClient, sender })

// Gas estimation hook
const { gasEstimate, estimate, isLoading } = useGasEstimation({ bundlerClient })

// Receipt tracking hook
const { receipt, waitForReceipt, pendingOps } = useUserOpReceipt({ bundlerClient })
```

---

# 한국어

StableNet 지갑과 dApp을 연결하기 위한 TypeScript SDK입니다.

## 기능

- EIP-1193 표준 Provider
- EIP-6963 자동 Provider 탐지 (멀티 지갑)
- React hooks: `useWallet`, `useBalance`, `useNetwork`, `useToken`, `useChainId`, `useContractRead`, `useContractWrite`
- **ERC-4337 hooks**: `useBundler`, `usePaymaster`, `useNonce`, `useGasEstimation`, `useUserOpReceipt`
- `WalletProvider` React Context (자동 주입)
- wagmi v2 Connector (`stableNetWallet`)
- EIP-2255 권한 관리 (fluent builder 지원)
- StableNet 커스텀 RPC 메서드 (EIP-7702, ERC-7579, EIP-4337, 세션 키, 스텔스 주소)
- **ERC-4337 유틸리티**: Bundler 클라이언트, Paymaster 클라이언트 (ERC-7677), Nonce 관리, Gas 추정, Factory/counterfactual 주소, EntryPoint 추상화, ERC-1271 서명 검증, UserOp 시뮬레이션
- TypeScript 완전 지원 (`@stablenet/core` 통합)

## 설치

```bash
pnpm add @stablenet/wallet-sdk
```

## 빠른 시작

### React (WalletProvider 사용)

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
    return <button onClick={() => connect()}>연결</button>
  }

  return (
    <div>
      <p>주소: {account}</p>
      <p>잔액: {isLoading ? '로딩 중...' : balance?.toString()}</p>
      <button onClick={() => disconnect()}>연결 해제</button>
    </div>
  )
}
```

### React (독립 사용)

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

## React Hooks

모든 hooks는 `<WalletProvider>` 내에서 사용 시 `provider`를 자동 주입합니다.
독립적으로 사용 시 `provider`를 명시적으로 전달할 수 있습니다.

### useWallet

연결 상태 및 계정 관리.

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

### useBalance

현재 계정 잔액 조회.

```typescript
const {
  balance,          // bigint | null (wei)
  isLoading,        // boolean
  error,            // Error | null
  refetch,          // () => Promise<void>
} = useBalance({ account })
```

### useNetwork

네트워크 정보 및 전환.

```typescript
const {
  network,          // NetworkInfo | null
  chainId,          // number | null
  isTestnet,        // boolean
  networks,         // NetworkInfo[]
  isLoading,        // boolean
  error,            // Error | null
  switchNetwork,    // (chainId: number) => Promise<void>
  addNetwork,       // (network: NetworkInfo) => Promise<void>
  isSupported,      // (chainId: number) => boolean
} = useNetwork({})
```

### useToken

ERC-20 토큰 정보 조회.

```typescript
const {
  token,            // TokenInfo | null
  balance,          // BalanceInfo | null
  isLoading,        // boolean
  error,            // Error | null
  refetch,          // () => Promise<void>
} = useToken({ tokenAddress: '0x...', account })
```

### useChainId

현재 체인 ID 조회.

```typescript
const {
  chainId,          // number | null
  chainIdHex,       // string | null
  isLoading,        // boolean
  error,            // Error | null
} = useChainId({})
```

### useContractRead

스마트 컨트랙트에서 데이터 읽기 (eth_call).

```tsx
import { useContractRead } from '@stablenet/wallet-sdk/react'

const { data, isLoading, error, refetch } = useContractRead({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
  watch: true,       // 계정/체인 변경 시 자동 갱신
})
```

### useContractWrite

스마트 컨트랙트에 트랜잭션 전송 (sendTransaction 경로).

```tsx
import { useContractWrite } from '@stablenet/wallet-sdk/react'

const { write, txHash, isLoading, error, reset } = useContractWrite({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'transfer',
})

const hash = await write([recipientAddress, amount])
```

## WalletProvider

React Context Provider로 하위 컴포넌트에 지갑 상태를 제공합니다.

```tsx
<WalletProvider autoConnect timeout={3000}>
  {children}
</WalletProvider>
```

하위 컴포넌트에서 `useWalletContext()`로 접근:

```typescript
const { isConnected, account, connect, provider } = useWalletContext()
```

## Provider API

EIP-1193 표준을 따르며 StableNet 확장 메서드를 지원합니다.

```typescript
// 표준 EIP-1193
const result = await provider.request({ method, params })

// 타입 안전한 StableNet 커스텀 메서드 (권장)
const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: '0x...', nonce: 0n } }
)

// 이벤트 (unsubscribe 함수 반환)
const unsub = provider.on('accountsChanged', (accounts) => {})
unsub() // 정리

// 편의 메서드
await provider.connect()
await provider.disconnect()
await provider.switchChain(chainId)
await provider.addChain({ chainId, chainName, ... })
```

## Provider 탐지

### EIP-6963 (권장)

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

// EIP-6963 이벤트를 통해 StableNet 지갑을 자동 탐지
const provider = await detectProvider({ timeout: 3000 })
```

### EIP-6963 Registry (멀티 지갑)

```typescript
import { createProviderRegistry } from '@stablenet/wallet-sdk'

const registry = createProviderRegistry()
registry.subscribe((event) => {
  if (event.type === 'providerAdded') {
    console.log('새 지갑 발견:', event.provider.info.name)
  }
})
const providers = await registry.discover()

// 사용 후 정리
registry.destroy()
```

### Legacy (window.stablenet)

```typescript
if (window.stablenet) {
  const provider = window.stablenet
}
```

## 권한 관리 (EIP-2255)

```typescript
import { createPermissionManager, permissionRequest } from '@stablenet/wallet-sdk'

const pm = createPermissionManager(provider)

// 현재 권한 조회
const perms = await pm.getPermissions()

// Fluent builder로 권한 요청
const request = permissionRequest()
  .accounts()
  .signAuthorization()
  .sendUserOperation()
  .build()

await pm.requestPermissions(request)

// StableNet 전용 권한 일괄 요청
await pm.requestStableNetPermissions({
  authorization: true,
  userOperation: true,
  sessionKeys: true,
})
```

## 네트워크 설정

```typescript
import { DEFAULT_NETWORKS, networkRegistry } from '@stablenet/wallet-sdk'

// 지원 네트워크 목록
console.log(DEFAULT_NETWORKS)

// 특정 네트워크 설정 조회
const config = networkRegistry.getNetwork(1)
```

## StableNet 커스텀 RPC

SDK는 StableNet 전용 RPC 메서드를 위한 TypeScript 타입을 제공합니다:

- **EIP-7702**: `Authorization`, `SignedAuthorization`, `DelegationStatus`
- **ERC-7579**: `ModuleType`, `InstalledModule`, `ModuleInstallRequest`
- **EIP-4337**: `UserOperationRequest`, `UserOperationReceipt`
- **세션 키**: `SessionKeyPermission`, `SessionKeyConfig`
- **스텔스 주소**: `StealthMetaAddress`, `StealthAddressResult`
- **페이마스터**: `PaymasterData`, `SponsorshipRequest`

```typescript
import { STABLENET_RPC_METHODS } from '@stablenet/wallet-sdk'

// 타입 안전한 커스텀 RPC (권장)
const signed = await provider.stableNetRequest(
  'wallet_signAuthorization',
  { authorization: { chainId: 1, address: contractAddress, nonce: 0n } }
)

const modules = await provider.stableNetRequest(
  'wallet_getInstalledModules',
  { account: accountAddress }
)
```

## ERC-4337 계정 추상화

SDK는 `@stablenet/core` 통합을 통해 포괄적인 ERC-4337 지원을 제공합니다.

### Bundler 클라이언트

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

### Paymaster 클라이언트 (ERC-7677)

```typescript
import { createPaymasterClient, getPaymasterStubData, getPaymasterData } from '@stablenet/wallet-sdk'

const paymaster = createPaymasterClient({ url: 'https://paymaster.example.com' })
const stub = await getPaymasterStubData(paymasterUrl, userOp, entryPoint, chainId)
const data = await getPaymasterData(paymasterUrl, userOp, entryPoint, chainId)
```

### Nonce 관리

```typescript
import { getNonce, parseNonce, encodeNonceKey } from '@stablenet/wallet-sdk'

const nonce = await getNonce(publicClient, sender, entryPoint)
const { key, sequence } = parseNonce(nonce)
```

### ERC-1271 서명 검증

```typescript
import { verifySignature, isSmartContractAccount } from '@stablenet/wallet-sdk'

const result = await verifySignature(publicClient, account, hash, signature)
// result: { isValid: boolean, signerType: 'eoa' | 'contract' }
```

### UserOp 시뮬레이션

```typescript
import { simulateValidation, simulateHandleOp } from '@stablenet/wallet-sdk'

const validation = await simulateValidation(publicClient, userOp, entryPoint)
```

### ERC-4337 React Hooks

```typescript
import { useBundler, usePaymaster, useNonce, useGasEstimation, useUserOpReceipt } from '@stablenet/wallet-sdk/react'

const { sendUserOp, estimateGas, isLoading } = useBundler({ bundlerUrl, entryPoint })
const { getStubData, getData } = usePaymaster({ paymasterUrl })
const { nonce, key, sequence, refetch } = useNonce({ publicClient, sender })
const { gasEstimate, estimate } = useGasEstimation({ bundlerClient })
const { receipt, waitForReceipt, pendingOps } = useUserOpReceipt({ bundlerClient })
```
