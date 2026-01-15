# ERC-7579 지원 프로젝트 정리

이 문서는 StableNet POC 워크스페이스 내에서 **ERC-7579 (Minimal Modular Smart Accounts)** 표준을 지원하는 프로젝트들을 정리합니다.

## 📋 목차

1. [ERC-7579 지원 프로젝트 목록](#erc-7579-지원-프로젝트-목록)
2. [프로젝트별 상세 정보](#프로젝트별-상세-정보)
3. [ERC-7579 미지원 프로젝트](#erc-7579-미지원-프로젝트)

---

## ERC-7579 지원 프로젝트 목록

| 프로젝트 | 경로 | 지원 수준 | 상태 |
|---------|------|----------|------|
| **kernel** | `/kernel` | ✅ 완전 지원 | 🟢 프로덕션 |
| **stable-poc-contract** | `/stable-poc-contract` | ✅ 완전 지원 | 🟡 PoC |
| **kernel-7579-plugins** | `/kernel-7579-plugins` | ✅ 플러그인 컬렉션 | 🟢 활성 |

---

## 프로젝트별 상세 정보

### 1. kernel

**경로**: `/kernel`

**설명**: ZeroDev에서 개발한 ERC-4337 및 ERC-7579를 완전히 지원하는 모듈러 스마트 계정 구현체입니다.

**ERC-7579 지원 내용**:
- ✅ `IERC7579Account` 인터페이스 구현
- ✅ `IERC7579Modules` 인터페이스 (Validator, Executor, Hook, Fallback, Policy, Signer)
- ✅ 모듈 설치/제거 기능 (`installModule`, `uninstallModule`)
- ✅ 실행 모드 지원 (`execute`, `executeFromExecutor`)
- ✅ 모듈 타입별 관리자 (ValidationManager, ExecutorManager, HookManager, SelectorManager)

**주요 파일**:
```
kernel/src/
├── Kernel.sol                    # 핵심 Smart Account 구현
├── interfaces/
│   ├── IERC7579Account.sol      # ERC-7579 Account 인터페이스
│   └── IERC7579Modules.sol      # ERC-7579 Module 인터페이스
├── core/
│   ├── ValidationManager.sol    # Validator 모듈 관리
│   ├── ExecutorManager.sol      # Executor 모듈 관리
│   ├── HookManager.sol          # Hook 모듈 관리
│   └── SelectorManager.sol      # Fallback 모듈 관리
└── validator/
    ├── ECDSAValidator.sol       # ECDSA 서명 검증기
    ├── WeightedECDSAValidator.sol
    └── MultiChainValidator.sol
```

**버전**: v3.3 (최신)

**라이선스**: MIT

**상태**: 🟢 프로덕션 사용 중 (가장 널리 사용되는 모듈러 스마트 계정)

**참고**: 
- [Kernel GitHub](https://github.com/zerodevapp/kernel)
- [ERC-7579 표준](https://eips.ethereum.org/EIPS/eip-7579)

---

### 2. stable-poc-contract

**경로**: `/stable-poc-contract`

**설명**: StableNet 전용 ERC-7579 모듈러 스마트 계정 구현체로, EIP-7702 지원을 포함합니다.

**ERC-7579 지원 내용**:
- ✅ `IERC7579Account` 인터페이스 구현
- ✅ `IERC7579Module` 인터페이스 (Validator, Executor, Hook, Fallback)
- ✅ 모듈 설치/제거 기능
- ✅ 실행 모드 지원 (단일/배치 실행)
- ✅ 커스텀 모듈 구현 (ECDSAValidator, SpendingLimitHook)

**주요 파일**:
```
stable-poc-contract/src/
├── core/
│   └── SmartAccount.sol         # ERC-7579 Smart Account 구현
├── interfaces/
│   ├── IERC7579Account.sol      # ERC-7579 Account 인터페이스
│   └── IERC7579Module.sol       # ERC-7579 Module 인터페이스
├── modules/
│   ├── validators/
│   │   └── ECDSAValidator.sol   # ECDSA 검증기
│   └── hooks/
│       └── SpendingLimitHook.sol # 지출 한도 훅
└── libraries/
    └── ExecutionLib.sol          # 실행 모드 인코딩
```

**추가 기능**:
- EIP-7702 EOA 위임 지원
- ERC-4337 EntryPoint 통합
- Paymaster 지원 (VerifyingPaymaster, ERC20Paymaster)
- 스텔스 주소 (EIP-5564)
- DEX 통합 (Uniswap V3)

**라이선스**: MIT

**상태**: 🟡 PoC (보안 감사 필요)

**의존성**:
- `kernel` (서브모듈) - ERC-7579 인터페이스 참조
- `account-abstraction` (서브모듈) - ERC-4337 EntryPoint

---

### 3. kernel-7579-plugins

**경로**: `/kernel-7579-plugins`

**설명**: Kernel Smart Account를 위한 ERC-7579 표준 플러그인 컬렉션입니다.

**ERC-7579 지원 내용**:
- ✅ ERC-7579 모듈 타입별 플러그인 구현
- ✅ Validator 플러그인 (WebAuthn, ERC1271)
- ✅ Executor 플러그인 (Recovery Action)
- ✅ Hook 플러그인 (Caller, OnlyEntryPoint, SpendingLimit)
- ✅ Policy 플러그인 (Call, Gas, RateLimit, Signature, Sudo, Timestamp)
- ✅ Signer 플러그인 (ECDSA, WebAuthn, AnySigner)

**플러그인 구조**:
```
kernel-7579-plugins/
├── validators/          # Module Type 1
│   ├── webauthn/        # WebAuthn 검증기
│   └── erc1271/         # ERC-1271 검증기
├── executors/           # Module Type 2
│   └── (없음 - Recovery Action은 Action으로 분류)
├── fallbacks/           # Module Type 3
│   └── (없음)
├── hooks/               # Module Type 4
│   ├── caller/          # Caller 훅
│   ├── onlyEntrypoint/  # EntryPoint 전용 훅
│   └── spendlingLimits/ # 지출 한도 훅
├── policies/            # Module Type 5 (Kernel 확장)
│   ├── call-policy/     # 호출 정책
│   ├── gas/             # 가스 정책
│   ├── ratelimit/       # 속도 제한 정책
│   ├── signature-caller/ # 서명 호출자 정책
│   ├── sudo/            # Sudo 정책
│   └── timestamp/       # 타임스탬프 정책
├── signers/             # Module Type 6 (Kernel 확장)
│   ├── ecdsa/           # ECDSA 서명자
│   ├── webauthn/        # WebAuthn 서명자
│   └── anysigner/       # 범용 서명자
└── actions/             # 커스텀 액션
    └── recovery/        # 복구 액션
```

**배포 주소** (멀티체인):
- ECDSA Signer: `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF`
- WebAuthn Signer: `0x65DEeC8fEe717dc044D0CFD63cCf55F02cCaC2b3`
- Call Policy: `0x9a52283276a0ec8740df50bf01b28a80d880eaf2`
- Gas Policy: `0xaeFC5AbC67FfD258abD0A3E54f65E70326F84b23`
- RateLimit Policy: `0xf63d4139B25c836334edD76641356c6b74C86873`
- Signature Policy: `0xF6A936c88D97E6fad13b98d2FD731Ff17eeD591d`
- Sudo Policy: `0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7`
- Timestamp Policy: `0xB9f8f524bE6EcD8C945b1b87f9ae5C192FdCE20F`
- WebAuthn Validator: `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69`
- Recovery Action: `0xe884C2868CC82c16177eC73a93f7D9E6F3A5DC6E`
- Only EntryPoint Hook: `0xb230f0A1C7C95fa11001647383c8C7a8F316b900`

**라이선스**: MIT (일부 UNLICENSED)

**상태**: 🟢 활성 (공식 플러그인)

**참고**: 
- [Kernel Plugins GitHub](https://github.com/zerodevapp/kernel-7579-plugins)

---

## ERC-7579 미지원 프로젝트

다음 프로젝트들은 ERC-7579를 지원하지 않습니다:

| 프로젝트 | 경로 | 주요 기능 | ERC-7579 지원 |
|---------|------|----------|---------------|
| account-abstraction | `/account-abstraction` | ERC-4337 EntryPoint 구현 | ❌ 미지원 |
| alto | `/alto` | ERC-4337 Bundler | ❌ 미지원 |
| permit2 | `/permit2` | 토큰 승인 표준 | ❌ 미지원 |
| singleton-paymaster | `/singleton-paymaster` | Paymaster 구현 | ❌ 미지원 |
| smart-order-router | `/smart-order-router` | DEX 라우팅 | ❌ 미지원 |
| stealth-address-erc-contracts | `/stealth-address-erc-contracts` | EIP-5564 스텔스 주소 | ❌ 미지원 |
| stealth-address-sdk | `/stealth-address-sdk` | 스텔스 주소 SDK | ❌ 미지원 |
| UniswapX | `/UniswapX` | DEX 프로토콜 | ❌ 미지원 |
| universal-router | `/universal-router` | 범용 라우터 | ❌ 미지원 |
| v3-core | `/v3-core` | Uniswap V3 코어 | ❌ 미지원 |
| zerodev-examples | `/zerodev-examples` | ZeroDev 예제 코드 | ❌ 미지원 (예제만) |
| go-stablenet | `/go-stablenet` | Go 블록체인 노드 | ❌ 미지원 (체인 레벨) |
| erc7677-proxy | `/erc7677-proxy` | ERC-7677 프록시 | ❌ 미지원 |
| sdk | `/sdk` | TypeScript SDK | ⚠️ 간접 지원 (Kernel 래퍼) |
| ai-toolkit | `/ai-toolkit` | AI 도구 모음 | ❌ 미지원 |

---

## ERC-7579 표준 요약

**ERC-7579 (Minimal Modular Smart Accounts)**는 모듈러 스마트 계정을 위한 표준으로, 다음 모듈 타입을 정의합니다:

| Module Type | ID | 설명 | 예시 |
|------------|-----|------|------|
| Validator | 1 | 서명 검증 모듈 | ECDSAValidator, WebAuthnValidator |
| Executor | 2 | 실행 확장 모듈 | RecoveryAction, DEXModule |
| Fallback | 3 | 알 수 없는 함수 호출 처리 | 커스텀 Fallback 핸들러 |
| Hook | 4 | 실행 전/후 훅 | SpendingLimitHook, CallerHook |
| Policy | 5 | 실행 정책 (Kernel 확장) | CallPolicy, GasPolicy |
| Signer | 6 | 서명자 모듈 (Kernel 확장) | ECDSASigner, WebAuthnSigner |

**핵심 인터페이스**:
- `IERC7579Account`: 계정 인터페이스 (`execute`, `installModule`, `uninstallModule` 등)
- `IERC7579Modules`: 모듈 인터페이스 (`IValidator`, `IExecutor`, `IHook`, `IFallback` 등)

**참고 자료**:
- [ERC-7579 EIP](https://eips.ethereum.org/EIPS/eip-7579)
- [ERC-7579 공식 사이트](https://erc7579.com/)

---

## 요약

### ✅ ERC-7579 완전 지원 프로젝트 (3개)

1. **kernel** - 프로덕션 레벨의 완전한 ERC-7579 구현
2. **stable-poc-contract** - StableNet 전용 PoC 구현
3. **kernel-7579-plugins** - Kernel용 플러그인 컬렉션

### 📊 통계

- **지원 프로젝트**: 3개
- **미지원 프로젝트**: 15개 이상
- **간접 지원**: 1개 (sdk - Kernel 래퍼)

### 🔗 프로젝트 간 관계

```
kernel (핵심 구현)
  ├── kernel-7579-plugins (플러그인)
  └── stable-poc-contract (커스텀 구현, kernel 서브모듈 사용)
```

---

**최종 업데이트**: 2024년
**작성자**: AI Assistant