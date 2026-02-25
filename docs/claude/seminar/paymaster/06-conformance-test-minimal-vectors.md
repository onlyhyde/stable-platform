# [06] Paymaster 최소 테스트 벡터

작성일: 2026-02-24  
용도: `05-conformance-test-log-template.md`에 바로 넣어 smoke 테스트 수행

## 1. 공통 입력(UserOp 최소형)

```json
{
  "sender": "0x1111111111111111111111111111111111111111",
  "nonce": "0x0",
  "callData": "0x",
  "callGasLimit": "0x249f0",
  "verificationGasLimit": "0x186a0",
  "preVerificationGas": "0xc350",
  "maxFeePerGas": "0x77359400",
  "maxPriorityFeePerGas": "0x3b9aca00",
  "signature": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa41"
}
```

주의:
- 위 값은 파이프라인 점검용 최소 벡터다.
- 실제 성공 테스트는 sender/nonce/signature/callData를 실환경 값으로 교체해야 한다.

## 2. pm_getPaymasterData 예시 (verifying)

```json
{
  "jsonrpc": "2.0",
  "id": 101,
  "method": "pm_getPaymasterData",
  "params": [
    "<USER_OP_JSON>",
    "<ENTRYPOINT>",
    "<CHAIN_ID_HEX>",
    { "paymasterType": "verifying", "policyId": "default" }
  ]
}
```

## 3. pm_getPaymasterData 예시 (sponsor)

```json
{
  "jsonrpc": "2.0",
  "id": 102,
  "method": "pm_getPaymasterData",
  "params": [
    "<USER_OP_JSON>",
    "<ENTRYPOINT>",
    "<CHAIN_ID_HEX>",
    { "paymasterType": "sponsor", "policyId": "default" }
  ]
}
```

## 4. pm_getPaymasterData 예시 (erc20)

```json
{
  "jsonrpc": "2.0",
  "id": 103,
  "method": "pm_getPaymasterData",
  "params": [
    "<USER_OP_JSON>",
    "<ENTRYPOINT>",
    "<CHAIN_ID_HEX>",
    { "paymasterType": "erc20", "tokenAddress": "<TOKEN_ADDRESS>" }
  ]
}
```

## 5. pm_getPaymasterData 예시 (permit2)

```json
{
  "jsonrpc": "2.0",
  "id": 104,
  "method": "pm_getPaymasterData",
  "params": [
    "<USER_OP_JSON>",
    "<ENTRYPOINT>",
    "<CHAIN_ID_HEX>",
    { "paymasterType": "permit2", "tokenAddress": "<TOKEN_ADDRESS>" }
  ]
}
```
