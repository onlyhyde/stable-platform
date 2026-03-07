# ERC-4337 스펙 준수 검토 보고서

## 개요

이 문서는 Kernel 프로젝트가 ERC-4337 (Account Abstraction) 스펙을 얼마나 잘 준수하는지 검토한 결과입니다.

**검토 일자**: 2024년  
**검토 대상**: `kernel/` 폴더의 구현  
**참조 문서**: `docs/eip/ERC-4337.md`

---

## 1. PackedUserOperation 구조체

### ✅ 스펙 준수

**스펙 요구사항** (ERC-4337.md:47-58):
```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}
```

**구현** (`kernel/src/interfaces/PackedUserOperation.sol:18-28`):
```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}
```

**결과**: ✅ **완벽히 일치** - 모든 필드가 스펙과 동일한 순서와 타입으로 정의됨

---

## 2. IAccount 인터페이스

### ✅ 스펙 준수

**스펙 요구사항** (ERC-4337.md:202-209):
```solidity
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
```

**구현** (`kernel/src/interfaces/IAccount.sol:35-38`):
```solidity
function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
    external
    payable
    returns (ValidationData validationData);
```

**차이점 분석**:
- ✅ 파라미터 타입 및 순서: 완벽히 일치
- ✅ 반환 타입: `ValidationData`는 `uint256`의 타입 별칭으로 추정됨 (스펙상 `uint256`)
- ⚠️ `payable` 수식어: 스펙에는 명시되지 않았으나, `missingAccountFunds`를 전송하기 위해 필요함

**결과**: ✅ **스펙 준수** - `payable`은 `missingAccountFunds` 처리에 필요한 합리적인 확장

---

## 3. validateUserOp 구현

### ✅ 핵심 요구사항 준수

**스펙 요구사항** (ERC-4337.md:187-196):
1. EntryPoint에서만 호출 가능
2. 서명 및 nonce 검증
3. `validationData` 반환
4. `missingAccountFunds` 처리

**구현 검토** (`kernel/src/Kernel.sol:229-280`):

#### 3.1 EntryPoint 접근 제어 ✅

```solidity
modifier onlyEntryPoint() {
    if (msg.sender != address(entrypoint)) {
        revert InvalidCaller();
    }
    _;
}

function validateUserOp(...) external payable override onlyEntryPoint
```

**결과**: ✅ EntryPoint에서만 호출 가능하도록 보호됨

#### 3.2 서명 및 Nonce 검증 ✅

```solidity
(ValidationMode vMode, ValidationType vType, ValidationId vId) = ValidatorLib.decodeNonce(userOp.nonce);
if (vType == VALIDATION_TYPE_ROOT) {
    vId = vs.rootValidator;
}
validationData = _validateUserOp(vMode, vId, userOp, userOpHash);
```

**결과**: ✅ Nonce에서 검증 모드와 validator ID를 디코딩하여 검증 수행

#### 3.3 missingAccountFunds 처리 ✅

```solidity
assembly {
    if missingAccountFunds {
        pop(call(gas(), caller(), missingAccountFunds, callvalue(), callvalue(), callvalue(), callvalue()))
        //ignore failure (its EntryPoint's job to verify, not account.)
    }
}
```

**결과**: ✅ `missingAccountFunds`가 있으면 EntryPoint로 전송 (스펙 요구사항 충족)

#### 3.4 validationData 반환 ✅

`_validateUserOp`는 `ValidationData`를 반환하며, 이는 스펙의 `uint256` 형식과 호환됨.

**결과**: ✅ **모든 핵심 요구사항 준수**

---

## 4. EntryPoint 인터페이스

### ✅ 스펙 준수

**스펙 요구사항** (ERC-4337.md:124-149):
- `handleOps()` ✅
- `handleAggregatedOps()` ✅
- `getUserOpHash()` ✅
- `getSenderAddress()` ✅

**구현** (`kernel/src/interfaces/IEntryPoint.sol`):
모든 필수 메서드가 인터페이스에 정의되어 있음.

**결과**: ✅ **스펙 준수**

---

## 5. UserOperation 해시 계산

### ✅ EntryPoint의 getUserOpHash 사용

**스펙 요구사항** (ERC-4337.md:950-970):
- EIP-712 스타일의 구조화된 메시지 해시
- Domain Separator: `name: "Account Abstraction", version: "1", chainId, verifyingContract: EntryPoint`
- `userOpHash = keccak256("\x19\x01" || domainSeparator || structHash)`

**구현 확인**:
- 테스트 코드에서 `entrypoint.getUserOpHash(op)` 사용 (`kernel/test/base/KernelTestBase.sol:449`)
- Kernel은 EntryPoint의 `getUserOpHash()`를 사용하므로, 해시 계산은 EntryPoint 구현에 의존

**결과**: ✅ **스펙 준수** - EntryPoint의 표준 `getUserOpHash()` 메서드 사용

### ⚠️ 추가 기능: Replayable UserOperation

Kernel은 `replayableUserOpHash()` 함수를 제공하여 체인 간 재사용 가능한 서명을 지원합니다 (`kernel/src/core/ValidationManager.sol:346-369`).

이는 ERC-4337 스펙의 확장 기능으로, 스펙 위반은 아니지만 추가 기능입니다.

---

## 6. Nonce 관리

### ⚠️ 스펙과의 차이점

**스펙 요구사항** (ERC-4337.md:1199-1211):
- Nonce는 `uint192(key) || uint64(sequence)` 형식
- EntryPoint는 각 `key`별로 `sequence`를 독립적으로 추적

**Kernel 구현**:
Kernel은 nonce를 다르게 사용합니다:
- Nonce의 첫 2바이트: ValidationMode
- Nonce의 2-22바이트: Validator 주소 (enable mode)
- 나머지: 실제 nonce 값

```solidity
// kernel/src/Kernel.sol:243
(ValidationMode vMode, ValidationType vType, ValidationId vId) = ValidatorLib.decodeNonce(userOp.nonce);
```

**분석**:
- Kernel은 nonce를 검증 모드와 validator 식별에 사용하는 확장된 방식 사용
- EntryPoint는 여전히 nonce를 `uint192(key) || uint64(sequence)`로 관리할 것으로 예상
- Kernel의 nonce 디코딩은 EntryPoint의 nonce 관리와 충돌하지 않을 것으로 보임 (다른 레벨에서 작동)

**결과**: ⚠️ **스펙 확장** - 스펙 위반은 아니지만, nonce를 검증 메타데이터로 사용하는 커스텀 방식

---

## 7. IAccountExecute 인터페이스

### ✅ 스펙 준수

**스펙 요구사항** (ERC-4337.md:229-242):
- `callData`가 `IAccountExecute.executeUserOp.selector`로 시작하면 EntryPoint가 래핑하여 전달

**구현** (`kernel/src/interfaces/IAccountExecute.sol:16`):
```solidity
function executeUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external payable;
```

**Kernel 구현** (`kernel/src/Kernel.sol:287-307`):
```solidity
function executeUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
    external
    payable
    override
    onlyEntryPoint
{
    // ... 구현
}
```

**결과**: ✅ **스펙 준수** - `executeUserOp` 메서드가 올바르게 구현됨

---

## 8. Paymaster 지원

### ✅ 인터페이스 준수

**스펙 요구사항** (ERC-4337.md:244-262):
- `IPaymaster` 인터페이스 정의

**구현 확인**:
- `kernel/src/interfaces/IPaymaster.sol`에 인터페이스 정의됨
- Kernel 자체는 Paymaster를 직접 구현하지 않지만, EntryPoint를 통해 Paymaster와 상호작용

**결과**: ✅ **스펙 준수** - Paymaster 인터페이스가 정의되어 있고, EntryPoint를 통해 작동

---

## 9. 가스 계산 및 정산

### ✅ EntryPoint 의존

**스펙 요구사항** (ERC-4337.md:544-672):
- EntryPoint가 가스 계산 및 정산을 담당
- Account는 `validateUserOp`에서 prefund를 전송

**Kernel 구현**:
- Kernel은 가스 계산을 직접 수행하지 않음
- `missingAccountFunds`를 EntryPoint로 전송하여 prefund 처리

**결과**: ✅ **스펙 준수** - 가스 계산은 EntryPoint의 책임이며, Kernel은 prefund 전송만 수행

---

## 10. 보안 고려사항

### ✅ 주요 보안 요구사항 준수

#### 10.1 EntryPoint 접근 제어 ✅
- `onlyEntryPoint` modifier로 보호됨

#### 10.2 서명 검증 ✅
- `userOpHash`에 대한 서명 검증 수행
- Validator/Permission 시스템을 통한 유연한 검증

#### 10.3 Nonce 검증 ✅
- Nonce 무효화 메커니즘 (`invalidateNonce`) 제공
- `validNonceFrom`을 통한 nonce 범위 검증

**결과**: ✅ **보안 요구사항 준수**

---

## 종합 평가

### ✅ 준수 항목 (9개)

1. ✅ PackedUserOperation 구조체
2. ✅ IAccount 인터페이스
3. ✅ validateUserOp 핵심 구현
4. ✅ EntryPoint 인터페이스
5. ✅ UserOperation 해시 계산 (EntryPoint 사용)
6. ✅ IAccountExecute 인터페이스
7. ✅ Paymaster 인터펙스
8. ✅ 가스 계산 및 정산 (EntryPoint 의존)
9. ✅ 보안 고려사항

### ⚠️ 확장/차이점 (1개)

1. ⚠️ Nonce 관리 방식
   - 스펙: `uint192(key) || uint64(sequence)` 형식
   - Kernel: Nonce를 검증 모드 및 validator 식별에 사용하는 확장 방식
   - **평가**: 스펙 위반은 아니지만, 커스텀 확장임. EntryPoint의 nonce 관리와 호환되어야 함.

### 📝 추가 기능

1. ✅ Replayable UserOperation 지원
   - 체인 간 재사용 가능한 서명 지원
   - 스펙 확장 기능

2. ✅ ERC-7579 모듈 시스템
   - Validator, Executor, Hook, Policy, Signer 모듈 지원
   - 스펙 확장 기능

---

## 결론

**Kernel 프로젝트는 ERC-4337 스펙을 대부분 준수합니다.**

### 강점:
1. ✅ 핵심 인터페이스 및 구조체가 스펙과 완벽히 일치
2. ✅ EntryPoint와의 통합이 올바르게 구현됨
3. ✅ 보안 요구사항 준수
4. ✅ 모듈러 아키텍처를 통한 확장성

### 주의사항:
1. ⚠️ Nonce 관리 방식이 스펙과 다르지만, EntryPoint 레벨에서는 호환되어야 함
2. ⚠️ EntryPoint 구현이 표준을 준수하는지 별도 검증 필요

### 권장사항:
1. EntryPoint 구현체가 ERC-4337 표준을 준수하는지 확인
2. Nonce 관리 방식이 EntryPoint의 nonce 추적과 호환되는지 테스트
3. 실제 EntryPoint 컨트랙트와의 통합 테스트 수행

---

## 검토 완료

**최종 평가**: ✅ **ERC-4337 스펙 준수** (확장 기능 포함)

Kernel은 ERC-4337의 핵심 요구사항을 충족하며, 추가적인 모듈 시스템과 확장 기능을 제공합니다.
