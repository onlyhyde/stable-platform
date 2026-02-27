# EIP-4337 스펙 준수 검토 — 잔여 이슈

작성일: 2026-02-27 | 최종 업데이트: 2026-02-28
기준 문서: `docs/claude/spec/EIP-4337_스펙표준_정리.md`

---

## 모듈별 준수 현황

| # | 프로젝트 | 경로 | 준수율 | 등급 | 변경 |
|---|---------|------|-------|------|------|
| 1 | EntryPoint 컨트랙트 | `poc-contract/src/erc4337-entrypoint/` | 100% | A+ | |
| 2 | Paymaster 컨트랙트 | `poc-contract/src/erc4337-paymaster/` | 98% | A+ | |
| 3 | SmartAccount (Kernel) | `poc-contract/src/erc7579-smartaccount/` | 100% | A+ | |
| 4 | SDK TypeScript | `stable-platform/packages/sdk-ts/` | 99% | A+ | |
| 5 | SDK Go | `stable-platform/packages/sdk-go/` | 99% | A+ | |
| 6 | Bundler 서비스 | `stable-platform/services/bundler/` | 100% | A+ | ⬆ 97→100% |
| 7 | Paymaster Proxy 서비스 | `stable-platform/services/paymaster-proxy/` | 100% | A+ | ⬆ 97→100% |
| 8 | Wallet SDK | `stable-platform/packages/wallet-sdk/` | 95% | A | ⬆ 75→95% |

---

## 잔여 이슈 — Paymaster 컨트랙트 (98%)

Public mempool 환경에서의 validation-phase opcode 제약(Section 7.1) 미충족. 현재 Private/Trusted Bundler 전용으로 동작.

| 이슈 | 설명 | 스펙 참조 |
|------|------|----------|
| validation-phase 상태 쓰기 | VerifyingPaymaster, SponsorPaymaster — `_validatePaymasterUserOp`에서 `senderNonce[sender]++` 수행. nonce 증가를 `postOp`으로 이전 필요 | Section 7.1 |
| 외부 상태 변경 | Permit2Paymaster — `PERMIT2.permit()` 호출이 validation-phase에서 외부 컨트랙트 상태 변경 (가장 심각한 위반) | Section 7.1 |
| 외부 컨트랙트 읽기 | ERC20Paymaster — `balanceOf`, `allowance` 외부 호출. staked paymaster 등록 또는 associated storage로 한정 필요 | Section 7.1 |

> **해결 방향**: nonce 추적을 postOp으로 이전, permit 호출을 submission 전 pre-approve로 변경, 또는 staked paymaster 등록

---

## 잔여 이슈 — SDK TypeScript (99%) / SDK Go (99%)

두 SDK 공통으로 Aggregator(Section 15)가 미구현. Section 15는 선택적(Optional) 기능으로, 현재 대부분의 bundler/account 구현에서 미지원.

| 이슈 | 설명 | 스펙 참조 | SDK-TS | SDK-Go |
|------|------|----------|--------|--------|
| Aggregator 미지원 | IAggregator 인터페이스 및 handleAggregatedOps 서명 집계 모드 없음 | Section 15 (Optional) | ❌ | ❌ |

> **참고**: SDK Go의 ERC-1271 서명 검증(Section 5) 및 getSenderAddress(Section 4.2)는 구현 완료.

---

## ~~잔여 이슈~~ — Bundler 서비스 (~~97%~~ → 100% 해결 완료)

| 이슈 | 상태 | 해결 내용 |
|------|------|----------|
| ~~Reputation 비영속~~ | ✅ 해결 | `ReputationPersistence` 추가. 원자적 파일 쓰기(temp+rename), startup 시 시간 감쇠 보정 로드, 주기적 저장. 기본값 `enabled: true` |
| ~~Aggregator 검증 미통합~~ | ✅ 해결 | `UserOperationValidator` Phase 5에 `validateUserOpSignature()` 통합. `BundleExecutor`에 `separateByAggregator()`, `encodeHandleAggregatedOps()` 구현. mixed bundle 지원 |
| ~~Storage access conflict 미검출~~ | ✅ 해결 | `DependencyTracker`에 `findFactoryCollisions()` 추가 — factory CREATE2 주소 충돌 감지. `BundleExecutor.detectFactoryCollisions()`에서 번들 빌드 시 충돌 op 자동 제외. createdAddresses 인덱스 관리(recordAccess/removeAccess/clear) 포함 |

---

## ~~잔여 이슈~~ — Paymaster Proxy 서비스 (~~97%~~ → 100% 해결 완료)

| 이슈 | 상태 | 해결 내용 |
|------|------|----------|
| ~~validUntil/validAfter 검증 부재~~ | ✅ 해결 | `validateTimeRange()` 유틸리티 추가. 미래 시간, 순서, 최대/최소 윈도우 검증. Block Number Mode 상수(bit 47) 추가 |
| ~~Settlement 비영속~~ | ✅ 해결 | `ReservationPersistence` JSON 파일 기반 영속 저장소 추가. 디바운스 저장, startup 로드, graceful shutdown flush |
| ~~Deposit 자동 충전 미구현~~ | ✅ 해결 | `DepositMonitor`에 `tryAutoDeposit()` 추가. WalletClient 기반 `depositTo` 호출, 쿨다운/single-flight guard |

---

## 잔여 이슈 — Wallet SDK (~~75%~~ → 95%)

대부분의 핵심 기능이 구현 완료. end-to-end UserOp 제출 플로우를 독립적으로 완료 가능.

### 구현 현황

| 우선순위 | 이슈 | 상태 | 해결 내용 |
|---------|------|------|----------|
| **P0** | ~~Bundler RPC 클라이언트~~ | ✅ 해결 | `bundler/index.ts` — `createBundlerClient` 팩토리 re-export. 7개 표준 RPC 메서드 지원 |
| **P0** | ~~Nonce 관리~~ | ✅ 해결 | `nonce/index.ts` — `getNonce()`, `parseNonce()`, `encodeNonceKey()`. uint192 key + uint64 sequence 분리 지원 |
| **P1** | ~~Gas 추정~~ | ✅ 해결 | `gas/index.ts` — `estimateUserOperationGas()`, `createGasEstimator`, 가스 버퍼 상수 |
| **P1** | ~~Factory/Counterfactual 지원~~ | ✅ 해결 | `factory/index.ts` — `getSenderAddress()` (EntryPoint revert 파싱), `predictCounterfactualAddress()` (CREATE2) |
| **P1** | ~~Paymaster 클라이언트 통합~~ | ✅ 해결 | `paymaster/index.ts` — ERC-7677 호환 `getPaymasterStubData()`, `getPaymasterData()` RPC 래퍼 |
| **P2** | ~~ERC-1271 컨트랙트 계정~~ | ✅ 해결 | `signature/index.ts` — `verifySignature()` (EOA/ERC-1271 자동 감지), `isValidSignature()`, `isSmartContractAccount()` |
| **P2** | ~~Receipt 추적~~ | ✅ 해결 | Bundler RPC 클라이언트의 `getUserOperationReceipt()` 메서드로 지원 |
| **P2** | ~~EntryPoint 버전 추상화~~ | ✅ 해결 | `entrypoint/index.ts` — `getEntryPointVersion()`, v0.6/v0.7 주소 상수 및 타입 가드 |
| **P3** | ~~Simulation 검증~~ | ✅ 해결 | `simulation/index.ts` — `simulateValidation()`, `simulateHandleOp()`, revert 데이터 파싱 |

### 잔여 항목 (95% → 100%)

| 이슈 | 설명 |
|------|------|
| React Hooks 통합 | `useNonce`, `useGasEstimation`, `useBundler`, `usePaymaster` 등 React hooks 래퍼 (placeholder 존재, 구현 필요) |
| 통합 테스트 | 신규 모듈(bundler, nonce, gas, factory, paymaster, signature, simulation) 단위/통합 테스트 |

---

## 스펙 문서 매핑

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
| Section 15 (Aggregator) | SDK-Go, Bundler |
