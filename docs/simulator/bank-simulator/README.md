# Bank Simulator

전통 은행 및 디지털 은행 기능을 시뮬레이션하는 서비스입니다.

## 서비스 정보

| 항목 | 값 |
|------|-----|
| 포트 | 4350 |
| 언어 | Go 1.24 |
| 프레임워크 | Gin |
| 스토리지 | In-memory |

## 현재 구현된 기능

### 1. 계좌 관리
- ✅ 계좌 생성 (`POST /api/v1/accounts`)
- ✅ 계좌 조회 (`GET /api/v1/accounts/{accountNo}`)
- ✅ 계좌 목록 (`GET /api/v1/accounts`)
- ✅ 계좌 동결 (`POST /api/v1/accounts/{accountNo}/freeze`)
- ✅ 계좌 해제 (`POST /api/v1/accounts/{accountNo}/unfreeze`)

### 2. 이체
- ✅ 계좌 간 이체 (`POST /api/v1/transfers`)
- ✅ 이체 조회 (`GET /api/v1/transfers/{id}`)
- ✅ 계좌별 이체 내역 (`GET /api/v1/accounts/{accountNo}/transfers`)

### 3. 헬스체크
- ✅ 서비스 상태 확인 (`GET /health`)

### 4. 보안
- ✅ Rate limiting (100 req/min per IP)
- ✅ Request body size limit (1MB)
- ✅ HMAC-SHA256 웹훅 서명
- ✅ Error sanitization
- ✅ 로그 마스킹

### 4. 웹훅
- ✅ `transfer.completed`
- ✅ `account.frozen`
- ✅ `account.unfrozen`

## 데이터 모델

### Account
```go
type Account struct {
    ID        string        // UUID
    AccountNo string        // "BANK" + timestamp
    Name      string        // 계좌주명
    Currency  string        // 통화 코드
    Balance   string        // 잔액 (문자열, 정밀도 보장)
    Status    AccountStatus // active | frozen | closed
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### Transfer
```go
type Transfer struct {
    ID            string
    FromAccountNo string
    ToAccountNo   string
    Amount        string
    Currency      string
    Reference     string
    Status        TransferStatus // pending | completed | failed
    FailureReason string
    CreatedAt     time.Time
    CompletedAt   *time.Time
}
```

## 환경 변수

> 환경변수 네이밍 규칙: [공통 타입 문서](../common/types.md#환경변수-네이밍-규칙)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| BANK_PORT | 4350 | 서버 포트 |
| BANK_WEBHOOK_URL | "" | 웹훅 전송 URL |
| BANK_WEBHOOK_SECRET | bank-webhook-secret-dev | 웹훅 서명 시크릿 |
| BANK_DEFAULT_BALANCE | 10000.00 | 신규 계좌 기본 잔액 |
| BANK_RATE_LIMIT | 100 | 분당 요청 제한 |
| LOG_LEVEL | info | 로그 레벨 |
| LOG_FORMAT | json | 로그 형식 |

## 누락 기능

상세 분석: [gap-analysis.md](./gap-analysis.md)

| 기능 | 우선순위 | 상세 스펙 |
|------|----------|----------|
| 입금/출금 API | P0 | [deposit-withdraw.md](./feature-specs/deposit-withdraw.md) |
| 계좌 인증 API | P0 | [account-verification.md](./feature-specs/account-verification.md) |
| Direct Debit API | P0 | [direct-debit.md](./feature-specs/direct-debit.md) |
| 거래 내역 조회 | P1 | [transaction-history.md](./feature-specs/transaction-history.md) |
| 계좌 해지 | P1 | [account-close.md](./feature-specs/account-close.md) |
| 거래 한도 | P2 | - |

## 헬스체크 API

### GET /health

**설명**: 서비스 상태 확인

**응답 (200)**:
```json
{
  "status": "ok",
  "service": "bank-simulator",
  "version": "1.0.0",
  "uptime": "2h30m15s",
  "timestamp": "2026-01-27T10:00:00Z"
}
```

**응답 (503)** - 서비스 이상 시:
```json
{
  "status": "degraded",
  "service": "bank-simulator",
  "version": "1.0.0",
  "issues": ["high_memory_usage"],
  "timestamp": "2026-01-27T10:00:00Z"
}
```

## 디렉토리 구조

```
services/bank-simulator/
├── cmd/
│   └── main.go              # 엔트리포인트
├── internal/
│   ├── config/
│   │   └── config.go        # 설정 관리
│   ├── handler/
│   │   └── bank.go          # HTTP 핸들러
│   ├── middleware/
│   │   └── ratelimit.go     # Rate limiting
│   ├── model/
│   │   └── account.go       # 데이터 모델
│   └── service/
│       └── bank.go          # 비즈니스 로직
├── go.mod
└── go.sum
```
