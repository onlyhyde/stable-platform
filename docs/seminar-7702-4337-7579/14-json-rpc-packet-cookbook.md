# 14) JSON-RPC 패킷 실전 레퍼런스 (7702/4337/7579)

## 문서 목적
세미나 데모와 실서비스 연동에서 바로 사용할 수 있는 JSON-RPC 패킷 예시를 정리합니다.

핵심 기준:
- 코드 구현과 동일한 파라미터 순서 사용
- `chainId` 표현 방식(hex/string) 구분
- bundler/paymaster/wallet-extension 경계 명확화

---

## 0. 엔드포인트 맵

1. Wallet Extension RPC
- 브라우저 dApp -> `window.ethereum.request(...)`

2. Bundler RPC
- `<BUNDLER_URL>/` (JSON-RPC POST)
- 참고: `stable-platform/services/bundler/src/rpc/server.ts:227`

3. Paymaster Proxy RPC
- `<PAYMASTER_URL>/` 또는 `<PAYMASTER_URL>/rpc`
- 참고: `stable-platform/services/paymaster-proxy/src/app.ts:160`, `stable-platform/services/paymaster-proxy/src/app.ts:174`

---

## 1. 공통 JSON-RPC Envelope

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "<method>",
  "params": []
}
```

---

## 2. 7702 Authorization 패킷

### 2.1 `wallet_signAuthorization`

근거 코드:
- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:755`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "wallet_signAuthorization",
  "params": [
    {
      "account": "0x1111111111111111111111111111111111111111",
      "contractAddress": "0x2222222222222222222222222222222222222222",
      "chainId": 8283
    }
  ]
}
```

응답 예시:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "signedAuthorization": {
      "chainId": 8283,
      "address": "0x2222222222222222222222222222222222222222",
      "nonce": 12,
      "v": 27,
      "r": "0x...",
      "s": "0x..."
    },
    "authorizationHash": "0x..."
  }
}
```

### 2.2 `eth_sendTransaction` with `authorizationList`

근거 코드:
- `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1322`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "eth_sendTransaction",
  "params": [
    {
      "from": "0x1111111111111111111111111111111111111111",
      "to": "0x1111111111111111111111111111111111111111",
      "value": "0x0",
      "data": "0x",
      "authorizationList": [
        {
          "chainId": 8283,
          "address": "0x2222222222222222222222222222222222222222",
          "nonce": 12,
          "v": 27,
          "r": "0x...",
          "s": "0x..."
        }
      ]
    }
  ]
}
```

---

## 3. 4337 Bundler 패킷

## 3.1 `eth_estimateUserOperationGas`

근거 코드:
- method dispatch: `stable-platform/services/bundler/src/rpc/server.ts:294`
- handler: `stable-platform/services/bundler/src/rpc/server.ts:361`
- SDK caller: `stable-platform/packages/sdk-ts/core/src/clients/bundlerClient.ts:144`

요청(권장: packed UserOp):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "eth_estimateUserOperationGas",
  "params": [
    {
      "sender": "0x3333333333333333333333333333333333333333",
      "nonce": "0x0",
      "initCode": "0x",
      "callData": "0x...",
      "accountGasLimits": "0x000000000000000000000000000249f00000000000000000000000000186a0",
      "preVerificationGas": "0xc350",
      "gasFees": "0x0000000000000000000000003b9aca000000000000000000000000003b9aca00",
      "paymasterAndData": "0x",
      "signature": "0x"
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

응답:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "preVerificationGas": "0xc350",
    "verificationGasLimit": "0x249f0",
    "callGasLimit": "0x186a0"
  }
}
```

## 3.2 `eth_sendUserOperation`

근거 코드:
- method dispatch: `stable-platform/services/bundler/src/rpc/server.ts:291`
- handler: `stable-platform/services/bundler/src/rpc/server.ts:332`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "eth_sendUserOperation",
  "params": [
    {
      "sender": "0x3333333333333333333333333333333333333333",
      "nonce": "0x0",
      "initCode": "0x",
      "callData": "0x...",
      "accountGasLimits": "0x...",
      "preVerificationGas": "0x...",
      "gasFees": "0x...",
      "paymasterAndData": "0x...",
      "signature": "0x..."
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

응답:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": "0x<userOpHash>"
}
```

## 3.3 `eth_getUserOperationReceipt`

근거 코드:
- dispatch: `stable-platform/services/bundler/src/rpc/server.ts:300`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "eth_getUserOperationReceipt",
  "params": ["0x<userOpHash>"]
}
```

---

## 4. Paymaster 패킷

### 파라미터 순서(중요)
- `[userOp, entryPoint, chainId, context?]`
- 근거: `stable-platform/services/paymaster-proxy/src/app.ts:316`, `stable-platform/services/paymaster-proxy/src/app.ts:360`

### 체인 ID 타입(중요)
- `chainId`는 hex 문자열이어야 함 (`"0x205b"` 등)
- 근거 스키마: `stable-platform/services/paymaster-proxy/src/schemas/index.ts:76`, `stable-platform/services/paymaster-proxy/src/schemas/index.ts:88`

## 4.1 `pm_getPaymasterStubData`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "pm_getPaymasterStubData",
  "params": [
    {
      "sender": "0x3333333333333333333333333333333333333333",
      "nonce": "0x0",
      "callData": "0x...",
      "callGasLimit": "0x186a0",
      "verificationGasLimit": "0x249f0",
      "preVerificationGas": "0xc350",
      "maxFeePerGas": "0x3b9aca00",
      "maxPriorityFeePerGas": "0x3b9aca00",
      "signature": "0x"
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "0x205b",
    {
      "sponsor": "demo"
    }
  ]
}
```

응답:
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "paymaster": "0x4444444444444444444444444444444444444444",
    "paymasterData": "0x",
    "paymasterVerificationGasLimit": "0x249f0",
    "paymasterPostOpGasLimit": "0xc350"
  }
}
```

## 4.2 `pm_getPaymasterData`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "pm_getPaymasterData",
  "params": [
    {
      "sender": "0x3333333333333333333333333333333333333333",
      "nonce": "0x0",
      "callData": "0x...",
      "callGasLimit": "0x186a0",
      "verificationGasLimit": "0x249f0",
      "preVerificationGas": "0xc350",
      "maxFeePerGas": "0x3b9aca00",
      "maxPriorityFeePerGas": "0x3b9aca00",
      "paymaster": "0x4444444444444444444444444444444444444444",
      "paymasterData": "0x",
      "paymasterVerificationGasLimit": "0x249f0",
      "paymasterPostOpGasLimit": "0xc350",
      "signature": "0x"
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "0x205b"
  ]
}
```

응답:
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "paymaster": "0x4444444444444444444444444444444444444444",
    "paymasterData": "0x<signed-data>",
    "paymasterVerificationGasLimit": "0x249f0",
    "paymasterPostOpGasLimit": "0xc350"
  }
}
```

---

## 5. 7579 모듈 RPC 패킷 (Wallet Extension Custom)

근거 코드:
- install: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1769`
- uninstall: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1969`

## 5.1 `stablenet_installModule`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "stablenet_installModule",
  "params": [
    {
      "account": "0x3333333333333333333333333333333333333333",
      "moduleAddress": "0x5555555555555555555555555555555555555555",
      "moduleType": "2",
      "initData": "0x",
      "initDataEncoded": true,
      "chainId": 8283
    }
  ]
}
```

응답:
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "hash": "0x<userOpHash>"
  }
}
```

## 5.2 `stablenet_uninstallModule`

요청:
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "stablenet_uninstallModule",
  "params": [
    {
      "account": "0x3333333333333333333333333333333333333333",
      "moduleAddress": "0x5555555555555555555555555555555555555555",
      "moduleType": "2",
      "chainId": 8283,
      "deInitData": "0x"
    }
  ]
}
```

---

## 6. 실수 방지 체크리스트

1. paymaster `chainId`는 숫자가 아니라 hex 문자열인지 확인.
2. bundler `eth_sendUserOperation` params가 `[packedOp, entryPoint]` 순서인지 확인.
3. UserOp `nonce`, gas 필드가 모두 hex 문자열인지 확인.
4. paymaster 경로가 `/`인지 `/rpc`인지 환경 설정과 일치하는지 확인.
5. 7702 authorization의 `nonce`가 tx nonce와 처리 순서에 맞는지 확인.

---

## 7. 빠른 디버깅 힌트

- `Invalid parameters`:
  - paymaster schema 불일치 가능성 높음 (`app.ts:307`, `app.ts:351`).
- `EntryPoint ... not supported`:
  - bundler allowlist 불일치 (`server.ts:336`, `server.ts:371`).
- UserOp 제출 후 무응답:
  - receipt polling 필요 (`useUserOp.ts:119`).

---

## 8. 코드 참조 인덱스

- bundler RPC: `stable-platform/services/bundler/src/rpc/server.ts`
- bundler validator: `stable-platform/services/bundler/src/validation/validator.ts`
- paymaster app: `stable-platform/services/paymaster-proxy/src/app.ts`
- paymaster schema: `stable-platform/services/paymaster-proxy/src/schemas/index.ts`
- wallet paymaster helper: `stable-platform/apps/wallet-extension/src/background/rpc/paymaster.ts`
- wallet RPC handler: `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts`
- SDK bundler client: `stable-platform/packages/sdk-ts/core/src/clients/bundlerClient.ts`
