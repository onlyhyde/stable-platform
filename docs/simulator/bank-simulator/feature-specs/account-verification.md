# 계좌 인증 API

## 개요

외부 서비스(PG, Onramp)가 은행 계좌의 유효성을 확인할 수 있는 API를 추가합니다.

**우선순위**: P0
**의존성**: 없음
**영향**: pg-simulator (bank_transfer), onramp-simulator (bank_transfer)

## 현재 상태

- 계좌 조회 API만 존재 (`GET /api/v1/accounts/{accountNo}`)
- 계좌 존재 여부 확인 가능
- 실명 확인, 1원 인증 등 미지원

## 요구사항

### 기능 요구사항

1. **계좌 유효성 확인**: 계좌번호와 예금주명 일치 확인
2. **1원 인증 시작**: 1원을 입금하고 입금자명에 인증코드 포함
3. **1원 인증 확인**: 사용자가 입력한 인증코드 검증
4. 동결/해지 계좌는 인증 실패

### 비기능 요구사항

- 인증 코드는 4자리 숫자
- 인증 유효 시간 5분
- 최대 3회 시도 가능

## API 설계

### POST /api/v1/accounts/verify

**설명**: 계좌 유효성 및 예금주명 확인

**요청**:
```json
{
  "accountNo": "BANK1234567890",
  "holderName": "홍길동"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| accountNo | string | ✅ | 계좌번호 |
| holderName | string | ✅ | 예금주명 |

**응답 (200)** - 일치:
```json
{
  "verified": true,
  "accountNo": "BANK1234567890",
  "maskedName": "홍*동",
  "status": "active"
}
```

**응답 (200)** - 불일치:
```json
{
  "verified": false,
  "reason": "name_mismatch"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | account_not_found | 계좌 없음 |
| 400 | account_unavailable | 동결/해지 계좌 |

---

### POST /api/v1/accounts/verify/initiate

**설명**: 1원 인증 시작 (1원 입금 + 인증코드 생성)

**요청**:
```json
{
  "accountNo": "BANK1234567890"
}
```

**응답 (200)**:
```json
{
  "verificationId": "verify_uuid",
  "accountNo": "BANK1234567890",
  "amount": "1",
  "depositorName": "인증1234",
  "expiresAt": "2026-01-27T10:05:00Z",
  "attemptsRemaining": 3
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | account_not_found | 계좌 없음 |
| 400 | account_unavailable | 동결/해지 계좌 |

---

### POST /api/v1/accounts/verify/complete

**설명**: 1원 인증 완료 (인증코드 확인)

**요청**:
```json
{
  "verificationId": "verify_uuid",
  "code": "1234"
}
```

**응답 (200)** - 성공:
```json
{
  "verified": true,
  "verificationId": "verify_uuid",
  "accountNo": "BANK1234567890"
}
```

**응답 (200)** - 실패:
```json
{
  "verified": false,
  "reason": "invalid_code",
  "attemptsRemaining": 2
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | verification_not_found | 인증 요청 없음 |
| 400 | verification_expired | 인증 만료 |
| 400 | max_attempts_exceeded | 시도 횟수 초과 |

## 데이터 모델

### Verification (신규)

```go
type VerificationStatus string

const (
    VerificationStatusPending   VerificationStatus = "pending"
    VerificationStatusVerified  VerificationStatus = "verified"
    VerificationStatusExpired   VerificationStatus = "expired"
    VerificationStatusFailed    VerificationStatus = "failed"
)

type Verification struct {
    ID          string             `json:"id"`
    AccountNo   string             `json:"accountNo"`
    Code        string             `json:"-"`  // 내부용, 응답에 포함 안함
    Status      VerificationStatus `json:"status"`
    Attempts    int                `json:"attempts"`
    MaxAttempts int                `json:"maxAttempts"`
    ExpiresAt   time.Time          `json:"expiresAt"`
    CreatedAt   time.Time          `json:"createdAt"`
    VerifiedAt  *time.Time         `json:"verifiedAt,omitempty"`
}
```

### Request/Response 모델

```go
type VerifyAccountRequest struct {
    AccountNo   string `json:"accountNo" binding:"required"`
    HolderName  string `json:"holderName" binding:"required"`
}

type VerifyAccountResponse struct {
    Verified   bool   `json:"verified"`
    AccountNo  string `json:"accountNo,omitempty"`
    MaskedName string `json:"maskedName,omitempty"`
    Status     string `json:"status,omitempty"`
    Reason     string `json:"reason,omitempty"`
}

type InitiateVerificationRequest struct {
    AccountNo string `json:"accountNo" binding:"required"`
}

type InitiateVerificationResponse struct {
    VerificationID    string    `json:"verificationId"`
    AccountNo         string    `json:"accountNo"`
    Amount            string    `json:"amount"`
    DepositorName     string    `json:"depositorName"`
    ExpiresAt         time.Time `json:"expiresAt"`
    AttemptsRemaining int       `json:"attemptsRemaining"`
}

type CompleteVerificationRequest struct {
    VerificationID string `json:"verificationId" binding:"required"`
    Code           string `json:"code" binding:"required"`
}

type CompleteVerificationResponse struct {
    Verified          bool   `json:"verified"`
    VerificationID    string `json:"verificationId"`
    AccountNo         string `json:"accountNo,omitempty"`
    Reason            string `json:"reason,omitempty"`
    AttemptsRemaining int    `json:"attemptsRemaining,omitempty"`
}
```

## 서비스 로직

### VerifyAccount (예금주 확인)

```go
func (s *BankService) VerifyAccount(req VerifyAccountRequest) (*VerifyAccountResponse, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    account, exists := s.accounts[req.AccountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    if account.Status != AccountStatusActive {
        return nil, ErrAccountUnavailable
    }

    // 이름 비교 (공백 제거 후 비교)
    normalizedInput := strings.ReplaceAll(req.HolderName, " ", "")
    normalizedAccount := strings.ReplaceAll(account.Name, " ", "")

    if normalizedInput == normalizedAccount {
        return &VerifyAccountResponse{
            Verified:   true,
            AccountNo:  account.AccountNo,
            MaskedName: maskName(account.Name),
            Status:     string(account.Status),
        }, nil
    }

    return &VerifyAccountResponse{
        Verified: false,
        Reason:   "name_mismatch",
    }, nil
}

func maskName(name string) string {
    runes := []rune(name)
    if len(runes) <= 1 {
        return name
    }
    if len(runes) == 2 {
        return string(runes[0]) + "*"
    }
    // 첫 글자 + * + 마지막 글자
    masked := string(runes[0])
    for i := 1; i < len(runes)-1; i++ {
        masked += "*"
    }
    masked += string(runes[len(runes)-1])
    return masked
}
```

### InitiateVerification (1원 인증 시작)

```go
func (s *BankService) InitiateVerification(req InitiateVerificationRequest) (*InitiateVerificationResponse, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    account, exists := s.accounts[req.AccountNo]
    if !exists {
        return nil, ErrAccountNotFound
    }

    if account.Status != AccountStatusActive {
        return nil, ErrAccountUnavailable
    }

    // 4자리 랜덤 코드 생성
    code := fmt.Sprintf("%04d", rand.Intn(10000))

    verification := &Verification{
        ID:          uuid.New().String(),
        AccountNo:   req.AccountNo,
        Code:        code,
        Status:      VerificationStatusPending,
        Attempts:    0,
        MaxAttempts: 3,
        ExpiresAt:   time.Now().Add(5 * time.Minute),
        CreatedAt:   time.Now(),
    }

    s.verifications[verification.ID] = verification

    // 1원 입금 (내부 트랜잭션)
    depositorName := "인증" + code

    return &InitiateVerificationResponse{
        VerificationID:    verification.ID,
        AccountNo:         req.AccountNo,
        Amount:            "1",
        DepositorName:     depositorName,
        ExpiresAt:         verification.ExpiresAt,
        AttemptsRemaining: verification.MaxAttempts,
    }, nil
}
```

### CompleteVerification (1원 인증 완료)

```go
func (s *BankService) CompleteVerification(req CompleteVerificationRequest) (*CompleteVerificationResponse, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    verification, exists := s.verifications[req.VerificationID]
    if !exists {
        return nil, ErrVerificationNotFound
    }

    // 만료 확인
    if time.Now().After(verification.ExpiresAt) {
        verification.Status = VerificationStatusExpired
        return nil, ErrVerificationExpired
    }

    // 시도 횟수 확인
    if verification.Attempts >= verification.MaxAttempts {
        verification.Status = VerificationStatusFailed
        return nil, ErrMaxAttemptsExceeded
    }

    verification.Attempts++

    // 코드 확인
    if req.Code == verification.Code {
        verification.Status = VerificationStatusVerified
        now := time.Now()
        verification.VerifiedAt = &now

        return &CompleteVerificationResponse{
            Verified:       true,
            VerificationID: verification.ID,
            AccountNo:      verification.AccountNo,
        }, nil
    }

    attemptsRemaining := verification.MaxAttempts - verification.Attempts

    return &CompleteVerificationResponse{
        Verified:          false,
        VerificationID:    verification.ID,
        Reason:            "invalid_code",
        AttemptsRemaining: attemptsRemaining,
    }, nil
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/account.go` | Verification 및 Request/Response 모델 추가 |
| `internal/service/bank.go` | VerifyAccount(), InitiateVerification(), CompleteVerification() 추가, verifications map 추가 |
| `internal/handler/bank.go` | 3개 핸들러 추가 |
| `cmd/main.go` | 라우트 등록 |

## 테스트 케이스

1. 예금주명 일치 - verified: true
2. 예금주명 불일치 - verified: false, reason: name_mismatch
3. 존재하지 않는 계좌 - 404
4. 동결 계좌 - 400 account_unavailable
5. 1원 인증 시작 - 정상 응답
6. 1원 인증 완료 - 올바른 코드
7. 1원 인증 완료 - 잘못된 코드
8. 1원 인증 - 만료 후 시도
9. 1원 인증 - 3회 초과 시도
10. 이름 마스킹 확인 (홍길동 → 홍*동)
