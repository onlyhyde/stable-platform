# 00. 세미나 목표와 의사결정 프레임 (v2, 상세판)

## 1) 세미나의 최종 목적

이 세미나는 단순 소개 세션이 아니라, 개발자가 다음을 실제로 할 수 있게 만드는 기술 온보딩 세션이다.

- Smart Account 구조를 "개념"이 아니라 "구현 단위"로 설명할 수 있다.
- EIP-4337, EIP-7702, ERC-7579의 역할 경계를 구분할 수 있다.
- 트랜잭션/유저오퍼레이션 생성 시 파라미터를 어디에 넣어야 하는지 실수 없이 구현할 수 있다.
- 스펙 준수와 제품 편차(의도적 deviation) 의사결정을 분리해 설명할 수 있다.

핵심 전제:

- EntryPoint는 **v0.9**를 기준으로 설명한다.
- 7702 위임 대상 Account는 **ERC-7579 Kernel Smart Account**를 사용한다.
- 구현 근거는 문서만이 아니라 실제 코드(`wallet-extension`, `web`, `sdk-ts`, `sdk-go`, `services`, `poc-contract`)로 검증한다.

## 2) 반드시 전달해야 하는 핵심 메시지

1. EVM에서 네이티브 Tx의 주체는 EOA이지만, 제품 요구는 EOA만으로 충족되지 않는다.
2. ERC-4337은 "UserOp를 Tx처럼 다루기 위한 계약-레벨 실행 스킴"이다.
3. EIP-7702는 EOA를 버리는 것이 아니라, EOA에 "위임 가능한 코드 실행 경로"를 추가한다.
4. ERC-7579는 Account 내부 확장(Validator/Executor/Hook/Fallback) 표준화로 제품 확장성을 만든다.
5. 세 표준을 합치면, 가스 정책/권한 정책/실행 정책을 분리한 실무 아키텍처가 가능해진다.
6. 스펙을 정확히 이해한 뒤에만, 제품 목적의 비준수(편차) 의사결정이 가능하다.

## 3) 발표 논리의 고정 흐름

세미나 스토리라인은 다음 순서를 고정한다.

1. EOA 한계와 문제 정의
2. ERC-4337 도입 배경, Actor, 처리 흐름
3. ERC-4337 v0.6 -> v0.9 변천과 이유
4. EIP-7702 위임/Authorization/Type-4 Tx
5. ERC-7579 모듈형 계정과 Lifecycle
6. 수수료 모델(Self/Sponsor/ERC-20)
7. 코드 기반 트랜잭션 생성 방법(파라미터 위치)
8. PoC 실습/데모/장애 복구
9. 제품화 의사결정 프레임

## 4) 설계 의사결정 프레임

아래 질문으로 모든 기술 선택을 설명한다.

- 문제: 어떤 사용자/제품 문제를 해결하려는가?
- 표준 축: 4337/7702/7579 중 무엇으로 해결하는가?
- 책임 분리: Wallet, DApp, SDK, Bundler, Paymaster, Account 중 누가 책임지는가?
- 파라미터 위치: 어떤 필드를 어느 레이어에서 주입/검증하는가?
- 실패 복구: 실패 시 어디서 재시도/보상/정산하는가?
- 운영/보안: 스펙 준수 범위와 제품 편차를 어떻게 기록하는가?

## 5) 이 문서 세트에서 사용하는 증거 소스

스펙 정본:

- `stable-platform/docs/claude/spec/EIP-4337_스펙표준_정리.md`
- `stable-platform/docs/claude/spec/EIP-4337_Paymaster_개발자_구현가이드.md`
- `stable-platform/docs/claude/spec/EIP-7579_스펙표준_정리.md`
- `stable-platform/docs/claude/spec/EIP-7702_스펙표준_정리.md`
- `stable-platform/docs/claude/spec/EIP-4337_7579_통합_스펙준수_보고서.md`
- `stable-platform/docs/claude/spec/ERC4337_EIP7702_COMPLETE_FLOW.md`
- `stable-platform/docs/claude/spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM.md`

코드 근거:

- Wallet: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- DApp: `stable-platform/apps/web/hooks/useSmartAccount.ts`, `stable-platform/apps/web/hooks/useUserOp.ts`
- SDK(TS): `stable-platform/packages/sdk-ts/core/src/utils/userOperation.ts`
- SDK(Go): `stable-platform/packages/sdk-go/core/userop/hash.go`
- Bundler: `stable-platform/services/bundler/src/rpc/server.ts`
- Paymaster Proxy: `stable-platform/services/paymaster-proxy/src/app.ts`
- Contract: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`, `poc-contract/src/erc7579-smartaccount/Kernel.sol`

## 6) 세미나 성공 기준 (Definition of Done)

세미나 종료 시 청중이 아래 6개를 스스로 할 수 있어야 한다.

1. `eth_sendUserOperation`에 필요한 최소 필드를 구성할 수 있다.
2. 7702 위임 Tx의 `authorizationList`와 nonce 규칙을 설명할 수 있다.
3. 7579 모듈 설치/해제/강제해제/교체의 차이를 설명할 수 있다.
4. Self-paid와 Paymaster 후원의 정산 차이를 설명할 수 있다.
5. 실패 케이스를 로그 기준으로 진단할 수 있다.
6. 제품 편차를 "의도/영향/롤백"으로 문서화할 수 있다.

## 7) 발표자가 계속 확인할 체크포인트

- 개념 설명마다 코드 근거를 붙였는가?
- 파라미터 설명마다 JSON-RPC 예시를 제시했는가?
- 성공 플로우뿐 아니라 실패/복구 플로우를 포함했는가?
- "왜 이 변화가 생겼는가"를 버전 맥락으로 설명했는가?
- 스펙 준수와 운영 정책(편차)을 분리해서 설명했는가?

## 8) 다음 문서 읽기 순서

1. `01-evm-account-model-and-eoa-limit.md`
2. `02-erc4337-philosophy-actors-and-flow.md`
3. `03-erc4337-version-history-v06-to-v09.md`
4. `04-eip7702-delegation-and-type4-transaction.md`
5. `05-erc7579-modular-account-and-lifecycle.md`
6. `06-fee-models-self-sponsored-erc20-settlement.md`
7. `07-transaction-cookbook-wiring-guide.md`
8. `08-codebase-mapping-wallet-dapp-sdk-services-contract.md`
9. `09-poc-demo-script-and-failure-recovery.md`
10. `10-productization-decision-and-spec-deviation-framework.md`
11. `11-seminar-lab-checklist-and-qa.md`
