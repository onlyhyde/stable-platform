# ERC-4337 + EIP-7702 + ERC-7579 전체 메시지 흐름

> 한국어 번역본 (원문: ERC4337_EIP7702_COMPLETE_FLOW.md)

> StableNet POC — ERC-20 Token Transfer via Smart Account with Paymaster Gas Sponsorship

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [컴포넌트 맵](#2-컴포넌트-맵)
3. [0단계: EIP-7702 위임 설정](#3-0단계-eip-7702-위임-설정)
4. [1단계: UserOp 구성](#4-1단계-userop-구성)
5. [2단계: 번들러 제출 및 검증](#5-2단계-번들러-제출-및-검증)
6. [3단계: EntryPoint 검증 단계](#6-3단계-entrypoint-검증-단계)
7. [4단계: EntryPoint 실행 단계](#7-4단계-entrypoint-실행-단계)
8. [5단계: PostOp 및 Paymaster 정산](#8-5단계-postop-및-paymaster-정산)
9. [모듈 라이프사이클 참고](#9-모듈-라이프사이클-참고)
10. [자금 흐름 요약](#10-자금-흐름-요약)
11. [데이터 구조 참고](#11-데이터-구조-참고)
12. [에러 코드 참고](#12-에러-코드-참고)

---

## 1. 아키텍처 개요

### 시나리오

사용자는 **네이티브 코인(ETH)이 없지만**, **ERC-20 토큰(USDC)을** 다른 주소로 전송하고자 합니다. 가스 수수료는 **ERC20Paymaster**를 통해 USDC로 지불됩니다. 사용자의 EOA는 **EIP-7702** 위임을 통해 **Kernel Smart Account**로 업그레이드되어 있습니다.

### 참여 구성요소

| 구성요소 | 역할 | 위치 |
|-----------|------|----------|
| **DApp** | 거래 시작을 위한 Web UI | `stable-platform/apps/web/` |
| **Wallet Extension** | 키 관리, 서명 | `stable-platform/apps/wallet-extension/` |
| **Bundler** | UserOp 수집/검증/번들링 | `stable-platform/services/bundler/` |
| **Paymaster-Proxy** | 오프체인 paymaster 승인 | `stable-platform/services/paymaster-proxy/` |
| **EntryPoint** | 온체인 UserOp 오케스트레이터 | `poc-contract/src/erc4337-entrypoint/EntryPoint.sol` |
| **Kernel** | ERC-7579 스마트 계정 | `poc-contract/src/erc7579-smartaccount/Kernel.sol` |
| **ERC20Paymaster** | ERC-20을 가스 지불 수단으로 수용 | `poc-contract/src/erc4337-paymaster/ERC20Paymaster.sol` |
| **USDC** | ERC-20 토큰 컨트랙트 | `poc-contract/src/tokens/USDC.sol` |

### 상위 수준 흐름

```
User → DApp → Wallet (sign) → Paymaster-Proxy (approve) → Bundler (validate & bundle)
  → EntryPoint.handleOps (on-chain) → Kernel.validateUserOp → Paymaster.validatePaymasterUserOp
  → Kernel.executeUserOp → USDC.transfer → Paymaster.postOp (collect fee) → Bundler (compensate)
```

---

## 2. 컴포넌트 맵

### 온체인 컨트랙트

```
EntryPoint (ERC-4337 v0.7)
├── handleOps(PackedUserOperation[], beneficiary)
├── handleAggregatedOps(UserOpsPerAggregator[], beneficiary)
├── simulateHandleOp(...)
└── deposits mapping (paymaster/account balances)

Kernel (ERC-7579 스마트 계정, delegated via EIP-7702)
├── validateUserOp(userOp, userOpHash, missingFunds) → validationData
├── executeUserOp(userOp, userOpHash)
├── execute(ExecMode, executionCalldata)
├── installModule(type, module, initData)
├── fallback() → routes to installed fallback modules
└── Modules:
    ├── Validators (IValidator) — signature/policy verification
    ├── Executors (IExecutor) — external execution triggers
    ├── Hooks (IHook) — pre/post execution guards
    ├── Fallbacks — handle unknown selectors
    ├── Policies (IPolicy) — permission-based access control
    └── Signers (ISigner) — custom signature schemes

ERC20Paymaster
├── validatePaymasterUserOp(userOp, hash, maxCost) → (context, validationData)
├── postOp(mode, context, actualGasCost, feePerGas)
├── getTokenAmount(token, ethCost) → tokenAmount
└── oracle: IPriceOracle (ETH/token price feed)

USDC (ERC-20, 6 decimals)
├── transfer(to, amount) → bool
├── transferFrom(from, to, amount) → bool
├── approve(spender, amount) → bool
└── Modifiers: whenNotPaused, notBlacklisted
```

### 오프체인 서비스

```
Bundler (JSON-RPC)
├── eth_sendUserOperation(packedUserOp, entryPoint) → userOpHash
├── eth_estimateUserOperationGas(userOp, entryPoint) → gasEstimates
├── eth_getUserOperationByHash(hash) → userOp details
├── eth_getUserOperationReceipt(hash) → receipt
├── Validation Pipeline (6 phases)
├── Mempool (priority-sorted, per-sender nonce ordering)
└── BundleExecutor (batches ops every 4s, calls handleOps)

Paymaster-Proxy (JSON-RPC)
├── pm_getPaymasterStubData(userOp, ep, chainId, ctx) → stub paymasterData
├── pm_getPaymasterData(userOp, ep, chainId, ctx) → signed paymasterData
├── pm_supportedTokens(chainId) → token list
├── pm_estimateTokenPayment(userOp, ep, chainId, token) → cost estimate
├── pm_getSponsorPolicy(sender, chainId) → eligibility
├── Signer: ECDSA signing of paymaster envelopes
├── PolicyManager: spending limits, reservations
└── SettlementWorker: async receipt polling & settlement
```

---

## 3. 0단계: EIP-7702 위임 설정

### 목적

EOA의 코드가 Kernel 구현에 위임하도록 설정하여, 일반 EOA를 Kernel Smart Account로 전환합니다.

### 흐름

```
Step 0.1: DApp requests authorization signing
  DApp → Wallet Extension: wallet_signAuthorization({
      account: EOA_ADDRESS,
      contractAddress: KERNEL_IMPLEMENTATION,
      chainId: CHAIN_ID,
      nonce: CURRENT_TX_COUNT
  })

Step 0.2: Wallet creates and signs the authorization
  authorization = {
      chainId: bigint,
      address: KERNEL_IMPLEMENTATION,     // contract to delegate to
      nonce: bigint                       // current tx count of EOA
  }
  authorizationHash = keccak256(0x05 || rlp([chainId, address, nonce]))
  signature = ECDSA.sign(authorizationHash, privateKey)
  → Returns: { chainId, address, nonce, v, r, s }

Step 0.3: Relayer broadcasts EIP-7702 transaction
  sendTransaction({
      to: EOA_ADDRESS,
      data: '0x',
      authorizationList: [{ chainId, address: Kernel, nonce, v, r, s }]
  })

Step 0.4: EVM processes the authorization
  EOA.code = 0xef0100 || KERNEL_ADDRESS
  // All subsequent calls to EOA now execute Kernel's code
  // EOA retains its storage and balance
```

### 설정 이후: 모듈 설치

위임 후에는 Smart Account에 모듈을 설치해야 합니다:

```
Kernel.initialize(
    rootValidator,     // ValidationId: [0x01][ECDSAValidator address]
    hook,              // IHook: address(1) for no hook, or hook contract
    validatorData,     // bytes: ECDSA validator init data (owner address)
    hookData,          // bytes: hook init data
    initConfig         // bytes[]: additional module installations
)
```

### 핵심 컨트랙트

| 컨트랙트 | 기본 주소 (로컬) | 목적 |
|----------|------------------------|---------|
| Kernel Implementation | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | 스마트 계정 로직 |
| ECDSA Validator | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | 서명 검증 |
| Kernel Factory | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | 계정 배포 |
| EntryPoint | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | UserOp 오케스트레이션 |

---

## 4. 1단계: UserOp 구성

### Step 1.1: 내부 호출 인코딩 (USDC 전송)

```solidity
// Target: USDC contract
// Function: transfer(address to, uint256 amount)
innerCallData = abi.encodeWithSelector(
    0xa9059cbb,                  // IERC20.transfer.selector
    0xRecipientAddress,          // address to
    100_000_000                  // uint256 amount (100 USDC, 6 decimals)
)
```

### Step 1.2: Kernel Execute로 래핑 (ERC-7579)

```solidity
// ExecMode encoding:
// [callType:1][execType:1][unused:4][payload:22] = 32 bytes
ExecMode = 0x00000000...0000
//          ^SINGLE  ^DEFAULT

// executionCalldata for SINGLE mode:
executionCalldata = abi.encodePacked(
    address(USDC),       // target: 20 bytes
    uint256(0),          // value: 32 bytes (no ETH)
    innerCallData        // callData: variable length
)

// Final callData for the UserOp:
// Option A: Via executeUserOp (when hooks are present)
callData = abi.encodeWithSelector(
    Kernel.execute.selector,     // 0x61affe23 — execute(ExecMode, bytes)
    execMode,
    executionCalldata
)
// Note: EntryPoint wraps this inside executeUserOp(userOp, userOpHash) automatically
```

### Step 1.3: Paymaster-Proxy에서 Paymaster 데이터 조회

#### Stub 데이터 (가스 추정용)

```
Request:  pm_getPaymasterStubData(userOp, entryPoint, chainId, {
              paymasterType: 'erc20',
              tokenAddress: USDC_ADDRESS
          })

Response: {
    paymaster: ERC20_PAYMASTER_ADDRESS,
    paymasterData: <envelope with zero signature>,
    paymasterVerificationGasLimit: 100000,
    paymasterPostOpGasLimit: 80000,
    isFinal: false
}
```

#### 서명 데이터 (최종)

```
Request:  pm_getPaymasterData(userOp_with_gas, entryPoint, chainId, {
              paymasterType: 'erc20',
              tokenAddress: USDC_ADDRESS
          })

Internal:
  1. Encode Erc20Payload:
     { token: USDC, maxTokenCost: calculated, quoteId: oracleId }

  2. Create PaymasterDataLib.Envelope:
     { version: 1, paymasterType: 2 (ERC20), flags: 0,
       validUntil: now + 300s, validAfter: now - 60s,
       nonce: 0, payload: Erc20Payload }

Response: {
    paymaster: ERC20_PAYMASTER_ADDRESS,
    paymasterData: <encoded envelope>
}
```

#### PaymasterDataLib Envelope 형식 (25바이트 헤더 + 페이로드)

```
Offset  Size    Field
[0]     1       version (0x01)
[1]     1       paymasterType (0x02 = ERC20)
[2]     1       flags (0x00)
[3:9]   6       validUntil (uint48 timestamp)
[9:15]  6       validAfter (uint48 timestamp)
[15:23] 8       nonce (uint64)
[23:25] 2       payloadLen (uint16)
[25:]   var     payload (Erc20Payload encoded)
```

#### Erc20Payload 구조

```solidity
struct Erc20Payload {
    address token;         // USDC address
    uint256 maxTokenCost;  // Maximum USDC to spend on gas
    uint256 quoteId;       // Off-chain quote identifier
    bytes erc20Extra;      // Additional data
}
```

### Step 1.4: 전체 UserOp 조립

```
PackedUserOperation {
    sender:            EOA_ADDRESS (= Smart Account)
    nonce:             [mode:1][type:1][validatorId:20][key:2][seq:8]
                       [0x00 DEFAULT][0x01 VALIDATOR][ECDSAValidator addr][0x0000][sequence]
    initCode:          0x (already deployed via EIP-7702)
    callData:          execute(ExecMode, executionCalldata)
    accountGasLimits:  pack(verificationGasLimit=200000, callGasLimit=200000)
    preVerificationGas: 100000
    gasFees:           pack(maxPriorityFeePerGas=1gwei, maxFeePerGas=1gwei)
    paymasterAndData:  [ERC20Paymaster:20][verGas:16][postOpGas:16][envelope...]
    signature:         <ECDSA signature over userOpHash>
}
```

### Step 1.5: UserOp 서명

```
// Compute canonical hash
userOpHash = keccak256(abi.encode(
    keccak256(pack(sender, nonce, hashInitCode, hashCallData,
                   accountGasLimits, preVerificationGas, gasFees,
                   hashPaymasterAndData)),
    entryPoint,
    chainId
))

// Wallet signs the hash
signature = wallet.signMessage({ message: { raw: userOpHash } })

// For Kernel v3 with ECDSA Validator:
// The signature is used as-is (65 bytes: r || s || v)
```

### Step 1.6: UserOp 패킹 (v0.7 형식)

```
paymasterAndData = abi.encodePacked(
    ERC20Paymaster,                          // address: 20 bytes
    uint128(paymasterVerificationGasLimit),   // 16 bytes
    uint128(paymasterPostOpGasLimit),         // 16 bytes
    paymasterData                            // variable: envelope bytes
)

accountGasLimits = bytes32(
    uint256(verificationGasLimit) << 128 | uint256(callGasLimit)
)

gasFees = bytes32(
    uint256(maxPriorityFeePerGas) << 128 | uint256(maxFeePerGas)
)
```

---

## 5. 2단계: 번들러 제출 및 검증

### Step 2.1: 번들러에 제출

```
POST http://bundler:4337/
{
    "jsonrpc": "2.0",
    "method": "eth_sendUserOperation",
    "params": [packedUserOp, ENTRY_POINT_ADDRESS],
    "id": 1
}

Response: { "result": "0x<userOpHash>" }
```

### Step 2.2: 6단계 검증 파이프라인

```
Phase 1: Format Validation (in-process, ~1ms)
├── All required fields present and correct types
├── Gas limits > 0
├── Address format validation
└── Signature length check

Phase 2: Reputation Check (in-memory, ~1ms)
├── Check sender reputation:    status ∈ {OK, throttled, banned}
├── Check paymaster reputation: status ∈ {OK, throttled, banned}
├── Check factory reputation:   status ∈ {OK, throttled, banned}
└── Reject if any entity is banned

Phase 3: State Validation (RPC calls, ~100ms)
├── Nonce validation:
│   ├── Extract nonce key (upper 192 bits) and sequence (lower 64 bits)
│   ├── Fetch on-chain nonce via EntryPoint.getNonce(sender, key)
│   └── Verify: on-chain <= user sequence <= on-chain + maxGap(10)
├── Account existence:
│   └── Verify EOA has code (EIP-7702 delegation set)
└── Timestamp validity:
    └── Verify validUntil - now > 30 seconds (buffer)

Phase 4: Simulation (RPC, ~1-2s)
├── Call EntryPoint.simulateHandleOp(userOp, target, targetCallData)
│   ├── Runs full validation: account + paymaster
│   ├── Returns: preOpGas, prefund, accountValidationData, paymasterValidationData
│   └── Does NOT execute the actual call
└── Verify simulation succeeds (no revert)

Phase 5: Simulation Result Validation
├── Parse accountValidationData:
│   ├── aggregator (must be address(0) — no aggregator)
│   ├── validUntil (timestamp check)
│   └── validAfter (timestamp check)
├── Parse paymasterValidationData:
│   └── Same structure as account
└── Verify stake requirements if needed

Phase 6: Opcode Validation — ERC-7562 (RPC, ~1-2s)
├── Run debug_traceCall on the validation
├── Check for banned opcodes:
│   ├── SELFDESTRUCT
│   ├── CREATE/CREATE2 (except by factory)
│   └── DELEGATECALL (from sender)
└── Check storage access rules:
    ├── Account can only access own storage
    ├── Paymaster can only access own storage + account
    └── No access to other contracts' storage in validation
```

### Step 2.3: 멤풀 및 번들링

```
Mempool Management:
├── Add validated UserOp to mempool
│   ├── Enforce per-sender limit (default: 4 pending ops)
│   ├── Sort by gas price (priority)
│   └── Evict lowest price if mempool full (max: 10,000)
│
└── Bundle Execution (every 4 seconds):
    ├── getPendingForBundle(maxSize=25):
    │   ├── Group by sender
    │   ├── Sort each sender's ops by nonce (ascending)
    │   ├── Filter to consecutive nonce sequences only
    │   └── Flatten with priority ordering
    │
    ├── Pre-flight re-simulation (drop invalid)
    │
    └── Submit bundle:
        ├── Encode: EntryPoint.handleOps(ops[], beneficiary)
        ├── estimateGas() + 20% buffer
        ├── sendTransaction to EntryPoint
        ├── Mark all ops as 'submitted'
        └── Async: waitForReceipt → update status to 'included'/'failed'
```

---

## 6. 3단계: EntryPoint 검증 단계

모든 검증은 실행이 시작되기 전에 완료됩니다 (원자성 안전성).

### Step 3.1: handleOps 진입

```solidity
function handleOps(
    PackedUserOperation[] calldata ops,
    address payable beneficiary              // Bundler's fee recipient
) external nonReentrant

// For each UserOp:
//   1. _validatePrepayment(i, ops[i], opInfos[i])
//   2. _validateAccountAndPaymasterValidationData(...)
// Then: emit BeforeExecution()
// Then: execute all ops
```

### Step 3.2: _validatePrepayment

```
For each UserOp:

1. Copy to memory & compute hash
   userOpHash = keccak256(pack(fields) || entryPoint || chainId)

2. Calculate required prefund
   requiredGas = verificationGasLimit           // 200,000
               + callGasLimit                   // 200,000
               + paymasterVerificationGasLimit  // 100,000
               + paymasterPostOpGasLimit        // 80,000
               + preVerificationGas             // 100,000
               = 680,000
   requiredPrefund = 680,000 * maxFeePerGas     // 680,000 * 1 gwei = 0.00068 ETH

3. Validate Account
   → Call Kernel.validateUserOp() (see Step 3.3)

4. Validate & Increment Nonce
   → EntryPoint increments on-chain nonce

5. Validate Paymaster (if present)
   → Deduct requiredPrefund from Paymaster's deposit
   → Call ERC20Paymaster.validatePaymasterUserOp() (see Step 3.4)
   → Store returned context for postOp
```

### Step 3.3: Kernel.validateUserOp (스마트 계정 검증)

```
EntryPoint calls:
  Kernel.validateUserOp(userOp, userOpHash, missingAccountFunds)
  Gas limit: verificationGasLimit (200,000)

  ┌─────────────────────────────────────────────────────────────────┐
  │ Kernel.validateUserOp                                           │
  │                                                                 │
  │ 1. NONCE DECODING                                               │
  │    decodeNonce(userOp.nonce) →                                  │
  │    ├── validationMode = 0x00 (VALIDATION_MODE_DEFAULT)          │
  │    ├── validationType = 0x01 (VALIDATION_TYPE_VALIDATOR)        │
  │    └── validationId   = [0x01][ECDSAValidator address]          │
  │                                                                 │
  │ 2. VALIDATOR CONFIG LOOKUP                                      │
  │    config = validationConfig[validationId]                      │
  │    ├── nonce: uint32 (validator's nonce)                        │
  │    └── hook: IHook address                                      │
  │    require(config.hook != address(0))  // must be installed     │
  │                                                                 │
  │ 3. INTERNAL VALIDATION DISPATCH                                 │
  │    _validateUserOp(mode=DEFAULT, vId, userOp, userOpHash)       │
  │    │                                                            │
  │    └── VALIDATION_TYPE_VALIDATOR:                                │
  │        Call: IValidator(ecdsaValidator).validateUserOp(          │
  │            userOp,       // full PackedUserOperation             │
  │            userOpHash    // canonical hash                       │
  │        )                                                        │
  │        Returns: uint256 validationData                          │
  │        │                                                        │
  │        └── ECDSAValidator internally:                           │
  │            recovered = ecrecover(userOpHash, v, r, s)           │
  │            if (recovered == owner) return 0     // success      │
  │            else return 1                        // SIG_FAILED   │
  │                                                                 │
  │ 4. HOOK HANDLING                                                │
  │    if (config.hook != address(1)) {  // hook is installed       │
  │        executionHook[userOpHash] = config.hook                  │
  │        // Require callData uses executeUserOp selector          │
  │        require(callData.selector == 0x8dd7712f)                 │
  │    }                                                            │
  │                                                                 │
  │ 5. SELECTOR ACCESS CHECK                                        │
  │    targetSelector = bytes4(userOp.callData[4:8])                │
  │    require(allowedSelectors[validationId][targetSelector])       │
  │                                                                 │
  │ 6. MISSING FUNDS FORWARDING                                     │
  │    if (missingAccountFunds > 0) {                               │
  │        call{value: missingAccountFunds}(entryPoint, "")         │
  │    }                                                            │
  │    // With paymaster: missingAccountFunds = 0                   │
  │                                                                 │
  │ return validationData                                           │
  └─────────────────────────────────────────────────────────────────┘
```

#### 대체 검증 경로

**VALIDATION_MODE_ENABLE (실시간 validator 활성화)**:
```
When nonce encodes validationMode = 0x01 (ENABLE):
  1. Parse signature: [hook:20][enableData][enableSig][userOpSig]
  2. Compute EIP-712 enable digest
  3. Verify enableSig with root validator
  4. Install new validator + hook on-the-fly
  5. Configure selector access
  6. Continue with actual validation using new validator
```

**VALIDATION_TYPE_PERMISSION (권한 기반)**:
```
When validationType = 0x02 (PERMISSION):
  1. Check SKIP_USEROP flag in PermissionConfig
  2. For each Policy in permissionConfig[permissionId].policyData:
     → IPolicy(policy).checkUserOpPolicy(permissionId, userOp)
     → Each policy has its own signature segment: [idx:1][len:8][sig:var]
  3. ISigner(signer).checkUserOpSignature(permissionId, userOp, userOpHash)
  4. Merge all validationData via _intersectValidationData()
```

**VALIDATION_TYPE_7702 (EIP-7702 네이티브)**:
```
When validationType = 0x00 and detected as 7702:
  → ECDSA recovery against address(this)
  → Used for chain-agnostic signatures
```

### Step 3.4: ERC20Paymaster.validatePaymasterUserOp

```
EntryPoint calls:
  ERC20Paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost)
  Gas limit: paymasterVerificationGasLimit (100,000)

  ┌─────────────────────────────────────────────────────────────────┐
  │ ERC20Paymaster._validatePaymasterUserOp                         │
  │                                                                 │
  │ 1. PARSE PAYMASTER DATA                                         │
  │    paymasterData = userOp.paymasterAndData[52:]                 │
  │    // Skip: address(20) + verGas(16) + postOpGas(16)            │
  │                                                                 │
  │ 2. DECODE ENVELOPE                                              │
  │    env = PaymasterDataLib.decode(paymasterData)                 │
  │    require(env.paymasterType == 2)  // ERC20 type               │
  │                                                                 │
  │ 3. DECODE ERC20 PAYLOAD                                         │
  │    payload = PaymasterPayload.decodeErc20(env.payload)          │
  │    // { token: USDC, maxTokenCost: X, quoteId: Y }              │
  │                                                                 │
  │ 4. TOKEN SUPPORT CHECK                                          │
  │    require(supportedTokens[payload.token] == true)              │
  │                                                                 │
  │ 5. PRICE CALCULATION                                            │
  │    maxTokenCost = getTokenAmount(USDC, maxCost)                 │
  │                                                                 │
  │    getTokenAmount(token, ethCost):                              │
  │    ├── (price, updatedAt) = oracle.getPriceWithTimestamp(USDC)  │
  │    ├── require(block.timestamp - updatedAt <= 1 hour)           │
  │    └── return (ethCost * 10^decimals * (10000+markup))          │
  │           / (price * 10000)                                     │
  │                                                                 │
  │    Example:                                                     │
  │    ├── ethCost = 0.00068 ETH (requiredPrefund)                  │
  │    ├── price = 3e14 (0.0003 ETH per USDC)                      │
  │    ├── markup = 1000 (10%)                                      │
  │    └── maxTokenCost = (0.00068e18 * 1e6 * 11000)               │
  │                       / (3e14 * 10000) ≈ 2.49 USDC             │
  │                                                                 │
  │ 6. BALANCE & ALLOWANCE CHECK                                    │
  │    require(USDC.balanceOf(sender) >= maxTokenCost)              │
  │    require(USDC.allowance(sender, address(this)) >= maxTokenCost)│
  │                                                                 │
  │ 7. ENCODE CONTEXT (for postOp)                                  │
  │    context = abi.encode(                                        │
  │        sender,          // Smart Account address                │
  │        USDC,            // token address                        │
  │        maxTokenCost,    // max USDC to collect                  │
  │        maxCost          // max ETH cost                         │
  │    )                                                            │
  │                                                                 │
  │ 8. RETURN                                                       │
  │    validationData = _packValidationDataSuccess(                 │
  │        env.validUntil,  // expiration timestamp                 │
  │        env.validAfter   // activation timestamp                 │
  │    )                                                            │
  │    return (context, validationData)                             │
  └─────────────────────────────────────────────────────────────────┘
```

### Step 3.5: 검증 데이터 병합

```
EntryPoint._validateAccountAndPaymasterValidationData():
  ├── Parse account validationData:
  │   [aggregator:20][validUntil:6][validAfter:6]
  │   aggregator must be 0 (self-validated)
  │   validAfter <= block.timestamp <= validUntil
  │
  ├── Parse paymaster validationData:
  │   Same structure, same checks
  │
  └── If either fails: revert with AA22/AA32 (expired/not yet valid)
```

---

## 7. 4단계: EntryPoint 실행 단계

모든 UserOp 검증이 끝나면 `emit BeforeExecution()`를 발생시키고 각 작업을 실행합니다.

### Step 4.1: innerHandleOp

```
EntryPoint opens new call context via self-call:
  this.innerHandleOp(callData, opInfo, context)

  1. Gas check:
     gasleft() * 63/64 >= callGasLimit + postOpGasLimit + 10,000

  2. Special callData handling:
     If callData starts with IAccountExecute.executeUserOp.selector (0x8dd7712f):
       → Rewrite: abi.encodeCall(executeUserOp, (userOp, userOpHash))
       → This passes full UserOp context to the account

  3. Execute:
     call{gas: callGasLimit}(sender, rewrittenCallData)
     → Calls Kernel.executeUserOp(userOp, userOpHash)
```

### Step 4.2: Kernel.executeUserOp (훅 라이프사이클)

```
Kernel.executeUserOp(userOp, userOpHash)
  modifier: onlyEntryPoint

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │ 1. RETRIEVE HOOK                                                │
  │    hook = executionHook[userOpHash]                             │
  │    delete executionHook[userOpHash]  // consumed once           │
  │                                                                 │
  │ 2. PRE-HOOK                                                     │
  │    if (hook != address(0) && hook != address(1)) {              │
  │        hookContext = IHook(hook).preCheck(                      │
  │            msg.sender,           // EntryPoint address          │
  │            msg.value,            // 0                           │
  │            userOp.callData[4:]   // inner callData              │
  │        )                                                        │
  │        // Hook validates pre-conditions:                        │
  │        //   - spending limits                                   │
  │        //   - time restrictions                                 │
  │        //   - target whitelist                                  │
  │        // Returns context bytes for postCheck                   │
  │    }                                                            │
  │                                                                 │
  │ 3. DELEGATECALL TO SELF (execute inner callData)                │
  │    innerCallData = userOp.callData[4:]                          │
  │    // = execute(ExecMode, executionCalldata)                    │
  │                                                                 │
  │    (success, returnData) = address(this).delegatecall(          │
  │        innerCallData                                            │
  │    )                                                            │
  │    │                                                            │
  │    └── Kernel.execute(execMode, executionCalldata)              │
  │        │                                                        │
  │        │  modifier: onlyEntryPointOrSelfOrRoot                  │
  │        │  (self-call via delegatecall → allowed)                │
  │        │                                                        │
  │        ├── Root Hook Pre-Check (if applicable)                  │
  │        │   // Only for non-EntryPoint callers                   │
  │        │                                                        │
  │        ├── ExecLib.execute(execMode, executionCalldata)         │
  │        │   │                                                    │
  │        │   ├── Decode ExecMode:                                 │
  │        │   │   callType = CALLTYPE_SINGLE (0x00)                │
  │        │   │   execType = EXECTYPE_DEFAULT (0x00)               │
  │        │   │                                                    │
  │        │   ├── LibERC7579.decodeSingle(executionCalldata):      │
  │        │   │   target = USDC_ADDRESS                            │
  │        │   │   value  = 0                                       │
  │        │   │   data   = transfer(recipient, 100_000_000)        │
  │        │   │                                                    │
  │        │   └── Low-level call:                                  │
  │        │       call(gas, USDC_ADDRESS, 0, transferData, size)   │
  │        │       msg.sender = Smart Account (EOA)                 │
  │        │                                                        │
  │        │       ┌─────────────────────────────────────────┐      │
  │        │       │ USDC.transfer(recipient, 100_000_000)   │      │
  │        │       │                                         │      │
  │        │       │ 1. require(!paused)                     │      │
  │        │       │ 2. require(!blacklisted[msg.sender])    │      │
  │        │       │ 3. require(!blacklisted[recipient])     │      │
  │        │       │ 4. _balances[sender] -= 100_000_000     │      │
  │        │       │ 5. _balances[recipient] += 100_000_000  │      │
  │        │       │ 6. emit Transfer(sender, to, amount)    │      │
  │        │       │ 7. return true                          │      │
  │        │       └─────────────────────────────────────────┘      │
  │        │                                                        │
  │        └── Root Hook Post-Check (if applicable)                 │
  │                                                                 │
  │ 4. VERIFY SUCCESS                                               │
  │    require(success)  // revert entire executeUserOp if failed   │
  │                                                                 │
  │ 5. POST-HOOK                                                    │
  │    if (hook != address(0) && hook != address(1)) {              │
  │        IHook(hook).postCheck(hookContext)                       │
  │        // Hook validates post-conditions:                       │
  │        //   - balance changes within limits                     │
  │        //   - state transitions are valid                       │
  │        //   - no unexpected side effects                        │
  │        // Reverts if validation fails → entire UserOp reverts   │
  │    }                                                            │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 배치 실행 모드

UserOp가 여러 호출을 포함하는 경우 (ERC-7579 배치):

```solidity
// ExecMode: callType = CALLTYPE_BATCH (0x01)
// executionCalldata = abi.encode(Execution[])

struct Execution {
    address target;
    uint256 value;
    bytes callData;
}

// ExecLib iterates and executes each:
for (uint i = 0; i < executions.length; i++) {
    execute(executions[i].target, executions[i].value, executions[i].callData);
}
```

### Executor 모듈 흐름

Executor는 실행을 트리거할 수 있는 외부 컨트랙트입니다:

```
ExternalExecutor.trigger()
  → Kernel.executeFromExecutor(execMode, executionCalldata)
      1. Verify executor is installed (hook != 미설치)
      2. Set _EXECUTOR_CONTEXT_SLOT (prevent re-entry)
      3. Pre-hook: IHook(executorHook).preCheck(executor, value, data)
      4. ExecLib.execute(execMode, executionCalldata)
      5. Post-hook: IHook(executorHook).postCheck(context)
      6. Clear _EXECUTOR_CONTEXT_SLOT
      7. Return bytes[] results
```

### Fallback 모듈 흐름

Kernel에서 인식되지 않은 selector 호출 시 트리거됩니다:

```
SomeContract.call(Kernel, unknownSelector, data)
  → Kernel.fallback()
      1. Lookup: selectorConfig[msg.sig]
         → { hook, target (fallback module), callType }
      2. Require installed (hook != address(0))
      3. If hook == HOOK_ONLY_ENTRYPOINT: require msg.sender == EntryPoint
      4. Pre-hook (if hook is a contract)
      5. Execute:
         - CALLTYPE_SINGLE: target.call(msg.data ++ msg.sender)  // ERC-2771
         - CALLTYPE_DELEGATECALL: delegatecall(target, msg.data)
      6. Post-hook
      7. Return/revert result
```

---

## 8. 5단계: PostOp 및 Paymaster 정산

### Step 5.1: EntryPoint._postExecution

```
_postExecution(mode=opSucceeded, opInfo, context, actualGas)

  1. UNUSED GAS PENALTY
     executionGasUsed = preGas - gasleft()
     unusedGas = callGasLimit - executionGasUsed
     if (unusedGas > 40,000) {
         penalty = unusedGas * 10 / 100    // 10% penalty
         actualGas += penalty
     }

  2. DETERMINE GAS PRICE
     gasPrice = min(maxFeePerGas, maxPriorityFeePerGas + block.basefee)

  3. CALCULATE PRE-POSTOP COST
     actualGasCost = actualGas * gasPrice

  4. CALL PAYMASTER.POSTOP
     (if paymaster exists AND context.length > 0)
```

### Step 5.2: ERC20Paymaster.postOp

```
EntryPoint calls:
  ERC20Paymaster.postOp(mode, context, actualGasCost, gasPrice)
  Gas limit: paymasterPostOpGasLimit (80,000)

  ┌─────────────────────────────────────────────────────────────────┐
  │ ERC20Paymaster._postOp                                          │
  │                                                                 │
  │ 1. SKIP IF POST-OP REVERTED                                    │
  │    if (mode == PostOpMode.postOpReverted) return                │
  │                                                                 │
  │ 2. DECODE CONTEXT                                               │
  │    (sender, token, maxTokenCost, maxCost)                       │
  │    = abi.decode(context, (address, address, uint256, uint256))  │
  │                                                                 │
  │ 3. CALCULATE ACTUAL TOKEN COST (proportional)                   │
  │    actualTokenCost = (maxTokenCost * actualGasCost) / maxCost   │
  │                                                                 │
  │    Example:                                                     │
  │    ├── maxTokenCost = 2.49 USDC (2,490,000 units)              │
  │    ├── actualGasCost = 0.0003 ETH                               │
  │    ├── maxCost = 0.00068 ETH                                    │
  │    └── actualTokenCost = (2,490,000 * 0.0003) / 0.00068        │
  │                        ≈ 1,098,529 units ≈ 1.10 USDC           │
  │                                                                 │
  │    if (actualTokenCost == 0) actualTokenCost = 1 // minimum     │
  │                                                                 │
  │ 4. COLLECT TOKENS FROM USER                                     │
  │    USDC.transferFrom(                                           │
  │        sender,              // Smart Account (user's EOA)       │
  │        address(this),       // ERC20Paymaster                   │
  │        actualTokenCost      // ~1.10 USDC                      │
  │    )                                                            │
  │                                                                 │
  │    USDC contract internally:                                    │
  │    ├── require(!paused)                                         │
  │    ├── require(!blacklisted[sender])                            │
  │    ├── require(!blacklisted[paymaster])                         │
  │    ├── require(!blacklisted[msg.sender=EntryPoint])             │
  │    ├── require(allowance[sender][paymaster] >= amount)          │
  │    ├── _balances[sender]    -= actualTokenCost                  │
  │    ├── _balances[paymaster] += actualTokenCost                  │
  │    ├── _allowances[sender][paymaster] -= actualTokenCost        │
  │    └── emit Transfer(sender, paymaster, actualTokenCost)        │
  │                                                                 │
  │ 5. EMIT EVENT                                                   │
  │    emit GasPaidWithToken(sender, USDC, actualTokenCost,         │
  │                          actualGasCost)                          │
  └─────────────────────────────────────────────────────────────────┘
```

### Step 5.3: 최종 정산

```
Back in EntryPoint._postExecution:

  5. RECALCULATE FINAL GAS (including postOp gas)
     actualGas += (prePostOpGas - gasleft()) + postOpUnusedGasPenalty
     finalActualGasCost = actualGas * gasPrice

  6. REFUND PAYMASTER
     refund = prefund - finalActualGasCost
     deposits[ERC20Paymaster] += refund
     // Return unused ETH to paymaster's EntryPoint deposit

  7. EMIT EVENT
     emit UserOperationEvent(
         userOpHash,            // indexed
         sender,                // indexed (Smart Account)
         ERC20Paymaster,        // indexed
         nonce,
         success = true,
         finalActualGasCost,    // ETH gas cost
         actualGasUsed          // total gas units
     )

  8. ACCUMULATE FEES
     collected += finalActualGasCost
```

### Step 5.4: 번들러 보상

```
번들 내 모든 UserOp 처리가 완료되면:

  EntryPoint._compensate(beneficiary, collected)
    beneficiary.call{value: collected}("")

    // beneficiary = Bundler 수수료 수령 주소
    // collected = 모든 UserOp actualGasCost의 합
    // handleOps 트랜잭션에 사용된 Bundler 가스를 보전
```

---

## 9. 모듈 라이프사이클 참고

### 모듈 타입 및 호출 시점

| # | 모듈 타입 | 인터페이스 | 호출 시점 | 함수 시그니처 | 파라미터 | 반환값 |
|---|-------------|-----------|-------------|-------------------|------------|--------|
| 1 | **Validator** | `IValidator` | 검증 단계 (`validateUserOp`) | `validateUserOp(PackedUserOperation, bytes32)` | userOp, userOpHash | `uint256` validationData |
| 2 | **Validator** | `IValidator` | ERC-1271 서명 검증 | `isValidSignatureWithSender(address, bytes32, bytes)` | sender, hash, data | `bytes4` magic value |
| 3 | **Hook** | `IHook` | 실행 전 | `preCheck(address, uint256, bytes)` | msgSender, msgValue, msgData | `bytes` context |
| 4 | **Hook** | `IHook` | 실행 후 | `postCheck(bytes)` | context from preCheck | void |
| 5 | **Executor** | `IExecutor` | 외부 트리거 | `Kernel.executeFromExecutor(ExecMode, bytes)` 호출 | execMode, executionCalldata | `bytes[]` results |
| 6 | **Fallback** | Any | Kernel의 미등록 selector 호출 시 | `target.call(msg.data ++ msg.sender)` 또는 `delegatecall(msg.data)` | 원본 calldata | 전달된 결과 |
| 7 | **Policy** | `IPolicy` | 권한 검증 | `checkUserOpPolicy(bytes32, PackedUserOperation)` | permissionId, userOp | `uint256` validationData |
| 8 | **Policy** | `IPolicy` | 서명 정책 검증 | `checkSignaturePolicy(bytes32, address, bytes32, bytes)` | id, sender, hash, sig | `uint256` validationData |
| 9 | **Signer** | `ISigner` | 권한 서명 검증 | `checkUserOpSignature(bytes32, PackedUserOperation, bytes32)` | id, userOp, hash | `uint256` validationData |
| 10 | **Signer** | `ISigner` | 권한 기반 ERC-1271 검증 | `checkSignature(bytes32, address, bytes32, bytes)` | id, sender, hash, sig | `bytes4` magic value |

### 훅 부착 지점

```
1. Validator Hook:
   저장 위치: validationConfig[validationId].hook
   호출 시점: Kernel.executeUserOp()
   흐름: preCheck → delegatecall(execute) → postCheck

2. Root Validator Hook:
   저장 위치: validationConfig[rootValidator].hook
   호출 시점: Kernel.execute() modifier (onlyEntryPointOrSelfOrRoot)
   흐름: preCheck → ExecLib.execute() → postCheck

3. Executor Hook:
   저장 위치: executorConfig[executor].hook
   호출 시점: Kernel.executeFromExecutor()
   흐름: preCheck → ExecLib.execute() → postCheck

4. Fallback Hook:
   저장 위치: selectorConfig[selector].hook
   호출 시점: Kernel.fallback()
   흐름: preCheck → target.call/delegatecall → postCheck
```

### 훅 특수 값

| 주소 | 의미 | 동작 |
|---------|---------|----------|
| `address(0)` | 미설치 | 모듈/selector 미구성 상태, revert |
| `address(1)` | NO_HOOK | 모듈은 설치됨, hook 강제 없음 |
| `address(0xFFFF...FFFF)` | ONLY_ENTRYPOINT | EntryPoint만 해당 selector 호출 가능 |

### 모듈 설치

```solidity
// Validator installation
Kernel.installModule(
    MODULE_TYPE_VALIDATOR,  // type = 1
    validatorAddress,
    abi.encodePacked(
        hookAddress,        // IHook (20 bytes), address(1) = no hook
        validatorInitData,  // passed to validator.onInstall()
        hookInitData,       // passed to hook.onInstall()
        selectorData        // bytes4 selector to grant access to
    )
)

// Executor installation
Kernel.installModule(
    MODULE_TYPE_EXECUTOR,  // type = 2
    executorAddress,
    abi.encodePacked(
        hookAddress,        // IHook (20 bytes)
        executorInitData,   // passed to executor.onInstall()
        hookInitData        // passed to hook.onInstall()
    )
)

// Fallback installation
Kernel.installModule(
    MODULE_TYPE_FALLBACK,  // type = 3
    fallbackModuleAddress,
    abi.encodePacked(
        bytes4(selector),       // selector to handle
        hookAddress,            // IHook (20 bytes)
        callType,               // 0x00=SINGLE, 0xFF=DELEGATECALL
        selectorInitData,       // passed to module.onInstall()
        hookInitData
    )
)
```

---

## 10. 자금 흐름 요약

### UserOp 단위 정산

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FUND FLOW                                  │
│                                                                      │
│  ┌──────────────────────┐                                           │
│  │  User (Smart Account)│                                           │
│  │                      │                                           │
│  │  USDC: -100.00       │ ──── transfer ────> Recipient: +100.00    │
│  │  USDC: -1.10         │ ──── gas fee ─────> Paymaster: +1.10     │
│  │  ETH:   0.00         │ (no native coin needed!)                  │
│  └──────────────────────┘                                           │
│                                                                      │
│  ┌──────────────────────┐                                           │
│  │  ERC20Paymaster      │                                           │
│  │                      │                                           │
│  │  Deposit: -prefund   │ ──── locked by ───> EntryPoint            │
│  │  Deposit: +refund    │ <─── returned ────  EntryPoint            │
│  │  USDC:   +1.10       │ <─── gas fee ─────  User                  │
│  │                      │                                           │
│  │  Net: -0.0003 ETH    │                                           │
│  │       +1.10 USDC     │ (profit if USDC > gas cost)               │
│  └──────────────────────┘                                           │
│                                                                      │
│  ┌──────────────────────┐                                           │
│  │  Bundler             │                                           │
│  │                      │                                           │
│  │  ETH: -tx gas cost   │ ──── handleOps tx gas ──> Network         │
│  │  ETH: +collected     │ <─── compensate ────────  EntryPoint      │
│  │                      │                                           │
│  │  Net: small profit   │ (maxFeePerGas > actual gasPrice margin)   │
│  └──────────────────────┘                                           │
│                                                                      │
│  ┌──────────────────────┐                                           │
│  │  EntryPoint          │                                           │
│  │                      │                                           │
│  │  Intermediary only   │ Manages deposits, locks prefunds,         │
│  │  No profit/loss      │ refunds excess, compensates bundler       │
│  └──────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 가스 정산 공식

```
requiredPrefund = (verificationGasLimit + callGasLimit
                 + paymasterVerificationGasLimit + paymasterPostOpGasLimit
                 + preVerificationGas) × maxFeePerGas

actualGasPrice = min(maxFeePerGas, maxPriorityFeePerGas + block.basefee)

actualGasCost = totalGasUsed × actualGasPrice
              + unusedGasPenalty (10% of unused callGas if > 40k)
              + postOpUnusedGasPenalty (10% of unused postOp gas if > 40k)

refund = requiredPrefund - actualGasCost

actualTokenCost = (maxTokenCost × actualGasCost) / maxCost

bundlerCompensation = sum(actualGasCost for all UserOps in bundle)
```

---

## 11. 데이터 구조 참고

### PackedUserOperation

```
Field               Type        Encoding
─────────────────────────────────────────────────────────
sender              address     20 bytes
nonce               uint256     [validationMode:1][validationType:1]
                                [validatorId:20][nonceKey:2][sequence:8]
initCode            bytes       factory(20) + factoryData, or empty
callData            bytes       execute(ExecMode, executionCalldata)
accountGasLimits    bytes32     [verificationGasLimit:16][callGasLimit:16]
preVerificationGas  uint256     Bundle overhead gas
gasFees             bytes32     [maxPriorityFeePerGas:16][maxFeePerGas:16]
paymasterAndData    bytes       [paymaster:20][verGas:16][postOpGas:16][data...]
signature           bytes       ECDSA signature (65 bytes: r||s||v)
```

### ValidationData

```
Bits        Field           Values
────────────────────────────────────────────────
0-159       aggregator      0x0 = valid, 0x1 = sig failed, other = aggregator
160-207     validUntil      uint48 timestamp (0 = infinite)
208-255     validAfter      uint48 timestamp (0 = always valid)
```

### Nonce Encoding

```
Bits        Field
────────────────────────────────
0-7         ValidationMode    (0x00=DEFAULT, 0x01=ENABLE, 0x02=INSTALL)
8-15        ValidationType    (0x00=ROOT, 0x01=VALIDATOR, 0x02=PERMISSION)
16-175      ValidatorId       (20 bytes: validator address or permission id)
176-191     NonceKey          (2 bytes: additional key space)
192-255     Sequence          (8 bytes: sequential counter)
```

### ValidationId (21 bytes)

```
Byte 0      ValidationType
Bytes 1-20  Validator address (TYPE_VALIDATOR)
            or PermissionId (TYPE_PERMISSION)
            or Zero address (TYPE_ROOT/7702)
```

### ExecMode (32 bytes)

```
Byte 0      CallType      0x00=SINGLE, 0x01=BATCH, 0xFF=DELEGATECALL
Byte 1      ExecType      0x00=DEFAULT (revert), 0x01=TRY (allow failure)
Bytes 2-5   Selector      (reserved)
Bytes 6-31  Payload       (reserved)
```

---

## 12. 에러 코드 참고

### EntryPoint 에러 코드

| 코드 | 컴포넌트 | 설명 |
|------|-----------|-------------|
| AA13 | Factory | initCode 실패 또는 가스 부족 |
| AA14 | Factory | initCode가 잘못된 sender 반환 |
| AA15 | Factory | initCode가 코드를 배포하지 못함 |
| AA20 | Account | 계정 미배포(코드 없음) |
| AA21 | Account | prefund 미납 |
| AA22 | Account | 서명 만료 또는 아직 유효하지 않음 |
| AA23 | Account | validateUserOp revert |
| AA24 | Account | Aggregator 불일치 |
| AA25 | Account | nonce 유효하지 않음 |
| AA26 | Account | verificationGasLimit 초과 |
| AA31 | Paymaster | 예치금 부족 |
| AA32 | Paymaster | 서명 만료 또는 아직 유효하지 않음 |
| AA33 | Paymaster | validatePaymasterUserOp revert |
| AA34 | Paymaster | 서명 오류 |
| AA35 | Paymaster | 반환 데이터 형식 오류 |
| AA36 | Paymaster | paymasterVerificationGasLimit 초과 |
| AA94 | Gas | 가스 값이 uint120 범위 초과 |
| AA95 | Gas | handleOps 실행 중 가스 부족 |

### 번들러 RPC 에러 코드

| 코드 | 설명 |
|------|-------------|
| -32500 | EntryPoint 또는 Account에서 거부됨 |
| -32501 | Paymaster에서 거부됨 |
| -32502 | 금지된 opcode 감지 |
| -32503 | 데드라인이 너무 짧음 |
| -32504 | 엔터티가 차단 또는 스로틀링됨 |
| -32505 | 스테이크 부족 |
| -32506 | 지원되지 않는 aggregator |
| -32507 | 유효하지 않은 서명 |

---

## 부록: 사전 준비사항

이 흐름을 실행하기 전에 다음 항목이 준비되어야 합니다:

1. **EIP-7702 위임**: 사용자 EOA가 Kernel 구현으로 위임되어 있어야 함
2. **Kernel 초기화**: `Kernel.initialize()`가 루트 validator와 hook 설정으로 호출되어 있어야 함
3. **ECDSA Validator 설치**: 루트 validator의 owner가 사용자 EOA로 설정되어 있어야 함
4. **USDC 승인**: 사용자가 `USDC.approve(ERC20Paymaster, amount)`를 호출해 paymaster 수수료 징수를 허용해야 함
5. **Paymaster 예치금**: ERC20Paymaster가 `EntryPoint.depositTo(paymaster)`를 통해 EntryPoint에 충분한 ETH를 예치해야 함
6. **오라클 설정**: ERC20Paymaster에 USDC/ETH 변환용 유효 가격 오라클이 설정되어 있어야 함
7. **Bundler 실행**: Bundler 서비스가 동일 체인 및 EntryPoint에 연결되어 있어야 함
8. **Paymaster-Proxy 실행**: 올바른 paymaster 주소와 서명 키로 설정되어 있어야 함
