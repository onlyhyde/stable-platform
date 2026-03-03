# 11. UserOp 라이프사이클 문서 검토 결과

## 목적

`10-userop-lifecycle-e2e.md`(이하 "라이프사이클 문서")가 아래 두 기준을 충족하는지 검토한 결과를 정리한다.

1. **스펙 준수**: `spec/EIP-4337_스펙표준_정리.md`(이하 "스펙 문서")의 표준과 일치하는가?
2. **코드 정합성**: 실제 코드 구현과 일치하는가?

---

## Part 1: 라이프사이클 문서 ↔ 스펙 표준 비교

### 1-1. 일치 항목

| # | 항목 | 스펙 문서 Section | 라이프사이클 Section | 판정 |
|---|------|------------------|---------------------|------|
| 1 | PackedUserOperation 9개 필드 정의 | §3, §19.1 | §1 | PASS |
| 2 | accountGasLimits 패킹 (verificationGasLimit:uint128 ‖ callGasLimit:uint128) | §3 | §1-2 | PASS |
| 3 | gasFees 패킹 (maxPriorityFeePerGas:uint128 ‖ maxFeePerGas:uint128) | §3 | §1-3 | PASS |
| 4 | paymasterAndData 레이아웃 (paymaster:20B + pmVerifGas:16B + pmPostOpGas:16B + data) | §6, §19.3 | §1-4 | PASS |
| 5 | Off-chain ↔ Packed 매핑 (factory+factoryData→initCode 등) | §3 | §1-5, §1-6 | PASS |
| 6 | EIP-712 userOpHash 계산 (0x1901 + domainSeparator + structHash) | §12 | §6-2 | PASS |
| 7 | PACKED_USEROP_TYPEHASH 문자열 일치 | §12 | §6-2 Step 2 | PASS |
| 8 | signature 필드가 hash에서 제외됨 | §12 | §6-1, §10-2 | PASS |
| 9 | Domain: name="ERC4337", version="1", chainId, verifyingContract=EntryPoint | §12 | §6-2 Step 3 | PASS |
| 10 | handleOps(PackedUserOperation[] ops, address payable beneficiary) 시그니처 | §4.1 | §9-1 | PASS |
| 11 | EIP-7702 magic address 0x7702 (20B right-padded) | §10 | §1-5 | PASS |
| 12 | Deposit/Stake 요구사항 (Paymaster deposit 필수, stake 필수) | §6 | §0-1, §0-2 | PASS |
| 13 | beneficiary 가스 환급 구조 | §7 | §0-4 | PASS |
| 14 | AA 접두사 에러 코드 체계 | §11 | §8-3 (암시적) | PASS |
| 15 | Validation 흐름 (initCode 배포 → validateUserOp → validatePaymasterUserOp) | §20.2 | §9-2 | PASS |
| 16 | Execution 흐름 (callData 실행 → postOp) | §20.2 | §9-2 | PASS |
| 17 | Settlement (가스 차감 → beneficiary 지급 → 이벤트) | §20.2 | §9-2 | PASS |

### 1-2. 불일치 / 누락 항목

#### [S-1] 시뮬레이션 방식 — 스펙 미정의 영역 (Severity: N/A — 불일치 아님)

**스펙의 범위**:

ERC-4337 스펙은 시뮬레이션에 대해 다음만 정의한다:
- Bundler는 UserOp을 온체인 제출 전에 사전 검증해야 한다 (§7.1 MUST 규칙)
- `handleOps()` 실행 중 검증 실패 시 `FailedOp`/`FailedOpWithRevert`로 revert한다 (§11)

스펙이 **정의하지 않는 것**:
- 시뮬레이션에 사용할 특정 함수나 컨트랙트
- `simulateValidation` 같은 별도 시뮬레이션 함수의 존재
- 시뮬레이션 결과의 반환 방식 (revert vs normal return)

즉, **시뮬레이션의 구체적 방법은 전적으로 구현체(Bundler)의 재량**이다.

**알려진 시뮬레이션 방식들**:

| 방식 | 사용처 | 설명 |
|------|--------|------|
| `handleOps()` view/trace call | 스펙 문서가 참고로 언급 | handleOps를 eth_call로 호출하여 revert 여부로 판단 |
| EntryPointSimulations + state override | 참조 구현 (eth-infinitism) | EntryPoint 주소에 시뮬레이션 바이트코드를 state override로 주입, normal return으로 결과 수신 |
| `delegateAndRevert` | state override 미지원 네트워크용 | EntryPoint의 delegatecall 기반 폴백 (참조 구현 제공) |

**본 프로젝트의 선택**: EntryPointSimulations + state override (두 번째 방식)

이 방식을 선택한 이유:
1. `simulateValidation`이 **normal return**으로 `ValidationResult` 전체를 반환하므로 파싱이 단순
2. `handleOps` view call은 revert 데이터에서 결과를 추출해야 하므로 에러 경로가 복잡
3. go-stablenet이 `eth_call` state override를 완전히 지원 (`internal/ethapi/api.go:1221`)
4. 참조 구현(eth-infinitism)이 이 방식을 공식 권장

**결론**: 스펙이 시뮬레이션 방법을 정의하지 않으므로, 어떤 방식이든 스펙 위반이 아니다.
라이프사이클 문서가 프로젝트의 실제 구현(state override)을 기술하는 것은 정확하며, 수정 불필요.

#### [S-2] validationData 패킹 형식 설명 누락 — **해소**

**스펙 문서 §5**:
```
validationData (uint256):
| authorizer (20 bytes) | validUntil (6 bytes) | validAfter (6 bytes) |
```
- authorizer: 0 = 유효, 1 = SIG_VALIDATION_FAILED, 기타 = aggregator 주소
- v0.9 Block Number Mode (bit 47 flag)

**해결**: 라이프사이클 문서 §8-3에 다음을 추가:
- ValidationResult 구조체 전체 (returnInfo, senderInfo, factoryInfo, paymasterInfo, aggregatorInfo)
- validationData uint256 패킹 바이트 다이어그램 (authorizer 160bit + validUntil 48bit + validAfter 48bit)
- parseValidationData() 코드 참조
- authorizer 값별 의미 테이블 (0x0=유효, 0x1=SIG_FAILED, 그 외=aggregator)
- Bundler의 4가지 검증 로직 (서명 실패, 만료 임박, 미유효, Account/Paymaster 독립 검증)

> 참고: v0.9 Block Number Mode (bit 47 flag)는 현재 프로젝트에서 미사용이므로 생략. 필요 시 추가.

#### [S-3] 10% 미사용 가스 페널티 누락 — **문서 해소, 구현 이슈 발견**

**스펙 문서 §8.1**: callGasLimit + paymasterPostOpGasLimit 미사용분이 40,000 gas 이상이면 미사용분의 10% 페널티 부과.

**온체인 구현**: EntryPoint.sol에 완전히 구현됨:
- `UNUSED_GAS_PENALTY_PERCENT = 10`, `PENALTY_GAS_THRESHOLD = 40000` (L49-52)
- `_getUnusedGasPenalty()` (L1004-1013): 핵심 계산 함수
- `_postExecution()` (L877-941): callGas, postOpGas 각각 독립 적용

**문서 해결**: 라이프사이클 문서 §9-4에 추가 완료 (목적, 상수, 공식, 자금 흐름, 수치 예시).

**Bundler에 penalty 함수가 필요한가?**: 불필요.
- Bundler는 beneficiary(수취자)이므로 penalty가 부과되면 수익이 증가
- penalty 함수가 필요한 컴포넌트는 **비용을 지불하거나 비용을 산출하는 쪽** (SDK, Paymaster)
- Bundler가 penalty를 반영하지 않는 것은 수익을 보수적으로 평가하는 것일 뿐, 기능 결함이 아님

**프로젝트 전체 penalty 코드 현황**:

| 컴포넌트 | penalty 코드 | 용도 | 필요 이유 |
|----------|-------------|------|-----------|
| EntryPoint.sol | `_getUnusedGasPenalty()` | 온체인 집행 | 스펙 구현 주체 |
| SDK-TS (`config/gas.ts:142-158`) | `calculateUnusedGasPenalty()` | 사용자 총 비용 산출 | 비용 지불자 측 UX |
| Paymaster-Proxy (`gasEstimator.ts:25-29`) | `calculateUnusedGasPenalty()` | 수수료 정산 | 비용 정산 주체 |
| Bundler | 없음 | — | beneficiary(수취자)이므로 불필요 |

#### [S-4] paymasterAndData 선택적 트레일러 누락 — **해소**

**스펙 문서 §19.3**: `paymasterData` 뒤에 선택적 트레일러 (`paymasterSignature` + length + `PAYMASTER_SIG_MAGIC`) 정의.

**해결**: 라이프사이클 문서 §1-4에 다음을 추가:
- full layout 다이어그램 (기본 4필드 + optional 3필드)
- 트레일러의 목적 (Paymaster가 hash 계산 시 자신의 서명 제외)
- `PAYMASTER_SIG_MAGIC`(8바이트) 인식 방법
- 본 프로젝트는 이 트레일러를 사용하지 않음을 명시

#### [S-5] Bundler 사전 검증 규칙 상세 누락 — **해소**

**스펙 문서 §7.1**: 구체적 수치 기반 MUST 규칙.

**코드 확인**: 모든 규칙이 구현됨:
- `MAX_VERIFICATION_GAS: 500_000n` (`config/constants.ts:114`)
- `formatValidator.ts:315,322` — verificationGasLimit, paymasterVerificationGasLimit 상한 검사
- `formatValidator.ts:62,67` — callGasLimit, preVerificationGas 하한 검사
- `bundleExecutor.ts:121-258` — sender 중복 금지 (`deduplicateSenders`)

**해결**: 라이프사이클 문서 §8-3 Format 검증에 다음을 추가:
- 7개 MUST 규칙 테이블 (규칙, 스펙 값, 코드 위치)
- `500,000`은 스펙 원문에 숫자로 명시됨을 기재
- 환경변수로 조정 가능함을 기재

#### [S-6] EntryPoint 이벤트 상세 부족 — **해소**

**스펙 문서 §14**: 8개 이벤트 (UserOperationEvent, AccountDeployed, BeforeExecution, UserOperationRevertReason, PostOpRevertReason, UserOperationPrefundTooLow, IgnoredInitCode, EIP7702AccountInitialized)

**해결**: 라이프사이클 문서 §9-3에 다음을 추가:
- 전체 8개 이벤트 목록 테이블 (이벤트명, 발행 시점, 설명)
- 이벤트 발행 순서 다이어그램 (Validation → BeforeExecution → Execution → Settlement)
- 스펙 범위 참고 주석 (스펙은 이벤트 시그니처를 정의하지 않음, 참조 구현 기반)
- `spec/EIP-4337_스펙표준_정리.md` §14 참조 링크

#### [S-7] postOp의 PostOpMode 누락 — **해소**

**스펙 문서 §6**: `PostOpMode { opSucceeded, opReverted }` enum

**해결**: 라이프사이클 문서 §9-2에 다음을 추가:
- `PostOpMode` enum 정의 (Solidity 코드)
- `opSucceeded` / `opReverted` 각 모드별 동작 설명
- `context`가 비어있으면 postOp 미호출 규칙
- v0.9 참조 구현의 `postOpReverted` (3번째 값)는 내부 제어용임을 명시
- `spec/EIP-4337_스펙표준_정리.md` §6, `spec/EIP-4337_Paymaster_개발자_구현가이드.md` §3.2 참조

---

## Part 2: 라이프사이클 문서 ↔ 실제 코드 비교

### 2-1. 일치 항목

| # | 항목 | 코드 위치 | 문서 Section | 판정 |
|---|------|-----------|-------------|------|
| 1 | initCode 파싱 (factory:20B + factoryData) | `bundler/src/rpc/utils.ts:31-37` | §1-5 | PASS |
| 2 | accountGasLimits 파싱 (upper:16B verif + lower:16B call) | `utils.ts:42-53` | §1-2 | PASS |
| 3 | gasFees 파싱 (upper:16B priority + lower:16B max) | `utils.ts:58-69` | §1-3 | PASS |
| 4 | paymasterAndData 파싱 (20B + 16B + 16B + data) | `utils.ts:77-99` | §1-4 | PASS |
| 5 | packUserOperation (역방향 패킹) | `utils.ts:123-172` | §1-6 변환 테이블 | PASS |
| 6 | SDK pack/unpack이 Bundler와 동일 | `sdk-ts/core/src/utils/userOperation.ts:8-115` | §1-6 | PASS |
| 7 | EIP-712 TYPEHASH 문자열 | `utils.ts:9-13` | §6-2 Step 2 | PASS |
| 8 | Domain: "ERC4337", "1", chainId, entryPoint | `utils.ts:15-22` | §6-2 Step 3 | PASS |
| 9 | 0x1901 prefix 사용 | `utils.ts:246` | §6-2 Step 4 | PASS |
| 10 | signature 제외 (structHash에 미포함) | `utils.ts:216-241` | §6-1 | PASS |
| 11 | SDK의 getUserOperationHash가 Bundler와 동일 | `userOperation.ts:173-212` | §6-2 | PASS |
| 12 | State override로 EntryPointSimulations 주입 | `simulationValidator.ts:124-134` | §8-3, §11 | PASS |
| 13 | Normal return 디코딩 (decodeValidationResultReturn) | `errors.ts:410-488` | §8-3 | PASS |
| 14 | FailedOp/FailedOpWithRevert는 revert 경로 처리 | `simulationValidator.ts:155-159` | §8-3 | PASS |
| 15 | ethSendUserOperation: packed 수신 → unpack → validate → mempool | `server.ts:365-406` | §7, §8 | PASS |
| 16 | ethEstimateUserOperationGas: packed 수신 → estimate → 5개 gas 반환 | `server.ts:411-443` | §4 | PASS |
| 17 | handleOps(packedOps, beneficiary) 호출 | `bundleExecutor.ts:submitBundle` | §9-1 | PASS |
| 18 | Paymaster stub: isFinal=false 반환 | `getPaymasterStubData.ts` 전체 | §3-3 | PASS |
| 19 | Paymaster final: 실제 서명 포함 | `getPaymasterData.ts:121-171` | §5-2 | PASS |
| 20 | SDK 흐름 순서: build → stub → estimate → final → sign → send | `smartAccountClient.ts:98-189` | §10-1 | PASS |
| 21 | 서명이 마지막 단계 | `smartAccountClient.ts:182-185` | §6-1 | PASS |
| 22 | RPC 메서드 이름 전체 일치 | `server.ts:320-359` | §7-1 | PASS |
| 23 | Validation 6단계 (format→reputation→state→simulation→result→opcode) | `validator.ts:146-189` | §8 | PASS |
| 24 | Bundler pack UserOp for on-chain submission | `bundleExecutor.ts:731-780` | §9-1 | PASS |

### 2-2. 불일치 항목

#### [C-1] 서명 형식: 66 bytes vs 65 bytes (Severity: High — 문서 정확성)

**문서 §6-3, §1-1 (signature 필드)**:
> "Kernel v3: 0x02(1B) + ECDSA(65B) = **66 bytes**"

**실제 코드에는 두 경로가 존재**:

| 경로 | 코드 위치 | 서명 크기 | 0x02 prefix |
|------|-----------|-----------|-------------|
| Kernel account SDK | `kernelAccount.ts:98-105` | **65 bytes** | 없음 |
| signUserOpForKernel 유틸리티 | `userOperation.ts:269-274` | **66 bytes** | 있음 |
| Web app (useUserOp.ts) | `apps/web/hooks/useUserOp.ts:253` | **66 bytes** | 있음 |

`kernelAccount.ts`의 주석: *"For Kernel v3 (ERC-7579), the validation mode is encoded in the nonce, not in the signature"*

**분석**:
- **Kernel v3 기본 모드(nonce에 validation type 인코딩)**: 65 bytes (0x02 불필요)
- **Enable mode / 명시적 validation type 지정 시**: 66 bytes (0x02 prefix 필요)
- 문서가 "항상 66 bytes"로 기술하는 것은 부정확

**제안**: §6-3에 두 경로를 구분하여 설명. Kernel v3의 nonce-based validation routing을 간략히 언급.

#### [C-2] signMessage의 EIP-191 래핑 설명 부정확 (Severity: Medium — 문서 정확성)

**문서 §6-3**:
> `signer.signMessage({ message: { raw: hash } })` — "raw bytes로 서명"

**실제 동작**: viem의 `signMessage`는 `{ raw: hash }`를 전달해도 **EIP-191 personal_sign prefix** (`\x19Ethereum Signed Message:\n32`)를 자동으로 붙인다. "raw bytes로 서명"이라는 설명은 EIP-191 래핑 없이 직접 서명하는 것으로 오해할 수 있다.

**코드 확인**: `ecdsaValidator.ts:48-55`에서 `signMessage({ message: { raw: hash } })` 사용.

문서의 기존 주석이 이를 보완:
> "온체인 ECDSAValidator는 dual-recovery 패턴을 사용하여 raw EIP-712 서명과 EIP-191 wrapped 서명 모두 수용한다."

**분석**: 동작에는 문제없으나(dual-recovery가 양쪽 모두 처리), 문서의 설명이 정확하지 않음.

**제안**: "viem의 signMessage는 내부적으로 EIP-191 prefix를 추가한다" + "온체인 ECDSAValidator가 dual-recovery로 이를 처리" 설명을 추가.

#### [C-3] EIP-7702 Kernel account 통합 범위 (Severity: Low — 문서 보완 필요)

**문서 §1-5**: KernelFactory + EIP-7702 magic address + Kernel.initialize() 인코딩 상세 설명

**코드 확인 결과**: EIP-7702는 **8개 레이어에 걸쳐 완전히 구현**되어 있음:

| Layer | 핵심 구현 |
|-------|----------|
| go-stablenet | SetCodeTx Type 4, authorization 처리, EVM delegation resolution |
| 컨트랙트 (EntryPoint) | `Eip7702Support.sol` — initCode 0x7702 감지, `initEip7702Sender()` |
| 컨트랙트 (Kernel) | `VALIDATION_TYPE_7702`, `_verify7702Signature()` (ECDSA.recover == address(this)) |
| Bundler | `gasEstimator.ts` — PER_AUTHORIZATION_GAS = 25000n |
| SDK-TS | `packages/sdk-ts/core/src/eip7702/` — authorization, transaction, strategy, gas, security |
| SDK-Go | `packages/sdk-go/eip7702/` — Go 병렬 구현 |
| Wallet Extension | `wallet_signAuthorization`, `wallet_delegateAccount` RPC, UI |
| Web App | 위임 UI 컴포넌트 |

**분석**: 라이프사이클 문서는 EIP-7702 initCode 경로(EntryPoint 관점)를 정확히 기술하고 있음. 다만 EIP-7702의 "사전 단계"(Type 4 트랜잭션으로 delegation 설정, authorization 서명)는 UserOp 라이프사이클 밖의 별도 흐름이므로, 문서 범위 밖이라 볼 수 있음.

**제안**: §1-5에 "EIP-7702 delegation 설정은 UserOp 흐름의 사전 단계이며, 별도 Type 4 트랜잭션으로 처리된다. 상세는 `03-how-to-use-7702-kernel-smart-account.md` 참조" 주석 추가.

#### [C-4] eth_getUserOperationByHash 온체인 폴백의 빈 UserOp 반환 (Severity: Low)

**문서**: 명시적 언급 없음

**코드** (`server.ts:506-507`): mempool에서 찾지 못하면 온체인 로그로 폴백하는데, `userOperation` 필드가 빈 객체(`{}`)로 반환됨.

**스펙 문서 §7**: `eth_getUserOperationByHash(userOpHash)` → 전체 UserOperation 반환 기대

**분석**: 이 이슈는 라이프사이클 문서의 범위(UserOp 전송까지의 흐름)를 벗어남. 별도 이슈로 추적하는 것이 적절.

---

## Part 3: 코드 자체의 스펙 준수 확인

### 3-1. Bundler ↔ SDK 구현 일관성

| 항목 | Bundler | SDK | 일관성 |
|------|---------|-----|--------|
| unpackUserOperation | 패킹 + 언패킹 양방향 폴백 | 패킹만 수신 | 호환 (Bundler가 상위집합) |
| packUserOperation | 동일 로직 | 동일 로직 | PASS |
| getUserOperationHash | 동일 TYPEHASH, 동일 domain | 동일 TYPEHASH, 동일 domain | PASS |
| keccak256(bytes 필드) 처리 | initCode, callData, paymasterAndData를 keccak256 | 동일 | PASS |

### 3-2. 코드의 스펙 준수 상태

| 스펙 요구사항 | 코드 구현 | 준수 |
|--------------|----------|------|
| PackedUserOperation 9 필드 | `types/index.ts:83-93` | PASS |
| EIP-712 hash (0x1901) | `utils.ts:246` | PASS |
| State override 시뮬레이션 (참조 구현) | `simulationValidator.ts:124-134` | PASS |
| Normal return 디코딩 | `errors.ts:410-488` | PASS |
| FailedOp/FailedOpWithRevert 에러 처리 | `errors.ts` ERROR_SELECTORS | PASS |
| validationData 파싱 (160+48+48 bit) | `errors.ts:530-546` | PASS |
| SIG_VALIDATION_FAILED = address(1) | `types.ts` VALIDATION_CONSTANTS | PASS |
| validateTimestamps (validAfter/validUntil) | `errors.ts:569-609` | PASS |
| handleOps(ops, beneficiary) | `bundleExecutor.ts:submitBundle` | PASS |
| handleAggregatedOps (aggregator 지원) | `bundleExecutor.ts` + `AGGREGATOR_ABI` | PASS |
| Paymaster 2-step (ERC-7677) | stub + final handlers | PASS |
| EIP-7702 authorization gas (25000) | `gasEstimator.ts` | PASS |
| 6단계 validation (format→rep→state→sim→result→opcode) | `validator.ts:146-189` | PASS |

---

## Part 4: 코드 검토에서 발견된 별도 이슈

문서/스펙 비교 과정에서 발견되었으나, penalty와 무관한 별도 이슈.

#### [I-1] Bundler 수익성 계산에 paymaster gas 필드 누락 (Severity: Medium)

**파일**: `services/bundler/src/executor/profitability.ts` L80, L129

**현재 코드**:
```typescript
const estimatedGas = op.callGasLimit + op.verificationGasLimit + op.preVerificationGas
```

**문제**: UserOp의 5개 gas 필드 중 `paymasterVerificationGasLimit`와 `paymasterPostOpGasLimit`가 누락됨.
Paymaster가 있는 UserOp의 수익을 과소평가하여 수익성 판단 정확도가 떨어짐.

> 참고: 이 이슈는 penalty와 무관. profitability 계산의 gas 필드 집계 누락.

---

## 종합 요약

### 문서 ↔ 스펙 (7건: 전체 해소)

| ID | 항목 | Severity | 분류 |
|----|------|----------|------|
| ~~S-1~~ | ~~시뮬레이션 방식~~ | ~~N/A~~ | **해소** — 스펙 미정의 영역, 현재 구현 정확 |
| ~~S-2~~ | ~~validationData 패킹 형식 누락~~ | ~~Medium~~ | **해소** — 라이프사이클 문서 §8-3에 추가 완료 |
| ~~S-3~~ | ~~10% 미사용 가스 페널티 누락~~ | ~~Low~~ | **해소** — 문서 §9-4 추가 완료. Bundler는 beneficiary이므로 penalty 함수 불필요 |
| ~~S-4~~ | ~~paymasterAndData optional trailer 누락~~ | ~~Low~~ | **해소** — 라이프사이클 문서 §1-4에 추가 완료 |
| ~~S-5~~ | ~~Bundler 사전 검증 규칙 상세 누락~~ | ~~Low~~ | **해소** — 라이프사이클 문서 §8-3에 규칙 테이블 추가 완료 |
| ~~S-6~~ | ~~EntryPoint 이벤트 상세 부족~~ | ~~Low~~ | **해소** — 라이프사이클 문서 §9-3에 전체 이벤트 목록 + 발행 순서 다이어그램 추가 완료 |
| ~~S-7~~ | ~~postOp PostOpMode enum 누락~~ | ~~Low~~ | **해소** — 라이프사이클 문서 §9-2에 PostOpMode enum 상세 + context 조건 추가 완료 |

### 문서 ↔ 코드 (4건 미처리)

| ID | 항목 | Severity | 분류 |
|----|------|----------|------|
| C-1 | 서명 형식 65B vs 66B 두 경로 미구분 | High | 문서 부정확 |
| C-2 | signMessage EIP-191 래핑 설명 부정확 | Medium | 문서 부정확 |
| C-3 | EIP-7702 사전 단계(delegation 설정) 미언급 | Low | 문서 범위 보완 |
| C-4 | getUserOperationByHash 폴백 빈 객체 | Low | 별도 이슈 |

### 별도 이슈 (1건 — penalty 무관)

| ID | 항목 | Severity | 분류 |
|----|------|----------|------|
| I-1 | profitability.ts: paymaster gas 필드 누락 | Medium | gas 집계 누락 |

### 코드 ↔ 스펙: **전체 PASS** (검사 항목 14개 모두 통과)

---

## 다음 단계

### 문서 수정 필요
1. **[C-1] 서명 형식** — Kernel v3 nonce-based validation과 enable mode의 차이를 문서에 반영
2. **[C-2] signMessage** — EIP-191 래핑 + dual-recovery 설명 보강

### 별도 코드 이슈
3. **[I-1] profitability.ts paymaster gas 추가** — penalty 무관, gas 필드 집계 누락

### Low severity (필요 시 점진적 보강)
4. C-3~C-4 — 문서 범위 확장 또는 참조 링크 추가
