# KYC 플로우 시뮬레이션

## 개요

실제 온램프 서비스의 KYC(Know Your Customer) 인증 플로우를 시뮬레이션합니다.

**우선순위**: P0
**의존성**: 없음
**영향**: 주문 생성, 거래 한도

## 현재 상태

- `KYCStatus` 필드가 Order 모델에 존재
- 항상 `"approved"`로 하드코딩

## 목표

```
사용자              Onramp
  │                  │
  │  KYC 제출        │
  │  (서류 제출)      │
  ├─────────────────▶│
  │  제출 완료        │
  │◀─────────────────┤
  │                  │
  │   (비동기 검증)   │
  │                  │
  │  KYC 완료 알림    │
  │◀─────────────────┤
  │                  │
  │  주문 생성 가능   │
```

## API 설계

### POST /api/v1/kyc/submit

**설명**: KYC 인증 제출

**요청**:
```json
{
  "userId": "USER_001",
  "level": "basic",
  "documents": {
    "idType": "passport",
    "idNumber": "M12345678",
    "fullName": "홍길동",
    "dateOfBirth": "1990-01-15",
    "nationality": "KR",
    "address": {
      "street": "테헤란로 123",
      "city": "서울",
      "country": "KR",
      "postalCode": "06164"
    }
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userId | string | ✅ | 사용자 ID |
| level | string | ✅ | KYC 레벨 (basic, advanced) |
| documents | object | ✅ | 제출 서류 정보 |
| documents.idType | string | ✅ | 신분증 유형 (passport, national_id, driver_license) |
| documents.idNumber | string | ✅ | 신분증 번호 |
| documents.fullName | string | ✅ | 성명 |
| documents.dateOfBirth | string | ✅ | 생년월일 (YYYY-MM-DD) |
| documents.nationality | string | ✅ | 국적 코드 (ISO 3166-1 alpha-2) |
| documents.address | object | ✅ | 주소 |

**응답 (202)**:
```json
{
  "id": "kyc_uuid",
  "userId": "USER_001",
  "level": "basic",
  "status": "pending",
  "estimatedCompletionTime": "2026-01-27T10:05:00Z",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

---

### GET /api/v1/kyc/status/{userId}

**설명**: KYC 인증 상태 조회

**응답**:
```json
{
  "userId": "USER_001",
  "level": "basic",
  "status": "approved",
  "limits": {
    "daily": "1000.00",
    "monthly": "10000.00",
    "perTransaction": "500.00"
  },
  "usage": {
    "dailyUsed": "250.00",
    "monthlyUsed": "1500.00"
  },
  "approvedAt": "2026-01-27T10:05:00Z",
  "expiresAt": "2027-01-27T10:05:00Z"
}
```

**status 값**:
| 상태 | 설명 |
|------|------|
| none | KYC 미제출 |
| pending | 검토 중 |
| approved | 승인됨 |
| rejected | 거절됨 |
| expired | 만료됨 |

---

### GET /api/v1/kyc/requirements

**설명**: KYC 레벨별 요구사항 조회

**응답**:
```json
{
  "levels": {
    "none": {
      "limits": {
        "daily": "0",
        "monthly": "0",
        "perTransaction": "0"
      },
      "requirements": []
    },
    "basic": {
      "limits": {
        "daily": "1000.00",
        "monthly": "10000.00",
        "perTransaction": "500.00"
      },
      "requirements": [
        "id_document",
        "full_name",
        "date_of_birth",
        "address"
      ]
    },
    "advanced": {
      "limits": {
        "daily": "50000.00",
        "monthly": "500000.00",
        "perTransaction": "25000.00"
      },
      "requirements": [
        "id_document",
        "full_name",
        "date_of_birth",
        "address",
        "proof_of_address",
        "selfie_with_id",
        "source_of_funds"
      ]
    }
  }
}
```

## 데이터 모델

### KYCRecord (신규)

```go
type KYCStatus string

const (
    KYCStatusNone     KYCStatus = "none"
    KYCStatusPending  KYCStatus = "pending"
    KYCStatusApproved KYCStatus = "approved"
    KYCStatusRejected KYCStatus = "rejected"
    KYCStatusExpired  KYCStatus = "expired"
)

type KYCLevel string

const (
    KYCLevelNone     KYCLevel = "none"
    KYCLevelBasic    KYCLevel = "basic"
    KYCLevelAdvanced KYCLevel = "advanced"
)

type KYCRecord struct {
    ID           string    `json:"id"`
    UserID       string    `json:"userId"`
    Level        KYCLevel  `json:"level"`
    Status       KYCStatus `json:"status"`
    Documents    *KYCDocuments `json:"documents,omitempty"`
    RejectedReason string  `json:"rejectedReason,omitempty"`
    CreatedAt    time.Time `json:"createdAt"`
    UpdatedAt    time.Time `json:"updatedAt"`
    ApprovedAt   *time.Time `json:"approvedAt,omitempty"`
    ExpiresAt    *time.Time `json:"expiresAt,omitempty"`
}

type KYCDocuments struct {
    IDType      string      `json:"idType"`
    IDNumber    string      `json:"idNumber"`
    FullName    string      `json:"fullName"`
    DateOfBirth string      `json:"dateOfBirth"`
    Nationality string      `json:"nationality"`
    Address     *KYCAddress `json:"address"`
}

type KYCAddress struct {
    Street     string `json:"street"`
    City       string `json:"city"`
    Country    string `json:"country"`
    PostalCode string `json:"postalCode"`
}
```

### KYCLimits

```go
type KYCLimits struct {
    Daily          string `json:"daily"`
    Monthly        string `json:"monthly"`
    PerTransaction string `json:"perTransaction"`
}

type KYCUsage struct {
    DailyUsed   string `json:"dailyUsed"`
    MonthlyUsed string `json:"monthlyUsed"`
}

var KYCLevelLimits = map[KYCLevel]KYCLimits{
    KYCLevelNone: {
        Daily:          "0",
        Monthly:        "0",
        PerTransaction: "0",
    },
    KYCLevelBasic: {
        Daily:          "1000.00",
        Monthly:        "10000.00",
        PerTransaction: "500.00",
    },
    KYCLevelAdvanced: {
        Daily:          "50000.00",
        Monthly:        "500000.00",
        PerTransaction: "25000.00",
    },
}
```

## 서비스 로직

### SubmitKYC

```go
func (s *OnRampService) SubmitKYC(req SubmitKYCRequest) (*KYCRecord, error) {
    // 1. 기존 KYC 확인
    s.mu.RLock()
    existing, exists := s.kycRecords[req.UserID]
    s.mu.RUnlock()

    if exists && existing.Status == KYCStatusPending {
        return nil, ErrKYCAlreadyPending
    }

    // 2. KYC 레코드 생성
    record := &KYCRecord{
        ID:        uuid.New().String(),
        UserID:    req.UserID,
        Level:     req.Level,
        Status:    KYCStatusPending,
        Documents: &req.Documents,
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    s.mu.Lock()
    s.kycRecords[req.UserID] = record
    s.mu.Unlock()

    // 3. 비동기 검증 시뮬레이션
    go s.processKYCVerification(record)

    return record, nil
}
```

### processKYCVerification

```go
func (s *OnRampService) processKYCVerification(record *KYCRecord) {
    // 시뮬레이션 지연 (설정 가능)
    delay := time.Duration(s.config.KYCProcessingTime) * time.Second
    time.Sleep(delay)

    s.mu.Lock()
    defer s.mu.Unlock()

    // 성공률에 따라 결과 결정
    if rand.Intn(100) < s.config.KYCSuccessRate {
        record.Status = KYCStatusApproved
        now := time.Now()
        record.ApprovedAt = &now
        expiresAt := now.AddDate(1, 0, 0) // 1년 후 만료
        record.ExpiresAt = &expiresAt

        go s.sendWebhook("kyc.approved", record)
    } else {
        record.Status = KYCStatusRejected
        record.RejectedReason = s.getRandomRejectionReason()

        go s.sendWebhook("kyc.rejected", record)
    }

    record.UpdatedAt = time.Now()
}

func (s *OnRampService) getRandomRejectionReason() string {
    reasons := []string{
        "document_unclear",
        "document_expired",
        "information_mismatch",
        "suspicious_activity",
        "unsupported_country",
    }
    return reasons[rand.Intn(len(reasons))]
}
```

### GetKYCStatus

```go
func (s *OnRampService) GetKYCStatus(userID string) (*KYCStatusResponse, error) {
    s.mu.RLock()
    record, exists := s.kycRecords[userID]
    s.mu.RUnlock()

    if !exists {
        return &KYCStatusResponse{
            UserID: userID,
            Level:  KYCLevelNone,
            Status: KYCStatusNone,
            Limits: KYCLevelLimits[KYCLevelNone],
        }, nil
    }

    // 만료 확인
    if record.Status == KYCStatusApproved && record.ExpiresAt != nil {
        if time.Now().After(*record.ExpiresAt) {
            record.Status = KYCStatusExpired
        }
    }

    // 사용량 계산
    usage := s.calculateKYCUsage(userID)

    return &KYCStatusResponse{
        UserID:     userID,
        Level:      record.Level,
        Status:     record.Status,
        Limits:     KYCLevelLimits[record.Level],
        Usage:      usage,
        ApprovedAt: record.ApprovedAt,
        ExpiresAt:  record.ExpiresAt,
    }, nil
}
```

### 주문 생성 시 KYC 검증

```go
func (s *OnRampService) CreateOrder(req CreateOrderRequest) (*Order, error) {
    // 1. KYC 상태 확인
    kycStatus, err := s.GetKYCStatus(req.UserID)
    if err != nil {
        return nil, err
    }

    // 2. KYC 미인증 시 거절
    if kycStatus.Status != KYCStatusApproved {
        return &Order{
            ID:            uuid.New().String(),
            UserID:        req.UserID,
            Status:        OrderStatusKYCRequired,
            FailureReason: "kyc_required",
            CreatedAt:     time.Now(),
        }, nil
    }

    // 3. 한도 확인
    if err := s.checkLimits(kycStatus, req.FiatAmount); err != nil {
        return nil, err
    }

    // 4. 기존 주문 생성 로직...
}

func (s *OnRampService) checkLimits(kyc *KYCStatusResponse, amount string) error {
    amountVal, _, _ := big.ParseFloat(amount, 10, 128, big.ToNearestEven)
    perTxLimit, _, _ := big.ParseFloat(kyc.Limits.PerTransaction, 10, 128, big.ToNearestEven)
    dailyLimit, _, _ := big.ParseFloat(kyc.Limits.Daily, 10, 128, big.ToNearestEven)
    dailyUsed, _, _ := big.ParseFloat(kyc.Usage.DailyUsed, 10, 128, big.ToNearestEven)

    // 건당 한도 확인
    if amountVal.Cmp(perTxLimit) > 0 {
        return ErrExceedsTransactionLimit
    }

    // 일일 한도 확인
    newDailyTotal := new(big.Float).Add(dailyUsed, amountVal)
    if newDailyTotal.Cmp(dailyLimit) > 0 {
        return ErrExceedsDailyLimit
    }

    return nil
}
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| KYC_PROCESSING_TIME | 5 | KYC 처리 시뮬레이션 시간 (초) |
| KYC_SUCCESS_RATE | 90 | KYC 승인 성공률 (%) |

## 웹훅 이벤트

> **참고**: 웹훅 페이로드는 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

### kyc.approved
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440010",
  "eventType": "kyc.approved",
  "timestamp": "2026-01-27T10:05:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440010",
  "attemptNumber": 1,
  "source": "onramp",
  "data": {
    "id": "kyc_uuid",
    "userId": "USER_001",
    "level": "basic",
    "status": "approved",
    "limits": {
      "daily": "1000.00",
      "monthly": "10000.00",
      "perTransaction": "500.00"
    }
  }
}
```

### kyc.rejected
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440011",
  "eventType": "kyc.rejected",
  "timestamp": "2026-01-27T10:05:00Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440011",
  "attemptNumber": 1,
  "source": "onramp",
  "data": {
    "id": "kyc_uuid",
    "userId": "USER_001",
    "level": "basic",
    "status": "rejected",
    "reason": "document_unclear"
  }
}
```

## 파일 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `internal/model/order.go` | KYCRecord (RenewalOf 필드 포함), KYCLimits, KYCUsage 추가 |
| `internal/config/config.go` | KYC 관련 환경변수 추가 |
| `internal/service/onramp.go` | SubmitKYC(), RenewKYC(), GetKYCStatus(), checkLimits() 추가 |
| `internal/handler/onramp.go` | 핸들러 추가 (HandleRenewKYC 포함) |
| `cmd/main.go` | 라우트 등록 |

## KYC 갱신 플로우

### POST /api/v1/kyc/renew

**설명**: 만료된 KYC 갱신 요청

**요청**:
```json
{
  "userId": "USER_001"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userId | string | ✅ | 사용자 ID |

**응답 (202)** - 갱신 접수:
```json
{
  "id": "kyc_renew_uuid",
  "userId": "USER_001",
  "level": "basic",
  "status": "pending",
  "renewalOf": "kyc_previous_uuid",
  "estimatedCompletionTime": "2026-01-27T10:05:00Z",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

**에러**:
| 상태 | 코드 | 설명 |
|------|------|------|
| 404 | kyc_not_found | KYC 기록 없음 (신규 제출 필요) |
| 400 | kyc_not_expired | KYC가 아직 만료되지 않음 |
| 400 | kyc_renewal_pending | 갱신이 이미 진행 중 |

### 서비스 로직

```go
func (s *OnRampService) RenewKYC(userID string) (*KYCRecord, error) {
    s.mu.RLock()
    existing, exists := s.kycRecords[userID]
    s.mu.RUnlock()

    // 1. 기존 KYC 확인
    if !exists {
        return nil, ErrKYCNotFound
    }

    // 2. 만료 상태 확인
    if existing.Status == KYCStatusPending {
        return nil, ErrKYCRenewalPending
    }
    if existing.Status == KYCStatusApproved {
        if existing.ExpiresAt != nil && time.Now().Before(*existing.ExpiresAt) {
            return nil, ErrKYCNotExpired
        }
    }

    // 3. 갱신 레코드 생성 (기존 서류 재사용)
    record := &KYCRecord{
        ID:        uuid.New().String(),
        UserID:    userID,
        Level:     existing.Level,
        Status:    KYCStatusPending,
        Documents: existing.Documents, // 기존 서류 재사용
        RenewalOf: existing.ID,
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    s.mu.Lock()
    s.kycRecords[userID] = record
    s.mu.Unlock()

    // 4. 비동기 검증 시뮬레이션 (갱신은 더 빠름)
    go s.processKYCRenewal(record)

    return record, nil
}

func (s *OnRampService) processKYCRenewal(record *KYCRecord) {
    // 갱신은 신규보다 빠르게 처리 (50% 시간)
    delay := time.Duration(s.config.KYCProcessingTime/2) * time.Second
    if delay < time.Second {
        delay = time.Second
    }
    time.Sleep(delay)

    s.mu.Lock()
    defer s.mu.Unlock()

    // 갱신 성공률 (신규보다 높음: 95%)
    if rand.Intn(100) < 95 {
        record.Status = KYCStatusApproved
        now := time.Now()
        record.ApprovedAt = &now
        expiresAt := now.AddDate(1, 0, 0)
        record.ExpiresAt = &expiresAt

        go s.sendWebhook("kyc.renewed", record)
    } else {
        record.Status = KYCStatusRejected
        record.RejectedReason = "renewal_document_review_required"

        go s.sendWebhook("kyc.renewal_rejected", record)
    }

    record.UpdatedAt = time.Now()
}
```

### KYCRecord 확장

```go
type KYCRecord struct {
    // 기존 필드들...
    RenewalOf string `json:"renewalOf,omitempty"` // 갱신 대상 KYC ID
}
```

### 웹훅 이벤트

> **참고**: 웹훅 페이로드는 [공통 웹훅 스펙](../../common/webhook-spec.md)을 따릅니다.

#### kyc.renewed
```json
{
  "version": "1.0",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440012",
  "eventType": "kyc.renewed",
  "timestamp": "2026-01-27T10:02:30Z",
  "deliveryId": "dlv_660e8400-e29b-41d4-a716-446655440012",
  "attemptNumber": 1,
  "source": "onramp",
  "data": {
    "id": "kyc_renew_uuid",
    "userId": "USER_001",
    "level": "basic",
    "status": "approved",
    "renewalOf": "kyc_previous_uuid",
    "expiresAt": "2027-01-27T10:02:30Z"
  }
}
```

---

## 라우트 추가

```go
v1.POST("/kyc/submit", handler.HandleSubmitKYC)
v1.GET("/kyc/status/:userId", handler.HandleGetKYCStatus)
v1.GET("/kyc/requirements", handler.HandleGetKYCRequirements)
v1.POST("/kyc/renew", handler.HandleRenewKYC)
```

## 테스트 케이스

1. KYC 제출 - 정상 (pending 상태)
2. KYC 제출 - 이미 pending 상태
3. KYC 상태 조회 - 미제출 사용자
4. KYC 상태 조회 - 승인된 사용자
5. KYC 비동기 승인 처리
6. KYC 비동기 거절 처리
7. KYC 미인증 사용자 주문 생성 - kyc_required
8. 건당 한도 초과 - 에러
9. 일일 한도 초과 - 에러
10. KYC 만료 확인
11. 웹훅 발송 확인
12. KYC 갱신 - 만료된 KYC 갱신 성공
13. KYC 갱신 - 아직 유효한 KYC 갱신 시도 (에러)
14. KYC 갱신 - KYC 기록 없는 사용자 (에러)
15. KYC 갱신 - 이미 갱신 진행 중 (에러)

## 관련 문서

- [공통 타입 정의](../../common/types.md) - Amount, 에러 응답 형식
- [상태 매핑](../../common/status-mapping.md) - KYC 상태 정의
- [웹훅 스펙](../../common/webhook-spec.md) - KYC 웹훅 이벤트 형식
