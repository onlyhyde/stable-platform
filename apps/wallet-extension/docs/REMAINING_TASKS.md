# StableNet Wallet - 작업 현황

> 작성일: 2026-01-23
> 최종 업데이트: 2026-01-30
> 현재 테스트: 758개 Unit + 27개 E2E
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

---

## 보안 검토 현황

> **검토일**: 2026-01-29
> **상태**: Phase 0 완료, 나머지 추후 진행

### 해결된 이슈

| ID | 심각도 | 이슈 | 상태 |
|----|--------|------|------|
| SEC-1 | 🔴 Critical | Origin별 계정 필터링 누락 | ✅ EventBroadcaster로 해결 |
| SEC-2 | 🔴 Critical | Content Script localStorage 노출 | ✅ data attribute로 해결 |
| SEC-3 | 🔴 Critical | Origin 검증 부족 | ✅ sender.tab.url에서만 추출 |
| SEC-12 | 🟡 Medium | 승인 팝업 URL 인코딩 누락 | ✅ encodeURIComponent 적용 |
| SEC-13 | 🟡 Medium | RPC URL HTTPS 강제 없음 | ✅ 설정 가능한 플래그로 구현 |

### 미해결 이슈 (추후 진행)

| ID | 심각도 | 이슈 | 우선순위 |
|----|--------|------|----------|
| SEC-4 | 🟠 High | Rate Limiting 부재 | ✅ 완료 |
| SEC-5 | 🟠 High | Typed Data Domain 검증 없음 | ✅ 완료 |
| SEC-6 | 🟠 High | Session Storage 비암호화 | ✅ 완료 |
| SEC-7 | 🟠 High | RPC 입력 검증 미적용 | ✅ 완료 |
| SEC-8 | 🟠 High | Mnemonic 접근 재인증 없음 | ✅ 완료 |
| SEC-9 | 🟠 High | connect/disconnect 이벤트 | ✅ Phase 1에서 해결 |
| SEC-10 | 🟡 Medium | 상태 Shallow Merge | ✅ deepMerge로 해결 |
| SEC-11 | 🟡 Medium | Origin 정규화 없음 | ✅ normalizeOrigin으로 해결 |
| SEC-14 | 🟡 Medium | 트랜잭션 위험 평가 불충분 | ✅ 완료 |
| SEC-15 | 🟢 Low | 에러 메시지 내부 정보 노출 | ✅ 완료 |
| SEC-16 | 🟢 Low | 감사 로깅 없음 | ✅ 완료 |
| SEC-17 | 🟢 Low | CSP 미설정 | ✅ 완료 |
| SEC-18 | 🟢 Low | 레거시 API 경고 없음 | ✅ 완료 |

---

## 남은 작업

### 🟢 추가 기능 (우선순위: Low)

#### 하드웨어 지갑 지원
- [ ] Ledger USB HID 연동
- [ ] 트랜잭션 서명 지원
- [ ] 계정 관리

#### dApp 브라우저 연동
- [ ] WalletConnect v2 지원
- [ ] Deep linking

### 🟢 인프라 개선 (우선순위: Low)

#### CI/CD
- [ ] GitHub Actions 테스트 자동화
- [ ] E2E 테스트 CI 통합
- [ ] 자동 빌드/배포

#### 문서화
- [ ] API 레퍼런스
- [ ] 아키텍처 다이어그램
- [ ] dApp 개발자 가이드

---

## 우선순위 매트릭스

| 작업 | 복잡도 | 영향도 | 우선순위 | 상태 |
|------|--------|--------|----------|------|
| 에러 처리 표준화 | 중 | 높음 | High | ✅ 완료 |
| 피싱 감지 | 중 | 높음 | High | ✅ 완료 |
| 서명 위험도 분석 | 중 | 높음 | High | ✅ 완료 |
| 입력 검증 강화 | 낮음 | 높음 | High | ✅ 완료 |
| GasFeeController | 중 | 중간 | Medium | ✅ 완료 |
| 토큰 관리 | 높음 | 중간 | Medium | ✅ 완료 |
| IndexerClient | 중 | 높음 | Medium | ✅ 완료 |
| 추가 보안 개선 | 낮음 | 높음 | Medium | ✅ 완료 |
| E2E 테스트 | 중 | 중간 | Medium | ✅ 완료 |
| 하드웨어 지갑 | 높음 | 낮음 | Low | 🟢 대기 |
| WalletConnect | 중 | 낮음 | Low | 🟢 대기 |
| CI/CD | 중 | 중간 | Low | 🟢 대기 |

---

## 진행률

```
기초 인프라:     ████████████████████ 100%
아키텍처 개선:   ████████████████████ 100%
보안 강화:       ████████████████████ 100%
기능 확장:       ████████████████████ 100%
E2E 테스트:      ████████████████████ 100%
```

**전체 진행률: 100% (핵심 기능 완료)**

---

## 테스트 현황

| 카테고리 | 테스트 수 | 상태 |
|----------|----------|------|
| Unit Tests | 758개 | ✅ 통과 |
| E2E Tests | 27개 | ✅ 작성 완료 |
| **합계** | **785개** | |

### Unit 테스트 상세

```
PASS tests/unit/inpage/provider.test.ts
PASS tests/unit/keyring/simpleKeyring.test.ts
PASS tests/unit/security/inputValidator.test.ts
PASS tests/unit/rpc/sendTransaction.test.ts
PASS tests/unit/rpc/signTypedData.test.ts
PASS tests/unit/controllers/tokenController.test.ts
PASS tests/unit/state/utils.test.ts
PASS tests/unit/controllers/transactionController.test.ts
PASS tests/unit/controllers/gasFeeController.test.ts
PASS tests/unit/rpc/personalSign.test.ts
PASS tests/unit/controllers/controllerMessenger.test.ts
PASS tests/unit/controllers/permissionController.test.ts
PASS tests/unit/setup.test.ts
PASS tests/unit/controllers/networkController.test.ts
PASS tests/unit/security/phishingDetector.test.ts
PASS tests/unit/security/signatureRiskAnalyzer.test.ts
PASS tests/unit/security/rateLimiter.test.ts
PASS tests/unit/security/typedDataValidator.test.ts
PASS tests/unit/errors/rpcErrors.test.ts
PASS tests/unit/utils/eventBroadcaster.test.ts
PASS tests/unit/keyring/hdKeyring.test.ts
PASS tests/unit/keyring/vault.test.ts
PASS tests/unit/keyring/sessionCrypto.test.ts
PASS tests/unit/security/transactionRiskAnalyzer.test.ts
PASS tests/unit/security/errorSanitizer.test.ts
PASS tests/unit/security/auditLogger.test.ts
PASS tests/unit/security/legacyApiWarning.test.ts

Test Suites: 27 passed, 27 total
Tests:       758 passed, 758 total
```

### E2E 테스트 상세

```
e2e/tests/onboarding.spec.ts  - 10 tests
e2e/tests/transactions.spec.ts - 9 tests
e2e/tests/network.spec.ts     - 8 tests
```

---

## 프로젝트 구조

```
apps/wallet-extension/
├── src/
│   ├── background/          # Service Worker
│   │   ├── controllers/     # 비즈니스 로직 컨트롤러
│   │   ├── services/        # IndexerClient 등 외부 서비스
│   │   └── rpc/             # RPC 메서드 핸들러
│   ├── contentscript/       # Content Script (메시지 중계)
│   ├── inpage/              # Inpage Provider (EIP-1193)
│   ├── ui/                  # React UI
│   ├── approval/            # 승인 팝업
│   ├── shared/              # 공유 유틸리티
│   └── config/              # 설정 상수
├── tests/
│   └── unit/                # Jest 단위 테스트
├── e2e/
│   ├── fixtures/            # Playwright fixtures
│   ├── pages/               # Page Object Models
│   └── tests/               # E2E 테스트 스펙
└── docs/
    └── REMAINING_TASKS.md   # 이 문서
```

---

## 다음 단계 제안

1. **CI/CD 구축** - GitHub Actions로 테스트/빌드 자동화
2. **문서화** - API 레퍼런스 및 개발자 가이드 작성
3. **하드웨어 지갑** - Ledger 연동 (사용자 요구 시)
4. **WalletConnect** - 모바일 dApp 연결 지원 (사용자 요구 시)

---

## 참고 자료

- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [EIP-1559: Fee market change](https://eips.ethereum.org/EIPS/eip-1559)
- [EIP-6963: Multi-wallet discovery](https://eips.ethereum.org/EIPS/eip-6963)
- [MetaMask Extension Architecture](https://github.com/MetaMask/metamask-extension)
- [Playwright Documentation](https://playwright.dev/docs/intro)
