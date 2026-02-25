# [05] Paymaster 정합 테스트 로그 템플릿

작성일: YYYY-MM-DD  
작성자:  
환경:  
체인ID:  
EntryPoint:  
Bundler RPC:  
Proxy URL:

## 1. 입력

- UserOp:
- paymasterType/context:

## 2. Stub 응답

- paymaster:
- paymasterData(stub):
- paymasterVerificationGasLimit:
- paymasterPostOpGasLimit:

## 3. Final 응답

- paymaster:
- paymasterData(final):
- reservationId:

## 4. Bundler/EntryPoint 결과

- eth_estimateUserOperationGas 결과:
- eth_sendUserOperation 결과(userOpHash):
- eth_getUserOperationReceipt 결과:
  - success:
  - actualGasCost:

## 5. 정산 결과

- reservation 상태(before/after):
- settle/cancel 결과:

## 6. 판정

- 포맷 정합: PASS/FAIL
- 해시 정합: PASS/FAIL
- 타입 정합: PASS/FAIL
- 후정산 정합: PASS/FAIL
- 최종 게이트: PASS/FAIL

메모:
