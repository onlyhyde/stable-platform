# 계좌 해지 API

## 개요

계좌를 해지(closed) 상태로 변경하는 API를 추가합니다.

**우선순위**: P1
**의존성**: 없음
**영향**: 해지 계좌에 대한 모든 거래 거절

## 현재 상태

- `AccountStatusClosed` 상태가 모델에 정의됨
- 해지 엔드포인트 없음
- 동결(freeze)만 가능

## 요구사항

### 기능 요구사항

1. **계좌 해지**: active 또는 frozen 상태의 계좌를 closed로 변경
2. **잔액 확인**: 잔액이 0이어야 해지 가능 (또는 강제 해지 옵션)
3. **비가역적**: 해지 후 다시 활성화 불가
4. 해지 사유 기록

### 비기능 요구사항

- 해지된 계좌의 데이터는 유지 (조회 가능)
- 해지된 계좌는 모든 거래 거절

## API 설계

### POST /api/v1/accounts/{accountNo}/close

**설명**: 계좌 해지

**요청**:
```json
{
  "reason": "고객 요청",
  "force": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| reason | string | ❌ | 해지 사유 |
| force | bool | ❌ | true면 잔액 있어도 강제 해지 (기본: false) |

**응답 (200)**:
```json
{
  "accountNo": "BANK1234567890",
  "status": "closed",
  "previousStatus": "active",
  "closedAt": "2026-01-27T10:00:00Z",
  "reason": "고객 요청",
  "finalBalance": "0.00"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | account_not_found | 계좌 없음 |
| 400 | already_closed | 이미 해지된 계좌 |
| 400 | balance_remaining | 잔액이 남아있음 (force=false일 때) |

## 데이터 모델

### Account 확장

```go
// 기존 Account 구조체에 추가
type Account struct {
    // ... 기존 필드들
    ClosedAt     *time.Time `json:"closedAt,omitempty"`
    CloseReason  string     `json:"closeReason,omitempty"`
}
```

### Request/Response 모델

```go
type CloseAccountRequest struct {
    Reason string `json:"reason"`
    Force  bool   `json:"force"`
}

type CloseAccountResponse struct {
    AccountNo      string    `json:"accountNo"`
    Status         string    `json:"status"`
    PreviousStatus string    `json:"previousStatus"`
    ClosedAt       time.Time `json:"closedAt"`
    Reason         string    `json:"reason,omitempty"`
    FinalBalance   string    `json:"finalBalance"`
}
```

## 서비스 로직

### CloseAccount

```go
func (s *BankService) CloseAccount(accountNo string, req CloseAccountRequest) (*CloseAccountResponse, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 1. 계좌 조회
    account, exists := s.accounts[accountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    // 2. 이미 해지 확인
    if account.Status == AccountStatusClosed {
        return nil, ErrAlreadyClosed
    }

    // 3. 잔액 확인 (force=false일 때)
    if !req.Force {
        balance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
        if balance.Sign() != 0 {
            return nil, ErrBalanceRemaining
        }
    }

    // 4. 상태 변경
    previousStatus := account.Status
    now := time.Now()

    account.Status = AccountStatusClosed
    account.ClosedAt = &now
    account.CloseReason = req.Reason
    account.UpdatedAt = now

    // 5. 웹훅 발송
    go s.sendWebhook("account.closed", map[string]interface{}{
        "accountNo":      account.AccountNo,
        "previousStatus": previousStatus,
        "reason":         req.Reason,
        "finalBalance":   account.Balance,
        "closedAt":       now,
    })

    return &CloseAccountResponse{
        AccountNo:      account.AccountNo,
        Status:         string(AccountStatusClosed),
        PreviousStatus: string(previousStatus),
        ClosedAt:       now,
        Reason:         req.Reason,
        FinalBalance:   account.Balance,
    }, nil
}
```

## 기존 로직 수정

해지된 계좌에 대한 거래를 거절하도록 기존 로직을 수정합니다.

### 영향받는 함수들

```go
// Deposit, Withdraw, Transfer 등에서 상태 체크 수정
if account.Status == AccountStatusClosed {
    return nil, ErrAccountClosed
}

// CreateDebitRequest에서도 동일하게 체크
if account.Status == AccountStatusClosed {
    return nil, ErrAccountClosed
}

// Freeze/Unfreeze는 해지 계좌에 적용 불가
if account.Status == AccountStatusClosed {
    return nil, ErrAccountClosed
}
```

## 웹훅 이벤트

### account.closed
```json
{
  "eventType": "account.closed",
  "timestamp": "2026-01-27T10:00:00Z",
  "data": {
    "accountNo": "BANK1234567890",
    "previousStatus": "active",
    "reason": "고객 요청",
    "finalBalance": "0.00",
    "closedAt": "2026-01-27T10:00:00Z"
  }
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/account.go` | Account에 ClosedAt, CloseReason 추가, Request/Response 추가 |
| `internal/service/bank.go` | CloseAccount() 추가, 기존 함수들에 closed 상태 체크 추가 |
| `internal/handler/bank.go` | HandleCloseAccount() 핸들러 추가 |
| `cmd/main.go` | 라우트 등록 |

## 에러 코드

```go
var (
    ErrAlreadyClosed    = errors.New("account already closed")
    ErrBalanceRemaining = errors.New("balance remaining in account")
    ErrAccountClosed    = errors.New("account is closed")
)
```

## 테스트 케이스

1. 잔액 0 계좌 정상 해지
2. 잔액 있는 계좌 해지 시도 - 400 balance_remaining
3. 잔액 있는 계좌 force=true로 해지 - 성공
4. 이미 해지된 계좌 재해지 시도 - 400 already_closed
5. 없는 계좌 해지 - 404
6. 동결 계좌 해지 - 성공
7. 해지 계좌에 입금 시도 - 400 account_closed
8. 해지 계좌에서 출금 시도 - 400 account_closed
9. 해지 계좌로 이체 시도 - 400
10. 해지 계좌 조회 - 정상 반환 (status: closed)
11. 웹훅 발송 확인
