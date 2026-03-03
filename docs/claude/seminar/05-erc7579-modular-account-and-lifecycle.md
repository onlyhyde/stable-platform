# 05. ERC-7579: 모듈형 계정과 Lifecycle (상세판)

## 1) ERC-7579가 필요한 이유

4337은 UserOp 파이프라인을 제공하지만, Account 내부를 어떻게 확장/정책화할지까지 표준화하지는 않는다. 7579는 이 공백을 메우는 모듈형 Account 인터페이스다.

## 2) Kernel 기반 계정 구조

본 프로젝트의 Account는 Kernel(`kernel.advanced.0.3.3`)이다.

코드:

- `poc-contract/src/erc7579-smartaccount/Kernel.sol`

핵심 책임:

- `validateUserOp` (4337 검증 엔트리)
- `executeUserOp` (4337 bridge)
- `execute(ExecMode, executionCalldata)` (7579 실행 엔트리)
- 모듈 lifecycle 관리

## 3) 모듈 타입

- Validator (1)
- Executor (2)
- Fallback (3)
- Hook (4)

모듈 타입별 호출 타이밍을 반드시 분리 설명한다.

## 4) Execution Mode

- SINGLE / BATCH / DELEGATECALL 중심
- Kernel은 STATIC mode를 지원하지 않도록 명시되어 있음
- 코드: `supportsExecutionMode` 구현 참고

## 5) 4337-7579 브리지 포인트

### 5.1 `validateUserOp`

- 4337 validationData 포맷을 만족해야 함
- 내부적으로 7579 validator 라우팅 수행
- nonce key space를 validator 식별과 결합해 사용

### 5.2 `executeUserOp`

- EntryPoint only
- `userOp.callData[4:]`를 self-delegatecall해 `execute` 경로로 브리지
- hook pre/post 패턴을 강제

## 6) 모듈 Lifecycle (핵심)

### 6.1 Install

- `installModule(type, module, initData)`
- Wallet Extension은 `buildKernelInstallData`로 Kernel v3 포맷 래핑 후 UserOp로 실행

### 6.2 Uninstall

- `uninstallModule`은 모듈 `onUninstall` 실패 시 revert
- 안정성은 높지만, 악성/고장 모듈 제거가 막힐 수 있음

### 6.3 Force Uninstall

- `forceUninstallModule`은 상태를 먼저 정리 후 safe-call
- 모듈 언인스톨 훅 실패를 무시하고 제거 지속

### 6.4 Replace (Atomic)

- `replaceModule`은 old 제거 + new 설치를 원자적으로 처리
- new 설치 실패 시 전체 revert

## 7) Fallback sender-context 이슈와 해결

Kernel fallback은 EntryPoint 호출 컨텍스트에서 `msg.sender` 왜곡 문제가 있다. 이를 보완하기 위해 CALLTYPE_SINGLE fallback에서 ERC-2771 스타일 sender append 방식을 사용한다.

코드 주석 근거:

- `poc-contract/src/erc7579-smartaccount/Kernel.sol` fallback 섹션

## 8) 보안/운영 제어 포인트

- Hook gas limit
- Delegatecall whitelist + enforce 플래그
- module operation reentrancy lock

## 9) Wallet/SDK에서 실제 사용하는 모듈 RPC

- `stablenet_installModule`
- `stablenet_uninstallModule`
- `stablenet_forceUninstallModule`
- `stablenet_replaceModule`

관련 코드:

- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- `stable-platform/packages/sdk-ts/core/src/modules/operationClient.ts`

## 10) 실무 실패 포인트

- fallback 타입일 때 `additionalContext`에 selector 누락
- validator/hook install initData 포맷 혼동
- uninstall 실패를 단순 재시도로 해결하려고 시도
- forceUninstall이 필요한 상황 판단 실패

## 11) 세미나 전달 문장

- "7579는 기능 확장 스펙이 아니라, 운영 가능한 계정 아키텍처 스펙이다."
- "모듈 lifecycle을 이해하지 못하면 제품 운영 중 장애를 복구할 수 없다."
