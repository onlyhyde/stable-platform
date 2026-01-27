# 공통 타입 정의

## 개요

모든 시뮬레이터에서 공유하는 공통 타입을 정의합니다.

## 금액 처리

### Amount 타입

모든 금액은 `string` 타입으로 처리합니다 (정밀도 보장).

```go
// Amount는 항상 string으로 표현
// 내부 계산은 big.Float 사용
type Amount = string

// 금액 파싱 예시
func ParseAmount(s string) (*big.Float, error) {
    f, _, err := big.ParseFloat(s, 10, 128, big.ToNearestEven)
    if err != nil {
        return nil, fmt.Errorf("invalid amount format: %s", s)
    }
    return f, nil
}

// 금액 포맷팅 예시
func FormatAmount(f *big.Float, decimals int) string {
    return f.Text('f', decimals)
}
```

## 결제 수단

### PaymentMethod

```go
type PaymentMethod string

const (
    PaymentMethodCard         PaymentMethod = "card"
    PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
    PaymentMethodWallet       PaymentMethod = "wallet"
    PaymentMethodApplePay     PaymentMethod = "apple_pay"
    PaymentMethodGooglePay    PaymentMethod = "google_pay"
)

// 서비스별 지원 결제 수단
var SupportedPaymentMethods = map[string][]PaymentMethod{
    "bank":   {PaymentMethodBankTransfer},
    "pg":     {PaymentMethodCard, PaymentMethodBankTransfer, PaymentMethodWallet},
    "onramp": {PaymentMethodCard, PaymentMethodBankTransfer, PaymentMethodApplePay, PaymentMethodGooglePay},
}
```

## 체인 정보

### ChainID

```go
type ChainID int

const (
    ChainEthereum ChainID = 1
    ChainPolygon  ChainID = 137
    ChainArbitrum ChainID = 42161
    ChainOptimism ChainID = 10
    ChainBase     ChainID = 8453
)

type ChainInfo struct {
    ID             ChainID `json:"id"`
    Name           string  `json:"name"`
    ShortName      string  `json:"shortName"`
    ExplorerURL    string  `json:"explorerUrl"`
    NativeSymbol   string  `json:"nativeSymbol"`
    NativeDecimals int     `json:"nativeDecimals"`
    EstimatedTime  string  `json:"estimatedTime"`
    NetworkFee     string  `json:"networkFee"`
}

var SupportedChains = map[ChainID]ChainInfo{
    ChainEthereum: {
        ID:             ChainEthereum,
        Name:           "Ethereum Mainnet",
        ShortName:      "ETH",
        ExplorerURL:    "https://etherscan.io",
        NativeSymbol:   "ETH",
        NativeDecimals: 18,
        EstimatedTime:  "15 minutes",
        NetworkFee:     "5.00",
    },
    ChainPolygon: {
        ID:             ChainPolygon,
        Name:           "Polygon",
        ShortName:      "MATIC",
        ExplorerURL:    "https://polygonscan.com",
        NativeSymbol:   "MATIC",
        NativeDecimals: 18,
        EstimatedTime:  "5 minutes",
        NetworkFee:     "0.50",
    },
    ChainArbitrum: {
        ID:             ChainArbitrum,
        Name:           "Arbitrum One",
        ShortName:      "ARB",
        ExplorerURL:    "https://arbiscan.io",
        NativeSymbol:   "ETH",
        NativeDecimals: 18,
        EstimatedTime:  "5 minutes",
        NetworkFee:     "1.00",
    },
    ChainOptimism: {
        ID:             ChainOptimism,
        Name:           "Optimism",
        ShortName:      "OP",
        ExplorerURL:    "https://optimistic.etherscan.io",
        NativeSymbol:   "ETH",
        NativeDecimals: 18,
        EstimatedTime:  "5 minutes",
        NetworkFee:     "1.00",
    },
    ChainBase: {
        ID:             ChainBase,
        Name:           "Base",
        ShortName:      "BASE",
        ExplorerURL:    "https://basescan.org",
        NativeSymbol:   "ETH",
        NativeDecimals: 18,
        EstimatedTime:  "5 minutes",
        NetworkFee:     "0.50",
    },
}
```

## 통화 코드

### FiatCurrency

```go
type FiatCurrency string

const (
    FiatUSD FiatCurrency = "USD"
    FiatEUR FiatCurrency = "EUR"
    FiatKRW FiatCurrency = "KRW"
)

type FiatCurrencyInfo struct {
    Code      FiatCurrency `json:"code"`
    Name      string       `json:"name"`
    Symbol    string       `json:"symbol"`
    Decimals  int          `json:"decimals"`
    MinAmount string       `json:"minAmount"`
    MaxAmount string       `json:"maxAmount"`
}

var SupportedFiatCurrencies = map[FiatCurrency]FiatCurrencyInfo{
    FiatUSD: {Code: FiatUSD, Name: "US Dollar", Symbol: "$", Decimals: 2, MinAmount: "10.00", MaxAmount: "100000.00"},
    FiatEUR: {Code: FiatEUR, Name: "Euro", Symbol: "€", Decimals: 2, MinAmount: "10.00", MaxAmount: "100000.00"},
    FiatKRW: {Code: FiatKRW, Name: "Korean Won", Symbol: "₩", Decimals: 0, MinAmount: "10000", MaxAmount: "100000000"},
}
```

### CryptoCurrency

```go
type CryptoCurrency string

const (
    CryptoUSDC CryptoCurrency = "USDC"
    CryptoUSDT CryptoCurrency = "USDT"
    CryptoETH  CryptoCurrency = "ETH"
)

type CryptoAssetType string

const (
    AssetTypeNative     CryptoAssetType = "native"
    AssetTypeStablecoin CryptoAssetType = "stablecoin"
    AssetTypeToken      CryptoAssetType = "token"
)

type CryptoAssetInfo struct {
    Symbol          CryptoCurrency  `json:"symbol"`
    Name            string          `json:"name"`
    Type            CryptoAssetType `json:"type"`
    Decimals        int             `json:"decimals"`
    SupportedChains []ChainID       `json:"supportedChains"`
    MinAmount       string          `json:"minAmount"`
    MaxAmount       string          `json:"maxAmount"`
}

var SupportedCryptoAssets = map[CryptoCurrency]CryptoAssetInfo{
    CryptoUSDC: {
        Symbol:          CryptoUSDC,
        Name:            "USD Coin",
        Type:            AssetTypeStablecoin,
        Decimals:        6,
        SupportedChains: []ChainID{ChainEthereum, ChainPolygon, ChainArbitrum, ChainOptimism, ChainBase},
        MinAmount:       "10.00",
        MaxAmount:       "100000.00",
    },
    CryptoUSDT: {
        Symbol:          CryptoUSDT,
        Name:            "Tether USD",
        Type:            AssetTypeStablecoin,
        Decimals:        6,
        SupportedChains: []ChainID{ChainEthereum, ChainPolygon, ChainArbitrum},
        MinAmount:       "10.00",
        MaxAmount:       "100000.00",
    },
    CryptoETH: {
        Symbol:          CryptoETH,
        Name:            "Ethereum",
        Type:            AssetTypeNative,
        Decimals:        18,
        SupportedChains: []ChainID{ChainEthereum, ChainArbitrum, ChainOptimism, ChainBase},
        MinAmount:       "0.01",
        MaxAmount:       "100.00",
    },
}
```

## 타임스탬프

### 표준 시간 형식

```go
// 모든 API 응답의 시간은 RFC3339 형식 사용
// 예: "2026-01-27T10:00:00Z"

import "time"

func FormatTimestamp(t time.Time) string {
    return t.UTC().Format(time.RFC3339)
}

func ParseTimestamp(s string) (time.Time, error) {
    return time.Parse(time.RFC3339, s)
}
```

## ID 생성

### UUID 형식

```go
import "github.com/google/uuid"

// 모든 리소스 ID는 UUID v4 형식
func GenerateID() string {
    return uuid.New().String()
}

// 예: "550e8400-e29b-41d4-a716-446655440000"
```

## 환경변수 네이밍 규칙

### 서비스별 Prefix

```bash
# Bank Simulator
BANK_PORT=4350
BANK_WEBHOOK_SECRET=bank_webhook_secret_key
BANK_RATE_LIMIT=100

# PG Simulator
PG_PORT=4351
PG_WEBHOOK_SECRET=pg_webhook_secret_key
PG_RATE_LIMIT=100

# Onramp Simulator
ONRAMP_PORT=4352
ONRAMP_WEBHOOK_SECRET=onramp_webhook_secret_key
ONRAMP_RATE_LIMIT=100

# 공통
LOG_LEVEL=info
LOG_FORMAT=json
```

## 에러 응답 형식

### 표준 에러 응답

```go
type ErrorResponse struct {
    Error   string            `json:"error"`            // 에러 코드
    Message string            `json:"message"`          // 사용자 친화적 메시지
    Details map[string]string `json:"details,omitempty"` // 추가 정보
}

// 예시
{
    "error": "insufficient_balance",
    "message": "Account balance is insufficient for this transaction",
    "details": {
        "available": "100.00",
        "requested": "150.00"
    }
}
```

### 공통 에러 코드

| 에러 코드 | HTTP 상태 | 설명 |
|-----------|-----------|------|
| `invalid_request` | 400 | 잘못된 요청 형식 |
| `validation_error` | 400 | 입력값 검증 실패 |
| `not_found` | 404 | 리소스를 찾을 수 없음 |
| `rate_limit_exceeded` | 429 | 요청 한도 초과 |
| `internal_error` | 500 | 내부 서버 오류 |
