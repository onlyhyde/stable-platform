# 월렛 주소 검증

## 개요

암호화폐 지갑 주소의 유효성을 검증합니다.

**우선순위**: P2
**의존성**: supported-assets (지원 체인 목록)
**영향**: 주문 생성

## 현재 상태

- `walletAddress` 필드 존재
- 유효성 검증 없음 (빈 문자열도 가능)

## 목표

- EVM 주소 형식 검증
- 체인별 주소 형식 검증 (추후 비EVM 체인 지원 시)
- Checksum 검증 (EIP-55)

## 검증 규칙

### EVM 주소 (Ethereum, Polygon, Arbitrum, Optimism, Base)

1. **형식**: `0x` + 40자리 16진수
2. **길이**: 42자
3. **문자**: 0-9, a-f, A-F
4. **Checksum**: EIP-55 (선택적, 경고만 표시)

### 예시

**유효한 주소**:
- `0x1234567890123456789012345678901234567890`
- `0xAbCdEf1234567890AbCdEf1234567890AbCdEf12` (mixed case OK)

**유효하지 않은 주소**:
- `1234567890123456789012345678901234567890` (0x 누락)
- `0x123` (너무 짧음)
- `0x1234567890123456789012345678901234567890g` (잘못된 문자)

## API 영향

### 주문 생성 시 검증

**POST /api/v1/orders**

잘못된 주소로 요청 시:
```json
{
  "error": "invalid_wallet_address",
  "message": "Wallet address must be a valid EVM address (0x + 40 hex characters)"
}
```

### 주소 검증 엔드포인트 (선택)

**POST /api/v1/wallets/validate**

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "chainId": 1
}
```

**응답**:
```json
{
  "valid": true,
  "address": "0x1234567890123456789012345678901234567890",
  "checksumAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 1,
  "chainName": "Ethereum Mainnet",
  "warnings": []
}
```

**경고 예시**:
```json
{
  "valid": true,
  "address": "0x1234567890123456789012345678901234567890",
  "warnings": [
    "Address checksum does not match. Please verify the address is correct."
  ]
}
```

## 데이터 모델

### ValidationResult

```go
type WalletValidationResult struct {
    Valid           bool     `json:"valid"`
    Address         string   `json:"address"`
    ChecksumAddress string   `json:"checksumAddress,omitempty"`
    ChainID         int      `json:"chainId"`
    ChainName       string   `json:"chainName"`
    Warnings        []string `json:"warnings,omitempty"`
    Error           string   `json:"error,omitempty"`
}
```

## 서비스 로직

### ValidateEVMAddress

```go
import (
    "encoding/hex"
    "regexp"
    "strings"

    "golang.org/x/crypto/sha3"
)

var evmAddressRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

func ValidateEVMAddress(address string) (bool, string, []string) {
    var warnings []string

    // 1. 기본 형식 검증
    if !evmAddressRegex.MatchString(address) {
        return false, "", nil
    }

    // 2. Checksum 계산 (EIP-55)
    checksumAddress := ToChecksumAddress(address)

    // 3. Checksum 경고 (mixed case인 경우에만)
    if hasMixedCase(address) && address != checksumAddress {
        warnings = append(warnings, "Address checksum does not match. Please verify the address is correct.")
    }

    return true, checksumAddress, warnings
}

func hasMixedCase(address string) bool {
    hexPart := address[2:]
    hasLower := strings.ContainsAny(hexPart, "abcdef")
    hasUpper := strings.ContainsAny(hexPart, "ABCDEF")
    return hasLower && hasUpper
}

func ToChecksumAddress(address string) string {
    // 소문자로 변환
    address = strings.ToLower(address)
    hexPart := address[2:]

    // Keccak256 해시 계산
    hash := sha3.NewLegacyKeccak256()
    hash.Write([]byte(hexPart))
    hashBytes := hash.Sum(nil)
    hashHex := hex.EncodeToString(hashBytes)

    // Checksum 적용
    result := "0x"
    for i, c := range hexPart {
        if c >= 'a' && c <= 'f' {
            // 해시의 해당 위치 값이 8 이상이면 대문자
            if hashHex[i] >= '8' {
                result += strings.ToUpper(string(c))
            } else {
                result += string(c)
            }
        } else {
            result += string(c)
        }
    }

    return result
}
```

### 주문 생성에 검증 추가

```go
func (s *OnRampService) CreateOrder(req CreateOrderRequest) (*Order, error) {
    // 1. 월렛 주소 검증
    valid, checksumAddress, warnings := ValidateEVMAddress(req.WalletAddress)
    if !valid {
        return nil, ErrInvalidWalletAddress
    }

    // 경고가 있으면 로그에 기록
    if len(warnings) > 0 {
        log.Printf("Wallet address warnings for order: %v", warnings)
    }

    // Checksum 주소로 정규화
    req.WalletAddress = checksumAddress

    // 2. 나머지 주문 생성 로직...
}
```

### 검증 핸들러

```go
func (h *OnRampHandler) HandleValidateWallet(c *gin.Context) {
    var req struct {
        Address string `json:"address" binding:"required"`
        ChainID int    `json:"chainId" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
        return
    }

    // 체인 지원 여부 확인
    chain := h.service.GetChain(req.ChainID)
    if chain == nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "valid": false,
            "error": "unsupported chain",
        })
        return
    }

    // EVM 체인인지 확인 (현재 모든 지원 체인이 EVM)
    valid, checksumAddress, warnings := ValidateEVMAddress(req.Address)

    c.JSON(http.StatusOK, WalletValidationResult{
        Valid:           valid,
        Address:         req.Address,
        ChecksumAddress: checksumAddress,
        ChainID:         req.ChainID,
        ChainName:       chain.Name,
        Warnings:        warnings,
    })
}
```

## 에러 코드

```go
var (
    ErrInvalidWalletAddress = errors.New("invalid wallet address format")
    ErrUnsupportedChain     = errors.New("unsupported chain")
)
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/service/wallet_validator.go` | 새 파일 - 월렛 주소 검증 |
| `internal/service/onramp.go` | CreateOrder()에 검증 추가 |
| `internal/handler/onramp.go` | HandleValidateWallet() 추가 |
| `cmd/main.go` | 라우트 등록 |
| `go.mod` | golang.org/x/crypto 의존성 추가 |

## 라우트 추가

```go
v1.POST("/wallets/validate", handler.HandleValidateWallet)
```

## 테스트 케이스

1. 유효한 주소 (소문자) - valid: true
2. 유효한 주소 (대문자) - valid: true
3. 유효한 주소 (올바른 checksum) - valid: true, 경고 없음
4. 유효한 주소 (잘못된 checksum) - valid: true, 경고 있음
5. 0x 누락 - valid: false
6. 길이 부족 - valid: false
7. 잘못된 문자 포함 - valid: false
8. 빈 문자열 - valid: false
9. 지원하지 않는 체인 - 에러
10. 주문 생성 시 잘못된 주소 - 에러
11. 주문 생성 시 주소 정규화 확인
