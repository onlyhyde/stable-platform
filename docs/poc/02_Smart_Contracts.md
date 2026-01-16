# StableNet Smart Contracts 구조

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 컨트랙트 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Smart Contract Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Core Layer                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  EntryPoint  │  │SmartAccount  │  │   Kernel     │              │   │
│  │  │   v0.7       │  │  Factory     │  │   v3.1       │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Module Layer (ERC-7579)                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │   │
│  │  │ Validators │  │ Executors  │  │   Hooks    │  │ Fallbacks  │   │   │
│  │  │ - ECDSA    │  │ - Session  │  │ - Spending │  │ - Recovery │   │   │
│  │  │ - WebAuthn │  │ - Recurring│  │ - Policy   │  │ - Upgrade  │   │   │
│  │  │ - Multi    │  │ - Batch    │  │ - Audit    │  │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Paymaster Layer                                │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │VerifyingPaymaster│  │ ERC20Paymaster   │  │ Permit2Paymaster │  │   │
│  │  │  (가스비 대납)    │  │ (토큰 결제)       │  │ (승인 없는 결제)  │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DeFi Layer                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ UniswapV3    │  │ Universal    │  │   Price      │              │   │
│  │  │ Factory/Pool │  │   Router     │  │   Oracle     │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Privacy Layer                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ERC5564       │  │ERC6538       │  │ PrivateBank  │              │   │
│  │  │Announcer     │  │Registry      │  │              │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Subscription Layer                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │ERC7715Permission │  │ERC7710Delegation │  │SubscriptionManager│  │   │
│  │  │   Manager        │  │   Manager        │  │                   │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Bridge Layer                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ SecureBridge │  │   Bridge     │  │   Message    │              │   │
│  │  │              │  │  Validator   │  │   Verifier   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Compliance Layer                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Regulatory   │  │  Proof of    │  │    KYC       │              │   │
│  │  │ Registry     │  │  Reserve     │  │   Registry   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐                                │   │
│  │  │ Audit        │  │  Monthly     │                                │   │
│  │  │ Logger       │  │ Attestation  │                                │   │
│  │  └──────────────┘  └──────────────┘                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Contracts

### 2.1 EntryPoint (ERC-4337 v0.7)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EntryPoint v0.7
 * @notice ERC-4337 Account Abstraction 핵심 컨트랙트
 * @dev UserOperation 검증 및 실행의 단일 진입점
 */
interface IEntryPoint {
    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;      // callGasLimit (16 bytes) | verificationGasLimit (16 bytes)
        uint256 preVerificationGas;
        bytes32 gasFees;                // maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
        bytes paymasterAndData;
        bytes signature;
    }

    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external;

    function getUserOpHash(PackedUserOperation calldata userOp)
        external view returns (bytes32);

    function getNonce(address sender, uint192 key)
        external view returns (uint256);

    function depositTo(address account) external payable;

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}
```

**주요 기능**:
- UserOperation 검증 및 실행
- Nonce 관리 (2D nonce: key + sequence)
- Paymaster 연동
- Aggregated signature 지원

### 2.2 SmartAccount (Kernel v3.1)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {IERC7579Account} from "erc7579/interfaces/IERC7579Account.sol";

/**
 * @title Kernel Smart Account
 * @notice ERC-4337 + ERC-7579 호환 모듈형 스마트 계정
 * @dev EIP-7702로 EOA에서 업그레이드 가능
 */
contract Kernel is IAccount, IERC7579Account {
    // Storage layout for ERC-7201 namespaced storage
    bytes32 private constant KERNEL_STORAGE_SLOT =
        keccak256("kernel.storage.v3.1");

    struct KernelStorage {
        address currentValidator;
        mapping(bytes4 => address) selectorConfig;
        mapping(address => ModuleConfig) modules;
    }

    struct ModuleConfig {
        bool isInstalled;
        bytes4 moduleType;
        bytes data;
    }

    // ERC-4337 validateUserOp
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        // 1. Validator 모듈로 서명 검증 위임
        // 2. 필요시 prefund 처리
        // 3. validationData 반환 (validAfter, validUntil, aggregator)
    }

    // ERC-7579 execute
    function execute(
        bytes32 mode,
        bytes calldata executionCalldata
    ) external payable {
        // mode에 따라 single/batch/delegatecall 실행
    }

    // ERC-7579 executeFromExecutor
    function executeFromExecutor(
        bytes32 mode,
        bytes calldata executionCalldata
    ) external payable returns (bytes[] memory returnData) {
        // Executor 모듈에서 호출
    }

    // Module management
    function installModule(
        uint256 moduleTypeId,
        address module,
        bytes calldata initData
    ) external payable;

    function uninstallModule(
        uint256 moduleTypeId,
        address module,
        bytes calldata deInitData
    ) external payable;

    function isModuleInstalled(
        uint256 moduleTypeId,
        address module,
        bytes calldata additionalContext
    ) external view returns (bool);
}
```

### 2.3 AccountFactory

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AccountFactory
 * @notice Smart Account 생성 팩토리
 * @dev CREATE2로 결정론적 주소 생성
 */
contract AccountFactory {
    address public immutable accountImplementation;
    address public immutable entryPoint;

    event AccountCreated(
        address indexed account,
        address indexed owner,
        uint256 salt
    );

    function createAccount(
        address owner,
        uint256 salt,
        bytes calldata initData
    ) external returns (address account) {
        bytes32 actualSalt = keccak256(abi.encodePacked(owner, salt));

        account = address(new ERC1967Proxy{salt: actualSalt}(
            accountImplementation,
            abi.encodeCall(Kernel.initialize, (owner, initData))
        ));

        emit AccountCreated(account, owner, salt);
    }

    function getAddress(
        address owner,
        uint256 salt
    ) external view returns (address) {
        bytes32 actualSalt = keccak256(abi.encodePacked(owner, salt));
        return Create2.computeAddress(
            actualSalt,
            keccak256(type(ERC1967Proxy).creationCode)
        );
    }
}
```

---

## 3. ERC-7579 Modules

### 3.1 Module Types

| Type ID | Type | 설명 |
|---------|------|------|
| 1 | Validator | UserOp 서명 검증 |
| 2 | Executor | 외부에서 실행 트리거 |
| 3 | Fallback | 알 수 없는 함수 호출 처리 |
| 4 | Hook | 실행 전/후 로직 |

### 3.2 Validator Modules

#### ECDSAValidator

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IValidator} from "erc7579/interfaces/IValidator.sol";

/**
 * @title ECDSAValidator
 * @notice secp256k1 ECDSA 서명 검증
 */
contract ECDSAValidator is IValidator {
    mapping(address => address) public owners;

    function onInstall(bytes calldata data) external {
        address owner = abi.decode(data, (address));
        owners[msg.sender] = owner;
    }

    function onUninstall(bytes calldata) external {
        delete owners[msg.sender];
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external view returns (uint256 validationData) {
        address owner = owners[userOp.sender];
        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(userOpHash);

        address recovered = ECDSA.recover(ethSignedHash, userOp.signature);

        if (recovered != owner) {
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4) {
        address owner = owners[sender];
        address recovered = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(hash),
            signature
        );

        if (recovered == owner) {
            return IERC1271.isValidSignature.selector;
        }
        return bytes4(0xffffffff);
    }
}
```

#### WebAuthnValidator

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WebAuthnValidator
 * @notice WebAuthn/Passkey 서명 검증 (P256)
 */
contract WebAuthnValidator is IValidator {
    struct WebAuthnData {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeOffset;
        uint256[2] rs;  // signature
    }

    mapping(address => bytes32) public credentialIds;
    mapping(address => uint256[2]) public publicKeys;  // P256 public key

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external view returns (uint256 validationData) {
        WebAuthnData memory data = abi.decode(userOp.signature, (WebAuthnData));

        // 1. clientDataJSON에서 challenge 추출 및 검증
        bytes32 challenge = _extractChallenge(data.clientDataJSON, data.challengeOffset);
        if (challenge != userOpHash) {
            return SIG_VALIDATION_FAILED;
        }

        // 2. P256 서명 검증
        bytes32 message = sha256(abi.encodePacked(
            data.authenticatorData,
            sha256(bytes(data.clientDataJSON))
        ));

        uint256[2] memory pubKey = publicKeys[userOp.sender];
        if (!P256.verify(message, data.rs, pubKey)) {
            return SIG_VALIDATION_FAILED;
        }

        return 0;
    }
}
```

#### MultiSigValidator

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigValidator
 * @notice M-of-N 다중 서명 검증
 */
contract MultiSigValidator is IValidator {
    struct MultiSigConfig {
        address[] signers;
        uint8 threshold;
    }

    mapping(address => MultiSigConfig) public configs;

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external view returns (uint256 validationData) {
        MultiSigConfig storage config = configs[userOp.sender];

        // 서명 파싱 (각 65 bytes)
        bytes[] memory signatures = _parseSignatures(userOp.signature);

        if (signatures.length < config.threshold) {
            return SIG_VALIDATION_FAILED;
        }

        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(userOpHash);
        uint8 validCount = 0;
        address lastSigner = address(0);

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(ethSignedHash, signatures[i]);

            // 중복 방지 (주소 순서 검증)
            require(signer > lastSigner, "Invalid signer order");
            lastSigner = signer;

            if (_isSigner(config, signer)) {
                validCount++;
            }
        }

        if (validCount < config.threshold) {
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }
}
```

### 3.3 Executor Modules

#### SessionKeyExecutor

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SessionKeyExecutor
 * @notice 임시 세션 키로 제한된 트랜잭션 실행
 */
contract SessionKeyExecutor is IExecutor {
    struct SessionConfig {
        address sessionKey;
        address target;
        bytes4 selector;
        uint256 maxValue;
        uint48 validAfter;
        uint48 validUntil;
        uint256 maxCalls;
        uint256 callCount;
    }

    mapping(address => mapping(bytes32 => SessionConfig)) public sessions;

    function execute(
        address account,
        bytes calldata sessionId,
        bytes calldata callData
    ) external returns (bytes memory) {
        bytes32 id = keccak256(sessionId);
        SessionConfig storage session = sessions[account][id];

        require(msg.sender == session.sessionKey, "Invalid session key");
        require(block.timestamp >= session.validAfter, "Session not active");
        require(block.timestamp <= session.validUntil, "Session expired");
        require(session.callCount < session.maxCalls, "Max calls exceeded");

        (address target, uint256 value, bytes memory data) =
            abi.decode(callData, (address, uint256, bytes));

        require(target == session.target, "Invalid target");
        require(bytes4(data) == session.selector, "Invalid selector");
        require(value <= session.maxValue, "Value too high");

        session.callCount++;

        return IERC7579Account(account).executeFromExecutor(
            ModeLib.encodeSimpleSingle(),
            ExecutionLib.encodeSingle(target, value, data)
        );
    }
}
```

#### RecurringPaymentExecutor

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RecurringPaymentExecutor
 * @notice 정기 결제 자동 실행
 */
contract RecurringPaymentExecutor is IExecutor {
    struct Subscription {
        address token;
        address recipient;
        uint256 amount;
        uint48 interval;      // seconds between payments
        uint48 lastPayment;
        uint48 endTime;
        bool active;
    }

    mapping(address => mapping(bytes32 => Subscription)) public subscriptions;

    event PaymentExecuted(
        address indexed account,
        bytes32 indexed subscriptionId,
        uint256 amount,
        uint256 timestamp
    );

    function executePayment(
        address account,
        bytes32 subscriptionId
    ) external returns (bytes memory) {
        Subscription storage sub = subscriptions[account][subscriptionId];

        require(sub.active, "Subscription not active");
        require(block.timestamp >= sub.lastPayment + sub.interval, "Too early");
        require(block.timestamp <= sub.endTime, "Subscription ended");

        sub.lastPayment = uint48(block.timestamp);

        bytes memory transferCall = abi.encodeCall(
            IERC20.transfer,
            (sub.recipient, sub.amount)
        );

        emit PaymentExecuted(account, subscriptionId, sub.amount, block.timestamp);

        return IERC7579Account(account).executeFromExecutor(
            ModeLib.encodeSimpleSingle(),
            ExecutionLib.encodeSingle(sub.token, 0, transferCall)
        );
    }
}
```

### 3.4 Hook Modules

#### SpendingLimitHook

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SpendingLimitHook
 * @notice 일일/주간/월간 지출 한도 관리
 */
contract SpendingLimitHook is IHook {
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

    mapping(address => mapping(address => SpendingLimit)) public limits;

    function preCheck(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) external returns (bytes memory hookData) {
        // 실행 전 한도 체크
        (address target, uint256 value, bytes memory data) =
            _parseExecution(msgData);

        if (data.length >= 4) {
            bytes4 selector = bytes4(data);
            if (selector == IERC20.transfer.selector ||
                selector == IERC20.approve.selector) {
                (, uint256 amount) = abi.decode(data[4:], (address, uint256));
                _checkAndUpdateLimit(msg.sender, target, amount);
            }
        }

        if (value > 0) {
            _checkAndUpdateLimit(msg.sender, address(0), value);
        }

        return abi.encode(target, value);
    }

    function postCheck(bytes calldata hookData) external {
        // 실행 후 검증 (선택적)
    }

    function _checkAndUpdateLimit(
        address account,
        address token,
        uint256 amount
    ) internal {
        SpendingLimit storage limit = limits[account][token];

        _resetIfNeeded(limit);

        require(
            limit.dailySpent + amount <= limit.dailyLimit,
            "Daily limit exceeded"
        );
        require(
            limit.weeklySpent + amount <= limit.weeklyLimit,
            "Weekly limit exceeded"
        );
        require(
            limit.monthlySpent + amount <= limit.monthlyLimit,
            "Monthly limit exceeded"
        );

        limit.dailySpent += amount;
        limit.weeklySpent += amount;
        limit.monthlySpent += amount;
    }
}
```

#### AuditHook

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AuditHook
 * @notice 규제 준수를 위한 감사 로그 기록
 */
contract AuditHook is IHook {
    event AuditLog(
        address indexed account,
        address indexed target,
        bytes4 selector,
        uint256 value,
        bytes32 dataHash,
        uint256 timestamp,
        bool success
    );

    struct AuditConfig {
        bool enabled;
        address[] watchedTokens;
        uint256 minAmountForLog;
    }

    mapping(address => AuditConfig) public configs;

    function preCheck(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) external returns (bytes memory hookData) {
        return abi.encode(block.timestamp, msgData);
    }

    function postCheck(bytes calldata hookData) external {
        (uint256 startTime, bytes memory originalData) =
            abi.decode(hookData, (uint256, bytes));

        AuditConfig storage config = configs[msg.sender];
        if (!config.enabled) return;

        // 감사 로그 기록
        emit AuditLog(
            msg.sender,
            address(0), // parsed from data
            bytes4(0),  // parsed from data
            0,          // value
            keccak256(originalData),
            block.timestamp,
            true
        );
    }
}
```

---

## 4. Paymaster Contracts

### 4.1 VerifyingPaymaster

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";

/**
 * @title VerifyingPaymaster
 * @notice 서명 기반 가스비 대납
 * @dev 오프체인 서버가 승인한 UserOp만 대납
 */
contract VerifyingPaymaster is IPaymaster {
    address public immutable entryPoint;
    address public verifyingSigner;

    mapping(address => uint256) public sponsorDeposits;
    mapping(bytes32 => bool) public usedHashes;

    struct PaymasterData {
        address sponsor;
        uint48 validUntil;
        uint48 validAfter;
        bytes signature;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        PaymasterData memory data = _parsePaymasterData(userOp.paymasterAndData);

        // 시간 유효성
        if (block.timestamp < data.validAfter || block.timestamp > data.validUntil) {
            return ("", _packValidationData(true, data.validUntil, data.validAfter));
        }

        // 스폰서 잔액 확인
        require(sponsorDeposits[data.sponsor] >= maxCost, "Insufficient sponsor deposit");

        // 서명 검증
        bytes32 hash = keccak256(abi.encode(
            userOpHash,
            data.sponsor,
            data.validUntil,
            data.validAfter
        ));

        require(!usedHashes[hash], "Hash already used");

        address recovered = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(hash),
            data.signature
        );

        if (recovered != verifyingSigner) {
            return ("", _packValidationData(true, 0, 0));
        }

        usedHashes[hash] = true;

        return (
            abi.encode(data.sponsor, maxCost),
            _packValidationData(false, data.validUntil, data.validAfter)
        );
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        (address sponsor, ) = abi.decode(context, (address, uint256));

        uint256 totalCost = actualGasCost +
            (actualGasCost * 10 / 100); // 10% markup

        sponsorDeposits[sponsor] -= totalCost;
    }
}
```

### 4.2 ERC20Paymaster

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC20Paymaster
 * @notice ERC-20 토큰으로 가스비 결제
 * @dev Oracle을 통해 토큰/ETH 환율 적용
 */
contract ERC20Paymaster is IPaymaster {
    address public immutable entryPoint;
    IOracle public priceOracle;

    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenMarkup; // basis points (100 = 1%)

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        (address token, uint256 maxTokenAmount) = _parsePaymasterData(
            userOp.paymasterAndData
        );

        require(supportedTokens[token], "Token not supported");

        // 필요한 토큰 양 계산
        uint256 tokenPrice = priceOracle.getPrice(token);
        uint256 requiredTokens = (maxCost * 1e18) / tokenPrice;
        uint256 markup = tokenMarkup[token];
        requiredTokens = requiredTokens + (requiredTokens * markup / 10000);

        require(requiredTokens <= maxTokenAmount, "Insufficient token allowance");

        // 사전 토큰 전송 (락)
        IERC20(token).transferFrom(userOp.sender, address(this), requiredTokens);

        return (
            abi.encode(userOp.sender, token, requiredTokens),
            0
        );
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        (address sender, address token, uint256 preChargedAmount) =
            abi.decode(context, (address, address, uint256));

        // 실제 사용량 계산
        uint256 tokenPrice = priceOracle.getPrice(token);
        uint256 actualTokenCost = (actualGasCost * 1e18) / tokenPrice;
        uint256 markup = tokenMarkup[token];
        actualTokenCost = actualTokenCost + (actualTokenCost * markup / 10000);

        // 환불
        if (preChargedAmount > actualTokenCost) {
            IERC20(token).transfer(sender, preChargedAmount - actualTokenCost);
        }
    }
}
```

### 4.3 Permit2Paymaster

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPermit2} from "permit2/interfaces/IPermit2.sol";

/**
 * @title Permit2Paymaster
 * @notice Permit2를 활용한 승인 없는 토큰 결제
 */
contract Permit2Paymaster is IPaymaster {
    IPermit2 public immutable permit2;
    address public immutable entryPoint;

    struct Permit2Data {
        address token;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        Permit2Data memory permitData = _parsePermit2Data(userOp.paymasterAndData);

        // Permit2 서명 검증 및 토큰 전송
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({
                token: permitData.token,
                amount: permitData.amount
            }),
            nonce: permitData.nonce,
            deadline: permitData.deadline
        });

        IPermit2.SignatureTransferDetails memory transferDetails =
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: permitData.amount
            });

        permit2.permitTransferFrom(
            permit,
            transferDetails,
            userOp.sender,
            permitData.signature
        );

        return (
            abi.encode(userOp.sender, permitData.token, permitData.amount),
            0
        );
    }
}
```

---

## 5. DeFi Contracts

### 5.1 Uniswap V3 Integration

```
┌───────────────────────────────────────────────────────────────────┐
│                      Uniswap V3 Architecture                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐                       │
│  │ UniswapV3Factory│───▶│ UniswapV3Pool   │                       │
│  │                 │    │  - WKRW/USDT    │                       │
│  │  createPool()   │    │  - WKRW/ETH     │                       │
│  └─────────────────┘    │  - USDT/ETH     │                       │
│                         └─────────────────┘                       │
│                                │                                   │
│                         ┌──────┴──────┐                           │
│                         ▼             ▼                           │
│               ┌─────────────┐  ┌─────────────┐                    │
│               │  Positions  │  │   Ticks     │                    │
│               │  NFT        │  │   Bitmap    │                    │
│               └─────────────┘  └─────────────┘                    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    UniversalRouter                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │  │
│  │  │ V3Swap  │  │ V2Swap  │  │ Permit2 │  │ Wrap    │        │  │
│  │  │ Module  │  │ Module  │  │ Module  │  │ Module  │        │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 PriceOracle

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PriceOracle
 * @notice Uniswap V3 TWAP 기반 가격 오라클
 */
contract PriceOracle {
    struct OracleConfig {
        address pool;
        uint32 twapWindow;
        bool isToken0;
    }

    mapping(address => OracleConfig) public tokenConfigs;
    address public immutable weth;

    function getPrice(address token) external view returns (uint256 price) {
        OracleConfig memory config = tokenConfigs[token];
        require(config.pool != address(0), "Token not configured");

        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
            config.pool,
            config.twapWindow
        );

        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);

        if (config.isToken0) {
            price = _getPriceFromSqrtPrice(sqrtPriceX96, true);
        } else {
            price = _getPriceFromSqrtPrice(sqrtPriceX96, false);
        }
    }

    function _getPriceFromSqrtPrice(
        uint160 sqrtPriceX96,
        bool isToken0
    ) internal pure returns (uint256) {
        uint256 price = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (isToken0) {
            return (price * 1e18) >> 192;
        } else {
            return (1e18 << 192) / price;
        }
    }
}
```

---

## 6. Privacy Contracts

### 6.1 ERC-5564 Stealth Address

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC5564Announcer
 * @notice Stealth Address 전송 공지
 */
contract ERC5564Announcer {
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    // schemeId 1 = secp256k1
    // schemeId 2 = ed25519

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        emit Announcement(
            schemeId,
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            metadata
        );
    }
}
```

### 6.2 ERC-6538 Registry

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC6538Registry
 * @notice Stealth Meta-Address 등록
 */
contract ERC6538Registry {
    event StealthMetaAddressSet(
        address indexed registrant,
        uint256 indexed schemeId,
        bytes stealthMetaAddress
    );

    // registrant => schemeId => stealthMetaAddress
    mapping(address => mapping(uint256 => bytes)) public stealthMetaAddresses;

    function registerKeys(
        uint256 schemeId,
        bytes calldata stealthMetaAddress
    ) external {
        stealthMetaAddresses[msg.sender][schemeId] = stealthMetaAddress;

        emit StealthMetaAddressSet(msg.sender, schemeId, stealthMetaAddress);
    }

    function registerKeysOnBehalf(
        address registrant,
        uint256 schemeId,
        bytes calldata stealthMetaAddress,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(abi.encodePacked(
            registrant,
            schemeId,
            stealthMetaAddress
        ));

        address recovered = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(hash),
            signature
        );
        require(recovered == registrant, "Invalid signature");

        stealthMetaAddresses[registrant][schemeId] = stealthMetaAddress;

        emit StealthMetaAddressSet(registrant, schemeId, stealthMetaAddress);
    }
}
```

### 6.3 PrivateBank

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PrivateBank
 * @notice Stealth Address로 프라이버시 보호 전송
 */
contract PrivateBank {
    IERC5564Announcer public immutable announcer;
    IERC6538Registry public immutable registry;

    uint256 public constant SCHEME_ID = 1; // secp256k1

    event StealthTransfer(
        address indexed token,
        address indexed stealthAddress,
        uint256 amount
    );

    /**
     * @notice Stealth Address로 토큰 전송
     * @param recipient 수신자 공개 주소 (Meta-Address 조회용)
     * @param token 전송할 토큰
     * @param amount 전송 금액
     * @param ephemeralPubKey 일회용 공개키
     * @param stealthAddress 계산된 Stealth Address
     * @param viewTag ViewTag for filtering
     */
    function sendToStealth(
        address recipient,
        address token,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        address stealthAddress,
        bytes1 viewTag
    ) external {
        // 1. 토큰 전송
        IERC20(token).transferFrom(msg.sender, stealthAddress, amount);

        // 2. Announcement 발행
        bytes memory metadata = abi.encodePacked(
            viewTag,
            token,
            amount
        );

        announcer.announce(
            SCHEME_ID,
            stealthAddress,
            ephemeralPubKey,
            metadata
        );

        emit StealthTransfer(token, stealthAddress, amount);
    }

    /**
     * @notice Native token (ETH) Stealth 전송
     */
    function sendETHToStealth(
        address recipient,
        bytes calldata ephemeralPubKey,
        address stealthAddress,
        bytes1 viewTag
    ) external payable {
        // 1. ETH 전송
        (bool success, ) = stealthAddress.call{value: msg.value}("");
        require(success, "ETH transfer failed");

        // 2. Announcement 발행
        bytes memory metadata = abi.encodePacked(
            viewTag,
            address(0), // native token
            msg.value
        );

        announcer.announce(
            SCHEME_ID,
            stealthAddress,
            ephemeralPubKey,
            metadata
        );

        emit StealthTransfer(address(0), stealthAddress, msg.value);
    }
}
```

---

## 7. Subscription Contracts

### 7.1 ERC-7715 Permission Manager

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC7715PermissionManager
 * @notice 권한 부여 및 관리
 */
contract ERC7715PermissionManager {
    struct Permission {
        address grantee;
        bytes4[] selectors;
        address[] targets;
        uint256 maxValue;
        uint48 validAfter;
        uint48 validUntil;
        uint256 usageLimit;
        uint256 usageCount;
        bool active;
    }

    // account => permissionId => Permission
    mapping(address => mapping(bytes32 => Permission)) public permissions;

    event PermissionGranted(
        address indexed account,
        bytes32 indexed permissionId,
        address indexed grantee,
        uint48 validUntil
    );

    event PermissionRevoked(
        address indexed account,
        bytes32 indexed permissionId
    );

    function grantPermission(
        address grantee,
        bytes4[] calldata selectors,
        address[] calldata targets,
        uint256 maxValue,
        uint48 validAfter,
        uint48 validUntil,
        uint256 usageLimit
    ) external returns (bytes32 permissionId) {
        permissionId = keccak256(abi.encodePacked(
            msg.sender,
            grantee,
            selectors,
            targets,
            block.timestamp
        ));

        permissions[msg.sender][permissionId] = Permission({
            grantee: grantee,
            selectors: selectors,
            targets: targets,
            maxValue: maxValue,
            validAfter: validAfter,
            validUntil: validUntil,
            usageLimit: usageLimit,
            usageCount: 0,
            active: true
        });

        emit PermissionGranted(msg.sender, permissionId, grantee, validUntil);
    }

    function validatePermission(
        address account,
        bytes32 permissionId,
        address target,
        bytes4 selector,
        uint256 value
    ) external returns (bool) {
        Permission storage perm = permissions[account][permissionId];

        require(perm.active, "Permission not active");
        require(msg.sender == perm.grantee, "Invalid grantee");
        require(block.timestamp >= perm.validAfter, "Permission not started");
        require(block.timestamp <= perm.validUntil, "Permission expired");
        require(perm.usageCount < perm.usageLimit, "Usage limit exceeded");
        require(value <= perm.maxValue, "Value too high");

        bool targetValid = false;
        for (uint i = 0; i < perm.targets.length; i++) {
            if (perm.targets[i] == target) {
                targetValid = true;
                break;
            }
        }
        require(targetValid, "Invalid target");

        bool selectorValid = false;
        for (uint i = 0; i < perm.selectors.length; i++) {
            if (perm.selectors[i] == selector) {
                selectorValid = true;
                break;
            }
        }
        require(selectorValid, "Invalid selector");

        perm.usageCount++;
        return true;
    }

    function revokePermission(bytes32 permissionId) external {
        permissions[msg.sender][permissionId].active = false;
        emit PermissionRevoked(msg.sender, permissionId);
    }
}
```

### 7.2 SubscriptionManager

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SubscriptionManager
 * @notice 정기 구독 관리 및 실행
 */
contract SubscriptionManager {
    IERC7715PermissionManager public immutable permissionManager;

    struct Subscription {
        bytes32 permissionId;
        address subscriber;
        address merchant;
        address token;
        uint256 amount;
        uint48 interval;
        uint48 nextPayment;
        uint48 endTime;
        string planId;
        bool active;
    }

    mapping(bytes32 => Subscription) public subscriptions;
    mapping(address => bytes32[]) public merchantSubscriptions;
    mapping(address => bytes32[]) public userSubscriptions;

    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        address indexed subscriber,
        address indexed merchant,
        string planId
    );

    event PaymentProcessed(
        bytes32 indexed subscriptionId,
        uint256 amount,
        uint256 timestamp
    );

    event SubscriptionCancelled(bytes32 indexed subscriptionId);

    function createSubscription(
        address merchant,
        address token,
        uint256 amount,
        uint48 interval,
        uint48 duration,
        string calldata planId,
        bytes32 permissionId
    ) external returns (bytes32 subscriptionId) {
        subscriptionId = keccak256(abi.encodePacked(
            msg.sender,
            merchant,
            token,
            amount,
            block.timestamp
        ));

        subscriptions[subscriptionId] = Subscription({
            permissionId: permissionId,
            subscriber: msg.sender,
            merchant: merchant,
            token: token,
            amount: amount,
            interval: interval,
            nextPayment: uint48(block.timestamp),
            endTime: uint48(block.timestamp + duration),
            planId: planId,
            active: true
        });

        merchantSubscriptions[merchant].push(subscriptionId);
        userSubscriptions[msg.sender].push(subscriptionId);

        emit SubscriptionCreated(subscriptionId, msg.sender, merchant, planId);

        // 첫 결제 실행
        _processPayment(subscriptionId);
    }

    function processPayment(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];

        require(sub.active, "Subscription not active");
        require(block.timestamp >= sub.nextPayment, "Too early");
        require(block.timestamp <= sub.endTime, "Subscription ended");

        _processPayment(subscriptionId);
    }

    function _processPayment(bytes32 subscriptionId) internal {
        Subscription storage sub = subscriptions[subscriptionId];

        // Permission 검증
        bool valid = permissionManager.validatePermission(
            sub.subscriber,
            sub.permissionId,
            sub.token,
            IERC20.transfer.selector,
            sub.amount
        );
        require(valid, "Permission validation failed");

        // 토큰 전송
        IERC20(sub.token).transferFrom(
            sub.subscriber,
            sub.merchant,
            sub.amount
        );

        sub.nextPayment = uint48(block.timestamp + sub.interval);

        emit PaymentProcessed(subscriptionId, sub.amount, block.timestamp);
    }

    function cancelSubscription(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];

        require(
            msg.sender == sub.subscriber || msg.sender == sub.merchant,
            "Unauthorized"
        );

        sub.active = false;

        emit SubscriptionCancelled(subscriptionId);
    }
}
```

---

## 8. Bridge Contracts

상세 Bridge 아키텍처는 [04_Secure_Bridge.md](./04_Secure_Bridge.md) 참조.

### 8.1 SecureBridge 요약

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SecureBridge
 * @notice MPC + Optimistic 검증 기반 보안 브릿지
 */
contract SecureBridge {
    // MPC 설정
    uint8 public constant THRESHOLD = 5;
    uint8 public constant TOTAL_SIGNERS = 7;

    // Optimistic 검증
    uint256 public constant CHALLENGE_PERIOD = 6 hours; // PoC

    // Rate Limiting
    uint256 public hourlyLimit;
    uint256 public dailyLimit;

    struct BridgeRequest {
        bytes32 id;
        address sender;
        address recipient;
        address token;
        uint256 amount;
        uint256 sourceChain;
        uint256 targetChain;
        uint256 timestamp;
        BridgeStatus status;
        bytes32 messageHash;
    }

    enum BridgeStatus {
        Pending,
        Approved,
        Challenged,
        Executed,
        Refunded
    }

    mapping(bytes32 => BridgeRequest) public requests;
    mapping(bytes32 => uint8) public approvalCount;
    mapping(bytes32 => mapping(address => bool)) public hasApproved;

    // Lock & Release
    function lockTokens(
        address token,
        uint256 amount,
        uint256 targetChain,
        address recipient
    ) external returns (bytes32 requestId);

    function approveRelease(
        bytes32 requestId,
        bytes calldata signature
    ) external;

    function executeRelease(bytes32 requestId) external;

    // Challenge
    function challengeRequest(
        bytes32 requestId,
        bytes calldata fraudProof
    ) external;

    function resolveChallenge(bytes32 requestId) external;
}
```

---

## 9. Compliance Contracts

규제 준수를 위한 스마트 컨트랙트입니다. 상세 구현은 [08_Regulatory_Compliance.md](./08_Regulatory_Compliance.md) 참조.

### 9.1 Compliance Contracts 개요

| 컨트랙트 | 목적 | 주요 기능 |
|---------|------|----------|
| **RegulatoryRegistry** | 규제기관 등록 및 권한 관리 | MRK 공개키 저장, 2-of-3 다중서명 승인 |
| **ProofOfReserve** | 100% 준비금 증명 | Chainlink PoR 오라클 연동, 자동 Pause |
| **KYCRegistry** | KYC 상태 온체인 기록 | 허용/차단 목록, OFAC 제재 연동 |
| **AuditLogger** | 불변 감사 로그 | 모든 규제기관 접근 기록 |
| **MonthlyAttestation** | CEO/CFO 월간 증명 | GENIUS Act 준수, 증명 누락 알림 |

### 9.2 RegulatoryRegistry 요약

```solidity
/**
 * @title RegulatoryRegistry
 * @notice 규제기관 등록 및 Regulatory Viewing Key 관리
 */
contract RegulatoryRegistry is AccessControlUpgradeable {
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    // Master Regulatory Key 공개키
    bytes public masterRegulatoryKeyPubKey;

    // 2-of-3 다중서명 승인 필요
    uint8 public constant REQUIRED_APPROVALS = 2;

    // 규제기관 등록
    function registerRegulator(address, string, string, uint8) external;

    // 자금 추적 요청 (법적 근거 필수)
    function requestTrace(address targetAccount, bytes32 legalBasisHash) external returns (bytes32);

    // 추적 요청 승인 (다중서명)
    function approveTrace(bytes32 requestId) external;
}
```

### 9.3 ProofOfReserve 요약

```solidity
/**
 * @title ProofOfReserve
 * @notice Chainlink PoR 오라클 기반 100% 준비금 증명
 */
contract ProofOfReserve is PausableUpgradeable {
    AggregatorV3Interface public reserveOracle;
    uint256 public constant MIN_RESERVE_RATIO = 10000; // 100%

    // 준비금 검증 (부족시 자동 Pause)
    function verifyReserve() external returns (bool);

    // 외부 감사인용 증명 생성
    function generateProof() external view returns (
        uint256 totalSupply,
        uint256 totalReserve,
        uint256 ratio,
        uint256 timestamp,
        bytes32 proofHash
    );
}
```

### 9.4 KYCRegistry 요약

```solidity
/**
 * @title KYCRegistry
 * @notice KYC 상태 및 제재 목록 관리
 */
contract KYCRegistry is AccessControlUpgradeable {
    enum KYCStatus { NONE, PENDING, VERIFIED, REJECTED, EXPIRED }
    enum RiskLevel { LOW, MEDIUM, HIGH, PROHIBITED }

    mapping(address => KYCRecord) public kycRecords;
    mapping(address => bool) public sanctionedAddresses;

    // KYC 상태 업데이트
    function updateKYCStatus(address, KYCStatus, RiskLevel, bytes32, string) external;

    // 거래 허용 여부 확인 (다른 컨트랙트에서 호출)
    function canTransact(address account) external view returns (bool);

    // 제재 목록 추가
    function addToSanctionList(address account, string reason) external;
}
```

---

## 10. 컨트랙트 배포 순서

```
Phase 1: Core Infrastructure
├── 1. Deploy EntryPoint v0.7
├── 2. Deploy Kernel Implementation
├── 3. Deploy AccountFactory
└── 4. Deploy ECDSAValidator

Phase 2: Module System
├── 5. Deploy WebAuthnValidator
├── 6. Deploy MultiSigValidator
├── 7. Deploy SessionKeyExecutor
├── 8. Deploy RecurringPaymentExecutor
├── 9. Deploy SpendingLimitHook
└── 10. Deploy AuditHook

Phase 3: Paymaster
├── 11. Deploy VerifyingPaymaster
├── 12. Deploy Permit2 (or use existing)
├── 13. Deploy PriceOracle
├── 14. Deploy ERC20Paymaster
└── 15. Deploy Permit2Paymaster

Phase 4: DeFi
├── 16. Deploy UniswapV3Factory
├── 17. Deploy UniswapV3Pool (WKRW/USDT)
├── 18. Deploy UniswapV3Pool (WKRW/ETH)
├── 19. Deploy NonfungiblePositionManager
└── 20. Deploy UniversalRouter

Phase 5: Privacy
├── 21. Deploy ERC5564Announcer
├── 22. Deploy ERC6538Registry
└── 23. Deploy PrivateBank

Phase 6: Subscription
├── 24. Deploy ERC7715PermissionManager
├── 25. Deploy ERC7710DelegationManager
└── 26. Deploy SubscriptionManager

Phase 7: Bridge
├── 27. Deploy BridgeValidator
├── 28. Deploy MessageVerifier
└── 29. Deploy SecureBridge

Phase 8: Compliance
├── 30. Deploy RegulatoryRegistry
├── 31. Deploy ProofOfReserve (with Chainlink PoR Oracle)
├── 32. Deploy KYCRegistry
├── 33. Deploy AuditLogger
└── 34. Deploy MonthlyAttestation
```

---

## 11. 보안 고려사항

### 11.1 공통 보안 패턴

| 패턴 | 적용 컨트랙트 | 설명 |
|------|--------------|------|
| Reentrancy Guard | 모든 토큰 전송 컨트랙트 | nonReentrant modifier |
| Access Control | Paymaster, Bridge, Compliance | OpenZeppelin AccessControl |
| Pausable | Core, ProofOfReserve | 긴급 정지 기능 |
| Rate Limiting | Bridge, Paymaster | 시간당/일일 한도 |
| Signature Replay | Paymaster, Permission | Nonce 및 deadline 적용 |
| Multi-Sig | RegulatoryRegistry | 2-of-3 다중서명 승인 |

### 11.2 감사 대상 우선순위

1. **Critical**: EntryPoint, Kernel, SecureBridge, RegulatoryRegistry
2. **High**: Paymaster 컨트랙트, SubscriptionManager, ProofOfReserve
3. **Medium**: Executor/Hook 모듈, PrivateBank, KYCRegistry
4. **Low**: Factory, Registry, Oracle, AuditLogger

---

## 12. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [03_Development_Roadmap.md](./03_Development_Roadmap.md) - 개발 로드맵
- [04_Secure_Bridge.md](./04_Secure_Bridge.md) - 브릿지 상세 설계
- [08_Regulatory_Compliance.md](./08_Regulatory_Compliance.md) - 규제 준수 아키텍처

---

*문서 끝*
