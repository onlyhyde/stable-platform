# 07. 트랜잭션 쿡북 연결 가이드 (상세판)

## 1) 목적

이 문서는 개발자가 바로 구현할 수 있도록, "어떤 트랜잭션을 어떤 파라미터로 어떻게 전송하는지"를 코드/메시지 단위로 정리한다.

## 2) 개발자가 먼저 고정해야 할 4개

1. 체인/EntryPoint 주소
2. signer 주체(EOA, delegated EOA, relayer)
3. 실행 모드(7702 Type-4 vs 4337 UserOp)
4. 가스 모델(native/sponsor/erc20)

## 3) Cookbook A: 7702 위임 (원샷)

RPC:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "wallet_delegateAccount",
  "params": [
    {
      "account": "0xYourEOA",
      "contractAddress": "0xKernelImplementation",
      "chainId": 8283
    }
  ]
}
```

핵심 포인트:

- Wallet 내부에서 `txNonce` 조회
- `authNonce = txNonce + 1` 적용
- Type-4 Tx에 `authorizationList` 삽입 후 전송

코드 근거:

- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts` (`wallet_delegateAccount`)

## 4) Cookbook B: 4337 UserOp (target/value/data 입력형)

### 4.1 DApp 요청 예시

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "eth_sendUserOperation",
  "params": [
    {
      "sender": "0xYourAccount",
      "target": "0xTargetContract",
      "value": "0x0",
      "data": "0xabcdef...",
      "gasPayment": {
        "type": "sponsor"
      }
    },
    "0xEntryPointAddress"
  ]
}
```

### 4.2 Wallet 내부 전처리

- `target/value/data` -> `callData` 자동 인코딩
- nonce 비어 있으면 EntryPoint `getNonce(sender, 0)` 조회
- 가스/수수료 자동 추정
- 필요 시 paymaster 데이터 주입
- UserOpHash 생성 후 서명

`executionCalldata` 인코딩 규칙:

- `abi.encodePacked(target[20], value[32], callData[bytes])`
- 이를 `execute(bytes32 mode, bytes executionCalldata)`에 넣어 `callData` 생성

## 5) Cookbook C: Paymaster 2-Phase

### 5.1 Stub

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "pm_getPaymasterStubData",
  "params": [
    { "sender": "0x...", "nonce": "0x...", "callData": "0x...", "callGasLimit": "0x...", "verificationGasLimit": "0x...", "preVerificationGas": "0x...", "maxFeePerGas": "0x...", "maxPriorityFeePerGas": "0x...", "signature": "0x" },
    "0xEntryPoint",
    "0x205b",
    { "paymasterType": "erc20", "tokenAddress": "0xToken" }
  ]
}
```

### 5.2 Final

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "pm_getPaymasterData",
  "params": [
    { "...userOpWithStubFields": "..." },
    "0xEntryPoint",
    "0x205b",
    { "paymasterType": "erc20", "tokenAddress": "0xToken" }
  ]
}
```

## 6) Cookbook D: 7579 모듈 설치/해제/교체

### 6.1 설치

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "stablenet_installModule",
  "params": [
    {
      "account": "0xYourAccount",
      "moduleAddress": "0xModule",
      "moduleType": "2",
      "initData": "0x...",
      "initDataEncoded": true,
      "chainId": 8283,
      "gasPaymentMode": "sponsor"
    }
  ]
}
```

### 6.2 해제

- `stablenet_uninstallModule`
- 실패 시 `suggestForceUninstall` 에러를 받고 `stablenet_forceUninstallModule` 경로 사용

### 6.3 교체

- `stablenet_replaceModule`
- old uninstall + new install 원자성 보장

## 7) Bundler RPC 참고

- `eth_estimateUserOperationGas`
- `eth_sendUserOperation`
- `eth_getUserOperationByHash`
- `eth_getUserOperationReceipt`

코드:

- `stable-platform/services/bundler/src/rpc/server.ts`
- `stable-platform/packages/sdk-ts/core/src/clients/bundlerClient.ts`

## 8) 파라미터 위치 실수 방지표

- `nonce`
- EntryPoint nonce인지 EOA nonce인지 구분

- `callData`
- target calldata 그대로가 아니라 Kernel execute 포맷인지 확인

- `paymasterData`
- envelope+payload(+signature) 구조 확인

- `chainId`
- paymaster RPC에서는 hex string 형식 유지

- `signature`
- validator 요구 포맷(prefix 포함 여부) 확인

## 9) 디버깅 순서 (현장용)

1. Wallet에서 최종 userOp payload 로그
2. Bundler `eth_estimateUserOperationGas` 통과 여부
3. Bundler `eth_sendUserOperation` 에러 코드 확인
4. EntryPoint `UserOperationEvent` 존재 여부 확인
5. Paymaster deposit/allowance/price 상태 확인

## 10) 코드 근거

- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- `stable-platform/apps/wallet-extension/src/background/rpc/paymaster.ts`
- `stable-platform/services/paymaster-proxy/src/app.ts`
- `stable-platform/services/paymaster-proxy/src/schemas/index.ts`
- `stable-platform/packages/sdk-ts/core/src/utils/userOperation.ts`
