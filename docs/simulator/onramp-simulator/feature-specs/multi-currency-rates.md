# 다중 환율 지원

## 개요

여러 법정화폐와 암호화폐 간의 환율을 지원합니다.

**우선순위**: P1
**의존성**: supported-assets (지원 자산 목록)
**영향**: 견적 계산, 주문 생성

## 현재 상태

- `USD_TO_USDC` 환경변수 하나만 지원
- USD → USDC 단일 페어만 가능

> **공통 타입 참조**: `ChainID` 상수 및 체인 정보는 [공통 타입 문서](../../common/types.md)에 정의되어 있습니다.
> 수수료 체계의 체인별 수수료는 공통 `ChainID` 타입을 사용합니다.

## 목표

여러 통화 페어 지원:
- USD → USDC, USDT, ETH
- EUR → USDC, USDT, ETH
- KRW → USDC, USDT, ETH

## API 설계

### GET /api/v1/rates

**설명**: 현재 환율 목록 조회

**Query Parameters**:
| 파라미터 | 설명 |
|----------|------|
| fiat | 법정화폐 필터 |
| crypto | 암호화폐 필터 |

**응답**:
```json
{
  "rates": [
    {
      "fiatCurrency": "USD",
      "cryptoCurrency": "USDC",
      "rate": "0.998",
      "buyRate": "0.995",
      "sellRate": "1.001",
      "updatedAt": "2026-01-27T10:00:00Z"
    },
    {
      "fiatCurrency": "USD",
      "cryptoCurrency": "USDT",
      "rate": "0.999",
      "buyRate": "0.996",
      "sellRate": "1.002",
      "updatedAt": "2026-01-27T10:00:00Z"
    },
    {
      "fiatCurrency": "USD",
      "cryptoCurrency": "ETH",
      "rate": "0.00031",
      "buyRate": "0.00030",
      "sellRate": "0.00032",
      "updatedAt": "2026-01-27T10:00:00Z"
    },
    {
      "fiatCurrency": "EUR",
      "cryptoCurrency": "USDC",
      "rate": "1.085",
      "buyRate": "1.080",
      "sellRate": "1.090",
      "updatedAt": "2026-01-27T10:00:00Z"
    },
    {
      "fiatCurrency": "KRW",
      "cryptoCurrency": "USDC",
      "rate": "0.00075",
      "buyRate": "0.00074",
      "sellRate": "0.00076",
      "updatedAt": "2026-01-27T10:00:00Z"
    }
  ],
  "lastUpdated": "2026-01-27T10:00:00Z"
}
```

---

### GET /api/v1/rates/{fiat}/{crypto}

**설명**: 특정 통화쌍 환율 조회

**응답**:
```json
{
  "fiatCurrency": "USD",
  "cryptoCurrency": "USDC",
  "rate": "0.998",
  "buyRate": "0.995",
  "sellRate": "1.001",
  "change24h": "-0.1",
  "high24h": "1.001",
  "low24h": "0.996",
  "updatedAt": "2026-01-27T10:00:00Z"
}
```

## 데이터 모델

### ExchangeRate

```go
type ExchangeRate struct {
    FiatCurrency   string    `json:"fiatCurrency"`
    CryptoCurrency string    `json:"cryptoCurrency"`
    Rate           string    `json:"rate"`      // 중간 환율
    BuyRate        string    `json:"buyRate"`   // 사용자가 살 때 (Onramp)
    SellRate       string    `json:"sellRate"`  // 사용자가 팔 때 (Offramp)
    Change24h      string    `json:"change24h,omitempty"`
    High24h        string    `json:"high24h,omitempty"`
    Low24h         string    `json:"low24h,omitempty"`
    UpdatedAt      time.Time `json:"updatedAt"`
}
```

### RateConfig

```go
type RateConfig struct {
    BaseRates   map[string]map[string]string // [fiat][crypto] = rate
    Spreads     map[string]string            // [crypto] = spread %
    UpdateInterval time.Duration
}
```

## 환경 변수

기존 단일 환율 대신 다중 환율 설정:

```bash
# 기본 환율 (JSON 형식)
EXCHANGE_RATES='{
  "USD": {"USDC": "0.998", "USDT": "0.999", "ETH": "0.00031"},
  "EUR": {"USDC": "1.085", "USDT": "1.086", "ETH": "0.00034"},
  "KRW": {"USDC": "0.00075", "USDT": "0.00075", "ETH": "0.00000023"}
}'

# 스프레드 (%)
RATE_SPREAD_USDC=0.3
RATE_SPREAD_USDT=0.3
RATE_SPREAD_ETH=0.5

# 환율 변동 시뮬레이션 (%)
RATE_VOLATILITY=0.1
```

## 서비스 로직

### 환율 관리

```go
type RateManager struct {
    rates      map[string]map[string]*ExchangeRate
    spreads    map[string]float64
    volatility float64
    mu         sync.RWMutex
}

func NewRateManager(config *Config) *RateManager {
    rm := &RateManager{
        rates:      make(map[string]map[string]*ExchangeRate),
        spreads:    config.Spreads,
        volatility: config.RateVolatility,
    }

    // 기본 환율 로드
    rm.loadBaseRates(config.BaseRates)

    // 환율 변동 시뮬레이션 (선택적)
    if rm.volatility > 0 {
        go rm.simulateRateChanges()
    }

    return rm
}

func (rm *RateManager) GetRate(fiat, crypto string) (*ExchangeRate, error) {
    rm.mu.RLock()
    defer rm.mu.RUnlock()

    if fiatRates, ok := rm.rates[fiat]; ok {
        if rate, ok := fiatRates[crypto]; ok {
            return rate, nil
        }
    }

    return nil, ErrRateNotFound
}

func (rm *RateManager) GetAllRates() []*ExchangeRate {
    rm.mu.RLock()
    defer rm.mu.RUnlock()

    var rates []*ExchangeRate
    for _, fiatRates := range rm.rates {
        for _, rate := range fiatRates {
            rates = append(rates, rate)
        }
    }
    return rates
}
```

### 환율 변동 시뮬레이션

```go
func (rm *RateManager) simulateRateChanges() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for range ticker.C {
        rm.mu.Lock()
        for _, fiatRates := range rm.rates {
            for _, rate := range fiatRates {
                // 작은 랜덤 변동 적용
                rm.applyVolatility(rate)
            }
        }
        rm.mu.Unlock()
    }
}

func (rm *RateManager) applyVolatility(rate *ExchangeRate) {
    baseRate, _, _ := big.ParseFloat(rate.Rate, 10, 128, big.ToNearestEven)

    // 랜덤 변동 (-volatility% ~ +volatility%)
    change := (rand.Float64()*2 - 1) * rm.volatility / 100
    changeFloat := new(big.Float).SetFloat64(change)
    adjustment := new(big.Float).Mul(baseRate, changeFloat)
    newRate := new(big.Float).Add(baseRate, adjustment)

    rate.Rate = newRate.Text('f', 8)

    // 스프레드 적용
    spread := rm.spreads[rate.CryptoCurrency]
    spreadFloat := new(big.Float).SetFloat64(spread / 100)

    buyAdjustment := new(big.Float).Mul(newRate, spreadFloat)
    sellAdjustment := new(big.Float).Mul(newRate, spreadFloat)

    rate.BuyRate = new(big.Float).Sub(newRate, buyAdjustment).Text('f', 8)
    rate.SellRate = new(big.Float).Add(newRate, sellAdjustment).Text('f', 8)
    rate.UpdatedAt = time.Now()
}
```

### 견적 계산 수정

```go
func (s *OnRampService) GetQuote(req QuoteRequest) (*QuoteResponse, error) {
    // 1. 환율 조회
    rate, err := s.rateManager.GetRate(req.FiatCurrency, req.CryptoCurrency)
    if err != nil {
        return nil, ErrUnsupportedPair
    }

    // 2. 견적 계산
    fiatAmount, _, _ := big.ParseFloat(req.FiatAmount, 10, 128, big.ToNearestEven)

    // 수수료 계산 (1.5%)
    feeRate := new(big.Float).SetFloat64(0.015)
    fee := new(big.Float).Mul(fiatAmount, feeRate)
    netAmount := new(big.Float).Sub(fiatAmount, fee)

    // 환율 적용 (BuyRate 사용 - 사용자가 구매)
    buyRate, _, _ := big.ParseFloat(rate.BuyRate, 10, 128, big.ToNearestEven)
    cryptoAmount := new(big.Float).Mul(netAmount, buyRate)

    return &QuoteResponse{
        FiatAmount:     req.FiatAmount,
        FiatCurrency:   req.FiatCurrency,
        CryptoAmount:   cryptoAmount.Text('f', 8),
        CryptoCurrency: req.CryptoCurrency,
        ExchangeRate:   rate.BuyRate,
        Fee:            fee.Text('f', 2),
        FeePercent:     "1.5",
        ExpiresAt:      time.Now().Add(5 * time.Minute),
    }, nil
}
```

## 수수료 체계

체인별로 다른 수수료 적용:

```go
// ChainID, PaymentMethod → common/types.md 참조

type FeeStructure struct {
    BaseFeePercent     string                   // 기본 수수료 (1.5%)
    ChainFees          map[ChainID]string       // 체인별 추가 수수료 (common/types.md)
    PaymentMethodFees  map[PaymentMethod]string // 결제 수단별 추가 수수료 (common/types.md)
}

var DefaultFees = FeeStructure{
    BaseFeePercent: "1.5",
    ChainFees: map[ChainID]string{
        ChainEthereum: "0.5",  // Ethereum: +0.5%
        ChainPolygon:  "0.0",  // Polygon: +0%
        ChainArbitrum: "0.2",  // Arbitrum: +0.2%
        ChainOptimism: "0.2",  // Optimism: +0.2%
        ChainBase:     "0.0",  // Base: +0%
    },
    PaymentMethodFees: map[PaymentMethod]string{
        PaymentMethodCard:         "0.5",  // 카드: +0.5%
        PaymentMethodBankTransfer: "0.0",  // 은행: +0%
        PaymentMethodApplePay:     "0.3",  // Apple Pay: +0.3%
        PaymentMethodGooglePay:    "0.3",  // Google Pay: +0.3%
    },
}

func (s *OnRampService) calculateTotalFee(
    amount string,
    chainId ChainID,         // common/types.md
    paymentMethod PaymentMethod, // common/types.md
) string {
    amountVal, _, _ := big.ParseFloat(amount, 10, 128, big.ToNearestEven)

    baseFee, _ := new(big.Float).SetString(DefaultFees.BaseFeePercent)
    chainFee, _ := new(big.Float).SetString(DefaultFees.ChainFees[chainId])
    methodFee, _ := new(big.Float).SetString(DefaultFees.PaymentMethodFees[paymentMethod])

    totalFeePercent := new(big.Float).Add(baseFee, chainFee)
    totalFeePercent = new(big.Float).Add(totalFeePercent, methodFee)

    // 100으로 나누어 실제 비율로 변환
    hundred := new(big.Float).SetFloat64(100)
    feeRate := new(big.Float).Quo(totalFeePercent, hundred)

    fee := new(big.Float).Mul(amountVal, feeRate)
    return fee.Text('f', 2)
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/order.go` | ExchangeRate, FeeStructure 추가 |
| `internal/config/config.go` | 환율 관련 환경변수 추가 |
| `internal/service/rate_manager.go` | 새 파일 - 환율 관리 |
| `internal/service/onramp.go` | GetQuote() 수정, calculateTotalFee() 추가 |
| `internal/handler/onramp.go` | 핸들러 추가 |
| `cmd/main.go` | RateManager 초기화, 라우트 등록 |

## 라우트 추가

```go
v1.GET("/rates", handler.HandleGetRates)
v1.GET("/rates/:fiat/:crypto", handler.HandleGetRate)
```

## 테스트 케이스

1. 전체 환율 조회 - 정상
2. fiat 필터 환율 조회 - 정상
3. crypto 필터 환율 조회 - 정상
4. 특정 통화쌍 환율 조회 - 정상
5. 지원하지 않는 통화쌍 - 에러
6. 견적 계산 - USD/USDC
7. 견적 계산 - EUR/USDC
8. 견적 계산 - KRW/ETH
9. 체인별 수수료 차이 확인
10. 결제 수단별 수수료 차이 확인
11. 환율 변동 시뮬레이션 확인
