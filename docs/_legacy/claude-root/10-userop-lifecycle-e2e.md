# 10. ERC-4337 UserOp 전체 라이프사이클 (End-to-End)

## 목적

이 문서는 ERC-4337 **EntryPoint v0.9**의 UserOperation이 생성되어 온체인에서 실행될 때까지의
**전체 흐름**을 코드 레퍼런스와 함께 단계별로 정리한다.

> 이 프로젝트의 모든 코드(bundler, SDK, paymaster-proxy)는 **v0.9 기준**으로 작성되어 있다.
> v0.6/v0.7과의 차이점은 부록에서 다룬다.

**시나리오**: EOA `a`가 EIP-7702로 Kernel 컨트랙트에 위임된 상태에서,
Paymaster(sponsor)가 가스를 대납하고, Bundler를 통해 자산을 전송한다.

**인프라 구성**:

| 서비스 | 엔드포인트 |
|--------|-----------|
| go-stablenet (체인) | `http://localhost:8501` (chainId: 8283) |
| Bundler | `http://localhost:4337` |
| Paymaster Proxy | `http://localhost:4338` |
| EntryPoint | `0xEf6817fe73741A8F10088f9511c64b666a338A14` |
| 네이티브 코인 | WKRC (이더리움의 ETH에 해당) |

---

## 0. 사전 준비: Deposit & Stake

시스템이 동작하기 위해 EntryPoint 컨트랙트에 대한 사전 설정이 필요하다.

### 0-1. Paymaster → EntryPoint Deposit

Paymaster는 UserOp의 가스비를 대납하므로, EntryPoint에 WKRC를 예치해야 한다.

```solidity
// EntryPoint 컨트랙트
function depositTo(address account) external payable;
```

Paymaster가 `depositTo(paymasterAddress)` 호출 + WKRC value 전송.
handleOps 실행 시 EntryPoint가 이 deposit에서 가스비를 차감한다.

### 0-2. Paymaster → EntryPoint Stake

Bundler의 reputation system을 위해 Paymaster는 stake도 필요하다.

```solidity
function addStake(uint32 unstakeDelaySec) external payable;
```

일정 기간 lock되는 담보. 악의적 Paymaster가 무한 revert를 유발하는 것을 방지한다.

### 0-3. 각 참여자별 요구사항 요약

| 참여자 | EntryPoint Deposit | EntryPoint Stake | 자체 WKRC |
|--------|-------------------|-----------------|----------|
| **Paymaster** | 필수 (가스 대납 원천) | 필수 (reputation) | deposit/stake 전송에 필요 |
| **User (sender)** | 불필요 (Paymaster 사용 시) | 불필요 | 불필요 (Paymaster 대납) |
| **User (sender)** | 필요 (Paymaster 미사용 시) | 불필요 | 또는 계정에 충분한 WKRC |
| **Bundler** | 불필요 | 불필요 | 필수 (handleOps tx 가스비) |

### 0-4. Bundler의 가스비 환급 (beneficiary)

Bundler는 `handleOps(ops, beneficiary)` 트랜잭션을 자기 EOA로 보내므로 자체 WKRC가 필요하다.
`beneficiary` 주소(보통 Bundler EOA)로 EntryPoint가 가스 비용을 환급한다.

**환급의 원천은 누가 가스를 부담하느냐에 따라 다르다**:

| 시나리오 | 가스 비용 원천 | beneficiary 환급 |
|---------|--------------|-----------------|
| Paymaster가 대납 | Paymaster의 EntryPoint deposit에서 차감 | 차감된 금액이 beneficiary로 이전 |
| Sender가 직접 지불 | Sender의 EntryPoint deposit 또는 계정 잔액에서 차감 | 차감된 금액이 beneficiary로 이전 |

즉, Bundler가 외부 트랜잭션에 쓴 가스비를 **Paymaster deposit** 또는 **Sender deposit**에서
beneficiary로 보상받는 구조다. Bundler 자체는 EntryPoint에 deposit할 필요가 없다.

---

## 1. v0.9 PackedUserOperation 구조체

EntryPoint v0.9의 **정식(canonical) 데이터 구조**. RPC 전송, 온체인 handleOps, userOpHash 계산에
모두 이 형식을 사용한다.

> 코드 참조: `stable-poc-contract/lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol`

```solidity
struct PackedUserOperation {
    address sender;             // 스마트 계정 주소
    uint256 nonce;              // 리플레이 방지 (key:192bit + sequence:64bit)
    bytes   initCode;           // factory(20B) + factoryCalldata (계정 미배포 시)
    bytes   callData;           // 실행할 작업 인코딩
    bytes32 accountGasLimits;   // verificationGasLimit(16B) ‖ callGasLimit(16B)
    uint256 preVerificationGas; // 번들 처리 오버헤드 가스
    bytes32 gasFees;            // maxPriorityFeePerGas(16B) ‖ maxFeePerGas(16B)
    bytes   paymasterAndData;   // paymaster(20B) + pmVerifGas(16B) + pmPostOpGas(16B) + data
    bytes   signature;          // 계정 서명 (userOpHash 계산에 포함되지 않음)
}
```

### 1-1. 각 필드 상세

| 필드 | 타입 | 설명 |
|------|------|------|
| `sender` | address | UserOp을 실행할 스마트 계정 주소. EIP-7702 위임된 EOA 또는 CA |
| `nonce` | uint256 | EntryPoint가 관리하는 리플레이 방지 값. `uint192(key) ‖ uint64(sequence)` 구조 |
| `initCode` | bytes | 계정 미배포 시: `factory주소(20B) + factory.createAccount() calldata`. 이미 배포됐으면 `0x` |
| `callData` | bytes | 계정에서 실행할 작업. 예: `Kernel.execute(to, value, data)` 인코딩 |
| `accountGasLimits` | bytes32 | **검증용 가스 + 실행용 가스**를 16바이트씩 패킹. 상위=verificationGasLimit, 하위=callGasLimit |
| `preVerificationGas` | uint256 | Bundler의 번들 처리 오버헤드 (calldata 비용, 번들 관리 등) |
| `gasFees` | bytes32 | **EIP-1559 가스 가격**을 16바이트씩 패킹. 상위=maxPriorityFeePerGas, 하위=maxFeePerGas |
| `paymasterAndData` | bytes | Paymaster 사용 시: 주소 + **Paymaster용 가스 한도** + 서명/데이터. 아래 상세 |
| `signature` | bytes | User의 서명. Kernel v3: `0x02(1B) + ECDSA(65B)` = 66 bytes |

### 1-2. accountGasLimits 패킹

```
accountGasLimits (32 bytes = bytes32):
┌─────────────────────────┬─────────────────────────┐
│  verificationGasLimit   │     callGasLimit         │
│     (uint128, 16B)      │     (uint128, 16B)       │
└─────────────────────────┴─────────────────────────┘
 상위 128bit               하위 128bit
```

- **verificationGasLimit**: `validateUserOp` + `validatePaymasterUserOp` 실행에 사용
- **callGasLimit**: `executeUserOp` (실제 작업 실행)에 사용

### 1-3. gasFees 패킹

```
gasFees (32 bytes = bytes32):
┌─────────────────────────┬─────────────────────────┐
│  maxPriorityFeePerGas   │     maxFeePerGas         │
│     (uint128, 16B)      │     (uint128, 16B)       │
└─────────────────────────┴─────────────────────────┘
 상위 128bit               하위 128bit
```

### 1-4. paymasterAndData 내부 구조

Paymaster 미사용 시 `0x`. 사용 시:

```
paymasterAndData 바이트 레이아웃:
┌──────────────┬────────────────────────────┬─────────────────────┬──────────────────┐
│ paymaster    │ paymasterVerificationGas   │ paymasterPostOpGas  │ paymasterData    │
│ (address,20B)│ (uint128, 16B)             │ (uint128, 16B)      │ (가변 길이)       │
├──────────────┼────────────────────────────┼─────────────────────┼──────────────────┤
│ offset 0     │ offset 20                  │ offset 36           │ offset 52+       │
└──────────────┴────────────────────────────┴─────────────────────┴──────────────────┘
```

> 코드 참조 (언패킹 오프셋): `UserOperationLib.sol`
> ```solidity
> uint256 public constant PAYMASTER_VALIDATION_GAS_OFFSET = 20;
> uint256 public constant PAYMASTER_POSTOP_GAS_OFFSET = 36;
> uint256 public constant PAYMASTER_DATA_OFFSET = 52;
> ```

**스펙 정의 선택적 트레일러** (§19.3):

스펙은 `paymasterData` 뒤에 추가 선택적 필드를 정의한다:

```
paymasterAndData (full layout):
  paymaster(20B)
  ‖ paymasterVerificationGasLimit(16B)
  ‖ paymasterPostOpGasLimit(16B)
  ‖ paymasterData(가변)
  ‖ [optional] paymasterSignature(가변)
  ‖ [optional] uint16(paymasterSignature.length)
  ‖ [optional] PAYMASTER_SIG_MAGIC (0x22e325a297439656)
```

이 트레일러는 `paymasterSignature`를 `paymasterData`와 분리하여, Paymaster가 hash 계산 시 자신의 서명을 제외할 수 있게 한다. `PAYMASTER_SIG_MAGIC`(8바이트)이 끝에 존재하면 파서가 트레일러를 인식한다.

> 본 프로젝트의 Paymaster는 이 선택적 트레일러를 사용하지 않는다. `paymasterData`에 서명을 직접 포함하는 방식을 사용한다.

### 1-5. initCode 내부 구조

계정이 이미 배포됐으면 `0x`. 미배포 시:

```
initCode:
┌──────────────────┬─────────────────────────────────────┐
│ factory address  │ factory 호출 calldata                │
│ (20 bytes)       │ (가변 길이)                           │
└──────────────────┴─────────────────────────────────────┘
```

**EIP-7702 위임 계정의 경우**:
```
factory = 0x0000000000000000000000000000000000007702  (magic address)
factoryCalldata = Kernel 초기화 데이터
```

EntryPoint가 이 magic address를 감지하면 일반 factory 배포 대신 EIP-7702 authorization 검증 경로를 사용한다.

**일반 Kernel 계정의 경우**:
```
factory = KernelFactory 컨트랙트 주소
factoryCalldata = KernelFactory.createAccount(initializeData, salt) 인코딩
```

factoryCalldata 인코딩 상세:

```typescript
// packages/sdk-ts/accounts/src/kernel/kernelAccount.ts:121-127
factoryCalldata = encodeFunctionData({
  abi: KernelFactoryAbi,
  functionName: 'createAccount',
  args: [initializeData, salt],  // (bytes, bytes32)
})
```

KernelFactory.createAccount 시그니처:
```solidity
function createAccount(bytes calldata initData, bytes32 salt)
  external payable returns (address);
```

`initializeData`는 Kernel.initialize() 호출 인코딩:
```typescript
// packages/sdk-ts/accounts/src/kernel/utils.ts:108-119
initializeData = encodeFunctionData({
  abi: KernelAccountAbi,
  functionName: 'initialize',
  args: [
    rootValidator,        // 21 bytes: 0x01(MODULE_TYPE) + validator 주소
    hookAddress,          // address: 0x0 (hook 없음)
    validatorInitData,    // bytes: ECDSA 공개키 (owner)
    hookData,             // bytes: 0x
    initConfig,           // bytes[]: []
  ],
})
```

### 1-6. SDK 내부 표현 (Unpacked)

SDK와 Bundler 내부에서는 **개발 편의를 위해 필드를 분리한 Unpacked 표현**을 사용한다.
이것은 별도 버전이 아니라, **v0.9 PackedUserOperation을 분해한 것**이다.

```typescript
// services/bundler/src/types/index.ts:60-78
/**
 * UserOperation for ERC-4337 v0.9  ← v0.9 명시
 */
export interface UserOperation {
  sender: Address
  nonce: bigint
  factory?: Address                      // ← initCode에서 분리
  factoryData?: Hex                      // ← initCode에서 분리
  callData: Hex
  callGasLimit: bigint                   // ← accountGasLimits에서 분리
  verificationGasLimit: bigint           // ← accountGasLimits에서 분리
  preVerificationGas: bigint
  maxFeePerGas: bigint                   // ← gasFees에서 분리
  maxPriorityFeePerGas: bigint           // ← gasFees에서 분리
  paymaster?: Address                    // ← paymasterAndData에서 분리
  paymasterVerificationGasLimit?: bigint // ← paymasterAndData에서 분리
  paymasterPostOpGasLimit?: bigint       // ← paymasterAndData에서 분리
  paymasterData?: Hex                    // ← paymasterAndData에서 분리
  signature: Hex
}
```

> **v0.6과의 차이**: v0.6에는 `factory`/`factoryData` 분리가 없었고(단일 `initCode`),
> `paymasterVerificationGasLimit`/`paymasterPostOpGasLimit` 필드도 존재하지 않았다.
> 이 Unpacked 표현에 v0.9 전용 필드가 있으므로, v0.6과 혼동하지 않는다.

**Packed ↔ Unpacked 변환**:

| 변환 | 함수 | 위치 |
|------|------|------|
| Unpacked → Packed | `packUserOperation()` | `sdk-ts/core/src/utils/userOperation.ts:8-51` |
| Packed → Unpacked | `unpackUserOperation()` | `services/bundler/src/rpc/utils.ts:27-118` |

### 1-7. 총 Required Prefund 계산

EntryPoint가 실행 전에 확보해야 하는 총 가스 비용:

```solidity
// EntryPoint.sol:466-473
function _getRequiredPrefund(MemoryUserOp memory mUserOp)
  internal pure returns (uint256 requiredPrefund)
{
    uint256 requiredGas = mUserOp.verificationGasLimit
        + mUserOp.callGasLimit
        + mUserOp.paymasterVerificationGasLimit
        + mUserOp.paymasterPostOpGasLimit
        + mUserOp.preVerificationGas;

    requiredPrefund = requiredGas * mUserOp.maxFeePerGas;
}
```

---

## 2. UserOp 구성 시작

SDK의 `smartAccountClient.ts`가 v0.9 PackedUserOperation의 각 필드에 해당하는 값을 수집한다.
내부적으로는 Unpacked 표현을 사용하지만, 최종적으로 Packed format으로 변환하여 전송한다.

> 코드 참조: `packages/sdk-ts/core/src/clients/smartAccountClient.ts:98-137`

### 2-1. 초기 값 수집

| Packed 필드 | 초기 값 | 출처 |
|-------------|---------|------|
| `sender` | EOA 'a' 주소 | `account.address` |
| `nonce` | EntryPoint에서 조회 | `account.getNonce()` → `EntryPoint.getNonce(sender, key)` |
| `initCode` | factory + factoryData (미배포 시) | `account.getFactory()` + `account.getFactoryData()` |
| `callData` | Kernel.execute 인코딩 | `account.encodeCallData({ to, value, data })` |
| `accountGasLimits` | `0x` + `0x` (아직 0) | gas estimation 후 채움 |
| `preVerificationGas` | 0 (아직 0) | gas estimation 후 채움 |
| `gasFees` | maxPriorityFee + maxFee | `provider.getGasPrices()` |
| `paymasterAndData` | `0x` (아직 없음) | paymaster 요청 후 채움 |
| `signature` | `0x` (빈 값) | 마지막 단계에서 서명 |

### 2-2. callData 구성 예시 (WKRC 전송)

```typescript
const callData = account.encodeCallData({
  to: '0xRecipient...',
  value: parseEther('1.0'),  // 1 WKRC
  data: '0x',
})
// → Kernel.execute(to, value, data)로 ABI 인코딩됨
```

---

## 3. Paymaster Stub Data 요청 (1차)

**목적**: Gas estimation에 필요한 paymaster 정보를 미리 확보한다.
아직 정확한 가스 비용을 모르므로, 서명 없는 "stub" 데이터를 받는다.

```
Wallet SDK → Paymaster Proxy (localhost:4338)
RPC: pm_getPaymasterStubData
```

> 코드 참조: `packages/sdk-ts/core/src/clients/smartAccountClient.ts:141-152`

### 3-1. 요청

```typescript
const paymasterStubData = await paymaster.getPaymasterStubData(
  userOp,           // Unpacked format (SDK 내부 표현)
  entryPoint,       // '0xEf6817fe73741A8F10088f9511c64b666a338A14'
  chainId           // 8283n
)
```

### 3-2. Paymaster Proxy 내부 처리

> 코드 참조: `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts:128-146`

1. `chainId`, `entryPoint` 유효성 검증
2. `context.paymasterType` 확인 → sponsor / verifying / erc20 / permit2 라우팅
3. Policy 검사 (spending limit, allowlist 등)
4. **Stub paymasterData 생성** — payload 인코딩만, 서명 없음
5. Gas limit 추정 (base + overhead)

### 3-3. 응답

```typescript
{
  paymaster: '0xPaymasterAddress',
  paymasterData: '0x...',                    // stub (서명 없는 더미 데이터)
  paymasterVerificationGasLimit: '0x186a0',  // 100,000
  paymasterPostOpGasLimit: '0xc350',         // 50,000
  isFinal: false,                            // ← "아직 최종이 아님"
}
```

### 3-4. UserOp 상태 업데이트

이 응답으로 `paymasterAndData` 필드를 구성할 수 있게 된다:

```
paymasterAndData = paymaster(20B) + pmVerifGas(16B) + pmPostOpGas(16B) + paymasterData(stub)
```

이 시점: `paymasterAndData` stub 채움, `accountGasLimits`/`preVerificationGas` 아직 0, `signature` 없음.

---

## 4. Gas Estimation

**목적**: Bundler에게 UserOp 실행에 필요한 가스 한도를 추정받는다.

```
Wallet SDK → Bundler (localhost:4337)
RPC: eth_estimateUserOperationGas
```

> 코드 참조: `services/bundler/src/rpc/server.ts:411-443`

### 4-1. Packed Format으로 전송

Bundler RPC API는 **v0.9 PackedUserOperation**을 사용한다:

```json
{
  "jsonrpc": "2.0",
  "method": "eth_estimateUserOperationGas",
  "params": [
    {
      "sender": "0xa...",
      "nonce": "0x0",
      "initCode": "0x0000000000000000000000000000000000007702<factoryData>",
      "callData": "0x<Kernel.execute encoded>",
      "accountGasLimits": "0x00000000000000000000000000000000 00000000000000000000000000000000",
      "preVerificationGas": "0x0",
      "gasFees": "0x<maxPriorityFee 16B><maxFee 16B>",
      "paymasterAndData": "0x<paymaster 20B><pmVerifGas 16B><pmPostOpGas 16B><stubData>",
      "signature": "0xff...ff"
    },
    "0xEf6817fe73741A8F10088f9511c64b666a338A14"
  ]
}
```

> `signature`는 이 시점에서 더미값 (65바이트 0xff).
> `accountGasLimits`는 0으로 채워져 있음 (estimation 결과로 채울 예정).

### 4-2. Bundler 내부 처리

1. **Unpack**: Packed → Unpacked 변환 (내부 처리 편의)
2. **Gas Estimation**: `gasEstimator.estimate(userOp)`
   - `simulateValidation`을 **state override**로 실행 (EntryPointSimulations 바이트코드 주입)
   - binary search로 각 gas limit 추정

### 4-3. 응답 (Unpacked 개별 값)

```typescript
{
  preVerificationGas: '0xc350',               // 50,000
  verificationGasLimit: '0x30d40',            // 200,000
  callGasLimit: '0x30d40',                    // 200,000
  paymasterVerificationGasLimit: '0x186a0',   // 100,000 (paymaster 사용 시)
  paymasterPostOpGasLimit: '0xc350',          // 50,000 (paymaster 사용 시)
}
```

### 4-4. Packed 필드 업데이트

이 응답으로 다음 packed 필드를 구성한다:

```
accountGasLimits = pad(verificationGasLimit, 16B) ‖ pad(callGasLimit, 16B)
                 = pad(0x30d40, 16B) ‖ pad(0x30d40, 16B)

preVerificationGas = 0xc350

paymasterAndData의 [20-35] = pad(paymasterVerificationGasLimit, 16B)
paymasterAndData의 [36-51] = pad(paymasterPostOpGasLimit, 16B)
```

이 시점: `accountGasLimits`/`preVerificationGas`/`gasFees` 확정, `paymasterAndData` stub, `signature` 없음.

---

## 5. Paymaster Final Data 요청 (2차)

**목적**: Gas limit이 확정된 UserOp에 대해 Paymaster가 **실제 서명**을 포함한 최종 데이터를 생성한다.

```
Wallet SDK → Paymaster Proxy (localhost:4338)
RPC: pm_getPaymasterData
```

> 코드 참조: `packages/sdk-ts/core/src/clients/smartAccountClient.ts:169-180`

### 5-1. 왜 2번 호출하는가? (ERC-7677 표준)

Paymaster를 2번 호출하는 것은 **ERC-7677 표준**에서 정의한 패턴이다.

**Chicken-and-egg 문제**:
1. Gas estimation에는 `paymasterAndData`의 **크기**가 필요하다 (calldata 비용에 영향)
2. 정확한 `paymasterData` 생성에는 확정된 **gas limit**이 필요하다 (Paymaster가 서명할 대상)
3. 따라서 1차에서 크기가 맞는 stub을 받고 → gas estimation → 2차에서 실제 서명을 받는다

**ERC-4337 spec 자체**는 `paymasterAndData`에 인코딩된 데이터를 넣으라고만 정의한다.
**ERC-7677 spec**이 이 2-step 패턴(pm_getPaymasterStubData + pm_getPaymasterData)을 표준화했다.

> 이론적으로 gas limit을 미리 충분히 크게 잡고 1회 호출로 처리할 수도 있다.
> 하지만 그 경우 gas 추정이 부정확해지고, Paymaster가 실제 gas와 무관한 서명을 하게 되어
> 보안상 바람직하지 않다. ERC-7677의 2-step은 **정확성 + 보안**을 위한 것이다.

### 5-2. Paymaster Proxy 내부 처리

> 코드 참조: `services/paymaster-proxy/src/handlers/getPaymasterData.ts:121-171`

1. Policy 재검증 + spending reserve (TOCTOU race 방지)
2. `signer.generateSignedData(userOp, entryPoint, chainId, type, payload)`
   - **Paymaster의 개인키**로 서명 생성
3. `reservationTracker`에 기록 (정산 추적용)
4. 서명이 포함된 `paymasterData` 반환

### 5-3. 응답

```typescript
{
  paymaster: '0xPaymasterAddress',
  paymasterData: '0x...',    // ← 이번엔 Paymaster 서명 포함
  reservationId: '...',      // 정산 추적용 (optional)
}
```

### 5-4. Packed 필드 업데이트

`paymasterAndData`가 최종 확정된다:

```
paymasterAndData = paymaster(20B) + pmVerifGas(16B) + pmPostOpGas(16B) + paymasterData(서명 포함)
```

이 시점: 모든 필드 확정, **`signature`만 빠져있음**.

---

## 6. User 서명

모든 필드가 확정되었으므로 User가 서명한다.

> 코드 참조: `packages/sdk-ts/core/src/clients/smartAccountClient.ts:182-185`

### 6-1. 서명 시점

User 서명은 **반드시 마지막**에 수행한다. 이유:
- `userOpHash` 계산에 `paymasterAndData`가 포함되므로, Paymaster 최종 서명이 확정된 후에만 가능
- gas limit 변경도 hash에 영향을 주므로 (`accountGasLimits`, `preVerificationGas`), gas estimation 완료 후에만 가능
- `signature` 필드 자체만 hash에 포함되지 않음

### 6-2. userOpHash 계산

```typescript
const userOpHash = getUserOperationHash(userOp, entryPoint, chainId)
```

> 코드 참조: `packages/sdk-ts/core/src/utils/userOperation.ts:173-212`

#### Step 1: Packed 필드 구성 (내부 변환)

```typescript
const packed = packUserOperation(userOp)
// initCode           = factory + factoryData
// accountGasLimits   = pad(verificationGasLimit, 16B) ‖ pad(callGasLimit, 16B)
// gasFees            = pad(maxPriorityFeePerGas, 16B) ‖ pad(maxFeePerGas, 16B)
// paymasterAndData   = paymaster(20B) + pad(pmVerifGas, 16B) + pad(pmPostOpGas, 16B) + paymasterData
```

#### Step 2: structHash 계산

```typescript
const structHash = keccak256(encodeAbiParameters(
  [bytes32, address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32],
  [
    PACKED_USEROP_TYPEHASH,       // keccak256("PackedUserOperation(address sender,...)")
    sender,                        // address
    nonce,                         // uint256
    keccak256(packed.initCode),    // bytes → hash
    keccak256(packed.callData),    // bytes → hash
    packed.accountGasLimits,       // bytes32 (패킹된 가스 한도)
    preVerificationGas,            // uint256
    packed.gasFees,                // bytes32 (패킹된 가스 가격)
    keccak256(packed.paymasterAndData),  // bytes → hash ★ Paymaster 서명 포함
  ]
))
```

> TYPEHASH에 사용되는 타입 문자열:
> ```
> PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,
> bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)
> ```
> → v0.9의 Packed 필드명(`accountGasLimits`, `gasFees`, `paymasterAndData`)이 그대로 사용됨.

#### Step 3: domainSeparator 계산

```typescript
const domainSeparator = keccak256(encodeAbiParameters(
  [bytes32, bytes32, bytes32, uint256, address],
  [
    EIP712_DOMAIN_TYPEHASH,        // keccak256("EIP712Domain(string name,...)")
    keccak256("ERC4337"),          // name hash
    keccak256("1"),                // version hash
    8283n,                         // chainId
    entryPoint,                    // verifyingContract
  ]
))
```

#### Step 4: EIP-712 최종 해시 (0x1901 prefix)

```typescript
userOpHash = keccak256(concat(['0x1901', domainSeparator, structHash]))
```

**`0x1901`의 의미**:
- `0x19`: [EIP-191](https://eips.ethereum.org/EIPS/eip-191) 서명 데이터 prefix. "이것은 일반 트랜잭션이 아니라 서명용 구조화 데이터"임을 나타냄
- `0x01`: EIP-191의 version byte. `0x01` = [EIP-712](https://eips.ethereum.org/EIPS/eip-712) typed structured data
- 다른 version: `0x00` = data with intended validator, `0x45` = personal_sign

이 prefix는 EIP-712 spec에 고정되어 있으며, 모든 EIP-712 해시는 이 형식을 따른다:
```
hashTypedData = keccak256("\x19\x01" ‖ domainSeparator ‖ structHash)
```

> 코드 위치: `packages/sdk-ts/core/src/utils/userOperation.ts:211`

### 6-3. 실제 서명 코드

```typescript
// smartAccountClient.ts:182-185
const userOpHash = getUserOperationHash(userOp, account.entryPoint, BigInt(chain.id))
const signature = await account.signUserOperation(userOpHash)
userOp = { ...userOp, signature }
```

#### signUserOperation 내부 (Kernel ECDSA)

```typescript
// packages/sdk-ts/accounts/src/kernel/kernelAccount.ts:98-105
const signUserOperation = async (userOpHash: Hex): Promise<Hex> => {
  const signature = await validator.signHash(userOpHash)
  return signature
}
```

#### ECDSA Validator의 signHash

```typescript
// packages/sdk-ts/plugins/ecdsa/src/ecdsaValidator.ts:48-55
const signHash = async (hash: Hex): Promise<Hex> => {
  // viem의 signMessage로 raw hash에 직접 서명
  const signature = await signer.signMessage({
    message: { raw: hash },  // raw bytes로 서명
  })
  return signature  // 65 bytes: r(32) + s(32) + v(1)
}
```

> 온체인 ECDSAValidator는 dual-recovery 패턴을 사용하여
> raw EIP-712 서명과 EIP-191 wrapped 서명 **모두** 수용한다.

#### Kernel v3 서명 래퍼

Kernel v3에서는 어떤 validator를 사용하는지 식별하기 위해 prefix를 붙인다:

```typescript
// packages/sdk-ts/core/src/utils/userOperation.ts:268-274
export function signUserOpForKernel(rawSignature: Hex): Hex {
  return concat(['0x02', rawSignature]) as Hex
}
```

**최종 `signature` 필드 구성**:

| 바이트 | 내용 | 크기 |
|--------|------|------|
| `0x02` | Kernel v3 validation mode: ECDSA validator | 1 byte |
| rawSignature | ECDSA 서명 (r + s + v) | 65 bytes |
| **총합** | | **66 bytes** |

이 시점: PackedUserOperation의 **모든 9개 필드 완성**. Bundler에 전송 준비 완료.

---

## 7. Bundler에 전송

```
Wallet SDK → Bundler (localhost:4337)
RPC: eth_sendUserOperation
```

> 코드 참조: `services/bundler/src/rpc/server.ts:365-406`

### 7-1. RPC 요청 (v0.9 PackedUserOperation)

```json
{
  "jsonrpc": "2.0",
  "method": "eth_sendUserOperation",
  "params": [
    {
      "sender": "0xa...",
      "nonce": "0x0",
      "initCode": "0x0000000000000000000000000000000000007702<factoryData>",
      "callData": "0x<Kernel.execute encoded>",
      "accountGasLimits": "0x<verificationGasLimit 16B><callGasLimit 16B>",
      "preVerificationGas": "0xc350",
      "gasFees": "0x<maxPriorityFee 16B><maxFee 16B>",
      "paymasterAndData": "0x<paymaster 20B><pmVerifGas 16B><pmPostOpGas 16B><paymasterData>",
      "signature": "0x02<65-byte ECDSA signature>"
    },
    "0xEf6817fe73741A8F10088f9511c64b666a338A14"
  ]
}
```

- 첫 번째 파라미터: **v0.9 PackedUserOperation** (9개 필드)
- 두 번째 파라미터: **EntryPoint 주소**

---

## 8. Bundler 내부 처리

> 코드 참조: `services/bundler/src/rpc/server.ts:365-406`

### 8-1. Unpack (내부 처리용)

```typescript
const userOp = unpackUserOperation(packedOp)
```

Packed → Unpacked 변환. 검증과 시뮬레이션은 개별 필드로 수행한다.

### 8-2. userOpHash 계산 & 중복 검사

```typescript
const chainId = BigInt(await this.publicClient.getChainId())
const userOpHash = getUserOperationHash(userOp, matchedEntryPoint, chainId)

if (this.mempool.get(userOpHash)) {
  throw new RpcError('UserOperation already in mempool', ...)
}
```

### 8-3. Validation

```typescript
const validationResult = await this.validator.validate(userOp)
```

Validation은 3단계로 구성된다:

#### a) Format 검증 (EIP-4337 §7.1 MUST 규칙)

> 코드 참조: `services/bundler/src/validation/formatValidator.ts`

스펙이 정의하는 Bundler 수신 시 사전 검증 규칙:

| 규칙 | 스펙 §7.1 | 코드 위치 |
|------|-----------|-----------|
| sender 존재 확인 | sender에 코드가 있거나 initCode가 제공되어야 함 (둘 다 또는 둘 다 없음은 거부) | `formatValidator.ts:validateSenderAndFactory` |
| verificationGasLimit 상한 | < **500,000** gas MUST | `formatValidator.ts:315` (`VALIDATION_CONSTANTS.MAX_VERIFICATION_GAS`) |
| paymasterVerificationGasLimit 상한 | < **500,000** gas MUST | `formatValidator.ts:322` |
| preVerificationGas 최소값 | ≥ calldata cost + **50,000** overhead MUST | `formatValidator.ts:67` (`MIN_PRE_VERIFICATION_GAS: 21000n`) |
| callGasLimit 최소값 | ≥ non-zero value CALL 비용 MUST | `formatValidator.ts:62` (`MIN_CALL_GAS_LIMIT: 9000n`) |
| 수수료 최소값 | maxFeePerGas, maxPriorityFeePerGas > 설정 가능한 최소값 | `formatValidator.ts:70-76` |
| sender 중복 금지 | 번들 당 sender 1개 (staked sender 예외) | `bundleExecutor.ts:121-258` (`deduplicateSenders`) |

> 상한값 `500,000`은 스펙 원문에 숫자로 명시됨. Bundler는 `config/constants.ts:114`에서
> `MAX_VERIFICATION_GAS: 500_000n`으로 설정하며, 환경변수 `BUNDLER_MAX_VERIFICATION_GAS`로 조정 가능.

#### b) Reputation 검증
- sender, factory, paymaster의 평판 확인
- 과거에 revert를 많이 유발한 주소는 throttle/ban

#### c) Simulation 검증 (State Override)

> 코드 참조: `services/bundler/src/validation/simulationValidator.ts:110-160`

```typescript
const { data } = await this.publicClient.call({
  to: this.entryPoint,
  data: calldata,  // simulateValidation(packedOp)
  stateOverride: [{
    address: this.entryPoint,
    code: ENTRY_POINT_SIMULATIONS_BYTECODE,  // ← 코드만 교체, storage 유지
  }],
})
const result = decodeValidationResultReturn(data)
```

**State Override**: go-stablenet의 `eth_call`에서 EntryPoint 주소의 코드를
EntryPointSimulations bytecode로 메모리상 교체. storage는 유지. 온체인 변경 없음.

#### Simulation 결과: ValidationResult

`decodeValidationResultReturn(data)`가 반환하는 구조:

```typescript
// services/bundler/src/validation/types.ts:11-37
interface ValidationResult {
  returnInfo: {
    preOpGas: bigint                  // 검증에 소모된 가스
    prefund: bigint                   // 필요한 선입금 금액
    accountValidationData: bigint     // ← Account의 validateUserOp 반환값
    paymasterValidationData: bigint   // ← Paymaster의 validatePaymasterUserOp 반환값
    paymasterContext: Hex             // Paymaster → postOp으로 전달할 context
  }
  senderInfo:   { stake, unstakeDelaySec }  // sender의 stake 정보
  factoryInfo:  { stake, unstakeDelaySec }  // factory의 stake 정보
  paymasterInfo:{ stake, unstakeDelaySec }  // paymaster의 stake 정보
  aggregatorInfo?: { aggregator, stakeInfo } // aggregator 사용 시
}
```

#### validationData 패킹 형식

`accountValidationData`와 `paymasterValidationData`는 동일한 uint256 패킹 형식을 사용한다:

```
validationData (uint256, 32 bytes):
┌──────────────────────┬──────────────────┬──────────────────┐
│     authorizer       │   validUntil     │   validAfter     │
│  (address, 20 bytes) │ (uint48, 6 bytes)│ (uint48, 6 bytes)│
├──────────────────────┼──────────────────┼──────────────────┤
│  상위 160 bits       │  중간 48 bits    │  하위 48 bits    │
└──────────────────────┴──────────────────┴──────────────────┘
```

> 코드 참조: `services/bundler/src/validation/errors.ts:530-546`

```typescript
function parseValidationData(validationData: bigint): ParsedValidationData {
  const validAfter  = validationData & 0xffffffffffffn              // 하위 48 bits
  const validUntil  = (validationData >> 48n) & 0xffffffffffffn     // 중간 48 bits
  const aggregator  = validationData >> 96n                         // 상위 160 bits
  return { aggregator, validAfter, validUntil }
}
```

**각 필드의 의미**:

| 필드 | 값 | 의미 |
|------|-----|------|
| `authorizer` | `0x0` (= address(0)) | 서명 유효, aggregator 없음 |
| `authorizer` | `0x1` (= address(1)) | **SIG_VALIDATION_FAILED** — 서명 검증 실패 |
| `authorizer` | 그 외 주소 | 해당 주소가 aggregator 컨트랙트 |
| `validUntil` | 0 | 만료 없음 (무한) |
| `validUntil` | > 0 | 이 시점(unix timestamp)까지만 유효 |
| `validAfter` | 0 | 즉시 유효 |
| `validAfter` | > 0 | 이 시점(unix timestamp) 이후부터 유효 |

**Bundler의 검증**:

1. `authorizer == address(1)` → 서명 실패로 거부
2. `validUntil > 0 && validUntil <= now + 30초` → 곧 만료되므로 거부
3. `validAfter > now` → 아직 유효하지 않으므로 거부
4. Account와 Paymaster의 validationData를 **각각 독립적으로** 검증

> 코드 참조: `services/bundler/src/validation/errors.ts:569-609`

### 8-4. Mempool 추가 & 응답

```typescript
this.mempool.add(userOp, userOpHash, matchedEntryPoint)
return userOpHash  // bytes32 Hex string
```

---

## 9. Bundle 실행

Bundler가 주기적으로 mempool에서 UserOps를 꺼내 하나의 트랜잭션으로 묶어 체인에 제출한다.

> 코드 참조: `services/bundler/src/executor/bundleExecutor.ts`

### 9-1. handleOps 파라미터

```solidity
function handleOps(
  PackedUserOperation[] calldata ops,  // 번들된 v0.9 PackedUserOps
  address payable beneficiary          // 가스 환급 받을 주소 (보통 Bundler EOA)
) external;
```

### 9-2. EntryPoint 온체인 실행 순서

각 UserOp에 대해 순서대로:

```
1. _validatePrepayment
   ├→ sender가 미배포면 initCode로 배포 (factory 호출)
   ├→ sender.validateUserOp(userOp, userOpHash, missingAccountFunds)
   │   └→ Kernel이 서명 검증 (ECDSA Validator)
   │   └→ missingAccountFunds만큼 EntryPoint에 deposit
   └→ paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost)
       └→ Paymaster가 대납 의사 확인 + Paymaster 서명 검증

2. _executeUserOp
   └→ sender.executeUserOp(callData, ...)
       └→ Kernel이 callData를 실행 (예: WKRC 전송, 토큰 전송)

3. _postExecution
   └→ paymaster.postOp(mode, context, actualGasCost, actualUserOpFeePerGas)
       └→ Paymaster 후처리 (비용 정산, 토큰 수취 등)
       └→ mode: PostOpMode enum (아래 참조)
```

**PostOpMode enum** (스펙 §6):

```solidity
enum PostOpMode {
    opSucceeded,  // UserOp 실행 성공 — 정상 정산
    opReverted    // UserOp 실행 revert — Paymaster는 여전히 가스비 부담
}
```

- `opSucceeded`: callData 실행이 성공한 경우. Paymaster는 context 기반으로 정상 정산 수행.
- `opReverted`: callData 실행이 revert된 경우. **Paymaster는 여전히 가스비를 부담**하며, context 기반 후처리(예: ERC-20 토큰 수취)를 수행할 수 있다.
- `postOp`는 `context`가 비어있지 않은 경우에만 호출된다 (`validatePaymasterUserOp`에서 빈 context를 반환하면 postOp 미호출).
- v0.9 참조 구현은 내부적으로 `postOpReverted` (3번째 값)를 enum에 포함하지만, 이는 EntryPoint 내부 제어용이며 `paymaster.postOp()`에 전달되지 않는다. Paymaster 인터페이스 관점에서 유효한 값은 위 2개뿐이다.

> 참조: `spec/EIP-4337_스펙표준_정리.md` §6, `spec/EIP-4337_Paymaster_개발자_구현가이드.md` §3.2

```

4. 정산
   ├→ 실제 가스비 계산 (actualGas × gasPrice)
   ├→ 미사용 가스 페널티 가산 (아래 §9-4 참조)
   ├→ Paymaster deposit (또는 Sender deposit)에서 총 비용 차감
   ├→ 잔여 prefund를 Paymaster (또는 Sender)에게 환급
   └→ 누적된 총 비용을 beneficiary (Bundler EOA)에게 지급
```

### 9-4. 미사용 가스 페널티 (10% Penalty)

> 코드 참조: `stable-poc-contract/src/erc4337-entrypoint/EntryPoint.sol:1004-1013`

Bundler의 **가스 예약 공격**(gas griefing)을 방지하기 위한 메커니즘.
UserOp이 gas limit을 높게 잡아놓고 실제로는 적게 사용하면,
Bundler가 해당 가스를 예약하느라 다른 UserOp을 처리하지 못하는 문제가 발생한다.

**상수**:

```solidity
uint256 private constant UNUSED_GAS_PENALTY_PERCENT = 10;   // 10%
uint256 private constant PENALTY_GAS_THRESHOLD = 40000;      // 40,000 gas 이하는 면제
```

**계산 공식**:

```solidity
function _getUnusedGasPenalty(uint256 gasUsed, uint256 gasLimit) internal pure returns (uint256) {
    if (gasLimit <= gasUsed + PENALTY_GAS_THRESHOLD) {
        return 0;  // 미사용 가스가 40,000 이하면 페널티 없음
    }
    uint256 unusedGas = gasLimit - gasUsed;
    return (unusedGas * UNUSED_GAS_PENALTY_PERCENT) / 100;  // 미사용분의 10%
}
```

**적용 대상** (각각 독립적으로 계산):

| 대상 | gasLimit | gasUsed | 조건 |
|------|----------|---------|------|
| 실행 가스 | `callGasLimit` | 실행에 실제 소모된 가스 | 항상 적용 |
| postOp 가스 | `paymasterPostOpGasLimit` | postOp에 실제 소모된 가스 | Paymaster context가 있을 때만 |

**자금 흐름**:

```
1. actualGas = 실제 소모 가스
2. actualGas += callGas 페널티       ← 미사용분의 10%
3. actualGas += postOpGas 페널티     ← 미사용분의 10% (paymaster 사용 시)
4. actualGasCost = actualGas × gasPrice
5. refund = prefund - actualGasCost  ← 환급금이 페널티만큼 줄어듦
6. 환급금 → Paymaster deposit (또는 Sender deposit)
7. 총 비용(페널티 포함) → beneficiary (Bundler EOA)
```

**누가 내는가**: Paymaster가 있으면 **Paymaster의 deposit**, 없으면 **Sender의 deposit**에서 차감.
**누가 받는가**: **beneficiary** (Bundler EOA). 페널티는 실제 가스비와 함께 Bundler에게 지급된다.

**예시**: callGasLimit = 200,000, 실제 사용 = 50,000, gasPrice = 1 gwei

```
미사용 = 200,000 - 50,000 = 150,000 (> 40,000 threshold)
페널티 = 150,000 × 10% = 15,000 gas
추가 비용 = 15,000 × 1 gwei = 15,000 gwei
```

이 15,000 gas 분의 비용이 Paymaster/Sender의 환급금에서 빠져 Bundler에게 간다.

### 9-3. 이벤트

> **스펙 범위 참고**: ERC-4337 스펙은 이벤트 시그니처를 명시적으로 정의하지 않는다. 아래는 참조 구현(eth-infinitism v0.9) 기반 이벤트 목록이다. 상세는 `spec/EIP-4337_스펙표준_정리.md` §14 참조.

**핵심 이벤트** — 모든 UserOp 처리 후 발행:

```solidity
event UserOperationEvent(
  bytes32 indexed userOpHash,
  address indexed sender,
  address indexed paymaster,
  uint256 nonce,
  bool success,
  uint256 actualGasCost,
  uint256 actualGasUsed
);
```

**전체 이벤트 목록**:

| 이벤트 | 발행 시점 | 설명 |
|--------|-----------|------|
| `UserOperationEvent` | Settlement | 모든 UserOp 처리 결과 — 추적/영수증 조회의 기반 |
| `AccountDeployed` | Validation | initCode를 통한 신규 계정 배포 시 |
| `BeforeExecution` | Validation→Execution 경계 | 검증 완료 후 실행 진입 시그널 (시뮬레이션 시 활용) |
| `UserOperationRevertReason` | Execution | callData 실행 revert 시 사유 |
| `PostOpRevertReason` | Execution | postOp 호출 revert 시 사유 |
| `UserOperationPrefundTooLow` | Settlement | prefund가 실제 가스비보다 부족한 경우 |
| `IgnoredInitCode` | Validation | 이미 배포된 계정에 initCode 제공 시 무시됨 (v0.9) |
| `EIP7702AccountInitialized` | Validation | EIP-7702 delegate 초기화 완료 시 (v0.9) |

**이벤트 발행 순서**:

```
Validation Phase:
  ├→ [AccountDeployed]           (계정 미배포 시)
  ├→ [IgnoredInitCode]           (배포 계정에 initCode 제공 시)
  └→ [EIP7702AccountInitialized] (EIP-7702 초기화 시)

→ BeforeExecution                (항상 발행)

Execution Phase:
  ├→ [UserOperationRevertReason]  (callData revert 시)
  └→ [PostOpRevertReason]         (postOp revert 시)

Settlement Phase:
  ├→ [UserOperationPrefundTooLow] (prefund 부족 시)
  └→ UserOperationEvent           (항상 발행)
```

---

## 10. 서명 순서와 이유

### 10-1. 전체 타임라인

```
paymasterAndData 없음   stub 채움         gas limit 확정      pm 최종 서명 + user 서명
accountGasLimits 0      accountGasLimits 0  accountGasLimits 확정  모든 필드 완성
signature 없음          signature 없음      signature 없음        signature 채워짐
    │                      │                   │                      │
    ▼                      ▼                   ▼                      ▼
[UserOp 구성] → [pm_getStubData] → [eth_estimateGas] → [pm_getData] → [User 서명] → [eth_sendUserOp]
               (PM:4338)          (Bundler:4337)      (PM:4338)                    (Bundler:4337)
```

### 10-2. 왜 이 순서인가?

```
userOpHash = keccak256(0x1901 ‖ domainSeparator ‖ structHash)
                       ^^^^^^
                       EIP-191 + EIP-712 prefix

structHash에 포함되는 v0.9 packed 필드:
├── sender
├── nonce
├── keccak256(initCode)
├── keccak256(callData)
├── accountGasLimits         ← gas estimation 결과
├── preVerificationGas       ← gas estimation 결과
├── gasFees
└── keccak256(paymasterAndData)  ← Paymaster 서명 포함

structHash에 포함되지 않는 것:
└── signature  ← User 서명
```

1. `userOpHash`는 `paymasterAndData`를 포함하여 계산됨
2. Paymaster의 최종 서명이 `paymasterData`에 들어감 → `paymasterAndData`에 포함
3. 따라서 `paymasterAndData`가 확정되어야 `userOpHash`가 확정됨
4. `userOpHash`가 확정되어야 User가 서명 가능
5. **결론: Paymaster 서명 → User 서명** 순서가 필수

---

## 11. State Override 시뮬레이션 상세

Bundler가 UserOp을 검증할 때 사용하는 핵심 메커니즘.

### 11-1. 왜 필요한가?

EntryPoint v0.9에서 `simulateValidation` 함수는 **EntryPoint 자체에 존재하지 않는다**.
별도의 `EntryPointSimulations` 컨트랙트에만 있으며, 이 컨트랙트는 **온체인에 배포하지 않는다**.

### 11-2. 동작 방식

```
eth_call 요청:
  to: EntryPoint 주소
  data: simulateValidation(packedOp)
  stateOverride: [{
    address: EntryPoint 주소,
    code: EntryPointSimulations의 deployed bytecode
  }]

go-stablenet 내부:
  1. state DB 복사본 생성 (메모리)
  2. EntryPoint 주소의 code를 EntryPointSimulations bytecode로 교체
  3. storage는 그대로 유지 (deposit, nonce 등 원본 데이터)
  4. EVM 실행: simulateValidation이 EntryPoint storage를 읽으며 검증
  5. 결과 반환 (온체인 state 변경 없음)
```

### 11-3. Storage Layout 호환

```solidity
contract EntryPointSimulations is EntryPoint, IEntryPointSimulations {
    // EntryPoint를 상속 → storage layout 완전 동일
    // 추가 함수: simulateValidation, simulateHandleOp
}
```

---

## 부록 A. v0.6 vs v0.9 차이점

| 항목 | v0.6 | v0.9 |
|------|------|------|
| **Struct 이름** | `UserOperation` (11개 필드) | `PackedUserOperation` (9개 필드) |
| **Gas 필드** | 개별 uint256 (callGasLimit, verificationGasLimit, maxFeePerGas, maxPriorityFeePerGas) | bytes32로 패킹 (`accountGasLimits`, `gasFees`) |
| **Paymaster Gas** | `paymasterAndData`에 내장되지만 별도 gas limit 없음 | `paymasterAndData` 내에 pmVerifGas(16B) + pmPostOpGas(16B) 명시 |
| **Factory** | `initCode` 단일 필드 | 동일하지만, SDK에서 `factory`/`factoryData` 분리 관리 |
| **EIP-7702** | 미지원 | magic address `0x7702`로 지원 |
| **Simulation** | `simulateValidation` revert 기반 | state override + EntryPointSimulations normal return |
| **Calldata 효율** | 높은 비용 (많은 uint256 필드) | 낮은 비용 (bytes32 패킹) |

---

## 부록 B. 코드 레퍼런스 맵

| 단계 | 파일 | 라인 |
|------|------|------|
| UserOp 구성 | `packages/sdk-ts/core/src/clients/smartAccountClient.ts` | 98-137 |
| Paymaster stub 요청 | 상동 | 141-152 |
| Gas estimation 요청 | 상동 | 156-166 |
| Paymaster final 요청 | 상동 | 169-180 |
| User 서명 | 상동 | 182-185 |
| Bundler 전송 | 상동 | 188 |
| Pack 변환 (SDK) | `packages/sdk-ts/core/src/utils/userOperation.ts` | 8-51 |
| userOpHash 계산 (SDK) | 상동 | 173-212 |
| EIP-712 TypedData 빌더 | 상동 | 224-266 |
| Kernel 서명 래퍼 | 상동 | 272-273 |
| Kernel 계정 factory 처리 | `packages/sdk-ts/accounts/src/kernel/kernelAccount.ts` | 107-127 |
| Kernel 초기화 데이터 인코딩 | `packages/sdk-ts/accounts/src/kernel/utils.ts` | 108-119 |
| KernelFactory ABI | `packages/sdk-ts/core/src/abis/factory.ts` | - |
| EIP-7702 constants | `packages/sdk-ts/core/src/eip7702/constants.ts` | - |
| ECDSA validator signHash | `packages/sdk-ts/plugins/ecdsa/src/ecdsaValidator.ts` | 48-55 |
| Bundler types (v0.9) | `services/bundler/src/types/index.ts` | 60-93 |
| Bundler RPC: sendUserOp | `services/bundler/src/rpc/server.ts` | 365-406 |
| Bundler RPC: estimateGas | 상동 | 411-443 |
| Unpack 변환 (Bundler) | `services/bundler/src/rpc/utils.ts` | 27-118 |
| Pack 변환 (Bundler) | 상동 | 123-172 |
| userOpHash 계산 (Bundler) | 상동 | 208-247 |
| Simulation (state override) | `services/bundler/src/validation/simulationValidator.ts` | 110-160 |
| Paymaster stub handler | `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts` | 128-146 |
| Paymaster final handler | `services/paymaster-proxy/src/handlers/getPaymasterData.ts` | 59-78 |
| PackedUserOperation 구조체 | `stable-poc-contract/lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol` | - |
| UserOperationLib (언패킹) | `stable-poc-contract/lib/account-abstraction/contracts/core/UserOperationLib.sol` | - |
| EntryPointSimulations | `poc-contract/src/erc4337-entrypoint/EntryPointSimulations.sol` | - |
| go-stablenet state override | `go-stablenet/internal/ethapi/api.go` | 1022-1235 |
