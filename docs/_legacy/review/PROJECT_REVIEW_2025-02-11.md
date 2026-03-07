# StableNet Platform - 프로젝트 전체 리뷰

> **작성일**: 2025-02-11
> **최종 수정일**: 2025-02-13
> **대상**: stable-platform 모노레포 전체
> **버전**: 0.1.7

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [레포지토리 구조](#2-레포지토리-구조)
3. [루트 설정 파일](#3-루트-설정-파일)
4. [Apps](#4-apps)
5. [Packages](#5-packages)
6. [Services](#6-services)
7. [Infrastructure](#7-infrastructure)
8. [CI/CD](#8-cicd)
9. [모니터링](#9-모니터링)
10. [문서화](#10-문서화)
11. [테스트 인프라](#11-테스트-인프라)
12. [기술 스택 요약](#12-기술-스택-요약)
13. [아키텍처 토폴로지](#13-아키텍처-토폴로지)
14. [주요 기술적 특징](#14-주요-기술적-특징)
15. [보안 아키텍처](#15-보안-아키텍처)
16. [변경 이력](#16-변경-이력)

---

## 1. 프로젝트 개요

StableNet Platform은 **ERC-4337 Account Abstraction** 기반의 스마트 지갑 플랫폼 PoC이다. 스마트 계정 생성/관리, 트랜잭션 처리, DeFi 통합, 프라이버시 전송, 구독 결제, 크로스체인 브릿지 등 포괄적인 블록체인 금융 인프라를 구현한다.

| 항목 | 값 |
|------|-----|
| 구조 | pnpm workspaces + Turborepo 모노레포 |
| 언어 | TypeScript, Go, Rust |
| 라이선스 | MIT |
| Node.js | >= 20.0.0 |
| pnpm | 10.28.2 |
| 핵심 표준 | ERC-4337, EIP-7702, ERC-7579, EIP-5564, ERC-7677 |

---

## 2. 레포지토리 구조

```
stable-platform/
├── apps/                          # 애플리케이션
│   ├── wallet-extension/          # Chrome 확장 프로그램 (React + Vite)
│   └── web/                       # 웹 대시보드 (Next.js 15)
├── packages/                      # 공유 패키지 (16개)
│   ├── types/                     # 공통 타입 정의
│   ├── config/                    # 플랫폼 설정
│   ├── contracts/                 # 컨트랙트 주소 관리
│   ├── wallet-sdk/                # dApp 통합 SDK
│   ├── registry-client/           # 레지스트리 클라이언트
│   ├── sdk-ts/                    # TypeScript SDK
│   │   ├── types/                 # SDK 타입
│   │   ├── crypto/                # 암호화 추상 레이어
│   │   ├── addresses/             # 주소 유틸리티
│   │   ├── core/                  # 핵심 클라이언트
│   │   ├── accounts/              # Kernel 스마트 계정
│   │   └── plugins/               # 7개 플러그인
│   └── sdk-go/                    # Go SDK
├── services/                      # 마이크로서비스 (11개)
│   ├── bundler/                   # ERC-4337 번들러 (TS/Fastify)
│   ├── paymaster-proxy/           # 가스 스폰서십 (TS/Hono)
│   ├── contract-registry/         # 컨트랙트 레지스트리 (TS/Fastify)
│   ├── module-registry/           # 모듈 마켓플레이스 (TS/Fastify)
│   ├── stealth-server/            # 스텔스 주소 서버 (Rust/Actix)
│   ├── order-router/              # DEX 라우터 (Go/Gin)
│   ├── subscription-executor/     # 구독 실행기 (Go/Gin)
│   ├── bridge-relayer/            # 크로스체인 릴레이어 (Go/Gin)
│   └── simulators/                # 시뮬레이터 3종 (Go/Gin)
│       ├── bank/
│       ├── pg/
│       └── onramp/
├── infra/                         # 인프라 설정
│   ├── docker/                    # Dockerfile, init-db.sql
│   ├── alertmanager/              # 알림 설정
│   └── grafana/                   # 대시보드, Prometheus 설정
├── monitoring/                    # Prometheus 스크랩 설정
├── docs/                          # 문서 (109개 파일, 27개 디렉토리)
├── tests/                         # 통합/E2E 테스트 (11개 파일)
├── scripts/                       # 유틸리티 스크립트
└── .github/                       # CI/CD 워크플로우
```

---

## 3. 루트 설정 파일

### package.json

- **타입**: ESM 모듈
- **주요 스크립트**:
  - `build` / `dev`: Turbo 기반 빌드/개발
  - `lint` / `lint:fix`: Biome 린팅
  - `test` / `test:watch` / `test:integration` / `test:e2e`: 테스트 분류
  - `typecheck`: TypeScript 검증
  - `clean`: 빌드 아티팩트 삭제
- **DevDeps**: Biome, Turbo, TypeScript 5.7, Vitest, Viem
- **pnpm overrides**: esbuild >= 0.25.0

### turbo.json

- **동시 실행**: 30개 병렬 태스크
- **글로벌 환경변수**: `NODE_ENV`, `STABLENET_RPC_URL`, `BUNDLER_URL`, `PAYMASTER_URL`
- **태스크 정의**:
  - `build`: `dist/**`, `.next/**`, `build/**` 출력, 캐시 활성화
  - `dev`: 캐시 미사용, persistent 모드
  - `test`: build 의존, `coverage/**` 출력
  - `lint` / `typecheck`: `^build` 의존

### tsconfig.json

- **Target**: ES2022
- **Module**: ESNext (bundler resolution)
- **Strict Mode**: 활성화
- **noUncheckedIndexedAccess**: true
- **isolatedModules**: true
- **verbatimModuleSyntax**: true

### biome.json

- **포매터**: 2-space indent, 100자 라인, single quotes, ES5 trailing comma
- **린터**: noUnusedImports/Variables (error), useImportType (error), noExplicitAny (warn), noConsoleLog (warn)
- **자동 import 정리**: 활성화

### pnpm-workspace.yaml

```yaml
packages:
  - packages/sdk-ts/types
  - packages/sdk-ts/addresses
  - packages/sdk-ts/crypto
  - packages/sdk-ts/core
  - packages/sdk-ts/accounts
  - packages/sdk-ts/plugins/*
  - packages/types
  - packages/config
  - packages/contracts
  - packages/registry-client
  - packages/wallet-sdk
  - apps/*
  - services/*
```

### vitest.config.ts (루트)

- **환경**: Node
- **패턴**: `tests/**/*.test.ts`
- **타임아웃**: 테스트 60초, 훅 30초
- **경로 별칭**: `@stablenet/core`, `@stablenet/accounts`, `@stablenet/types`, 각종 플러그인

### Docker Compose

| 파일 | 용도 |
|------|------|
| `docker-compose.yml` | 프로덕션 구성 (13개 서비스) |
| `docker-compose.yaml` | 동일 구성 (중복) |
| `docker-compose.dev.yml` | 개발 모드 (Anvil 추가, 소스 마운트, 디버그 로깅) |

### Makefile (38개 타겟)

| 카테고리 | 주요 명령 |
|----------|-----------|
| 개발 | `install`, `build`, `test`, `lint`, `clean`, `typecheck` |
| Docker | `docker-up`, `docker-dev`, `docker-down`, `docker-logs` |
| 로컬 | `anvil`, `deploy`, `deploy-full`, `fund-paymaster`, `dev-setup` |
| 테스트 | `test-unit`, `test-int`, `test-e2e`, `test-all` |

### 기타

| 파일 | 내용 |
|------|------|
| `.npmrc` | `engine-strict=true`, `auto-install-peers=true` |
| `.gitmodules` | Foundry 의존성 3개 (account-abstraction, solady, openzeppelin-contracts) |
| `.gitignore` | node_modules, dist, .env, .turbo, Go/Rust 빌드 아티팩트 |
| `SECURITY.md` | 보안 정책 템플릿 (미완성) |

---

## 4. Apps

### 4.1 Wallet Extension (`apps/wallet-extension`)

**Chrome Extension (Manifest V3) - StableNet 스마트 계정 지갑**

| 항목 | 값 |
|------|-----|
| 버전 | 0.1.7 |
| 프레임워크 | React 19 + Vite + @crxjs/vite-plugin |
| 상태관리 | Zustand 5.0.2 |
| 스타일 | Tailwind CSS 3.4.17 |
| 테스트 | Jest 29 (46 suites, 1072 tests) + Playwright 1.58 (5 E2E specs) |
| 소스 파일 | 170개 TS/TSX |

#### 아키텍처

```
wallet-extension/src/
├── background/              # Service Worker
│   ├── index.ts             # 메인 진입점
│   ├── controllers/         # 트랜잭션, 승인, 권한, 토큰, 모듈 컨트롤러
│   ├── keyring/             # 키 관리 (vault, HD, hardware, session)
│   ├── rpc/                 # JSON-RPC 핸들러 (handler, utils, paymaster, validation)
│   ├── services/            # IndexerClient, transactionWatcher
│   ├── security/            # 시뮬레이션, 피싱가드, callData 디코더
│   └── state/               # 스토어, 마이그레이션
├── ui/                      # 팝업 + 사이드패널 UI
│   ├── pages/               # Home, Activity, Send, Receive, Settings, Lock, Swap, Buy, Dashboard
│   │   └── Modules/         # ModuleList, SwapExecutor, SpendingLimit, MultiSig, Staking, WebAuthn, Delegate
│   ├── components/          # Button, Card, Modal, Badge, Toggle, Toast, TokenList 등
│   └── hooks/               # UI 전용 훅
├── approval/                # 트랜잭션 승인 모달 (별도 진입점)
├── contentscript/           # 웹페이지 주입 스크립트
├── inpage/                  # window.stablenet 프로바이더
├── shared/                  # API, 상수, 에러, 보안, 유효성검사
├── types/                   # account, approval, asset, bank, eip7702, keyring, network, onramp, rpc, transaction
├── i18n/                    # 국제화
└── config/                  # 설정 상수
```

#### 주요 기능

- **3개 UI 진입점**: Popup (빠른 액션), Sidepanel (확장 인터페이스), Approval (트랜잭션 승인)
- **키 관리**: HD Keyring, Simple Keyring, Hardware Keyring, Session Crypto (패스워드 검증 필수)
- **트랜잭션**: MultiModeTransactionController (EOA, EIP-7702, Smart Account)
- **ERC-7579 모듈**: 6종 모듈 설정 UI (SwapExecutor, SpendingLimit, MultiSig, Staking, WebAuthn, Delegate)
- **보안**: 트랜잭션 시뮬레이션, 피싱 탐지, 오리진 검증
- **국제화**: i18next + react-i18next
- **키보드 단축키**: Alt+S (사이드패널 열기)

#### Manifest V3 권한

```
storage, activeTab, notifications, idle, alarms, tabs, sidePanel, contextMenus
host_permissions: <all_urls>
```

#### Jest 테스트 설정 (3-project)

| 프로젝트 | 환경 | 용도 |
|----------|------|------|
| `unit-security` | node | 실제 @stablenet/core 빌드 사용 |
| `jsdom` | jsdom | UI 컴포넌트, inpage 스크립트 |
| `unit` | node | 일반 노드 테스트, 모킹 |

#### E2E (Playwright)

- 순차 실행 (single worker, Chrome 확장 제약)
- 60초 타임아웃
- 스크린샷(실패시), 비디오(재시도시)
- 테스트: onboarding, transactions, network, smart-account-send, install-module

---

### 4.2 Web Application (`apps/web`)

**Next.js 웹 대시보드 - 스마트 계정 관리 및 DeFi 플랫폼**

| 항목 | 값 |
|------|-----|
| 버전 | 0.1.0 |
| 프레임워크 | Next.js 15.5.12 + React 19 (App Router) |
| 상태관리 | TanStack Query 5.62 + React Context |
| Web3 | wagmi 2.14 + viem 2.21 |
| 스타일 | Tailwind CSS 3.4.17 |
| 테스트 | Vitest 4.0 (7 unit) |
| 소스 파일 | 216개 TS/TSX |

#### 라우트 구조

| 라우트 | 기능 | 핵심 훅 |
|--------|------|---------|
| `/` | 홈 대시보드 | - |
| `/payment/` | 송금, 수신, 거래내역 | `useWalletAssets`, `useUserOp` |
| `/defi/` | 토큰 스왑, 유동성 풀 | `useSwap`, `usePools`, `usePaymaster` |
| `/stealth/` | 프라이버시 전송 | `useStealth` |
| `/smart-account/` | 스마트 계정, 모듈 관리 | `useSmartAccount`, `useModule` |
| `/subscription/` | 구독 플랜, 머천트 | `useSubscription`, `useRecurringPayment` |
| `/session-keys/` | 세션 키 생성/관리 | `useSessionKey` |
| `/enterprise/` | 급여, 경비, 감사로그 | `usePayroll`, `useExpenses`, `useAuditLogs` |
| `/marketplace/` | ERC-7579 모듈 마켓 | - |
| `/settings/` | 사용자 설정 | - |
| `/docs/` | 동적 문서 페이지 | - |

#### 커스텀 훅 (26개)

```
useWallet, useBalance, useTokens, useWalletAssets, useWalletNetworks,
useChainInfo, useSmartAccount, useModule, useModuleInstall, usePaymaster,
useUserOp, useStealth, useSubscription, useRecurringPayment, useSessionKey,
useSwap, useStableNetWallet, usePayroll, useExpenses, useAuditLogs,
useTransactionHistory, usePools ...
```

#### 프로바이더 구조

```tsx
<ThemeProvider>
  <WalletProvider>
    <StableNetProvider>
      <QueryClientProvider>
        {children}
      </QueryClientProvider>
    </StableNetProvider>
  </WalletProvider>
</ThemeProvider>
```

---

## 5. Packages

### 5.1 플랫폼 공유 패키지

#### @stablenet/types (`packages/types`)

공통 타입 정의 패키지. UserOperation, SmartAccount, Network, Module, Transaction, Paymaster, RPC 관련 타입과 상수 제공.

**주요 export**:
- 타입: `UserOperation`, `SmartAccount`, `Call`, `ModuleType`, `TransactionMode`, `PaymasterData`
- 상수: `ENTRY_POINT_V07_ADDRESS`, `KERNEL_V3_1_FACTORY_ADDRESS`, `EXEC_MODE`, `CALL_TYPE`
- 타입 가드: `isValidator()`, `isExecutor()`, `isHook()`, `isEOAMode()`, `isEIP7702Mode()`, `isSmartAccountMode()`
- 의존성: `viem@^2.21.0`

#### @stablenet/config (`packages/config`)

플랫폼 전역 설정. EntryPoint 주소, 네트워크 정의, 체인 설정, 환경변수 오버라이드.

- 의존성: `@stablenet/types`, `viem`

#### @stablenet/contracts (`packages/contracts`)

컨트랙트 주소 관리 + 핫리로드.

**주요 export**:
- `getChainAddresses()`, `getEntryPoint()`, `getKernel()`, `getEcdsaValidator()`
- `getStealthRegistry()`, `getSubscriptionManager()`, `getDelegatePresets()`
- `ContractAddressWatcher` (chokidar 기반 파일 워칭)
- `CHAIN_ADDRESSES`, `DEFAULT_TOKENS`, `SERVICE_URLS`, `SUPPORTED_CHAIN_IDS`

#### @stablenet/wallet-sdk (`packages/wallet-sdk`)

dApp 통합 SDK. EIP-1193/6963 프로바이더, React 훅, 퍼미션 관리.

**주요 export**:
- 프로바이더: `StableNetProvider`, `detectProvider()`, `isWalletInstalled()`
- React 훅: `useWallet()`, `useBalance()`, `useNetwork()`, `useToken()`, `useChainId()`, `useContractRead()`, `useContractWrite()`
- 퍼미션: `PermissionManager`, `PermissionRequestBuilder` (EIP-2255)
- RPC: `STABLENET_RPC_METHODS` (EIP-4337, EIP-7702, ERC-7579 커스텀 메서드)
- 서브 export: `@stablenet/wallet-sdk/react`

#### @stablenet/registry-client (`packages/registry-client`)

컨트랙트 레지스트리 클라이언트. 이벤트 기반 업데이트.

- `RegistryClient` 클래스
- 타입: `ContractEntry`, `ResolvedAddressSet`, `ContractFilter`
- 의존성: `eventemitter3`

---

### 5.2 SDK-TS 패키지

#### @stablenet/sdk-types (`packages/sdk-ts/types`)

SDK 전용 타입. UserOperation, SmartAccount, Module, Network, Bundler, Paymaster 정의.

#### @stablenet/sdk-crypto (`packages/sdk-ts/crypto`)

크로스 언어 암호화 추상 레이어.

**인터페이스**: `Signer`, `RpcClient`, `CryptoProvider`, `AbiEncoder`, `HashAlgorithm`
**어댑터**: `ViemCryptoProvider`, `ViemAbiEncoder`, `ViemHashAlgorithm`, `ViemRpcClient`
**팩토리**: `createCryptoProvider()`, `createAbiEncoder()`, `createHashAlgorithm()`, `createRpcClient()`

#### @stablenet/sdk-addresses (`packages/sdk-ts/addresses`)

체인별 컨트랙트 주소 유틸리티.

- `getChainAddresses()`, `getEntryPoint()`, `getKernel()`, `getKernelFactory()`
- `isChainSupported()`, `isZeroAddress()`, `assertNotZeroAddress()`
- 자동 생성: `scripts/generate-addresses.ts`

#### @stablenet/core (`packages/sdk-ts/core`)

SDK 핵심. SmartAccountClient, BundlerClient, RPC, 에러 처리, 트랜잭션 전략.

```
src/
├── clients/       SmartAccountClient, BundlerClient, IndexerClient
├── transaction/   EOA, EIP-7702, Smart Account 모드 및 전략
├── rpc/           JSON-RPC 클라이언트 추상화
├── providers/     Viem 프로바이더
├── errors/        SdkError, BundlerError, UserOperationError, TransactionError
├── config/        가스 제한, 타임아웃, 재시도 정책
└── abis/          EntryPoint, Kernel, Validators, Executors, Hooks ABI
```

#### @stablenet/accounts (`packages/sdk-ts/accounts`)

Kernel 스마트 계정 구현.

- `toKernelSmartAccount()` - 계정 팩토리
- `encodeExecutionMode()`, `encodeSingleCall()`, `encodeBatchCalls()`
- `encodeKernelInitializeData()`, `encodeRootValidator()`, `calculateSalt()`
- ABI: `KernelAccountAbi`, `KernelFactoryAbi`, `EntryPointAbi`

#### 플러그인 패키지 (7개)

| 플러그인 | 패키지명 | 역할 | 특수 의존성 |
|----------|---------|------|------------|
| ECDSA | `@stablenet/plugin-ecdsa` | ECDSA 밸리데이터 | - |
| Session Keys | `@stablenet/plugin-session-keys` | 제한된 실행을 위한 세션 키 | - |
| Subscription | `@stablenet/plugin-subscription` | 구독 결제 (EIP-7702 + ERC-7715) | - |
| Paymaster | `@stablenet/plugin-paymaster` | 가스 스폰서십 통합 | - |
| Stealth | `@stablenet/plugin-stealth` | 스텔스 주소 (EIP-5564/6538) | `@noble/curves`, `@noble/hashes` |
| Modules | `@stablenet/plugin-modules` | ERC-7579 모듈 관리 | - |
| DeFi | `@stablenet/plugin-defi` | DeFi 실행기/훅 | - |

모든 플러그인 공통 의존성: `@stablenet/core`, `@stablenet/sdk-types`, `viem`

---

### 5.3 SDK-Go (`packages/sdk-go`)

Go 서버사이드 SDK. ERC-4337 v0.7 + Kernel + 멀티체인.

```
sdk-go/
├── core/          번들러, UserOp, 페이마스터, RPC
├── types/         UserOperation, Network, Module, Transaction
├── accounts/      Kernel 스마트 계정
├── clients/       SmartAccountClient, IndexerClient
├── config/        가스, 클라이언트 설정
├── crypto/        추상 레이어 + go-ethereum 어댑터
├── plugins/       플러그인 지원
├── modules/       모듈 타입/관리
├── transaction/   라우팅, 전략
├── security/      레이트 리미팅, 서명 리스크 평가
├── eip7702/       EIP-7702 위임
├── errors/        에러 타입
└── gas/           가스 추정
```

- **Go 버전**: 1.24.0 (go.mod), Dockerfile은 1.23-alpine 사용 — 동기화 필요
- **의존성**: go-ethereum v1.14.13, secp256k1 v4.3.0, x/crypto v0.47.0

---

### 5.4 패키지 의존성 그래프

```
@stablenet/types (루트)
├── @stablenet/config
├── @stablenet/contracts
├── @stablenet/wallet-sdk
└── @stablenet/sdk-types

@stablenet/sdk-types
├── @stablenet/sdk-crypto
└── @stablenet/sdk-addresses

@stablenet/core
├── @stablenet/sdk-types
└── viem

@stablenet/accounts
├── @stablenet/core
└── @stablenet/sdk-types

plugin-* (전체)
├── @stablenet/core
├── @stablenet/sdk-types
└── viem

@stablenet/wallet-sdk
├── @stablenet/types (optional)
├── react (peer, optional)
└── viem (peer)
```

---

## 6. Services

### 6.1 서비스 포트 맵

| 서비스 | 포트 | 언어 | 프레임워크 | 역할 |
|--------|------|------|-----------|------|
| bundler | 4337 | TypeScript | Fastify 5.7 | ERC-4337 UserOp 번들러 |
| paymaster-proxy | 4338 | TypeScript | Hono 4.11 | ERC-7677 가스 스폰서십 |
| stealth-server | 4339 | Rust | Actix-web 4 | EIP-5564 스텔스 주소 인덱서 |
| contract-registry | 4400 | TypeScript | Fastify 5.7 | 컨트랙트 주소 레지스트리 |
| module-registry | 4340 | TypeScript | Fastify 5.7 | ERC-7579 모듈 마켓플레이스 |
| order-router | 8087 | Go | Gin 1.10 | DEX/AMM 라우팅 |
| subscription-executor | 8083 | Go | Gin 1.10 | 구독 결제 자동실행 |
| bridge-relayer | 8080 | Go | Gin 1.10 | 크로스체인 릴레이 + MPC |
| bank-simulator | 4350 | Go | Gin 1.10 | 뱅킹 시뮬레이터 |
| pg-simulator | 4351 | Go | Gin 1.10 | PG 시뮬레이터 (결제+정산, 워커풀 웹훅) |
| onramp-simulator | 4352 | Go | Gin 1.10 | 온램프 시뮬레이터 |

---

### 6.2 TypeScript 서비스 상세

#### Bundler (`services/bundler`)

ERC-4337 UserOperation 번들러. 유효성 검증, 멤풀 관리, 번들 제출.

```
src/
├── abi/            EntryPoint V0.7 ABI
├── cli/            CLI 진입점, 설정 파싱
├── config/         네트워크 프리셋, 상수
├── executor/       번들 제출 (7개 파일)
│   ├── bundleExecutor.ts      핵심 번들링 로직
│   ├── directSubmitter.ts     직접 멤풀 제출
│   ├── flashbotsSubmitter.ts  Flashbots MEV 보호
│   └── profitability.ts       번들 수익성 분석
├── gas/            가스 추정
├── mempool/        UserOp 큐 관리, 의존성 추적
├── metrics/        Prometheus 메트릭
├── rpc/            JSON-RPC 서버 (bundler_* 메서드)
├── types/          인터페이스
├── utils/          로거
└── validation/     UserOp 유효성 검증 (12개 파일)
    ├── 포맷 검증 (서명, 인코딩)
    ├── 시뮬레이션 검증 (가스 추정)
    ├── 평판 관리
    └── 스테이크 요구사항
```

- **의존성**: fastify 5.7, viem 2.21, pino 9.5, zod 3.23, yargs 17.7
- **제출 전략**: Direct (멤풀 직접), Flashbots (MEV 보호)

#### Paymaster Proxy (`services/paymaster-proxy`)

ERC-7677 페이마스터. UserOp 가스 스폰서십.

```
src/
├── handlers/       getPaymasterStubData, getPaymasterData
├── policy/         SponsorPolicyManager (지출 한도, 정책 관리)
├── signer/         PaymasterSigner (ECDSA)
├── schemas/        Zod 유효성 검증
└── config/         설정 로딩
```

- **의존성**: hono 4.11, viem 2.21, pino 9.5, zod 3.23

#### Contract Registry (`services/contract-registry`)

컨트랙트 주소 레지스트리. 파일 워칭 + WebSocket 실시간 업데이트.

```
src/
├── server/         Fastify 서버 (7개 파일)
├── store/          인메모리 스토어 + 파일 영속성 (7개 파일)
└── watcher/        chokidar 파일 워처
```

- **의존성**: fastify 5.7, fastify/websocket 11.0, chokidar 4.0

#### Module Registry (`services/module-registry`)

ERC-7579 모듈 마켓플레이스 백엔드. 모듈 메타데이터 관리.

```
src/
├── server/         Fastify 서버 (5개 파일)
├── store/          모듈 스토리지 (4개 파일)
└── cli/            CLI, 포트/호스트 설정
```

- **의존성**: fastify 5.7, pino 9.5, zod 3.23, nanoid 5.0
- **기능**: 시드 데이터 자동 로딩, CORS (프로덕션 오리진 제한), 레이트 리미팅, Zod 스키마 검증, API Key 인증

---

### 6.3 Go 서비스 상세

#### Subscription Executor (`services/subscription-executor`)

구독 결제 자동실행. 가장 복잡한 데이터 레이어.

```
internal/
├── client/         구독 클라이언트 (9개 파일)
├── config/         설정
├── handler/        HTTP 핸들러
├── lock/           분산 락 (5개 파일)
├── logger/         구조화 로깅
├── metrics/        Prometheus 메트릭 (4개 파일)
├── middleware/      멱등성, 레이트 리미팅
├── model/          데이터 모델 (5개 파일)
├── repository/     데이터 액세스 (6개 파일)
│   ├── PostgresRepository     PostgreSQL 구현
│   └── InMemoryRepository     개발/폴백 모드
├── resilience/     재시도/서킷 브레이커 (6개 파일)
├── service/        비즈니스 로직 (executor.go)
├── validation/     입력 유효성 검증
└── webhook/        웹훅 시스템 (6개 파일)
```

- **DB**: PostgreSQL (pgx v5, 커넥션 풀링, 자동 인메모리 폴백)
- **복원력**: 분산 락, 웹훅 재시도, 서킷 브레이커
- **멱등성**: API 레벨 요청 중복 방지

#### Bridge Relayer (`services/bridge-relayer`)

크로스체인 브릿지. 가장 복잡한 Go 서비스.

```
internal/
├── ethereum/       이더리움 클라이언트
├── executor/       트랜잭션 실행
├── fraud/          사기 탐지 (6개 모듈)
├── guardian/       가디언 모니터링
├── monitor/        이벤트 모니터링
├── mpc/            MPC 임계값 서명
└── middleware/     인증, 멱등성, CORS, 레이트 리미팅, 요청 ID, 보안 헤더, 바디 제한
```

- **MPC 서명**: 다중 서명 임계값 기반
- **사기 탐지**: 6개 모듈
- **이벤트 추적**: EventTracker (중복 제거)
- **미들웨어 스택**: Recovery → Logging → CORS → Security Headers → Request ID → Rate Limiting → Body Limit → Idempotency

#### Order Router (`services/order-router`)

DEX/AMM 프로토콜 라우팅.

```
internal/
├── config/         체인별 설정 (ChainID)
├── handler/        HTTP 라우팅
├── model/          데이터 모델
└── service/        멀티 프로토콜 라우팅
```

#### 시뮬레이터 3종

| 서비스 | 포트 | 특징 |
|--------|------|------|
| bank-simulator | 4350 | 뱅킹 오퍼레이션, 레이트 리미팅 |
| pg-simulator | 4351 | 결제+정산 이중 서비스, 워커풀 웹훅, 입력 이스케이프 |
| onramp-simulator | 4352 | 법정화폐→암호화폐 플로우 |

---

### 6.4 Rust 서비스 상세

#### Stealth Server (`services/stealth-server`)

EIP-5564 스텔스 주소 인덱서.

```
src/
├── main.rs         진입점
├── api/            HTTP 핸들러
├── config/         설정
├── domain/         도메인 모델
├── parser/         어나운스먼트 파서
├── storage/        PostgreSQL 레이어 (sqlx, 컴파일 타임 쿼리 체크)
└── subscriber/     이벤트 구독
```

- **의존성**: actix-web 4, tokio 1, sqlx 0.8, k256 0.13, sha3 0.10, alloy-primitives 0.6
- **특징**: WebSocket 실시간 업데이트, ECDSA 키 유도, 스텔스 주소 생성

---

### 6.5 서비스 공통 패턴

#### 헬스 체크 (Kubernetes 호환)

모든 서비스가 구현:

```
GET /health    → 상세 상태 + 업타임
GET /ready     → 의존성 확인 (DB 등)
GET /live      → 단순 활성 확인 (200)
```

#### 로깅

| 언어 | 라이브러리 | 포맷 |
|------|-----------|------|
| Go | slog | JSON/Text (구조화) |
| TypeScript | Pino | JSON (pino-pretty for dev) |
| Rust | Tracing | 구조화 스팬 |

#### 미들웨어

- CORS 헤더
- 보안 헤더
- 요청 ID 추적
- 레이트 리미팅 (Go: 100 req/min per IP)
- 요청 바디 크기 제한 (Go: 1MB)
- 에러 복구 (panic handling)
- 멱등성 추적

#### Docker

- 멀티스테이지 빌드
- Non-root 유저 실행 (nodejs:1001, appuser:1001)
- 헬스 체크 포함

---

## 7. Infrastructure

### 7.1 Docker Compose 토폴로지

**네트워크**:
- `data-internal` (internal): PostgreSQL, Redis만 접근
- `stablenet`: 모든 서비스간 통신

**데이터 계층**:

| 서비스 | 설정 |
|--------|------|
| PostgreSQL | UUID + pg_trgm 확장, 내부 네트워크 전용 |
| Redis | Password auth, 내부 네트워크 전용 |

**환경변수**: YAML 앵커 (`&common-env`, `&contract-addresses`)로 공유

### 7.2 데이터베이스 스키마 (`infra/docker/init-db.sql`)

**stablenet_stealth DB**:

| 테이블 | 용도 |
|--------|------|
| `stealth_addresses` | spending/viewing 공개키 |
| `stealth_announcements` | ephemeral 키 + 트랜잭션 메타데이터 |

**stablenet DB**:

| 테이블 | 용도 |
|--------|------|
| `subscriptions` | 구독 결제 (active/paused/cancelled/expired) |
| `execution_records` | 구독 실행 감사 추적 |
| `user_operations` | UserOp 이력 + 상태/가스 추적 |
| `paymaster_deposits` | 스폰서십 예치금 추적 |

- **인덱스**: smart_account, status, next_execution 최적화
- **트리거**: `update_updated_at` (subscriptions 자동 업데이트)

### 7.3 Dockerfile

| 파일 | 베이스 | 용도 |
|------|--------|------|
| `Dockerfile.node` | node:20-alpine | TypeScript 서비스 (pnpm + turbo) |
| `Dockerfile.go` | golang:1.23-alpine → alpine:3.19 | Go 서비스 (CGO_ENABLED=0 정적 바이너리, go.mod은 1.24.0) |

---

## 8. CI/CD

### GitHub Actions (`ci.yml`)

**5개 병렬 잡**:

| Job | 실행 환경 | 내용 |
|-----|----------|------|
| **TypeScript CI** | ubuntu-latest | lint → typecheck → build → test → 아티팩트 업로드 |
| **Go CI** | ubuntu-latest (7 서비스 매트릭스) | go mod download → build → test |
| **E2E Tests** | ubuntu-latest (TS CI 의존) | 빌드 아티팩트 다운로드 → Playwright → 리포트 업로드 |
| **Docker Build** | ubuntu-latest (TS + Go 의존, main push만) | 전체 Docker 이미지 병렬 빌드 |
| **Format Check** | ubuntu-latest | Biome 포맷 검증 |

### Dependabot (`dependabot.yml`)

| 에코시스템 | 그룹 | 주기 |
|-----------|------|------|
| npm | typescript, viem, build-tools, testing | weekly |
| gomod | 7개 Go 서비스 | weekly |
| github-actions | - | weekly |

- **최대 오픈 PR**: 10개

---

## 9. 모니터링

### Prometheus

- **스크랩 인터벌**: 15초 (글로벌), 30초 (시뮬레이터/서비스)
- **11개 잡**: Prometheus self + 3 simulators + 4 Go services + stealth-server + bundler + paymaster-proxy

### AlertManager

**4개 알림 그룹**:

| 그룹 | 알림 | 임계값 |
|------|------|--------|
| service-health | ServiceDown + 10개 서비스별 다운 알림 | 1분 장애 |
| error-rates | HighErrorRate, CriticalErrorRate | 5%, 20% |
| service-specific | BundlerMempool, BridgeRelayerMPC 등 | 서비스별 |
| latency | HighLatencyDetected | 95th percentile > 2초 |

**라우팅**: critical (10초 그룹, 1시간 반복), warning (4시간 반복)
**억제 규칙**: Critical이 동일 서비스의 Warning을 억제

### Grafana

- 서비스 상태 Stat 패널 (10개 핵심 서비스 Up/Down)
- 서비스 메트릭 섹션 (상세 대시보드)

---

## 10. 문서화

### 문서 통계

- **총 파일**: 109개
- **디렉토리**: 27개

### 주요 문서 카테고리

| 디렉토리 | 내용 |
|----------|------|
| `poc/` | PoC 기술명세 (시스템 아키텍처, 스마트 컨트랙트, 브릿지, PRD) |
| `seminar-7702-4337-7579/` | EIP-7702/ERC-4337/ERC-7579 세미나 자료 (10개 가이드) |
| `roadmap/` | 기술 로드맵 |
| `specs/` | 기술 스택 명세 |
| `sdk/` | SDK API 레퍼런스 |
| `simulator/` | 시뮬레이터 설계 문서 |
| `architecture/` | 시스템 설계, 컴포넌트 상호작용 |
| `operations/` | 배포, 모니터링, 트러블슈팅 가이드 |
| `prd/` | 제품 요구사항 정의 |

### 핵심 문서

| 문서 | 내용 |
|------|------|
| `StableNet_SmartAccount_PoC_기술명세서.md` | 전체 PoC 기술 명세 |
| `StableNet_기술_심층검토_보고서.md` | 기술 심층 리뷰 |
| `StableNet_신뢰성_검토_보고서.md` | 신뢰성 감사 보고서 |
| `VULNERABILITY_REMEDIATION.md` | 보안 취약점 추적 |
| `wallet-reference.md` | 지갑 확장 프로그램 API 문서 |
| `CODE_REVIEW_REPORT_2025-02-09.md` | 코드 리뷰 보고서 |

---

## 11. 테스트 인프라

### 테스트 계층 구조

| 계층 | 위치 | 프레임워크 | 수량 |
|------|------|-----------|------|
| **Unit (wallet-extension)** | `apps/wallet-extension/tests/` | Jest 29 | 46 suites, 1072 테스트 |
| **Unit (web)** | `apps/web/**/__tests__/` | Vitest 4.0 | 7 파일 |
| **Unit (wallet-sdk)** | `packages/wallet-sdk/tests/` | Vitest | 144 테스트 |
| **Unit (sdk packages)** | 각 패키지 `tests/` | Vitest | 패키지별 |
| **Integration** | `tests/` (루트) | Vitest | 5 파일 |
| **E2E (wallet)** | `apps/wallet-extension/e2e/tests/` | Playwright 1.58 | 5 spec 파일 |
| **E2E (root)** | `tests/` (루트) | Vitest | 6 파일 |
| **Go** | 각 서비스 `*_test.go` | Go testing | 서비스별 |

### 테스트 설정 특이사항

- **wallet-extension Jest**: 3-project 설정 (unit-security, jsdom, unit)
- **Chrome mock**: `tests/utils/mockChrome.ts`로 `global.chrome` 설정
- **Zustand**: `useWalletStore.setState({...})`로 직접 상태 설정
- **Playwright E2E**: 순차 실행 (Chrome 확장 제약), 60초 타임아웃

---

## 12. 기술 스택 요약

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
├─────────────────────────────────────────────────────────┤
│ Chrome Extension: React 19 + Vite + Zustand + Tailwind  │
│ Web Dashboard:    Next.js 15 + wagmi + TanStack Query   │
│ Shared SDK:       @stablenet/wallet-sdk (EIP-1193/6963) │
├─────────────────────────────────────────────────────────┤
│                   BACKEND SERVICES                       │
├─────────────────────────────────────────────────────────┤
│ TypeScript: Fastify 5.7, Hono 4.11 (Bundler, Paymaster)│
│ Go:         Gin 1.10 (Order Router, Subscription, Bridge│
│ Rust:       Actix-web 4 (Stealth Server)                │
├─────────────────────────────────────────────────────────┤
│                    BLOCKCHAIN                            │
├─────────────────────────────────────────────────────────┤
│ viem 2.21 + wagmi 2.14                                  │
│ ERC-4337 (Account Abstraction)                          │
│ EIP-7702 (Delegation)                                   │
│ ERC-7579 (Modular Smart Accounts)                       │
│ EIP-5564/6538 (Stealth Addresses)                       │
│ ERC-7677 (Paymaster)                                    │
├─────────────────────────────────────────────────────────┤
│                    DATA LAYER                            │
├─────────────────────────────────────────────────────────┤
│ PostgreSQL (uuid-ossp, pg_trgm)                         │
│ Redis (session, cache)                                  │
├─────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE                         │
├─────────────────────────────────────────────────────────┤
│ Docker Compose (13 services, 2 networks)                │
│ Prometheus + Grafana + AlertManager                     │
│ GitHub Actions (5 CI jobs)                              │
│ Foundry / Anvil (EVM simulation)                        │
├─────────────────────────────────────────────────────────┤
│                    TOOLING                               │
├─────────────────────────────────────────────────────────┤
│ pnpm 10.28 + Turborepo (monorepo)                      │
│ Biome (lint + format)                                   │
│ tsup (TS build) + TypeScript 5.7                        │
│ Vitest + Jest + Playwright + Go testing                 │
└─────────────────────────────────────────────────────────┘
```

---

## 13. 아키텍처 토폴로지

```
┌──────────────┐     ┌──────────────┐
│   Chrome     │     │   Next.js    │
│  Extension   │     │   Web App    │
│  (Popup/     │     │  (Dashboard) │
│  Sidepanel)  │     │              │
└──────┬───────┘     └──────┬───────┘
       │                     │
       │  @stablenet/wallet-sdk (EIP-1193/6963)
       │                     │
       ▼                     ▼
┌─────────────────────────────────────────┐
│              RPC Layer                   │
├─────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │   Bundler   │   │   Paymaster     │  │
│  │  (Port 4337)│   │   Proxy         │  │
│  │  Fastify    │   │  (Port 4338)    │  │
│  │  ERC-4337   │   │   Hono          │  │
│  └──────┬──────┘   │   ERC-7677      │  │
│         │          └────────┬────────┘  │
│         │                   │            │
│         ▼                   ▼            │
│  ┌──────────────────────────────────┐   │
│  │       EntryPoint (EVM)           │   │
│  │   Kernel Smart Account           │   │
│  │   ERC-7579 Modules               │   │
│  └──────────────────────────────────┘   │
│                                          │
├─────────────────────────────────────────┤
│            Core Services                 │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Order Router │  │  Subscription   │  │
│  │ (Port 8087)  │  │  Executor       │  │
│  │ Go/Gin       │  │  (Port 8083)    │  │
│  │ DEX Routing  │  │  Go/Gin         │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │   Bridge     │  │   Stealth       │  │
│  │   Relayer    │  │   Server        │  │
│  │ (Port 8080)  │  │  (Port 4339)    │  │
│  │ Go/Gin       │  │   Rust/Actix    │  │
│  │ MPC + Fraud  │  │  EIP-5564       │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Contract    │  │   Module        │  │
│  │  Registry    │  │   Registry      │  │
│  │ (Port 4400)  │  │  (Port 4340)    │  │
│  │ TS/Fastify   │  │  TS/Fastify     │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
├─────────────────────────────────────────┤
│           Simulators (Testing)           │
│                                          │
│  ┌──────────┐  ┌────────┐  ┌─────────┐ │
│  │  Bank    │  │   PG   │  │ OnRamp  │ │
│  │  (4350)  │  │ (4351) │  │ (4352)  │ │
│  └──────────┘  └────────┘  └─────────┘ │
│                                          │
├─────────────────────────────────────────┤
│              Data Layer                  │
│       (data-internal network)            │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL  │  │     Redis       │  │
│  │  - stealth   │  │  - sessions     │  │
│  │  - subscript │  │  - cache        │  │
│  │  - user_ops  │  │                 │  │
│  │  - paymaster │  │                 │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
├─────────────────────────────────────────┤
│           Monitoring                     │
│                                          │
│  ┌────────────┐ ┌────────┐ ┌─────────┐ │
│  │ Prometheus │ │Grafana │ │  Alert  │ │
│  │  (11 jobs) │ │        │ │ Manager │ │
│  └────────────┘ └────────┘ └─────────┘ │
└─────────────────────────────────────────┘
```

---

## 14. 주요 기술적 특징

### 14.1 폴리글랏 아키텍처

전략적 언어 선택으로 각 도메인에 최적화된 구현:

| 언어 | 선택 이유 | 적용 영역 |
|------|----------|-----------|
| TypeScript | 빠른 개발, React 생태계, Web3 라이브러리 | 프론트엔드, 번들러, 페이마스터, 레지스트리 |
| Go | 고성능, 낮은 레이턴시, 동시성 | DEX 라우터, 구독 실행기, 브릿지 릴레이어 |
| Rust | 메모리 안전성, 암호화 성능 | 스텔스 주소 서버 |

### 14.2 ERC-4337 풀스택 구현

번들러부터 스마트 계정까지 Account Abstraction 전체 스택:

```
UserOperation 생성 (SDK)
    ↓
유효성 검증 (Bundler - 12개 검증 파일)
    ↓
멤풀 관리 (Bundler)
    ↓
가스 스폰서십 (Paymaster - ERC-7677)
    ↓
번들 제출 (Bundler - Direct/Flashbots)
    ↓
EntryPoint 실행 (EVM)
    ↓
Kernel Smart Account (ERC-7579 모듈)
```

### 14.3 ERC-7579 모듈 시스템

스마트 계정의 확장성을 위한 모듈 아키텍처:

| 모듈 타입 | bigint | 용도 |
|-----------|--------|------|
| Validator | 1n | 트랜잭션 서명 검증 (ECDSA, WebAuthn) |
| Executor | 2n | 트랜잭션 실행 (Swap, Staking, Spending Limit) |
| Fallback | 3n | 폴백 핸들러 |
| Hook | 4n | 전/후 처리 훅 (DeFi) |

**마켓플레이스**: Module Registry 서비스 + 지갑 UI에서 설치/설정

### 14.4 프라이버시 (EIP-5564/6538)

- **Rust 스텔스 서버**: k256 ECDSA, PostgreSQL 인덱싱
- **SDK 플러그인**: `@stablenet/plugin-stealth` (@noble/curves)
- **웹 UI**: `/stealth/` 라우트 (전송/수신)
- **Chrome Extension**: 스텔스 전송 지원

### 14.5 크로스체인 브릿지

- **MPC 서명**: 다중 서명 임계값 기반 보안
- **사기 탐지**: 6개 탐지 모듈
- **가디언 모니터링**: 실시간 감시
- **이벤트 추적**: 중복 제거 메커니즘

### 14.6 구독 결제 자동화

- **EIP-7702 + ERC-7715**: 위임 기반 구독
- **분산 락**: 동시 실행 방지
- **서킷 브레이커**: 장애 전파 방지
- **웹훅 재시도**: 실패시 자동 재시도
- **PostgreSQL + 인메모리 폴백**: 유연한 영속성

### 14.7 엔터프라이즈 기능

Web 앱에서 B2B 기능 제공:
- **급여 관리** (`/enterprise/payroll/`)
- **경비 추적** (`/enterprise/expenses/`)
- **감사 로그** (`/enterprise/audit/`)
- **구독 머천트** (`/subscription/merchant/`)

### 14.8 시뮬레이터 기반 테스트

외부 서비스 의존성 없이 통합 테스트 가능:

| 시뮬레이터 | 시뮬레이션 대상 |
|-----------|----------------|
| Bank Simulator | 전통 뱅킹 시스템 (on/off-ramp) |
| PG Simulator | 결제 게이트웨이 (결제 + 정산) |
| OnRamp Simulator | 법정화폐→암호화폐 온램프 |

---

## 15. 보안 아키텍처

코드 리뷰(`CODE_REVIEW_REPORT_2025-02-09.md`) 기반으로 7단계 보안 강화를 수행했다.

### 15.1 인증 및 권한

| 서비스 | 인증 방식 | 변경 사항 |
|--------|----------|----------|
| module-registry | API Key (`X-API-Key` 헤더) | 쓰기 엔드포인트에 인증 추가 |
| contract-registry | API Key | undefined 바이패스 취약점 수정 |
| paymaster-proxy | Admin Auth | 관리 엔드포인트 인증 추가 |
| wallet-extension | 패스워드 검증 | deprecated `getMnemonic()` 제거, `getMnemonicWithPassword()` 강제 |

### 15.2 입력 검증

- **RPC 핸들러**: `InputValidator` + `validateRpcParams()` (Zod 기반 메서드별 검증)
- **module-registry**: 모든 라우트 파라미터를 Zod `safeParse`로 검증 (unsafe `as` 캐스팅 제거)
- **pg-simulator**: 결제 금액 양수 검증 추가, XSS 입력 이스케이프 (`html.EscapeString`)

### 15.3 동시성 및 리소스 관리

| 이슈 | 해결 |
|------|------|
| 결제 TOCTOU 경쟁 조건 | 원자적 멱등성 키 예약 패턴 |
| 무제한 고루틴 스폰 | 채널 기반 워커풀 (5 워커, 100 큐) |
| 중첩 뮤텍스 (데드락 위험) | `GetEligiblePayments()` 공개 메서드로 캡슐화 |
| 컨텍스트 미전파 | `context.Context` 기반 Graceful Shutdown |
| publicClientCache 무제한 | TTL (30분) + LRU eviction (최대 20) |
| WebSocket 핸들러 누수 | 재연결 시 이벤트 핸들러 null 초기화 |

### 15.4 인프라 보안

- **Docker**: 리소스 제한 (CPU/메모리), 환경변수 기반 비밀번호, SSL 모드, 재시작 정책
- **CORS**: 프로덕션 환경에서 `ALLOWED_ORIGINS` 환경변수 기반 오리진 제한
- **네트워크**: `data-internal` (내부 전용) / `stablenet` (서비스 간) 분리

### 15.5 감사 로깅

- `AuditLogger` 서비스 추가 (민감 작업 추적)
- 니모닉 조회, 키 내보내기, 설정 변경 등 기록

---

## 16. 변경 이력

### 2025-02-09 ~ 2025-02-13: 보안 및 코드 품질 개선 (Phase 0-6)

| Phase | 커밋 | 내용 |
|-------|------|------|
| 0 | `5081922` | CRITICAL 보안 취약점 3건 패치 (내부 요청 바이패스, 관리자 인증, 비밀키 노출) |
| 1 | `2b911db` | HIGH 보안 강화 (module-registry 인증, contract-registry 인증 수정, 감사 로깅) |
| 2 | `d2264a2` | 인프라 보안 (Docker 리소스 제한, 환경변수 비밀번호, Prometheus 설정) |
| 3 | `21d294a` | 타입 시스템 통합 (UserOperation 타입 통합, unsafe cast 제거) |
| 4 | `6c05761` | Go 서비스 (TOCTOU 경쟁 조건, 워커풀, 컨텍스트 전파, CORS 제한) |
| 5 | `fd8d74d` | 코드 구조 (handler.ts 3,875→3,172줄 분리, Zod 검증, WebSocket 누수 수정) |
| 6 | `8195d2e` | 잔여 개선 (deprecated API 제거, 캐시 TTL, 금액 검증, 매직 넘버 정리) |

**해결 이슈**: CRITICAL 9건, HIGH 20건 전부 해결. MEDIUM 32건 중 actionable 항목 처리 완료.

---

> **참고**: 이 문서는 2025-02-11에 최초 작성되었으며, 2025-02-13에 Phase 0-6 보안 수정 결과를 반영하여 업데이트되었습니다. 개별 서비스나 패키지의 세부 사항은 해당 디렉토리의 README 또는 소스 코드를 참조하세요.
