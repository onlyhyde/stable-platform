# 13. 데모 리허설 런북 (실행 커맨드 상세)

작성일: 2026-03-02  
목표: 세미나 데모(A~D)를 "실패 복구 포함"으로 반복 재현 가능하게 만든다.

---

## 0. 범위

- Demo A: EOA -> EIP-7702 delegation
- Demo B: ERC-4337 self-paid UserOp
- Demo C: Paymaster sponsor/erc20 경로
- Demo D: ERC-7579 module lifecycle

---

## 1. 사전 준비

### 1.1 필수 버전

- Node.js: `>=22` (`stable-platform/package.json:59`)
- pnpm: `>=9` (`stable-platform/package.json:60`)
- Foundry(`forge`, `cast`) 설치

### 1.2 워크디렉터리

```bash
cd /Users/kevin/work/github/0xmhha/stable-platform/stable-platform
```

### 1.3 터미널 구성 권장

- T1: `anvil`
- T2: 계약 배포/펀딩
- T3: `bundler`
- T4: `paymaster-proxy`
- T5: `apps/web`
- T6: `apps/wallet-extension` 빌드 감시

---

## 2. 부팅 절차

### 2.1 의존성 설치

```bash
pnpm install
```

### 2.2 로컬 체인 실행

```bash
make anvil
```

근거: `Makefile:114-116`

### 2.3 필수 컨트랙트 배포 + 주소 생성

```bash
make deploy
```

근거: `Makefile:118-126`, `147-154`

### 2.4 paymaster 자금 충전

```bash
make fund-paymaster
```

근거: `Makefile:138-144`

### 2.5 bundler 실행

```bash
make bundler
```

또는

```bash
pnpm -C services/bundler dev
```

근거: `Makefile:165-166`, `services/bundler/package.json:13`

### 2.6 paymaster-proxy 실행

```bash
make paymaster
```

또는

```bash
pnpm -C services/paymaster-proxy dev
```

근거: `Makefile:168-169`, `services/paymaster-proxy/package.json:14`

### 2.7 웹/확장 실행

```bash
pnpm -C apps/web dev
pnpm -C apps/wallet-extension dev
```

근거: `apps/web/package.json:7`, `apps/wallet-extension/package.json:7`

---

## 3. 헬스체크

### 3.1 일괄 상태 확인

```bash
make health
```

근거: `Makefile:196-202`

### 3.2 bundler health

```bash
curl -s http://localhost:4337/health | jq
```

### 3.3 paymaster health

```bash
curl -s http://localhost:4338/health | jq
```

### 3.4 EntryPoint 주소 점검

- canonical v0.9: `packages/contracts/src/addresses.ts:69`
- bundler preset: `services/bundler/src/cli/config.ts:124-139`
- paymaster default allowlist: `services/paymaster-proxy/src/config/constants.ts:145-149`

점검 항목:
- bundler와 paymaster의 EntryPoint allowlist가 동일해야 한다.
- 데모 체인의 배포 주소와 앱 설정값이 일치해야 한다.

---

## 4. Demo A 런북: EOA -> EIP-7702 delegation

### 4.1 데모 포인트

- `wallet_signAuthorization` 경로 시연
- 또는 `wallet_delegateAccount` 원샷 경로 시연
- 성공 후 `eth_getCode`로 delegation 코드 확인

### 4.2 코드 근거

- `wallet_signAuthorization`: `apps/wallet-extension/src/background/rpc/handler.ts:804`
- `wallet_delegateAccount`: `.../handler.ts:946`
- executor:self nonce 보정(`N+1`): `.../handler.ts:1020-1029`

### 4.3 브라우저 콘솔 예시(EIP-1193)

```js
await window.ethereum.request({
  method: 'wallet_signAuthorization',
  params: [{
    account: '<EOA_ADDRESS>',
    contractAddress: '<KERNEL_IMPL_ADDRESS>',
    chainId: 31337,
  }],
})
```

원샷 경로:

```js
await window.ethereum.request({
  method: 'wallet_delegateAccount',
  params: [{
    account: '<EOA_ADDRESS>',
    contractAddress: '<KERNEL_IMPL_ADDRESS>',
    chainId: 31337,
  }],
})
```

### 4.4 성공 판정

- tx hash 반환
- delegation 이후 `eth_getCode(EOA)`가 `0xef0100...` prefix

### 4.5 실패 복구

- `nonce mismatch`
  - EOA tx nonce 재조회 후 재시도
- `chain mismatch`
  - wallet 네트워크와 요청 `chainId` 일치 여부 확인

---

## 5. Demo B 런북: ERC-4337 self-paid UserOp

### 5.1 데모 포인트

- DApp은 `target/value/data` 형태로 요청
- wallet-extension이 `Kernel.execute` callData로 변환
- paymaster 없이 제출

### 5.2 코드 근거

- callData 자동 인코딩: `apps/wallet-extension/src/background/rpc/handler.ts:1132-1140`
- nonce 보정: `.../handler.ts:1192-1215`
- typedData 서명: `.../handler.ts:1297-1299`

### 5.3 브라우저 콘솔 예시

```js
await window.ethereum.request({
  method: 'eth_sendUserOperation',
  params: [
    {
      sender: '<SMART_ACCOUNT_OR_DELEGATED_EOA>',
      target: '<TARGET_CONTRACT>',
      value: '0x0',
      data: '0x',
      gasPayment: { type: 'native' },
    },
    '<ENTRY_POINT>'
  ]
})
```

### 5.4 bundler 직접 추정(curl)

```bash
curl -s http://localhost:4337 \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"eth_estimateUserOperationGas",
    "params":[
      {
        "sender":"<sender>",
        "nonce":"0x0",
        "initCode":"0x",
        "callData":"0x<encoded>",
        "accountGasLimits":"0x0000000000000000000000000000000000000000000000000000000000000000",
        "preVerificationGas":"0x0",
        "gasFees":"0x0000000000000000000000000000000000000000000000000000000000000000",
        "paymasterAndData":"0x",
        "signature":"0x"
      },
      "<entryPoint>"
    ]
  }' | jq
```

### 5.5 성공 판정

- `userOpHash` 반환
- `eth_getUserOperationReceipt(userOpHash)`가 non-null

### 5.6 실패 복구

- `AA25 invalid nonce`
  - EntryPoint `getNonce(sender,0)` 재조회
- `EntryPoint not supported`
  - bundler entryPoint allowlist 확인 (`server.ts:369-375`)

---

## 6. Demo C 런북: Paymaster sponsor/erc20

### 6.1 데모 포인트

- paymaster는 `stub -> final` 2단계
- params 순서는 `[userOp, entryPoint, chainId(hex), context?]`

### 6.2 코드 근거

- wallet-extension 2단계 호출: `apps/wallet-extension/src/background/rpc/paymaster.ts:82-113`
- paymaster params schema: `services/paymaster-proxy/src/schemas/index.ts:79-99`
- paymaster method dispatch: `services/paymaster-proxy/src/app.ts:415-439`

### 6.3 sponsor 예시(curl)

```bash
curl -s http://localhost:4338/rpc \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"pm_getPaymasterStubData",
    "params":[
      {
        "sender":"<sender>",
        "nonce":"0x1",
        "callData":"0x<encoded>",
        "callGasLimit":"0x0",
        "verificationGasLimit":"0x0",
        "preVerificationGas":"0x0",
        "maxFeePerGas":"0x0",
        "maxPriorityFeePerGas":"0x0",
        "signature":"0x"
      },
      "<entryPoint>",
      "0x7a69",
      { "paymasterType":"sponsor", "policyId":"default" }
    ]
  }' | jq
```

### 6.4 erc20 예시(curl)

```bash
curl -s http://localhost:4338/rpc \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"pm_getPaymasterData",
    "params":[
      {
        "sender":"<sender>",
        "nonce":"0x1",
        "callData":"0x<encoded>",
        "callGasLimit":"0x5208",
        "verificationGasLimit":"0x7a120",
        "preVerificationGas":"0xc350",
        "maxFeePerGas":"0x3b9aca00",
        "maxPriorityFeePerGas":"0x3b9aca00",
        "signature":"0x"
      },
      "<entryPoint>",
      "0x7a69",
      {
        "paymasterType":"erc20",
        "tokenAddress":"<erc20_token>",
        "policyId":"default"
      }
    ]
  }' | jq
```

### 6.5 성공 판정

- paymaster 주소 + paymasterData 수신
- 최종 UserOp 제출 성공

### 6.6 실패 복구

- `Invalid parameters`
  - chainId를 10진수 대신 hex string으로 전달했는지 확인
- `deposit low`
  - paymaster 재충전 후 재시도

---

## 7. Demo D 런북: 7579 module lifecycle

### 7.1 데모 포인트

- install -> uninstall -> forceUninstall -> replace
- uninstall 거부 시 force 경로 설명

### 7.2 코드 근거

- install RPC: `apps/wallet-extension/src/background/rpc/handler.ts:1968`
- uninstall RPC: `.../handler.ts:2190`
- force uninstall RPC: `.../handler.ts:2417`
- replace RPC: `.../handler.ts:2615`
- on-chain 함수: `Kernel.sol:476`, `:616`, `:653`, `:692`

### 7.3 브라우저 콘솔 예시

```js
await window.ethereum.request({
  method: 'stablenet_installModule',
  params: [{
    account: '<ACCOUNT>',
    moduleAddress: '<MODULE_ADDR>',
    moduleType: '2',
    initData: '0x',
    initDataEncoded: true,
    chainId: 31337,
    gasPaymentMode: 'sponsor'
  }]
})
```

해제 실패 시:

```js
await window.ethereum.request({
  method: 'stablenet_forceUninstallModule',
  params: [{
    account: '<ACCOUNT>',
    moduleAddress: '<MODULE_ADDR>',
    moduleType: '2',
    chainId: 31337,
    deInitData: '0x',
    gasPaymentMode: 'sponsor'
  }]
})
```

### 7.4 성공 판정

- 모듈 상태 조회에서 설치/해제 결과 일치
- 에러 안내문(`suggestForceUninstall`) 확인 가능

---

## 8. 장애 대응 매트릭스

| 증상 | 1차 확인 | 2차 확인 | 즉시 대응 |
|---|---|---|---|
| UserOp 제출 즉시 실패 | entryPoint 주소 | sender nonce | nonce 재조회 후 재전송 |
| paymaster 응답 없음 | `:4338/health` | 정책/allowlist | self-paid로 즉시 전환 |
| receipt 미발견 | bundler mempool 상태 | on-chain log 조회 | `eth_getUserOperationReceipt` 재폴링 |
| 모듈 해제 실패 | onUninstall revert 여부 | Module 타입/데이터 | forceUninstall 전환 |

---

## 9. 리허설 합격 기준

- 4개 데모를 30분 내 재현 가능
- 실패 복구 2개 이상(예: nonce mismatch, paymaster 다운) 시연 가능
- 마지막 Q&A에서 nonce 3종(EOA tx, 7702 auth, 4337 UserOp)을 분리 설명 가능

---

## 10. D-Day 체크리스트

1. `make health` 결과 정상
2. EntryPoint 주소 정렬 확인(앱/번들러/페이마스터)
3. 데모 계정 잔고/토큰/allowance 확인
4. 브라우저 확장 연결 상태 확인
5. fallback 시나리오 해시/스크린샷 준비

