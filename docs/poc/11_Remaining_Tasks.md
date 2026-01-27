# 11. Remaining Tasks - StableNet PoC 남은 작업 목록

> **작성일**: 2026-01-26
> **최종 업데이트**: 2026-01-27
> **상태**: Active

## 목차

1. [작업 요약](#1-작업-요약)
2. [전체 진행 현황](#2-전체-진행-현황)
3. [완료된 작업](#3-완료된-작업)
4. [남은 작업 - HIGH](#4-남은-작업---high)
5. [남은 작업 - MEDIUM](#5-남은-작업---medium)
6. [남은 작업 - LOW](#6-남은-작업---low)
7. [Sprint 계획](#7-sprint-계획)
8. [변경 이력](#8-변경-이력)

---

## 1. 작업 요약

| 우선순위 | 전체 | 완료 | 남은 건수 |
|----------|------|------|----------|
| 🔴 CRITICAL | 15 | 15 | **0** |
| 🟠 HIGH | 14 | 7 | **7** |
| 🟡 MEDIUM | 17 | 0 | **17** (1건 부분 완료) |
| 🟢 LOW | 23 | 0 | **23** |
| **합계** | **69** | **22** | **47** |

### 분류 기준

| 우선순위 | 설명 |
|----------|------|
| 🔴 CRITICAL | 보안/핵심 기능. 즉시 수정 필요 |
| 🟠 HIGH | 주요 품질 문제. 빠른 수정 필요 |
| 🟡 MEDIUM | 운영 안정성/코드 품질. 계획적 수정 |
| 🟢 LOW | 개선 권장. 유지보수성 향상 |

---

## 2. 전체 진행 현황

```
Smart Contracts       ████████████████████  95% ✅ (110 .sol files in poc-contract)
Packages (SDK)        ████████████████████ 100% ✅
Services              ███████████████████░  95% ✅
Apps                  ████████████████████ 100% ✅
Simulators            ████████████████████ 100% ✅
테스트 커버리지        ███████████░░░░░░░░░  ~55% ⚠️ (SDK 285 tests + Go 4 services)
```

| Phase | 내용 | 완성도 |
|-------|------|--------|
| Phase 0-3 | Foundation ~ Paymaster | 100% ✅ |
| Phase 4 | Stealth | 100% ✅ |
| Phase 5 | Wallet | 100% ✅ |
| Phase 6 | Web Frontend | 100% ✅ |
| Phase 7 | 추가 서비스 | 95% ✅ |

---

## 3. 완료된 작업

### 🔴 CRITICAL - 전체 완료 (15/15)

**C-01. SDK 테스트 작성** ✅ — 8 packages, 285 tests ALL PASS (vitest 검증 완료)

| ID | 패키지 | Tests |
|----|--------|-------|
| C-01-1 | plugin-ecdsa | 15 |
| C-01-2 | plugin-paymaster | 16 |
| C-01-3 | plugin-session-keys | 22 |
| C-01-4 | plugin-stealth | 57 |
| C-01-5 | core | 55 |
| C-01-6 | accounts | 30 |
| C-01-7 | @stablenet/types | 28 |
| C-01-8 | @stablenet/config | 62 |

**C-02. Bridge Relayer 구현** ✅ — ~2,900 LOC (MPC Signer, Fraud Proof, Monitor, Guardian 등 7개 컴포넌트)

### 🟠 HIGH 완료 항목 (7/14)

**H-01. PG Simulator 완성** ✅ — Luhn/CVV/만료일 검증 + 3D Secure 시뮬레이션

**H-02. Go 서비스 테스트 (3/5 완료)**:
- ✅ H-02-1: order-router (7 test files)
- ✅ H-02-2: subscription-executor (3 test files)
- ✅ H-02-4: pg-simulator (1 test file, 306 LOC)

---

## 4. 남은 작업 - HIGH

> 🟠 **7건 미완료**

### H-02. Go 서비스 단위 테스트 (2건 미완료)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| H-02-3 | bank-simulator 테스트 | `services/bank-simulator/internal/*_test.go` |
| H-02-5 | onramp-simulator 테스트 | `services/onramp-simulator/internal/*_test.go` |

### H-03. E2E 테스트 작성 (5건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| H-03-1 | UserOp 전체 흐름 E2E | `tests/e2e/userOp.spec.ts` |
| H-03-2 | Stealth 전송 E2E | `tests/e2e/stealth.spec.ts` |
| H-03-3 | 구독 결제 E2E | `tests/e2e/subscription.spec.ts` |
| H-03-4 | Paymaster 가스 대납 E2E | `tests/e2e/paymaster.spec.ts` |
| H-03-5 | Wallet Extension E2E | `tests/e2e/wallet.spec.ts` |

---

## 5. 남은 작업 - MEDIUM

> 🟡 **17건 미완료** (1건 부분 완료)

### M-01. 구조화된 로깅 도입 (5건)

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-01-1 | bundler 로깅 개선 | `services/bundler/src/utils/logger.ts` | ⬜ |
| M-01-2 | paymaster-proxy 로깅 개선 | `services/paymaster-proxy/src/utils/logger.ts` | ⬜ |
| M-01-3 | stealth-server 로깅 개선 | `services/stealth-server/src/utils/` | ⬜ |
| M-01-4 | wallet-extension console 정리 | `apps/wallet-extension/src/**/*.ts` | 🔶 부분 완료 |
| M-01-5 | Go 서비스 로깅 통일 | `services/*/internal/logger/` | ⬜ |

> M-01-4: createLogger 유틸리티 구현 완료. 기존 console.log → logger 전환 작업 잔여.

### M-02. 하드코딩 상수 외부화 (5건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| M-02-1 | bundler 상수 외부화 | `services/bundler/src/config/` |
| M-02-2 | paymaster-proxy 상수 외부화 | `services/paymaster-proxy/src/config/` |
| M-02-3 | SDK 상수 외부화 | `packages/config/src/` |
| M-02-4 | web 앱 상수 외부화 | `apps/web/lib/config/` |
| M-02-5 | wallet-extension 상수 외부화 | `apps/wallet-extension/src/config/` |

### M-03. 에러 처리 강화 (3건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| M-03-1 | wallet-extension BaseApi 에러 처리 | `apps/wallet-extension/src/shared/api/` |
| M-03-2 | web 앱 에러 바운더리 | `apps/web/components/error/` |
| M-03-3 | SDK 에러 타입 정의 | `packages/sdk/packages/core/src/errors/` |

### M-04. 입력 검증 강화 (2건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| M-04-1 | onramp-simulator 검증 추가 | `services/onramp-simulator/internal/validation/` |
| M-04-2 | bank-simulator 검증 추가 | `services/bank-simulator/internal/validation/` |

### M-05. Idempotency 구현 (2건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| M-05-1 | subscription-executor idempotency | `services/subscription-executor/internal/` |
| M-05-2 | bridge-relayer idempotency | `services/bridge-relayer/internal/` |

---

## 6. 남은 작업 - LOW

> 🟢 **23건 미완료**

### L-01. 코드 품질 개선 (4건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-01-1 | `as any` 타입 제거 (wallet-extension) | `apps/wallet-extension/src/**/*.ts` |
| L-01-2 | bundler 테스트 `as any` 제거 | `services/bundler/tests/**/*.ts` |
| L-01-3 | 미사용 import 정리 | 전체 |
| L-01-4 | TODO/FIXME 해결 | 전체 |

### L-02. 문서화 (5건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-02-1 | SDK API Reference | `docs/sdk/api/` |
| L-02-2 | Service API Reference | `docs/services/` |
| L-02-3 | 배포 가이드 | `docs/deployment/` |
| L-02-4 | 운영 가이드 | `docs/operations/` |
| L-02-5 | SDK Tutorial | `docs/tutorials/` |

### L-03. 인프라 개선 (4건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-03-1 | Health Check 엔드포인트 통일 | 모든 서비스 |
| L-03-2 | Prometheus 메트릭 추가 | 모든 서비스 |
| L-03-3 | Grafana 대시보드 | `infra/grafana/` |
| L-03-4 | AlertManager 설정 | `infra/alertmanager/` |

### L-04. DeFi 기능 완성 (3건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-04-1 | Uniswap V3 배포 스크립트 | `contracts/script/` |
| L-04-2 | TWAP Oracle 구현 확인 | `contracts/src/oracle/` |
| L-04-3 | Permit2Paymaster 연동 | `packages/sdk/plugins/paymaster/` |

### L-05. Module Marketplace (3건)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-05-1 | Marketplace UI | `apps/web/app/marketplace/` |
| L-05-2 | Module Registry 백엔드 | `services/module-registry/` |
| L-05-3 | 모듈 설치 API | `apps/wallet-extension/` |

### L-06. wallet-extension TypeScript 오류 수정 (4건)

> 기존 67개 pre-existing TS 오류 (최근 변경과 무관, tsc --noEmit 검증 완료)

| ID | 작업 | 파일/위치 |
|----|------|----------|
| L-06-1 | 타입 오류 수정 (background) | `apps/wallet-extension/src/background/` |
| L-06-2 | 타입 오류 수정 (UI) | `apps/wallet-extension/src/ui/` |
| L-06-3 | 타입 오류 수정 (approval) | `apps/wallet-extension/src/approval/` |
| L-06-4 | 타입 오류 수정 (shared) | `apps/wallet-extension/src/shared/` |

---

## 7. Sprint 계획

### 완료 현황

| Sprint | 기간 | 상태 | 완료 항목 |
|--------|------|------|----------|
| Sprint 1 | Week 1-2 | ✅ 완료 | C-01-1~4 (SDK 플러그인 테스트), H-01 (PG Simulator) |
| Sprint 2 | Week 3-4 | ✅ 완료 | C-01-5~8 (SDK 나머지 테스트), C-02 (Bridge Relayer), H-02-1~2 (Go 테스트) |

### 다음 Sprint

#### Sprint 3 (Week 5-6) - 진행중

**목표**: Go 서비스 테스트 완료 + E2E 테스트 시작

| ID | 작업 | 상태 |
|----|------|------|
| H-02-3 | bank-simulator 테스트 | ⬜ |
| H-02-5 | onramp-simulator 테스트 | ⬜ |
| H-03-1 | UserOp 전체 흐름 E2E | ⬜ |
| H-03-2 | Stealth 전송 E2E | ⬜ |
| H-03-3 | 구독 결제 E2E | ⬜ |

#### Sprint 4 (Week 7-8)

**목표**: E2E 테스트 완료 + MEDIUM 착수

| ID | 작업 |
|----|------|
| H-03-4 | Paymaster 가스 대납 E2E |
| H-03-5 | Wallet Extension E2E |
| M-01-1~5 | 구조화된 로깅 도입 |
| M-02-1~5 | 하드코딩 상수 외부화 |

#### Sprint 5 (Week 9-10)

**목표**: MEDIUM 완료

| ID | 작업 |
|----|------|
| M-03-1~3 | 에러 처리 강화 |
| M-04-1~2 | 입력 검증 강화 |
| M-05-1~2 | Idempotency 구현 |

#### Sprint 6+ (Week 11~)

LOW 우선순위 작업 순차 진행 (L-01 ~ L-06)

---

## 8. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-26 | 초기 작업 목록 작성 (총 67건) |
| 2026-01-26 | 스마트 컨트랙트 현황 추가 (poc-contract 69개 컨트랙트 반영) |
| 2026-01-26 | C-02 Bridge Relayer 구현 완료 — 7건 완료, 남은 작업 60건 |
| 2026-01-26 | H-01 PG Simulator 완성 (Luhn/CVV/만료일 + 3D Secure) — 11건 완료, 남은 작업 56건 |
| 2026-01-27 | C-01 SDK 테스트 전체 완료 (8 packages, 3,471 LOC). H-02 Go 서비스 테스트 부분 완료. Sprint 1-2 완료 — 22건 완료, 남은 작업 45건 |
| 2026-01-27 | vitest 실행 검증: SDK 285 tests ALL PASS. Go 4 services ALL PASS. M-01-4 부분 완료 |
| 2026-01-27 | 문서 재구성: 완료 항목 축소, 남은 작업 중심 정리, Sprint 계획 갱신, L-06 추가 (wallet-extension TS 오류 67건) |

---

## 관련 문서

- [12_Development_Progress_Report.md](./12_Development_Progress_Report.md) - 종합 개발 진행 상황 보고서

---

*문서 끝*
