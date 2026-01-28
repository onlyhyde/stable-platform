# Simulator 작업 리스트

## 작업 현황 요약

| 카테고리 | 완료 | 대기 | 총합 |
|----------|------|------|------|
| Phase 1: 문서 작성 | 27 | 0 | 27 |
| Phase 2: 이슈 수정 (P0+P1+P2) | 13 | 0 | 13 |
| Phase 3: 기능 구현 (Sprint 1~3 P0) | 11 | 0 | 11 |
| Phase 3: 기능 구현 (Sprint 4 P1) | 6 | 0 | 6 |
| Phase 3: 기능 구현 (Sprint 5 P2+test) | 2 | 1 | 3 |
| **총합** | **59** | **1** | **60** |

**진행률**: 59/60 (98%) — Phase 1~2 완료, Sprint 1~5 P2 완료, CROSS-04 통합 테스트 대기

---

## Phase 1~2: 완료 ✅

<details>
<summary>Phase 1: 문서 작성 (27건 완료)</summary>

- 기본 문서 5건: README, REVIEW_ISSUES, common/types, status-mapping, webhook-spec
- Bank Simulator 7건: README, gap-analysis, deposit-withdraw, account-verification, direct-debit, transaction-history, account-close
- PG Simulator 7건: README, gap-analysis, bank-transfer-flow, wallet-payment-flow, redirect-url, checkout-session, settlement
- Onramp Simulator 7건: README, gap-analysis, payment-integration, kyc-flow, supported-assets, multi-currency-rates, wallet-validation
- Cross-Service 2건: README, integration-specs

</details>

<details>
<summary>Phase 2: 이슈 수정 (13건 완료)</summary>

**P0 (5건)**: 멱등성 키, 상태 매핑, 웹훅 순환 방지, 환경변수 네이밍, Order 상태 통일
**P1 (4건)**: Transaction 모델 통합, 부분 실패 처리, 웹훅 버전 관리, 엔드포인트 분리
**P2 (4건)**: 헬스체크 엔드포인트, KYC 갱신, 정산 조정, 체인 ID 통합

</details>

---

## Phase 3: 기능 구현 (20건 대기)

### Sprint 1: Bank Simulator 핵심 — P0 ✅

| ID | 기능 | 우선순위 | 상태 | 스펙 문서 |
|----|------|----------|------|-----------|
| BANK-01 | 입금/출금 API | P0 | ✅ | [deposit-withdraw.md](./bank-simulator/feature-specs/deposit-withdraw.md) |
| BANK-02 | 계좌 인증 API | P0 | ✅ | [account-verification.md](./bank-simulator/feature-specs/account-verification.md) |
| BANK-03 | Direct Debit API | P0 | ✅ | [direct-debit.md](./bank-simulator/feature-specs/direct-debit.md) |

---

### Sprint 2: PG-Bank 연동 — P0 ✅

| ID | 기능 | 우선순위 | 상태 | 스펙 문서 |
|----|------|----------|------|-----------|
| PG-01 | Bank Transfer 플로우 | P0 | ✅ | [bank-transfer-flow.md](./pg-simulator/feature-specs/bank-transfer-flow.md) |
| PG-02 | Wallet 결제 플로우 | P0 | ✅ | [wallet-payment-flow.md](./pg-simulator/feature-specs/wallet-payment-flow.md) |
| CROSS-03 | PG → Bank 연동 | - | ✅ | [integration-specs.md](./cross-service/integration-specs.md) |

---

### Sprint 3: Onramp 핵심 — P0 ✅

| ID | 기능 | 우선순위 | 상태 | 스펙 문서 |
|----|------|----------|------|-----------|
| ONRAMP-03 | KYC 플로우 | P0 | ✅ | [kyc-flow.md](./onramp-simulator/feature-specs/kyc-flow.md) |
| ONRAMP-01 | 결제 연동 (PG) | P0 | ✅ | [payment-integration.md](./onramp-simulator/feature-specs/payment-integration.md) |
| ONRAMP-02 | 결제 연동 (Bank) | P0 | ✅ | [payment-integration.md](./onramp-simulator/feature-specs/payment-integration.md) |
| CROSS-01 | Onramp → PG 연동 | - | ✅ | [integration-specs.md](./cross-service/integration-specs.md) |
| CROSS-02 | Onramp → Bank 연동 | - | ✅ | [integration-specs.md](./cross-service/integration-specs.md) |

---

### Sprint 4: 부가 기능 — P1 ✅

| ID | 기능 | 우선순위 | 상태 | 스펙 문서 | 구현 범위 | 의존성 |
|----|------|----------|------|-----------|----------|--------|
| BANK-04 | 거래 내역 조회 | P1 | ✅ | [transaction-history.md](./bank-simulator/feature-specs/transaction-history.md) | handler, service | BANK-01 |
| BANK-05 | 계좌 해지 | P1 | ✅ | [account-close.md](./bank-simulator/feature-specs/account-close.md) | handler, service | BANK-01 |
| PG-03 | Redirect URL | P1 | ✅ | [redirect-url.md](./pg-simulator/feature-specs/redirect-url.md) | handler, service, template | PG-01 |
| PG-04 | Checkout Session | P1 | ✅ | [checkout-session.md](./pg-simulator/feature-specs/checkout-session.md) | handler, service, template | PG-01 |
| ONRAMP-04 | 지원 자산/네트워크 API | P1 | ✅ | [supported-assets.md](./onramp-simulator/feature-specs/supported-assets.md) | handler, rate_manager | 없음 |
| ONRAMP-05 | 다중 환율 지원 | P1 | ✅ | [multi-currency-rates.md](./onramp-simulator/feature-specs/multi-currency-rates.md) | service, rate_manager | ONRAMP-04 |

---

### Sprint 5: 완성도 — P2 + 테스트

| ID | 기능 | 우선순위 | 상태 | 스펙 문서 | 구현 범위 | 의존성 |
|----|------|----------|------|-----------|----------|--------|
| PG-05 | 정산 시뮬레이션 | P2 | ✅ | [settlement.md](./pg-simulator/feature-specs/settlement.md) | handler, service | PG-01 |
| ONRAMP-06 | 월렛 주소 검증 | P2 | ✅ | [wallet-validation.md](./onramp-simulator/feature-specs/wallet-validation.md) | service, validator, handler | 없음 |
| CROSS-04 | 통합 테스트 | - | 대기 | - | e2e test scenarios | 전체 |

#### 테스트 시나리오

| 구분 | 시나리오 |
|------|----------|
| 단위 테스트 | Bank/PG/Onramp 서비스별 테스트 |
| 통합 테스트 | Onramp→PG(Card), Onramp→Bank(Transfer), PG→Bank(Transfer), 웹훅 발송/수신 |
| E2E 시나리오 | 카드 결제 성공/실패, 은행 이체 성공/실패, KYC 승인/거절, 환불 |

---

## 의존성 다이어그램

```
Sprint 1                Sprint 2                Sprint 3
─────────              ─────────              ─────────
BANK-01 ──┐
           ├─ BANK-02
           ├─ BANK-03 ──┬─ PG-01 ──── CROSS-03    ONRAMP-03 ──┐
           │             │                                       ├─ ONRAMP-01 ── CROSS-01
           │             └─────────────────────── ONRAMP-02 ────┘
           │                                          │
           └──────────────────────────────────── CROSS-02
                          PG-02 (독립)

Sprint 4                Sprint 5
─────────              ─────────
BANK-04, BANK-05       PG-05
PG-03, PG-04           ONRAMP-06
ONRAMP-04 ── ONRAMP-05 CROSS-04 (전체 테스트)
```

---

## 빠른 참조: 스펙 문서 인덱스

| 서비스 | 문서 | 경로 |
|--------|------|------|
| 공통 | 타입 정의 | `common/types.md` |
| 공통 | 상태 매핑 | `common/status-mapping.md` |
| 공통 | 웹훅 스펙 | `common/webhook-spec.md` |
| Bank | 입금/출금 | `bank-simulator/feature-specs/deposit-withdraw.md` |
| Bank | 계좌 인증 | `bank-simulator/feature-specs/account-verification.md` |
| Bank | Direct Debit | `bank-simulator/feature-specs/direct-debit.md` |
| Bank | 거래 내역 | `bank-simulator/feature-specs/transaction-history.md` |
| Bank | 계좌 해지 | `bank-simulator/feature-specs/account-close.md` |
| PG | Bank Transfer | `pg-simulator/feature-specs/bank-transfer-flow.md` |
| PG | Wallet 결제 | `pg-simulator/feature-specs/wallet-payment-flow.md` |
| PG | Redirect URL | `pg-simulator/feature-specs/redirect-url.md` |
| PG | Checkout Session | `pg-simulator/feature-specs/checkout-session.md` |
| PG | 정산 | `pg-simulator/feature-specs/settlement.md` |
| Onramp | 결제 연동 | `onramp-simulator/feature-specs/payment-integration.md` |
| Onramp | KYC | `onramp-simulator/feature-specs/kyc-flow.md` |
| Onramp | 지원 자산 | `onramp-simulator/feature-specs/supported-assets.md` |
| Onramp | 다중 환율 | `onramp-simulator/feature-specs/multi-currency-rates.md` |
| Onramp | 월렛 검증 | `onramp-simulator/feature-specs/wallet-validation.md` |
| Cross | 통합 스펙 | `cross-service/integration-specs.md` |
