# Wallet 결제 플로우

## 개요

간편결제(Wallet) 방식의 결제 플로우를 구현합니다. 사전 등록된 결제수단으로 원터치 결제를 시뮬레이션합니다.

**우선순위**: P0
**의존성**: 없음
**영향**: 간편결제 시나리오 테스트

## 현재 상태

- `PaymentMethodWallet` enum 존재
- 실제 지갑 결제 로직 없음
- 카드 결제와 동일하게 처리됨

## 목표

간편결제 서비스(카카오페이, 네이버페이 등)의 결제 플로우를 시뮬레이션:

1. 사용자가 지갑에 결제수단 등록 (PoC에서는 시뮬레이션)
2. 결제 시 지갑 ID로 원터치 결제
3. 별도의 카드 정보 입력 불필요

## API 설계

### 지갑 등록 (신규)

**POST /api/v1/wallets**

```json
{
  "userId": "USER_001",
  "name": "내 카카오페이",
  "type": "kakao",
  "defaultCard": {
    "number": "4242424242424242",
    "expMonth": "12",
    "expYear": "28",
    "cvv": "123",
    "name": "홍길동"
  }
}
```

**응답**:
```json
{
  "id": "wallet_uuid",
  "userId": "USER_001",
  "name": "내 카카오페이",
  "type": "kakao",
  "cardLast4": "4242",
  "cardBrand": "visa",
  "status": "active",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

### 지갑 목록 조회

**GET /api/v1/users/{userId}/wallets**

```json
{
  "wallets": [
    {
      "id": "wallet_uuid",
      "name": "내 카카오페이",
      "type": "kakao",
      "cardLast4": "4242",
      "cardBrand": "visa",
      "status": "active"
    }
  ]
}
```

### 지갑 결제

**POST /api/v1/payments** (기존 확장)

```json
{
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "amount": "30000",
  "currency": "KRW",
  "method": "wallet",
  "walletId": "wallet_uuid"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| walletId | string | ✅ (wallet 시) | 등록된 지갑 ID |

**응답**:
```json
{
  "id": "pay_uuid",
  "merchantId": "MERCHANT_001",
  "orderId": "ORDER_12345",
  "amount": "30000",
  "currency": "KRW",
  "method": "wallet",
  "status": "approved",
  "walletId": "wallet_uuid",
  "walletType": "kakao",
  "cardLast4": "4242",
  "cardBrand": "visa",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

## 데이터 모델

### Wallet (신규)

```go
type WalletType string

const (
    WalletTypeKakao  WalletType = "kakao"
    WalletTypeNaver  WalletType = "naver"
    WalletTypeToss   WalletType = "toss"
    WalletTypePayco  WalletType = "payco"
    WalletTypeCustom WalletType = "custom"
)

type WalletStatus string

const (
    WalletStatusActive   WalletStatus = "active"
    WalletStatusInactive WalletStatus = "inactive"
)

type Wallet struct {
    ID         string       `json:"id"`
    UserID     string       `json:"userId"`
    Name       string       `json:"name"`
    Type       WalletType   `json:"type"`
    CardLast4  string       `json:"cardLast4"`
    CardBrand  string       `json:"cardBrand"`
    Status     WalletStatus `json:"status"`
    // 내부용 (응답에 포함 안 함)
    CardNumber string       `json:"-"`
    CardExpiry string       `json:"-"`
    CardCVV    string       `json:"-"`
    CardName   string       `json:"-"`
    CreatedAt  time.Time    `json:"createdAt"`
    UpdatedAt  time.Time    `json:"updatedAt"`
}
```

### Request 모델

```go
type CreateWalletRequest struct {
    UserID      string        `json:"userId" binding:"required"`
    Name        string        `json:"name" binding:"required"`
    Type        WalletType    `json:"type" binding:"required"`
    DefaultCard *CardDetails  `json:"defaultCard" binding:"required"`
}

// CreatePaymentRequest 확장
type CreatePaymentRequest struct {
    // 기존 필드들...
    WalletID string `json:"walletId,omitempty"`
}

// Payment 확장
type Payment struct {
    // 기존 필드들...
    WalletID   string     `json:"walletId,omitempty"`
    WalletType WalletType `json:"walletType,omitempty"`
}
```

## 서비스 로직

### CreateWallet

```go
func (s *PaymentService) CreateWallet(req CreateWalletRequest) (*Wallet, error) {
    // 1. 카드 유효성 검증
    if err := validateCard(req.DefaultCard); err != nil {
        return nil, err
    }

    // 2. 카드 정보 추출
    cardBrand := detectCardBrand(req.DefaultCard.Number)
    cardLast4 := req.DefaultCard.Number[len(req.DefaultCard.Number)-4:]

    // 3. 지갑 생성
    wallet := &Wallet{
        ID:         uuid.New().String(),
        UserID:     req.UserID,
        Name:       req.Name,
        Type:       req.Type,
        CardLast4:  cardLast4,
        CardBrand:  cardBrand,
        CardNumber: req.DefaultCard.Number,
        CardExpiry: fmt.Sprintf("%s/%s", req.DefaultCard.ExpMonth, req.DefaultCard.ExpYear),
        CardCVV:    req.DefaultCard.CVV,
        CardName:   req.DefaultCard.Name,
        Status:     WalletStatusActive,
        CreatedAt:  time.Now(),
        UpdatedAt:  time.Now(),
    }

    s.mu.Lock()
    s.wallets[wallet.ID] = wallet
    s.mu.Unlock()

    log.Printf("Wallet created: %s (type: %s)", wallet.ID, wallet.Type)

    return wallet, nil
}
```

### processWalletPayment

```go
func (s *PaymentService) processWalletPayment(req CreatePaymentRequest) (*Payment, error) {
    // 1. 지갑 ID 검증
    if req.WalletID == "" {
        return nil, ErrWalletIDRequired
    }

    // 2. 지갑 조회
    s.mu.RLock()
    wallet, exists := s.wallets[req.WalletID]
    s.mu.RUnlock()

    if !exists {
        return nil, ErrWalletNotFound
    }

    if wallet.Status != WalletStatusActive {
        return nil, ErrWalletInactive
    }

    // 3. 결제 레코드 생성
    payment := &Payment{
        ID:         uuid.New().String(),
        MerchantID: req.MerchantID,
        OrderID:    req.OrderID,
        Amount:     req.Amount,
        Currency:   req.Currency,
        Method:     PaymentMethodWallet,
        WalletID:   wallet.ID,
        WalletType: wallet.Type,
        CardLast4:  wallet.CardLast4,
        CardBrand:  wallet.CardBrand,
        Status:     PaymentStatusPending,
        CreatedAt:  time.Now(),
        UpdatedAt:  time.Now(),
    }

    // 4. 결제 처리 (내부 카드로 결제)
    // 지갑에 저장된 카드 정보로 카드 결제 처리
    cardPaymentSuccess := s.simulateCardPayment(wallet)

    if cardPaymentSuccess {
        payment.Status = PaymentStatusApproved
        go s.sendWebhook("payment.approved", payment)
    } else {
        payment.Status = PaymentStatusDeclined
        payment.FailureReason = s.getRandomDeclineReason()
        go s.sendWebhook("payment.declined", payment)
    }

    s.mu.Lock()
    s.payments[payment.ID] = payment
    s.mu.Unlock()

    return payment, nil
}

func (s *PaymentService) simulateCardPayment(wallet *Wallet) bool {
    // 설정된 성공률에 따라 결과 결정
    return rand.Intn(100) < s.config.SuccessRate
}
```

### CreatePayment 수정

```go
func (s *PaymentService) CreatePayment(req CreatePaymentRequest) (*Payment, error) {
    switch req.Method {
    case PaymentMethodCard:
        return s.processCardPayment(req)
    case PaymentMethodBank:
        return s.processBankTransfer(req)
    case PaymentMethodWallet:
        return s.processWalletPayment(req)
    default:
        return nil, ErrUnsupportedPaymentMethod
    }
}
```

## 에러 코드

```go
var (
    ErrWalletIDRequired         = errors.New("wallet ID required for wallet payment")
    ErrWalletNotFound           = errors.New("wallet not found")
    ErrWalletInactive           = errors.New("wallet is inactive")
    ErrUnsupportedPaymentMethod = errors.New("unsupported payment method")
)
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/payment.go` | Wallet, WalletType, CreateWalletRequest 추가, Payment 확장 |
| `internal/service/payment.go` | CreateWallet(), processWalletPayment() 추가, wallets map 추가 |
| `internal/handler/payment.go` | HandleCreateWallet(), HandleGetWallets() 추가 |
| `cmd/main.go` | 라우트 등록 |

## 라우트 추가

```go
// cmd/main.go
v1 := router.Group("/api/v1")
{
    // 기존 라우트들...

    // 지갑 관련
    v1.POST("/wallets", handler.HandleCreateWallet)
    v1.GET("/users/:userId/wallets", handler.HandleGetWallets)
    v1.DELETE("/wallets/:id", handler.HandleDeleteWallet)
}
```

## 테스트 케이스

1. 지갑 생성 - 정상
2. 지갑 생성 - 잘못된 카드 정보
3. 지갑 목록 조회 - 정상
4. 지갑 결제 - 성공
5. 지갑 결제 - 존재하지 않는 지갑
6. 지갑 결제 - 비활성 지갑
7. walletId 없이 wallet 결제 요청 - 에러
8. 결제 조회 시 walletType 포함 확인
9. 카드 정보는 응답에서 마스킹
10. 웹훅 발송 확인
