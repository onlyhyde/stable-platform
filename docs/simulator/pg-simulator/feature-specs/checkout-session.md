# Checkout Session (Hosted Checkout)

## 개요

가맹점이 결제 링크를 생성하면 PG가 호스팅하는 결제 페이지에서 결제를 처리하는 기능을 추가합니다.

**우선순위**: P1
**의존성**: redirect-url
**영향**: onramp-simulator (카드 결제 위임)

## 현재 상태

- 가맹점이 직접 카드 정보를 받아 결제 API 호출
- PG 호스팅 결제 페이지 없음

## 목표

Stripe Checkout, 토스페이먼츠 결제창처럼 PG가 호스팅하는 결제 페이지:

```
가맹점                    PG Simulator
  │                          │
  │  1. 세션 생성             │
  ├─────────────────────────▶│
  │  2. 결제 URL 반환         │
  │◀─────────────────────────┤
  │                          │
  │  3. 사용자 결제 페이지로 이동
  │                          │
  │    사용자 ──▶ 결제 페이지
  │              카드 정보 입력
  │              3DS 인증 (필요 시)
  │              결제 완료
  │    사용자 ◀── returnUrl
  │                          │
  │  4. 웹훅 수신 (결제 결과)  │
  │◀─────────────────────────┤
```

## API 설계

### POST /api/v1/checkout-sessions

**설명**: 결제 세션 생성

**요청**:
```json
{
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "orderName": "스마트폰 케이스 외 2건",
  "amount": "35000",
  "currency": "KRW",
  "customerEmail": "customer@example.com",
  "customerName": "홍길동",
  "returnUrl": "https://shop.example.com/payment/complete",
  "cancelUrl": "https://shop.example.com/payment/cancel",
  "expiresIn": 3600,
  "metadata": {
    "productIds": ["PROD_001", "PROD_002"]
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| merchantId | string | ✅ | 가맹점 ID |
| orderId | string | ✅ | 주문 ID |
| orderName | string | ✅ | 주문명 (결제창에 표시) |
| amount | string | ✅ | 결제 금액 |
| currency | string | ✅ | 통화 코드 |
| customerEmail | string | ❌ | 고객 이메일 |
| customerName | string | ❌ | 고객명 |
| returnUrl | string | ✅ | 결제 완료 후 이동 URL |
| cancelUrl | string | ❌ | 결제 취소 시 이동 URL |
| expiresIn | int | ❌ | 세션 유효 시간 (초, 기본: 3600) |
| metadata | object | ❌ | 가맹점 메타데이터 |

**응답 (201)**:
```json
{
  "id": "cs_uuid",
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "orderName": "스마트폰 케이스 외 2건",
  "amount": "35000",
  "currency": "KRW",
  "status": "pending",
  "checkoutUrl": "http://localhost:4351/checkout/cs_uuid",
  "expiresAt": "2026-01-27T11:00:00Z",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

---

### GET /api/v1/checkout-sessions/{id}

**설명**: 세션 상태 조회

**응답**:
```json
{
  "id": "cs_uuid",
  "status": "completed",
  "paymentId": "pay_uuid",
  "expiresAt": "2026-01-27T11:00:00Z"
}
```

**status 값**:
| 상태 | 설명 |
|------|------|
| pending | 결제 대기 중 |
| completed | 결제 완료 |
| expired | 세션 만료 |
| cancelled | 사용자 취소 |

---

### GET /checkout/{sessionId}

**설명**: 결제 페이지 (HTML)

사용자가 접근하는 결제 UI 페이지. 카드 정보 입력 폼 제공.

---

### POST /checkout/{sessionId}/pay

**설명**: 결제 페이지에서 결제 실행

**요청** (form data):
```
cardNumber=4242424242424242
cardExpMonth=12
cardExpYear=28
cardCVV=123
cardName=홍길동
```

**응답**: 3DS 필요 시 3DS 페이지로 redirect, 아니면 결과 페이지로 redirect

---

### POST /checkout/{sessionId}/cancel

**설명**: 결제 취소

결제 페이지에서 "취소" 버튼 클릭 시 호출.

**응답**: cancelUrl로 redirect

## 데이터 모델

### CheckoutSession (신규)

```go
type CheckoutSessionStatus string

const (
    CheckoutSessionStatusPending   CheckoutSessionStatus = "pending"
    CheckoutSessionStatusCompleted CheckoutSessionStatus = "completed"
    CheckoutSessionStatusExpired   CheckoutSessionStatus = "expired"
    CheckoutSessionStatusCancelled CheckoutSessionStatus = "cancelled"
)

type CheckoutSession struct {
    ID            string                `json:"id"`
    MerchantID    string                `json:"merchantId"`
    OrderID       string                `json:"orderId"`
    OrderName     string                `json:"orderName"`
    Amount        string                `json:"amount"`
    Currency      string                `json:"currency"`
    CustomerEmail string                `json:"customerEmail,omitempty"`
    CustomerName  string                `json:"customerName,omitempty"`
    ReturnUrl     string                `json:"returnUrl"`
    CancelUrl     string                `json:"cancelUrl,omitempty"`
    Status        CheckoutSessionStatus `json:"status"`
    PaymentID     string                `json:"paymentId,omitempty"`
    CheckoutUrl   string                `json:"checkoutUrl"`
    Metadata      map[string]any        `json:"metadata,omitempty"`
    ExpiresAt     time.Time             `json:"expiresAt"`
    CreatedAt     time.Time             `json:"createdAt"`
    CompletedAt   *time.Time            `json:"completedAt,omitempty"`
}
```

### Request 모델

```go
type CreateCheckoutSessionRequest struct {
    MerchantID    string         `json:"merchantId" binding:"required"`
    OrderID       string         `json:"orderId" binding:"required"`
    OrderName     string         `json:"orderName" binding:"required"`
    Amount        string         `json:"amount" binding:"required"`
    Currency      string         `json:"currency" binding:"required"`
    CustomerEmail string         `json:"customerEmail"`
    CustomerName  string         `json:"customerName"`
    ReturnUrl     string         `json:"returnUrl" binding:"required"`
    CancelUrl     string         `json:"cancelUrl"`
    ExpiresIn     int            `json:"expiresIn"`
    Metadata      map[string]any `json:"metadata"`
}
```

## 서비스 로직

### CreateCheckoutSession

```go
func (s *PaymentService) CreateCheckoutSession(req CreateCheckoutSessionRequest) (*CheckoutSession, error) {
    // 1. 유효 시간 설정
    expiresIn := req.ExpiresIn
    if expiresIn <= 0 {
        expiresIn = 3600 // 기본 1시간
    }

    // 2. 세션 생성
    session := &CheckoutSession{
        ID:            "cs_" + uuid.New().String()[:8],
        MerchantID:    req.MerchantID,
        OrderID:       req.OrderID,
        OrderName:     req.OrderName,
        Amount:        req.Amount,
        Currency:      req.Currency,
        CustomerEmail: req.CustomerEmail,
        CustomerName:  req.CustomerName,
        ReturnUrl:     req.ReturnUrl,
        CancelUrl:     req.CancelUrl,
        Status:        CheckoutSessionStatusPending,
        Metadata:      req.Metadata,
        ExpiresAt:     time.Now().Add(time.Duration(expiresIn) * time.Second),
        CreatedAt:     time.Now(),
    }

    // 3. Checkout URL 생성
    session.CheckoutUrl = fmt.Sprintf("%s/checkout/%s", s.config.BaseURL, session.ID)

    s.mu.Lock()
    s.checkoutSessions[session.ID] = session
    s.mu.Unlock()

    return session, nil
}
```

### ProcessCheckoutPayment

```go
func (s *PaymentService) ProcessCheckoutPayment(sessionID string, card CardDetails) (*Payment, error) {
    s.mu.Lock()
    session, exists := s.checkoutSessions[sessionID]
    if !exists {
        s.mu.Unlock()
        return nil, ErrSessionNotFound
    }

    // 만료 확인
    if time.Now().After(session.ExpiresAt) {
        session.Status = CheckoutSessionStatusExpired
        s.mu.Unlock()
        return nil, ErrSessionExpired
    }

    // 이미 완료 확인
    if session.Status != CheckoutSessionStatusPending {
        s.mu.Unlock()
        return nil, ErrSessionAlreadyProcessed
    }
    s.mu.Unlock()

    // 결제 생성 (기존 로직 활용)
    payment, err := s.CreatePayment(CreatePaymentRequest{
        MerchantID: session.MerchantID,
        OrderID:    session.OrderID,
        Amount:     session.Amount,
        Currency:   session.Currency,
        Method:     PaymentMethodCard,
        Card:       &card,
        ReturnUrl:  session.ReturnUrl,
        CancelUrl:  session.CancelUrl,
    })

    if err != nil {
        return nil, err
    }

    // 세션 업데이트
    s.mu.Lock()
    if payment.Status == PaymentStatusApproved {
        session.Status = CheckoutSessionStatusCompleted
        now := time.Now()
        session.CompletedAt = &now
    }
    session.PaymentID = payment.ID
    s.mu.Unlock()

    return payment, nil
}
```

## HTML 템플릿

### templates/checkout.html

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제 - {{.session.OrderName}}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 480px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #1a1a1a;
            color: white;
            padding: 24px;
        }
        .header h1 { margin: 0 0 8px; font-size: 18px; }
        .header .amount { font-size: 32px; font-weight: 700; }
        .form { padding: 24px; }
        .field { margin-bottom: 16px; }
        .field label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }
        .field input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
        }
        .row { display: flex; gap: 12px; }
        .row .field { flex: 1; }
        .btn {
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 16px;
        }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-secondary { background: #e5e5e5; color: #333; }
        .btn:hover { opacity: 0.9; }
        .footer { padding: 16px 24px; border-top: 1px solid #eee; text-align: center; }
        .footer a { color: #666; font-size: 14px; }
        .test-info {
            background: #fef3c7;
            padding: 12px;
            margin: 0 24px 16px;
            border-radius: 8px;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.session.OrderName}}</h1>
            <div class="amount">{{.session.Currency}} {{.session.Amount}}</div>
        </div>

        <div class="test-info">
            <strong>테스트 카드:</strong> 4242 4242 4242 4242 / 12/28 / 123
        </div>

        <form class="form" method="POST" action="/checkout/{{.session.ID}}/pay">
            <div class="field">
                <label>카드 번호</label>
                <input type="text" name="cardNumber" placeholder="0000 0000 0000 0000"
                       maxlength="19" required>
            </div>

            <div class="row">
                <div class="field">
                    <label>만료일</label>
                    <input type="text" name="cardExpiry" placeholder="MM/YY"
                           maxlength="5" required>
                </div>
                <div class="field">
                    <label>CVV</label>
                    <input type="text" name="cardCVV" placeholder="123"
                           maxlength="4" required>
                </div>
            </div>

            <div class="field">
                <label>카드 소유자명</label>
                <input type="text" name="cardName"
                       value="{{.session.CustomerName}}" required>
            </div>

            <button type="submit" class="btn btn-primary">
                {{.session.Amount}} 원 결제하기
            </button>
        </form>

        <div class="footer">
            <a href="/checkout/{{.session.ID}}/cancel">결제 취소</a>
        </div>
    </div>
</body>
</html>
```

## 핸들러

```go
func (h *PaymentHandler) HandleCheckoutPage(c *gin.Context) {
    sessionID := c.Param("sessionId")

    session, err := h.service.GetCheckoutSession(sessionID)
    if err != nil {
        c.HTML(http.StatusNotFound, "error.html", gin.H{
            "message": "결제 세션을 찾을 수 없습니다",
        })
        return
    }

    if session.Status == CheckoutSessionStatusExpired {
        c.HTML(http.StatusGone, "error.html", gin.H{
            "message": "결제 세션이 만료되었습니다",
        })
        return
    }

    c.HTML(http.StatusOK, "checkout.html", gin.H{
        "session": session,
    })
}

func (h *PaymentHandler) HandleCheckoutPay(c *gin.Context) {
    sessionID := c.Param("sessionId")

    // 폼 데이터 파싱
    cardNumber := c.PostForm("cardNumber")
    cardExpiry := c.PostForm("cardExpiry")
    cardCVV := c.PostForm("cardCVV")
    cardName := c.PostForm("cardName")

    // 만료일 파싱 (MM/YY)
    parts := strings.Split(cardExpiry, "/")
    if len(parts) != 2 {
        c.HTML(http.StatusBadRequest, "error.html", gin.H{
            "message": "잘못된 만료일 형식입니다",
        })
        return
    }

    card := CardDetails{
        Number:   strings.ReplaceAll(cardNumber, " ", ""),
        ExpMonth: parts[0],
        ExpYear:  parts[1],
        CVV:      cardCVV,
        Name:     cardName,
    }

    payment, err := h.service.ProcessCheckoutPayment(sessionID, card)
    if err != nil {
        // 에러 처리
        c.HTML(http.StatusBadRequest, "error.html", gin.H{
            "message": err.Error(),
        })
        return
    }

    // 3DS 필요 시
    if payment.Status == PaymentStatusRequires3DS {
        c.Redirect(http.StatusFound, payment.ThreeDSecure.AuthenticationURL)
        return
    }

    // 결과 페이지로
    c.Redirect(http.StatusFound, fmt.Sprintf("/api/v1/payments/%s/result", payment.ID))
}

func (h *PaymentHandler) HandleCheckoutCancel(c *gin.Context) {
    sessionID := c.Param("sessionId")

    session, _ := h.service.GetCheckoutSession(sessionID)
    if session != nil {
        session.Status = CheckoutSessionStatusCancelled

        if session.CancelUrl != "" {
            c.Redirect(http.StatusFound, session.CancelUrl)
            return
        }
    }

    c.HTML(http.StatusOK, "cancelled.html", nil)
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/payment.go` | CheckoutSession, CreateCheckoutSessionRequest 추가 |
| `internal/service/payment.go` | CreateCheckoutSession(), ProcessCheckoutPayment() 추가 |
| `internal/handler/payment.go` | 핸들러 5개 추가 |
| `templates/checkout.html` | 새 파일 |
| `templates/cancelled.html` | 새 파일 |
| `cmd/main.go` | 라우트 등록 |

## 라우트 추가

```go
// API
v1.POST("/checkout-sessions", handler.HandleCreateCheckoutSession)
v1.GET("/checkout-sessions/:id", handler.HandleGetCheckoutSession)

// Checkout 페이지 (HTML)
router.GET("/checkout/:sessionId", handler.HandleCheckoutPage)
router.POST("/checkout/:sessionId/pay", handler.HandleCheckoutPay)
router.POST("/checkout/:sessionId/cancel", handler.HandleCheckoutCancel)
```

## Onramp 연동 예시

```go
// onramp-simulator에서 호출
func (s *OnRampService) createCardPayment(order *Order) error {
    // 1. Checkout Session 생성
    resp, err := http.Post(
        s.config.PGSimulatorURL + "/api/v1/checkout-sessions",
        "application/json",
        sessionRequestBody,
    )

    var session CheckoutSession
    json.NewDecoder(resp.Body).Decode(&session)

    // 2. 사용자를 결제 페이지로 리다이렉트 (또는 URL 반환)
    order.PaymentUrl = session.CheckoutUrl

    // 3. 웹훅으로 결과 수신 대기
    // ...
}
```

## 테스트 케이스

1. 세션 생성 - 정상
2. 세션 조회 - 정상
3. 결제 페이지 접근 - HTML 렌더링
4. 결제 실행 - 성공
5. 결제 실행 - 카드 검증 실패
6. 결제 실행 - 3DS 필요 시 리다이렉트
7. 만료된 세션 결제 시도 - 에러
8. 이미 완료된 세션 재결제 시도 - 에러
9. 결제 취소 - cancelUrl로 리다이렉트
10. 웹훅 발송 확인
