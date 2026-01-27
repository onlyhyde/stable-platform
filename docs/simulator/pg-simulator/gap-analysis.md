# PG Simulator - Gap Analysis

## 요약

현재 pg-simulator는 카드 결제와 3D Secure 인증을 잘 지원하고 있습니다. 그러나 `bank_transfer`와 `wallet` 결제 방식이 enum으로만 정의되어 있고 실제 로직이 없으며, bank-simulator와의 연동도 구현되어 있지 않습니다.

## 누락 기능 분석

### P0 - 필수 (PoC 핵심 시나리오)

#### 1. bank_transfer 결제 플로우

**현재 상태**:
- `PaymentMethodBank` enum 존재
- 결제 생성 시 method로 `bank_transfer` 전달 가능
- 실제 은행 연동 로직 없음 (카드와 동일하게 성공률로 처리)

**필요 이유**:
- 실제 PG는 계좌이체 결제를 지원
- bank-simulator와 연동하여 실제 잔액 차감 필요
- 가상계좌 발급 → 입금 확인 → 결제 완료 플로우

**상세 스펙**: [feature-specs/bank-transfer-flow.md](./feature-specs/bank-transfer-flow.md)

---

#### 2. wallet 결제 플로우

**현재 상태**:
- `PaymentMethodWallet` enum 존재
- 실제 지갑 결제 로직 없음

**필요 이유**:
- 간편결제 (카카오페이, 네이버페이 등) 시뮬레이션
- 사전 등록된 결제수단으로 원터치 결제

**상세 스펙**: [feature-specs/wallet-payment-flow.md](./feature-specs/wallet-payment-flow.md)

---

### P1 - 권장 (현실적 시나리오)

#### 3. Return URL / Cancel URL

**현재 상태**:
- 3DS challenge 페이지만 있음
- 결제 완료 후 가맹점으로 돌아가는 redirect 없음

**필요 이유**:
- 실제 PG는 결제 완료/실패/취소 시 가맹점 URL로 redirect
- 사용자 결제 여정 완성
- Onramp에서 카드 결제 후 복귀 처리

**상세 스펙**: [feature-specs/redirect-url.md](./feature-specs/redirect-url.md)

---

#### 4. Checkout Session (Hosted Checkout)

**현재 상태**: 없음

**필요 이유**:
- Stripe Checkout처럼 PG가 호스팅하는 결제 페이지
- 가맹점이 결제 링크만 생성하면 PG가 결제 UI 제공
- 결제 수단 선택 → 정보 입력 → 결제 완료까지 PG 측에서 처리

**상세 스펙**: [feature-specs/checkout-session.md](./feature-specs/checkout-session.md)

---

### P2 - 선택 (완성도)

#### 5. 정산(Settlement) 시뮬레이션

**현재 상태**: 없음

**필요 이유**:
- 가맹점에 정산금 지급 시뮬레이션
- 결제 수수료 차감 후 정산
- bank-simulator와 연동하여 가맹점 계좌에 입금

**상세 스펙**: [feature-specs/settlement.md](./feature-specs/settlement.md)

---

#### 6. 구독/정기결제

**현재 상태**: 없음

**필요 이유**:
- SaaS 결제 시나리오
- 월정액 서비스 시뮬레이션
- 자동 청구 및 결제 실패 재시도

**구현 범위**:
- 구독 생성/조회/취소 API
- 빌링 주기 설정
- 자동 청구 스케줄러 (시뮬레이션)
- 결제 실패 시 재시도 로직

---

## 영향 받는 외부 서비스

| 기능 | bank-simulator | onramp-simulator |
|------|----------------|------------------|
| bank_transfer | Direct Debit 호출 | - |
| wallet | - | - |
| Return URL | - | 카드 결제 후 복귀 |
| Checkout Session | - | 카드 결제 위임 |
| 정산 | 가맹점 계좌 입금 | - |

## 구현 순서 권장

1. **bank_transfer 결제 플로우** - bank-simulator 연동의 핵심
2. **Return URL** - 결제 후 복귀 처리
3. **Checkout Session** - Onramp 카드 결제 위임
4. **wallet 결제 플로우** - 간편결제 시뮬레이션
5. **정산** - 가맹점 정산 플로우
