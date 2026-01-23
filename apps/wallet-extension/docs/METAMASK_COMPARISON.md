# StableNet Wallet vs MetaMask 비교 분석

> 작성일: 2025-01-23
> 목적: MetaMask 아키텍처와 비교하여 개선 영역 식별

## 1. 개요

### 1.1 프로젝트 비교

| 항목 | StableNet Wallet | MetaMask |
|------|------------------|----------|
| 코드베이스 크기 | ~13,500 LOC | ~500,000+ LOC |
| 컨트롤러 수 | 2-3개 | 20+ 전문 컨트롤러 |
| 테스트 커버리지 | 0% | 80%+ |
| 보안 레이어 | 기본 암호화 | LavaMoat + 다중 레이어 |
| 하드웨어 지갑 | 미지원 | Ledger, Trezor, Lattice |
| 플러그인 시스템 | 미지원 | Snaps |

### 1.2 기술 스택 비교

| 영역 | StableNet Wallet | MetaMask |
|------|------------------|----------|
| UI Framework | React 19 | React 18 |
| State Management | Zustand 5 | Redux |
| Ethereum Library | viem 2.x | ethers.js / @metamask/eth-* |
| Build Tool | Vite 6 | Webpack / LavaMoat |
| Testing | 없음 | Jest + Playwright |
| Linting | Biome | ESLint + Prettier |

## 2. 아키텍처 비교

### 2.1 컨트롤러 패턴

#### MetaMask 컨트롤러 구조
```
MetaMaskController (Orchestrator)
├── KeyringController        # 키 관리
├── TransactionController    # 트랜잭션 생명주기
├── NetworkController        # 네트워크 관리
├── PermissionController     # 권한 관리
├── PreferencesController    # 사용자 설정
├── AccountsController       # 계정 관리
├── GasFeeController         # 가스비 추정
├── TokensController         # 토큰 관리
├── PhishingController       # 피싱 감지
├── ApprovalController       # 승인 흐름
├── CurrencyRateController   # 환율 정보
├── AddressBookController    # 주소록
├── AlertController          # 알림 관리
├── OnboardingController     # 온보딩 흐름
└── ... (20+ 컨트롤러)
```

#### StableNet Wallet 현재 구조
```
background/
├── index.ts                 # 메시지 라우팅 + 상태 관리 (혼합)
├── keyring/                 # 키링 컨트롤러
│   ├── index.ts
│   ├── vault.ts
│   ├── hdKeyring.ts
│   └── simpleKeyring.ts
├── rpc/
│   └── handler.ts           # RPC 처리
├── state/
│   └── store.ts             # 상태 관리
├── controller/
│   ├── accountController.ts
│   └── networkController.ts
└── controllers/
    └── approvalController.ts
```

#### 개선 필요 사항
- [ ] 컨트롤러 분리 (Transaction, Permission, GasFee 등)
- [ ] 컨트롤러 간 Messenger 패턴 도입
- [ ] 각 컨트롤러의 단일 책임 원칙 준수

### 2.2 보안 아키텍처

#### MetaMask 보안 레이어
1. **LavaMoat**: 의존성 샌드박싱
   - 각 패키지의 전역 객체 접근 제한
   - 빌드 시 정책 적용
   - 런타임 보호

2. **SES (Secure EcmaScript)**: 프로토타입 오염 방지
   - `lockdown()` 함수로 환경 동결
   - 원시 객체 보호

3. **피싱 감지**: eth-phishing-detect
   - 실시간 도메인 검증
   - 피싱 경고 페이지

4. **서명 검증**: 위험도 분석
   - EIP-712 도메인 검증
   - 계약 시뮬레이션

#### StableNet Wallet 현재 보안
1. **암호화**: AES-256-GCM + PBKDF2 (100k iterations) ✅
2. **세션 관리**: chrome.storage.session ✅
3. **자동 잠금**: idle detection ✅
4. **의존성 보안**: 없음 ❌
5. **피싱 감지**: 없음 ❌
6. **서명 검증**: 기본적 ❌

### 2.3 상태 관리

#### MetaMask 상태 구조
```javascript
{
  metamask: {
    vault: EncryptedVault,
    keyrings: KeyringState[],
    accounts: AccountState,
    identities: IdentityMap,
    selectedAddress: Address,
    network: NetworkState,
    transactions: TransactionMap,
    tokens: TokenState,
    permissions: PermissionState,
    preferences: PreferencesState,
    // ... 50+ 상태 필드
  }
}
```

#### StableNet Wallet 상태 구조
```typescript
{
  accounts: { accounts: Account[], selectedAccount: Address | null },
  networks: { networks: Network[], selectedChainId: number },
  transactions: { pendingTransactions: [], history: [] },
  connections: { connectedSites: ConnectedSite[] },
  keyring: { isUnlocked: boolean, isInitialized: boolean },
  ui: { currentPage: Page, isLoading: boolean, error: string | null },
  isInitialized: boolean
}
```

## 3. 기능 비교

### 3.1 RPC 메서드 지원

| 메서드 | StableNet | MetaMask | 우선순위 |
|--------|-----------|----------|----------|
| eth_accounts | ✅ | ✅ | - |
| eth_requestAccounts | ✅ | ✅ | - |
| eth_chainId | ✅ | ✅ | - |
| eth_getBalance | ✅ | ✅ | - |
| eth_call | ✅ | ✅ | - |
| eth_blockNumber | ✅ | ✅ | - |
| personal_sign | ❌ TODO | ✅ | 🔴 Critical |
| eth_signTypedData_v4 | ❌ TODO | ✅ | 🔴 Critical |
| eth_sendTransaction | ❌ TODO | ✅ | 🔴 Critical |
| wallet_switchEthereumChain | ✅ | ✅ | - |
| wallet_addEthereumChain | ✅ | ✅ | - |
| wallet_watchAsset | ❌ | ✅ | 🟡 Medium |
| eth_subscribe | ❌ | ✅ | 🟡 Medium |
| eth_getTransactionReceipt | ❌ | ✅ | 🟢 Low |

### 3.2 하드웨어 지갑

| 하드웨어 | StableNet | MetaMask |
|----------|-----------|----------|
| Ledger | ❌ | ✅ |
| Trezor | ❌ | ✅ |
| Lattice1 | ❌ | ✅ |
| QR-based (Keystone) | ❌ | ✅ |

### 3.3 추가 기능

| 기능 | StableNet | MetaMask |
|------|-----------|----------|
| 토큰 관리 | ❌ | ✅ |
| NFT 표시 | ❌ | ✅ |
| 스왑 | ❌ | ✅ |
| 브릿지 | ❌ | ✅ |
| 포트폴리오 | ❌ | ✅ (Portfolio) |
| Snaps 플러그인 | ❌ | ✅ |

## 4. 테스트 비교

### 4.1 MetaMask 테스트 구조
```
test/
├── unit/           # 단위 테스트 (Jest)
├── integration/    # 통합 테스트
├── e2e/            # E2E 테스트 (Playwright)
└── stub/           # 테스트 스텁/목
```

### 4.2 StableNet Wallet 현재 상태
- 테스트 파일: **0개**
- 커버리지: **0%**

### 4.3 필수 테스트 영역
1. **Unit Tests**
   - Vault 암호화/복호화
   - Keyring 계정 생성/서명
   - RPC 핸들러 로직
   - 상태 관리

2. **Integration Tests**
   - 메시지 패싱
   - 컨트롤러 간 통신
   - 상태 동기화

3. **E2E Tests**
   - 온보딩 플로우
   - dApp 연결
   - 트랜잭션 승인

## 5. 참고 자료

- [MetaMask Extension GitHub](https://github.com/MetaMask/metamask-extension)
- [MetaMask KeyringController](https://github.com/MetaMask/KeyringController)
- [LavaMoat GitHub](https://github.com/LavaMoat/LavaMoat)
- [MetaMask Architecture (DESOSA)](https://desosa2022.netlify.app/projects/metamask/posts/essay2/)
- [MetaMask Security Reports](https://metamask.io/news/metamask-security-report-january-2025)
