# Onramp Simulator - Gap Analysis

## 요약

현재 onramp-simulator는 주문 생명주기와 가격 계산을 잘 시뮬레이션하고 있습니다. 그러나 결제 수단별 실제 연동이 없고(성공률로만 처리), KYC 플로우가 하드코딩되어 있으며, 지원 자산/네트워크 정보 API가 없습니다.

## 누락 기능 분석

### P0 - 필수 (PoC 핵심 시나리오)

#### 1. 결제 수단별 실제 연동

**현재 상태**:
- `paymentMethod` 필드 존재 (card, bank_transfer, apple_pay, google_pay)
- 모든 결제 수단이 동일하게 처리 (내부 성공률로만 결정)
- pg-simulator, bank-simulator와 실제 연동 없음

**필요 이유**:
- **card**: pg-simulator에 결제 요청 → 3DS 처리 → 결과 반영
- **bank_transfer**: bank-simulator에 출금 요청 → 잔액 차감 → 결과 반영
- **apple_pay/google_pay**: pg-simulator 통해 처리

**상세 스펙**: [feature-specs/payment-integration.md](./feature-specs/payment-integration.md)

---

#### 2. KYC 플로우

**현재 상태**:
- `KYCStatus` 필드가 모델에 존재
- 항상 `"approved"`로 하드코딩

**필요 이유**:
- 실제 온램프 서비스는 규제 상 KYC 필수
- KYC 미완료 사용자의 주문 거절 시나리오
- KYC 수준에 따른 거래 한도 차등 적용

**상세 스펙**: [feature-specs/kyc-flow.md](./feature-specs/kyc-flow.md)

---

### P1 - 권장 (현실적 시나리오)

#### 3. 지원 자산/네트워크 조회 API

**현재 상태**:
- `cryptoCurrency`, `chainId` 필드 존재
- 지원되는 자산/네트워크 목록 조회 API 없음
- 유효성 검증 없음 (아무 값이나 가능)

**필요 이유**:
- 클라이언트가 지원 자산 목록을 표시
- 잘못된 자산/네트워크 조합 방지
- 네트워크별 수수료 차등 적용

**상세 스펙**: [feature-specs/supported-assets.md](./feature-specs/supported-assets.md)

---

#### 4. 다중 환율 지원

**현재 상태**:
- `USD_TO_USDC` 환경변수 하나만 지원
- USD → USDC 단일 페어만 가능

**필요 이유**:
- 여러 fiat 통화 지원 (EUR, KRW, JPY 등)
- 여러 crypto 자산 지원 (USDT, ETH, BTC 등)
- 실시간 환율 변동 시뮬레이션

**상세 스펙**: [feature-specs/multi-currency-rates.md](./feature-specs/multi-currency-rates.md)

---

### P2 - 선택 (완성도)

#### 5. 월렛 주소 검증

**현재 상태**:
- `walletAddress` 필드 존재
- 유효성 검증 없음 (빈 문자열도 가능)

**필요 이유**:
- EVM 주소 형식 검증 (0x + 40 hex chars)
- 잘못된 주소로 전송 방지
- 체인별 주소 형식 차이 대응

**상세 스펙**: [feature-specs/wallet-validation.md](./feature-specs/wallet-validation.md)

---

#### 6. 거래 한도

**현재 상태**: 없음

**필요 이유**:
- KYC 수준별 거래 한도 (미인증: $0, 기본: $1,000, 고급: $50,000)
- 일일/월간 누적 한도
- 한도 초과 거절 시나리오

**구현 범위**:
- 사용자별 한도 조회 API
- 주문 생성 시 한도 검증
- KYC 수준과 한도 연동

---

#### 7. Off-ramp (역방향)

**현재 상태**: 없음 (온램프만 지원)

**필요 이유**:
- Crypto → Fiat 변환
- 완전한 양방향 서비스 시뮬레이션

**구현 범위** (추후):
- Crypto 출금 주소 생성
- 입금 확인 시뮬레이션
- Fiat 지급 (은행 이체)

---

## 영향 받는 외부 서비스

| 기능 | pg-simulator | bank-simulator |
|------|--------------|----------------|
| 결제 연동 - card | 결제 요청/결과 수신 | - |
| 결제 연동 - bank | - | Direct Debit 요청 |
| KYC | - | - |
| 지원 자산 | - | - |
| 다중 환율 | - | - |
| 월렛 검증 | - | - |

## 구현 순서 권장

1. **결제 수단별 연동** - PG/Bank 연동의 핵심
2. **KYC 플로우** - 규제 준수 시뮬레이션
3. **지원 자산 API** - 클라이언트 UI에 필요
4. **다중 환율** - 다양한 통화 페어 지원
5. **월렛 검증** - 주소 오류 방지
