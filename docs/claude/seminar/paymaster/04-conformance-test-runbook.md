# [04] Paymaster 정합 테스트 Runbook

작성일: 2026-02-24  
대상: `03-interface-conformance-checklist.md`

## 1. 사전 준비

- paymaster-proxy 실행
- EntryPoint/Paymaster 배포 확인
- bundler RPC 접근 가능
- signer/sender 계정 준비

필수 환경:
- `PAYMASTER_SUPPORTED_CHAIN_IDS`
- `SUPPORTED_ENTRY_POINTS`
- `BUNDLER_RPC_URL` (후정산 사용 시)

## 2. 실행 순서

1. health/주소/잔고 확인
2. `pm_getPaymasterStubData` 호출
3. `pm_getPaymasterData` 호출
4. `eth_estimateUserOperationGas` 검증
5. `eth_sendUserOperation` 제출
6. `eth_getUserOperationReceipt`로 결과 확인
7. reservation settle/cancel 확인

## 3. 기록 포인트

- 입력 UserOp
- 응답 paymasterData
- userOpHash
- receipt(success, actualGasCost)
- policy reservation 상태 변화

## 4. 판정

- PASS: 정합 항목 전부 충족
- FAIL: 포맷/해시/정산 중 1개라도 불일치
