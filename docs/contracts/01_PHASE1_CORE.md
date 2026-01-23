# Phase 1: Core Foundation

> **Version**: 1.0
> **Duration**: 1-2 주
> **Priority**: Critical
> **Dependencies**: None

---

## 1. 개요

Phase 1은 StableNet Smart Contract 인프라의 기반을 구축합니다.

### 1.1 목표
- Foundry 개발 환경 구축
- ERC-4337 v0.7 EntryPoint 배포
- ERC-7579 호환 Kernel Smart Account 구현
- EIP-7702 Delegation 지원

### 1.2 산출물
- 배포 가능한 Core 컨트랙트
- 단위 테스트 (80%+ 커버리지)
- Anvil devnet 배포

---

## 2. 컴포넌트 목록

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 |
|----|----------|------|---------|--------|
| C1.1 | EntryPoint | `core/EntryPoint.sol` | P0 | High |
| C1.2 | Kernel | `core/Kernel.sol` | P0 | High |
| C1.3 | KernelFactory | `core/KernelFactory.sol` | P0 | Medium |
| C1.4 | DelegateKernel | `delegation/DelegateKernel.sol` | P0 | Medium |
| C1.5 | ECDSAValidator | `validators/ECDSAValidator.sol` | P0 | Low |
| C1.6 | Interfaces | `core/interfaces/*.sol` | P0 | Low |
| C1.7 | Libraries | `libraries/*.sol` | P1 | Medium |

---

## 3. 태스크 분해

### 3.1 환경 설정 (T1.0)

#### T1.0.1 Foundry 프로젝트 초기화
```yaml
파일: packages/contracts/foundry.toml
작업:
  - [ ] foundry.toml 생성
  - [ ] remappings.txt 설정
  - [ ] .gitignore 업데이트
  - [ ] forge install dependencies
예상시간: 1h
의존성: 없음
```

**foundry.toml 구성**:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
optimizer = true
optimizer_runs = 200
via_ir = true
solc_version = "0.8.24"

[profile.default.fuzz]
runs = 1000
max_test_rejects = 100000

[profile.default.invariant]
runs = 256
depth = 32

[rpc_endpoints]
anvil = "http://localhost:8545"
sepolia = "${SEPOLIA_RPC_URL}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
```

#### T1.0.2 의존성 설치
```yaml
작업:
  - [ ] forge install foundry-rs/forge-std
  - [ ] forge install eth-infinitism/account-abstraction
  - [ ] forge install vectorized/solady
  - [ ] forge install openzeppelin/openzeppelin-contracts
예상시간: 30m
의존성: T1.0.1
```

#### T1.0.3 기본 디렉토리 구조 생성
```yaml
작업:
  - [ ] src/ 하위 폴더 생성
  - [ ] test/ 하위 폴더 생성
  - [ ] script/ 폴더 생성
  - [ ] deployments/ 폴더 생성
예상시간: 15m
의존성: T1.0.1
```

---

### 3.2 Interfaces 정의 (T1.1)

#### T1.1.1 IEntryPoint.sol
```yaml
파일: src/core/interfaces/IEntryPoint.sol
작업:
  - [ ] PackedUserOperation struct 정의
  - [ ] handleOps() 시그니처
  - [ ] getUserOpHash() 시그니처
  - [ ] getNonce() 시그니처
  - [ ] depositTo() / withdrawTo() 시그니처
  - [ ] Events 정의 (UserOperationEvent, AccountDeployed 등)
예상시간: 2h
의존성: T1.0.2
```

**PackedUserOperation 구조체**:
```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;              // factory + factoryData
    bytes callData;
    bytes32 accountGasLimits;    // callGasLimit (16) | verificationGasLimit (16)
    uint256 preVerificationGas;
    bytes32 gasFees;             // maxPriorityFeePerGas (16) | maxFeePerGas (16)
    bytes paymasterAndData;
    bytes signature;
}
```

#### T1.1.2 IERC7579Account.sol
```yaml
파일: src/core/interfaces/IERC7579Account.sol
작업:
  - [ ] execute() 시그니처 (ModeCode 기반)
  - [ ] executeFromExecutor() 시그니처
  - [ ] installModule() 시그니처
  - [ ] uninstallModule() 시그니처
  - [ ] isModuleInstalled() 시그니처
  - [ ] accountId() 시그니처
  - [ ] supportsExecutionMode() 시그니처
  - [ ] supportsModule() 시그니처
예상시간: 2h
의존성: T1.0.2
```

**Module Types**:
```solidity
uint256 constant MODULE_TYPE_VALIDATOR = 1;
uint256 constant MODULE_TYPE_EXECUTOR = 2;
uint256 constant MODULE_TYPE_FALLBACK = 3;
uint256 constant MODULE_TYPE_HOOK = 4;
```

#### T1.1.3 IValidator.sol
```yaml
파일: src/core/interfaces/IValidator.sol
작업:
  - [ ] validateUserOp() 시그니처
  - [ ] isValidSignatureWithSender() 시그니처
  - [ ] onInstall() / onUninstall() 시그니처
예상시간: 1h
의존성: T1.1.1
```

#### T1.1.4 IExecutor.sol
```yaml
파일: src/core/interfaces/IExecutor.sol
작업:
  - [ ] onInstall() / onUninstall() 시그니처
예상시간: 30m
의존성: T1.0.2
```

#### T1.1.5 IHook.sol
```yaml
파일: src/core/interfaces/IHook.sol
작업:
  - [ ] preCheck() 시그니처
  - [ ] postCheck() 시그니처
예상시간: 30m
의존성: T1.0.2
```

#### T1.1.6 IPaymaster.sol
```yaml
파일: src/core/interfaces/IPaymaster.sol
작업:
  - [ ] validatePaymasterUserOp() 시그니처
  - [ ] postOp() 시그니처
  - [ ] PostOpMode enum 정의
예상시간: 1h
의존성: T1.1.1
```

---

### 3.3 Libraries 구현 (T1.2)

#### T1.2.1 ModeLib.sol
```yaml
파일: src/libraries/ModeLib.sol
작업:
  - [ ] ModeCode 타입 정의 (bytes32)
  - [ ] CallType enum (SINGLE, BATCH, DELEGATECALL)
  - [ ] ExecType enum (DEFAULT, TRY)
  - [ ] encodeSimpleSingle() 함수
  - [ ] encodeSimpleBatch() 함수
  - [ ] decodeMode() 함수
예상시간: 2h
의존성: T1.1.2
```

**ModeCode 구조**:
```
bytes32 ModeCode:
[0]     - CallType (1 byte)
[1]     - ExecType (1 byte)
[2:5]   - Reserved (4 bytes)
[6:9]   - ModeSelector (4 bytes)
[10:31] - ModePayload (22 bytes)
```

#### T1.2.2 ExecutionLib.sol
```yaml
파일: src/libraries/ExecutionLib.sol
작업:
  - [ ] Execution struct 정의 (target, value, callData)
  - [ ] encodeSingle() 함수
  - [ ] encodeBatch() 함수
  - [ ] decodeSingle() 함수
  - [ ] decodeBatch() 함수
예상시간: 2h
의존성: T1.2.1
```

#### T1.2.3 ValidationLib.sol
```yaml
파일: src/libraries/ValidationLib.sol
작업:
  - [ ] SIG_VALIDATION_FAILED 상수
  - [ ] SIG_VALIDATION_SUCCESS 상수
  - [ ] packValidationData() 함수
  - [ ] unpackValidationData() 함수
  - [ ] ValidationData struct (validAfter, validUntil, aggregator)
예상시간: 1h
의존성: T1.1.1
```

---

### 3.4 EntryPoint 연동 (T1.3)

> **중요**: EntryPoint는 ERC-4337 표준의 **싱글톤 컨트랙트**입니다.
> 새로 배포하지 않고 각 체인에 배포된 **Canonical EntryPoint v0.7**을 사용합니다.
> - Ethereum Mainnet: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
> - 대부분의 EVM 체인에 동일 주소로 배포됨

#### T1.3.1 EntryPoint 연동 설정
```yaml
파일: src/core/interfaces/IEntryPoint.sol, src/constants/Addresses.sol
작업:
  - [ ] Canonical EntryPoint 주소 상수 정의
  - [ ] IEntryPoint 인터페이스 import (eth-infinitism/account-abstraction)
  - [ ] 체인별 EntryPoint 주소 매핑 (Sepolia, Base 등)
  - [ ] 로컬 테스트용 EntryPoint 배포 스크립트 (Anvil 전용)
예상시간: 2h
의존성: T1.1.1
```

> **로컬 테스트**: Anvil에서는 Canonical EntryPoint가 없으므로 테스트 전용으로 배포합니다.
> 그러나 테스트넷/메인넷에서는 반드시 기존 Canonical EntryPoint를 사용해야 합니다.

#### T1.3.2 EntryPoint 헬퍼 유틸리티
```yaml
파일: src/libraries/EntryPointLib.sol
작업:
  - [ ] getUserOpHash() 래퍼 함수
  - [ ] getNonce() 조회 헬퍼
  - [ ] getDepositInfo() 조회 헬퍼
  - [ ] Simulation 유틸리티 함수
예상시간: 2h
의존성: T1.3.1
```

> **참고**: EntryPoint의 핵심 로직(handleOps, deposit, stake 등)은
> Canonical 컨트랙트에 이미 구현되어 있습니다.
> 우리는 이를 호출하는 Account/Paymaster 측면만 구현합니다.

**EntryPoint 주요 함수 (참조용)**:
```
handleOps(ops[], beneficiary)
├── for each op:
│   ├── _validatePrepayment(op)
│   │   ├── _getRequiredPrefund()
│   │   ├── _validateAccountPrepayment()
│   │   │   ├── account.validateUserOp() 호출
│   │   │   └── signature 검증, nonce 확인
│   │   └── _validatePaymasterPrepayment() (if paymaster)
│   │
│   ├── _executeUserOp(op)
│   │   ├── account.execute() 호출
│   │   └── 가스 측정
│   │
│   └── _postExecution(op)
│       ├── 가스비 정산
│       └── paymaster.postOp() 호출 (if paymaster)
│
└── beneficiary.transfer(collected)
```

**Nonce 구조** (EntryPoint에서 관리):
```
uint256 nonce = (uint192 key << 64) | uint64 sequence
- key: 병렬 nonce 채널 (최대 2^192개)
- sequence: 순차 증가 (최대 2^64개)
```

#### T1.3.3 로컬 테스트용 EntryPoint 배포 (Anvil 전용)
```yaml
파일: script/DeployEntryPoint.s.sol
작업:
  - [ ] Anvil 환경 감지
  - [ ] EntryPoint v0.7 배포 (테스트 전용)
  - [ ] 배포 주소 저장
예상시간: 1h
의존성: T1.3.1
참고: 테스트넷/메인넷에서는 실행하지 않음
```

---

### 3.5 Kernel 구현 (T1.4)

#### T1.4.1 Kernel Storage 레이아웃
```yaml
파일: src/core/Kernel.sol
작업:
  - [ ] ERC-7201 namespaced storage
  - [ ] KernelStorage struct 정의
  - [ ] _getKernelStorage() 내부 함수
예상시간: 2h
의존성: T1.1.2
```

**Storage Layout**:
```solidity
struct KernelStorage {
    // Root validator
    IValidator rootValidator;
    bytes rootValidatorData;

    // Module registry
    mapping(address => ModuleConfig) validators;
    mapping(address => ModuleConfig) executors;
    mapping(bytes4 => FallbackConfig) fallbacks;
    IHook hook;

    // Note: Nonce는 EntryPoint에서 관리됨 (2D nonce: key + sequence)
    // Account는 별도로 nonce를 추적하지 않음
}

struct ModuleConfig {
    bool isInstalled;
    bytes data;
}

struct FallbackConfig {
    address handler;
    CallType callType;
}
```

#### T1.4.2 Kernel 초기화
```yaml
작업:
  - [ ] initialize() 함수 (proxy pattern용)
  - [ ] _initializeRootValidator()
  - [ ] Initializable guard (OZ 또는 custom)
예상시간: 2h
의존성: T1.4.1
```

#### T1.4.3 validateUserOp() 구현
```yaml
작업:
  - [ ] IAccount.validateUserOp() 구현
  - [ ] rootValidator 또는 selector별 validator 선택
  - [ ] validator.validateUserOp() 호출
  - [ ] prefund 처리 (missingAccountFunds)
예상시간: 4h
의존성: T1.4.1, T1.1.3
```

**validateUserOp 흐름**:
```
validateUserOp(userOp, userOpHash, missingAccountFunds)
├── validator = _getValidator(userOp.signature)
├── validationData = validator.validateUserOp(userOp, userOpHash)
├── if (missingAccountFunds > 0):
│   └── _payPrefund(missingAccountFunds)
└── return validationData
```

#### T1.4.4 execute() 구현
```yaml
작업:
  - [ ] ModeCode 파싱
  - [ ] SINGLE 모드: _executeSingle()
  - [ ] BATCH 모드: _executeBatch()
  - [ ] DELEGATECALL 모드: _executeDelegateCall()
  - [ ] TRY 모드 지원 (실패해도 revert 안함)
예상시간: 4h
의존성: T1.2.1, T1.2.2
```

#### T1.4.5 executeFromExecutor() 구현
```yaml
작업:
  - [ ] executor 검증 (isModuleInstalled)
  - [ ] execute() 위임
  - [ ] returnData 반환
예상시간: 2h
의존성: T1.4.4
```

#### T1.4.6 Module 관리
```yaml
작업:
  - [ ] installModule() 구현
  - [ ] uninstallModule() 구현
  - [ ] isModuleInstalled() 구현
  - [ ] _installValidator()
  - [ ] _installExecutor()
  - [ ] _installFallback()
  - [ ] _installHook()
예상시간: 4h
의존성: T1.4.1
```

**installModule 흐름**:
```
installModule(moduleTypeId, module, initData)
├── require(!isModuleInstalled(moduleTypeId, module))
├── switch (moduleTypeId):
│   ├── VALIDATOR: _installValidator(module, initData)
│   ├── EXECUTOR: _installExecutor(module, initData)
│   ├── FALLBACK: _installFallback(module, initData)
│   └── HOOK: _installHook(module, initData)
└── module.onInstall(initData)
```

#### T1.4.7 ERC-1271 지원
```yaml
작업:
  - [ ] isValidSignature() 구현
  - [ ] EIP-1271 매직 값 반환
예상시간: 1h
의존성: T1.4.1
```

#### T1.4.8 Fallback 처리
```yaml
작업:
  - [ ] fallback() 함수
  - [ ] receive() 함수
  - [ ] _fallback() 내부 함수
예상시간: 2h
의존성: T1.4.1
```

---

### 3.6 KernelFactory 구현 (T1.5)

#### T1.5.1 Factory 기본 구조
```yaml
파일: src/core/KernelFactory.sol
작업:
  - [ ] implementation 저장
  - [ ] entryPoint 저장
예상시간: 1h
의존성: T1.4.2
```

#### T1.5.2 createAccount() 구현
```yaml
작업:
  - [ ] salt 계산 (owner + index)
  - [ ] CREATE2로 ERC1967Proxy 배포
  - [ ] Kernel.initialize() 호출
  - [ ] AccountCreated 이벤트
예상시간: 3h
의존성: T1.5.1
```

#### T1.5.3 getAddress() 구현
```yaml
작업:
  - [ ] CREATE2 주소 계산
  - [ ] 배포 전 주소 예측
예상시간: 1h
의존성: T1.5.1
```

#### T1.5.4 initCode 생성 유틸
```yaml
작업:
  - [ ] getInitCode() 헬퍼 함수
  - [ ] factory address + createAccount calldata
예상시간: 1h
의존성: T1.5.2
```

---

### 3.7 DelegateKernel 구현 (T1.6)

#### T1.6.1 EIP-7702 호환 설계
```yaml
파일: src/delegation/DelegateKernel.sol
작업:
  - [ ] Kernel 상속 또는 래핑
  - [ ] 0xef0100 delegation 인식
  - [ ] EOA → CA 전환 시 초기화 로직
예상시간: 3h
의존성: T1.4.2
```

**EIP-7702 Delegation**:
```
EOA bytecode after delegation:
0xef0100 + delegateAddress (20 bytes)

When called:
1. EVM recognizes 0xef0100 prefix
2. Loads code from delegateAddress
3. Executes in EOA's context (storage, balance)
```

#### T1.6.2 초기화 없이 동작 지원
```yaml
작업:
  - [ ] isInitialized() 체크 수정
  - [ ] 첫 호출 시 자동 초기화 (lazy init)
  - [ ] 기본 validator 설정 (msg.sender = owner)
예상시간: 2h
의존성: T1.6.1
```

#### T1.6.3 DelegationRegistry
```yaml
파일: src/delegation/DelegationRegistry.sol
작업:
  - [ ] 승인된 delegate 목록 관리
  - [ ] delegate preset 저장
  - [ ] 버전 관리
예상시간: 2h
의존성: T1.6.1
```

---

### 3.8 ECDSAValidator 구현 (T1.7)

#### T1.7.1 기본 구조
```yaml
파일: src/validators/ECDSAValidator.sol
작업:
  - [ ] IValidator 상속
  - [ ] owners mapping (account → owner)
예상시간: 1h
의존성: T1.1.3
```

#### T1.7.2 onInstall/onUninstall
```yaml
작업:
  - [ ] onInstall(): owner 등록
  - [ ] onUninstall(): owner 삭제
예상시간: 1h
의존성: T1.7.1
```

#### T1.7.3 validateUserOp()
```yaml
작업:
  - [ ] userOpHash를 ethSignedMessageHash로 변환
  - [ ] ECDSA.recover()
  - [ ] owner 비교
  - [ ] validationData 반환
예상시간: 2h
의존성: T1.7.1
```

#### T1.7.4 isValidSignatureWithSender()
```yaml
작업:
  - [ ] ERC-1271 호환
  - [ ] hash → ethSignedMessageHash
  - [ ] ECDSA 검증
  - [ ] magic value 반환
예상시간: 1h
의존성: T1.7.3
```

---

### 3.9 테스트 작성 (T1.8)

#### T1.8.1 EntryPoint 테스트
```yaml
파일: test/core/EntryPoint.t.sol
작업:
  - [ ] handleOps 성공 케이스
  - [ ] handleOps 실패 케이스 (invalid signature)
  - [ ] Nonce 관리 테스트
  - [ ] Deposit/Withdraw 테스트
  - [ ] Simulation 테스트
예상시간: 6h
의존성: T1.3.*
```

#### T1.8.2 Kernel 테스트
```yaml
파일: test/core/Kernel.t.sol
작업:
  - [ ] validateUserOp 테스트
  - [ ] execute (single/batch) 테스트
  - [ ] Module install/uninstall 테스트
  - [ ] ERC-1271 테스트
예상시간: 6h
의존성: T1.4.*
```

#### T1.8.3 KernelFactory 테스트
```yaml
파일: test/core/KernelFactory.t.sol
작업:
  - [ ] createAccount 테스트
  - [ ] getAddress 테스트
  - [ ] CREATE2 결정론적 주소 검증
예상시간: 2h
의존성: T1.5.*
```

#### T1.8.4 DelegateKernel 테스트
```yaml
파일: test/delegation/DelegateKernel.t.sol
작업:
  - [ ] EIP-7702 delegation 시뮬레이션
  - [ ] EOA context에서 실행 검증
  - [ ] Lazy initialization 테스트
예상시간: 3h
의존성: T1.6.*
```

#### T1.8.5 ECDSAValidator 테스트
```yaml
파일: test/validators/ECDSAValidator.t.sol
작업:
  - [ ] validateUserOp 성공/실패
  - [ ] isValidSignature 테스트
  - [ ] Install/Uninstall 테스트
예상시간: 2h
의존성: T1.7.*
```

#### T1.8.6 Integration 테스트
```yaml
파일: test/integration/FullFlow.t.sol
작업:
  - [ ] Factory → Account 생성 → UserOp 전송 풀플로우
  - [ ] 여러 UserOp 배치 실행
  - [ ] Module 교체 시나리오
예상시간: 4h
의존성: T1.8.1 ~ T1.8.5
```

---

### 3.10 배포 스크립트 (T1.9)

#### T1.9.1 Deploy.s.sol
```yaml
파일: script/Deploy.s.sol
작업:
  - [ ] EntryPoint 주소 설정 (Canonical 사용, Anvil에서만 배포)
  - [ ] Kernel implementation 배포
  - [ ] KernelFactory 배포 (EntryPoint 주소 전달)
  - [ ] ECDSAValidator 배포
  - [ ] DelegateKernel 배포 (optional)
  - [ ] 주소 저장 (JSON)
예상시간: 3h
의존성: T1.8.*
참고: 테스트넷/메인넷에서는 Canonical EntryPoint (0x0000000071727De22E5E9d8BAf0edAc6f37da032) 사용
```

#### T1.9.2 Anvil 로컬 배포
```yaml
작업:
  - [ ] anvil 시작 스크립트
  - [ ] forge script 실행
  - [ ] deployments/anvil.json 생성
예상시간: 1h
의존성: T1.9.1
```

#### T1.9.3 SDK 주소 연동
```yaml
작업:
  - [ ] packages/contracts/src/generated/addresses.ts 업데이트
  - [ ] ABI 파일 복사 스크립트
예상시간: 1h
의존성: T1.9.2
```

---

## 4. 의존성 그래프

```
T1.0 (환경설정)
├── T1.0.1 Foundry 초기화
├── T1.0.2 의존성 설치 ◄── T1.0.1
└── T1.0.3 디렉토리 구조 ◄── T1.0.1

T1.1 (Interfaces) ◄── T1.0.2
├── T1.1.1 IEntryPoint
├── T1.1.2 IERC7579Account
├── T1.1.3 IValidator ◄── T1.1.1
├── T1.1.4 IExecutor
├── T1.1.5 IHook
└── T1.1.6 IPaymaster ◄── T1.1.1

T1.2 (Libraries) ◄── T1.1.*
├── T1.2.1 ModeLib ◄── T1.1.2
├── T1.2.2 ExecutionLib ◄── T1.2.1
└── T1.2.3 ValidationLib ◄── T1.1.1

T1.3 (EntryPoint) ◄── T1.1.1
├── T1.3.1 기본 구조
├── T1.3.2 handleOps ◄── T1.3.1
├── T1.3.3 getUserOpHash ◄── T1.3.1
├── T1.3.4 getNonce ◄── T1.3.1
├── T1.3.5 Deposit/Stake ◄── T1.3.1
└── T1.3.6 Simulation ◄── T1.3.2

T1.4 (Kernel) ◄── T1.1.2, T1.2.*
├── T1.4.1 Storage 레이아웃
├── T1.4.2 초기화 ◄── T1.4.1
├── T1.4.3 validateUserOp ◄── T1.4.1, T1.1.3
├── T1.4.4 execute ◄── T1.2.1, T1.2.2
├── T1.4.5 executeFromExecutor ◄── T1.4.4
├── T1.4.6 Module 관리 ◄── T1.4.1
├── T1.4.7 ERC-1271 ◄── T1.4.1
└── T1.4.8 Fallback ◄── T1.4.1

T1.5 (KernelFactory) ◄── T1.4.2
├── T1.5.1 기본 구조
├── T1.5.2 createAccount ◄── T1.5.1
├── T1.5.3 getAddress ◄── T1.5.1
└── T1.5.4 initCode 유틸 ◄── T1.5.2

T1.6 (DelegateKernel) ◄── T1.4.2
├── T1.6.1 EIP-7702 호환
├── T1.6.2 Lazy init ◄── T1.6.1
└── T1.6.3 DelegationRegistry ◄── T1.6.1

T1.7 (ECDSAValidator) ◄── T1.1.3
├── T1.7.1 기본 구조
├── T1.7.2 onInstall/Uninstall ◄── T1.7.1
├── T1.7.3 validateUserOp ◄── T1.7.1
└── T1.7.4 isValidSignature ◄── T1.7.3

T1.8 (테스트) ◄── T1.3.* ~ T1.7.*
├── T1.8.1 EntryPoint 테스트
├── T1.8.2 Kernel 테스트
├── T1.8.3 KernelFactory 테스트
├── T1.8.4 DelegateKernel 테스트
├── T1.8.5 ECDSAValidator 테스트
└── T1.8.6 Integration 테스트

T1.9 (배포) ◄── T1.8.*
├── T1.9.1 Deploy.s.sol
├── T1.9.2 Anvil 배포 ◄── T1.9.1
└── T1.9.3 SDK 연동 ◄── T1.9.2
```

---

## 5. 일정 추정

| Week | 작업 그룹 | 예상 시간 |
|------|----------|-----------|
| Week 1 Day 1-2 | T1.0 환경설정 + T1.1 Interfaces | 8h |
| Week 1 Day 3-4 | T1.2 Libraries + T1.3 EntryPoint | 20h |
| Week 1 Day 5 | T1.3 EntryPoint 완료 | 6h |
| Week 2 Day 1-2 | T1.4 Kernel | 20h |
| Week 2 Day 3 | T1.5 KernelFactory + T1.6 DelegateKernel | 10h |
| Week 2 Day 4 | T1.7 ECDSAValidator | 5h |
| Week 2 Day 5 | T1.8 테스트 + T1.9 배포 | 15h |

**총 예상 시간**: ~84h (2주)

---

## 6. 체크리스트

### Phase 1 완료 조건

- [ ] Foundry 프로젝트 빌드 성공
- [ ] 모든 인터페이스 정의 완료
- [ ] EntryPoint v0.7 배포 가능
- [ ] Kernel v3.1 배포 가능
- [ ] KernelFactory 동작 확인
- [ ] DelegateKernel EIP-7702 호환
- [ ] ECDSAValidator 검증 성공
- [ ] 테스트 커버리지 80%+
- [ ] Anvil devnet 배포 완료
- [ ] SDK 주소 연동 완료

---

## 7. 관련 문서

- [specs/EntryPoint.md](./specs/EntryPoint.md)
- [specs/Kernel.md](./specs/Kernel.md)
- [specs/KernelFactory.md](./specs/KernelFactory.md)
- [specs/DelegateKernel.md](./specs/DelegateKernel.md)
- [specs/ECDSAValidator.md](./specs/ECDSAValidator.md)

---

*Phase 1 문서 끝*
