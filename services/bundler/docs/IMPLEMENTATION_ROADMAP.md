# ERC-4337 Bundler 구현 로드맵

**작성일**: 2026-01-23
**방법론**: TDD (Test-Driven Development) - RED → GREEN → REFACTOR

---

## 우선순위 1: Critical (프로덕션 차단)

### Task 1.1: Gas Estimation 시뮬레이션 기반 구현
**예상 LOC**: ~300
**테스트 파일**: `tests/gas/gasEstimator.test.ts`

#### 세부 작업
- [ ] 1.1.1 `simulateHandleOp` 기반 callGasLimit 추정
- [ ] 1.1.2 Binary search 기반 verificationGasLimit 추정
- [ ] 1.1.3 Paymaster gas 시뮬레이션
- [ ] 1.1.4 preVerificationGas 정확한 계산 (packed format 기반)
- [ ] 1.1.5 Gas estimation 안전 마진 설정 가능하게

#### 테스트 케이스
```typescript
// RED 단계에서 작성할 테스트
describe('GasEstimator', () => {
  describe('estimateVerificationGasLimit', () => {
    it('should estimate via binary search simulation')
    it('should handle factory deployment gas')
    it('should include safety margin')
  })

  describe('estimateCallGasLimit', () => {
    it('should estimate via simulateHandleOp')
    it('should handle revert cases')
  })

  describe('estimatePreVerificationGas', () => {
    it('should calculate based on packed UserOp size')
    it('should include L1 data cost for L2 chains')
  })
})
```

---

### Task 1.2: Mempool Eviction 정책 구현
**예상 LOC**: ~150
**테스트 파일**: `tests/mempool/mempool.test.ts`

#### 세부 작업
- [ ] 1.2.1 TTL 기반 만료 (기본 30분)
- [ ] 1.2.2 최대 크기 제한 (기본 10,000)
- [ ] 1.2.3 Sender별 제한 (기본 4개)
- [ ] 1.2.4 Gas price 기반 eviction
- [ ] 1.2.5 설정 가능한 eviction 파라미터

#### 테스트 케이스
```typescript
describe('Mempool', () => {
  describe('eviction', () => {
    it('should evict expired entries after TTL')
    it('should evict lowest gas price when max size reached')
    it('should limit operations per sender')
    it('should prioritize by gas price during eviction')
  })
})
```

---

### Task 1.3: E2E 통합 테스트 작성
**예상 LOC**: ~400
**테스트 파일**: `tests/e2e/bundler.test.ts`

#### 세부 작업
- [ ] 1.3.1 RPC 서버 시작/중지 테스트
- [ ] 1.3.2 eth_sendUserOperation 전체 플로우
- [ ] 1.3.3 eth_estimateUserOperationGas 정확도
- [ ] 1.3.4 번들 생성 및 제출 테스트
- [ ] 1.3.5 에러 시나리오 테스트

---

### Task 1.4: Bundle Executor 테스트 작성
**예상 LOC**: ~200
**테스트 파일**: `tests/executor/bundleExecutor.test.ts`

#### 세부 작업
- [ ] 1.4.1 번들 생성 로직 테스트
- [ ] 1.4.2 Pre-flight validation 테스트
- [ ] 1.4.3 트랜잭션 제출 테스트
- [ ] 1.4.4 이벤트 파싱 테스트
- [ ] 1.4.5 실패 처리 테스트

---

## 우선순위 2: Important (기능 개선)

### Task 2.1: ERC-7562 Banned Opcodes 검증
**예상 LOC**: ~200
**테스트 파일**: `tests/validation/opcodeValidator.test.ts`

#### 세부 작업
- [ ] 2.1.1 Banned opcode 목록 정의
- [ ] 2.1.2 Simulation trace 분석
- [ ] 2.1.3 Entity별 opcode 검증
- [ ] 2.1.4 에러 메시지 및 코드 (-32502)

#### Banned Opcodes (ERC-7562)
```
GASPRICE, GASLIMIT, DIFFICULTY, TIMESTAMP, BASEFEE, BLOCKHASH,
NUMBER, SELFBALANCE, BALANCE, ORIGIN, GAS, CREATE, COINBASE,
SELFDESTRUCT, RANDOM, PREVRANDAO, INVALID
```

---

### Task 2.2: Mempool Sender 제한 강화
**예상 LOC**: ~100
**테스트 파일**: `tests/mempool/mempool.test.ts` (추가)

#### 세부 작업
- [ ] 2.2.1 Sender별 pending 작업 제한
- [ ] 2.2.2 Nonce 연속성 검증
- [ ] 2.2.3 교체 규칙 (10% 높은 gas price)

---

### Task 2.3: 설정 가능한 상수 추출
**예상 LOC**: ~100
**테스트 파일**: 기존 테스트 수정

#### 세부 작업
- [ ] 2.3.1 Nonce gap 설정 가능
- [ ] 2.3.2 Timestamp buffer 설정 가능
- [ ] 2.3.3 Gas buffer 설정 가능
- [ ] 2.3.4 Bundle 파라미터 설정 가능

---

### Task 2.4: Reputation 시간 감쇠
**예상 LOC**: ~80
**테스트 파일**: `tests/validation/reputationManager.test.ts` (추가)

#### 세부 작업
- [ ] 2.4.1 시간 기반 opsSeen 감쇠
- [ ] 2.4.2 Throttle 자동 해제 조건
- [ ] 2.4.3 감쇠 주기 설정

---

## 우선순위 3: Enhancement (품질 향상)

### Task 3.1: 번들 우선순위 최적화
- [ ] Nonce 의존성 기반 정렬
- [ ] Reputation 기반 우선순위
- [ ] 수익성 기반 선택

### Task 3.2: Aggregator 지원 (선택)
- [ ] Aggregator 인터페이스 구현
- [ ] 서명 집계 검증

### Task 3.3: 모니터링 메트릭
- [ ] Gas estimation 정확도 메트릭
- [ ] Bundle 성공률 메트릭
- [ ] Mempool 사용량 메트릭

---

## 작업 진행 순서

```
Week 1:
├─ Task 1.1: Gas Estimation (TDD)
└─ Task 1.2: Mempool Eviction (TDD)

Week 2:
├─ Task 1.3: E2E 테스트
└─ Task 1.4: Bundle Executor 테스트

Week 3:
├─ Task 2.1: ERC-7562 Opcodes
└─ Task 2.2: Sender 제한

Week 4:
├─ Task 2.3: 설정 추출
├─ Task 2.4: Reputation 감쇠
└─ 문서화 및 정리
```

---

## TDD 진행 방식

### RED 단계
1. 실패하는 테스트 작성
2. `pnpm test` 실행 → 실패 확인
3. 테스트가 의도대로 실패하는지 검증

### GREEN 단계
1. 테스트를 통과하는 최소 코드 작성
2. `pnpm test` 실행 → 통과 확인
3. 모든 테스트 통과 확인

### REFACTOR 단계
1. 코드 품질 개선
2. 중복 제거
3. 테스트 재실행 → 통과 확인

---

## 완료 기준

각 Task 완료 조건:
- [ ] 모든 테스트 통과
- [ ] TypeScript 타입체크 통과
- [ ] Lint 통과
- [ ] 문서 업데이트 (필요시)
