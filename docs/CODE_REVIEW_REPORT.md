# StableNet POC 프로젝트 코드 리뷰 보고서

**작성일**: 2026-01-13
**최종 수정**: 2026-01-13
**검토 대상**: 10개 하위 프로젝트
**검토 범위**: 코드 품질, 보안, 아키텍처, 라이센스

---

## 목차

1. [전체 요약](#1-전체-요약)
2. [라이센스 분석](#2-라이센스-분석)
3. [프로젝트별 상세 리뷰](#3-프로젝트별-상세-리뷰)
4. [보안 이슈 요약](#4-보안-이슈-요약)
5. [권장 조치사항](#5-권장-조치사항)

---

## 1. 전체 요약

### 프로젝트 개요

| 프로젝트 | 유형 | 라이센스 | 점수 | 프로덕션 준비 |
|----------|------|----------|------|---------------|
| kernel | Solidity | MIT | 9/10 | ✅ 준비됨 |
| stealth-address-erc-contracts | Solidity | CC0-1.0 | 9.2/10 | ✅ 준비됨 |
| sdk | TypeScript | MIT | 8.5/10 | ✅ 준비됨 |
| stealth-address-sdk | TypeScript | MIT | 8.5/10 | ✅ 준비됨 |
| go-stablenet 🆕 | Go | LGPL-3.0 | 8/10 | 🔧 개발 중 |
| stealth-7702 🆕 | TypeScript | MIT | 7.5/10 | 🧪 데모 |
| stable-poc-contract | Solidity | MIT | 7/10 | ⚠️ 보안 강화 필요 |
| stable-platform | 문서 | GPL-3.0 | 7/10 | ❌ 코드 없음 |
| kernel-7579-plugins | Solidity | MIT* | 6/10 | ❌ Critical 이슈 |
| zerodev-examples | TypeScript | MIT | 6.5/10 | ⚠️ 교육용 |

> *kernel-7579-plugins: `SudoPolicy.sol`은 UNLICENSED

### 기술 스택 요약

```
Blockchain Node (Go)
└── go-stablenet (EIP-7702 + Fee Delegation + WBFT)

Smart Contracts (Solidity 0.8.x)
├── kernel (ERC-4337 + ERC-7579)
├── kernel-7579-plugins
├── stable-poc-contract
├── stealth-address-erc-contracts
└── stealth-7702/contracts (StealthSuite)

TypeScript/JavaScript
├── sdk (ZeroDev SDK v5)
├── stealth-address-sdk
├── stealth-7702/app (Next.js 데모)
└── zerodev-examples

Documentation Only
└── stable-platform (KRW L1 블록체인 설계)
```

---

## 2. 라이센스 분석

### 2.1 라이센스 유형별 분류

#### MIT License (허용적)
- **kernel** - Copyright 2023 ZeroDev, Inc.
- **kernel-7579-plugins** - Copyright 2024 ZeroDev
- **sdk** - Copyright 2023 ZeroDev
- **stealth-address-sdk** - Copyright 2024 ScopeLift
- **stable-poc-contract** - MIT (SPDX 헤더)
- **zerodev-examples** - MIT (package.json)

**특징**: 상업적 사용, 수정, 배포, 2차 라이센스 허용. 저작권 표시 필요.

#### CC0-1.0 (퍼블릭 도메인)
- **stealth-address-erc-contracts** - Creative Commons Zero

**특징**: 모든 권리 포기. 제한 없이 사용 가능. ERC 표준 구현체에 적합.

#### LGPL-3.0 (약한 Copyleft)
- **go-stablenet** - GNU Lesser General Public License v3 (go-ethereum 포크)

**특징**: 라이브러리로 링크 시 파생작 공개 의무 없음. 수정 시 소스 공개 필요. 동적 링크 허용.

#### GPL-3.0 (Copyleft)
- **stable-platform** - GNU General Public License v3

**특징**: 파생 작업도 GPL-3.0으로 공개 필요. 소스 코드 공개 의무.

### 2.2 라이센스 호환성 매트릭스

| 조합 | 호환성 | 결과 라이센스 |
|------|--------|---------------|
| MIT + MIT | ✅ 호환 | MIT |
| MIT + CC0 | ✅ 호환 | MIT |
| MIT + LGPL-3.0 | ✅ 호환 | LGPL-3.0 (라이브러리만) |
| MIT + GPL-3.0 | ⚠️ 조건부 | GPL-3.0 (전파) |
| LGPL-3.0 + GPL-3.0 | ✅ 호환 | GPL-3.0 |
| CC0 + GPL-3.0 | ✅ 호환 | GPL-3.0 |

### 2.3 주의사항

#### ⚠️ GPL-3.0 영향 (stable-platform)
```
stable-platform이 GPL-3.0을 사용하므로:
- 이 코드를 통합하는 프로젝트는 GPL-3.0으로 배포해야 함
- 상업적 SaaS 서비스에는 제한 없음 (AGPL이 아님)
- 바이너리 배포 시 소스 코드 공개 필요
```

#### ⚠️ UNLICENSED 파일 (kernel-7579-plugins)
```
파일: kernel-7579-plugins/policies/sudo/src/SudoPolicy.sol
상태: SPDX-License-Identifier: UNLICENSED

문제점:
- 해당 파일 사용 권한 없음
- 프로덕션 사용 전 라이센스 명확화 필요
- ZeroDev에 라이센스 확인 요청 권장
```

### 2.4 라이센스 권장사항

| 우선순위 | 조치 |
|----------|------|
| High | `SudoPolicy.sol` 라이센스 확인 및 수정 |
| Medium | `stable-platform` GPL-3.0 영향도 분석 |
| Low | 모든 프로젝트에 LICENSE 파일 존재 확인 |

---

## 3. 프로젝트별 상세 리뷰

### 3.1 kernel

**평점**: 9/10 ⭐⭐⭐⭐⭐

**개요**
- ERC-4337 (Account Abstraction) + ERC-7579 (Modular Smart Account) 구현
- ZeroDev의 핵심 스마트 컨트랙트 계정

**기술 스택**
- Solidity 0.8.25
- Foundry + Hardhat
- Solady 라이브러리

**강점**
- ✅ 다수의 전문 감사 완료 (Chainlight, Kalos)
- ✅ 우수한 가스 최적화 (Via-IR, 200 runs)
- ✅ 깔끔한 모듈형 아키텍처
- ✅ 포괄적인 테스트 스위트

**개선 필요**
- 📝 NatSpec 문서화 확대
- 📝 delegatecall 위험 문서화
- 📝 매직 넘버 상수화

**핵심 컴포넌트**
```
src/
├── Kernel.sol           # 메인 계정 컨트랙트 (535줄)
├── core/
│   ├── ValidationManager.sol  # 검증자 관리 (677줄)
│   ├── ExecutorManager.sol
│   └── HookManager.sol
├── factory/
│   └── KernelFactory.sol      # CREATE2 팩토리
└── validator/
    ├── ECDSAValidator.sol
    └── WeightedECDSAValidator.sol
```

---

### 3.2 kernel-7579-plugins

**평점**: 6/10 ⭐⭐⭐

**개요**
- Kernel v3용 ERC-7579 플러그인 모음
- Validator, Policy, Signer, Hook, Action 모듈

**기술 스택**
- Solidity 0.8.x
- Foundry
- Via-IR 최적화

**🚨 Critical 이슈**

```solidity
// RecoveryAction.sol - 접근 제어 없음!
function doRecovery(address _validator, bytes calldata _data) external {
    IValidator(_validator).onUninstall(hex"");
    IValidator(_validator).onInstall(_data);
}
// 문제: 누구나 호출하여 validator 교체 가능
```

```solidity
// CallPolicy.sol - 경계 검사 없음
bytes32 param = bytes32(data[4 + rule.offset:4 + rule.offset + 32]);
// 문제: data.length 검증 없이 배열 접근
```

**컴포넌트 구조**
```
├── validators/  (2개) - WebAuthn, ERC1271
├── signers/     (3개) - ECDSA, WebAuthn, Any
├── policies/    (6개) - Call, Gas, RateLimit, Signature, Sudo, Timestamp
├── hooks/       (3개) - OnlyEntryPoint, Caller, SpendingLimit
└── actions/     (1개) - Recovery
```

**즉시 수정 필요**
1. `RecoveryAction.doRecovery()` 접근 제어 추가
2. `CallPolicy` 입력 검증 강화
3. `SudoPolicy.sol` 라이센스 명확화

---

### 3.3 sdk (ZeroDev SDK v5)

**평점**: 8.5/10 ⭐⭐⭐⭐

**개요**
- ERC-4337 계정 추상화 TypeScript SDK
- 모노레포 구조로 17개 플러그인 지원

**기술 스택**
- TypeScript 5.3
- Viem 2.28+
- Bun (패키지 매니저)
- Biome (린터/포매터)

**강점**
- ✅ 강력한 타입 안전성
- ✅ 깔끔한 모듈 아키텍처
- ✅ 포괄적인 테스트 (23개 파일)
- ✅ 우수한 문서화 (CLAUDE.md 포함)

**개선 필요**
- 📝 일부 TODO 미완료 (EP v0.7 지원)
- 📝 `any` 타입 사용 제거
- 📝 의존성 취약점 스캐닝 추가

**패키지 구조**
```
├── packages/core/    # 메인 SDK (@zerodev/sdk)
├── plugins/          # 17개 검증자/기능 플러그인
│   ├── ecdsa/
│   ├── webauthn-key/
│   ├── session-key/
│   ├── permission/
│   └── ...
└── templates/
```

---

### 3.4 stable-platform

**평점**: 7/10 ⭐⭐⭐

**개요**
- KRW 스테이블코인 L1 블록체인 설계 문서
- **코드 없음** - 문서만 존재

**라이센스**: GPL-3.0 (⚠️ Copyleft)

**설계 특징**
- 7계층 아키텍처
- WBFT 합의 알고리즘
- ERC-5564 스텔스 주소 지원
- 19+ 마이크로서비스

**주요 우려사항**
```
1. 실제 코드 없음 - 문서만 존재
2. 3000 TPS 주장 미검증
3. go-ethereum 포크 유지보수 부담
4. Blacklist 시스템 남용 가능성
5. GPL-3.0 라이센스로 상업적 통합 제한
```

**권장사항**
- MVP 먼저 구현 후 확장
- 합의 알고리즘 형식 검증
- 보안 감사 계획 수립

---

### 3.5 stable-poc-contract

**평점**: 7/10 ⭐⭐⭐

**개요**
- ERC-7579 스마트 계정 POC
- EIP-5564 스텔스 결제 지원
- Paymaster, DEX 통합

**기술 스택**
- Solidity 0.8.24
- Foundry
- OpenZeppelin Contracts

**테스트 현황**: 26개 통과 (100%)

**🚨 보안 이슈**

| 심각도 | 이슈 | 위치 |
|--------|------|------|
| High | Reentrancy Guard 없음 | SmartAccount.sol |
| High | Oracle 조작 위험 | ERC20Paymaster.sol |
| Medium | 서명 가변성 미검증 | StealthPaymentContract.sol |
| Medium | MEV 보호 없음 | DEXModule.sol |

**핵심 컨트랙트**
```
src/
├── core/SmartAccount.sol       # 메인 계정 (380줄)
├── modules/
│   ├── validators/ECDSAValidator.sol
│   └── hooks/SpendingLimitHook.sol
├── paymaster/
│   ├── VerifyingPaymaster.sol
│   └── ERC20Paymaster.sol
├── stealth/StealthPaymentContract.sol
└── dex/DEXModule.sol
```

---

### 3.6 stealth-address-erc-contracts

**평점**: 9.2/10 ⭐⭐⭐⭐⭐

**개요**
- ERC-5564, ERC-6538 표준 구현
- 스텔스 주소용 정식 컨트랙트

**라이센스**: CC0-1.0 (퍼블릭 도메인)

**기술 스택**
- Solidity 0.8.23
- Foundry
- 10M optimizer runs (프로덕션 최적화)

**강점**
- ✅ 매우 간결한 코드 (44줄 + 165줄)
- ✅ Critical 이슈 없음
- ✅ 포괄적인 Fuzz 테스트
- ✅ 멀티체인 배포 완료

**컨트랙트 구조**
```
src/
├── ERC5564Announcer.sol  # 44줄 - 이벤트 발행
└── ERC6538Registry.sol   # 165줄 - 메타 주소 레지스트리
```

**배포 현황**
- Mainnet, Optimism, Arbitrum, Base 등 다수 체인

---

### 3.7 stealth-address-sdk

**평점**: 8.5/10 ⭐⭐⭐⭐

**개요**
- EIP-5564/EIP-6538 TypeScript SDK
- @scopelift/stealth-address-sdk

**기술 스택**
- TypeScript
- Viem 2.9+
- @noble/secp256k1
- Bun

**강점**
- ✅ 깔끔한 모듈 아키텍처
- ✅ 포괄적인 타입 정의
- ✅ 우수한 문서화
- ✅ 안전한 암호화 라이브러리 사용

**개선 필요**
```typescript
// 제거 필요: 라이브러리 코드의 console.error
console.error('Error generating signature:', error);

// BigInt 정밀도 손실 가능
toBlock: BigInt(Math.min(Number(currentBlock) + chunkSize - 1, Number(end)))
```

**API 구조**
```typescript
// High-level API
const client = createStealthClient({ chainId, rpcUrl });
await client.getAnnouncements(...);

// Low-level API
import { generateStealthAddress, computeStealthKey } from './utils/crypto';
```

---

### 3.8 zerodev-examples

**평점**: 6.5/10 ⭐⭐⭐

**개요**
- ZeroDev SDK 교육용 예제
- Account Abstraction 데모

**기술 스택**
- TypeScript
- ts-node
- ZeroDev SDK v5

**구성**
```
├── create-account/      # 계정 생성
├── send-transaction/    # 트랜잭션 전송
├── batch-transactions/  # 배치 처리
├── session-keys/        # 세션 키
├── multisig/           # 다중 서명
├── hooks/              # 훅 (SpendingLimit)
├── intent/             # Intent 시스템
└── eip-7702/           # EOA 위임
```

**개선 필요**
```typescript
// 입력 검증 없음
const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

// 함수명 오타
async function createIntentClinet(chain: Chain) {
//                       ^^^^^^^ Clinet → Client
```

---

### 3.9 go-stablenet

**평점**: 8/10 ⭐⭐⭐⭐

**개요**
- go-ethereum 포크 기반 StableNet 블록체인 노드
- EIP-7702 (EOA Delegation) 지원
- Fee Delegation 트랜잭션 타입 추가

**라이센스**: LGPL-3.0 (go-ethereum 상속)

**기술 스택**
- Go 1.21+
- go-ethereum v1.14.x 포크
- Clef 서명 도구

**핵심 기능**

| 기능 | 트랜잭션 타입 | 설명 |
|------|---------------|------|
| EIP-7702 | 0x04 (SetCodeTx) | EOA에 임시 코드 위임 |
| Fee Delegation | 0x16 | 가스비 대납 트랜잭션 |
| WBFT | - | 가중 BFT 합의 알고리즘 |

**핵심 구현 분석**

```go
// core/types/transaction.go
const (
    SetCodeTxType               = 0x04  // EIP-7702
    FeeDelegateDynamicFeeTxType = 0x16  // StableNet 커스텀
)

// core/types/tx_setcode.go
var DelegationPrefix = []byte{0xef, 0x01, 0x00}

type SetCodeAuthorization struct {
    ChainID uint256.Int    `json:"chainId"`
    Address common.Address `json:"address"`
    Nonce   uint64         `json:"nonce"`
    V       uint8          `json:"yParity"`
    R       uint256.Int    `json:"r"`
    S       uint256.Int    `json:"s"`
}
```

**강점**
- ✅ EIP-7702 완전 구현 (SetCodeTx, Authority 복구)
- ✅ Fee Delegation 독자 설계
- ✅ 기존 go-ethereum 호환성 유지
- ✅ 명확한 트랜잭션 타입 분리

**개선 필요**
- 📝 WBFT 합의 알고리즘 상세 구현 검증 필요
- 📝 Fee Delegation 보안 감사 필요
- 📝 업스트림 go-ethereum 동기화 전략 필요

**컴포넌트 구조**
```
core/types/
├── transaction.go       # 트랜잭션 타입 정의 (0x04, 0x16)
├── tx_setcode.go        # EIP-7702 SetCodeTx (251줄)
├── tx_fee_delegate.go   # Fee Delegation 트랜잭션
└── gen_authorization.go # SetCodeAuthorization 직렬화

consensus/
├── ethash/              # PoW (레거시)
├── clique/              # PoA
└── wbft/                # 가중 BFT 합의 (StableNet 커스텀)
```

---

### 3.10 stealth-7702

**평점**: 7.5/10 ⭐⭐⭐

**개요**
- EIP-7702 + Stealth Address 데모 앱
- Odyssey Testnet (Chain ID: 911867) 기반
- EOA 위임을 통한 스텔스 결제 시연

**라이센스**: MIT

**기술 스택**
- Next.js 14 (App Router)
- TypeScript
- Viem 2.x, Wagmi 2.x
- Permissionless (ERC-4337)
- Chakra UI

**핵심 컴포넌트**

```
stealth-7702/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃
│   └── page.tsx            # 메인 페이지
├── components/
│   ├── providers.tsx       # Wagmi/QueryClient 프로바이더
│   ├── Navbar.tsx          # 네비게이션 바
│   └── MetaAddressCard.tsx # 스텔스 메타 주소 UI
├── contracts/
│   └── StealthSuite.sol    # 단일 스마트 컨트랙트
├── services/
│   └── bundlerService.ts   # ERC-4337 번들러 연동
└── utils/
    └── stealth.ts          # 스텔스 주소 유틸리티
```

**스마트 컨트랙트 분석**

```solidity
// contracts/StealthSuite.sol
contract StealthSuite {
    // ERC-5564 스텔스 발표자
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function announce(...) external { ... }

    // ERC-6538 메타 주소 레지스트리
    mapping(address => bytes) public stealthMetaAddresses;

    function registerKeys(bytes calldata _stealthMetaAddress) external {
        stealthMetaAddresses[msg.sender] = _stealthMetaAddress;
    }
}
```

**강점**
- ✅ 깔끔한 단일 컨트랙트 설계 (StealthSuite)
- ✅ 현대적 프론트엔드 스택 (Next.js 14, App Router)
- ✅ EIP-7702 + 스텔스 주소 통합 시연
- ✅ Odyssey Testnet 실제 배포

**개선 필요**
- ⚠️ 데모 목적 - 프로덕션 미적합
- 📝 에러 핸들링 강화 필요
- 📝 테스트 코드 없음
- 📝 스텔스 키 생성/파싱 로직 검증 필요

**보안 고려사항**

| 항목 | 상태 | 설명 |
|------|------|------|
| 입력 검증 | ⚠️ | 기본적 검증만 존재 |
| 접근 제어 | ✅ | registerKeys는 msg.sender만 가능 |
| 이벤트 로깅 | ✅ | 적절한 indexed 필드 사용 |
| 테스트 | ❌ | 테스트 코드 없음 |

**네트워크 설정**
```typescript
// Odyssey Testnet
{
  id: 911867,
  name: 'Odyssey Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://odyssey.ithaca.xyz'] } }
}
```

---

## 4. 보안 이슈 요약

### 4.1 심각도별 분류

#### 🚨 Critical
| 프로젝트 | 이슈 | 설명 |
|----------|------|------|
| kernel-7579-plugins | RecoveryAction 접근 제어 없음 | 누구나 validator 교체 가능 |

#### ⚠️ High
| 프로젝트 | 이슈 | 설명 |
|----------|------|------|
| kernel-7579-plugins | CallPolicy 경계 검사 없음 | Out-of-bounds 접근 |
| stable-poc-contract | Reentrancy Guard 없음 | 재진입 공격 가능 |
| stable-poc-contract | Oracle 조작 위험 | Staleness 체크 없음 |

#### ⚡ Medium
| 프로젝트 | 이슈 |
|----------|------|
| stable-poc-contract | 서명 가변성 미검증 |
| stable-poc-contract | MEV 보호 없음 |
| zerodev-examples | 입력 검증 미흡 |

### 4.2 보안 체크리스트

| 항목 | kernel | plugins | stable-poc | stealth |
|------|--------|---------|------------|---------|
| Reentrancy Guard | ✅ | ⚠️ | ❌ | N/A |
| Access Control | ✅ | ❌ | ⚠️ | ✅ |
| Input Validation | ✅ | ❌ | ⚠️ | ✅ |
| 감사 완료 | ✅ | ❌ | ❌ | ❌ |
| Fuzz Testing | ✅ | ⚠️ | ❌ | ✅ |

---

## 5. 권장 조치사항

### 5.1 즉시 수정 (Critical)

```
1. kernel-7579-plugins/actions/recovery/src/RecoveryAction.sol
   - doRecovery() 함수에 접근 제어 추가
   - msg.sender 검증 또는 역할 기반 접근 제어

2. kernel-7579-plugins/policies/call/src/CallPolicy.sol
   - 배열 경계 검사 추가
   - require(data.length >= 4 + rule.offset + 32)

3. kernel-7579-plugins/policies/sudo/src/SudoPolicy.sol
   - UNLICENSED → MIT로 라이센스 변경 요청
```

### 5.2 단기 조치 (High - 1주 이내)

```
1. stable-poc-contract
   - OpenZeppelin ReentrancyGuard 추가
   - Oracle staleness 체크 구현
   - 서명 가변성 검증 추가 (s < secp256k1n/2)

2. zerodev-examples
   - Private key 검증 함수 추가
   - 함수명 오타 수정 (createIntentClinet)
   - 의존성 업데이트
```

### 5.3 중기 조치 (1개월 이내)

```
1. 보안 감사
   - stable-poc-contract 전문 감사 의뢰
   - kernel-7579-plugins 감사 의뢰

2. 테스트 강화
   - kernel-7579-plugins Fuzz 테스트 추가
   - stable-poc-contract 테스트 커버리지 80%+ 달성

3. 문서화
   - 모든 프로젝트 NatSpec 문서 완성
   - 보안 가이드라인 작성
```

### 5.4 장기 조치

```
1. stable-platform
   - MVP 코드 구현
   - 합의 알고리즘 형식 검증
   - GPL-3.0 라이센스 영향도 분석

2. 전체
   - CI/CD 보안 스캔 통합
   - 버그 바운티 프로그램 시작
   - 정기 보안 감사 체계 수립
```

---

## 부록

### A. 라이센스 전문 참조

| 라이센스 | 파일 위치 |
|----------|-----------|
| MIT (kernel) | `/kernel/LICENSE.txt` |
| MIT (plugins) | `/kernel-7579-plugins/LICENSE` |
| MIT (sdk) | `/sdk/LICENSE` |
| LGPL-3.0 (go-stablenet) | `/go-stablenet/COPYING.LESSER` |
| GPL-3.0 | `/stable-platform/LICENSE` |
| CC0-1.0 | `/stealth-address-erc-contracts/LICENSE` |
| MIT (stealth-sdk) | `/stealth-address-sdk/LICENSE` |
| MIT (stealth-7702) | `/stealth-7702/LICENSE` |

### B. 참고 표준

- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) - Account Abstraction
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) - Modular Smart Account
- [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) - Stealth Addresses
- [EIP-6538](https://eips.ethereum.org/EIPS/eip-6538) - Stealth Meta-Address Registry
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) - EOA Delegation

---

**보고서 작성**: Claude Code
**검토 방법론**: SOLID 원칙, OWASP Top 10, 스마트 컨트랙트 보안 모범 사례
