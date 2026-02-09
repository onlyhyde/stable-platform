# ERC-4337 Bundler 기능 구현 현황 감사 보고서

**분석일**: 2026-02-09
**버전**: v0.1.0
**대상**: StableNet ERC-4337 Bundler (EntryPoint v0.7)
**기준 스펙**: ERC-4337, ERC-7562

---

## 1. 종합 평가

### 1.1 한눈에 보기

| 영역 | 준수율 | 상태 | 비고 |
|------|--------|------|------|
| RPC 메서드 | 100% | ✅ 완료 | 필수 6개 + 디버그 5개 |
| UserOp 포맷 (v0.7) | 100% | ✅ 완료 | PackedUserOperation 완전 지원 |
| 에러 코드 | 100% | ✅ 완료 | -32500 ~ -32507 전체 구현 |
| Gas Estimation | 90% | ✅ 완료 | Binary search 시뮬레이션 기반 |
| Mempool 관리 | 95% | ✅ 완료 | Eviction, 우선순위, Sender 제한 |
| 검증 파이프라인 | 85% | ⚠️ 부분 | Opcode 검증 미연결 |
| 번들 실행 | 90% | ✅ 완료 | Pre-flight, Receipt 파싱 |
| Aggregator 지원 | 100% | ✅ 완료 | 서명 집계/검증 |
| Reputation 시스템 | 95% | ✅ 완료 | 감쇠, 자동 해제 포함 |
| Monitoring/Metrics | 100% | ✅ 완료 | Prometheus + JSON |
| ERC-7562 Opcode 검증 | 30% | 🔴 미연결 | 코드 존재, 런타임 비활성 |
| ERC-7562 Storage 검증 | 0% | 🔴 미구현 | 구현체 없음 |
| **전체** | **~80%** | **테스트넷 수준** | **프로덕션 미달** |

### 1.2 환경별 적합성

| 환경 | 적합성 | 근거 |
|------|--------|------|
| 로컬 개발 / PoC | ✅ 적합 | 전체 RPC, Gas 추정, Mempool 정상 동작 |
| 테스트넷 | ⚠️ 조건부 적합 | ERC-7562 규칙 미적용으로 악의적 UserOp 차단 불가 |
| 프로덕션 / 메인넷 | ❌ 부적합 | Opcode/Storage 검증 부재 → 보안 위험 |

---

## 2. 구현 완료 항목 상세

### 2.1 RPC 메서드 (11/11, 100%)

**파일**: `src/rpc/server.ts`

#### 필수 메서드 (6/6)

| 메서드 | 기능 | 라인 |
|--------|------|------|
| `eth_sendUserOperation` | UserOp 검증 후 Mempool 추가 | 225-252 |
| `eth_estimateUserOperationGas` | 시뮬레이션 기반 Gas 추정 | 257-293 |
| `eth_getUserOperationByHash` | Hash로 UserOp 조회 | 298-324 |
| `eth_getUserOperationReceipt` | 실행 결과 Receipt 조회 | 329-388 |
| `eth_supportedEntryPoints` | 지원 EntryPoint 목록 | 393-395 |
| `eth_chainId` | 체인 ID 반환 | 400-403 |

#### 디버그 메서드 (5/5)

| 메서드 | 기능 | 라인 |
|--------|------|------|
| `debug_bundler_clearState` | Mempool & Reputation 초기화 | 408-414 |
| `debug_bundler_dumpMempool` | Mempool 엔트리 내보내기 | 419-432 |
| `debug_bundler_setReputation` | Reputation 수동 설정 | 437-462 |
| `debug_bundler_dumpReputation` | Reputation 엔트리 내보내기 | 467-483 |
| `debug_bundler_clearReputation` | Reputation 초기화 | 488-495 |

---

### 2.2 UserOperation 포맷 (100%)

**파일**: `src/types/index.ts`, `src/rpc/utils.ts`

- v0.7 PackedUserOperation 형식 완전 지원
- `initCode` (factory + factoryData) 패킹/언패킹
- `accountGasLimits` (verificationGasLimit + callGasLimit) 패킹/언패킹
- `gasFees` (maxPriorityFeePerGas + maxFeePerGas) 패킹/언패킹
- `paymasterAndData` (paymaster + paymasterVerificationGasLimit + paymasterPostOpGasLimit + paymasterData) 패킹/언패킹
- ERC-4337 스펙 기반 `userOpHash` 계산

---

### 2.3 Gas Estimation (90%)

**파일**: `src/gas/gasEstimator.ts` (~740줄)

| 기능 | 방식 | 상태 |
|------|------|------|
| `verificationGasLimit` | Binary search (max 20회 반복) | ✅ |
| `callGasLimit` | `simulateHandleOp` 기반 binary search | ✅ |
| `paymasterVerificationGasLimit` | 별도 binary search 시뮬레이션 | ✅ |
| `paymasterPostOpGasLimit` | 별도 binary search 시뮬레이션 | ✅ |
| `preVerificationGas` | Packed UserOp 바이트 기반 계산 | ✅ |
| L2 data cost | L1 gas price 동적 조회 | ✅ |
| 안전 마진(buffer) | 타입별 독립 설정 (0-100%) | ✅ |
| Factory 배포 Gas | 고정값 200,000 사용 (fallback) | ⚠️ |

**미비점**: Factory 계정 배포 시 동적 gas 추정이 아닌 고정값 사용. 복잡한 Factory의 경우 부정확할 수 있음.

---

### 2.4 검증 파이프라인 (85%)

**파일**: `src/validation/validator.ts`

```
eth_sendUserOperation
    │
    ▼
┌─────────────────────────────────┐
│  Phase 1: Format Validation     │  ✅ 완료
│  - Zod 스키마 검증              │
│  - 주소/Hex 형식 확인           │
│  - Gas 범위/관계 검증           │
│  - Signature 길이 검증          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Phase 2: Reputation Check      │  ✅ 완료
│  - Sender 평판 확인             │
│  - Factory 평판 확인            │
│  - Paymaster 평판 확인          │
│  - Ban/Throttle 적용            │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Phase 3: State Validation      │  ✅ 완료
│  - Nonce 검증 (gap 포함)        │
│  - Account 존재 확인            │
│  - 기존 operation 탐지          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Phase 4: Simulation            │  ✅ 완료
│  - simulateValidation 호출      │
│  - 에러 디코딩                  │
│  - Aggregation 결과 처리        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Phase 5: Result Validation     │  ✅ 완료
│  - Signature 검증               │
│  - Timestamp 검증               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Phase 6: Opcode Validation     │  🔴 비활성
│  - Banned opcode 탐지           │
│  - Storage 접근 검증            │
│  - Entity별 제한 적용           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Add to Mempool                 │  ✅ 완료
└─────────────────────────────────┘
```

---

### 2.5 Mempool 관리 (95%)

**파일**: `src/mempool/mempool.ts` (~676줄)

#### 핵심 기능

| 기능 | 설정 | 기본값 | 상태 |
|------|------|--------|------|
| TTL 만료 | `ttlMs` | 30분 | ✅ |
| 최대 크기 | `maxSize` | 10,000 | ✅ |
| Sender별 제한 | `maxOpsPerSender` | 4개 | ✅ |
| 교체 규칙 | `minGasPriceIncrease` | 10% | ✅ |
| Nonce 연속성 | `validateNonceContinuity` | false | ✅ |
| 자동 Eviction | `evictionInterval` | 60초 | ✅ |

#### 우선순위 전략

| 전략 | 정렬 기준 | 용도 |
|------|-----------|------|
| `gas_price` (기본) | maxFeePerGas 내림차순 | 수익 극대화 |
| `priority_fee` | maxPriorityFeePerGas 내림차순 | 우선순위 기반 |
| `profit` | gas × priorityFee 내림차순 | 이익 추정 기반 |
| `fifo` | addedAt 오름차순 | 선입선출 |
| `age_weighted` | gasPrice + 시간 가중치 | Staleness 방지 |

---

### 2.6 번들 실행 (90%)

**파일**: `src/executor/bundleExecutor.ts`

- Bundle 생성: Mempool에서 우선순위별 UserOp 선택
- Pre-flight 검증: 번들 전 재시뮬레이션
- 부분 실패 복구: 실패한 UserOp 제외 후 재시도
- EntryPoint `handleOps` 트랜잭션 제출
- `UserOperationEvent` 파싱 및 Receipt 구성
- Aggregated ops 분리 처리 (`handleAggregatedOps`)
- 블록 번호 및 가스 사용량 추적

---

### 2.7 Aggregator 지원 (100%)

**파일**: `src/validation/aggregatorValidator.ts` (~350줄)

| 기능 | 메서드 | 상태 |
|------|--------|------|
| 개별 서명 검증 | `validateUserOpSignature()` | ✅ |
| 서명 집계 | `aggregateSignatures()` | ✅ |
| 집계 서명 검증 | `validateSignatures()` | ✅ |
| Stake 정보 조회 | `getAggregatorStakeInfo()` | ✅ |
| Aggregator 유효성 | `isValidAggregator()` | ✅ |
| Aggregator별 그룹화 | `groupByAggregator()` | ✅ |
| handleAggregatedOps 인코딩 | `prepareAggregatedOps()` | ✅ |

---

### 2.8 Reputation 시스템 (95%)

**파일**: `src/validation/reputationManager.ts`

| 기능 | 상태 | 설정 |
|------|------|------|
| ERC-7562 reputation 모델 | ✅ | minInclusionDenominator, throttlingSlack, banSlack |
| ok / throttled / banned 상태 | ✅ | - |
| opsSeen / opsIncluded 추적 | ✅ | - |
| 시간 기반 감쇠 | ✅ | `decayIntervalMs`, `decayAmount` |
| Throttle 자동 해제 | ✅ | `throttleAutoReleaseDurationMs` |
| Stake 정보 추적 | ✅ | `minStake`, `minUnstakeDelay` |
| 수동 ban/unban | ✅ | - |

---

### 2.9 모니터링 / 메트릭 (100%)

**파일**: `src/metrics/collector.ts`, `src/metrics/endpoint.ts`

| 메트릭 카테고리 | 항목 | 형식 |
|----------------|------|------|
| UserOperation | received, validated, included, failed, dropped | Counter |
| Bundle | attempted, submitted, failed, totalGasUsed | Counter, Gauge |
| Mempool | size, maxSize, utilization | Gauge |
| Reputation | totalEntities, byStatus | Gauge |
| RPC | totalRequests, byMethod, failedRequests, responseTimeMs | Counter, Histogram |
| Gas Estimation | total, successful, failed, avgTimeMs | Counter, Gauge |
| System | uptimeSeconds | Gauge |

**엔드포인트**:
- `GET /metrics` — Prometheus text format
- `GET /metrics/json` — JSON format
- `POST /metrics/reset` — 메트릭 초기화

---

### 2.10 에러 처리 (100%)

**파일**: `src/validation/errors.ts`

| 코드 | 이름 | 설명 |
|------|------|------|
| -32500 | `REJECTED_BY_EP_OR_ACCOUNT` | EntryPoint/Account 거부 |
| -32501 | `REJECTED_BY_PAYMASTER` | Paymaster 거부 |
| -32502 | `BANNED_OPCODE` | 금지된 opcode 탐지 |
| -32503 | `SHORT_DEADLINE` | Timestamp 유효기간 부족 |
| -32504 | `BANNED_OR_THROTTLED` | 주소 ban 또는 throttle |
| -32505 | `STAKE_OR_UNSTAKE_DELAY` | Stake/unstake 지연 문제 |
| -32506 | `UNSUPPORTED_AGGREGATOR` | 미지원 Aggregator |
| -32507 | `INVALID_SIGNATURE` | 서명 무효 |

`FailedOp`, `FailedOpWithRevert` revert 데이터 파싱 완전 지원.

---

### 2.11 설정 관리 (100%)

**파일**: `src/cli/config.ts`, `src/config/constants.ts`

- CLI 옵션 + 환경변수 + 네트워크 프리셋 + 기본값 4단계 우선순위
- 모든 주요 파라미터 환경변수 오버라이드 지원
- 네트워크 프리셋: local, devnet, sepolia, mainnet
- CORS 설정 지원

---

## 3. 미구현 / 미연결 항목 상세

### 3.1 🔴 ERC-7562 Opcode 검증 — 코드 존재, 런타임 비활성 (Critical)

**현상**:
`OpcodeValidator` 클래스가 완전히 구현되어 있고 (`src/validation/opcodeValidator.ts`), `UserOperationValidator`의 Phase 6에 연결 코드가 존재하나 **실제 런타임에서 실행되지 않음**.

**근본 원인**:

```typescript
// validator.ts - factory 메서드에서 OpcodeValidator를 생성하지 않음
static create(publicClient, config, logger): UserOperationValidator {
  const dependencies: ValidatorDependencies = {
    formatValidator: new FormatValidator(),
    simulationValidator: new SimulationValidator(...),
    reputationManager: new ReputationManager(...),
    // ❌ opcodeValidator 누락 → undefined
  }
  return new UserOperationValidator(config, logger, dependencies)
}

// validator.ts:140 - opcodeValidator가 undefined이므로 항상 skip
if (!this.config.skipOpcodeValidation && this.opcodeValidator) {
  await this.validateOpcodes(userOp)  // 절대 실행 안됨
}
```

**누락된 구현체**: `ITracer` 인터페이스를 구현하는 concrete 클래스가 없음.
- `ITracer.trace()` → `debug_traceCall` RPC를 호출해야 하나, 이 어댑터가 없음
- Geth/Anvil의 `debug_traceCall`과 연결하는 tracer 구현 필요

**위험도**: 🔴 **Critical**
- 악의적 UserOp가 banned opcode(SELFDESTRUCT, CREATE, ORIGIN 등)를 사용해도 검증을 통과
- 메인넷에서 번들러 평판 하락 및 자금 손실 위험

**필요 작업**:
1. `ITracer` 구현체 작성 (debug_traceCall 어댑터)
2. `UserOperationValidator.create()` factory에서 `OpcodeValidator` 인스턴스 생성 및 주입
3. CLI에서 opcode validation 활성화/비활성화 옵션 추가

---

### 3.2 🔴 ERC-7562 Storage Access 검증 — 미구현 (Critical)

**현상**: 교차 계정 스토리지 접근 규칙이 전혀 구현되지 않음.

**ERC-7562 Section 6.3 요구사항**:
- 각 entity(sender, factory, paymaster)는 자신의 storage에만 접근 가능
- sender와 연관된(associated) storage에만 접근 허용
- EntryPoint storage는 허용
- 다른 계정의 code 읽기는 허용하되, storage 쓰기는 금지

**`OpcodeValidator`에 storage 검증 로직이 존재하나**, tracer가 없어 실행 불가:

```typescript
// opcodeValidator.ts - 로직은 있으나 dead code
private validateStorageAccess(
  storage: Record<Address, string[]>,
  sender: Address,
  entity: Address,
  entityType: EntityType,
  entities: Map<string, EntityType>
): void { ... }
```

**위험도**: 🔴 **Critical**
- 악의적 UserOp가 다른 계정의 storage를 수정할 수 있음
- 프론트러닝(frontrunning) 공격 벡터 노출

---

### 3.3 🟡 Per-entity Calldata 크기 제한 — 미구현

**ERC-7562 요구사항**: 각 entity별로 calldata 크기를 제한해야 함.

**현재**: `formatValidator.ts`에서 전체 calldata 크기만 검증. Entity별 분리 검증 없음.

**위험도**: 🟡 Medium
- DoS 공격 벡터이나 다른 검증으로 부분적 완화 가능

---

### 3.4 🟡 Cross-operation 의존성 추적 — 미구현

**현상**: Mempool 내 UserOp 간 의존성 추적 없음.

**시나리오**: UserOp A가 UserOp B의 실행 결과에 의존하는 경우, 번들 순서가 잘못되면 실패 가능.

**현재 완화**: 동일 sender의 nonce 순서는 보장. 다른 sender 간 의존성만 미추적.

**위험도**: 🟡 Low-Medium
- 번들 실패 시 pre-flight에서 잡아내므로 자금 손실은 없음
- 번들 효율성만 저하

---

### 3.5 🟡 MEV 보호 — 미구현

**현상**: 번들 트랜잭션에 대한 MEV 보호 메커니즘 없음.

**필요 기능**:
- Flashbots / MEV-Share 연동
- Private mempool 옵션
- 번들러 수익성 최적화

**위험도**: 🟡 Medium (메인넷 한정)

---

### 3.6 🟢 Factory 배포 Gas 동적 추정

**현상**: Factory가 있는 UserOp의 배포 gas가 고정값 200,000 사용.

**영향**: 복잡한 Factory의 경우 gas 부족으로 실패하거나, 단순 Factory의 경우 과도한 gas 할당.

**위험도**: 🟢 Low
- 대부분의 표준 Factory에서는 200,000이 충분

---

## 4. 테스트 현황

### 4.1 테스트 요약

| 지표 | 수치 |
|------|------|
| 총 테스트 수 | 342 |
| 통과율 | 100% (342/342) |
| 테스트 파일 수 | 14 |
| 테스트 코드량 | ~6,484줄 |
| 프로덕션 코드량 | ~8,529줄 |
| 테스트/코드 비율 | 0.76:1 |

### 4.2 모듈별 테스트 커버리지

| 모듈 | 테스트 파일 | 테스트 수 | 커버리지 |
|------|------------|-----------|----------|
| Format Validation | `formatValidator.test.ts` | 25 | 100% |
| Reputation Manager | `reputationManager.test.ts` | 27 | 95% |
| Error Handling | `errors.test.ts` | 30 | 100% |
| Opcode Validator | `opcodeValidator.test.ts` | 32 | 90% |
| Main Validator | `validator.test.ts` | 28 | 85% |
| Aggregator Validator | `aggregatorValidator.test.ts` | 28 | 90% |
| Gas Estimator | `gasEstimator.test.ts` | 27 | 85% |
| Mempool | `mempool.test.ts` | 27 | 90% |
| Bundle Executor | `bundleExecutor.test.ts` | 25 | 85% |
| E2E Integration | `bundleExecution.test.ts` | 17 | N/A |
| RPC Server | `rpcServer.test.ts` | 20 | 80% |
| Metrics Endpoint | `metricsEndpoint.test.ts` | 15 | 85% |
| Metrics Collector | `collector.test.ts` | 19 | 90% |
| Module Exports | `index.test.ts` | 1 | N/A |

### 4.3 테스트 갭

| 영역 | 상태 | 비고 |
|------|------|------|
| Opcode 통합 테스트 | ❌ | 실제 tracer 연동 E2E 없음 |
| 실제 EntryPoint 연동 E2E | ❌ | Anvil/Hardhat fork 기반 테스트 없음 |
| Storage access 테스트 | ❌ | 구현체 없으므로 테스트 불가 |
| 부하 테스트 | ❌ | 대량 UserOp 처리 성능 미측정 |
| 장시간 운영 테스트 | ❌ | 메모리 누수 등 미확인 |

---

## 5. 코드 아키텍처 평가

### 5.1 강점

- **DI 패턴**: Factory 메서드 + 인터페이스 기반 의존성 주입으로 테스트 용이
- **모듈 분리**: 검증, Gas, Mempool, 실행, 메트릭이 명확히 분리
- **타입 안전성**: TypeScript strict mode, Zod 스키마 검증
- **설정 유연성**: CLI + 환경변수 + 프리셋 + 기본값 4단계 구조
- **최소 의존성**: viem, fastify, zod, pino, yargs만 사용
- **로깅**: Pino 기반 구조적 로깅, 모듈별 child logger

### 5.2 디렉토리 구조

```
src/
├── abi/              # EntryPoint v0.7 ABI 정의
├── cli/              # CLI 진입점 및 설정 파서
├── config/           # 상수 및 환경변수 매핑
├── executor/         # 번들 실행 엔진
├── gas/              # Gas 추정 엔진
├── mempool/          # Mempool 관리
├── metrics/          # Prometheus 메트릭
├── rpc/              # JSON-RPC 서버
├── types/            # TypeScript 타입 정의
├── utils/            # Logger 유틸리티
└── validation/       # 검증 파이프라인
    ├── formatValidator.ts       # Phase 1: 형식 검증
    ├── reputationManager.ts     # Phase 2: 평판 관리
    ├── simulationValidator.ts   # Phase 4: 시뮬레이션
    ├── opcodeValidator.ts       # Phase 6: Opcode 검증 (비활성)
    ├── aggregatorValidator.ts   # Aggregator 검증
    ├── validator.ts             # 파이프라인 오케스트레이터
    ├── errors.ts                # 에러 코드/파싱
    └── types.ts                 # 검증 타입 정의
```

---

## 6. 프로덕션 배포를 위한 필수 작업

### 6.1 P0 — 보안 차단 항목 (메인넷 필수)

| # | 작업 | 예상 LOC | 난이도 |
|---|------|----------|--------|
| 1 | `ITracer` 구현체 작성 (`debug_traceCall` 어댑터) | ~150 | Medium |
| 2 | `UserOperationValidator.create()`에 `OpcodeValidator` 주입 | ~20 | Low |
| 3 | CLI에 opcode validation on/off 옵션 추가 | ~30 | Low |
| 4 | ERC-7562 storage access 규칙 검증 활성화 | ~100 | Medium |
| 5 | 실제 EntryPoint 대상 E2E 테스트 (Anvil fork) | ~400 | High |

### 6.2 P1 — 운영 안정성

| # | 작업 | 예상 LOC | 난이도 |
|---|------|----------|--------|
| 6 | Per-entity calldata 크기 제한 | ~80 | Low |
| 7 | Factory 배포 gas 동적 추정 | ~100 | Medium |
| 8 | 부하 테스트 및 성능 벤치마크 | ~300 | Medium |
| 9 | 장시간 운영 메모리 프로파일링 | ~50 | Low |

### 6.3 P2 — 메인넷 최적화

| # | 작업 | 예상 LOC | 난이도 |
|---|------|----------|--------|
| 10 | MEV 보호 (Flashbots 연동) | ~300 | High |
| 11 | 번들러 수익성 최적화 | ~200 | Medium |
| 12 | Cross-operation 의존성 추적 | ~150 | Medium |

---

## 7. ERC-4337 스펙 대비 체크리스트

### 7.1 필수 요구사항 (MUST)

| 요구사항 | 구현 | 비고 |
|----------|------|------|
| `eth_sendUserOperation` 구현 | ✅ | |
| `eth_estimateUserOperationGas` 구현 | ✅ | |
| `eth_getUserOperationByHash` 구현 | ✅ | |
| `eth_getUserOperationReceipt` 구현 | ✅ | |
| `eth_supportedEntryPoints` 구현 | ✅ | |
| `eth_chainId` 구현 | ✅ | |
| EntryPoint v0.7 지원 | ✅ | |
| UserOperation 형식 검증 | ✅ | |
| ERC-4337 에러 코드 반환 | ✅ | |
| `simulateValidation` 호출 | ✅ | |
| Mempool 관리 | ✅ | |
| Bundle 생성 및 제출 | ✅ | |
| ERC-7562 opcode 제한 적용 | ❌ | 코드 존재, 런타임 비활성 |
| ERC-7562 storage 접근 규칙 | ❌ | 미구현 |

### 7.2 권장 요구사항 (SHOULD)

| 요구사항 | 구현 | 비고 |
|----------|------|------|
| Reputation 시스템 | ✅ | |
| Debug 메서드 지원 | ✅ | |
| Aggregator 지원 | ✅ | |
| Gas 추정 정확도 | ⚠️ | Factory 배포 gas 고정값 |
| 번들 수익성 최적화 | ❌ | |

---

## 8. 결론

### 현재 상태

StableNet ERC-4337 Bundler는 **기능적으로 ~80% 완성**되었으며, 핵심 인프라(RPC, Gas 추정, Mempool, 번들 실행, Aggregator, Reputation, 메트릭)가 잘 구현되어 있다.

### 핵심 문제

**단 하나의 근본 원인**으로 인해 프로덕션 배포가 차단됨:

> `ITracer` 구현체가 없어 `OpcodeValidator`가 `UserOperationValidator`에 주입되지 않으며,
> 결과적으로 ERC-7562 opcode/storage 검증이 런타임에서 완전히 비활성화 상태.

이 문제의 해결은 **~200줄 수준의 코드 추가**로 가능하나, 실제 EntryPoint 대상 E2E 검증이 반드시 선행되어야 한다.

### 권장 사항

1. **즉시**: ITracer 구현 + OpcodeValidator 주입으로 ERC-7562 검증 활성화
2. **단기**: Anvil fork 기반 E2E 테스트로 실제 동작 검증
3. **중기**: MEV 보호 및 수익성 최적화로 메인넷 경쟁력 확보

---

*이 문서는 2026-02-09 기준 코드 분석 결과입니다.*
*프로덕션 코드: ~8,529줄 | 테스트 코드: ~6,484줄 | 통과 테스트: 342개*
