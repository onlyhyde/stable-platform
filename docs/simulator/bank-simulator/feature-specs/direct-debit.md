# Direct Debit API

## 개요

외부 서비스(PG, Onramp)가 사용자 동의 하에 계좌에서 출금할 수 있는 Direct Debit API를 추가합니다.

**우선순위**: P0
**의존성**: 없음
**영향**: pg-simulator (bank_transfer 결제), onramp-simulator (bank_transfer 결제)

## 현재 상태

- 외부 서비스가 계좌에서 직접 출금하는 방법 없음
- 계좌 간 이체만 가능 (양쪽 모두 은행 내 계좌 필요)

## 요구사항

### 기능 요구사항

1. **출금 요청 생성**: 외부 서비스가 출금 요청
2. **비동기 처리**: 요청 후 승인/거절 처리 (시뮬레이션)
3. **상태 조회**: 출금 요청 상태 확인
4. **자동 승인 모드**: PoC 편의를 위한 즉시 승인 옵션
5. 잔액 부족, 동결 등 상황 시 거절

### 비기능 요구사항

- 요청자 식별 (creditorId)
- 참조 ID 매핑 (외부 트랜잭션과 연결)
- 웹훅으로 결과 통보

## 처리 플로우

```
PG/Onramp                     Bank Simulator
    │                              │
    │  1. POST /debit-requests     │
    ├─────────────────────────────▶│
    │                              │ 요청 생성 (pending)
    │  2. 202 Accepted             │
    │◀─────────────────────────────┤
    │                              │
    │         (비동기 처리)          │
    │                              │ 잔액 확인
    │                              │ 상태 검증
    │                              │ 출금 실행 또는 거절
    │                              │
    │  3. Webhook (결과)            │
    │◀─────────────────────────────┤
    │                              │
```

## API 설계

### POST /api/v1/debit-requests

**설명**: 출금 요청 생성

**요청**:
```json
{
  "idempotencyKey": "idem_550e8400-e29b-41d4-a716-446655440000",
  "accountNo": "BANK1234567890",
  "amount": "50000.00",
  "currency": "KRW",
  "creditorId": "PG_MERCHANT_001",
  "creditorName": "온라인쇼핑몰",
  "reference": "PAYMENT_ORDER_12345",
  "description": "상품 결제",
  "autoApprove": true,
  "webhookUrl": "http://localhost:4351/webhooks/bank"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| idempotencyKey | string | ✅ | 멱등성 키 (중복 요청 방지) |
| accountNo | string | ✅ | 출금 대상 계좌번호 |
| amount | string | ✅ | 출금 금액 |
| currency | string | ✅ | 통화 코드 |
| creditorId | string | ✅ | 요청자 식별자 (가맹점 ID 등) |
| creditorName | string | ✅ | 요청자명 |
| reference | string | ❌ | 외부 참조 ID |
| description | string | ❌ | 출금 사유 |
| autoApprove | bool | ❌ | true면 즉시 승인 (기본: false) |
| webhookUrl | string | ❌ | 결과 수신 웹훅 URL |

**멱등성 처리**:
- 동일한 `idempotencyKey`로 요청 시 기존 결과 반환
- 멱등성 키는 24시간 동안 유효
- 키 형식: `idem_` prefix + UUID 권장

**응답 (202)**:
```json
{
  "id": "debit_uuid",
  "accountNo": "BANK1234567890",
  "amount": "50000.00",
  "currency": "KRW",
  "creditorId": "PG_MERCHANT_001",
  "creditorName": "온라인쇼핑몰",
  "reference": "PAYMENT_ORDER_12345",
  "status": "pending",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 400 | missing_idempotency_key | 멱등성 키 누락 |
| 400 | invalid_amount | 금액이 0 이하 |
| 404 | account_not_found | 계좌 없음 |
| 400 | account_unavailable | 동결/해지 계좌 |

---

### GET /api/v1/debit-requests/{id}

**설명**: 출금 요청 상태 조회

**응답 (200)**:
```json
{
  "id": "debit_uuid",
  "accountNo": "BANK1234567890",
  "amount": "50000.00",
  "currency": "KRW",
  "creditorId": "PG_MERCHANT_001",
  "creditorName": "온라인쇼핑몰",
  "reference": "PAYMENT_ORDER_12345",
  "status": "completed",
  "failureReason": "",
  "transactionId": "txn_uuid",
  "createdAt": "2026-01-27T10:00:00Z",
  "processedAt": "2026-01-27T10:00:01Z"
}
```

**status 값**:
| 상태 | 설명 |
|------|------|
| pending | 처리 대기 중 |
| processing | 처리 중 |
| completed | 출금 완료 |
| rejected | 거절됨 |
| cancelled | 취소됨 |

---

### POST /api/v1/debit-requests/{id}/cancel

**설명**: 출금 요청 취소 (pending 상태에서만 가능)

**응답 (200)**:
```json
{
  "id": "debit_uuid",
  "status": "cancelled",
  "cancelledAt": "2026-01-27T10:00:30Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 400 | invalid_status | pending 상태가 아님 |
| 404 | not_found | 요청 없음 |

## 데이터 모델

### DebitRequest (신규)

```go
type DebitRequestStatus string

const (
    DebitRequestStatusPending    DebitRequestStatus = "pending"
    DebitRequestStatusProcessing DebitRequestStatus = "processing"
    DebitRequestStatusCompleted  DebitRequestStatus = "completed"
    DebitRequestStatusRejected   DebitRequestStatus = "rejected"
    DebitRequestStatusCancelled  DebitRequestStatus = "cancelled"
)

type DebitRequest struct {
    ID             string             `json:"id"`
    IdempotencyKey string             `json:"idempotencyKey"`
    AccountNo      string             `json:"accountNo"`
    Amount         string             `json:"amount"`
    Currency       string             `json:"currency"`
    CreditorID     string             `json:"creditorId"`
    CreditorName   string             `json:"creditorName"`
    Reference      string             `json:"reference,omitempty"`
    Description    string             `json:"description,omitempty"`
    WebhookURL     string             `json:"webhookUrl,omitempty"`
    Status         DebitRequestStatus `json:"status"`
    FailureReason  string             `json:"failureReason,omitempty"`
    TransactionID  string             `json:"transactionId,omitempty"`
    AutoApprove    bool               `json:"-"`
    CreatedAt      time.Time          `json:"createdAt"`
    ProcessedAt    *time.Time         `json:"processedAt,omitempty"`
    CancelledAt    *time.Time         `json:"cancelledAt,omitempty"`
}
```

### IdempotencyRecord (멱등성 관리)

```go
type IdempotencyRecord struct {
    DebitRequestID string    `json:"debitRequestId"`
    CreatedAt      time.Time `json:"createdAt"`
}
```

### Request 모델

```go
type CreateDebitRequestInput struct {
    IdempotencyKey string `json:"idempotencyKey" binding:"required"`
    AccountNo      string `json:"accountNo" binding:"required"`
    Amount         string `json:"amount" binding:"required"`
    Currency       string `json:"currency" binding:"required"`
    CreditorID     string `json:"creditorId" binding:"required"`
    CreditorName   string `json:"creditorName" binding:"required"`
    Reference      string `json:"reference"`
    Description    string `json:"description"`
    WebhookURL     string `json:"webhookUrl"`
    AutoApprove    bool   `json:"autoApprove"`
}
```

## 서비스 로직

### CreateDebitRequest

```go
func (s *BankService) CreateDebitRequest(req CreateDebitRequestInput) (*DebitRequest, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 0. 멱등성 키 확인 (중복 요청 방지)
    if existing, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
        // 24시간 이내의 요청이면 기존 결과 반환
        if time.Since(existing.CreatedAt) < 24*time.Hour {
            return s.debitRequests[existing.DebitRequestID], nil
        }
        // 만료된 키는 삭제
        delete(s.idempotencyKeys, req.IdempotencyKey)
    }

    // 1. 계좌 확인
    account, exists := s.accounts[req.AccountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    if account.Status != AccountStatusActive {
        return nil, ErrAccountUnavailable
    }

    // 2. 금액 검증
    amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
    if err != nil || amount.Sign() <= 0 {
        return nil, ErrInvalidAmount
    }

    // 3. 요청 생성
    debitReq := &DebitRequest{
        ID:             uuid.New().String(),
        IdempotencyKey: req.IdempotencyKey,
        AccountNo:      req.AccountNo,
        Amount:         req.Amount,
        Currency:       req.Currency,
        CreditorID:     req.CreditorID,
        CreditorName:   req.CreditorName,
        Reference:      req.Reference,
        Description:    req.Description,
        WebhookURL:     req.WebhookURL,
        Status:         DebitRequestStatusPending,
        AutoApprove:    req.AutoApprove,
        CreatedAt:      time.Now(),
    }

    s.debitRequests[debitReq.ID] = debitReq

    // 4. 멱등성 키 저장
    s.idempotencyKeys[req.IdempotencyKey] = &IdempotencyRecord{
        DebitRequestID: debitReq.ID,
        CreatedAt:      time.Now(),
    }

    // 4. 자동 승인 또는 비동기 처리
    if req.AutoApprove {
        go s.processDebitRequest(debitReq.ID)
    } else {
        // 시뮬레이션: 1-3초 후 처리
        go func() {
            time.Sleep(time.Duration(1+rand.Intn(3)) * time.Second)
            s.processDebitRequest(debitReq.ID)
        }()
    }

    return debitReq, nil
}
```

### processDebitRequest

```go
func (s *BankService) processDebitRequest(id string) {
    s.mu.Lock()
    defer s.mu.Unlock()

    debitReq, exists := s.debitRequests[id]
    if !exists || debitReq.Status != DebitRequestStatusPending {
        return
    }

    debitReq.Status = DebitRequestStatusProcessing

    // 계좌 확인
    account, exists := s.accounts[debitReq.AccountNo]
    if !exists {
        s.rejectDebitRequest(debitReq, "account_not_found")
        return
    }

    if account.Status != AccountStatusActive {
        s.rejectDebitRequest(debitReq, "account_unavailable")
        return
    }

    // 잔액 확인
    amount, _, _ := big.ParseFloat(debitReq.Amount, 10, 128, big.ToNearestEven)
    balance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)

    if balance.Cmp(amount) < 0 {
        s.rejectDebitRequest(debitReq, "insufficient_balance")
        return
    }

    // 출금 실행
    balanceBefore := account.Balance
    newBalance := new(big.Float).Sub(balance, amount)
    account.Balance = newBalance.Text('f', 2)
    account.UpdatedAt = time.Now()

    // 트랜잭션 기록
    txn := &Transaction{
        ID:            uuid.New().String(),
        AccountNo:     debitReq.AccountNo,
        Type:          TransactionTypeDebit,
        Amount:        debitReq.Amount,
        BalanceBefore: balanceBefore,
        BalanceAfter:  account.Balance,
        Reference:     debitReq.Reference,
        Description:   fmt.Sprintf("Direct Debit by %s", debitReq.CreditorName),
        CreatedAt:     time.Now(),
    }
    s.transactions[txn.ID] = txn

    // 요청 완료
    now := time.Now()
    debitReq.Status = DebitRequestStatusCompleted
    debitReq.TransactionID = txn.ID
    debitReq.ProcessedAt = &now

    // 웹훅 발송
    go s.sendWebhook("debit.completed", debitReq)
}

func (s *BankService) rejectDebitRequest(debitReq *DebitRequest, reason string) {
    now := time.Now()
    debitReq.Status = DebitRequestStatusRejected
    debitReq.FailureReason = reason
    debitReq.ProcessedAt = &now

    go s.sendWebhook("debit.rejected", debitReq)
}
```

## 웹훅 이벤트

> 웹훅 페이로드 형식은 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

### direct_debit.completed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440000",
  "eventType": "direct_debit.completed",
  "timestamp": "2026-01-27T10:00:01Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440000",
  "attemptNumber": 1,
  "correlationId": "cor_770e8400-e29b-41d4-a716-446655440000",
  "source": "bank",
  "data": {
    "id": "debit_uuid",
    "idempotencyKey": "idem_550e8400-e29b-41d4-a716-446655440000",
    "accountNo": "BANK1234567890",
    "amount": "50000.00",
    "creditorId": "PG_MERCHANT_001",
    "reference": "PAYMENT_ORDER_12345",
    "status": "completed",
    "transactionId": "txn_uuid"
  }
}
```

### direct_debit.rejected
```json
{
  "version": "1.0",
  "eventId": "evt_660e8400-e29b-41d4-a716-446655440001",
  "eventType": "direct_debit.rejected",
  "timestamp": "2026-01-27T10:00:01Z",
  "deliveryId": "dlv_770e8400-e29b-41d4-a716-446655440001",
  "attemptNumber": 1,
  "correlationId": "cor_880e8400-e29b-41d4-a716-446655440001",
  "source": "bank",
  "data": {
    "id": "debit_uuid",
    "idempotencyKey": "idem_550e8400-e29b-41d4-a716-446655440000",
    "accountNo": "BANK1234567890",
    "amount": "50000.00",
    "creditorId": "PG_MERCHANT_001",
    "reference": "PAYMENT_ORDER_12345",
    "status": "rejected",
    "failureReason": "insufficient_balance"
  }
}
```

## 환경 변수 추가

| 변수 | 기본값 | 설명 |
|------|--------|------|
| DEBIT_PROCESSING_DELAY | 2 | 비동기 처리 지연 시간 (초) |
| DEBIT_SUCCESS_RATE | 100 | 성공률 % (테스트용) |

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/account.go` | DebitRequest, DebitRequestStatus 추가 |
| `internal/service/bank.go` | CreateDebitRequest(), GetDebitRequest(), CancelDebitRequest(), processDebitRequest() 추가 |
| `internal/handler/bank.go` | 3개 핸들러 추가 |
| `internal/config/config.go` | DEBIT_PROCESSING_DELAY, DEBIT_SUCCESS_RATE 추가 |
| `cmd/main.go` | 라우트 등록 |

## 테스트 케이스

1. 정상 출금 요청 - pending 상태로 생성
2. autoApprove=true - 즉시 completed
3. 잔액 부족 - rejected, reason: insufficient_balance
4. 동결 계좌 - 400 account_unavailable
5. 없는 계좌 - 404
6. 상태 조회 - 정상 반환
7. pending 상태 취소 - cancelled
8. completed 상태 취소 시도 - 400
9. 웹훅 발송 확인 (completed, rejected)
10. 트랜잭션 기록 확인
11. **멱등성: 동일 키로 재요청 - 기존 결과 반환**
12. **멱등성: 24시간 후 동일 키 - 새 요청 생성**
13. **멱등성: 누락된 키 - 400 에러**

## 연동 예시

### PG에서 bank_transfer 결제 시

```go
// pg-simulator에서 호출
func (s *PaymentService) processBankTransfer(payment *Payment, bankAccount BankAccountInfo) error {
    // bank-simulator에 Direct Debit 요청
    resp, err := http.Post(
        s.config.BankSimulatorURL + "/api/v1/debit-requests",
        "application/json",
        debitRequestBody,
    )

    // 결과에 따라 payment 상태 업데이트
    if debitResult.Status == "completed" {
        payment.Status = PaymentStatusApproved
    } else {
        payment.Status = PaymentStatusDeclined
        payment.FailureReason = debitResult.FailureReason
    }
}
```

## 관련 문서

- [공통 타입 정의](../../common/types.md) - Amount, Currency 등 공통 타입
- [상태 매핑](../../common/status-mapping.md) - DirectDebit ↔ Payment 상태 매핑
- [웹훅 스펙](../../common/webhook-spec.md) - 웹훅 페이로드, 서명, 재시도 정책
