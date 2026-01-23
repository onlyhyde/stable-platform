# StableNet Wallet 개선 작업 목록

> 작성일: 2025-01-23
> 방법론: TDD (Test-Driven Development) - Red-Green-Refactor
> 참고: [MetaMask 비교 분석](./METAMASK_COMPARISON.md)

## 작업 방법론

모든 작업은 TDD 방식으로 진행합니다:

1. **RED**: 실패하는 테스트 작성
2. **GREEN**: 테스트를 통과하는 최소한의 코드 작성
3. **REFACTOR**: 코드 개선 (테스트는 계속 통과)

```
┌─────────────────────────────────────────────────────┐
│                    TDD Cycle                        │
│                                                     │
│    ┌───────┐     ┌───────┐     ┌──────────┐       │
│    │  RED  │ ──▶ │ GREEN │ ──▶ │ REFACTOR │       │
│    │ 실패  │     │ 통과  │     │   개선   │       │
│    └───────┘     └───────┘     └──────────┘       │
│        ▲                             │             │
│        └─────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: 기초 인프라 (Week 1-2)

### 1.1 테스트 인프라 구축
**우선순위**: 🔴 Critical
**예상 소요**: 4시간

#### 작업 내용
- [ ] Jest + ts-jest 설정
- [ ] React Testing Library 설정
- [ ] 테스트 유틸리티 함수 작성
- [ ] CI/CD 테스트 파이프라인 구성

#### 파일 구조
```
tests/
├── setup.ts                 # Jest 글로벌 설정
├── utils/
│   ├── testUtils.ts         # 공통 유틸리티
│   ├── mockChrome.ts        # Chrome API 목
│   └── mockViem.ts          # viem 목
├── unit/
├── integration/
└── e2e/
```

#### 완료 기준
- [ ] `pnpm test` 명령어 동작
- [ ] 샘플 테스트 통과
- [ ] 커버리지 리포트 생성

---

### 1.2 Vault 테스트 작성
**우선순위**: 🔴 Critical
**예상 소요**: 4시간
**TDD 대상**: `src/background/keyring/vault.ts`

#### 테스트 케이스
```typescript
describe('Vault', () => {
  describe('initialize', () => {
    it('should create new vault with password')
    it('should throw if vault already initialized')
    it('should save to session storage')
  })

  describe('unlock', () => {
    it('should decrypt vault with correct password')
    it('should throw with incorrect password')
    it('should restore keyrings from session')
  })

  describe('lock', () => {
    it('should clear cached data')
    it('should clear session storage')
  })

  describe('updateData', () => {
    it('should persist changes to storage')
    it('should update session storage')
    it('should throw if vault locked')
  })
})
```

---

### 1.3 Keyring 테스트 작성
**우선순위**: 🔴 Critical
**예상 소요**: 6시간
**TDD 대상**: `src/background/keyring/hdKeyring.ts`, `simpleKeyring.ts`

#### 테스트 케이스
```typescript
describe('HDKeyring', () => {
  describe('initializeNewMnemonic', () => {
    it('should generate 12-word mnemonic')
    it('should generate 24-word mnemonic')
    it('should be valid BIP39 mnemonic')
  })

  describe('addAccount', () => {
    it('should derive account at correct index')
    it('should use BIP44 path')
  })

  describe('signMessage', () => {
    it('should sign message with correct account')
    it('should produce valid signature')
  })
})

describe('SimpleKeyring', () => {
  describe('importAccount', () => {
    it('should import valid private key')
    it('should reject invalid private key')
    it('should reject duplicate account')
  })

  describe('signMessage', () => {
    it('should sign with imported key')
  })
})
```

---

### 1.4 서명 메서드 구현 (personal_sign)
**우선순위**: 🔴 Critical
**예상 소요**: 8시간
**TDD 대상**: `src/background/rpc/handler.ts`

#### 테스트 케이스 (RED)
```typescript
describe('personal_sign', () => {
  it('should reject if not connected')
  it('should reject if account not authorized')
  it('should request approval from user')
  it('should sign message after approval')
  it('should reject after user denial')
  it('should return valid signature')
})
```

#### 구현 (GREEN)
```typescript
// src/background/rpc/signing.ts
export async function handlePersonalSign(
  params: [Hex, Address],
  origin: string
): Promise<Hex>
```

---

### 1.5 서명 메서드 구현 (eth_signTypedData_v4)
**우선순위**: 🔴 Critical
**예상 소요**: 8시간
**TDD 대상**: `src/background/rpc/handler.ts`

#### 테스트 케이스 (RED)
```typescript
describe('eth_signTypedData_v4', () => {
  it('should reject invalid typed data')
  it('should validate EIP-712 domain')
  it('should request approval with risk assessment')
  it('should sign typed data after approval')
  it('should return valid EIP-712 signature')
})
```

---

### 1.6 트랜잭션 전송 구현 (eth_sendTransaction)
**우선순위**: 🔴 Critical
**예상 소요**: 12시간
**TDD 대상**: `src/background/rpc/handler.ts`

#### 테스트 케이스 (RED)
```typescript
describe('eth_sendTransaction', () => {
  it('should reject if not connected')
  it('should validate transaction params')
  it('should estimate gas if not provided')
  it('should request approval with tx details')
  it('should sign and broadcast after approval')
  it('should return transaction hash')
  it('should track pending transaction')
})
```

---

## Phase 2: 아키텍처 개선 (Week 3-4)

### 2.1 TransactionController 분리
**우선순위**: 🟠 High
**예상 소요**: 8시간

#### 테스트 케이스 (RED)
```typescript
describe('TransactionController', () => {
  describe('addTransaction', () => {
    it('should create transaction with unapproved status')
    it('should emit unapprovedTransaction event')
  })

  describe('approveTransaction', () => {
    it('should change status to approved')
    it('should sign transaction')
  })

  describe('submitTransaction', () => {
    it('should broadcast to network')
    it('should update status to submitted')
  })

  describe('confirmTransaction', () => {
    it('should update status to confirmed')
    it('should move to history')
  })
})
```

#### 파일 구조
```
src/background/controllers/
├── transactionController.ts
├── transactionController.test.ts
└── types.ts
```

---

### 2.2 PermissionController 구현
**우선순위**: 🟠 High
**예상 소요**: 8시간

#### 테스트 케이스 (RED)
```typescript
describe('PermissionController', () => {
  describe('requestPermissions', () => {
    it('should create permission request')
    it('should store granted permissions')
  })

  describe('hasPermission', () => {
    it('should return true for granted permission')
    it('should return false for denied permission')
  })

  describe('revokePermission', () => {
    it('should remove permission')
    it('should emit permissionRevoked event')
  })

  describe('getPermissionsForOrigin', () => {
    it('should return all permissions for origin')
    it('should apply caveats')
  })
})
```

---

### 2.3 NetworkController 강화
**우선순위**: 🟠 High
**예상 소요**: 6시간

#### 테스트 케이스 (RED)
```typescript
describe('NetworkController', () => {
  describe('addNetwork', () => {
    it('should validate RPC URL')
    it('should verify chain ID matches')
    it('should detect duplicate networks')
  })

  describe('switchNetwork', () => {
    it('should update selected network')
    it('should emit chainChanged event')
  })

  describe('validateRpcUrl', () => {
    it('should reject invalid URLs')
    it('should test RPC connectivity')
  })
})
```

---

### 2.4 Controller Messenger 패턴 도입
**우선순위**: 🟠 High
**예상 소요**: 8시간

#### 테스트 케이스 (RED)
```typescript
describe('ControllerMessenger', () => {
  describe('registerAction', () => {
    it('should register action handler')
  })

  describe('call', () => {
    it('should call registered action')
    it('should throw for unregistered action')
  })

  describe('publish', () => {
    it('should notify all subscribers')
  })

  describe('subscribe', () => {
    it('should receive published events')
  })
})
```

---

## Phase 3: 보안 강화 (Week 5-6)

### 3.1 에러 처리 표준화
**우선순위**: 🟠 High
**예상 소요**: 6시간

#### 테스트 케이스 (RED)
```typescript
describe('RpcError', () => {
  it('should create error with code and message')
  it('should serialize to JSON-RPC format')
})

describe('ErrorHandler', () => {
  it('should log errors with context')
  it('should sanitize sensitive data')
  it('should report to error tracking')
})
```

---

### 3.2 피싱 감지 시스템
**우선순위**: 🟡 Medium
**예상 소요**: 6시간

#### 테스트 케이스 (RED)
```typescript
describe('PhishingController', () => {
  describe('checkUrl', () => {
    it('should detect known phishing domains')
    it('should allow legitimate domains')
    it('should update blocklist periodically')
  })

  describe('checkSigningDomain', () => {
    it('should validate EIP-712 domain')
    it('should warn on suspicious domains')
  })
})
```

---

### 3.3 서명 위험도 분석
**우선순위**: 🟡 Medium
**예상 소요**: 8시간

#### 테스트 케이스 (RED)
```typescript
describe('SigningRiskAssessor', () => {
  describe('assessPersonalSign', () => {
    it('should detect permit signatures')
    it('should warn on suspicious messages')
  })

  describe('assessTypedData', () => {
    it('should detect token approvals')
    it('should calculate risk score')
    it('should identify contract interactions')
  })
})
```

---

### 3.4 입력 검증 강화
**우선순위**: 🟡 Medium
**예상 소요**: 4시간

#### 테스트 케이스 (RED)
```typescript
describe('InputValidation', () => {
  describe('validateAddress', () => {
    it('should accept valid addresses')
    it('should reject invalid addresses')
    it('should checksum addresses')
  })

  describe('validatePrivateKey', () => {
    it('should accept valid private keys')
    it('should reject invalid length')
    it('should reject invalid hex')
  })

  describe('validateMnemonic', () => {
    it('should accept valid BIP39 mnemonics')
    it('should reject invalid words')
    it('should reject invalid length')
  })
})
```

---

## Phase 4: 기능 확장 (Week 7-10)

### 4.1 GasFeeController 구현
**우선순위**: 🟡 Medium
**예상 소요**: 8시간

### 4.2 토큰 관리 기능
**우선순위**: 🟢 Low
**예상 소요**: 12시간

### 4.3 하드웨어 지갑 지원 (Ledger)
**우선순위**: 🟢 Low
**예상 소요**: 16시간

### 4.4 E2E 테스트 구축
**우선순위**: 🟡 Medium
**예상 소요**: 12시간

---

## 진행 상황 추적

### Phase 1 체크리스트 ✅ 완료 (2026-01-23)
- [x] 1.1 테스트 인프라 구축 (17 tests)
- [x] 1.2 Vault 테스트 작성 (40 tests)
- [x] 1.3 Keyring 테스트 작성 (75 tests)
- [x] 1.4 personal_sign 구현 (14 tests)
- [x] 1.5 eth_signTypedData_v4 구현 (14 tests)
- [x] 1.6 eth_sendTransaction 구현 (17 tests)

**Phase 1 총 테스트: 177개 통과**

### Phase 2 체크리스트 ✅ 완료 (2026-01-23)
- [x] 2.1 TransactionController 분리 (33 tests)
- [x] 2.2 PermissionController 구현 (34 tests)
- [x] 2.3 NetworkController 강화 (33 tests)
- [x] 2.4 Controller Messenger 패턴 (28 tests)

**Phase 2 총 테스트: 305개 통과** (Phase 1: 177 + Phase 2: 128)

### Phase 3 체크리스트
- [ ] 3.1 에러 처리 표준화
- [ ] 3.2 피싱 감지 시스템
- [ ] 3.3 서명 위험도 분석
- [ ] 3.4 입력 검증 강화

### Phase 4 체크리스트
- [ ] 4.1 GasFeeController
- [ ] 4.2 토큰 관리
- [ ] 4.3 하드웨어 지갑
- [ ] 4.4 E2E 테스트

---

## 작업 로그

### 2026-01-23
- ✅ Phase 1 완료 (177 tests)
- 🚀 Phase 2 시작
- ✅ 2.1 TransactionController 분리 완료 (33 tests)
- ✅ 2.2 PermissionController 구현 완료 (34 tests)
- ✅ 2.3 NetworkController 강화 완료 (33 tests)
- ✅ 2.4 Controller Messenger 패턴 완료 (28 tests)
- ✅ Phase 2 완료 (305 tests)

---

## 참고

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
