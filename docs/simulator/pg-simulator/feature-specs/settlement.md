# 정산 (Settlement) 시뮬레이션

## 개요

가맹점에 결제금을 정산하는 기능을 시뮬레이션합니다. bank-simulator와 연동하여 가맹점 계좌에 입금합니다.

**우선순위**: P2
**의존성**: bank-simulator의 입금 API
**영향**: 정산 플로우 테스트

## 현재 상태

- 정산 기능 없음
- 결제 완료 후 가맹점에 대한 정산 처리 없음

## 목표

```
결제 완료                    PG Simulator              Bank Simulator
    │                           │                           │
    │                           │  정산 배치 실행             │
    │                           │                           │
    │                           │  1. 정산 대상 결제 집계     │
    │                           │  2. 수수료 차감 계산        │
    │                           │  3. 입금 요청               │
    │                           ├─────────────────────────▶│
    │                           │                           │ 가맹점 계좌 입금
    │                           │  4. 결과 수신               │
    │                           │◀─────────────────────────┤
    │                           │                           │
    │  웹훅 (정산 완료)          │                           │
    │◀──────────────────────────┤                           │
```

## API 설계

### POST /api/v1/settlements/process

**설명**: 정산 배치 실행 (수동 트리거)

**요청**:
```json
{
  "merchantId": "MERCHANT_001",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-27"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| merchantId | string | ❌ | 특정 가맹점만 정산 (미지정 시 전체) |
| fromDate | string | ❌ | 시작일 (YYYY-MM-DD) |
| toDate | string | ❌ | 종료일 (YYYY-MM-DD, 기본: 오늘) |

**응답 (202)**:
```json
{
  "batchId": "batch_uuid",
  "status": "processing",
  "merchantCount": 5,
  "totalAmount": "1250000.00",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

---

### GET /api/v1/settlements/{batchId}

**설명**: 정산 배치 상태 조회

**응답**:
```json
{
  "batchId": "batch_uuid",
  "status": "completed",
  "settlements": [
    {
      "id": "settle_001",
      "merchantId": "MERCHANT_001",
      "paymentCount": 15,
      "grossAmount": "500000.00",
      "feeAmount": "15000.00",
      "netAmount": "485000.00",
      "bankAccountNo": "BANK1234567890",
      "transactionId": "txn_uuid",
      "status": "completed"
    }
  ],
  "summary": {
    "totalGross": "1250000.00",
    "totalFees": "37500.00",
    "totalNet": "1212500.00",
    "successCount": 5,
    "failedCount": 0
  },
  "completedAt": "2026-01-27T10:00:05Z"
}
```

---

### GET /api/v1/merchants/{merchantId}/settlements

**설명**: 가맹점별 정산 내역 조회

**Query Parameters**:
| 파라미터 | 설명 |
|----------|------|
| fromDate | 시작일 |
| toDate | 종료일 |
| status | 상태 필터 |

**응답**:
```json
{
  "settlements": [
    {
      "id": "settle_001",
      "batchId": "batch_uuid",
      "paymentCount": 15,
      "grossAmount": "500000.00",
      "feeAmount": "15000.00",
      "netAmount": "485000.00",
      "status": "completed",
      "settledAt": "2026-01-27T10:00:05Z"
    }
  ],
  "total": 10
}
```

---

### 가맹점 등록 (정산 계좌 설정)

**POST /api/v1/merchants**

```json
{
  "id": "MERCHANT_001",
  "name": "온라인 쇼핑몰",
  "feeRate": "0.03",
  "settlementBankAccount": "BANK1234567890"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | ✅ | 가맹점 ID |
| name | string | ✅ | 가맹점명 |
| feeRate | string | ✅ | 수수료율 (3% = "0.03") |
| settlementBankAccount | string | ✅ | 정산 계좌번호 |

## 데이터 모델

### Merchant (신규)

```go
type Merchant struct {
    ID                    string    `json:"id"`
    Name                  string    `json:"name"`
    FeeRate               string    `json:"feeRate"` // "0.03" = 3%
    SettlementBankAccount string    `json:"settlementBankAccount"`
    Status                string    `json:"status"` // active, suspended
    CreatedAt             time.Time `json:"createdAt"`
    UpdatedAt             time.Time `json:"updatedAt"`
}
```

### Settlement (신규)

```go
type SettlementStatus string

const (
    SettlementStatusPending   SettlementStatus = "pending"
    SettlementStatusProcessing SettlementStatus = "processing"
    SettlementStatusCompleted  SettlementStatus = "completed"
    SettlementStatusFailed     SettlementStatus = "failed"
)

type Settlement struct {
    ID            string           `json:"id"`
    BatchID       string           `json:"batchId"`
    MerchantID    string           `json:"merchantId"`
    PaymentCount  int              `json:"paymentCount"`
    PaymentIDs    []string         `json:"paymentIds,omitempty"`
    GrossAmount   string           `json:"grossAmount"`
    FeeAmount     string           `json:"feeAmount"`
    NetAmount     string           `json:"netAmount"`
    BankAccountNo string           `json:"bankAccountNo"`
    TransactionID string           `json:"transactionId,omitempty"`
    Status        SettlementStatus `json:"status"`
    FailureReason string           `json:"failureReason,omitempty"`
    CreatedAt     time.Time        `json:"createdAt"`
    SettledAt     *time.Time       `json:"settledAt,omitempty"`
}
```

### SettlementBatch (신규)

```go
type SettlementBatch struct {
    ID           string           `json:"id"`
    Status       SettlementStatus `json:"status"`
    Settlements  []*Settlement    `json:"settlements,omitempty"`
    Summary      *BatchSummary    `json:"summary,omitempty"`
    CreatedAt    time.Time        `json:"createdAt"`
    CompletedAt  *time.Time       `json:"completedAt,omitempty"`
}

type BatchSummary struct {
    TotalGross   string `json:"totalGross"`
    TotalFees    string `json:"totalFees"`
    TotalNet     string `json:"totalNet"`
    SuccessCount int    `json:"successCount"`
    FailedCount  int    `json:"failedCount"`
}
```

## 서비스 로직

### ProcessSettlementBatch

```go
func (s *PaymentService) ProcessSettlementBatch(req ProcessSettlementRequest) (*SettlementBatch, error) {
    batch := &SettlementBatch{
        ID:        "batch_" + uuid.New().String()[:8],
        Status:    SettlementStatusProcessing,
        CreatedAt: time.Now(),
    }

    s.mu.Lock()
    s.settlementBatches[batch.ID] = batch
    s.mu.Unlock()

    // 비동기 처리
    go s.executeSettlementBatch(batch, req)

    return batch, nil
}

func (s *PaymentService) executeSettlementBatch(batch *SettlementBatch, req ProcessSettlementRequest) {
    // 1. 정산 대상 결제 조회 (승인됨, 미정산)
    payments := s.getSettlementEligiblePayments(req)

    // 2. 가맹점별 그룹화
    merchantPayments := groupByMerchant(payments)

    var settlements []*Settlement
    var totalGross, totalFees, totalNet big.Float
    successCount, failedCount := 0, 0

    for merchantID, pmts := range merchantPayments {
        settlement := s.createSettlement(batch.ID, merchantID, pmts)
        settlements = append(settlements, settlement)

        // 3. bank-simulator에 입금 요청
        err := s.depositToMerchant(settlement)

        if err == nil {
            settlement.Status = SettlementStatusCompleted
            now := time.Now()
            settlement.SettledAt = &now
            successCount++

            gross, _ := new(big.Float).SetString(settlement.GrossAmount)
            fees, _ := new(big.Float).SetString(settlement.FeeAmount)
            net, _ := new(big.Float).SetString(settlement.NetAmount)
            totalGross.Add(&totalGross, gross)
            totalFees.Add(&totalFees, fees)
            totalNet.Add(&totalNet, net)

            // 결제 상태 업데이트 (정산됨)
            for _, pid := range settlement.PaymentIDs {
                if p, ok := s.payments[pid]; ok {
                    p.SettledAt = settlement.SettledAt
                }
            }
        } else {
            settlement.Status = SettlementStatusFailed
            settlement.FailureReason = err.Error()
            failedCount++
        }
    }

    // 4. 배치 완료
    s.mu.Lock()
    batch.Settlements = settlements
    batch.Summary = &BatchSummary{
        TotalGross:   totalGross.Text('f', 2),
        TotalFees:    totalFees.Text('f', 2),
        TotalNet:     totalNet.Text('f', 2),
        SuccessCount: successCount,
        FailedCount:  failedCount,
    }
    batch.Status = SettlementStatusCompleted
    now := time.Now()
    batch.CompletedAt = &now
    s.mu.Unlock()

    // 5. 웹훅 발송
    go s.sendWebhook("settlement.batch.completed", batch)
}
```

### createSettlement

```go
func (s *PaymentService) createSettlement(batchID, merchantID string, payments []*Payment) *Settlement {
    merchant := s.merchants[merchantID]

    var gross big.Float
    var paymentIDs []string

    for _, p := range payments {
        amount, _ := new(big.Float).SetString(p.Amount)
        gross.Add(&gross, amount)
        paymentIDs = append(paymentIDs, p.ID)
    }

    // 수수료 계산
    feeRate, _ := new(big.Float).SetString(merchant.FeeRate)
    fee := new(big.Float).Mul(&gross, feeRate)
    net := new(big.Float).Sub(&gross, fee)

    return &Settlement{
        ID:            "settle_" + uuid.New().String()[:8],
        BatchID:       batchID,
        MerchantID:    merchantID,
        PaymentCount:  len(payments),
        PaymentIDs:    paymentIDs,
        GrossAmount:   gross.Text('f', 2),
        FeeAmount:     fee.Text('f', 2),
        NetAmount:     net.Text('f', 2),
        BankAccountNo: merchant.SettlementBankAccount,
        Status:        SettlementStatusPending,
        CreatedAt:     time.Now(),
    }
}
```

### depositToMerchant

```go
func (s *PaymentService) depositToMerchant(settlement *Settlement) error {
    reqBody := map[string]string{
        "amount":      settlement.NetAmount,
        "reference":   settlement.ID,
        "description": fmt.Sprintf("PG 정산금 (%d건)", settlement.PaymentCount),
    }

    resp, err := s.bankClient.Post(
        fmt.Sprintf("/api/v1/accounts/%s/deposit", settlement.BankAccountNo),
        reqBody,
    )

    if err != nil {
        return err
    }

    var result struct {
        ID string `json:"id"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    settlement.TransactionID = result.ID
    return nil
}
```

## 정산 조정 (Adjustment)

정산 완료 후 차액이 발생하거나, 환불/취소로 인해 금액 조정이 필요한 경우 처리합니다.

### POST /api/v1/settlements/{settlementId}/adjustments

**설명**: 정산 조정 요청

**요청**:
```json
{
  "type": "deduction",
  "amount": "50000.00",
  "reason": "payment_refunded",
  "referenceId": "pay_refunded_001",
  "description": "결제 환불에 따른 정산 차감"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| type | string | ✅ | 조정 유형 (deduction: 차감, addition: 추가) |
| amount | string | ✅ | 조정 금액 |
| reason | string | ✅ | 조정 사유 코드 |
| referenceId | string | ❌ | 관련 결제/환불 ID |
| description | string | ❌ | 조정 상세 설명 |

**조정 사유 코드**:
| 사유 코드 | 설명 |
|-----------|------|
| payment_refunded | 결제 환불 |
| payment_cancelled | 결제 취소 |
| fee_correction | 수수료 정정 |
| amount_correction | 금액 정정 |
| chargeback | 차지백 |

**응답 (200)**:
```json
{
  "id": "adj_uuid",
  "settlementId": "settle_001",
  "merchantId": "MERCHANT_001",
  "type": "deduction",
  "amount": "50000.00",
  "reason": "payment_refunded",
  "referenceId": "pay_refunded_001",
  "status": "applied",
  "balanceBefore": "485000.00",
  "balanceAfter": "435000.00",
  "createdAt": "2026-01-27T12:00:00Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | settlement_not_found | 정산 건 없음 |
| 400 | invalid_adjustment_type | 유효하지 않은 조정 유형 |
| 400 | insufficient_settlement_balance | 차감 금액이 정산 잔액 초과 |

---

### GET /api/v1/settlements/{settlementId}/adjustments

**설명**: 정산 조정 내역 조회

**응답**:
```json
{
  "adjustments": [
    {
      "id": "adj_001",
      "type": "deduction",
      "amount": "50000.00",
      "reason": "payment_refunded",
      "status": "applied",
      "createdAt": "2026-01-27T12:00:00Z"
    }
  ],
  "summary": {
    "totalDeductions": "50000.00",
    "totalAdditions": "0.00",
    "netAdjustment": "-50000.00",
    "adjustedNetAmount": "435000.00"
  }
}
```

### 데이터 모델

```go
type AdjustmentType string

const (
    AdjustmentTypeDeduction AdjustmentType = "deduction"
    AdjustmentTypeAddition  AdjustmentType = "addition"
)

type Adjustment struct {
    ID             string         `json:"id"`
    SettlementID   string         `json:"settlementId"`
    MerchantID     string         `json:"merchantId"`
    Type           AdjustmentType `json:"type"`
    Amount         string         `json:"amount"`
    Reason         string         `json:"reason"`
    ReferenceID    string         `json:"referenceId,omitempty"`
    Description    string         `json:"description,omitempty"`
    Status         string         `json:"status"` // applied, pending, rejected
    BalanceBefore  string         `json:"balanceBefore"`
    BalanceAfter   string         `json:"balanceAfter"`
    CreatedAt      time.Time      `json:"createdAt"`
}

type AdjustmentSummary struct {
    TotalDeductions  string `json:"totalDeductions"`
    TotalAdditions   string `json:"totalAdditions"`
    NetAdjustment    string `json:"netAdjustment"`
    AdjustedNetAmount string `json:"adjustedNetAmount"`
}
```

### 서비스 로직

```go
func (s *PaymentService) CreateAdjustment(settlementID string, req CreateAdjustmentRequest) (*Adjustment, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 1. 정산 건 확인
    settlement, exists := s.findSettlement(settlementID)
    if !exists {
        return nil, ErrSettlementNotFound
    }

    // 2. 유효성 검증
    adjAmount, _, _ := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
    currentNet, _, _ := big.ParseFloat(settlement.NetAmount, 10, 128, big.ToNearestEven)

    if req.Type == AdjustmentTypeDeduction {
        if adjAmount.Cmp(currentNet) > 0 {
            return nil, ErrInsufficientSettlementBalance
        }
    }

    // 3. 잔액 계산
    balanceBefore := settlement.NetAmount
    var newBalance *big.Float
    if req.Type == AdjustmentTypeDeduction {
        newBalance = new(big.Float).Sub(currentNet, adjAmount)
    } else {
        newBalance = new(big.Float).Add(currentNet, adjAmount)
    }
    settlement.NetAmount = newBalance.Text('f', 2)

    // 4. 조정 레코드 생성
    adj := &Adjustment{
        ID:            "adj_" + uuid.New().String()[:8],
        SettlementID:  settlementID,
        MerchantID:    settlement.MerchantID,
        Type:          req.Type,
        Amount:        req.Amount,
        Reason:        req.Reason,
        ReferenceID:   req.ReferenceID,
        Description:   req.Description,
        Status:        "applied",
        BalanceBefore: balanceBefore,
        BalanceAfter:  settlement.NetAmount,
        CreatedAt:     time.Now(),
    }

    s.adjustments = append(s.adjustments, adj)

    // 5. 웹훅 발송
    go s.sendWebhook("settlement.adjusted", adj)

    return adj, nil
}
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| DEFAULT_FEE_RATE | 0.03 | 기본 수수료율 (3%) |
| SETTLEMENT_BATCH_SIZE | 100 | 배치당 최대 결제 건수 |

## 웹훅 이벤트

> **참고**: 웹훅 페이로드는 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

### settlement.batch.completed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440030",
  "eventType": "settlement.batch.completed",
  "timestamp": "2026-01-27T10:00:05Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440030",
  "attemptNumber": 1,
  "source": "pg",
  "data": {
    "batchId": "batch_uuid",
    "summary": {
      "totalGross": "1250000.00",
      "totalFees": "37500.00",
      "totalNet": "1212500.00",
      "successCount": 5,
      "failedCount": 0
    }
  }
}
```

### settlement.completed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440031",
  "eventType": "settlement.completed",
  "timestamp": "2026-01-27T10:00:05Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440031",
  "attemptNumber": 1,
  "source": "pg",
  "data": {
    "id": "settle_001",
    "merchantId": "MERCHANT_001",
    "netAmount": "485000.00",
    "transactionId": "txn_uuid"
  }
}
```

### settlement.adjusted
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440032",
  "eventType": "settlement.adjusted",
  "timestamp": "2026-01-27T12:00:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440032",
  "attemptNumber": 1,
  "source": "pg",
  "data": {
    "id": "adj_uuid",
    "settlementId": "settle_001",
    "merchantId": "MERCHANT_001",
    "type": "deduction",
    "amount": "50000.00",
    "reason": "payment_refunded",
    "adjustedNetAmount": "435000.00"
  }
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/payment.go` | Merchant, Settlement, SettlementBatch 추가 |
| `internal/service/payment.go` | 정산 관련 함수 추가 |
| `internal/handler/payment.go` | 핸들러 추가 |
| `cmd/main.go` | 라우트 등록 |

## 테스트 케이스

1. 가맹점 등록 - 정상
2. 정산 배치 실행 - 정상
3. 정산 배치 조회 - 정상
4. 가맹점별 정산 내역 조회 - 정상
5. 정산 - bank-simulator 입금 성공
6. 정산 - bank-simulator 입금 실패 (계좌 없음)
7. 정산 대상 없음 - 빈 결과
8. 수수료 계산 정확성 확인
9. 웹훅 발송 확인
10. 이미 정산된 결제 제외 확인
