# ERC-4337 Bundler 작업 현황

**최종 업데이트**: 2026-01-23
**테스트 현황**: 342 passing ✅

---

## ✅ 완료된 작업

| Task | 설명 | 테스트 | 완료일 |
|------|------|--------|--------|
| 1.1 | Gas Estimation 시뮬레이션 기반 구현 | 27 tests | 2026-01-23 |
| 1.2 | Mempool Eviction 정책 구현 | 27 tests | 2026-01-23 |
| 1.3 | E2E 통합 테스트 작성 | 17 tests | 2026-01-23 |
| 1.4 | Bundle Executor 테스트 강화 | 25 tests | 2026-01-23 |
| 2.1 | ERC-7562 Banned Opcodes 검증 | 32 tests | 2026-01-23 |
| 2.2 | Mempool Sender 제한 강화 (Nonce 연속성) | 12 tests | 2026-01-23 |
| 2.3 | 설정 가능한 상수 추출 | 6 tests | 2026-01-23 |
| 2.4 | Reputation 시간 감쇠 | 15 tests | 2026-01-23 |
| 3.1 | 번들 우선순위 최적화 | 12 tests | 2026-01-23 |
| 3.2 | Aggregator 지원 | 28 tests | 2026-01-23 |
| 3.3 | 모니터링 메트릭 | 41 tests | 2026-01-23 |

---

## 🔴 우선순위 1: Critical (프로덕션 차단)

| Task | 설명 | 예상 LOC | 상태 |
|------|------|----------|------|
| ~~1.1~~ | ~~Gas Estimation 시뮬레이션 기반 구현~~ | ~300 | ✅ 완료 |
| ~~1.2~~ | ~~Mempool Eviction 정책 구현~~ | ~150 | ✅ 완료 |
| ~~1.3~~ | ~~E2E 통합 테스트 작성~~ | ~400 | ✅ 완료 |
| ~~1.4~~ | ~~Bundle Executor 테스트 작성~~ | ~200 | ✅ 완료 |

### Task 1.1 세부 작업 ✅
- [x] 1.1.1 `simulateHandleOp` 기반 callGasLimit 추정
- [x] 1.1.2 Binary search 기반 verificationGasLimit 추정
- [x] 1.1.3 Paymaster gas 시뮬레이션
- [x] 1.1.4 preVerificationGas 정확한 계산 (L2 data cost 포함)
- [x] 1.1.5 Gas estimation 안전 마진 설정 가능하게

### Task 1.2 세부 작업 ✅
- [x] 1.2.1 TTL 기반 만료 (기본 30분)
- [x] 1.2.2 최대 크기 제한 (기본 10,000)
- [x] 1.2.3 Sender별 제한 (기본 4개)
- [x] 1.2.4 Gas price 기반 eviction
- [x] 1.2.5 설정 가능한 eviction 파라미터

### Task 1.3 세부 작업 ✅
- [x] 1.3.1 UserOperation 전체 플로우 테스트 (submission → mempool)
- [x] 1.3.2 Multi-UserOp 번들링 테스트 (다중 sender, sequential nonce)
- [x] 1.3.3 에러 케이스 및 실패 시나리오 테스트
- [x] 1.3.4 Paymaster 통합 테스트
- [x] 1.3.5 Reputation 시스템 통합 테스트
- [x] 1.3.6 Mempool 관리 테스트 (maxOpsPerSender, replacement)

### Task 1.4 세부 작업 ✅
- [x] 1.4.1 Pre-flight validation 강화 (전체 실패, 부분 실패 복구)
- [x] 1.4.2 Receipt parsing (success=false 이벤트, 다중 이벤트, 블록 번호)
- [x] 1.4.3 Error recovery (gas estimation 실패, receipt timeout)
- [x] 1.4.4 UserOp packing (factory 없음, paymaster 없음 케이스)
- [x] 1.4.5 Multiple senders 번들링 및 entryPoint 필터링

---

## 🟡 우선순위 2: Important (기능 개선)

| Task | 설명 | 예상 LOC | 상태 |
|------|------|----------|------|
| ~~2.1~~ | ~~ERC-7562 Banned Opcodes 검증~~ | ~200 | ✅ 완료 |
| ~~2.2~~ | ~~Mempool Sender 제한 강화~~ | ~100 | ✅ 완료 |
| ~~2.3~~ | ~~설정 가능한 상수 추출~~ | ~100 | ✅ 완료 |
| ~~2.4~~ | ~~Reputation 시간 감쇠~~ | ~80 | ✅ 완료 |

### Task 2.4 세부 작업 ✅
- [x] 2.4.1 시간 기반 opsSeen 감쇠
- [x] 2.4.2 Throttle 자동 해제 조건
- [x] 2.4.3 감쇠 주기 설정

---

## 🟢 우선순위 3: Enhancement (품질 향상)

| Task | 설명 | 상태 |
|------|------|------|
| ~~3.1~~ | ~~번들 우선순위 최적화~~ | ✅ 완료 |
| ~~3.2~~ | ~~Aggregator 지원~~ | ✅ 완료 |
| ~~3.3~~ | ~~모니터링 메트릭~~ | ✅ 완료 |

### Task 3.1 세부 작업 ✅
- [x] 3.1.1 다양한 우선순위 전략 (gas_price, priority_fee, profit, fifo, age_weighted)
- [x] 3.1.2 Nonce 순서 보장 (같은 sender는 nonce 순서대로)
- [x] 3.1.3 Age-weighted 전략 (staleness 방지)
- [x] 3.1.4 설정 가능한 우선순위 파라미터

### Task 3.2 세부 작업 ✅
- [x] 3.2.1 Aggregator ABI 정의 (AGGREGATOR_ABI, HANDLE_AGGREGATED_OPS_ABI)
- [x] 3.2.2 Aggregator 타입 정의 (UserOpsPerAggregator, IAggregatorValidator)
- [x] 3.2.3 AggregatorValidator 클래스 구현
- [x] 3.2.4 Mempool aggregator 지원 (setAggregator 메서드)
- [x] 3.2.5 BundleExecutor aggregated ops 지원 (handleAggregatedOps)

### Task 3.3 세부 작업 ✅
- [x] 3.3.1 메트릭 타입 및 인터페이스 정의
- [x] 3.3.2 메트릭 수집기 테스트 작성 (TDD)
- [x] 3.3.3 메트릭 엔드포인트 테스트 작성 (TDD)
- [x] 3.3.4 MetricsCollector 클래스 구현
- [x] 3.3.5 /metrics, /metrics/json, /metrics/reset 엔드포인트 구현

---

## 📊 진행률 요약

```
우선순위 1: ████████████████████ 4/4 (100%) ✅
우선순위 2: ████████████████████ 4/4 (100%) ✅
우선순위 3: ████████████████████ 3/3 (100%) ✅

전체 진행률: 11/11 tasks (100%) ✅
```

---

## 구현된 기능 상세

### Task 1.1: Gas Estimation 시뮬레이션 기반 구현
- `GasEstimator` 클래스 대폭 개선
- `simulateHandleOp` 기반 callGasLimit binary search
- `simulateValidation` 기반 verificationGasLimit binary search
- Paymaster verification/postOp gas 개별 시뮬레이션
- L2 체인용 L1 data cost 계산 (동적 gas price 조회)
- 설정 가능한 buffer percentage (0-100% 검증)
  - `verificationGasBufferPercent`: 검증 가스 버퍼
  - `callGasBufferPercent`: 호출 가스 버퍼
  - `preVerificationGasBufferPercent`: 사전 검증 가스 버퍼
  - `paymasterVerificationGasBufferPercent`: 페이마스터 검증 버퍼
  - `paymasterPostOpGasBufferPercent`: 페이마스터 postOp 버퍼
- `isL2Chain`, `l1GasPrice`, `l2GasPrice` 설정 옵션

### Task 1.2: Mempool Eviction 정책 구현
- `Mempool` 클래스 eviction 정책 구현
- TTL 기반 만료: `evictExpired()` 메서드, `ttlMs` 설정 (기본 30분)
- 최대 크기 제한: `maxSize` 설정 (기본 10,000)
- Sender별 제한: `maxOpsPerSender` 설정 (기본 4개)
- Gas price 기반 eviction: `evictLowestGasPrice()` 메서드
- 교체 규칙: `minGasPriceIncrease` (기본 10% 증가 필요)
- 자동 eviction: `startAutoEviction()`, `stopAutoEviction()`
- 설정 가능한 파라미터: `MempoolConfig` 인터페이스

### Task 1.3: E2E 통합 테스트 작성
- `tests/e2e/bundleExecution.test.ts` 신규 작성 (17 tests)
- Full UserOperation Flow 테스트
  - UserOperation submission → mempool inclusion
  - getUserOperationByHash 동작 검증
  - Nonce gap 거부 테스트
- Multiple UserOperations 테스트
  - 다중 sender 동시 처리
  - Sequential nonce 처리
- Gas Estimation 시나리오
  - Paymaster 없는 경우
  - Paymaster 있는 경우 (paymasterVerificationGasLimit, paymasterPostOpGasLimit)
- Reputation System 통합 테스트
  - Banned factory 거부
  - Banned paymaster 거부
  - 정상 reputation 허용
- Paymaster Integration 테스트
  - 유효한 paymaster 필드 허용
  - Gas limit 누락 시 거부
- Error Handling 테스트
  - Validation 에러 처리
  - 에러 코드 검증 (-32602, -32504)
- Mempool Management 테스트
  - maxOpsPerSender 제한 검증
  - Duplicate userOpHash 거부
  - Same sender+nonce 처리 동작

### Task 1.4: Bundle Executor 테스트 강화
- `tests/executor/bundleExecutor.test.ts` 테스트 추가 (13 → 25 tests)
- Pre-flight Validation 테스트
  - 전체 ops 실패 시 null 반환
  - 부분 실패 시 유효한 ops만 번들링
- Receipt Parsing 테스트
  - UserOperationEvent success=false 처리
  - 다중 UserOperationEvent 파싱
  - 블록 번호 기록 검증
  - 이벤트 없는 receipt 처리
- Error Recovery 테스트
  - Gas estimation 실패 처리
  - Receipt timeout graceful 처리
- UserOp Packing 테스트
  - Factory 없는 경우 (no initCode)
  - Paymaster 없는 경우 (no paymasterAndData)
- Multiple Senders 테스트
  - 다중 sender 번들링
  - EntryPoint 필터링

### Task 2.1: ERC-7562 Banned Opcodes 검증
- `OpcodeValidator` 클래스 구현
- `debug_traceCall` 기반 트레이스 분석
- Banned/Conditional opcode 검증
- Entity별 (sender, factory, paymaster) 검증

### Task 2.2: Mempool Sender 제한 강화
- Sender별 nonce 연속성 검증
- `validateNonceContinuity` 설정 옵션
- `maxNonceGap` 설정 옵션
- `getNextExpectedNonce()` API

### Task 2.3: 설정 가능한 상수 추출
- `maxNonceGap`: Validator nonce 갭 제한 (기본: 10)
- `minValidUntilBuffer`: validUntil 버퍼 (기본: 30초)
- `validateNonceContinuity`: Mempool nonce 검증 (기본: false)
- `mempoolMaxNonceGap`: Mempool nonce 갭 (기본: 0)
- CLI 옵션 및 환경변수 지원

### Task 2.4: Reputation 시간 감쇠
- `ReputationConfig`에 감쇠 관련 설정 추가
  - `decayIntervalMs`: 감쇠 간격 (기본: 0, 비활성화)
  - `decayAmount`: 간격당 감쇠량 (기본: 0)
  - `throttleAutoReleaseDurationMs`: Throttle 자동 해제 시간 (기본: 0, 비활성화)
- `applyDecay()`: 수동 감쇠 적용 메서드
- `applyDecayToEntry()`: 개별 엔트리 감쇠 (checkReputation 시 자동 호출)
- `shouldAutoReleaseThrottle()`: Throttle 자동 해제 조건 확인
- `startAutoDecay()`: 자동 감쇠 타이머 시작
- `stopAutoDecay()`: 자동 감쇠 타이머 중지
- 시간 기반 opsSeen 감쇠 (lastUpdated 기준)
- Throttle 자동 해제 (설정된 시간 경과 후)
- Ban은 자동 해제되지 않음 (보안)

### Task 3.1: 번들 우선순위 최적화
- `PriorityStrategy` 타입 추가
  - `gas_price`: maxFeePerGas 기준 정렬 (기본값)
  - `priority_fee`: maxPriorityFeePerGas 기준 정렬
  - `profit`: 예상 수익 기준 정렬 (gas * priorityFee)
  - `fifo`: 선입선출 (addedAt 기준)
  - `age_weighted`: 가스 가격 + 시간 가중치
- `MempoolConfig`에 우선순위 설정 추가
  - `priorityStrategy`: 우선순위 전략 (기본: 'gas_price')
  - `ageWeightFactor`: age_weighted 전략의 초당 가중치
  - `maxAgeBoostMs`: 최대 시간 부스트 (staleness 방지)
- `getPendingForBundle()`: 번들용 pending 조회
  - 동일 sender의 ops는 nonce 순서 보장
  - 연속되지 않은 nonce는 제외
  - sender 간 우선순위로 정렬
- `getConfig()` / `updateConfig()`: 설정 조회 및 변경

### Task 3.2: Aggregator 지원
- `AggregatorValidator` 클래스 신규 구현
  - `validateUserOpSignature()`: 개별 UserOp 서명 검증
  - `aggregateSignatures()`: 다중 UserOp 서명 집계
  - `validateSignatures()`: 집계된 서명 검증
  - `getAggregatorStakeInfo()`: Aggregator stake 정보 조회
  - `isValidAggregator()`: Aggregator 유효성 검사
  - `groupByAggregator()`: UserOps를 aggregator별로 그룹화
  - `prepareAggregatedOps()`: handleAggregatedOps 호출 데이터 준비
- `AGGREGATOR_ABI`: IAggregator 인터페이스 ABI
  - `validateSignatures`, `validateUserOpSignature`, `aggregateSignatures`
- `HANDLE_AGGREGATED_OPS_ABI`: handleAggregatedOps 함수 ABI
- `MempoolEntry`에 `aggregator` 필드 추가
- `Mempool.setAggregator()`: UserOp의 aggregator 설정
- `BundleExecutor` aggregated ops 지원
  - `setAggregatorValidator()`: Aggregator validator 설정
  - `separateByAggregator()`: aggregated/non-aggregated ops 분리
  - `encodeHandleAggregatedOps()`: handleAggregatedOps 호출 인코딩
  - 혼합 번들 지원 (aggregated + non-aggregated)

### Task 3.3: 모니터링 메트릭
- `MetricsCollector` 클래스 신규 구현
  - `IMetricsCollector` 인터페이스 정의
  - UserOperation 메트릭 (received, validated, included, validationFailed, dropped)
  - Bundle 메트릭 (attempted, submitted, failed, totalGasUsed, totalOpsBundled)
  - Mempool 메트릭 (size, maxSize, utilization, byStatus)
  - Reputation 메트릭 (totalEntities, byStatus)
  - RPC 메트릭 (totalRequests, byMethod, failedRequests, responseTimeMs)
  - Gas Estimation 메트릭 (total, successful, failed, avgTimeMs)
  - System 메트릭 (uptimeSeconds, startTime)
- Prometheus 포맷 내보내기
  - Counter, Gauge, Histogram 타입 지원
  - `toPrometheus()`: Prometheus text format 생성
  - Response time histogram with configurable buckets
- HTTP 엔드포인트
  - `GET /metrics`: Prometheus format (text/plain)
  - `GET /metrics/json`: JSON format
  - `POST /metrics/reset`: 메트릭 초기화
- 메트릭 이름 상수 (`METRIC_NAMES`)
  - `bundler_user_operations_*`: UserOp 관련 메트릭
  - `bundler_bundles_*`: 번들 관련 메트릭
  - `bundler_mempool_*`: Mempool 관련 메트릭
  - `bundler_reputation_*`: Reputation 관련 메트릭
  - `bundler_rpc_*`: RPC 관련 메트릭
  - `bundler_gas_estimation_*`: Gas 추정 관련 메트릭
  - `bundler_uptime_seconds`: 업타임
