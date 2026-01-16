# Alto vs Account-Abstraction 비교 분석

## 개요

StableNet PoC 프로젝트에서 사용 중인 ERC-4337 관련 컴포넌트들의 역할과 관계를 명확히 하기 위한 분석 문서입니다.

---

## 핵심 결론

> **Alto는 Bundler(오프체인 서비스)이고, account-abstraction은 스마트 컨트랙트 라이브러리입니다.**
> 두 프로젝트는 경쟁 관계가 아닌 **상호 보완 관계**입니다.

---

## 1. 프로젝트 개요

### 1.1 Alto (Pimlico)

| 항목 | 내용 |
|------|------|
| **유형** | ERC-4337 Bundler |
| **언어** | TypeScript |
| **개발사** | Pimlico |
| **역할** | UserOperation 수집, 검증, 번들링, EntryPoint 제출 |
| **실행 환경** | 오프체인 (Node.js 서비스) |
| **위치** | `/poc/alto/` |

```
┌─────────────────────────────────────────────────────────────┐
│                    Alto Bundler (Off-chain)                 │
├─────────────────────────────────────────────────────────────┤
│  • RPC Server (eth_sendUserOperation, etc.)                 │
│  • Mempool (UserOperation 풀 관리)                          │
│  • Executor (번들 생성 및 제출)                              │
│  • Validator (UserOperation 검증)                            │
│  • Gas Price Manager (체인별 가스 가격 관리)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   EntryPoint (On-chain)       │
              │   (account-abstraction 제공)   │
              └───────────────────────────────┘
```

### 1.2 account-abstraction (eth-infinitism)

| 항목 | 내용 |
|------|------|
| **유형** | ERC-4337 스마트 컨트랙트 라이브러리 |
| **언어** | Solidity |
| **개발사** | eth-infinitism (ERC-4337 표준 팀) |
| **역할** | EntryPoint, BasePaymaster, SimpleAccount 등 핵심 컨트랙트 제공 |
| **실행 환경** | 온체인 (EVM) |
| **버전** | v0.9 (EIP-7702 지원) |
| **위치** | `/poc/stable-poc-contract/lib/account-abstraction/` |

---

## 2. 아키텍처 비교

### 2.1 ERC-4337 전체 아키텍처에서의 위치

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ERC-4337 Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐│
│  │   Wallet     │────▶│   Bundler    │────▶│  EntryPoint (On-chain)   ││
│  │   (User)     │     │   (Alto)     │     │  (account-abstraction)   ││
│  └──────────────┘     └──────────────┘     └──────────────────────────┘│
│         │                    │                        │                 │
│         │                    │                        ▼                 │
│         │                    │              ┌─────────────────────────┐ │
│         │                    │              │  Smart Account          │ │
│         ▼                    ▼              │  (SmartAccountWithKernel)│ │
│  ┌──────────────┐     ┌──────────────┐     └─────────────────────────┘ │
│  │ UserOperation│     │   Mempool    │              │                  │
│  │   생성       │     │   관리       │              ▼                  │
│  └──────────────┘     └──────────────┘     ┌─────────────────────────┐ │
│                                            │  Paymaster               │ │
│                                            │  (VerifyingPaymaster,    │ │
│                                            │   ERC20Paymaster)        │ │
│                                            └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트별 역할

| 컴포넌트 | Alto | account-abstraction | stable-poc-contract |
|----------|------|---------------------|---------------------|
| **EntryPoint** | 테스트용 복사본 (수정됨) | 공식 구현체 (v0.9) | account-abstraction 사용 |
| **Paymaster** | 테스트용 최소 구현 | BasePaymaster 추상 클래스 | VerifyingPaymaster, ERC20Paymaster |
| **Smart Account** | 미포함 | SimpleAccount, Simple7702Account | SmartAccountWithKernel |
| **Bundler** | 핵심 기능 (TypeScript) | 미포함 | 미포함 |

---

## 3. EntryPoint 비교 분석

### 3.1 Alto의 EntryPoint

```solidity
// /poc/alto/contracts/src/v07/EntryPoint.sol
// 주석: "This EntryPoint closely resembles the actual EntryPoint with some diffs"

import { EntryPoint as EntryPointBase } from "account-abstraction-v7/core/EntryPoint.sol";

contract EntryPoint is EntryPointBase {
    // 번들러 테스트를 위한 수정된 구현
}
```

**특징:**
- account-abstraction을 import하여 상속
- 번들러 테스트 목적의 수정된 버전
- v0.6, v0.7, v0.8, v0.9 버전별 테스트 지원
- **프로덕션 사용 비권장**

### 3.2 account-abstraction의 EntryPoint

```solidity
// /poc/stable-poc-contract/lib/account-abstraction/contracts/core/EntryPoint.sol
pragma solidity ^0.8.28;

contract EntryPoint is
    IEntryPoint,
    StakeManager,
    NonceManager,
    EIP712,
    Eip7702Support,
    ReentrancyGuardTransient
{
    using UserOperationLib for PackedUserOperation;

    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) public nonReentrant {
        // 핵심 UserOperation 처리 로직
    }
}
```

**특징:**
- ERC-4337 v0.9 공식 구현체
- EIP-7702 (EOA 위임) 지원
- EIP-712 서명 지원
- ReentrancyGuard 적용
- **프로덕션 사용 권장**

### 3.3 EntryPoint 비교 표

| 기능 | Alto (테스트용) | account-abstraction (공식) |
|------|-----------------|---------------------------|
| ERC-4337 호환 | ✅ | ✅ |
| EIP-7702 지원 | ⚠️ 버전에 따라 다름 | ✅ (v0.9) |
| 프로덕션 권장 | ❌ | ✅ |
| 감사 완료 | ❌ | ✅ |
| 체인 배포 | 자체 테스트넷 | 메인넷/테스트넷 |

---

## 4. Paymaster 비교 분석

### 4.1 Alto의 Paymaster (테스트용)

```solidity
// /poc/alto/contracts/src/test-utils/paymasterV07.sol
contract SimplePaymaster is IPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external pure returns (bytes memory context, uint256 validationData) {
        return ("", 0);  // 항상 승인 (테스트용)
    }
}
```

**특징:**
- 모든 요청 무조건 승인
- 테스트/개발 목적
- 보안 검증 없음

### 4.2 account-abstraction의 BasePaymaster

```solidity
// /poc/stable-poc-contract/lib/account-abstraction/contracts/core/BasePaymaster.sol
abstract contract BasePaymaster is IPaymaster, Ownable {
    IEntryPoint public immutable entryPoint;

    function deposit() public payable virtual {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) public virtual onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "not from entrypoint");
        _;
    }
}
```

**특징:**
- 추상 클래스 (상속하여 사용)
- 예치금(deposit) 관리 기능
- 출금(withdraw) 기능
- EntryPoint 검증

### 4.3 stable-poc-contract의 커스텀 Paymaster

#### VerifyingPaymaster (서명 기반)

```solidity
// /poc/stable-poc-contract/src/paymaster/VerifyingPaymaster.sol
contract VerifyingPaymaster is IPaymaster, Ownable {
    address public verifyingSigner;

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external view onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        (uint48 validUntil, uint48 validAfter, bytes calldata signature) =
            _parsePaymasterAndData(userOp.paymasterAndData);

        bytes32 hash = getHash(userOp, validUntil, validAfter).toEthSignedMessageHash();
        address recovered = hash.recover(signature);

        if (recovered != verifyingSigner) {
            return ("", 1);  // 서명 검증 실패
        }

        return (abi.encode(userOp.sender), _packValidationData(false, validUntil, validAfter));
    }
}
```

**특징:**
- 신뢰된 서명자(verifyingSigner)의 서명 검증
- 시간 기반 유효성 (validUntil, validAfter)
- 가스 스폰서링 제공
- **StableNet 프로덕션용**

#### ERC20Paymaster (토큰 결제)

```solidity
// /poc/stable-poc-contract/src/paymaster/ERC20Paymaster.sol
contract ERC20Paymaster is IPaymaster, Ownable {
    struct TokenConfig {
        address oracle;      // 가격 오라클
        uint256 priceMarkup; // 마크업 (150 = 1.5%)
        uint256 minDeposit;  // 최소 예치금
    }

    mapping(address => TokenConfig) public tokenConfigs;

    function getTokenAmountRequired(
        address token,
        uint256 ethCost
    ) public view returns (uint256) {
        TokenConfig memory config = tokenConfigs[token];
        uint256 tokenPrice = _getTokenPrice(token, config.oracle);
        uint256 baseAmount = (ethCost * tokenPrice) / 1e18;
        return (baseAmount * (PRICE_DENOMINATOR + config.priceMarkup)) / PRICE_DENOMINATOR;
    }
}
```

**특징:**
- ERC20 토큰으로 가스비 결제
- 오라클 기반 가격 계산
- 가격 마크업 지원
- 다중 토큰 지원
- **StableNet 프로덕션용**

### 4.4 Paymaster 비교 표

| 기능 | Alto | account-abstraction | stable-poc-contract |
|------|------|---------------------|---------------------|
| **구현체** | SimplePaymaster | BasePaymaster (추상) | VerifyingPaymaster, ERC20Paymaster |
| **검증 로직** | 없음 (항상 승인) | 기본 검증 | 서명/토큰 검증 |
| **예치금 관리** | ❌ | ✅ | ✅ |
| **가스 스폰서링** | ⚠️ 테스트용 | 상속 필요 | ✅ |
| **ERC20 결제** | ❌ | ❌ | ✅ |
| **오라클 연동** | ❌ | ❌ | ✅ |
| **프로덕션 적합** | ❌ | 확장 필요 | ✅ |

---

## 5. Smart Account 비교

### 5.1 account-abstraction의 Simple7702Account

```solidity
// EIP-7702 지원 최소 구현
contract Simple7702Account is IAccount, IERC7821, ERC1271, Eip7702Support {
    function execute(address target, uint256 value, bytes calldata data)
        external payable virtual returns (bytes memory result) {
        _requireFromSelfOrEntryPoint();
        return _call(target, value, data);
    }
}
```

**특징:**
- EIP-7702 (EOA 위임) 지원
- 최소한의 기능
- 배치 실행 지원

### 5.2 stable-poc-contract의 SmartAccountWithKernel

```solidity
// ERC-4337 + ERC-7579 호환 Smart Account
contract SmartAccountWithKernel is Kernel {
    string public constant VERSION = "1.0.0";
    string public constant NAME = "StableSmartAccount";

    function initializeWithValidator(
        address validator,
        bytes calldata ownerData
    ) external {
        ValidationId rootValidatorId = ValidatorLib.validatorToIdentifier(IValidator(validator));
        this.initialize(rootValidatorId, IHook(address(0)), ownerData, "", new bytes[](0));
    }

    function supportsEIP7702() external pure returns (bool) {
        return true;
    }
}
```

**특징:**
- Kernel 기반 모듈러 아키텍처
- ERC-7579 모듈 지원 (Validators, Executors, Hooks, Fallbacks)
- EIP-7702 위임 지원
- 확장 가능한 검증 시스템
- **StableNet 프로덕션용**

---

## 6. 권장사항

### 6.1 현재 프로젝트 구조 평가

```
stable-poc-contract/
├── lib/
│   └── account-abstraction/     ✅ 올바른 선택
│       └── contracts/
│           ├── core/
│           │   ├── EntryPoint.sol      ← 프로덕션 EntryPoint
│           │   └── BasePaymaster.sol   ← 확장 기반
│           └── accounts/
│               └── Simple7702Account.sol
├── src/
│   ├── paymaster/
│   │   ├── VerifyingPaymaster.sol     ✅ 커스텀 구현
│   │   └── ERC20Paymaster.sol         ✅ 커스텀 구현
│   └── smart-account/
│       └── SmartAccountWithKernel.sol ✅ 커스텀 구현
```

### 6.2 권장 아키텍처

| 컴포넌트 | 권장 사항 | 이유 |
|----------|-----------|------|
| **EntryPoint** | account-abstraction 사용 | 공식 구현, 감사 완료, 체인 배포됨 |
| **Paymaster** | stable-poc-contract 커스텀 | 비즈니스 로직 반영 필요 |
| **Smart Account** | SmartAccountWithKernel | 모듈러 아키텍처, 확장성 |
| **Bundler** | 공용 번들러 사용 | PoC 단계에서 자체 운영 불필요 |

### 6.3 Bundler 전략

#### PoC 단계 (현재)
```
권장: 공용 Bundler 사용
- Pimlico (pimlico.io)
- StackUp (stackup.sh)
- Alchemy AA
- Biconomy

장점:
- 빠른 개발 및 테스트
- 인프라 관리 불필요
- 멀티체인 지원
```

#### 프로덕션 단계 (향후)
```
옵션 1: 공용 Bundler 유지
- 비용: $0.01-0.05/UserOp
- 장점: 관리 불필요
- 단점: 의존성, 비용

옵션 2: Alto 기반 자체 Bundler
- 비용: 서버 + 운영 비용
- 장점: 완전한 제어, 커스터마이징
- 단점: 운영 복잡성

옵션 3: 하이브리드
- 자체 Bundler + 공용 Bundler 폴백
- 권장: 대규모 트래픽 시
```

### 6.4 결론

| 질문 | 답변 |
|------|------|
| Alto와 account-abstraction 중 선택? | **둘 다 사용** (역할이 다름) |
| EntryPoint 어디 것을 사용? | **account-abstraction** |
| Paymaster 어디 것을 사용? | **stable-poc-contract 커스텀** |
| Bundler는 어떻게? | **PoC: 공용, 프로덕션: 상황에 따라** |

---

## 7. 관련 문서

- [규제준수 컨트랙트 기술구현 가이드](./규제준수_컨트랙트_기술구현_가이드.md)
- [규제준수 기술 실제사례 조사](./규제준수_기술_실제사례_조사.md)
- [Alto CLAUDE.md](/poc/alto/CLAUDE.md)
- [ERC-4337 표준](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-7702 표준](https://eips.ethereum.org/EIPS/eip-7702)

---

*문서 작성일: 2026-01-16*
*분석 대상: Alto (Pimlico), account-abstraction v0.9 (eth-infinitism), stable-poc-contract*
