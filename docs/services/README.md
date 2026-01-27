# StableNet Service API Reference

> **Version**: 1.0.0
> **Last Updated**: 2026-01-27

## Overview

StableNet은 Account Abstraction 기반 결제 인프라를 위한 마이크로서비스 아키텍처를 제공합니다.

## Services

| Service | Port | Description |
|---------|------|-------------|
| [bundler](#bundler) | 3000 | ERC-4337 Bundler |
| [paymaster-proxy](#paymaster-proxy) | 3001 | Gas Sponsorship API |
| [subscription-executor](#subscription-executor) | 3002 | Recurring Payments |
| [bridge-relayer](#bridge-relayer) | 3003 | Cross-chain Bridge |
| [stealth-server](#stealth-server) | 3004 | Stealth Address Indexer |
| [order-router](#order-router) | 3005 | Payment Order Router |
| [bank-simulator](#bank-simulator) | 3010 | Bank API Simulator |
| [pg-simulator](#pg-simulator) | 3011 | Payment Gateway Simulator |
| [onramp-simulator](#onramp-simulator) | 3012 | Fiat On-ramp Simulator |

---

## Bundler

ERC-4337 compliant bundler for UserOperation processing.

### Base URL

```
http://localhost:3000/rpc
```

### JSON-RPC Methods

#### `eth_sendUserOperation`

UserOperation을 mempool에 제출합니다.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_sendUserOperation",
  "params": [
    {
      "sender": "0x...",
      "nonce": "0x0",
      "initCode": "0x",
      "callData": "0x...",
      "accountGasLimits": "0x...",
      "preVerificationGas": "0x5208",
      "gasFees": "0x...",
      "paymasterAndData": "0x",
      "signature": "0x..."
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x..." // userOpHash
}
```

#### `eth_estimateUserOperationGas`

UserOperation 가스 비용을 추정합니다.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_estimateUserOperationGas",
  "params": [
    { /* UserOperation */ },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "preVerificationGas": "0x5208",
    "verificationGasLimit": "0x30d40",
    "callGasLimit": "0x186a0",
    "paymasterVerificationGasLimit": "0x0",
    "paymasterPostOpGasLimit": "0x0"
  }
}
```

#### `eth_getUserOperationReceipt`

UserOperation 실행 결과를 조회합니다.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getUserOperationReceipt",
  "params": ["0x..."]
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "userOpHash": "0x...",
    "sender": "0x...",
    "nonce": "0x0",
    "actualGasCost": "0x...",
    "actualGasUsed": "0x...",
    "success": true,
    "receipt": {
      "transactionHash": "0x...",
      "blockNumber": "0x...",
      "blockHash": "0x..."
    }
  }
}
```

#### `eth_getUserOperationByHash`

UserOperation 상세 정보를 조회합니다.

#### `eth_supportedEntryPoints`

지원하는 EntryPoint 주소 목록을 반환합니다.

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
}
```

### Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32500 | AA10-AA99 | Account validation errors |
| -32501 | PM10-PM99 | Paymaster validation errors |
| -32502 | OP10-OP99 | Opcode validation errors |
| -32600 | Invalid Request | Malformed request |
| -32601 | Method not found | Unknown method |

---

## Paymaster Proxy

Gas sponsorship service with policy-based access control.

### Base URL

```
http://localhost:3001
```

### Endpoints

#### `POST /pm_getPaymasterStubData`

가스 추정용 Paymaster stub 데이터를 반환합니다.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pm_getPaymasterStubData",
  "params": [
    {
      "sender": "0x...",
      "nonce": "0x0",
      "initCode": "0x",
      "callData": "0x..."
    },
    "0x1",
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "paymaster": "0x...",
    "paymasterData": "0x...",
    "paymasterVerificationGasLimit": "0x30d40",
    "paymasterPostOpGasLimit": "0x0"
  }
}
```

#### `POST /pm_getPaymasterData`

서명된 Paymaster 데이터를 반환합니다.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pm_getPaymasterData",
  "params": [
    {
      "sender": "0x...",
      "nonce": "0x0",
      "initCode": "0x",
      "callData": "0x...",
      "accountGasLimits": "0x...",
      "preVerificationGas": "0x5208",
      "gasFees": "0x..."
    },
    "0x1",
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  ]
}
```

#### `GET /health`

서비스 상태를 확인합니다.

**Response:**
```json
{
  "status": "ok",
  "service": "paymaster-proxy",
  "timestamp": "2026-01-27T12:00:00Z"
}
```

### Sponsorship Policies

Paymaster는 다음 정책을 지원합니다:

- **allowedContracts**: 허용된 컨트랙트 주소 목록
- **allowedMethods**: 허용된 함수 시그니처
- **maxGasLimit**: 최대 가스 한도
- **dailyLimit**: 일일 후원 한도 (USD)
- **perUserLimit**: 사용자당 후원 한도

---

## Subscription Executor

Recurring payment automation service.

### Base URL

```
http://localhost:3002
```

### REST Endpoints

#### `POST /api/v1/subscriptions`

구독을 생성합니다.

**Headers:**
```
Content-Type: application/json
Idempotency-Key: <unique-key>  // optional, prevents duplicate requests
```

**Request:**
```json
{
  "smartAccount": "0x...",
  "recipient": "0x...",
  "token": "0x...",
  "amount": "10000000",
  "intervalDays": 30,
  "maxExecutions": 12
}
```

**Response:**
```json
{
  "id": "sub_1706356800000",
  "smartAccount": "0x...",
  "recipient": "0x...",
  "token": "0x...",
  "amount": "10000000",
  "interval": 2592000,
  "nextExecution": "2026-02-27T12:00:00Z",
  "executionCount": 0,
  "maxExecutions": 12,
  "status": "active",
  "createdAt": "2026-01-27T12:00:00Z"
}
```

#### `GET /api/v1/subscriptions/:id`

구독 상세 정보를 조회합니다.

#### `GET /api/v1/subscriptions?account=0x...`

계정의 모든 구독을 조회합니다.

#### `POST /api/v1/subscriptions/:id/cancel`

구독을 취소합니다.

#### `POST /api/v1/subscriptions/:id/pause`

구독을 일시 정지합니다.

#### `POST /api/v1/subscriptions/:id/resume`

일시 정지된 구독을 재개합니다.

### Idempotency

`Idempotency-Key` 헤더를 사용하여 중복 요청을 방지할 수 있습니다:

```bash
curl -X POST http://localhost:3002/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id-123" \
  -d '{"smartAccount": "0x...", ...}'
```

동일한 키로 24시간 내 재요청 시 캐시된 응답을 반환합니다.

---

## Bridge Relayer

Cross-chain bridge relayer with MPC signature support.

### Base URL

```
http://localhost:3003
```

### REST Endpoints

#### `POST /api/v1/bridge/initiate`

브릿지 요청을 시작합니다.

**Headers:**
```
Content-Type: application/json
Idempotency-Key: <unique-key>
```

**Request:**
```json
{
  "sender": "0x...",
  "recipient": "0x...",
  "token": "0x...",
  "amount": "1000000000000000000",
  "sourceChain": 1,
  "targetChain": 137
}
```

#### `GET /api/v1/bridge/status/:requestId`

브릿지 요청 상태를 조회합니다.

**Response:**
```json
{
  "requestId": "0x...",
  "status": "executed",
  "sender": "0x...",
  "recipient": "0x...",
  "amount": "1000000000000000000",
  "sourceChain": 1,
  "targetChain": 137,
  "sourceTxHash": "0x...",
  "targetTxHash": "0x...",
  "createdAt": "2026-01-27T12:00:00Z",
  "completedAt": "2026-01-27T12:05:00Z"
}
```

#### `GET /api/v1/bridge/pending`

대기 중인 브릿지 요청 목록을 반환합니다.

#### `GET /health`

서비스 상태를 확인합니다.

**Response:**
```json
{
  "status": "ok",
  "service": "bridge-relayer",
  "pendingRequests": 3,
  "processedCount": 1250,
  "isPaused": false
}
```

---

## Stealth Server

Stealth address announcement indexer.

### Base URL

```
http://localhost:3004
```

### REST Endpoints

#### `GET /api/v1/announcements`

스텔스 주소 공지를 조회합니다.

**Query Parameters:**
- `fromBlock`: 시작 블록 번호
- `toBlock`: 종료 블록 번호 (default: latest)
- `schemeId`: 스킴 ID (default: 1)
- `limit`: 결과 수 제한 (default: 100)

**Response:**
```json
{
  "announcements": [
    {
      "schemeId": 1,
      "stealthAddress": "0x...",
      "ephemeralPubKey": "0x...",
      "viewTag": "0x12",
      "caller": "0x...",
      "blockNumber": 12345678,
      "transactionHash": "0x..."
    }
  ],
  "fromBlock": 12345600,
  "toBlock": 12345700
}
```

#### `GET /api/v1/registry/:address`

등록된 스텔스 메타 주소를 조회합니다.

**Response:**
```json
{
  "owner": "0x...",
  "spendingPubKey": "0x...",
  "viewingPubKey": "0x...",
  "schemeId": 1,
  "registeredAt": "2026-01-27T12:00:00Z"
}
```

---

## Order Router

Payment order routing service.

### Base URL

```
http://localhost:3005
```

### REST Endpoints

#### `POST /api/v1/orders`

결제 주문을 생성합니다.

**Request:**
```json
{
  "merchantId": "merchant_123",
  "amount": "10000",
  "currency": "KRW",
  "paymentMethod": "card",
  "returnUrl": "https://merchant.com/callback",
  "metadata": {
    "orderId": "order_456"
  }
}
```

**Response:**
```json
{
  "orderId": "ord_1706356800000",
  "status": "pending",
  "paymentUrl": "https://pg.stablenet.io/pay/ord_1706356800000",
  "expiresAt": "2026-01-27T12:30:00Z"
}
```

#### `GET /api/v1/orders/:orderId`

주문 상태를 조회합니다.

#### `POST /api/v1/orders/:orderId/confirm`

주문을 확정합니다 (PG 콜백 후).

---

## Simulator Services

개발 및 테스트용 시뮬레이터 서비스입니다.

### Bank Simulator (Port 3010)

은행 API 시뮬레이터:

- `POST /api/v1/accounts` - 계좌 생성
- `GET /api/v1/accounts/:accountNumber/balance` - 잔액 조회
- `POST /api/v1/transfer` - 계좌 이체
- `POST /api/v1/withdraw` - 출금

### PG Simulator (Port 3011)

결제 게이트웨이 시뮬레이터:

- `POST /api/v1/payments` - 결제 요청
- `GET /api/v1/payments/:paymentId` - 결제 상태
- `POST /api/v1/payments/:paymentId/confirm` - 결제 확정
- `POST /api/v1/payments/:paymentId/cancel` - 결제 취소

카드 검증: Luhn 알고리즘, CVV 검증, 3D Secure 시뮬레이션

### Onramp Simulator (Port 3012)

법정화폐 온램프 시뮬레이터:

- `POST /api/v1/quotes` - 환율 견적
- `POST /api/v1/orders` - 온램프 주문
- `GET /api/v1/orders/:orderId` - 주문 상태
- `POST /webhook` - 결제 완료 웹훅

---

## Common Headers

모든 서비스에서 공통으로 사용되는 헤더:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Request-ID` | 요청 추적 ID (자동 생성) |
| `X-API-Key` | API 인증 키 (production) |
| `Idempotency-Key` | 중복 요청 방지 키 |

## Error Response Format

모든 서비스는 일관된 에러 응답 형식을 사용합니다:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "amount",
      "reason": "must be positive"
    }
  }
}
```

---

## Related Documentation

- [SDK API Reference](../sdk/api/README.md)
- [Deployment Guide](../deployment/README.md)
- [Operations Guide](../operations/README.md)
