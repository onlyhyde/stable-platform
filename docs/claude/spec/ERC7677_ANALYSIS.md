# ERC-7677 Paymaster Proxy 분석 및 통합 가이드

## 개요

이 문서는 ERC-7677 표준과 StableNet PoC 프로젝트들 간의 관계를 분석하고, 통합 방안을 제시합니다.

---

## ERC-7677 표준이란?

**ERC-7677**은 **Paymaster Web Service 를 위한 표준 JSON-RPC 인터페이스**입니다. [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) 의 capability 시스템을 기반으로, dApp 이 Wallet 에게 특정 Paymaster 웹 서비스와 통신하도록 지시할 수 있는 표준을 정의합니다.

### 목적

- dApp → Wallet → Paymaster Service 간 통신 표준화
- 다양한 Paymaster 구현체에 대한 일관된 API 제공
- Wallet 이 자체 가스 추정을 수행하고, Paymaster 서비스에 스폰서링을 요청하는 2단계 워크플로우 표준화
- EIP-5792 `wallet_sendCalls` 의 `paymasterService` capability 를 통한 앱-지갑 통합

### 핵심 RPC 메서드

| 메서드 | 용도 | 필수 반환 필드 |
|--------|------|---------------|
| `pm_getPaymasterStubData` | 가스 추정용 stub 데이터 조회 | `paymasterPostOpGasLimit` (v0.7+ 필수) |
| `pm_getPaymasterData` | 트랜잭션 실행용 최종 paymaster 데이터 조회 | `paymaster` + `paymasterData` (v0.7+) |

> **v0.9 참고**: RPC 메서드 자체는 변경 없음. 단, v0.9 에서 `paymasterAndData` 필드 내부에 **Paymaster Signature** 가 선택적으로 추가될 수 있으며 (`PAYMASTER_SIG_MAGIC` suffix), `validUntil`/`validAfter` 에 **Block Number Mode** 가 적용될 수 있음. 자세한 내용은 [EntryPoint v0.9 변경사항](#entrypoint-v09-변경사항-v07-대비) 참조.

### 핵심 특징 (표준 문서 기준)

#### 1. 2단계 워크플로우

```
Step 1: pm_getPaymasterStubData → 가스 추정용 placeholder 데이터
Step 2: (Wallet 이 가스 추정 수행)
Step 3: pm_getPaymasterData → 최종 서명된 paymaster 데이터
Step 4: (User 서명 → Bundler 제출)
```

#### 2. `isFinal` 플래그

`pm_getPaymasterStubData` 가 `isFinal: true` 를 반환하면, Step 3 (`pm_getPaymasterData`)를 **생략** 할 수 있습니다. 이는 `paymasterData` 에 서명이 필요 없는 경우(예: ERC-20 기반 오라클 Paymaster)에 유용합니다.

#### 3. `sponsor` 객체

```typescript
sponsor?: {
  name: string;    // 스폰서 이름 (UI 표시용)
  icon?: string;   // RFC-2397 Data URI (96x96px 이상, PNG/WebP/SVG 권장)
}
```

- Wallet 이 스폰서 정보를 사용자에게 표시할 수 있음
- SVG 는 보안상 `<img>` 태그로만 렌더링해야 함 (XSS 방지)

#### 4. `paymasterService` Capability (EIP-5792 연동)

```typescript
// dApp → Wallet: wallet_sendCalls 에 capability 포함
{
  "capabilities": {
    "paymasterService": {
      "url": "https://paymaster.example.com/rpc",
      "context": {
        "policyId": "962b252c-a726-4a37-8d86-333ce0a07299"
      }
    }
  }
}

// Wallet → dApp: wallet_getCapabilities 응답
{
  "0x2105": {
    "paymasterService": { "supported": true }
  }
}
```

#### 5. Stub 데이터 요구사항 (중요)

표준에서 명시하는 stub 데이터 규칙:

1. **동일 길이**: stub 데이터는 최종 데이터와 **동일한 바이트 길이**여야 함 (`preVerificationGas` 정확도를 위해)
2. **제로 바이트 수**: stub 의 제로 바이트(`0x00`) 수는 최종 데이터 이하여야 함
3. **동일 코드 경로**: stub 이 `validatePaymasterUserOp` / `postOp` 에서 최종 데이터와 **동일한 실행 경로**를 유발해야 함 (가스 추정 정확도를 위해)

#### 6. 보안 권장사항

표준에서 권장하는 보안 패턴:

```
dApp Backend (proxy)
├── API 키를 안전하게 보관
├── 추가 시뮬레이션/검증 수행 가능
└── Wallet 에는 Backend URL 만 노출

dApp → Backend → Paymaster Service (API 키 포함)
```

- Paymaster 서비스 URL 에 포함된 API 키가 Wallet 에 노출되지 않도록 **Backend proxy** 사용 권장

---

## EntryPoint v0.9 변경사항 (v0.7 대비)

> **문서 이력**: 본 문서는 최초 EntryPoint v0.7 기준으로 작성되었으며, 아래 섹션은 v0.9 (StableNet PoC 현재 EntryPoint 버전) 에서의 변경사항과 ERC-7677 Paymaster 서비스에 미치는 영향을 정리합니다.
>
> v0.9 는 v0.7/v0.8 과 **ABI 하위 호환**입니다. 기존 v0.7 기반 코드는 수정 없이 v0.9 에서 동작합니다.

### 버전 변경 요약

| 전환 | 변경 사항 | 변경 이유 | Breaking? |
|------|----------|----------|-----------|
| **v0.7 → v0.8** | `userOpHash` 에 EIP-712 Typed Data 적용 | 하드웨어 지갑 blind signing 문제 해결 | **Yes** (해시 계산 변경) |
| **v0.8 → v0.9** | Block Number Mode 추가 | L2/DeFi 프로토콜의 block number 기반 유효성 지원 | No |
| **v0.8 → v0.9** | EIP-7702 네이티브 통합 | EOA → Smart Account 위임의 EntryPoint 레벨 지원 | No |
| **v0.8 → v0.9** | Paymaster Signature 분리 | Paymaster 서명을 userOpHash 에서 제외하여 독립 서명 가능 | No |
| **v0.8 → v0.9** | `delegateAndRevert()` 추가 | 오프체인 시뮬레이션용 dry-run 헬퍼 | No |
| **v0.8 → v0.9** | `getCurrentUserOpHash()` 추가 | AA-aware 컨트랙트가 현재 실행 중인 UserOp 해시 조회 가능 | No |

### 1. EIP-712 기반 userOpHash (v0.8 에서 도입, v0.9 유지)

**변경 전 (v0.7)**:
```solidity
// 단순 keccak256 해싱
userOpHash = keccak256(abi.encode(userOp, entryPoint, chainId))
```

**변경 후 (v0.8/v0.9)**:
```solidity
// EIP-712 Typed Data 해싱
bytes32 PACKED_USEROP_TYPEHASH = keccak256(
    "PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,"
    "bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"
);

// EIP-712 domain separator 포함
// DOMAIN_NAME = "ERC4337", DOMAIN_VERSION = "1"
userOpHash = _hashTypedDataV4(keccak256(abi.encode(PACKED_USEROP_TYPEHASH, ...)))
```

**ERC-7677 영향**:
- Paymaster 서비스가 `userOpHash` 를 직접 계산하는 경우 (예: VerifyingPaymaster 의 서명 생성), **반드시 EIP-712 방식**으로 계산해야 함
- `pm_getPaymasterData` 에서 서명 생성 시 v0.7 방식의 해시와 **호환되지 않음**
- paymaster-proxy 서비스의 signer 모듈이 EIP-712 해싱을 사용하는지 검증 필요

### 2. Block Number Mode (v0.9 신규)

**개요**: `validUntil` / `validAfter` 필드의 최상위 비트(bit 47)를 1로 설정하면, 타임스탬프 대신 **블록 넘버 기반** 유효성 검증을 수행합니다.

```solidity
// EntryPoint.sol 에 정의된 상수
uint48 constant VALIDITY_BLOCK_RANGE_FLAG = 0x800_000_000_000;  // bit 47
uint48 constant VALIDITY_BLOCK_RANGE_MASK = 0x7ff_fff_fff_fff;  // 하위 47비트

// 사용 예시
validAfter  = (1 << 47) | blockNumberStart;  // Block Number Mode ON
validUntil  = (1 << 47) | blockNumberEnd;
```

**제약 사항**:
- 동일 `validationData` 내에서 `validAfter` 와 `validUntil` **모두** bit 47 플래그가 설정되어야 Block Number Mode 가 활성화됨
- Account 의 `validationData` 와 Paymaster 의 `validationData` 는 **독립적으로 처리**됨 (서로 다른 모드를 사용해도 거부되지 않음)
- 즉, Account 은 timestamp 모드, Paymaster 는 block number 모드를 각각 사용할 수 있음

**사용 시나리오**:
- L2/Rollup 환경에서 시퀀서 지연으로 timestamp 가 부정확할 때
- DeFi 프로토콜 (Uniswap v3 TWAP, 거버넌스 투표) 에서 블록 기반 유효성이 필요할 때

**ERC-7677 영향**:
- Paymaster 서비스가 `validUntil`/`validAfter` 를 설정할 때, Block Number Mode 를 **인식하고 올바르게 인코딩**해야 함
- `pm_getPaymasterStubData` / `pm_getPaymasterData` 응답에서 반환하는 `paymasterData` 내부의 validity 필드가 Block Number Mode 를 사용할 수 있음
- Wallet 은 Block Number Mode 를 인식하고 사용자에게 올바른 유효 범위를 표시해야 함 (블록 번호 vs 시간)

**paymaster-proxy 영향**:

| 항목 | 현재 상태 | 필요 조치 |
|------|----------|----------|
| PaymasterDataLib Envelope | `validUntil`/`validAfter` 는 uint48 — bit 47 세팅 가능 | 구조 변경 불필요 |
| 정책 엔진 | 타임스탬프 기반 만료 로직 | Block Number Mode 분기 추가 필요 |
| Stub 데이터 | 타임스탬프 기반 | Block Number Mode 일 때 동일 모드로 stub 생성 필요 |

### 3. EIP-7702 네이티브 통합 (v0.9 신규)

**개요**: EntryPoint v0.9 는 EIP-7702 EOA 위임을 네이티브로 지원합니다.

```solidity
// Eip7702Support.sol
bytes3 constant EIP7702_PREFIX = 0xef0100;           // EOA 코드 프리픽스
bytes2 constant INITCODE_EIP7702_MARKER = 0x7702;    // initCode 마커

// initCode 형식
// 일반:  initCode = factory(20) || factoryCalldata
// 7702:  initCode = 0x7702 || optionalPayload
```

**핵심 함수**:

| 함수 | 용도 |
|------|------|
| `_isEip7702InitCode(initCode)` | initCode 가 `0x7702` 로 시작하는지 검사 |
| `_getEip7702Delegate(sender)` | sender 의 `0xef0100 + delegate` 코드에서 delegate 주소 추출 |
| `_getEip7702InitCodeHashOverride(userOp)` | 7702 계정의 대체 initCodeHash 계산 (userOpHash 에 사용) |

**이벤트**:
```solidity
event EIP7702AccountInitialized(
    bytes32 indexed userOpHash,
    address indexed sender,
    address indexed delegate
);
```

**ERC-7677 영향**:
- Paymaster 서비스는 EIP-7702 계정의 `initCode` 가 `0x7702` 로 시작하는 것을 **정상으로 인식**해야 함 (기존 factory 주소 추출 로직과 다름)
- 7702 계정의 `userOpHash` 계산이 일반 계정과 다름 (`initCodeHash` 에 delegate 주소 포함)
- `pm_getPaymasterStubData` 에서 7702 계정의 첫 UserOp 을 올바르게 처리해야 함

### 4. Paymaster Signature 분리 (v0.9 신규)

**개요**: v0.9 에서는 `paymasterAndData` 필드 끝에 **Paymaster 전용 서명**을 선택적으로 추가할 수 있습니다. 이 서명은 `userOpHash` 계산에서 **제외**되어, 사용자 서명과 독립적으로 생성/검증됩니다.

```
paymasterAndData 레이아웃 (v0.9 확장):

[기존 v0.7 레이아웃]
paymaster(20) || verificationGasLimit(16) || postOpGasLimit(16) || paymasterData

[v0.9 선택적 확장 — Paymaster Signature 추가 시]
paymaster(20) || verificationGasLimit(16) || postOpGasLimit(16) || paymasterData
   || paymasterSignature
   || uint16(paymasterSignature.length)
   || PAYMASTER_SIG_MAGIC (0x22e325a297439656)
```

**PAYMASTER_SIG_MAGIC**: `0x22e325a297439656` — `keccak256("PaymasterSignature")` 의 첫 8바이트

**동작 원리**:
1. `paymasterAndData` 끝 8바이트가 `PAYMASTER_SIG_MAGIC` 인지 확인
2. 매직 바로 앞 2바이트 = `paymasterSignature` 의 길이 (uint16)
3. 그 앞 `length` 바이트 = 실제 `paymasterSignature`
4. `userOpHash` 계산 시, `paymasterSignature` + length + magic 은 **제외**하되 magic 은 해시에 포함

```solidity
// UserOperationLib.sol
bytes8 constant PAYMASTER_SIG_MAGIC = 0x22e325a297439656;

// paymasterDataKeccak: signature 부분을 제외하고 해싱
// hash = keccak256(paymasterData_without_sig || PAYMASTER_SIG_MAGIC)
```

**ERC-7677 영향 — 매우 중요**:

| 항목 | v0.7 동작 | v0.9 변경 |
|------|----------|----------|
| **서명 위치** | `paymasterData` 내부에 서명 포함 (사용자가 서명 전 확정) | `paymasterSignature` 를 별도 suffix 로 분리 가능 |
| **서명 타이밍** | `pm_getPaymasterData` 에서 서명 포함하여 반환 → 사용자 서명 | Paymaster 가 사용자 서명 **이후에** 서명 추가 가능 |
| **userOpHash** | `paymasterAndData` 전체가 해시에 포함 | `paymasterSignature` 부분은 해시에서 제외 |
| **Stub 데이터** | stub 과 final 의 길이가 동일해야 함 | stub 에 dummy signature + magic suffix 포함 필요 |
| **`isFinal` 최적화** | 서명 없는 Paymaster (ERC20) 에만 적용 | 모든 Paymaster 가 Paymaster Signature 를 사용하면 `isFinal` 활용도 변경 |

**paymaster-proxy 영향**:

```
[v0.7 방식 - 현재 구현]
pm_getPaymasterStubData → stub paymasterData (65 byte zero signature 포함)
pm_getPaymasterData     → 서명된 paymasterData (ECDSA signature 포함)
사용자 서명              → signature 필드에 서명
Bundler 제출

[v0.9 방식 - Paymaster Signature 활용 시]
pm_getPaymasterStubData → stub paymasterData + dummy paymasterSignature suffix
pm_getPaymasterData     → paymasterData (서명 없이 반환 가능)
사용자 서명              → signature 필드에 서명
Paymaster 서명           → paymasterSignature suffix 추가 (사용자 서명 이후)
Bundler 제출
```

> **참고**: Paymaster Signature 분리는 **선택적** 기능입니다. 기존 v0.7 방식 (paymasterData 내부에 서명 포함) 도 v0.9 에서 계속 동작합니다. 두 방식의 혼용도 가능합니다.

### 5. 기타 v0.9 변경사항

#### 5.1 `delegateAndRevert(target, data)`

오프체인 시뮬레이션 전용 헬퍼. EntryPoint 에 delegatecall 하고 결과를 revert 로 반환합니다. state-override 가 불편한 환경에서 dry-run 테스트에 사용됩니다.

```solidity
error DelegateAndRevert(bool success, bytes ret);
function delegateAndRevert(address target, bytes calldata data) external;
```

#### 5.2 `getCurrentUserOpHash()`

AA-aware 컨트랙트 (예: Paymaster, Module) 가 현재 실행 중인 UserOp 의 해시를 조회할 수 있습니다. `transient storage` 를 사용하여 실행 컨텍스트 내에서만 유효합니다.

```solidity
function getCurrentUserOpHash() external view returns (bytes32);
```

#### 5.3 `PostOpReverted` 에러

```solidity
error PostOpReverted(bytes returnData);
```

`postOp` 실행 중 revert 발생 시, EntryPoint 가 이 에러를 emit 합니다. v0.6 에서는 `PostOpMode.postOpReverted` 로 Paymaster 를 재호출했으나, v0.7 이후 이중 postOp 호출 패턴이 폐지되었고, v0.9 에서는 **EntryPoint 가 내부적으로 처리**하고 Paymaster 를 재호출하지 않습니다.

#### 5.4 가스 상수 변경

| 상수 | 값 | 용도 |
|------|---|------|
| `INNER_GAS_OVERHEAD` | 10,000 | 내부 호출 가스 여유분 |
| `UNUSED_GAS_PENALTY_PERCENT` | 10% | 미사용 가스 패널티 |
| `PENALTY_GAS_THRESHOLD` | 40,000 | 패널티 면제 임계값 |

### v0.9 ABI 호환성 매트릭스

| 기능 | v0.6 | v0.7 | v0.8 | v0.9 | Breaking? |
|------|------|------|------|------|-----------|
| `PackedUserOperation` | - | ✅ | ✅ | ✅ | v0.7 only |
| EIP-712 `userOpHash` | - | - | ✅ | ✅ | v0.8 only |
| `PostOpMode` (2값 외부호출) | - | ✅ | ✅ | ✅ | v0.7 only |
| Block Number Mode | - | - | - | ✅ | No |
| EIP-7702 네이티브 | - | - | - | ✅ | No |
| Paymaster Signature (`PAYMASTER_SIG_MAGIC`) | - | - | - | ✅ | No |
| `delegateAndRevert()` | - | - | - | ✅ | No |
| `getCurrentUserOpHash()` | - | - | - | ✅ | No |

> **핵심**: v0.9 의 모든 신규 기능은 **하위 호환**입니다. 기존 v0.7 기반 Paymaster 코드와 ERC-7677 서비스는 수정 없이 v0.9 EntryPoint 에서 동작합니다. 신규 기능 활용 시에만 코드 수정이 필요합니다.

---

### 아키텍처 흐름 (ERC-7677 표준 기준)

```
┌──────────┐  wallet_sendCalls   ┌──────────┐  pm_getPaymaster*  ┌───────────────┐
│          │  (EIP-5792)         │          │  (ERC-7677)        │               │
│   dApp   │ ──────────────────► │  Wallet  │ ─────────────────► │  Paymaster    │
│          │  paymasterService   │  (Smart  │                    │  Web Service  │
│          │  capability 포함     │  Wallet) │ ◄───────────────── │  (off-chain)  │
└──────────┘                     └──────────┘                    └───────┬───────┘
                                      │                                  │
                                      │  eth_sendUserOperation           │
                                      ▼                                  │
                                 ┌──────────┐                    ┌──────┴────────┐
                                 │ Bundler  │                    │  Paymaster    │
                                 │          │ ──────────────────►│  (on-chain)   │
                                 └──────────┘  EntryPoint call   └───────────────┘
```

> **주의**: 원본 문서의 아키텍처 흐름에서 dApp 이 직접 Paymaster proxy 와 통신하는 것으로 표시되어 있으나,
> ERC-7677 표준에서는 **Wallet 이 Paymaster 서비스와 통신**하고, dApp 은 `wallet_sendCalls` 를 통해
> Paymaster 서비스 URL 을 전달하는 구조입니다. 단, API 키 보호를 위해 dApp Backend 를 proxy 로 사용하는
> 패턴도 표준에서 명시적으로 권장합니다.

### RPC 메서드 상세

#### `pm_getPaymasterStubData`

```typescript
// 요청 파라미터 [userOp, entryPoint, chainId, context]
type GetPaymasterStubDataParams = [
  {
    sender: `0x${string}`;
    nonce: `0x${string}`;
    initCode: `0x${string}`;          // v0.6
    callData: `0x${string}`;
    callGasLimit: `0x${string}`;
    verificationGasLimit: `0x${string}`;
    preVerificationGas: `0x${string}`;
    maxFeePerGas: `0x${string}`;
    maxPriorityFeePerGas: `0x${string}`;
  },
  `0x${string}`,                      // EntryPoint address
  `0x${string}`,                      // Chain ID (hex)
  Record<string, any>                 // Context (서비스 제공자 정의)
];

// 응답 (EntryPoint v0.7+ 기준, v0.9 포함)
type GetPaymasterStubDataResult = {
  sponsor?: { name: string; icon?: string };  // 스폰서 정보 (선택)
  paymaster?: string;                          // Paymaster 주소
  paymasterData?: string;                      // Paymaster 데이터
  paymasterVerificationGasLimit?: `0x${string}`;  // 검증 가스 (선택)
  paymasterPostOpGasLimit?: `0x${string}`;         // postOp 가스 (v0.7+ 필수)
  paymasterAndData?: string;                       // v0.6 전용 (통합 필드)
  isFinal?: boolean;                               // true 면 pm_getPaymasterData 생략 가능
};
```

**핵심 포인트**:
- `paymasterPostOpGasLimit` 은 v0.7+ 에서 **반드시** 반환해야 함 (Paymaster 가 지불하므로 Wallet 에 위임 불가)
- `paymasterVerificationGasLimit` 은 선택적 (Bundler 가 추정 가능하지만, Paymaster 서비스가 더 정확)
- Paymaster 서비스는 이 단계에서 **UserOp 을 검증하고 거부할 수 있음** (정책 위반 등)

> **v0.9 Stub 데이터 주의사항**: Paymaster Signature (`PAYMASTER_SIG_MAGIC`) 를 사용하는 경우, stub 데이터에도 동일한 길이의 dummy signature + uint16(length) + magic suffix (총 10 + signature.length 바이트) 를 포함해야 합니다. 이를 누락하면 `preVerificationGas` 추정이 부정확해집니다.

#### `pm_getPaymasterData`

```typescript
// 요청 파라미터: pm_getPaymasterStubData 와 동일
type GetPaymasterDataParams = [
  { /* unsigned UserOp */ },
  `0x${string}`,                      // EntryPoint
  `0x${string}`,                      // Chain ID
  Record<string, any>                 // Context
];

// 응답 (EntryPoint v0.7+ 기준, v0.9 포함)
type GetPaymasterDataResult = {
  paymaster?: string;                  // Paymaster 주소
  paymasterData?: string;              // 최종 서명된 Paymaster 데이터
  paymasterAndData?: string;           // v0.6 전용
};
```

**핵심 포인트**:
- UserOp 에 signature 가 **포함되지 않음** (사용자는 모든 필드 확정 후 서명)
- Paymaster 서비스는 EntryPoint 버전을 감지하고 올바른 필드를 반환해야 함 (MUST)
- `sponsor` 객체와 `isFinal` 은 이 응답에 포함되지 않음

> **v0.9 Paymaster Signature 분리 시 변경**: Paymaster Signature 를 분리하는 경우, `pm_getPaymasterData` 에서 반환하는 `paymasterData` 에 서명을 포함하지 **않을 수** 있습니다. 대신 Paymaster 가 사용자 서명 이후에 `paymasterSignature` suffix 를 별도로 추가합니다. 이 경우 Wallet 은 `paymasterData` 에 서명이 없는 상태로 사용자 서명을 받고, Paymaster (또는 Bundler) 가 최종 `paymasterSignature` 를 append 합니다.

---

## 프로젝트별 분석

### 1. erc7677-proxy (위치: `paymaster/erc7677-proxy/`)

**역할**: Pimlico Paymaster 서비스에 대한 ERC-7677 호환 JSON-RPC 프록시 서버 (최소 구현 템플릿)

**기술 스택**:
- Hono (웹 프레임워크)
- viem (이더리움 클라이언트)
- permissionless (Account Abstraction 유틸리티)
- Zod (스키마 검증)

**주요 기능**:
- JSON-RPC 요청 검증 및 라우팅
- 다중 체인 지원 (Chain ID 화이트리스트)
- EntryPoint 버전 관리 (0.6, 0.7, 0.8)
- Pimlico `validateSponsorshipPolicies` 연동
- EntryPoint 버전별 UserOp 스키마 분기 (Zod discriminated union)

**ERC-7677 준수 상태**:

| 기능 | 지원 여부 | 비고 |
|------|----------|------|
| `pm_getPaymasterStubData` | ✅ | Pimlico 에 위임 |
| `pm_getPaymasterData` | ✅ | Pimlico 에 위임 |
| EntryPoint v0.6/v0.7/v0.8 | ✅ | 스키마 분기 지원 (v0.9 는 v0.7/v0.8 ABI 호환으로 추가 작업 불필요) |
| `sponsor` 객체 | ❌ | 미구현 |
| `isFinal` 플래그 | ❌ | 미구현 |
| `paymasterService` capability | ❌ | Wallet 측 구현 사항 |
| Stub 데이터 길이 보장 | ⚠️ | Pimlico 에 위임 |
| Context 지원 | ✅ | `sponsorshipPolicyId` / `sponsorshipPolicyIds` |
| Chain ID 파라미터 | ✅ | 멀티체인 URL 지원 |

**현재 상태**: Pimlico Labs 의 오픈소스 템플릿 기반, Pimlico 서비스에 프록시로 동작

---

### 2. stable-platform paymaster-proxy (위치: `stable-platform/services/paymaster-proxy/`)

**역할**: StableNet 자체 Paymaster 서비스 (ERC-7677 확장 구현)

**주요 기능**:
- 4가지 Paymaster 타입 지원 (Verifying, Sponsor, ERC20, Permit2)
- 자체 ECDSA 서명 생성 (Pimlico 비의존)
- 정책 관리 (화이트리스트/블랙리스트, 일일 한도, 글로벌 한도)
- 비동기 정산 (reservation tracking, settlement worker)
- 토큰 결제 추정 (`pm_estimateTokenPayment`)
- 관리자 API (Bearer token 인증)

**ERC-7677 준수 상태**:

| 기능 | 지원 여부 | 비고 |
|------|----------|------|
| `pm_getPaymasterStubData` | ✅ | 4개 타입 모두 지원 |
| `pm_getPaymasterData` | ✅ | 4개 타입 모두 지원 |
| EntryPoint v0.7+ (v0.9 호환) | ✅ | Packed/Unpacked 양쪽 지원, v0.9 ABI 하위 호환 |
| `sponsor` 객체 | ✅ | `PAYMASTER_SPONSOR_NAME` 환경 변수 |
| `isFinal` 플래그 | ✅ | stub 응답에 `isFinal: false` 반환 |
| Context 파라미터 | ✅ | `paymasterType`, `policyId`, `tokenAddress`, `campaignId` 등 |
| Stub 데이터 길이 보장 | ✅ | 65 byte zero signature 로 길이 일치 |
| Chain ID 파라미터 | ✅ | 지원 |
| 추가 RPC 메서드 | ✅ | `pm_supportedTokens`, `pm_estimateTokenPayment`, `pm_getSponsorPolicy`, `pm_sponsorUserOperation` |

**확장 메서드** (ERC-7677 표준 외):

| 메서드 | 용도 |
|--------|------|
| `pm_supportedChainIds` | 지원 체인 목록 |
| `pm_supportedPaymasterTypes` | 구성된 Paymaster 타입 목록 |
| `pm_supportedTokens` | ERC-20 Paymaster 지원 토큰 목록 |
| `pm_estimateTokenPayment` | 토큰 결제 금액 추정 |
| `pm_getSponsorPolicy` | 스폰서 정책 적격성 확인 |
| `pm_sponsorUserOperation` | `pm_getPaymasterData` 의 호환 별칭 |

---

### 3. poc-contract (위치: `poc-contract/`)

**역할**: 온체인 스마트 컨트랙트

**Paymaster 구현체**:

| 구현체 | 파일 | 기능 |
|--------|------|------|
| **BasePaymaster** | `src/erc4337-paymaster/BasePaymaster.sol` | 공통 인프라 (validation, postOp, deposit 관리) |
| **VerifyingPaymaster** | `src/erc4337-paymaster/VerifyingPaymaster.sol` | 오프체인 ECDSA 서명 검증 기반 가스 스폰서링 |
| **ERC20Paymaster** | `src/erc4337-paymaster/ERC20Paymaster.sol` | ERC-20 토큰으로 가스비 지불 (Price Oracle 기반) |
| **SponsorPaymaster** | `src/erc4337-paymaster/SponsorPaymaster.sol` | Visa 4-Party 캠페인 기반 스폰서링 |
| **Permit2Paymaster** | `src/erc4337-paymaster/Permit2Paymaster.sol` | Uniswap Permit2 연동 가스리스 토큰 승인 |

**표준 지원**:
- ERC-4337 (Account Abstraction) — **EntryPoint v0.9**
- EIP-7702 (EOA → Smart Account 위임) — EntryPoint 네이티브 통합
- ERC-7579 (모듈러 스마트 계정)
- PaymasterDataLib: 25바이트 Envelope 헤더 + 타입별 Payload 포맷

**EntryPoint v0.9 전용 컴포넌트**:

| 파일 | 기능 |
|------|------|
| `src/erc4337-entrypoint/EntryPoint.sol` | v0.9 싱글톤 (Block Number Mode, EIP-712 해싱) |
| `src/erc4337-entrypoint/Eip7702Support.sol` | EIP-7702 delegate 감지/검증 라이브러리 |
| `src/erc4337-entrypoint/UserOperationLib.sol` | `PAYMASTER_SIG_MAGIC` 기반 Paymaster Signature 처리 |
| `src/erc4337-entrypoint/Helpers.sol` | `paymasterDataKeccak()` — Paymaster Signature 제외 해싱 |
| `src/erc4337-entrypoint/SenderCreator.sol` | 계정 배포 팩토리 위임 |

**데이터 인코딩** (`PaymasterDataLib.sol`):

```
Envelope (25-byte header + variable payload):
[0]     version (0x01)
[1]     paymasterType (0=Verifying, 1=Sponsor, 2=ERC20, 3=Permit2)
[2]     flags
[3:9]   validUntil (uint48)
[9:15]  validAfter (uint48)
[15:23] nonce (uint64)
[23:25] payloadLen (uint16)
[25:]   payload (타입별 인코딩)
[25+len:] signature (Verifying/Sponsor 에만 해당)
```

---

### 4. stable-platform (위치: `stable-platform/`)

**역할**: 플랫폼 서비스 및 프론트엔드 애플리케이션

**관련 컴포넌트**:

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| **Web DApp** | `apps/web/` | 사용자 인터페이스, UserOp 생성, 지갑 연결 |
| **Wallet Extension** | `apps/wallet-extension/` | 키 관리, 서명, EIP-7702 인증 |
| **Bundler** | `services/bundler/` | UserOp 수집, 검증, 번들링, EntryPoint 전송 |
| **Paymaster-Proxy** | `services/paymaster-proxy/` | ERC-7677 호환 Paymaster 서비스 |

---

## 두 프록시의 비교 및 역할 구분

### erc7677-proxy vs paymaster-proxy

| 관점 | erc7677-proxy | paymaster-proxy |
|------|---------------|-----------------|
| **위치** | `paymaster/erc7677-proxy/` | `stable-platform/services/paymaster-proxy/` |
| **성격** | Pimlico 프록시 (템플릿) | 자체 Paymaster 서비스 (프로덕션) |
| **Paymaster 타입** | 1개 (Pimlico 위임) | 4개 (Verifying, Sponsor, ERC20, Permit2) |
| **RPC 메서드** | 2개 (표준만) | 7개+ (표준 + 확장) |
| **서명** | Pimlico 위임 | 자체 ECDSA 서명 |
| **정책 관리** | Pimlico 정책 ID | 자체 정책 (화이트리스트, 한도 관리) |
| **정산** | 없음 (Pimlico 가 처리) | 비동기 reservation/settlement |
| **토큰 결제** | 미지원 | ERC-20, Permit2 지원 |
| **EntryPoint 버전** | v0.6, v0.7, v0.8 | v0.7 (Packed/Unpacked), v0.9 호환 (ABI 동일) |
| **코드량** | ~600 LOC | ~4,000+ LOC |
| **용도** | 외부 서비스 연동 참고/학습 | StableNet 프로덕션 |

### 권장 전략

```
┌──────────────────────────────────────────────────────────────────┐
│                      StableNet 권장 구조                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐  wallet_sendCalls   ┌──────────────────┐           │
│  │  dApp   │ ──────────────────► │  Wallet          │           │
│  │  (Web)  │  paymasterService:  │  Extension       │           │
│  │         │  {url, context}     │                  │           │
│  └─────────┘                     └────────┬─────────┘           │
│                                           │                      │
│                              pm_getPaymasterStubData             │
│                              pm_getPaymasterData                 │
│                                           │                      │
│                                           ▼                      │
│                              ┌────────────────────────┐         │
│                              │  paymaster-proxy       │         │
│                              │  (ERC-7677 + 확장)     │         │
│                              │                        │         │
│                              │  ├── Verifying 타입    │         │
│                              │  ├── Sponsor 타입      │         │
│                              │  ├── ERC20 타입        │         │
│                              │  └── Permit2 타입      │         │
│                              └──────────┬─────────────┘         │
│                                         │                        │
│                        ┌────────────────┼────────────────┐      │
│                        ▼                ▼                ▼      │
│               ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│               │ Verifying    │ │ ERC20        │ │ Sponsor    │ │
│               │ Paymaster    │ │ Paymaster    │ │ Paymaster  │ │
│               │ (on-chain)   │ │ (on-chain)   │ │ (on-chain) │ │
│               └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ │
│                      │                │               │         │
│                      └────────────────┼───────────────┘         │
│                                       ▼                          │
│                              ┌──────────────────┐               │
│                              │   EntryPoint     │               │
│                              │   (ERC-4337)     │               │
│                              └──────────────────┘               │
│                                                                  │
│  erc7677-proxy: Pimlico 외부 서비스 연동이 필요한 경우에만 사용   │
│  (학습/참고용 보관 또는 Pimlico fallback 용도)                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## ERC-7677 표준 대비 기존 문서의 오류 및 누락 사항

### 오류

| # | 항목 | 기존 문서 | 표준/실제 |
|---|------|----------|----------|
| 1 | **아키텍처 흐름** | dApp ↔ ERC7677-proxy ↔ Paymaster (on-chain) | 표준: dApp → Wallet → Paymaster Service → (Wallet → Bundler → EntryPoint → Paymaster on-chain). Wallet 이 중심 역할 |
| 2 | **stable-platform 상태** | "코드 없음, 문서만 존재" | 실제: `services/paymaster-proxy/` (4,000+ LOC), `services/bundler/`, `apps/web/`, `apps/wallet-extension/` 등 코드 존재 |
| 3 | **Paymaster 경로** | `src/paymaster/VerifyingPaymaster.sol` | 실제: `src/erc4337-paymaster/VerifyingPaymaster.sol` |
| 4 | **프로젝트명** | `stable-poc-contract` | 실제: `poc-contract` |
| 5 | **Paymaster 종류** | VerifyingPaymaster, ERC20Paymaster (2종) | 실제: + SponsorPaymaster, Permit2Paymaster, BasePaymaster (5종) |

### 누락

| # | 누락 항목 | 중요도 | 설명 |
|---|----------|--------|------|
| 1 | **EIP-5792 연동** (`paymasterService` capability) | **높음** | ERC-7677 의 핵심 — dApp 이 Wallet 에 paymaster URL 을 전달하는 표준 방식 |
| 2 | **`wallet_getCapabilities` 응답** | **높음** | Wallet 이 `paymasterService` 지원을 광고하는 방식 |
| 3 | **`isFinal` 플래그** | **높음** | stub 단계에서 최종 데이터 확정 가능 여부 (2단계 → 1단계 최적화) |
| 4 | **`sponsor` 객체** | 중간 | UI 에 스폰서 정보 표시 (name, icon) |
| 5 | **Stub 데이터 규칙** (동일 길이, 동일 코드 경로) | **높음** | 가스 추정 정확도에 직접 영향. 위반 시 bundler rejection 가능 |
| 6 | **보안 권장사항** (Backend proxy) | 중간 | API 키 보호를 위한 프록시 패턴 |
| 7 | **Chain ID 파라미터 설계 이유** | 낮음 | URL-per-chain vs 멀티체인 URL 설계 근거 |
| 8 | **paymaster-proxy 서비스** | **높음** | stable-platform 에 이미 구현된 4-type Paymaster 서비스 미언급 |
| 9 | **RPC 응답 상세 스펙** (v0.6/v0.7 분기) | 중간 | EntryPoint 버전별 다른 응답 필드 |
| 10 | **`preVerificationGas` 이슈** | 중간 | stub/final 데이터 크기 차이로 인한 가스 추정 오류 가능성 |
| 11 | **Paymaster 가 `pm_getPaymasterStubData` 에서 거부 가능** | 중간 | 정책 위반 시 이 단계에서 조기 거부 (SHOULD) |

---

## 다음 단계

### Phase 1: paymaster-proxy ERC-7677 완전 준수 ✅ (대부분 완료)

- [x] `pm_getPaymasterStubData` 구현
- [x] `pm_getPaymasterData` 구현
- [x] `sponsor` 객체 반환 지원
- [x] `isFinal` 플래그 반환
- [x] 4개 Paymaster 타입 라우팅
- [ ] `isFinal: true` 지원 (ERC20 타입에서 서명 불필요 시)
- [ ] Stub 데이터 길이 검증 테스트 (stub 길이 == final 길이)
- [ ] Stub 데이터 코드 경로 검증 테스트

### Phase 1.5: EntryPoint v0.9 대응 (신규)

- [ ] **EIP-712 userOpHash 검증**: paymaster-proxy signer 모듈이 v0.9 의 EIP-712 Typed Data 해싱을 사용하는지 확인
- [ ] **Block Number Mode 지원**: 정책 엔진에서 `validUntil`/`validAfter` 의 bit 47 플래그 인식 및 분기 처리
- [ ] **Paymaster Signature 분리 평가**: `PAYMASTER_SIG_MAGIC` 기반 서명 분리가 필요한 시나리오 검토
  - VerifyingPaymaster: 사용자 서명 이후 Paymaster 서명이 필요한 경우 유용
  - ERC20Paymaster: 서명 불필요 (`isFinal: true`) 이므로 해당 없음
- [ ] **Stub 데이터 Paymaster Signature suffix**: Paymaster Signature 사용 시 stub 에 dummy suffix 포함하여 길이 일치 보장
- [ ] **EIP-7702 initCode 처리**: `0x7702` 마커 initCode 를 정상으로 인식하는 검증 로직 추가
- [ ] **`getCurrentUserOpHash()` 활용 검토**: on-chain Paymaster 가 실행 중 UserOp 해시를 조회할 필요가 있는 시나리오 평가

### Phase 2: Wallet Extension EIP-5792 연동

- [ ] `wallet_getCapabilities` 에 `paymasterService: { supported: true }` 반환
- [ ] `wallet_sendCalls` 에서 `paymasterService` capability 파싱
- [ ] Wallet → paymaster-proxy 자동 통신 흐름 구현
- [ ] 사용자 UI 에 sponsor 정보 표시

### Phase 3: 기능 확장

- [ ] ERC-20 토큰 기반 가스비 정책 고도화
- [ ] 캠페인별 스폰서링 정책 (SponsorPaymaster 연동)
- [ ] 인증/인가 미들웨어 (Bearer token, JWT)
- [ ] 멀티체인 지원 (Chain ID 라우팅)

### Phase 4: 운영 준비

- [ ] Stub 데이터 규칙 준수 자동화 테스트
- [ ] 가스 추정 정확도 모니터링
- [ ] Paymaster deposit 잔액 모니터링 및 알림
- [ ] 정산 워커 안정성 테스트
- [ ] 모니터링 및 로깅 구성 (Prometheus 메트릭)

---

## 파일 구조

```
poc/
├── paymaster/
│   └── erc7677-proxy/                 # Pimlico 연동 ERC-7677 프록시 (템플릿)
│       ├── api/                       # Vercel serverless 함수
│       ├── src/
│       │   ├── app.ts                 # 메인 애플리케이션 + RPC 라우팅
│       │   ├── env.ts                 # 환경 변수
│       │   ├── providers.ts           # Pimlico 연동 (validateSponsorshipPolicies)
│       │   └── schemas/               # Zod 스키마 (v0.6/v0.7/v0.8 분기)
│       │       ├── rpc.ts             # JSON-RPC 2.0 기본 구조
│       │       ├── methods.ts         # pm_* 메서드 검증
│       │       ├── userop.ts          # UserOp 스키마 (EntryPoint 버전별)
│       │       ├── paymaster-context.ts  # Context 스키마
│       │       └── authorization.ts   # EIP-7702 인증 스키마
│       └── package.json
│
├── poc-contract/                      # 온체인 스마트 컨트랙트
│   ├── src/erc4337-entrypoint/        # EntryPoint v0.9
│   │   ├── EntryPoint.sol             # v0.9 싱글톤 (EIP-712, Block Number Mode)
│   │   ├── Eip7702Support.sol         # EIP-7702 네이티브 통합 라이브러리
│   │   ├── UserOperationLib.sol       # PAYMASTER_SIG_MAGIC, 해싱 유틸리티
│   │   ├── Helpers.sol                # paymasterDataKeccak (Paymaster Sig 제외 해싱)
│   │   ├── SenderCreator.sol          # 계정 배포 팩토리 위임
│   │   ├── StakeManager.sol           # 스테이킹/보증금 관리
│   │   ├── NonceManager.sol           # key-based nonce 관리
│   │   └── interfaces/
│   │       ├── IEntryPoint.sol        # EntryPoint 인터페이스 (delegateAndRevert 포함)
│   │       ├── IEntryPointSimulations.sol  # 시뮬레이션 인터페이스
│   │       ├── IPaymaster.sol         # Paymaster 인터페이스 (PostOpMode)
│   │       └── PackedUserOperation.sol  # v0.7+ 구조체 (v0.9 Paymaster Sig 주석 포함)
│   │
│   └── src/erc4337-paymaster/
│       ├── BasePaymaster.sol          # 공통 인프라 (validatePaymasterUserOp, postOp)
│       ├── VerifyingPaymaster.sol     # 오프체인 서명 검증 (가스 스폰서링)
│       ├── ERC20Paymaster.sol         # ERC-20 토큰 가스 결제 (Oracle 기반)
│       ├── SponsorPaymaster.sol       # 캠페인 기반 스폰서링 (Visa 4-Party)
│       ├── Permit2Paymaster.sol       # Uniswap Permit2 연동
│       ├── PaymasterDataLib.sol       # 표준 Envelope 인코더/디코더
│       ├── PaymasterPayload.sol       # 타입별 Payload 구조체
│       └── interfaces/
│           └── IPriceOracle.sol       # 가격 오라클 인터페이스
│
├── stable-platform/
│   ├── apps/
│   │   ├── web/                       # DApp 프론트엔드 (React/Next.js)
│   │   └── wallet-extension/          # 브라우저 지갑 확장
│   ├── services/
│   │   ├── paymaster-proxy/           # ERC-7677 호환 Paymaster 서비스
│   │   │   ├── src/
│   │   │   │   ├── app.ts             # 메인 앱 + RPC 라우팅
│   │   │   │   ├── handlers/          # RPC 핸들러 (stub, data, tokens, policy)
│   │   │   │   ├── signer/            # ECDSA 서명 생성
│   │   │   │   ├── policy/            # 정책 관리 (한도, 화이트리스트)
│   │   │   │   ├── settlement/        # 비동기 정산 (reservation, worker)
│   │   │   │   ├── schemas/           # Zod 검증 스키마
│   │   │   │   └── types/             # TypeScript 인터페이스
│   │   │   └── package.json
│   │   └── bundler/                   # ERC-4337 Bundler 서비스
│   └── docs/
│       └── claude/spec/
│           └── ERC7677_ANALYSIS.md    # 본 문서
│
└── docs/
    ├── ERCs/ERCS/erc-7677.md          # ERC-7677 표준 원문
    ├── ERC7677_ANALYSIS.md            # 이전 분석 문서
    └── ERC4337_EIP7702_COMPLETE_FLOW.md  # 전체 메시지 플로우 문서
```

---

## 참고 자료

- [ERC-7677 Specification](https://eips.ethereum.org/EIPS/eip-7677) — Paymaster Web Service Capability
- [EIP-5792 Specification](https://eips.ethereum.org/EIPS/eip-5792) — Wallet Call API (wallet_sendCalls)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337) — UserOperation 표준
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) — EOA → Smart Account 위임
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) — 모듈러 스마트 계정
- [Pimlico Documentation](https://docs.pimlico.io/) — erc7677-proxy 기반 서비스
- [permissionless.js](https://docs.pimlico.io/permissionless) — Account Abstraction 유틸리티
- [StableNet 전체 메시지 플로우](../../../docs/ERC4337_EIP7702_COMPLETE_FLOW.md) — ERC-4337 + EIP-7702 E2E 플로우
- [ERC-4337 기술 가이드](../../../docs/account-abstraction/ERC-4337-기술-가이드.md) — v0.6→v0.7→v0.8→v0.9 버전 변경 이력 포함

---

## 문서 변경 이력

| 날짜 | 변경 내용 | EntryPoint 버전 |
|------|----------|----------------|
| 최초 작성 | ERC-7677 분석 및 통합 가이드 | v0.7 기준 |
| 1차 수정 | 오류 5건 수정, 누락 11건 추가, paymaster-proxy 비교 추가 | v0.7 기준 |
| 2차 수정 | v0.9 변경사항 추가 (Block Number Mode, EIP-7702 네이티브, Paymaster Signature 분리, EIP-712 해싱) | v0.7 + **v0.9** |
