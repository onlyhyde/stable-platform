# StableNet Wallet - 작업 현황

> 작성일: 2026-01-23
> 최종 업데이트: 2026-02-09
> 현재 테스트: 1,603개 Unit (wallet-extension 1,070 + sdk-ts 351 + wallet-sdk 182) + 27개 E2E
> Lint 오류: 0개 (Biome)
>
> **관련 문서**: [ARCHITECTURE.md](./ARCHITECTURE.md) - 기술 아키텍처

---

## 완료된 작업

### ✅ 기초 인프라 (177 tests)
- [x] 테스트 인프라 구축 (Jest, Chrome API mocks)
- [x] Vault 테스트 및 구현
- [x] HDKeyring / SimpleKeyring 테스트 및 구현
- [x] personal_sign RPC 구현
- [x] eth_signTypedData_v4 RPC 구현
- [x] eth_sendTransaction RPC 구현

### ✅ 아키텍처 개선 (128 tests)
- [x] TransactionController (33 tests)
- [x] PermissionController (34 tests)
- [x] NetworkController (33 tests)
- [x] ControllerMessenger (28 tests)

### ✅ 보안 강화 (125 tests)
- [x] RPC 에러 처리 표준화 (27 tests)
  - RpcError, ProviderRpcError 클래스
  - JSON-RPC 2.0, EIP-1193, EIP-1474 표준 에러 코드
- [x] 피싱 감지 시스템 (27 tests)
  - Typosquatting 감지
  - Homograph/Punycode 공격 감지
  - 의심스러운 서브도메인 감지
  - 커스텀 Blocklist/Allowlist
- [x] 서명 위험도 분석 (18 tests)
  - eth_sign 블라인드 서명 경고
  - EIP-712 typed data 파싱
  - 무제한 토큰 승인 감지
  - NFT setApprovalForAll 감지
- [x] 입력 검증 강화 (53 tests)
  - 주소 검증 (EIP-55 체크섬)
  - Hex 문자열 검증
  - Chain ID 검증
  - 트랜잭션/RPC 요청 검증
  - 문자열 새니타이징 (XSS 방지)

### ✅ 기능 확장 (133 tests)

#### GasFeeController ✅
- [x] 가스 추정 로직 (`estimateGas`)
- [x] EIP-1559 지원 (`getEIP1559GasFees`)
- [x] 가스 가격 히스토리 (`getGasPriceHistory`)
- [x] Indexer 통합 (`getHistoricalGasStats`)

#### TokenController ✅
- [x] ERC-20 토큰 추적 (`addToken`, `getTokens`)
- [x] 토큰 잔액 조회 (`getTokenBalance`, `getAllTokenBalances`)
- [x] 토큰 전송 빌드 (`buildTransferTransaction`)
- [x] Indexer 통합:
  - [x] 자동 토큰 발견 (`discoverTokens`, `autoAddTokens`)
  - [x] 전송 히스토리 (`getTransferHistory`)

#### IndexerClient ✅
- [x] GraphQL/JSON-RPC 클라이언트
- [x] Gas 통계 조회 (`getGasStats`, `getAverageGasPrice`)
- [x] 토큰 잔액 조회 (`getTokenBalances`)
- [x] 토큰 전송 조회 (`getERC20Transfers`)

### ✅ 추가 보안 개선

#### Content Script 보안 (SEC-2) ✅
- [x] localStorage 사용 제거
- [x] data attribute를 통한 설정 전달
- [x] 페이지 스크립트로부터 설정 보호

#### URL 보안 (SEC-12) ✅
- [x] Approval popup URL 인코딩 추가
- [x] URL 인젝션 공격 방지

#### HTTPS 강제 (SEC-13) ✅
- [x] `enforceHttpsRpcUrls` 플래그 추가
- [x] `validateRpcUrl()` / `assertValidRpcUrl()` 유틸리티
- [x] 프로덕션 환경 HTTPS 강제 (플래그 활성화 시)
- [x] localhost 개발 환경 예외 처리

### ✅ E2E 테스트 (27 tests)

#### Playwright 설정 ✅
- [x] Chrome extension 테스트 환경
- [x] Test fixtures (extension loading)
- [x] Page Object Models

#### 온보딩 플로우 테스트 ✅
- [x] 지갑 생성 (10 tests)
- [x] 시드 구문 백업/확인
- [x] 비밀번호 검증
- [x] 지갑 가져오기
- [x] Lock/Unlock

#### 트랜잭션 서명 테스트 ✅
- [x] dApp 연결 요청/승인/거절 (9 tests)
- [x] 트랜잭션 승인/거절
- [x] personal_sign 서명
- [x] EIP-712 typed data 서명

#### 네트워크 전환 테스트 ✅
- [x] 네트워크 표시/선택 (8 tests)
- [x] UI에서 네트워크 전환
- [x] dApp 요청으로 네트워크 전환
- [x] 새 네트워크 추가 요청

### ✅ SDK 핵심 스텁 수정 (Phase 1)
- [x] `encodeSmartAccountCall()` - Kernel v0.3.3 execute 인코딩 구현
- [x] `calculateUserOpHash()` - 기존 `getUserOperationHash()` 위임
- [x] Nonce 조회 - EntryPoint `getNonce(sender, key)` 온체인 조회
- [x] EIP-7702 `waitForConfirmation()` - `waitForReceipt` 구현

### ✅ Smart Account 대시보드 (Phase 2)
- [x] SmartAccountDashboard 페이지 (`ui/pages/SmartAccountDashboard.tsx`)
  - Smart Account 상태 카드 (배포 상태, 주소, 타입)
  - Delegation 정보 표시
  - Root Validator 표시
  - 설치된 모듈 요약 (Validator/Executor/Hook/Fallback 카운트)
  - 빠른 작업 버튼
- [x] `useSmartAccountInfo` 훅 (계정 타입, root validator, delegation 상태 조회)
- [x] `stablenet_getSmartAccountInfo` RPC 핸들러
- [x] Home 페이지에서 대시보드 연결

### ✅ ERC-7579 모듈 마켓플레이스 (Phase 3)
- [x] ModuleList 마켓플레이스 탭 ("Installed" / "Browse All" 토글)
- [x] `useModuleMarketplace` 훅 (레지스트리 전체 모듈 조회, 설치 여부 교차 참조)
- [x] `stablenet_getRegistryModules` RPC 핸들러
- [x] `useModuleInstall` 훅 (모듈 설치/제거)
- [x] `useModules` 훅 (설치된 모듈 조회)
- [x] `useModuleRegistry` 훅 (모듈 레지스트리 접근)
- [x] `useWebAuthn` 훅 (WebAuthn/PassKey 인증)
- [x] 모듈별 설정 UI:
  - [x] DelegateSetup, InstallModule, ModuleConfig
  - [x] LendingExecutorConfig, StakingExecutorConfig, SwapExecutorConfig
  - [x] WebAuthnConfig, MultiSigConfig, SessionKeyConfig
  - [x] SpendingLimitConfig, RecurringPaymentConfig

### ✅ 토큰 가격 및 스왑 UI (Phase 4)
- [x] TokenPriceService (`background/services/tokenPriceService.ts`)
  - onramp-simulator `/api/v1/rates` 엔드포인트 연동
  - 30초 TTL 캐시
- [x] `useTokenPrices` 훅 (30초 폴링, 총 USD 가치 계산)
- [x] Home 페이지 총 포트폴리오 USD 가치 표시
- [x] SwapPage (`ui/pages/SwapPage.tsx`)
  - 토큰 선택 (from/to)
  - 슬리피지 설정 (0.5%, 1%, 2%)
  - 스왑 실행 UI

### ✅ 트랜잭션 상세 + 가속/취소 (Phase 5)
- [x] TransactionDetail 페이지 (`ui/pages/TransactionDetail.tsx`)
  - 트랜잭션 해시, From/To, Value, Gas 정보
  - 상태, 타임스탬프, Block number, Confirmation count
  - UserOp hash (ERC-4337)
- [x] `stablenet_speedUpTransaction` RPC 핸들러 (10% gas 인상 교체 트랜잭션)
- [x] `stablenet_cancelTransaction` RPC 핸들러 (동일 nonce no-op 트랜잭션)
- [x] TransactionCache 서비스 (`background/services/transactionCache.ts`)
- [x] Activity 페이지 → TransactionDetail 연동
- [x] Approval 컴포넌트:
  - [x] ApprovalWarnings (트랜잭션 위험 경고)
  - [x] TransactionSimulation (트랜잭션 시뮬레이션)

### ✅ SDK Contract Hooks (Phase 6)
- [x] `useContractRead` 훅 (`packages/wallet-sdk/src/hooks/useContractRead.ts`)
  - viem `encodeFunctionData` / `decodeFunctionResult` 사용
  - `eth_call`로 실행, 결과 캐싱
- [x] `useContractWrite` 훅 (`packages/wallet-sdk/src/hooks/useContractWrite.ts`)
  - viem `encodeFunctionData`로 인코딩
  - `eth_sendTransaction`으로 전송, 가스 추정 지원
- [x] wallet-sdk export 업데이트

### ✅ OnRamp 개선 + Smart Account 설정 (Phase 7)
- [x] BuyPage KYC 상태 연동 (`/api/v1/kyc/status/:userId`)
  - KYC 상태 배너 (rejected=에러, pending=경고)
  - 주문 상태 15초 폴링
- [x] Settings Smart Account 섹션
  - 계정 타입 표시 (EOA/Delegated/Smart)
  - 배포 상태, Account ID, Delegation 정보
  - Root Validator 관리 (조회/변경)
- [x] `stablenet_setRootValidator` RPC 핸들러
- [x] GasPayment 고급 설정 (Custom maxFeePerGas, maxPriorityFeePerGas)
- [x] SupportedMethod 타입에 stablenet_* 5개 메서드 추가

---

## 보안 검토 현황

> **검토일**: 2026-01-29
> **상태**: 전체 완료 (SEC-1 ~ SEC-18)

### 해결된 이슈

| ID | 심각도 | 이슈 | 상태 |
|----|--------|------|------|
| SEC-1 | 🔴 Critical | Origin별 계정 필터링 누락 | ✅ EventBroadcaster로 해결 |
| SEC-2 | 🔴 Critical | Content Script localStorage 노출 | ✅ data attribute로 해결 |
| SEC-3 | 🔴 Critical | Origin 검증 부족 | ✅ sender.tab.url에서만 추출 |
| SEC-4 | 🟠 High | Rate Limiting 부재 | ✅ 완료 |
| SEC-5 | 🟠 High | Typed Data Domain 검증 없음 | ✅ 완료 |
| SEC-6 | 🟠 High | Session Storage 비암호화 | ✅ 완료 |
| SEC-7 | 🟠 High | RPC 입력 검증 미적용 | ✅ 완료 |
| SEC-8 | 🟠 High | Mnemonic 접근 재인증 없음 | ✅ 완료 |
| SEC-9 | 🟠 High | connect/disconnect 이벤트 | ✅ 완료 |
| SEC-10 | 🟡 Medium | 상태 Shallow Merge | ✅ deepMerge로 해결 |
| SEC-11 | 🟡 Medium | Origin 정규화 없음 | ✅ normalizeOrigin으로 해결 |
| SEC-12 | 🟡 Medium | 승인 팝업 URL 인코딩 누락 | ✅ encodeURIComponent 적용 |
| SEC-13 | 🟡 Medium | RPC URL HTTPS 강제 없음 | ✅ 설정 가능한 플래그로 구현 |
| SEC-14 | 🟡 Medium | 트랜잭션 위험 평가 불충분 | ✅ 완료 |
| SEC-15 | 🟢 Low | 에러 메시지 내부 정보 노출 | ✅ 완료 |
| SEC-16 | 🟢 Low | 감사 로깅 없음 | ✅ 완료 |
| SEC-17 | 🟢 Low | CSP 미설정 | ✅ 완료 |
| SEC-18 | 🟢 Low | 레거시 API 경고 없음 | ✅ 완료 |

---

## 남은 작업

### 🟡 품질 개선 (우선순위: Medium)

#### 신규 컴포넌트 테스트
- [x] Phase 2-7 UI 페이지 테스트 (SmartAccountDashboard 14t, SwapPage 11t, TransactionDetail 18t) ✅
- [x] Phase 2-7 훅 테스트 (useTokenPrices 7t, useSmartAccountInfo 8t, useModuleMarketplace 7t) ✅
- [x] Background 서비스 테스트 (TokenPriceService 20t, TransactionCache 12t) ✅
- [x] SDK 훅 테스트 (useContractRead 7t, useContractWrite 11t) ✅

#### 기능 완성도
- [x] BuyPage 동적 자산/체인 로딩 (onramp-simulator API 연동, fallback to defaults) ✅
- [x] ModuleDetails 미설치 모듈 상세 (RegistryModuleView: 설명, 설정 필드, 지원 체인, 설치 버튼) ✅
- [x] Home TokenList 토큰별 개별 USD 가치 표시 (tokenPrices + nativePriceUsd 전달) ✅
- [x] SwapPage DEX 모듈 연동 (`stablenet_executeSwap` RPC + UserOp 서명/제출 완료) ✅

### 🟢 추가 기능 (우선순위: Low)

#### 하드웨어 지갑 지원
- [ ] Ledger USB HID 연동
- [ ] 트랜잭션 서명 지원
- [ ] 계정 관리

#### dApp 브라우저 연동
- [ ] WalletConnect v2 지원
- [ ] Deep linking

#### 다국어 지원
- [ ] i18n 프레임워크 설정
- [ ] 한국어/영어 번역

### 🟢 인프라 개선 (우선순위: Low)

#### CI/CD
- [x] GitHub Actions 테스트 자동화 (pnpm 버전 수정, build artifact 업로드) ✅
- [ ] E2E 테스트 CI 통합 (Playwright + Chrome extension 설정 필요)
- [ ] 자동 빌드/배포

#### 문서화 ✅
- [x] API 레퍼런스 (`docs/API_REFERENCE.md`)
- [x] 아키텍처 다이어그램 (`docs/ARCHITECTURE_DIAGRAM.md`)
- [x] dApp 개발자 가이드 (`docs/DAPP_DEVELOPER_GUIDE.md`)

---

## 우선순위 매트릭스

| 작업 | 복잡도 | 영향도 | 우선순위 | 상태 |
|------|--------|--------|----------|------|
| 에러 처리 표준화 | 중 | 높음 | High | ✅ 완료 |
| 피싱 감지 | 중 | 높음 | High | ✅ 완료 |
| 서명 위험도 분석 | 중 | 높음 | High | ✅ 완료 |
| 입력 검증 강화 | 낮음 | 높음 | High | ✅ 완료 |
| SDK 핵심 스텁 수정 | 높음 | 높음 | High | ✅ 완료 |
| Smart Account 대시보드 | 중 | 높음 | High | ✅ 완료 |
| 모듈 마켓플레이스 | 중 | 높음 | High | ✅ 완료 |
| GasFeeController | 중 | 중간 | Medium | ✅ 완료 |
| 토큰 관리 | 높음 | 중간 | Medium | ✅ 완료 |
| IndexerClient | 중 | 높음 | Medium | ✅ 완료 |
| 추가 보안 개선 | 낮음 | 높음 | Medium | ✅ 완료 |
| E2E 테스트 | 중 | 중간 | Medium | ✅ 완료 |
| 토큰 가격/스왑 | 중 | 중간 | Medium | ✅ 완료 |
| TX 상세/가속/취소 | 중 | 중간 | Medium | ✅ 완료 |
| SDK Contract Hooks | 중 | 중간 | Medium | ✅ 완료 |
| OnRamp/SA 설정 | 중 | 중간 | Medium | ✅ 완료 |
| 신규 컴포넌트 테스트 | 중 | 중간 | Medium | ✅ 완료 |
| 기능 완성도 | 중 | 중간 | Medium | ✅ 완료 |
| 하드웨어 지갑 | 높음 | 낮음 | Low | 🟢 대기 |
| WalletConnect | 중 | 낮음 | Low | 🟢 대기 |
| CI/CD | 중 | 중간 | Low | 🟡 부분 완료 |
| 다국어 지원 | 중 | 낮음 | Low | 🟢 대기 |
| 문서화 | 낮음 | 중간 | Low | ✅ 완료 |

---

## 진행률

```
기초 인프라:     ████████████████████ 100%
아키텍처 개선:   ████████████████████ 100%
보안 강화:       ████████████████████ 100%
기능 확장:       ████████████████████ 100%
E2E 테스트:      ████████████████████ 100%
Smart Account:   ████████████████████ 100%
모듈 시스템:     ████████████████████ 100%
토큰/스왑:       ████████████████████ 100%
TX 관리:         ████████████████████ 100%
SDK Hooks:       ████████████████████ 100%
OnRamp/설정:     ████████████████████ 100%
```

**전체 진행률: 100% (핵심 기능 완료)**

---

## 테스트 현황

| 패키지 | 테스트 수 | Suite 수 | 상태 |
|--------|----------|----------|------|
| wallet-extension (Jest) | 1,070개 | 46 suites | ✅ 통과 |
| sdk-ts (Vitest) | 351개 | 14 suites | ✅ 통과 |
| wallet-sdk (Vitest) | 182개 | 13 suites | ✅ 통과 |
| E2E (Playwright) | 27개 | 5 specs | ✅ 작성 완료 |
| **합계** | **1,630개** | | |

### wallet-extension 테스트 (46 suites, 1,070 tests)

기초 인프라 (177), 아키텍처 (128), 보안 (125), 기능확장 (133), Phase 2-7 (507)

### sdk-ts 테스트 (14 suites, 351 tests)

RPC 클라이언트, 트랜잭션 라우터, Smart Account 전략, EIP-7702, 가스 추정, 번들러 클라이언트, 모듈 유틸, UserOperation, Circuit Breaker, 공개 API

### wallet-sdk 테스트 (13 suites, 182 tests)

useWallet, useBalance, useNetwork, useToken, useChainId, useContractRead, useContractWrite, WalletProvider, detect

### E2E 테스트 상세

```
e2e/tests/onboarding.spec.ts               - 10 tests
e2e/tests/transactions.spec.ts             - 9 tests
e2e/tests/network.spec.ts                  - 8 tests
e2e/tests/modules/install-module.spec.ts   - Module 설치 플로우
e2e/tests/send/smart-account-send.spec.ts  - Smart Account 전송
```

---

## 프로젝트 구조

```
apps/wallet-extension/
├── src/
│   ├── background/              # Service Worker
│   │   ├── controllers/         # 비즈니스 로직 컨트롤러
│   │   ├── services/            # IndexerClient, TokenPriceService, TransactionCache
│   │   ├── rpc/                 # RPC 메서드 핸들러 (stablenet_* 포함)
│   │   ├── keyring/             # HD/Simple/Hardware 키링
│   │   └── security/            # 메모리 새니타이저
│   ├── contentscript/           # Content Script (메시지 중계)
│   ├── inpage/                  # Inpage Provider (EIP-1193)
│   ├── ui/                      # React UI
│   │   ├── pages/
│   │   │   ├── Home.tsx                    # 메인 (포트폴리오 USD 가치)
│   │   │   ├── Send/                       # 전송 (GasPayment 고급설정)
│   │   │   ├── Activity.tsx                # 활동 (TX 클릭→상세)
│   │   │   ├── Settings.tsx                # 설정 (Smart Account 섹션)
│   │   │   ├── BuyPage.tsx                 # 구매 (KYC 연동)
│   │   │   ├── SmartAccountDashboard.tsx   # SA 대시보드
│   │   │   ├── SwapPage.tsx                # 토큰 스왑
│   │   │   ├── TransactionDetail.tsx       # TX 상세/가속/취소
│   │   │   └── Modules/                    # 모듈 관리
│   │   │       ├── ModuleList.tsx           # 마켓플레이스 (Installed/Browse All)
│   │   │       ├── ModuleDetails.tsx        # 모듈 상세
│   │   │       ├── InstallModule.tsx        # 설치 위저드
│   │   │       ├── DelegateSetup.tsx        # 위임 설정
│   │   │       ├── *Config.tsx              # 모듈별 설정 (8개)
│   │   │       └── hooks/                   # 모듈 훅
│   │   │           ├── useSmartAccountInfo.ts
│   │   │           ├── useModuleMarketplace.ts
│   │   │           ├── useModuleInstall.ts
│   │   │           ├── useModules.ts
│   │   │           ├── useModuleRegistry.ts
│   │   │           └── useWebAuthn.ts
│   │   └── hooks/
│   │       ├── useWalletStore.ts            # Zustand 상태 관리
│   │       ├── useTokenPrices.ts            # 토큰 가격 훅
│   │       └── useIndexerData.ts            # 인덱서 데이터 훅
│   ├── approval/                # 승인 팝업
│   │   ├── pages/               # ConnectApproval, TransactionApproval
│   │   └── components/          # ApprovalWarnings, TransactionSimulation
│   ├── shared/                  # 공유 유틸리티
│   │   ├── errors/              # WalletError
│   │   ├── security/            # memorySanitizer, originVerifier
│   │   └── validation/          # 입력 검증
│   └── config/                  # 설정 상수
├── tests/
│   ├── unit/                    # Jest 단위 테스트 (27 suites)
│   ├── integration/             # 통합 테스트 (1 suite)
│   ├── security/                # 보안 테스트 (3 suites)
│   └── utils/                   # 테스트 유틸리티/목
├── e2e/
│   ├── fixtures/                # Playwright fixtures
│   ├── pages/                   # Page Object Models
│   └── tests/                   # E2E 테스트 스펙
└── docs/
    ├── REMAINING_TASKS.md       # 이 문서
    ├── API_REFERENCE.md         # API 레퍼런스
    ├── ARCHITECTURE.md          # 아키텍처 설명
    ├── ARCHITECTURE_DIAGRAM.md  # 아키텍처 다이어그램
    ├── DAPP_DEVELOPER_GUIDE.md  # dApp 개발자 가이드
    └── DEVELOPER_GUIDE.md       # 개발자 가이드

packages/wallet-sdk/
├── src/
│   ├── hooks/
│   │   ├── useWallet.ts          # 지갑 연결/상태
│   │   ├── useBalance.ts         # 잔액 조회
│   │   ├── useNetwork.ts         # 네트워크 관리
│   │   ├── useToken.ts           # 토큰 관리
│   │   ├── useContractRead.ts    # 컨트랙트 읽기
│   │   └── useContractWrite.ts   # 컨트랙트 쓰기
│   ├── provider/                 # StableNetProvider, EIP-6963
│   └── context/                  # React Context
└── tests/
    ├── hooks/                    # 훅 테스트
    ├── provider/                 # 프로바이더 테스트
    └── setup.ts                  # 테스트 설정
```

---

## 다음 단계 제안

1. **E2E 테스트 CI 통합** - GitHub Actions에 Playwright + Chrome extension 환경 구성
2. **하드웨어 지갑** - Ledger 연동 (사용자 요구 시)
3. **WalletConnect** - 모바일 dApp 연결 지원 (사용자 요구 시)
4. **다국어 지원** - i18n 프레임워크 설정 (사용자 요구 시)

### 작성된 문서

| 문서 | 설명 |
|------|------|
| [API_REFERENCE.md](./API_REFERENCE.md) | RPC 메서드, 이벤트, 에러 코드 레퍼런스 |
| [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) | 시스템 아키텍처 다이어그램 |
| [DAPP_DEVELOPER_GUIDE.md](./DAPP_DEVELOPER_GUIDE.md) | dApp 통합 가이드 및 예제 코드 |

---

## 참고 자료

- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-1559: Fee market change](https://eips.ethereum.org/EIPS/eip-1559)
- [EIP-6963: Multi-wallet discovery](https://eips.ethereum.org/EIPS/eip-6963)
- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-7579: Minimal Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [MetaMask Extension Architecture](https://github.com/MetaMask/metamask-extension)
- [Playwright Documentation](https://playwright.dev/docs/intro)
