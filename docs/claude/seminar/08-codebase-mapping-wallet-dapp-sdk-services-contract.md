# 08. 코드베이스 매핑: Wallet / DApp / SDK / Services / Contract (상세판)

## 1) 레이어별 책임 요약

- Wallet Extension
- 사용자 승인/서명, RPC 핸들링, UserOp/7702 전송 관문

- DApp Web
- 사용자 시나리오 UX, intent 생성, 지갑/SDK 호출

- SDK (TS/Go)
- 재사용 가능한 트랜잭션 생성/해시/패킹/클라이언트 로직

- Wallet SDK
- DApp <-> Wallet 연결 표준화, 이벤트 동기화

- Services (Bundler/Paymaster Proxy)
- 오프체인 검증/라우팅/정산 보조

- Contracts (EntryPoint/Kernel/Paymaster)
- 최종 검증/실행/정산의 신뢰 루트

## 2) 경로 맵

- Wallet
- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- `stable-platform/apps/wallet-extension/src/background/rpc/paymaster.ts`

- DApp
- `stable-platform/apps/web/hooks/useSmartAccount.ts`
- `stable-platform/apps/web/hooks/useUserOp.ts`
- `stable-platform/apps/web/hooks/useModuleInstall.ts`

- SDK TS
- `stable-platform/packages/sdk-ts/core/src/utils/userOperation.ts`
- `stable-platform/packages/sdk-ts/core/src/clients/bundlerClient.ts`
- `stable-platform/packages/sdk-ts/core/src/modules/operationClient.ts`

- SDK Go
- `stable-platform/packages/sdk-go/core/userop/packing.go`
- `stable-platform/packages/sdk-go/core/userop/hash.go`
- `stable-platform/packages/sdk-go/transaction/strategies/smart_account.go`

- Wallet SDK
- `stable-platform/packages/wallet-sdk/src/bundler/index.ts`
- `stable-platform/packages/wallet-sdk/src/hooks/useUserOpReceipt.ts`

- Services
- `stable-platform/services/bundler/src/rpc/server.ts`
- `stable-platform/services/paymaster-proxy/src/app.ts`

- Contracts
- `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`
- `poc-contract/src/erc7579-smartaccount/Kernel.sol`
- `poc-contract/src/erc4337-paymaster/*.sol`

## 3) 트랜잭션 생성 책임 분해

### 3.1 7702 Type-4

- 생성/서명/전송 핵심: Wallet Extension
- DApp는 delegate 주소와 UX 트리거 제공

### 3.2 4337 UserOp

- DApp: intent(to/value/data)
- Wallet/SDK: callData 인코딩, nonce/gas/paymaster/서명
- Bundler: 수신 및 온체인 제출
- EntryPoint: validate/execute/postOp

### 3.3 7579 모듈

- DApp: 설치 요청
- Wallet/SDK: module calldata 생성 + UserOp 포장
- Kernel: 실제 lifecycle 적용

## 4) 레이어 간 인터페이스 계약

- DApp -> Wallet
- `wallet_delegateAccount`, `wallet_signAuthorization`, `eth_sendUserOperation`, `stablenet_*Module`

- Wallet -> Bundler
- `eth_estimateUserOperationGas`, `eth_sendUserOperation`, receipt 조회

- Wallet -> Paymaster Proxy
- `pm_getPaymasterStubData`, `pm_getPaymasterData`

- Bundler -> EntryPoint
- `handleOps` / `handleAggregatedOps`

## 5) 이번 검토에서 확인한 주요 정합 포인트

PASS:

- TS SDK UserOp pack/hash는 EntryPoint v0.9 방향과 정합
- Wallet Extension의 UserOp 전처리/서명/paymaster 연동 흐름이 문서화 가능 수준
- Bundler의 byHash/receipt 조회 fallback(on-chain log 검색) 구현 존재

주의/보강 필요:

- `stable-platform/packages/sdk-go/transaction/strategies/smart_account.go`
- 기본 EntryPoint 주석/상수가 과거 맥락으로 보이며, 현재 v0.9 중심 설명과 불일치 소지
- nonce 처리에 placeholder(0) 경로가 남아 있어 실사용 시 보강 필요
- paymaster 연동이 stub 중심으로 보여 final-data 단계 정렬 검토 필요

세미나에서는 위 항목을 "현 코드 갭"으로 명확히 공개하고, TS 기준 경로를 실습 기준으로 제시한다.

## 6) 추천 코드 스터디 순서

1. EntryPoint `getUserOpHash`, `_validatePrepayment`, `_postExecution`
2. Kernel `validateUserOp`, `executeUserOp`, `install/uninstall/force/replace`
3. Wallet `eth_sendUserOperation`, `wallet_delegateAccount`
4. Bundler RPC server
5. Paymaster Proxy 2-phase
6. SDK TS hash/packing

## 7) 발표에서 전달할 아키텍처 메시지

- "DApp은 의도를 만들고, SDK는 메시지를 구성하고, Wallet은 서명하며, Services는 전달/정책을 담당하고, Contract가 최종 진실을 결정한다."
- "문제가 생기면 레이어 책임 기준으로 역추적해야 한다."
