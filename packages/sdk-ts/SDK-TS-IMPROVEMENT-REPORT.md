# StableNet SDK-TS 개선점 분석 보고서

> **작성일**: 2026-03-12
> **비교 대상**: ZeroDev SDK (`@zerodev/sdk` v5.5.7) vs StableNet SDK-TS (`@stablenet/*`)
> **분석 범위**: 코드 품질, 아키텍처, 기능 갭, 테스트 커버리지

---

## 목차

1. [요약](#1-요약)
2. [코드 품질 이슈](#2-코드-품질-이슈)
3. [ZeroDev 대비 기능 갭](#3-zerodev-대비-기능-갭)
4. [테스트 커버리지 분석](#4-테스트-커버리지-분석)
5. [StableNet 고유 강점](#5-stablenet-고유-강점)
6. [개선 로드맵](#6-개선-로드맵)

---

## 1. 요약

### 현황

StableNet SDK-TS는 ZeroDev SDK를 참고하되 아키텍처 레벨에서 재설계한 자체 SDK입니다. 3-mode TransactionRouter, 8개 내장 보안 모듈, 크로스 언어 Crypto 추상화 등 ZeroDev에 없는 고유 강점이 있으나, 프로덕션 배포를 위해서는 코드 품질 이슈 수정과 핵심 기능 갭 해소가 필요합니다.

### 수치 요약

| 구분 | 건수 |
|------|------|
| 코드 품질 이슈 (Critical) | 4건 |
| 코드 품질 이슈 (High) | 6건 |
| 코드 품질 이슈 (Medium) | 4건 |
| 기능 갭 (Critical) | 3건 |
| 기능 갭 (Important) | 5건 |
| 기능 갭 (Medium) | 5건 |
| **총 개선 항목** | **27건** |

---

## 2. 코드 품질 이슈

### 2.1 CRITICAL — 즉시 수정 필요

#### C-01. SmartAccountClient 입력 검증 누락

- **파일**: `core/src/clients/smartAccountClient.ts`
- **현상**: 초기화 시점에 `account.address`, `chain.id`, `bundlerUrl` 등의 유효성 검사가 없음
- **위험**: 잘못된 설정이 런타임 깊숙이 전파되어 디버깅이 어려운 에러 발생
- **해결**: 기존 `InputValidator` 클래스를 클라이언트 초기화 단계에서 활용

```typescript
// Before (현재)
const client = createSmartAccountClient({ account, chain, ... })
// account.address가 유효하지 않아도 생성됨

// After (개선)
const validator = createInputValidator()
if (!validator.isValidAddress(account.address)) {
  throw new ValidationError('Invalid account address', ...)
}
```

#### C-02. Nonce Race Condition

- **파일**: `core/src/clients/smartAccountClient.ts`
- **현상**: `sendUserOperation` 호출 시 nonce를 한 번만 fetch
- **위험**: 고빈도 환경에서 prepare→execute 사이에 다른 트랜잭션이 nonce 소비 가능
- **해결**: Nonce Manager 도입 (로컬 카운터 + 서버 동기화)

```typescript
// 제안: NonceManager 패턴
interface NonceManager {
  acquire(sender: Address): Promise<bigint>    // 로컬 카운터 증가 + 반환
  release(sender: Address, nonce: bigint): void // 실패 시 반납
  sync(sender: Address): Promise<void>         // 서버와 동기화
}
```

#### C-03. Transport URL 추출 취약성

- **파일**: `core/src/clients/smartAccountClient.ts:282-306`
- **현상**: `getUrlFromTransport()`가 모든 transport에 `url` 프로퍼티가 있다고 가정
- **위험**: WebSocket, fallback, custom transport에서 예외 발생
- **해결**: transport 타입별 분기 처리

```typescript
// Before
const transportConfig = transport({ chain: undefined, retryCount: 0 })
return transportConfig.url  // WebSocket이면 실패

// After
function getUrlFromTransport(transport: Transport): string {
  const config = transport({ chain: undefined, retryCount: 0 })
  if ('url' in config && typeof config.url === 'string') return config.url
  if ('getSocket' in config) return config.getSocket().url
  throw new ConfigurationError('Unsupported transport type', ...)
}
```

#### C-04. 에러 원인 체인(cause) 누락

- **파일**: `core/src/clients/smartAccountClient.ts:282-292`
- **현상**: Transport 추출 실패 시 원래 에러를 삼키고 generic 메시지만 전달
- **위험**: 프로덕션에서 근본 원인 추적 불가
- **해결**: Error cause 체인 추가

```typescript
// Before
catch {
  throw new ConfigurationError('Could not extract URL from transport', 'transport', {...})
}

// After
catch (cause) {
  throw new ConfigurationError('Could not extract URL from transport', 'transport', {
    operation: 'getUrlFromTransport',
    cause,
  })
}
```

---

### 2.2 HIGH — 조기 수정 권장

#### H-01. SponsorPaymaster 정책 파라미터 미사용

- **파일**: `plugins/paymaster/src/sponsorPaymaster.ts:172-188`
- **현상**: `policy` 파라미터를 받지만 `_policy`로 무시됨
- **해결**: API 요청 body/header에 policy 포함 또는 파라미터 제거

#### H-02. SmartAccountStrategy validate() 불완전

- **파일**: `core/src/transaction/strategies/smartAccountStrategy.ts:131-156`
- **현상**: `from`/`to` 존재만 확인, 주소 유효성/값 범위/hex 유효성 검증 없음
- **해결**: `InputValidator` 통합

```typescript
validate(request, account) {
  const validator = createInputValidator()
  if (!validator.isValidAddress(request.from)) throw new ValidationError(...)
  if (!validator.isValidAddress(request.to)) throw new ValidationError(...)
  if (request.data && !validator.isValidHex(request.data)) throw new ValidationError(...)
  if (request.value !== undefined && request.value < 0n) throw new ValidationError(...)
}
```

#### H-03. RPC 에러 감지가 문자열 패턴 매칭 의존

- **파일**: `core/src/rpc/jsonRpcClient.ts:157-172`
- **현상**: `error.message.includes('network')` 등 문자열 기반 에러 분류
- **위험**: 환경별 에러 메시지 포맷이 달라 분류 실패 가능
- **해결**: `error.code`, `error.cause`, `instanceof` 기반 검사로 전환

```typescript
// Before
if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) { ... }

// After
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true
  if (hasProperty(error, 'code') && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) return true
  if (hasProperty(error, 'cause')) return isNetworkError(error.cause)
  return false
}
```

#### H-04. getNonce()에 재시도 로직 없음

- **파일**: `core/src/transaction/strategies/smartAccountStrategy.ts:103-111`
- **현상**: EntryPoint의 `getNonce()` RPC 호출 실패 시 곧바로 에러
- **해결**: CircuitBreaker 통합 또는 exponential backoff 래핑

#### H-05. ValidatorRouter에서 generic Error 사용

- **파일**: `core/src/modules/validatorRouter.ts:83-89`
- **현상**: SDK에 커스텀 에러 계층이 있는데도 `throw new Error(...)` 사용
- **해결**: `ValidationError` 또는 `SdkError`로 교체

#### H-06. Nonce Key 인코딩 후 범위 검증 없음

- **파일**: `core/src/modules/utils/nonceUtils.ts`
- **현상**: `encodeValidatorNonceKey()` 결과가 `MAX_UINT192`를 초과할 수 있음
- **해결**: 인코딩 후 범위 단언 추가

```typescript
const key = encodeValidatorNonceKey(validatorAddress, { type })
const MAX_UINT192 = (1n << 192n) - 1n
if (key > MAX_UINT192) {
  throw new ValidationError(`Nonce key overflow: ${key}`, 'nonceKey', { max: MAX_UINT192 })
}
```

---

### 2.3 MEDIUM — 품질 개선

| ID | 이슈 | 파일 | 해결 방향 |
|----|------|------|-----------|
| M-01 | GAS MIN/MAX PRIORITY FEE 하드코딩 | `core/src/gas/gasEstimator.ts` | 체인별 설정 테이블로 분리 |
| M-02 | Deprecated 인코딩 함수 그대로 export | `core/src/modules/moduleClient.ts` | `@deprecated` JSDoc + 별도 파일 분리 |
| M-03 | PaymasterClient에 timeout/circuit breaker 없음 | `core/src/paymasterClient.ts` | RPC CircuitBreaker 통합 |
| M-04 | 복잡한 인코딩 함수에 스펙 참조 누락 | `core/src/transaction/strategies/` | ERC-4337 스펙 링크 및 인라인 주석 추가 |

---

## 3. ZeroDev 대비 기능 갭

### 3.1 CRITICAL — 프로덕션 필수

#### F-01. Multi-Chain Validator 부재

ZeroDev에는 3개의 멀티체인 플러그인이 있어 여러 체인에 걸친 UserOp 동시 서명이 가능합니다.

| ZeroDev 플러그인 | 기능 |
|------------------|------|
| `multi-chain-ecdsa` | 크로스체인 ECDSA 동시 서명 |
| `multi-chain-web-authn` | 크로스체인 WebAuthn 배치 서명 |
| `multi-chain-weighted-validator` | 가중치 기반 멀티체인 가디언 |

**StableNet 현황**: 단일 체인 전용, 크로스체인 트랜잭션 조율 메커니즘 없음

**권장 구현**:
```
plugins/
  └── multi-chain/
      ├── src/
      │   ├── multiChainValidator.ts        # 크로스체인 서명 조율
      │   ├── multiChainCoordinator.ts      # 체인 간 상태 동기화
      │   ├── strategies/
      │   │   ├── ecdsaMultiChain.ts
      │   │   └── webauthnMultiChain.ts
      │   └── types.ts
      └── tests/
```

#### F-02. Permission/Policy 시스템 부재

ZeroDev의 가장 강력한 기능으로, 세밀한 권한 제어가 가능합니다.

| ZeroDev Policy | 기능 | StableNet |
|----------------|------|-----------|
| `toCallPolicy` | 특정 컨트랙트/함수 셀렉터 제한 | 없음 |
| `toGasPolicy` | 가스 예산 한도 | 없음 |
| `toRateLimitPolicy` | 시간당 호출 횟수 제한 | 없음 |
| `toTimestampPolicy` | 시간 윈도우 실행 제한 | session-keys에 기본적 |
| `toSignatureCallerPolicy` | 호출자 주소 검증 | 없음 |
| `toSudoPolicy` | 마이그레이션용 무제한 바이패스 | 없음 |
| Merkle tree proving | 가스 효율적 권한 증명 | 없음 |

**StableNet 현황**: `plugin-session-keys`가 시간/지출 제한만 제공

**권장 구현**:
```
plugins/
  └── permission/
      ├── src/
      │   ├── permissionValidator.ts        # 권한 기반 검증자
      │   ├── policies/
      │   │   ├── callPolicy.ts             # 컨트랙트/함수 제한
      │   │   ├── gasPolicy.ts              # 가스 예산
      │   │   ├── rateLimitPolicy.ts        # 호출 빈도 제한
      │   │   ├── timestampPolicy.ts        # 시간 윈도우
      │   │   └── parameterPolicy.ts        # 파라미터 조건부 실행
      │   ├── merkle/
      │   │   ├── merkleTree.ts             # Merkle tree 구성
      │   │   └── merkleProver.ts           # 증명 생성
      │   └── types.ts
      └── tests/
```

#### F-03. Social Recovery / Social Login 부재

| 기능 | ZeroDev | StableNet |
|------|---------|-----------|
| OAuth 로그인 (Google/Facebook) | Magic SDK 통합 | 없음 |
| 소셜 복구 | 가디언 기반 복구 | 없음 |
| `isAuthorized()` | OAuth 세션 확인 | 없음 |
| `initiateLogin()` | OAuth 플로우 시작 | 없음 |

**권장 구현**: Magic SDK 또는 Web3Auth 통합 플러그인

---

### 3.2 IMPORTANT — 기능 완성도

#### F-04. Weighted Validator 부재

- **ZeroDev**: `weighted-ecdsa`, `weighted-r1-k1` — 서명자별 가중치 + 임계값 기반 다중서명
- **StableNet**: `plugin-multisig`는 모든 서명자가 동일 가중치 (M-of-N)
- **필요성**: 기업 거버넌스 (CEO: 가중치 3, 팀원: 가중치 1, 임계값: 5)
- **예상 난이도**: 중

#### F-05. Hooks Plugin 부재

- **ZeroDev**: `toSpendingLimitHook` — 토큰별 지출 한도 post-validation 체크
- **StableNet**: core에 Hook 타입 정의는 있으나 플러그인 구현 없음
- **필요성**: ERC-7579 Hook 모듈 타입의 실질적 활용
- **예상 난이도**: 중

#### F-06. Fallback Client 부재

- **ZeroDev**: `createFallbackKernelAccountClient` — Proxy 기반 번들러/RPC 다중 엔드포인트 자동 전환
- **StableNet**: 단일 엔드포인트만 지원, 실패 시 CircuitBreaker로 차단만 함
- **필요성**: 프로덕션 고가용성(HA) 보장
- **예상 난이도**: 하

```typescript
// 제안 API
const client = createFallbackSmartAccountClient({
  clients: [
    createSmartAccountClient({ bundlerTransport: http(bundlerUrl1) }),
    createSmartAccountClient({ bundlerTransport: http(bundlerUrl2) }),
  ],
  onError: (error, clientIndex) => console.error(`Client ${clientIndex} failed`, error),
})
```

#### F-07. Kernel Migration 부재

- **ZeroDev**: `createKernelMigrationAccount` — 검증자 원자적 교체 (ECDSA→WebAuthn 등)
- **StableNet**: 검증자 변경 메커니즘 없음
- **필요성**: 프로덕션에서 보안 키 로테이션 필수
- **예상 난이도**: 중

#### F-08. Remote Signer 부재

- **ZeroDev**: `remoteSigner` 플러그인 — 백엔드/커스터디 서명 위임
- **StableNet**: 로컬 서명만 지원
- **필요성**: 기업 환경에서 HSM/KMS 연동 필수
- **예상 난이도**: 하

---

### 3.3 MEDIUM — 완성도 향상

| ID | 기능 | 설명 | 예상 난이도 |
|----|------|------|------------|
| F-09 | EIP-1193 Provider 확장 | EventEmitter, 전체 메서드 커버리지 | 하 |
| F-10 | Client Decorator 패턴 | 커스텀 메서드 확장 HOF | 하 |
| F-11 | DelegateCall 지원 | 배치 내 per-call 실행 모드 선택 | 중 |
| F-12 | Multi-Version Account | Kernel v0.2.x 레거시 지원 | 중 |
| F-13 | Observability Hook | 메트릭/로깅/트레이싱 인터페이스 | 하 |

---

## 4. 테스트 커버리지 분석

### 4.1 패키지별 테스트 현황

| 패키지/컴포넌트 | 파일 | 커버리지 | 주요 갭 |
|----------------|------|----------|---------|
| **core/clients** | | | |
| SmartAccountClient | - | **낮음** | 에러 시나리오, transport 실패, paymaster 미설정 |
| BundlerClient | `bundlerClient.test.ts` | 양호 | receipt 파싱 경계 케이스 |
| **core/transaction** | | | |
| TransactionRouter | `transactionRouter.test.ts` | 부분 | prepare→execute 통합 테스트 없음 |
| EIP7702Transaction | `eip7702Transaction.test.ts` | 부분 | 에러 경로 |
| Strategies | `smartAccountStrategy.test.ts`, `eip7702Strategy.test.ts` | 부분 | validate 경계 테스트 부족 |
| **core/gas** | | | |
| GasEstimator | `gasEstimator.test.ts` | 부분 | 전략 간 통합 테스트 없음 |
| **core/rpc** | | | |
| CircuitBreaker | `circuitBreaker.test.ts` | **양호** | — |
| JsonRpcClient | `jsonRpcClient.test.ts` | 양호 | timeout 테스트 부족 |
| RequestCache | `requestCache.test.ts` | 양호 | — |
| **core/security** | | | |
| InputValidator | `inputValidator.test.ts` | 양호 | — |
| PhishingDetector | `phishingDetector.test.ts` | 양호 | — |
| TransactionRiskAnalyzer | `transactionRiskAnalyzer.test.ts` | 양호 | — |
| TypedDataValidator | `typedDataValidator.test.ts` | 양호 | — |
| RateLimiter | `rateLimiter.test.ts` | 양호 | — |
| AuthorizationRiskAnalyzer | `authorizationRiskAnalyzer.test.ts` | 양호 | — |
| **core/modules** | | | |
| ValidatorRouter | `validatorRouter.test.ts` | **양호** | — |
| NonceUtils | `nonceUtils.test.ts` | 양호 | — |
| ValidatorUtils | `validatorUtils.test.ts` | 양호 | — |
| **core/paymaster** | | | |
| PaymasterHasher | `paymasterHasher.test.ts` | 부분 | — |
| PaymasterClient | - | **낮음** | policy, timeout 테스트 없음 |
| **accounts** | | | |
| KernelAccount | `index.test.ts`, `kernelAccountRouter.test.ts` | 부분 | 배포 상태 캐싱, 에러 경로 |
| **plugins** | | | |
| ECDSA | `index.test.ts` | 부분 | — |
| WebAuthn | `index.test.ts` | 부분 | — |
| MultiSig | `index.test.ts` | 부분 | — |
| Session Keys | `index.test.ts` | 부분 | — |
| Stealth | `index.test.ts` | 부분 | — |
| Subscription | `index.test.ts` | 부분 | — |
| Paymaster | `index.test.ts` | 부분 | — |
| DeFi | `index.test.ts` | 부분 | — |
| Modules | `index.test.ts` | 부분 | — |

### 4.2 필요한 테스트 추가

**통합 테스트 (존재하지 않음)**:
- SmartAccountClient → BundlerClient → EntryPoint 전체 플로우
- TransactionRouter prepare → execute → receipt 플로우
- Module install → execute → uninstall 라이프사이클
- Paymaster 연동 UserOp 전체 플로우

**에러 시나리오 테스트**:
- 잘못된 transport 설정 시 SmartAccountClient 생성 실패
- 번들러 연결 실패 시 재시도/폴백 동작
- 잘못된 서명 시 UserOp 거부
- Nonce 충돌 시 동작

---

## 5. StableNet 고유 강점

ZeroDev에 없는 StableNet만의 기능으로, 유지하고 강화해야 할 영역입니다.

| 기능 | 설명 | ZeroDev |
|------|------|---------|
| **3-Mode TransactionRouter** | EOA/EIP-7702/Smart Account 통합 라우팅 | 없음 (SA 전용) |
| **8개 내장 보안 모듈** | Input, Phishing, TxRisk, SigRisk, TypedData, RateLimit, AuthRisk, LegacyAPI | 없음 |
| **크로스 언어 Crypto 추상화** | `CryptoProvider`/`AbiEncoder` 인터페이스 (Go/Rust 확장 설계) | 없음 (TS 전용) |
| **EIP-7702 Risk Analyzer** | Authorization 위임 4단계 위험도 분석 | 기본 검증만 |
| **자체 GasPriceOracle** | `eth_feeHistory` 기반 동적 가격 추정 | ZeroDev API 위임 |
| **RPC CircuitBreaker** | 상태 머신 기반 RPC 장애 격리 | 없음 |
| **Stealth Address** | EIP-5564/6538 프라이버시 결제 | 없음 |
| **Subscription Payment** | EIP-7715 기반 반복 결제 | 없음 |
| **Paymaster Envelope 패턴** | header + payload + signature 구조화된 인코딩 | 없음 |
| **ERC-4337 v0.9 Gas Penalty** | 미사용 가스 페널티 계산 | 없음 |

---

## 6. 개선 로드맵

### Phase 1 — 코드 안정화 (1~2주)

코드 품질 Critical/High 이슈 수정 및 테스트 보강

| 우선순위 | ID | 작업 | 예상 공수 |
|---------|-----|------|----------|
| 1 | C-01 | SmartAccountClient 입력 검증 추가 | 4h |
| 2 | C-02 | NonceManager 도입 | 8h |
| 3 | C-03 | Transport URL 추출 안전성 | 2h |
| 4 | C-04 | 에러 cause 체인 추가 | 1h |
| 5 | H-01 | Paymaster policy 파라미터 구현 | 4h |
| 6 | H-02 | Strategy validate() 강화 | 4h |
| 7 | H-03 | RPC 에러 감지 개선 | 4h |
| 8 | H-04 | getNonce() 재시도 로직 | 2h |
| 9 | H-05 | ValidatorRouter 에러 타입 교체 | 1h |
| 10 | H-06 | Nonce key 범위 검증 | 1h |
| | | **소계** | **~31h** |

### Phase 2 — 핵심 기능 추가 (3~4주)

프로덕션 배포에 필요한 핵심 기능 갭 해소

| 우선순위 | ID | 작업 | 예상 공수 |
|---------|-----|------|----------|
| 1 | F-02 | Permission/Policy 시스템 | 40h |
| 2 | F-06 | Fallback Client | 8h |
| 3 | F-08 | Remote Signer 플러그인 | 8h |
| 4 | F-07 | Kernel Migration 지원 | 16h |
| 5 | F-05 | Hooks Plugin | 16h |
| 6 | F-04 | Weighted Validator | 16h |
| | | **소계** | **~104h** |

### Phase 3 — 멀티체인 & 소셜 (4~6주)

멀티체인 지원 및 사용자 온보딩 개선

| 우선순위 | ID | 작업 | 예상 공수 |
|---------|-----|------|----------|
| 1 | F-01 | Multi-Chain Validator | 40h |
| 2 | F-03 | Social Recovery/Login | 24h |
| 3 | F-09 | EIP-1193 Provider 확장 | 8h |
| 4 | F-10 | Client Decorator 패턴 | 8h |
| 5 | F-13 | Observability Hook | 8h |
| | | **소계** | **~88h** |

### Phase 4 — 완성도 (2~3주)

레거시 호환성 및 고급 기능

| 우선순위 | ID | 작업 | 예상 공수 |
|---------|-----|------|----------|
| 1 | M-01~04 | Medium 코드 품질 이슈 4건 | 8h |
| 2 | F-11 | DelegateCall 지원 | 16h |
| 3 | F-12 | Multi-Version Account | 16h |
| 4 | - | 통합 테스트 전체 구축 | 24h |
| | | **소계** | **~64h** |

---

### 총 예상 공수

| Phase | 기간 | 공수 | 목표 |
|-------|------|------|------|
| Phase 1 | 1~2주 | ~31h | 코드 안정화 |
| Phase 2 | 3~4주 | ~104h | 핵심 기능 |
| Phase 3 | 4~6주 | ~88h | 멀티체인 & 소셜 |
| Phase 4 | 2~3주 | ~64h | 완성도 |
| **합계** | **10~15주** | **~287h** | **프로덕션 준비 완료** |

---

## 부록: 프로젝트 구조 비교

### 패키지 구성

```
ZeroDev (@zerodev/sdk)                    StableNet (@stablenet/*)
───────────────────────────               ──────────────────────────
packages/core/                            core/          (@stablenet/core)
  ├── accounts/kernel/                    accounts/      (@stablenet/accounts)
  ├── clients/                            types/         (@stablenet/sdk-types)
  ├── actions/                            crypto/        (@stablenet/sdk-crypto)
  ├── providers/                          addresses/     (@stablenet/sdk-addresses)
  └── types/
                                          plugins/
plugins/                                    ├── ecdsa/
  ├── ecdsa/                                ├── webauthn/
  ├── passkey/                              ├── multisig/
  ├── webauthn-key/                         ├── session-keys/
  ├── session-key/                          ├── stealth/        ← StableNet only
  ├── permission/        ← ZeroDev only    ├── subscription/   ← StableNet only
  ├── modularPermission/ ← ZeroDev only    ├── paymaster/
  ├── multi-chain-ecdsa/ ← ZeroDev only    ├── defi/           ← StableNet only
  ├── multi-chain-web-authn/ ← ZeroDev     └── modules/        ← StableNet only
  ├── multi-chain-weighted-validator/
  ├── multi-tenant-session-account/
  ├── weighted-ecdsa/    ← ZeroDev only
  ├── weighted-r1-k1/   ← ZeroDev only
  ├── hooks/             ← ZeroDev only
  ├── remoteSigner/      ← ZeroDev only
  └── social/            ← ZeroDev only
```

### 의존성 비교

| 의존성 | ZeroDev | StableNet |
|--------|---------|-----------|
| viem | ^2.28.0 (peer) | ^2.46.3 |
| semver | ^7.6.0 | - |
| @noble/hashes | - | ^1.6.1 |
| @noble/curves | - | 사용 |
| TypeScript | ~5.3.0 | ^5.7.2 |
| 빌드 도구 | tsc (ESM/CJS/Types) | tsup (ESM only) |
| 테스트 | - | vitest ^4.0.18 |
| 린터 | Biome | Biome ^2.4.6 |

### 디자인 패턴 비교

| 패턴 | ZeroDev | StableNet |
|------|---------|-----------|
| Strategy | - | TransactionRouter, Gas |
| Registry | - | Module, Strategy |
| Factory | `createKernelAccount` | `create*()` 일관된 패턴 |
| Adapter | - | ViemProvider, CryptoProvider |
| Router | - | TransactionRouter, ValidatorRouter |
| Circuit Breaker | - | RPC resilience |
| Builder | - | Transaction builders |
| Decorator | viem Client Actions | - |
| Plugin Manager | KernelPluginManager | - (모듈 시스템으로 대체) |
| Duck Typing | - | ValidatorRouter 감지 |
