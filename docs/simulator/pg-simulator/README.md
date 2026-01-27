# PG Simulator

결제 게이트웨이(Payment Gateway) 기능을 시뮬레이션하는 서비스입니다.

## 서비스 정보

| 항목 | 값 |
|------|-----|
| 포트 | 4351 |
| 언어 | Go 1.24 |
| 프레임워크 | Gin |
| 스토리지 | In-memory |

## 현재 구현된 기능

### 1. 결제 처리
- ✅ 결제 생성 (`POST /api/v1/payments`)
- ✅ 결제 조회 (`GET /api/v1/payments/{id}`)
- ✅ 결제 취소 (`POST /api/v1/payments/{id}/cancel`)
- ✅ 환불 (`POST /api/v1/payments/{id}/refund`)
- ✅ 가맹점별 결제 조회 (`GET /api/v1/merchants/{merchantId}/payments`)

### 2. 3D Secure
- ✅ 3DS 시작 (`POST /api/v1/payments/{id}/3ds/initiate`)
- ✅ 3DS Challenge 완료 (`POST /api/v1/payments/{id}/3ds/complete`)
- ✅ 3DS 후 결제 승인 (`POST /api/v1/payments/{id}/3ds/finalize`)
- ✅ Challenge 페이지 렌더링 (`GET /api/v1/3ds/challenge/{acsTransactionId}`)

### 3. 카드 검증
- ✅ Luhn 알고리즘 검증
- ✅ CVV 검증 (브랜드별)
- ✅ 만료일 검증
- ✅ 카드 브랜드 감지 (Visa, Mastercard, AmEx, Discover)

### 4. 헬스체크
- ✅ 서비스 상태 확인 (`GET /health`)

### 5. 보안
- ✅ Rate limiting (100 req/min per IP)
- ✅ Idempotency key 지원
- ✅ HMAC-SHA256 웹훅 서명
- ✅ 카드 정보 마스킹

### 5. 웹훅
- ✅ `payment.approved` / `payment.declined`
- ✅ `payment.cancelled` / `payment.refunded`
- ✅ `payment.3ds.succeeded` / `payment.3ds.failed`

## 데이터 모델

### Payment
```go
type Payment struct {
    ID            string
    MerchantID    string
    OrderID       string
    Amount        string
    Currency      string
    Method        PaymentMethod  // card | bank_transfer | wallet
    Status        PaymentStatus
    CardLast4     string
    CardBrand     string
    FailureReason string
    RefundedAt    *time.Time
    CreatedAt     time.Time
    UpdatedAt     time.Time
    ThreeDSecure  *ThreeDSecureData
}
```

### PaymentStatus
```go
const (
    PaymentStatusPending
    PaymentStatusRequires3DS
    PaymentStatusPending3DSComplete
    PaymentStatusApproved
    PaymentStatusDeclined
    PaymentStatusRefunded
    PaymentStatusCancelled
)
```

## 환경 변수

> 환경변수 네이밍 규칙: [공통 타입 문서](../common/types.md#환경변수-네이밍-규칙)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| PG_PORT | 4351 | 서버 포트 |
| PG_BASE_URL | http://localhost:4351 | 3DS redirect용 기본 URL |
| PG_WEBHOOK_URL | "" | 웹훅 전송 URL |
| PG_WEBHOOK_SECRET | pg-webhook-secret-dev | 웹훅 서명 시크릿 |
| PG_SUCCESS_RATE | 95 | 결제 성공률 (0-100) |
| PG_RATE_LIMIT | 100 | 분당 요청 제한 |
| PG_BANK_URL | http://localhost:4350 | Bank Simulator URL |
| LOG_LEVEL | info | 로그 레벨 |
| LOG_FORMAT | json | 로그 형식 |

## 테스트 카드

| 카드 번호 | 브랜드 | 설명 |
|-----------|--------|------|
| 4242424242424242 | Visa | 성공 |
| 4111111111111111 | Visa | 성공 |
| 5555555555554444 | Mastercard | 성공 |
| 378282246310005 | AmEx | 성공 |
| 6011111111111117 | Discover | 성공 |
| 4242424242424241 | - | Luhn 실패 |

## 누락 기능

상세 분석: [gap-analysis.md](./gap-analysis.md)

| 기능 | 우선순위 | 상세 스펙 |
|------|----------|----------|
| bank_transfer 결제 플로우 | P0 | [bank-transfer-flow.md](./feature-specs/bank-transfer-flow.md) |
| wallet 결제 플로우 | P0 | [wallet-payment-flow.md](./feature-specs/wallet-payment-flow.md) |
| Return/Cancel URL | P1 | [redirect-url.md](./feature-specs/redirect-url.md) |
| Checkout Session | P1 | [checkout-session.md](./feature-specs/checkout-session.md) |
| 정산 시뮬레이션 | P2 | [settlement.md](./feature-specs/settlement.md) |
| 구독/정기결제 | P2 | - |

## 헬스체크 API

### GET /health

**설명**: 서비스 상태 확인

**응답 (200)**:
```json
{
  "status": "ok",
  "service": "pg-simulator",
  "version": "1.0.0",
  "uptime": "2h30m15s",
  "timestamp": "2026-01-27T10:00:00Z"
}
```

**응답 (503)** - 서비스 이상 시:
```json
{
  "status": "degraded",
  "service": "pg-simulator",
  "version": "1.0.0",
  "issues": ["bank_simulator_unreachable"],
  "timestamp": "2026-01-27T10:00:00Z"
}
```

## 디렉토리 구조

```
services/pg-simulator/
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── handler/
│   │   └── payment.go
│   ├── middleware/
│   │   └── ratelimit.go
│   ├── model/
│   │   └── payment.go
│   └── service/
│       ├── payment.go
│       └── payment_test.go
├── go.mod
└── go.sum
```
