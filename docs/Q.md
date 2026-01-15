# 질문 및 답변 (Q&A)

## 1. Signer Contract ?

**답변**:

Signer Contract는 ERC-7579의 모듈 타입 중 하나로, **Module Type 6**에 해당합니다. Kernel Smart Account에서 서명 검증을 담당하는 모듈입니다.

**구현 위치**:
- `kernel/src/sdk/moduleBase/SignerBase.sol` - 기본 Signer 인터페이스
- `kernel/src/signer/MultiChainSigner.sol` - 멀티체인 서명자 구현
- `kernel-7579-plugins/signers/ecdsa/src/ECDSASigner.sol` - ECDSA 서명자
- `kernel-7579-plugins/signers/anysigner/src/AnySigner.sol` - 범용 서명자

**주요 기능**:
```solidity
interface ISigner is IModule {
    // UserOperation 서명 검증 (ERC-4337)
    function checkUserOpSignature(
        bytes32 id,
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external payable returns (uint256);
    
    // ERC-1271 서명 검증
    function checkSignature(
        bytes32 id,
        address sender,
        bytes32 hash,
        bytes calldata sig
    ) external view returns (bytes4);
}
```

**배포 주소** (kernel-7579-plugins):
- ECDSA Signer: `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF`
- WebAuthn Signer: `0x65DEeC8fEe717dc044D0CFD63cCf55F02cCaC2b3`

**Validator vs Signer 차이점**:
- **Validator (Type 1)**: ERC-4337 UserOperation 검증, ERC-1271 서명 검증, 계정 소유권 관리
- **Signer (Type 6)**: Validator의 서명 로직을 분리한 모듈, 여러 Validator가 동일한 Signer를 공유 가능

---

## 2. Policy Contract ?

**답변**:

Policy Contract는 ERC-7579의 모듈 타입 중 하나로, Smart Account의 실행 정책을 정의합니다. UserOperation 실행 전후에 정책 검증을 수행합니다.

**구현 위치**:
- `kernel/src/sdk/moduleBase/PolicyBase.sol` - 기본 Policy 인터페이스
- `kernel-7579-plugins/policies/` - 각 정책 구현체

### 2.1 Call Policy

**위치**: `kernel-7579-plugins/policies/call-policy/src/CallPolicy.sol`  
**주소**: `0x9a52283276a0ec8740df50bf01b28a80d880eaf2`  
**기능**: 특정 컨트랙트 주소/함수 호출만 허용/차단
```solidity
struct CallPolicyConfig {
    address[] allowedTargets;  // 허용된 대상 주소
    bytes4[] allowedSelectors;  // 허용된 함수 셀렉터
}
```

### 2.2 Gas Policy

**위치**: `kernel-7579-plugins/policies/gas/src/GasPolicy.sol`  
**주소**: `0xaeFC5AbC67FfD258abD0A3E54f65E70326F84b23`  
**기능**: 가스비 한도 제한, 특정 Paymaster 강제 사용
```solidity
struct GasPolicyConfig {
    uint128 allowed;              // 허용된 가스비 한도
    bool enforcePaymaster;         // Paymaster 강제 여부
    address allowedPaymaster;      // 허용된 Paymaster 주소
}
```

### 2.3 RateLimit Policy

**위치**: `kernel-7579-plugins/policies/ratelimit/src/RateLimitPolicy.sol`  
**주소**: `0xf63d4139B25c836334edD76641356c6b74C86873`  
**기능**: 시간당/일당 트랜잭션 횟수 제한
```solidity
struct RateLimitConfig {
    uint48 interval;   // 제한 간격 (초)
    uint48 count;      // 허용 횟수
    ValidAfter startAt; // 시작 시간
}
```

### 2.4 Signature Policy

**위치**: `kernel-7579-plugins/policies/signature-caller/src/SignaturePolicy.sol`  
**주소**: `0xF6A936c88D97E6fad13b98d2FD731Ff17eeD591d`  
**기능**: 특정 서명자만 허용 (예: 멀티시그에서 특정 키만 사용 가능)

### 2.5 Sudo Policy

**위치**: `kernel-7579-plugins/policies/sudo/src/SudoPolicy.sol`  
**주소**: `0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7`  
**기능**: 모든 제약을 우회하는 슈퍼 유저 정책 (관리자용)

### 2.6 Timestamp Policy

**위치**: `kernel-7579-plugins/policies/timestamp/src/TimestampPolicy.sol`  
**주소**: `0xB9f8f524bE6EcD8C945b1b87f9ae5C192FdCE20F`  
**기능**: 특정 시간 범위 내에서만 실행 허용
```solidity
struct TimestampConfig {
    ValidAfter validAfter;   // 시작 시간
    ValidUntil validUntil;   // 종료 시간
}
```

**Policy 인터페이스**:
```solidity
interface IPolicy is IModule {
    // UserOperation 정책 검증
    function checkUserOpPolicy(
        bytes32 id,
        PackedUserOperation calldata userOp
    ) external payable returns (uint256);
    
    // ERC-1271 서명 정책 검증
    function checkSignaturePolicy(
        bytes32 id,
        address sender,
        bytes32 hash,
        bytes calldata sig
    ) external view returns (uint256);
}
```

**반환값**: `0` = 통과, `1` = 거부

---

## 3. Validator Contract ?

**답변**:

Validator Contract는 ERC-7579의 **Module Type 1**로, Smart Account의 소유권 검증을 담당하는 핵심 모듈입니다.

**구현 위치**:
- `kernel/src/validator/ECDSAValidator.sol` - 기본 ECDSA 검증기
- `kernel/src/validator/WeightedECDSAValidator.sol` - 가중 다중서명 검증기
- `kernel/src/validator/MultiChainValidator.sol` - 멀티체인 검증기

**주요 기능**:
```solidity
interface IValidator is IModule {
    // ERC-4337 UserOperation 검증
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external payable returns (uint256);
    
    // ERC-1271 서명 검증
    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata data
    ) external view returns (bytes4);
}
```

**검증 반환값** (ERC-4337 표준):
- `SIG_VALIDATION_SUCCESS_UINT` (0): 검증 성공
- `SIG_VALIDATION_FAILED_UINT` (1): 검증 실패
- `packValidationData(validAfter, validUntil)`: 시간 기반 검증 데이터

**Validator 타입**:

1. **ECDSAValidator**: 단일 ECDSA 키 기반 검증
   ```solidity
   mapping(address => address) public ecdsaValidatorStorage; // account => owner
   ```

2. **WeightedECDSAValidator**: 가중 다중서명 검증
   ```solidity
   struct WeightedValidatorConfig {
       uint256 threshold;  // 최소 가중치 합계
       address[] signers; // 서명자 목록
       uint256[] weights; // 각 서명자의 가중치
   }
   ```

3. **MultiChainValidator**: 멀티체인 서명 검증 (Merkle Proof 기반)

**Validator vs Policy 차이점**:
- **Validator**: "누가" 실행할 수 있는지 검증 (소유권)
- **Policy**: "어떤 조건에서" 실행할 수 있는지 검증 (제약 조건)

---

## 4. Recovery Contract ?

**답변**:

Recovery Contract는 Smart Account의 키 복구를 위한 Action 모듈입니다. Guardian(보호자) 계정이 새로운 Validator를 설치하여 계정 소유권을 복구할 수 있게 합니다.

**구현 위치**:
- `kernel-7579-plugins/actions/recovery/src/RecoveryAction.sol`
**주소**: `0xe884C2868CC82c16177eC73a93f7D9E6F3A5DC6E`

**핵심 로직**:
```solidity
contract RecoveryAction {
    function doRecovery(address _validator, bytes calldata _data) external {
        // 1. 기존 Validator 제거
        IValidator(_validator).onUninstall(hex"");
        // 2. 새로운 Validator 설치
        IValidator(_validator).onInstall(_data);
    }
}
```

**Recovery 흐름**:

1. **초기 설정**:
   ```
   Account Owner (oldSigner)
   ├── Sudo Validator: ECDSAValidator(oldSigner)
   └── Regular Validator: WeightedECDSAValidator(guardian)
   └── Action Module: RecoveryAction (with Caller Hook)
   ```

2. **Guardian 등록**:
   ```typescript
   await registerGuardian(account, {
       guardian: guardianAccount.address
   });
   ```

3. **Recovery 실행** (Guardian이 수행):
   ```typescript
   await recoverAccount(guardianClient, {
       targetAccount: account.address,
       guardian: guardianAccount.address,
       newSigner: newSigner
   });
   ```

4. **결과**:
   - 기존 `oldSigner`의 Validator 제거
   - 새로운 `newSigner`의 Validator 설치
   - 계정 소유권이 `newSigner`로 이전

**보안 고려사항**:
- RecoveryAction은 **Caller Hook**과 함께 사용되어 Guardian만 호출 가능하도록 제한
- Guardian은 WeightedECDSAValidator로 관리되어 다중 Guardian 지원 가능
- Recovery 후 기존 Validator는 완전히 제거되므로 키 유출 시 즉시 복구 가능

**SDK 사용 예시**:
```typescript
// zerodev-examples/guardians/recovery.ts 참조
const recoveryExecutorFunction = "function doRecovery(address _validator, bytes calldata _data)";
```

---

## 5. Is Entrypoint Hook Contract a standard spec ?

**답변**:

**아니요, EntryPoint Hook은 ERC-7579 표준이 아닙니다.** ERC-7579는 Hook 모듈 타입을 정의하지만, "EntryPoint 전용 Hook"은 Kernel 프로젝트의 커스텀 구현입니다.

**ERC-7579 표준 Hook 인터페이스**:
```solidity
interface IHook is IModule {
    function preCheck(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) external payable returns (bytes memory hookData);
    
    function postCheck(bytes calldata hookData) external payable;
}
```

**OnlyEntryPointHook 구현**:
```solidity
// kernel-7579-plugins/hooks/onlyEntrypoint/src/OnlyEntryPointHook.sol
contract OnlyEntryPointHook is IHook {
    address constant ENTRYPOINT_0_7 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    
    function preCheck(address msgSender, uint256, bytes calldata) 
        external payable override returns (bytes memory) {
        require(msgSender == ENTRYPOINT_0_7, "only entrypoint");
    }
}
```

**주소**: `0xb230f0A1C7C95fa11001647383c8C7a8F316b900`

**용도**:
- 특정 함수가 EntryPoint를 통해서만 호출되도록 제한
- 예: RecoveryAction은 Guardian이 직접 호출할 수 없고, EntryPoint를 통한 UserOperation으로만 실행 가능

**Kernel의 Hook 시스템**:
```solidity
// Kernel.sol에서 Hook 호출
IHook execHook = vc.hook;
if (address(execHook) != HOOK_MODULE_NOT_INSTALLED) {
    bytes memory hookData = execHook.preCheck(msg.sender, msg.value, msg.data);
    // ... 실행 ...
    execHook.postCheck(hookData);
}
```

**결론**:
- Hook 모듈 타입 자체는 ERC-7579 표준 (Module Type 4)
- OnlyEntryPointHook은 Kernel 프로젝트의 커스텀 구현
- 표준 스펙은 Hook 인터페이스만 정의하며, 구체적인 Hook 구현은 프로젝트별로 다름

---

## 6. SetCode 의 Auth logic flow 검토

**답변**:

EIP-7702 SetCode 트랜잭션의 Authorization 로직은 go-stablenet에서 완전히 구현되어 있습니다.

### 6.1 데이터 구조

**SetCodeAuthorization 구조체** (`go-stablenet/core/types/tx_setcode.go`):
```go
type SetCodeAuthorization struct {
    ChainID uint256.Int    // 체인 ID (0이면 현재 체인)
    Address common.Address // 위임할 Smart Account 주소
    Nonce   uint64         // Authorization Nonce
    V       uint8          // 서명 V (yParity)
    R       uint256.Int    // 서명 R
    S       uint256.Int    // 서명 S
}
```

**SetCodeTx 구조체**:
```go
type SetCodeTx struct {
    ChainID    *uint256.Int
    Nonce      uint64
    GasTipCap  *uint256.Int
    GasFeeCap  *uint256.Int
    Gas        uint64
    To         common.Address
    Value      *uint256.Int
    Data       []byte
    AccessList AccessList
    AuthList   []SetCodeAuthorization  // 핵심: Authorization 목록
    V, R, S    *uint256.Int            // 트랜잭션 서명
}
```

### 6.2 Authorization 생성 및 서명

**1. Authorization 생성**:
```go
auth := types.SetCodeAuthorization{
    ChainID: chainID,
    Address: smartAccountAddress,
    Nonce:   authorityNonce,
}
```

**2. 서명 해시 생성** (`SigHash()`):
```go
func (a *SetCodeAuthorization) SigHash() common.Hash {
    return prefixedRlpHash(0x05, []any{
        a.ChainID,
        a.Address,
        a.Nonce,
    })
}
```
- EIP-191 스타일: `keccak256("\x05" || rlp([chainId, address, nonce]))`

**3. 서명 생성** (`SignSetCode()`):
```go
func SignSetCode(prv *ecdsa.PrivateKey, auth SetCodeAuthorization) (SetCodeAuthorization, error) {
    sighash := auth.SigHash()
    sig, err := crypto.Sign(sighash[:], prv)
    // ... V, R, S 추출 및 반환
}
```

### 6.3 Authorization 검증 흐름

**트랜잭션 실행 시 검증** (`core/state_transition.go`):

```
1. StateTransition.validateAuthorization()
   ├── ChainID 검증 (0이거나 현재 체인 ID와 일치)
   ├── Nonce 오버플로우 검증 (2^64-1 제한)
   ├── 서명 검증 및 Authority 복구
   │   └── auth.Authority() 호출
   ├── Authority 계정 상태 검증
   │   ├── 코드가 없거나 Delegation Prefix만 있어야 함
   │   └── Nonce가 auth.Nonce와 일치해야 함
   └── AccessList에 Authority 추가

2. StateTransition.applyAuthorization()
   ├── validateAuthorization() 재호출
   ├── Authority Nonce 증가 (auth.Nonce + 1)
   └── Authority에 Delegation 코드 설치
       ├── auth.Address == 0 → SetCode(authority, nil) (제거)
       └── 그 외 → SetCode(authority, AddressToDelegation(auth.Address))
```

**Authority 복구** (`Authority()`):
```go
func (a *SetCodeAuthorization) Authority() (common.Address, error) {
    sighash := a.SigHash()
    // 서명값 검증
    if !crypto.ValidateSignatureValues(a.V, a.R.ToBig(), a.S.ToBig(), true) {
        return common.Address{}, ErrInvalidSig
    }
    // 서명 복구
    pub, err := crypto.Ecrecover(sighash[:], sig[:])
    // 공개키 → 주소 변환
    addr := crypto.Keccak256(pub[1:])[12:]
    return addr, nil
}
```

### 6.4 Delegation Prefix

**Delegation Prefix**: `[]byte{0xef, 0x01, 0x00}`

**주소 → Delegation 변환**:
```go
func AddressToDelegation(addr common.Address) []byte {
    return append(DelegationPrefix, addr.Bytes()...)
    // 결과: [0xef, 0x01, 0x00, ...20 bytes address]
}
```

**Delegation 파싱**:
```go
func ParseDelegation(b []byte) (common.Address, bool) {
    if len(b) != 23 || !bytes.HasPrefix(b, DelegationPrefix) {
        return common.Address{}, false
    }
    return common.BytesToAddress(b[len(DelegationPrefix):]), true
}
```

### 6.5 전체 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│              EIP-7702 SetCode Authorization Flow            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. EOA 소유자 (Authority)                                   │
│     ├── Smart Account 주소 선택                              │
│     ├── Authorization 생성 (ChainID, Address, Nonce)        │
│     ├── SigHash() 계산                                       │
│     └── SignSetCode()로 서명                                │
│                                                              │
│  2. SetCodeTx 생성                                           │
│     ├── AuthList에 Authorization 추가                       │
│     ├── 트랜잭션 서명 (발신자)                               │
│     └── 체인에 제출                                          │
│                                                              │
│  3. 체인 레벨 검증 (go-stablenet)                            │
│     ├── validateAuthorization()                             │
│     │   ├── ChainID 검증                                     │
│     │   ├── Nonce 검증                                       │
│     │   ├── Authority 복구 (ECDSA)                          │
│     │   └── Authority 계정 상태 검증                        │
│     └── applyAuthorization()                                │
│         ├── Authority Nonce 증가                            │
│         └── SetCode(authority, DelegationPrefix || Address) │
│                                                              │
│  4. 결과                                                      │
│     └── Authority 계정이 Smart Account 코드로 위임됨        │
│         (Authority.code == [0xef, 0x01, 0x00, ...SA address])│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 go-stablenet 체인 레벨 구현 현황

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

검증 로직 (core/state_transition.go):
├── validateAuthorization() - Authorization 검증 ✅
│   ├── ChainID 검증
│   ├── Nonce 검증
│   ├── 서명 검증 및 Authority 복구
│   └── Authority 계정 상태 검증
└── applyAuthorization() - Authorization 적용 ✅
    ├── Authority Nonce 증가
    └── Delegation 코드 설치
```

### 6.7 보안 검증 항목

✅ **구현 완료된 검증**:
1. ✅ ChainID 검증 (다른 체인 Authorization 방지)
2. ✅ Nonce 검증 (Replay Attack 방지)
3. ✅ 서명 검증 (ECDSA 복구)
4. ✅ Authority 계정 코드 검증 (기존 코드가 있으면 거부)
5. ✅ Nonce 일치 검증 (Authorization Nonce == Account Nonce)
6. ✅ Delegation Prefix 검증 (올바른 형식만 허용)

**검증 코드 위치**:
- `go-stablenet/core/state_transition.go:595` - `validateAuthorization()`
- `go-stablenet/core/state_transition.go:626` - `applyAuthorization()`
- `go-stablenet/core/types/tx_setcode.go:118` - `Authority()`

**결론**: SetCode Authorization 로직은 EIP-7702 명세를 완전히 준수하며, 모든 보안 검증이 구현되어 있습니다.

---

## 7. 

(추가 질문이 있으면 여기에 작성)
