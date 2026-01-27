# 통합 거래 내역 조회 API

## 개요

입금, 출금, 이체, 직불 등 모든 거래 유형을 통합하여 조회하는 API를 추가합니다.

**우선순위**: P1
**의존성**: deposit-withdraw, direct-debit 구현 후
**영향**: 없음 (조회 전용)

> **참고**: 이 문서는 **조회(GET)** API만 다룹니다.
> 입금/출금(POST) API는 [deposit-withdraw.md](./deposit-withdraw.md)를 참조하세요.
> Transaction 모델 정의는 [deposit-withdraw.md](./deposit-withdraw.md#데이터-모델)에 있습니다.

## 현재 상태

- 이체 내역만 조회 가능 (`GET /api/v1/accounts/{accountNo}/transfers`)
- 입금, 출금, 직불 등 다른 거래 유형 조회 불가
- 전체 거래 내역 통합 조회 없음

## 요구사항

### 기능 요구사항

1. **통합 조회**: 모든 거래 유형을 하나의 API로 조회
2. **필터링**: 거래 유형, 기간별 필터
3. **정렬**: 시간순 정렬 (최신순/과거순)
4. **페이지네이션**: 대량 데이터 대응

### 비기능 요구사항

- 기본 조회 건수: 20건
- 최대 조회 건수: 100건
- 빈 결과 시 빈 배열 반환

## API 설계

### GET /api/v1/accounts/{accountNo}/transactions

**설명**: 계좌의 통합 거래 내역 조회

**Query Parameters**:
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| type | string | all | 거래 유형 필터 (deposit, withdraw, transfer_in, transfer_out, debit, all) |
| fromDate | string | - | 시작일 (YYYY-MM-DD) |
| toDate | string | - | 종료일 (YYYY-MM-DD) |
| limit | int | 20 | 조회 건수 (최대 100) |
| cursor | string | - | 페이지네이션 커서 |
| order | string | desc | 정렬 순서 (desc: 최신순, asc: 과거순) |

**응답 (200)**:
```json
{
  "transactions": [
    {
      "id": "txn_001",
      "accountNo": "BANK1234567890",
      "type": "deposit",
      "amount": "1000.00",
      "balanceBefore": "5000.00",
      "balanceAfter": "6000.00",
      "reference": "PG_SETTLEMENT_001",
      "description": "정산금 입금",
      "counterparty": null,
      "createdAt": "2026-01-27T10:00:00Z"
    },
    {
      "id": "txn_002",
      "accountNo": "BANK1234567890",
      "type": "transfer_out",
      "amount": "500.00",
      "balanceBefore": "6000.00",
      "balanceAfter": "5500.00",
      "reference": "TRF_123",
      "description": null,
      "counterparty": {
        "accountNo": "BANK0987654321",
        "name": "김철수"
      },
      "createdAt": "2026-01-27T09:30:00Z"
    },
    {
      "id": "txn_003",
      "accountNo": "BANK1234567890",
      "type": "debit",
      "amount": "50000.00",
      "balanceBefore": "55500.00",
      "balanceAfter": "5500.00",
      "reference": "ONRAMP_ORDER_789",
      "description": "암호화폐 구매",
      "counterparty": {
        "creditorId": "ONRAMP_SERVICE",
        "creditorName": "온램프 서비스"
      },
      "createdAt": "2026-01-27T09:00:00Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6InR4bl8wMDMiLCJjcmVhdGVkQXQiOiIyMDI2LTAxLTI3VDA5OjAwOjAwWiJ9",
    "total": 45
  }
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | account_not_found | 계좌 없음 |
| 400 | invalid_date_format | 날짜 형식 오류 |
| 400 | invalid_type | 지원하지 않는 거래 유형 |

## 데이터 모델

### TransactionView (응답용)

```go
type TransactionView struct {
    ID            string            `json:"id"`
    AccountNo     string            `json:"accountNo"`
    Type          TransactionType   `json:"type"`
    Amount        string            `json:"amount"`
    BalanceBefore string            `json:"balanceBefore"`
    BalanceAfter  string            `json:"balanceAfter"`
    Reference     string            `json:"reference,omitempty"`
    Description   string            `json:"description,omitempty"`
    Counterparty  *CounterpartyInfo `json:"counterparty,omitempty"`
    CreatedAt     time.Time         `json:"createdAt"`
}

type CounterpartyInfo struct {
    // 이체 상대방
    AccountNo string `json:"accountNo,omitempty"`
    Name      string `json:"name,omitempty"`

    // 직불 요청자
    CreditorID   string `json:"creditorId,omitempty"`
    CreditorName string `json:"creditorName,omitempty"`
}

type TransactionListResponse struct {
    Transactions []TransactionView  `json:"transactions"`
    Pagination   PaginationInfo     `json:"pagination"`
}

type PaginationInfo struct {
    HasMore    bool   `json:"hasMore"`
    NextCursor string `json:"nextCursor,omitempty"`
    Total      int    `json:"total"`
}
```

### Query 파라미터

```go
type TransactionQuery struct {
    Type     string `form:"type"`
    FromDate string `form:"fromDate"`
    ToDate   string `form:"toDate"`
    Limit    int    `form:"limit"`
    Cursor   string `form:"cursor"`
    Order    string `form:"order"`
}
```

## 서비스 로직

### GetTransactionsByAccount

```go
func (s *BankService) GetTransactionsByAccount(
    accountNo string,
    query TransactionQuery,
) (*TransactionListResponse, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    // 1. 계좌 확인
    _, exists := s.accounts[accountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    // 2. 기본값 설정
    if query.Limit <= 0 || query.Limit > 100 {
        query.Limit = 20
    }
    if query.Order == "" {
        query.Order = "desc"
    }

    // 3. 날짜 파싱
    var fromTime, toTime time.Time
    var err error
    if query.FromDate != "" {
        fromTime, err = time.Parse("2006-01-02", query.FromDate)
        if err != nil {
            return nil, ErrInvalidDateFormat
        }
    }
    if query.ToDate != "" {
        toTime, err = time.Parse("2006-01-02", query.ToDate)
        if err != nil {
            return nil, ErrInvalidDateFormat
        }
        // 종료일은 해당 일의 끝까지
        toTime = toTime.Add(24*time.Hour - time.Nanosecond)
    }

    // 4. 거래 수집 및 필터링
    var allTxns []*Transaction
    for _, txn := range s.transactions {
        if txn.AccountNo != accountNo {
            continue
        }

        // 유형 필터
        if query.Type != "" && query.Type != "all" {
            if string(txn.Type) != query.Type {
                continue
            }
        }

        // 날짜 필터
        if !fromTime.IsZero() && txn.CreatedAt.Before(fromTime) {
            continue
        }
        if !toTime.IsZero() && txn.CreatedAt.After(toTime) {
            continue
        }

        allTxns = append(allTxns, txn)
    }

    // 5. 정렬
    sort.Slice(allTxns, func(i, j int) bool {
        if query.Order == "asc" {
            return allTxns[i].CreatedAt.Before(allTxns[j].CreatedAt)
        }
        return allTxns[i].CreatedAt.After(allTxns[j].CreatedAt)
    })

    // 6. 커서 기반 페이지네이션
    startIdx := 0
    if query.Cursor != "" {
        cursorData, err := decodeCursor(query.Cursor)
        if err == nil {
            for i, txn := range allTxns {
                if txn.ID == cursorData.ID {
                    startIdx = i + 1
                    break
                }
            }
        }
    }

    // 7. 결과 슬라이싱
    endIdx := startIdx + query.Limit
    if endIdx > len(allTxns) {
        endIdx = len(allTxns)
    }

    resultTxns := allTxns[startIdx:endIdx]
    hasMore := endIdx < len(allTxns)

    // 8. TransactionView로 변환
    views := make([]TransactionView, len(resultTxns))
    for i, txn := range resultTxns {
        views[i] = s.toTransactionView(txn)
    }

    // 9. 다음 커서 생성
    var nextCursor string
    if hasMore && len(resultTxns) > 0 {
        lastTxn := resultTxns[len(resultTxns)-1]
        nextCursor = encodeCursor(CursorData{
            ID:        lastTxn.ID,
            CreatedAt: lastTxn.CreatedAt,
        })
    }

    return &TransactionListResponse{
        Transactions: views,
        Pagination: PaginationInfo{
            HasMore:    hasMore,
            NextCursor: nextCursor,
            Total:      len(allTxns),
        },
    }, nil
}
```

### 상대방 정보 조회

```go
func (s *BankService) toTransactionView(txn *Transaction) TransactionView {
    view := TransactionView{
        ID:            txn.ID,
        AccountNo:     txn.AccountNo,
        Type:          txn.Type,
        Amount:        txn.Amount,
        BalanceBefore: txn.BalanceBefore,
        BalanceAfter:  txn.BalanceAfter,
        Reference:     txn.Reference,
        Description:   txn.Description,
        CreatedAt:     txn.CreatedAt,
    }

    // 이체인 경우 상대방 정보 조회
    if txn.Type == TransactionTypeTransferIn || txn.Type == TransactionTypeTransferOut {
        if transfer, exists := s.findTransferByTransaction(txn.ID); exists {
            var counterAccountNo string
            if txn.Type == TransactionTypeTransferIn {
                counterAccountNo = transfer.FromAccountNo
            } else {
                counterAccountNo = transfer.ToAccountNo
            }

            if counterAccount, exists := s.accounts[counterAccountNo]; exists {
                view.Counterparty = &CounterpartyInfo{
                    AccountNo: counterAccountNo,
                    Name:      counterAccount.Name,
                }
            }
        }
    }

    // 직불인 경우 요청자 정보 조회
    if txn.Type == TransactionTypeDebit {
        if debitReq, exists := s.findDebitRequestByTransaction(txn.ID); exists {
            view.Counterparty = &CounterpartyInfo{
                CreditorID:   debitReq.CreditorID,
                CreditorName: debitReq.CreditorName,
            }
        }
    }

    return view
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/account.go` | TransactionView, TransactionQuery, PaginationInfo 추가 |
| `internal/service/bank.go` | GetTransactionsByAccount(), toTransactionView() 추가 |
| `internal/handler/bank.go` | HandleGetTransactions() 핸들러 추가 |
| `cmd/main.go` | 라우트 등록 |

## 테스트 케이스

1. 전체 거래 조회 - 정상 반환
2. 유형별 필터 (deposit) - 해당 유형만 반환
3. 기간 필터 - 해당 기간만 반환
4. 유형 + 기간 복합 필터
5. limit=5 - 5건만 반환, hasMore=true
6. 페이지네이션 - 커서로 다음 페이지 조회
7. 정렬 - desc/asc 확인
8. 거래 없는 계좌 - 빈 배열 반환
9. 없는 계좌 - 404
10. 잘못된 날짜 형식 - 400
