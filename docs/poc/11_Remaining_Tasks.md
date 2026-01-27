# 11. Remaining Tasks - StableNet PoC 남은 작업 목록

> **작성일**: 2026-01-26
> **최종 업데이트**: 2026-01-27
> **상태**: Active
> **총 작업 수**: 67건 (완료 22건, 남은 작업 45건)

## 목차

1. [개요](#1-개요)
2. [전체 진행 현황](#2-전체-진행-현황)
3. [CRITICAL 작업](#3-critical-작업)
4. [HIGH 작업](#4-high-작업)
5. [MEDIUM 작업](#5-medium-작업)
6. [LOW 작업](#6-low-작업)
7. [Sprint 계획](#7-sprint-계획)
8. [변경 이력](#8-변경-이력)

---

## 1. 개요

본 문서는 StableNet PoC 코드 리뷰 및 문서 검토 결과를 바탕으로 도출된 남은 작업 목록을 정리한 것입니다.

### 1.1 작업 분류 기준

| 우선순위 | 설명 | 목표 기간 |
|----------|------|----------|
| 🔴 CRITICAL | 보안/핵심 기능. 즉시 수정 필요 | 2-3주 |
| 🟠 HIGH | 주요 품질 문제. 빠른 수정 필요 | 2주 |
| 🟡 MEDIUM | 운영 안정성/코드 품질. 계획적 수정 | 2-3주 |
| 🟢 LOW | 개선 권장. 유지보수성 향상 | 4-6주 |

### 1.2 작업 요약

| 우선순위 | 건수 | 완료 | 남은 건수 |
|----------|------|------|----------|
| 🔴 CRITICAL | 15 | 15 | 0 |
| 🟠 HIGH | 14 | 7 | 7 |
| 🟡 MEDIUM | 15 | 0 | 15 |
| 🟢 LOW | 23 | 0 | 23 |
| **합계** | **67** | **22** | **45** |

---

## 2. 전체 진행 현황

### 2.1 구현 완성도

```
Smart Contracts       ████████████████████  95% ✅ (110 .sol files in poc-contract)
Packages (SDK)        ████████████████████ 100% ✅
Services              ███████████████████░  95% ✅ (bridge-relayer implemented)
Apps                  ████████████████████ 100% ✅
Simulators            ████████████████████ 100% ✅
테스트 커버리지        ███████████░░░░░░░░░  ~55% ⚠️ (SDK 8 packages + Go 4 services)
```

> **참고**: 스마트 컨트랙트는 `poc-contract/src/` 경로에 별도 관리됨

### 2.2 스마트 컨트랙트 현황 (poc-contract/src/)

| 카테고리 | 컨트랙트 수 | 상태 |
|----------|------------|------|
| erc4337-entrypoint | 8 | ✅ 완료 |
| erc7579-smartaccount | 12 | ✅ 완료 |
| erc7579-validators | 5 | ✅ 완료 |
| erc7579-executors | 2 | ✅ 완료 |
| erc7579-hooks | 2 | ✅ 완료 |
| erc7579-fallbacks | 2 | ✅ 완료 |
| erc7579-plugins | 3 | ✅ 완료 |
| erc4337-paymaster | 5 | ✅ 완료 |
| privacy | 3 | ✅ 완료 |
| subscription | 2 | ✅ 완료 |
| bridge | 6 | ✅ 완료 |
| compliance | 4 | ✅ 완료 |
| defi | 2 | ✅ 완료 |
| permit2 | 8 | ✅ 완료 |
| tokens | 2 | ✅ 완료 |

### 2.3 Phase별 진행 상황

| Phase | 내용 | 완성도 |
|-------|------|--------|
| Phase 0 | Foundation | 100% ✅ |
| Phase 1 | SDK Core | 100% ✅ |
| Phase 2 | Bundler | 100% ✅ |
| Phase 3 | Paymaster | 100% ✅ |
| Phase 4 | Stealth | 100% ✅ |
| Phase 5 | Wallet | 100% ✅ |
| Phase 6 | Web Frontend | 100% ✅ |
| Phase 7 | 추가 서비스 | 95% ✅ |

---

## 3. CRITICAL 작업

### C-01. SDK 테스트 작성 (커버리지 0% → 80%+) ✅ 완료

**배경**: ~~모든 SDK 테스트 파일이 `.todo()` stub 상태. 핵심 암호화 로직 검증 없이 사용 중.~~ → **2026-01-27 검증 완료: 전체 8 packages, 3,471 LOC, 241 tests, 579 assertions. `.todo()`/`.skip()` 없음.**

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| C-01-1 | plugin-ecdsa 테스트 | `packages/sdk/plugins/ecdsa/tests/` | ✅ 완료 (171 LOC, 18 tests, 31 assertions) |
| C-01-2 | plugin-paymaster 테스트 | `packages/sdk/plugins/paymaster/tests/` | ✅ 완료 (383 LOC, 20 tests, 48 assertions) |
| C-01-3 | plugin-session-keys 테스트 | `packages/sdk/plugins/session-keys/tests/` | ✅ 완료 (450 LOC, 24 tests, 58 assertions) |
| C-01-4 | plugin-stealth 테스트 | `packages/sdk/plugins/stealth/tests/` | ✅ 완료 (700 LOC, 42 tests, 98 assertions) |
| C-01-5 | core 패키지 테스트 | `packages/sdk/packages/core/tests/` | ✅ 완료 (521 LOC, 46 tests, 119 assertions) |
| C-01-6 | accounts 패키지 테스트 | `packages/sdk/packages/accounts/tests/` | ✅ 완료 (388 LOC, 30 tests, 73 assertions) |
| C-01-7 | @stablenet/types 테스트 | `packages/types/tests/` | ✅ 완료 (179 LOC, 18 tests, 44 assertions) |
| C-01-8 | @stablenet/config 테스트 | `packages/config/tests/` | ✅ 완료 (379 LOC, 43 tests, 104 assertions) |

### C-02. Bridge Relayer 완전 구현 ✅ 완료

**배경**: ~~현재 Stub 상태. MPC + Optimistic 브릿지 핵심 기능 미구현.~~ → **2026-01-26 구현 완료 (~2,900 LOC)**

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| C-02-1 | MPC Signer Service 구현 | `services/bridge-relayer/internal/mpc/signer.go` | ✅ 완료 |
| C-02-2 | Fraud Proof Verifier 구현 | `services/bridge-relayer/internal/fraud/fraud_monitor.go` | ✅ 완료 |
| C-02-3 | Rate Limiting 구현 | `services/bridge-relayer/internal/middleware/middleware.go` | ✅ 완료 |
| C-02-4 | Challenge 시스템 구현 | `services/bridge-relayer/internal/executor/bridge_executor.go` | ✅ 완료 |
| C-02-5 | Bridge Monitor 구현 | `services/bridge-relayer/internal/monitor/event_monitor.go` | ✅ 완료 |
| C-02-6 | 이벤트 리스너 구현 | `services/bridge-relayer/internal/monitor/event_monitor.go` | ✅ 완료 |
| C-02-7 | Emergency Pause 구현 | `services/bridge-relayer/internal/guardian/guardian_monitor.go` | ✅ 완료 |

---

## 4. HIGH 작업

### H-01. PG Simulator 완성 ✅

**배경**: 카드 번호 검증 로직 및 3D Secure 시뮬레이션 구현 완료.

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| H-01-1 | 카드 번호 Luhn 검증 | `services/pg-simulator/internal/service/payment.go` | ✅ 완료 |
| H-01-2 | CVV 검증 | `services/pg-simulator/internal/service/payment.go` | ✅ 완료 |
| H-01-3 | 만료일 검증 | `services/pg-simulator/internal/service/payment.go` | ✅ 완료 |
| H-01-4 | 3D Secure 시뮬레이션 | `services/pg-simulator/internal/service/payment.go` | ✅ 완료 |

### H-02. Go 서비스 단위 테스트 추가 (부분 완료)

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| H-02-1 | order-router 테스트 | `services/order-router/internal/*_test.go` | ✅ 완료 (7 test files) |
| H-02-2 | subscription-executor 테스트 | `services/subscription-executor/internal/*_test.go` | ✅ 완료 (3 test files) |
| H-02-3 | bank-simulator 테스트 | `services/bank-simulator/internal/*_test.go` | ⬜ 미완료 |
| H-02-4 | pg-simulator 테스트 | `services/pg-simulator/internal/*_test.go` | ✅ 완료 (1 test file, 306 LOC) |
| H-02-5 | onramp-simulator 테스트 | `services/onramp-simulator/internal/*_test.go` | ⬜ 미완료 |

### H-03. E2E 테스트 작성

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| H-03-1 | UserOp 전체 흐름 E2E | `tests/e2e/userOp.spec.ts` | ⬜ 미완료 |
| H-03-2 | Stealth 전송 E2E | `tests/e2e/stealth.spec.ts` | ⬜ 미완료 |
| H-03-3 | 구독 결제 E2E | `tests/e2e/subscription.spec.ts` | ⬜ 미완료 |
| H-03-4 | Paymaster 가스 대납 E2E | `tests/e2e/paymaster.spec.ts` | ⬜ 미완료 |
| H-03-5 | Wallet Extension E2E | `tests/e2e/wallet.spec.ts` | ⬜ 미완료 |

---

## 5. MEDIUM 작업

### M-01. 구조화된 로깅 도입

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-01-1 | bundler 로깅 개선 | `services/bundler/src/utils/logger.ts` | ⬜ 미완료 |
| M-01-2 | paymaster-proxy 로깅 개선 | `services/paymaster-proxy/src/utils/logger.ts` | ⬜ 미완료 |
| M-01-3 | stealth-server 로깅 개선 | `services/stealth-server/src/utils/` | ⬜ 미완료 |
| M-01-4 | wallet-extension console 정리 | `apps/wallet-extension/src/**/*.ts` | ⬜ 미완료 |
| M-01-5 | Go 서비스 로깅 통일 | `services/*/internal/logger/` | ⬜ 미완료 |

### M-02. 하드코딩 상수 외부화

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-02-1 | bundler 상수 외부화 | `services/bundler/src/config/` | ⬜ 미완료 |
| M-02-2 | paymaster-proxy 상수 외부화 | `services/paymaster-proxy/src/config/` | ⬜ 미완료 |
| M-02-3 | SDK 상수 외부화 | `packages/config/src/` | ⬜ 미완료 |
| M-02-4 | web 앱 상수 외부화 | `apps/web/lib/config/` | ⬜ 미완료 |
| M-02-5 | wallet-extension 상수 외부화 | `apps/wallet-extension/src/config/` | ⬜ 미완료 |

### M-03. 에러 처리 강화

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-03-1 | wallet-extension BaseApi 에러 처리 | `apps/wallet-extension/src/shared/api/` | ⬜ 미완료 |
| M-03-2 | web 앱 에러 바운더리 | `apps/web/components/error/` | ⬜ 미완료 |
| M-03-3 | SDK 에러 타입 정의 | `packages/sdk/packages/core/src/errors/` | ⬜ 미완료 |

### M-04. 입력 검증 강화

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-04-1 | onramp-simulator 검증 추가 | `services/onramp-simulator/internal/validation/` | ⬜ 미완료 |
| M-04-2 | bank-simulator 검증 추가 | `services/bank-simulator/internal/validation/` | ⬜ 미완료 |

### M-05. Idempotency 구현

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-05-1 | subscription-executor idempotency | `services/subscription-executor/internal/` | ⬜ 미완료 |
| M-05-2 | bridge-relayer idempotency | `services/bridge-relayer/src/` | ⬜ 미완료 |

---

## 6. LOW 작업

### L-01. 코드 품질 개선

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| L-01-1 | `as any` 타입 제거 (wallet-extension) | `apps/wallet-extension/src/**/*.ts` | ⬜ 미완료 |
| L-01-2 | bundler 테스트 `as any` 제거 | `services/bundler/tests/**/*.ts` | ⬜ 미완료 |
| L-01-3 | 미사용 import 정리 | 전체 | ⬜ 미완료 |
| L-01-4 | TODO/FIXME 해결 | 전체 | ⬜ 미완료 |

### L-02. 문서화

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| L-02-1 | SDK API Reference | `docs/sdk/api/` | ⬜ 미완료 |
| L-02-2 | Service API Reference | `docs/services/` | ⬜ 미완료 |
| L-02-3 | 배포 가이드 | `docs/deployment/` | ⬜ 미완료 |
| L-02-4 | 운영 가이드 | `docs/operations/` | ⬜ 미완료 |
| L-02-5 | SDK Tutorial | `docs/tutorials/` | ⬜ 미완료 |

### L-03. 인프라 개선

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| L-03-1 | Health Check 엔드포인트 통일 | 모든 서비스 | ⬜ 미완료 |
| L-03-2 | Prometheus 메트릭 추가 | 모든 서비스 | ⬜ 미완료 |
| L-03-3 | Grafana 대시보드 | `infra/grafana/` | ⬜ 미완료 |
| L-03-4 | AlertManager 설정 | `infra/alertmanager/` | ⬜ 미완료 |

### L-04. DeFi 기능 완성 (Phase 2)

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| L-04-1 | Uniswap V3 배포 스크립트 | `contracts/script/` | ⬜ 미완료 |
| L-04-2 | TWAP Oracle 구현 확인 | `contracts/src/oracle/` | ⬜ 미완료 |
| L-04-3 | Permit2Paymaster 연동 | `packages/sdk/plugins/paymaster/` | ⬜ 미완료 |

### L-05. Module Marketplace (Phase 6)

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| L-05-1 | Marketplace UI | `apps/web/app/marketplace/` | ⬜ 미완료 |
| L-05-2 | Module Registry 백엔드 | `services/module-registry/` | ⬜ 미완료 |
| L-05-3 | 모듈 설치 API | `apps/wallet-extension/` | ⬜ 미완료 |

---

## 7. Sprint 계획

### Sprint 1 (Week 1-2) - ✅ 완료

**목표**: SDK 플러그인 테스트, console 정리

| ID | 작업 | 담당 | 상태 |
|----|------|------|------|
| C-01-1 | plugin-ecdsa 테스트 | - | ✅ 완료 |
| C-01-2 | plugin-paymaster 테스트 | - | ✅ 완료 |
| C-01-3 | plugin-session-keys 테스트 | - | ✅ 완료 |
| C-01-4 | plugin-stealth 테스트 | - | ✅ 완료 |
| M-01-4 | wallet-extension console 정리 | - | ⬜ 미완료 |

**완료된 작업 (H-01)**:
- ✅ H-01-1: 카드 번호 Luhn 검증
- ✅ H-01-2: CVV 검증
- ✅ H-01-3: 만료일 검증
- ✅ H-01-4: 3D Secure 시뮬레이션

### Sprint 2 (Week 3-4) - ✅ 완료

**목표**: SDK 나머지 테스트, Go 서비스 테스트

| ID | 작업 | 상태 |
|----|------|------|
| C-01-5 | core 패키지 테스트 | ✅ 완료 |
| C-01-6 | accounts 패키지 테스트 | ✅ 완료 |
| C-01-7 | @stablenet/types 테스트 | ✅ 완료 |
| C-01-8 | @stablenet/config 테스트 | ✅ 완료 |
| H-02-1 | order-router 테스트 | ✅ 완료 |
| H-02-2 | subscription-executor 테스트 | ✅ 완료 |
| H-02-3 | bank-simulator 테스트 | ⬜ 미완료 |

### Sprint 3 (Week 5-6) - 부분 완료

**목표**: E2E 테스트, 구조화된 로깅, Go 서비스 테스트 완료

| ID | 작업 | 상태 |
|----|------|------|
| H-02-4 | pg-simulator 테스트 | ✅ 완료 |
| H-02-5 | onramp-simulator 테스트 | ⬜ 미완료 |
| H-03-1 | UserOp 전체 흐름 E2E | ⬜ 미완료 |
| H-03-2 | Stealth 전송 E2E | ⬜ 미완료 |
| H-03-3 | 구독 결제 E2E | ⬜ 미완료 |
| M-01-1 | bundler 로깅 개선 | ⬜ 미완료 |
| M-01-2 | paymaster-proxy 로깅 개선 | ⬜ 미완료 |
| M-01-3 | stealth-server 로깅 개선 | ⬜ 미완료 |

### Sprint 4 (Week 7-8)

**목표**: E2E 테스트 완료, 상수 외부화, 에러 처리 강화

| ID | 작업 |
|----|------|
| H-03-4 | Paymaster 가스 대납 E2E |
| H-03-5 | Wallet Extension E2E |
| M-02-1 ~ M-02-5 | 하드코딩 상수 외부화 |
| M-03-1 ~ M-03-3 | 에러 처리 강화 |
| M-04-1 | onramp-simulator 검증 추가 |
| M-04-2 | bank-simulator 검증 추가 |

### Sprint 5+ (Week 9~)

LOW 우선순위 작업들 순차 진행

---

## 8. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-26 | 초기 작업 목록 작성 (총 67건) |
| 2026-01-26 | 스마트 컨트랙트 현황 추가 (poc-contract 69개 컨트랙트 반영) |
| 2026-01-26 | C-02 Bridge Relayer 구현 완료 (7건 완료, 남은 작업 60건) |
| 2026-01-26 | H-01 PG Simulator 완성 (Luhn, CVV, 만료일 검증 + 3D Secure 시뮬레이션) - 11건 완료, 남은 작업 56건 |
| 2026-01-27 | C-01 SDK 테스트 전체 완료 확인 (8 packages, 3,471 LOC, 241 tests, 579 assertions). H-02 Go 서비스 테스트 부분 완료 (order-router 7, subscription-executor 3, pg-simulator 1). Sprint 1-2 완료, Sprint 3 부분 완료 - 22건 완료, 남은 작업 45건 |

---

## 9. 관련 문서

- [12_Development_Progress_Report.md](./12_Development_Progress_Report.md) - 종합 개발 진행 상황 보고서

---

*문서 끝*
