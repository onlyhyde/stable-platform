# 지원 자산/네트워크 조회 API

## 개요

Onramp 서비스가 지원하는 암호화폐, 법정화폐, 블록체인 네트워크 정보를 조회하는 API를 추가합니다.

**우선순위**: P1
**의존성**: 없음
**영향**: 클라이언트 UI, 주문 유효성 검증

## 현재 상태

- `cryptoCurrency`, `chainId` 필드 존재
- 지원되는 자산/네트워크 목록 조회 API 없음
- 유효성 검증 없음

> **공통 타입 참조**: 체인 ID(`ChainID`), 자산 타입(`CryptoAssetType`), 법정화폐(`FiatCurrency`) 등의 기본 타입은
> [공통 타입 문서](../../common/types.md)에 정의되어 있습니다.
> 이 문서의 데이터 모델은 공통 타입을 재사용하며, API 응답에 필요한 추가 필드만 확장합니다.

## API 설계

### GET /api/v1/supported-assets

**설명**: 지원 암호화폐 목록 조회

**응답**:
```json
{
  "assets": [
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "type": "stablecoin",
      "decimals": 6,
      "iconUrl": "https://example.com/icons/usdc.png",
      "supportedChains": [1, 137, 42161, 10, 8453],
      "minAmount": "10.00",
      "maxAmount": "100000.00"
    },
    {
      "symbol": "USDT",
      "name": "Tether USD",
      "type": "stablecoin",
      "decimals": 6,
      "iconUrl": "https://example.com/icons/usdt.png",
      "supportedChains": [1, 137, 42161],
      "minAmount": "10.00",
      "maxAmount": "100000.00"
    },
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "type": "native",
      "decimals": 18,
      "iconUrl": "https://example.com/icons/eth.png",
      "supportedChains": [1, 42161, 10, 8453],
      "minAmount": "0.01",
      "maxAmount": "100.00"
    }
  ]
}
```

---

### GET /api/v1/supported-chains

**설명**: 지원 블록체인 네트워크 목록 조회

**응답**:
```json
{
  "chains": [
    {
      "id": 1,
      "name": "Ethereum Mainnet",
      "shortName": "ETH",
      "iconUrl": "https://example.com/icons/ethereum.png",
      "explorerUrl": "https://etherscan.io",
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "supportedAssets": ["USDC", "USDT", "ETH"],
      "estimatedTime": "15 minutes",
      "networkFee": "5.00"
    },
    {
      "id": 137,
      "name": "Polygon",
      "shortName": "MATIC",
      "iconUrl": "https://example.com/icons/polygon.png",
      "explorerUrl": "https://polygonscan.com",
      "nativeCurrency": {
        "symbol": "MATIC",
        "decimals": 18
      },
      "supportedAssets": ["USDC", "USDT"],
      "estimatedTime": "5 minutes",
      "networkFee": "0.50"
    },
    {
      "id": 42161,
      "name": "Arbitrum One",
      "shortName": "ARB",
      "iconUrl": "https://example.com/icons/arbitrum.png",
      "explorerUrl": "https://arbiscan.io",
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "supportedAssets": ["USDC", "USDT", "ETH"],
      "estimatedTime": "5 minutes",
      "networkFee": "1.00"
    },
    {
      "id": 10,
      "name": "Optimism",
      "shortName": "OP",
      "iconUrl": "https://example.com/icons/optimism.png",
      "explorerUrl": "https://optimistic.etherscan.io",
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "supportedAssets": ["USDC", "ETH"],
      "estimatedTime": "5 minutes",
      "networkFee": "1.00"
    },
    {
      "id": 8453,
      "name": "Base",
      "shortName": "BASE",
      "iconUrl": "https://example.com/icons/base.png",
      "explorerUrl": "https://basescan.org",
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "supportedAssets": ["USDC", "ETH"],
      "estimatedTime": "5 minutes",
      "networkFee": "0.50"
    }
  ]
}
```

---

### GET /api/v1/supported-fiat

**설명**: 지원 법정화폐 목록 조회

**응답**:
```json
{
  "currencies": [
    {
      "code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "minAmount": "10.00",
      "maxAmount": "100000.00",
      "paymentMethods": ["card", "bank_transfer", "apple_pay", "google_pay"]
    },
    {
      "code": "EUR",
      "name": "Euro",
      "symbol": "€",
      "minAmount": "10.00",
      "maxAmount": "100000.00",
      "paymentMethods": ["card", "bank_transfer"]
    },
    {
      "code": "KRW",
      "name": "Korean Won",
      "symbol": "₩",
      "minAmount": "10000",
      "maxAmount": "100000000",
      "paymentMethods": ["card", "bank_transfer"]
    }
  ]
}
```

---

### GET /api/v1/supported-pairs

**설명**: 지원 거래쌍 목록 조회

**Query Parameters**:
| 파라미터 | 설명 |
|----------|------|
| fiat | 법정화폐 필터 (예: USD) |
| crypto | 암호화폐 필터 (예: USDC) |
| chainId | 체인 ID 필터 (예: 1) |

**응답**:
```json
{
  "pairs": [
    {
      "fiatCurrency": "USD",
      "cryptoCurrency": "USDC",
      "chainId": 1,
      "chainName": "Ethereum Mainnet",
      "exchangeRate": "0.998",
      "feePercent": "1.5",
      "minFiatAmount": "10.00",
      "maxFiatAmount": "100000.00",
      "estimatedTime": "15 minutes"
    },
    {
      "fiatCurrency": "USD",
      "cryptoCurrency": "USDC",
      "chainId": 137,
      "chainName": "Polygon",
      "exchangeRate": "0.998",
      "feePercent": "1.0",
      "minFiatAmount": "10.00",
      "maxFiatAmount": "100000.00",
      "estimatedTime": "5 minutes"
    }
  ]
}
```

## 데이터 모델

### SupportedAsset

> `CryptoAssetType`, `ChainID`는 [공통 타입](../../common/types.md)에서 가져옵니다.

```go
// CryptoAssetType, ChainID → common/types.md 참조

type SupportedAsset struct {
    Symbol          string          `json:"symbol"`
    Name            string          `json:"name"`
    Type            CryptoAssetType `json:"type"`            // common/types.md
    Decimals        int             `json:"decimals"`
    IconUrl         string          `json:"iconUrl,omitempty"`
    SupportedChains []ChainID       `json:"supportedChains"` // common/types.md
    MinAmount       string          `json:"minAmount"`
    MaxAmount       string          `json:"maxAmount"`
}
```

### SupportedChain

> 기본 체인 정보(`ChainInfo`)는 [공통 타입](../../common/types.md)의 `SupportedChains` 맵에서 참조합니다.
> API 응답에 필요한 추가 필드(`IconUrl`, `SupportedAssets`)만 확장합니다.

```go
// ChainInfo → common/types.md 참조

type SupportedChain struct {
    ID              ChainID  `json:"id"`              // common/types.md
    Name            string   `json:"name"`            // ChainInfo.Name
    ShortName       string   `json:"shortName"`       // ChainInfo.ShortName
    IconUrl         string   `json:"iconUrl,omitempty"`
    ExplorerUrl     string   `json:"explorerUrl"`     // ChainInfo.ExplorerURL
    NativeCurrency  NativeCurrency `json:"nativeCurrency"` // ChainInfo.NativeSymbol + NativeDecimals
    SupportedAssets []string `json:"supportedAssets"`  // 이 체인이 지원하는 자산 목록
    EstimatedTime   string   `json:"estimatedTime"`   // ChainInfo.EstimatedTime
    NetworkFee      string   `json:"networkFee"`      // ChainInfo.NetworkFee
}

type NativeCurrency struct {
    Symbol   string `json:"symbol"`
    Decimals int    `json:"decimals"`
}
```

### SupportedFiat

```go
type SupportedFiat struct {
    Code           string   `json:"code"`
    Name           string   `json:"name"`
    Symbol         string   `json:"symbol"`
    MinAmount      string   `json:"minAmount"`
    MaxAmount      string   `json:"maxAmount"`
    PaymentMethods []string `json:"paymentMethods"`
}
```

### TradingPair

```go
type TradingPair struct {
    FiatCurrency    string `json:"fiatCurrency"`
    CryptoCurrency  string `json:"cryptoCurrency"`
    ChainID         int    `json:"chainId"`
    ChainName       string `json:"chainName"`
    ExchangeRate    string `json:"exchangeRate"`
    FeePercent      string `json:"feePercent"`
    MinFiatAmount   string `json:"minFiatAmount"`
    MaxFiatAmount   string `json:"maxFiatAmount"`
    EstimatedTime   string `json:"estimatedTime"`
}
```

## 서비스 로직

### 데이터 초기화

```go
func initSupportedData() {
    // 자산 정의 - ChainID 상수는 common/types.md 참조
    SupportedAssets = []SupportedAsset{
        {
            Symbol:          "USDC",
            Name:            "USD Coin",
            Type:            AssetTypeStablecoin,
            Decimals:        6,
            SupportedChains: []ChainID{ChainEthereum, ChainPolygon, ChainArbitrum, ChainOptimism, ChainBase},
            MinAmount:       "10.00",
            MaxAmount:       "100000.00",
        },
        {
            Symbol:          "USDT",
            Name:            "Tether USD",
            Type:            AssetTypeStablecoin,
            Decimals:        6,
            SupportedChains: []ChainID{ChainEthereum, ChainPolygon, ChainArbitrum},
            MinAmount:       "10.00",
            MaxAmount:       "100000.00",
        },
        {
            Symbol:          "ETH",
            Name:            "Ethereum",
            Type:            AssetTypeNative,
            Decimals:        18,
            SupportedChains: []ChainID{ChainEthereum, ChainArbitrum, ChainOptimism, ChainBase},
            MinAmount:       "0.01",
            MaxAmount:       "100.00",
        },
    }

    // 체인 정의 - common/types.md의 SupportedChains 맵에서 기본 정보를 가져옴
    // SupportedAssets, IconUrl 등 API 응답 전용 필드만 추가
    initChains := func() []SupportedChain {
        var chains []SupportedChain
        for _, chainID := range []ChainID{ChainEthereum, ChainPolygon, ChainArbitrum, ChainOptimism, ChainBase} {
            info := common.SupportedChains[chainID] // common/types.md 참조
            chains = append(chains, SupportedChain{
                ID:        chainID,
                Name:      info.Name,
                ShortName: info.ShortName,
                ExplorerUrl:    info.ExplorerURL,
                NativeCurrency: NativeCurrency{Symbol: info.NativeSymbol, Decimals: info.NativeDecimals},
                EstimatedTime:  info.EstimatedTime,
                NetworkFee:     info.NetworkFee,
                SupportedAssets: getAssetsForChain(chainID),
            })
        }
        return chains
    }
    SupportedChainList = initChains()
}

// 특정 체인에서 지원하는 자산 목록을 반환
func getAssetsForChain(chainID ChainID) []string {
    var assets []string
    for _, asset := range SupportedAssets {
        for _, cid := range asset.SupportedChains {
            if cid == chainID {
                assets = append(assets, asset.Symbol)
                break
            }
        }
    }
    return assets
}
```

### 유효성 검증 추가

```go
func (s *OnRampService) validateAssetAndChain(cryptoCurrency string, chainId ChainID) error {
    // 체인 지원 확인 - common/types.md의 SupportedChains 맵 활용
    if _, ok := common.SupportedChains[chainId]; !ok {
        return ErrUnsupportedChain
    }

    // 자산 지원 확인
    asset := s.findAsset(cryptoCurrency)
    if asset == nil {
        return ErrUnsupportedAsset
    }

    // 해당 자산이 해당 체인 지원하는지 확인
    supported := false
    for _, cid := range asset.SupportedChains {
        if cid == chainId {
            supported = true
            break
        }
    }

    if !supported {
        return ErrUnsupportedChainForAsset
    }

    return nil
}

// CreateOrder에서 호출
func (s *OnRampService) CreateOrder(req CreateOrderRequest) (*Order, error) {
    // 자산/체인 유효성 검증
    if err := s.validateAssetAndChain(req.CryptoCurrency, req.ChainID); err != nil {
        return nil, err
    }

    // ... 나머지 로직
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/order.go` | SupportedAsset, SupportedChain, SupportedFiat, TradingPair 추가 |
| `internal/service/onramp.go` | GetSupportedAssets(), validateAssetAndChain() 추가 |
| `internal/handler/onramp.go` | 핸들러 추가 |
| `cmd/main.go` | 라우트 등록, 데이터 초기화 |

## 라우트 추가

```go
v1.GET("/supported-assets", handler.HandleGetSupportedAssets)
v1.GET("/supported-chains", handler.HandleGetSupportedChains)
v1.GET("/supported-fiat", handler.HandleGetSupportedFiat)
v1.GET("/supported-pairs", handler.HandleGetSupportedPairs)
```

## 테스트 케이스

1. 지원 자산 조회 - 정상
2. 지원 체인 조회 - 정상
3. 지원 법정화폐 조회 - 정상
4. 거래쌍 조회 - 전체
5. 거래쌍 조회 - fiat 필터
6. 거래쌍 조회 - crypto 필터
7. 거래쌍 조회 - chainId 필터
8. 주문 생성 - 지원하지 않는 자산
9. 주문 생성 - 지원하지 않는 체인
10. 주문 생성 - 해당 체인에서 지원하지 않는 자산
