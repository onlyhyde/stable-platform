# ERC-4337 Bundler 표준 준수 분석 보고서

**분석일**: 2026-01-23
**버전**: v0.1.0
**대상**: StableNet ERC-4337 Bundler (EntryPoint v0.7)

---

## 1. 개요

### 1.1 평가 요약

| 항목 | 준수율 | 상태 |
|------|--------|------|
| RPC 메서드 | 100% | ✅ 완료 |
| UserOp 포맷 (v0.7) | 100% | ✅ 완료 |
| 에러 처리 | 95% | ✅ 완료 |
| 번들 실행 | 90% | ✅ 완료 |
| 검증 파이프라인 | 85% | ⚠️ 개선 필요 |
| Gas Estimation | 40% | 🔴 심각 |
| ERC-7562 규칙 | 20% | 🔴 심각 |
| 테스트 커버리지 | 20% | 🔴 심각 |
| **전체** | **72%** | **프로덕션 미달** |

### 1.2 적합성 평가

| 환경 | 적합성 | 비고 |
|------|--------|------|
| 로컬 개발 | ✅ 적합 | 기본 기능 동작 |
| 테스트넷 | ⚠️ 주의 | Gas estimation 부정확 |
| 프로덕션 | ❌ 부적합 | 심각한 보완 필요 |

---

## 2. 구현 완료 항목

### 2.1 RPC 메서드 (100%)

#### 필수 메서드 (6/6)
| 메서드 | 파일 | 라인 |
|--------|------|------|
| `eth_sendUserOperation` | rpc/server.ts | 225-252 |
| `eth_estimateUserOperationGas` | rpc/server.ts | 257-293 |
| `eth_getUserOperationByHash` | rpc/server.ts | 298-324 |
| `eth_getUserOperationReceipt` | rpc/server.ts | 329-388 |
| `eth_supportedEntryPoints` | rpc/server.ts | 393-395 |
| `eth_chainId` | rpc/server.ts | 400-403 |

#### 디버그 메서드 (5/5)
| 메서드 | 파일 | 라인 |
|--------|------|------|
| `debug_bundler_clearState` | rpc/server.ts | 408-414 |
| `debug_bundler_dumpMempool` | rpc/server.ts | 419-432 |
| `debug_bundler_setReputation` | rpc/server.ts | 437-462 |
| `debug_bundler_dumpReputation` | rpc/server.ts | 467-483 |
| `debug_bundler_clearReputation` | rpc/server.ts | 488-495 |

### 2.2 검증 파이프라인 (85%)

```
Phase 1: Format Validation     ✅ 완료
  └─ Zod 스키마 검증, 주소/Hex 형식, Gas 관계

Phase 2: Reputation Check      ✅ 완료
  └─ ERC-7562 reputation 시스템

Phase 3: State Validation      ✅ 완료
  └─ Nonce 검증, Account 존재 확인

Phase 4: Simulation            ⚠️ 부분 완료
  └─ simulateValidation 호출 (ERC-7562 규칙 미적용)
```

### 2.3 에러 처리 (95%)

```typescript
// 구현된 ERC-4337 에러 코드
-32500: REJECTED_BY_EP_OR_ACCOUNT
-32501: REJECTED_BY_PAYMASTER
-32502: BANNED_OPCODE          // 탐지 로직 미구현
-32503: SHORT_DEADLINE
-32504: BANNED_OR_THROTTLED
-32505: STAKE_OR_UNSTAKE_DELAY
-32506: UNSUPPORTED_AGGREGATOR
-32507: INVALID_SIGNATURE
```

### 2.4 UserOperation 포맷 (100%)

- v0.7 PackedUserOperation 완전 지원
- initCode, accountGasLimits, gasFees, paymasterAndData 패킹/언패킹
- ERC-4337 해시 계산 구현

---

## 3. 미구현/개선 필요 항목

### 3.1 🔴 Critical (프로덕션 차단)

#### 3.1.1 Gas Estimation (40%)
**현재 상태**: 하드코딩된 정적 값

```typescript
// 현재 구현 (gasEstimator.ts)
verificationGasLimit = 100_000n  // 고정값
callGasLimit = 100_000n          // 기본값
paymasterVerificationGasLimit = 100_000n  // 고정값
```

**문제점**:
- 실제 시뮬레이션 미수행
- 가스 부족으로 트랜잭션 실패 가능
- preVerificationGas 계산 부정확 (JSON 직렬화 사용)

**필요 구현**:
- `simulateHandleOp` 기반 gas estimation
- Binary search를 통한 정확한 gas limit 산출
- Paymaster 시뮬레이션

#### 3.1.2 ERC-7562 검증 규칙 (20%)
**미구현 항목**:

| 규칙 | 상태 | 설명 |
|------|------|------|
| Banned Opcodes | ❌ | CREATE, CREATE2, SELFDESTRUCT 등 |
| Storage Access | ❌ | 교차 계정 storage 접근 검증 |
| Call Data Limits | ❌ | Entity별 calldata 크기 제한 |
| Concurrent Ops | ❌ | Mempool 내 의존성 추적 |

#### 3.1.3 테스트 커버리지 (20%)
**현재 테스트**:
```
✅ formatValidator.test.ts     - 25 tests
✅ reputationManager.test.ts   - 27 tests
✅ errors.test.ts              - 30 tests
❌ gasEstimator.test.ts        - 없음
❌ bundleExecutor.test.ts      - 없음
❌ mempool.test.ts             - 없음
❌ rpc/server.test.ts          - 없음
❌ E2E integration tests       - 없음
```

#### 3.1.4 Mempool 관리
**문제점**:
- Eviction 정책 없음 (메모리 무한 증가)
- TTL 기반 만료 없음
- 크기 제한 없음

### 3.2 🟡 Important (기능 개선)

#### 3.2.1 Aggregator 미지원
```typescript
// 현재: 무조건 거부
if (aggregator) {
  throw new RpcError(`aggregator not supported`, -32506)
}
```

#### 3.2.2 하드코딩된 상수
| 상수 | 현재값 | 위치 |
|------|--------|------|
| Nonce gap | 10 | validator.ts:231 |
| Timestamp buffer | 30s | errors.ts:12 |
| Bundle gas buffer | 20% | bundleExecutor.ts |

#### 3.2.3 번들 우선순위
- 현재: `maxFeePerGas` 정렬만
- 필요: Nonce 의존성, reputation 고려

#### 3.2.4 Reputation 감쇠
- 현재: 영구 throttle/ban
- 필요: 시간 기반 회복 메커니즘

---

## 4. 아키텍처 개선 제안

### 4.1 Gas Estimation 개선

```
현재:
  UserOp → 하드코딩 값 반환

개선:
  UserOp → simulateHandleOp 호출
        → Binary search로 최적 gas 탐색
        → 안전 마진 적용
        → 결과 반환
```

### 4.2 ERC-7562 검증 추가

```
현재:
  Format → Reputation → State → Simulation

개선:
  Format → Reputation → State → Simulation → ERC-7562 Rules
                                              ├─ Opcode 검증
                                              ├─ Storage 검증
                                              └─ CallData 검증
```

### 4.3 Mempool 개선

```
현재:
  Map<hash, entry> (무제한)

개선:
  Map<hash, entry>
    ├─ maxSize: 10,000
    ├─ ttl: 30분
    ├─ eviction: LRU + gas price
    └─ sender limits: 4 per sender
```

---

## 5. 결론

### 5.1 강점
- ERC-4337 인터페이스 완전 구현
- v0.7 UserOperation 포맷 지원
- 체계적인 검증 파이프라인
- 깔끔한 DI 기반 아키텍처

### 5.2 약점
- Gas estimation 정확도 부족
- ERC-7562 보안 규칙 미구현
- 테스트 커버리지 부족
- Mempool 관리 미흡

### 5.3 권장 사항
1. Gas estimation 시뮬레이션 기반 구현 (최우선)
2. E2E 테스트 작성
3. Mempool eviction 정책 구현
4. ERC-7562 검증 규칙 추가
