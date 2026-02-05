# StableNet SDK Overview

> **Version**: 1.0
> **Last Updated**: 2025-02-05
> **Status**: Active Development

---

## 1. 개요

StableNet SDK는 Smart Contract와 상호작용하기 위한 TypeScript/JavaScript 라이브러리입니다.

### 1.1 목표

- **ERC-4337 Account Abstraction** 완벽 지원
- **ERC-7579 모듈형 Smart Account** 관리
- **EIP-7702 EOA Delegation** 지원
- **Paymaster** 가스 대납 통합
- **Stealth Address** 프라이버시 전송
- **DeFi Integration** 스왑, 대출, 스테이킹

### 1.2 핵심 특징

| 특징 | 설명 |
|------|------|
| **Viem 기반** | 타입 안전한 Ethereum 상호작용 |
| **모듈형 아키텍처** | 필요한 기능만 선택적으로 사용 |
| **플러그인 시스템** | 확장 가능한 기능 추가 |
| **완전한 타입 지원** | TypeScript 네이티브 |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         StableNet SDK Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Core Packages                                │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │ │
│  │  │ @stablenet/core  │  │@stablenet/accounts│  │ @stablenet/types │ │ │
│  │  │                  │  │                  │  │                  │ │ │
│  │  │ - BundlerClient  │  │ - KernelAccount  │  │ - UserOperation  │ │ │
│  │  │ - SmartAccount   │  │ - AccountFactory │  │ - Call           │ │ │
│  │  │   Client         │  │ - SignerAdapter  │  │ - ModuleTypes    │ │ │
│  │  │ - EIP-7702       │  │                  │  │ - Network        │ │ │
│  │  │ - UserOp Utils   │  │                  │  │                  │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                           Plugins                                   │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │ │
│  │  │plugin-ecdsa│  │plugin-     │  │ plugin-    │  │ plugin-    │  │ │
│  │  │            │  │session-keys│  │ paymaster  │  │ stealth    │  │ │
│  │  │ ECDSA      │  │            │  │            │  │            │  │ │
│  │  │ Validator  │  │ SessionKey │  │ Verifying  │  │ EIP-5564   │  │ │
│  │  │            │  │ Executor   │  │ Sponsor    │  │ EIP-6538   │  │ │
│  │  │            │  │            │  │ Permit2    │  │            │  │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │ │
│  │                                                                    │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │ │
│  │  │plugin-     │  │ plugin-    │  │ plugin-    │                   │ │
│  │  │subscription│  │ defi       │  │ modules    │                   │ │
│  │  │            │  │            │  │            │                   │ │
│  │  │ Subscription│ │ Swap       │  │ Module     │                   │ │
│  │  │ Recurring  │  │ Lending    │  │ Install    │                   │ │
│  │  │ Permission │  │ Staking    │  │ Encode     │                   │ │
│  │  └────────────┘  └────────────┘  └────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 패키지 구조

### 3.1 디렉토리 구조

```
packages/sdk/
├── packages/
│   ├── core/              # @stablenet/core
│   │   └── src/
│   │       ├── clients/   # BundlerClient, SmartAccountClient, IndexerClient
│   │       ├── eip7702/   # EIP-7702 지원
│   │       ├── errors/    # 에러 타입
│   │       └── utils/     # UserOp 유틸리티
│   │
│   ├── accounts/          # @stablenet/accounts
│   │   └── src/
│   │       ├── kernel/    # Kernel Account
│   │       └── factory/   # Account Factory
│   │
│   └── types/             # @stablenet/types
│       └── src/
│           ├── userOp.ts  # UserOperation 타입
│           ├── modules.ts # 모듈 타입
│           └── network.ts # 네트워크 타입
│
└── plugins/
    ├── ecdsa/             # @stablenet/plugin-ecdsa
    ├── session-keys/      # @stablenet/plugin-session-keys
    ├── subscription/      # @stablenet/plugin-subscription
    ├── paymaster/         # @stablenet/plugin-paymaster
    ├── stealth/           # @stablenet/plugin-stealth
    ├── defi/              # @stablenet/plugin-defi
    └── modules/           # @stablenet/plugin-modules
```

### 3.2 패키지 설명

#### Core Packages

| 패키지 | 설명 | 주요 Export |
|--------|------|-------------|
| `@stablenet/core` | SDK 핵심 기능 | `createBundlerClient`, `createSmartAccountClient`, EIP-7702 유틸 |
| `@stablenet/accounts` | Smart Account 관리 | `createKernelAccount`, `KernelAccountFactory` |
| `@stablenet/types` | 공통 타입 정의 | `UserOperation`, `Call`, `ModuleType`, `Network` |

#### Plugin Packages

| 패키지 | 설명 | 지원 Contract |
|--------|------|---------------|
| `@stablenet/plugin-ecdsa` | ECDSA 서명 검증 | ECDSAValidator |
| `@stablenet/plugin-session-keys` | 세션 키 관리 | SessionKeyExecutor |
| `@stablenet/plugin-subscription` | 구독/정기결제 | SubscriptionManager, RecurringPaymentExecutor |
| `@stablenet/plugin-paymaster` | 가스 대납 | VerifyingPaymaster, SponsorPaymaster, Permit2Paymaster |
| `@stablenet/plugin-stealth` | 프라이버시 전송 | ERC5564Announcer, ERC6538Registry |
| `@stablenet/plugin-defi` | DeFi 통합 | SwapExecutor, LendingExecutor, StakingExecutor, HealthFactorHook |
| `@stablenet/plugin-modules` | 모듈 관리 | Kernel 모듈 install/uninstall |

---

## 4. 주요 기능

### 4.1 Smart Account Client

```typescript
import { createSmartAccountClient } from '@stablenet/core'
import { createKernelAccount } from '@stablenet/accounts'

// Create account
const account = await createKernelAccount({
  publicClient,
  signer,
  entryPoint: ENTRY_POINT_V07_ADDRESS,
})

// Create client
const client = createSmartAccountClient({
  account,
  chain: sepolia,
  transport: http(),
  bundlerTransport: http('https://bundler.example.com'),
})

// Send transaction
const hash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
})
```

### 4.2 EIP-7702 Support

```typescript
import {
  createAuthorization,
  createSignedAuthorization,
  isDelegatedAccount,
  getDelegationStatus,
} from '@stablenet/core'

// Create authorization for EOA delegation
const auth = createAuthorization({
  chainId: 1n,
  address: kernelImplementation,
  nonce: 0n,
})

// Sign authorization
const signedAuth = await createSignedAuthorization(auth, signer)

// Check delegation status
const status = await getDelegationStatus(publicClient, eoaAddress)
```

### 4.3 Paymaster Integration

```typescript
import { createVerifyingPaymaster, createSponsorPaymaster } from '@stablenet/plugin-paymaster'

// Verifying Paymaster (local signer)
const paymaster = createVerifyingPaymaster({
  paymasterAddress: '0x...',
  signer: privateKeyToAccount('0x...'),
  chainId: 1n,
})

// Sponsor Paymaster (API-based)
const sponsorPaymaster = createSponsorPaymaster({
  paymasterUrl: 'https://paymaster.example.com',
  apiKey: 'your-api-key',
  chainId: 1n,
})

// Use with client
const client = createSmartAccountClient({
  account,
  paymaster,
  // ...
})
```

### 4.4 Stealth Address

```typescript
import {
  createStealthClient,
  generateStealthAddress,
  watchAnnouncementsWithKey,
} from '@stablenet/plugin-stealth'

// Generate stealth address
const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
  stealthMetaAddressUri: 'st:eth:0x...',
})

// Watch for payments
const unwatch = watchAnnouncementsWithKey({
  client,
  spendingPrivateKey: '0x...',
  viewingPrivateKey: '0x...',
  onAnnouncement: (announcement, stealthKey) => {
    console.log('Received at:', stealthKey.stealthAddress)
  },
})
```

### 4.5 DeFi Executors

```typescript
import {
  SwapExecutorAbi,
  encodeSwapExecutorInitData,
  calculateMinOutput,
} from '@stablenet/plugin-defi'

// Install SwapExecutor
const installData = encodeSwapExecutorInitData({
  maxSlippageBps: 100, // 1%
  dailyLimit: parseEther('10'),
})

// Execute swap via Smart Account
const swapCall = {
  target: swapExecutorAddress,
  value: 0n,
  callData: encodeFunctionData({
    abi: SwapExecutorAbi,
    functionName: 'executeSwap',
    args: [tokenIn, tokenOut, amountIn, minAmountOut],
  }),
}
```

### 4.6 Module Management

```typescript
import {
  buildInstallModuleCall,
  isModuleInstalled,
  MODULE_TYPES,
  encodeECDSAValidatorInitData,
} from '@stablenet/plugin-modules'

// Install module
const installCall = buildInstallModuleCall(smartAccountAddress, {
  moduleType: MODULE_TYPES.VALIDATOR,
  module: ecdsaValidatorAddress,
  initData: encodeECDSAValidatorInitData(ownerAddress),
})

// Check installation
const installed = await isModuleInstalled(publicClient, smartAccountAddress, {
  moduleType: MODULE_TYPES.VALIDATOR,
  module: ecdsaValidatorAddress,
})
```

---

## 5. 의존성

### 5.1 External Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `viem` | ^2.x | Ethereum 상호작용 |
| `abitype` | ^1.x | ABI 타입 생성 |
| `@noble/curves` | ^1.x | 암호화 연산 |
| `@noble/hashes` | ^1.x | 해시 함수 |

### 5.2 Internal Dependencies

```
@stablenet/types
    ↑
@stablenet/core ← @stablenet/accounts
    ↑
@stablenet/plugin-*
```

---

## 6. 관련 문서

- [01_CONTRACT_SDK_MAPPING.md](./01_CONTRACT_SDK_MAPPING.md) - Contract ↔ SDK 매핑
- [02_SDK_REMAINING_TASKS.md](./02_SDK_REMAINING_TASKS.md) - 남은 작업
- [../contracts/00_CONTRACTS_OVERVIEW.md](../contracts/00_CONTRACTS_OVERVIEW.md) - Contract 개요

---

*문서 끝*
