# 문서 논리적 검토 결과

## 개요

시뮬레이터 문서 검토 결과 27개의 이슈가 발견되었습니다.

| 카테고리 | 이슈 수 | 심각도 |
|----------|---------|--------|
| API 엔드포인트 충돌 | 2 | 높음 |
| 데이터 모델 불일치 | 4 | 높음 |
| 누락된 에러 처리 | 3 | 중간 |
| 워크플로우 갭 | 5 | 높음 |
| 상태값 불일치 | 4 | 중간 |
| 웹훅 이벤트 네이밍 | 3 | 낮음 |
| 환경변수 충돌 | 2 | 중간 |
| 순환 의존성 위험 | 4 | 높음 |

---

## 1. API 엔드포인트 충돌

### 이슈 1.1: Transaction 엔드포인트 중복 정의
- **위치**: `bank-simulator/feature-specs/deposit-withdraw.md`, `bank-simulator/feature-specs/transaction-history.md`
- **내용**: 두 문서 모두 `/api/v1/accounts/:accountNo/transactions` 엔드포인트를 정의
- **해결**: `deposit-withdraw.md`는 POST만, `transaction-history.md`는 GET만 담당하도록 명확히 분리

### 이슈 1.2: 헬스체크 엔드포인트 누락
- **위치**: 각 시뮬레이터 README.md
- **내용**: 서비스 상태 확인을 위한 `/health` 또는 `/api/v1/health` 엔드포인트 미정의
- **해결**: 각 서비스에 표준 헬스체크 엔드포인트 추가

---

## 2. 데이터 모델 불일치

### 이슈 2.1: Transaction 모델 중복 정의
- **위치**: `deposit-withdraw.md` vs `transaction-history.md`
- **내용**: 동일한 Transaction 구조체가 두 곳에서 정의됨
- **해결**: `model/transaction.go`에 단일 정의 후 import

### 이슈 2.2: Order 상태 필드 불일치
- **위치**: `onramp-simulator/README.md` vs `payment-integration.md`
- **내용**:
  - README: `pending`, `processing`, `completed`, `failed`
  - payment-integration: `pending`, `pending_payment`, `processing`, `completed`, `failed`
- **해결**: `pending_payment` 상태를 README에 추가

### 이슈 2.3: Payment 상태와 Order 상태 매핑 부재
- **위치**: `cross-service/integration-specs.md`
- **내용**: PG 결제 상태(`approved`, `declined`)와 Onramp 주문 상태(`processing`, `failed`) 매핑 테이블 없음
- **해결**: 상태 매핑 테이블 추가

```go
var PaymentToOrderStatus = map[string]string{
    "approved":      "processing",
    "declined":      "failed",
    "cancelled":     "failed",
    "refunded":      "failed",
    "pending":       "pending_payment",
    "requires_auth": "pending_payment",
}
```

### 이슈 2.4: Amount 타입 불일치
- **위치**: 전체 문서
- **내용**: Amount를 `string`으로 정의하나 일부 예제에서 `int64` 사용
- **해결**: 모든 Amount는 `string` (big.Float 기반)으로 통일, 예제 수정

---

## 3. 누락된 에러 처리

### 이슈 3.1: Direct Debit 멱등성 키 누락
- **위치**: `bank-simulator/feature-specs/direct-debit.md`
- **내용**: 중복 출금 방지를 위한 `idempotencyKey` 필드가 요청에 없음
- **해결**: 요청 구조체에 추가

```go
type DirectDebitRequest struct {
    AccountNo      string `json:"accountNo" binding:"required"`
    Amount         string `json:"amount" binding:"required"`
    Description    string `json:"description"`
    Reference      string `json:"reference" binding:"required"`
    IdempotencyKey string `json:"idempotencyKey" binding:"required"` // 추가
    WebhookURL     string `json:"webhookUrl,omitempty"`
}
```

### 이슈 3.2: 웹훅 실패 시 재시도 로직 불완전
- **위치**: `cross-service/integration-specs.md`
- **내용**: 재시도 간격이 지수 백오프가 아닌 고정 간격(5초)
- **해결**: 지수 백오프 적용 (5s, 10s, 20s, 40s, 80s)

### 이슈 3.3: 부분 실패 처리 미정의
- **위치**: `onramp-simulator/feature-specs/payment-integration.md`
- **내용**: 결제 성공 후 블록체인 전송 실패 시 처리 로직 없음
- **해결**: `payment_completed_pending_transfer` 상태 추가 및 환불 플로우 정의

---

## 4. 워크플로우 갭

### 이슈 4.1: Onramp 은행 이체 플로우 불완전
- **위치**: `onramp-simulator/feature-specs/payment-integration.md`
- **내용**: Bank Direct Debit 결과를 폴링하는 로직만 있고, 웹훅 수신 처리 없음
- **해결**: 웹훅 핸들러 추가

### 이슈 4.2: PG Checkout 취소 플로우 누락
- **위치**: `pg-simulator/feature-specs/checkout-session.md`
- **내용**: 사용자가 결제 페이지에서 취소 시 `cancelUrl`로 리다이렉트되나, 세션 상태 업데이트 로직 없음
- **해결**: 취소 엔드포인트 및 상태 업데이트 로직 추가

### 이슈 4.3: KYC 만료 갱신 플로우 누락
- **위치**: `onramp-simulator/feature-specs/kyc-flow.md`
- **내용**: KYC 만료 시 재인증 플로우 정의 없음
- **해결**: KYC 갱신 API 추가 (`POST /api/v1/kyc/renew`)

### 이슈 4.4: 정산 조정(Adjustment) 로직 누락
- **위치**: `pg-simulator/feature-specs/settlement.md`
- **내용**: 정산 후 차액 발생 시 조정 처리 로직 없음
- **해결**: 조정 API 및 상태 추가

### 이슈 4.5: 계좌 검증 실패 후 재시도 제한 없음
- **위치**: `bank-simulator/feature-specs/account-verification.md`
- **내용**: 소액 입금 검증 실패 시 무제한 재시도 가능
- **해결**: 최대 시도 횟수(3회) 및 쿨다운 시간 추가

---

## 5. 상태값 불일치

### 이슈 5.1: Direct Debit vs Payment 상태 불일치
- **위치**: `bank-simulator/feature-specs/direct-debit.md` vs `pg-simulator/README.md`
- **내용**:
  - Direct Debit: `pending`, `completed`, `failed`, `cancelled`
  - Payment: `pending`, `approved`, `declined`, `refunded`, `cancelled`
- **해결**: 크로스 서비스 상태 매핑 테이블 정의

### 이슈 5.2: 웹훅 이벤트 타입 vs 상태 불일치
- **위치**: 전체 문서
- **내용**: 웹훅 이벤트 `direct_debit.completed`와 상태 `completed`가 1:1 매핑되지 않는 경우 존재
- **해결**: 이벤트-상태 매핑 테이블 명시

### 이슈 5.3: 결제 수단 enum 불일치
- **위치**: `pg-simulator/README.md` vs `onramp-simulator/feature-specs/payment-integration.md`
- **내용**:
  - PG: `card`, `bank_transfer`, `wallet`
  - Onramp: `card`, `bank_transfer`, `apple_pay`, `google_pay`
- **해결**: 통합 PaymentMethod enum 정의

### 이슈 5.4: 체인 ID 정의 위치 분산
- **위치**: `onramp-simulator/feature-specs/supported-assets.md`, `multi-currency-rates.md`
- **내용**: 체인 ID(1, 137, 42161, 10, 8453)가 여러 문서에 중복 정의
- **해결**: 공통 상수 파일로 통합

---

## 6. 웹훅 이벤트 네이밍

### 이슈 6.1: 네이밍 컨벤션 불일치
- **위치**: 전체 문서
- **내용**:
  - Bank: `direct_debit.completed` (snake_case.snake_case)
  - PG: `payment.approved` (snake_case.snake_case)
  - Onramp: `kyc.approved` (snake_case.snake_case) ✅
  - 그러나 일부 문서에서 `payment_completed` 형식 사용
- **해결**: `{resource}.{action}` 형식으로 통일

### 이슈 6.2: 웹훅 버전 관리 부재
- **위치**: 전체 문서
- **내용**: 웹훅 페이로드 버전 필드 없음
- **해결**: 모든 웹훅에 `version` 필드 추가

```json
{
  "version": "1.0",
  "eventType": "payment.approved",
  "timestamp": "...",
  "data": {}
}
```

### 이슈 6.3: 웹훅 재시도 식별자 누락
- **위치**: 전체 문서
- **내용**: 동일 이벤트의 재시도 구분 불가
- **해결**: `deliveryId` 및 `attemptNumber` 필드 추가

---

## 7. 환경변수 충돌

### 이슈 7.1: WEBHOOK_SECRET 네이밍 불일치
- **위치**: 각 시뮬레이터 README.md
- **내용**:
  - Bank: `WEBHOOK_SECRET`
  - PG: `WEBHOOK_SECRET`
  - Onramp: `WEBHOOK_SECRET`
  - 동일 환경에서 실행 시 충돌
- **해결**: 서비스별 prefix 추가
  - `BANK_WEBHOOK_SECRET`
  - `PG_WEBHOOK_SECRET`
  - `ONRAMP_WEBHOOK_SECRET`

### 이슈 7.2: 포트 설정 환경변수 누락
- **위치**: 각 시뮬레이터 README.md
- **내용**: 포트가 하드코딩(4350, 4351, 4352)되어 있고 환경변수로 설정 불가
- **해결**: `PORT` 환경변수 추가

---

## 8. 순환 의존성 위험

### 이슈 8.1: 웹훅 순환 호출 위험
- **위치**: `cross-service/integration-specs.md`
- **내용**: Onramp → PG → Bank → Onramp 형태의 웹훅 체인에서 무한 루프 가능성
- **해결**: 웹훅 depth 제한 및 correlation ID 추적

### 이슈 8.2: 서비스 시작 순서 의존성
- **위치**: `cross-service/integration-specs.md`
- **내용**: Onramp가 PG/Bank에 의존하나 시작 순서 정의 없음
- **해결**: 헬스체크 기반 서비스 대기 로직 추가

### 이슈 8.3: 동시 요청 시 데드락 가능성
- **위치**: 전체 서비스
- **내용**: 인메모리 저장소의 RWMutex 사용 시 크로스 서비스 호출에서 데드락 가능
- **해결**: 락 범위 최소화 및 타임아웃 적용

### 이슈 8.4: 트랜잭션 경계 불명확
- **위치**: `onramp-simulator/feature-specs/payment-integration.md`
- **내용**: 결제 → 주문 상태 업데이트 → 블록체인 전송이 원자적이지 않음
- **해결**: 상태 머신 패턴 적용 및 각 단계 롤백 로직 정의

---

## 권장 수정 우선순위

### 즉시 수정 필요 (P0) - ✅ 해결 완료
1. ✅ Direct Debit 멱등성 키 추가 (이슈 3.1) - `direct-debit.md` 수정됨
2. ✅ 상태 매핑 테이블 정의 (이슈 2.3) - `common/status-mapping.md` 생성됨
3. ✅ 웹훅 순환 호출 방지 (이슈 8.1) - `common/webhook-spec.md` 생성됨
4. ✅ 환경변수 네이밍 수정 (이슈 7.1) - 각 README.md 수정됨
5. ✅ Order 상태 불일치 (이슈 2.2) - onramp README.md 수정됨

### 구현 전 수정 권장 (P1) - ✅ 해결 완료
1. ✅ Transaction 모델 통합 (이슈 2.1) - `transaction-history.md`에서 `deposit-withdraw.md` 참조로 변경
2. ✅ Transaction 엔드포인트 분리 (이슈 1.1) - POST는 `deposit-withdraw.md`, GET은 `transaction-history.md`로 명확히 분리
3. ✅ 부분 실패 처리 정의 (이슈 3.3) - `payment-integration.md`에 `payment_completed_pending_transfer` 상태 및 환불 플로우 추가
4. ✅ 웹훅 버전 관리 (이슈 6.2) - 각 feature-spec의 웹훅 예제에 표준 형식(version, eventId, deliveryId 등) 적용

### 구현 중 수정 가능 (P2) - ✅ 해결 완료
1. ✅ 헬스체크 엔드포인트 (이슈 1.2) - 각 시뮬레이터 README.md에 `GET /health` API 스펙 추가 (ok/degraded 응답, 의존 서비스 상태 포함)
2. ✅ KYC 갱신 플로우 (이슈 4.3) - `kyc-flow.md`에 `POST /api/v1/kyc/renew` API, 서비스 로직, 웹훅 이벤트(`kyc.renewed`) 추가
3. ✅ 정산 조정 로직 (이슈 4.4) - `settlement.md`에 Adjustment API (`POST/GET`), 데이터 모델, 서비스 로직, 웹훅(`settlement.adjusted`) 추가
4. ✅ 체인 ID 통합 (이슈 5.4) - `supported-assets.md`, `multi-currency-rates.md`에서 하드코딩된 체인 ID를 `common/types.md`의 `ChainID` 상수 참조로 변경

---

## 다음 단계

### 완료됨
- ✅ P0 이슈 문서 수정
- ✅ 공통 타입 정의 문서 생성 (`common/types.md`)
- ✅ 상태 매핑 테이블 문서 생성 (`common/status-mapping.md`)
- ✅ 웹훅 스펙 통합 문서 생성 (`common/webhook-spec.md`)
- ✅ P1 이슈 문서 수정
  - Transaction 모델 참조 통합
  - 부분 실패 처리 로직 추가
  - 웹훅 버전 관리 적용
- ✅ P2 이슈 문서 수정
  - 헬스체크 엔드포인트 추가 (3개 서비스)
  - KYC 갱신 플로우 추가
  - 정산 조정 API/모델 추가
  - 체인 ID 공통 타입 통합

### 다음 작업
1. 각 기능별 상세 구현 착수 (Phase 3)
2. 통합 테스트 계획 수립
