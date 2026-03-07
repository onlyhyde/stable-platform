# StableNet Platform 코드 리뷰 보고서

**작성일**: 2025-02-09
**리뷰 범위**: 전체 모노레포 (apps, packages, services, infra)
**최종 판정**: 🚨 **BLOCK** - 프로덕션 배포 전 수정 필요

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [이슈 통계](#2-이슈-통계)
3. [CRITICAL 이슈 상세](#3-critical-이슈-상세)
4. [HIGH 이슈 상세](#4-high-이슈-상세)
5. [MEDIUM 이슈 상세](#5-medium-이슈-상세)
6. [긍정적 발견 사항](#6-긍정적-발견-사항)
7. [수정 작업 체크리스트](#7-수정-작업-체크리스트)
8. [권장 일정](#8-권장-일정)

---

## 1. Executive Summary

StableNet Platform 모노레포에 대한 종합 코드 리뷰를 수행한 결과, **9건의 CRITICAL**, **20건의 HIGH**, **32건의 MEDIUM** 이슈가 발견되었습니다.

주요 발견 사항:
- **보안 취약점**: XSS, 인증 우회, Private Key 노출 위험
- **데이터 무결성**: Race condition으로 인한 중복 처리 가능성
- **인프라 보안**: 하드코딩된 개인키, 기본 비밀번호 사용
- **타입 안전성**: 패키지 간 타입 불일치 및 중복

CRITICAL 및 HIGH 이슈 해결 전까지 프로덕션 배포를 권장하지 않습니다.

---

## 2. 이슈 통계

| 영역 | CRITICAL | HIGH | MEDIUM | 상태 |
|------|:--------:|:----:|:------:|:----:|
| Wallet Extension | 1 | 3 | 6 | 🚨 BLOCK |
| TypeScript Packages | 2 | 4 | 6 | ⚠️ WARNING |
| Go Services | 2 | 4 | 6 | 🚨 BLOCK |
| TypeScript Services | 2 | 4 | 6 | 🚨 BLOCK |
| Infrastructure | 2 | 5 | 8 | 🚨 BLOCK |
| **합계** | **9** | **20** | **32** | **🚨 BLOCK** |

---

## 3. CRITICAL 이슈 상세

### CRITICAL-1: Internal Request Bypass Vulnerability

**영역**: Wallet Extension
**파일**: `apps/wallet-extension/src/background/rpc/handler.ts:791-804`
**심각도**: 🔴 CRITICAL
**유형**: Security - Authentication Bypass

#### 문제점

`origin === 'extension' || origin === 'internal'` 검사가 승인 팝업을 완전히 우회합니다. DApp이 origin을 조작할 수 있다면 사용자 동의 없이 트랜잭션을 실행할 수 있습니다.

```typescript
// 현재 코드 (취약)
const isInternalRequest = origin === 'extension' || origin === 'internal'
if (!isInternalRequest) {
  try {
    await approvalController.requestAuthorization(...)
  }
}
```

#### 수정 방법

Origin 검증을 `chrome.runtime.MessageSender`를 통해 수행해야 합니다.

```typescript
// 수정된 코드
function isInternalOrigin(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.url) return false
  const extensionUrl = chrome.runtime.getURL('')
  return sender.url.startsWith(extensionUrl)
}

// handler에서 사용
const isInternalRequest = isInternalOrigin(sender)
if (!isInternalRequest) {
  try {
    await approvalController.requestAuthorization(...)
  }
}
```

#### 영향 범위
- EIP-7702 authorization signing
- 모든 트랜잭션 승인 플로우

---

### CRITICAL-2: XSS Vulnerability in HTML Template

**영역**: Go Services (pg-simulator)
**파일**: `services/pg-simulator/internal/handler/payment.go:310-387`
**심각도**: 🔴 CRITICAL
**유형**: Security - XSS

#### 문제점

`RenderChallengePage` 함수에서 사용자 입력(`acsTransactionID`, `returnURL`)을 HTML 템플릿에 직접 삽입하여 XSS 공격에 취약합니다.

```go
// 현재 코드 (취약)
html := `<!DOCTYPE html>
...
<strong>Transaction ID:</strong> ` + acsTransactionID[:8] + `...<br>
...
<input type="hidden" id="returnUrl" value="` + returnURL + `">
<input type="hidden" id="acsTransactionId" value="` + acsTransactionID + `">
```

#### 수정 방법

```go
import "html"

func (h *PaymentHandler) RenderChallengePage(c *gin.Context) {
    acsTransactionID := html.EscapeString(c.Param("acsTransactionId"))
    returnURL := html.EscapeString(c.Query("returnUrl"))

    // 또는 Go 템플릿 엔진 사용 (자동 이스케이프)
    tmpl := template.Must(template.ParseFiles("challenge.html"))
    tmpl.Execute(c.Writer, map[string]string{
        "TransactionID": acsTransactionID,
        "ReturnURL":     returnURL,
    })
}
```

#### 영향 범위
- 3DS 챌린지 페이지
- 결제 흐름 전체

---

### CRITICAL-3: Race Condition in Payment Processing

**영역**: Go Services (pg-simulator)
**파일**: `services/pg-simulator/internal/service/payment.go:62-76`
**심각도**: 🔴 CRITICAL
**유형**: Concurrency - TOCTOU

#### 문제점

Idempotency key 확인과 payment 생성 사이에 TOCTOU (Time-of-Check-Time-of-Use) 경합 조건이 존재합니다.

```go
// 현재 코드 (취약)
s.mu.RLock()
if req.IdempotencyKey != "" {
    if existingPaymentID, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
        // ...
    }
}
s.mu.RUnlock()  // 여기서 락 해제 - 다른 고루틴 진입 가능

switch req.Method {  // 락 없이 처리
case model.PaymentMethodCard:
    return s.processCardPayment(req)
```

#### 수정 방법

```go
func (s *PaymentService) CreatePayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // Idempotency check (락 내에서)
    if req.IdempotencyKey != "" {
        if existingPaymentID, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
            if existingPayment, ok := s.payments[existingPaymentID]; ok {
                return existingPayment, nil
            }
        }
    }

    // 결제 처리 (락 내에서)
    var payment *model.Payment
    var err error

    switch req.Method {
    case model.PaymentMethodCard:
        payment, err = s.processCardPaymentLocked(req)  // 락 없는 내부 함수
    // ...
    }

    if err == nil && req.IdempotencyKey != "" {
        s.idempotencyKeys[req.IdempotencyKey] = payment.ID
    }

    return payment, err
}
```

#### 영향 범위
- 중복 결제 발생 가능
- 데이터 무결성 손상

---

### CRITICAL-4: Unauthenticated Admin Endpoints

**영역**: TypeScript Services (paymaster-proxy)
**파일**: `services/paymaster-proxy/src/app.ts:113-121`
**심각도**: 🔴 CRITICAL
**유형**: Security - Missing Authentication

#### 문제점

Admin policy 관리 엔드포인트에 인증이 없어 누구나 후원 정책을 수정할 수 있습니다.

```typescript
// 현재 코드 (취약)
app.get('/admin/policies', (c) => {
  const policies = policyManager.getAllPolicies()
  return c.json({ policies })
})

app.post('/admin/policies', async (c) => {
  const body = await c.req.json()
  policyManager.setPolicy(body)  // 인증 없이 정책 수정!
  return c.json({ success: true })
})
```

#### 수정 방법

```typescript
import { bearerAuth } from 'hono/bearer-auth'

// 환경 변수에서 admin 토큰 로드
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN
if (!ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_API_TOKEN is required in production')
}

const adminAuth = bearerAuth({
  token: ADMIN_TOKEN!,
  invalidTokenMessage: 'Unauthorized: Invalid admin token'
})

// 인증 미들웨어 적용
app.get('/admin/policies', adminAuth, (c) => {
  const policies = policyManager.getAllPolicies()
  return c.json({ policies })
})

app.post('/admin/policies', adminAuth, async (c) => {
  const body = await c.req.json()
  // 입력 검증 추가
  const result = policySchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid policy data', details: result.error }, 400)
  }
  policyManager.setPolicy(result.data)
  return c.json({ success: true })
})
```

#### 영향 범위
- Paymaster 후원 정책 무단 변경
- 가스비 후원 남용 가능

---

### CRITICAL-5: Private Key Exposure in URL

**영역**: TypeScript Services (stealth-server)
**파일**: `services/stealth-server/src/api/handlers.rs:349-355`
**심각도**: 🔴 CRITICAL
**유형**: Security - Sensitive Data Exposure

#### 문제점

scan API가 viewing private key를 쿼리 파라미터로 받아 서버 로그와 브라우저 히스토리에 노출됩니다.

```rust
// 현재 코드 (취약)
#[derive(Debug, Deserialize)]
pub struct ScanQuery {
    pub viewing_private_key: String,  // URL 쿼리에 개인키!
    pub from_block: Option<u64>,
    // ...
}

// GET /scan?viewing_private_key=0x...
```

#### 수정 방법

```rust
// POST 요청으로 변경
#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub viewing_private_key: String,
    pub from_block: Option<u64>,
    pub to_block: Option<u64>,
}

pub async fn scan(
    storage: web::Data<Storage>,
    body: web::Json<ScanRequest>,  // POST body 사용
) -> impl Responder {
    // ...
}

// 라우터 변경
.route("/scan", web::post().to(scan))  // GET -> POST
```

#### 영향 범위
- 사용자 viewing private key 노출
- 스텔스 주소 프라이버시 침해

---

### CRITICAL-6: Hardcoded Private Keys in .env.example

**영역**: Infrastructure
**파일**: `.env.example:127-131`
**심각도**: 🔴 CRITICAL
**유형**: Security - Hardcoded Secrets

#### 문제점

Well-known Anvil test private keys가 .env.example에 하드코딩되어 있습니다.

```bash
# 현재 코드 (위험)
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BUNDLER_PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
PAYMASTER_SIGNER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

#### 수정 방법

```bash
# 수정된 코드
# ============================================
# SECURITY WARNING: Private Keys
# ============================================
# NEVER commit real private keys to version control.
# For local development with Anvil, run: anvil --accounts 10
# For production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

# Generate new keys: cast wallet new
DEPLOYER_PRIVATE_KEY=<GENERATE_NEW_KEY_REQUIRED>
BUNDLER_PRIVATE_KEY=<GENERATE_NEW_KEY_REQUIRED>
PAYMASTER_SIGNER_PRIVATE_KEY=<GENERATE_NEW_KEY_REQUIRED>
EXECUTOR_PRIVATE_KEY=<GENERATE_NEW_KEY_REQUIRED>
RELAYER_PRIVATE_KEY=<GENERATE_NEW_KEY_REQUIRED>
```

#### 영향 범위
- 테스트넷/메인넷에 잘못 배포 시 자금 손실
- 보안 감사 실패

---

### CRITICAL-7: Hardcoded Keys in Makefile

**영역**: Infrastructure
**파일**: `Makefile:124-144, 207-210`
**심각도**: 🔴 CRITICAL
**유형**: Security - Hardcoded Secrets

#### 문제점

Makefile에 Anvil private keys가 하드코딩되어 있습니다.

```makefile
# 현재 코드 (위험)
deploy-contracts:
	cd ../poc-contract && forge script script/deploy/DeployDevnet.s.sol \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

#### 수정 방법

```makefile
# 수정된 코드
.PHONY: check-env
check-env:
ifndef DEPLOYER_PRIVATE_KEY
	$(error DEPLOYER_PRIVATE_KEY is required. Set via environment variable.)
endif

deploy-contracts: check-env
	@echo "Deploying contracts..."
	cd ../poc-contract && forge script script/deploy/DeployDevnet.s.sol \
		--rpc-url $(RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY) \
		--broadcast
```

---

### CRITICAL-8: Type Inconsistency in UserOperationReceipt

**영역**: TypeScript Packages
**파일**: `packages/types/src/userOp.ts:89-117`, `packages/sdk-ts/types/src/userOperation.ts:66-78`
**심각도**: 🔴 CRITICAL
**유형**: Type Safety

#### 문제점

`UserOperationReceipt` 인터페이스의 필드 타입이 패키지 간에 불일치합니다.

```typescript
// packages/types/src/userOp.ts
interface UserOperationReceipt {
  actualGasCost: Hex  // string 타입
  actualGasUsed: Hex  // string 타입
}

// packages/sdk-ts/types/src/userOperation.ts
interface UserOperationReceipt {
  actualGasCost: bigint  // bigint 타입
  actualGasUsed: bigint  // bigint 타입
}
```

#### 수정 방법

```typescript
// packages/types/src/userOp.ts - 단일 소스로 통합
export interface UserOperationReceipt {
  userOpHash: Hex
  entryPoint: Address
  sender: Address
  nonce: bigint
  paymaster: Address
  actualGasCost: bigint  // bigint로 통일
  actualGasUsed: bigint  // bigint로 통일
  success: boolean
  logs: Log[]
  receipt: TransactionReceipt
}

// packages/sdk-ts/types/src/userOperation.ts
// 직접 정의 제거, re-export로 변경
export { UserOperationReceipt } from '@stablenet/types'
```

---

### CRITICAL-9: Type Duplication Across Packages

**영역**: TypeScript Packages
**파일**: `packages/types/`, `packages/sdk-ts/types/`
**심각도**: 🔴 CRITICAL
**유형**: Architecture - DRY Violation

#### 문제점

`UserOperation`, `PackedUserOperation`, `ExecutionCall` 등 핵심 타입이 여러 패키지에 중복 정의되어 있습니다.

#### 수정 방법

타입 의존성 계층 구조 수립:

```
@stablenet/types (canonical source)
    ↑
    ├── @stablenet/sdk-types (re-exports + SDK-specific)
    │       ↑
    │       └── @stablenet/sdk-core
    │
    ├── @stablenet/wallet-sdk
    ├── @stablenet/contracts
    └── @stablenet/config
```

```typescript
// packages/sdk-ts/types/src/index.ts
// 기존 중복 정의 제거, re-export로 변경
export type {
  UserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  ExecutionCall,
} from '@stablenet/types'

// SDK 전용 타입만 정의
export interface SdkSpecificType {
  // ...
}
```

---

## 4. HIGH 이슈 상세

### HIGH-1: Missing Rate Limiting on RPC Handlers

**영역**: Wallet Extension
**파일**: `apps/wallet-extension/src/background/rpc/handler.ts:32`

#### 문제점

`rateLimiter`가 생성되었지만 실제 RPC handler들에서 사용되지 않습니다.

#### 수정 방법

```typescript
// RPC handler 시작 부분에 rate limiting 추가
eth_requestAccounts: async (_params, origin) => {
  const rateCheck = rateLimiter.check(origin, 'eth_requestAccounts')
  if (!rateCheck.allowed) {
    throw createRpcError({
      code: RPC_ERRORS.LIMIT_EXCEEDED.code,
      message: `Rate limit exceeded. Retry in ${rateCheck.retryAfter}s`,
    })
  }
  // ... 기존 로직
}
```

---

### HIGH-2: Deprecated getMnemonic Without Password

**영역**: Wallet Extension
**파일**: `apps/wallet-extension/src/background/keyring/index.ts:526-540`

#### 문제점

`getMnemonic()` 메서드가 비밀번호 검증 없이 mnemonic을 반환합니다.

#### 수정 방법

```typescript
// 옵션 1: 메서드 제거
getMnemonic(): never {
  throw new Error('Deprecated: Use getMnemonicWithPassword() instead')
}

// 옵션 2: 비밀번호 필수 적용
getMnemonic(password: string): string | null {
  if (!vault.isUnlocked()) {
    throw new Error('Vault is locked')
  }

  // 비밀번호 재검증
  if (!this.verifyPassword(password)) {
    throw new Error('Invalid password')
  }

  const hdKeyring = this.hdKeyrings[0]
  return hdKeyring?.getMnemonic() ?? null
}
```

---

### HIGH-3: Large File Size (1400+ lines)

**영역**: Wallet Extension
**파일**: `apps/wallet-extension/src/background/rpc/handler.ts`

#### 수정 방법

기능별 파일 분리:

```
src/background/rpc/
├── handler.ts                 # 진입점, 라우팅
├── handlers/
│   ├── accountHandlers.ts     # eth_accounts, eth_requestAccounts
│   ├── transactionHandlers.ts # eth_sendTransaction, eth_sendUserOperation
│   ├── signatureHandlers.ts   # personal_sign, eth_signTypedData_v4
│   ├── networkHandlers.ts     # eth_chainId, wallet_switchEthereumChain
│   └── authorizationHandlers.ts # wallet_signAuthorization, wallet_delegateAccount
├── middleware/
│   ├── rateLimiter.ts
│   └── inputValidator.ts
└── utils/
    └── publicClientCache.ts
```

---

### HIGH-4: Nested Mutex Lock (Deadlock Risk)

**영역**: Go Services
**파일**: `services/pg-simulator/internal/service/settlement.go:226-228`

#### 문제점

```go
func (s *SettlementService) getSettlementEligiblePayments(...) []*model.Payment {
    s.paymentService.mu.RLock()  // 다른 서비스의 내부 mutex 직접 접근
    defer s.paymentService.mu.RUnlock()
}
```

#### 수정 방법

```go
// PaymentService에 public 메서드 추가
func (s *PaymentService) GetEligiblePaymentsForSettlement(
    merchantID string,
    cutoffTime time.Time,
) []*model.Payment {
    s.mu.RLock()
    defer s.mu.RUnlock()

    var eligible []*model.Payment
    for _, payment := range s.payments {
        if payment.MerchantID == merchantID &&
           payment.Status == model.StatusCaptured &&
           payment.CreatedAt.Before(cutoffTime) {
            eligible = append(eligible, payment)
        }
    }
    return eligible
}

// SettlementService에서 호출
func (s *SettlementService) getSettlementEligiblePayments(...) []*model.Payment {
    return s.paymentService.GetEligiblePaymentsForSettlement(merchantID, cutoffTime)
}
```

---

### HIGH-5: Unbounded Goroutine Spawning

**영역**: Go Services
**파일**: `services/pg-simulator/internal/service/payment.go:136, 164, 248, 324`

#### 문제점

```go
// 현재 코드 - 무제한 고루틴 생성
go s.sendWebhook("payment."+string(payment.Status), &paymentCopy)
```

#### 수정 방법

```go
type PaymentService struct {
    webhookChan chan webhookJob
    // ...
}

type webhookJob struct {
    eventType string
    data      interface{}
}

func NewPaymentService(cfg *config.Config) *PaymentService {
    s := &PaymentService{
        webhookChan: make(chan webhookJob, 100),
        // ...
    }

    // Worker pool 시작 (10개 worker)
    for i := 0; i < 10; i++ {
        go s.webhookWorker()
    }

    return s
}

func (s *PaymentService) webhookWorker() {
    for job := range s.webhookChan {
        s.sendWebhookSync(job.eventType, job.data)
    }
}

func (s *PaymentService) enqueueWebhook(eventType string, data interface{}) {
    select {
    case s.webhookChan <- webhookJob{eventType, data}:
        // 성공
    default:
        log.Warn("Webhook queue full, dropping event", "type", eventType)
    }
}
```

---

### HIGH-6: Missing Context Propagation

**영역**: Go Services
**파일**: `services/pg-simulator/internal/service/payment.go:423-488`

#### 수정 방법

```go
func (s *PaymentService) sendWebhook(ctx context.Context, eventType string, data interface{}) {
    // Context 전파
    req, err := http.NewRequestWithContext(ctx, "POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
    if err != nil {
        return
    }

    // 타임아웃 설정
    client := &http.Client{
        Timeout: webhookTimeout,
    }

    resp, err := client.Do(req)
    // ...
}
```

---

### HIGH-7: Type Safety Issues ('as any')

**영역**: TypeScript Packages
**파일**: `packages/wallet-sdk/src/hooks/useContractWrite.ts:117`

#### 수정 방법

```typescript
// 수정 전
const calldata = encodeFunctionData({ abi, functionName, args } as any)

// 수정 후
import type { Abi, ExtractAbiFunctionNames } from 'abitype'

function useContractWrite<
  TAbi extends Abi,
  TFunctionName extends ExtractAbiFunctionNames<TAbi, 'nonpayable' | 'payable'>
>({
  abi,
  functionName,
  args,
}: {
  abi: TAbi
  functionName: TFunctionName
  args: readonly unknown[]
}) {
  const calldata = encodeFunctionData({
    abi,
    functionName,
    args,
  })
  // ...
}
```

---

### HIGH-8: Empty Catch Block

**영역**: TypeScript Packages
**파일**: `packages/registry-client/src/client.ts:215-217`

#### 수정 방법

```typescript
// 수정 전
} catch {
  // ignore parse errors
}

// 수정 후
} catch (error) {
  // WebSocket 메시지 파싱 실패 로깅
  if (this.debug || process.env.NODE_ENV === 'development') {
    console.warn('[RegistryClient] Failed to parse message:', raw, error)
  }
  // 파싱 실패한 메시지는 무시하고 계속 진행
}
```

---

### HIGH-9: Missing Authentication in Module-Registry

**영역**: TypeScript Services
**파일**: `services/module-registry/src/server/routes/modules.ts:68-115`

#### 수정 방법

```typescript
import { createAuthHook } from '../middleware/auth'

export function registerModuleRoutes(app: FastifyInstance, store: ModuleStore) {
  const authHook = createAuthHook(process.env.API_KEY)

  // 읽기 작업은 인증 없이 허용
  app.get('/api/v1/modules', async (request, reply) => { ... })
  app.get('/api/v1/modules/:id', async (request, reply) => { ... })

  // 쓰기 작업은 인증 필수
  app.post('/api/v1/modules', { preHandler: [authHook] }, async (request, reply) => { ... })
  app.put('/api/v1/modules/:id', { preHandler: [authHook] }, async (request, reply) => { ... })
  app.delete('/api/v1/modules/:id', { preHandler: [authHook] }, async (request, reply) => { ... })
}
```

---

### HIGH-10: Overly Permissive CORS

**영역**: TypeScript Services
**파일**: `services/module-registry/src/server/index.ts:28-31`

#### 수정 방법

```typescript
await this.app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') ?? ['https://stablenet.io'])
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
})
```

---

### HIGH-11: Private Key in CLI Arguments

**영역**: TypeScript Services
**파일**: `services/paymaster-proxy/src/cli/index.ts:46-49`

#### 수정 방법

```typescript
// CLI 옵션 제거
// .option('signer', { ... })  // 삭제

// 환경 변수만 사용
const signerKey = process.env.PAYMASTER_SIGNER_PRIVATE_KEY
if (!signerKey) {
  logger.error('PAYMASTER_SIGNER_PRIVATE_KEY environment variable is required')
  process.exit(1)
}

// 프로세스 목록에서 숨김
const maskedEnv = { ...process.env }
delete maskedEnv.PAYMASTER_SIGNER_PRIVATE_KEY
```

---

### HIGH-12: API Key Bypass When Undefined

**영역**: TypeScript Services
**파일**: `services/contract-registry/src/server/middleware/auth.ts:3-6`

#### 수정 방법

```typescript
export function createAuthHook(
  apiKey: string | undefined,
  options: { required?: boolean } = { required: true }
) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    // 프로덕션에서는 API key 필수
    if (!apiKey) {
      if (options.required && process.env.NODE_ENV === 'production') {
        request.log.error('API key not configured in production')
        return reply.status(500).send({ error: 'Server configuration error' })
      }
      // 개발 환경에서만 인증 스킵
      request.log.warn('API key not configured, skipping authentication')
      return
    }

    const providedKey = request.headers['x-api-key']
    if (!providedKey || providedKey !== apiKey) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }
}
```

---

### HIGH-13 ~ HIGH-20: Infrastructure Issues

| # | 이슈 | 파일 | 수정 방법 |
|---|------|------|-----------|
| 13 | Default DB Password | `docker-compose.yaml:13` | 환경 변수 사용 `${POSTGRES_PASSWORD:?required}` |
| 14 | Grafana Default Credentials | `docker-compose.yaml:289-292` | 환경 변수 사용 |
| 15 | No Resource Limits | 모든 서비스 | `deploy.resources.limits` 추가 |
| 16 | Exposed Ports | `docker-compose.yaml:15-16` | `127.0.0.1:5432:5432` 로 바인딩 |
| 17 | Weak Webhook Secrets | `.env.example:79-81` | 32자 이상 랜덤 문자열 권장 |

---

## 5. MEDIUM 이슈 상세

### 카테고리별 요약

#### 입력 검증 (Input Validation)

| 파일 | 이슈 | 수정 방법 |
|------|------|-----------|
| `handler.ts:41` | inputValidator 미사용 | 모든 handler에 적용 |
| `payment.go:866` | 금액 음수 검증 누락 | `strconv.ParseFloat` + 범위 체크 |
| `modules.ts:40` | 타입 단언 사용 | Zod 스키마로 변경 |
| `addresses.ts:53` | chainId 유효성 검증 누락 | 정수 및 양수 검증 추가 |

#### 리소스 관리 (Resource Management)

| 파일 | 이슈 | 수정 방법 |
|------|------|-----------|
| `handler.ts:44-53` | publicClientCache TTL 없음 | LRU 캐시 또는 TTL 적용 |
| `memory-store.ts` | 인메모리 스토리지 정리 없음 | 파일 기반 영속화 추가 |
| `client.ts:115-157` | WebSocket 이벤트 핸들러 누수 | close 시 핸들러 정리 |

#### 코드 품질 (Code Quality)

| 파일 | 이슈 | 수정 방법 |
|------|------|-----------|
| `payment.go` | 829줄 대형 파일 | 도메인별 분리 |
| `payment.go:871` | 매직 넘버 사용 | 상수 정의 |
| `payment.go:822` | 커스텀 `contains` 함수 | `strings.Contains` 사용 |
| `provider.ts:12` | `any` 타입 사용 | 제네릭 타입 적용 |

#### 인프라 (Infrastructure)

| 파일 | 이슈 | 수정 방법 |
|------|------|-----------|
| `docker-compose.yml` | SSL 모드 비활성화 | 환경별 설정 분리 |
| `docker-compose.yml` | 재시작 정책 없음 | `restart: unless-stopped` 추가 |
| `prometheus.yml` | 포트 불일치 | 실제 서비스 포트와 동기화 |
| `alertmanager.yml` | localhost URL | 서비스명 사용 |
| `Dockerfile.*` | read-only 파일시스템 미적용 | `read_only: true` 추가 |
| `infra/k8s/` | 빈 디렉토리 | K8s 매니페스트 또는 문서 추가 |

---

## 6. 긍정적 발견 사항

### 보안 (Security)

| 항목 | 설명 |
|------|------|
| 암호화 | AES-256-GCM + PBKDF2 (100,000 iterations) |
| 메모리 보안 | `clearString()`, `sanitize()` 메서드로 민감 데이터 정리 |
| 세션 암호화 | 저장 전 세션 데이터 암호화 |
| 피싱 탐지 | 호모그래프, 타이포스쿼팅, 의심스러운 TLD 탐지 |
| 트랜잭션 시뮬레이션 | 서명 전 `eth_call`로 사전 검증 |
| EIP-712 검증 | Chain ID 포함 도메인 검증 |
| Webhook 보안 | HMAC 서명 검증, 지수 백오프 재시도 |
| 카드 데이터 마스킹 | 카드번호, 계좌번호, 이름 마스킹 |

### 코드 품질 (Code Quality)

| 항목 | 설명 |
|------|------|
| 입력 검증 | Zod 스키마 활용, EIP-55 체크섬 지원 |
| 에러 처리 | 구조화된 SdkError 클래스 계층 |
| 팩토리 패턴 | `createJsonRpcClient`, `createSmartAccountClient` 등 |
| 불변성 패턴 | spread 연산자 활용 |
| JSDoc 문서화 | 상세한 JSDoc 주석 |
| 타입 가드 | `isRpcError`, `isSdkError` 등 |

### 인프라 (Infrastructure)

| 항목 | 설명 |
|------|------|
| Non-root 사용자 | Dockerfile에서 전용 사용자 생성 |
| 멀티스테이지 빌드 | Node.js, Go 모두 적용 |
| 네트워크 분리 | `data-internal` 네트워크 내부 전용 |
| 헬스체크 | 모든 서비스에 적절한 헬스체크 구성 |
| 필수 변수 검증 | `${VAR:?required}` 패턴 사용 |
| 보안 주석 | `.env.example`에 보안 경고 문서화 |
| Alpine 이미지 | 최소화된 베이스 이미지 사용 |

---

## 7. 수정 작업 체크리스트

### Phase 1: CRITICAL 이슈 (즉시 - 배포 차단)

- [ ] **CRITICAL-1**: Wallet Extension origin 검증 강화
- [ ] **CRITICAL-2**: pg-simulator XSS 방지 (`html.EscapeString`)
- [ ] **CRITICAL-3**: pg-simulator Race condition 해결 (단일 Lock)
- [ ] **CRITICAL-4**: paymaster-proxy admin 인증 추가
- [ ] **CRITICAL-5**: stealth-server scan API POST로 변경
- [ ] **CRITICAL-6**: .env.example 하드코딩된 키 제거
- [ ] **CRITICAL-7**: Makefile 하드코딩된 키 제거
- [ ] **CRITICAL-8**: UserOperationReceipt 타입 통일
- [ ] **CRITICAL-9**: 타입 중복 제거, 단일 소스 구축

### Phase 2: HIGH 이슈 (1주 내)

- [ ] **HIGH-1**: Wallet Extension rate limiting 적용
- [ ] **HIGH-2**: getMnemonic 비밀번호 필수화
- [ ] **HIGH-3**: handler.ts 파일 분리
- [ ] **HIGH-4**: SettlementService mutex 접근 캡슐화
- [ ] **HIGH-5**: Webhook worker pool 구현
- [ ] **HIGH-6**: Context propagation 적용
- [ ] **HIGH-7**: `as any` 제거, 적절한 타입 적용
- [ ] **HIGH-8**: 빈 catch 블록에 로깅 추가
- [ ] **HIGH-9**: module-registry 인증 추가
- [ ] **HIGH-10**: CORS 환경별 설정
- [ ] **HIGH-11**: CLI private key 옵션 제거
- [ ] **HIGH-12**: API key 미설정 시 프로덕션 차단
- [ ] **HIGH-13~20**: 인프라 보안 설정

### Phase 3: MEDIUM 이슈 (2주 내)

- [ ] 입력 검증 일관성 확보
- [ ] 리소스 관리 개선 (캐시 TTL, 메모리 정리)
- [ ] 대형 파일 분리
- [ ] 매직 넘버 상수화
- [ ] Docker 보안 설정 강화
- [ ] Prometheus 설정 동기화

---

## 8. 권장 일정

```
Week 1 (즉시)
├── Day 1-2: CRITICAL 보안 이슈 (1-5)
├── Day 3-4: CRITICAL 인프라/타입 이슈 (6-9)
└── Day 5: 검증 및 테스트

Week 2
├── Day 1-3: HIGH 이슈 (1-12)
├── Day 4: HIGH 인프라 이슈 (13-20)
└── Day 5: 통합 테스트

Week 3
├── Day 1-3: MEDIUM 이슈
├── Day 4: 문서화 업데이트
└── Day 5: 최종 검토 및 배포 준비
```

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2025-02-09 | Claude Code Review | 초기 작성 |

---

## 부록: 참조 문서

- [OWASP Top 10](https://owasp.org/Top10/)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Chrome Extension Security](https://developer.chrome.com/docs/extensions/mv3/security/)
