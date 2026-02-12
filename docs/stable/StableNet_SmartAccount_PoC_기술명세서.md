# StableNet Smart Account PoC 기술 명세서

## 1. Executive Summary

본 문서는 go-stablenet 체인을 기반으로 EIP-7702 및 Smart Account를 지원하는 PoC 프로젝트의 종합 기술 명세서입니다.

### 1.1 핵심 목표

| 기능 | 설명 | 관련 표준 |
|------|------|-----------|
| **EOA → Smart Account 전환** | EOA가 Smart Contract 코드를 위임받아 실행 | EIP-7702 |
| **가스비 대납** | 제3자가 사용자 대신 가스비 지불 | ERC-4337 Paymaster |
| **토큰으로 가스비 지불** | 네이티브 코인 대신 ERC-20 토큰으로 지불 | Paymaster + Swap |
| **정기 구독 결제** | 자동화된 반복 결제 | ERC-7715/7710 |
| **Plugin형 권한 부여** | 모듈식 Smart Account 확장 | ERC-7579 |
| **DEX 지원** | Uniswap V3 기반 스왑 | Uniswap V3 Core |
| **Bundler 지원** | UserOperation 번들링 및 제출 | ERC-4337 |
| **Stealth Addresses** | 프라이버시 보호 자금 이체 | EIP-5564 + Custom s-ca |

### 1.2 go-stablenet 현재 상태

```go
// core/types/transaction.go - 이미 지원되는 트랜잭션 타입
const (
    LegacyTxType                = 0x00
    AccessListTxType            = 0x01
    DynamicFeeTxType            = 0x02
    BlobTxType                  = 0x03
    SetCodeTxType               = 0x04  // ✅ EIP-7702 지원
    FeeDelegateDynamicFeeTxType = 0x16  // ✅ Fee Delegation 지원
)
```

---

## 2. 시스템 아키텍처

### 2.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Web3 dApp     │  │   Mobile Wallet │  │   SDK/Library   │              │
│  │   (React/Next)  │  │   (React Native)│  │   (TypeScript)  │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    StableNet SDK (viem/wagmi)                        │    │
│  │  • EIP-7702 Authorization signing                                    │    │
│  │  • ERC-4337 UserOperation building                                   │    │
│  │  • ERC-7715 Permission granting                                      │    │
│  │  • Stealth Address generation                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │
│  │     Bundler       │  │ Subscription Svc  │  │  Stealth Scanner  │        │
│  │  (ERC-4337)       │  │  (ERC-7715/7710)  │  │  (EIP-5564)       │        │
│  │                   │  │                   │  │                   │        │
│  │ • UserOp Pool     │  │ • Scheduler       │  │ • Announcement    │        │
│  │ • Gas Estimation  │  │ • Permission Mgmt │  │   Indexer         │        │
│  │ • Bundle Creation │  │ • Executor        │  │ • View Tag Filter │        │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘        │
│            │                      │                      │                   │
│            └──────────────────────┼──────────────────────┘                   │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         RPC Gateway                                  │    │
│  │  • eth_sendRawTransaction    • eth_estimateUserOperationGas         │    │
│  │  • eth_sendUserOperation     • stablenet_getStealthAnnouncements    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHAIN LAYER (go-stablenet)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Transaction Processing                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │ SetCodeTx   │  │ FeeDelegateTx│  │ DynamicFeeTx│  │ LegacyTx    │ │    │
│  │  │ (0x04)      │  │ (0x16)       │  │ (0x02)      │  │ (0x00)      │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    State Management                                  │    │
│  │  • Account State (Code Delegation: 0xef0100 + address)              │    │
│  │  • Authorization Nonce Tracking                                      │    │
│  │  • Gas Accounting                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMART CONTRACT LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Core Contracts                                  │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │  EntryPoint     │  │  SmartAccount   │  │  AccountFactory │      │    │
│  │  │  (ERC-4337)     │  │  (ERC-7579)     │  │                 │      │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Extension Modules                               │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │    │
│  │  │ Paymaster   │ │ Subscription│ │ Stealth     │ │ DEX         │    │    │
│  │  │ Module      │ │ Module      │ │ Payment     │ │ Integration │    │    │
│  │  │             │ │ (ERC-7715)  │ │ Contract    │ │ (Uniswap V3)│    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트별 역할

| 레이어 | 컴포넌트 | 역할 |
|--------|----------|------|
| **Frontend** | Web3 dApp | 사용자 인터페이스, 트랜잭션 서명 |
| **Frontend** | StableNet SDK | EIP-7702/ERC-4337 통합 라이브러리 |
| **Backend** | Bundler | UserOperation 수집, 번들링, 제출 |
| **Backend** | Subscription Service | 정기 결제 스케줄링 및 실행 |
| **Backend** | Stealth Scanner | Stealth Announcement 인덱싱 |
| **Chain** | go-stablenet | EIP-7702/Fee Delegation 처리 |
| **Contract** | EntryPoint | ERC-4337 진입점 |
| **Contract** | SmartAccount | ERC-7579 모듈러 계정 |
| **Contract** | Paymaster | 가스비 대납/토큰 결제 |

---

## 3. EIP-7702 구현 상세

### 3.1 SetCodeTx 구조 (이미 go-stablenet에 구현됨)

```go
// core/types/tx_setcode.go
type SetCodeTx struct {
    ChainID    *uint256.Int
    Nonce      uint64
    GasTipCap  *uint256.Int  // maxPriorityFeePerGas
    GasFeeCap  *uint256.Int  // maxFeePerGas
    Gas        uint64
    To         common.Address
    Value      *uint256.Int
    Data       []byte
    AccessList AccessList
    AuthList   []SetCodeAuthorization  // 핵심: 권한 위임 목록

    // Signature
    V *uint256.Int
    R *uint256.Int
    S *uint256.Int
}

type SetCodeAuthorization struct {
    ChainID uint256.Int     // 체인 ID (replay 보호)
    Address common.Address  // 위임할 컨트랙트 주소
    Nonce   uint64          // 권한 nonce
    V       uint8           // yParity
    R       uint256.Int
    S       uint256.Int
}
```

### 3.2 Delegation Prefix

```go
// 0xef0100 + 20바이트 주소 = 23바이트
var DelegationPrefix = []byte{0xef, 0x01, 0x00}

func ParseDelegation(b []byte) (common.Address, bool) {
    if len(b) != 23 || !bytes.HasPrefix(b, DelegationPrefix) {
        return common.Address{}, false
    }
    return common.BytesToAddress(b[len(DelegationPrefix):]), true
}

func AddressToDelegation(addr common.Address) []byte {
    return append(DelegationPrefix, addr.Bytes()...)
}
```

### 3.3 Authorization 서명

```go
// SetCodeAuthorization 해시 계산
func (a *SetCodeAuthorization) SigHash() common.Hash {
    return prefixedRlpHash(0x05, []any{
        a.ChainID,
        a.Address,
        a.Nonce,
    })
}

// Authority 복구
func (a *SetCodeAuthorization) Authority() (common.Address, error) {
    sighash := a.SigHash()
    // ECDSA 서명 검증 및 주소 복구
    pub, err := crypto.Ecrecover(sighash[:], sig[:])
    // ...
}
```

### 3.4 트랜잭션 처리 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EIP-7702 Transaction Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User signs Authorization Tuple                                       │
│     ┌────────────────────────────────────────┐                          │
│     │ Authorization = {                      │                          │
│     │   chainId: 1234,                       │                          │
│     │   address: SmartAccountImpl,           │                          │
│     │   nonce: 0,                            │                          │
│     │   signature: ECDSA(hash)               │                          │
│     │ }                                      │                          │
│     └────────────────────────────────────────┘                          │
│                         │                                                │
│                         ▼                                                │
│  2. Sponsor creates SetCodeTx with AuthList                             │
│     ┌────────────────────────────────────────┐                          │
│     │ SetCodeTx = {                          │                          │
│     │   ...gasParams,                        │                          │
│     │   to: targetContract,                  │                          │
│     │   data: encodedCall,                   │                          │
│     │   authList: [Authorization]            │                          │
│     │ }                                      │                          │
│     └────────────────────────────────────────┘                          │
│                         │                                                │
│                         ▼                                                │
│  3. Chain processes transaction                                          │
│     ┌────────────────────────────────────────┐                          │
│     │ For each auth in AuthList:             │                          │
│     │   - Verify signature                   │                          │
│     │   - Check nonce                        │                          │
│     │   - Set code: EOA.code = 0xef0100+addr│                          │
│     │   - Increment auth nonce               │                          │
│     └────────────────────────────────────────┘                          │
│                         │                                                │
│                         ▼                                                │
│  4. Execute transaction with delegated code                              │
│     ┌────────────────────────────────────────┐                          │
│     │ - EOA now has SmartAccountImpl code    │                          │
│     │ - Call executes in EOA context         │                          │
│     │ - Storage is EOA's storage             │                          │
│     │ - msg.sender is preserved              │                          │
│     └────────────────────────────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ERC-4337 Account Abstraction

### 4.1 UserOperation 구조

```solidity
struct PackedUserOperation {
    address sender;                    // Smart Account 주소
    uint256 nonce;                     // 192-bit key + 64-bit sequence
    bytes initCode;                    // factory + factoryData (배포시)
    bytes callData;                    // 실행할 호출 데이터
    bytes32 accountGasLimits;          // verificationGasLimit + callGasLimit
    uint256 preVerificationGas;        // 번들러 가스 보상
    bytes32 gasFees;                   // maxPriorityFee + maxFeePerGas
    bytes paymasterAndData;            // paymaster + verificationGas + postOpGas + data
    bytes signature;                   // 서명
}
```

### 4.2 EntryPoint Interface

```solidity
interface IEntryPoint {
    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external;

    function getUserOpHash(PackedUserOperation calldata userOp)
        external view returns (bytes32);

    function getNonce(address sender, uint192 key)
        external view returns (uint256);

    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
}
```

### 4.3 Smart Account Interface (ERC-7579)

```solidity
interface ISmartAccount {
    // ERC-4337 validation
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);

    // Execution
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable;

    function executeBatch(
        Call[] calldata calls
    ) external payable;

    // ERC-1271
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4);

    // Module Management (ERC-7579)
    function installModule(
        uint256 moduleType,
        address module,
        bytes calldata initData
    ) external;

    function uninstallModule(
        uint256 moduleType,
        address module,
        bytes calldata deInitData
    ) external;
}

struct Call {
    address target;
    uint256 value;
    bytes data;
}
```

### 4.4 Module Types (ERC-7579)

```solidity
// Module Type Constants
uint256 constant MODULE_TYPE_VALIDATOR = 1;    // 트랜잭션 검증
uint256 constant MODULE_TYPE_EXECUTOR = 2;     // 외부 호출 실행
uint256 constant MODULE_TYPE_FALLBACK = 3;     // 폴백 핸들러
uint256 constant MODULE_TYPE_HOOK = 4;         // Pre/Post 실행 훅

// Validator Module Interface
interface IValidator {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256);

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4);
}

// Executor Module Interface
interface IExecutor {
    function executeViaAccount(
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory);
}

// Hook Module Interface
interface IHook {
    function preCheck(
        address account,
        bytes calldata callData
    ) external returns (bytes memory hookData);

    function postCheck(
        bytes calldata hookData
    ) external;
}
```

---

## 5. Paymaster 구현

### 5.1 Paymaster Interface

```solidity
interface IPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}

enum PostOpMode {
    opSucceeded,    // UserOp 성공
    opReverted,     // UserOp 실패
    postOpReverted  // postOp 실패
}
```

### 5.2 VerifyingPaymaster (가스비 대납)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract VerifyingPaymaster is IPaymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IEntryPoint public immutable entryPoint;
    address public verifyingSigner;

    mapping(address => bool) public sponsoredAccounts;

    constructor(IEntryPoint _entryPoint, address _signer) {
        entryPoint = _entryPoint;
        verifyingSigner = _signer;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        // 1. 스폰서 계정 확인
        if (sponsoredAccounts[userOp.sender]) {
            return (abi.encode(userOp.sender), 0);
        }

        // 2. 서명 검증 방식
        (uint48 validUntil, uint48 validAfter, bytes memory signature) =
            _parsePaymasterData(userOp.paymasterAndData);

        bytes32 hash = getHash(userOp, validUntil, validAfter)
            .toEthSignedMessageHash();

        if (hash.recover(signature) != verifyingSigner) {
            return ("", 1); // SIG_VALIDATION_FAILED
        }

        // Pack validationData: validAfter (6 bytes) | validUntil (6 bytes) | aggregator (20 bytes)
        validationData = (uint256(validAfter) << 208) | (uint256(validUntil) << 160);

        return (abi.encode(userOp.sender), validationData);
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        address sender = abi.decode(context, (address));

        // 가스 사용량 기록 (선택적)
        emit GasSponsored(sender, actualGasCost);
    }

    function getHash(
        PackedUserOperation calldata userOp,
        uint48 validUntil,
        uint48 validAfter
    ) public view returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.accountGasLimits,
            userOp.preVerificationGas,
            userOp.gasFees,
            block.chainid,
            address(this),
            validUntil,
            validAfter
        ));
    }

    event GasSponsored(address indexed account, uint256 gasCost);
}
```

### 5.3 ERC20Paymaster (토큰으로 가스비 지불)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract ERC20Paymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    IERC20 public immutable paymentToken;      // USDC, USDT 등
    ISwapRouter public immutable swapRouter;
    address public immutable WETH;

    // 1 ETH = pricePerETH tokens (예: 1 ETH = 2000 USDC)
    uint256 public pricePerETH;
    uint256 public constant PRICE_DENOM = 1e18;

    constructor(
        IEntryPoint _entryPoint,
        IERC20 _token,
        ISwapRouter _router,
        address _weth,
        uint256 _initialPrice
    ) {
        entryPoint = _entryPoint;
        paymentToken = _token;
        swapRouter = _router;
        WETH = _weth;
        pricePerETH = _initialPrice;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        // 토큰 가격으로 최대 비용 계산
        uint256 maxTokenCost = (maxCost * pricePerETH) / PRICE_DENOM;

        // 토큰 잔액 확인 및 선 차감
        require(
            paymentToken.balanceOf(userOp.sender) >= maxTokenCost,
            "Insufficient token balance"
        );

        // 토큰 전송 (사전 승인 필요)
        paymentToken.transferFrom(userOp.sender, address(this), maxTokenCost);

        // context에 선불 금액 저장
        return (abi.encode(userOp.sender, maxTokenCost), 0);
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override {
        require(msg.sender == address(entryPoint), "Only EntryPoint");

        (address sender, uint256 preCharge) = abi.decode(context, (address, uint256));

        // 실제 토큰 비용 계산
        uint256 actualTokenCost = (actualGasCost * pricePerETH) / PRICE_DENOM;

        // 과다 청구분 환불
        if (preCharge > actualTokenCost) {
            paymentToken.transfer(sender, preCharge - actualTokenCost);
        }

        // 수집된 토큰을 ETH로 스왑 (EntryPoint 예치금 보충)
        _swapTokensForETH(actualTokenCost);
    }

    function _swapTokensForETH(uint256 tokenAmount) internal {
        paymentToken.approve(address(swapRouter), tokenAmount);

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(paymentToken),
                tokenOut: WETH,
                fee: 3000,  // 0.3%
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: tokenAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 ethReceived = swapRouter.exactInputSingle(params);

        // EntryPoint에 예치
        entryPoint.depositTo{value: ethReceived}(address(this));
    }

    receive() external payable {}
}
```

---

## 6. Subscription 모듈

### 6.1 ERC-7715 Permission Grant

```typescript
// Frontend: 구독 권한 요청
import { walletClient } from './config'

const subscriptionPermission = await walletClient.grantPermissions({
    account: userAddress,
    expiry: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1년
    signer: {
        type: 'key',
        data: {
            type: 'secp256r1',  // P256 (서버 실행용)
            publicKey: serverPublicKey
        }
    },
    permissions: [
        {
            type: 'erc20-token-transfer',
            data: {
                tokenAddress: USDC_ADDRESS
            },
            policies: [
                {
                    type: 'token-allowance',
                    data: { allowance: parseUnits('1200', 6) }  // 연간 $1200
                },
                {
                    type: 'rate-limit',
                    data: {
                        count: 1,
                        interval: 86400 * 30  // 월 1회
                    }
                }
            ]
        }
    ]
})

// context 저장 (서버에서 실행 시 사용)
const { context, signerMeta } = subscriptionPermission
```

### 6.2 Subscription Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SubscriptionModule {
    using ECDSA for bytes32;

    struct Subscription {
        address subscriber;       // Smart Account 주소
        address token;            // 결제 토큰
        address recipient;        // 수취인
        uint256 amount;           // 결제 금액
        uint256 interval;         // 결제 주기 (초)
        uint256 lastPayment;      // 마지막 결제 시간
        uint256 totalLimit;       // 총 한도
        uint256 totalPaid;        // 누적 결제액
        uint256 expiry;           // 만료 시간
        bool active;
    }

    mapping(bytes32 => Subscription) public subscriptions;
    mapping(address => bytes32[]) public userSubscriptions;

    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        address indexed subscriber,
        address recipient,
        uint256 amount,
        uint256 interval
    );
    event SubscriptionExecuted(bytes32 indexed subscriptionId, uint256 amount);
    event SubscriptionCancelled(bytes32 indexed subscriptionId);

    function createSubscription(
        address token,
        address recipient,
        uint256 amount,
        uint256 interval,
        uint256 totalLimit,
        uint256 expiry
    ) external returns (bytes32 subscriptionId) {
        subscriptionId = keccak256(abi.encodePacked(
            msg.sender,
            token,
            recipient,
            block.timestamp
        ));

        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            token: token,
            recipient: recipient,
            amount: amount,
            interval: interval,
            lastPayment: 0,
            totalLimit: totalLimit,
            totalPaid: 0,
            expiry: expiry,
            active: true
        });

        userSubscriptions[msg.sender].push(subscriptionId);

        emit SubscriptionCreated(
            subscriptionId,
            msg.sender,
            recipient,
            amount,
            interval
        );
    }

    function executeSubscription(
        bytes32 subscriptionId,
        bytes calldata signature  // ERC-7710 delegation proof
    ) external {
        Subscription storage sub = subscriptions[subscriptionId];

        require(sub.active, "Subscription not active");
        require(block.timestamp < sub.expiry, "Subscription expired");
        require(sub.totalPaid < sub.totalLimit, "Limit reached");
        require(
            block.timestamp >= sub.lastPayment + sub.interval,
            "Too early"
        );

        // 결제 금액 계산
        uint256 remaining = sub.totalLimit - sub.totalPaid;
        uint256 paymentAmount = sub.amount > remaining ? remaining : sub.amount;

        // 상태 업데이트
        sub.lastPayment = block.timestamp;
        sub.totalPaid += paymentAmount;

        // Smart Account를 통한 토큰 전송 실행
        // (실제 구현은 ERC-7710 DelegationManager 사용)
        _executePayment(sub.subscriber, sub.token, sub.recipient, paymentAmount, signature);

        emit SubscriptionExecuted(subscriptionId, paymentAmount);
    }

    function cancelSubscription(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        require(msg.sender == sub.subscriber, "Not subscriber");

        sub.active = false;
        emit SubscriptionCancelled(subscriptionId);
    }

    function isPaymentDue(bytes32 subscriptionId) external view returns (bool) {
        Subscription storage sub = subscriptions[subscriptionId];
        return sub.active
            && block.timestamp < sub.expiry
            && sub.totalPaid < sub.totalLimit
            && block.timestamp >= sub.lastPayment + sub.interval;
    }

    function _executePayment(
        address subscriber,
        address token,
        address recipient,
        uint256 amount,
        bytes calldata signature
    ) internal {
        // ERC-7710 Delegation Manager를 통한 실행
        // 또는 Smart Account의 executeFromModule 호출

        // 간단한 PoC 버전: 직접 transferFrom
        IERC20(token).transferFrom(subscriber, recipient, amount);
    }
}
```

### 6.3 Subscription Service (Backend)

```typescript
// subscription-service/src/executor.ts
import { createBundlerClient } from 'permissionless'
import { privateKeyToAccount } from 'viem/accounts'

interface SubscriptionJob {
    subscriptionId: string
    subscriber: string
    permissionContext: string
    delegationManager: string
    nextExecutionTime: number
}

class SubscriptionExecutor {
    private bundlerClient: any
    private executorKey: any
    private subscriptionContract: any

    constructor(config: Config) {
        this.bundlerClient = createBundlerClient({
            chain: stablenet,
            transport: http(config.bundlerUrl)
        })
        this.executorKey = privateKeyToAccount(config.executorPrivateKey)
    }

    async checkAndExecute(): Promise<void> {
        const dueSubscriptions = await this.getDueSubscriptions()

        for (const sub of dueSubscriptions) {
            try {
                await this.executeSubscription(sub)
                console.log(`Executed subscription: ${sub.subscriptionId}`)
            } catch (error) {
                console.error(`Failed to execute ${sub.subscriptionId}:`, error)
            }
        }
    }

    async executeSubscription(job: SubscriptionJob): Promise<string> {
        // 1. UserOperation 생성
        const callData = encodeFunctionData({
            abi: SubscriptionModuleABI,
            functionName: 'executeSubscription',
            args: [job.subscriptionId, '0x']  // signature는 delegation proof
        })

        // 2. ERC-7710 delegation을 통한 실행
        const userOp = await this.bundlerClient.prepareUserOperationRequest({
            account: job.subscriber,
            calls: [{
                to: SUBSCRIPTION_MODULE_ADDRESS,
                data: callData
            }],
            permissionsContext: job.permissionContext
        })

        // 3. 서명 및 제출
        const signature = await this.executorKey.signMessage({
            message: { raw: userOp.hash }
        })

        const hash = await this.bundlerClient.sendUserOperation({
            ...userOp,
            signature
        })

        return hash
    }

    async getDueSubscriptions(): Promise<SubscriptionJob[]> {
        // Redis 또는 DB에서 실행 대상 구독 조회
        const now = Math.floor(Date.now() / 1000)
        return await this.db.subscriptions.findMany({
            where: {
                nextExecutionTime: { lte: now },
                active: true
            }
        })
    }
}

// Scheduler (cron 또는 Chainlink Automation)
const executor = new SubscriptionExecutor(config)

// 매 분마다 실행
cron.schedule('* * * * *', async () => {
    await executor.checkAndExecute()
})
```

---

## 7. Stealth Payment Contract (s-ca)

### 7.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Stealth Payment Contract (s-ca)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Public Operations                           │    │
│  │  (On-chain visible)                                              │    │
│  │                                                                   │    │
│  │  deposit()  ───────────────────►  Announcement Event              │    │
│  │    │                              (EIP-5564 compatible)           │    │
│  │    ▼                                                              │    │
│  │  _balances[stealthAddr][token] += amount                         │    │
│  │                                                                   │    │
│  │  withdraw() ───────────────────►  Withdrawal Event                │    │
│  │    │                              (destination visible)           │    │
│  │    ▼                                                              │    │
│  │  _balances[stealthAddr][token] -= amount                         │    │
│  │  token.transfer(recipient, amount)                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Private Operations                           │    │
│  │  (On-chain invisible, audit log only)                            │    │
│  │                                                                   │    │
│  │  internalTransfer() ──────────►  NO EVENT EMITTED                │    │
│  │    │                              (privacy preserved)             │    │
│  │    ▼                                                              │    │
│  │  _balances[fromStealth][token] -= amount                         │    │
│  │  _balances[toStealth][token] += amount                           │    │
│  │    │                                                              │    │
│  │    ▼                                                              │    │
│  │  _auditLog.push(EncryptedEntry)  ◄── Government can decrypt      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Government Audit                             │    │
│  │                                                                   │    │
│  │  • Viewing key escrow at registration                            │    │
│  │  • Encrypted audit log readable with authority key               │    │
│  │  • Time-limited access tokens                                    │    │
│  │  • Full transaction history for tax compliance                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 핵심 컨트랙트 구현

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract StealthPaymentContract {
    using ECDSA for bytes32;

    // ========== Registration ==========
    struct UserRegistration {
        bytes stealthMetaAddress;       // 66 bytes: P_spend || P_view
        bytes encryptedViewingKey;      // 정부 공개키로 암호화된 viewing key
        uint256 registrationTimestamp;
        bool isActive;
    }

    mapping(address => UserRegistration) public registrations;

    // ========== Internal Balance Ledger ==========
    // stealthAddress => tokenAddress => balance
    mapping(address => mapping(address => uint256)) private _balances;

    // ========== Encrypted Audit Log ==========
    struct EncryptedAuditEntry {
        bytes32 encryptedFromAddress;
        bytes32 encryptedToAddress;
        bytes32 encryptedAmount;
        address tokenAddress;           // 세금 분류용으로 공개
        uint256 timestamp;
        bytes32 nonce;
    }

    EncryptedAuditEntry[] private _auditLog;

    // ========== Government Authority ==========
    address public governmentAuthority;
    bytes public governmentPublicKey;

    mapping(address => uint256) public auditorAccessExpiry;

    // ========== Events (EIP-5564 Compatible) ==========
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    event Withdrawal(
        address indexed stealthAddress,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );

    // ========== Registration Functions ==========

    function register(
        bytes calldata stealthMetaAddress,
        bytes calldata encryptedViewingKey
    ) external {
        require(stealthMetaAddress.length == 66, "Invalid meta-address length");

        registrations[msg.sender] = UserRegistration({
            stealthMetaAddress: stealthMetaAddress,
            encryptedViewingKey: encryptedViewingKey,
            registrationTimestamp: block.timestamp,
            isActive: true
        });
    }

    // ========== Deposit (Public, On-chain Visible) ==========

    function deposit(
        address token,
        uint256 amount,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag,
        bytes calldata metadata
    ) external payable {
        if (token == address(0)) {
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }

        _balances[stealthAddress][token] += amount;

        // EIP-5564 호환 이벤트 발생
        emit Announcement(
            1,  // schemeId for SECP256k1
            stealthAddress,
            msg.sender,
            ephemeralPubKey,
            abi.encodePacked(viewTag, metadata)
        );
    }

    // ========== Internal Transfer (Private, No Event) ==========

    function internalTransfer(
        address fromStealth,
        address toStealth,
        address token,
        uint256 amount,
        bytes calldata stealthProof
    ) external {
        // Stealth 소유권 증명 검증
        require(
            _verifyStealthOwnership(fromStealth, stealthProof),
            "Invalid ownership proof"
        );

        require(_balances[fromStealth][token] >= amount, "Insufficient balance");

        // 잔액 이동 (이벤트 없음 = 온체인 불가시)
        _balances[fromStealth][token] -= amount;
        _balances[toStealth][token] += amount;

        // 암호화된 감사 로그 생성
        _createAuditEntry(fromStealth, toStealth, token, amount);
    }

    // ========== Withdrawal (Public, On-chain Visible) ==========

    function withdraw(
        address stealthAddress,
        address token,
        uint256 amount,
        address recipient,
        bytes calldata stealthProof
    ) external {
        require(
            _verifyStealthOwnership(stealthAddress, stealthProof),
            "Invalid ownership proof"
        );

        require(_balances[stealthAddress][token] >= amount, "Insufficient balance");

        _balances[stealthAddress][token] -= amount;

        if (token == address(0)) {
            payable(recipient).transfer(amount);
        } else {
            IERC20(token).transfer(recipient, amount);
        }

        emit Withdrawal(stealthAddress, recipient, token, amount);
    }

    // ========== Balance Query ==========

    function balanceOf(
        address stealthAddress,
        address token
    ) external view returns (uint256) {
        // 소유자만 조회 가능하도록 하려면 추가 검증 필요
        return _balances[stealthAddress][token];
    }

    // ========== Ownership Verification ==========

    function _verifyStealthOwnership(
        address stealthAddress,
        bytes calldata proof
    ) internal view returns (bool) {
        // 방법 1: Stealth private key로 직접 서명
        bytes32 messageHash = keccak256(abi.encodePacked(
            "StealthOwnership",
            stealthAddress,
            block.chainid,
            address(this)
        ));

        address recovered = messageHash.toEthSignedMessageHash().recover(proof);
        return recovered == stealthAddress;
    }

    // ========== Audit Log (Government Access) ==========

    function _createAuditEntry(
        address from,
        address to,
        address token,
        uint256 amount
    ) internal {
        bytes32 nonce = keccak256(abi.encodePacked(
            block.timestamp,
            _auditLog.length,
            from,
            to
        ));

        // 실제 구현: AES-256-GCM 암호화 (정부 공개키 사용)
        // 여기서는 간단히 XOR로 표현
        _auditLog.push(EncryptedAuditEntry({
            encryptedFromAddress: _encrypt(bytes32(uint256(uint160(from))), nonce),
            encryptedToAddress: _encrypt(bytes32(uint256(uint160(to))), nonce),
            encryptedAmount: _encrypt(bytes32(amount), nonce),
            tokenAddress: token,
            timestamp: block.timestamp,
            nonce: nonce
        }));
    }

    function _encrypt(bytes32 data, bytes32 nonce) internal view returns (bytes32) {
        // 실제 구현: ECIES 또는 AES-GCM
        // PoC: 단순 XOR (실제로는 사용 금지)
        return data ^ keccak256(abi.encodePacked(governmentPublicKey, nonce));
    }

    // ========== Government Audit Functions ==========

    modifier onlyAuthorizedAuditor() {
        require(
            auditorAccessExpiry[msg.sender] > block.timestamp,
            "Not authorized auditor"
        );
        _;
    }

    function getAuditLog(
        uint256 fromIndex,
        uint256 toIndex
    ) external view onlyAuthorizedAuditor returns (EncryptedAuditEntry[] memory) {
        require(toIndex <= _auditLog.length, "Index out of bounds");

        EncryptedAuditEntry[] memory entries = new EncryptedAuditEntry[](toIndex - fromIndex);
        for (uint256 i = 0; i < toIndex - fromIndex; i++) {
            entries[i] = _auditLog[fromIndex + i];
        }
        return entries;
    }

    function grantAuditorAccess(
        address auditor,
        uint256 durationSeconds
    ) external {
        require(msg.sender == governmentAuthority, "Only government");
        auditorAccessExpiry[auditor] = block.timestamp + durationSeconds;
    }

    receive() external payable {}
}
```

### 7.3 Stealth Address 생성 (Frontend/SDK)

```typescript
// stablenet-sdk/src/stealth.ts
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak256 } from 'viem'

interface StealthKeys {
    spendingPrivateKey: Uint8Array
    spendingPublicKey: Uint8Array
    viewingPrivateKey: Uint8Array
    viewingPublicKey: Uint8Array
    stealthMetaAddress: string
}

interface GeneratedStealthAddress {
    stealthAddress: string
    ephemeralPublicKey: Uint8Array
    viewTag: number
}

// Stealth 키 생성
export function generateStealthKeys(): StealthKeys {
    const spendingPrivateKey = secp256k1.utils.randomPrivateKey()
    const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true)

    const viewingPrivateKey = secp256k1.utils.randomPrivateKey()
    const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true)

    // st:stablenet:0x<spendingPubKey><viewingPubKey>
    const stealthMetaAddress = `st:stablenet:0x${
        Buffer.from(spendingPublicKey).toString('hex')
    }${
        Buffer.from(viewingPublicKey).toString('hex')
    }`

    return {
        spendingPrivateKey,
        spendingPublicKey,
        viewingPrivateKey,
        viewingPublicKey,
        stealthMetaAddress
    }
}

// Stealth Address 생성 (송금자가 사용)
export function generateStealthAddress(
    recipientMetaAddress: string
): GeneratedStealthAddress {
    // Parse recipient's public keys
    const metaAddressHex = recipientMetaAddress.replace('st:stablenet:0x', '')
    const spendingPubKey = Uint8Array.from(
        Buffer.from(metaAddressHex.slice(0, 66), 'hex')
    )
    const viewingPubKey = Uint8Array.from(
        Buffer.from(metaAddressHex.slice(66), 'hex')
    )

    // Generate ephemeral key pair
    const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey()
    const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

    // Compute shared secret: s = ephemeralPriv * viewingPub
    const sharedSecret = secp256k1.getSharedSecret(
        ephemeralPrivateKey,
        viewingPubKey
    )

    // Hash the secret
    const secretHash = keccak256(sharedSecret)

    // View tag = first byte
    const viewTag = parseInt(secretHash.slice(2, 4), 16)

    // Compute stealth public key: P_stealth = P_spend + hash(s) * G
    const secretHashScalar = BigInt(secretHash)
    const secretPoint = secp256k1.ProjectivePoint.BASE.multiply(secretHashScalar)
    const spendingPoint = secp256k1.ProjectivePoint.fromHex(spendingPubKey)
    const stealthPoint = spendingPoint.add(secretPoint)

    // Derive address
    const stealthPubKeyBytes = stealthPoint.toRawBytes(false).slice(1) // uncompressed, no prefix
    const stealthAddress = '0x' + keccak256(stealthPubKeyBytes).slice(-40)

    return {
        stealthAddress,
        ephemeralPublicKey,
        viewTag
    }
}

// Stealth Address 수신 확인 (수신자가 사용)
export function checkStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: Uint8Array,
    viewingPrivateKey: Uint8Array,
    spendingPublicKey: Uint8Array,
    announcedViewTag: number
): boolean {
    // Compute shared secret: s = viewingPriv * ephemeralPub
    const sharedSecret = secp256k1.getSharedSecret(
        viewingPrivateKey,
        ephemeralPublicKey
    )

    const secretHash = keccak256(sharedSecret)

    // Quick filter with view tag
    const computedViewTag = parseInt(secretHash.slice(2, 4), 16)
    if (computedViewTag !== announcedViewTag) {
        return false  // 빠른 필터링: 99.6% 확률로 스킵
    }

    // Full verification
    const secretHashScalar = BigInt(secretHash)
    const secretPoint = secp256k1.ProjectivePoint.BASE.multiply(secretHashScalar)
    const spendingPoint = secp256k1.ProjectivePoint.fromHex(spendingPublicKey)
    const stealthPoint = spendingPoint.add(secretPoint)

    const stealthPubKeyBytes = stealthPoint.toRawBytes(false).slice(1)
    const computedAddress = '0x' + keccak256(stealthPubKeyBytes).slice(-40)

    return computedAddress.toLowerCase() === stealthAddress.toLowerCase()
}

// Stealth Private Key 도출 (수신자가 출금 시 사용)
export function deriveStealthPrivateKey(
    ephemeralPublicKey: Uint8Array,
    viewingPrivateKey: Uint8Array,
    spendingPrivateKey: Uint8Array
): Uint8Array {
    // s = viewingPriv * ephemeralPub
    const sharedSecret = secp256k1.getSharedSecret(
        viewingPrivateKey,
        ephemeralPublicKey
    )

    const secretHash = keccak256(sharedSecret)
    const secretHashBigInt = BigInt(secretHash)

    // p_stealth = p_spend + hash(s)
    const spendingKeyBigInt = BigInt('0x' + Buffer.from(spendingPrivateKey).toString('hex'))
    const stealthKeyBigInt = (spendingKeyBigInt + secretHashBigInt) % secp256k1.CURVE.n

    return secp256k1.utils.numberToBytesBE(stealthKeyBigInt, 32)
}
```

---

## 8. Bundler 구현

### 8.1 Bundler 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           StableNet Bundler                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      RPC Interface                               │    │
│  │  eth_sendUserOperation                                           │    │
│  │  eth_estimateUserOperationGas                                    │    │
│  │  eth_getUserOperationByHash                                      │    │
│  │  eth_getUserOperationReceipt                                     │    │
│  │  eth_supportedEntryPoints                                        │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    UserOperation Pool                            │    │
│  │  • Validation (signature, nonce, gas limits)                     │    │
│  │  • Simulation (EntryPoint.simulateValidation)                    │    │
│  │  • Priority ordering (gas price)                                 │    │
│  │  • Deduplication                                                 │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Bundle Builder                                │    │
│  │  • Gas optimization                                              │    │
│  │  • Conflict detection                                            │    │
│  │  • Bundle size limits                                            │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Transaction Submitter                         │    │
│  │  • EntryPoint.handleOps() call                                   │    │
│  │  • Gas price management                                          │    │
│  │  • Retry logic                                                   │    │
│  │  • MEV protection (optional)                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Bundler RPC Implementation

```typescript
// bundler/src/rpc.ts
import { createPublicClient, createWalletClient, http } from 'viem'
import { EntryPointABI } from './abis'

interface UserOperation {
    sender: string
    nonce: bigint
    initCode: string
    callData: string
    accountGasLimits: string
    preVerificationGas: bigint
    gasFees: string
    paymasterAndData: string
    signature: string
}

class BundlerRPC {
    private userOpPool: Map<string, UserOperation> = new Map()
    private publicClient: any
    private walletClient: any
    private entryPoint: string

    constructor(config: BundlerConfig) {
        this.publicClient = createPublicClient({
            chain: stablenet,
            transport: http(config.rpcUrl)
        })
        this.walletClient = createWalletClient({
            chain: stablenet,
            transport: http(config.rpcUrl),
            account: config.bundlerAccount
        })
        this.entryPoint = config.entryPointAddress
    }

    // eth_sendUserOperation
    async sendUserOperation(
        userOp: UserOperation,
        entryPoint: string
    ): Promise<string> {
        // 1. Validate UserOp
        await this.validateUserOp(userOp)

        // 2. Simulate validation
        await this.simulateValidation(userOp)

        // 3. Add to pool
        const userOpHash = this.getUserOpHash(userOp)
        this.userOpPool.set(userOpHash, userOp)

        return userOpHash
    }

    // eth_estimateUserOperationGas
    async estimateUserOperationGas(
        userOp: Partial<UserOperation>,
        entryPoint: string
    ): Promise<{
        preVerificationGas: bigint
        verificationGasLimit: bigint
        callGasLimit: bigint
    }> {
        // Call EntryPoint.simulateValidation
        const result = await this.publicClient.simulateContract({
            address: this.entryPoint,
            abi: EntryPointABI,
            functionName: 'simulateValidation',
            args: [userOp]
        })

        // Parse gas values from simulation
        return {
            preVerificationGas: 21000n,
            verificationGasLimit: result.verificationGasLimit,
            callGasLimit: result.callGasLimit
        }
    }

    // eth_getUserOperationByHash
    async getUserOperationByHash(hash: string): Promise<UserOperation | null> {
        return this.userOpPool.get(hash) || null
    }

    // eth_supportedEntryPoints
    getSupportedEntryPoints(): string[] {
        return [this.entryPoint]
    }

    // Internal: Validate UserOp
    private async validateUserOp(userOp: UserOperation): Promise<void> {
        // Check sender is deployed or has initCode
        const code = await this.publicClient.getCode({ address: userOp.sender })
        if (!code && !userOp.initCode) {
            throw new Error('Account not deployed and no initCode provided')
        }

        // Validate nonce
        const currentNonce = await this.publicClient.readContract({
            address: this.entryPoint,
            abi: EntryPointABI,
            functionName: 'getNonce',
            args: [userOp.sender, 0n]
        })

        if (userOp.nonce < currentNonce) {
            throw new Error('Invalid nonce')
        }
    }

    // Internal: Simulate validation
    private async simulateValidation(userOp: UserOperation): Promise<void> {
        try {
            await this.publicClient.simulateContract({
                address: this.entryPoint,
                abi: EntryPointABI,
                functionName: 'simulateValidation',
                args: [userOp]
            })
        } catch (error: any) {
            // Parse validation result from revert
            if (error.message.includes('ValidationResult')) {
                // Success - validation passed
                return
            }
            throw error
        }
    }

    // Internal: Get UserOp hash
    private getUserOpHash(userOp: UserOperation): string {
        return keccak256(encodePacked([
            'address', 'uint256', 'bytes32', 'bytes32',
            'bytes32', 'uint256', 'bytes32', 'bytes32'
        ], [
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.accountGasLimits,
            userOp.preVerificationGas,
            userOp.gasFees,
            keccak256(userOp.paymasterAndData)
        ]))
    }

    // Bundle and submit
    async createAndSubmitBundle(): Promise<string> {
        const userOps = Array.from(this.userOpPool.values())
        if (userOps.length === 0) return ''

        // Submit bundle
        const txHash = await this.walletClient.writeContract({
            address: this.entryPoint,
            abi: EntryPointABI,
            functionName: 'handleOps',
            args: [userOps, this.walletClient.account.address]
        })

        // Clear processed ops
        this.userOpPool.clear()

        return txHash
    }
}
```

---

## 9. DEX Integration (Uniswap V3)

### 9.1 Uniswap V3 통합 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DEXModule {
    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _router) {
        swapRouter = _router;
    }

    // Exact Input Swap
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        return swapRouter.exactInputSingle(params);
    }

    // Exact Output Swap
    function swapExactOutput(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountIn) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountInMaximum);
        IERC20(tokenIn).approve(address(swapRouter), amountInMaximum);

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        amountIn = swapRouter.exactOutputSingle(params);

        // Refund excess
        if (amountIn < amountInMaximum) {
            IERC20(tokenIn).transfer(msg.sender, amountInMaximum - amountIn);
        }
    }

    // Multi-hop swap
    function swapExactInputMultiHop(
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        address tokenIn = _decodeFirstToken(path);

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputParams memory params =
            ISwapRouter.ExactInputParams({
                path: path,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });

        return swapRouter.exactInput(params);
    }

    function _decodeFirstToken(bytes calldata path) internal pure returns (address) {
        return address(bytes20(path[:20]));
    }
}
```

---

## 10. 프로젝트 구조

### 10.1 전체 프로젝트 디렉토리

```
stablenet-smart-account/
├── chain/                          # go-stablenet fork
│   ├── core/
│   │   └── types/
│   │       ├── tx_setcode.go       # EIP-7702 (이미 구현됨)
│   │       └── tx_fee_delegate.go  # Fee delegation
│   ├── systemcontracts/
│   │   ├── entrypoint/            # ERC-4337 EntryPoint
│   │   └── smart_account/         # 기본 Smart Account
│   └── params/
│       └── config.go               # Chain config
│
├── contracts/                       # Smart Contracts (Foundry)
│   ├── src/
│   │   ├── core/
│   │   │   ├── EntryPoint.sol
│   │   │   ├── SmartAccount.sol
│   │   │   └── AccountFactory.sol
│   │   ├── modules/
│   │   │   ├── validators/
│   │   │   │   ├── ECDSAValidator.sol
│   │   │   │   └── PasskeyValidator.sol
│   │   │   ├── executors/
│   │   │   │   └── BatchExecutor.sol
│   │   │   └── hooks/
│   │   │       └── SpendingLimitHook.sol
│   │   ├── paymaster/
│   │   │   ├── VerifyingPaymaster.sol
│   │   │   └── ERC20Paymaster.sol
│   │   ├── subscription/
│   │   │   └── SubscriptionModule.sol
│   │   ├── stealth/
│   │   │   └── StealthPaymentContract.sol
│   │   └── dex/
│   │       └── DEXModule.sol
│   ├── test/
│   └── script/
│
├── bundler/                         # ERC-4337 Bundler
│   ├── src/
│   │   ├── rpc/
│   │   ├── pool/
│   │   ├── builder/
│   │   └── submitter/
│   └── config/
│
├── backend/                         # Backend Services
│   ├── subscription-service/
│   │   ├── src/
│   │   │   ├── scheduler/
│   │   │   ├── executor/
│   │   │   └── api/
│   │   └── prisma/
│   ├── stealth-scanner/
│   │   ├── src/
│   │   │   ├── indexer/
│   │   │   └── api/
│   │   └── prisma/
│   └── rpc-gateway/
│       └── src/
│
├── sdk/                             # Frontend SDK
│   ├── packages/
│   │   ├── core/
│   │   │   ├── src/
│   │   │   │   ├── account/
│   │   │   │   ├── userOperation/
│   │   │   │   ├── stealth/
│   │   │   │   └── utils/
│   │   │   └── package.json
│   │   ├── react/
│   │   └── wagmi/
│   └── examples/
│
├── frontend/                        # Web Application
│   ├── apps/
│   │   ├── wallet/
│   │   └── dapp/
│   └── packages/
│       └── ui/
│
└── docs/
    ├── architecture/
    ├── api/
    └── guides/
```

### 10.2 컨트랙트 배포 주소 (Testnet)

| Contract | Address | 설명 |
|----------|---------|------|
| EntryPoint | 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 | ERC-4337 v0.7 |
| AccountFactory | TBD | Smart Account 팩토리 |
| SmartAccountImpl | TBD | Smart Account 구현체 |
| VerifyingPaymaster | TBD | 가스비 대납 |
| ERC20Paymaster | TBD | 토큰 결제 |
| SubscriptionModule | TBD | 구독 관리 |
| StealthPaymentContract | TBD | Stealth 결제 |
| DEXModule | TBD | Uniswap V3 통합 |

---

## 11. Transaction Flow 상세

### 11.1 가스비 대납 플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Gas Sponsorship Transaction Flow                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User (EOA)                                                              │
│  │                                                                       │
│  │ 1. Sign EIP-7702 Authorization                                        │
│  │    ┌────────────────────────────────┐                                │
│  │    │ authorization = {              │                                │
│  │    │   chainId, address, nonce      │                                │
│  │    │ }                              │                                │
│  │    │ sig = sign(hash(auth))         │                                │
│  │    └────────────────────────────────┘                                │
│  │                                                                       │
│  │ 2. Create UserOperation                                               │
│  │    ┌────────────────────────────────┐                                │
│  │    │ userOp = {                     │                                │
│  │    │   sender: userEOA,             │                                │
│  │    │   callData: transfer(...),     │                                │
│  │    │   paymasterAndData: paymaster  │                                │
│  │    │ }                              │                                │
│  │    └────────────────────────────────┘                                │
│  │                                                                       │
│  ▼                                                                       │
│  Bundler                                                                 │
│  │                                                                       │
│  │ 3. Validate & Simulate                                                │
│  │                                                                       │
│  │ 4. Create SetCodeTx with AuthList                                     │
│  │    ┌────────────────────────────────┐                                │
│  │    │ setCodeTx = {                  │                                │
│  │    │   authList: [authorization],   │                                │
│  │    │   to: entryPoint,              │                                │
│  │    │   data: handleOps([userOp])    │                                │
│  │    │ }                              │                                │
│  │    └────────────────────────────────┘                                │
│  │                                                                       │
│  ▼                                                                       │
│  Chain (go-stablenet)                                                    │
│  │                                                                       │
│  │ 5. Process SetCodeTx                                                  │
│  │    - Apply authorization: EOA.code = 0xef0100 + SmartAccountImpl     │
│  │                                                                       │
│  │ 6. Execute handleOps                                                  │
│  │    ┌────────────────────────────────────────────────────────────┐    │
│  │    │ EntryPoint.handleOps:                                       │    │
│  │    │   • validateUserOp(userOp) → SmartAccount.validateUserOp()  │    │
│  │    │   • validatePaymaster(userOp) → Paymaster.validatePaymaster │    │
│  │    │   • executeUserOp() → SmartAccount.execute(callData)        │    │
│  │    │   • postOp() → Paymaster.postOp()                           │    │
│  │    └────────────────────────────────────────────────────────────┘    │
│  │                                                                       │
│  ▼                                                                       │
│  Result: User's transfer executed, Paymaster paid gas                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Stealth Transfer 플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Stealth Transfer Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     REGISTRATION PHASE                           │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  Recipient:                                                       │    │
│  │  1. Generate stealth keys                                         │    │
│  │     • spendingKey (private, NEVER shared)                         │    │
│  │     • viewingKey (shared with government)                         │    │
│  │                                                                   │    │
│  │  2. Register with s-ca                                            │    │
│  │     register(stealthMetaAddress, encryptedViewingKey)            │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DEPOSIT PHASE                               │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  Sender:                                                          │    │
│  │  1. Fetch recipient's stealthMetaAddress                         │    │
│  │                                                                   │    │
│  │  2. Generate stealth address                                      │    │
│  │     { stealthAddr, ephemeralPubKey, viewTag } =                  │    │
│  │         generateStealthAddress(metaAddress)                       │    │
│  │                                                                   │    │
│  │  3. Deposit to s-ca                                               │    │
│  │     deposit(token, amount, stealthAddr, ephemeralPubKey, viewTag)│    │
│  │                                                                   │    │
│  │  4. Event emitted (on-chain visible)                              │    │
│  │     Announcement(1, stealthAddr, sender, ephemeralPubKey, meta)  │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   INTERNAL TRANSFER PHASE                        │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  Stealth Owner:                                                   │    │
│  │  1. Derive stealth private key                                    │    │
│  │     p_stealth = deriveStealthPrivateKey(                         │    │
│  │         ephemeralPubKey, viewingKey, spendingKey)                │    │
│  │                                                                   │    │
│  │  2. Sign ownership proof                                          │    │
│  │     proof = sign(message, p_stealth)                             │    │
│  │                                                                   │    │
│  │  3. Execute internal transfer                                     │    │
│  │     internalTransfer(fromStealth, toStealth, token, amount, proof)│    │
│  │                                                                   │    │
│  │  4. NO EVENT EMITTED (on-chain invisible)                         │    │
│  │     Only encrypted audit log entry created                        │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    WITHDRAWAL PHASE                              │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  Stealth Owner:                                                   │    │
│  │  1. Sign ownership proof                                          │    │
│  │                                                                   │    │
│  │  2. Withdraw                                                      │    │
│  │     withdraw(stealthAddr, token, amount, recipientEOA, proof)    │    │
│  │                                                                   │    │
│  │  3. Event emitted (on-chain visible)                              │    │
│  │     Withdrawal(stealthAddr, recipient, token, amount)            │    │
│  │                                                                   │    │
│  │  NOTE: Withdrawal reveals recipient EOA!                          │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. 구현 로드맵

### Phase 1: Foundation (Week 1-2)

| 태스크 | 설명 | 담당 |
|--------|------|------|
| go-stablenet 포크 확인 | EIP-7702, Fee Delegation 동작 검증 | Chain |
| EntryPoint 배포 | ERC-4337 v0.7 배포 | Contract |
| SmartAccount 구현 | 기본 ERC-7579 계정 | Contract |
| AccountFactory 구현 | CREATE2 팩토리 | Contract |
| 기본 SDK 구현 | UserOperation 빌더 | SDK |

### Phase 2: Paymaster & Bundler (Week 3-4)

| 태스크 | 설명 | 담당 |
|--------|------|------|
| VerifyingPaymaster | 서명 기반 가스 대납 | Contract |
| ERC20Paymaster | 토큰 결제 + Uniswap 통합 | Contract |
| Bundler 구현 | RPC + Pool + Submitter | Backend |
| SDK Paymaster 통합 | paymasterAndData 빌더 | SDK |

### Phase 3: Extensions (Week 5-6)

| 태스크 | 설명 | 담당 |
|--------|------|------|
| SubscriptionModule | 정기 결제 컨트랙트 | Contract |
| Subscription Service | 스케줄러 + 실행기 | Backend |
| DEXModule | Uniswap V3 통합 | Contract |
| ERC-7715 SDK | Permission grant | SDK |

### Phase 4: Stealth & Privacy (Week 7-8)

| 태스크 | 설명 | 담당 |
|--------|------|------|
| StealthPaymentContract | s-ca 구현 | Contract |
| Stealth Scanner | Announcement 인덱서 | Backend |
| Stealth SDK | 키 생성, 주소 생성 | SDK |
| Government Audit | 감사 인터페이스 | Backend |

### Phase 5: Frontend & Integration (Week 9-10)

| 태스크 | 설명 | 담당 |
|--------|------|------|
| Wallet UI | 지갑 인터페이스 | Frontend |
| dApp Demo | 데모 애플리케이션 | Frontend |
| 통합 테스트 | E2E 테스트 | QA |
| 문서화 | API 문서, 가이드 | Docs |

---

## 13. 보안 고려사항

### 13.1 EIP-7702 보안

| 위험 | 완화 방법 |
|------|-----------|
| Authorization replay | Chain ID + Nonce 검증 |
| Whitelist bypass | 0xef0100 prefix 검사 |
| Legacy contract 호환성 | EXTCODESIZE 반환값 확인 |
| Private key exposure | Spending key 오프라인 보관 |

### 13.2 Smart Account 보안

| 위험 | 완화 방법 |
|------|-----------|
| Signature replay | EIP-712 domain separator |
| Module 악용 | 신뢰된 모듈만 설치 |
| Reentrancy | CEI 패턴 + ReentrancyGuard |
| Front-running | Private mempool / MEV 보호 |

### 13.3 Stealth 보안

| 위험 | 완화 방법 |
|------|-----------|
| Spending key 노출 | 오프라인 보관, 암호화 |
| Viewing key 남용 | 정부 접근 시간 제한 |
| 메타데이터 분석 | 가스 사용량 정규화 |
| Audit log 변조 | Immutable storage |

---

## 14. 참고 자료

### EIP/ERC 표준
- [EIP-7702: Set Code for EOAs](https://eips.ethereum.org/EIPS/eip-7702)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-7579: Minimal Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [ERC-7715: Grant Permissions](https://eips.ethereum.org/EIPS/eip-7715)
- [ERC-7710: Smart Contract Delegation](https://eips.ethereum.org/EIPS/eip-7710)
- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [EIP-712: Typed Structured Data](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-2612: Permit Extension](https://eips.ethereum.org/EIPS/eip-2612)
- [ERC-1271: Contract Signature Validation](https://eips.ethereum.org/EIPS/eip-1271)

### 구현 참조
- [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction)
- [erc7579/erc7579-implementation](https://github.com/erc7579/erc7579-implementation)
- [ScopeLift/stealth-address-erc-contracts](https://github.com/ScopeLift/stealth-address-erc-contracts)
- [fluidkey/fluidkey-stealth-account-kit](https://github.com/fluidkey/fluidkey-stealth-account-kit)

---

*문서 버전: 1.0.0*
*최종 업데이트: 2026-01-10*
