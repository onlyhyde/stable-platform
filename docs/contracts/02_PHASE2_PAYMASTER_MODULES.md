# Phase 2: Paymaster & Modules

> **Version**: 1.1
> **Last Updated**: 2026-01-23
> **Duration**: 2-3 주
> **Priority**: High
> **Dependencies**: Phase 1 완료
> **Implementation Status**: ✅ 대부분 완료 (poc-contract 기준)

---

## 1. 개요

Phase 2는 가스 대납 시스템과 ERC-7579 모듈 생태계를 구축합니다.

### 1.1 목표
- Paymaster 컨트랙트 구현 (가스 스폰서십, 토큰 결제)
- ERC-7579 Validator 모듈 확장 (WebAuthn, MultiSig)
- ERC-7579 Executor 모듈 구현 (SessionKey, Recurring)
- ERC-7579 Hook 모듈 구현 (SpendingLimit, Audit)

### 1.2 산출물
- 배포 가능한 Paymaster 컨트랙트
- 모듈 컨트랙트 세트
- 테스트 커버리지 80%+

---

## 2. 컴포넌트 목록

> **참조**: poc-contract 구현 상태 기준 (2026-01-23 업데이트)

### 2.1 Paymaster

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.1 | VerifyingPaymaster | `erc4337-paymaster/VerifyingPaymaster.sol` | P0 | Medium | ✅ 완료 |
| C2.2 | ERC20Paymaster | `erc4337-paymaster/ERC20Paymaster.sol` | P0 | High | ✅ 완료 |
| C2.3 | Permit2Paymaster | `erc4337-paymaster/Permit2Paymaster.sol` | P1 | Medium | ✅ 완료 |
| C2.3.1 | SponsorPaymaster | `erc4337-paymaster/SponsorPaymaster.sol` | P2 | Low | ✅ 완료 (추가) |
| C2.4 | IPriceOracle | `erc4337-paymaster/interfaces/IPriceOracle.sol` | P0 | Low | ✅ 완료 |
| C2.4.1 | PriceOracle | `defi/PriceOracle.sol` | P0 | Medium | ✅ 완료 (통합) |

### 2.2 Validators

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.5 | WebAuthnValidator | `erc7579-validators/WebAuthnValidator.sol` | P1 | High | ✅ 완료 |
| C2.6 | MultiSigValidator | `erc7579-validators/MultiSigValidator.sol` | P1 | Medium | ✅ 완료 |
| C2.6.1 | MultiChainValidator | `erc7579-validators/MultiChainValidator.sol` | P2 | Medium | ✅ 완료 (추가) |
| C2.6.2 | WeightedECDSAValidator | `erc7579-validators/WeightedECDSAValidator.sol` | P2 | Medium | ✅ 완료 (추가) |

### 2.3 Executors

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.7 | SessionKeyExecutor | `erc7579-executors/SessionKeyExecutor.sol` | P0 | High | ✅ 완료 |
| C2.8 | RecurringPaymentExecutor | `erc7579-executors/RecurringPaymentExecutor.sol` | P1 | Medium | ✅ 완료 |
| C2.9 | BatchExecutor | `executors/BatchExecutor.sol` | P2 | Low | ⏸️ Kernel 내장 |

### 2.4 Hooks

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.10 | SpendingLimitHook | `erc7579-hooks/SpendingLimitHook.sol` | P1 | Medium | ✅ 완료 |
| C2.11 | AuditHook | `erc7579-hooks/AuditHook.sol` | P2 | Low | ✅ 완료 |
| C2.12 | PolicyHook | `hooks/PolicyHook.sol` | P2 | Medium | ❌ 미구현 |

### 2.5 Fallbacks (추가)

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.13 | TokenReceiverFallback | `erc7579-fallbacks/TokenReceiverFallback.sol` | P2 | Low | ✅ 완료 |
| C2.14 | FlashLoanFallback | `erc7579-fallbacks/FlashLoanFallback.sol` | P2 | Medium | ✅ 완료 |

### 2.6 Plugins (추가)

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 | 상태 |
|----|----------|------|---------|--------|------|
| C2.15 | AutoSwapPlugin | `erc7579-plugins/AutoSwapPlugin.sol` | P2 | High | ✅ 완료 |
| C2.16 | MicroLoanPlugin | `erc7579-plugins/MicroLoanPlugin.sol` | P3 | Medium | ✅ 완료 |
| C2.17 | OnRampPlugin | `erc7579-plugins/OnRampPlugin.sol` | P3 | Medium | ✅ 완료 |

---

## 3. Paymaster 태스크 분해

### 3.1 VerifyingPaymaster (T2.1)

#### T2.1.1 기본 구조
```yaml
파일: src/paymasters/VerifyingPaymaster.sol
작업:
  - [ ] IPaymaster 상속
  - [ ] entryPoint immutable
  - [ ] verifyingSigner 저장
  - [ ] sponsorDeposits mapping
  - [ ] usedHashes mapping (replay protection)
예상시간: 2h
의존성: Phase 1 완료
```

#### T2.1.2 PaymasterData 구조체
```yaml
작업:
  - [ ] PaymasterData struct 정의
    - sponsor: address
    - validUntil: uint48
    - validAfter: uint48
    - signature: bytes
  - [ ] _parsePaymasterData() 내부 함수
예상시간: 1h
의존성: T2.1.1
```

**paymasterAndData 인코딩**:
```
paymasterAndData = abi.encodePacked(
    paymaster,           // 20 bytes
    verificationGasLimit,// 16 bytes (packed)
    postOpGasLimit,      // 16 bytes (packed)
    sponsor,             // 20 bytes
    validUntil,          // 6 bytes
    validAfter,          // 6 bytes
    signature            // 65 bytes
)
```

#### T2.1.3 validatePaymasterUserOp()
```yaml
작업:
  - [ ] paymasterData 파싱
  - [ ] 시간 유효성 검사 (validAfter, validUntil)
  - [ ] sponsor deposit 확인
  - [ ] 해시 생성 (userOpHash + sponsor + timestamps)
  - [ ] 서명 검증 (verifyingSigner)
  - [ ] usedHashes 중복 방지
  - [ ] context 인코딩 (sponsor, maxCost)
  - [ ] validationData 반환
예상시간: 4h
의존성: T2.1.2
```

**validatePaymasterUserOp 흐름**:
```
validatePaymasterUserOp(userOp, userOpHash, maxCost)
├── data = _parsePaymasterData(userOp.paymasterAndData)
├── if (block.timestamp < data.validAfter || > data.validUntil):
│   └── return (_, SIG_VALIDATION_FAILED with timestamps)
├── require(sponsorDeposits[data.sponsor] >= maxCost)
├── hash = keccak256(userOpHash, sponsor, validUntil, validAfter)
├── require(!usedHashes[hash], "Already used")
├── recovered = ECDSA.recover(hash.toEthSignedMessageHash(), signature)
├── if (recovered != verifyingSigner):
│   └── return (_, SIG_VALIDATION_FAILED)
├── usedHashes[hash] = true
└── return (abi.encode(sponsor, maxCost), packValidationData(0, validUntil, validAfter))
```

#### T2.1.4 postOp()
```yaml
작업:
  - [ ] context 디코딩 (sponsor, maxCost)
  - [ ] actualGasCost 계산
  - [ ] markup 적용 (예: 10%)
  - [ ] sponsorDeposits 차감
예상시간: 2h
의존성: T2.1.3
```

#### T2.1.5 Deposit 관리
```yaml
작업:
  - [ ] deposit() 함수 (sponsor용)
  - [ ] withdraw() 함수
  - [ ] getDeposit() view 함수
  - [ ] 이벤트: Deposited, Withdrawn
예상시간: 2h
의존성: T2.1.1
```

#### T2.1.6 Admin 기능
```yaml
작업:
  - [ ] setVerifyingSigner() (onlyOwner)
  - [ ] setMarkup() (onlyOwner)
  - [ ] pause()/unpause() (onlyOwner)
예상시간: 1h
의존성: T2.1.1
```

---

### 3.2 ERC20Paymaster (T2.2)

> **IPriceOracle 의존성**:
> ERC20Paymaster는 `IPriceOracle` 인터페이스에만 의존합니다.
> - **개발/테스트**: TWAPOracle (Phase 2)
> - **프로덕션**: ChainlinkOracle (Phase 4)
>
> 배포 시 적절한 Oracle 구현체 주소를 생성자에 전달하세요.

#### T2.2.1 기본 구조
```yaml
파일: src/paymasters/ERC20Paymaster.sol
작업:
  - [ ] IPaymaster 상속
  - [ ] IPriceOracle priceOracle (생성자에서 주입)
  - [ ] supportedTokens mapping
  - [ ] tokenMarkup mapping (basis points)
예상시간: 2h
의존성: Phase 1 완료, T2.3.1 (IPriceOracle 인터페이스)
```

#### T2.2.2 Token 관리
```yaml
작업:
  - [ ] addSupportedToken() (onlyOwner)
  - [ ] removeSupportedToken() (onlyOwner)
  - [ ] setTokenMarkup() (onlyOwner)
  - [ ] isSupportedToken() view
  - [ ] getSupportedTokens() view
예상시간: 2h
의존성: T2.2.1
```

#### T2.2.3 validatePaymasterUserOp()
```yaml
작업:
  - [ ] paymasterData 파싱 (token, maxTokenAmount)
  - [ ] token 지원 여부 확인
  - [ ] priceOracle에서 token 가격 조회
  - [ ] 필요 토큰 양 계산 (ETH cost → token)
  - [ ] markup 적용
  - [ ] maxTokenAmount 확인
  - [ ] 토큰 잔액/allowance 확인 (상태 변경 없음!)
  - [ ] context 인코딩 (token, maxTokens, sender)
예상시간: 5h
의존성: T2.2.1, T2.3.1 (IPriceOracle)
```

> **중요**: ERC-4337 스펙에 따라 `validatePaymasterUserOp`에서는 **상태 변경이 금지**됩니다.
> `transferFrom`은 반드시 `postOp`에서 수행해야 합니다.
> validation 단계에서는 잔액/allowance만 확인합니다.

**토큰 양 계산**:
```solidity
tokenPrice = priceOracle.getPrice(token); // token/ETH price
requiredTokens = (maxCost * 1e18) / tokenPrice;
requiredTokens = requiredTokens + (requiredTokens * markup / 10000);
// 여기서는 계산만 하고, 실제 전송은 postOp에서 수행
```

#### T2.2.4 postOp()
```yaml
작업:
  - [ ] context 디코딩 (token, maxTokens, sender)
  - [ ] 실제 가스 사용량 → 토큰 양 계산
  - [ ] 토큰 transferFrom 실행 (실제 토큰 수집은 여기서!)
  - [ ] 토큰 수수료 수집
  - [ ] TokensCharged 이벤트 발행
예상시간: 3h
의존성: T2.2.3
```

> **참고**: ERC-4337에서 `postOp`은 UserOp 실행 후 호출됩니다.
> 실제 가스 사용량을 기반으로 정확한 토큰 양을 계산하여 수집합니다.
> `PostOpMode.opSucceeded`인 경우에만 토큰을 수집합니다.

#### T2.2.5 Fee 수집
```yaml
작업:
  - [ ] withdrawTokens() (onlyOwner)
  - [ ] withdrawETH() (onlyOwner)
  - [ ] 수수료 통계 view
예상시간: 1h
의존성: T2.2.1
```

---

### 3.3 PriceOracle (T2.3)

> **아키텍처 설계 (문서)**:
> - **IPriceOracle 인터페이스**: 공통 인터페이스 (Phase 2에서 정의)
> - **TWAPOracle**: Uniswap V3 TWAP 기반 (Phase 2, 개발/테스트용)
> - **ChainlinkOracle**: Chainlink Aggregator 기반 (Phase 4, 프로덕션용)
>
> ERC20Paymaster는 **IPriceOracle 인터페이스만 의존**하므로, 배포 환경에 따라 Oracle 구현체를 교체할 수 있습니다.

> **⚠️ 실제 구현 (poc-contract)**:
> 실제 코드에서는 **통합 PriceOracle**로 구현되어 있습니다:
> - `erc4337-paymaster/interfaces/IPriceOracle.sol` - 인터페이스
> - `defi/PriceOracle.sol` - **Chainlink + TWAP 통합 구현**
>   - Chainlink 우선, TWAP Fallback 전략
>   - Staleness 검사 포함 (1시간 기본)
>   - `setChainlinkFeed()`, `setUniswapPool()` 관리자 함수
>
> 문서의 분리 설계와 코드의 통합 설계 중 선택 필요.

```
┌─────────────────────────────────────────┐
│      ERC20Paymaster / Permit2Paymaster  │
│              depends on                 │
│            IPriceOracle                 │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────────┐   ┌─────────────────┐
│ TWAPOracle  │   │ ChainlinkOracle │
│  (Phase 2)  │   │    (Phase 4)    │
│ 개발/테스트  │   │   프로덕션용     │
└─────────────┘   └─────────────────┘
```

#### T2.3.1 IPriceOracle 인터페이스
```yaml
파일: src/interfaces/IPriceOracle.sol
작업:
  - [ ] IPriceOracle 인터페이스 정의
  - [ ] getPrice(token) → uint256 (18 decimals, USD 기준)
  - [ ] getQuote(tokenIn, tokenOut, amountIn) → uint256
  - [ ] isSupportedToken(token) → bool
예상시간: 1h
의존성: Phase 1 완료
```

**인터페이스 정의**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPriceOracle
/// @notice 토큰 가격 조회를 위한 공통 인터페이스
/// @dev ERC20Paymaster, Permit2Paymaster 등에서 사용
interface IPriceOracle {
    /// @notice 토큰의 USD 가격 조회 (18 decimals)
    /// @param token 토큰 주소
    /// @return price USD 가격 (1e18 = $1)
    function getPrice(address token) external view returns (uint256 price);

    /// @notice 토큰 간 환율 계산
    /// @param tokenIn 입력 토큰
    /// @param tokenOut 출력 토큰
    /// @param amountIn 입력 수량
    /// @return amountOut 출력 수량
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /// @notice 토큰 지원 여부 확인
    /// @param token 토큰 주소
    /// @return supported 지원 여부
    function isSupportedToken(address token) external view returns (bool supported);
}
```

#### T2.3.2 TWAPOracle 기본 구조
```yaml
파일: src/paymasters/TWAPOracle.sol
작업:
  - [ ] IPriceOracle 인터페이스 구현
  - [ ] OracleConfig struct (pool, twapWindow, isToken0)
  - [ ] tokenConfigs mapping
  - [ ] weth immutable
예상시간: 2h
의존성: T2.3.1
```

#### T2.3.3 Uniswap V3 TWAP
```yaml
작업:
  - [ ] configureToken() (pool, twapWindow, isToken0)
  - [ ] getPrice() - TWAP 조회
  - [ ] OracleLibrary.consult() 호출
  - [ ] TickMath.getSqrtRatioAtTick() 변환
  - [ ] isSupportedToken() 구현
예상시간: 4h
의존성: T2.3.2
```

**TWAPOracle 구현**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/libraries/OracleLibrary.sol";
import {TickMath} from "@uniswap/v3-core/libraries/TickMath.sol";

/// @title TWAPOracle
/// @notice Uniswap V3 TWAP 기반 가격 오라클
/// @dev 개발/테스트 환경용. 프로덕션에서는 ChainlinkOracle 권장
contract TWAPOracle is IPriceOracle {
    struct OracleConfig {
        address pool;
        uint32 twapWindow;
        bool isToken0;
    }

    mapping(address => OracleConfig) public tokenConfigs;
    address public immutable weth;

    function getPrice(address token) external view returns (uint256) {
        OracleConfig memory config = tokenConfigs[token];
        require(config.pool != address(0), "Token not configured");

        (int24 tick,) = OracleLibrary.consult(config.pool, config.twapWindow);
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);

        if (config.isToken0) {
            return (uint256(sqrtPriceX96) ** 2 * 1e18) >> 192;
        } else {
            return (1e18 << 192) / (uint256(sqrtPriceX96) ** 2);
        }
    }

    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        uint256 priceIn = this.getPrice(tokenIn);
        uint256 priceOut = this.getPrice(tokenOut);
        amountOut = (amountIn * priceIn) / priceOut;
    }

    function isSupportedToken(address token) external view returns (bool) {
        return tokenConfigs[token].pool != address(0);
    }
}
```

> **⚠️ 주의**: TWAPOracle은 Flash Loan 공격에 취약할 수 있습니다.
> 프로덕션 환경에서는 Phase 4의 **ChainlinkOracle**을 사용하세요.

#### T2.3.4 Fallback 가격
```yaml
작업:
  - [ ] 가격 유효성 검사 (freshness, deviation)
  - [ ] Fallback 메커니즘 (옵션)
예상시간: 2h
의존성: T2.3.3
```

---

### 3.4 Permit2Paymaster (T2.4)

> **IPriceOracle 의존성**: ERC20Paymaster와 동일하게 IPriceOracle 인터페이스 사용

#### T2.4.1 기본 구조
```yaml
파일: src/paymasters/Permit2Paymaster.sol
작업:
  - [ ] IPaymaster 상속
  - [ ] permit2 immutable
  - [ ] IPriceOracle priceOracle (생성자에서 주입)
예상시간: 1h
의존성: T2.3.1 (IPriceOracle)
```

#### T2.4.2 Permit2Data 구조체
```yaml
작업:
  - [ ] Permit2Data struct
    - token: address
    - amount: uint256
    - nonce: uint256
    - deadline: uint256
    - signature: bytes
  - [ ] _parsePermit2Data() 내부 함수
예상시간: 1h
의존성: T2.4.1
```

#### T2.4.3 validatePaymasterUserOp()
```yaml
작업:
  - [ ] Permit2Data 파싱
  - [ ] IPermit2.PermitTransferFrom 구성
  - [ ] permit2.permitTransferFrom() 호출
  - [ ] 토큰 수신 확인
  - [ ] context 인코딩
예상시간: 4h
의존성: T2.4.2
```

#### T2.4.4 postOp()
```yaml
작업:
  - [ ] ERC20Paymaster와 유사
  - [ ] 환불 처리
예상시간: 2h
의존성: T2.4.3
```

---

## 4. Validator 태스크 분해

### 4.1 WebAuthnValidator (T2.5)

#### T2.5.1 기본 구조
```yaml
파일: src/validators/WebAuthnValidator.sol
작업:
  - [ ] IValidator 상속
  - [ ] credentialIds mapping (account → bytes32)
  - [ ] publicKeys mapping (account → uint256[2])
예상시간: 2h
의존성: Phase 1 완료
```

#### T2.5.2 WebAuthnData 구조체
```yaml
작업:
  - [ ] WebAuthnData struct
    - authenticatorData: bytes
    - clientDataJSON: string
    - challengeOffset: uint256
    - rs: uint256[2] (P256 signature)
  - [ ] _decodeWebAuthnData() 내부 함수
예상시간: 2h
의존성: T2.5.1
```

#### T2.5.3 P256 Precompile / Library
```yaml
작업:
  - [ ] P256 signature verification
  - [ ] EIP-7212 precompile 사용 (if available)
  - [ ] 또는 FreshCryptoLib/p256-verifier 사용
예상시간: 4h
의존성: T2.5.1
```

#### T2.5.4 validateUserOp()
```yaml
작업:
  - [ ] WebAuthnData 디코딩
  - [ ] clientDataJSON에서 challenge 추출
  - [ ] challenge base64url 디코딩 → userOpHash 비교
  - [ ] authenticatorData + clientDataJSON hash
  - [ ] P256 서명 검증
예상시간: 6h
의존성: T2.5.2, T2.5.3
```

> **중요**: WebAuthn의 challenge는 **base64url 인코딩**되어 clientDataJSON에 포함됩니다.
> 따라서 userOpHash를 base64url로 인코딩한 값과 비교하거나,
> challenge를 base64url 디코딩하여 원본 해시와 비교해야 합니다.

**WebAuthn 검증 흐름**:
```
validateUserOp(userOp, userOpHash)
├── data = _decodeWebAuthnData(userOp.signature)
├── challenge = _extractChallenge(data.clientDataJSON, data.challengeOffset)
├── // challenge는 base64url 인코딩된 상태
├── expectedChallenge = base64url.encode(userOpHash)
├── require(challenge == expectedChallenge)
├── message = sha256(data.authenticatorData || sha256(clientDataJSON))
├── pubKey = publicKeys[userOp.sender]
└── return P256.verify(message, data.rs, pubKey) ? 0 : SIG_VALIDATION_FAILED
```

#### T2.5.5 Credential 등록
```yaml
작업:
  - [ ] onInstall() - credential 등록
  - [ ] updateCredential() - 키 교체
  - [ ] onUninstall() - credential 삭제
예상시간: 2h
의존성: T2.5.1
```

---

### 4.2 MultiSigValidator (T2.6)

#### T2.6.1 기본 구조
```yaml
파일: src/validators/MultiSigValidator.sol
작업:
  - [ ] IValidator 상속
  - [ ] MultiSigConfig struct (signers[], threshold)
  - [ ] configs mapping (account → config)
예상시간: 2h
의존성: Phase 1 완료
```

#### T2.6.2 Signer 관리
```yaml
작업:
  - [ ] onInstall() - initial signers 설정
  - [ ] addSigner() - signer 추가
  - [ ] removeSigner() - signer 제거
  - [ ] changeThreshold() - threshold 변경
  - [ ] getConfig() view
예상시간: 3h
의존성: T2.6.1
```

#### T2.6.3 validateUserOp()
```yaml
작업:
  - [ ] signature 파싱 (각 65 bytes)
  - [ ] 각 서명에서 signer 복구
  - [ ] signer 순서 검증 (오름차순, 중복 방지)
  - [ ] valid signer 카운트
  - [ ] threshold 비교
예상시간: 4h
의존성: T2.6.2
```

**MultiSig 검증**:
```solidity
function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
    external view returns (uint256)
{
    MultiSigConfig storage config = configs[userOp.sender];
    bytes[] memory sigs = _parseSignatures(userOp.signature);

    require(sigs.length >= config.threshold, "Not enough signatures");

    bytes32 ethSignedHash = userOpHash.toEthSignedMessageHash();
    address lastSigner;
    uint8 validCount;

    for (uint i = 0; i < sigs.length; i++) {
        address signer = ECDSA.recover(ethSignedHash, sigs[i]);
        require(signer > lastSigner, "Invalid order");
        lastSigner = signer;

        if (_isSigner(config, signer)) validCount++;
    }

    return validCount >= config.threshold ? 0 : SIG_VALIDATION_FAILED;
}
```

---

## 5. Executor 태스크 분해

### 5.1 SessionKeyExecutor (T2.7)

#### T2.7.1 기본 구조
```yaml
파일: src/executors/SessionKeyExecutor.sol
작업:
  - [ ] IExecutor 상속
  - [ ] SessionConfig struct
  - [ ] sessions mapping (account → sessionId → config)
예상시간: 2h
의존성: Phase 1 완료
```

**SessionConfig 구조**:
```solidity
struct SessionConfig {
    address sessionKey;      // 세션 키 주소
    address target;          // 허용된 타겟 컨트랙트
    bytes4 selector;         // 허용된 함수 selector
    uint256 maxValue;        // 최대 ETH value
    uint48 validAfter;       // 시작 시간
    uint48 validUntil;       // 만료 시간
    uint256 maxCalls;        // 최대 호출 횟수
    uint256 callCount;       // 현재 호출 횟수
}
```

#### T2.7.2 Session 관리
```yaml
작업:
  - [ ] createSession() - 세션 생성
  - [ ] revokeSession() - 세션 취소
  - [ ] updateSession() - 세션 업데이트
  - [ ] getSession() view
  - [ ] isSessionActive() view
예상시간: 3h
의존성: T2.7.1
```

#### T2.7.3 execute()
```yaml
작업:
  - [ ] sessionKey 검증 (msg.sender)
  - [ ] 시간 검증 (validAfter, validUntil)
  - [ ] callCount 검증 (< maxCalls)
  - [ ] target, selector, value 검증
  - [ ] callCount 증가
  - [ ] account.executeFromExecutor() 호출
예상시간: 4h
의존성: T2.7.2
```

#### T2.7.4 Permission Extensions
```yaml
작업:
  - [ ] 다중 target 허용 (targets[])
  - [ ] 다중 selector 허용 (selectors[])
  - [ ] value 범위 (minValue, maxValue)
  - [ ] callData 검증 (특정 파라미터 제한)
예상시간: 3h
의존성: T2.7.3
```

---

### 5.2 RecurringPaymentExecutor (T2.8)

#### T2.8.1 기본 구조
```yaml
파일: src/executors/RecurringPaymentExecutor.sol
작업:
  - [ ] IExecutor 상속
  - [ ] Subscription struct
  - [ ] subscriptions mapping
예상시간: 2h
의존성: Phase 1 완료
```

**Subscription 구조**:
```solidity
struct Subscription {
    address token;           // 결제 토큰
    address recipient;       // 수신자
    uint256 amount;          // 결제 금액
    uint48 interval;         // 결제 간격 (초)
    uint48 lastPayment;      // 마지막 결제 시간
    uint48 endTime;          // 구독 종료 시간
    bool active;             // 활성 상태
}
```

#### T2.8.2 Subscription 관리
```yaml
작업:
  - [ ] createSubscription() - 구독 생성
  - [ ] cancelSubscription() - 구독 취소
  - [ ] updateSubscription() - 구독 수정
  - [ ] getSubscription() view
예상시간: 3h
의존성: T2.8.1
```

#### T2.8.3 executePayment()
```yaml
작업:
  - [ ] 구독 활성 상태 확인
  - [ ] 시간 검증 (>= lastPayment + interval)
  - [ ] 종료 시간 검증 (<= endTime)
  - [ ] lastPayment 업데이트
  - [ ] IERC20.transfer() 호출 인코딩
  - [ ] account.executeFromExecutor() 호출
예상시간: 4h
의존성: T2.8.2
```

#### T2.8.4 Batch Execution
```yaml
작업:
  - [ ] executeBatchPayments() - 여러 구독 한번에 실행
  - [ ] 가스 최적화 (단일 executeFromExecutor batch)
예상시간: 2h
의존성: T2.8.3
```

---

### 5.3 BatchExecutor (T2.9)

#### T2.9.1 기본 구조
```yaml
파일: src/executors/BatchExecutor.sol
작업:
  - [ ] IExecutor 상속
  - [ ] 권한 설정 (누가 batch 실행 가능)
예상시간: 1h
의존성: Phase 1 완료
```

#### T2.9.2 executeBatch()
```yaml
작업:
  - [ ] calls[] 배열 받기
  - [ ] 모든 call을 batch 모드로 실행
  - [ ] results[] 반환
예상시간: 2h
의존성: T2.9.1
```

---

## 6. Hook 태스크 분해

### 6.1 SpendingLimitHook (T2.10)

#### T2.10.1 기본 구조
```yaml
파일: src/hooks/SpendingLimitHook.sol
작업:
  - [ ] IHook 상속
  - [ ] SpendingLimit struct
  - [ ] limits mapping (account → token → limit)
예상시간: 2h
의존성: Phase 1 완료
```

**SpendingLimit 구조**:
```solidity
struct SpendingLimit {
    uint256 dailyLimit;
    uint256 weeklyLimit;
    uint256 monthlyLimit;
    uint256 dailySpent;
    uint256 weeklySpent;
    uint256 monthlySpent;
    uint48 lastDailyReset;
    uint48 lastWeeklyReset;
    uint48 lastMonthlyReset;
}
```

#### T2.10.2 Limit 관리
```yaml
작업:
  - [ ] setLimit() - 한도 설정
  - [ ] getLimit() view
  - [ ] getRemainingLimit() view
  - [ ] _resetIfNeeded() 내부 함수
예상시간: 3h
의존성: T2.10.1
```

#### T2.10.3 preCheck()
```yaml
작업:
  - [ ] execution 파싱 (target, value, data)
  - [ ] ERC20 transfer/approve 감지
  - [ ] 금액 추출
  - [ ] 한도 확인 및 업데이트
  - [ ] hookData 반환 (원본 데이터)
예상시간: 4h
의존성: T2.10.2
```

#### T2.10.4 postCheck()
```yaml
작업:
  - [ ] 실행 성공/실패 기반 정리
  - [ ] 실패 시 spent 롤백
예상시간: 2h
의존성: T2.10.3
```

---

### 6.2 AuditHook (T2.11)

#### T2.11.1 기본 구조
```yaml
파일: src/hooks/AuditHook.sol
작업:
  - [ ] IHook 상속
  - [ ] AuditConfig struct
  - [ ] configs mapping
예상시간: 1h
의존성: Phase 1 완료
```

#### T2.11.2 AuditLog 이벤트
```yaml
작업:
  - [ ] AuditLog event 정의
    - account, target, selector, value, dataHash, timestamp, success
  - [ ] 이벤트 인덱싱 최적화
예상시간: 1h
의존성: T2.11.1
```

#### T2.11.3 preCheck/postCheck
```yaml
작업:
  - [ ] preCheck: timestamp, msgData 캡처
  - [ ] postCheck: AuditLog 이벤트 발행
  - [ ] 필터링 (watchedTokens, minAmount)
예상시간: 2h
의존성: T2.11.2
```

---

### 6.3 PolicyHook (T2.12)

#### T2.12.1 기본 구조
```yaml
파일: src/hooks/PolicyHook.sol
작업:
  - [ ] IHook 상속
  - [ ] Policy struct (rules[])
  - [ ] policies mapping
예상시간: 2h
의존성: Phase 1 완료
```

#### T2.12.2 Policy Rules
```yaml
작업:
  - [ ] Rule types: WHITELIST, BLACKLIST, TIME_RESTRICT, GEO_RESTRICT
  - [ ] addRule() / removeRule()
  - [ ] checkPolicy()
예상시간: 4h
의존성: T2.12.1
```

#### T2.12.3 preCheck()
```yaml
작업:
  - [ ] 모든 rule 순회
  - [ ] 각 rule 검증
  - [ ] 실패 시 revert
예상시간: 2h
의존성: T2.12.2
```

---

## 7. 테스트 작성 (T2.13)

### T2.13.1 Paymaster 테스트
```yaml
파일: test/paymasters/*.t.sol
작업:
  - [ ] VerifyingPaymaster.t.sol
    - validatePaymasterUserOp 성공/실패
    - postOp 가스 정산
    - deposit/withdraw
  - [ ] ERC20Paymaster.t.sol
    - 토큰 결제 플로우
    - 가격 변동 시나리오
    - 환불 검증
  - [ ] Permit2Paymaster.t.sol
    - Permit2 서명 검증
    - 토큰 전송 검증
예상시간: 10h
의존성: T2.1 ~ T2.4
```

### T2.13.2 Validator 테스트
```yaml
파일: test/validators/*.t.sol
작업:
  - [ ] WebAuthnValidator.t.sol
    - P256 서명 검증
    - credential 등록/갱신
  - [ ] MultiSigValidator.t.sol
    - threshold 검증
    - signer 추가/제거
    - 서명 순서 검증
예상시간: 8h
의존성: T2.5, T2.6
```

### T2.13.3 Executor 테스트
```yaml
파일: test/executors/*.t.sol
작업:
  - [ ] SessionKeyExecutor.t.sol
    - 세션 생성/취소
    - 권한 검증
    - 만료 검증
  - [ ] RecurringPaymentExecutor.t.sol
    - 구독 생성/취소
    - 결제 실행
    - 간격 검증
예상시간: 8h
의존성: T2.7 ~ T2.9
```

### T2.13.4 Hook 테스트
```yaml
파일: test/hooks/*.t.sol
작업:
  - [ ] SpendingLimitHook.t.sol
    - 일/주/월 한도
    - 리셋 로직
    - 초과 시 revert
  - [ ] AuditHook.t.sol
    - 이벤트 발행 확인
예상시간: 6h
의존성: T2.10 ~ T2.12
```

### T2.13.5 Integration 테스트
```yaml
파일: test/integration/PaymasterFlow.t.sol
작업:
  - [ ] UserOp + VerifyingPaymaster 풀플로우
  - [ ] UserOp + ERC20Paymaster 풀플로우
  - [ ] SessionKey + SpendingLimit 조합
예상시간: 6h
의존성: T2.13.1 ~ T2.13.4
```

---

## 8. 배포 스크립트 (T2.14)

### T2.14.1 DeployPaymasters.s.sol
```yaml
파일: script/DeployPaymasters.s.sol
작업:
  - [ ] PriceOracle 배포
  - [ ] VerifyingPaymaster 배포
  - [ ] ERC20Paymaster 배포
  - [ ] 주소 저장
예상시간: 2h
의존성: T2.13.*
```

### T2.14.2 DeployModules.s.sol
```yaml
파일: script/DeployModules.s.sol
작업:
  - [ ] WebAuthnValidator 배포
  - [ ] MultiSigValidator 배포
  - [ ] SessionKeyExecutor 배포
  - [ ] RecurringPaymentExecutor 배포
  - [ ] SpendingLimitHook 배포
  - [ ] 주소 저장
예상시간: 2h
의존성: T2.13.*
```

---

## 9. 의존성 그래프

```
Phase 1 (Core) 완료
    │
    ├── T2.1 (VerifyingPaymaster)
    │   ├── T2.1.1 기본 구조
    │   ├── T2.1.2 PaymasterData ◄── T2.1.1
    │   ├── T2.1.3 validatePaymasterUserOp ◄── T2.1.2
    │   ├── T2.1.4 postOp ◄── T2.1.3
    │   ├── T2.1.5 Deposit 관리 ◄── T2.1.1
    │   └── T2.1.6 Admin ◄── T2.1.1
    │
    ├── T2.3 (PriceOracle)
    │   ├── T2.3.1 기본 구조
    │   ├── T2.3.2 TWAP ◄── T2.3.1
    │   └── T2.3.3 Fallback ◄── T2.3.2
    │
    ├── T2.2 (ERC20Paymaster) ◄── T2.3
    │   ├── T2.2.1 기본 구조
    │   ├── T2.2.2 Token 관리 ◄── T2.2.1
    │   ├── T2.2.3 validatePaymasterUserOp ◄── T2.2.2, T2.3
    │   ├── T2.2.4 postOp ◄── T2.2.3
    │   └── T2.2.5 Fee 수집 ◄── T2.2.1
    │
    ├── T2.4 (Permit2Paymaster) ◄── T2.3
    │
    ├── T2.5 (WebAuthnValidator)
    │   ├── T2.5.1 기본 구조
    │   ├── T2.5.2 WebAuthnData ◄── T2.5.1
    │   ├── T2.5.3 P256 ◄── T2.5.1
    │   ├── T2.5.4 validateUserOp ◄── T2.5.2, T2.5.3
    │   └── T2.5.5 Credential 등록 ◄── T2.5.1
    │
    ├── T2.6 (MultiSigValidator)
    │
    ├── T2.7 (SessionKeyExecutor)
    │   ├── T2.7.1 기본 구조
    │   ├── T2.7.2 Session 관리 ◄── T2.7.1
    │   ├── T2.7.3 execute ◄── T2.7.2
    │   └── T2.7.4 Extensions ◄── T2.7.3
    │
    ├── T2.8 (RecurringPaymentExecutor)
    │
    ├── T2.10 (SpendingLimitHook)
    │
    ├── T2.11 (AuditHook)
    │
    └── T2.12 (PolicyHook)

T2.13 (테스트) ◄── T2.1 ~ T2.12
T2.14 (배포) ◄── T2.13
```

---

## 10. 일정 추정

| Week | 작업 그룹 | 예상 시간 |
|------|----------|-----------|
| Week 1 Day 1-2 | T2.1 VerifyingPaymaster | 12h |
| Week 1 Day 3-4 | T2.3 PriceOracle + T2.2 ERC20Paymaster | 18h |
| Week 1 Day 5 | T2.4 Permit2Paymaster | 8h |
| Week 2 Day 1-2 | T2.5 WebAuthnValidator | 16h |
| Week 2 Day 3 | T2.6 MultiSigValidator | 9h |
| Week 2 Day 4-5 | T2.7 SessionKeyExecutor | 12h |
| Week 3 Day 1 | T2.8 RecurringPaymentExecutor | 11h |
| Week 3 Day 2 | T2.10-12 Hooks | 15h |
| Week 3 Day 3-5 | T2.13 테스트 + T2.14 배포 | 40h |

**총 예상 시간**: ~140h (3주)

---

## 11. 체크리스트

### Phase 2 완료 조건

- [ ] VerifyingPaymaster 동작 확인
- [ ] ERC20Paymaster 토큰 결제 성공
- [ ] PriceOracle TWAP 가격 조회 성공
- [ ] WebAuthnValidator P256 검증 성공
- [ ] MultiSigValidator threshold 검증 성공
- [ ] SessionKeyExecutor 세션 실행 성공
- [ ] RecurringPaymentExecutor 정기 결제 성공
- [ ] SpendingLimitHook 한도 적용 확인
- [ ] 테스트 커버리지 80%+
- [ ] Anvil devnet 배포 완료

---

*Phase 2 문서 끝*
