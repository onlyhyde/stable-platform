# StableNet POC 저장소 분석 문서

> 작성일: 2026-01-13
> 최종 수정: 2026-01-13
> 분석 대상: `/poc/` 디렉토리

## 개요

StableNet POC 저장소는 **Account Abstraction(AA)**과 **Privacy** 기능을 구현하기 위한 완전한 기술 스택을 포함합니다. 총 **10개의 서브프로젝트**로 구성되어 있으며, Ethereum 표준(EIP-4337, EIP-5564, EIP-6538, EIP-7579, EIP-7702)을 기반으로 합니다.

---

## 프로젝트 구조

```
/poc/
├── go-stablenet/                    # 🆕 go-ethereum 포크 (EIP-7702, Fee Delegation)
├── kernel/                          # ERC-4337 스마트 계정 핵심 구현
├── sdk/                             # ZeroDev SDK v5 (모노레포, 19개 플러그인)
├── stealth-7702/                    # 🆕 EIP-7702 + 스텔스 주소 데모 앱
├── stealth-address-sdk/             # 스텔스 주소 TypeScript SDK
├── stealth-address-erc-contracts/   # ERC-5564/6538 컨트랙트 정규 구현
├── stable-poc-contract/             # StableNet 스마트 계정 컨트랙트
├── kernel-7579-plugins/             # ERC-7579 플러그인 모음
├── zerodev-examples/                # 31개 사용 예제
├── stable-platform/                 # 설계 문서 (KRW L1)
├── EIPs/ (symlink)                  # Ethereum Enhancement Proposals 참조
└── RIPs/ (symlink)                  # Rollup Improvement Proposals 참조
```

---

## 서브프로젝트 상세

### 1. kernel

**목적**: ERC-4337 Account Abstraction을 위한 고성능 모듈러 스마트 계정 구현

| 항목 | 내용 |
|------|------|
| 타입 | Solidity 스마트 컨트랙트 |
| 기술스택 | Solidity 0.8.x, Foundry, Hardhat |
| 라이선스 | MIT |
| 상태 | ✅ 프로덕션 (v3.3) |

**핵심 기능**:
- ERC-4337 EntryPoint 통합
- ERC-7579 모듈러 플러그인 시스템 (validators, executors, fallbacks, hooks)
- 세션 키 및 멀티시그 검증기 지원
- 가스 최적화 설계

**주요 컨트랙트**:
- `Kernel.sol` - 핵심 스마트 계정 구현
- `KernelFactory.sol` / `MetaFactory.sol` - 계정 배포 팩토리
- `ECDSAValidator.sol` - 서명 검증 모듈

**배포 현황**: Mainnet, Arbitrum, Optimism, Base, Polygon, Scroll, Sepolia, Holešky 등 12+ 체인

---

### 2. sdk (ZeroDev SDK v5)

**목적**: ERC-4337 Account Abstraction 앱 개발을 위한 종합 SDK

| 항목 | 내용 |
|------|------|
| 타입 | TypeScript/JavaScript 모노레포 |
| 기술스택 | TypeScript, Bun, Viem |
| 라이선스 | MIT |
| 상태 | ✅ 프로덕션 |

**모노레포 구조**:
```
packages/
├── core/              # 메인 SDK (@zerodev/sdk)
│   ├── accounts/      # Kernel v1, v2, v3 계정 구현
│   ├── actions/       # 계정 작업 함수
│   ├── clients/       # BundlerClient, PaymasterClient, SignerClient
│   └── providers/     # EIP-1193 호환 지갑 프로바이더
└── test/              # E2E 테스트

plugins/               # 19개 플러그인
├── ecdsa/             # ECDSA 서명 검증
├── permission/        # 권한 기반 접근 제어
├── session-key/       # 세션 키 관리
├── webauthn-key/      # WebAuthn/Passkey 지원
├── weighted-*/        # 멀티시그 검증기
├── multi-chain-*/     # 크로스체인 검증기
└── hooks/             # 스마트 컨트랙트 훅
```

**플러그인 목록** (19개):
1. ecdsa - 기본 ECDSA 검증기
2. multi-chain-ecdsa - 크로스체인 ECDSA
3. multi-chain-web-authn - 크로스체인 WebAuthn
4. multi-chain-weighted-validator - 크로스체인 멀티시그
5. multi-tenant-session-account - 세션 관리
6. webauthn-key - Passkey/WebAuthn 지원
7. session-key - 세션 키 생성 및 검증
8. permission (modularPermission) - 세분화된 권한
9. hooks - pre/post 실행 훅
10. weighted-ecdsa - 가중치 멀티시그
11. weighted-r1-k1 - 대체 서명 곡선
12. passkey - Passkey 통합
13. remoteSigner - 원격 서명
14. social - 소셜 복구
15. react-native-passkeys-utils - 모바일 유틸리티
16. smart-account - 기본 스마트 계정
17. wallet - 지갑 통합
18. walletconnect - WalletConnect 프로토콜
19. intent - Intent 기반 실행

---

### 3. stealth-address-sdk

**목적**: EIP-5564/6538 스텔스 주소를 위한 TypeScript SDK

| 항목 | 내용 |
|------|------|
| 타입 | TypeScript SDK |
| 기술스택 | TypeScript, Bun, Viem, @noble/secp256k1 |
| 라이선스 | MIT (ScopeLift) |
| 상태 | ✅ 프로덕션 (Beta v1.0) |

**핵심 API**:
- `generateStealthAddress()` - 스텔스 주소 생성
- `computeStealthKey()` - 지출 키 파생
- `checkStealthAddress()` - 발표가 사용자 대상인지 확인
- `getAnnouncements()` - 온체인 발표 조회
- `getAnnouncementsForUser()` - 사용자별 발표 필터링
- `watchAnnouncementsForUser()` - 새 발표 구독
- `prepareAnnounce()` - 발표 트랜잭션 준비
- `getStealthMetaAddress()` - 등록된 메타 주소 조회

**포함 예제**: 13개

---

### 4. stealth-address-erc-contracts

**목적**: ERC-5564/6538의 정규(canonical) 컨트랙트 구현

| 항목 | 내용 |
|------|------|
| 타입 | Solidity 스마트 컨트랙트 |
| 기술스택 | Solidity 0.8.x, Foundry |
| 라이선스 | CC0-1.0 (Public Domain) |
| 상태 | ✅ 프로덕션 |

**배포된 컨트랙트**:
| 컨트랙트 | 주소 |
|---------|------|
| ERC5564Announcer | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| ERC6538Registry | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` |

**배포 체인**: Mainnet, Arbitrum, Base, Gnosis, Optimism, Polygon, Scroll, Sepolia, Holešky 등

---

### 5. stable-poc-contract

**목적**: StableNet 전용 ERC-7579 모듈러 스마트 계정 (EIP-7702 지원)

| 항목 | 내용 |
|------|------|
| 타입 | Solidity 스마트 컨트랙트 |
| 기술스택 | Solidity 0.8.x, Foundry, OpenZeppelin, Uniswap V3 |
| 라이선스 | MIT |
| 상태 | ⚠️ PoC (보안 감사 필요) |

**아키텍처**:
```
contracts/src/
├── core/                    # 핵심 계정 인프라
│   ├── SmartAccount.sol     # ERC-7579 모듈러 스마트 계정
│   └── AccountFactory.sol   # CREATE2 팩토리
│
├── modules/                 # ERC-7579 모듈
│   ├── validators/          # ECDSA 검증기
│   └── hooks/               # SpendingLimitHook
│
├── paymaster/               # 가스 추상화
│   ├── VerifyingPaymaster   # 오프체인 검증 후원
│   └── ERC20Paymaster       # ERC-20 토큰 가스비 지불
│
├── subscription/            # 반복 결제
├── stealth/                 # 프라이버시 (EIP-5564)
├── dex/                     # DEX 통합 (Uniswap V3)
└── libraries/               # ExecutionLib, ValidationDataLib
```

**주요 기능**:
- ERC-7579 모듈러 아키텍처
- EIP-7702 EOA 위임 지원
- 다양한 Paymaster 타입의 가스 추상화
- 스텔스 주소 기반 프라이버시
- Uniswap V3 DEX 통합
- 지출 한도 및 트랜잭션 훅
- 구독/반복 결제 모듈

---

### 6. kernel-7579-plugins

**목적**: Kernel 기능 확장을 위한 ERC-7579 플러그인 컬렉션

| 항목 | 내용 |
|------|------|
| 타입 | Solidity 스마트 컨트랙트 |
| 기술스택 | Solidity 0.8.x, Foundry |
| 라이선스 | MIT (일부 UNLICENSED) |
| 상태 | ⚠️ 주의 필요 |

**플러그인 카테고리**:

| 카테고리 | 플러그인 |
|---------|---------|
| Signers (3) | ECDSA, WebAuthn, Webauthn Validator |
| Policies (6) | Call, Gas, RateLimit, Signature, Sudo, Timestamp |
| Actions | Recovery Action |
| Hooks | Only EntryPoint Hook |

**배포 주소 (멀티체인)**:
- ECDSA Signer: `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF`
- WebAuthn Signer: `0x65DEeC8fEe717dc044D0CFD63cCf55F02cCaC2b3`
- Call Policy: `0x9a52283276a0ec8740df50bf01b28a80d880eaf2`
- Gas Policy: `0xaeFC5AbC67FfD258abD0A3E54f65E70326F84b23`

---

### 7. zerodev-examples

**목적**: SDK 기능과 패턴을 보여주는 종합 예제 컬렉션

| 항목 | 내용 |
|------|------|
| 타입 | TypeScript 예제 앱 |
| 기술스택 | TypeScript, Viem, ZeroDev SDK |
| 라이선스 | MIT |
| 상태 | 📚 교육용 |

**예제 카테고리** (31개):

| 카테고리 | 예제 수 | 내용 |
|---------|--------|------|
| Account Management | 7 | 계정 생성, 마이그레이션, 검증기 변경 |
| Transaction Patterns | 5 | 기본/배치 트랜잭션, delegatecall |
| Advanced Features | 8 | 세션 키, 멀티체인, EIP-7702, 훅 |
| Payment & Gas | 2 | ERC-20 가스비, Intent |
| Specialized | 3 | 튜토리얼, 유틸리티 |

---

### 8. stable-platform

**목적**: StableNet KRW L1 블록체인 아키텍처 및 설계 문서

| 항목 | 내용 |
|------|------|
| 타입 | 문서 전용 |
| 라이선스 | GPL-3.0 |
| 상태 | 📄 설계 문서 |

**주의**: GPL-3.0 copyleft 라이선스 - 파생 작업 시 동일 라이선스 적용 필요

---

### 9. go-stablenet 🆕

**목적**: StableNet 체인 노드 - go-ethereum 포크 (EIP-7702, Fee Delegation 지원)

| 항목 | 내용 |
|------|------|
| 타입 | Go 블록체인 클라이언트 |
| 기술스택 | Go 1.21+, go-ethereum |
| 라이선스 | LGPL-3.0 (go-ethereum 상속) |
| 상태 | 🔧 개발 중 |

**핵심 기능**:
- **EIP-7702 지원**: SetCodeTx (0x04) 트랜잭션 타입
- **Fee Delegation**: FeeDelegateDynamicFeeTx (0x16) 커스텀 트랜잭션
- **WBFT 합의**: Weighted Byzantine Fault Tolerance 합의 알고리즘
- **System Contracts**: 네이티브 코인 어댑터 등 시스템 컨트랙트

**트랜잭션 타입**:
```
LegacyTxType                = 0x00
AccessListTxType            = 0x01
DynamicFeeTxType            = 0x02
BlobTxType                  = 0x03
SetCodeTxType               = 0x04  ← EIP-7702
FeeDelegateDynamicFeeTxType = 0x16  ← StableNet 커스텀
```

**주요 디렉토리**:
```
go-stablenet/
├── core/types/
│   ├── tx_setcode.go         # EIP-7702 구현
│   ├── tx_fee_delegation.go  # Fee Delegation 구현
│   └── transaction.go        # 트랜잭션 타입 정의
├── consensus/wbft/           # WBFT 합의 알고리즘
├── systemcontracts/          # 시스템 컨트랙트
└── cmd/gstable/              # CLI 명령어
```

---

### 10. stealth-7702 🆕

**목적**: EIP-7702와 스텔스 주소를 결합한 프라이버시 데모 애플리케이션

| 항목 | 내용 |
|------|------|
| 타입 | Full-stack 데모 앱 |
| 기술스택 | Next.js 14, Viem 2, Wagmi 2, Permissionless |
| 라이선스 | MIT |
| 상태 | 🧪 데모/실험 (Odyssey Testnet) |

**핵심 기능**:
- 스텔스 주소 생성 및 Announcement 발행
- EIP-7702로 스텔스 계정을 Kernel Smart Account로 업그레이드
- Pimlico Paymaster를 통한 가스 스폰서링 (완전한 프라이버시 유지)
- ERC-5564/6538 표준 준수

**프로젝트 구조**:
```
stealth-7702/
├── app/                      # Next.js 프론트엔드
│   ├── components/           # React 컴포넌트
│   ├── pages/                # 페이지 라우팅
│   └── utils/                # 유틸리티 함수
├── scripts/                  # CLI 도구 (Bun)
│   └── src/
│       ├── 7702/             # EIP-7702 스크립트
│       ├── stealth/          # 스텔스 주소 스크립트
│       └── deploy/           # 컨트랙트 배포
├── contracts/
│   └── StealthSuite.sol      # ERC-5564/6538 간소화 구현
├── chain-config/
│   └── chains.ts             # 체인 설정 (Odyssey Testnet)
└── docs/                     # EIP-5564 관련 문서
```

**컨트랙트 (StealthSuite.sol)**:
```solidity
// StealthAnnouncer - ERC-5564 호환
contract StealthAnnouncer {
    event Announcement(uint256 schemeId, address stealthAddress, ...);
    function announce(...) external;
}

// StealthRegistry - ERC-6538 호환
contract StealthRegistry {
    function registerKeys(uint256 schemeId, bytes stealthMetaAddress) external;
    function stealthMetaAddressOf(address, uint256) external view returns (bytes);
}
```

**지원 네트워크**:
- Odyssey Testnet (Chain ID: 911867)

**참고 자료**:
- [Live Demo](https://youtu.be/YGspcdghsqo)
- [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538)

---

## 기술 스택 요약

| 레이어 | 기술 | 용도 |
|--------|------|------|
| 블록체인 노드 | Go, go-ethereum 포크 | StableNet 체인 (EIP-7702, Fee Delegation) |
| 스마트 컨트랙트 | Solidity 0.8.x | ERC-4337, ERC-7579, Privacy |
| 빌드 도구 | Foundry, Hardhat | 컨트랙트 컴파일 및 테스트 |
| JavaScript SDK | TypeScript, Bun | AA 앱 개발 |
| RPC/블록체인 | Viem, Ethers.js | 블록체인 상호작용 |
| 암호화 | @noble/secp256k1 | 스텔스 주소 연산 |
| 프론트엔드 | Next.js, React, Chakra UI | 데모 앱 UI |

---

## 적용 표준

| 표준 | 설명 | 사용처 |
|------|------|--------|
| EIP-4337 | Account Abstraction | kernel, sdk, stable-poc-contract |
| EIP-5564 | Stealth Addresses | stealth-address-*, stable-poc-contract |
| EIP-6538 | Stealth Meta-Address Registry | stealth-address-erc-contracts |
| EIP-7579 | Modular Smart Accounts | kernel, kernel-7579-plugins, stable-poc-contract |
| EIP-7702 | EOA Delegation | stable-poc-contract |

---

## 프로덕션 준비 상태

| 프로젝트 | 상태 | 비고 |
|---------|------|------|
| kernel | ✅ 프로덕션 | 광범위하게 감사됨, v3.3 최신 |
| stealth-address-erc-contracts | ✅ 프로덕션 | 정규 구현, CC0, 제약 없음 |
| sdk | ✅ 프로덕션 | 종합적, 잘 테스트됨 |
| stealth-address-sdk | ✅ 프로덕션 | Beta v1.0, 기능 완성 |
| stable-poc-contract | ⚠️ PoC | 보안 감사 필요 |
| kernel-7579-plugins | ⚠️ 주의 | 라이선스 이슈, 일부 UNLICENSED |
| zerodev-examples | ✅ 교육용 | 학습용, 프로덕션 아님 |
| stable-platform | ❌ 설계만 | 문서, 코드 없음 |
| go-stablenet | 🔧 개발 중 | EIP-7702, Fee Delegation 구현 완료, 테스트 필요 |
| stealth-7702 | 🧪 데모 | Odyssey Testnet 전용, 실험적 |

---

## 아키텍처 관계도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        go-stablenet (체인 노드)                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EIP-7702 (SetCodeTx) │ Fee Delegation (0x16) │ WBFT 합의        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐
│  ZeroDev SDK v5   │  │  stealth-7702 🆕     │  │  StableNet Contracts    │
│     (sdk/)        │  │  (데모 앱)            │  │  (stable-poc-contract)  │
│                   │  │                     │  │                         │
│ • 19개 플러그인      │  │ • EIP-7702 통합      │  │ • ERC-7579 모듈러 계정   │
│ • Bundler Client  │  │ • 스텔스 주소          │  │ • Paymaster             │
│ • Paymaster       │  │ • Pimlico 연동       │  │ • DEX 통합              │
└─────────┬─────────┘  │ • Next.js UI        │  └─────────────────────────┘
          │            └─────────────────────┘
          │
          ├─── Kernel v3.3 ◄────────── kernel/
          │    (ERC-4337 + ERC-7579)     (핵심 스마트 계정)
          │
          ├─── Stealth Contracts ◄──── stealth-address-erc-contracts
          │    (ERC-5564, ERC-6538)      (정규 구현)
          │
          ├─── Privacy SDK ◄────────── stealth-address-sdk
          │    (TypeScript API)          (스텔스 주소 연산)
          │
          ├─── 7579 Plugins ◄───────── kernel-7579-plugins
          │    (확장 기능)                (Signers, Policies, Hooks)
          │
          └─── Examples ◄───────────── zerodev-examples
               (31개 데모)                (학습 및 참조용)
```

---

## 핵심 통계

| 지표 | 값 |
|------|-----|
| 총 서브프로젝트 | **10개** |
| 블록체인 노드 | 1개 (go-stablenet) |
| Solidity 컨트랙트 프로젝트 | 5개 |
| TypeScript 패키지 | 4개 + 1 모노레포 |
| 총 플러그인 | 19개 (SDK) + 10개 (7579-plugins) |
| 예제 앱 | 31개 + 1 데모 앱 |
| 배포된 컨트랙트 | 20+ 주소, 12+ 체인 |
| 라이선스 타입 | MIT (7), CC0 (1), GPL-3.0 (1), LGPL-3.0 (1) |

---

## 주요 발견사항

1. **Full-Stack 완성**: 체인 노드(go-stablenet)부터 프론트엔드(stealth-7702)까지 전체 스택 구현
2. **생태계 일관성**: 프로젝트들이 AA + Privacy 스택으로 응집력 있게 구성됨
3. **표준 준수**: 모든 프로젝트가 Ethereum 표준(EIP-4337, EIP-5564, EIP-7579, EIP-7702 등) 준수
4. **프로덕션 품질**: 5개 프로젝트 프로덕션 준비됨, 3개 PoC/개발 중
5. **EIP-7702 선도**: go-stablenet과 stealth-7702에서 EIP-7702 활용 사례 구현
6. **라이선스 전략**: 대부분 MIT, 표준 구현은 CC0, 플랫폼 설계는 GPL-3.0, 체인 노드는 LGPL-3.0
7. **배포 성공**: CREATE2를 통해 12+ 주요 체인에 일관된 주소로 배포됨
8. **커뮤니티 채택**: Kernel이 주요 AA 인프라 제공자들에게 널리 사용됨

---

## 권장사항

### 즉시 조치 필요
- [ ] `stable-poc-contract` 보안 감사 수행
- [ ] `kernel-7579-plugins` 라이선스 이슈 해결 (UNLICENSED 파일)
- [ ] `go-stablenet` 테스트넷 배포 및 검증

### 향후 개선
- [ ] `stealth-7702` StableNet 체인 통합 (현재 Odyssey Testnet 전용)
- [ ] `zerodev-examples` 최신 SDK 버전에 맞게 업데이트
- [ ] 통합 테스트 스위트 구축
- [ ] CI/CD 파이프라인 표준화
- [ ] `go-stablenet` WBFT 합의 알고리즘 형식 검증

---

## 참조 링크

- [EIP-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [EIP-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [EIP-7579: Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [EIP-7702: Set EOA Account Code](https://eips.ethereum.org/EIPS/eip-7702)
