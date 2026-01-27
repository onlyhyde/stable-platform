# 서비스 간 상태 매핑

## 개요

세 시뮬레이터 간의 상태값 매핑을 정의합니다. 크로스 서비스 통신 시 이 매핑을 참조합니다.

## Bank Simulator 상태

### Account 상태

```go
type AccountStatus string

const (
    AccountStatusActive   AccountStatus = "active"
    AccountStatusInactive AccountStatus = "inactive"
    AccountStatusFrozen   AccountStatus = "frozen"
    AccountStatusClosed   AccountStatus = "closed"
)
```

### DirectDebit 상태

```go
type DirectDebitStatus string

const (
    DirectDebitPending   DirectDebitStatus = "pending"
    DirectDebitCompleted DirectDebitStatus = "completed"
    DirectDebitFailed    DirectDebitStatus = "failed"
    DirectDebitCancelled DirectDebitStatus = "cancelled"
)
```

### Transaction 상태

```go
type TransactionType string

const (
    TransactionDeposit    TransactionType = "deposit"
    TransactionWithdrawal TransactionType = "withdrawal"
    TransactionTransfer   TransactionType = "transfer"
    TransactionDebit      TransactionType = "debit"      // Direct Debit
    TransactionRefund     TransactionType = "refund"
)
```

---

## PG Simulator 상태

### Payment 상태

```go
type PaymentStatus string

const (
    PaymentPending      PaymentStatus = "pending"
    PaymentRequiresAuth PaymentStatus = "requires_auth"  // 3DS 필요
    PaymentProcessing   PaymentStatus = "processing"
    PaymentApproved     PaymentStatus = "approved"
    PaymentDeclined     PaymentStatus = "declined"
    PaymentCancelled    PaymentStatus = "cancelled"
    PaymentRefunded     PaymentStatus = "refunded"
)
```

### CheckoutSession 상태

```go
type CheckoutSessionStatus string

const (
    CheckoutOpen      CheckoutSessionStatus = "open"
    CheckoutComplete  CheckoutSessionStatus = "complete"
    CheckoutExpired   CheckoutSessionStatus = "expired"
    CheckoutCancelled CheckoutSessionStatus = "cancelled"
)
```

### Settlement 상태

```go
type SettlementStatus string

const (
    SettlementPending    SettlementStatus = "pending"
    SettlementProcessing SettlementStatus = "processing"
    SettlementCompleted  SettlementStatus = "completed"
    SettlementFailed     SettlementStatus = "failed"
)
```

---

## Onramp Simulator 상태

### Order 상태

```go
type OrderStatus string

const (
    OrderPending        OrderStatus = "pending"          // 주문 생성됨
    OrderPendingPayment OrderStatus = "pending_payment"  // 결제 대기 중
    OrderProcessing     OrderStatus = "processing"       // 결제 완료, 전송 준비
    OrderCompleted      OrderStatus = "completed"        // 전송 완료
    OrderFailed         OrderStatus = "failed"           // 실패
    OrderCancelled      OrderStatus = "cancelled"        // 취소됨
    OrderRefunding      OrderStatus = "refunding"        // 환불 진행 중
    OrderRefunded       OrderStatus = "refunded"         // 환불 완료
)
```

### KYC 상태

```go
type KYCStatus string

const (
    KYCNone     KYCStatus = "none"
    KYCPending  KYCStatus = "pending"
    KYCApproved KYCStatus = "approved"
    KYCRejected KYCStatus = "rejected"
    KYCExpired  KYCStatus = "expired"
)
```

---

## 상태 매핑 테이블

### PG Payment → Onramp Order 매핑

| PG Payment 상태 | Onramp Order 상태 | 설명 |
|-----------------|-------------------|------|
| `pending` | `pending_payment` | 결제 처리 대기 |
| `requires_auth` | `pending_payment` | 3DS 인증 필요 |
| `processing` | `pending_payment` | 결제 처리 중 |
| `approved` | `processing` | 결제 승인, 전송 준비 |
| `declined` | `failed` | 결제 거절 |
| `cancelled` | `cancelled` | 결제 취소 |
| `refunded` | `refunded` | 환불 완료 |

```go
var PaymentToOrderStatus = map[PaymentStatus]OrderStatus{
    PaymentPending:      OrderPendingPayment,
    PaymentRequiresAuth: OrderPendingPayment,
    PaymentProcessing:   OrderPendingPayment,
    PaymentApproved:     OrderProcessing,
    PaymentDeclined:     OrderFailed,
    PaymentCancelled:    OrderCancelled,
    PaymentRefunded:     OrderRefunded,
}
```

### Bank DirectDebit → Onramp Order 매핑

| Bank DirectDebit 상태 | Onramp Order 상태 | 설명 |
|-----------------------|-------------------|------|
| `pending` | `pending_payment` | 출금 처리 대기 |
| `completed` | `processing` | 출금 완료, 전송 준비 |
| `failed` | `failed` | 출금 실패 |
| `cancelled` | `cancelled` | 출금 취소 |

```go
var DirectDebitToOrderStatus = map[DirectDebitStatus]OrderStatus{
    DirectDebitPending:   OrderPendingPayment,
    DirectDebitCompleted: OrderProcessing,
    DirectDebitFailed:    OrderFailed,
    DirectDebitCancelled: OrderCancelled,
}
```

### Bank DirectDebit → PG Payment 매핑

| Bank DirectDebit 상태 | PG Payment 상태 | 설명 |
|-----------------------|-----------------|------|
| `pending` | `processing` | 은행 이체 처리 중 |
| `completed` | `approved` | 이체 완료 |
| `failed` | `declined` | 이체 실패 |
| `cancelled` | `cancelled` | 이체 취소 |

```go
var DirectDebitToPaymentStatus = map[DirectDebitStatus]PaymentStatus{
    DirectDebitPending:   PaymentProcessing,
    DirectDebitCompleted: PaymentApproved,
    DirectDebitFailed:    PaymentDeclined,
    DirectDebitCancelled: PaymentCancelled,
}
```

---

## 상태 전이 다이어그램

### Onramp Order 상태 전이

```
                    ┌───────────┐
                    │  pending  │
                    └─────┬─────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   pending_payment     │
              └───────────┬───────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌────────────┐    ┌───────────┐
   │ cancelled│    │ processing │    │  failed   │
   └──────────┘    └─────┬──────┘    └───────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │completed │ │  failed  │ │refunding │
        └──────────┘ └──────────┘ └────┬─────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │ refunded │
                                 └──────────┘
```

### PG Payment 상태 전이

```
                    ┌───────────┐
                    │  pending  │
                    └─────┬─────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
  ┌──────────────┐ ┌────────────┐   ┌───────────┐
  │requires_auth │ │ processing │   │ declined  │
  └──────┬───────┘ └─────┬──────┘   └───────────┘
         │               │
         └───────┬───────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌───────────┐
│ approved │ │ declined │ │ cancelled │
└────┬─────┘ └──────────┘ └───────────┘
     │
     ▼
┌──────────┐
│ refunded │
└──────────┘
```

---

## 실패 원인 코드

### Bank 실패 원인

```go
type BankFailureReason string

const (
    BankFailureInsufficientBalance BankFailureReason = "insufficient_balance"
    BankFailureAccountNotFound     BankFailureReason = "account_not_found"
    BankFailureAccountFrozen       BankFailureReason = "account_frozen"
    BankFailureAccountClosed       BankFailureReason = "account_closed"
    BankFailureDailyLimitExceeded  BankFailureReason = "daily_limit_exceeded"
    BankFailureInvalidAmount       BankFailureReason = "invalid_amount"
    BankFailureSystemError         BankFailureReason = "system_error"
)
```

### PG 실패 원인

```go
type PGFailureReason string

const (
    PGFailureCardDeclined      PGFailureReason = "card_declined"
    PGFailureInsufficientFunds PGFailureReason = "insufficient_funds"
    PGFailureInvalidCard       PGFailureReason = "invalid_card"
    PGFailureExpiredCard       PGFailureReason = "expired_card"
    PGFailure3DSFailed         PGFailureReason = "3ds_failed"
    PGFailureBankDeclined      PGFailureReason = "bank_declined"
    PGFailureFraudSuspected    PGFailureReason = "fraud_suspected"
    PGFailureSystemError       PGFailureReason = "system_error"
)
```

### Onramp 실패 원인

```go
type OnrampFailureReason string

const (
    OnrampFailurePaymentFailed     OnrampFailureReason = "payment_failed"
    OnrampFailureKYCRequired       OnrampFailureReason = "kyc_required"
    OnrampFailureKYCRejected       OnrampFailureReason = "kyc_rejected"
    OnrampFailureLimitExceeded     OnrampFailureReason = "limit_exceeded"
    OnrampFailureInvalidWallet     OnrampFailureReason = "invalid_wallet"
    OnrampFailureUnsupportedPair   OnrampFailureReason = "unsupported_pair"
    OnrampFailureTransferFailed    OnrampFailureReason = "transfer_failed"
    OnrampFailureQuoteExpired      OnrampFailureReason = "quote_expired"
    OnrampFailureSystemError       OnrampFailureReason = "system_error"
)
```

---

## 실패 원인 매핑

### PG → Onramp 실패 원인 매핑

```go
var PGToOnrampFailureReason = map[PGFailureReason]OnrampFailureReason{
    PGFailureCardDeclined:      OnrampFailurePaymentFailed,
    PGFailureInsufficientFunds: OnrampFailurePaymentFailed,
    PGFailureInvalidCard:       OnrampFailurePaymentFailed,
    PGFailureExpiredCard:       OnrampFailurePaymentFailed,
    PGFailure3DSFailed:         OnrampFailurePaymentFailed,
    PGFailureBankDeclined:      OnrampFailurePaymentFailed,
    PGFailureFraudSuspected:    OnrampFailurePaymentFailed,
    PGFailureSystemError:       OnrampFailureSystemError,
}
```

### Bank → Onramp 실패 원인 매핑

```go
var BankToOnrampFailureReason = map[BankFailureReason]OnrampFailureReason{
    BankFailureInsufficientBalance: OnrampFailurePaymentFailed,
    BankFailureAccountNotFound:     OnrampFailurePaymentFailed,
    BankFailureAccountFrozen:       OnrampFailurePaymentFailed,
    BankFailureAccountClosed:       OnrampFailurePaymentFailed,
    BankFailureDailyLimitExceeded:  OnrampFailureLimitExceeded,
    BankFailureInvalidAmount:       OnrampFailurePaymentFailed,
    BankFailureSystemError:         OnrampFailureSystemError,
}
```
