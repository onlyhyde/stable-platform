# 11. Remaining Tasks - StableNet PoC 남은 작업 목록

> **작성일**: 2026-01-26
> **최종 업데이트**: 2026-01-27 (오후)
> **상태**: Active

## 목차

1. [작업 요약](#1-작업-요약)
2. [전체 진행 현황](#2-전체-진행-현황)
3. [남은 작업 - MEDIUM](#3-남은-작업---medium)
4. [남은 작업 - LOW](#4-남은-작업---low)
5. [Sprint 계획](#5-sprint-계획)
6. [변경 이력](#6-변경-이력)

---

## 1. 작업 요약

| 우선순위 | 전체 | 완료 | 남은 건수 |
|----------|------|------|----------|
| 🔴 CRITICAL | 15 | 15 | **0** |
| 🟠 HIGH | 14 | 14 | **0** |
| 🟡 MEDIUM | 17 | 17 | **0** |
| 🟢 LOW | 23 | 0 | **23** |
| **합계** | **69** | **46** | **23** |

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
Services              ████████████████████ 100% ✅
Apps                  ████████████████████ 100% ✅
Simulators            ████████████████████ 100% ✅
테스트 커버리지        ██████████████░░░░░░  ~65% ⚠️ (SDK 331 tests + Go 5 services + Integration 25)
```

| Phase | 내용 | 완성도 |
|-------|------|--------|
| Phase 0-3 | Foundation ~ Paymaster | 100% ✅ |
| Phase 4 | Stealth | 100% ✅ |
| Phase 5 | Wallet | 100% ✅ |
| Phase 6 | Web Frontend | 100% ✅ |
| Phase 7 | 추가 서비스 | 100% ✅ |

### 완료된 주요 작업 (참고)

- **C-01**: SDK 테스트 (9 packages, 331 tests)
- **C-02**: Bridge Relayer (~2,900 LOC)
- **H-01**: PG Simulator (Luhn/CVV/3D Secure)
- **H-02**: Go 서비스 테스트 (5 services, 6,621 LOC)
- **H-03**: E2E 테스트 (5개 시나리오, 171 tests)
- **M-01**: 구조화된 로깅 (9 implementations)
- **M-02**: 상수 외부화 (7 config files)
- **M-03**: 에러 처리 강화 (4 modules)
- **M-04**: 입력 검증 강화 (4 services)
- **M-05-1**: subscription-executor idempotency
- **M-05-2**: bridge-relayer idempotency (2계층 - API + Event dedup)

---

## 3. 남은 작업 - MEDIUM

> 🟡 **모든 작업 완료** ✅

---

## 4. 남은 작업 - LOW

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

## 5. Sprint 계획

### 완료 현황

| Sprint | 기간 | 상태 |
|--------|------|------|
| Sprint 1 | Week 1-2 | ✅ 완료 |
| Sprint 2 | Week 3-4 | ✅ 완료 |
| Sprint 3 | Week 5-6 | ✅ 완료 |
| Sprint 4 | Week 7-8 | ✅ 완료 |
| Sprint 5 | Week 9-10 | ✅ 완료 |

### 다음 Sprint

#### Sprint 5 (Week 9-10) - ✅ 완료

**목표**: MEDIUM 완료

| ID | 작업 | 상태 |
|----|------|------|
| M-05-2 | bridge-relayer idempotency | ✅ 완료 |

#### Sprint 6+ (Week 11~)

LOW 우선순위 작업 순차 진행 (L-01 ~ L-06)

**권장 순서**:
1. L-06 (TypeScript 오류 수정) - 빌드 안정성
2. L-01 (코드 품질) - 유지보수성
3. L-02 (문서화) - 온보딩 지원
4. L-03 (인프라) - 운영 준비
5. L-04, L-05 (기능 확장) - 선택적

---

## 6. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-26 | 초기 작업 목록 작성 (총 69건) |
| 2026-01-27 | Sprint 1-4 완료. 45건 완료, 24건 남음 |
| 2026-01-27 | 문서 정리: 완료 항목 삭제, 미구현 항목만 유지 |
| 2026-01-27 | M-05-2 (bridge-relayer idempotency) 완료. MEDIUM 전부 완료. 46건 완료, 23건 남음 |

**완료 내역 상세**는 `git log` 및 코드 커밋 기록 참조.

---

## 관련 문서

- [12_Development_Progress_Report.md](./12_Development_Progress_Report.md) - 종합 개발 진행 상황 보고서

---

*문서 끝*
