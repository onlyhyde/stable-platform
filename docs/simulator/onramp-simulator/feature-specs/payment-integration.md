# 결제 수단별 실제 연동

## 개요

Onramp의 결제 수단별로 pg-simulator, bank-simulator와 실제 연동하여 결제를 처리합니다.

**우선순위**: P0
**의존성**:
- pg-simulator의 checkout-session, bank_transfer
- bank-simulator의 direct-debit
**영향**: 전체 결제 플로우

## 현재 상태

- `paymentMethod` 필드 존재 (card, bank_transfer, apple_pay, google_pay)
- 모든 결제 수단이 동일하게 처리 (내부 성공률로만 결정)
- pg-simulator, bank-simulator와 실제 연동 없음

## 목표

### Card 결제 플로우
```
사용자           Onramp                PG Simulator
  │                │                       │
  │  주문 생성      │                       │
  │  (card)        │                       │
  ├───────────────▶│                       │
  │                │  Checkout Session 생성│
  │                ├──────────────────────▶│
  │                │  checkoutUrl 반환     │
  │                │◀──────────────────────┤
  │                │                       │
  │  결제 URL 안내  │                       │
  │◀───────────────┤                       │
  │                │                       │
  │  결제 페이지    │                       │
  │───────────────────────────────────────▶│
  │                │                       │ 결제 처리
  │  결제 완료      │  웹훅 수신            │
  │◀──────────────────────────────────────│
  │                │                       │
  │                │◀──────────────────────┤
  │                │  주문 완료 처리        │
```

### Bank Transfer 플로우
```
사용자           Onramp               Bank Simulator
  │                │                       │
  │  주문 생성      │                       │
  │  (bank_transfer)│                      │
  ├───────────────▶│                       │
  │                │  Direct Debit 요청    │
  │                ├──────────────────────▶│
  │                │                       │ 잔액 확인/차감
  │                │  결과 반환             │
  │                │◀──────────────────────┤
  │                │                       │
  │  결과 반환      │                       │
  │◀───────────────┤                       │
```

## API 설계

### 주문 생성 확장

**POST /api/v1/orders**

```json
{
  "userId": "USER_001",
  "walletAddress": "0x1234...5678",
  "fiatAmount": "100.00",
  "fiatCurrency": "USD",
  "cryptoCurrency": "USDC",
  "paymentMethod": "card",
  "chainId": 1,
  "returnUrl": "https://app.example.com/order/complete",
  "cancelUrl": "https://app.example.com/order/cancel",
  "bankAccount": {
    "accountNo": "BANK1234567890",
    "holderName": "홍길동"
  }
}
```

**새 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| returnUrl | string | ❌ | 카드 결제 완료 후 복귀 URL |
| cancelUrl | string | ❌ | 카드 결제 취소 시 복귀 URL |
| bankAccount | object | ✅ (bank_transfer 시) | 출금 계좌 정보 |

### 응답 확장

**card 결제 시**:
```json
{
  "id": "order_uuid",
  "userId": "USER_001",
  "status": "pending_payment",
  "paymentUrl": "http://localhost:4351/checkout/cs_uuid",
  "paymentExpiresAt": "2026-01-27T11:00:00Z",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

**bank_transfer 결제 시**:
```json
{
  "id": "order_uuid",
  "userId": "USER_001",
  "status": "processing",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

## 데이터 모델

### Order 확장

```go
type Order struct {
    // 기존 필드들...
    ReturnUrl         string `json:"returnUrl,omitempty"`
    CancelUrl         string `json:"cancelUrl,omitempty"`
    PaymentUrl        string `json:"paymentUrl,omitempty"`
    PaymentExpiresAt  *time.Time `json:"paymentExpiresAt,omitempty"`
    PaymentSessionID  string `json:"paymentSessionId,omitempty"`  // PG checkout session ID
    DebitRequestID    string `json:"debitRequestId,omitempty"`    // Bank direct debit ID
    ExternalPaymentID string `json:"externalPaymentId,omitempty"` // PG payment ID
}

type OrderStatus string

const (
    OrderStatusPending                    OrderStatus = "pending"
    OrderStatusPendingPayment             OrderStatus = "pending_payment"              // 카드 결제 대기
    OrderStatusProcessing                 OrderStatus = "processing"
    OrderStatusPaymentCompletedPendingTx  OrderStatus = "payment_completed_pending_transfer"  // 결제 완료, 전송 대기
    OrderStatusCompleted                  OrderStatus = "completed"
    OrderStatusFailed                     OrderStatus = "failed"
    OrderStatusCancelled                  OrderStatus = "cancelled"
    OrderStatusRefundPending              OrderStatus = "refund_pending"              // 환불 진행 중
    OrderStatusRefunded                   OrderStatus = "refunded"                    // 환불 완료
    OrderStatusKYCRequired                OrderStatus = "kyc_required"
)
```

### Request 확장

```go
type CreateOrderRequest struct {
    // 기존 필드들...
    ReturnUrl   string           `json:"returnUrl"`
    CancelUrl   string           `json:"cancelUrl"`
    BankAccount *BankAccountInfo `json:"bankAccount"`
}

type BankAccountInfo struct {
    AccountNo  string `json:"accountNo" binding:"required"`
    HolderName string `json:"holderName" binding:"required"`
}
```

## 환경 변수 추가

```go
type Config struct {
    // 기존...
    PGSimulatorURL   string
    BankSimulatorURL string
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| PG_SIMULATOR_URL | http://localhost:4351 | pg-simulator URL |
| BANK_SIMULATOR_URL | http://localhost:4350 | bank-simulator URL |

## 서비스 로직

### CreateOrder 수정

```go
func (s *OnRampService) CreateOrder(req CreateOrderRequest) (*Order, error) {
    // 1. 견적 계산
    quote, err := s.calculateQuote(req.FiatAmount, req.FiatCurrency, req.CryptoCurrency)
    if err != nil {
        return nil, err
    }

    // 2. 주문 생성
    order := &Order{
        ID:             uuid.New().String(),
        UserID:         req.UserID,
        WalletAddress:  req.WalletAddress,
        FiatAmount:     req.FiatAmount,
        FiatCurrency:   req.FiatCurrency,
        CryptoAmount:   quote.CryptoAmount,
        CryptoCurrency: req.CryptoCurrency,
        ExchangeRate:   quote.ExchangeRate,
        Fee:            quote.Fee,
        PaymentMethod:  req.PaymentMethod,
        ChainID:        req.ChainID,
        ReturnUrl:      req.ReturnUrl,
        CancelUrl:      req.CancelUrl,
        Status:         OrderStatusPending,
        KYCStatus:      "approved", // TODO: KYC 플로우 구현 시 변경
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    // 3. 결제 수단별 처리
    switch req.PaymentMethod {
    case PaymentMethodCard, PaymentMethodApplePay, PaymentMethodGooglePay:
        return s.processCardPayment(order, req)
    case PaymentMethodBankTransfer:
        return s.processBankTransfer(order, req)
    default:
        return nil, ErrUnsupportedPaymentMethod
    }
}
```

### processCardPayment

```go
func (s *OnRampService) processCardPayment(order *Order, req CreateOrderRequest) (*Order, error) {
    // 1. PG에 Checkout Session 생성
    sessionReq := map[string]interface{}{
        "merchantId":    "ONRAMP_SIMULATOR",
        "orderId":       order.ID,
        "orderName":     fmt.Sprintf("%s 구매", order.CryptoCurrency),
        "amount":        order.FiatAmount,
        "currency":      order.FiatCurrency,
        "customerEmail": "", // TODO: 사용자 정보에서 가져오기
        "returnUrl":     s.buildReturnUrl(order.ID, req.ReturnUrl),
        "cancelUrl":     s.buildCancelUrl(order.ID, req.CancelUrl),
    }

    resp, err := s.pgClient.Post("/api/v1/checkout-sessions", sessionReq)
    if err != nil {
        order.Status = OrderStatusFailed
        order.FailureReason = "payment_gateway_error"
        return order, nil
    }

    var session struct {
        ID          string    `json:"id"`
        CheckoutUrl string    `json:"checkoutUrl"`
        ExpiresAt   time.Time `json:"expiresAt"`
    }
    json.NewDecoder(resp.Body).Decode(&session)

    // 2. 주문 업데이트
    order.Status = OrderStatusPendingPayment
    order.PaymentSessionID = session.ID
    order.PaymentUrl = session.CheckoutUrl
    order.PaymentExpiresAt = &session.ExpiresAt

    s.mu.Lock()
    s.orders[order.ID] = order
    s.mu.Unlock()

    // 3. 웹훅 발송
    go s.sendWebhook("order.created", order)

    return order, nil
}

func (s *OnRampService) buildReturnUrl(orderID, userReturnUrl string) string {
    // Onramp의 결제 완료 콜백 URL
    baseUrl := fmt.Sprintf("%s/api/v1/orders/%s/payment-callback", s.config.BaseURL, orderID)
    if userReturnUrl != "" {
        return fmt.Sprintf("%s?redirectTo=%s", baseUrl, url.QueryEscape(userReturnUrl))
    }
    return baseUrl
}
```

### processBankTransfer

```go
func (s *OnRampService) processBankTransfer(order *Order, req CreateOrderRequest) (*Order, error) {
    // 1. 계좌 정보 검증
    if req.BankAccount == nil {
        return nil, ErrBankAccountRequired
    }

    // 2. bank-simulator에 Direct Debit 요청
    debitReq := map[string]interface{}{
        "accountNo":    req.BankAccount.AccountNo,
        "amount":       order.FiatAmount,
        "currency":     order.FiatCurrency,
        "creditorId":   "ONRAMP_SIMULATOR",
        "creditorName": "Onramp Service",
        "reference":    order.ID,
        "description":  fmt.Sprintf("%s 구매", order.CryptoCurrency),
        "autoApprove":  true,
    }

    resp, err := s.bankClient.Post("/api/v1/debit-requests", debitReq)
    if err != nil {
        order.Status = OrderStatusFailed
        order.FailureReason = "bank_communication_error"
        s.mu.Lock()
        s.orders[order.ID] = order
        s.mu.Unlock()
        go s.sendWebhook("order.failed", order)
        return order, nil
    }

    var debitResult struct {
        ID            string `json:"id"`
        Status        string `json:"status"`
        FailureReason string `json:"failureReason"`
    }
    json.NewDecoder(resp.Body).Decode(&debitResult)

    order.DebitRequestID = debitResult.ID

    // 3. 결과에 따라 처리
    if debitResult.Status == "completed" {
        order.Status = OrderStatusProcessing
        s.mu.Lock()
        s.orders[order.ID] = order
        s.mu.Unlock()
        go s.sendWebhook("order.created", order)

        // 비동기로 crypto 전송 시뮬레이션
        go s.processCryptoTransfer(order)
    } else {
        order.Status = OrderStatusFailed
        order.FailureReason = debitResult.FailureReason
        s.mu.Lock()
        s.orders[order.ID] = order
        s.mu.Unlock()
        go s.sendWebhook("order.failed", order)
    }

    return order, nil
}
```

### 부분 실패 처리 (Crypto 전송 실패)

결제 성공 후 블록체인 전송이 실패할 경우를 처리합니다.

```go
func (s *OnRampService) processCryptoTransfer(order *Order) {
    // 1. 상태를 payment_completed_pending_transfer로 업데이트
    s.mu.Lock()
    order.Status = OrderStatusPaymentCompletedPendingTx
    order.UpdatedAt = time.Now()
    s.mu.Unlock()
    go s.sendWebhook("order.payment_completed", order)

    // 2. Crypto 전송 시뮬레이션
    time.Sleep(time.Duration(s.config.TransferProcessingTime) * time.Second)

    // 3. 성공률에 따라 결과 결정
    if rand.Intn(100) < s.config.TransferSuccessRate {
        // 전송 성공
        txHash := fmt.Sprintf("0x%s", uuid.New().String()[:64])

        s.mu.Lock()
        order.Status = OrderStatusCompleted
        order.TxHash = txHash
        order.CompletedAt = time.Now()
        order.UpdatedAt = time.Now()
        s.mu.Unlock()

        go s.sendWebhook("order.completed", order)
    } else {
        // 전송 실패 → 환불 플로우 시작
        s.mu.Lock()
        order.Status = OrderStatusRefundPending
        order.FailureReason = "crypto_transfer_failed"
        order.UpdatedAt = time.Now()
        s.mu.Unlock()

        go s.sendWebhook("order.transfer_failed", order)
        go s.processRefund(order)
    }
}
```

### 환불 플로우

```go
func (s *OnRampService) processRefund(order *Order) {
    // 1. 환불 지연 시뮬레이션
    time.Sleep(time.Duration(s.config.RefundProcessingTime) * time.Second)

    var refundErr error

    // 2. 결제 수단에 따라 환불 처리
    switch order.PaymentMethod {
    case PaymentMethodCard, PaymentMethodApplePay, PaymentMethodGooglePay:
        refundErr = s.processCardRefund(order)
    case PaymentMethodBankTransfer:
        refundErr = s.processBankRefund(order)
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    if refundErr != nil {
        // 환불 실패 - 수동 처리 필요
        order.Status = OrderStatusFailed
        order.FailureReason = "refund_failed"
        order.UpdatedAt = time.Now()
        go s.sendWebhook("order.refund_failed", order)
        return
    }

    // 3. 환불 완료
    order.Status = OrderStatusRefunded
    order.RefundedAt = &time.Time{}
    *order.RefundedAt = time.Now()
    order.UpdatedAt = time.Now()
    go s.sendWebhook("order.refunded", order)
}

func (s *OnRampService) processCardRefund(order *Order) error {
    // PG에 환불 요청
    refundReq := map[string]interface{}{
        "paymentId": order.ExternalPaymentID,
        "amount":    order.FiatAmount,
        "reason":    "crypto_transfer_failed",
    }

    resp, err := s.pgClient.Post("/api/v1/refunds", refundReq)
    if err != nil {
        return fmt.Errorf("pg refund request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("pg refund failed with status: %d", resp.StatusCode)
    }

    return nil
}

func (s *OnRampService) processBankRefund(order *Order) error {
    // Bank에 입금 요청 (환불)
    depositReq := map[string]interface{}{
        "amount":      order.FiatAmount,
        "reference":   fmt.Sprintf("REFUND_%s", order.ID),
        "description": "암호화폐 구매 취소 환불",
    }

    accountNo := order.BankAccountNo // 원래 출금했던 계좌
    resp, err := s.bankClient.Post(
        fmt.Sprintf("/api/v1/accounts/%s/deposit", accountNo),
        depositReq,
    )
    if err != nil {
        return fmt.Errorf("bank deposit request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("bank deposit failed with status: %d", resp.StatusCode)
    }

    return nil
}
```

### 환경 변수 추가 (부분 실패 처리)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| TRANSFER_SUCCESS_RATE | 95 | Crypto 전송 성공률 (%) |
| TRANSFER_PROCESSING_TIME | 3 | Crypto 전송 처리 시간 (초) |
| REFUND_PROCESSING_TIME | 5 | 환불 처리 시간 (초) |

---

### PG 웹훅 핸들러

```go
// PG로부터 결제 결과 웹훅 수신
func (h *OnRampHandler) HandlePGWebhook(c *gin.Context) {
    var payload struct {
        EventType string `json:"eventType"`
        Data      struct {
            ID      string `json:"id"`
            OrderID string `json:"orderId"`
            Status  string `json:"status"`
        } `json:"data"`
    }

    if err := c.ShouldBindJSON(&payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
        return
    }

    // 시그니처 검증
    signature := c.GetHeader("X-Webhook-Signature")
    if !h.service.VerifyWebhookSignature(c.Request.Body, signature) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }

    orderID := payload.Data.OrderID
    order, err := h.service.GetOrder(orderID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
        return
    }

    switch payload.EventType {
    case "payment.approved":
        order.ExternalPaymentID = payload.Data.ID
        order.Status = OrderStatusProcessing
        order.UpdatedAt = time.Now()
        go h.service.processCryptoTransfer(order)
        go h.service.sendWebhook("order.processing", order)

    case "payment.declined":
        order.Status = OrderStatusFailed
        order.FailureReason = "payment_declined"
        order.UpdatedAt = time.Now()
        go h.service.sendWebhook("order.failed", order)
    }

    c.JSON(http.StatusOK, gin.H{"received": true})
}
```

### 결제 콜백 핸들러

```go
// 사용자가 결제 완료 후 돌아오는 콜백
func (h *OnRampHandler) HandlePaymentCallback(c *gin.Context) {
    orderID := c.Param("id")
    redirectTo := c.Query("redirectTo")

    order, err := h.service.GetOrder(orderID)
    if err != nil {
        c.HTML(http.StatusNotFound, "error.html", gin.H{
            "message": "Order not found",
        })
        return
    }

    // 사용자 redirect URL이 있으면 리다이렉트
    if redirectTo != "" {
        redirectUrl := fmt.Sprintf("%s?orderId=%s&status=%s",
            redirectTo, order.ID, order.Status)
        c.Redirect(http.StatusFound, redirectUrl)
        return
    }

    // 없으면 상태 페이지 표시
    c.HTML(http.StatusOK, "order-status.html", gin.H{
        "order": order,
    })
}
```

## 웹훅 등록 (초기화 시)

```go
func (s *OnRampService) RegisterPGWebhook() error {
    // PG에 웹훅 URL 등록 (실제로는 PG 관리자 콘솔에서 설정)
    // PoC에서는 PG의 WEBHOOK_URL 환경변수로 설정
    log.Printf("PG webhook should be configured to: %s/api/v1/webhooks/pg", s.config.BaseURL)
    return nil
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/order.go` | Order 확장, BankAccountInfo 추가, 상태 추가 |
| `internal/config/config.go` | PG_SIMULATOR_URL, BANK_SIMULATOR_URL 추가 |
| `internal/service/onramp.go` | processCardPayment(), processBankTransfer() 추가 |
| `internal/service/pg_client.go` | 새 파일 - PG 연동 클라이언트 |
| `internal/service/bank_client.go` | 새 파일 - Bank 연동 클라이언트 |
| `internal/handler/onramp.go` | HandlePGWebhook(), HandlePaymentCallback() 추가 |
| `cmd/main.go` | 라우트 및 클라이언트 초기화 |

## 라우트 추가

```go
v1.POST("/webhooks/pg", handler.HandlePGWebhook)
v1.GET("/orders/:id/payment-callback", handler.HandlePaymentCallback)
```

## 테스트 케이스

1. card 결제 - 성공 (PG 결제 후 처리 완료)
2. card 결제 - PG 결제 실패 (declined)
3. card 결제 - PG 연결 실패
4. bank_transfer 결제 - 성공
5. bank_transfer 결제 - 잔액 부족
6. bank_transfer 결제 - 계좌 없음
7. bank_transfer 결제 - 은행 연결 실패
8. apple_pay/google_pay - card와 동일하게 처리
9. 웹훅 수신 후 상태 업데이트 확인
10. 결제 콜백 후 사용자 리다이렉트 확인

## 관련 문서

- [공통 타입 정의](../../common/types.md) - Amount, PaymentMethod 등 공통 타입
- [상태 매핑](../../common/status-mapping.md) - PG/Bank → Onramp 상태 매핑
- [웹훅 스펙](../../common/webhook-spec.md) - 웹훅 페이로드, 서명, 재시도 정책
- [크로스 서비스 연동](../../cross-service/integration-specs.md) - 서비스 간 통합 상세
