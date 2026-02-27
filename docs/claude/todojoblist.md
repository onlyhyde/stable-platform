# EIP-4337 스펙 준수 검토 — Todo Job List

작성일: 2026-02-27
기준 문서: `docs/claude/spec/EIP-4337_스펙표준_정리.md`

---

## 검토 대상 프로젝트 현황

| # | 프로젝트 | 경로 | 준수율 | 등급 | 변동 |
|---|---------|------|-------|------|------|
| 1 | EntryPoint 컨트랙트 | `poc-contract/src/erc4337-entrypoint/` | 100% | A+ | — |
| 2 | Paymaster 컨트랙트 | `poc-contract/src/erc4337-paymaster/` | 98% | A+ | +3% (P2-1) |
| 3 | SmartAccount (Kernel) | `poc-contract/src/erc7579-smartaccount/` | 100% | A+ | — |
| 4 | SDK TypeScript | `stable-platform/packages/sdk-ts/` | 100% | A+ | — |
| 5 | SDK Go | `stable-platform/packages/sdk-go/` | 97% | A | +9% (P2-2, P2-3, P3-2) |
| 6 | Bundler 서비스 | `stable-platform/services/bundler/` | 97% | A | +17% (P0-1~3, P1-5, P2-6, P3-5) |
| 7 | Paymaster Proxy 서비스 | `stable-platform/services/paymaster-proxy/` | 97% | A | +12% (P1-1, P2-4~5, P3-1, P3-6) |
| 8 | Wallet SDK | `stable-platform/packages/wallet-sdk/` | 75% | B- | +45% (P1-2~4, P3-3~4) |

---

## P0 — Critical (즉시 수정)

### [P0-1] ~~Bundler: MAX_VERIFICATION_GAS 상한 값 수정~~ ✅ 완료
- [x] **파일**: `services/bundler/src/config/constants.ts`
- **수정 내용**:
  - [x] `MAX_VERIFICATION_GAS`를 `10_000_000n` → `500_000n`으로 변경
  - [x] `formatValidator.ts`에서 per-entity 가스 리밋 검증 분리 (verificationGasLimit, paymasterVerificationGasLimit 각각 500K 상한)
  - [x] 관련 help text 및 주석 업데이트 (`constants.ts`, `types.ts`)

### [P0-2] ~~Bundler: 번들 내 sender 중복 검증 구현~~ ✅ 완료
- [x] **파일**: `services/bundler/src/executor/bundleExecutor.ts`
- **수정 내용**:
  - [x] `deduplicateSenders()` 메서드 구현 — 번들 조립 시 sender별 UserOp 수 제한 (1개)
  - [x] staked sender 예외 처리: `getDepositInfo()` + `reputationManager.isStaked()` 사용
  - [x] `tryBundle()` 파이프라인에 dedup 단계 통합

### [P0-3] ~~Bundler: Paymaster deposit 번들 총합 검증 구현~~ ✅ 완료
- [x] **파일**: `services/bundler/src/executor/bundleExecutor.ts`
- **수정 내용**:
  - [x] `validatePaymasterDeposits()` 메서드 구현 — paymaster별 총 가스 비용 집계
  - [x] EntryPoint `getDepositInfo(paymaster)`로 실시간 잔액 조회
  - [x] deposit 부족 시 초과 UserOp 제외 (deposit 범위 내 최대한 포함)
  - [x] `tryBundle()` 파이프라인에 deposit 검증 단계 통합

---

## P1 — High (프로덕션 전 수정)

### [P1-1] ~~Paymaster Proxy: EntryPoint deposit 모니터링 구현~~ ✅ 완료
- [x] **파일**: `services/paymaster-proxy/src/deposit/depositMonitor.ts` (신규)
- **수정 내용**:
  - [x] `DepositMonitor` 클래스 — 주기적 `balanceOf(paymaster)` 조회 워커
  - [x] `config/constants.ts`에 `DEPOSIT_MONITOR_*` 환경변수 추가 (threshold, poll interval, reject on low)
  - [x] `app.ts`에 deposit monitor 통합 — `/health` 엔드포인트에 deposit 잔액 정보 포함
  - [x] `pm_getPaymasterData` 호출 시 deposit 부족 사전 거부 옵션 (`rejectOnLowDeposit`)

### [P1-2] ~~Wallet SDK: userOpHash 계산 함수 구현~~ ✅ 완료
- [x] **파일**: `packages/wallet-sdk/src/userOp/hash.ts` (신규)
- **수정 내용**:
  - [x] `computeUserOpHash(userOp, entryPoint, chainId): Hex` — EIP-4337 Section 4 준수
  - [x] Packed UserOp → keccak256(encodedFields) → keccak256(abi.encode(hash, entryPoint, chainId))
  - [x] `src/index.ts`에 export 추가

### [P1-3] ~~Wallet SDK: PackedUserOperation 인코딩 구현~~ ✅ 완료
- [x] **파일**: `packages/wallet-sdk/src/userOp/pack.ts` (신규)
- **수정 내용**:
  - [x] `packUserOperation(userOp): PackedUserOperation` — Off-chain → Packed 변환
  - [x] `unpackUserOperation(packed): UserOperation` — 역변환
  - [x] `UserOperation`, `PackedUserOperation` 인터페이스 정의
  - [x] `src/index.ts`에 export 추가

### [P1-4] ~~Wallet SDK: Bundler RPC convenience 메서드 추가~~ ✅ 완료
- [x] **파일**: `packages/wallet-sdk/src/provider/StableNetProvider.ts`
- **수정 내용**:
  - [x] `sendUserOperation(userOp, entryPoint): Promise<Hash>` 메서드
  - [x] `estimateUserOperationGas(userOp, entryPoint): Promise<GasEstimate>` 메서드
  - [x] `getUserOperationReceipt(hash): Promise<Receipt | null>` 메서드
  - [x] `waitForUserOperation(hash, options?): Promise<Receipt>` 폴링 (exponential backoff)
  - [x] `AA_ERROR_CODES` 상수 — AA1x, AA2x, AA3x, AA4x, AA5x 계열 (`rpc/index.ts`)

### [P1-5] ~~Bundler: Paymaster 코드 존재 사전 검증 추가~~ ✅ 완료
- [x] **파일**: `services/bundler/src/validation/validator.ts`
- **수정 내용**:
  - [x] `validatePaymasterOnChain()` — Phase 3 (State Validation)에 추가
  - [x] `hasCode(paymaster)` 호출로 코드 존재 확인
  - [x] `getDepositInfo(paymaster)` 호출로 deposit이 UserOp max gas cost 이상인지 확인
  - [x] reputation 차단은 기존 Phase 2 `checkReputations()`에서 이미 처리됨

---

## P2 — Medium (품질 개선)

### [P2-1] ~~Paymaster 컨트랙트: Public Mempool 호환성 검토~~ ✅ 완료
- [x] **파일**: `poc-contract/src/erc4337-paymaster/BasePaymaster.sol`
- **수정 내용**:
  - [x] **방침 결정: Private/Trusted Bundler Only (PoC Phase)**
  - [x] `BasePaymaster.sol`에 공식 정책 문서 추가 — 모든 validation-phase 위반 사항 목록화
  - [x] 각 컨트랙트별 기존 경고 주석 확인 (VerifyingPaymaster, SponsorPaymaster, Permit2Paymaster, ERC20Paymaster 모두 상세 경고 포함됨)
  - [x] 향후 public mempool 지원 시 필요한 3가지 변경사항 명시 (nonce→postOp, permit→postOp, staked paymaster)

### [P2-2] ~~SDK Go: Nonce key 분리 전략 API 노출~~ ✅ 완료
- [x] **파일**: `packages/sdk-go/accounts/kernel/account.go`, `accounts/types.go`
- **수정 내용**:
  - [x] `SmartAccount` 인터페이스에 `GetNonceWithKey(ctx, key *big.Int) (uint64, error)` 추가
  - [x] `Account.GetNonce()` → `GetNonceWithKey(ctx, big.NewInt(0))` 위임으로 리팩터링
  - [x] `GetNonceWithKey()` 구현 — nil key 안전 처리, 상세 문서 주석 추가
  - [x] 기본값 key=0 유지, 고급 사용자용 커스텀 key 지원

### [P2-3] ~~SDK Go: preVerificationGas 계산 공식 구현~~ ✅ 완료
- [x] **파일**: `packages/sdk-go/config/gas.go`, `gas/estimator.go`
- **수정 내용**:
  - [x] `CalculatePreVerificationGas(userOpBytes, bundleSize, hasEIP7702Auth)` 함수 구현
    - calldata gas (EIP-2028: zero byte 4gas, non-zero byte 16gas)
    - 기본 번들 비용 (21,000 / bundleSize)
    - per-op overhead (18,300)
    - EIP-7702 authorization cost (25,000 해당 시)
  - [x] `SmartAccountStrategy.Estimate()`에서 bundler 실패 시 로컬 계산 fallback 적용
  - [x] EIP-7702 모드 자동 감지 (`TransactionModeEIP7702`)

### [P2-4] ~~Paymaster Proxy: 리스크 스코어링 구현~~ ✅ 완료
- [x] **파일**: `services/paymaster-proxy/src/policy/riskScorer.ts` (신규)
- **수정 내용**:
  - [x] `RiskScorer` 클래스 — 4가지 리스크 요소 평가 (callData 패턴, gas 이상 징후, sender 평판, factory 사용)
  - [x] `RiskAssessment` 결과 — score (0.0~1.0), level (low/medium/high/critical), factors 상세
  - [x] configurable threshold (기본 reject: 0.8, review: 0.5)
  - [x] sender 이력 추적 — 성공/실패 비율 기반 평판 계산
  - [x] `SponsorPolicyManager.checkPolicy()`에 risk assessment 통합 — threshold 초과 시 자동 거부
  - [x] `assessRisk()`, `recordRiskOutcome()` 공개 메서드 추가

### [P2-5] ~~Paymaster Proxy: ERC-1271 스마트 컨트랙트 서명자 지원~~ ✅ 완료
- [x] **파일**: `services/paymaster-proxy/src/signer/paymasterSigner.ts`
- **수정 내용**:
  - [x] `SignerType` ('eoa' | 'erc1271') 타입 추가
  - [x] `ContractSignerConfig` — PublicClient, contractAddress, signerPrivateKey 설정
  - [x] `PaymasterSigner` 생성자에 optional `ContractSignerConfig` 파라미터 추가
  - [x] `verifyERC1271Signature()` — on-chain `isValidSignature(bytes32,bytes)` 호출 (magic value `0x1626ba7e`)
  - [x] stub signature 생성 시 ERC-1271 포맷 반영 (0x01 mode byte + 20 bytes signer + 65 bytes ECDSA)
  - [x] `generateSignedData()` — ERC-1271 모드 시 서명 포맷 자동 전환

### [P2-6] ~~Bundler: 최소 가스비 정책 설정 지원~~ ✅ 완료
- [x] **파일**: `services/bundler/src/config/constants.ts`, `validation/formatValidator.ts`
- **수정 내용**:
  - [x] `BUNDLER_MIN_MAX_FEE_PER_GAS` 환경변수 추가 (기본값: 1 gwei = 1,000,000,000)
  - [x] `BUNDLER_MIN_MAX_PRIORITY_FEE_PER_GAS` 환경변수 추가 (기본값: 0 = 제한 없음)
  - [x] `formatValidator.validateGasRelationships()`에 최소 가스비 검증 추가
  - [x] help text에 신규 환경변수 문서화
  - [x] TypeScript 컴파일 확인 (기존 6개 pre-existing 에러 외 신규 에러 없음)

---

## P3 — Low (장기 개선)

### [P3-1] ~~Paymaster Proxy: 동적 가스 리밋 추정~~ ✅ 완료
- [x] **파일**: `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts`
- **수정 내용**:
  - [x] 정적 `DEFAULT_GAS_LIMITS` → 동적 `estimateGasLimits()` 함수로 교체
  - [x] `BASE_GAS_LIMITS` (최소 floor값) + `GAS_OVERHEAD` (상황별 추가분) 아키텍처
  - [x] 동적 조정 기준: factory 존재(+50K verification), 대용량 callData >1KB(+20K), 토큰 postOp(+50K), 대용량 paymasterData >256B(+30K)
  - [x] 4개 핸들러(verifying, sponsor, erc20, permit2) 모두 동적 추정 적용

### [P3-2] ~~SDK Go: Signature 포맷 플러그인화~~ ✅ 완료
- [x] **파일**: `packages/sdk-go/accounts/types.go`, `accounts/kernel/constants.go`, `accounts/kernel/account.go`
- **수정 내용**:
  - [x] `SignatureFormatter` 인터페이스 정의 — `FormatSignature(rawSignature) (Hex, error)`
  - [x] `KernelSignatureFormatter` 구현 — mode byte prefix (기본 0x02 validation mode)
  - [x] `NewKernelSignatureFormatterWithMode(mode)` — enable mode(0x00), enable-with-sig(0x01) 지원
  - [x] `AccountConfig.SignatureFormatter` 옵션 추가 (nil이면 기본 validation mode 사용)
  - [x] `SignUserOperation()`에서 하드코딩 제거 → `signatureFormatter.FormatSignature()` 위임

### [P3-3] ~~Wallet SDK: UserOperation Builder API~~ ✅ 완료
- [x] **파일**: `packages/wallet-sdk/src/userOp/builder.ts` (신규)
- **수정 내용**:
  - [x] `UserOperationBuilder` — Fluent API 스타일 빌더 클래스
  - [x] `setSender()`, `setNonce()`, `setCallData()`, `setGasLimits()`, `setGasFees()`, `setPaymaster()`, `setFactory()`, `setSignature()` 체이닝 메서드
  - [x] `build()` — 필수 필드 검증, factory/paymaster 일관성 검증, gas fee 관계 검증
  - [x] `clone()` — 빌더 복제 (설정 fork용)
  - [x] `UserOperationValidationError` — 누락 필드 목록 포함 에러
  - [x] `GasLimitsConfig`, `GasFeesConfig`, `PaymasterConfig`, `FactoryConfig` 타입
  - [x] `src/userOp/index.ts`, `src/index.ts`에 export 추가

### [P3-4] ~~Wallet SDK: AA 에러 처리 프레임워크~~ ✅ 완료
- [x] **파일**: `packages/wallet-sdk/src/errors/aaErrors.ts` (신규)
- **수정 내용**:
  - [x] `AAError` 클래스 — code, category, severity, suggestions 포함 구조화 에러
  - [x] `AAErrorInfo` — AA1x~AA5x 전체 에러 코드별 메타데이터 (18개 코드)
  - [x] `AAErrorSeverity` — fatal, recoverable, transient 분류
  - [x] `parseAAError(error)` — 번들러/EntryPoint 에러 자동 파싱 → 구조화된 AAError
  - [x] `extractAAErrorCode()` — 에러 메시지에서 AA 코드 정규식 추출
  - [x] `extractRevertReason()` — revert reason 문자열 추출
  - [x] `getAAErrorInfo()` — 코드별 상세 정보 조회
  - [x] 각 에러 코드별 actionable recovery suggestions 제공
  - [x] `src/errors/index.ts`, `src/index.ts`에 export 추가

### [P3-5] ~~Bundler: debug_traceCall RPC 타임아웃 처리~~ ✅ 완료
- [x] **파일**: `services/bundler/src/validation/tracer.ts`
- **수정 내용**:
  - [x] `TracerConfig.clientTimeoutMs` 옵션 추가 (기본값: 15,000ms)
  - [x] `requestWithTimeout()` private 메서드 — `Promise.race` + setTimeout 기반 클라이언트측 타임아웃
  - [x] timer `unref()` 처리 — 프로세스 종료 차단 방지
  - [x] 타임아웃 시 전용 에러 메시지 (`debug_traceCall timed out after Xms`)
  - [x] 기존 RPC node측 `timeout: '10s'` 설정과 이중 보호 (node 10s + client 15s)

### [P3-6] ~~Paymaster Proxy: 개발 환경 Admin 엔드포인트 인증~~ ✅ 완료
- [x] **파일**: `services/paymaster-proxy/src/app.ts`
- **수정 내용**:
  - [x] **모든 환경에서 admin 인증 필수화** — 3-way 분기 (auth/production-block/dev-open) 제거
  - [x] `PAYMASTER_ADMIN_TOKEN` 미설정 시 `crypto.randomUUID()`로 임시 토큰 자동 생성 및 콘솔 출력
  - [x] 개발 환경에서도 `bearerAuth` 미들웨어 항상 적용
  - [x] 운영자에게 영구 토큰 설정 안내 메시지 출력

---

## 준수 완료 항목 (변경 불필요)

### EntryPoint 컨트랙트 — 전항목 통과
- [x] `handleOps()` 배치 실행 — `EntryPoint.sol:89-104`
- [x] `nonReentrant` 순수 EOA 검증 — `EntryPoint.sol:75-86`
- [x] `getNonce(sender, key)` — `NonceManager.sol:16-18`
- [x] Deposit 관리 (balanceOf/depositTo/withdrawTo) — `StakeManager.sol:34-133`
- [x] Stake 관리 (addStake/unlockStake/withdrawStake) — `StakeManager.sol:82-122`
- [x] `receive() payable` — `StakeManager.sol:38-40`
- [x] `getCurrentUserOpHash()` transient storage — `EntryPoint.sol:69, 172-174`
- [x] EIP-712 domain separator (ERC4337, v1) — `EntryPoint.sol:66-73`
- [x] PackedUserOperation struct 전필드 — `PackedUserOperation.sol:42-52`
- [x] 검증→실행→정산 3단계 — `EntryPoint.sol:481-890`
- [x] 10% 미사용 가스 페널티 (40K 임계) — `EntryPoint.sol:948-957`
- [x] EIP-7702 지원 (0x7702 initCode) — `Eip7702Support.sol`
- [x] Block Number Mode (bit 47 플래그) — `EntryPoint.sol:735-757`
- [x] 에러 타입 (FailedOp, FailedOpWithRevert, SignatureValidationFailed) — `IEntryPoint.sol`
- [x] 이벤트 전체 (UserOperationEvent 등 8종) — `IEntryPoint.sol:31-103`
- [x] SenderCreator 래퍼 — `SenderCreator.sol:16-59`

### SmartAccount (Kernel) — 전항목 통과
- [x] IAccount `validateUserOp` 인터페이스 — `Kernel.sol:280-333`
- [x] EntryPoint caller 검증 (`onlyEntryPoint`) — `Kernel.sol:78-103`
- [x] 서명 검증 (userOpHash 기반) — `ValidationManager.sol:287-341`
- [x] SIG_VALIDATION_FAILED 반환 (revert 아님) — `KernelValidationResult.sol:7-44`
- [x] 서명 실패 시에도 정상 플로우 완료 — `Kernel.sol:327-332`
- [x] missingAccountFunds 지불 — `Kernel.sol:327-332`
- [x] validationData 패킹 (authorizer|validUntil|validAfter) — `Types.sol:86-113`
- [x] IAccountExecute `executeUserOp` — `Kernel.sol:361-381`
- [x] Factory CREATE2 결정론적 배포 — `KernelFactory.sol:18-36`
- [x] Nonce key 분리 전략 — `ValidationTypeLib.sol:43-87`
- [x] ERC-7579 모듈 호환 (6종) — `Kernel.sol:585-587`

### Paymaster 컨트랙트 — 핵심 항목 통과
- [x] IPaymaster 인터페이스 (validatePaymasterUserOp + postOp) — `BasePaymaster.sol:61-84`
- [x] PostOpMode enum (opSucceeded, opReverted) — `IPaymaster.sol:11-19`
- [x] EntryPoint caller 검증 — `BasePaymaster.sol:32-41`
- [x] Deposit/Stake 관리 — `BasePaymaster.sol:120-165`
- [x] validationData 패킹 — `BasePaymaster.sol:175-187`
- [x] paymasterAndData 포맷 (52바이트 prefix) — `BasePaymaster.sol:194-204`
- [x] 4개 paymaster 패턴 구현 — Verifying, Sponsor, ERC20, Permit2
- [x] PaymasterDataLib 인코딩/디코딩 — `PaymasterDataLib.sol:19-209`

### SDK TypeScript — 전항목 통과
- [x] UserOperation 전필드 구성 — `types/src/userOperation.ts`
- [x] Off-chain → Packed 매핑 (uint128) — `core/src/utils/userOperation.ts:8-51`
- [x] EIP-712 userOpHash 계산 — `core/src/utils/userOperation.ts:120-212`
- [x] PACKED_USEROP_TYPEHASH 정확 일치 — 스펙과 동일
- [x] Signature: userOpHash 서명 — `core/src/clients/smartAccountClient.ts:182-185`
- [x] Bundler RPC 6개 메서드 — `core/src/clients/bundlerClient.ts`
- [x] Nonce key 분리 전략 — `accounts/src/kernel/kernelAccount.ts:68-78`
- [x] Domain separation (chainId + EntryPoint) — 테스트 검증 완료

---

## 참고: 스펙 문서 매핑

| 스펙 섹션 | 주요 검증 대상 |
|----------|--------------|
| Section 3 (UserOperation 필드) | SDK-TS, SDK-Go, Wallet SDK |
| Section 4 (EntryPoint 책임) | EntryPoint 컨트랙트 |
| Section 5 (Account 요구사항) | SmartAccount (Kernel) |
| Section 6 (Paymaster 표준) | Paymaster 컨트랙트, Paymaster Proxy |
| Section 7 (Bundler 표준) | Bundler 서비스 |
| Section 8 (보안 체크리스트) | 전체 프로젝트 |
| Section 12 (EIP-712 해싱) | SDK-TS, SDK-Go, EntryPoint |
| Section 13 (preVerificationGas) | Bundler, SDK-Go |
| Section 14 (이벤트) | EntryPoint 컨트랙트 |
