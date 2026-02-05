# 20. Integration Checklist

## Overview

Multi-mode Transaction System과 Modular Smart Account 구현의 통합 체크리스트입니다.

---

## Documentation Review Status

### Review Summary

| Review | Date | Status | Notes |
|--------|------|--------|-------|
| 1차 검토 | 2026-02-04 | ✅ 완료 | bytes4[] 타입 누락 수정 |
| 2차 검토 | 2026-02-04 | ✅ 완료 | 미사용 import 제거 |
| 구현 진행 | 2026-02-05 | ✅ 완료 | Document 01-20 구현 완료 |

### Document Status (20개 문서)

| Phase | Document | Design | Review |
|-------|----------|--------|--------|
| 1 | 01-TYPES-DEFINITION.md | ✅ | ✅ |
| 1 | 02-EOA-TRANSACTION.md | ✅ | ✅ |
| 1 | 03-EIP7702-TRANSACTION.md | ✅ | ✅ |
| 1 | 04-GAS-ESTIMATOR.md | ✅ | ✅ |
| 1 | 05-TRANSACTION-ROUTER.md | ✅ | ✅ |
| 1 | 06-PAYMASTER-CLIENT.md | ✅ | ✅ |
| 2 | 07-MODULE-TYPES.md | ✅ | ✅ (수정됨: bytes4[] 추가) |
| 2 | 08-MODULE-REGISTRY.md | ✅ | ✅ |
| 2 | 09-MODULE-CLIENT.md | ✅ | ✅ |
| 2 | 10-CONTRACT-ABIS.md | ✅ | ✅ |
| 3 | 11-VALIDATOR-UTILS.md | ✅ | ✅ |
| 3 | 12-EXECUTOR-UTILS.md | ✅ | ✅ |
| 3 | 13-HOOK-UTILS.md | ✅ | ✅ |
| 3 | 14-FALLBACK-UTILS.md | ✅ | ✅ |
| 4 | 15-UI-SEND-PAGE.md | ✅ | ✅ |
| 4 | 16-UI-TRANSACTION-MODE.md | ✅ | ✅ (수정됨: 미사용 import 제거) |
| 4 | 17-UI-GAS-PAYMENT.md | ✅ | ✅ |
| 4 | 18-UI-MODULE-MANAGEMENT.md | ✅ | ✅ |
| 5 | 19-TESTING-STRATEGY.md | ✅ | ✅ |
| 5 | 20-INTEGRATION-CHECKLIST.md | ✅ | ✅ |

### Review Findings

| 문서 | 발견된 이슈 | 조치 |
|------|------------|------|
| 07-MODULE-TYPES.md | SolidityType에 bytes4[] 누락 | ✅ 추가 완료 |
| 16-UI-TRANSACTION-MODE.md | getModuleTypeName 미사용 import | ✅ 제거 완료 |

---

## Phase 1: Core Infrastructure

### 1.1 Types Definition (01-TYPES-DEFINITION.md)

| Task | Status | Notes |
|------|--------|-------|
| `TRANSACTION_MODE` const 정의 | ✅ | eoa, eip7702, smartAccount |
| `GAS_PAYMENT_TYPE` const 정의 | ✅ | sponsor, native, erc20 |
| `MultiModeTransactionRequest` 인터페이스 | ✅ | |
| `GasEstimate` 인터페이스 | ✅ | Smart Account 필드 포함 |
| `TransactionResult` 인터페이스 | ✅ | |
| `Account` 타입 확장 | ✅ | delegateAddress, installedModules |
| Type guards 함수 구현 | ✅ | isEOAMode, isSmartAccountMode 등 |
| 기존 코드 호환성 확인 | ✅ | |

### 1.2 EOA Transaction (02-EOA-TRANSACTION.md)

| Task | Status | Notes |
|------|--------|-------|
| `createEOATransactionBuilder` 함수 | ✅ | |
| Gas estimation 구현 | ✅ | EIP-1559 지원 |
| Nonce management | ✅ | |
| Transaction signing interface | ✅ | |
| Error handling | ✅ | 구체적 에러 코드 |
| Unit tests | ☐ | 80% coverage |

### 1.3 EIP-7702 Transaction (03-EIP7702-TRANSACTION.md)

| Task | Status | Notes |
|------|--------|-------|
| `createEIP7702TransactionBuilder` 함수 | ✅ | |
| Authorization hash 생성 | ✅ | |
| Signed authorization 구조 | ✅ | |
| Delegation 빌드 | ✅ | |
| Revocation 빌드 | ✅ | ZERO_ADDRESS 사용 |
| Delegation status 확인 | ✅ | 0xef0100 prefix |
| Unit tests | ☐ | |

### 1.4 Gas Estimator (04-GAS-ESTIMATOR.md)

| Task | Status | Notes |
|------|--------|-------|
| `createGasEstimator` 함수 | ✅ | |
| EOA gas estimation | ✅ | |
| EIP-7702 gas estimation | ✅ | Authorization overhead |
| Smart Account gas estimation | ✅ | UserOp gas fields |
| Gas price fetching | ✅ | EIP-1559 |
| Mode comparison utility | ✅ | estimateAllModes |
| Unit tests | ☐ | |

### 1.5 Transaction Router (05-TRANSACTION-ROUTER.md)

| Task | Status | Notes |
|------|--------|-------|
| `createTransactionRouter` 함수 | ✅ | |
| Mode validation | ✅ | Account type별 |
| Mode resolution | ✅ | Default mode logic |
| Transaction preparation | ✅ | |
| Transaction execution | ✅ | 모드별 분기 |
| UserOperation building | ✅ | |
| Bundler integration | ✅ | |
| Integration tests | ☐ | |

### 1.6 Paymaster Client (06-PAYMASTER-CLIENT.md)

| Task | Status | Notes |
|------|--------|-------|
| `createPaymasterClient` 함수 | ✅ | |
| Sponsor policy check | ✅ | |
| Sponsored paymaster data | ✅ | |
| Supported tokens list | ✅ | |
| ERC20 payment estimation | ✅ | |
| ERC20 paymaster data | ✅ | |
| Retry logic | ✅ | |
| Timeout handling | ✅ | |
| Unit tests | ☐ | |

---

## Phase 2: Module System

### 2.1 Module Types (07-MODULE-TYPES.md)

| Task | Status | Notes |
|------|--------|-------|
| `MODULE_TYPE` const 정의 | ✅ | 6가지 타입 |
| `ModuleMetadata` 인터페이스 | ✅ | |
| `ModuleConfigSchema` 인터페이스 | ✅ | |
| `InstalledModule` 인터페이스 | ✅ | |
| `SolidityType` 정의 | ✅ | bytes4[] 포함 |
| Validator config types | ✅ | ECDSA, WebAuthn, MultiSig |
| Executor config types | ✅ | SessionKey, RecurringPayment |
| Hook config types | ✅ | SpendingLimit, Audit |
| Type guards | ✅ | isValidator, isExecutor 등 |

### 2.2 Module Registry (08-MODULE-REGISTRY.md)

| Task | Status | Notes |
|------|--------|-------|
| `createModuleRegistry` 함수 | ✅ | |
| Built-in module definitions | ✅ | 7개 모듈 |
| Chain별 주소 매핑 | ✅ | |
| Module search/filter | ✅ | |
| Configuration validation | ✅ | |
| Type별 그룹핑 | ✅ | |
| Custom module 지원 | ✅ | |
| Unit tests | ☐ | |

### 2.3 Module Client (09-MODULE-CLIENT.md)

| Task | Status | Notes |
|------|--------|-------|
| `createModuleClient` 함수 | ✅ | |
| `isModuleInstalled` 체크 | ✅ | |
| `getInstalledModules` 조회 | ✅ | |
| `prepareInstall` calldata | ✅ | |
| `prepareUninstall` calldata | ✅ | |
| Batch operations | ✅ | |
| Validation | ✅ | |
| Init data encoding helpers | ✅ | |
| Integration tests | ☐ | |

### 2.4 Contract ABIs (10-CONTRACT-ABIS.md)

| Task | Status | Notes |
|------|--------|-------|
| Kernel ABI | ✅ | Module management, execution |
| Entry Point ABI | ✅ | v0.7 |
| ECDSA Validator ABI | ✅ | |
| WebAuthn Validator ABI | ✅ | |
| MultiSig Validator ABI | ✅ | |
| Spending Limit Hook ABI | ✅ | |
| Export structure | ✅ | |

---

## Phase 3: Module Utilities

### 3.1 Validator Utils (11-VALIDATOR-UTILS.md)

| Task | Status | Notes |
|------|--------|-------|
| ECDSA init encoding | ✅ | |
| ECDSA validation | ✅ | |
| WebAuthn init encoding | ✅ | |
| WebAuthn signature encoding | ✅ | Malleability fix (P256_N / 2n) |
| WebAuthn credential parsing | ✅ | |
| MultiSig init encoding | ✅ | |
| MultiSig validation | ✅ | Duplicate check |
| Unit tests | ✅ | validatorUtils.test.ts |

### 3.2 Executor Utils (12-EXECUTOR-UTILS.md)

| Task | Status | Notes |
|------|--------|-------|
| Session Key init encoding | ✅ | |
| Session Key validation | ✅ | Time bounds |
| Permission checking | ✅ | |
| Recurring Payment init encoding | ✅ | |
| Recurring Payment validation | ✅ | |
| Payment status calculation | ✅ | |
| Batch execution encoding | ✅ | |
| Unit tests | ☐ | |

### 3.3 Hook Utils (13-HOOK-UTILS.md)

| Task | Status | Notes |
|------|--------|-------|
| Spending Limit init encoding | ✅ | |
| Spending Limit validation | ✅ | |
| Limit status calculation | ✅ | |
| Exceed check | ✅ | |
| Formatted display | ✅ | |
| Audit Hook encoding | ✅ | |
| Period presets | ✅ | HOURLY, DAILY, WEEKLY, MONTHLY |
| Unit tests | ☐ | |

### 3.4 Fallback Utils (14-FALLBACK-UTILS.md)

| Task | Status | Notes |
|------|--------|-------|
| Token Receiver init encoding | ✅ | |
| Token Receiver validation | ✅ | |
| Interface ID constants | ✅ | ERC721, ERC1155, ERC777 |
| Flash Loan init encoding | ✅ | |
| Flash Loan validation | ✅ | |
| Authorization check | ✅ | |
| Unit tests | ☐ | |

---

## Phase 4: UI Components

### 4.1 Send Page (15-UI-SEND-PAGE.md)

| Task | Status | Notes |
|------|--------|-------|
| Multi-mode 리팩토링 | ✅ | |
| `useSendTransaction` hook | ✅ | |
| `useGasEstimate` hook | ✅ | |
| Form validation | ✅ | |
| Mode selector 통합 | ✅ | |
| Gas payment 통합 | ✅ | |
| Confirmation modal | ✅ | |
| Error handling | ✅ | |
| E2E tests | ✅ | SendPage.ts, smart-account-send.spec.ts |

### 4.2 Transaction Mode UI (16-UI-TRANSACTION-MODE.md)

| Task | Status | Notes |
|------|--------|-------|
| `TransactionModeSelector` 컴포넌트 | ✅ | |
| Mode cards with descriptions | ✅ | |
| Account type filtering | ✅ | |
| Setup prompt (EOA → Smart) | ✅ | |
| Compact selector variant | ✅ | |
| Mode comparison table | ✅ | |
| Accessibility (aria) | ✅ | |
| Unit tests | ☐ | |

### 4.3 Gas Payment UI (17-UI-GAS-PAYMENT.md)

| Task | Status | Notes |
|------|--------|-------|
| `GasPaymentSelector` 컴포넌트 | ✅ | |
| Native payment option | ✅ | |
| Sponsor payment option | ✅ | |
| ERC20 payment options | ✅ | |
| `usePaymasterClient` hook | ✅ | |
| Sponsor policy display | ✅ | |
| Token balance check | ✅ | |
| Insufficient balance warning | ✅ | |
| Unit tests | ☐ | |

### 4.4 Module Management UI (18-UI-MODULE-MANAGEMENT.md)

| Task | Status | Notes |
|------|--------|-------|
| Modules page | ✅ | |
| Module list 컴포넌트 | ✅ | |
| Module details 컴포넌트 | ✅ | |
| Install wizard | ✅ | 4단계 |
| Module config form | ✅ | |
| `useModules` hook | ✅ | |
| `useModuleInstall` hook | ✅ | |
| E2E tests | ✅ | ModulesPage.ts, install-module.spec.ts |

---

## Phase 5: Testing & Integration

### 5.1 Testing (19-TESTING-STRATEGY.md)

| Task | Status | Notes |
|------|--------|-------|
| Unit test setup (Vitest) | ✅ | vitest.config.ts |
| Integration test setup | ☐ | |
| E2E test setup (Playwright) | ✅ | playwright.config.ts, fixtures |
| Coverage configuration | ✅ | 80% minimum |
| CI/CD integration | ☐ | GitHub Actions |
| Test fixtures | ✅ | extension.ts helpers |

### 5.2 Final Integration

| Task | Status | Notes |
|------|--------|-------|
| Package exports 정리 | ✅ | @stablenet/core, @stablenet/types |
| wallet-extension 통합 | ✅ | |
| Background service 업데이트 | ✅ | |
| RPC handler 업데이트 | ✅ | |
| State management 업데이트 | ✅ | useWalletStore |
| Documentation | ✅ | docs/wallet-sdk/ |
| Performance testing | ☐ | |
| Security review | ☐ | |

---

## Pre-Release Checklist

### Code Quality

- [x] TypeScript strict mode 통과
- [x] ESLint 에러 없음
- [x] Prettier 포맷팅 완료
- [x] 중복 코드 제거
- [x] Magic numbers → constants
- [x] Error messages 명확화

### Testing

- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests 통과
- [x] E2E critical paths 100%
- [x] Cross-browser testing (Chrome)
- [ ] Network failure scenarios

### Security

- [ ] Input validation 검토
- [ ] Private key handling 검토
- [ ] RPC request validation
- [ ] Origin 검증
- [ ] Error message 정보 노출 검토

### Performance

- [ ] Bundle size 확인
- [ ] Gas estimation 정확도
- [ ] API response time
- [ ] UI responsiveness

### Documentation

- [x] API documentation
- [x] Usage examples
- [ ] Migration guide (기존 사용자)
- [ ] Changelog

---

## Deployment Checklist

### Pre-Deployment

- [ ] 모든 테스트 통과
- [ ] Staging 환경 테스트
- [ ] Version bump
- [ ] Changelog 업데이트

### Deployment

- [ ] Package publish (@stablenet/core, @stablenet/types)
- [ ] Extension build
- [ ] Chrome Web Store 제출

### Post-Deployment

- [ ] Production 동작 확인
- [ ] 모니터링 설정
- [ ] 에러 트래킹 확인
- [ ] 사용자 피드백 채널

---

## Implementation Priority

### Priority 1 (Critical Path)

1. **01-TYPES-DEFINITION** - 모든 모듈의 기반
2. **07-MODULE-TYPES** - 모듈 시스템의 기반
3. **02-EOA-TRANSACTION** - 기본 트랜잭션
4. **10-CONTRACT-ABIS** - 컨트랙트 통신 필수

### Priority 2 (Core Features)

5. **03-EIP7702-TRANSACTION** - Smart Account 전환
6. **04-GAS-ESTIMATOR** - UX 필수
7. **05-TRANSACTION-ROUTER** - 통합 레이어
8. **06-PAYMASTER-CLIENT** - 가스 대납

### Priority 3 (Module System)

9. **08-MODULE-REGISTRY** - 모듈 관리
10. **09-MODULE-CLIENT** - 모듈 설치/제거
11. **11-VALIDATOR-UTILS** - 검증자 모듈
12. **12-EXECUTOR-UTILS** - 실행자 모듈

### Priority 4 (Advanced Features)

13. **13-HOOK-UTILS** - 훅 모듈
14. **14-FALLBACK-UTILS** - 폴백 모듈

### Priority 5 (UI)

15. **15-UI-SEND-PAGE** - 메인 송금 페이지
16. **16-UI-TRANSACTION-MODE** - 모드 선택
17. **17-UI-GAS-PAYMENT** - 가스 지불 선택
18. **18-UI-MODULE-MANAGEMENT** - 모듈 관리 UI

### Priority 6 (Quality)

19. **19-TESTING-STRATEGY** - 테스트
20. **20-INTEGRATION-CHECKLIST** - 최종 통합

---

## Contact Points

| Role | Responsibility |
|------|---------------|
| Frontend | UI Components (15-18) |
| Backend | Transaction Router, Gas Estimator |
| Smart Contract | Module ABIs, Contracts |
| DevOps | CI/CD, Deployment |
| QA | E2E Testing |

---

## Timeline Reference

| Phase | Documents | Duration | Dependency |
|-------|-----------|----------|------------|
| Phase 1 | 01-06 | Week 1-2 | - |
| Phase 2 | 07-10 | Week 2-3 | Phase 1 완료 |
| Phase 3 | 11-14 | Week 3-4 | Phase 2 완료 |
| Phase 4 | 15-18 | Week 4-5 | Phase 1-3 완료 |
| Phase 5 | 19-20 | Week 5-6 | Phase 4 완료 |

---

## Notes

- 각 Phase는 이전 Phase 완료 후 시작
- Unit tests는 해당 기능 구현과 동시 진행
- E2E tests는 UI 구현 완료 후 진행
- Security review는 Phase 4 이후 별도 진행
- **문서 검토 완료**: 모든 설계 문서가 검토되어 구현 준비 완료
