# 11) 코드 전수 이해용 마스터 가이드 (세미나 준비용)

## 문서 목적
이 문서는 아래 목적을 위해 작성되었습니다.
- 발표자 본인이 코드 기준으로 전체 구조를 설명할 수 있도록 학습 순서를 고정한다.
- EIP-7702, ERC-4337, ERC-7579를 "트랜잭션 생성/전송" 관점으로 연결한다.
- 온램프/PG/구독(은행/결제 더미 서버 포함) 시나리오를 백엔드-컨트랙트-프론트 흐름으로 연결한다.

핵심 원칙:
- 문서보다 코드를 기준으로 설명한다.
- 기능 설명은 반드시 "어느 파일의 어떤 책임"인지와 함께 말한다.

---

## 1. 전체 구성 맵 (요청하신 6개 영역)

### 1) 컨트랙트
- `poc-contract/src/`
- 핵심:
  - EntryPoint(4337): `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`
  - Kernel(7579 Smart Account): `poc-contract/src/erc7579-smartaccount/Kernel.sol`
  - Paymaster: `poc-contract/src/erc4337-paymaster/`

### 2) 백엔드 서비스
- `stable-platform/services/`
- 핵심:
  - Bundler: `stable-platform/services/bundler/src/`
  - Paymaster Proxy: `stable-platform/services/paymaster-proxy/src/`
  - Subscription Executor: `stable-platform/services/subscription-executor/`
  - Onramp/PG/Bank Simulator: `stable-platform/services/onramp-simulator/`, `stable-platform/services/pg-simulator/`, `stable-platform/services/bank-simulator/`

### 3) 프론트엔드
- `stable-platform/apps/`
- 핵심:
  - Web App: `stable-platform/apps/web/`
  - Wallet Extension: `stable-platform/apps/wallet-extension/`

### 4) SDK
- `stable-platform/packages/sdk-ts/`
- `stable-platform/packages/wallet-sdk/`
- `stable-platform/packages/sdk-go/`

### 5) 로컬 노드 프로젝트
- `go-stablenet/`

### 6) 로컬 노드 구성 스크립트
- `node-test-scripts/script/`

---

## 2. 표준별 책임 분해

### EIP-7702 (EOA -> Delegated Account)
- 권한서명/업그레이드 UX:
  - `stable-platform/apps/web/hooks/useSmartAccount.ts`
  - `stable-platform/apps/web/app/smart-account/page.tsx`
- 트랜잭션 빌더:
  - `stable-platform/packages/sdk-ts/core/src/transaction/eip7702Transaction.ts`
  - `stable-platform/packages/sdk-ts/core/src/transaction/strategies/eip7702Strategy.ts`
- 지갑 RPC:
  - `stable-platform/packages/wallet-sdk/src/rpc/index.ts`
  - `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`

### ERC-4337 (UserOperation)
- 온체인 엔트리:
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`
    - `handleOps`, `_validatePrepayment`, `_validateAccountPrepayment`, `simulateValidation`
- Bundler RPC/검증:
  - `stable-platform/services/bundler/src/rpc/server.ts`
  - `stable-platform/services/bundler/src/validation/validator.ts`
- SDK 송신 경로:
  - `stable-platform/packages/sdk-ts/core/src/clients/smartAccountClient.ts`
  - `stable-platform/packages/sdk-ts/core/src/transaction/strategies/smartAccountStrategy.ts`

### ERC-7579 (모듈형 Smart Account)
- 온체인 커널:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol`
    - `validateUserOp`, `execute`, `installModule`, `uninstallModule`
- 모듈 타입 상수:
  - `poc-contract/src/erc7579-smartaccount/types/Constants.sol`
- 웹 설치 UX:
  - `stable-platform/apps/web/hooks/useModuleInstall.ts`
  - `stable-platform/apps/web/lib/moduleAddresses.ts`
  - `stable-platform/apps/web/app/marketplace/page.tsx`
- SDK 모듈 오퍼레이션:
  - `stable-platform/packages/sdk-ts/core/src/modules/moduleClient.ts`
  - `stable-platform/packages/sdk-go/modules/operation_client.go`

### ERC-7715/권한형 정기결제 (프로젝트 확장)
- 웹 권한/구독:
  - `stable-platform/apps/web/hooks/useSubscription.ts`
- Executor API/실행:
  - `stable-platform/services/subscription-executor/api/openapi.yaml`
  - `stable-platform/services/subscription-executor/internal/service/executor.go`
  - `stable-platform/services/subscription-executor/internal/client/userop.go`

---

## 3. 핵심 End-to-End 플로우

### 플로우 A: EOA를 Smart Account로 전환 (7702)
1. Web에서 `wallet_signAuthorization` 호출
- `stable-platform/apps/web/hooks/useSmartAccount.ts`
2. 서명 결과를 `authorizationList`로 넣어 tx 전송
- `sendTransaction({ to: address, data: '0x', authorizationList: [...] })`
3. 체인에서 EOA 코드가 delegation prefix를 가지게 됨
- prefix 관련 상수: `poc-contract/src/erc7579-smartaccount/types/Constants.sol`
4. 이후 Smart Account 기능(모듈/배치/후원 가스) 사용 가능

### 플로우 B: UserOperation 전송 (4337)
1. callData 인코딩 (대상 함수 호출)
2. nonce/가스 추정/수수료 산정
3. (선택) paymaster stub -> gas estimate -> final paymaster data
4. userOpHash 서명
5. `eth_sendUserOperation` 호출
6. Bundler가 검증 후 mempool 반영, 배치 제출
7. `eth_getUserOperationReceipt`로 결과 확인

코드 연결:
- 클라이언트 조립: `stable-platform/packages/sdk-ts/core/src/clients/smartAccountClient.ts`
- Bundler RPC: `stable-platform/services/bundler/src/rpc/server.ts`
- 검증 파이프라인: `stable-platform/services/bundler/src/validation/validator.ts`

### 플로우 C: ERC-7579 모듈 설치
1. 설치할 모듈 주소/타입/initData 선택
- `stable-platform/apps/web/lib/moduleAddresses.ts`
2. Smart Account 자기호출 calldata 생성 (`installModule`)
- `stable-platform/apps/web/hooks/useModuleInstall.ts`
- `stable-platform/packages/sdk-go/modules/operation_client.go`
3. 설치 tx 또는 userOp로 전송
4. Kernel `installModule`에서 타입별 분기 설치
- `poc-contract/src/erc7579-smartaccount/Kernel.sol`

### 플로우 D: 가스 대납 (Paymaster)
1. `pm_getPaymasterStubData`
2. Bundler 가스 추정 반영
3. `pm_getPaymasterData` (최종 서명 데이터)
4. userOp에 paymaster 필드 세팅 후 전송

코드:
- Paymaster API 라우팅: `stable-platform/services/paymaster-proxy/src/app.ts`
- 핸들러: `stable-platform/services/paymaster-proxy/src/handlers/getPaymasterStubData.ts`, `stable-platform/services/paymaster-proxy/src/handlers/getPaymasterData.ts`
- 정책: `stable-platform/services/paymaster-proxy/src/policy/sponsorPolicy.ts`

### 플로우 E: 온램프/PG/은행 시뮬레이터
1. 온램프 quote 생성
2. order 생성 (결제수단 card/bank 분기)
3. PG 또는 은행 더미 서비스 처리
4. webhook/callback로 상태 전이
5. 최종적으로 crypto transfer 완료 또는 환불

코드:
- Onramp 라우트: `stable-platform/services/onramp-simulator/internal/handler/onramp.go`
- Onramp 오더 처리: `stable-platform/services/onramp-simulator/internal/service/onramp.go`
- PG 결제 처리: `stable-platform/services/pg-simulator/internal/service/payment.go`
- Bank 계좌/이체/debit: `stable-platform/services/bank-simulator/internal/handler/bank.go`

### 플로우 F: PG 웹 결제 시나리오
- Checkout session 생성 -> 결제 진행 -> 3DS/redirect -> 승인/실패/환불 후 webhook 전파
- 코드:
  - `stable-platform/services/pg-simulator/internal/handler/payment.go`
  - `stable-platform/services/pg-simulator/internal/service/payment.go`

### 플로우 G: 구독 자동결제 시나리오
1. 사용자 permission 승인 (ERC-7715)
- `stable-platform/apps/web/hooks/useSubscription.ts`
2. 구독 생성/활성화
3. executor가 due subscription poll
- `stable-platform/services/subscription-executor/internal/service/executor.go`
4. executor가 userOp 생성/서명/전송
- `stable-platform/services/subscription-executor/internal/client/userop.go`
5. receipt 반영 및 실행 이력 업데이트

---

## 4. 트랜잭션을 "어떻게 만들고 보내는지" (실무 기준)

### 4.1 7702 SetCode 트랜잭션
필수 요소:
- `authorizationList[]`: `{chainId, address(delegate), nonce, r,s,v(or yParity)}`
- 실제 전송 tx는 account 본인이 보내거나(relayer 포함) 지갑이 대행

코드 레퍼런스:
- 빌드/서명/전송: `stable-platform/packages/sdk-ts/core/src/transaction/eip7702Transaction.ts`
- 웹 훅: `stable-platform/apps/web/hooks/useSmartAccount.ts`

### 4.2 4337 UserOperation
실무 필드 구성 순서:
1. `sender`, `nonce`, `callData` 준비
2. `callGasLimit`, `verificationGasLimit`, `preVerificationGas` 추정
3. `maxFeePerGas`, `maxPriorityFeePerGas` 설정
4. paymaster가 있으면 stub/final 데이터 반영
5. `signature` 생성
6. `eth_sendUserOperation`

코드 레퍼런스:
- `stable-platform/packages/sdk-ts/core/src/clients/smartAccountClient.ts`
- `stable-platform/apps/web/hooks/useUserOp.ts`
- `stable-platform/services/bundler/src/rpc/server.ts`

### 4.3 7579 installModule calldata
- 대상은 Smart Account 자신 (`to = smartAccount`)
- `data = installModule(moduleType, moduleAddress, initData)`
- initData는 모듈 타입별 포맷이 다름

코드 레퍼런스:
- `poc-contract/src/erc7579-smartaccount/Kernel.sol`
- `stable-platform/apps/web/hooks/useModule.ts`
- `stable-platform/packages/sdk-go/modules/operation_client.go`

---

## 5. 발표 전 학습 순서 (권장)

### Phase 1: 핵심 표준 축 고정 (반드시)
1. `poc-contract/src/erc7579-smartaccount/Kernel.sol`
2. `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`
3. `stable-platform/services/bundler/src/rpc/server.ts`
4. `stable-platform/services/bundler/src/validation/validator.ts`
5. `stable-platform/services/paymaster-proxy/src/app.ts`

### Phase 2: 제품 플로우 축 고정
1. `stable-platform/apps/web/hooks/useSmartAccount.ts`
2. `stable-platform/apps/web/hooks/useModuleInstall.ts`
3. `stable-platform/apps/web/hooks/useSubscription.ts`
4. `stable-platform/services/subscription-executor/internal/service/executor.go`
5. `stable-platform/services/onramp-simulator/internal/service/onramp.go`
6. `stable-platform/services/pg-simulator/internal/service/payment.go`

### Phase 3: SDK/지갑 확장 축 고정
1. `stable-platform/packages/sdk-ts/core/src/transaction/transactionRouter.ts`
2. `stable-platform/packages/sdk-ts/core/src/transaction/strategies/smartAccountStrategy.ts`
3. `stable-platform/packages/wallet-sdk/src/rpc/index.ts`
4. `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`

---

## 6. 로컬 실습 루프 (세미나 데모 리허설)

### A. 플랫폼 기본 스택
- 작업 위치: `stable-platform/`
- 권장 순서:
1. `make install`
2. `make anvil` (별도 터미널)
3. `make dev-setup`
4. `make docker-dev` 또는 `make docker-up`
5. 상태 확인: `make health`

참고:
- 스크립트/포트는 `stable-platform/Makefile`, `stable-platform/docker-compose.yml`, `stable-platform/docker-compose.yaml` 기준으로 확인

### B. 컨트랙트 단독 검증
- 작업 위치: `poc-contract/`
- `forge build`
- `forge test -vvv`

### C. 로컬 체인(go-stablenet) 검증
- 작업 위치: `node-test-scripts/script/`
1. `./init_genesis.sh`
2. `./run_gstable.sh`
3. `./attach.sh 1` (콘솔 접속)
4. preload 함수로 트랜잭션 발행/검증 (`script/javascript/sendTx.js`)

---

## 7. 세미나 청중별 설명 포인트

### 기획자
- "사용자 여정" 기준으로 설명
- 핵심 메시지: EOA를 버리지 않고(7702) Smart Account UX를 단계 도입
- 근거 코드:
  - `stable-platform/apps/web/app/smart-account/page.tsx`
  - `stable-platform/apps/web/app/marketplace/page.tsx`

### 사업/사업계획
- "수익/운영" 기준으로 설명
- 핵심 메시지:
  - 가스 대납 정책화(paymaster policy)
  - PG/온램프 시뮬레이터로 운영 시나리오 검증
  - 구독 자동결제로 반복 매출 시나리오 검증
- 근거 코드:
  - `stable-platform/services/paymaster-proxy/src/policy/sponsorPolicy.ts`
  - `stable-platform/services/onramp-simulator/internal/service/onramp.go`
  - `stable-platform/services/subscription-executor/internal/service/executor.go`

### 개발자
- "트랜잭션 파이프라인" 기준으로 설명
- 핵심 메시지:
  - 7702 tx와 4337 userOp는 경쟁이 아니라 역할 분담
  - 7579 모듈은 계정 기능을 런타임 확장
- 근거 코드:
  - `stable-platform/packages/sdk-ts/core/src/transaction/`
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol`
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`

---

## 8. 발표 전에 반드시 답할 수 있어야 하는 질문 체크리스트

1. 왜 7702와 4337을 함께 쓰는가?
2. 7702 업그레이드/리보크 tx 구조는 무엇인가?
3. userOp의 필수 필드와 생성 순서는?
4. paymaster stub/final 2단계를 왜 나누는가?
5. module install 시 self-call을 쓰는 이유는?
6. 구독 자동결제에서 permission(7715)와 executor 역할 분리는 어떻게 되는가?
7. 온램프/PG/은행 더미 시나리오에서 실패 시 상태 전이는?
8. 로컬 devnet(31337)과 StableNet local(8283)의 역할 차이는?

---

## 9. 같이 보면 좋은 기존 문서
- `stable-platform/docs/seminar-7702-4337-7579/00-overview.md`
- `stable-platform/docs/seminar-7702-4337-7579/03-how-to-use-7702-kernel-smart-account.md`
- `stable-platform/docs/seminar-7702-4337-7579/04-7702-7579-with-4337.md`
- `stable-platform/docs/seminar-7702-4337-7579/07-install-and-use-7579-modules.md`
- `stable-platform/docs/seminar-7702-4337-7579/10-seminar-playbook.md`
- `stable-platform/docs/SMART_WALLET_ARCHITECTURE.md`
- `stable-platform/docs/services/README.md`
- `stable-platform/docs/simulator/README.md`
- `poc-contract/README.md`
- `poc-contract/docs/ko/README.md`

