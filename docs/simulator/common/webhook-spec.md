# 웹훅 통합 스펙

## 개요

세 시뮬레이터 간의 웹훅 통신을 위한 표준 스펙을 정의합니다.

## 웹훅 페이로드 형식

### 표준 웹훅 구조

```go
type WebhookPayload struct {
    // 메타데이터
    Version       string    `json:"version"`       // 웹훅 버전 (예: "1.0")
    EventID       string    `json:"eventId"`       // 이벤트 고유 ID
    EventType     string    `json:"eventType"`     // 이벤트 유형
    Timestamp     time.Time `json:"timestamp"`     // 이벤트 발생 시간

    // 전송 메타데이터
    DeliveryID    string    `json:"deliveryId"`    // 전송 시도 ID
    AttemptNumber int       `json:"attemptNumber"` // 재시도 횟수 (1부터 시작)

    // 추적 정보
    CorrelationID string    `json:"correlationId,omitempty"` // 크로스 서비스 추적 ID
    Source        string    `json:"source"`        // 발신 서비스 (bank, pg, onramp)

    // 실제 데이터
    Data          any       `json:"data"`          // 이벤트 데이터
}
```

### 예시

```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440000",
  "eventType": "direct_debit.completed",
  "timestamp": "2026-01-27T10:00:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440000",
  "attemptNumber": 1,
  "correlationId": "cor_770e8400-e29b-41d4-a716-446655440000",
  "source": "bank",
  "data": {
    "id": "dd_123",
    "accountNo": "1234567890",
    "amount": "100.00",
    "status": "completed"
  }
}
```

---

## 이벤트 타입 네이밍 규칙

### 형식

```
{resource}.{action}
```

- `resource`: 리소스 유형 (snake_case)
- `action`: 액션 (snake_case)

### Bank Simulator 이벤트

| 이벤트 타입 | 설명 |
|-------------|------|
| `direct_debit.pending` | Direct Debit 요청 접수 |
| `direct_debit.completed` | Direct Debit 성공 |
| `direct_debit.failed` | Direct Debit 실패 |
| `direct_debit.cancelled` | Direct Debit 취소 |
| `account.verified` | 계좌 검증 완료 |
| `account.verification_failed` | 계좌 검증 실패 |
| `transfer.completed` | 이체 완료 |
| `transfer.failed` | 이체 실패 |

### PG Simulator 이벤트

| 이벤트 타입 | 설명 |
|-------------|------|
| `payment.pending` | 결제 요청 접수 |
| `payment.requires_auth` | 3DS 인증 필요 |
| `payment.approved` | 결제 승인 |
| `payment.declined` | 결제 거절 |
| `payment.cancelled` | 결제 취소 |
| `payment.refunded` | 결제 환불 |
| `checkout.completed` | 체크아웃 완료 |
| `checkout.expired` | 체크아웃 만료 |
| `settlement.completed` | 정산 완료 |

### Onramp Simulator 이벤트

| 이벤트 타입 | 설명 |
|-------------|------|
| `order.created` | 주문 생성 |
| `order.payment_received` | 결제 수신 |
| `order.processing` | 전송 처리 중 |
| `order.completed` | 주문 완료 |
| `order.failed` | 주문 실패 |
| `order.refunded` | 환불 완료 |
| `kyc.submitted` | KYC 제출 |
| `kyc.approved` | KYC 승인 |
| `kyc.rejected` | KYC 거절 |

---

## 서명 검증

### HMAC-SHA256 서명

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

func GenerateSignature(payload []byte, secret string) string {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    return hex.EncodeToString(mac.Sum(nil))
}

func VerifySignature(payload []byte, signature, secret string) bool {
    expected := GenerateSignature(payload, secret)
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

### HTTP 헤더

```
POST /webhook HTTP/1.1
Content-Type: application/json
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1706353200
X-Webhook-Event: direct_debit.completed
X-Webhook-Delivery-ID: dlv_660e8400...
```

### 서명 생성 (발신)

```go
func SendWebhook(url string, payload WebhookPayload, secret string) error {
    body, _ := json.Marshal(payload)
    timestamp := time.Now().Unix()

    // 서명 생성: timestamp + "." + body
    signatureInput := fmt.Sprintf("%d.%s", timestamp, string(body))
    signature := GenerateSignature([]byte(signatureInput), secret)

    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Webhook-Signature", "sha256="+signature)
    req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", timestamp))
    req.Header.Set("X-Webhook-Event", payload.EventType)
    req.Header.Set("X-Webhook-Delivery-ID", payload.DeliveryID)

    // ... 전송
}
```

### 서명 검증 (수신)

```go
func VerifyWebhookRequest(r *http.Request, secret string) error {
    // 1. 타임스탬프 검증 (5분 이내)
    timestamp, _ := strconv.ParseInt(r.Header.Get("X-Webhook-Timestamp"), 10, 64)
    if time.Now().Unix()-timestamp > 300 {
        return errors.New("webhook timestamp expired")
    }

    // 2. 서명 검증
    body, _ := io.ReadAll(r.Body)
    r.Body = io.NopCloser(bytes.NewBuffer(body))

    signatureInput := fmt.Sprintf("%d.%s", timestamp, string(body))
    expectedSignature := "sha256=" + GenerateSignature([]byte(signatureInput), secret)

    if r.Header.Get("X-Webhook-Signature") != expectedSignature {
        return errors.New("invalid webhook signature")
    }

    return nil
}
```

---

## 재시도 정책

### 지수 백오프

```go
type RetryConfig struct {
    MaxAttempts    int           // 최대 시도 횟수 (기본: 5)
    InitialDelay   time.Duration // 초기 대기 시간 (기본: 5초)
    MaxDelay       time.Duration // 최대 대기 시간 (기본: 300초)
    BackoffFactor  float64       // 백오프 배수 (기본: 2.0)
}

var DefaultRetryConfig = RetryConfig{
    MaxAttempts:   5,
    InitialDelay:  5 * time.Second,
    MaxDelay:      300 * time.Second,
    BackoffFactor: 2.0,
}

// 재시도 간격: 5s, 10s, 20s, 40s, 80s
func (c *RetryConfig) GetDelay(attempt int) time.Duration {
    delay := float64(c.InitialDelay) * math.Pow(c.BackoffFactor, float64(attempt-1))
    if delay > float64(c.MaxDelay) {
        return c.MaxDelay
    }
    return time.Duration(delay)
}
```

### 재시도 조건

| HTTP 상태 | 재시도 여부 | 설명 |
|-----------|-------------|------|
| 2xx | 아니오 | 성공 |
| 400 | 아니오 | 잘못된 요청 (재시도해도 동일) |
| 401, 403 | 아니오 | 인증/권한 오류 |
| 404 | 아니오 | 엔드포인트 없음 |
| 408 | 예 | 요청 타임아웃 |
| 429 | 예 | 요청 한도 초과 |
| 5xx | 예 | 서버 오류 |
| 타임아웃 | 예 | 네트워크 오류 |

### 재시도 구현

```go
func SendWithRetry(url string, payload WebhookPayload, secret string, config RetryConfig) error {
    var lastErr error

    for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
        payload.DeliveryID = uuid.New().String()
        payload.AttemptNumber = attempt

        err := SendWebhook(url, payload, secret)
        if err == nil {
            return nil
        }

        lastErr = err

        // 재시도 불가능한 에러인지 확인
        if !isRetryable(err) {
            return err
        }

        // 마지막 시도가 아니면 대기
        if attempt < config.MaxAttempts {
            time.Sleep(config.GetDelay(attempt))
        }
    }

    return fmt.Errorf("webhook delivery failed after %d attempts: %w", config.MaxAttempts, lastErr)
}
```

---

## 순환 호출 방지

### Correlation ID 추적

```go
const MaxWebhookDepth = 5

type WebhookContext struct {
    CorrelationID string
    Depth         int
    VisitedNodes  []string  // [bank, pg, onramp]
}

func (ctx *WebhookContext) CanProceed(source string) bool {
    // 깊이 제한 확인
    if ctx.Depth >= MaxWebhookDepth {
        return false
    }

    // 동일 노드 재방문 확인
    for _, node := range ctx.VisitedNodes {
        if node == source {
            return false
        }
    }

    return true
}

func (ctx *WebhookContext) AddNode(source string) WebhookContext {
    return WebhookContext{
        CorrelationID: ctx.CorrelationID,
        Depth:         ctx.Depth + 1,
        VisitedNodes:  append(ctx.VisitedNodes, source),
    }
}
```

### 웹훅 처리 시 검증

```go
func HandleWebhook(r *http.Request) error {
    var payload WebhookPayload
    json.NewDecoder(r.Body).Decode(&payload)

    // Correlation ID로 컨텍스트 조회
    ctx := GetWebhookContext(payload.CorrelationID)

    // 순환 호출 방지
    if !ctx.CanProceed(payload.Source) {
        log.Printf("Webhook loop detected: %v", ctx.VisitedNodes)
        return ErrWebhookLoopDetected
    }

    // 새 컨텍스트로 처리
    newCtx := ctx.AddNode(payload.Source)

    // ... 처리 로직
}
```

---

## 멱등성 처리

### Event ID 기반 중복 방지

```go
type WebhookDeduplicator struct {
    processed map[string]time.Time
    mu        sync.RWMutex
    ttl       time.Duration
}

func NewWebhookDeduplicator(ttl time.Duration) *WebhookDeduplicator {
    d := &WebhookDeduplicator{
        processed: make(map[string]time.Time),
        ttl:       ttl,
    }
    go d.cleanup()
    return d
}

func (d *WebhookDeduplicator) IsDuplicate(eventID string) bool {
    d.mu.RLock()
    _, exists := d.processed[eventID]
    d.mu.RUnlock()
    return exists
}

func (d *WebhookDeduplicator) MarkProcessed(eventID string) {
    d.mu.Lock()
    d.processed[eventID] = time.Now()
    d.mu.Unlock()
}

func (d *WebhookDeduplicator) cleanup() {
    ticker := time.NewTicker(time.Minute)
    for range ticker.C {
        d.mu.Lock()
        cutoff := time.Now().Add(-d.ttl)
        for id, ts := range d.processed {
            if ts.Before(cutoff) {
                delete(d.processed, id)
            }
        }
        d.mu.Unlock()
    }
}
```

### 핸들러에서 사용

```go
var deduplicator = NewWebhookDeduplicator(24 * time.Hour)

func HandleWebhook(r *http.Request) error {
    var payload WebhookPayload
    json.NewDecoder(r.Body).Decode(&payload)

    // 중복 확인
    if deduplicator.IsDuplicate(payload.EventID) {
        // 이미 처리됨 - 성공 응답 반환
        return nil
    }

    // 처리
    if err := processWebhook(payload); err != nil {
        return err
    }

    // 처리 완료 마킹
    deduplicator.MarkProcessed(payload.EventID)
    return nil
}
```

---

## 응답 형식

### 성공 응답

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "received": true,
  "eventId": "evt_550e8400..."
}
```

### 실패 응답

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_signature",
  "message": "Webhook signature verification failed"
}
```

### 응답 코드

| HTTP 상태 | 의미 | 재시도 |
|-----------|------|--------|
| 200 | 성공 | 아니오 |
| 202 | 수신 확인 (비동기 처리) | 아니오 |
| 400 | 잘못된 요청 | 아니오 |
| 401 | 인증 실패 | 아니오 |
| 500 | 서버 오류 | 예 |
| 503 | 서비스 불가 | 예 |

---

## 환경변수

### 서비스별 웹훅 설정

```bash
# Bank Simulator
BANK_WEBHOOK_SECRET=your_bank_webhook_secret_32chars
BANK_WEBHOOK_TIMEOUT=30
BANK_WEBHOOK_MAX_RETRIES=5

# PG Simulator
PG_WEBHOOK_SECRET=your_pg_webhook_secret_32_chars
PG_WEBHOOK_TIMEOUT=30
PG_WEBHOOK_MAX_RETRIES=5

# Onramp Simulator
ONRAMP_WEBHOOK_SECRET=your_onramp_webhook_secret_32c
ONRAMP_WEBHOOK_TIMEOUT=30
ONRAMP_WEBHOOK_MAX_RETRIES=5
```

### 서비스 URL 설정

```bash
# Bank Simulator가 호출하는 서비스
BANK_PG_WEBHOOK_URL=http://localhost:4351/webhooks/bank

# PG Simulator가 호출하는 서비스
PG_BANK_WEBHOOK_URL=http://localhost:4350/webhooks/pg
PG_ONRAMP_WEBHOOK_URL=http://localhost:4352/webhooks/pg

# Onramp Simulator가 호출하는 서비스
ONRAMP_PG_WEBHOOK_URL=http://localhost:4351/webhooks/onramp
ONRAMP_BANK_WEBHOOK_URL=http://localhost:4350/webhooks/onramp
```
