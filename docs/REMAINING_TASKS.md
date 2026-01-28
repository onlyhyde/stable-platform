# StableNet PoC 남은 작업 리스트

> **최종 업데이트**: 2026-01-28
> **현재 진행률**: 약 70%
> **완료 영역**: Simulator Services (100%), Core Contracts (80-95%)

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
| SDK (Core) | 70% | ⚠️ 구독 플러그인 없음 |
| Backend (subscription-executor) | 60% | ⚠️ 서명/재시도 로직 없음 |
| Frontend | 30% | ❌ 구독 UI 없음 |

### 1.2 PoC 9대 핵심 기능 현황

```
1. Smart Account (EIP-7702)     ███████░░░  70%
2. Paymaster (가스대납)          █████████░  85%
3. Token Gas Payment            █████████░  85%
4. Subscription (정기결제)       ██████░░░░  60%  ← 백엔드/프론트 미완
5. ERC-7579 Modules             ███████░░░  70%
6. DEX (Uniswap V3)             ████░░░░░░  35%
7. Bundler (ERC-4337)           ████████░░  80%
8. Stealth Address              █████████░  90%  (Standard만)
9. Regulatory Compliance        ████████░░  80%
```

---

## 2. P0: Critical - 구독 결제 시스템

> **목표**: EIP-7702 + ERC-7715 기반 구독 결제 시스템 완성
> **예상 작업량**: 21개 태스크

### Phase 1: SDK 플러그인 (Foundation)

SDK에 구독 관련 플러그인을 추가하여 프론트엔드/백엔드 모두 재사용할 수 있도록 합니다.

| ID | 작업 | 위치 | 설명 | 의존성 |
|----|------|------|------|--------|
| 1.1 | `@stablenet/plugin-subscription` 생성 | `plugins/subscription/` | 패키지 스캐폴딩, tsconfig, tsup 설정 | 없음 |
| 1.2 | 컨트랙트 ABI/주소 등록 | `packages/contracts/` | SubscriptionManager, ERC7715PermissionManager, RecurringPaymentExecutor | 1.1 |
| 1.3 | `subscriptionClient` 구현 | `plugins/subscription/src/` | 플랜 CRUD, 구독 생성/취소, 결제 처리 인코딩 | 1.2 |
| 1.4 | `recurringPaymentClient` 구현 | `plugins/subscription/src/` | 스케줄 생성/취소, 결제 실행, 배치 처리 | 1.2 |
| 1.5 | `permissionClient` 구현 | `plugins/subscription/src/` | ERC-7715 권한 부여/폐기/조회 헬퍼 | 1.2 |
| 1.6 | 단위 테스트 | `plugins/subscription/tests/` | 인코딩/디코딩, 타입 안전성 (450+ LOC 목표) | 1.3-1.5 |
| 1.7 | 통합 테스트 (devnet) | `tests/integration/` | 플랜 생성 → 구독 → 결제 실행 플로우 | 1.6 |

**산출물**:
```
plugins/subscription/
├── src/
│   ├── index.ts
│   ├── subscriptionClient.ts
│   ├── recurringPaymentClient.ts
│   ├── permissionClient.ts
│   ├── types.ts
│   ├── abi.ts
│   └── constants.ts
├── tests/
│   └── index.test.ts
└── package.json
```

---

### Phase 2: 백엔드 서비스 (Scheduler)

Go 서비스를 스케줄러 역할로 축소하고, 핵심 블록체인 로직은 SDK에 위임합니다.

| ID | 작업 | 위치 | 설명 | 의존성 |
|----|------|------|------|--------|
| 2.1 | 아키텍처 결정 | - | Go 유지 vs Node.js 전환 평가 | Phase 1 |
| 2.2 | 서비스 구현/리팩토링 | `services/subscription-*` | SDK 호출 구조로 변경 | 2.1 |
| 2.3 | **UserOp 서명 로직** | 서비스 | placeholder(`0x01...01`) 제거, 실제 서명 구현 | 2.2 |
| 2.4 | Smart Account 인가 검증 | 서비스 | 실행 전 권한 유효성 확인 | 2.2, 1.5 |
| 2.5 | 실패 재시도 + Circuit Breaker | 서비스 | Exponential backoff (최대 3회) | 2.3 |
| 2.6 | 구조적 로깅 | 서비스 | Go: `slog` / Node.js: `pino` | 2.2 |
| 2.7 | 테스트 작성 | 서비스 | 커버리지 60%+ 목표 | 2.3-2.6 |

**현재 문제점**:
- UserOp 서명: placeholder 상태 → 실제 서명 로직 없음
- Smart Account 인가 검증 없음
- 실패 재시도/circuit breaker 없음
- 테스트 커버리지 ~15%
- 로깅/모니터링 없음

---

### Phase 3: 프론트엔드 (User Experience)

SDK 플러그인을 사용하여 완전한 구독 관리 UI를 구축합니다.

| ID | 작업 | 위치 | 설명 | 의존성 |
|----|------|------|------|--------|
| 3.1 | `useSubscription` Hook | `apps/web/hooks/` | 플랜 조회, 구독 생성/취소, 상태 폴링 | Phase 1 |
| 3.2 | `useSessionKey` Hook | `apps/web/hooks/` | 세션키 생성/폐기, 권한 부여, 잔여 한도 | Phase 1 |
| 3.3 | `useRecurringPayment` Hook | `apps/web/hooks/` | 스케줄 생성/취소, 실행 이력 | Phase 1 |
| 3.4 | 구독 플랜 목록 페이지 | `apps/web/pages/subscription/` | 플랜 카드 목록, 가격/주기 표시 | 3.1 |
| 3.5 | 구독 신청 플로우 | `apps/web/components/subscription/` | 플랜 선택 → 권한 부여 → 세션키 → 확인 | 3.1-3.3 |
| 3.6 | 내 구독 관리 대시보드 | `apps/web/pages/subscription/` | 활성 구독, 결제 이력, 취소/일시정지 | 3.1 |
| 3.7 | Session Key 관리 UI | `apps/web/components/session-keys/` | 세션키 목록, 잔여 한도, 폐기 | 3.2 |

**현재 상태**:
- 존재: Smart Account 관리 UI (`/smart-account`)
- 없음: 구독 UI, Session Key 관리 UI, useSubscription/useSessionKey Hook

---

## 3. P1: High Priority - 핵심 기능 보완

> **목표**: 컨트랙트 완성 및 품질/보안 강화
> **예상 작업량**: 10개 태스크

### 3.1 스마트 컨트랙트

| ID | 작업 | 위치 | 설명 | 완성도 |
|----|------|------|------|--------|
| C-1 | `DelegateKernel.sol` | `poc-contract/src/` | EIP-7702 전용 Smart Account | 0% |
| C-2 | `DelegationRegistry.sol` | `poc-contract/src/` | 위임 등록소 | 0% |
| C-3 | Enterprise Stealth 컨트랙트 | `poc-contract/src/stealth/` | StealthVault, StealthLedger, WithdrawalManager, RoleManager | 0% |
| C-4 | 퍼징 테스트 | `poc-contract/test/` | SubscriptionManager, RecurringPaymentExecutor 경계값 검증 | 0% |
| C-5 | 크로스모듈 통합 테스트 | `poc-contract/test/` | SubscriptionManager ↔ ERC7715 ↔ RecurringPaymentExecutor | 0% |

### 3.2 품질/보안

| ID | 작업 | 위치 | 설명 |
|----|------|------|------|
| Q-1 | E2E 테스트 | `tests/e2e/` | 컨트랙트 배포 → 7702 위임 → 7715 권한 → 구독 → 결제 → 취소 |
| Q-2 | 보안 감사 준비 | 전체 | Slither/Mythril 정적 분석, replay 방어 확인 |
| Q-3 | 메트릭/모니터링 | `services/` | Prometheus: 실행 성공/실패, 지연시간, pending 구독 수 |
| Q-4 | Docker Compose | `services/` | PostgreSQL + scheduler + bundler + paymaster |
| Q-5 | API 문서화 (OpenAPI) | `services/` | REST API 스펙, req/res 스키마, 에러 코드 |

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

| 우선순위 | 작업 수 | 영역 | 권장 순서 |
|----------|---------|------|----------|
| **P0 (Critical)** | 21개 | SDK 플러그인, 백엔드, 프론트엔드 | 1순위 |
| **P1 (High)** | 10개 | 컨트랙트 보완, 품질/보안 | 2순위 |
| **P2 (Medium)** | 8개 | DeFi, 확장 기능 | 3순위 |
| **총합** | **39개** | - | - |

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
