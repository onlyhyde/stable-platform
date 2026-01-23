# StableNet Smart Contracts - 개발 플랜 개요

> **Version**: 1.1
> **Last Updated**: 2026-01-23
> **Status**: In Development

---

## 1. 프로젝트 목표

StableNet 플랫폼의 스마트 컨트랙트 레이어를 구축하여 다음 기능을 지원:

1. **EIP-7702**: EOA를 Smart Account로 업그레이드
2. **ERC-4337**: Account Abstraction 완벽 지원
3. **ERC-7579**: 모듈형 Smart Account 아키텍처
4. **Paymaster**: 가스 대납 및 ERC-20 토큰 결제
5. **Stealth Address**: 프라이버시 보호 전송 (표준 + Enterprise)
6. **DeFi Integration**: Swap, Lending, Staking, Perpetual
7. **Subscription**: 정기 결제 및 권한 위임

---

## 2. 현재 상태 분석

### 2.1 구현 현황

> **참조**: `poc-contract/` 디렉토리 기준 (2026-01-23 업데이트)

| 영역 | 문서화 | SDK/TS | Solidity | 완성도 | 비고 |
|------|--------|--------|----------|--------|------|
| EIP-7702 (Delegation) | ✅ | ✅ 60% | ⚠️ 라이브러리 | 40% | `Eip7702Support.sol` 존재, DelegateKernel 미구현 |
| ERC-4337 (Core) | ✅ | ✅ 70% | ✅ | 80% | EntryPoint, Kernel, Factory 완료 |
| ERC-7579 (Modules) | ✅ | ⚠️ 15% | ✅ | 70% | Validators, Executors, Hooks, Fallbacks 구현 |
| Paymaster | ✅ | ✅ 50% | ✅ | 85% | Verifying, ERC20, Permit2 완료 |
| Stealth (Standard) | ✅ | ✅ 40% | ✅ | 90% | ERC5564, ERC6538, PrivateBank 완료 |
| Stealth (Enterprise) | ✅ | ❌ | ❌ | 0% | StealthVault, StealthLedger 미구현 |
| DeFi | ✅ | ⚠️ 20% | ⚠️ 30% | 35% | PriceOracle, DEXIntegration 구현 |
| Subscription | ✅ | ❌ | ✅ | 80% | SubscriptionManager, ERC7715 완료 |
| **Bridge** | ❌ | ❌ | ✅ | 70% | SecureBridge 등 구현 (문서화 필요) |
| **Compliance** | ❌ | ❌ | ✅ | 80% | KYCRegistry 등 구현 (문서화 필요) |
| **Tokens** | ❌ | ❌ | ✅ | 90% | StableToken, WKRW 구현 (문서화 필요) |

### 2.2 Gap 분석

#### Critical Gaps (P0)
- ~~Solidity 컨트랙트 전무~~ → **대부분 구현 완료**
- ~~Foundry 개발환경 미구축~~ → **구축 완료**
- **DelegateKernel.sol** (EIP-7702 전용 Account) 미구현
- **DelegationRegistry.sol** 미구현

#### High Priority Gaps (P1)
- Enterprise Stealth 컨트랙트 전무 (StealthVault, StealthLedger, WithdrawalManager, RoleManager)
- 문서에 없는 구현체 문서화 필요 (Bridge, Compliance, Tokens)

#### Medium Priority Gaps (P2)
- DeFi 컨트랙트 일부 미구현 (SwapRouter, LendingPool, StakingVault)
- 테스트넷 배포 및 SDK 연동

---

## 3. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        StableNet Contract Architecture                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                          Layer 1: Core                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │  EntryPoint  │  │    Kernel    │  │     KernelFactory        │ │ │
│  │  │   v0.7       │  │   v0.3.3     │  │                          │ │ │
│  │  │ (Canonical)  │  │              │  │  + DelegateKernel        │ │ │
│  │  │  (ERC-4337)  │  │ (ERC-7579)   │  │    (EIP-7702) [TODO]     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  │  * EntryPoint는 Canonical 사용 (0x0000000071727De22E5E9d8BAf0edAc6f37da032) │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       Layer 2: Modules (ERC-7579)                   │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │ │
│  │  │ Validators │  │ Executors  │  │   Hooks    │  │ Fallbacks  │  │ │
│  │  │ - ECDSA    │  │ - Session  │  │ - Spending │  │ - Token    │  │ │
│  │  │ - WebAuthn │  │ - Recurring│  │ - Audit    │  │   Receiver │  │ │
│  │  │ - MultiSig │  │            │  │            │  │ - FlashLoan│  │ │
│  │  │ - MultiChn │  ├────────────┤  └────────────┘  └────────────┘  │ │
│  │  │ - Weighted │  │  Plugins   │                                   │ │
│  │  └────────────┘  │ - AutoSwap │                                   │ │
│  │                  │ - MicroLoan│                                   │ │
│  │                  │ - OnRamp   │                                   │ │
│  │                  └────────────┘                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Layer 3: Paymaster                           │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │ │
│  │  │VerifyingPaymaster│  │  ERC20Paymaster  │  │ Permit2Paymaster │ │ │
│  │  │  (가스비 대납)    │  │  (토큰 결제)     │  │ (승인 없는 결제) │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────────────┐   │ │
│  │  │ PriceOracle (Chainlink + Uniswap V3 TWAP 통합)              │   │ │
│  │  └────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Layer 4: Privacy                             │ │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐ │ │
│  │  │     Standard Stealth ✅     │  │  Enterprise Stealth [TODO]  │ │ │
│  │  │  - ERC5564Announcer         │  │  - StealthVault             │ │ │
│  │  │  - ERC6538Registry          │  │  - StealthLedger            │ │ │
│  │  │  - PrivateBank              │  │  - WithdrawalManager        │ │ │
│  │  └─────────────────────────────┘  └─────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       Layer 5: DeFi & Extensions                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
│  │  │  DEX     │  │ Lending  │  │ Staking  │  │  Subscription    │  │ │
│  │  │Integratn │  │  [TODO]  │  │ [TODO]   │  │    Manager ✅    │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Layer 6: Infrastructure ✅                      │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │ │
│  │  │   SecureBridge   │  │   Compliance     │  │     Tokens       │ │ │
│  │  │ - BridgeValidator│  │ - KYCRegistry    │  │ - StableToken    │ │ │
│  │  │ - RateLimiter    │  │ - AuditLogger    │  │ - WKRW           │ │ │
│  │  │ - Guardian       │  │ - ProofOfReserve │  │                  │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 구현 상태 범례
- ✅ : 구현 완료
- [TODO] : 문서화 완료, 구현 대기
- Layer 6 (Infrastructure): 문서에 없었으나 poc-contract에 구현됨

---

## 4. Phase 구성

### Phase 1: Core Foundation (1-2주)
**목표**: ERC-4337 핵심 인프라 구축

| 컴포넌트 | 설명 | 상세 문서 |
|----------|------|-----------|
| EntryPoint | ERC-4337 v0.7 진입점 | [specs/EntryPoint.md](./specs/EntryPoint.md) |
| Kernel | ERC-7579 Smart Account | [specs/Kernel.md](./specs/Kernel.md) |
| KernelFactory | Account 생성 팩토리 | [specs/KernelFactory.md](./specs/KernelFactory.md) |
| DelegateKernel | EIP-7702 Delegation | [specs/DelegateKernel.md](./specs/DelegateKernel.md) |
| ECDSAValidator | 기본 서명 검증 | [specs/ECDSAValidator.md](./specs/ECDSAValidator.md) |

📄 **상세 문서**: [01_PHASE1_CORE.md](./01_PHASE1_CORE.md)

---

### Phase 2: Paymaster & Modules (2-3주)
**목표**: 가스 대납 및 모듈 시스템 구현

| 컴포넌트 | 설명 | 상세 문서 |
|----------|------|-----------|
| VerifyingPaymaster | 서명 기반 스폰서십 | [specs/VerifyingPaymaster.md](./specs/VerifyingPaymaster.md) |
| ERC20Paymaster | 토큰 결제 | [specs/ERC20Paymaster.md](./specs/ERC20Paymaster.md) |
| SessionKeyExecutor | 세션 키 실행 | [specs/SessionKeyExecutor.md](./specs/SessionKeyExecutor.md) |
| SpendingLimitHook | 지출 한도 | [specs/SpendingLimitHook.md](./specs/SpendingLimitHook.md) |
| WebAuthnValidator | Passkey 인증 | [specs/WebAuthnValidator.md](./specs/WebAuthnValidator.md) |
| MultiSigValidator | 다중 서명 | [specs/MultiSigValidator.md](./specs/MultiSigValidator.md) |

📄 **상세 문서**: [02_PHASE2_PAYMASTER_MODULES.md](./02_PHASE2_PAYMASTER_MODULES.md)

---

### Phase 3: Privacy (2-3주)
**목표**: 표준 및 Enterprise Stealth Address 구현

| 컴포넌트 | 설명 | 상세 문서 |
|----------|------|-----------|
| ERC5564Announcer | Stealth 공지 | [specs/ERC5564Announcer.md](./specs/ERC5564Announcer.md) |
| ERC6538Registry | Meta-Address 등록 | [specs/ERC6538Registry.md](./specs/ERC6538Registry.md) |
| PrivateBank | 표준 Stealth 전송 | [specs/PrivateBank.md](./specs/PrivateBank.md) |
| StealthVault | Enterprise 자금 예치 | [specs/StealthVault.md](./specs/StealthVault.md) |
| StealthLedger | On-chain 원장 | [specs/StealthLedger.md](./specs/StealthLedger.md) |
| WithdrawalManager | Multi-sig 출금 | [specs/WithdrawalManager.md](./specs/WithdrawalManager.md) |

📄 **상세 문서**: [03_PHASE3_PRIVACY.md](./03_PHASE3_PRIVACY.md)

---

### Phase 4: DeFi & Extensions (3-4주)
**목표**: DeFi 통합 및 확장 기능

| 컴포넌트 | 설명 | 상세 문서 |
|----------|------|-----------|
| SwapRouter | DEX 통합 | [specs/SwapRouter.md](./specs/SwapRouter.md) |
| PriceOracle | 가격 오라클 | [specs/PriceOracle.md](./specs/PriceOracle.md) |
| LendingPool | 대출 풀 | [specs/LendingPool.md](./specs/LendingPool.md) |
| StakingVault | 스테이킹 | [specs/StakingVault.md](./specs/StakingVault.md) |
| SubscriptionManager | 정기 결제 | [specs/SubscriptionManager.md](./specs/SubscriptionManager.md) |

📄 **상세 문서**: [04_PHASE4_DEFI_EXTENSIONS.md](./04_PHASE4_DEFI_EXTENSIONS.md)

---

### Phase 5: Integration (5-6주)
**목표**: 종합 테스트, 보안 검증, SDK 연동, 배포

📄 **상세 문서**: [05_PHASE5_INTEGRATION.md](./05_PHASE5_INTEGRATION.md)

---

## 5. 파일 구조

> **참조**: `poc-contract/` 실제 구조 기준 (2026-01-23 업데이트)

```
poc-contract/
├── foundry.toml                    # Foundry 설정
├── remappings.txt                  # Import 매핑
│
├── src/
│   │
│   ├── erc4337-entrypoint/         # Phase 1 - Core ✅
│   │   ├── EntryPoint.sol
│   │   ├── Eip7702Support.sol      # EIP-7702 라이브러리
│   │   ├── NonceManager.sol
│   │   ├── SenderCreator.sol
│   │   ├── StakeManager.sol
│   │   ├── UserOperationLib.sol
│   │   ├── Helpers.sol
│   │   ├── interfaces/
│   │   │   ├── IAccount.sol
│   │   │   ├── IEntryPoint.sol
│   │   │   ├── IPaymaster.sol
│   │   │   └── PackedUserOperation.sol
│   │   └── utils/
│   │       └── Exec.sol
│   │
│   ├── erc7579-smartaccount/       # Phase 1 - Smart Account ✅
│   │   ├── Kernel.sol              # v0.3.3
│   │   ├── core/
│   │   │   ├── ExecutorManager.sol
│   │   │   ├── HookManager.sol
│   │   │   ├── SelectorManager.sol
│   │   │   └── ValidationManager.sol
│   │   ├── factory/
│   │   │   ├── KernelFactory.sol
│   │   │   └── FactoryStaker.sol
│   │   ├── interfaces/
│   │   │   ├── IERC7579Account.sol
│   │   │   └── IERC7579Modules.sol
│   │   ├── types/
│   │   │   ├── Constants.sol
│   │   │   ├── Structs.sol
│   │   │   └── Types.sol
│   │   └── utils/
│   │       ├── ExecLib.sol
│   │       ├── ModuleLib.sol
│   │       └── ValidationTypeLib.sol
│   │
│   ├── erc7579-validators/         # Phase 1-2 - Validators ✅
│   │   ├── ECDSAValidator.sol
│   │   ├── WebAuthnValidator.sol
│   │   ├── MultiSigValidator.sol
│   │   ├── MultiChainValidator.sol     # 추가 (문서화 필요)
│   │   └── WeightedECDSAValidator.sol  # 추가 (문서화 필요)
│   │
│   ├── erc7579-executors/          # Phase 2 - Executors ✅
│   │   ├── SessionKeyExecutor.sol
│   │   └── RecurringPaymentExecutor.sol
│   │
│   ├── erc7579-hooks/              # Phase 2 - Hooks ✅
│   │   ├── SpendingLimitHook.sol
│   │   └── AuditHook.sol
│   │
│   ├── erc7579-fallbacks/          # Phase 2 - Fallbacks ✅ (문서화 필요)
│   │   ├── TokenReceiverFallback.sol   # ERC-721/1155/777 수신
│   │   └── FlashLoanFallback.sol       # Flash Loan 콜백
│   │
│   ├── erc7579-plugins/            # Phase 2 - Plugins ✅ (문서화 필요)
│   │   ├── AutoSwapPlugin.sol      # DCA, Limit Order, Stop Loss
│   │   ├── MicroLoanPlugin.sol     # 소액 대출
│   │   └── OnRampPlugin.sol        # Fiat-to-Crypto
│   │
│   ├── erc4337-paymaster/          # Phase 2 - Paymaster ✅
│   │   ├── BasePaymaster.sol
│   │   ├── VerifyingPaymaster.sol
│   │   ├── ERC20Paymaster.sol
│   │   ├── Permit2Paymaster.sol
│   │   ├── SponsorPaymaster.sol    # 추가 (문서화 필요)
│   │   └── interfaces/
│   │       ├── IPriceOracle.sol
│   │       └── IPermit2.sol
│   │
│   ├── privacy/                    # Phase 3 - Standard Stealth ✅
│   │   ├── ERC5564Announcer.sol
│   │   ├── ERC6538Registry.sol
│   │   └── PrivateBank.sol
│   │   # Note: Enterprise Stealth (StealthVault, StealthLedger 등) 미구현
│   │
│   ├── defi/                       # Phase 4 - DeFi ⚠️
│   │   ├── PriceOracle.sol         # Chainlink + TWAP 통합 ✅
│   │   ├── DEXIntegration.sol      # Uniswap V3 통합 ✅
│   │   └── interfaces/
│   │       └── UniswapV3.sol
│   │   # Note: SwapRouter, LendingPool, StakingVault 미구현
│   │
│   ├── subscription/               # Phase 4 - Subscription ✅
│   │   ├── SubscriptionManager.sol
│   │   └── ERC7715PermissionManager.sol
│   │
│   ├── bridge/                     # Infrastructure - Bridge ✅ (문서화 필요)
│   │   ├── SecureBridge.sol        # MPC + Optimistic 검증
│   │   ├── BridgeValidator.sol     # 5-of-7 MPC 서명
│   │   ├── BridgeRateLimiter.sol   # 볼륨 제한
│   │   ├── BridgeGuardian.sol      # 긴급 대응
│   │   ├── OptimisticVerifier.sol  # 6h 챌린지
│   │   └── FraudProofVerifier.sol  # 사기 증명
│   │
│   ├── compliance/                 # Infrastructure - Compliance ✅ (문서화 필요)
│   │   ├── KYCRegistry.sol         # KYC 상태 관리
│   │   ├── AuditLogger.sol         # 감사 로그
│   │   ├── RegulatoryRegistry.sol  # 규제 기관 레지스트리
│   │   └── ProofOfReserve.sol      # 준비금 증명
│   │
│   └── tokens/                     # Infrastructure - Tokens ✅ (문서화 필요)
│       ├── StableToken.sol         # USDC (6 decimals)
│       └── WKRW.sol                # Wrapped KRW
│
├── lib/                            # Foundry 의존성
│   ├── forge-std/
│   ├── solady/
│   └── openzeppelin-contracts/
│
├── test/                           # 테스트 ✅
│   ├── erc4337-entrypoint/
│   ├── erc4337-paymaster/
│   ├── erc7579-smartaccount/
│   ├── erc7579-validators/
│   ├── erc7579-executors/
│   ├── erc7579-plugins/
│   ├── hooks/
│   ├── fallbacks/
│   ├── privacy/
│   ├── defi/
│   ├── subscription/
│   ├── bridge/
│   ├── compliance/
│   └── mocks/
│
├── script/                         # 배포 스크립트
│   ├── DeployAll.s.sol
│   ├── DeployKernel.s.sol
│   ├── DeployPrivacy.s.sol
│   ├── DeployBridge.s.sol
│   ├── DeployCompliance.s.sol
│   └── DeployTokens.s.sol
│
└── deployments/                    # 배포 결과
    └── anvil.json
```

### 5.1 구현 상태 요약

| 디렉토리 | 상태 | 문서화 |
|----------|------|--------|
| erc4337-entrypoint/ | ✅ 완료 | ✅ |
| erc7579-smartaccount/ | ✅ 완료 | ✅ |
| erc7579-validators/ | ✅ 완료 | ⚠️ 부분 (2개 추가 필요) |
| erc7579-executors/ | ✅ 완료 | ✅ |
| erc7579-hooks/ | ✅ 완료 | ✅ |
| erc7579-fallbacks/ | ✅ 완료 | ❌ 문서화 필요 |
| erc7579-plugins/ | ✅ 완료 | ❌ 문서화 필요 |
| erc4337-paymaster/ | ✅ 완료 | ✅ |
| privacy/ | ⚠️ Standard만 | ✅ |
| defi/ | ⚠️ 부분 | ⚠️ 부분 |
| subscription/ | ✅ 완료 | ✅ |
| bridge/ | ✅ 완료 | ❌ 문서화 필요 |
| compliance/ | ✅ 완료 | ❌ 문서화 필요 |
| tokens/ | ✅ 완료 | ❌ 문서화 필요 |

---

## 6. 기술 스택

| 카테고리 | 도구 |
|----------|------|
| **Language** | Solidity 0.8.24+ |
| **Framework** | Foundry (Forge, Cast, Anvil) |
| **Libraries** | OpenZeppelin, Solady, account-abstraction |
| **Testing** | Forge Test, Invariant Tests |
| **Linting** | Solhint, Slither |
| **Deployment** | Forge Script |

---

## 7. 의존성

### External Contracts (Import/Reference)
- `eth-infinitism/account-abstraction` - EntryPoint v0.7 인터페이스
  - **주의**: EntryPoint 컨트랙트는 배포하지 않고 Canonical 주소 사용
  - Canonical EntryPoint: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- `zerodev/kernel` - Kernel v3.1 참조 (아키텍처 참고)
- `vectorized/solady` - 가스 최적화 라이브러리
- `openzeppelin/contracts` - 보안 유틸리티 (AccessControl, ReentrancyGuard 등)

### Internal SDK Integration
- `@stablenet/core` - SDK 클라이언트
- `@stablenet/contracts` - ABI 및 주소 관리
- `@stablenet/plugin-*` - SDK 플러그인

---

## 8. 일정 및 작업량 요약

### 8.1 Phase별 시간 추정

| Phase | 설명 | Tasks | 예상 시간 | 기간 |
|-------|------|-------|-----------|------|
| Phase 1 | Core Foundation | ~50 | ~84h | 2주 |
| Phase 2 | Paymaster & Modules | ~60 | ~140h | 3주 |
| Phase 3 | Privacy (Standard + Enterprise) | ~45 | ~87h | 3주 |
| Phase 4 | DeFi & Extensions | ~26 | ~129h | 3-4주 |
| Phase 5 | Integration & Deployment | ~31 | ~222h | 5-6주 |
| **Total** | | **~212 tasks** | **~662h** | **16-18주** |

### 8.2 Timeline

```
Week 1-2:   Phase 1 (Core) ━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 3-5:   Phase 2 (Paymaster & Modules) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 6-8:   Phase 3 (Privacy) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 9-12:  Phase 4 (DeFi & Extensions) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 13-18: Phase 5 (Integration) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8.3 우선순위 Matrix

| 우선순위 | 항목 | Phase |
|----------|------|-------|
| **P0 (Critical)** | EntryPoint, Kernel, Factory, ECDSAValidator | 1 |
| **P0 (Critical)** | VerifyingPaymaster, Unit Tests | 2, 5 |
| **P1 (High)** | DelegateKernel (EIP-7702), ERC20Paymaster | 1, 2 |
| **P1 (High)** | Standard Stealth, Security Tests | 3, 5 |
| **P2 (Medium)** | Enterprise Stealth, DeFi Modules | 3, 4 |
| **P2 (Medium)** | Additional Validators/Hooks | 2 |
| **P3 (Low)** | Perpetual Trading, Advanced Features | 4 |

---

## 9. 관련 문서

### Phase 상세 문서
- [01_PHASE1_CORE.md](./01_PHASE1_CORE.md)
- [02_PHASE2_PAYMASTER_MODULES.md](./02_PHASE2_PAYMASTER_MODULES.md)
- [03_PHASE3_PRIVACY.md](./03_PHASE3_PRIVACY.md)
- [04_PHASE4_DEFI_EXTENSIONS.md](./04_PHASE4_DEFI_EXTENSIONS.md)
- [05_PHASE5_INTEGRATION.md](./05_PHASE5_INTEGRATION.md)

### 컨트랙트 스펙 (specs/)
- [EntryPoint.md](./specs/EntryPoint.md)
- [Kernel.md](./specs/Kernel.md)
- [KernelFactory.md](./specs/KernelFactory.md)
- [DelegateKernel.md](./specs/DelegateKernel.md)
- *...기타 스펙 문서*

### 기존 문서
- [../poc/02_Smart_Contracts.md](../poc/02_Smart_Contracts.md) - 원본 스펙
- [../poc/09_Implementation_Plan.md](../poc/09_Implementation_Plan.md) - SDK/서비스 구현 플랜

---

## 10. 추가 구현 컴포넌트 (문서화 필요)

> poc-contract에 구현되었으나 기존 Phase 문서에 없는 컴포넌트

### 10.1 Bridge 시스템 (`bridge/`)

크로스체인 자산 이동을 위한 보안 브릿지 시스템.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| SecureBridge | `SecureBridge.sol` | 메인 브릿지 컨트랙트 (Defense-in-depth) |
| BridgeValidator | `BridgeValidator.sol` | 5-of-7 MPC 다중 서명 검증 |
| BridgeRateLimiter | `BridgeRateLimiter.sol` | 볼륨 기반 Rate Limiting |
| BridgeGuardian | `BridgeGuardian.sol` | 긴급 상황 대응 (Pause, 자산 동결) |
| OptimisticVerifier | `OptimisticVerifier.sol` | 6시간 챌린지 기간 Optimistic 검증 |
| FraudProofVerifier | `FraudProofVerifier.sol` | 사기 증명 및 분쟁 해결 |

**보안 레이어**:
1. MPC Signing (5-of-7 threshold)
2. Optimistic Verification (6h challenge period)
3. Fraud Proofs (dispute resolution)
4. Rate Limiting (volume controls)
5. Guardian System (emergency response)

---

### 10.2 Compliance 시스템 (`compliance/`)

규제 준수를 위한 KYC/AML 및 감사 시스템.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| KYCRegistry | `KYCRegistry.sol` | KYC 상태 관리 (NONE/PENDING/VERIFIED/REJECTED/EXPIRED) |
| AuditLogger | `AuditLogger.sol` | 온체인 감사 로그 기록 |
| RegulatoryRegistry | `RegulatoryRegistry.sol` | 규제 기관 및 규정 레지스트리 |
| ProofOfReserve | `ProofOfReserve.sol` | 준비금 증명 (Chainlink PoR 연동) |

**지원 기능**:
- KYC Status: NONE, PENDING, VERIFIED, REJECTED, EXPIRED
- Risk Level: LOW, MEDIUM, HIGH, PROHIBITED
- Sanctions List: OFAC, UN, EU, Other
- Multi-jurisdiction support

---

### 10.3 Tokens (`tokens/`)

플랫폼 토큰 구현.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| StableToken | `StableToken.sol` | USD 페깅 스테이블코인 (USDC, 6 decimals) |
| WKRW | `WKRW.sol` | Wrapped KRW (한국 원화) |

**기능**:
- Minter role 기반 민팅
- Blacklist 기능 (규제 준수)
- Pausable (긴급 상황)
- ERC-4337 Paymaster 호환

---

### 10.4 ERC-7579 Plugins (`erc7579-plugins/`)

Smart Account 확장 플러그인.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| AutoSwapPlugin | `AutoSwapPlugin.sol` | 자동 스왑 (DCA, Limit Order, Stop Loss, Take Profit) |
| MicroLoanPlugin | `MicroLoanPlugin.sol` | 소액 대출 |
| OnRampPlugin | `OnRampPlugin.sol` | Fiat-to-Crypto 온램프 |

**AutoSwapPlugin 주문 타입**:
- DCA (Dollar Cost Averaging)
- LIMIT_BUY / LIMIT_SELL
- STOP_LOSS
- TAKE_PROFIT
- TRAILING_STOP

---

### 10.5 ERC-7579 Fallbacks (`erc7579-fallbacks/`)

Smart Account Fallback 모듈.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| TokenReceiverFallback | `TokenReceiverFallback.sol` | ERC-721/1155/777 토큰 수신 콜백 |
| FlashLoanFallback | `FlashLoanFallback.sol` | Flash Loan 콜백 지원 |

**TokenReceiverFallback 지원**:
- `onERC721Received` (ERC-721)
- `onERC1155Received`, `onERC1155BatchReceived` (ERC-1155)
- `tokensReceived` (ERC-777)
- 토큰 Whitelist/Blacklist
- Transfer 로깅 (규제 준수)

---

### 10.6 추가 Validators (`erc7579-validators/`)

기존 문서에 없는 추가 Validator.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| MultiChainValidator | `MultiChainValidator.sol` | 멀티체인 서명 검증 (Merkle Proof) |
| WeightedECDSAValidator | `WeightedECDSAValidator.sol` | 가중치 기반 ECDSA 검증 |

---

### 10.7 추가 Paymaster (`erc4337-paymaster/`)

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| SponsorPaymaster | `SponsorPaymaster.sol` | 스폰서 기반 가스비 대납 |

---

### 10.8 PriceOracle 구조 변경

**문서 (분리 구조)**:
```
interfaces/IPriceOracle.sol (Phase 2)
paymasters/TWAPOracle.sol   (Phase 2, 개발/테스트)
oracles/ChainlinkOracle.sol (Phase 4, 프로덕션)
```

**실제 코드 (통합 구조)**:
```
erc4337-paymaster/interfaces/IPriceOracle.sol
defi/PriceOracle.sol  # Chainlink + TWAP 통합
```

**차이점**:
- 코드는 Chainlink와 Uniswap V3 TWAP를 단일 `PriceOracle.sol`에 통합
- Chainlink 우선, TWAP Fallback 구조
- Staleness 검사 포함
- 문서 업데이트 또는 코드 분리 필요 (선택)

---

## 11. 공통 고려사항

### 11.1 가스 최적화 전략

| 기법 | 적용 대상 | 예상 절감 |
|------|----------|----------|
| Solady 라이브러리 | ECDSA, SafeTransfer | 10-20% |
| Packed Storage | Module configs, timestamps | 15-30% |
| Calldata 최적화 | UserOp 파라미터 | 5-10% |
| Short-circuit 검증 | Validator/Hook 체인 | 변동적 |

### 11.2 업그레이드 전략

- **Kernel**: ERC-1967 Proxy 패턴, implementation 교체 가능
- **Modules**: 개별 설치/제거, 무중단 업데이트
- **Paymaster**: 새 버전 배포 후 마이그레이션
- **EntryPoint**: Canonical이므로 업그레이드 불필요

### 11.3 Emergency Procedures

| 시나리오 | 대응 방안 |
|----------|----------|
| 심각한 취약점 발견 | Pausable 모듈 비활성화, 새 버전 배포 |
| Paymaster 악용 | deposit 동결, 서비스 일시 중단 |
| Oracle 오작동 | Fallback Oracle 활성화, 수동 가격 설정 |
| Multi-sig 키 분실 | Recovery 모듈, 타임락 기반 복구 |

### 11.4 보안 감사 체크리스트

- [ ] Slither 정적 분석 통과
- [ ] Foundry Fuzz 테스트 (1000+ runs)
- [ ] Echidna invariant 테스트
- [ ] 외부 감사 (권장: Trail of Bits, OpenZeppelin)
- [ ] Bug Bounty 프로그램 설정

---

*문서 끝*
