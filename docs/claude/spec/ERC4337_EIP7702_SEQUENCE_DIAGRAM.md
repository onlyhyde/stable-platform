# ERC-4337 + EIP-7702 Sequence Diagrams

## 0. Seminar Reading Guide: 2-Track

이 문서는 세미나 전달력을 위해 아래 2개 트랙을 구분해 읽는다.

| Track | 의미 | 이 문서에서의 처리 |
|---|---|---|
| **Track A: Current Implementation** | 현재 코드/PoC와 1:1로 일치하는 플로우 | 메인 다이어그램 기준 |
| **Track B: Target/Expansion Architecture** | 향후 확장 가능한 운영/제품 아키텍처 | 보조 설명용(현재 미구현) |

Track A 핵심 해석 규칙:
- EIP-7702 delegation(type-4)은 UserOp 이전 별도 단계
- Bundler 실행은 `handleOps` 제출 중심
- 본 POC의 실행 기본 경로는 `Kernel.execute(...)` direct path

Track B는 세미나에서 "비전/확장"으로 소개하되, 구현 여부를 명확히 표시한다.

## 0.1 Implementation Sync (2026-03-02)

이 다이어그램은 **v0.9 목표 정합 플로우**를 기준으로 한다.  
현재 저장소 오프체인 인프라 상태는 아래 항목이 PARTIAL이다.

| Area | Status | Note |
|---|---|---|
| Bundler `userOpHash` path | **PARTIAL** | legacy hash path remains in bundler RPC utility |
| `eth_getUserOperationReceipt` | **PARTIAL** | mempool-dependent path, on-chain fallback 보강 필요 |
| EntryPoint defaults | **PARTIAL** | mixed defaults across SDK/config/env |
| Gas estimation parity | **PARTIAL** | 10% penalty / EIP-7702 +25k reflection needs convergence |

Reference:
- `docs/claude/spec/EIP-4337_7579_통합_스펙준수_보고서.md` (§11.2.4, §11.3)
- `docs/claude/spec/EIP-4337_7579_코드정합성_검토결과_2026-03-02.md`

## 1. Complete End-to-End Flow (Overview, Track A)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant D as DApp (Web)
    participant W as Wallet Extension
    participant PP as Paymaster-Proxy
    participant B as Bundler
    participant EP as EntryPoint
    participant K as Kernel (Smart Account)
    participant V as ECDSA Validator
    participant PM as ERC20Paymaster
    participant O as Price Oracle
    participant T as USDC Token

    Note over U,T: Phase 0: EIP-7702 Delegation Setup
    U->>D: Click "Upgrade to Smart Account"
    D->>W: wallet_signAuthorization({account, contractAddress: Kernel})
    W->>W: createAuthorizationHash(chainId, Kernel, nonce)
    W->>W: ECDSA sign(authHash, privateKey)
    W-->>D: {chainId, address, nonce, v, r, s}
    D->>D: Relayer sends type-4 tx ({authorizationList: [signedAuth]})
    Note over D: EVM sets EOA.code = 0xef0100||Kernel

    Note over U,T: Phase 1: Construct UserOp
    U->>D: Send 100 USDC to recipient
    D->>D: Encode USDC.transfer(recipient, 100e6)
    D->>D: Wrap in Kernel.execute(SINGLE, calldata)
    D->>PP: pm_getPaymasterStubData(userOp, {type: erc20, token: USDC})
    PP-->>D: {paymaster, stubData, gasLimits}
    D->>B: eth_estimateUserOperationGas(userOp)
    B-->>D: {preVerificationGas, verificationGasLimit, callGasLimit}
    D->>PP: pm_getPaymasterData(userOp_with_gas)
    PP->>PP: Encode Erc20Payload + Envelope
    PP-->>D: {paymaster, paymasterData: envelope}
    D->>D: Pack UserOp (v0.9-compatible packed format)
    D->>D: Compute userOpHash (target: v0.9 EIP-712)
    D->>W: signMessage(userOpHash)
    W->>W: ECDSA sign(hash, privateKey)
    W-->>D: signature (r||s||v)
    D->>D: Attach signature to UserOp

    Note over U,T: Phase 2: Submit to Bundler
    D->>B: eth_sendUserOperation(packedUserOp, entryPoint)
    B->>B: Phase 1: Format validation
    B->>B: Phase 2: Reputation check
    B->>B: Phase 3: State validation (nonce, code)
    B->>EP: Phase 4: simulateHandleOp(userOp)
    EP-->>B: Simulation result
    B->>B: Phase 5: Validate simulation
    B->>B: Phase 6: Opcode validation (ERC-7562)
    B->>B: Add to mempool
    B-->>D: userOpHash

    Note over U,T: Phase 3: Bundle & Execute
    B->>B: Bundle timer (every 4s)
    B->>B: Select ops from mempool
    B->>EP: handleOps([packedUserOp], beneficiary)

    Note over EP,T: Phase 3a: Validation
    EP->>K: validateUserOp(userOp, hash, 0)
    K->>K: decodeNonce → ROOT/7702 mode
    K->>K: _verify7702Signature(ethSigned(hash), signature)
    K-->>EP: validationData

    EP->>EP: Deduct prefund from Paymaster deposit
    EP->>PM: validatePaymasterUserOp(userOp, hash, maxCost)
    PM->>PM: Decode Envelope + Erc20Payload
    PM->>O: getPriceWithTimestamp(USDC)
    O-->>PM: (price, updatedAt)
    PM->>PM: maxTokenCost = getTokenAmount(USDC, maxCost)
    PM->>T: balanceOf(sender) >= maxTokenCost?
    T-->>PM: balance ✓
    PM->>T: allowance(sender, paymaster) >= maxTokenCost?
    T-->>PM: allowance ✓
    PM-->>EP: (context, validationData)

    Note over EP,T: Phase 3b: Execution
    EP->>EP: emit BeforeExecution()
    EP->>K: execute(ExecMode, executionCalldata) [this POC]
    K->>K: ExecLib: decode SINGLE mode
    K->>T: call: transfer(recipient, 100_000_000)
    T->>T: Check: !paused, !blacklisted
    T->>T: balances[sender] -= 100e6
    T->>T: balances[recipient] += 100e6
    T->>T: emit Transfer(sender, recipient, 100e6)
    T-->>K: true

    K-->>EP: success

    Note over EP,T: Phase 4: PostOp Settlement
    EP->>EP: Calculate actualGasCost + penalties
    Note over EP: postOp is invoked only when context.length > 0<br/>(ERC20 flow returns non-empty context)
    EP->>PM: postOp(opSucceeded, context, actualGasCost, gasPrice)
    PM->>PM: Decode context (sender, token, maxTokenCost, maxCost)
    PM->>PM: actualTokenCost = maxTokenCost × actualGasCost / maxCost
    PM->>T: transferFrom(sender, paymaster, actualTokenCost)
    T->>T: balances[sender] -= 1.10 USDC
    T->>T: balances[paymaster] += 1.10 USDC
    T->>T: emit Transfer(sender, paymaster, actualTokenCost)
    T-->>PM: true
    PM->>PM: emit GasPaidWithToken(sender, USDC, tokenCost, gasCost)
    PM-->>EP: done

    EP->>EP: refund = prefund - finalActualGasCost
    EP->>EP: deposits[paymaster] += refund
    EP->>EP: emit UserOperationEvent(hash, sender, paymaster, ...)

    Note over EP,T: Phase 5: Bundler Compensation
    EP->>B: compensate(beneficiary, collected ETH)

    Note over U,T: Phase 6: Receipt
    D->>B: eth_getUserOperationReceipt(userOpHash) [polling, target behavior]
    B-->>D: {success: true, actualGasCost, txHash}
    D->>U: Transfer complete ✓
```

> Sync note (2026-03-02): In current code, `eth_getUserOperationReceipt` may depend on in-memory mempool state.  
> For operations, verify with on-chain `UserOperationEvent` lookup until receipt fallback convergence is completed.

### 1.1 Target/Expansion Overlay (Track B, Concept)

```mermaid
flowchart LR
    A["Type-4 Delegation Automation"] --> B["Policy/Template-driven UserOp Builder"]
    B --> C["Bundler Multi-Scenario Orchestration"]
    C --> D["EntryPoint handleOps Execution"]
    D --> E["Unified Monitoring & Settlement"]
```

Track B는 세미나용 확장 비전이며, 현재 저장소의 구현 범위는 Track A다.

### 1.2 Track B Roadmap Mapping (Seminar Script)

| Milestone | 세미나에서 설명할 다이어그램 포인트 | 핵심 메시지 |
|---|---|---|
| **M1. Protocol Correctness Lock** | Section 1/3/4 | hash, nonce, selector 규칙을 먼저 고정해야 확장이 가능 |
| **M2. Delegation Orchestration Layer** | Section 2 | delegation은 UserOp 이전 별도 단계이며 운영 자동화가 필요 |
| **M3. Policy/Template UserOp Builder** | Section 1/3 | UserOp 조립을 템플릿화해 시나리오 확장 비용을 낮춤 |
| **M4. Bundler Multi-Scenario Orchestration** | Section 1/5/6 | bundler는 단순 제출기가 아니라 정책 기반 오케스트레이터가 되어야 함 |
| **M5. Security/Operations Guardrails** | Section 5/6 | postOp 정산/지출 제어/모니터링이 운영 안정성의 핵심 |
| **M6. Seminar-to-Production Package** | 전체 | 교육 자료와 운영 절차를 같은 번호 체계로 연결해야 온보딩이 빨라짐 |

세미나 진행 팁:
- Track A 다이어그램을 먼저 설명하고,
- 같은 번호의 M1~M6를 오버레이로 붙여 “현재 상태 -> 확장 경로”를 연결한다.

---

## 2. EIP-7702 Delegation Setup (Detailed)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant D as DApp
    participant W as Wallet Extension
    participant KC as Keyring Controller
    participant R as Relayer
    participant EVM as EVM / Blockchain

    U->>D: Click "Upgrade to Smart Account"
    D->>W: wallet_signAuthorization({<br/>account: EOA,<br/>contractAddress: Kernel,<br/>chainId: 8283,<br/>nonce: auto})

    W->>EVM: getTransactionCount(EOA)
    EVM-->>W: currentNonce

    W->>W: authorization = {<br/>chainId: 8283,<br/>address: Kernel,<br/>nonce: currentNonce}

    W->>W: authHash = keccak256(<br/>0x05 || rlp([chainId, Kernel, nonce]))

    rect rgb(255, 240, 240)
        Note over W,KC: User Approval (if external DApp)
        W->>U: "Allow delegation to Kernel contract?"
        U-->>W: Approve ✓
    end

    W->>KC: signAuthorizationHash(EOA, authHash)
    KC->>KC: Retrieve private key from vault
    KC->>KC: ECDSA.sign(authHash, privateKey)
    KC-->>W: {signature: 0x...}

    W->>W: Parse signature → {v, r, s}
    W-->>D: {chainId, address: Kernel,<br/>nonce, v, r, s}

    D->>R: Construct EIP-7702 transaction
    Note over R: Relayer pays gas for the user

    R->>EVM: sendTransaction({<br/>to: EOA,<br/>data: 0x,<br/>authorizationList: [{<br/>chainId, address: Kernel,<br/>nonce, v, r, s<br/>}]})

    EVM->>EVM: Increment sender nonce (tx sender)
    EVM->>EVM: Verify ECDSA signature
    EVM->>EVM: Verify authority.nonce == auth.nonce
    EVM->>EVM: Increment authority.nonce
    EVM->>EVM: Set authority.code = 0xef0100 || Kernel
    EVM-->>R: Transaction receipt

    R-->>D: txHash
    D->>EVM: eth_getCode(EOA)
    EVM-->>D: 0xef0100{Kernel address}
    D->>D: isSmartAccount = true
    D-->>U: "Smart Account activated ✓"
```

---

## 3. Kernel Validation Flow (Detailed)

```mermaid
sequenceDiagram
    autonumber
    participant EP as EntryPoint
    participant K as Kernel
    participant VM as ValidationManager
    participant V as ECDSA Validator
    participant H as Hook Module
    participant P as Policy (Permission mode)
    participant S as Signer (Permission mode)

    EP->>K: validateUserOp(userOp, userOpHash, missingFunds)
    Note over K: modifier: onlyEntryPoint

    K->>K: decodeNonce(userOp.nonce)
    Note over K: → validationMode, validationType, validationId

    alt validationMode == DEFAULT (0x00)
        K->>VM: _validateUserOp(DEFAULT, vId, userOp, hash)
    else validationMode == ENABLE (0x01)
        K->>VM: _enableMode(vId, packedData)
        VM->>VM: Extract hook + enableData from signature
        VM->>VM: Compute EIP-712 enable digest
        VM->>V: Verify enable signature (root validator)
        V-->>VM: valid
        VM->>VM: Install new validator + hook
        VM->>VM: Configure selector access
        VM->>VM: Continue validation with new validator
    end

    alt validationType == VALIDATOR (0x01)
        VM->>V: validateUserOp(userOp, userOpHash)
        V->>V: ecrecover(userOpHash, signature)
        V->>V: recovered == registered owner?
        V-->>VM: validationData (0=success, 1=fail)

    else validationType == PERMISSION (0x02)
        VM->>VM: Load PermissionConfig(permissionId)
        VM->>VM: Check SKIP_USEROP flag

        loop For each Policy in policyData[]
            VM->>P: checkUserOpPolicy(permissionId, userOp)
            P-->>VM: validationData
            VM->>VM: _intersectValidationData(accumulated, result)
        end

        VM->>S: checkUserOpSignature(permissionId, userOp, hash)
        S-->>VM: validationData

    else validationType == 7702 (0x00)
        VM->>VM: ECDSA recovery against address(this)
        VM->>VM: verify ethSigned(userOpHash)
    end

    VM-->>K: validationData

    K->>K: Lookup validationConfig[vId].hook

    alt validationType == ROOT/7702 (0x00)
        K->>K: executionHook[userOpHash] = hook (often address(0))
        Note over K: installed-validator and selector checks are skipped
    else validationType == VALIDATOR/PERMISSION
        alt hook != address(1) (Hook installed)
            K->>K: executionHook[userOpHash] = hook
            K->>K: Require callData selector == executeUserOp
            Note over K: Hook will be called during execution
        else hook == address(1) (No hook)
            Note over K: Direct execute() call allowed
        end
    end

    opt validationType != ROOT/7702
        K->>K: Check allowedSelectors[vId][targetSelector]
    end

    opt missingAccountFunds > 0
        K->>EP: call{value: missingFunds}("")
        Note over K: Prefund EntryPoint (only when no paymaster)
    end

    K-->>EP: validationData
```

---

## 4. Kernel Execution Flow (Detailed)

```mermaid
sequenceDiagram
    autonumber
    participant EP as EntryPoint
    participant K as Kernel
    participant H as Hook Module
    participant EL as ExecLib
    participant USDC as USDC Contract

    EP->>EP: innerHandleOp(callData, opInfo, context)
    Note over EP: New call context for gas isolation

    EP->>EP: Verify gas: gasleft()*63/64 >= callGas + postOpGas + 10k

    EP->>EP: Check selector and optional rewrite

    alt callData selector == executeUserOp (0x8dd7712f)
        EP->>EP: Rewrite to executeUserOp(userOp, userOpHash)
        EP->>K: call{gas: callGasLimit} executeUserOp(userOp, userOpHash)
        K->>K: hook = executionHook[userOpHash]
        K->>K: delete executionHook[userOpHash]

        opt hook != address(0) && hook != address(1)
            K->>H: preCheck(msg.sender, msg.value, userOp.callData[4:])
            H-->>K: hookContext
        end

        K->>EL: execute(execMode, executionCalldata)
        EL->>EL: Decode ExecMode: CALLTYPE_SINGLE, EXECTYPE_DEFAULT
        EL->>EL: decodeSingle(executionCalldata)
        Note over EL: target = USDC<br/>value = 0<br/>data = transfer(recipient, 100e6)
        EL->>USDC: call(gas, USDC, 0, transferData)
        USDC-->>EL: true
        EL-->>K: success + returnData

        opt hook != address(0) && hook != address(1)
            K->>H: postCheck(hookContext)
            H-->>K: (reverts if invalid)
        end
    else direct execute path (this POC)
        EP->>K: call{gas: callGasLimit} execute(ExecMode, executionCalldata)
        K->>EL: execute(execMode, executionCalldata)
        EL->>EL: Decode ExecMode: CALLTYPE_SINGLE, EXECTYPE_DEFAULT
        EL->>EL: decodeSingle(executionCalldata)
        Note over EL: target = USDC<br/>value = 0<br/>data = transfer(recipient, 100e6)
        EL->>USDC: call(gas, USDC, 0, transferData)
        USDC-->>EL: true
        EL-->>K: success + returnData
    end

    Note over EL: msg.sender = Smart Account (EOA)
    USDC->>USDC: require(!paused)
    USDC->>USDC: require(!blacklisted[sender])
    USDC->>USDC: require(!blacklisted[recipient])
    USDC->>USDC: require(balances[sender] >= 100e6)
    USDC->>USDC: balances[sender] -= 100,000,000
    USDC->>USDC: balances[recipient] += 100,000,000
    USDC->>USDC: emit Transfer(sender, recipient, 100e6)

    K-->>EP: execution complete
```

---

## 5. PostOp & Settlement Flow (Detailed)

```mermaid
sequenceDiagram
    autonumber
    participant EP as EntryPoint
    participant PM as ERC20Paymaster
    participant O as Price Oracle
    participant T as USDC Token
    participant B as Bundler (beneficiary)

    Note over EP: Back in innerHandleOp after execution

    EP->>EP: mode = opSucceeded
    EP->>EP: _postExecution(mode, opInfo, context, actualGas)

    rect rgb(255, 245, 238)
        Note over EP: Gas Penalty Calculation
        EP->>EP: unusedGas = callGasLimit - executionGasUsed
        EP->>EP: if unusedGas > 40,000:<br/>penalty = unusedGas × 10%
        EP->>EP: actualGas += penalty
    end

    EP->>EP: gasPrice = min(maxFeePerGas,<br/>maxPriorityFeePerGas + block.basefee)
    EP->>EP: actualGasCost = actualGas × gasPrice

    rect rgb(240, 248, 255)
        Note over EP,T: Paymaster PostOp
        Note over EP: Conditional call: only if context.length > 0
        EP->>PM: postOp{gas: postOpGasLimit}(<br/>opSucceeded,<br/>context,<br/>actualGasCost,<br/>gasPrice)
        Note over PM: modifier: onlyEntryPoint

        PM->>PM: Decode context:<br/>(sender, token, maxTokenCost, maxCost)

        PM->>PM: actualTokenCost =<br/>(maxTokenCost × actualGasCost) / maxCost
        Note over PM: Example:<br/>maxTokenCost = 2.49 USDC<br/>actualGasCost = 0.0003 ETH<br/>maxCost = 0.00068 ETH<br/>→ actualTokenCost ≈ 1.10 USDC

        PM->>PM: if actualTokenCost == 0:<br/>actualTokenCost = 1

        PM->>T: transferFrom(sender, paymaster, actualTokenCost)
        T->>T: Check: !paused, !blacklisted(all parties)
        T->>T: Check: allowance[sender][paymaster] >= amount
        T->>T: balances[sender] -= 1,098,529
        T->>T: balances[paymaster] += 1,098,529
        T->>T: allowances[sender][paymaster] -= 1,098,529
        T->>T: emit Transfer(sender, paymaster, 1098529)
        T-->>PM: true

        PM->>PM: emit GasPaidWithToken(<br/>sender, USDC,<br/>1098529, actualGasCost)
        PM-->>EP: done
    end

    rect rgb(245, 255, 245)
        Note over EP: Post-PostOp Gas Accounting
        EP->>EP: postOpGasUsed = prePostOpGas - gasleft()
        EP->>EP: postOpUnusedPenalty = (postOpGasLimit - postOpGasUsed) × 10%<br/>(only if unused > 40k)
        EP->>EP: actualGas += postOpGasUsed + postOpUnusedPenalty
        EP->>EP: finalActualGasCost = actualGas × gasPrice
    end

    rect rgb(255, 245, 255)
        Note over EP,B: Refund & Settlement
        EP->>EP: refund = prefund - finalActualGasCost
        EP->>EP: deposits[ERC20Paymaster] += refund
        Note over EP: Return unused ETH to paymaster's deposit

        EP->>EP: emit UserOperationEvent(<br/>userOpHash,<br/>sender,<br/>ERC20Paymaster,<br/>nonce,<br/>success=true,<br/>finalActualGasCost,<br/>actualGasUsed)

        EP->>EP: collected += finalActualGasCost
    end

    Note over EP: After ALL UserOps processed

    rect rgb(255, 250, 240)
        Note over EP,B: Bundler Compensation
        EP->>B: call{value: collected}("")
        Note over B: Bundler receives ETH compensation<br/>for the gas spent on handleOps transaction
    end
```

---

## 6. Paymaster-Proxy Off-Chain Flow (Detailed)

```mermaid
sequenceDiagram
    autonumber
    participant D as DApp / Wallet
    participant PP as Paymaster-Proxy
    participant SIG as Paymaster Signer
    participant POL as Policy Manager
    participant SW as Settlement Worker
    participant B as Bundler

    Note over D,B: Step 1: Stub Data (for gas estimation)
    D->>PP: pm_getPaymasterStubData(<br/>userOp, entryPoint, chainId,<br/>{type: "erc20", token: USDC})

    PP->>PP: Route to handleErc20StubData()
    PP->>PP: Create zero-signature envelope
    PP->>PP: Estimate gas limits
    PP-->>D: {paymaster, paymasterData: stub,<br/>verGasLimit: 100000,<br/>postOpGasLimit: 80000}

    Note over D: DApp estimates gas with bundler using stub data

    Note over D,B: Step 2: Final Signed Data
    D->>PP: pm_getPaymasterData(<br/>userOp_with_gas, entryPoint, chainId,<br/>{type: "erc20", token: USDC})

    PP->>PP: Route to handleErc20Data()
    PP->>PP: Encode Erc20Payload:<br/>{token: USDC, maxTokenCost, quoteId}
    PP->>PP: Create Envelope:<br/>{version: 1, type: 2 (ERC20),<br/>validUntil: now+300s,<br/>validAfter: now-60s,<br/>payload: Erc20Payload}

    Note over PP: ERC20 type: No signature needed<br/>(oracle validates on-chain)

    PP-->>D: {paymaster, paymasterData: envelope}

    Note over D,B: Step 3: For Verifying/Sponsor types (alternative flow)

    rect rgb(245, 245, 255)
        Note over PP,POL: Policy Check (Verifying/Sponsor only)
        PP->>POL: checkPolicy(userOp, policyId, estimatedCost)
        POL->>POL: Check sender whitelist/blacklist
        POL->>POL: Check per-tx limit
        POL->>POL: Check daily limit per sender
        POL->>POL: Check global daily limit
        POL-->>PP: {allowed: true}

        PP->>SIG: generateSignedData(userOp, ep, chainId, type, payload)
        SIG->>SIG: Compute domain separator
        SIG->>SIG: Compute userOp core hash
        SIG->>SIG: Hash envelope for signature
        SIG->>SIG: ECDSA.sign(hash, paymasterPrivateKey)
        SIG-->>PP: envelope + signature

        PP->>POL: reserveSpending(sender, estimatedCost)
        POL-->>PP: reservationId
    end

    Note over D,B: Step 4: Async Settlement
    rect rgb(255, 250, 240)
        loop Every 15 seconds
            SW->>B: eth_getUserOperationReceipt(userOpHash)
            alt Receipt found
                B-->>SW: {success, actualGasCost}
                SW->>POL: settleReservation(reservationId, actualCost)
                POL->>POL: Refund overage: reserved - actual
            else Not found yet
                B-->>SW: null
                Note over SW: Continue polling (max 10 retries)
            end
        end

        Note over SW: After 5 minutes: expire reservation, full refund
    end
```

---

## 7. Fallback Module Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as External Caller
    participant K as Kernel
    participant SM as SelectorManager
    participant H as Fallback Hook
    participant F as Fallback Module

    C->>K: call with unknown selector (e.g., onERC721Received)

    K->>K: fallback() triggered
    K->>SM: Lookup selectorConfig[msg.sig]
    SM-->>K: {hook, target, callType}

    alt hook == address(0)
        K->>K: REVERT: selector not installed
    end

    alt hook == HOOK_ONLY_ENTRYPOINT
        K->>K: require(msg.sender == EntryPoint)
    end

    opt hook is a contract (not special value)
        K->>H: preCheck(msg.sender, msg.value, msg.data)
        H-->>K: hookContext
    end

    alt callType == CALLTYPE_SINGLE (0x00)
        K->>F: call(msg.data ++ msg.sender)
        Note over F: ERC-2771 style:<br/>msg.sender appended to calldata<br/>Fallback module extracts sender<br/>from last 20 bytes
        F-->>K: result
    else callType == CALLTYPE_DELEGATECALL (0xFF)
        K->>F: delegatecall(msg.data)
        Note over F: Executes in Kernel's context<br/>Preserves storage access
        F-->>K: result
    end

    opt hook is a contract
        K->>H: postCheck(hookContext)
        H-->>K: (reverts if invalid)
    end

    K-->>C: Forward result (or revert)
```

---

## 8. Module Installation Flow

```mermaid
sequenceDiagram
    autonumber
    participant EP as EntryPoint / Self
    participant K as Kernel
    participant V as New Validator
    participant H as Hook Module
    participant E as Executor Module
    participant F as Fallback Module

    Note over EP,F: Validator Installation (type=1)
    EP->>K: installModule(1, validatorAddr, initData)
    Note over K: initData = [hook:20][validatorData][hookData][selectorData]
    K->>K: Extract hook address from initData[0:20]
    K->>K: Generate ValidationId: [0x01][validator address]
    K->>K: Store ValidationConfig{nonce, hook}
    K->>H: onInstall(hookData)
    K->>V: onInstall(validatorData)
    K->>K: Grant selector access if selectorData provided

    Note over EP,F: Executor Installation (type=2)
    EP->>K: installModule(2, executorAddr, initData)
    Note over K: initData = [hook:20][executorData][hookData]
    K->>K: Store ExecutorConfig{hook}
    K->>H: onInstall(hookData)
    K->>E: onInstall(executorData)

    Note over EP,F: Fallback Installation (type=3)
    EP->>K: installModule(3, fallbackAddr, initData)
    Note over K: initData = [selector:4][hook:20][callType:1][data][hookData]
    K->>K: Store SelectorConfig{hook, target, callType}
    opt callType == SINGLE
        K->>F: onInstall(selectorData)
    end
    K->>H: onInstall(hookData)
```

---

## Legend

### Participants

| Color | Component | Layer |
|-------|-----------|-------|
| Default | DApp, Wallet, User | Off-chain Client |
| Default | Bundler, Paymaster-Proxy | Off-chain Infrastructure |
| Default | EntryPoint, Kernel | On-chain Core |
| Default | Validator, Hook, Paymaster | On-chain Modules |
| Default | USDC, Oracle | On-chain Dependencies |

### Message Types

| Arrow | Meaning |
|-------|---------|
| `→` (solid) | Synchronous call |
| `-->` (dashed) | Return value |
| `rect` | Grouped logical phase |
| `opt` | Optional (conditional) |
| `alt` | Alternative paths |
| `loop` | Repeated operation |

### Key Addresses (Local Development)

```
EntryPoint:        0xEf6817fe73741A8F10088f9511c64b666a338A14
Kernel:            0xA61b944dd427A85495B685D93237CB73087E0035
ECDSA Validator:   0xA61b944dd427A85495B685D93237CB73087E0035
Kernel Factory:    0xbEbb0338503F9E28FFDC84C3548F8454F12Dd1D3
```

Source: `stable-platform/packages/contracts/src/generated/addresses.ts` (chainId `8283`)
