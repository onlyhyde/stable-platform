# 12) Phase 1 파일별/라인 단위 해설 (발표자 학습용)

## 문서 목적
이 문서는 세미나 발표자가 아래 5개 핵심 파일을 "라인 단위 책임"으로 설명할 수 있도록 만든 학습 가이드입니다.

- `poc-contract/src/erc7579-smartaccount/Kernel.sol`
- `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`
- `stable-platform/services/bundler/src/rpc/server.ts`
- `stable-platform/services/bundler/src/validation/validator.ts`
- `stable-platform/services/paymaster-proxy/src/app.ts`

핵심 원칙:
- 기능 설명은 "파일 + 함수 + 라인"으로 말한다.
- 표준 설명은 반드시 실제 코드 흐름(입력 -> 검증 -> 실행 -> 결과)으로 연결한다.

---

## 0. 30분 학습 루프

1. Kernel `validateUserOp` -> `executeUserOp`만 먼저 읽는다.
2. EntryPoint `handleOps` -> `_validatePrepayment` -> `_executeUserOp` 순서로 읽는다.
3. Bundler `eth_sendUserOperation`에서 validator 호출 지점을 찾는다.
4. Paymaster RPC 파라미터 순서를 암기한다: `[userOp, entryPoint, chainId, context?]`.

---

## 1. Kernel (ERC-7579 Smart Account)

대상 파일: `poc-contract/src/erc7579-smartaccount/Kernel.sol`

### 1.1 핵심 라인

| 라인 | 함수 | 발표 포인트 |
|---|---|---|
| 111 | `initialize` | 최초 루트 validator 설정 + initConfig 배치 실행 |
| 235 | `validateUserOp` | nonce 디코딩, validator 선택, selector 접근 통제 |
| 295 | `executeUserOp` | EntryPoint 경유 실행, pre/post hook 호출 |
| 317 | `executeFromExecutor` | 등록된 executor만 실행 가능 |
| 338 | `execute` | EntryPoint/self/root만 실행 가능 |
| 342 | `installModule` | 모듈 타입별 분기 설치(validator/executor/fallback/hook/policy/signer) |
| 348 | validator branch | validator 설치 + selector grant |
| 369 | executor branch | executor + hook 설치 |
| 377 | fallback branch | selector 기반 fallback 설치 |
| 438 | `uninstallModule` | 모듈 타입별 제거 + 안전장치(root validator 제거 방지) |

### 1.2 함수별 설명

1. `initialize` (`Kernel.sol:111`)
- 이미 초기화된 계정인지 확인 (`AlreadyInitialized`).
- 루트 validator 타입을 검사해 root/permission 허용 범위를 고정.
- `initConfig[]`를 self-call로 실행해 초기 설치를 배치 처리.

2. `validateUserOp` (`Kernel.sol:235`)
- `userOp.nonce`에서 mode/type/id를 decode.
- root인지 plugin validator인지 분기.
- allowed selector를 확인해 validator 권한 범위를 강제.
- hook 필요 여부에 따라 `executeUserOp` 형식 강제.
- `missingAccountFunds`를 EntryPoint로 전송(실패 무시, 검증 책임은 EntryPoint).

3. `executeUserOp` (`Kernel.sol:295`)
- `executionHook[userOpHash]`로 hook context를 찾음.
- hook pre -> delegatecall 실행 -> hook post 순서.
- core 포인트: 실행 바디는 `userOp.callData[4:]`를 delegatecall.

4. `installModule` (`Kernel.sol:342`)
- `moduleType`으로 분기.
- validator 타입은 nonce/currentNonce 및 selector grant 처리.
- executor/fallback은 hook과 함께 설치되어 실행 정책과 연결.
- hook/policy/signer 타입은 독립 설치가 아니라 `onInstall` 강제 호출 형태.

5. `uninstallModule` (`Kernel.sol:438`)
- moduleType별 clear 로직.
- policy/signer 제거 시 root validator와 충돌하면 revert (`RootValidatorCannotBeRemoved`).
- 마지막에 `ModuleLib.uninstallModule(module, deInitData)` 호출.

### 1.3 발표용 한 줄
- "Kernel은 7579의 모듈 라우터이자, `validateUserOp`에서 validator/selector/hook을 조합해 실행 권한을 강제하는 계정 런타임이다."

---

## 2. EntryPoint (ERC-4337)

대상 파일: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`

### 2.1 핵심 라인

| 라인 | 함수 | 발표 포인트 |
|---|---|---|
| 89 | `handleOps` | 번들 진입점, validate->execute 루프 |
| 166 | `getUserOpHash` | EIP-7702 override initCode hash 지원 |
| 229 | `_executeUserOp` | 계정 호출 실행 + postExecution 연결 |
| 530 | `_validateAccountPrepayment` | account validation/prefund 체크 |
| 608 | `_validatePaymasterPrepayment` | paymaster validate + context 확보 |
| 770 | `_validatePrepayment` | prepayment 검증 오케스트레이션 |
| 825 | `_postExecution` | 최종 가스 정산, 환불/페널티 반영 |
| 974 | `simulateValidation` | 오프체인 시뮬레이션용 revert result |

### 2.2 함수별 설명

1. `handleOps` (`EntryPoint.sol:89`)
- 모든 UserOp를 먼저 검증 단계로 순회.
- 검증 통과 후 실행 단계 순회.
- 수집된 수수료를 beneficiary에 정산.

2. `_validatePrepayment` (`EntryPoint.sol:770`)
- UserOp를 memory struct로 복사.
- `getUserOpHash` 계산.
- 가스값 overflow 체크.
- 계정 prepayment 검증 -> nonce 업데이트 -> paymaster 검증.

3. `_executeUserOp` (`EntryPoint.sol:229`)
- `executeUserOp` selector이면 inner call로 감쌈.
- 실행 실패 유형(Out-of-gas, low-prefund 등)별로 분기 처리.
- 결국 `_postExecution`으로 가스 회계 통합.

4. `_postExecution` (`EntryPoint.sol:825`)
- 실제 사용 가스 + unused gas penalty 계산.
- paymaster 있으면 `postOp` 호출.
- prefund와 actualGasCost 비교 후 환불/실패 이벤트 처리.

5. `simulateValidation` (`EntryPoint.sol:974`)
- 온체인 상태를 바꾸지 않고 검증 결과를 리턴(실제 구현은 revert payload).
- Bundler 사전 검증의 핵심 기반.

### 2.3 발표용 한 줄
- "EntryPoint는 계정/Paymaster/Nonce를 표준화된 순서로 검증하고, 성공/실패를 가스 회계까지 포함해 최종 정산하는 4337 정산 엔진이다."

---

## 3. Bundler RPC Server

대상 파일: `stable-platform/services/bundler/src/rpc/server.ts`

### 3.1 핵심 라인

| 라인 | 함수 | 발표 포인트 |
|---|---|---|
| 169 | `/health` | 런타임 상태/메모풀 상태 노출 |
| 227 | `POST /` | JSON-RPC 단일/배치 요청 처리 |
| 291 | `eth_sendUserOperation` case | 제출 메서드 디스패치 |
| 294 | `eth_estimateUserOperationGas` case | 가스 추정 메서드 디스패치 |
| 300 | `eth_getUserOperationReceipt` case | receipt 조회 |
| 332 | `ethSendUserOperation` | entryPoint 체크 -> unpack -> validate -> mempool 추가 |
| 361 | `ethEstimateUserOperationGas` | unpack 후 estimator 호출 |
| 631 | `start()` listen | 서버 시작 포인트 |

### 3.2 함수별 설명

1. JSON-RPC 엔드포인트 (`server.ts:227`)
- `POST /`에서 단일/배치 둘 다 지원.
- method 별로 `callMethod` 스위치 분기.

2. `ethSendUserOperation` (`server.ts:332`)
- params는 `[packedOp, entryPoint]`.
- entryPoint allowlist 검증.
- `unpackUserOperation` 호출.
- validator 파이프라인 통과 후 mempool에 저장.

3. `ethEstimateUserOperationGas` (`server.ts:361`)
- 동일하게 `[packedOp, entryPoint]` 사용.
- unpack -> gasEstimator 결과 반환.

### 3.3 오해 방지
- Bundler는 packed 필드를 기본으로 받지만, unpack 유틸이 일부 unpacked 필드도 fallback 파싱한다.
- 실무 권장: SDK의 `packUserOperation` 출력 형태로 보내는 것이 가장 안전.

---

## 4. Bundler Validator Pipeline

대상 파일: `stable-platform/services/bundler/src/validation/validator.ts`

### 4.1 핵심 라인

| 라인 | 함수 | 발표 포인트 |
|---|---|---|
| 135 | `validate` | 전체 파이프라인 진입점 |
| 183 | `validateFormat` | 빠른 형식 검증 |
| 195 | `checkReputations` | sender/factory/paymaster 평판 체크 |
| 234 | `validateState` | nonce/account 존재 검증 |
| 245 | `validateNonce` | nonce key/sequence 범위 확인 |
| 316 | `validateSimulationResult` | signature/time/aggregator/stake 검증 |
| 300 | `validateOpcodes` | ERC-7562 opcode 제한 검증 |

### 4.2 파이프라인 설명

1. Format (`validator.ts:183`)
- RPC 호출 없이 즉시 reject 가능한 오류를 컷.

2. Reputation (`validator.ts:195`)
- sender/factory/paymaster 상태가 banned/throttled면 즉시 reject.

3. State (`validator.ts:234`)
- nonce 하한/상한(`maxNonceGap`) 검증.
- account가 없고 factory도 없으면 reject.

4. Simulation Result (`validator.ts:316`)
- signature/validity window 검사.
- aggregator 미지원 주소면 reject.
- 필요시 stake 정보 검사.

5. Opcode (`validator.ts:300`)
- 정책상 금지 opcode/패턴 검증.

### 4.3 발표용 한 줄
- "Bundler validator는 빠른 형식 컷 -> 상태/시뮬레이션 심사 -> 실행 안전성(opcode) 순으로 비용을 최소화하며 거절한다."

---

## 5. Paymaster Proxy RPC

대상 파일: `stable-platform/services/paymaster-proxy/src/app.ts`

### 5.1 핵심 라인

| 라인 | 함수 | 발표 포인트 |
|---|---|---|
| 160 | `POST /` | JSON-RPC 메인 엔드포인트 |
| 174 | `POST /rpc` | 호환 엔드포인트 |
| 275 | `pm_getPaymasterStubData` case | stub 데이터 발급 |
| 278 | `pm_getPaymasterData` case | 최종 서명 데이터 발급 |
| 307 | stub params parse | 파라미터 스키마 검증 |
| 316 | `[userOp, entryPoint, chainId, context]` | 파라미터 순서 핵심 |
| 351 | data params parse | final 데이터 스키마 검증 |
| 360 | `[userOp, entryPoint, chainId, context]` | 동일 순서 |

### 5.2 실무 핵심
- `chainId`는 hex 문자열(`0x...`)로 전달해야 스키마 통과.
- `context`는 옵션이지만, 존재할 경우 정책 엔진 입력으로 사용 가능.
- 서비스는 `/`와 `/rpc` 모두 지원.

---

## 6. 5개 파일을 하나로 묶는 실행 흐름

### 6.1 UserOp 제출(가스 자가 부담)

1. 클라이언트가 UserOp 생성.
2. Bundler `eth_sendUserOperation` 수신 (`server.ts:332`).
3. validator 파이프라인 실행 (`validator.ts:135`).
4. EntryPoint `handleOps`에서 검증+실행 (`EntryPoint.sol:89`).
5. Kernel `validateUserOp` -> `executeUserOp` (`Kernel.sol:235`, `Kernel.sol:295`).
6. EntryPoint `_postExecution` 정산 (`EntryPoint.sol:825`).

### 6.2 UserOp 제출(가스 대납)

1. 클라이언트가 paymaster stub 요청 (`app.ts:275`).
2. 가스 보정 후 final paymaster data 요청 (`app.ts:278`).
3. paymaster 필드 포함 UserOp를 bundler에 제출 (`server.ts:332`).
4. EntryPoint에서 `_validatePaymasterPrepayment` (`EntryPoint.sol:608`).
5. 실행 후 paymaster `postOp`/정산 (`EntryPoint.sol:825`).

---

## 7. 발표자가 반드시 답할 수 있어야 하는 질문

1. 왜 `Kernel.validateUserOp`에서 selector 권한 검증이 필요한가?
2. 왜 EntryPoint는 `_validatePrepayment`와 `_postExecution`을 분리했는가?
3. bundler가 받는 UserOp는 packed/unpacked 중 무엇이 기본인가?
4. paymaster RPC 파라미터 순서와 `chainId` 타입은 무엇인가?
5. module 설치가 실패했을 때 어디(커널/번들러/페이마스터)에서 먼저 관측되는가?

---

## 8. 발표 리허설 체크리스트

- `Kernel.sol` 111/235/295/342/438 라인을 코드 에디터로 즉시 점프 가능.
- `EntryPoint.sol` 89/770/825/974 라인을 2분 내 설명 가능.
- bundler/paymaster RPC 파라미터를 샘플 JSON으로 즉시 작성 가능.
- "EOA -> 7702 -> 4337 UserOp -> 7579 모듈 실행" 1문장 연결 설명 가능.
