# Bank Transfer 결제 플로우

## 개요

PG의 `bank_transfer` 결제 방식을 bank-simulator와 연동하여 실제 계좌 이체로 처리합니다.

**우선순위**: P0
**의존성**: bank-simulator의 Direct Debit API
**영향**: onramp-simulator (bank_transfer 결제)

## 현재 상태

- `PaymentMethodBank` enum 존재
- 결제 생성 시 method로 `bank_transfer` 전달 가능
- 카드 결제와 동일하게 성공률로만 처리
- bank-simulator 연동 없음

## 목표

```
가맹점                  PG Simulator              Bank Simulator
  │                         │                           │
  │  1. 결제 생성            │                           │
  │  (bank_transfer)        │                           │
  ├────────────────────────▶│                           │
  │                         │  2. Direct Debit 요청     │
  │                         ├─────────────────────────▶│
  │                         │                           │ 잔액 확인/차감
  │                         │  3. 결과 반환              │
  │                         │◀─────────────────────────┤
  │  4. 결제 결과            │                           │
  │◀────────────────────────┤                           │
```

## API 설계

### 결제 생성 요청 확장

**기존 CreatePaymentRequest에 은행 정보 추가**:

```json
{
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "amount": "50000",
  "currency": "KRW",
  "method": "bank_transfer",
  "bankAccount": {
    "accountNo": "BANK1234567890",
    "holderName": "홍길동"
  },
  "returnUrl": "https://shop.example.com/payment/complete",
  "cancelUrl": "https://shop.example.com/payment/cancel"
}
```

**새 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| bankAccount | object | ✅ (bank_transfer 시) | 출금 계좌 정보 |
| bankAccount.accountNo | string | ✅ | 계좌번호 |
| bankAccount.holderName | string | ✅ | 예금주명 |

### 결제 응답 확장

```json
{
  "id": "pay_uuid",
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "amount": "50000",
  "currency": "KRW",
  "method": "bank_transfer",
  "status": "approved",
  "bankAccount": {
    "accountNo": "BANK****7890",
    "holderName": "홍*동"
  },
  "debitRequestId": "debit_uuid",
  "createdAt": "2026-01-27T10:00:00Z",
  "updatedAt": "2026-01-27T10:00:01Z"
}
```

## 데이터 모델

### 기존 모델 확장

```go
// model/payment.go에 추가

type BankAccountInfo struct {
    AccountNo   string `json:"accountNo" binding:"required"`
    HolderName  string `json:"holderName" binding:"required"`
}

type CreatePaymentRequest struct {
    MerchantID     string           `json:"merchantId" binding:"required"`
    OrderID        string           `json:"orderId" binding:"required"`
    Amount         string           `json:"amount" binding:"required"`
    Currency       string           `json:"currency" binding:"required"`
    Method         PaymentMethod    `json:"method" binding:"required"`
    Card           *CardDetails     `json:"card,omitempty"`
    BankAccount    *BankAccountInfo `json:"bankAccount,omitempty"`  // 추가
    IdempotencyKey string           `json:"idempotencyKey,omitempty"`
    ReturnUrl      string           `json:"returnUrl,omitempty"`    // 추가
    CancelUrl      string           `json:"cancelUrl,omitempty"`    // 추가
}

type Payment struct {
    // 기존 필드들...
    BankAccountNo     string `json:"bankAccountNo,omitempty"`     // 추가 (마스킹된)
    BankHolderName    string `json:"bankHolderName,omitempty"`    // 추가 (마스킹된)
    DebitRequestID    string `json:"debitRequestId,omitempty"`    // 추가
    ReturnUrl         string `json:"returnUrl,omitempty"`         // 추가
    CancelUrl         string `json:"cancelUrl,omitempty"`         // 추가
}
```

## 환경 변수 추가

```go
// config/config.go에 추가

type Config struct {
    // 기존 필드들...
    BankSimulatorURL string  // bank-simulator URL
}

func LoadConfig() *Config {
    return &Config{
        // 기존...
        BankSimulatorURL: getEnv("BANK_SIMULATOR_URL", "http://localhost:4350"),
    }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| BANK_SIMULATOR_URL | http://localhost:4350 | bank-simulator URL |

## 서비스 로직

### CreatePayment 수정

```go
func (s *PaymentService) CreatePayment(req CreatePaymentRequest) (*Payment, error) {
    // ... 기존 검증 로직

    if req.Method == PaymentMethodBank {
        return s.processBankTransfer(req)
    }

    // ... 기존 카드 결제 로직
}
```

### processBankTransfer (신규)

```go
func (s *PaymentService) processBankTransfer(req CreatePaymentRequest) (*Payment, error) {
    // 1. 은행 계좌 정보 검증
    if req.BankAccount == nil {
        return nil, ErrBankAccountRequired
    }

    // 2. 결제 레코드 생성 (pending 상태)
    payment := &Payment{
        ID:             uuid.New().String(),
        MerchantID:     req.MerchantID,
        OrderID:        req.OrderID,
        Amount:         req.Amount,
        Currency:       req.Currency,
        Method:         PaymentMethodBank,
        Status:         PaymentStatusPending,
        BankAccountNo:  maskAccountNo(req.BankAccount.AccountNo),
        BankHolderName: maskName(req.BankAccount.HolderName),
        ReturnUrl:      req.ReturnUrl,
        CancelUrl:      req.CancelUrl,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    s.mu.Lock()
    s.payments[payment.ID] = payment
    s.mu.Unlock()

    // 3. bank-simulator에 계좌 확인 요청
    verified, err := s.verifyBankAccount(
        req.BankAccount.AccountNo,
        req.BankAccount.HolderName,
    )
    if err != nil || !verified {
        payment.Status = PaymentStatusDeclined
        payment.FailureReason = "account_verification_failed"
        go s.sendWebhook("payment.declined", payment)
        return payment, nil
    }

    // 4. bank-simulator에 Direct Debit 요청
    debitResult, err := s.requestDirectDebit(
        req.BankAccount.AccountNo,
        req.Amount,
        req.Currency,
        payment.ID,
    )

    if err != nil {
        payment.Status = PaymentStatusDeclined
        payment.FailureReason = "bank_communication_error"
        go s.sendWebhook("payment.declined", payment)
        return payment, nil
    }

    payment.DebitRequestID = debitResult.ID

    // 5. 결과에 따라 상태 업데이트
    if debitResult.Status == "completed" {
        payment.Status = PaymentStatusApproved
        payment.UpdatedAt = time.Now()
        go s.sendWebhook("payment.approved", payment)
    } else {
        payment.Status = PaymentStatusDeclined
        payment.FailureReason = debitResult.FailureReason
        payment.UpdatedAt = time.Now()
        go s.sendWebhook("payment.declined", payment)
    }

    return payment, nil
}
```

### Bank Simulator 연동 함수

```go
type BankClient struct {
    baseURL    string
    httpClient *http.Client
}

func NewBankClient(baseURL string) *BankClient {
    return &BankClient{
        baseURL: baseURL,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

// 계좌 확인
func (c *BankClient) VerifyAccount(accountNo, holderName string) (bool, error) {
    reqBody := map[string]string{
        "accountNo":   accountNo,
        "holderName":  holderName,
    }

    resp, err := c.post("/api/v1/accounts/verify", reqBody)
    if err != nil {
        return false, err
    }
    defer resp.Body.Close()

    var result struct {
        Verified bool   `json:"verified"`
        Reason   string `json:"reason,omitempty"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return false, err
    }

    return result.Verified, nil
}

// Direct Debit 요청
func (c *BankClient) RequestDebit(accountNo, amount, currency, reference string) (*DebitResult, error) {
    reqBody := map[string]interface{}{
        "accountNo":    accountNo,
        "amount":       amount,
        "currency":     currency,
        "creditorId":   "PG_SIMULATOR",
        "creditorName": "PG Simulator",
        "reference":    reference,
        "autoApprove":  true,  // PoC에서는 즉시 승인
    }

    resp, err := c.post("/api/v1/debit-requests", reqBody)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result DebitResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    // autoApprove=true이므로 즉시 결과 반환됨
    // 실제로는 웹훅 기반 비동기 처리 필요할 수 있음

    return &result, nil
}

type DebitResult struct {
    ID            string `json:"id"`
    Status        string `json:"status"`
    FailureReason string `json:"failureReason,omitempty"`
}
```

### 마스킹 함수

```go
func maskAccountNo(accountNo string) string {
    if len(accountNo) <= 4 {
        return accountNo
    }
    // "BANK1234567890" → "BANK****7890"
    prefix := accountNo[:4]
    suffix := accountNo[len(accountNo)-4:]
    return prefix + "****" + suffix
}

func maskName(name string) string {
    runes := []rune(name)
    if len(runes) <= 1 {
        return name
    }
    if len(runes) == 2 {
        return string(runes[0]) + "*"
    }
    // "홍길동" → "홍*동"
    return string(runes[0]) + "*" + string(runes[len(runes)-1])
}
```

## 에러 처리

```go
var (
    ErrBankAccountRequired        = errors.New("bank account info required for bank_transfer")
    ErrBankCommunicationError     = errors.New("failed to communicate with bank")
    ErrAccountVerificationFailed  = errors.New("account verification failed")
)
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/payment.go` | BankAccountInfo, Payment 확장 |
| `internal/config/config.go` | BANK_SIMULATOR_URL 추가 |
| `internal/service/payment.go` | processBankTransfer(), BankClient 추가 |
| `internal/service/bank_client.go` | 새 파일 - bank-simulator 연동 클라이언트 |
| `cmd/main.go` | BankClient 초기화 |

## 웹훅 이벤트

> **참고**: 웹훅 페이로드는 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

bank_transfer 결제도 기존 웹훅 이벤트 사용:
- `payment.approved`
- `payment.declined`

추가 필드:
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440020",
  "eventType": "payment.approved",
  "timestamp": "2026-01-27T10:00:01Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440020",
  "attemptNumber": 1,
  "source": "pg",
  "data": {
    "id": "pay_uuid",
    "method": "bank_transfer",
    "bankAccountNo": "BANK****7890",
    "debitRequestId": "debit_uuid"
  }
}
```

## 테스트 케이스

1. bank_transfer 결제 성공 - 잔액 충분
2. bank_transfer 결제 실패 - 잔액 부족
3. bank_transfer 결제 실패 - 계좌 없음
4. bank_transfer 결제 실패 - 예금주명 불일치
5. bank_transfer 결제 실패 - 동결 계좌
6. bankAccount 없이 bank_transfer 요청 - 400 에러
7. bank-simulator 연결 실패 - 에러 처리
8. 결제 조회 시 bankAccountNo 마스킹 확인
9. 웹훅 발송 확인
10. Idempotency key 동작 확인

## 관련 문서

- [Direct Debit API](../../bank-simulator/feature-specs/direct-debit.md) - Bank Simulator의 Direct Debit 스펙
- [공통 타입 정의](../../common/types.md) - Amount, PaymentMethod 등 공통 타입
- [상태 매핑](../../common/status-mapping.md) - DirectDebit → Payment 상태 매핑
- [웹훅 스펙](../../common/webhook-spec.md) - 웹훅 페이로드, 서명, 재시도 정책
