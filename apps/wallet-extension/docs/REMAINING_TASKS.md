# StableNet Wallet - 남은 작업 목록

> 작성일: 2026-01-23
> 현재 테스트: 305개 통과

---

## 완료된 작업

### ✅ 기초 인프라 (177 tests)
- [x] 테스트 인프라 구축 (Jest, Chrome API mocks)
- [x] Vault 테스트 및 구현
- [x] HDKeyring / SimpleKeyring 테스트 및 구현
- [x] personal_sign RPC 구현
- [x] eth_signTypedData_v4 RPC 구현
- [x] eth_sendTransaction RPC 구현

### ✅ 아키텍처 개선 (128 tests)
- [x] TransactionController (33 tests)
- [x] PermissionController (34 tests)
- [x] NetworkController (33 tests)
- [x] ControllerMessenger (28 tests)

---

## 남은 작업

### 🟠 보안 강화 (우선순위: High)

#### 3.1 에러 처리 표준화
- [ ] RpcError 클래스 구현
- [ ] ErrorHandler 유틸리티
- [ ] JSON-RPC 표준 에러 코드 적용

```typescript
// 예시 테스트 케이스
describe('RpcError', () => {
  it('should create error with code and message')
  it('should serialize to JSON-RPC format')
})
```

#### 3.2 피싱 감지 시스템
- [ ] PhishingController 구현
- [ ] 알려진 피싱 도메인 블록리스트
- [ ] EIP-712 도메인 검증

```typescript
describe('PhishingController', () => {
  it('should detect known phishing domains')
  it('should validate EIP-712 domain')
})
```

#### 3.3 서명 위험도 분석
- [ ] SigningRiskAssessor 구현
- [ ] Permit 서명 감지
- [ ] 토큰 승인 분석

```typescript
describe('SigningRiskAssessor', () => {
  it('should detect permit signatures')
  it('should calculate risk score')
})
```

#### 3.4 입력 검증 강화
- [ ] 주소 검증 (체크섬 포함)
- [ ] 프라이빗 키 검증
- [ ] 니모닉 검증 (BIP39)

```typescript
describe('InputValidation', () => {
  it('should validate and checksum addresses')
  it('should reject invalid private keys')
  it('should validate BIP39 mnemonics')
})
```

---

### 🟡 기능 확장 (우선순위: Medium)

#### 4.1 GasFeeController
- [ ] 가스 추정 로직
- [ ] EIP-1559 지원
- [ ] 가스 가격 히스토리

#### 4.2 토큰 관리
- [ ] ERC-20 토큰 추적
- [ ] 토큰 잔액 조회
- [ ] 토큰 전송 UI

#### 4.4 E2E 테스트
- [ ] Playwright 설정
- [ ] 온보딩 플로우 테스트
- [ ] 트랜잭션 서명 테스트

---

### 🟢 기능 확장 (우선순위: Low)

#### 4.3 하드웨어 지갑 지원
- [ ] Ledger 연동
- [ ] 트랜잭션 서명 지원

---

## 우선순위 매트릭스

| 작업 | 복잡도 | 영향도 | 우선순위 |
|------|--------|--------|----------|
| 에러 처리 표준화 | 중 | 높음 | 🟠 High |
| 피싱 감지 | 중 | 높음 | 🟠 High |
| 서명 위험도 분석 | 중 | 높음 | 🟠 High |
| 입력 검증 강화 | 낮음 | 높음 | 🟠 High |
| GasFeeController | 중 | 중간 | 🟡 Medium |
| E2E 테스트 | 중 | 중간 | 🟡 Medium |
| 토큰 관리 | 높음 | 중간 | 🟡 Medium |
| 하드웨어 지갑 | 높음 | 낮음 | 🟢 Low |

---

## 다음 단계 제안

1. **보안 강화 작업** (3.1 ~ 3.4)을 먼저 완료하여 프로덕션 준비도 향상
2. **GasFeeController** 구현으로 사용자 경험 개선
3. **E2E 테스트** 구축으로 회귀 방지

---

## 참고 자료

- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-1559: Fee market change](https://eips.ethereum.org/EIPS/eip-1559)
- [MetaMask Extension Architecture](https://github.com/MetaMask/metamask-extension)
