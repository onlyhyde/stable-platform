# ERC-4337 + EIP-7702 + ERC-7579 Complete Message Flow

> StableNet POC — ERC-20 Token Transfer via Smart Account with Paymaster Gas Sponsorship

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Map](#2-component-map)
3. [Phase 0: EIP-7702 Delegation Setup](#3-phase-0-eip-7702-delegation-setup)
4. [Phase 1: UserOp Construction](#4-phase-1-userop-construction)
5. [Phase 2: Bundler Submission & Validation](#5-phase-2-bundler-submission--validation)
6. [Phase 3: EntryPoint Validation Phase](#6-phase-3-entrypoint-validation-phase)
7. [Phase 4: EntryPoint Execution Phase](#7-phase-4-entrypoint-execution-phase)
8. [Phase 5: PostOp & Paymaster Settlement](#8-phase-5-postop--paymaster-settlement)
9. [Module Lifecycle Reference](#9-module-lifecycle-reference)
10. [Fund Flow Summary](#10-fund-flow-summary)
11. [Data Structure Reference](#11-data-structure-reference)
12. [Error Code Reference](#12-error-code-reference)

---

## 1. Architecture Overview

### Scenario

A user with **no native coin (ETH)** wants to transfer their **ERC-20 token (USDC)** to another address. The gas fee is paid in USDC through an **ERC20Paymaster**. The user's EOA has been upgraded to a **Kernel Smart Account** via **EIP-7702** delegation.

### Participants

| Component | Role | Location |
|-----------|------|----------|
| **DApp** | Web UI for initiating transactions | `stable-platform/apps/web/` |
| **Wallet Extension** | Key management, signing | `stable-platform/apps/wallet-extension/` |
| **Bundler** | Collects, validates, bundles UserOps | `stable-platform/services/bundler/` |
| **Paymaster-Proxy** | Off-chain paymaster approval | `stable-platform/services/paymaster-proxy/` |
| **EntryPoint** | On-chain UserOp orchestrator | `poc-contract/src/erc4337-entrypoint/EntryPoint.sol` |
| **Kernel** | ERC-7579 Smart Account | `poc-contract/src/erc7579-smartaccount/Kernel.sol` |
| **ERC20Paymaster** | Accepts ERC-20 as gas payment | `poc-contract/src/erc4337-paymaster/ERC20Paymaster.sol` |
| **USDC** | ERC-20 token contract | `poc-contract/src/tokens/USDC.sol` |

### High-Level Flow

```
User → DApp → Wallet (sign) → Paymaster-Proxy (approve) → Bundler (validate & bundle)
  → EntryPoint.handleOps (on-chain) → Kernel.validateUserOp → Paymaster.validatePaymasterUserOp
  → Kernel.executeUserOp → USDC.transfer → Paymaster.postOp (collect fee) → Bundler (compensate)
```

---

## 2. Component Map

### On-Chain Contracts

```
EntryPoint (ERC-4337 v0.7)
├── handleOps(PackedUserOperation[], beneficiary)
├── handleAggregatedOps(UserOpsPerAggregator[], beneficiary)
├── simulateHandleOp(...)
└── deposits mapping (paymaster/account balances)

Kernel (ERC-7579 Smart Account, delegated via EIP-7702)
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

### Off-Chain Services

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

## 3. Phase 0: EIP-7702 Delegation Setup

### Purpose

Convert a regular EOA into a Kernel Smart Account by setting the EOA's code to delegate to the Kernel implementation.

### Flow

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

### Post-Setup: Module Installation

After delegation, the Smart Account needs modules installed:

```
Kernel.initialize(
    rootValidator,     // ValidationId: [0x01][ECDSAValidator address]
    hook,              // IHook: address(1) for no hook, or hook contract
    validatorData,     // bytes: ECDSA validator init data (owner address)
    hookData,          // bytes: hook init data
    initConfig         // bytes[]: additional module installations
)
```

### Key Contracts

| Contract | Default Address (Local) | Purpose |
|----------|------------------------|---------|
| Kernel Implementation | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | Smart account logic |
| ECDSA Validator | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | Signature verification |
| Kernel Factory | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | Account deployment |
| EntryPoint | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | UserOp orchestration |

---

## 4. Phase 1: UserOp Construction

### Step 1.1: Encode the Inner Call (USDC Transfer)

```solidity
// Target: USDC contract
// Function: transfer(address to, uint256 amount)
innerCallData = abi.encodeWithSelector(
    0xa9059cbb,                  // IERC20.transfer.selector
    0xRecipientAddress,          // address to
    100_000_000                  // uint256 amount (100 USDC, 6 decimals)
)
```

### Step 1.2: Wrap in Kernel Execute (ERC-7579)

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

### Step 1.3: Get Paymaster Data from Paymaster-Proxy

#### Stub Data (for gas estimation)

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

#### Signed Data (final)

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

#### PaymasterDataLib Envelope Format (25-byte header + payload)

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

#### Erc20Payload Structure

```solidity
struct Erc20Payload {
    address token;         // USDC address
    uint256 maxTokenCost;  // Maximum USDC to spend on gas
    uint256 quoteId;       // Off-chain quote identifier
    bytes erc20Extra;      // Additional data
}
```

### Step 1.4: Assemble the Complete UserOp

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

### Step 1.5: Sign the UserOp

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

### Step 1.6: Pack the UserOp (v0.7 Format)

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

## 5. Phase 2: Bundler Submission & Validation

### Step 2.1: Submit to Bundler

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

### Step 2.2: 6-Phase Validation Pipeline

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

### Step 2.3: Mempool & Bundling

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

## 6. Phase 3: EntryPoint Validation Phase

All validation completes before any execution begins (atomic safety).

### Step 3.1: handleOps Entry

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

### Step 3.3: Kernel.validateUserOp (Smart Account Validation)

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

#### Alternative Validation Paths

**VALIDATION_MODE_ENABLE (On-the-fly validator activation)**:
```
When nonce encodes validationMode = 0x01 (ENABLE):
  1. Parse signature: [hook:20][enableData][enableSig][userOpSig]
  2. Compute EIP-712 enable digest
  3. Verify enableSig with root validator
  4. Install new validator + hook on-the-fly
  5. Configure selector access
  6. Continue with actual validation using new validator
```

**VALIDATION_TYPE_PERMISSION**:
```
When validationType = 0x02 (PERMISSION):
  1. Check SKIP_USEROP flag in PermissionConfig
  2. For each Policy in permissionConfig[permissionId].policyData:
     → IPolicy(policy).checkUserOpPolicy(permissionId, userOp)
     → Each policy has its own signature segment: [idx:1][len:8][sig:var]
  3. ISigner(signer).checkUserOpSignature(permissionId, userOp, userOpHash)
  4. Merge all validationData via _intersectValidationData()
```

**VALIDATION_TYPE_7702 (EIP-7702 native)**:
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

### Step 3.5: Validation Data Merging

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

## 7. Phase 4: EntryPoint Execution Phase

After all UserOps are validated, `emit BeforeExecution()`, then execute each.

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

### Step 4.2: Kernel.executeUserOp (Hook Lifecycle)

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

### Batch Execution Mode

If the UserOp contains multiple calls (ERC-7579 batch):

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

### Executor Module Flow

Executors are external contracts that can trigger execution:

```
ExternalExecutor.trigger()
  → Kernel.executeFromExecutor(execMode, executionCalldata)
      1. Verify executor is installed (hook != NOT_INSTALLED)
      2. Set _EXECUTOR_CONTEXT_SLOT (prevent re-entry)
      3. Pre-hook: IHook(executorHook).preCheck(executor, value, data)
      4. ExecLib.execute(execMode, executionCalldata)
      5. Post-hook: IHook(executorHook).postCheck(context)
      6. Clear _EXECUTOR_CONTEXT_SLOT
      7. Return bytes[] results
```

### Fallback Module Flow

Triggered when an unrecognized selector is called on the Kernel:

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

## 8. Phase 5: PostOp & Paymaster Settlement

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

### Step 5.3: Final Settlement

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

### Step 5.4: Bundler Compensation

```
After all UserOps in the bundle are processed:

  EntryPoint._compensate(beneficiary, collected)
    beneficiary.call{value: collected}("")

    // beneficiary = Bundler's fee recipient address
    // collected = sum of all actualGasCost from all UserOps
    // This reimburses the Bundler for the gas spent on handleOps tx
```

---

## 9. Module Lifecycle Reference

### Module Types and Their Call Points

| # | Module Type | Interface | When Called | Function Signature | Parameters | Return |
|---|-------------|-----------|-------------|-------------------|------------|--------|
| 1 | **Validator** | `IValidator` | Validation phase (validateUserOp) | `validateUserOp(PackedUserOperation, bytes32)` | userOp, userOpHash | `uint256` validationData |
| 2 | **Validator** | `IValidator` | ERC-1271 signature check | `isValidSignatureWithSender(address, bytes32, bytes)` | sender, hash, data | `bytes4` magic value |
| 3 | **Hook** | `IHook` | Before execution | `preCheck(address, uint256, bytes)` | msgSender, msgValue, msgData | `bytes` context |
| 4 | **Hook** | `IHook` | After execution | `postCheck(bytes)` | context from preCheck | void |
| 5 | **Executor** | `IExecutor` | External trigger | Calls `Kernel.executeFromExecutor(ExecMode, bytes)` | execMode, executionCalldata | `bytes[]` results |
| 6 | **Fallback** | Any | Unknown selector on Kernel | `target.call(msg.data ++ msg.sender)` or `delegatecall(msg.data)` | Original calldata | Forwarded result |
| 7 | **Policy** | `IPolicy` | Permission validation | `checkUserOpPolicy(bytes32, PackedUserOperation)` | permissionId, userOp | `uint256` validationData |
| 8 | **Policy** | `IPolicy` | Signature policy check | `checkSignaturePolicy(bytes32, address, bytes32, bytes)` | id, sender, hash, sig | `uint256` validationData |
| 9 | **Signer** | `ISigner` | Permission signature check | `checkUserOpSignature(bytes32, PackedUserOperation, bytes32)` | id, userOp, hash | `uint256` validationData |
| 10 | **Signer** | `ISigner` | ERC-1271 with permission | `checkSignature(bytes32, address, bytes32, bytes)` | id, sender, hash, sig | `bytes4` magic value |

### Hook Attachment Points

```
1. Validator Hook:
   Stored in: validationConfig[validationId].hook
   Called during: Kernel.executeUserOp()
   Flow: preCheck → delegatecall(execute) → postCheck

2. Root Validator Hook:
   Stored in: validationConfig[rootValidator].hook
   Called during: Kernel.execute() modifier (onlyEntryPointOrSelfOrRoot)
   Flow: preCheck → ExecLib.execute() → postCheck

3. Executor Hook:
   Stored in: executorConfig[executor].hook
   Called during: Kernel.executeFromExecutor()
   Flow: preCheck → ExecLib.execute() → postCheck

4. Fallback Hook:
   Stored in: selectorConfig[selector].hook
   Called during: Kernel.fallback()
   Flow: preCheck → target.call/delegatecall → postCheck
```

### Hook Special Values

| Address | Meaning | Behavior |
|---------|---------|----------|
| `address(0)` | NOT_INSTALLED | Module/selector not configured, revert |
| `address(1)` | NO_HOOK | Module installed, no hook enforcement |
| `address(0xFFFF...FFFF)` | ONLY_ENTRYPOINT | Only EntryPoint can call this selector |

### Module Installation

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

## 10. Fund Flow Summary

### Per-UserOp Settlement

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

### Gas Accounting Formula

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

## 11. Data Structure Reference

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

## 12. Error Code Reference

### EntryPoint Error Codes

| Code | Component | Description |
|------|-----------|-------------|
| AA13 | Factory | initCode failed or out of gas |
| AA14 | Factory | initCode returned wrong sender |
| AA15 | Factory | initCode didn't deploy code |
| AA20 | Account | Account not deployed (no code) |
| AA21 | Account | Didn't pay prefund |
| AA22 | Account | Signature expired or not yet valid |
| AA23 | Account | validateUserOp reverted |
| AA24 | Account | Aggregator mismatch |
| AA25 | Account | Invalid nonce |
| AA26 | Account | Over verificationGasLimit |
| AA31 | Paymaster | Deposit too low |
| AA32 | Paymaster | Signature expired or not yet valid |
| AA33 | Paymaster | validatePaymasterUserOp reverted |
| AA34 | Paymaster | Signature error |
| AA35 | Paymaster | Malformed return data |
| AA36 | Paymaster | Over paymasterVerificationGasLimit |
| AA94 | Gas | Gas values overflow uint120 |
| AA95 | Gas | Out of gas in handleOps |

### Bundler RPC Error Codes

| Code | Description |
|------|-------------|
| -32500 | Rejected by EntryPoint or Account |
| -32501 | Rejected by Paymaster |
| -32502 | Banned opcode detected |
| -32503 | Deadline too short |
| -32504 | Entity banned or throttled |
| -32505 | Insufficient stake |
| -32506 | Unsupported aggregator |
| -32507 | Invalid signature |

---

## Appendix: Prerequisites

Before executing this flow, the following must be in place:

1. **EIP-7702 Delegation**: User's EOA has been delegated to Kernel implementation
2. **Kernel Initialized**: `Kernel.initialize()` called with root validator and hook configuration
3. **ECDSA Validator Installed**: Root validator configured with user's EOA as owner
4. **USDC Approval**: User has called `USDC.approve(ERC20Paymaster, amount)` to allow paymaster to collect fees
5. **Paymaster Deposit**: ERC20Paymaster has sufficient ETH deposited in EntryPoint via `EntryPoint.depositTo(paymaster)`
6. **Oracle Configured**: ERC20Paymaster has a valid price oracle for USDC/ETH conversion
7. **Bundler Running**: Bundler service is connected to the same chain and EntryPoint
8. **Paymaster-Proxy Running**: Configured with correct paymaster address and signing key
