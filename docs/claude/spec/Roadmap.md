# 잔여 작업 로드맵

작성일: 2026-02-28
최종 갱신: 2026-03-02
출처: EIP-4337/EIP-7579 감사 후 잔존 항목

> CRITICAL 이슈 5건 전체 해결 완료 (2026-03-01)
> **EIP-7579 전체 완료** — 68항목 중 67건 준수(99%), 1건 비구현(MAY 허용). 잔여 작업은 EIP-4337 + 통합 이슈 1건.

---

## EIP-4337/7579 통합

### 0. TokenReceiverFallback 셀렉터 충돌 (IMPLEMENTATION BUG)

출처: `EIP-4337_7579_통합_스펙준수_보고서.md` §6.3 (P0-4)

Kernel.sol에 `onERC721Received`, `onERC1155Received`, `onERC1155BatchReceived`가 explicit `pure` 함수로 정의되어 있어, Solidity 함수 매칭 규칙에 의해 fallback 경로보다 항상 우선 실행된다. TokenReceiverFallback 모듈을 설치해도 ERC-721/1155 수신 시 Kernel의 내장 함수가 실행되어, 모듈의 화이트리스트/블랙리스트/로깅 기능이 동작하지 않는다.

| 우선순위 | 항목 | 파일 | 수정 옵션 |
|---------|------|------|----------|
| HIGH | Kernel 내장 토큰 수신 함수 vs TokenReceiverFallback 충돌 | `Kernel.sol:242-256` | (A) 내장 함수 제거, fallback 모듈로 대체 (B) 내장 함수에서 fallback 모듈 설치 여부 확인 후 위임 (C) TokenReceiverFallback을 ERC-777 전용으로 축소 |

---

## EIP-4337

### 1. Public Mempool 전환 시 필수 (BUNDLER COMPAT)

현재 trusted bundler 전제로 운영 중. Public mempool 지원 시 아래 4건 수정 필요.

위협 모델: 시뮬레이션(오프체인, 가스 무료)과 온체인 `handleOps()` 실행 사이에 외부 상태가 변경되면, 번들러가 온체인 트랜잭션 가스를 손해본다. Section 7.1 제약은 이 시뮬레이션↔온체인 결과 일관성을 보장하기 위한 것이다.

| 우선순위 | 항목 | 파일 | 수정 방향 |
|---------|------|------|----------|
| CRITICAL | Permit2 `permit()` validation 단계 호출 | `Permit2Paymaster.sol:239` | permit을 postOp으로 이동 또는 사전 approve 방식 |
| HIGH | `senderNonce++` validation 단계 상태 변경 | `VerifyingPaymaster.sol:147`, `SponsorPaymaster.sol:139` | nonce 증가를 postOp으로 이전 |
| MEDIUM | ERC-20 `balanceOf`/`allowance` validation 외부 읽기 | `ERC20Paymaster.sol:226-234` | staked paymaster 등록 또는 associated storage 한정 |
| MEDIUM | postOp revert → paymaster 가스 손실 | `ERC20Paymaster.sol:275-278` | validation 단계 pre-charge 또는 postOp 실패 시 채권 기록 |

### 2. 기능 개선 (선택적)

| 우선순위 | 항목 | 파일 | 설명 |
|---------|------|------|------|
| LOW | ERC20Paymaster 가격 상한 검증 | `ERC20Paymaster.sol:159` | 토큰 가격에 대한 상한/하한 검증 로직 추가 |
| LOW | Paymaster Proxy 비표준 `reservationId` 필드 | `types/index.ts:243` | ERC-7677 표준 외 필드. 기능 영향 없으나 정리 가능 |
| ~~LOW~~ | ~~`MIN_DEPOSIT` 상수 미사용~~ | ~~`BasePaymaster.sol:23`~~ | ✅ **완료** (2026-03-01) — `deposit()` 함수(line 142)에서 `MIN_DEPOSIT` 강제 체크 구현됨. `msg.value < MIN_DEPOSIT`이면 `InsufficientDeposit` revert |

### 3. Wallet SDK 완성 (95% → 100%)

| 항목 | 설명 |
|------|------|
| ~~React Hooks 통합~~ | ✅ **완료** (2026-03-01) — `useNonce`, `useGasEstimation`, `useBundler`, `usePaymaster` 4개 훅 구현 완료. 각 훅별 단위 테스트 포함. `packages/wallet-sdk/src/hooks/` |
| 통합 테스트 | bundler, nonce, gas, factory, paymaster, signature, simulation 모듈별 단위 테스트는 완료. 크로스 모듈 통합 테스트(전체 UserOp 플로우 등) 미구현 |

### 4. 참고 — 설계 선택 (변경 불필요)

| 항목 | 근거 |
|------|------|
| EntryPoint transient storage (EIP-1153) | Cancun 이후 체인 전용. v0.9 의도된 선택 |
| 비표준 EIP-712 도메인 (entryPoint+paymaster) | 의도된 편차 |
| postOp 비례 계산 토큰 정산 (최소 1토큰) | 설계 선택 |
| SDK Aggregator (Section 15) 미지원 | Optional 스펙. 현재 불필요 |

---

## EIP-7579 — 전체 완료 (2026-03-01)

출처: `EIP-7579_컨트랙트_준수_감사표.md` (14차 갱신)
최종 결과: **68항목 중 67건 준수(99%), 1건 비구현(MAY 허용)**
수정 상세: `EIP-7579_미해결_항목_수정계획.md` 참조

### 5. ~~보안 강화~~ — 전체 완료

감사에서 지적된 보안 4건을 Phase 2~3에서 수정 완료.

| 항목 | 완료일 | 구현 내용 |
|------|--------|----------|
| ~~delegatecall 대상 검증~~ | 2026-03-01 | `DelegatecallWhitelistStorage` + `_checkDelegatecallTarget()`. `fallback()`, `execute()`, `executeFromExecutor()` 3개 실행 경로에 적용. opt-in (`enforceWhitelist` 기본값 false) |
| ~~onInstall/onUninstall 재진입 방어~~ | 2026-03-01 | `nonReentrantModuleOp` modifier — EIP-1153 transient storage. `installModule`, `uninstallModule`, `forceUninstallModule`, `installValidations`, `uninstallValidation` 5개 함수에 적용 |
| ~~Hook DoS 방어~~ | 2026-03-01 | `HookGasLimitStorage` + per-hook gas limit. `_doPreHook()` / `_doPostHook()`에서 `gasLimit > 0`이면 `{gas: limit}` 적용. opt-in (기본값 0 = 무제한) |
| ~~단일 타입 모듈 교체 시 잔여 상태~~ | 2026-03-01 | `replaceModule()` 원자적 교체 함수 추가. VALIDATOR/EXECUTOR/FALLBACK 지원. old module onUninstall 실패 또는 new module onInstall 실패 시 전체 revert |

### 6. ~~Fallback 모듈 수정~~ — 전체 완료

| 항목 | 완료일 | 구현 내용 |
|------|--------|----------|
| ~~Fallback auth control 미사용~~ | 2026-03-01 | 코드 검증 결과, 모든 콜백이 `_extractContext()` → `_validateProtocol()` / `_validateAndLogTransfer()`로 sender 인가를 이미 수행 중이었음. 미사용 dead code `_extractMsgSender()`를 삭제하여 정리 완료 |
| ~~installModule/uninstallModule 모듈별 hook~~ | 2026-03-01 | `_extractModuleHook()` + `_isActiveHook()` 헬퍼 추가. `uninstallModule`, `forceUninstallModule`, `replaceModule` 3개 함수에서 per-module preCheck/postCheck 호출 |

### 7. ~~코드 정리 및 확인~~ — 전체 완료

| 항목 | 완료일 | 구현 내용 |
|------|--------|----------|
| ~~`accountId()` semver 형식~~ | 2026-03-01 | `"kernel.advanced.v0.3.3"` → `"kernel.advanced.0.3.3"`. 테스트 assertion 동기화 |
| ~~Plugin lifecycle 실질 초기화 로직 부재~~ | 2026-03-01 | 의도된 설계(lazy initialization)로 확인. 3개 Plugin에 `@dev BY DESIGN` NatSpec 추가 |
| ~~dead code 제거~~ | 2026-03-01 | `ModuleOnUninstallFailed` error는 2단계 uninstall 도입으로 재활용됨 (3곳에서 active usage). `_extractMsgSender()` dead code는 2개 파일에서 삭제 |

### 8. 참고 — 설계 선택 (변경 불필요)

| 항목 | 근거 |
|------|------|
| Policy(5), Signer(6), Permission 기반 Validation | ERC-7579 확장 허용 범위 내 |
| Validator의 Hook 겸용 설계 (ECDSA, MultiChain) | 다중 타입 모듈 허용 |
| ERC-165 비구현 | MAY이므로 허용. `supportsModule()` + `isModuleInstalled()`로 discovery 제공 |
| 도메인 특화 executor/plugin 비즈니스 로직 | 스펙 외 확장 |
