# Contract Registry Service

> **버전**: 0.1.0
> **최종 업데이트**: 2026-01-27
> **상태**: ✅ Implemented

## 개요

Contract Registry Service는 StableNet 플랫폼의 모든 스마트 컨트랙트 주소를 중앙에서 관리하는 HTTP/WebSocket 서비스입니다.

### 주요 기능

- REST API를 통한 컨트랙트 주소 CRUD
- WebSocket을 통한 실시간 주소 변경 알림
- Foundry 배포 아티팩트 자동 감지 및 등록
- JSON 파일 기반 영속성
- TypeScript 클라이언트 SDK (React hooks 포함)

---

## 아키텍처

```
services/contract-registry/     # 레지스트리 서비스 (Port: 4400)
├── src/
│   ├── cli/                    # CLI 엔트리포인트
│   ├── server/                 # Fastify 서버
│   │   ├── routes/             # REST API 라우트
│   │   ├── middleware/         # 인증, 검증
│   │   ├── schemas/            # Zod 스키마
│   │   └── websocket/          # WebSocket 핸들러
│   ├── store/                  # 인메모리 스토어 + 영속성
│   ├── watcher/                # Foundry 아티팩트 감시
│   └── utils/                  # 로거, ID 생성
└── tests/                      # 유닛/통합 테스트

packages/registry-client/       # 클라이언트 SDK
├── src/
│   ├── client.ts               # RegistryClient
│   ├── types.ts                # 공유 타입
│   └── react/                  # React Provider + Hooks
│       └── hooks/
└── tests/
```

---

## API 레퍼런스

### REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | 헬스체크 |
| `GET` | `/api/v1/contracts` | No | 컨트랙트 목록 (query: chainId, tag, name) |
| `GET` | `/api/v1/contracts/:chainId/:name` | No | 단일 컨트랙트 조회 |
| `POST` | `/api/v1/contracts` | Yes | 컨트랙트 생성/수정 |
| `DELETE` | `/api/v1/contracts/:chainId/:name` | Yes | 컨트랙트 삭제 |
| `GET` | `/api/v1/sets` | No | 주소 세트 목록 |
| `GET` | `/api/v1/sets/:chainId/:name` | No | 주소 세트 조회 (resolved) |
| `POST` | `/api/v1/sets` | Yes | 주소 세트 생성 |
| `DELETE` | `/api/v1/sets/:chainId/:name` | Yes | 주소 세트 삭제 |
| `GET` | `/api/v1/chains` | No | 등록된 체인 ID 목록 |
| `POST` | `/api/v1/bulk/import` | Yes | 대량 컨트랙트 등록 |

### 인증

쓰기 작업(POST, DELETE)은 `X-API-Key` 헤더 필요:

```bash
curl -X POST http://localhost:4400/api/v1/contracts \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 31337, "name": "entryPoint", "address": "0x..."}'
```

### WebSocket

```
ws://localhost:4400/ws
```

**Protocol:**

```typescript
// Client → Server
{ type: 'subscribe', channels: ['contracts:31337'] }
{ type: 'unsubscribe', channels: ['contracts:31337'] }
{ type: 'ping' }

// Server → Client
{ type: 'subscribed', channels: ['contracts:31337'] }
{ type: 'contract:updated', data: ContractEntry }
{ type: 'contract:deleted', chainId: number, name: string }
{ type: 'set:updated', data: ResolvedAddressSet }
{ type: 'pong' }
```

**Channel 패턴:**
- `contracts:*` — 모든 컨트랙트 변경
- `contracts:{chainId}` — 특정 체인의 변경
- `contracts:{chainId}:{name}` — 특정 컨트랙트
- `sets:{chainId}:{setName}` — 특정 주소 세트

---

## 데이터 모델

### ContractEntry

```typescript
interface ContractEntry {
  id: string               // nanoid
  chainId: number
  name: string             // e.g., "entryPoint"
  address: `0x${string}`
  version: string          // semver
  tags: string[]           // e.g., ["core", "erc4337"]
  abi?: string             // optional ABI JSON
  deployedAt?: number      // block number
  txHash?: `0x${string}`
  metadata: Record<string, unknown>
  createdAt: string        // ISO timestamp
  updatedAt: string
}
```

### AddressSet

```typescript
interface AddressSet {
  id: string
  name: string             // e.g., "bundler-config"
  chainId: number
  contracts: string[]      // contract entry names
  description?: string
  createdAt: string
  updatedAt: string
}
```

---

## 사용법

### 서버 실행

```bash
# 개발 모드
pnpm --filter @stablenet/contract-registry dev

# 프로덕션
pnpm --filter @stablenet/contract-registry build
pnpm --filter @stablenet/contract-registry start
```

### CLI 명령어

```bash
# 서버 시작
registry run --port 4400 --data-dir ./data --api-key your-key

# Foundry 아티팩트 감시
registry run --watch-dir ../poc-contract/broadcast

# JSON 파일에서 import
registry import contracts.json --api-key your-key

# 컨트랙트 목록
registry list --chain 31337

# 컨트랙트 export
registry export --chain 31337 > exported.json
```

### 환경 변수

```bash
REGISTRY_PORT=4400
REGISTRY_DATA_DIR=./data
REGISTRY_WATCH_DIR=             # Foundry broadcast 디렉토리
REGISTRY_API_KEY=               # 쓰기 작업용 API 키
REGISTRY_LOG_LEVEL=info
```

---

## 클라이언트 SDK

### 설치

```bash
pnpm add @stablenet/registry-client
```

### 기본 사용법

```typescript
import { RegistryClient } from '@stablenet/registry-client'

const client = new RegistryClient({
  url: 'http://localhost:4400',
  apiKey: 'your-api-key', // 쓰기 작업 시 필요
})

// 컨트랙트 조회
const entry = await client.getContract(31337, 'entryPoint')
console.log(entry.address)

// 실시간 구독
client.subscribe(['contracts:31337'])
client.on('contract:updated', (entry) => {
  console.log('Updated:', entry.name, entry.address)
})
```

### React Hooks

```tsx
import { RegistryProvider, useContract, useAddressSet } from '@stablenet/registry-client/react'

// App.tsx
function App() {
  return (
    <RegistryProvider options={{ url: 'http://localhost:4400' }}>
      <MyComponent />
    </RegistryProvider>
  )
}

// Component
function MyComponent() {
  const { address, isLoading, error } = useContract(31337, 'entryPoint')
  const { addresses } = useAddressSet(31337, 'bundler-config')

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>EntryPoint: {address}</div>
}
```

---

## Foundry 아티팩트 연동

서버가 `--watch-dir` 옵션으로 시작되면 Foundry broadcast 파일을 자동 감지합니다:

```bash
registry run --watch-dir /path/to/poc-contract
```

감지 시:
1. `broadcast/**/*.json` 파일 변경 감지
2. CREATE/CREATE2 트랜잭션 파싱
3. 컨트랙트 이름 매핑 (e.g., `EntryPoint` → `entryPoint`)
4. 자동 등록 + WebSocket 알림

### 이름 매핑

| Foundry Artifact | Registry Name |
|------------------|---------------|
| `EntryPoint` | `entryPoint` |
| `Kernel` | `kernel` |
| `KernelFactory` | `kernelFactory` |
| `ECDSAValidator` | `ecdsaValidator` |
| `VerifyingPaymaster` | `verifyingPaymaster` |
| ... | ... |

---

## 테스트

```bash
# 전체 테스트
pnpm --filter @stablenet/contract-registry test

# Watch 모드
pnpm --filter @stablenet/contract-registry test:watch
```

### 테스트 현황

| 카테고리 | 테스트 수 | 파일 |
|---------|----------|------|
| Store | 15 | `tests/unit/store.test.ts` |
| Watcher | 7 | `tests/unit/watcher.test.ts` |
| Auth | 4 | `tests/unit/auth.test.ts` |
| API Integration | 14 | `tests/integration/api.test.ts` |
| **총합** | **40** | |

---

## 관련 문서

- [SRS - Software Requirements Specification](../registry/SRS_Contract_Registry_Service.md)
- [11. Remaining Tasks](../poc/11_Remaining_Tasks.md)
- [12. Development Progress Report](../poc/12_Development_Progress_Report.md)
