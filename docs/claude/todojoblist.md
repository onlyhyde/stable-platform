# EIP-4337 스펙 준수 검토 — 잔여 이슈

작성일: 2026-02-27 | 최종 업데이트: 2026-02-27
기준 문서: `docs/claude/spec/EIP-4337_스펙표준_정리.md`

---

## 모듈별 준수 현황

| # | 프로젝트 | 경로 | 준수율 | 등급 |
|---|---------|------|-------|------|
| 1 | EntryPoint 컨트랙트 | `poc-contract/src/erc4337-entrypoint/` | 100% | A+ |
| 2 | Paymaster 컨트랙트 | `poc-contract/src/erc4337-paymaster/` | 98% | A+ |
| 3 | SmartAccount (Kernel) | `poc-contract/src/erc7579-smartaccount/` | 100% | A+ |
| 4 | SDK TypeScript | `stable-platform/packages/sdk-ts/` | 99% | A+ |
| 5 | SDK Go | `stable-platform/packages/sdk-go/` | 99% | A+ |
| 6 | Bundler 서비스 | `stable-platform/services/bundler/` | 97% | A |
| 7 | Paymaster Proxy 서비스 | `stable-platform/services/paymaster-proxy/` | 97% | A |
| 8 | Wallet SDK | `stable-platform/packages/wallet-sdk/` | 75% | B- |

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

## 잔여 이슈 — Bundler 서비스 (97%)

| 이슈 | 설명 | 스펙 참조 |
|------|------|----------|
| Storage access conflict 미검출 | 번들 내 cross-sender 저장소 접근 충돌, factory 생성 주소 충돌 감지 없음 | Section 7.3 |
| Reputation 비영속 | ReputationManager가 인메모리 전용. 재시작 시 ban/throttle 상태 및 시간 감쇠 점수 초기화 | Section 7.5 |
| Aggregator 검증 미통합 | aggregator가 포함된 UserOp 거부만 수행. IAggregator.validateSignatures 통합 없음 | Section 15 |

---

## 잔여 이슈 — Paymaster Proxy 서비스 (97%)

| 이슈 | 설명 | 스펙 참조 |
|------|------|----------|
| validUntil/validAfter 검증 부재 | 서명 생성 시 validity time-range 강제 검증 없음. Block Number Mode(bit 47 플래그) 미지원 | Section 6 |
| Settlement 비영속 | ReservationTracker가 인메모리 전용. 요청 간 정산 reconciliation 및 DB 연동 없음 | Section 6 |
| Deposit 자동 충전 미구현 | DepositMonitor가 잔액 모니터링만 수행. threshold 도달 시 자동 depositTo 트리거 없음 | Section 6 |

---

## 잔여 이슈 — Wallet SDK (75%)

가장 큰 격차. 현재 UserOperation 구성/해싱은 가능하나, **end-to-end UserOp 제출 플로우를 독립적으로 완료할 수 없음**.

### 핵심 부재 기능 (100% 달성을 위해 필요)

| 우선순위 | 이슈 | 설명 | 스펙 참조 |
|---------|------|------|----------|
| **P0** | Bundler RPC 클라이언트 | `eth_sendUserOperation`, `eth_estimateUserOperationGas`, `eth_getUserOperationReceipt` 전용 클라이언트 없음. Builder로 구성은 가능하나 제출 경로 없음 | Section 7 |
| **P0** | Nonce 관리 | EntryPoint `getNonce(sender, key)` 조회 없음. uint192 key + uint64 sequence 분리 전략 미지원. 제출 전 nonce gap 검증 없음 | Section 4.1 |
| **P1** | Gas 추정 | bundler `eth_estimateUserOperationGas` 호출 없음. calldata 크기 기반 로컬 fallback 추정 없음. paymaster gas limit 추정 없음 | Section 7.1, 13 |
| **P1** | Factory/Counterfactual 지원 | `getSenderAddress(initCode)` 호출 없음. 최초 배포 감지 및 CREATE2 주소 예측 불가 | Section 4.2 |
| **P1** | Paymaster 클라이언트 통합 | `pm_getPaymasterData`/`pm_getPaymasterStubData` 호출 없음. paymaster 타입 선택(Verifying/Sponsor/ERC20/Permit2) 및 데이터 인코딩 없음 | Section 6, ERC-7677 |
| **P2** | ERC-1271 컨트랙트 계정 | 스마트 컨트랙트 서명 검증 없음. delegation 핸들링 없음 | Section 5 |
| **P2** | Receipt 추적 | `eth_getUserOperationReceipt` 래퍼 없음. configurable timeout 기반 폴링/대기 로직 없음 | Section 7 |
| **P2** | EntryPoint 버전 추상화 | v0.6/v0.7 런타임 감지 없음. 체인별 EntryPoint 주소 레지스트리 없음 | Section 4 |
| **P3** | Simulation 검증 | 제출 전 클라이언트측 `validateUserOp` 시뮬레이션 없음 | Section 7.1 |

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
