# StableNet Wallet - 남은 작업 목록

> 작성일: 2026-01-23
> 최종 업데이트: 2026-01-23
> 현재 테스트: 430개 통과

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

### ✅ 보안 강화 (125 tests)
- [x] RPC 에러 처리 표준화 (27 tests)
  - RpcError, ProviderRpcError 클래스
  - JSON-RPC 2.0, EIP-1193, EIP-1474 표준 에러 코드
- [x] 피싱 감지 시스템 (27 tests)
  - Typosquatting 감지
  - Homograph/Punycode 공격 감지
  - 의심스러운 서브도메인 감지
  - 커스텀 Blocklist/Allowlist
- [x] 서명 위험도 분석 (18 tests)
  - eth_sign 블라인드 서명 경고
  - EIP-712 typed data 파싱
  - 무제한 토큰 승인 감지
  - NFT setApprovalForAll 감지
- [x] 입력 검증 강화 (53 tests)
  - 주소 검증 (EIP-55 체크섬)
  - Hex 문자열 검증
  - Chain ID 검증
  - 트랜잭션/RPC 요청 검증
  - 문자열 새니타이징 (XSS 방지)

---

## 남은 작업

### 🟡 기능 확장 (우선순위: Medium)

#### 4.1 GasFeeController
- [ ] 가스 추정 로직
- [ ] EIP-1559 지원
- [ ] 가스 가격 히스토리

```typescript
describe('GasFeeController', () => {
  it('should estimate gas for transactions')
  it('should support EIP-1559 fee parameters')
  it('should track gas price history')
})
```

#### 4.2 토큰 관리
- [ ] ERC-20 토큰 추적
- [ ] 토큰 잔액 조회
- [ ] 토큰 전송 UI

```typescript
describe('TokenController', () => {
  it('should track ERC-20 tokens')
  it('should fetch token balances')
  it('should support token transfers')
})
```

#### 4.3 E2E 테스트
- [ ] Playwright 설정
- [ ] 온보딩 플로우 테스트
- [ ] 트랜잭션 서명 테스트

---

### 🟢 추가 기능 (우선순위: Low)

#### 4.4 하드웨어 지갑 지원
- [ ] Ledger 연동
- [ ] 트랜잭션 서명 지원

#### 4.5 dApp 브라우저 연동
- [ ] WalletConnect 지원
- [ ] Deep linking

---

## 우선순위 매트릭스

| 작업 | 복잡도 | 영향도 | 우선순위 | 상태 |
|------|--------|--------|----------|------|
| 에러 처리 표준화 | 중 | 높음 | High | ✅ 완료 |
| 피싱 감지 | 중 | 높음 | High | ✅ 완료 |
| 서명 위험도 분석 | 중 | 높음 | High | ✅ 완료 |
| 입력 검증 강화 | 낮음 | 높음 | High | ✅ 완료 |
| GasFeeController | 중 | 중간 | Medium | 🟡 대기 |
| 토큰 관리 | 높음 | 중간 | Medium | 🟡 대기 |
| E2E 테스트 | 중 | 중간 | Medium | 🟡 대기 |
| 하드웨어 지갑 | 높음 | 낮음 | Low | 🟢 대기 |
| WalletConnect | 중 | 낮음 | Low | 🟢 대기 |

---

## 진행률

```
기초 인프라:     ████████████████████ 100%
아키텍처 개선:   ████████████████████ 100%
보안 강화:       ████████████████████ 100%
기능 확장:       ░░░░░░░░░░░░░░░░░░░░   0%
```

**전체 진행률: 75% (3/4 단계 완료)**

---

## 다음 단계 제안

1. **GasFeeController** 구현으로 트랜잭션 UX 개선
2. **토큰 관리** 기능 추가로 사용성 확대
3. **E2E 테스트** 구축으로 회귀 방지

---

## 참고 자료

- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-1559: Fee market change](https://eips.ethereum.org/EIPS/eip-1559)
- [MetaMask Extension Architecture](https://github.com/MetaMask/metamask-extension)
