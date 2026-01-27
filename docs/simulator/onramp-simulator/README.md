# Onramp Simulator

Fiat에서 Crypto로의 온램프 기능을 시뮬레이션하는 서비스입니다.

## 서비스 정보

| 항목 | 값 |
|------|-----|
| 포트 | 4352 |
| 언어 | Go 1.24 |
| 프레임워크 | Gin |
| 스토리지 | In-memory |

## 현재 구현된 기능

### 1. 견적(Quote)
- ✅ 견적 조회 (`POST /api/v1/quote`)
- ✅ 환율 적용 (configurable)
- ✅ 수수료 계산 (1.5%)
- ✅ 견적 만료 시간 (5분)

### 2. 주문 관리
- ✅ 주문 생성 (`POST /api/v1/orders`)
- ✅ 주문 조회 (`GET /api/v1/orders/{id}`)
- ✅ 주문 취소 (`POST /api/v1/orders/{id}/cancel`)
- ✅ 사용자별 주문 조회 (`GET /api/v1/users/{userId}/orders`)

### 3. 주문 처리
- ✅ 비동기 상태 전이 (pending → processing → completed/failed)
- ✅ 처리 시간 시뮬레이션 (configurable)
- ✅ 성공률 시뮬레이션 (configurable)
- ✅ 실패 사유 랜덤 생성

### 4. 헬스체크
- ✅ 서비스 상태 확인 (`GET /health`)

### 5. 보안
- ✅ Rate limiting (100 req/min per IP)
- ✅ HMAC-SHA256 웹훅 서명
- ✅ 사용자 ID 마스킹

### 5. 웹훅
- ✅ `order.created`
- ✅ `order.processing`
- ✅ `order.completed`
- ✅ `order.failed`
- ✅ `order.cancelled`

## 데이터 모델

### Order
```go
type Order struct {
    ID             string
    UserID         string
    WalletAddress  string
    FiatAmount     string
    FiatCurrency   string
    CryptoAmount   string
    CryptoCurrency string
    ExchangeRate   string
    Fee            string
    PaymentMethod  PaymentMethod  // card | bank_transfer | apple_pay | google_pay
    Status         OrderStatus
    FailureReason  string
    TxHash         string
    ChainID        int
    KYCStatus      string
    CreatedAt      time.Time
    UpdatedAt      time.Time
    CompletedAt    *time.Time
}
```

### OrderStatus
```go
const (
    OrderStatusPending         // 주문 생성됨
    OrderStatusPendingPayment  // 결제 대기 중 (PG/Bank 처리 중)
    OrderStatusProcessing      // 결제 완료, 전송 준비
    OrderStatusCompleted       // 전송 완료
    OrderStatusFailed          // 실패
    OrderStatusCancelled       // 취소됨
    OrderStatusRefunding       // 환불 진행 중
    OrderStatusRefunded        // 환불 완료
    OrderStatusKYCRequired     // KYC 필요
)
```

> 상태 매핑 상세: [상태 매핑 문서](../common/status-mapping.md)

### PaymentMethod
```go
const (
    PaymentMethodCard
    PaymentMethodBankTransfer
    PaymentMethodApplePay
    PaymentMethodGooglePay
)
```

## 환경 변수

> 환경변수 네이밍 규칙: [공통 타입 문서](../common/types.md#환경변수-네이밍-규칙)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| ONRAMP_PORT | 4352 | 서버 포트 |
| ONRAMP_WEBHOOK_URL | "" | 웹훅 전송 URL |
| ONRAMP_WEBHOOK_SECRET | onramp-webhook-secret-dev | 웹훅 서명 시크릿 |
| ONRAMP_PROCESSING_TIME | 5 | 처리 단계별 지연 시간 (초) |
| ONRAMP_SUCCESS_RATE | 95 | 주문 성공률 (0-100) |
| ONRAMP_RATE_LIMIT | 100 | 분당 요청 제한 |
| ONRAMP_PG_URL | http://localhost:4351 | PG Simulator URL |
| ONRAMP_BANK_URL | http://localhost:4350 | Bank Simulator URL |
| USD_TO_USDC | 0.998 | 환율 |
| LOG_LEVEL | info | 로그 레벨 |
| LOG_FORMAT | json | 로그 형식 |

## 가격 계산 공식

```
Fee = FiatAmount × 0.015 (1.5%)
NetAmount = FiatAmount - Fee
CryptoAmount = NetAmount × ExchangeRate

예시: 100 USD
├─ Fee: 100 × 0.015 = 1.50 USD
├─ Net: 100 - 1.50 = 98.50 USD
└─ Crypto: 98.50 × 0.998 = 98.303 USDC
```

## 누락 기능

상세 분석: [gap-analysis.md](./gap-analysis.md)

| 기능 | 우선순위 | 상세 스펙 |
|------|----------|----------|
| 결제 수단별 연동 | P0 | [payment-integration.md](./feature-specs/payment-integration.md) |
| KYC 플로우 | P0 | [kyc-flow.md](./feature-specs/kyc-flow.md) |
| 지원 자산/네트워크 API | P1 | [supported-assets.md](./feature-specs/supported-assets.md) |
| 다중 환율 지원 | P1 | [multi-currency-rates.md](./feature-specs/multi-currency-rates.md) |
| 월렛 주소 검증 | P2 | [wallet-validation.md](./feature-specs/wallet-validation.md) |
| 거래 한도 | P2 | - |

## 헬스체크 API

### GET /health

**설명**: 서비스 상태 확인

**응답 (200)**:
```json
{
  "status": "ok",
  "service": "onramp-simulator",
  "version": "1.0.0",
  "uptime": "2h30m15s",
  "dependencies": {
    "pg-simulator": "ok",
    "bank-simulator": "ok"
  },
  "timestamp": "2026-01-27T10:00:00Z"
}
```

**응답 (503)** - 서비스 이상 시:
```json
{
  "status": "degraded",
  "service": "onramp-simulator",
  "version": "1.0.0",
  "dependencies": {
    "pg-simulator": "ok",
    "bank-simulator": "unreachable"
  },
  "issues": ["bank_simulator_unreachable"],
  "timestamp": "2026-01-27T10:00:00Z"
}
```

## 디렉토리 구조

```
services/onramp-simulator/
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── handler/
│   │   └── onramp.go
│   ├── middleware/
│   │   └── ratelimit.go
│   ├── model/
│   │   └── order.go
│   └── service/
│       ├── onramp.go
│       └── onramp_test.go
├── go.mod
└── go.sum
```
