# 11. Remaining Tasks - StableNet PoC 남은 작업 목록

> **작성일**: 2026-01-26
> **최종 업데이트**: 2026-01-27 (23:00)
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
| 🟠 HIGH | 14 | 14 | **0** |
| 🟡 MEDIUM | 17 | 16 | **1** |
| 🟢 LOW | 23 | 0 | **23** |
| **합계** | **69** | **45** | **24** |

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
테스트 커버리지        ██████████████░░░░░░  ~65% ⚠️ (SDK 331 tests + Go 5 services + Integration 25)
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

**C-01. SDK 테스트 작성** ✅ — 9 packages, 331 tests ALL PASS (vitest 검증 완료)

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
| C-01-9 | plugin-subscription | 46 |

**C-02. Bridge Relayer 구현** ✅ — ~2,900 LOC (MPC Signer, Fraud Proof, Monitor, Guardian 등 7개 컴포넌트)

### 🟠 HIGH 완료 항목 (14/14) ✅

**H-01. PG Simulator 완성** ✅ — Luhn/CVV/만료일 검증 + 3D Secure 시뮬레이션

**H-02. Go 서비스 테스트 (5/5 완료)** ✅ — 17 test files, 6,621 LOC total:
- ✅ H-02-1: order-router (8 files, 2,368 LOC)
- ✅ H-02-2: subscription-executor (3 files, 1,106 LOC)
- ✅ H-02-3: bank-simulator (4 files, 2,216 LOC)
- ✅ H-02-4: pg-simulator (1 file, 306 LOC)
- ✅ H-02-5: onramp-simulator (1 file, 625 LOC)

**H-03-1. UserOp E2E 테스트** ✅ — 35 tests, SDK 기능 활용 (`tests/e2e/userOp.test.ts`)
- ECDSA Validator (plugin-ecdsa), Kernel Smart Account (accounts), UserOp utilities (core)
- Bundler Client, Smart Account Client, EntryPoint Direct Interactions

**H-03-2. Stealth 전송 E2E 테스트** ✅ — 20 tests (`tests/e2e/stealth.test.ts`)
- Key Generation (spending/viewing keypairs, stealth meta-address)
- Stealth Address Generation (unique per payment)
- ETH Transfer to Stealth Address
- View Tag Filtering (1/256 false positive rate)
- Stealth Key Computation
- Spending from Stealth Address
- Full Flow Integration, Edge Cases

**H-03-3. 구독 결제 E2E 테스트** ✅ — 71 tests total
- SDK Plugin Unit Tests: 46 tests (`packages/sdk/plugins/subscription/tests/`)
- Integration Tests: 25 tests (`tests/integration/subscription.test.ts`)
- 구현 완료 항목:
  - Subscription SDK Plugin (`@stablenet/plugin-subscription`) — 46 unit tests
  - Web UI Components (`apps/web/components/subscription/`) — 5개 컴포넌트
  - Web Pages (`apps/web/app/subscription/`) — 3개 페이지
  - Payment Automation Service (`apps/payment-service/`) — Node.js 서비스
  - Contract Addresses 등록 (`packages/contracts/src/generated/addresses.ts`)

**H-03-4. Paymaster 가스 대납 E2E** ✅ — (H-03-1에 통합, VerifyingPaymaster 서명 및 가스 대납 포함)

**H-03-5. Wallet Extension E2E 테스트** ✅ — 45 tests (`tests/e2e/wallet.test.ts`)
- HD Keyring (mnemonic, derivation, signing), Simple Keyring (import, signing)
- Wallet State Management, Transaction Signing, Vault Encryption
- RPC Error Handling, Provider Events (EIP-1193), Live Network Integration

---

## 4. 남은 작업 - HIGH

> 🟠 **전체 완료** ✅

### H-03. E2E 테스트 작성 (전체 완료)

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| H-03-1 | UserOp 전체 흐름 E2E | `tests/e2e/userOp.test.ts` | ✅ 완료 |
| H-03-2 | Stealth 전송 E2E | `tests/e2e/stealth.test.ts` | ✅ 완료 |
| H-03-3 | 구독 결제 E2E | `tests/integration/subscription.test.ts` | ✅ 완료 |
| H-03-4 | Paymaster 가스 대납 E2E | `tests/e2e/paymaster.test.ts` | ✅ 완료 |
| H-03-5 | Wallet Extension E2E | `tests/e2e/wallet.test.ts` | ✅ 완료 |

**H-03-4. Paymaster 가스 대납 E2E 테스트** ✅ — (H-03-1에 통합)
- VerifyingPaymaster 서명 및 가스 대납 테스트 포함

**H-03-5. Wallet Extension E2E 테스트** ✅ — 45 tests (`tests/e2e/wallet.test.ts`)
- HD Keyring: mnemonic generation, account derivation, message/typed data signing
- Simple Keyring: private key import, signing
- Wallet State Management: accounts, networks, connections
- Transaction Signing: legacy, EIP-1559, contract deployment
- Vault Encryption: data protection, session persistence
- RPC Error Handling: standard error codes (EIP-1193)
- Provider Events: accountsChanged, chainChanged
- Live Network Integration: balance/block/gas queries, transaction broadcast

---

## 5. 남은 작업 - MEDIUM

> 🟡 **1건 미완료**

### M-01. 구조화된 로깅 도입 (5건) ✅ 전체 완료

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-01-1 | bundler 로깅 개선 | `services/bundler/src/utils/logger.ts` | ✅ 완료 |
| M-01-2 | paymaster-proxy 로깅 개선 | `services/paymaster-proxy/src/utils/logger.ts` | ✅ 완료 |
| M-01-3 | stealth-server 로깅 개선 | `services/stealth-server/` | ✅ N/A (Rust 서비스) |
| M-01-4 | wallet-extension console 정리 | `apps/wallet-extension/src/**/*.ts` | ✅ 완료 |
| M-01-5 | Go 서비스 로깅 통일 | `services/*/internal/logger/` | ✅ 완료 |

> **M-01-1**: pino 기반 구조화 로깅 (redaction, global logger, child logger). CLI earlyLogger 패턴 적용.
> **M-01-2**: pino 로거 신규 생성. console.* 13건 → 구조화 로깅 전환. --log-level CLI 옵션 추가.
> **M-01-3**: Rust 서비스로 Go/TS 로깅 범위 외. N/A 처리.
> **M-01-4**: createLogger 유틸리티 구현 완료. 모든 console.* 호출이 logger.ts 내부에만 존재 (0건 외부 호출). 6개 파일에서 logger 사용 중 (11 calls).
> **M-01-5**: 6개 Go 서비스에 `log/slog` 기반 구조화 로거 패키지 생성. 서비스별 컨텍스트 헬퍼 (WithAccount, WithPayment, WithBridgeTransfer 등). 모든 main.go `log.*` → `slog.*` 전환 완료.

### M-02. 하드코딩 상수 외부화 (5건) ✅ 전체 완료

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-02-1 | bundler 상수 외부화 | `services/bundler/src/config/constants.ts` | ✅ 완료 |
| M-02-2 | paymaster-proxy 상수 외부화 | `services/paymaster-proxy/src/config/constants.ts` | ✅ 완료 |
| M-02-3 | SDK 상수 외부화 | `packages/config/src/env.ts` | ✅ 완료 |
| M-02-4 | web 앱 상수 외부화 | `apps/web/lib/config/env.ts` | ✅ 완료 |
| M-02-5 | wallet-extension 상수 외부화 | `apps/wallet-extension/src/config/constants.ts` | ✅ 완료 |

> **M-02-1**: bundler 검증 한계, 평판 설정, 멤풀 구성, 서버 설정 등 ~50개 환경 변수 외부화. `.env.example` 생성.
> **M-02-2**: paymaster-proxy 서버 설정, 서명자 설정, 정책 설정 등 ~15개 환경 변수 외부화.
> **M-02-3**: SDK 4개 네트워크(Anvil, Devnet, Sepolia, Mainnet)별 URL 설정 ~25개 환경 변수 외부화. `getAnvilConfig()`, `getNetworkConfigByChainId()` 등 getter 함수 제공.
> **M-02-4**: web 앱 NEXT_PUBLIC_ 접두사 환경 변수 ~25개 외부화. Devnet/Testnet 서비스 URL, 컨트랙트 주소, 앱 설정 지원.
> **M-02-5**: wallet-extension VITE_WALLET_ 접두사 환경 변수 ~20개 외부화. API URL, 네트워크 설정, 타임아웃, 보안 설정 지원.

### M-03. 에러 처리 강화 (3건) ✅ 전체 완료

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-03-1 | wallet-extension BaseApi 에러 처리 | `apps/wallet-extension/src/shared/api/` | ✅ 완료 |
| M-03-2 | web 앱 에러 바운더리 | `apps/web/components/error/` | ✅ 완료 |
| M-03-3 | SDK 에러 타입 정의 | `packages/sdk/packages/core/src/errors/` | ✅ 완료 |

> **M-03-1**: ApiError 클래스, 에러 코드 체계, BaseApi HTTP 클라이언트 (retry, timeout, abort 지원)
> **M-03-2**: ErrorBoundary (class component), ErrorFallback UI, useErrorHandler hook, withErrorBoundary HOC
> **M-03-3**: SdkError 계층 (SdkError, BundlerError, UserOperationError, TransactionError, GasEstimationError, ConfigurationError, ValidationError), 에러 유틸리티 (normalizeError, assertCondition, assertDefined 등). bundlerClient 통합 완료.

### M-04. 입력 검증 강화 (2건) ✅ 전체 완료

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-04-1 | onramp-simulator 검증 추가 | `services/onramp-simulator/internal/validation/` | ✅ 완료 |
| M-04-2 | bank-simulator 검증 추가 | `services/bank-simulator/internal/validation/` | ✅ 완료 |

> **M-04-1**: ValidationErrors 구조체, QuoteRequest/CreateOrderRequest/OrderID/UserID 검증. fiatAmount ($1-$50K), fiatCurrency (5종), cryptoCurrency (5종+WKRC), walletAddress (EVM), userId, paymentMethod, chainId. 22개 테스트 전체 통과. 5개 핸들러 통합.
> **M-04-2**: CreateAccountRequest (name/currency/balance), TransferRequest (fromAccountNo/toAccountNo/amount/reference/self-transfer), AccountNoParam (BANK+4-14자리), TransferID (UUID). big.Float 정밀 검증, regex 포맷 검증. 7개 핸들러 통합. 전체 테스트 통과.

### M-05. Idempotency 구현 (2건) — 1건 완료

| ID | 작업 | 파일/위치 | 상태 |
|----|------|----------|------|
| M-05-1 | subscription-executor idempotency | `services/subscription-executor/internal/` | ✅ 완료 |
| M-05-2 | bridge-relayer idempotency | `services/bridge-relayer/internal/` | ⬜ 미완료 |

> **M-05-1**: 2계층 idempotency 구현. Layer A: `Idempotency-Key` 헤더 기반 API 응답 캐싱 (24h TTL, first-writer-wins). Layer B: DB unique partial index `(subscription_id) WHERE status='pending'`로 실행 중복 방지. 8개 미들웨어 테스트 전체 통과. +576 LOC.

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
| Sprint 3 | Week 5-6 | ✅ 완료 | H-02-3~5 (Go 테스트 완료), H-03-1~3 (E2E 테스트), C-01-9 (plugin-subscription) |

### 다음 Sprint

#### Sprint 4 (Week 7-8) - 진행중

**목표**: E2E 테스트 완료 ✅ + MEDIUM 착수

| ID | 작업 | 상태 |
|----|------|------|
| H-03-4 | Paymaster 가스 대납 E2E | ✅ 완료 (H-03-1에 통합) |
| H-03-5 | Wallet Extension E2E | ✅ 완료 (45 tests) |
| M-03-1~3 | 에러 처리 강화 | ✅ 완료 |
| M-01-1~5 | 구조화된 로깅 도입 | ✅ 완료 (5/5) |
| M-02-1~5 | 하드코딩 상수 외부화 | ✅ 완료 |
| M-04-1~2 | 입력 검증 강화 | ✅ 완료 |

#### Sprint 5 (Week 9-10) - 진행중

**목표**: MEDIUM 완료

| ID | 작업 | 상태 |
|----|------|------|
| M-05-1 | subscription-executor idempotency | ✅ 완료 |
| M-05-2 | bridge-relayer idempotency | ⬜ 미완료 |

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
| 2026-01-27 | H-02-5 onramp-simulator 테스트 완료 (625 LOC). H-02-3 bank-simulator 기존 완료 확인 (2,216 LOC). H-02 Go 서비스 테스트 전체 완료 (5/5) — 24건 완료, 남은 작업 45건 |
| 2026-01-27 | H-03-1 UserOp E2E 테스트 완료 (35 tests). SDK 기능 활용 재작성 (@stablenet/core, accounts, plugin-ecdsa) — 25건 완료, 남은 작업 44건 |
| 2026-01-27 | H-03-2 Stealth 전송 E2E 테스트 완료 (20 tests). Key generation, stealth address, view tag filtering, spending 검증 — 26건 완료, 남은 작업 43건 |
| 2026-01-27 | H-03-3 구독 결제 E2E 완료 (71 tests total). SDK Plugin 46 tests + Integration 25 tests. Subscription UI (5 컴포넌트, 3 페이지), Payment Automation Service (Node.js) 구현 완료. Sprint 3 완료 — 27건 완료, 남은 작업 42건 |
| 2026-01-27 | H-03-4 Paymaster E2E (H-03-1에 통합), H-03-5 Wallet Extension E2E 완료 (45 tests). HIGH 전체 완료 — 29건 완료, 남은 작업 40건 |
| 2026-01-27 | M-03 에러 처리 강화 전체 완료 (3건). M-03-1 wallet-extension BaseApi (ApiError, BaseApi HTTP client), M-03-2 web 에러 바운더리 (ErrorBoundary, ErrorFallback, useErrorHandler), M-03-3 SDK 에러 타입 (SdkError 7개 클래스 계층, bundlerClient 통합) — 32건 완료, 남은 작업 37건 |
| 2026-01-27 | M-01 구조화된 로깅 도입 4건 완료. M-01-1 bundler pino 로깅 강화, M-01-2 paymaster-proxy 구조화 로깅 신규 생성, M-01-3 stealth-server N/A (Rust), M-01-5 Go 6개 서비스 slog 로거 패키지+main.go 전환. 전체 빌드 검증 통과 — 36건 완료, 남은 작업 33건 |
| 2026-01-27 | M-04 입력 검증 강화 전체 완료 (2건). M-04-1 onramp-simulator (fiatAmount/fiatCurrency/cryptoCurrency/walletAddress/userId/paymentMethod/chainId 검증, 22 tests, 5 핸들러 통합). M-04-2 bank-simulator (name/currency/balance/accountNo/amount/reference/UUID 검증, 7 핸들러 통합, sanitizeError). 전체 빌드·테스트 통과 — 38건 완료, 남은 작업 31건 |
| 2026-01-27 | M-02 하드코딩 상수 외부화 전체 완료 (5건). M-02-1 bundler (~50 env vars, validation/reputation/mempool/server config), M-02-2 paymaster-proxy (~15 env vars, server/signer/policy config), M-02-3 SDK (~25 env vars, 4개 네트워크별 URL), M-02-4 web (~25 env vars, NEXT_PUBLIC_ prefix), M-02-5 wallet-extension (~20 env vars, VITE_WALLET_ prefix). 모든 모듈 `.env.example` 생성, getter 함수 패턴 적용 — 43건 완료, 남은 작업 26건 |
| 2026-01-27 | M-05-1 subscription-executor idempotency 완료. 2계층 idempotency (API Layer: Idempotency-Key 헤더 캐싱 24h TTL, Execution Layer: DB unique partial index). 8개 미들웨어 테스트 통과. M-01-4 완료 확인 (console.* 0건 외부 호출). — 45건 완료, 남은 작업 24건 |

---

## 관련 문서

- [12_Development_Progress_Report.md](./12_Development_Progress_Report.md) - 종합 개발 진행 상황 보고서

---

*문서 끝*
