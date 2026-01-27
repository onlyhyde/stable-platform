# Return URL / Cancel URL

## 개요

결제 완료/취소 시 가맹점으로 redirect하는 기능을 추가합니다.

**우선순위**: P1
**의존성**: 없음
**영향**: onramp-simulator (카드 결제 후 복귀)

## 현재 상태

- 3DS challenge 페이지만 있음
- 결제 완료 후 가맹점으로 돌아가는 redirect 없음
- API 응답으로만 결과 전달

## 목표

실제 PG처럼 결제 완료/취소 시 가맹점 URL로 redirect:

```
사용자 → PG 결제 페이지 → 결제 처리 → 가맹점 returnUrl
                                    ↳ 취소 시 cancelUrl
```

## API 설계

### 결제 생성 확장

**CreatePaymentRequest에 URL 추가** (이미 bank-transfer-flow.md에서 정의):

```json
{
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "amount": "30000",
  "currency": "KRW",
  "method": "card",
  "card": { ... },
  "returnUrl": "https://shop.example.com/payment/complete",
  "cancelUrl": "https://shop.example.com/payment/cancel"
}
```

### 결제 결과 페이지 (신규)

**GET /api/v1/payments/{id}/result**

결제 완료 후 사용자가 보는 결과 페이지. 자동으로 returnUrl/cancelUrl로 redirect.

**HTML 응답**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>결제 완료</title>
    <meta http-equiv="refresh" content="3;url={{.RedirectURL}}">
</head>
<body>
    <h1>결제가 완료되었습니다</h1>
    <p>잠시 후 자동으로 이동합니다.</p>
    <p>자동으로 이동하지 않으면 <a href="{{.RedirectURL}}">여기</a>를 클릭하세요.</p>
</body>
</html>
```

### Redirect URL 파라미터

returnUrl로 redirect 시 결제 정보를 query parameter로 전달:

**성공 시**:
```
https://shop.example.com/payment/complete
  ?paymentId=pay_uuid
  &orderId=ORDER_12345
  &status=approved
  &amount=30000
  &signature=<HMAC>
```

**실패 시**:
```
https://shop.example.com/payment/complete
  ?paymentId=pay_uuid
  &orderId=ORDER_12345
  &status=declined
  &reason=insufficient_funds
  &signature=<HMAC>
```

**취소 시**:
```
https://shop.example.com/payment/cancel
  ?paymentId=pay_uuid
  &orderId=ORDER_12345
  &status=cancelled
  &signature=<HMAC>
```

## 데이터 모델

### Payment 확장

```go
type Payment struct {
    // 기존 필드들...
    ReturnUrl string `json:"returnUrl,omitempty"`
    CancelUrl string `json:"cancelUrl,omitempty"`
}
```

### Redirect 파라미터

```go
type RedirectParams struct {
    PaymentID string `json:"paymentId"`
    OrderID   string `json:"orderId"`
    Status    string `json:"status"`
    Amount    string `json:"amount,omitempty"`
    Reason    string `json:"reason,omitempty"`
    Signature string `json:"signature"`
}
```

## 서비스 로직

### generateRedirectURL

```go
func (s *PaymentService) generateRedirectURL(payment *Payment) string {
    var baseURL string
    var params url.Values

    switch payment.Status {
    case PaymentStatusApproved:
        baseURL = payment.ReturnUrl
        params = url.Values{
            "paymentId": {payment.ID},
            "orderId":   {payment.OrderID},
            "status":    {"approved"},
            "amount":    {payment.Amount},
        }
    case PaymentStatusDeclined:
        baseURL = payment.ReturnUrl
        params = url.Values{
            "paymentId": {payment.ID},
            "orderId":   {payment.OrderID},
            "status":    {"declined"},
            "reason":    {payment.FailureReason},
        }
    case PaymentStatusCancelled:
        baseURL = payment.CancelUrl
        if baseURL == "" {
            baseURL = payment.ReturnUrl
        }
        params = url.Values{
            "paymentId": {payment.ID},
            "orderId":   {payment.OrderID},
            "status":    {"cancelled"},
        }
    default:
        return ""
    }

    if baseURL == "" {
        return ""
    }

    // HMAC 서명 생성
    signData := fmt.Sprintf("%s:%s:%s", payment.ID, payment.OrderID, payment.Status)
    signature := computeHMAC(signData, s.config.WebhookSecret)
    params.Set("signature", signature)

    // URL 조합
    u, _ := url.Parse(baseURL)
    u.RawQuery = params.Encode()
    return u.String()
}
```

### 결과 페이지 핸들러

```go
func (h *PaymentHandler) HandlePaymentResult(c *gin.Context) {
    paymentID := c.Param("id")

    payment, err := h.service.GetPayment(paymentID)
    if err != nil {
        c.HTML(http.StatusNotFound, "error.html", gin.H{
            "message": "Payment not found",
        })
        return
    }

    redirectURL := h.service.generateRedirectURL(payment)

    // returnUrl이 없으면 결과만 표시
    if redirectURL == "" {
        c.HTML(http.StatusOK, "result.html", gin.H{
            "payment":    payment,
            "autoRedirect": false,
        })
        return
    }

    c.HTML(http.StatusOK, "result.html", gin.H{
        "payment":     payment,
        "redirectURL": redirectURL,
        "autoRedirect": true,
    })
}
```

## 3DS 플로우 통합

3DS 인증 완료 후에도 결과 페이지로 이동:

```go
func (h *PaymentHandler) HandleFinalize3DS(c *gin.Context) {
    // ... 기존 3DS 완료 로직

    // 결과 페이지로 redirect
    c.Redirect(http.StatusFound, fmt.Sprintf("/api/v1/payments/%s/result", payment.ID))
}
```

## HTML 템플릿

### templates/result.html

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제 결과</title>
    {{if .autoRedirect}}
    <meta http-equiv="refresh" content="3;url={{.redirectURL}}">
    {{end}}
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
        }
        .success { color: #22c55e; }
        .failed { color: #ef4444; }
        .cancelled { color: #f59e0b; }
        h1 { margin-bottom: 16px; }
        p { color: #666; margin-bottom: 24px; }
        a { color: #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        {{if eq .payment.Status "approved"}}
            <h1 class="success">✓ 결제 완료</h1>
            <p>결제가 성공적으로 처리되었습니다.</p>
        {{else if eq .payment.Status "declined"}}
            <h1 class="failed">✗ 결제 실패</h1>
            <p>{{.payment.FailureReason}}</p>
        {{else if eq .payment.Status "cancelled"}}
            <h1 class="cancelled">결제 취소</h1>
            <p>결제가 취소되었습니다.</p>
        {{end}}

        {{if .autoRedirect}}
            <p>잠시 후 자동으로 이동합니다...</p>
            <p>자동으로 이동하지 않으면 <a href="{{.redirectURL}}">여기</a>를 클릭하세요.</p>
        {{end}}
    </div>
</body>
</html>
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/payment.go` | CreatePaymentRequest에 ReturnUrl, CancelUrl 추가 |
| `internal/service/payment.go` | generateRedirectURL() 추가 |
| `internal/handler/payment.go` | HandlePaymentResult() 추가 |
| `templates/result.html` | 새 파일 |
| `cmd/main.go` | 라우트 및 템플릿 로딩 |

## 라우트 추가

```go
v1.GET("/payments/:id/result", handler.HandlePaymentResult)
```

## 시그니처 검증 (가맹점 측)

가맹점은 redirect 파라미터의 signature를 검증하여 위변조를 방지:

```javascript
// 가맹점 서버 예시
const crypto = require('crypto');

function verifySignature(params, secret) {
    const { paymentId, orderId, status, signature } = params;
    const signData = `${paymentId}:${orderId}:${status}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(signData)
        .digest('hex');
    return signature === expected;
}
```

## 테스트 케이스

1. 결제 성공 시 returnUrl로 redirect
2. 결제 실패 시 returnUrl로 redirect (status=declined)
3. 결제 취소 시 cancelUrl로 redirect
4. cancelUrl 없으면 returnUrl 사용
5. returnUrl/cancelUrl 모두 없으면 결과 페이지만 표시
6. redirect 파라미터에 signature 포함
7. 3DS 완료 후 결과 페이지로 이동
8. 존재하지 않는 결제 ID - 404
9. 결과 페이지 HTML 렌더링 확인
10. HMAC 서명 검증 확인
