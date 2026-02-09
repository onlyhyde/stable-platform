# @stablenet/wallet-sdk

> [한국어 문서는 아래에 있습니다 / Korean documentation below](#한국어)

TypeScript SDK for integrating dApps with StableNet Wallet.

## Features

- EIP-1193 compliant Provider
- EIP-6963 automatic provider discovery (multi-wallet)
- React hooks: `useWallet`, `useBalance`, `useNetwork`, `useToken`, `useChainId`, `useContractRead`, `useContractWrite`
- `WalletProvider` React Context
- EIP-2255 permission management with fluent builder
- StableNet custom RPC methods (EIP-7702, ERC-7579, EIP-4337, session keys, stealth addresses)
- Full TypeScript support

## Installation

```bash
pnpm add @stablenet/wallet-sdk
```

## Quick Start

### React

```tsx
import { WalletProvider, useWallet, useBalance } from '@stablenet/wallet-sdk/react'

function App() {
  return (
    <WalletProvider autoConnect>
      <Dashboard />
    </WalletProvider>
  )
}

function Dashboard() {
  const { connect, disconnect, isConnected, address } = useWallet()
  const { balance, isLoading } = useBalance()

  if (!isConnected) {
    return <button onClick={connect}>Connect</button>
  }

  return (
    <div>
      <p>Address: {address}</p>
      <p>Balance: {isLoading ? 'Loading...' : balance}</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  )
}
```

### Vanilla TypeScript

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

const provider = await detectProvider()
const accounts = await provider.request({ method: 'eth_requestAccounts' })
const balance = await provider.request({
  method: 'eth_getBalance',
  params: [accounts[0], 'latest'],
})
```

## React Hooks

### useWallet

Connection state and account management.

```typescript
const {
  connect,          // () => Promise<void>
  disconnect,       // () => void
  isConnected,      // boolean
  isConnecting,     // boolean
  address,          // string | null
  chainId,          // number | null
  provider,         // StableNetProvider | null
} = useWallet()
```

### useBalance

Query the current account balance.

```typescript
const {
  balance,          // string (formatted ETH)
  rawBalance,       // bigint
  isLoading,        // boolean
  refetch,          // () => Promise<void>
} = useBalance()
```

### useNetwork

Network info and switching.

```typescript
const {
  chainId,          // number | null
  name,             // string | null
  switchNetwork,    // (chainId: number) => Promise<void>
} = useNetwork()
```

### useToken

Query ERC-20 token info.

```typescript
const {
  name,             // string | null
  symbol,           // string | null
  decimals,         // number | null
  balance,          // string (formatted)
  isLoading,        // boolean
} = useToken(tokenAddress)
```

### useChainId

Get only the current chain ID.

```typescript
const chainId = useChainId() // number | null
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
  provider,
  watch: true,       // auto-refresh on account/chain change
})
```

### useContractWrite

Write to smart contracts (eth_sendTransaction).

```tsx
import { useContractWrite } from '@stablenet/wallet-sdk/react'

const { write, txHash, isLoading, error, reset } = useContractWrite({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'transfer',
  provider,
})

const hash = await write([recipientAddress, amount])
```

## WalletProvider

React Context Provider that supplies wallet state to child components.

```tsx
<WalletProvider autoConnect>
  {children}
</WalletProvider>
```

## Provider API

Follows the EIP-1193 standard.

```typescript
// Request
const result = await provider.request({ method, params })

// Events
provider.on('connect', (info) => {})
provider.on('disconnect', (error) => {})
provider.on('accountsChanged', (accounts) => {})
provider.on('chainChanged', (chainId) => {})
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
registry.on('providerAdded', (provider) => {
  console.log('New wallet found:', provider.info.name)
})
registry.startDiscovery()
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
  .chains([1, 137])
  .expiry(Date.now() + 3600000)
  .build()

await pm.requestPermissions(request)
```

## Network Configuration

```typescript
import { DEFAULT_NETWORKS, networkRegistry } from '@stablenet/wallet-sdk'

// Supported network list
console.log(DEFAULT_NETWORKS)

// Get network config
const config = networkRegistry.getNetwork(1)
// { chainId: 1, name: 'Ethereum', rpcUrl: '...', nativeCurrency: { ... } }
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

// EIP-7702 authorization
const result = await provider.request({
  method: 'stablenet_signAuthorization',
  params: [{ chainId: 1, address: contractAddress, nonce: 0 }],
})

// ERC-7579 module management
const modules = await provider.request({
  method: 'stablenet_getInstalledModules',
  params: [accountAddress],
})
```

---

# 한국어

StableNet 지갑과 dApp을 연결하기 위한 TypeScript SDK입니다.

## 기능

- EIP-1193 표준 Provider
- EIP-6963 자동 Provider 탐지 (멀티 지갑)
- React hooks: `useWallet`, `useBalance`, `useNetwork`, `useToken`, `useChainId`, `useContractRead`, `useContractWrite`
- `WalletProvider` React Context
- EIP-2255 권한 관리 (fluent builder 지원)
- StableNet 커스텀 RPC 메서드 (EIP-7702, ERC-7579, EIP-4337, 세션 키, 스텔스 주소)
- TypeScript 완전 지원

## 설치

```bash
pnpm add @stablenet/wallet-sdk
```

## 빠른 시작

### React

```tsx
import { WalletProvider, useWallet, useBalance } from '@stablenet/wallet-sdk/react'

function App() {
  return (
    <WalletProvider autoConnect>
      <Dashboard />
    </WalletProvider>
  )
}

function Dashboard() {
  const { connect, disconnect, isConnected, address } = useWallet()
  const { balance, isLoading } = useBalance()

  if (!isConnected) {
    return <button onClick={connect}>연결</button>
  }

  return (
    <div>
      <p>주소: {address}</p>
      <p>잔액: {isLoading ? '로딩 중...' : balance}</p>
      <button onClick={disconnect}>연결 해제</button>
    </div>
  )
}
```

### Vanilla TypeScript

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

const provider = await detectProvider()
const accounts = await provider.request({ method: 'eth_requestAccounts' })
const balance = await provider.request({
  method: 'eth_getBalance',
  params: [accounts[0], 'latest'],
})
```

## React Hooks

### useWallet

연결 상태 및 계정 관리.

```typescript
const {
  connect,          // () => Promise<void>
  disconnect,       // () => void
  isConnected,      // boolean
  isConnecting,     // boolean
  address,          // string | null
  chainId,          // number | null
  provider,         // StableNetProvider | null
} = useWallet()
```

### useBalance

현재 계정 잔액 조회.

```typescript
const {
  balance,          // string (포맷된 ETH)
  rawBalance,       // bigint
  isLoading,        // boolean
  refetch,          // () => Promise<void>
} = useBalance()
```

### useNetwork

네트워크 정보 및 전환.

```typescript
const {
  chainId,          // number | null
  name,             // string | null
  switchNetwork,    // (chainId: number) => Promise<void>
} = useNetwork()
```

### useToken

ERC-20 토큰 정보 조회.

```typescript
const {
  name,             // string | null
  symbol,           // string | null
  decimals,         // number | null
  balance,          // string (포맷됨)
  isLoading,        // boolean
} = useToken(tokenAddress)
```

### useChainId

현재 체인 ID만 필요할 때.

```typescript
const chainId = useChainId() // number | null
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
  provider,
  watch: true,       // 계정/체인 변경 시 자동 갱신
})
```

### useContractWrite

스마트 컨트랙트에 트랜잭션 전송 (eth_sendTransaction).

```tsx
import { useContractWrite } from '@stablenet/wallet-sdk/react'

const { write, txHash, isLoading, error, reset } = useContractWrite({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'transfer',
  provider,
})

const hash = await write([recipientAddress, amount])
```

## WalletProvider

React Context Provider로 하위 컴포넌트에 지갑 상태를 제공합니다.

```tsx
<WalletProvider autoConnect>
  {children}
</WalletProvider>
```

## Provider API

EIP-1193 표준을 따릅니다.

```typescript
// 요청
const result = await provider.request({ method, params })

// 이벤트
provider.on('connect', (info) => {})
provider.on('disconnect', (error) => {})
provider.on('accountsChanged', (accounts) => {})
provider.on('chainChanged', (chainId) => {})
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
registry.on('providerAdded', (provider) => {
  console.log('새 지갑 발견:', provider.info.name)
})
registry.startDiscovery()
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
  .chains([1, 137])
  .expiry(Date.now() + 3600000)
  .build()

await pm.requestPermissions(request)
```

## 네트워크 설정

```typescript
import { DEFAULT_NETWORKS, networkRegistry } from '@stablenet/wallet-sdk'

// 지원 네트워크 목록
console.log(DEFAULT_NETWORKS)

// 특정 네트워크 설정 조회
const config = networkRegistry.getNetwork(1)
// { chainId: 1, name: 'Ethereum', rpcUrl: '...', nativeCurrency: { ... } }
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

// EIP-7702 인가
const result = await provider.request({
  method: 'stablenet_signAuthorization',
  params: [{ chainId: 1, address: contractAddress, nonce: 0 }],
})

// ERC-7579 모듈 관리
const modules = await provider.request({
  method: 'stablenet_getInstalledModules',
  params: [accountAddress],
})
```
