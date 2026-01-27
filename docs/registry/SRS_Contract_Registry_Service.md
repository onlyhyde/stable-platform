# Contract Registry Service - SRS (Software Requirements Specification)

> **문서 버전**: 1.1
> **작성일**: 2026-01-27
> **상태**: ✅ Implemented

---

## 1. 목적 및 배경

### 1.1 해결하려는 문제

StableNet 플랫폼은 10개의 서비스(TypeScript 3, Go 5, Rust 1, Web 1)가 스마트 컨트랙트 주소에 의존한다. 현재 각 서비스가 `.env` 파일 또는 하드코딩으로 주소를 관리하며, 컨트랙트 재배포 시 다음 문제가 발생한다:

| 문제 | 현재 상태 |
|------|----------|
| 주소 변경 시 | `.env` 7개 수동 편집 + 서비스 7개 재시작 |
| 체인 추가 시 | 모든 서비스 설정 파일에 체인 정보 추가 |
| 컨트랙트 추가 시 | 서비스별 코드 수정 필요 |
| 주소 불일치 | 서비스 간 다른 주소를 참조할 위험 |
| 이력 관리 | 변경 기록 없음 |

### 1.2 목적

**Contract Registry Service**는 플랫폼 전체의 컨트랙트 주소를 중앙에서 관리하고, 모든 서비스에 실시간으로 주소를 제공하는 서비스다.

### 1.3 범위

- 컨트랙트 주소 등록, 조회, 검색
- 체인별 주소 관리
- 변경사항 실시간 알림
- 배포 아티팩트 자동 연동
- 클라이언트 SDK (TypeScript, Go, Rust)

### 1.4 범위 외

- 컨트랙트 배포 자체
- ABI 호스팅 (별도 서비스 영역)
- 온체인 레지스트리 (향후 확장)

---

## 2. 이해관계자 및 사용자

### 2.1 서비스 소비자 (Consumer)

주소를 조회하고 변경 알림을 수신하는 주체.

| 서비스 | 언어 | 필요 주소 | 빈도 |
|--------|------|----------|------|
| apps/web | TypeScript | 전체 (core, privacy, subscription 등) | 페이지 로드 시 |
| bundler | TypeScript | EntryPoint | 시작 시 + 변경 시 |
| paymaster-proxy | TypeScript | Paymaster | 시작 시 + 변경 시 |
| subscription-executor | Go | SubscriptionManager, Executor, EntryPoint | 시작 시 + 변경 시 |
| bridge-relayer | Go | Bridge 관련 6개 | 시작 시 + 변경 시 |
| order-router | Go | DEX Router 4개 | 시작 시 + 변경 시 |
| stealth-server | Rust | StealthAnnouncer | 시작 시 + 변경 시 |

### 2.2 주소 등록자 (Publisher)

컨트랙트 주소를 등록하고 업데이트하는 주체.

| 등록자 | 방식 | 시점 |
|--------|------|------|
| 배포 스크립트 (Foundry) | 배포 아티팩트 자동 감지 | 컨트랙트 배포 후 |
| 개발자 | REST API / CLI | 수동 등록/수정 |
| CI/CD 파이프라인 | REST API | 자동 배포 후 |

### 2.3 운영자 (Operator)

서비스 상태 모니터링, 설정 관리.

---

## 3. 기능 요구사항

### FR-1. 컨트랙트 등록 및 관리

컨트랙트 주소를 등록, 수정, 삭제한다.

#### FR-1.1 컨트랙트 등록

- 필수 필드: `chainId`, `name`, `address`
- 선택 필드: `category`, `description`, `version`, `tags`, `metadata`
- `chainId + name` 조합은 unique
- 등록 시 address format 검증 (EVM: `0x` + 40 hex chars)
- 동일 `chainId + name`에 대한 중복 등록 시 업데이트로 처리

#### FR-1.2 컨트랙트 수정

- address 변경 시 이전 값은 이력으로 보관 (FR-6)
- 수정 시점 타임스탬프 기록

#### FR-1.3 컨트랙트 삭제

- soft delete (비활성화) 지원
- 삭제된 컨트랙트는 조회 결과에서 기본 제외, 옵션으로 포함 가능

#### FR-1.4 벌크 등록

- 여러 컨트랙트를 한 번에 등록/수정
- 배포 아티팩트 import 시 활용

### FR-2. 주소 조회 (Resolution)

다양한 기준으로 컨트랙트 주소를 조회한다.

#### FR-2.1 체인별 전체 조회

- 특정 chainId의 모든 등록된 컨트랙트 조회
- 현재 `@stablenet/contracts`의 `getChainAddresses(chainId)` 대체

#### FR-2.2 카테고리별 조회

- 카테고리 분류: `core`, `validators`, `executors`, `hooks`, `paymasters`, `privacy`, `compliance`, `subscriptions`, `defi`, `bridge`, `tokens`
- 특정 체인 + 카테고리 조합 조회

#### FR-2.3 개별 조회

- `chainId + name`으로 단일 주소 조회
- 예: `GET /v1/chains/31337/contracts/entryPoint` → `0x5FbDB...`

#### FR-2.4 주소 역검색

- 주소로 컨트랙트 이름/체인/카테고리 조회
- 예: `GET /v1/contracts?address=0x5FbDB...` → `{ name: "entryPoint", chainId: 31337, ... }`

### FR-3. 검색 및 필터링

컨트랙트를 다양한 기준으로 검색한다.

#### FR-3.1 이름 검색

- 부분 일치 (contains) 지원
- 대소문자 무시
- 예: `?q=paymaster` → verifyingPaymaster, tokenPaymaster 모두 반환

#### FR-3.2 태그 검색

- 태그 기반 필터링
- 예: `?tags=erc4337,core` → ERC-4337 관련 핵심 컨트랙트

#### FR-3.3 카테고리 필터

- 단일 또는 복수 카테고리 필터
- 예: `?category=privacy,stealth`

#### FR-3.4 체인 간 검색

- 동일 이름의 컨트랙트를 여러 체인에서 조회
- 예: `GET /v1/contracts/entryPoint` → 모든 체인의 entryPoint 주소

### FR-4. 실시간 변경 알림 (Notification)

주소 변경 시 구독자에게 실시간 알림을 전달한다.

#### FR-4.1 WebSocket 구독

- 특정 체인 구독: `subscribe(chainId)`
- 특정 컨트랙트 구독: `subscribe(chainId, contractName)`
- 전체 구독: `subscribe(*)`

#### FR-4.2 SSE (Server-Sent Events)

- WebSocket 대안으로 SSE 지원
- 방화벽 환경에서 WebSocket이 차단될 경우 대안

#### FR-4.3 Webhook

- 외부 URL로 변경 알림 전송
- Webhook 등록: URL, 대상(체인/컨트랙트), secret
- 재시도 정책: 3회, exponential backoff

#### FR-4.4 알림 페이로드

```json
{
  "event": "contract.updated",
  "timestamp": "2026-01-27T12:00:00Z",
  "chainId": 31337,
  "contract": {
    "name": "entryPoint",
    "category": "core",
    "address": "0xNewAddress...",
    "previousAddress": "0xOldAddress..."
  }
}
```

### FR-5. 배포 아티팩트 연동

Foundry/Hardhat 배포 결과를 자동으로 인식하고 등록한다.

#### FR-5.1 파일 감시 (File Watcher)

- 배포 출력 디렉토리 감시 (예: `poc-contract/deployments/`)
- `addresses.json` 파일 변경 시 자동 파싱 및 등록
- 현재 `packages/contracts/src/watcher.ts` 기능 흡수

#### FR-5.2 Foundry 포맷 지원

- Foundry broadcast output JSON 파싱
- `deployments/{chainId}/addresses.json` 구조 지원
- 현재 `packages/contracts/scripts/generate-addresses.ts` 기능 흡수

#### FR-5.3 수동 Import

- REST API를 통한 배포 아티팩트 업로드
- CLI를 통한 파일 지정 import
- CI/CD 파이프라인에서의 자동 import

### FR-6. 변경 이력 (Version History)

주소 변경 내역을 기록하고 조회한다.

#### FR-6.1 이력 기록

- 변경 시점, 이전 주소, 새 주소, 변경자, 사유
- 자동 기록 (등록/수정/삭제 시)

#### FR-6.2 이력 조회

- 특정 컨트랙트의 변경 이력 조회
- 기간별 필터링
- 체인별/카테고리별 변경 이력 조회

#### FR-6.3 롤백

- 이전 주소로 롤백 가능
- 롤백도 변경 이력으로 기록

### FR-7. Address Set (설정 셋)

관련 컨트랙트들을 묶어 하나의 설정 셋으로 관리한다.

#### FR-7.1 셋 정의

- 이름, 설명, 포함 컨트랙트 목록으로 구성
- 예: "bundler-config" → `{ entryPoint, accountFactory }`
- 예: "stealth-config" → `{ stealthAnnouncer, stealthRegistry }`
- 예: "full-platform" → 모든 컨트랙트

#### FR-7.2 셋 조회

- 셋 이름으로 조회 시 포함된 모든 컨트랙트 주소 반환
- 서비스가 자신에게 필요한 셋만 구독 가능

#### FR-7.3 셋 기반 구독

- 셋에 포함된 컨트랙트 중 하나라도 변경 시 알림
- 서비스별 관심사 분리

#### FR-7.4 셋 기반 .env 생성

- 셋에 포함된 컨트랙트를 `.env` 형식으로 export
- 기존 서비스의 점진적 마이그레이션 지원
- 예: `GET /v1/sets/bundler-config/export?format=env`

```env
BUNDLER_ENTRY_POINT=0x5FbDB2315678afecb367f032d93F642f64180aa3
ACCOUNT_FACTORY=0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c
```

### FR-8. 체인 관리

지원 체인을 등록하고 관리한다.

#### FR-8.1 체인 등록

- chainId, name, rpcUrl, blockExplorerUrl
- 네트워크 타입: devnet, testnet, mainnet

#### FR-8.2 체인별 서비스 URL

- 체인별 bundler, paymaster, stealthServer 등 서비스 URL 관리
- 현재 `SERVICE_URLS` 대체

#### FR-8.3 체인별 토큰 정보

- 기본 토큰 목록 관리
- 현재 `DEFAULT_TOKENS` 대체

### FR-9. CLI 도구

커맨드라인에서 레지스트리와 상호작용한다.

#### FR-9.1 조회 명령

```bash
# 체인별 전체 조회
stablenet-registry list --chain 31337

# 개별 조회
stablenet-registry get entryPoint --chain 31337

# 검색
stablenet-registry search paymaster

# 셋 조회
stablenet-registry set bundler-config --chain 31337
```

#### FR-9.2 등록 명령

```bash
# 단일 등록
stablenet-registry register entryPoint 0x5FbDB... --chain 31337 --category core

# 파일에서 import
stablenet-registry import ./deployments/31337/addresses.json

# .env 생성
stablenet-registry export --set bundler-config --chain 31337 --format env > .env
```

#### FR-9.3 감시 명령

```bash
# 변경 감시 (실시간 출력)
stablenet-registry watch --chain 31337

# 배포 디렉토리 감시 → 자동 등록
stablenet-registry watch-deploy ./poc-contract/deployments/
```

---

## 4. 비기능 요구사항

### NFR-1. 성능

| 지표 | 요구사항 |
|------|----------|
| API 응답 시간 | p95 < 50ms |
| WebSocket 알림 지연 | < 500ms (변경 감지 후) |
| 동시 WebSocket 연결 | 100+ |
| 동시 API 요청 | 1000 req/s |

### NFR-2. 가용성

| 지표 | 요구사항 |
|------|----------|
| 서비스 가용성 | 99.9% |
| 장애 복구 시간 | < 30s (자동 재시작) |
| 데이터 지속성 | 디스크 기반 (SQLite 또는 파일) |
| Graceful Shutdown | 진행 중인 연결 정리 후 종료 |

### NFR-3. 확장성

| 항목 | 요구사항 |
|------|----------|
| 체인 수 | 100+ |
| 체인별 컨트랙트 수 | 1000+ |
| 이력 보관 기간 | 무제한 |
| 클라이언트 언어 | TypeScript, Go, Rust |

### NFR-4. 보안

| 항목 | 요구사항 |
|------|----------|
| 조회 API | 인증 불필요 (공개) |
| 등록/수정/삭제 API | API Key 인증 |
| WebSocket 구독 | 인증 불필요 |
| Webhook secret | HMAC-SHA256 서명 |
| 입력 검증 | 모든 입력에 대해 형식/길이 검증 |

### NFR-5. 운영성

| 항목 | 요구사항 |
|------|----------|
| 로깅 | 구조화된 JSON 로그 |
| 헬스체크 | `/health` 엔드포인트 |
| 메트릭 | 요청 수, 응답 시간, 연결 수 |
| 설정 | 환경변수 기반, 최소 설정 |

### NFR-6. 호환성

| 항목 | 요구사항 |
|------|----------|
| 기존 서비스 | `.env` export로 점진적 마이그레이션 |
| @stablenet/contracts | 동일 데이터 모델 호환 |
| Foundry 배포 출력 | 자동 파싱 지원 |
| API 버저닝 | `/v1/` prefix, 하위 호환성 보장 |

---

## 5. 데이터 모델

### 5.1 Core Entities

```
Chain
├── chainId: number (PK)
├── name: string
├── networkType: "devnet" | "testnet" | "mainnet"
├── rpcUrl: string
├── blockExplorerUrl?: string
├── createdAt: timestamp
└── updatedAt: timestamp

Contract
├── id: string (PK, auto)
├── chainId: number (FK → Chain)
├── name: string
├── address: string
├── category: string
├── description?: string
├── version?: string
├── tags: string[]
├── metadata: jsonb
├── isActive: boolean
├── createdAt: timestamp
└── updatedAt: timestamp
│
├── UNIQUE(chainId, name)
└── INDEX(chainId, category)

ContractHistory
├── id: string (PK, auto)
├── contractId: string (FK → Contract)
├── previousAddress: string
├── newAddress: string
├── changedBy: string
├── reason?: string
└── changedAt: timestamp

AddressSet
├── id: string (PK, auto)
├── name: string (UNIQUE)
├── description?: string
├── contractNames: string[]
├── envMapping: Record<string, string>  // contractName → ENV_VAR_NAME
├── createdAt: timestamp
└── updatedAt: timestamp

ServiceUrl
├── chainId: number (FK → Chain)
├── serviceName: string
├── url: string
├── UNIQUE(chainId, serviceName)
└── updatedAt: timestamp

Token
├── chainId: number (FK → Chain)
├── address: string
├── name: string
├── symbol: string
├── decimals: number
├── logoUrl?: string
└── UNIQUE(chainId, address)

WebhookSubscription
├── id: string (PK, auto)
├── url: string
├── secret: string
├── chainIds: number[]       // 빈 배열 = 전체
├── contractNames: string[]  // 빈 배열 = 전체
├── setName?: string         // 셋 기반 구독
├── isActive: boolean
├── lastDeliveredAt?: timestamp
├── failCount: number
└── createdAt: timestamp
```

### 5.2 Address Set 예시 (사전 정의)

```yaml
bundler-config:
  description: "ERC-4337 Bundler 서비스에 필요한 주소"
  contracts: [entryPoint]
  envMapping:
    entryPoint: BUNDLER_ENTRY_POINT

paymaster-config:
  description: "Paymaster Proxy 서비스에 필요한 주소"
  contracts: [verifyingPaymaster]
  envMapping:
    verifyingPaymaster: PAYMASTER_ADDRESS

stealth-config:
  description: "Stealth Server에 필요한 주소"
  contracts: [stealthAnnouncer, stealthRegistry]
  envMapping:
    stealthAnnouncer: STEALTH_ANNOUNCER_ADDRESS

subscription-config:
  description: "Subscription Executor에 필요한 주소"
  contracts: [subscriptionManager, recurringPaymentExecutor, entryPoint]
  envMapping:
    subscriptionManager: SUBSCRIPTION_MANAGER_ADDRESS
    recurringPaymentExecutor: RECURRING_PAYMENT_EXECUTOR_ADDRESS
    entryPoint: ENTRYPOINT_ADDRESS

bridge-config:
  description: "Bridge Relayer에 필요한 주소"
  contracts: [secureBridge, bridgeValidator, bridgeRateLimiter, optimisticVerifier, fraudProofVerifier, bridgeGuardian]
  envMapping:
    secureBridge: CONTRACT_SECURE_BRIDGE
    bridgeValidator: CONTRACT_BRIDGE_VALIDATOR
    bridgeRateLimiter: CONTRACT_BRIDGE_RATE_LIMITER
    optimisticVerifier: CONTRACT_OPTIMISTIC_VERIFIER
    fraudProofVerifier: CONTRACT_FRAUD_PROOF_VERIFIER
    bridgeGuardian: CONTRACT_BRIDGE_GUARDIAN

web-config:
  description: "Web App에 필요한 전체 주소"
  contracts: [entryPoint, kernelFactory, verifyingPaymaster, stealthAnnouncer, stealthRegistry, subscriptionManager, recurringPaymentExecutor, permissionManager]
  envMapping: {}  # Web은 API로 직접 조회

full-platform:
  description: "모든 컨트랙트"
  contracts: ["*"]
  envMapping: {}
```

---

## 6. API 명세 (요약)

### 6.1 Contract API

```
GET    /v1/chains/{chainId}/contracts                  # 체인별 전체 조회
GET    /v1/chains/{chainId}/contracts/{name}            # 개별 조회
GET    /v1/chains/{chainId}/contracts?category={cat}    # 카테고리 필터
POST   /v1/chains/{chainId}/contracts                   # 등록 (인증)
PUT    /v1/chains/{chainId}/contracts/{name}             # 수정 (인증)
DELETE /v1/chains/{chainId}/contracts/{name}             # 삭제 (인증)
POST   /v1/chains/{chainId}/contracts/bulk               # 벌크 등록 (인증)
```

### 6.2 Search API

```
GET    /v1/search?q={query}                             # 이름 검색
GET    /v1/search?address={address}                     # 주소 역검색
GET    /v1/search?tags={tag1,tag2}                      # 태그 검색
GET    /v1/contracts/{name}                             # 크로스체인 조회
```

### 6.3 Address Set API

```
GET    /v1/sets                                         # 셋 목록
GET    /v1/sets/{name}                                  # 셋 상세
GET    /v1/sets/{name}/resolve?chainId={id}              # 셋의 주소 해석
GET    /v1/sets/{name}/export?chainId={id}&format={fmt}  # .env / json export
POST   /v1/sets                                         # 셋 생성 (인증)
PUT    /v1/sets/{name}                                  # 셋 수정 (인증)
DELETE /v1/sets/{name}                                  # 셋 삭제 (인증)
```

### 6.4 Chain API

```
GET    /v1/chains                                       # 지원 체인 목록
GET    /v1/chains/{chainId}                              # 체인 상세 (주소 + 서비스 + 토큰)
POST   /v1/chains                                       # 체인 등록 (인증)
PUT    /v1/chains/{chainId}                              # 체인 수정 (인증)
```

### 6.5 History API

```
GET    /v1/chains/{chainId}/contracts/{name}/history     # 변경 이력
GET    /v1/history?chainId={id}&from={ts}&to={ts}        # 기간별 이력
```

### 6.6 Realtime API

```
WS     /v1/ws                                           # WebSocket 연결
         → subscribe: { chainIds?, contractNames?, setName? }
         → unsubscribe: { ... }
         ← event: { type, chainId, contract, timestamp }

GET    /v1/sse?chainId={id}                              # SSE 스트림
```

### 6.7 Webhook API

```
GET    /v1/webhooks                                     # 등록된 webhook 목록 (인증)
POST   /v1/webhooks                                     # webhook 등록 (인증)
DELETE /v1/webhooks/{id}                                 # webhook 삭제 (인증)
```

### 6.8 Import API

```
POST   /v1/import/foundry                                # Foundry 아티팩트 import (인증)
POST   /v1/import/file                                   # 범용 파일 import (인증)
```

### 6.9 Operational API

```
GET    /v1/health                                       # 헬스체크
GET    /v1/metrics                                      # 서비스 메트릭
```

---

## 7. 클라이언트 SDK 요구사항

### 7.1 공통 인터페이스

모든 언어의 SDK는 동일한 논리적 인터페이스를 제공한다:

```
RegistryClient
├── constructor(config: { url, apiKey?, cacheEnabled? })
│
├── # 조회
├── getAddress(chainId, name) → Address
├── getAddresses(chainId) → Map<name, Address>
├── getAddressesByCategory(chainId, category) → Map<name, Address>
├── resolveSet(chainId, setName) → Map<name, Address>
│
├── # 검색
├── search(query) → Contract[]
├── reverseSearch(address) → Contract[]
│
├── # 구독
├── subscribe(options: { chainIds?, names?, setName? }, callback) → Unsubscribe
│
├── # 캐시
├── getCached(chainId, name) → Address | null
├── refreshCache(chainId?) → void
│
├── # 라이프사이클
├── connect() → void
├── disconnect() → void
└── isConnected() → boolean
```

### 7.2 TypeScript SDK 추가 요구사항

- `@stablenet/contracts` 패키지의 기존 인터페이스(`ChainAddresses`, `getChainAddresses()` 등)와 호환
- React hook 제공: `useRegistryAddress(chainId, name)`, `useRegistrySet(chainId, setName)`
- `viem`의 `Address` 타입 호환

### 7.3 Go SDK 추가 요구사항

- `context.Context` 기반 API
- goroutine-safe
- `sync.RWMutex` 기반 in-memory cache
- 구독 콜백은 별도 goroutine에서 실행

### 7.4 Rust SDK 추가 요구사항

- `tokio` 기반 async
- `Arc<RwLock<>>` 기반 thread-safe cache
- `serde` 직렬화 지원
- `alloy` 또는 `ethers` Address 타입 호환

### 7.5 클라이언트 장애 복구

- 연결 실패 시 exponential backoff 재연결 (최대 30초)
- 서버 미응답 시 로컬 캐시 사용 (stale 허용)
- 캐시 워밍업: 연결 성공 시 즉시 전체 주소 fetch

---

## 8. 마이그레이션 전략

### 8.1 단계별 마이그레이션

```
Phase 0: Registry Service 배포 (기존 서비스 변경 없음)
  └── 기존 addresses.json에서 초기 데이터 import
  └── Foundry watcher 활성화

Phase 1: TypeScript 서비스 마이그레이션
  └── apps/web: SDK 클라이언트 연동
  └── bundler: SDK 클라이언트 연동
  └── paymaster-proxy: SDK 클라이언트 연동

Phase 2: Go 서비스 마이그레이션
  └── subscription-executor: Go SDK 연동
  └── bridge-relayer: Go SDK 연동
  └── order-router: Go SDK 연동

Phase 3: Rust 서비스 마이그레이션
  └── stealth-server: Rust SDK 연동

Phase 4: 레거시 제거
  └── 하드코딩된 주소 제거
  └── .env 주소 관련 항목 제거
  └── packages/contracts의 정적 주소 파일 deprecate
```

### 8.2 하위 호환성

- Phase 0~3 동안 `.env` export 기능으로 기존 방식 병행 가능
- SDK 클라이언트가 서버 미접속 시 fallback으로 환경변수 사용
- `packages/contracts`의 기존 API는 내부적으로 Registry Client를 사용하도록 점진 전환

---

## 9. 기술적 제약사항

### 9.1 기술 스택 제약

- 서비스: monorepo 내 `services/` 디렉토리에 위치
- 클라이언트 SDK: 각 언어의 기존 패키지 매니저 활용
  - TypeScript: `packages/` workspace 패키지
  - Go: `go module`
  - Rust: `crate`

### 9.2 인프라 제약

- 단일 프로세스로 실행 가능해야 함 (외부 DB 의존 최소화)
- 개발 환경에서 추가 인프라 없이 동작 (SQLite 또는 파일 기반)
- Docker 환경 지원

### 9.3 기존 시스템 연동

- `packages/contracts/scripts/generate-addresses.ts` 기능 흡수 또는 연동
- `packages/contracts/src/watcher.ts` 기능 흡수 또는 연동
- `poc-contract/deployments/` 디렉토리 구조 호환

---

## 10. Feature 우선순위

### P0 (MVP - 필수)

| ID | Feature | 근거 |
|----|---------|------|
| FR-1.1 | 컨트랙트 등록 | 핵심 기능 |
| FR-1.4 | 벌크 등록 | 배포 연동에 필수 |
| FR-2.1 | 체인별 전체 조회 | 가장 빈번한 사용 패턴 |
| FR-2.3 | 개별 조회 | 기본 해석 기능 |
| FR-4.1 | WebSocket 구독 | 재시작 없는 주소 반영의 핵심 |
| FR-5.1 | 파일 감시 | 배포 자동 연동 |
| FR-5.2 | Foundry 포맷 지원 | 현재 배포 도구 호환 |
| FR-7.1 | 셋 정의 | 서비스별 설정 관리 |
| FR-7.2 | 셋 조회 | 서비스별 필요 주소 일괄 조회 |
| FR-7.4 | .env export | 마이그레이션 지원 |
| NFR-5 | 기존 서비스 호환 | 점진적 마이그레이션 필수 |

### P1 (중요)

| ID | Feature | 근거 |
|----|---------|------|
| FR-1.2 | 컨트랙트 수정 | 주소 업데이트 |
| FR-2.2 | 카테고리별 조회 | 편의 기능 |
| FR-3.1 | 이름 검색 | 탐색 기능 |
| FR-4.2 | SSE | WebSocket 대안 |
| FR-6.1 | 이력 기록 | 추적성 |
| FR-6.2 | 이력 조회 | 디버깅 |
| FR-8.1 | 체인 등록 | 멀티체인 관리 |
| FR-8.2 | 서비스 URL 관리 | SERVICE_URLS 대체 |
| FR-9.1 | CLI 조회 | 개발 편의 |
| FR-9.2 | CLI 등록 | 운영 편의 |

### P2 (개선)

| ID | Feature | 근거 |
|----|---------|------|
| FR-1.3 | 컨트랙트 삭제 | 관리 기능 |
| FR-2.4 | 주소 역검색 | 탐색 기능 |
| FR-3.2 | 태그 검색 | 고급 검색 |
| FR-3.4 | 체인 간 검색 | 멀티체인 비교 |
| FR-4.3 | Webhook | 외부 연동 |
| FR-6.3 | 롤백 | 복구 기능 |
| FR-7.3 | 셋 기반 구독 | 고급 구독 |
| FR-8.3 | 토큰 정보 | DEFAULT_TOKENS 대체 |
| FR-9.3 | CLI 감시 | 개발 편의 |

---

## 11. 용어 정의

| 용어 | 정의 |
|------|------|
| **Contract** | 블록체인에 배포된 스마트 컨트랙트 |
| **Chain** | 블록체인 네트워크 (chainId로 식별) |
| **Address** | 컨트랙트의 블록체인 상 주소 |
| **Category** | 컨트랙트의 기능적 분류 (core, privacy 등) |
| **Address Set** | 서비스가 필요로 하는 컨트랙트 주소들의 묶음 |
| **Registry** | 컨트랙트 주소를 중앙 관리하는 본 서비스 |
| **Consumer** | Registry에서 주소를 조회하는 서비스/앱 |
| **Publisher** | Registry에 주소를 등록하는 주체 |
| **Deployment Artifact** | 컨트랙트 배포 도구(Foundry 등)의 출력 파일 |

---

## 12. 관련 문서

- [13_Web_SDK_Integration_Review.md](../poc/13_Web_SDK_Integration_Review.md) - Web/SDK 통합 검토 보고서
- [00_PoC_Overview.md](../poc/00_PoC_Overview.md) - PoC 전체 개요
- [01_System_Architecture.md](../poc/01_System_Architecture.md) - 시스템 아키텍처
