# StableNet PoC 남은 작업 리스트

> **최종 업데이트**: 2026-01-28 (P1 컨트랙트 완료 후 업데이트)
> **현재 진행률**: 약 95%
> **완료 영역**: Simulator (100%), SDK Subscription (100%), Backend (95%), Frontend (100%), Contracts (95%)

---

## 목차

1. [현재 상태 요약](#1-현재-상태-요약)
2. [P0: Critical - 구독 결제 시스템](#2-p0-critical---구독-결제-시스템)
3. [P1: High Priority - 핵심 기능 보완](#3-p1-high-priority---핵심-기능-보완)
4. [P2: Medium Priority - 확장 기능](#4-p2-medium-priority---확장-기능)
5. [의존성 다이어그램](#5-의존성-다이어그램)
6. [참조 문서](#6-참조-문서)

---

## 1. 현재 상태 요약

### 1.1 컴포넌트별 완성도

| 컴포넌트 | 완성도 | 상태 |
|----------|--------|------|
| Smart Contracts (Core) | 80-95% | ✅ 대부분 완료 |
| Simulator Services | 100% | ✅ 완료 |
| SDK (Subscription Plugin) | 100% | ✅ 완료 (2,986 LOC, 71 tests) |
| Backend (subscription-executor) | 95% | ✅ 대부분 완료 (6,012 LOC) |
| Frontend (Subscription) | 100% | ✅ 완료 (3,563 LOC) |

### 1.2 PoC 9대 핵심 기능 현황

```
1. Smart Account (EIP-7702)     ██████████  100% ✅ DelegateKernel 완료!
2. Paymaster (가스대납)          █████████░  85%
3. Token Gas Payment            █████████░  85%
4. Subscription (정기결제)       ██████████  100% ✅ P0 완료!
5. ERC-7579 Modules             ███████░░░  70%
6. DEX (Uniswap V3)             ████░░░░░░  35%
7. Bundler (ERC-4337)           ████████░░  80%
8. Stealth Address              ██████████  100% ✅ Enterprise 완료!
9. Regulatory Compliance        ████████░░  80%
```

---

## 2. P0: Critical - 구독 결제 시스템

> **목표**: EIP-7702 + ERC-7715 기반 구독 결제 시스템 완성
> **예상 작업량**: 21개 태스크

### Phase 1: SDK 플러그인 (Foundation) ✅ 완료

SDK에 구독 관련 플러그인을 추가하여 프론트엔드/백엔드 모두 재사용할 수 있도록 합니다.

| ID | 작업 | 위치 | 상태 | LOC |
|----|------|------|------|-----|
| 1.1 | `@stablenet/plugin-subscription` 생성 | `plugins/subscription/` | ✅ 완료 | - |
| 1.2 | 컨트랙트 ABI/주소 등록 | `plugins/subscription/src/types.ts` | ✅ 완료 | 795 |
| 1.3 | `subscriptionClient` 구현 | `plugins/subscription/src/` | ✅ 완료 | 316 |
| 1.4 | `recurringPaymentClient` 구현 | `plugins/subscription/src/` | ✅ 완료 | 273 |
| 1.5 | `permissionClient` 구현 | `plugins/subscription/src/` | ✅ 완료 | 276 |
| 1.6 | 단위 테스트 | `plugins/subscription/tests/` | ✅ 완료 (46 tests) | 698 |
| 1.7 | 통합 테스트 (devnet) | `tests/integration/` | ✅ 완료 (25 tests) | 492 |

**총 2,986 LOC 구현 완료** (목표 450+ LOC 초과 달성)

**산출물**:
```
plugins/subscription/
├── src/
│   ├── index.ts              (106 LOC)
│   ├── subscriptionClient.ts (316 LOC)
│   ├── recurringPaymentClient.ts (273 LOC)
│   ├── permissionClient.ts   (276 LOC)
│   ├── types.ts              (795 LOC - 3개 컨트랙트 ABI)
│   └── constants.ts          (29 LOC)
├── tests/
│   └── index.test.ts         (698 LOC - 46 tests)
└── package.json
```

---

### Phase 2: 백엔드 서비스 (Scheduler) ✅ 95% 완료

Go 서비스를 스케줄러 역할로 축소하고, 핵심 블록체인 로직은 SDK에 위임합니다.

| ID | 작업 | 위치 | 상태 |
|----|------|------|------|
| 2.1 | 아키텍처 결정 | - | ✅ Go 유지 결정 |
| 2.2 | 서비스 구현/리팩토링 | `services/subscription-executor/` | ✅ 완료 (6,012 LOC) |
| 2.3 | **UserOp 서명 로직** | `internal/client/signer.go` | ✅ 완료 (테스트 포함) |
| 2.4 | Smart Account 인가 검증 | `internal/client/permission.go` | ✅ 완료 |
| 2.5 | 실패 재시도 + Circuit Breaker | `internal/resilience/` | ✅ 완료 (테스트 포함) |
| 2.6 | 구조적 로깅 | `internal/logger/logger.go` | ✅ 완료 (slog) |
| 2.7 | 테스트 작성 | `internal/*_test.go` | ✅ 완료 (6 packages) |

**추가 구현 완료**:
- OpenAPI 3.0 스펙 (`api/openapi.yaml`, 516 LOC)
- Prometheus 메트릭 (`internal/metrics/`, 474 LOC)
- Rate Limiting 미들웨어 (`internal/middleware/ratelimit.go`)
- Idempotency 미들웨어 (`internal/middleware/idempotency.go`)
- Validation 패키지 (`internal/validation/`)

**남은 작업**: Docker Compose 설정 (P1으로 이동)

---

### Phase 3: 프론트엔드 (User Experience) ✅ 100% 완료

SDK 플러그인을 사용하여 완전한 구독 관리 UI를 구축합니다.

| ID | 작업 | 위치 | 상태 | LOC |
|----|------|------|------|-----|
| 3.1 | `useSubscription` Hook | `apps/web/hooks/` | ✅ 완료 | 695 |
| 3.2 | `useSessionKey` Hook | `apps/web/hooks/` | ✅ 완료 | 560 |
| 3.3 | `useRecurringPayment` Hook | `apps/web/hooks/` | ✅ 완료 | 650 |
| 3.4 | 구독 플랜 목록 페이지 | `apps/web/app/subscription/plans/` | ✅ 완료 | 168 |
| 3.5 | 구독 신청 플로우 | `apps/web/components/subscription/` | ✅ 완료 | 971 |
| 3.6 | 내 구독 관리 대시보드 | `apps/web/app/subscription/` | ✅ 완료 | 256 |
| 3.7 | Session Key 관리 UI | `apps/web/components/session-keys/` | ✅ 완료 | - |

**총 3,563 LOC 구현 완료**

**구현 완료 내역**:
- **Hooks** (1,905 LOC):
  - `useSubscription.ts` - 플랜 조회, 구독 생성/취소, 상태 폴링
  - `useSessionKey.ts` - 세션키 생성/폐기, 권한 부여
  - `useRecurringPayment.ts` - 스케줄 생성/취소, 실행 이력
- **Pages** (687 LOC):
  - `/subscription/page.tsx` - 내 구독 관리 대시보드
  - `/subscription/plans/page.tsx` - 플랜 목록 및 구독 신청
  - `/subscription/merchant/page.tsx` - 가맹점 대시보드
- **Components** (971 LOC):
  - `SubscriptionPlanCard.tsx`, `PermissionModal.tsx`
  - `CreatePlanForm.tsx`, `SubscriptionList.tsx`, `PaymentHistory.tsx`
- **Session Key UI**: 별도 4개 컴포넌트 + 페이지
- **E2E 테스트**: 746 LOC

---

## 3. P1: High Priority - 핵심 기능 보완

> **목표**: 컨트랙트 완성 및 품질/보안 강화
> **예상 작업량**: 10개 태스크

### 3.1 스마트 컨트랙트

| ID | 작업 | 위치 | 설명 | 완성도 |
|----|------|------|------|--------|
| C-1 | `DelegateKernel.sol` | `poc-contract/src/delegation/` | EIP-7702 전용 Smart Account | ✅ 100% |
| C-2 | `DelegationRegistry.sol` | `poc-contract/src/delegation/` | 위임 등록소 | ✅ 100% |
| C-3 | Enterprise Stealth 컨트랙트 | `poc-contract/src/privacy/enterprise/` | StealthVault, StealthLedger, WithdrawalManager, RoleManager | ✅ 100% |
| C-4 | 퍼징 테스트 | `poc-contract/test/` | SubscriptionManager, RecurringPaymentExecutor 경계값 검증 | 0% |
| C-5 | 크로스모듈 통합 테스트 | `poc-contract/test/` | SubscriptionManager ↔ ERC7715 ↔ RecurringPaymentExecutor | 0% |

**P1 컨트랙트 구현 완료 (2,793 LOC)**:
- `DelegationRegistry.sol` (492 LOC) - EIP-712 서명, 시간제한 위임, 지출 한도
- `DelegateKernel.sol` (483 LOC) - EIP-7702 Smart Account, 배치 실행, 가디언 복구
- `StealthVault.sol` (368 LOC) - 멀티토큰 지원, 스텔스 주소 입금
- `StealthLedger.sol` (349 LOC) - 잔액 추적, 트랜잭션 이력
- `WithdrawalManager.sol` (383 LOC) - 쿨다운 기반 출금 워크플로우
- `RoleManager.sol` (455 LOC) - 시간제한 역할 할당, 세분화된 권한 관리

### 3.2 품질/보안

| ID | 작업 | 위치 | 상태 |
|----|------|------|------|
| Q-1 | E2E 테스트 | `tests/e2e/` | ✅ 완료 (746 LOC) |
| Q-2 | 보안 감사 준비 | 전체 | ❌ 미완료 |
| Q-3 | 메트릭/모니터링 | `services/` | ✅ 완료 (Prometheus 메트릭) |
| Q-4 | Docker Compose | `services/` | ❌ 미완료 |
| Q-5 | API 문서화 (OpenAPI) | `services/` | ✅ 완료 (516 LOC) |

---

## 4. P2: Medium Priority - 확장 기능

> **목표**: DeFi 통합 및 운영 기능 완성
> **예상 작업량**: 8개 태스크

### 4.1 DeFi 컨트랙트

| ID | 작업 | 설명 | 현재 상태 |
|----|------|------|----------|
| D-1 | SwapRouter | DEX 스왑 라우터 | 부분 구현 |
| D-2 | LendingPool | 대출 풀 | 미구현 |
| D-3 | StakingVault | 스테이킹 볼트 | 미구현 |

### 4.2 기타 확장

| ID | 작업 | 위치 | 설명 |
|----|------|------|------|
| O-1 | ERC-20 Paymaster 완성 | `plugins/paymaster/` | 현재 stub (zero address) |
| O-2 | 분산 잠금 (Multi-Instance) | 서비스 | Redis/PostgreSQL advisory lock |
| O-3 | Webhook/이벤트 알림 | 서비스 | 결제 성공/실패, 구독 만료 콜백 |
| O-4 | 가맹점(Merchant) 관리 UI | `apps/web/pages/merchant/` | 플랜 생성, 구독자 목록, 수익 대시보드 |
| O-5 | 테스트넷 배포 | - | 실제 네트워크 배포 및 SDK 연동 |

---

## 5. 의존성 다이어그램

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
   │                               │
   ▼                               ▼
Phase 4 (Production Readiness) ─ P1 + P2
  C-4, C-5 컨트랙트 테스트 (병렬 진행 가능)
  Q-1 E2E 테스트 (Phase 2+3 완료 후)
  Q-2~Q-5 품질/보안/운영
```

---

## 6. 작업 요약

| 우선순위 | 총 작업 | 완료 | 남은 작업 | 진행률 |
|----------|---------|------|-----------|--------|
| **P0 (Critical)** | 21개 | 21개 | 0개 | ✅ 100% |
| **P1 (High)** | 10개 | 6개 | 4개 | 60% |
| **P2 (Medium)** | 8개 | 0개 | 8개 | 0% |
| **총합** | **39개** | **27개** | **12개** | **69%** |

### P0 완료! 🎉

**구독 결제 시스템 전체 구현 완료**:
- SDK Plugin: 2,986 LOC (71 tests)
- Backend: 6,012 LOC (6 test packages)
- Frontend: 3,563 LOC
- E2E Tests: 746 LOC
- **총 13,307 LOC**

### P1 컨트랙트 완료! 🎉

**EIP-7702 Delegation + Enterprise Stealth 컨트랙트 구현 완료**:
- Delegation System: 975 LOC (DelegationRegistry + DelegateKernel)
- Enterprise Stealth: 1,555 LOC (Vault + Ledger + Withdrawal + Role)
- **총 2,793 LOC** (6개 컨트랙트)

### 다음 단계 (권장 순서)
1. **P1 테스트**: 퍼징 테스트 (C-4), 통합 테스트 (C-5)
2. **P1 품질**: Docker Compose, 보안 감사 준비 (Slither/Mythril)
3. **P2 DeFi**: SwapRouter, LendingPool, StakingVault

---

## 7. 참조 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 구독 구현 계획 | `docs/EIP7702_Subscription_Implementation_Plan.md` | 상세 구현 계획 및 API 설계 |
| 컨트랙트 개요 | `docs/contracts/00_CONTRACTS_OVERVIEW.md` | 컨트랙트 아키텍처 및 Gap 분석 |
| PoC 종합 설계서 | `docs/poc/00_PoC_Overview.md` | PoC 9대 핵심 기능 정의 |
| 기술 로드맵 | `docs/roadmap/StableNet_기술_로드맵.md` | 24개월 전체 로드맵 |

---

*이 문서는 `docs/EIP7702_Subscription_Implementation_Plan.md` 및 `docs/contracts/00_CONTRACTS_OVERVIEW.md`를 기반으로 작성되었습니다.*
