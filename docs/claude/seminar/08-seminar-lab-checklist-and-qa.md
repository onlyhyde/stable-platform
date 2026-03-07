# 11. 세미나 Lab 체크리스트와 Q&A 운영 (상세판)

## 1) Lab 목표

참가자가 세미나 종료 시 아래를 직접 수행한다.

1. 7702 위임 트랜잭션 전송
2. 4337 UserOp 전송 및 receipt 확인
3. paymaster sponsor/erc20 모드 전환
4. 7579 모듈 설치와 제거

## 2) 사전 환경 체크

- RPC/Chain 연결 정상
- EntryPoint/Bundler/Paymaster 주소 설정 완료
- 테스트 계정 잔액/토큰/allowance 준비
- Wallet Extension 설치 및 연결 확인

## 3) Lab 트랙

### Lab-1: EIP-7702 위임

- 입력: account, delegate contract, chainId
- 실행: `wallet_delegateAccount`
- 검증: `eth_getCode` 전/후 비교

### Lab-2: 4337 Self-paid

- 입력: sender, target/value/data
- 실행: `eth_sendUserOperation`
- 검증: `eth_getUserOperationReceipt`

### Lab-3: Paymaster Sponsorship/ERC-20

- 입력: gasPayment.type, tokenAddress(optional)
- 실행: paymaster 2-phase를 거친 UserOp
- 검증: paymaster 필드 포함 여부 및 receipt

### Lab-4: 7579 Module Lifecycle

- 실행: install -> isInstalled -> uninstall -> forceUninstall/replace
- 검증: 상태 일관성 및 tx 결과

## 4) 공통 체크리스트

- 체인 ID와 주소가 올바른가
- nonce 종류를 구분했는가
- callData 인코딩 규칙을 지켰는가
- paymaster params 순서가 정확한가
- receipt/event로 최종 상태를 확인했는가

## 5) 실습 실패 시 진단 순서

1. Wallet 요청 payload 확인
2. Bundler 에러 코드 확인
3. EntryPoint 이벤트 확인
4. Paymaster 정책/잔액/토큰 상태 확인
5. 모듈 상태 조회(`isModuleInstalled`) 확인

## 6) Q&A 운영 방식

- 질문을 개념/구현/운영 3가지로 분류
- 개념 질문은 역할 경계로 답변
- 구현 질문은 파라미터 위치와 코드 경로로 답변
- 운영 질문은 리스크/모니터링/롤백으로 답변

## 7) 자주 나오는 질문 10개 (핵심)

1. 4337과 7702 중 무엇이 먼저인가?
2. 왜 UserOp nonce와 EOA nonce가 다르나?
3. Paymaster 없이도 가능한가?
4. 7579 모듈을 왜 굳이 분리하나?
5. Force uninstall은 언제 써야 하나?
6. Bundler가 UserOp를 거절하면 어디부터 보나?
7. ERC-20 정산 실패 시 누가 손실을 보나?
8. TS/Go SDK가 다르면 무엇을 기준으로 삼나?
9. 스펙 편차를 허용해도 되나?
10. 제품 적용 시 최소 보안 통제는 무엇인가?

## 8) 발표자 메모

- 질문에 답할 때 항상 "레이어"를 먼저 선언한다.
- 로그/이벤트를 근거로 사실관계를 먼저 확정한다.
- 추측보다 "어느 파일/함수에서 확인 가능한지"를 제시한다.

## 9) 완료 기준

- 참가자 과반이 Lab 1~3을 재현
- 핵심 Q&A에서 nonce/가스/모듈 lifecycle 혼동이 해소
- 세션 후 바로 적용 가능한 코드 참조 경로를 확보

## 10) 연계 문서

- `SEMINAR_TRANSACTION_COOKBOOK_KO_2026-03-02.md`
- `SEMINAR_SPEC_CODE_TRACE_MATRIX_KO_2026-03-02.md`
- `SEMINAR_QA_30_KO_2026-03-02.md`
