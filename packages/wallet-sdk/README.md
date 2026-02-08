# @stablenet/wallet-sdk

StableNet 지갑과 dApp을 연결하기 위한 TypeScript SDK입니다.

## Features

- EIP-1193 표준 Provider
- EIP-6963 자동 Provider 탐지
- React hooks (useWallet, useBalance, useNetwork, useToken, useChainId)
- WalletProvider React Context
- 권한 관리 (wallet_requestPermissions)
- TypeScript 완전 지원

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
import { StableNetProvider, detectProvider } from '@stablenet/wallet-sdk'

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
  balance,          // string (formatted ETH)
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
  balance,          // string (formatted)
  isLoading,        // boolean
} = useToken(tokenAddress)
```

### useChainId

현재 체인 ID만 필요할 때.

```typescript
const chainId = useChainId() // number | null
```

## WalletProvider

React Context Provider로 하위 컴포넌트에 지갑 상태를 제공합니다.

```tsx
<WalletProvider
  autoConnect       // 페이지 로드 시 자동 연결 시도
>
  {children}
</WalletProvider>
```

## Provider API

EIP-1193 표준을 따릅니다.

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

### EIP-6963 (권장)

```typescript
import { detectProvider } from '@stablenet/wallet-sdk'

// 자동으로 EIP-6963 이벤트를 통해 StableNet 지갑 탐지
const provider = await detectProvider({ timeout: 3000 })
```

### Legacy (window.stablenet)

```typescript
if (window.stablenet) {
  const provider = window.stablenet
}
```

## Permissions

```typescript
import { requestPermissions, getPermissions } from '@stablenet/wallet-sdk'

// 현재 권한 조회
const perms = await getPermissions(provider)

// 추가 권한 요청
await requestPermissions(provider, ['eth_accounts'])
```

## Network Configuration

```typescript
import { SUPPORTED_NETWORKS, getNetworkConfig } from '@stablenet/wallet-sdk'

// 지원 네트워크 목록
console.log(SUPPORTED_NETWORKS) // [1, 11155111, 31337, ...]

// 특정 네트워크 설정
const config = getNetworkConfig(1)
// { chainId: 1, name: 'Ethereum', rpcUrl: '...', currency: { ... } }
```
