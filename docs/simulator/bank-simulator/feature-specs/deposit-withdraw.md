# 입금/출금 API

## 개요

외부에서 계좌 잔액을 직접 조정할 수 있는 입금/출금 API를 추가합니다.

**우선순위**: P0
**의존성**: 없음
**영향**: pg-simulator (정산), onramp-simulator (은행 이체)

## 현재 상태

- 계좌 간 이체만 가능 (`POST /api/v1/transfers`)
- 외부에서 잔액 증가/감소 불가
- 테스트 시 잔액 조정이 어려움

## 요구사항

### 기능 요구사항

1. **입금(Deposit)**: 외부에서 계좌에 금액을 추가
2. **출금(Withdraw)**: 계좌에서 외부로 금액 차감
3. 출금 시 잔액 검증 (잔액 부족 시 실패)
4. 동결 계좌는 입출금 불가
5. 각 거래에 대한 웹훅 발송

### 비기능 요구사항

- 잔액 계산은 big.Float 사용 (정밀도 보장)
- Thread-safe 처리 (mutex)
- 거래 기록 유지

## API 설계

### POST /api/v1/accounts/{accountNo}/deposit

**설명**: 계좌에 금액 입금

**요청**:
```json
{
  "amount": "1000.00",
  "reference": "PG_SETTLEMENT_12345",
  "description": "정산금 입금"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| amount | string | ✅ | 입금 금액 (양수) |
| reference | string | ❌ | 외부 참조 ID |
| description | string | ❌ | 입금 사유 설명 |

**응답 (200)**:
```json
{
  "id": "txn_uuid",
  "accountNo": "BANK1234567890",
  "type": "deposit",
  "amount": "1000.00",
  "balanceBefore": "5000.00",
  "balanceAfter": "6000.00",
  "reference": "PG_SETTLEMENT_12345",
  "description": "정산금 입금",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 400 | invalid_amount | 금액이 0 이하 또는 파싱 실패 |
| 404 | account_not_found | 계좌 없음 |
| 400 | account_frozen | 계좌 동결 상태 |
| 400 | account_closed | 계좌 해지 상태 |

---

### POST /api/v1/accounts/{accountNo}/withdraw

**설명**: 계좌에서 금액 출금

**요청**:
```json
{
  "amount": "500.00",
  "reference": "ONRAMP_ORDER_67890",
  "description": "암호화폐 구매"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| amount | string | ✅ | 출금 금액 (양수) |
| reference | string | ❌ | 외부 참조 ID |
| description | string | ❌ | 출금 사유 설명 |

**응답 (200)**:
```json
{
  "id": "txn_uuid",
  "accountNo": "BANK1234567890",
  "type": "withdraw",
  "amount": "500.00",
  "balanceBefore": "6000.00",
  "balanceAfter": "5500.00",
  "reference": "ONRAMP_ORDER_67890",
  "description": "암호화폐 구매",
  "createdAt": "2026-01-27T10:05:00Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 400 | invalid_amount | 금액이 0 이하 또는 파싱 실패 |
| 400 | insufficient_balance | 잔액 부족 |
| 404 | account_not_found | 계좌 없음 |
| 400 | account_frozen | 계좌 동결 상태 |
| 400 | account_closed | 계좌 해지 상태 |

## 데이터 모델

### Transaction (신규)

```go
type TransactionType string

const (
    TransactionTypeDeposit  TransactionType = "deposit"
    TransactionTypeWithdraw TransactionType = "withdraw"
    TransactionTypeTransferIn  TransactionType = "transfer_in"
    TransactionTypeTransferOut TransactionType = "transfer_out"
    TransactionTypeDebit    TransactionType = "debit"  // Direct Debit용
)

type Transaction struct {
    ID            string          `json:"id"`
    AccountNo     string          `json:"accountNo"`
    Type          TransactionType `json:"type"`
    Amount        string          `json:"amount"`
    BalanceBefore string          `json:"balanceBefore"`
    BalanceAfter  string          `json:"balanceAfter"`
    Reference     string          `json:"reference,omitempty"`
    Description   string          `json:"description,omitempty"`
    CreatedAt     time.Time       `json:"createdAt"`
}
```

### 기존 모델 수정

**internal/model/account.go**에 추가:
```go
type DepositRequest struct {
    Amount      string `json:"amount" binding:"required"`
    Reference   string `json:"reference"`
    Description string `json:"description"`
}

type WithdrawRequest struct {
    Amount      string `json:"amount" binding:"required"`
    Reference   string `json:"reference"`
    Description string `json:"description"`
}
```

## 서비스 로직

### Deposit

```go
func (s *BankService) Deposit(accountNo string, req DepositRequest) (*Transaction, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 1. 계좌 조회
    account, exists := s.accounts[accountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    // 2. 상태 확인
    if account.Status == AccountStatusFrozen {
        return nil, ErrAccountFrozen
    }
    if account.Status == AccountStatusClosed {
        return nil, ErrAccountClosed
    }

    // 3. 금액 파싱 및 검증
    amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
    if err != nil || amount.Sign() <= 0 {
        return nil, ErrInvalidAmount
    }

    // 4. 잔액 계산
    currentBalance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
    balanceBefore := account.Balance
    newBalance := new(big.Float).Add(currentBalance, amount)
    account.Balance = newBalance.Text('f', 2)
    account.UpdatedAt = time.Now()

    // 5. 트랜잭션 기록
    txn := &Transaction{
        ID:            uuid.New().String(),
        AccountNo:     accountNo,
        Type:          TransactionTypeDeposit,
        Amount:        req.Amount,
        BalanceBefore: balanceBefore,
        BalanceAfter:  account.Balance,
        Reference:     req.Reference,
        Description:   req.Description,
        CreatedAt:     time.Now(),
    }
    s.transactions[txn.ID] = txn

    // 6. 웹훅 발송
    go s.sendWebhook("deposit.completed", txn)

    return txn, nil
}
```

### Withdraw

```go
func (s *BankService) Withdraw(accountNo string, req WithdrawRequest) (*Transaction, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 1. 계좌 조회
    account, exists := s.accounts[accountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    // 2. 상태 확인
    if account.Status == AccountStatusFrozen {
        return nil, ErrAccountFrozen
    }
    if account.Status == AccountStatusClosed {
        return nil, ErrAccountClosed
    }

    // 3. 금액 파싱 및 검증
    amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
    if err != nil || amount.Sign() <= 0 {
        return nil, ErrInvalidAmount
    }

    // 4. 잔액 확인
    currentBalance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
    if currentBalance.Cmp(amount) < 0 {
        return nil, ErrInsufficientBalance
    }

    // 5. 잔액 차감
    balanceBefore := account.Balance
    newBalance := new(big.Float).Sub(currentBalance, amount)
    account.Balance = newBalance.Text('f', 2)
    account.UpdatedAt = time.Now()

    // 6. 트랜잭션 기록
    txn := &Transaction{
        ID:            uuid.New().String(),
        AccountNo:     accountNo,
        Type:          TransactionTypeWithdraw,
        Amount:        req.Amount,
        BalanceBefore: balanceBefore,
        BalanceAfter:  account.Balance,
        Reference:     req.Reference,
        Description:   req.Description,
        CreatedAt:     time.Now(),
    }
    s.transactions[txn.ID] = txn

    // 7. 웹훅 발송
    go s.sendWebhook("withdraw.completed", txn)

    return txn, nil
}
```

## 웹훅 이벤트

> **참고**: 웹훅 페이로드는 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

### deposit.completed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440001",
  "eventType": "deposit.completed",
  "timestamp": "2026-01-27T10:00:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440001",
  "attemptNumber": 1,
  "source": "bank",
  "data": {
    "id": "txn_uuid",
    "accountNo": "BANK1234567890",
    "type": "deposit",
    "amount": "1000.00",
    "balanceAfter": "6000.00",
    "reference": "PG_SETTLEMENT_12345"
  }
}
```

### withdraw.completed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440002",
  "eventType": "withdraw.completed",
  "timestamp": "2026-01-27T10:05:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440002",
  "attemptNumber": 1,
  "source": "bank",
  "data": {
    "id": "txn_uuid",
    "accountNo": "BANK1234567890",
    "type": "withdraw",
    "amount": "500.00",
    "balanceAfter": "5500.00",
    "reference": "ONRAMP_ORDER_67890"
  }
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/account.go` | Transaction, DepositRequest, WithdrawRequest 추가 |
| `internal/service/bank.go` | Deposit(), Withdraw() 메서드 추가, transactions map 추가 |
| `internal/handler/bank.go` | HandleDeposit(), HandleWithdraw() 핸들러 추가 |
| `cmd/main.go` | 라우트 등록 |

## 테스트 케이스

1. 정상 입금 - 잔액 증가 확인
2. 정상 출금 - 잔액 감소 확인
3. 잔액 부족 출금 - 에러 반환
4. 동결 계좌 입금 - 에러 반환
5. 동결 계좌 출금 - 에러 반환
6. 해지 계좌 입금 - 에러 반환
7. 없는 계좌 입금 - 404 반환
8. 음수 금액 입금 - 에러 반환
9. 0 금액 출금 - 에러 반환
10. 웹훅 발송 확인
