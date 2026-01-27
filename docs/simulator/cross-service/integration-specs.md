# 서비스 간 연동 상세 스펙

## 개요

세 개의 시뮬레이터 서비스 간 연동 방식과 플로우를 정의합니다.

## 연동 구성

### 서비스 URL

```bash
# 환경 변수 설정
BANK_SIMULATOR_URL=http://localhost:4350
PG_SIMULATOR_URL=http://localhost:4351
ONRAMP_SIMULATOR_URL=http://localhost:4352
```

### 웹훅 URL

```bash
# bank-simulator
WEBHOOK_URL=http://localhost:4351/api/v1/webhooks/bank  # PG가 수신
# 또는
WEBHOOK_URL=http://localhost:4352/api/v1/webhooks/bank  # Onramp가 수신

# pg-simulator
WEBHOOK_URL=http://localhost:4352/api/v1/webhooks/pg    # Onramp가 수신

# onramp-simulator
WEBHOOK_URL=<사용자_정의_엔드포인트>
```

## 연동 시나리오

### 1. Onramp 카드 결제

**플로우**:
```
[User] → [Onramp] → [PG] → [User] → [PG] → [Onramp] → [User]
```

**상세 단계**:

| 단계 | 주체 | 동작 | API 호출 |
|------|------|------|----------|
| 1 | User | 주문 생성 (card) | `POST onramp/api/v1/orders` |
| 2 | Onramp | PG 결제 세션 생성 | `POST pg/api/v1/checkout-sessions` |
| 3 | Onramp | 결제 URL 반환 | 응답에 paymentUrl 포함 |
| 4 | User | 결제 페이지 접근 | `GET pg/checkout/{sessionId}` |
| 5 | User | 카드 정보 입력 | `POST pg/checkout/{sessionId}/pay` |
| 6 | PG | 3DS 처리 (필요시) | 내부 처리 |
| 7 | PG | 결제 완료 | 상태 업데이트 |
| 8 | PG | Onramp 웹훅 | `POST onramp/api/v1/webhooks/pg` |
| 9 | Onramp | 주문 상태 업데이트 | 내부 처리 |
| 10 | Onramp | Crypto 전송 시뮬레이션 | 내부 처리 |
| 11 | Onramp | 사용자 웹훅 | `POST {user_webhook_url}` |
| 12 | PG | 사용자 리다이렉트 | returnUrl로 리다이렉트 |

**API 상세**:

```yaml
# 단계 2: Onramp → PG
POST /api/v1/checkout-sessions
Request:
  merchantId: "ONRAMP_SIMULATOR"
  orderId: "{onramp_order_id}"
  orderName: "USDC 구매"
  amount: "100.00"
  currency: "USD"
  returnUrl: "http://localhost:4352/api/v1/orders/{id}/payment-callback"
  cancelUrl: "http://localhost:4352/api/v1/orders/{id}/payment-cancel"
Response:
  id: "cs_xxx"
  checkoutUrl: "http://localhost:4351/checkout/cs_xxx"

# 단계 8: PG → Onramp 웹훅
POST /api/v1/webhooks/pg
Headers:
  X-Webhook-Signature: "{hmac_signature}"
Body:
  eventType: "payment.approved"
  timestamp: "2026-01-27T10:00:00Z"
  data:
    id: "pay_xxx"
    orderId: "{onramp_order_id}"
    status: "approved"
    amount: "100.00"
```

---

### 2. Onramp 은행 이체

**플로우**:
```
[User] → [Onramp] → [Bank] → [Onramp] → [User]
```

**상세 단계**:

| 단계 | 주체 | 동작 | API 호출 |
|------|------|------|----------|
| 1 | User | 주문 생성 (bank_transfer) | `POST onramp/api/v1/orders` |
| 2 | Onramp | 계좌 확인 | `POST bank/api/v1/accounts/verify` |
| 3 | Onramp | 출금 요청 | `POST bank/api/v1/debit-requests` |
| 4 | Bank | 잔액 확인/차감 | 내부 처리 |
| 5 | Bank | 결과 반환 | Direct Debit 응답 |
| 6 | Onramp | 주문 상태 업데이트 | 내부 처리 |
| 7 | Onramp | Crypto 전송 시뮬레이션 | 내부 처리 |
| 8 | Onramp | 사용자 웹훅 | `POST {user_webhook_url}` |

**API 상세**:

```yaml
# 단계 2: Onramp → Bank (계좌 확인)
POST /api/v1/accounts/verify
Request:
  accountNo: "BANK1234567890"
  holderName: "홍길동"
Response:
  verified: true
  accountNo: "BANK1234567890"
  maskedName: "홍*동"
  status: "active"

# 단계 3: Onramp → Bank (출금 요청)
POST /api/v1/debit-requests
Request:
  accountNo: "BANK1234567890"
  amount: "100.00"
  currency: "USD"
  creditorId: "ONRAMP_SIMULATOR"
  creditorName: "Onramp Service"
  reference: "{onramp_order_id}"
  description: "USDC 구매"
  autoApprove: true
Response:
  id: "debit_xxx"
  status: "completed"  # autoApprove=true이므로 즉시 완료
  transactionId: "txn_xxx"
```

---

### 3. PG 은행 이체 결제

**플로우**:
```
[Merchant] → [PG] → [Bank] → [PG] → [Merchant]
```

**상세 단계**:

| 단계 | 주체 | 동작 | API 호출 |
|------|------|------|----------|
| 1 | Merchant | 결제 생성 (bank_transfer) | `POST pg/api/v1/payments` |
| 2 | PG | 계좌 확인 | `POST bank/api/v1/accounts/verify` |
| 3 | PG | 출금 요청 | `POST bank/api/v1/debit-requests` |
| 4 | Bank | 잔액 확인/차감 | 내부 처리 |
| 5 | Bank | 결과 반환 | Direct Debit 응답 |
| 6 | PG | 결제 상태 업데이트 | 내부 처리 |
| 7 | PG | 가맹점 웹훅 | `POST {merchant_webhook_url}` |

**API 상세**:

```yaml
# 단계 1: Merchant → PG
POST /api/v1/payments
Request:
  merchantId: "MERCHANT_001"
  orderId: "ORDER_12345"
  amount: "50000"
  currency: "KRW"
  method: "bank_transfer"
  bankAccount:
    accountNo: "BANK1234567890"
    holderName: "홍길동"
  returnUrl: "https://shop.example.com/complete"
Response:
  id: "pay_xxx"
  status: "approved"  # 또는 "declined"
  bankAccountNo: "BANK****7890"
  debitRequestId: "debit_xxx"
```

---

### 4. PG 정산 → Bank

**플로우**:
```
[PG 정산 배치] → [Bank] → [Merchant 계좌 입금]
```

**상세 단계**:

| 단계 | 주체 | 동작 | API 호출 |
|------|------|------|----------|
| 1 | Admin | 정산 트리거 | `POST pg/api/v1/settlements/process` |
| 2 | PG | 정산 대상 집계 | 내부 처리 |
| 3 | PG | 가맹점 계좌 입금 | `POST bank/api/v1/accounts/{no}/deposit` |
| 4 | Bank | 잔액 추가 | 내부 처리 |
| 5 | Bank | 결과 반환 | Deposit 응답 |
| 6 | PG | 정산 완료 처리 | 내부 처리 |
| 7 | PG | 가맹점 웹훅 | `POST {merchant_webhook_url}` |

**API 상세**:

```yaml
# 단계 3: PG → Bank (입금)
POST /api/v1/accounts/BANK1234567890/deposit
Request:
  amount: "485000.00"
  reference: "settle_xxx"
  description: "PG 정산금 (15건)"
Response:
  id: "txn_xxx"
  accountNo: "BANK1234567890"
  type: "deposit"
  amount: "485000.00"
  balanceAfter: "1485000.00"
```

## HTTP 클라이언트 구현

### 공통 클라이언트 패턴

```go
type ServiceClient struct {
    baseURL    string
    secret     string
    httpClient *http.Client
}

func NewServiceClient(baseURL, secret string) *ServiceClient {
    return &ServiceClient{
        baseURL: baseURL,
        secret:  secret,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *ServiceClient) Post(path string, body interface{}) (*http.Response, error) {
    jsonBody, err := json.Marshal(body)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewBuffer(jsonBody))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")

    return c.httpClient.Do(req)
}

func (c *ServiceClient) Get(path string) (*http.Response, error) {
    req, err := http.NewRequest("GET", c.baseURL+path, nil)
    if err != nil {
        return nil, err
    }

    return c.httpClient.Do(req)
}
```

### Bank Client (PG/Onramp 사용)

```go
// internal/service/bank_client.go

type BankClient struct {
    *ServiceClient
}

func NewBankClient(baseURL string) *BankClient {
    return &BankClient{
        ServiceClient: NewServiceClient(baseURL, ""),
    }
}

// 계좌 확인
func (c *BankClient) VerifyAccount(accountNo, holderName string) (*VerifyResult, error) {
    resp, err := c.Post("/api/v1/accounts/verify", map[string]string{
        "accountNo":  accountNo,
        "holderName": holderName,
    })
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result VerifyResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}

// Direct Debit 요청
func (c *BankClient) RequestDebit(req DebitRequest) (*DebitResult, error) {
    resp, err := c.Post("/api/v1/debit-requests", req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result DebitResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}

// 입금
func (c *BankClient) Deposit(accountNo string, amount, reference, description string) (*TransactionResult, error) {
    resp, err := c.Post(fmt.Sprintf("/api/v1/accounts/%s/deposit", accountNo), map[string]string{
        "amount":      amount,
        "reference":   reference,
        "description": description,
    })
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result TransactionResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}
```

### PG Client (Onramp 사용)

```go
// internal/service/pg_client.go

type PGClient struct {
    *ServiceClient
}

func NewPGClient(baseURL string) *PGClient {
    return &PGClient{
        ServiceClient: NewServiceClient(baseURL, ""),
    }
}

// Checkout Session 생성
func (c *PGClient) CreateCheckoutSession(req CheckoutSessionRequest) (*CheckoutSession, error) {
    resp, err := c.Post("/api/v1/checkout-sessions", req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result CheckoutSession
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}

// 결제 조회
func (c *PGClient) GetPayment(paymentID string) (*Payment, error) {
    resp, err := c.Get(fmt.Sprintf("/api/v1/payments/%s", paymentID))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result Payment
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}
```

## 웹훅 핸들러 구현

### 공통 웹훅 검증

```go
func VerifyWebhookSignature(body []byte, signature, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expected))
}
```

### Onramp: PG 웹훅 핸들러

```go
func (h *OnRampHandler) HandlePGWebhook(c *gin.Context) {
    // 1. Body 읽기
    body, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
        return
    }

    // 2. 시그니처 검증
    signature := c.GetHeader("X-Webhook-Signature")
    if !VerifyWebhookSignature(body, signature, h.config.PGWebhookSecret) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }

    // 3. 페이로드 파싱
    var payload WebhookPayload
    if err := json.Unmarshal(body, &payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
        return
    }

    // 4. 이벤트 처리
    switch payload.EventType {
    case "payment.approved":
        h.handlePaymentApproved(payload.Data)
    case "payment.declined":
        h.handlePaymentDeclined(payload.Data)
    case "payment.cancelled":
        h.handlePaymentCancelled(payload.Data)
    }

    c.JSON(http.StatusOK, gin.H{"received": true})
}
```

### PG: Bank 웹훅 핸들러

```go
func (h *PaymentHandler) HandleBankWebhook(c *gin.Context) {
    // 1. Body 읽기 및 검증
    body, _ := io.ReadAll(c.Request.Body)
    signature := c.GetHeader("X-Webhook-Signature")

    if !VerifyWebhookSignature(body, signature, h.config.BankWebhookSecret) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }

    // 2. 페이로드 파싱
    var payload WebhookPayload
    json.Unmarshal(body, &payload)

    // 3. 이벤트 처리
    switch payload.EventType {
    case "debit.completed":
        h.handleDebitCompleted(payload.Data)
    case "debit.rejected":
        h.handleDebitRejected(payload.Data)
    }

    c.JSON(http.StatusOK, gin.H{"received": true})
}
```

## 에러 처리

### 연동 실패 시 처리

```go
func (s *OnRampService) processCardPayment(order *Order, req CreateOrderRequest) (*Order, error) {
    // PG 연동 시도
    session, err := s.pgClient.CreateCheckoutSession(...)

    if err != nil {
        // 네트워크 오류 등
        order.Status = OrderStatusFailed
        order.FailureReason = "payment_gateway_unavailable"

        s.mu.Lock()
        s.orders[order.ID] = order
        s.mu.Unlock()

        go s.sendWebhook("order.failed", order)

        return order, nil  // 에러를 반환하지 않고 실패 상태의 주문 반환
    }

    // 성공 시 계속 진행
    // ...
}
```

### 재시도 로직

```go
func (c *ServiceClient) PostWithRetry(path string, body interface{}, maxRetries int) (*http.Response, error) {
    var lastErr error
    backoff := time.Second

    for i := 0; i < maxRetries; i++ {
        resp, err := c.Post(path, body)
        if err == nil && resp.StatusCode < 500 {
            return resp, nil
        }

        if err != nil {
            lastErr = err
        } else {
            lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
            resp.Body.Close()
        }

        time.Sleep(backoff)
        backoff *= 2
        if backoff > 10*time.Second {
            backoff = 10 * time.Second
        }
    }

    return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
}
```

## 환경 변수 요약

### bank-simulator
```bash
PORT=4350
WEBHOOK_URL=                          # 웹훅 수신 서비스 URL (선택)
WEBHOOK_SECRET=bank-webhook-secret    # 웹훅 서명 시크릿
```

### pg-simulator
```bash
PORT=4351
BANK_SIMULATOR_URL=http://localhost:4350
WEBHOOK_URL=                          # 웹훅 수신 서비스 URL (선택)
WEBHOOK_SECRET=pg-webhook-secret
BANK_WEBHOOK_SECRET=bank-webhook-secret  # Bank 웹훅 검증용
```

### onramp-simulator
```bash
PORT=4352
PG_SIMULATOR_URL=http://localhost:4351
BANK_SIMULATOR_URL=http://localhost:4350
WEBHOOK_URL=                          # 사용자 웹훅 URL
WEBHOOK_SECRET=onramp-webhook-secret
PG_WEBHOOK_SECRET=pg-webhook-secret   # PG 웹훅 검증용
BANK_WEBHOOK_SECRET=bank-webhook-secret  # Bank 웹훅 검증용
```

## 테스트 시나리오

### 통합 테스트 케이스

1. **Onramp 카드 결제 E2E**
   - 주문 생성 → PG 결제 → 웹훅 수신 → 주문 완료

2. **Onramp 은행 이체 E2E**
   - 주문 생성 → 계좌 확인 → 출금 → 주문 완료

3. **PG 은행 이체 E2E**
   - 결제 생성 → 계좌 확인 → 출금 → 결제 완료

4. **PG 정산 E2E**
   - 정산 트리거 → 집계 → 입금 → 정산 완료

5. **실패 시나리오**
   - 잔액 부족 → 출금 실패 → 주문/결제 실패
   - 서비스 연결 실패 → 에러 처리

6. **동시성 테스트**
   - 동일 계좌에 동시 출금 요청

## 모니터링

### 로그 포맷

```go
// 연동 요청 로그
log.Printf("[%s] Request to %s: %s %s", time.Now().Format(time.RFC3339), serviceName, method, path)

// 연동 응답 로그
log.Printf("[%s] Response from %s: %d (%dms)", time.Now().Format(time.RFC3339), serviceName, statusCode, duration)

// 웹훅 수신 로그
log.Printf("[%s] Webhook received: %s from %s", time.Now().Format(time.RFC3339), eventType, sourceService)
```

### 헬스체크

각 서비스 시작 시 의존 서비스 연결 확인:

```go
func (s *OnRampService) CheckDependencies() error {
    // PG 연결 확인
    resp, err := s.pgClient.Get("/health")
    if err != nil || resp.StatusCode != 200 {
        log.Printf("WARNING: PG simulator not available")
    }

    // Bank 연결 확인
    resp, err = s.bankClient.Get("/health")
    if err != nil || resp.StatusCode != 200 {
        log.Printf("WARNING: Bank simulator not available")
    }

    return nil
}
```
