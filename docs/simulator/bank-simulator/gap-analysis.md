# Bank Simulator - Gap Analysis

## 요약

현재 bank-simulator는 기본적인 계좌 관리와 계좌 간 이체 기능만 제공합니다. PoC의 다양한 사용자 시나리오를 지원하려면 외부 서비스와의 연동을 위한 추가 API가 필요합니다.

## 누락 기능 분석

### P0 - 필수 (PoC 핵심 시나리오)

#### 1. 입금/출금 API

**현재 상태**: 계좌 간 이체만 가능, 외부에서 잔액 변경 불가

**필요 이유**:
- PG에서 bank_transfer 결제 후 가맹점 계좌에 입금
- Onramp에서 은행 이체 시 사용자 계좌에서 출금
- 테스트 시나리오에서 계좌 잔액 조정

**상세 스펙**: [feature-specs/deposit-withdraw.md](./feature-specs/deposit-withdraw.md)

---

#### 2. 계좌 인증 API

**현재 상태**: 계좌 존재 여부 확인만 가능 (GET /accounts/{accountNo})

**필요 이유**:
- PG bank_transfer 시 계좌 실명 확인
- Onramp 은행 이체 시 계좌 검증
- 실제 은행의 "1원 인증" 또는 "실명 확인" 시뮬레이션

**상세 스펙**: [feature-specs/account-verification.md](./feature-specs/account-verification.md)

---

#### 3. Direct Debit API (출금 승인)

**현재 상태**: 없음

**필요 이유**:
- PG의 bank_transfer 결제 시 사용자 계좌에서 출금
- Onramp의 은행 이체 시 사용자 계좌에서 출금
- 실제 은행의 "자동이체" 또는 "CMS 출금" 시뮬레이션
- 비동기 승인/거절 플로우 지원

**상세 스펙**: [feature-specs/direct-debit.md](./feature-specs/direct-debit.md)

---

### P1 - 권장 (현실적 시나리오)

#### 4. 통합 거래 내역 조회

**현재 상태**: 이체 내역만 조회 가능 (`GET /accounts/{accountNo}/transfers`)

**필요 이유**:
- 입금, 출금, 이체, 직불을 포함한 통합 조회
- 기간별/유형별 필터링
- 대사(reconciliation) 시뮬레이션

**상세 스펙**: [feature-specs/transaction-history.md](./feature-specs/transaction-history.md)

---

#### 5. 계좌 해지

**현재 상태**: `closed` 상태가 모델에 정의되어 있으나 엔드포인트 없음

**필요 이유**:
- 계좌 생명주기 완성
- 해지된 계좌에 대한 거래 방지 테스트

**상세 스펙**: [feature-specs/account-close.md](./feature-specs/account-close.md)

---

### P2 - 선택 (완성도)

#### 6. 거래 한도

**현재 상태**: 없음

**필요 이유**:
- 일일/월간/건당 이체 한도 시뮬레이션
- 한도 초과 시 거래 거절 테스트

**구현 범위**:
- 계좌별 한도 설정 API
- 이체/출금 시 한도 검증
- 한도 초과 에러 반환

---

## 영향 받는 외부 서비스

| 기능 | pg-simulator | onramp-simulator |
|------|--------------|------------------|
| 입금/출금 | 가맹점 정산 입금 | - |
| 계좌 인증 | bank_transfer 계좌 확인 | bank_transfer 계좌 확인 |
| Direct Debit | bank_transfer 결제 출금 | bank_transfer 출금 |
| 거래 내역 | - | - |
| 계좌 해지 | 해지 계좌 결제 실패 | 해지 계좌 주문 실패 |

## 구현 순서 권장

1. **Direct Debit API** - PG/Onramp 연동의 핵심
2. **입금/출금 API** - Direct Debit 이후 정산 등에 활용
3. **계좌 인증 API** - 결제 전 검증에 활용
4. **통합 거래 내역** - 전체 트랜잭션 추적
5. **계좌 해지** - 생명주기 완성
