# EIP-7702 구독 결제 시스템 — 구현 계획서

> **최종 업데이트**: 2026-01-27
> **상태**: 계획 단계
> **범위**: poc-contract, stable-platform (SDK, Frontend, Backend)

---

## 1. 현재 구현 현황

### 1.1 스마트 컨트랙트 (poc-contract) — 95% 완성

| 컨트랙트 | 경로 | LOC | 테스트 | 상태 |
|----------|------|-----|--------|------|
| `Eip7702Support.sol` | `src/erc4337-entrypoint/` | - | 별도 | 완료 |
| `SubscriptionManager.sol` | `src/subscription/` | 579 | 459 LOC / 35+ 테스트 | 완료 |
| `ERC7715PermissionManager.sol` | `src/subscription/` | 585 | 422 LOC | 완료 |
| `RecurringPaymentExecutor.sol` | `src/erc7579-executors/` | 418 | 357 LOC | 완료 |
| `SessionKeyExecutor.sol` | `src/erc7579-executors/` | 434 | 245 LOC / 44 테스트 | 완료 |

**구현된 기능**:
- 시간~연 단위 구독 주기, 트라이얼/유예 기간
- ERC-20 + 네이티브 토큰 결제
- ERC-7715 권한 기반 인가 (5가지 권한 타입)
- 배치 결제 처리, 프로토콜 수수료 (기본 0.5%, 최대 10%)
- ERC-7579 모듈 라이프사이클 (install/uninstall)
- 배포 스크립트 완비 (`DeploySubscription.s.sol`, `DeployExecutors.s.sol`)

**미완료**: 퍼징 테스트, 크로스모듈 통합 테스트

---

### 1.2 SDK (stable-platform/packages/sdk/) — 70% 완성

```
packages/sdk/
├── packages/
│   ├── core/          # createSmartAccountClient, createBundlerClient, UserOp 유틸리티
│   ├── types/         # UserOperation, SmartAccount, Bundler 타입 정의
│   └── accounts/      # Kernel v3.1 Smart Account (toKernelSmartAccount)
└── plugins/
    ├── ecdsa/         # ECDSA Validator
    ├── paymaster/     # VerifyingPaymaster + SponsorPaymaster
    ├── session-keys/  # SessionKeyExecutor 클라이언트 (450 LOC 테스트)
    └── stealth/       # Stealth Address
```

**이미 구현된 공통 기능** (재구현 불필요):
- `createBundlerClient()` — 전체 ERC-4337 번들러 RPC (send, estimate, receipt polling)
- `createSmartAccountClient()` — UserOp 빌드 → 가스 추정 → 페이마스터 → 서명 → 전송
- `sendUserOperation()` / `sendTransaction()` — 완전한 트랜잭션 제출 플로우
- `getUserOperationHash()` / `packUserOperation()` — UserOp 해싱/직렬화
- EIP-7702 authorization signing (`eip7702/authorization.ts`)
- Session Key 관리 (`plugins/session-keys/`)

**미구현**: 구독 관련 플러그인 없음

---

### 1.3 백엔드 서비스 (subscription-executor) — 60% 완성

Go/Gin 기반 REST API 서비스. 6개 엔드포인트 구현.

**완성된 부분**:
- HTTP API (Create/Get/List/Cancel/Pause/Resume)
- PostgreSQL + InMemory 리포지토리
- UserOp 빌드 및 번들러 제출 (기본 구조)
- Rate limiting, Graceful shutdown, DB 마이그레이션 스키마

**치명적 미완료**:
- UserOp 서명: placeholder(`0x01...01`) — 실제 서명 로직 없음
- Smart Account 인가 검증 없음
- 실패 재시도/circuit breaker 없음
- 테스트 커버리지 ~15%
- 로깅/모니터링 없음

---

### 1.4 프론트엔드 (apps/web/) — 30% 완성

**존재하는 것**: Smart Account 관리 UI (`/smart-account` 페이지), 결제/DeFi/스텔스 페이지

**전혀 없는 것**: 구독 UI, Session Key 관리 UI, useSubscription/useSessionKey Hook, 프론트엔드↔백엔드 연동

---

## 2. 아키텍처 재설계: SDK 중심 구조

### 2.1 문제점: 현재 Go 서비스의 기능 중복

현재 `subscription-executor` (Go)가 UserOp 빌드/서명/전송 로직을 자체 구현하고 있음.
SDK에 이미 동일한 기능이 TypeScript로 완성되어 있어 **이중 구현 + 유지보수 부담** 발생.

```
현재 (문제):
┌─────────────────────────┐     ┌──────────────────────────────┐
│  Frontend (React)       │     │  subscription-executor (Go)  │
│  - UI만 있음             │     │  - UserOp 빌드 (중복)         │
│  - SDK 미사용           │     │  - 서명 (placeholder)         │
│                         │     │  - 번들러 RPC (중복)          │
│                         │     │  - 페이마스터 RPC (중복)       │
└─────────────────────────┘     └──────────────────────────────┘
```

### 2.2 제안: SDK 플러그인 + 경량 스케줄러 구조

```
개선 (제안):

┌──────────────────────────────────────────────────────┐
│                    @stablenet/sdk                     │
│                                                      │
│  packages/core        → createBundlerClient          │
│                       → createSmartAccountClient     │
│                       → sendUserOperation            │
│                                                      │
│  plugins/session-keys → 세션키 생성/검증/실행          │
│  plugins/paymaster    → 가스 스폰서링                  │
│  plugins/subscription → (NEW) 구독 관리 클라이언트     │
│                         - 컨트랙트 인코딩               │
│                         - 구독 상태 조회                │
│                         - 권한 부여 헬퍼                │
│                         - UserOp 빌드 (구독 결제용)     │
└──────────┬───────────────────────┬───────────────────┘
           │                       │
    ┌──────▼──────┐     ┌─────────▼──────────────┐
    │  Frontend   │     │  subscription-scheduler │
    │  (React)    │     │  (Node.js or Go)        │
    │             │     │                         │
    │  - 구독 UI  │     │  - 스케줄링만 담당        │
    │  - Hook     │     │  - SDK 호출하여 실행      │
    │  - 상태표시  │     │  - DB 상태 관리           │
    │             │     │  - 재시도/모니터링         │
    └─────────────┘     └─────────────────────────┘
```

**핵심 변경 사항**:

1. **`@stablenet/plugin-subscription`** (NEW): 구독 컨트랙트 인터랙션 로직을 SDK 플러그인으로 구현
2. **subscription-executor 역할 축소**: UserOp 빌드/서명/전송은 SDK에 위임, 서비스는 **스케줄링 + DB 상태 관리** 에만 집중
3. **프론트엔드**: SDK 플러그인을 직접 사용하여 구독 생성/조회/취소

### 2.3 SDK 플러그인 설계: `@stablenet/plugin-subscription`

```
plugins/subscription/
├── src/
│   ├── index.ts                    # Barrel exports
│   ├── subscriptionClient.ts       # 구독 관리 클라이언트
│   ├── recurringPaymentClient.ts   # RecurringPaymentExecutor 클라이언트
│   ├── permissionClient.ts         # ERC-7715 권한 관리 클라이언트
│   ├── types.ts                    # 구독 관련 타입 정의
│   ├── abi.ts                      # 컨트랙트 ABI
│   └── constants.ts                # 주소, 기본값
├── tests/
│   └── index.test.ts
├── package.json
└── tsconfig.json
```

**주요 API**:

```typescript
// subscriptionClient.ts
interface SubscriptionClient {
  // SubscriptionManager 컨트랙트 인터랙션
  encodCreatePlan(params: CreatePlanParams): Hex
  encodeSubscribe(params: SubscribeParams): Hex
  encodeProcessPayment(subscriptionId: bigint): Hex
  encodeBatchProcessPayments(ids: bigint[]): Hex
  encodeCancelSubscription(subscriptionId: bigint): Hex

  // 읽기 함수
  getPlan(planId: bigint): Promise<Plan>
  getSubscription(subscriptionId: bigint): Promise<Subscription>
  getSubscriptionsByAccount(account: Address): Promise<Subscription[]>
  isPaymentDue(subscriptionId: bigint): Promise<boolean>
}

// recurringPaymentClient.ts
interface RecurringPaymentClient {
  // RecurringPaymentExecutor 모듈 인터랙션
  encodeCreateSchedule(params: CreateScheduleParams): Hex
  encodeCancelSchedule(scheduleId: bigint): Hex
  encodeExecutePayment(account: Address, scheduleId: bigint): Hex
  encodeBatchExecute(params: BatchExecuteParams): Hex

  // 읽기 함수
  getSchedule(account: Address, scheduleId: bigint): Promise<Schedule>
  isPaymentDue(account: Address, scheduleId: bigint): Promise<boolean>
  getActiveSchedules(account: Address): Promise<Schedule[]>
}

// permissionClient.ts
interface SubscriptionPermissionClient {
  // ERC-7715 권한 부여 헬퍼
  encodeGrantSubscriptionPermission(params: GrantParams): Hex
  encodeGrantRecurringAllowance(params: RecurringAllowanceParams): Hex
  encodeRevokePermission(permissionId: bytes32): Hex

  // 읽기 함수
  getPermission(permissionId: bytes32): Promise<Permission>
  hasActivePermission(account: Address, executor: Address): Promise<boolean>
  getRemainingAllowance(permissionId: bytes32): Promise<bigint>
}
```

---

## 3. 작업 리스트

### Phase 1: SDK 공통 기능 구축 (Foundation)

구독 결제의 핵심 로직을 SDK에 집중하여 프론트엔드/백엔드 모두 재사용할 수 있도록 합니다.

| # | 작업 | 위치 | 설명 | 의존성 |
|---|------|------|------|--------|
| **1.1** | `@stablenet/plugin-subscription` 패키지 생성 | `plugins/subscription/` | 패키지 스캐폴딩, tsconfig, tsup 설정, turbo pipeline 등록 | 없음 |
| **1.2** | 컨트랙트 ABI/주소 등록 | `packages/contracts/` | SubscriptionManager, ERC7715PermissionManager, RecurringPaymentExecutor ABI 및 배포 주소 등록 | 1.1 |
| **1.3** | `subscriptionClient` 구현 | `plugins/subscription/src/` | SubscriptionManager 컨트랙트 인코딩/디코딩. 플랜 CRUD, 구독 생성/취소, 결제 처리 | 1.2 |
| **1.4** | `recurringPaymentClient` 구현 | `plugins/subscription/src/` | RecurringPaymentExecutor 모듈 인터랙션. 스케줄 생성/취소, 결제 실행, 배치 처리 | 1.2 |
| **1.5** | `permissionClient` 구현 | `plugins/subscription/src/` | ERC-7715 권한 부여/폐기/조회 헬퍼. 구독용 recurring allowance 생성 | 1.2 |
| **1.6** | 단위 테스트 | `plugins/subscription/tests/` | 인코딩/디코딩 정확성, 타입 안전성, 경계값 테스트. 기존 session-keys 테스트 패턴 참조 (450+ LOC 목표) | 1.3-1.5 |
| **1.7** | 통합 테스트 (devnet) | `tests/integration/` | 실제 devnet 컨트랙트와 연동 테스트. 플랜 생성 → 구독 → 결제 실행 플로우 | 1.6 |

### Phase 2: 백엔드 서비스 리팩토링 (Scheduler)

Go 서비스를 스케줄러 역할로 축소하고, 핵심 블록체인 로직은 SDK에 위임합니다.

| # | 작업 | 위치 | 설명 | 의존성 |
|---|------|------|------|--------|
| **2.1** | 아키텍처 결정: Go 유지 vs Node.js 전환 | - | Go 유지 시 SDK 직접 호출 불가 → REST API wrapping 필요. Node.js 전환 시 SDK 직접 import 가능. 비용/이점 평가 | Phase 1 |
| **2.2a** | (Go 유지 시) SDK-powered REST API 생성 | `services/subscription-api/` | Node.js 기반 얇은 API 레이어. SDK를 사용하여 UserOp 빌드/서명/전송. Go 스케줄러가 이 API를 호출 | 2.1 |
| **2.2b** | (Node.js 전환 시) subscription-scheduler 재구현 | `services/subscription-scheduler/` | SDK import하여 직접 사용. 스케줄링 + DB 관리에 집중 | 2.1 |
| **2.3** | 서명 로직 구현 | 서비스 내 | SDK의 `createEcdsaValidator` 또는 Session Key 서명을 사용하여 실제 UserOp 서명 생성. placeholder 제거 | 2.2 |
| **2.4** | Smart Account 인가 검증 | 서비스 내 | SDK의 `permissionClient`를 통해 실행 전 권한 유효성 확인 | 2.2, 1.5 |
| **2.5** | 실패 재시도 + Circuit Breaker | 서비스 내 | Exponential backoff (최대 3회), 연속 실패 시 circuit open. 실패 이력 DB 기록 | 2.3 |
| **2.6** | 구조적 로깅 도입 | 서비스 전체 | Go: `slog` / Node.js: `pino`. 구독 ID, 계정, txHash 등 구조화된 필드 | 2.2 |
| **2.7** | 핵심 테스트 작성 | 서비스 전체 | 스케줄러 로직, API 핸들러, 리포지토리 테스트. 커버리지 60%+ 목표 | 2.3-2.6 |

### Phase 3: 프론트엔드 통합 (User Experience)

SDK 플러그인을 사용하여 완전한 구독 관리 UI를 구축합니다.

| # | 작업 | 위치 | 설명 | 의존성 |
|---|------|------|------|--------|
| **3.1** | `useSubscription` Hook | `apps/web/hooks/` | SDK `subscriptionClient` 래핑. 플랜 목록 조회, 구독 생성/취소, 결제 상태 폴링. React Query 또는 SWR 패턴 | Phase 1 |
| **3.2** | `useSessionKey` Hook | `apps/web/hooks/` | SDK `session-keys` 플러그인 래핑. 세션키 생성/폐기, 권한 부여, 잔여 한도 조회 | Phase 1 |
| **3.3** | `useRecurringPayment` Hook | `apps/web/hooks/` | SDK `recurringPaymentClient` 래핑. 스케줄 생성/취소, 실행 이력 조회 | Phase 1 |
| **3.4** | 구독 플랜 목록 페이지 | `apps/web/pages/subscription/` | 가용 플랜 카드 목록, 가격/주기/트라이얼 정보 표시, 구독 버튼 | 3.1 |
| **3.5** | 구독 신청 플로우 | `apps/web/components/subscription/` | 전체 흐름: 플랜 선택 → 권한 부여(ERC-7715) → Session Key 발급 → 구독 확인 → 완료 | 3.1-3.3 |
| **3.6** | 내 구독 관리 대시보드 | `apps/web/pages/subscription/` | 활성 구독 목록, 다음 결제일, 결제 이력, 취소/일시정지/재개 액션 | 3.1 |
| **3.7** | Session Key 관리 UI | `apps/web/components/session-keys/` | 활성 세션키 목록, 잔여 한도/만료일 표시, 폐기 버튼, 새 세션키 생성 모달 | 3.2 |
| **3.8** | 가맹점(Merchant) 관리 UI | `apps/web/pages/merchant/` | (선택) 가맹점용 플랜 생성/수정, 구독자 목록, 수익 대시보드 | 3.1 |

### Phase 4: 품질/보안/운영 (Production Readiness)

| # | 작업 | 위치 | 설명 | 의존성 |
|---|------|------|------|--------|
| **4.1** | 스마트 컨트랙트 퍼징 테스트 | `poc-contract/test/` | Foundry fuzz로 SubscriptionManager, RecurringPaymentExecutor 경계값/오버플로우 검증 | 없음 |
| **4.2** | 크로스모듈 통합 테스트 | `poc-contract/test/` | SubscriptionManager ↔ ERC7715PermissionManager ↔ RecurringPaymentExecutor 전체 플로우 | 없음 |
| **4.3** | E2E 테스트 (전체 플로우) | `stable-platform/tests/e2e/` | 컨트랙트 배포 → EOA 위임(7702) → 권한 부여(7715) → 구독 생성 → 자동 결제 → 취소 | Phase 1-3 |
| **4.4** | 보안 감사 준비 | 전체 | Slither/Mythril 정적 분석, 서명 재사용(replay) 방어, chainId=0 크로스체인 리플레이 방어 확인 | 4.1-4.2 |
| **4.5** | 메트릭/모니터링 | 서비스 | Prometheus 메트릭: 실행 성공/실패, 지연시간, pending 구독 수, bundler/paymaster 응답시간 | Phase 2 |
| **4.6** | Docker + Docker Compose | `services/` | 전체 로컬 개발 환경: PostgreSQL + subscription-scheduler + bundler + paymaster | Phase 2 |
| **4.7** | API 문서화 (OpenAPI) | `services/` | REST API 엔드포인트 스펙, req/res 스키마, 에러 코드, 인증 방식 | Phase 2 |
| **4.8** | ERC-20 Paymaster 구현 | `plugins/paymaster/` | 현재 stub(zero address). USDC 등 ERC-20 토큰 가스비 지불 기능 | 없음 |
| **4.9** | 분산 잠금 (Multi-Instance) | 서비스 | Redis 또는 PostgreSQL advisory lock 기반 다중 인스턴스 동시 실행 방지 | Phase 2 |
| **4.10** | Webhook/이벤트 알림 | 서비스 | 결제 성공/실패, 구독 만료, 유예기간 진입 등 이벤트 콜백 | Phase 2 |

---

## 4. 의존성 및 실행 순서

```
Phase 1 (SDK Foundation)
  1.1 패키지 생성
   ├→ 1.2 ABI/주소 등록
   │   ├→ 1.3 subscriptionClient
   │   ├→ 1.4 recurringPaymentClient
   │   └→ 1.5 permissionClient
   │       └→ 1.6 단위 테스트
   │           └→ 1.7 통합 테스트
   │
   ▼
Phase 2 (Backend)              Phase 3 (Frontend)
  2.1 아키텍처 결정               3.1 useSubscription ──┐
   └→ 2.2 서비스 구현              3.2 useSessionKey ───┤
       ├→ 2.3 서명 구현            3.3 useRecurringPay ─┤
       ├→ 2.4 인가 검증            └→ 3.4 플랜 목록     │
       ├→ 2.5 재시도 로직              3.5 신청 플로우 ←─┘
       ├→ 2.6 로깅                     3.6 관리 대시보드
       └→ 2.7 테스트                   3.7 SessionKey UI
                                       3.8 가맹점 UI (선택)
   │                               │
   ▼                               ▼
Phase 4 (Production Readiness)
  4.1-4.2 컨트랙트 테스트 (병렬 진행 가능)
  4.3 E2E 테스트 (Phase 2+3 완료 후)
  4.4-4.10 (독립적 진행)
```

**병렬 진행 가능한 영역**:
- Phase 2 (백엔드) + Phase 3 (프론트엔드): Phase 1 완료 후 동시 진행
- Phase 4.1-4.2 (컨트랙트 테스트): 다른 Phase와 독립적
- Phase 4.8 (ERC-20 Paymaster): 다른 작업과 독립적

---

## 5. 완성도 현황 및 목표

| 레이어 | 현재 | Phase 1 후 | Phase 2 후 | Phase 3 후 | Phase 4 후 (목표) |
|--------|------|-----------|-----------|-----------|-------------------|
| 스마트 컨트랙트 | 95% | 95% | 95% | 95% | **100%** |
| SDK | 70% | **90%** | 90% | 90% | **100%** |
| 백엔드 서비스 | 60% | 60% | **90%** | 90% | **100%** |
| 프론트엔드 | 30% | 30% | 30% | **85%** | **100%** |
| 테스트/DevOps | 5% | 15% | 30% | 50% | **100%** |

---

## 6. 이상적인 구독 결제 플로우 (최종 목표)

### 6.1 사용자 구독 신청

```
1. [Frontend] 사용자가 구독 플랜 선택
2. [Frontend] EIP-7702 위임 확인 (미위임 시 Smart Account 업그레이드 유도)
3. [SDK plugin-subscription] 구독 권한 인코딩
4. [Frontend] wallet_grantPermissions (ERC-7715) 호출
   → 사용자 서명으로 Session Key에 구독 결제 권한 부여
   → 시간 제한 (예: 30일), 금액 제한 (예: 월 100 USDC), 대상 컨트랙트 제한
5. [SDK plugin-subscription] SubscriptionManager.subscribe() 트랜잭션 인코딩
6. [SDK core] sendUserOperation() → 번들러 → on-chain 구독 등록
7. [Backend] DB에 구독 스케줄 기록
8. [Frontend] 구독 완료 화면 표시
```

### 6.2 자동 결제 실행 (백엔드 스케줄러)

```
1. [Backend Scheduler] DB에서 due 상태 구독 조회
2. [Backend] SDK permissionClient로 권한 유효성 확인
3. [SDK plugin-subscription] RecurringPaymentExecutor.executePayment() 인코딩
4. [SDK core] sendUserOperation() → Paymaster 가스 스폰서 → 번들러 → on-chain 결제
5. [Backend] 실행 결과(txHash, status) DB에 기록
6. [Backend] 실패 시 재시도 큐에 추가 (exponential backoff, 최대 3회)
7. [Backend] Webhook 알림 발송 (성공/실패)
```

### 6.3 구독 취소

```
1. [Frontend] 사용자 취소 요청
2. [SDK plugin-subscription] SubscriptionManager.cancelSubscription() 인코딩
3. [SDK core] sendUserOperation() → on-chain 구독 취소
4. [SDK plugin-subscription] ERC-7715 권한 폐기 (선택)
5. [Backend] DB 상태 업데이트
6. [Frontend] 취소 완료 표시
```

---

## 7. 참고 자료 (외부)

### EIP-7702 구독 결제 관련 인프라/툴킷

| 플랫폼 | 특징 | URL |
|--------|------|-----|
| MetaMask Delegation Toolkit | 세분화된 권한 + 반복 트랜잭션 자동화 | https://metamask.io/developer/delegation-toolkit |
| Biconomy SmartSession (ERC-7579) | 모듈러 세션 관리, 재사용 가능 정책/검증기 | https://blog.biconomy.io/a-comprehensive-eip-7702-guide-for-apps/ |
| thirdweb SDK | 한 줄 7702 활성화, 가스 스폰서/배치/자동화 | https://blog.thirdweb.com/changelog/next-gen-smart-accounts/ |
| OpenZeppelin Contracts 5.x | EOA delegation 표준 구현체 | https://docs.openzeppelin.com/contracts/5.x/eoa-delegation |
| 7BlockLabs Session Auth Patterns | EIP-7702 세션 기반 인증 위임 패턴 | https://www.7blocklabs.com/blog/session-based-authentication-on-ethereum-delegation-patterns-for-eip-7702 |
| SlowMist Best Practices | EIP-7702 보안 모범 사례 | https://slowmist.medium.com/in-depth-discussion-on-eip-7702-and-best-practices-968b6f57c0d5 |
| ethereum.org 7702 Guidelines | 공식 Pectra 7702 가이드라인 | https://ethereum.org/roadmap/pectra/7702/ |

### 보안 Best Practices 요약

1. **위임 컨트랙트 최소화**: 핵심 로직 ~200줄 이내 유지 (Ambire 사례)
2. **프록시 패턴 사용**: 업그레이드 가능하도록 프록시에 위임
3. **ERC-7201 네임스페이스 스토리지**: 재위임 시 스토리지 충돌 방지
4. **Chain ID 검증**: `chainId: 0` 서명의 크로스체인 리플레이 공격 경고
5. **모듈러 설계**: ERC-7579/6900 기반 플러그인 구조
6. **벤더 중립**: 특정 SDK에 종속되지 않는 표준 기반 구현

---

## 8. 관련 파일 경로 요약

### 스마트 컨트랙트
- `poc-contract/src/subscription/SubscriptionManager.sol`
- `poc-contract/src/subscription/ERC7715PermissionManager.sol`
- `poc-contract/src/erc7579-executors/RecurringPaymentExecutor.sol`
- `poc-contract/src/erc7579-executors/SessionKeyExecutor.sol`
- `poc-contract/src/erc4337-entrypoint/Eip7702Support.sol`
- `poc-contract/test/subscription/*.t.sol`
- `poc-contract/test/erc7579-executors/*.t.sol`
- `poc-contract/script/deploy-contract/DeploySubscription.s.sol`
- `poc-contract/script/deploy-contract/DeployExecutors.s.sol`

### SDK
- `stable-platform/packages/sdk/packages/core/src/` (bundlerClient, smartAccountClient)
- `stable-platform/packages/sdk/packages/core/src/eip7702/` (authorization, types, constants)
- `stable-platform/packages/sdk/plugins/session-keys/` (SessionKeyExecutor 클라이언트)
- `stable-platform/packages/sdk/plugins/paymaster/` (Verifying + Sponsor)
- `stable-platform/packages/sdk/plugins/subscription/` **(NEW — 생성 예정)**

### 백엔드 서비스
- `stable-platform/services/subscription-executor/` (현재 Go 서비스)
- `stable-platform/services/subscription-executor/internal/service/executor.go:364` (placeholder 서명)

### 프론트엔드
- `stable-platform/apps/web/pages/` (기존 페이지들)
- `stable-platform/apps/web/hooks/` (기존 Hook들)

### 문서
- `stable-platform/docs/poc/09_Implementation_Plan.md`
- `stable-platform/docs/poc/12_Development_Progress_Report.md`
- `stable-platform/docs/poc/11_Remaining_Tasks.md`
