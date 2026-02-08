# StableNet Wallet Extension - Developer Guide

## Security Model

### Overview

보안은 다중 레이어로 구성되어 있으며, 각 경계에서 입력 검증과 위협 탐지를 수행합니다.

```
dApp (untrusted)
  │  window.postMessage
  ▼
InPage Provider  ──→  Message Schema Validation
  │  chrome.runtime
  ▼
Content Script   ──→  Origin Verification (chrome.tabs)
  │  chrome.runtime
  ▼
Background
  ├─ Rate Limiter        (per-origin request throttling)
  ├─ Input Validator     (address, hex, chain ID, RPC params)
  ├─ Phishing Guard      (domain blocklist + pattern matching)
  ├─ Transaction Simulator (eth_call + calldata decoding)
  └─ Approval Controller (user consent for state-changing ops)
```

### Message Validation

모든 확장 내부 메시지는 `validateExtensionMessage()`를 통해 스키마 검증됩니다.

```typescript
// src/shared/validation/messageSchema.ts
import { validateExtensionMessage, isValidMessageType } from './messageSchema'

// Content script → Background
const parsed = validateExtensionMessage(event.data)
if (!parsed) return // Invalid message, silently drop

// Validate specific payload structure
if (!isValidMessageType(parsed.type)) return
```

검증 대상:
- `type`: 허용된 MESSAGE_TYPES 중 하나
- `id`: non-empty string
- `payload`: object 타입
- `source`: 'stablenet-inpage' | 'stablenet-content' | 'stablenet-background'

### Origin Verification

dApp origin은 메시지 내 self-reported origin 대신 `chrome.tabs` API로 검증합니다.

```typescript
// src/shared/security/originVerifier.ts
import { isOriginAllowed, originFromUrl } from './originVerifier'

// chrome-extension:// URLs도 안전하게 처리
const origin = originFromUrl('chrome-extension://abc123/popup.html')
// → 'chrome-extension://abc123'

// 내부 origin 검사
isOriginAllowed(origin) // Extension origins are always allowed
```

### Phishing Detection

`checkOrigin()` 함수가 dApp 연결 시 자동으로 호출됩니다.

```typescript
// src/background/security/phishingGuard.ts
import { checkOrigin } from './phishingGuard'

const result = await checkOrigin('https://suspicious-site.com')
if (result.isPhishing) {
  // Block connection, show warning to user
}
```

### Transaction Simulation

트랜잭션 승인 전에 `eth_call`로 시뮬레이션하여 결과를 미리 보여줍니다.

- **CallDataDecoder**: ERC-20/721/1155 ABI 디코딩 (approve, transfer, setApprovalForAll 등)
- **TransactionSimulator**: 잔액 변화, 토큰 승인, 위험 경고 생성
- **Approval UI**: 시뮬레이션 결과를 TransactionSimulation 컴포넌트로 표시

### Memory Sanitization

지갑 잠금 시 메모리에서 민감 데이터를 제거합니다.

```typescript
// src/shared/security/memorySanitizer.ts
import { sanitizeBuffer, sanitizeString, sanitizeObject } from './memorySanitizer'

// Lock 시 호출
sanitizeBuffer(privateKeyBuffer)  // Zero-fill
sanitizeString(mnemonic)          // Overwrite with spaces
sanitizeObject(keyringState)      // Deep-clear all values
```

### Error Handling

```typescript
// src/shared/errors/WalletError.ts
import { WalletError } from './WalletError'

throw new WalletError(
  'KEYRING_LOCKED',
  'Wallet is locked',
  { context: 'signMessage', origin: 'https://dapp.com' }
)

// RPC 응답으로 변환
const rpcError = walletError.toRpcError()
// → { code: 4100, message: 'Wallet is locked', data: {...} }
```

---

## wallet-sdk Usage

### Installation

```bash
pnpm add @stablenet/wallet-sdk
```

### Provider Setup

```typescript
import { WalletProvider } from '@stablenet/wallet-sdk'

function App() {
  return (
    <WalletProvider autoConnect>
      <MyDApp />
    </WalletProvider>
  )
}
```

WalletProvider는 다음을 관리합니다:
- EIP-6963 provider 자동 탐지
- 연결 상태 lifecycle
- 이벤트 리스너 등록/해제
- 자동 재연결

### React Hooks

#### useWallet

```typescript
import { useWallet } from '@stablenet/wallet-sdk'

function ConnectButton() {
  const { connect, disconnect, isConnected, address, chainId } = useWallet()

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <p>Chain: {chainId}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return <button onClick={connect}>Connect Wallet</button>
}
```

#### useBalance

```typescript
import { useBalance } from '@stablenet/wallet-sdk'

function BalanceDisplay() {
  const { balance, isLoading, refetch } = useBalance()

  if (isLoading) return <p>Loading...</p>
  return <p>Balance: {balance} ETH</p>
}
```

#### useNetwork

```typescript
import { useNetwork } from '@stablenet/wallet-sdk'

function NetworkSwitcher() {
  const { chainId, switchNetwork, networks } = useNetwork()

  return (
    <select
      value={chainId}
      onChange={(e) => switchNetwork(Number(e.target.value))}
    >
      {networks.map((n) => (
        <option key={n.chainId} value={n.chainId}>{n.name}</option>
      ))}
    </select>
  )
}
```

#### useToken

```typescript
import { useToken } from '@stablenet/wallet-sdk'

function TokenInfo({ address }: { address: string }) {
  const { name, symbol, decimals, balance } = useToken(address)

  return (
    <div>
      <p>{name} ({symbol})</p>
      <p>Balance: {balance}</p>
    </div>
  )
}
```

### Direct Provider Access

React 없이 직접 provider를 사용할 수 있습니다:

```typescript
import { StableNetProvider, detectProvider } from '@stablenet/wallet-sdk'

// Auto-detect installed wallet
const provider = await detectProvider()

// Or create manually
const provider = new StableNetProvider()

// EIP-1193 standard
const accounts = await provider.request({ method: 'eth_requestAccounts' })
const chainId = await provider.request({ method: 'eth_chainId' })

// Events
provider.on('accountsChanged', (accounts) => { ... })
provider.on('chainChanged', (chainId) => { ... })
provider.on('disconnect', () => { ... })
```

---

## RPC Methods Reference

### Account Methods

| Method | Approval | Description |
|--------|----------|-------------|
| `eth_accounts` | No | 연결된 계정 목록 |
| `eth_requestAccounts` | Yes | 연결 요청 (피싱 검사 포함) |

### Chain Methods

| Method | Approval | Description |
|--------|----------|-------------|
| `eth_chainId` | No | 현재 체인 ID (hex) |
| `net_version` | No | 네트워크 버전 (decimal string) |
| `wallet_switchEthereumChain` | No | 체인 전환 |
| `wallet_addEthereumChain` | Yes | 새 체인 추가 |

### Signing Methods

| Method | Approval | Description |
|--------|----------|-------------|
| `personal_sign` | Yes | 메시지 서명 |
| `eth_signTypedData_v4` | Yes | EIP-712 typed data 서명 |

### Transaction Methods

| Method | Approval | Description |
|--------|----------|-------------|
| `eth_sendTransaction` | Yes | 트랜잭션 전송 (시뮬레이션 포함) |
| `eth_sendRawTransaction` | No | 서명된 raw tx 전송 |
| `eth_estimateGas` | No | 가스 추정 |
| `eth_getTransactionCount` | No | 논스 조회 |

### Read Methods

| Method | Description |
|--------|-------------|
| `eth_getBalance` | 잔액 조회 |
| `eth_blockNumber` | 최신 블록 번호 |
| `eth_gasPrice` | 현재 가스 가격 |
| `eth_maxPriorityFeePerGas` | EIP-1559 priority fee |
| `eth_feeHistory` | 가스 수수료 히스토리 |
| `eth_call` | 읽기 전용 호출 |
| `eth_getTransactionReceipt` | 트랜잭션 영수증 |
| `eth_getBlockByNumber` | 블록 조회 |

### Permission Methods

| Method | Description |
|--------|-------------|
| `wallet_getPermissions` | 현재 권한 조회 |
| `wallet_requestPermissions` | 권한 요청 |

---

## Testing

### Test Structure

```
tests/
├── security/              # Security boundary tests
│   ├── messageSchema.test.ts
│   ├── originVerifier.test.ts
│   └── walletError.test.ts
├── integration/           # End-to-end RPC flow tests
│   └── rpcFlow.test.ts
└── utils/
    ├── testUtils.ts       # Test helpers
    └── __mocks__/         # Module mocks for jest
        ├── stablenetCore.js
        └── stablenetPluginStealth.js
```

### Running Tests

```bash
# All tests
pnpm --filter wallet-extension test

# Security tests only
npx jest tests/security/

# Integration tests only
npx jest tests/integration/

# Type checking
pnpm --filter wallet-extension typecheck
```

### Writing Tests

@stablenet/core 의존성은 jest.mock()으로 모킹합니다:

```typescript
jest.mock('@stablenet/core', () => ({
  InputValidator: jest.fn().mockImplementation(() => ({
    validateAddress: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    // ...
  })),
  createRateLimiter: jest.fn().mockReturnValue({
    checkLimit: jest.fn().mockReturnValue({ allowed: true }),
    // ...
  }),
}))
```

---

## Performance

### RPC Request Caching

deterministic RPC 메서드는 TTL 기반으로 캐싱됩니다:

| Method | TTL |
|--------|-----|
| `eth_chainId` | 60s |
| `eth_blockNumber` | 2s |
| `eth_gasPrice` | 5s |
| `eth_getCode` | 30s |
| `eth_getBalance` | 10s |

```typescript
// packages/sdk-ts/core/src/rpc/requestCache.ts
import { RequestCache } from '@stablenet/core'

const cache = new RequestCache({ maxEntries: 200 })
if (cache.isCacheable('eth_chainId')) {
  const cached = cache.get('eth_chainId', [])
  if (cached) return cached
}
```

### Circuit Breaker

RPC 엔드포인트 장애 시 자동으로 요청을 차단합니다:

```typescript
// packages/sdk-ts/core/src/rpc/circuitBreaker.ts
import { CircuitBreaker } from '@stablenet/core'

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
})

if (!breaker.canExecute()) {
  throw new Error('Circuit is OPEN')
}

try {
  const result = await rpcCall()
  breaker.onSuccess()
  return result
} catch (err) {
  breaker.onFailure()
  throw err
}
```

### Network Health & Failover

NetworkController가 주기적으로 RPC 엔드포인트를 체크하고, 장애 시 fallback URL로 자동 전환합니다:

```typescript
// 30초 간격 헬스 체크 시작
networkController.startHealthChecks(30_000)

// 연속 3회 실패 시 fallbackRpcUrls로 자동 페일오버
// network.config.fallbackRpcUrls = ['https://backup-rpc.example.com']
```

### Public Client Caching

`createPublicClient()` 인스턴스는 RPC URL별로 캐싱되어 재생성 비용을 절감합니다.

---

## Build & Deploy

```bash
# Development build
pnpm --filter wallet-extension dev

# Production build
pnpm --filter wallet-extension build

# Load in Chrome
# 1. chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked → apps/wallet-extension/dist
```
