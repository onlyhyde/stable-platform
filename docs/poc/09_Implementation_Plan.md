# StableNet PoC 구현 플랜 (Contract 제외)

> **Version**: 1.0
> **Last Updated**: 2025-01-19
> **Status**: Draft

## 1. 개요

본 문서는 StableNet PoC의 구현 플랜을 정의합니다. Smart Contract는 별도 세션에서 작업 중이므로 제외하고, Backend Services, SDK, Frontend, Infrastructure 구현에 집중합니다.

### 1.1 참고 프로젝트

| 컴포넌트 | 참고 프로젝트 | 경로 |
|----------|-------------|------|
| Bundler | Alto Bundler | `../erc-4337/alto-bundler/` |
| SDK | ZeroDev SDK | `../erc-4337/sdk/` |
| Examples | ZeroDev Examples | `../erc-4337/zerodev-examples/` |
| L1 Chain | go-stablenet | `../L1/go-stablenet/` |
| Paymaster Proxy | ERC-7677 Proxy | `../paymaster/erc7677-proxy/` |
| Stealth | Stealth 7702 | `../stealth/stealth-7702/` |
| Stealth SDK | Stealth Address SDK | `../stealth/stealth-address-sdk/` |

### 1.2 참고 프로젝트 패턴 분석

#### Alto Bundler 패턴
- **아키텍처**: Monorepo (pnpm workspaces)
- **구조**: CLI + RPC Server + Mempool + Executor + Gas Management
- **기술 스택**: TypeScript, yargs CLI, viem, Fastify
- **특징**:
  - Multi-entry point 지원 (EP 0.6, 0.7, 0.8)
  - Reputation 시스템
  - 네트워크별 가스 관리

#### ZeroDev SDK 패턴
- **아키텍처**: Core + Plugin 생태계
- **구조**: Accounts + Clients + Actions + Plugins + Types
- **기술 스택**: TypeScript, bun, viem peer dependency
- **특징**:
  - 플러그인 기반 확장성
  - viem 클라이언트 확장
  - 다중 배포 포맷 (CJS/ESM/types)

#### ERC-7677 Proxy 패턴
- **아키텍처**: Stateless HTTP API Proxy
- **구조**: Hono app + Zod schemas + Middleware
- **기술 스택**: TypeScript, Hono, Zod, viem
- **특징**:
  - 경량 미들웨어 프록시
  - Validation-first 접근
  - Serverless 배포 지원

#### Stealth Address SDK 패턴
- **아키텍처**: Action 기반 유틸리티 라이브러리
- **구조**: Actions + StealthClient + Config + Helpers
- **기술 스택**: TypeScript, @noble/secp256k1, viem, graphql-request
- **특징**:
  - Action 기반 API 설계
  - Client Factory 패턴
  - GraphQL Subgraph 통합

---

## 2. 프로젝트 구조

```
stable-platform/
├── packages/
│   ├── sdk/                      # ZeroDev SDK 패턴 적용
│   │   ├── packages/
│   │   │   ├── core/             # 핵심 클라이언트
│   │   │   ├── accounts/         # Smart Account 구현
│   │   │   └── types/            # 공유 타입
│   │   └── plugins/
│   │       ├── ecdsa/            # ECDSA 검증
│   │       ├── session-keys/     # 세션 키
│   │       ├── paymaster/        # Paymaster 클라이언트
│   │       └── stealth/          # Stealth Address
│   │
│   └── stealth-sdk/              # Stealth SDK 패턴 적용
│       └── src/
│           ├── actions/          # Action 기반 API
│           ├── client/           # StealthClient
│           └── config/           # 네트워크 설정
│
├── apps/
│   ├── web/                      # 통합 Frontend (Next.js)
│   │   └── app/
│   │       ├── (auth)/           # 인증
│   │       ├── payment/          # 결제 기능
│   │       ├── defi/             # DeFi 기능
│   │       ├── enterprise/       # 기업용 기능
│   │       ├── stealth/          # 스텔스 전송
│   │       └── settings/         # 설정
│   │
│   └── wallet-extension/         # Chrome Extension (MetaMask 패턴)
│       ├── src/
│       │   ├── background/       # Service Worker
│       │   ├── contentscript/    # Content Scripts
│       │   ├── ui/               # Popup UI (React)
│       │   └── inpage/           # Injected Provider
│       └── manifest.json
│
├── services/
│   ├── bundler/                  # Alto 패턴 적용
│   │   └── src/
│   │       ├── cli/              # CLI 진입점
│   │       ├── rpc/              # JSON-RPC 핸들러
│   │       ├── mempool/          # UserOp 풀
│   │       ├── executor/         # 번들 실행
│   │       └── gas/              # 가스 관리
│   │
│   ├── paymaster-proxy/          # ERC-7677 Proxy 패턴 적용
│   │   └── src/
│   │       ├── app.ts            # Hono 앱
│   │       ├── routes/           # API 라우트
│   │       ├── schemas/          # Zod 스키마
│   │       └── middleware/       # 검증 미들웨어
│   │
│   ├── stealth-server/           # Rust + Actix
│   │   └── src/
│   │       ├── api/
│   │       ├── indexer/
│   │       └── db/
│   │
│   ├── order-router/             # DEX 라우팅
│   └── subscription-executor/    # 구독 실행기
│
├── simulators/                   # Go 시뮬레이터
│   ├── bank/
│   ├── pg/
│   └── onramp/
│
└── infra/
    ├── docker/
    └── k8s/
```

---

## 3. Phase별 구현 플랜

### 3.1 Phase 0: Foundation (Week 1-2)

#### 목표
개발 환경 구축 및 프로젝트 기반 설정

#### 작업 목록

| ID | 작업 | 참고 | 기술 스택 | 우선순위 |
|----|------|------|----------|---------|
| F-01 | Monorepo 설정 | alto-bundler | pnpm + Turborepo | P0 |
| F-02 | 공통 설정 (biome, tsconfig) | 전체 참고 프로젝트 | TypeScript | P0 |
| F-03 | Docker Compose 개발환경 | - | Docker | P0 |
| F-04 | CI/CD 파이프라인 | - | GitHub Actions | P1 |

#### 산출물
- Monorepo 구조 완성
- 공유 타입/설정 패키지
- 로컬 개발환경 Docker Compose
- CI/CD 기본 파이프라인

#### 상세 구현

**F-01: Monorepo 설정**
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'packages/sdk/packages/*'
  - 'packages/sdk/plugins/*'
  - 'apps/*'
  - 'services/*'
  - 'simulators/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**F-02: 공통 설정**
```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.5.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

---

### 3.2 Phase 1: SDK Core (Week 3-5)

#### 목표
StableNet SDK 핵심 패키지 구현

#### 작업 목록

| ID | 작업 | 참고 | 상세 |
|----|------|------|------|
| S-01 | `@stablenet/core` 패키지 | sdk/packages/core | viem 기반 클라이언트 |
| S-02 | `@stablenet/accounts` | sdk/packages/accounts | Kernel Smart Account |
| S-03 | `@stablenet/types` | sdk/packages/types | 공유 타입 정의 |
| S-04 | `@stablenet/plugin-ecdsa` | sdk/plugins/ecdsa | ECDSA 검증 플러그인 |
| S-05 | `@stablenet/plugin-paymaster` | sdk/plugins/paymaster | Paymaster 클라이언트 |

#### SDK Core 구조

```
packages/sdk/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client/
│   │   │   │   ├── createStableNetClient.ts
│   │   │   │   ├── createSmartAccountClient.ts
│   │   │   │   └── createBundlerClient.ts
│   │   │   ├── actions/
│   │   │   │   ├── sendUserOperation.ts
│   │   │   │   ├── estimateUserOperationGas.ts
│   │   │   │   └── getUserOperationReceipt.ts
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── accounts/
│   │   ├── src/
│   │   │   ├── kernel/
│   │   │   │   ├── createKernelAccount.ts
│   │   │   │   ├── encodeCallData.ts
│   │   │   │   └── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── types/
│       ├── src/
│       │   ├── userOperation.ts
│       │   ├── smartAccount.ts
│       │   ├── paymaster.ts
│       │   └── index.ts
│       └── package.json
│
└── plugins/
    ├── ecdsa/
    │   ├── src/
    │   │   ├── signerToEcdsaValidator.ts
    │   │   └── index.ts
    │   └── package.json
    │
    └── paymaster/
        ├── src/
        │   ├── createPaymasterClient.ts
        │   ├── sponsorUserOperation.ts
        │   └── index.ts
        └── package.json
```

#### 사용 예시

```typescript
// SDK 사용 예시
import { createStableNetClient, createSmartAccountClient } from '@stablenet/core'
import { createKernelAccount } from '@stablenet/accounts'
import { signerToEcdsaValidator } from '@stablenet/plugin-ecdsa'
import { createPaymasterClient } from '@stablenet/plugin-paymaster'
import { privateKeyToAccount } from 'viem/accounts'
import { http } from 'viem'

// 1. Signer 생성
const signer = privateKeyToAccount('0x...')

// 2. Validator 생성
const ecdsaValidator = await signerToEcdsaValidator({
  signer,
  entryPoint: ENTRY_POINT_ADDRESS,
})

// 3. Smart Account 생성
const account = await createKernelAccount({
  validator: ecdsaValidator,
  entryPoint: ENTRY_POINT_ADDRESS,
})

// 4. Client 생성
const client = createSmartAccountClient({
  account,
  chain: stablenetDevnet,
  transport: http(BUNDLER_URL),
  paymaster: createPaymasterClient({
    transport: http(PAYMASTER_URL),
  }),
})

// 5. UserOperation 전송
const hash = await client.sendUserOperation({
  calls: [
    {
      to: '0x...',
      value: parseEther('1'),
      data: '0x',
    },
  ],
})
```

---

### 3.3 Phase 2: Bundler Service (Week 4-6)

#### 목표
ERC-4337 Bundler 서비스 구현 (Alto 패턴 적용)

#### 작업 목록

| ID | 작업 | 참고 | 상세 |
|----|------|------|------|
| B-01 | CLI 구조 | alto/src/cli | yargs 기반 CLI |
| B-02 | RPC 서버 | alto/src/rpc | Fastify JSON-RPC |
| B-03 | Mempool 관리 | alto/src/mempool | UserOp 풀 |
| B-04 | 번들 실행기 | alto/src/executor | 트랜잭션 제출 |
| B-05 | 가스 추정 | alto/src/gas | 네트워크별 가스 관리 |

#### Bundler 구조

```
services/bundler/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI 진입점
│   │   ├── config.ts             # CLI 설정 파싱
│   │   └── commands/
│   │       └── run.ts            # run 커맨드
│   │
│   ├── rpc/
│   │   ├── server.ts             # Fastify 서버
│   │   ├── handlers/
│   │   │   ├── eth_sendUserOperation.ts
│   │   │   ├── eth_estimateUserOperationGas.ts
│   │   │   ├── eth_getUserOperationByHash.ts
│   │   │   ├── eth_getUserOperationReceipt.ts
│   │   │   └── eth_supportedEntryPoints.ts
│   │   └── validation/
│   │       └── userOpValidator.ts
│   │
│   ├── mempool/
│   │   ├── mempool.ts            # UserOp 메모리풀
│   │   ├── reputationManager.ts  # Sender reputation
│   │   └── types.ts
│   │
│   ├── executor/
│   │   ├── bundleExecutor.ts     # 번들 실행
│   │   ├── transactionManager.ts # TX 관리
│   │   └── nonceManager.ts       # Nonce 관리
│   │
│   ├── gas/
│   │   ├── gasEstimator.ts       # 가스 추정
│   │   └── gasPriceManager.ts    # 가스 가격 관리
│   │
│   ├── simulation/
│   │   └── simulator.ts          # UserOp 시뮬레이션
│   │
│   └── utils/
│       ├── logger.ts
│       └── metrics.ts
│
├── package.json
├── tsconfig.json
└── Dockerfile
```

#### RPC API

```typescript
// JSON-RPC 2.0 Methods
const rpcMethods = {
  // ERC-4337 표준 메서드
  eth_sendUserOperation: 'UserOperation 제출',
  eth_estimateUserOperationGas: '가스 추정',
  eth_getUserOperationByHash: 'UserOp 조회 (hash)',
  eth_getUserOperationReceipt: 'UserOp 영수증',
  eth_supportedEntryPoints: '지원 EntryPoint 목록',

  // 확장 메서드
  debug_bundler_clearState: '상태 초기화 (debug)',
  debug_bundler_dumpMempool: '메모리풀 덤프 (debug)',
}
```

#### CLI 사용법

```bash
# 기본 실행
pnpm bundler run \
  --network devnet \
  --port 4337 \
  --entry-point 0x0000000071727De22E5E9d8BAf0edAc6f37da032

# 전체 옵션
pnpm bundler run \
  --network devnet \
  --port 4337 \
  --entry-point 0x... \
  --beneficiary 0x... \
  --min-balance 0.1 \
  --bundle-interval 1000 \
  --max-bundle-size 10 \
  --log-level debug
```

---

### 3.4 Phase 3: Paymaster Proxy (Week 5-6)

#### 목표
ERC-7677 Paymaster Proxy 서비스 구현

#### 작업 목록

| ID | 작업 | 참고 | 상세 |
|----|------|------|------|
| P-01 | Hono 앱 구조 | erc7677-proxy | Hono + Zod |
| P-02 | 스폰서 정책 | erc7677-proxy/src | 화이트리스트, 한도 |
| P-03 | pm_getPaymasterStubData | ERC-7677 | 스텁 데이터 반환 |
| P-04 | pm_getPaymasterData | ERC-7677 | 실제 서명 데이터 |

#### Paymaster Proxy 구조

```
services/paymaster-proxy/
├── src/
│   ├── app.ts                    # Hono 앱 메인
│   ├── routes/
│   │   ├── paymaster.ts          # Paymaster 라우트
│   │   └── health.ts             # Health check
│   │
│   ├── handlers/
│   │   ├── getPaymasterStubData.ts
│   │   └── getPaymasterData.ts
│   │
│   ├── schemas/
│   │   ├── userOperation.ts      # UserOp 스키마
│   │   ├── request.ts            # 요청 스키마
│   │   └── response.ts           # 응답 스키마
│   │
│   ├── middleware/
│   │   ├── validator.ts          # Zod 검증
│   │   ├── rateLimiter.ts        # Rate limiting
│   │   └── logger.ts             # 로깅
│   │
│   ├── policy/
│   │   ├── sponsorPolicy.ts      # 스폰서 정책
│   │   └── whitelist.ts          # 화이트리스트
│   │
│   ├── config/
│   │   ├── env.ts                # 환경 변수
│   │   └── chains.ts             # 체인 설정
│   │
│   └── utils/
│       └── signer.ts             # 서명 유틸
│
├── package.json
├── tsconfig.json
└── Dockerfile
```

#### API 스펙

```typescript
// POST /v1/:chainId
// Content-Type: application/json

// Request
interface PaymasterRequest {
  jsonrpc: '2.0'
  id: number
  method: 'pm_getPaymasterStubData' | 'pm_getPaymasterData'
  params: [
    UserOperation,      // UserOperation
    Address,            // EntryPoint address
    Hex,                // Chain ID (hex)
    Record<string, any> // Context (optional)
  ]
}

// Response - pm_getPaymasterStubData
interface PaymasterStubDataResponse {
  paymasterAndData: Hex
  // 또는 ERC-4337 v0.7+
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: Hex
  paymasterPostOpGasLimit: Hex
}

// Response - pm_getPaymasterData
interface PaymasterDataResponse {
  paymasterAndData: Hex
  // 또는 ERC-4337 v0.7+
  paymaster: Address
  paymasterData: Hex
}
```

---

### 3.5 Phase 4: Stealth Address (Week 7-9)

#### 목표
Stealth Address SDK 및 Server 구현

#### 작업 목록

| ID | 작업 | 참고 | 상세 |
|----|------|------|------|
| ST-01 | `@stablenet/stealth-sdk` | stealth-address-sdk | Action 기반 SDK |
| ST-02 | Stealth Server (Rust) | stealth-7702 | 이벤트 인덱싱 |
| ST-03 | SDK 플러그인 통합 | - | core SDK 연동 |

#### Stealth SDK 구조

```
packages/stealth-sdk/
├── src/
│   ├── client/
│   │   └── createStealthClient.ts
│   │
│   ├── actions/
│   │   ├── generateStealthAddress.ts
│   │   ├── computeStealthKey.ts
│   │   ├── registerStealthMetaAddress.ts
│   │   ├── checkAnnouncement.ts
│   │   ├── fetchAnnouncements.ts
│   │   └── watchAnnouncements.ts
│   │
│   ├── crypto/
│   │   ├── stealth.ts            # 스텔스 암호화
│   │   └── viewTag.ts            # ViewTag 계산
│   │
│   ├── config/
│   │   └── networks.ts           # 네트워크 설정
│   │
│   ├── constants/
│   │   ├── contracts.ts          # 컨트랙트 주소
│   │   └── schemes.ts            # Scheme IDs
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── index.ts
│
├── package.json
└── tsconfig.json
```

#### Stealth SDK 사용 예시

```typescript
import {
  createStealthClient,
  generateStealthAddress,
  computeStealthKey,
  watchAnnouncements,
} from '@stablenet/stealth-sdk'

// 1. Client 생성
const stealthClient = createStealthClient({
  chain: stablenetDevnet,
  transport: http(),
})

// 2. 스텔스 메타 주소 등록
await stealthClient.registerStealthMetaAddress({
  stealthMetaAddress: '0x...',
})

// 3. 스텔스 주소 생성 (송금자)
const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
  stealthMetaAddressUri: 'st:eth:0x...',
  schemeId: SCHEME_ID_SECP256K1,
})

// 4. 수신자: Announcement 모니터링
const unwatch = watchAnnouncements({
  client: stealthClient,
  spendingPubKey,
  viewingPrivateKey,
  onAnnouncement: async (announcement) => {
    const stealthKey = computeStealthKey({
      announcement,
      spendingPrivateKey,
      viewingPrivateKey,
    })
    console.log('Received stealth transfer:', stealthKey)
  },
})
```

#### Stealth Server 구조 (Rust)

```
services/stealth-server/
├── src/
│   ├── main.rs
│   │
│   ├── api/
│   │   ├── mod.rs
│   │   ├── register.rs           # POST /register
│   │   ├── announcements.rs      # GET /announcements
│   │   ├── scan.rs               # GET /scan/:viewingKey
│   │   └── health.rs             # GET /health
│   │
│   ├── indexer/
│   │   ├── mod.rs
│   │   ├── event_listener.rs     # 블록체인 이벤트 리스너
│   │   └── processor.rs          # 이벤트 처리
│   │
│   ├── db/
│   │   ├── mod.rs
│   │   ├── postgres.rs           # PostgreSQL 연동
│   │   └── models.rs             # DB 모델
│   │
│   ├── crypto/
│   │   ├── mod.rs
│   │   └── view_tag.rs           # ViewTag 필터링
│   │
│   └── config/
│       └── mod.rs
│
├── Cargo.toml
├── Dockerfile
└── migrations/
    └── 001_initial.sql
```

#### Stealth Server API

```yaml
# POST /register - 스텔스 메타 주소 등록
Request:
  stealthMetaAddress: string
  signature: string
Response:
  success: boolean
  registeredAt: timestamp

# GET /announcements - Announcement 목록 조회
Query:
  fromBlock?: number
  toBlock?: number
  limit?: number
Response:
  announcements: Announcement[]

# GET /scan/:viewingKey - ViewTag 기반 스캔
Params:
  viewingKey: string (hex)
Query:
  fromBlock?: number
Response:
  matches: Announcement[]

# WebSocket /watch - 실시간 모니터링
Message:
  type: 'subscribe' | 'unsubscribe'
  viewTag?: string
Event:
  type: 'announcement'
  data: Announcement
```

---

### 3.6 Phase 5: Wallet Extension (Week 8-11)

#### 목표
Chrome Extension 지갑 구현 (MetaMask 패턴 참고)

#### 작업 목록

| ID | 작업 | 참고 | 상세 |
|----|------|------|------|
| W-01 | Manifest V3 구조 | MetaMask | Chrome Extension |
| W-02 | Background Service Worker | MetaMask | 상태 관리, RPC |
| W-03 | Popup UI | - | React + SDK 연동 |
| W-04 | Content Script | MetaMask | dApp 연결 |
| W-05 | Inpage Provider | MetaMask | window.stablenet |

#### Wallet Extension 구조

```
apps/wallet-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── index.ts              # Service Worker 진입점
│   │   ├── controller/
│   │   │   ├── accountController.ts
│   │   │   ├── transactionController.ts
│   │   │   └── networkController.ts
│   │   ├── rpc/
│   │   │   ├── handler.ts        # dApp RPC 처리
│   │   │   └── methods.ts        # RPC 메서드 구현
│   │   ├── keyring/
│   │   │   ├── keyringController.ts
│   │   │   └── hdKeyring.ts
│   │   └── state/
│   │       └── store.ts          # 상태 저장소
│   │
│   ├── contentscript/
│   │   ├── index.ts              # Content Script 진입점
│   │   └── inject.ts             # Provider 주입
│   │
│   ├── inpage/
│   │   ├── provider.ts           # StableNet Provider
│   │   └── stream.ts             # 메시지 스트림
│   │
│   └── ui/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Home/
│       │   │   └── index.tsx
│       │   ├── Send/
│       │   │   └── index.tsx
│       │   ├── Receive/
│       │   │   └── index.tsx
│       │   ├── Activity/
│       │   │   └── index.tsx
│       │   ├── Settings/
│       │   │   └── index.tsx
│       │   └── Connect/
│       │       └── index.tsx     # dApp 연결 승인
│       ├── components/
│       │   ├── AccountSelector/
│       │   ├── NetworkSelector/
│       │   ├── TokenList/
│       │   └── TransactionItem/
│       ├── hooks/
│       │   ├── useAccount.ts
│       │   ├── useBalance.ts
│       │   └── useNetwork.ts
│       └── styles/
│
├── public/
│   └── icons/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

#### Manifest V3

```json
{
  "manifest_version": 3,
  "name": "StableNet Wallet",
  "version": "1.0.0",
  "description": "StableNet Smart Account Wallet",

  "permissions": [
    "storage",
    "activeTab",
    "notifications"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["contentscript.js"],
      "run_at": "document_start"
    }
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "web_accessible_resources": [
    {
      "resources": ["inpage.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

#### Provider API

```typescript
// window.stablenet (EIP-1193 호환)
interface StableNetProvider {
  // 기본 메서드
  request(args: RequestArguments): Promise<unknown>
  on(event: string, listener: (...args: any[]) => void): void
  removeListener(event: string, listener: (...args: any[]) => void): void

  // 속성
  isStableNet: boolean
  chainId: string | null
  selectedAddress: string | null
}

interface RequestArguments {
  method: string
  params?: unknown[] | object
}

// 지원 메서드
const supportedMethods = [
  // 계정
  'eth_accounts',
  'eth_requestAccounts',

  // 체인
  'eth_chainId',
  'wallet_switchEthereumChain',

  // 트랜잭션 (ERC-4337)
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationByHash',
  'eth_getUserOperationReceipt',

  // 서명
  'personal_sign',
  'eth_signTypedData_v4',

  // 기타
  'eth_getBalance',
  'eth_call',
]
```

---

### 3.7 Phase 6: Web Frontend (Week 10-13)

#### 목표
통합 Frontend 애플리케이션 구현 (단일 Next.js 프로젝트)

#### 작업 목록

| ID | 작업 | 상세 |
|----|------|------|
| WEB-01 | Next.js 앱 구조 | App Router, 통합 레이아웃 |
| WEB-02 | /payment 페이지 | 송금, QR, 내역 |
| WEB-03 | /defi 페이지 | Swap, 유동성 |
| WEB-04 | /stealth 페이지 | 스텔스 전송/수신 |
| WEB-05 | /enterprise 페이지 | 급여, 비용관리 |
| WEB-06 | SDK 연동 | @stablenet/core 사용 |

#### Web Frontend 구조

```
apps/web/
├── app/
│   ├── layout.tsx                # Root 레이아웃
│   ├── page.tsx                  # 홈 (대시보드)
│   ├── globals.css
│   │
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── connect/
│   │       └── page.tsx          # 지갑 연결
│   │
│   ├── payment/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 결제 메인
│   │   ├── send/
│   │   │   └── page.tsx          # 송금
│   │   ├── receive/
│   │   │   └── page.tsx          # 수신 (QR)
│   │   └── history/
│   │       └── page.tsx          # 거래 내역
│   │
│   ├── defi/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # DeFi 메인
│   │   ├── swap/
│   │   │   └── page.tsx          # 토큰 스왑
│   │   └── pool/
│   │       └── page.tsx          # 유동성 풀
│   │
│   ├── stealth/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 스텔스 메인
│   │   ├── send/
│   │   │   └── page.tsx          # 스텔스 송금
│   │   └── receive/
│   │       └── page.tsx          # 스텔스 수신
│   │
│   ├── enterprise/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 기업용 메인
│   │   ├── payroll/
│   │   │   └── page.tsx          # 급여 관리
│   │   ├── expenses/
│   │   │   └── page.tsx          # 비용 관리
│   │   └── audit/
│   │       └── page.tsx          # 감사 로그
│   │
│   └── settings/
│       └── page.tsx              # 설정
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   │
│   ├── wallet/
│   │   ├── ConnectButton.tsx
│   │   ├── AccountInfo.tsx
│   │   └── NetworkSwitch.tsx
│   │
│   ├── transaction/
│   │   ├── SendForm.tsx
│   │   ├── TransactionList.tsx
│   │   └── TransactionDetail.tsx
│   │
│   ├── defi/
│   │   ├── SwapCard.tsx
│   │   ├── PoolCard.tsx
│   │   └── TokenSelector.tsx
│   │
│   ├── stealth/
│   │   ├── StealthAddressDisplay.tsx
│   │   ├── StealthSendForm.tsx
│   │   └── AnnouncementList.tsx
│   │
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Card.tsx
│       └── QRCode.tsx
│
├── hooks/
│   ├── useStableNet.ts           # SDK 클라이언트
│   ├── useWallet.ts              # 지갑 연결
│   ├── useAccount.ts             # 계정 정보
│   ├── useBalance.ts             # 잔액 조회
│   ├── useUserOp.ts              # UserOp 전송
│   ├── useStealth.ts             # 스텔스 기능
│   └── useSwap.ts                # 스왑 기능
│
├── lib/
│   ├── stablenet.ts              # SDK 인스턴스
│   ├── wagmi.ts                  # wagmi 설정
│   └── utils.ts                  # 유틸리티
│
├── providers/
│   ├── WalletProvider.tsx
│   └── StableNetProvider.tsx
│
├── types/
│   └── index.ts
│
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

#### 페이지별 기능

```yaml
# / (홈/대시보드)
- 계정 잔액 표시
- 최근 거래 내역
- 빠른 액션 버튼

# /payment
- /payment/send: 일반 송금 (EOA, Smart Account)
- /payment/receive: QR 코드 생성, 주소 복사
- /payment/history: 거래 내역 필터링/검색

# /defi
- /defi/swap: 토큰 스왑 (Uniswap V3)
- /defi/pool: 유동성 공급/제거

# /stealth
- /stealth/send: 스텔스 주소로 송금
- /stealth/receive: 스텔스 메타 주소 등록, Announcement 스캔

# /enterprise
- /enterprise/payroll: 다중 수신자 급여 지급
- /enterprise/expenses: 비용 승인 워크플로우
- /enterprise/audit: 감사 로그 조회

# /settings
- 네트워크 설정
- 계정 관리
- 보안 설정
```

---

### 3.8 Phase 7: 추가 서비스 (Week 12-16)

#### 목표
DEX 라우터, 구독 실행기, 시뮬레이터 구현

#### 작업 목록

| ID | 작업 | 기술 스택 | 상세 |
|----|------|----------|------|
| SV-01 | Order Router | TypeScript + Fastify | DEX 경로 최적화 |
| SV-02 | Subscription Executor | TypeScript + Bull | 정기 결제 스케줄러 |
| SV-03 | Bank Simulator | Go + Gin | 은행 API 목업 |
| SV-04 | PG Simulator | Go + Gin | PG API 목업 |
| SV-05 | On-Ramp Simulator | Go + Gin | 온램프 API 목업 |

#### Order Router 구조

```
services/order-router/
├── src/
│   ├── api/
│   │   ├── quote.ts              # GET /quote
│   │   └── swap.ts               # POST /swap
│   │
│   ├── routing/
│   │   ├── pathFinder.ts         # 최적 경로 탐색
│   │   ├── priceCalculator.ts    # 가격 계산
│   │   └── slippage.ts           # 슬리피지 처리
│   │
│   ├── providers/
│   │   ├── uniswapV3.ts          # Uniswap V3
│   │   └── types.ts
│   │
│   └── cache/
│       └── priceCache.ts         # 가격 캐시
│
└── package.json
```

#### Subscription Executor 구조

```
services/subscription-executor/
├── src/
│   ├── api/
│   │   ├── subscription.ts       # 구독 CRUD
│   │   └── webhook.ts            # 상태 웹훅
│   │
│   ├── scheduler/
│   │   ├── cronManager.ts        # 크론 스케줄러
│   │   └── jobProcessor.ts       # 작업 처리
│   │
│   ├── executor/
│   │   └── paymentExecutor.ts    # 결제 실행
│   │
│   ├── queue/
│   │   └── bullQueue.ts          # Bull 큐
│   │
│   └── db/
│       └── subscription.ts       # 구독 데이터
│
└── package.json
```

---

## 4. 의존성 그래프

```
Phase 0 (Foundation)
    │
    ▼
Phase 1 (SDK Core) ─────────────────────────┐
    │                                       │
    ├──► Phase 2 (Bundler)                  │
    │        │                              │
    │        └──► Phase 3 (Paymaster) ◄─────┤
    │                                       │
    └──► Phase 4 (Stealth SDK) ◄────────────┤
             │                              │
             ▼                              │
    Phase 5 (Wallet Extension) ◄────────────┘
             │
             ▼
    Phase 6 (Web Frontend)
             │
             ▼
    Phase 7 (추가 서비스)
```

---

## 5. 기술 스택 요약

| 카테고리 | 기술 |
|----------|------|
| **Language** | TypeScript (주), Rust (Stealth Server), Go (Simulators) |
| **Build** | pnpm, Turborepo, Vite, tsup |
| **Linting** | Biome |
| **Backend Framework** | Fastify, Hono, Actix (Rust), Gin (Go) |
| **Frontend Framework** | Next.js 14, React 18 |
| **Blockchain** | viem, wagmi |
| **Queue** | Bull (Redis) |
| **Database** | PostgreSQL, Redis |
| **Testing** | Vitest, Playwright |
| **Container** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 6. 작업 요약

| Phase | 기간 | 주요 산출물 | 의존성 |
|-------|------|------------|--------|
| **0. Foundation** | Week 1-2 | Monorepo, 개발환경, CI/CD | - |
| **1. SDK Core** | Week 3-5 | @stablenet/core, accounts, plugins | Phase 0 |
| **2. Bundler** | Week 4-6 | bundler 서비스 | Phase 1 |
| **3. Paymaster** | Week 5-6 | paymaster-proxy 서비스 | Phase 1, 2 |
| **4. Stealth** | Week 7-9 | stealth-sdk, stealth-server | Phase 1 |
| **5. Wallet** | Week 8-11 | Chrome Extension | Phase 1-4 |
| **6. Web** | Week 10-13 | 통합 Frontend | Phase 1-5 |
| **7. Services** | Week 12-16 | Router, Executor, Simulators | Phase 1-3 |

---

## 7. 즉시 시작 가능한 작업

### 병렬 진행 가능
1. **F-01~F-04**: Monorepo 설정, Docker, CI/CD
2. **S-01~S-03**: SDK 기본 구조 (core, types)
3. **B-01**: Bundler CLI 구조 (Alto 참고)

### 권장 시작 순서
1. Monorepo 설정 완료
2. SDK core 패키지 스캐폴딩
3. Bundler 서비스 스캐폴딩
4. 병렬로 개발 진행

---

## Appendix A: 참고 자료

### 표준 문서
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) - Account Abstraction
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) - Minimal Modular Smart Accounts
- [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677) - Paymaster Web Service Capability
- [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) - Stealth Addresses
- [EIP-6538](https://eips.ethereum.org/EIPS/eip-6538) - Stealth Meta-Address Registry

### 참고 구현
- Alto Bundler: https://github.com/pimlicolabs/alto
- ZeroDev SDK: https://github.com/zerodevapp/sdk
- MetaMask Extension: https://github.com/MetaMask/metamask-extension
- Umbra Protocol: https://github.com/ScopeLift/umbra-protocol
