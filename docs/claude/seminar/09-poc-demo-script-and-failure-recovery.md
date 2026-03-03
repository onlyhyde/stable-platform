# 09. PoC 데모 스크립트와 실패 복구 런북 (상세판)

## 1) 데모 목적

- 7702 온보딩 -> 4337 실행 -> 7579 확장 -> 수수료 모델 변화까지 한 흐름으로 보여준다.
- 참가자가 "이걸 제품 코드에 어떻게 옮기는지"를 이해하게 만든다.

## 2) 데모 시나리오 순서

1. Demo A: EOA -> 7702 위임
2. Demo B: Self-paid UserOp 전송
3. Demo C: Sponsor/ ERC-20 Paymaster 전환
4. Demo D: 7579 모듈 설치/해제/강제해제/교체

## 3) 90분 기준 운영 타임라인

- 0~10분: 문제정의/계정모델
- 10~30분: 4337/7702/7579 개념
- 30~55분: 코드 구조 투어
- 55~80분: 라이브 데모 A~D
- 80~90분: 장애 복구/Q&A

## 4) Demo A (7702 위임)

목표:

- EOA 코드가 delegation prefix를 가지는지 확인

실행:

1. `wallet_delegateAccount` 호출
2. tx receipt 확인
3. `eth_getCode`로 위임 전/후 비교

성공 기준:

- tx success
- delegated code 확인

실패 복구:

- nonce mismatch -> 계정 nonce 재조회 후 재시도
- chain mismatch -> chainId와 rpc 네트워크 재확인

## 5) Demo B (Self-paid UserOp)

목표:

- paymaster 없이 UserOp 실행

실행:

1. DApp에서 target/value/data 생성
2. `eth_sendUserOperation` 호출
3. `eth_getUserOperationReceipt`로 포함 확인

성공 기준:

- UserOp receipt `success=true`
- EntryPoint 이벤트 조회 가능

실패 복구:

- AA25/nonce 관련 -> EntryPoint nonce 강제 재조회
- gas 부족 -> `eth_estimateUserOperationGas` 선호출

## 6) Demo C (Paymaster 모델 전환)

목표:

- sponsor -> erc20 정산까지 비교

실행:

1. sponsor 모드로 UserOp 전송
2. erc20 모드로 tokenAddress 포함 전송
3. paymaster proxy 로그/응답 비교

성공 기준:

- stub/final paymaster data 정상 수신
- receipt 생성

실패 복구:

- paymaster deposit 부족 -> deposit 모니터 상태 확인
- allowance 부족 -> 토큰 approve 후 재시도
- 가격 오류 -> oracle/토큰 지원 상태 확인

## 7) Demo D (7579 모듈 lifecycle)

목표:

- install/uninstall/forceUninstall/replace 차이 시연

실행:

1. `stablenet_installModule`
2. `isModuleInstalled` 확인
3. `stablenet_uninstallModule`
4. 실패 시 `stablenet_forceUninstallModule`
5. `stablenet_replaceModule`

성공 기준:

- 모듈 상태 변화와 트랜잭션 결과 일치

실패 복구:

- uninstall revert -> forceUninstall로 대체
- replacement 실패 -> old module 유지 여부 확인

## 8) 실시간 장애 대응 공통 규칙

1. 레이어를 먼저 확정한다 (DApp/Wallet/Service/Contract)
2. 입력 파라미터와 체인 정보를 먼저 검증한다
3. receipt/event로 온체인 사실관계를 먼저 확인한다
4. 재시도는 nonce/fee/policy를 분리해 한 항목씩 조정한다

## 9) 백업 데모 플랜

- 라이브 실패 시 사전 생성된 userOpHash/txHash를 이용해 receipt/event 조회 중심으로 전환
- paymaster 실패 시 self-paid 경로로 전환
- 모듈 uninstall 실패 시 forceUninstall 시나리오를 오히려 교육 포인트로 전환

## 10) D-Day 사전 점검

- EntryPoint/Kernel/Paymaster 주소 확인
- Bundler/Paymaster URL 가용성 확인
- 데모 계정 잔액 및 allowance 확인
- 대표 오류 코드 대응 문구 준비

## 11) 참고 코드

- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- `stable-platform/apps/web/hooks/useSmartAccount.ts`
- `stable-platform/apps/web/hooks/useUserOp.ts`
- `stable-platform/services/bundler/src/rpc/server.ts`
- `stable-platform/services/paymaster-proxy/src/app.ts`
