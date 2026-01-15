# StableNet Smart Account PoC 구현 분석서

> **최종 수정일**: 2026-01-14

## 1. 개요

본 문서는 `StableNet_SmartAccount_PoC_기술명세서.md`와 `StableNet_Key.md`에 기술된 설계 내용을 기존 POC 프로젝트 코드베이스와 비교 분석하여, 각 모듈별 구현 가능성과 활용 가능한 프로젝트를 정리합니다.

### 1.1 신규 프로젝트 추가 (2026-01)

| 프로젝트 | 설명 | 주요 기능 |
|----------|------|-----------|
| **go-stablenet** | Go 블록체인 노드 | EIP-7702, Fee Delegation (0x16), WBFT 합의 |
| **stealth-7702** | 스텔스 주소 데모 앱 | Next.js 14, Viem 2, ERC-5564/6538 통합 |

---

## 2. 핵심 모듈별 분석

### 2.1 EIP-7702 (EOA → Smart Account 전환)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | SetCodeTx (0x04), AuthList 기반 코드 위임, Delegation Prefix (0xef0100) |
| **go-stablenet 현황** | ✅ **이미 구현됨** - `SetCodeTxType = 0x04`, `FeeDelegateDynamicFeeTxType = 0x16` |
| **POC 프로젝트** | `sdk/plugins/ecdsa/account/create7702KernelAccount.ts` |
| **stealth-7702 현황** | ✅ **데모 앱 구현됨** - Kernel Smart Account 업그레이드 + Paymaster 연동 |
| **구현 상태** | 🟢 **완료** |

**세부 분석**:
```
go-stablenet 체인 레벨 (core/types/):
├── SetCodeTx 트랜잭션 타입 지원 ✅ (tx_setcode.go)
│   ├── SetCodeTxType = 0x04
│   ├── DelegationPrefix = []byte{0xef, 0x01, 0x00}
│   └── SetCodeAuthorization 구조체 (ChainID, Address, Nonce, V, R, S)
├── SetCodeAuthorization.SigHash() - 서명 해시 생성 ✅
├── SetCodeAuthorization.Authority() - 서명자 복구 ✅
├── SignSetCode() - Authorization 서명 ✅
├── ParseDelegation() - Delegation Prefix 파싱 ✅
├── AddressToDelegation() - 주소 → Delegation 변환 ✅
└── AuthList 기반 코드 위임 ✅

SDK 레벨:
├── create7702KernelAccount() - EIP-7702 계정 생성 ✅
├── kernel7702AccountClient.ts - 클라이언트 지원 ✅
└── EIP-7702 서명 지원 ✅

stealth-7702 데모 앱:
├── Stealth Account → Kernel Smart Account 업그레이드 ✅
├── ERC-4337 Paymaster 연동 (Pimlico) ✅
├── Gas Sponsorship으로 프라이버시 보존 ✅
└── Odyssey Testnet (Chain ID: 911867) 배포 ✅
```

**결론**: EIP-7702는 체인 레벨에서 완전 지원되며, SDK와 stealth-7702 데모 앱에서도 활용 가능한 상태입니다.

---

### 2.2 ERC-4337 Account Abstraction

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | EntryPoint, PackedUserOperation, handleOps() |
| **POC 프로젝트** | `kernel/src/interfaces/IEntryPoint.sol`, `sdk/packages/core/` |
| **구현 상태** | 🟢 **완료** |

**활용 가능한 코드**:
```
kernel/src/interfaces/
├── IEntryPoint.sol - EntryPoint 인터페이스 ✅
├── IPaymaster.sol - Paymaster 인터페이스 ✅
├── PackedUserOperation.sol - UserOp 구조체 ✅
└── IStakeManager.sol - 스테이킹 관리 ✅

sdk/packages/core/
├── accounts/kernel/ - Kernel 계정 구현 ✅
├── clients/ - Bundler 클라이언트 ✅
└── actions/ - UserOp 액션 ✅
```

**필요 작업**:
- EntryPoint 컨트랙트 배포 (eth-infinitism/account-abstraction 사용 권장)
- StableNet 체인에 맞춘 가스 계산 로직 조정

---

### 2.3 ERC-7579 Smart Account (Modular Account)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | validateUserOp, execute/executeBatch, Module Management |
| **POC 프로젝트** | `kernel/src/Kernel.sol` |
| **구현 상태** | 🟢 **완료** |

**Kernel 프로젝트 구조**:
```
kernel/src/
├── Kernel.sol - 핵심 Smart Account 구현 ✅
├── core/
│   ├── ExecutorManager.sol - Executor 모듈 관리 ✅
│   ├── HookManager.sol - Hook 모듈 관리 ✅
│   ├── SelectorManager.sol - 함수 셀렉터 관리 ✅
│   └── ValidationManager.sol - 검증 모듈 관리 ✅
├── factory/
│   ├── KernelFactory.sol - 계정 팩토리 ✅
│   └── FactoryStaker.sol - 팩토리 스테이킹 ✅
└── validator/
    ├── ECDSAValidator.sol - ECDSA 검증기 ✅
    ├── WeightedECDSAValidator.sol - 가중 다중서명 ✅
    └── MultiChainValidator.sol - 멀티체인 지원 ✅
```

**Module Type 지원**:
| Type | 명세서 | Kernel | 상태 |
|------|--------|--------|------|
| Validator (1) | ✅ | ✅ | 완료 |
| Executor (2) | ✅ | ✅ | 완료 |
| Fallback (3) | ✅ | ✅ | 완료 |
| Hook (4) | ✅ | ✅ | 완료 |

---

### 2.4 Paymaster 및 Fee Delegation (가스비 대납)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | VerifyingPaymaster, ERC20Paymaster |
| **go-stablenet 현황** | ✅ **Fee Delegation 구현됨** - `FeeDelegateDynamicFeeTxType = 0x16` |
| **POC 프로젝트** | `kernel/src/interfaces/IPaymaster.sol` |
| **stealth-7702 현황** | ✅ **Pimlico Paymaster 연동** |
| **구현 상태** | 🟡 **체인 레벨 지원, 컨트랙트 구현 필요** |

**go-stablenet Fee Delegation 구현 (core/types/tx_fee_delegation.go)**:
```go
// 트랜잭션 타입 0x16 (22)
type FeeDelegateDynamicFeeTx struct {
    SenderTx DynamicFeeTx           // 원본 트랜잭션 (발신자 서명 포함)
    FeePayer *common.Address        // 가스비 대납자 주소
    FV       *big.Int               // FeePayer V (서명)
    FR       *big.Int               // FeePayer R (서명)
    FS       *big.Int               // FeePayer S (서명)
}

주요 기능:
├── SetSenderTx()                   - 원본 트랜잭션 설정 ✅
├── feePayer()                      - 가스비 대납자 조회 ✅
├── rawFeePayerSignatureValues()    - 대납자 서명값 조회 ✅
├── sigHash()                       - 서명 해시 생성 (SenderTx + FeePayer) ✅
└── 이중 서명 구조                   - 발신자 + 대납자 서명 ✅
```

**Fee Delegation 트랜잭션 구조**:
```
FeeDelegateDynamicFeeTx (0x16)
├── SenderTx (DynamicFeeTx)
│   ├── ChainID, Nonce, GasTipCap, GasFeeCap
│   ├── Gas, To, Value, Data, AccessList
│   └── V, R, S (발신자 서명)
├── FeePayer (가스비 대납자 주소)
└── FV, FR, FS (대납자 서명)
```

**필요한 구현**:

#### VerifyingPaymaster (ERC-4337 가스비 대납)
```solidity
// 명세서 Section 5.2에 정의됨
- validatePaymasterUserOp() - 서명 검증 ❌ 구현 필요
- postOp() - 가스 사용량 기록 ❌ 구현 필요
- sponsoredAccounts 매핑 ❌ 구현 필요
- 시간 기반 유효성 검증 ❌ 구현 필요
```

#### ERC20Paymaster (토큰으로 가스비 지불)
```solidity
// 명세서 Section 5.3에 정의됨
- ERC20 토큰 수령 후 가스비 정산 ❌ 구현 필요
- Uniswap V3 연동 스왑 ❌ 구현 필요
- 환율 관리 (pricePerETH) ❌ 구현 필요
```

**권장 사항**:
1. **네이티브 Fee Delegation 활용**: go-stablenet의 `FeeDelegateDynamicFeeTx` (0x16) 사용
2. **ERC-4337 Paymaster**: 표준 호환을 위해 컨트랙트 레벨 구현 추가
3. `stable-poc-contract/` 프로젝트에 Paymaster 컨트랙트 추가
4. OpenZeppelin 5.x의 `draft-ERC4337Utils.sol` 활용

---

### 2.5 Subscription Module (정기 결제)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | ERC-7715 Permission Grant, ERC-7710 Delegation |
| **POC 프로젝트** | `sdk/plugins/multi-tenant-session-account/` |
| **구현 상태** | 🟡 **부분 구현** |

**기존 구현**:
```
sdk/plugins/multi-tenant-session-account/
├── abi/DelegationManagerAbi.ts ✅
├── actions/
│   ├── delegate.ts ✅
│   ├── signDelegation.ts ✅
│   └── installDMAndDelegate.ts ✅
├── enforcers/
│   ├── allowed-params/ ✅
│   ├── allowed-targets/ ✅
│   └── cab-paymaster/ ✅
└── utils/delegationManager.ts ✅
```

**추가 필요 구현**:
```
❌ SubscriptionModule.sol - 명세서 Section 6.2
  - createSubscription()
  - executeSubscription()
  - cancelSubscription()
  - isPaymentDue()

❌ Subscription Service (Backend)
  - 스케줄러 (cron)
  - 결제 실행 로직
  - UserOperation 생성
```

**권장 사항**:
1. 기존 `multi-tenant-session-account` enforcer 패턴 활용
2. SubscriptionModule 컨트랙트 신규 개발
3. Backend 서비스 개발 (Node.js/TypeScript)

---

### 2.6 Stealth Payment (프라이버시 전송)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | EIP-5564 Stealth Addresses, ERC-6538 Registry, s-ca 컨트랙트 |
| **POC 프로젝트** | `stealth-address-sdk/`, `stealth-address-erc-contracts/` |
| **stealth-7702 프로젝트** | ✅ **EIP-7702 + ERC-5564/6538 통합 데모** |
| **구현 상태** | 🟡 **기본 구현 완료, s-ca 신규 필요** |

**기존 구현 (stealth-address-sdk)**:
```
src/utils/crypto/
├── generateStealthAddress.ts ✅
├── checkStealthAddress.ts ✅
├── computeStealthKey.ts ✅
└── EIP-5564 표준 준수 ✅

src/lib/abi/
├── ERC5564Announcer.ts ✅
└── ERC6538Registry.ts ✅

src/lib/actions/
├── getAnnouncements/ ✅
├── getAnnouncementsForUser/ ✅
├── prepareAnnounce/ ✅
├── prepareRegisterKeys/ ✅
└── watchAnnouncementsForUser/ ✅
```

**stealth-7702 프로젝트 (신규)**:

EIP-7702와 스텔스 주소를 결합한 데모 애플리케이션입니다.

```
stealth-7702/
├── app/                          # Next.js 14 Frontend
│   ├── components/               # React 컴포넌트
│   ├── utils/                    # Stealth 유틸리티
│   ├── pkg/                      # Viem 2 + Wagmi 2 연동
│   └── pages/                    # 페이지 라우팅
├── contracts/
│   └── StealthSuite.sol          # ERC-5564 + ERC-6538 통합 컨트랙트 ✅
├── chain-config/
│   └── chains.ts                 # 체인 설정 (Odyssey Testnet)
└── scripts/                      # CLI 도구

StealthSuite.sol 구현:
├── StealthAnnouncer              # ERC-5564 Announcement 이벤트 ✅
│   ├── announce()                # Stealth Address 공지
│   └── Announcement 이벤트       # schemeId, stealthAddress, ephemeralPubKey, metadata
└── StealthRegistry               # ERC-6538 Registry ✅
    ├── registerKeys()            # Stealth Meta Address 등록
    ├── stealthMetaAddressOf()    # Meta Address 조회
    └── KeysRegistered 이벤트     # registrant, schemeId, stealthMetaAddress
```

**기술 스택**:
| 구성요소 | 기술 | 버전 |
|----------|------|------|
| Frontend | Next.js | 14.0.4 |
| Ethereum Client | Viem | 2.x |
| React Hooks | Wagmi | 2.x |
| Wallet Connect | RainbowKit | 2.x |
| Bundler/Paymaster | Pimlico (permissionless) | 0.2.20 |

**배포된 컨트랙트 (Odyssey Testnet, Chain ID: 911867)**:
| 컨트랙트 | 주소 |
|----------|------|
| ERC5564Announcer | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| ERC6538Registry | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` |
| Kernel Implementation | `0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27` |
| MultiChainValidator | `0x02d32f9c668C92A60b44825C4f79B501c0F685dA` |

**EIP-7702 + Stealth Address 통합 흐름**:
```
1. 수신자: Stealth Meta Address 등록 (ERC-6538 Registry)
2. 송신자: Stealth Address 생성 + 자금 전송 + Announcement (EIP-5564)
3. 수신자: Announcement 스캔 → Stealth Address 발견
4. 수신자: EIP-7702로 Stealth Account → Kernel Smart Account 업그레이드
5. 수신자: Paymaster 통해 가스비 없이 자금 출금 (프라이버시 보존)
```

**추가 필요 구현 (s-ca 컨트랙트)**:
```solidity
// 명세서 Section 7에 정의된 StealthPaymentContract
❌ StealthPaymentContract.sol
  - register() - 사용자 등록 + 정부 공개키 암호화
  - deposit() - 공개 입금 (EIP-5564 Announcement)
  - internalTransfer() - 비공개 내부 전송 (이벤트 없음)
  - withdraw() - 공개 출금
  - _balances 내부 원장
  - EncryptedAuditEntry 감사 로그
  - 정부 감사 접근 권한 관리
```

**명세서 vs 기존 구현 차이점**:
| 기능 | stealth-address-sdk | stealth-7702 | s-ca 명세서 |
|------|---------------------|--------------|-------------|
| Stealth Address 생성 | ✅ | ✅ | ✅ |
| EIP-5564 Announcement | ✅ | ✅ | ✅ |
| ERC-6538 Registry | ✅ | ✅ | ✅ |
| EIP-7702 Smart Account 업그레이드 | ❌ | ✅ | - |
| Paymaster 가스 대납 | ❌ | ✅ (Pimlico) | - |
| 내부 잔액 관리 | ❌ | ❌ | ✅ 필요 |
| 비공개 내부 전송 | ❌ | ❌ | ✅ 필요 |
| 암호화된 감사 로그 | ❌ | ❌ | ✅ 필요 |
| 정부 접근 권한 | ❌ | ❌ | ✅ 필요 |

---

### 2.7 Bundler

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | ERC-4337 RPC, UserOp Pool, Bundle Builder |
| **POC 프로젝트** | `sdk/packages/core/clients/` |
| **구현 상태** | 🟡 **클라이언트만 존재** |

**기존 구현**:
```
sdk/packages/core/
├── clients/bundler/ - Bundler 클라이언트 ✅
└── actions/sendUserOperation - UserOp 전송 ✅
```

**필요한 Bundler 서버 구현** (명세서 Section 8):
```
❌ RPC Interface
  - eth_sendUserOperation
  - eth_estimateUserOperationGas
  - eth_getUserOperationByHash
  - eth_getUserOperationReceipt
  - eth_supportedEntryPoints

❌ UserOperation Pool
  - 검증 (signature, nonce, gas limits)
  - 시뮬레이션 (EntryPoint.simulateValidation)
  - 우선순위 정렬 (gas price)

❌ Bundle Builder
  - 가스 최적화
  - 충돌 감지
  - 번들 크기 제한

❌ Transaction Submitter
  - EntryPoint.handleOps() 호출
  - 재시도 로직
```

**권장 사항**:
1. **Alto Bundler** (https://github.com/pimlico/alto) 포크 권장
2. 또는 **Rundler** (https://github.com/alchemyplatform/rundler) 활용
3. StableNet 체인 특성에 맞춘 커스터마이징 필요

---

### 2.8 DEX Integration (Uniswap V3)

| 항목 | 내용 |
|------|------|
| **명세서 요구사항** | Uniswap V3 Core, SwapRouter, ERC20Paymaster 연동 |
| **POC 프로젝트** | 없음 |
| **구현 상태** | 🔴 **미구현** |

**필요한 구현**:
```
❌ Uniswap V3 Core 배포
  - UniswapV3Factory
  - UniswapV3Pool
  - SwapRouter

❌ Liquidity Pool 설정
  - STABLE/WETH 풀
  - USDC/STABLE 풀
  - 초기 유동성 공급

❌ Price Oracle 연동
  - ERC20Paymaster의 환율 업데이트
  - 슬리피지 보호
```

**권장 사항**:
1. Uniswap V3 컨트랙트 직접 배포 (MIT 라이선스)
2. 또는 자체 DEX 구현 (간소화된 버전)
3. Chainlink 또는 자체 오라클 연동

---

## 3. 프로젝트별 활용 매트릭스

| 모듈 | go-stablenet | kernel | sdk | stealth-7702 | stealth-address-sdk | stable-poc-contract | 신규 개발 |
|------|--------------|--------|-----|--------------|---------------------|---------------------|-----------|
| EIP-7702 (0x04) | ✅ | - | ✅ | ✅ | - | - | - |
| Fee Delegation (0x16) | ✅ | - | - | - | - | - | SDK 연동 |
| WBFT 합의 | ✅ | - | - | - | - | - | - |
| ERC-4337 EntryPoint | - | ✅ | ✅ | ✅ | - | 배포 필요 | - |
| ERC-7579 Smart Account | - | ✅ | ✅ | - | - | - | - |
| ERC-5564 Announcer | - | - | - | ✅ | ✅ | - | - |
| ERC-6538 Registry | - | - | - | ✅ | ✅ | - | - |
| VerifyingPaymaster | - | - | - | 🟡 (Pimlico) | - | - | ✅ |
| ERC20Paymaster | - | - | - | - | - | - | ✅ |
| Subscription Module | - | - | 🟡 | - | - | - | ✅ |
| Stealth Payment (s-ca) | - | - | - | - | 🟡 | - | ✅ |
| Bundler Server | - | - | 🟡 | - | - | - | ✅ |
| DEX Integration | - | - | - | - | - | - | ✅ |

---

## 4. 구현 우선순위 권장

### Phase 1: 핵심 인프라 (즉시 활용 가능)
1. ✅ Kernel Smart Account 배포
2. ✅ KernelFactory 배포
3. ✅ ECDSAValidator 배포
4. ⚙️ EntryPoint 배포 (eth-infinitism v0.7)

### Phase 2: 가스비 대납 (1-2주)
1. VerifyingPaymaster 개발 및 배포
2. ERC20Paymaster 개발 및 배포
3. Bundler 서버 구축 (Alto 포크)

### Phase 3: 고급 기능 (2-4주)
1. SubscriptionModule 개발
2. StealthPaymentContract (s-ca) 개발
3. DEX (Uniswap V3) 배포 및 유동성 공급

### Phase 4: 백엔드 서비스 (병렬 진행)
1. Subscription Service (스케줄러)
2. Stealth Scanner (Announcement 인덱싱)
3. 관리자 대시보드

---

## 5. 기술적 타당성 평가

### 5.1 실현 가능성

| 카테고리 | 평가 | 근거 |
|----------|------|------|
| **체인 레벨** | ✅ 높음 | go-stablenet에서 EIP-7702 (0x04), Fee Delegation (0x16), WBFT 합의 이미 지원 |
| **스마트 컨트랙트** | ✅ 높음 | kernel 프로젝트가 ERC-7579 완벽 지원 |
| **SDK** | ✅ 높음 | ZeroDev SDK v5 기반으로 충분한 기능 제공 |
| **Stealth Address** | ✅ 높음 | stealth-address-sdk가 EIP-5564/ERC-6538 지원 |
| **Stealth + EIP-7702** | ✅ 높음 | stealth-7702 데모 앱에서 통합 검증 완료 |
| **Fee Delegation** | ✅ 높음 | go-stablenet 체인 레벨 구현 완료 (0x16) |
| **Paymaster** | 🟡 중간 | 체인 레벨 지원 있음, ERC-4337 컨트랙트 구현 필요 |
| **Bundler** | 🟡 중간 | 클라이언트 있으나 서버 구현 필요 |
| **DEX** | 🔴 낮음 | 완전 신규 구현 또는 Uniswap 배포 필요 |

### 5.2 리스크 요소

1. **Bundler 안정성**: 프로덕션 수준의 Bundler는 복잡한 엔지니어링 필요
2. **DEX 유동성**: 초기 유동성 확보 및 가격 안정성 문제
3. **s-ca 감사 기능**: 암호화/복호화 로직의 보안 검증 필요
4. **규제 준수**: 정부 감사 기능의 법적 검토 필요

---

## 6. 결론

StableNet Smart Account PoC 기술명세서에 기술된 대부분의 기능은 기존 POC 프로젝트를 활용하여 구현 가능합니다.

**즉시 활용 가능 (75%)**:
- EIP-7702 지원 (go-stablenet, stealth-7702)
- Fee Delegation 0x16 (go-stablenet)
- WBFT 합의 엔진 (go-stablenet)
- ERC-4337/7579 Smart Account (kernel)
- Stealth Address 기본 기능 (stealth-address-sdk, stealth-7702)
- EIP-7702 + Stealth 통합 (stealth-7702)
- SDK 인프라 (sdk)

**추가 개발 필요 (25%)**:
- Paymaster 컨트랙트 (ERC-4337 표준)
- Bundler 서버
- SubscriptionModule
- StealthPaymentContract (s-ca)
- DEX Integration

총 예상 개발 기간: 4-6주 (3-4명 개발팀 기준)

### 6.1 신규 프로젝트 기여도

| 프로젝트 | 주요 기여 | 활용 방안 |
|----------|-----------|-----------|
| **go-stablenet** | 체인 레벨 EIP-7702, Fee Delegation, WBFT | 메인넷 노드로 활용 |
| **stealth-7702** | EIP-7702 + Stealth 통합 데모 | 프라이버시 전송 참조 구현체 |

---

## 7. 클라이언트 (SDK/Frontend) 상세 분석

### 7.1 StableNet SDK 구조

기술명세서 Section 10.1에 정의된 SDK 구조를 기존 POC 프로젝트와 매핑합니다.

```
명세서 요구사항                      기존 POC (sdk/)                    상태
─────────────────────────────────────────────────────────────────────────────
sdk/packages/core/
├── account/                         ✅ accounts/kernel/               완료
│   ├── createSmartAccount()         ✅ createKernelAccount.ts
│   ├── create7702Account()          ✅ create7702KernelAccount.ts
│   └── signUserOp()                 ✅ signUserOperation.ts
├── userOperation/                   ✅ actions/                       완료
│   ├── buildUserOp()                ✅ prepareUserOperationRequest
│   ├── estimateGas()                ✅ estimateUserOperationGas
│   └── sendUserOp()                 ✅ sendUserOperation
├── stealth/                         🟡 별도 SDK 존재                   통합 필요
│   ├── generateStealthAddress()     ✅ stealth-address-sdk
│   ├── checkStealthAddress()        ✅ stealth-address-sdk
│   └── computeStealthKey()          ✅ stealth-address-sdk
└── utils/                           ✅ 기본 유틸리티                   완료
```

### 7.2 SDK 모듈별 상세 기능

#### 7.2.1 Account Module

| 기능 | 명세서 요구사항 | POC 구현 위치 | 상태 |
|------|----------------|---------------|------|
| Kernel Account 생성 | `createSmartAccount()` | `sdk/packages/core/accounts/kernel/createKernelAccount.ts` | ✅ |
| EIP-7702 Account | `create7702Account()` | `sdk/plugins/ecdsa/account/create7702KernelAccount.ts` | ✅ |
| Account Factory | `getAccountAddress()` | `sdk/packages/core/accounts/kernel/utils/getAccountAddress.ts` | ✅ |
| Module 설치 | `installModule()` | `sdk/packages/core/accounts/kernel/utils/plugins/` | ✅ |

#### 7.2.2 UserOperation Module

| 기능 | 명세서 요구사항 | POC 구현 위치 | 상태 |
|------|----------------|---------------|------|
| UserOp 빌드 | Gas limits, callData 인코딩 | `sdk/packages/core/actions/` | ✅ |
| Gas 추정 | `eth_estimateUserOperationGas` | `sdk/packages/core/clients/bundler/` | ✅ |
| Paymaster 통합 | `paymasterAndData` 구성 | `sdk/packages/core/actions/` | 🟡 |
| UserOp 서명 | ECDSA, WebAuthn, MultiSig | `sdk/plugins/` | ✅ |

#### 7.2.3 Permission Module (ERC-7715/7710)

| 기능 | 명세서 요구사항 | POC 구현 위치 | 상태 |
|------|----------------|---------------|------|
| Permission Grant | `wallet_grantPermissions` | `sdk/plugins/modularPermission/` | 🟡 |
| Delegation | `redeemDelegations` | `sdk/plugins/multi-tenant-session-account/` | ✅ |
| Enforcer 정책 | AllowedTargets, TokenAllowance | `sdk/plugins/multi-tenant-session-account/enforcers/` | ✅ |
| Session Key | 세션 기반 서명 | `sdk/plugins/session-account/` | ✅ |

#### 7.2.4 Stealth Module

| 기능 | 명세서 요구사항 | POC 구현 위치 | 상태 |
|------|----------------|---------------|------|
| Meta Address 생성 | `generateStealthMetaAddress()` | `stealth-address-sdk/src/utils/helpers/` | ✅ |
| Stealth Address 생성 | `generateStealthAddress()` | `stealth-address-sdk/src/utils/crypto/` | ✅ |
| Announcement 조회 | `getAnnouncements()` | `stealth-address-sdk/src/lib/actions/` | ✅ |
| View Tag 필터링 | 99.6% 빠른 필터링 | `stealth-address-sdk/src/utils/crypto/checkStealthAddress.ts` | ✅ |
| Registry 등록 | `prepareRegisterKeys()` | `stealth-address-sdk/src/lib/actions/` | ✅ |

### 7.3 SDK 신규 개발 필요 항목

```typescript
// 1. Paymaster Client (신규 개발 필요)
interface PaymasterClient {
  // VerifyingPaymaster용
  getPaymasterStubData(userOp: UserOperation): Promise<PaymasterData>;
  getPaymasterSignature(userOp: UserOperation): Promise<Hex>;

  // ERC20Paymaster용
  getTokenPaymasterData(userOp: UserOperation, token: Address): Promise<PaymasterData>;
  approveTokenForPaymaster(token: Address, amount: bigint): Promise<Hash>;
}

// 2. Subscription Client (신규 개발 필요)
interface SubscriptionClient {
  createSubscription(params: SubscriptionParams): Promise<Hash>;
  cancelSubscription(subscriptionId: Hex): Promise<Hash>;
  getSubscriptionStatus(subscriptionId: Hex): Promise<SubscriptionStatus>;
  grantSubscriptionPermission(params: PermissionParams): Promise<PermissionContext>;
}

// 3. Stealth Payment Client (신규 개발 필요 - s-ca 연동)
interface StealthPaymentClient {
  register(metaAddress: Hex, encryptedViewingKey: Hex): Promise<Hash>;
  deposit(params: DepositParams): Promise<Hash>;
  internalTransfer(params: TransferParams): Promise<Hash>;
  withdraw(params: WithdrawParams): Promise<Hash>;
  getBalance(stealthAddress: Address, token: Address): Promise<bigint>;
}
```

### 7.4 Frontend 애플리케이션

명세서 Section 10.1의 `frontend/` 구조 분석:

```
명세서 요구사항                      구현 필요 항목                       우선순위
─────────────────────────────────────────────────────────────────────────────
frontend/apps/wallet/
├── pages/
│   ├── home/                        잔액 표시, 최근 거래                  P1
│   ├── send/                        일반 전송, Stealth 전송 선택           P1
│   ├── receive/                     QR 코드, Stealth Meta Address          P1
│   ├── settings/                    계정 설정, 모듈 관리                   P2
│   └── subscription/                구독 관리, 권한 부여                   P2
├── components/
│   ├── WalletConnect.tsx            EIP-7702 Authorization UI              P1
│   ├── UserOpConfirm.tsx            UserOp 확인 다이얼로그                 P1
│   ├── GasSelector.tsx              Native/Token 가스비 선택               P1
│   └── StealthAddressInput.tsx      Stealth Address 입력/생성              P2
└── hooks/
    ├── useSmartAccount.ts           Kernel Account 연동                    P1
    ├── usePaymaster.ts              Paymaster 연동                         P1
    └── useStealth.ts                Stealth SDK 연동                       P2

frontend/apps/dapp/
├── 데모 DApp                        구독 결제 데모                         P3
└── 통합 예제                        전체 플로우 시연                       P3
```

---

## 8. 백엔드 서비스 상세 분석

### 8.1 전체 백엔드 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend Services Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │    Bundler      │  │  Subscription   │  │ Stealth Scanner │              │
│  │    Server       │  │    Service      │  │                 │              │
│  │                 │  │                 │  │                 │              │
│  │ • RPC Server    │  │ • Scheduler     │  │ • Event Indexer │              │
│  │ • UserOp Pool   │  │ • Executor      │  │ • DB Storage    │              │
│  │ • Bundle Builder│  │ • DB Storage    │  │ • REST API      │              │
│  │ • Tx Submitter  │  │ • REST API      │  │ • WebSocket     │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         RPC Gateway                                  │    │
│  │  • Load Balancing    • Rate Limiting    • Authentication            │    │
│  │  • Request Routing   • Metrics          • Logging                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                │                                             │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    go-stablenet (Chain Node)                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Bundler 서버

#### 8.2.1 기능 요구사항

| 기능 | 명세서 참조 | 설명 | 복잡도 |
|------|------------|------|--------|
| **RPC Interface** | Section 8.2 | ERC-4337 표준 RPC 메서드 | 중간 |
| **UserOp Pool** | Section 8.1 | 메모리 풀 + 검증 | 높음 |
| **Bundle Builder** | Section 8.1 | 최적 번들 구성 | 높음 |
| **Tx Submitter** | Section 8.1 | 체인 제출 + 재시도 | 중간 |

#### 8.2.2 RPC 메서드 명세

```typescript
// ERC-4337 표준 RPC 메서드
interface BundlerRPC {
  // UserOp 제출
  eth_sendUserOperation(
    userOp: PackedUserOperation,
    entryPoint: Address
  ): Promise<UserOpHash>;

  // Gas 추정
  eth_estimateUserOperationGas(
    userOp: Partial<PackedUserOperation>,
    entryPoint: Address
  ): Promise<GasEstimate>;

  // UserOp 조회
  eth_getUserOperationByHash(hash: Hex): Promise<UserOpInfo | null>;

  // Receipt 조회
  eth_getUserOperationReceipt(hash: Hex): Promise<UserOpReceipt | null>;

  // EntryPoint 목록
  eth_supportedEntryPoints(): Promise<Address[]>;

  // Chain ID
  eth_chainId(): Promise<Hex>;
}

// StableNet 확장 RPC
interface StableNetBundlerRPC extends BundlerRPC {
  // EIP-7702 Authorization 처리
  stablenet_sendUserOperationWithAuth(
    userOp: PackedUserOperation,
    authorization: SetCodeAuthorization,
    entryPoint: Address
  ): Promise<UserOpHash>;
}
```

#### 8.2.3 구현 전략

| 옵션 | 장점 | 단점 | 권장도 |
|------|------|------|--------|
| **Alto 포크** | TypeScript, 활발한 개발 | Pimlico 특화 기능 | ⭐⭐⭐ |
| **Rundler 포크** | Rust, 고성능 | 러닝커브 | ⭐⭐ |
| **자체 구현** | 완전한 커스터마이징 | 개발 비용 높음 | ⭐ |

**권장**: Alto 포크 후 StableNet 특화 기능 추가

```
bundler/
├── src/
│   ├── rpc/
│   │   ├── server.ts               # Express/Fastify 서버
│   │   ├── handlers/
│   │   │   ├── sendUserOp.ts
│   │   │   ├── estimateGas.ts
│   │   │   └── getUserOp.ts
│   │   └── middleware/
│   │       ├── validation.ts
│   │       └── rateLimit.ts
│   ├── pool/
│   │   ├── mempool.ts              # UserOp 메모리 풀
│   │   ├── validator.ts            # UserOp 검증
│   │   └── simulator.ts            # EntryPoint 시뮬레이션
│   ├── builder/
│   │   ├── bundleBuilder.ts        # 번들 구성
│   │   ├── gasOptimizer.ts         # 가스 최적화
│   │   └── conflictDetector.ts     # 충돌 감지
│   ├── submitter/
│   │   ├── txSubmitter.ts          # 트랜잭션 제출
│   │   ├── nonceManager.ts         # Nonce 관리
│   │   └── retryManager.ts         # 재시도 로직
│   └── config/
│       └── index.ts
├── prisma/
│   └── schema.prisma               # 선택적 DB 저장
└── package.json
```

### 8.3 Subscription Service

#### 8.3.1 기능 요구사항

| 기능 | 명세서 참조 | 설명 |
|------|------------|------|
| **Scheduler** | Section 6.3 | 결제 시점 스케줄링 |
| **Executor** | Section 6.3 | UserOp 생성 및 제출 |
| **Permission Manager** | Section 6.1 | ERC-7715 권한 관리 |
| **REST API** | - | 구독 CRUD, 상태 조회 |

#### 8.3.2 상세 설계

```typescript
// subscription-service/src/types.ts
interface Subscription {
  id: string;
  subscriberAddress: Address;      // Smart Account 주소
  recipientAddress: Address;       // 수취인 주소
  tokenAddress: Address;           // 결제 토큰
  amount: bigint;                  // 결제 금액
  interval: number;                // 결제 주기 (초)
  nextPaymentTime: number;         // 다음 결제 시간
  totalLimit: bigint;              // 총 한도
  totalPaid: bigint;               // 누적 결제액
  permissionContext: Hex;          // ERC-7715 권한 컨텍스트
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

// subscription-service/src/scheduler.ts
class SubscriptionScheduler {
  private queue: Queue;            // Bull/BullMQ
  private db: PrismaClient;

  async start(): Promise<void> {
    // 매 분마다 결제 대상 스캔
    this.queue.process('check-payments', async () => {
      const due = await this.getDueSubscriptions();
      for (const sub of due) {
        await this.queue.add('execute-payment', { subscriptionId: sub.id });
      }
    });

    // 결제 실행 처리
    this.queue.process('execute-payment', async (job) => {
      await this.executor.execute(job.data.subscriptionId);
    });
  }
}

// subscription-service/src/executor.ts
class SubscriptionExecutor {
  async execute(subscriptionId: string): Promise<string> {
    const sub = await this.db.subscription.findUnique({ where: { id: subscriptionId } });

    // 1. UserOperation 생성
    const userOp = await this.buildUserOp(sub);

    // 2. 서버 키로 서명 (ERC-7710 delegation)
    const signedOp = await this.signWithServerKey(userOp, sub.permissionContext);

    // 3. Bundler에 제출
    const hash = await this.bundlerClient.sendUserOperation(signedOp);

    // 4. 상태 업데이트
    await this.updateSubscriptionStatus(sub, hash);

    return hash;
  }
}
```

#### 8.3.3 디렉토리 구조

```
subscription-service/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── subscriptions.ts    # CRUD API
│   │   │   └── webhooks.ts         # 결제 결과 웹훅
│   │   └── middleware/
│   │       └── auth.ts
│   ├── scheduler/
│   │   ├── index.ts
│   │   └── jobs/
│   │       ├── checkPayments.ts
│   │       └── executePayment.ts
│   ├── executor/
│   │   ├── index.ts
│   │   ├── userOpBuilder.ts
│   │   └── delegationSigner.ts
│   ├── services/
│   │   └── bundlerClient.ts
│   └── utils/
├── prisma/
│   └── schema.prisma
├── docker-compose.yml              # Redis, PostgreSQL
└── package.json
```

### 8.4 Stealth Scanner

#### 8.4.1 기능 요구사항

| 기능 | 명세서 참조 | 설명 |
|------|------------|------|
| **Event Indexer** | Section 7.3 | Announcement 이벤트 인덱싱 |
| **DB Storage** | - | 효율적인 조회를 위한 저장 |
| **REST API** | - | 사용자별 Announcement 조회 |
| **WebSocket** | - | 실시간 알림 |

#### 8.4.2 상세 설계

```typescript
// stealth-scanner/src/indexer.ts
class AnnouncementIndexer {
  private client: PublicClient;
  private db: PrismaClient;

  async start(fromBlock: bigint): Promise<void> {
    // 과거 이벤트 동기화
    await this.syncHistoricalEvents(fromBlock);

    // 실시간 이벤트 감시
    this.watchNewAnnouncements();
  }

  private async syncHistoricalEvents(fromBlock: bigint): Promise<void> {
    const logs = await this.client.getLogs({
      address: ERC5564_ANNOUNCER_ADDRESS,
      event: AnnouncementEvent,
      fromBlock,
      toBlock: 'latest'
    });

    for (const log of logs) {
      await this.processAnnouncement(log);
    }
  }

  private watchNewAnnouncements(): void {
    this.client.watchContractEvent({
      address: ERC5564_ANNOUNCER_ADDRESS,
      event: AnnouncementEvent,
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.processAnnouncement(log);
          await this.notifyUser(log);
        }
      }
    });
  }

  private async processAnnouncement(log: Log): Promise<void> {
    const { schemeId, stealthAddress, caller, ephemeralPubKey, metadata } = log.args;

    await this.db.announcement.create({
      data: {
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        schemeId,
        stealthAddress,
        caller,
        ephemeralPubKey,
        viewTag: extractViewTag(metadata),
        metadata,
        createdAt: new Date()
      }
    });
  }
}

// stealth-scanner/src/api/routes/announcements.ts
router.get('/announcements/:address', async (req, res) => {
  const { address } = req.params;
  const { viewingKey } = req.query;  // 암호화된 viewing key

  // 1. View Tag로 빠른 필터링 (99.6% 필터링)
  const candidates = await getCandidatesByViewTag(address, viewingKey);

  // 2. 전체 검증 (나머지 0.4%만)
  const verified = await verifyStealthAddresses(candidates, viewingKey);

  res.json({ announcements: verified });
});
```

#### 8.4.3 디렉토리 구조

```
stealth-scanner/
├── src/
│   ├── indexer/
│   │   ├── index.ts
│   │   ├── eventProcessor.ts
│   │   └── blockTracker.ts
│   ├── api/
│   │   ├── routes/
│   │   │   ├── announcements.ts
│   │   │   └── health.ts
│   │   └── websocket/
│   │       └── notifier.ts
│   ├── services/
│   │   ├── viewTagFilter.ts
│   │   └── stealthVerifier.ts
│   └── utils/
├── prisma/
│   └── schema.prisma
└── package.json
```

### 8.5 RPC Gateway

#### 8.5.1 기능 요구사항

| 기능 | 설명 |
|------|------|
| **Load Balancing** | 여러 백엔드 서비스로 분산 |
| **Rate Limiting** | API 호출 제한 |
| **Authentication** | API 키 인증 |
| **Request Routing** | 서비스별 라우팅 |
| **Metrics/Logging** | Prometheus, ELK 연동 |

#### 8.5.2 구현

```typescript
// rpc-gateway/src/index.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Rate Limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

// API Key Authentication
app.use('/api', authenticateApiKey);

// Routing
app.use('/bundler', createProxyMiddleware({
  target: process.env.BUNDLER_URL,
  changeOrigin: true
}));

app.use('/subscription', createProxyMiddleware({
  target: process.env.SUBSCRIPTION_SERVICE_URL,
  changeOrigin: true
}));

app.use('/stealth', createProxyMiddleware({
  target: process.env.STEALTH_SCANNER_URL,
  changeOrigin: true
}));

// Chain RPC Proxy
app.use('/rpc', createProxyMiddleware({
  target: process.env.STABLENET_RPC_URL,
  changeOrigin: true
}));
```

---

## 9. 인프라 및 DevOps

### 9.1 Docker Compose 구성

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Bundler
  bundler:
    build: ./bundler
    ports:
      - "4337:4337"
    environment:
      - ENTRY_POINT_ADDRESS=${ENTRY_POINT_ADDRESS}
      - CHAIN_RPC_URL=http://stablenet:8545
      - PRIVATE_KEY=${BUNDLER_PRIVATE_KEY}
    depends_on:
      - stablenet
      - redis

  # Subscription Service
  subscription-service:
    build: ./subscription-service
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/subscription
      - REDIS_URL=redis://redis:6379
      - BUNDLER_URL=http://bundler:4337
    depends_on:
      - postgres
      - redis
      - bundler

  # Stealth Scanner
  stealth-scanner:
    build: ./stealth-scanner
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/stealth
      - CHAIN_RPC_URL=http://stablenet:8545
    depends_on:
      - postgres
      - stablenet

  # RPC Gateway
  rpc-gateway:
    build: ./rpc-gateway
    ports:
      - "8080:8080"
    environment:
      - BUNDLER_URL=http://bundler:4337
      - SUBSCRIPTION_SERVICE_URL=http://subscription-service:3001
      - STEALTH_SCANNER_URL=http://stealth-scanner:3002
      - STABLENET_RPC_URL=http://stablenet:8545

  # StableNet Node
  stablenet:
    image: go-stablenet:latest
    ports:
      - "8545:8545"
      - "8546:8546"
    volumes:
      - stablenet-data:/data

  # Database
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  # Cache
  redis:
    image: redis:7
    volumes:
      - redis-data:/data

volumes:
  stablenet-data:
  postgres-data:
  redis-data:
```

### 9.2 기술 스택 요약

| 레이어 | 기술 | 용도 |
|--------|------|------|
| **Chain** | go-stablenet | EIP-7702, Fee Delegation |
| **Contracts** | Solidity, Foundry | Smart Account, Paymaster |
| **Bundler** | TypeScript, Node.js | ERC-4337 UserOp 처리 |
| **Backend** | TypeScript, Express/Fastify | REST API, 스케줄링 |
| **Database** | PostgreSQL | 구독, Announcement 저장 |
| **Cache/Queue** | Redis, BullMQ | 작업 큐, 캐싱 |
| **SDK** | TypeScript, viem | 클라이언트 라이브러리 |
| **Frontend** | React, Next.js, wagmi | 지갑 UI |

---

## 10. 개발 로드맵 (수정)

### Phase 1: 핵심 인프라 (Week 1-2)

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| EntryPoint 배포 | Contract | 배포된 EntryPoint 주소 |
| Kernel 배포 | Contract | SmartAccount, Factory 주소 |
| 기본 Bundler | Backend | RPC 서버 (기본 기능) |
| SDK 통합 테스트 | SDK | E2E 테스트 통과 |

### Phase 2: 가스비 대납 (Week 3-4)

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| VerifyingPaymaster | Contract | 컨트랙트 배포 |
| ERC20Paymaster | Contract | 컨트랙트 배포 |
| Paymaster SDK | SDK | Client 라이브러리 |
| Bundler 고도화 | Backend | MEV 보호, 재시도 로직 |

### Phase 3: 구독 시스템 (Week 5-6)

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| SubscriptionModule | Contract | 컨트랙트 배포 |
| Subscription Service | Backend | Scheduler, Executor 서비스 |
| Permission SDK | SDK | ERC-7715/7710 클라이언트 |
| 관리자 API | Backend | REST API |

### Phase 4: Stealth 시스템 (Week 7-8)

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| StealthPaymentContract | Contract | s-ca 컨트랙트 |
| Stealth Scanner | Backend | Indexer, API 서비스 |
| Stealth SDK 통합 | SDK | 통합 클라이언트 |
| 정부 감사 API | Backend | Audit API |

### Phase 5: Frontend & 통합 (Week 9-10)

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| Wallet UI | Frontend | React 애플리케이션 |
| DApp Demo | Frontend | 데모 애플리케이션 |
| RPC Gateway | Backend | 통합 게이트웨이 |
| 문서화 | All | API 문서, 가이드 |

---

## 11. 팀 구성 권장

| 역할 | 인원 | 담당 영역 |
|------|------|-----------|
| **Smart Contract Developer** | 1-2명 | Paymaster, Subscription, Stealth 컨트랙트 |
| **Backend Developer** | 1-2명 | Bundler, Subscription Service, Stealth Scanner |
| **SDK Developer** | 1명 | SDK 통합, 클라이언트 라이브러리 |
| **Frontend Developer** | 1명 | Wallet UI, DApp Demo |
| **DevOps** | 0.5명 | 인프라, CI/CD |

**총 팀 규모**: 4-6명
**예상 기간**: 8-10주

---

## 12. go-stablenet 상세 분석

### 12.1 트랜잭션 타입 지원

go-stablenet은 다음 트랜잭션 타입을 지원합니다:

| 타입 ID | 상수명 | 설명 |
|---------|--------|------|
| 0x00 | `LegacyTxType` | 레거시 트랜잭션 |
| 0x01 | `AccessListTxType` | EIP-2930 Access List |
| 0x02 | `DynamicFeeTxType` | EIP-1559 Dynamic Fee |
| 0x03 | `BlobTxType` | EIP-4844 Blob |
| 0x04 | `SetCodeTxType` | **EIP-7702 Set Code** |
| 0x16 | `FeeDelegateDynamicFeeTxType` | **Fee Delegation** |

### 12.2 EIP-7702 구현 상세 (core/types/tx_setcode.go)

```go
// Delegation Prefix: EOA가 Smart Account로 전환되었음을 나타냄
var DelegationPrefix = []byte{0xef, 0x01, 0x00}

// SetCodeTx: EIP-7702 트랜잭션 구조체
type SetCodeTx struct {
    ChainID    *uint256.Int
    Nonce      uint64
    GasTipCap  *uint256.Int        // maxPriorityFeePerGas
    GasFeeCap  *uint256.Int        // maxFeePerGas
    Gas        uint64
    To         common.Address      // 컨트랙트 생성 불가, 항상 주소 필요
    Value      *uint256.Int
    Data       []byte
    AccessList AccessList
    AuthList   []SetCodeAuthorization  // 핵심: Authorization 목록
    V, R, S    *uint256.Int
}

// SetCodeAuthorization: EOA 소유자의 코드 위임 승인
type SetCodeAuthorization struct {
    ChainID uint256.Int     // 체인 ID
    Address common.Address  // 위임할 Smart Account 주소
    Nonce   uint64          // Authorization Nonce
    V       uint8           // 서명 V
    R       uint256.Int     // 서명 R
    S       uint256.Int     // 서명 S
}

// 주요 함수
func SignSetCode(prv *ecdsa.PrivateKey, auth SetCodeAuthorization) (SetCodeAuthorization, error)
func (a *SetCodeAuthorization) SigHash() common.Hash
func (a *SetCodeAuthorization) Authority() (common.Address, error)
func ParseDelegation(b []byte) (common.Address, bool)
func AddressToDelegation(addr common.Address) []byte
```

### 12.3 Fee Delegation 구현 상세 (core/types/tx_fee_delegation.go)

```go
// FeeDelegateDynamicFeeTx: 가스비 대납 트랜잭션
type FeeDelegateDynamicFeeTx struct {
    SenderTx DynamicFeeTx      // 원본 트랜잭션 (발신자 서명 포함)
    FeePayer *common.Address   // 가스비 대납자 주소
    FV       *big.Int          // 대납자 서명 V
    FR       *big.Int          // 대납자 서명 R
    FS       *big.Int          // 대납자 서명 S
}

// 이중 서명 구조
// 1. 발신자(Sender): 트랜잭션 내용에 서명 (SenderTx.V, R, S)
// 2. 대납자(FeePayer): 트랜잭션 + 자신의 주소에 서명 (FV, FR, FS)
```

### 12.4 WBFT 합의 엔진 (consensus/wbft/)

go-stablenet은 WBFT (Weighted Byzantine Fault Tolerance) 합의 알고리즘을 사용합니다.

```
consensus/wbft/
├── backend/
│   ├── backend.go          # WBFT 백엔드 구현
│   ├── engine.go           # 합의 엔진 핵심 로직
│   └── handler.go          # 메시지 핸들링
├── core/
│   ├── core.go             # 합의 코어 로직
│   ├── prepare.go          # Prepare 단계
│   ├── preprepare.go       # Pre-prepare 단계
│   ├── commit.go           # Commit 단계
│   └── roundchange.go      # Round Change 처리
├── messages/
│   ├── preprepare.go       # Pre-prepare 메시지
│   ├── prepare.go          # Prepare 메시지
│   ├── commit.go           # Commit 메시지
│   └── roundchange.go      # Round Change 메시지
├── validator/
│   ├── validator.go        # Validator 인터페이스
│   └── default.go          # 기본 Validator 구현
└── config.go               # WBFT 설정
```

### 12.5 BLS 서명 지원 (crypto/bls/)

WBFT 합의에서 사용하는 BLS (Boneh-Lynn-Shacham) 서명:

```
crypto/bls/
├── blst/                   # blst 라이브러리 바인딩
│   ├── public_key.go
│   ├── secret_key.go
│   └── signature.go
├── signature_batch.go      # 배치 서명 검증
└── bls.go                  # BLS 인터페이스
```

---

## 13. stealth-7702 상세 분석

### 13.1 프로젝트 개요

stealth-7702는 EIP-7702와 스텔스 주소(ERC-5564/ERC-6538)를 결합한 프라이버시 전송 데모 앱입니다.

**핵심 혁신**: Stealth Account에서 자금을 출금할 때 가스비가 필요한 문제를 EIP-7702 + Paymaster로 해결

### 13.2 기술 스택

```yaml
Frontend:
  - Next.js 14.0.4
  - React 18
  - Chakra UI 2.8.2
  - RainbowKit 2.x

Blockchain:
  - Viem 2.x
  - Wagmi 2.x
  - permissionless 0.2.20 (Pimlico)

Target Network:
  - Odyssey Testnet (Chain ID: 911867)
  - RPC: https://odyssey.ithaca.xyz
```

### 13.3 StealthSuite.sol 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ERC-5564 Announcer: 스텔스 주소 공지
contract StealthAnnouncer {
    event Announcement(
        uint256 indexed schemeId,      // 스킴 ID (SECP256K1 = 0)
        address indexed stealthAddress, // 생성된 스텔스 주소
        address indexed caller,         // 호출자 (송신자)
        bytes ephemeralPubKey,          // 임시 공개키
        bytes metadata                  // View Tag 포함 메타데이터
    );

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}

// ERC-6538 Registry: 스텔스 메타 주소 등록
contract StealthRegistry {
    event KeysRegistered(
        address indexed registrant,     // 등록자
        uint256 indexed schemeId,       // 스킴 ID
        bytes stealthMetaAddress        // 스텔스 메타 주소
    );

    mapping(address => mapping(uint256 => bytes)) private _registry;

    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external;
    function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes memory);
}
```

### 13.4 EIP-7702 + Stealth 통합 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Stealth + EIP-7702 통합 흐름                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 수신자 등록                                                       │
│     ├── Stealth Meta Address 생성 (Spending Key + Viewing Key)      │
│     └── ERC-6538 Registry에 등록                                     │
│                                                                      │
│  2. 송신자 전송                                                       │
│     ├── 수신자의 Stealth Meta Address 조회                           │
│     ├── 임시 키쌍 생성 → Stealth Address 계산                        │
│     ├── Stealth Address로 자금 전송                                  │
│     └── ERC-5564 Announcement 발행 (View Tag 포함)                   │
│                                                                      │
│  3. 수신자 스캔                                                       │
│     ├── Announcement 이벤트 스캔                                     │
│     ├── View Tag로 빠른 필터링 (99.6% 제외)                          │
│     └── 자신의 Stealth Address 발견                                  │
│                                                                      │
│  4. EIP-7702 업그레이드 (핵심!)                                       │
│     ├── Stealth Address EOA → Kernel Smart Account 업그레이드       │
│     ├── SetCodeAuthorization 생성 및 서명                            │
│     └── SetCodeTx (0x04) 제출                                        │
│                                                                      │
│  5. 가스비 없는 출금                                                  │
│     ├── Pimlico Paymaster 연동                                       │
│     ├── UserOperation 생성 (가스비 = 0)                              │
│     └── 자금 출금 (프라이버시 보존!)                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.5 배포 정보

**Odyssey Testnet (Chain ID: 911867)**:

| 컨트랙트 | 주소 | 용도 |
|----------|------|------|
| ERC5564Announcer | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` | 스텔스 주소 공지 |
| ERC6538Registry | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` | 메타 주소 등록 |
| Kernel Implementation | `0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27` | Smart Account 구현체 |
| MultiChainValidator | `0x02d32f9c668C92A60b44825C4f79B501c0F685dA` | 멀티체인 검증기 |

**Paymaster 설정**:
```typescript
{
  type: "pimlico",
  bundlerSlug: "911867"  // Pimlico Bundler URL에서 사용
}
```

### 13.6 StableNet 적용 시 고려사항

1. **체인 설정 추가**: `chain-config/chains.ts`에 StableNet 체인 정보 추가
2. **컨트랙트 배포**: StealthSuite.sol을 StableNet에 배포
3. **Fee Delegation 통합**: go-stablenet의 0x16 트랜잭션과 연동 가능
4. **Paymaster 교체**: Pimlico → StableNet 자체 Paymaster

---

## 14. 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-14 | 1.1 | go-stablenet, stealth-7702 프로젝트 분석 추가 |
| - | 1.0 | 초기 문서 작성 |
