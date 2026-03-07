# 13) 90분 세미나 발표 대본 (기획/사업/개발 통합 청중용)

## 세션 목표
90분 안에 다음을 청중이 이해하도록 설계합니다.

1. 왜 EIP-7702 + ERC-4337 + ERC-7579 조합이 필요한가
2. 실제 코드에서 어떤 컴포넌트가 어떤 책임을 갖는가
3. 제품 씬(모듈, 가스대납, 온램프, PG, 구독자동결제)을 어떤 트랜잭션 흐름으로 구현하는가

---

## 시간표 (총 90분)

- 0~10분: 문제 정의와 사업 임팩트
- 10~25분: 표준 핵심 구조(7702/4337/7579)
- 25~45분: 코드 아키텍처 투어(컨트랙트/백엔드/프론트/SDK)
- 45~65분: 실거래 플로우(모듈 설치, paymaster, 온램프/PG)
- 65~80분: 데모 시나리오
- 80~90분: 리스크/운영/로드맵 + Q&A

---

## 0~10분: 문제 정의와 사업 임팩트

### 발표 멘트
"기존 EOA UX는 사용자가 가스, nonce, 권한 관리를 직접 처리해야 해서 전환율과 재방문율에 불리합니다. 우리 목표는 주소는 유지하면서(EIP-7702), 실행은 자동화하고(ERC-4337), 권한은 모듈화(ERC-7579)하는 것입니다."

### 청중별 포인트
- 기획자: 사용자 onboarding friction 감소
- 사업 담당: 결제/구독/온램프 전환율 지표 개선
- 개발자: 권한 정책을 모듈로 분리해 릴리즈 속도 개선

### 슬라이드 키워드
- "주소 연속성"
- "가스 비용 추상화"
- "모듈 기반 권한 분리"

---

## 10~25분: 표준 핵심 구조

### 발표 멘트
"7702는 EOA를 버리지 않고 스마트 계정처럼 동작시키는 입구이고, 4337은 UserOperation 실행 인프라, 7579는 계정 내부 권한/실행 정책의 확장 프레임워크입니다."

### 코드 근거를 함께 제시할 포인트

1. 7702 delegation prefix
- `poc-contract/src/erc7579-smartaccount/types/Constants.sol:51`

2. 4337 번들 진입
- `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:89`

3. 7579 계정 검증/실행
- `poc-contract/src/erc7579-smartaccount/Kernel.sol:235`
- `poc-contract/src/erc7579-smartaccount/Kernel.sol:295`

### 한 문장 요약
- "7702는 계정 상태 전환, 4337은 실행/정산, 7579는 계정 내부 정책 엔진이다."

---

## 25~45분: 코드 아키텍처 투어

### 1) 컨트랙트 레이어

발표 멘트:
"EntryPoint는 모든 UserOp를 검증/정산하고, Kernel은 실제 계정 권한과 실행 경로를 결정합니다."

핵심 라인:
- `EntryPoint.handleOps`: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:89`
- `EntryPoint._validatePrepayment`: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:770`
- `EntryPoint._postExecution`: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:825`
- `Kernel.installModule`: `poc-contract/src/erc7579-smartaccount/Kernel.sol:342`

### 2) 백엔드 레이어

발표 멘트:
"Bundler는 UserOp 관문이고, Paymaster Proxy는 후원 정책 집행점입니다."

핵심 라인:
- bundler method dispatch: `stable-platform/services/bundler/src/rpc/server.ts:291`
- sendUserOp 검증 연계: `stable-platform/services/bundler/src/rpc/server.ts:332`
- validator 파이프라인: `stable-platform/services/bundler/src/validation/validator.ts:135`
- paymaster RPC dispatch: `stable-platform/services/paymaster-proxy/src/app.ts:275`

### 3) 프론트/지갑/SDK 레이어

발표 멘트:
"프론트는 시나리오를 조립하고, SDK는 패킷을 만들고, 지갑은 최종 서명을 수행합니다."

핵심 라인:
- 7702 훅: `stable-platform/apps/web/hooks/useSmartAccount.ts:253`
- UserOp 제출 훅: `stable-platform/apps/web/hooks/useUserOp.ts:232`
- Router 전략 선택: `stable-platform/packages/sdk-ts/core/src/transaction/transactionRouter.ts:97`
- wallet_signAuthorization: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:752`

---

## 45~65분: 실거래 플로우 설명

### 플로우 A: EOA -> Smart Account 전환

발표 멘트:
"사용자는 먼저 authorization을 서명하고, 그 결과를 tx의 `authorizationList`에 넣어 전송합니다."

코드 포인트:
- `wallet_signAuthorization`: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:755`
- `eth_sendTransaction` + `authorizationList`: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1322`

### 플로우 B: 모듈 설치(7579)

발표 멘트:
"모듈 설치는 결국 `installModule` calldata를 UserOp로 싸서 bundler에 전달하는 과정입니다."

코드 포인트:
- 지갑 RPC: `stablenet_installModule` `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1769`
- 커널 설치 함수: `poc-contract/src/erc7579-smartaccount/Kernel.sol:342`

### 플로우 C: 가스 대납

발표 멘트:
"paymaster는 2단계(stub -> final)로 sponsor 데이터를 채웁니다."

코드 포인트:
- stub 호출: `stable-platform/apps/wallet-extension/src/background/rpc/paymaster.ts:78`
- final 호출: `stable-platform/apps/wallet-extension/src/background/rpc/paymaster.ts:96`
- 서버 파싱: `stable-platform/services/paymaster-proxy/src/app.ts:316`

### 플로우 D: 온램프/PG/구독

발표 멘트:
"온램프/PG/은행 더미는 결제/정산 상태 전이를 검증하는 실험 환경입니다. 최종 체인 반영은 UserOp 경로로 연결됩니다."

코드 영역:
- onramp: `stable-platform/services/onramp-simulator/`
- pg: `stable-platform/services/pg-simulator/`
- bank: `stable-platform/services/bank-simulator/`
- subscription executor: `stable-platform/services/subscription-executor/`

---

## 65~80분: 데모 대본

## 데모 1 (8분): 7702 전환

진행 멘트:
1. "지금 이 계정은 일반 EOA 상태입니다."
2. "`wallet_signAuthorization` 호출로 delegation 서명을 받겠습니다."
3. "이제 authorizationList 포함 트랜잭션을 전송합니다."
4. "계정이 스마트 계정 동작을 갖게 되었고, 다음 단계에서 UserOp를 사용할 수 있습니다."

실패 시 백업 멘트:
- "nonce 불일치가 발생하면 `wallet_delegateAccount` 경로로 재시도합니다."

## 데모 2 (7분): 모듈 설치 + 실행

진행 멘트:
1. "모듈 타입/주소/initData를 선택합니다."
2. "지갑이 installModule용 UserOp를 생성합니다."
3. "bundler 제출 후 receipt를 확인합니다."
4. "설치된 모듈 정책이 실제 실행을 제한/허용하는지 확인합니다."

## 데모 3 (8분): paymaster 후원

진행 멘트:
1. "`pm_getPaymasterStubData`로 초기 값을 받습니다."
2. "가스 보정 뒤 `pm_getPaymasterData`로 최종 서명 데이터를 받습니다."
3. "후원 필드가 채워진 UserOp를 전송합니다."
4. "성공/거절 정책 케이스를 비교합니다."

---

## 80~90분: 리스크/운영/Q&A

### 리스크 체크 포인트

1. 권한 리스크
- 모듈 설치/해제 권한 경계가 분명한가
- root validator 제거 방지 로직 검증 여부

2. 운영 리스크
- bundler/paymaster 가용성 모니터링 체계
- 실패 재시도 및 fallback(self-pay) 설계

3. 제품 리스크
- 지원 네트워크별 파라미터 불일치(특히 chainId hex)
- 지갑 구현별 7702 지원 편차

### 마무리 멘트
"우리 아키텍처의 핵심은, 사용자 주소를 유지하면서도 실행/정산/권한을 분리해 제품 요구에 맞춘다는 점입니다. 오늘 보신 모든 흐름은 코드로 이미 연결돼 있고, 남은 과제는 정책과 운영 자동화의 고도화입니다."

---

## 예상 질문과 답변(짧은 버전)

1. 왜 7702와 4337을 같이 쓰나요?
- 7702는 계정 전환, 4337은 실행 인프라라 역할이 다릅니다.

2. 모듈이 많아지면 복잡도만 늘지 않나요?
- 맞습니다. 그래서 설치 권한, selector 접근, nonce 무효화 정책을 함께 운영해야 합니다.

3. paymaster 장애 시 트랜잭션은?
- 현재 구현은 self-pay fallback 경로를 가질 수 있게 설계되어 있습니다.

4. 구독 자동결제는 어떻게 안전하게 하나요?
- permission/정책 기반으로 호출 범위와 주기, 금액 상한을 제한하고 executor가 이를 집행합니다.

---

## 발표 전 최종 체크

- 커널/엔트리포인트 핵심 라인 점프 준비 완료
- 데모 계정 nonce 상태 사전 확인
- bundler/paymaster 엔드포인트 health 확인
- 실패 케이스(거절/nonce mismatch) 대체 시나리오 준비
