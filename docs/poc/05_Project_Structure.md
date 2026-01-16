# StableNet PoC 프로젝트 구조

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 모노레포 구조 개요

```
stable-platform/
├── .github/                      # GitHub 설정
│   ├── workflows/                # CI/CD 워크플로우
│   │   ├── contracts.yml         # 컨트랙트 테스트/배포
│   │   ├── backend.yml           # 백엔드 서비스 테스트/배포
│   │   ├── frontend.yml          # 프론트엔드 빌드/배포
│   │   └── e2e.yml               # E2E 테스트
│   └── CODEOWNERS                # 코드 리뷰어 설정
│
├── packages/                     # 공유 패키지
│   ├── contracts/                # 스마트 컨트랙트 (Foundry)
│   ├── sdk/                      # TypeScript SDK
│   ├── types/                    # 공통 타입 정의
│   └── config/                   # 공유 설정
│
├── apps/                         # 애플리케이션
│   ├── wallet-extension/         # Chrome Extension Wallet
│   ├── payment-dapp/             # 결제 dApp
│   ├── defi-dapp/                # DeFi dApp
│   ├── enterprise-dapp/          # Enterprise dApp
│   └── marketplace/              # Module Marketplace
│
├── services/                     # 백엔드 서비스
│   ├── bundler/                  # ERC-4337 Bundler
│   ├── stealth-server/           # Stealth Address Server (Rust)
│   ├── paymaster-proxy/          # ERC-7677 Proxy
│   ├── order-router/             # Smart Order Router
│   ├── subscription-executor/    # 정기 결제 실행기
│   └── bridge-relayer/           # Bridge Relayer
│
├── simulators/                   # 외부 시스템 시뮬레이터
│   ├── bank/                     # 은행 API 시뮬레이터
│   ├── pg/                       # PG사 시뮬레이터
│   └── onramp/                   # On-Ramp 시뮬레이터
│
├── infra/                        # 인프라 설정
│   ├── docker/                   # Docker 설정
│   ├── k8s/                      # Kubernetes 매니페스트
│   └── terraform/                # IaC (선택적)
│
├── docs/                         # 문서
│   ├── poc/                      # PoC 문서
│   ├── prd/                      # PRD 문서
│   ├── api/                      # API 문서
│   └── guides/                   # 가이드
│
├── scripts/                      # 유틸리티 스크립트
│   ├── deploy/                   # 배포 스크립트
│   ├── setup/                    # 환경 설정
│   └── test/                     # 테스트 헬퍼
│
├── package.json                  # 루트 package.json (pnpm workspace)
├── pnpm-workspace.yaml           # pnpm 워크스페이스 설정
├── turbo.json                    # Turborepo 설정
├── .env.example                  # 환경변수 예시
└── README.md                     # 프로젝트 README
```

---

## 2. Smart Contracts (packages/contracts)

```
packages/contracts/
├── foundry.toml                  # Foundry 설정
├── remappings.txt                # 임포트 매핑
│
├── src/
│   ├── core/                     # Core 컨트랙트
│   │   ├── EntryPoint.sol        # ERC-4337 EntryPoint v0.7
│   │   ├── Kernel.sol            # Smart Account Implementation
│   │   ├── KernelFactory.sol     # Account Factory
│   │   └── interfaces/
│   │       ├── IEntryPoint.sol
│   │       ├── IAccount.sol
│   │       └── IERC7579Account.sol
│   │
│   ├── modules/                  # ERC-7579 모듈
│   │   ├── validators/
│   │   │   ├── ECDSAValidator.sol
│   │   │   ├── WebAuthnValidator.sol
│   │   │   └── MultiSigValidator.sol
│   │   ├── executors/
│   │   │   ├── SessionKeyExecutor.sol
│   │   │   └── RecurringPaymentExecutor.sol
│   │   ├── hooks/
│   │   │   ├── SpendingLimitHook.sol
│   │   │   └── AuditHook.sol
│   │   └── fallbacks/
│   │       └── RecoveryFallback.sol
│   │
│   ├── paymaster/                # Paymaster 컨트랙트
│   │   ├── VerifyingPaymaster.sol
│   │   ├── ERC20Paymaster.sol
│   │   ├── Permit2Paymaster.sol
│   │   └── PaymasterHelpers.sol
│   │
│   ├── defi/                     # DeFi 컨트랙트
│   │   ├── UniswapV3Factory.sol
│   │   ├── UniswapV3Pool.sol
│   │   ├── NonfungiblePositionManager.sol
│   │   ├── UniversalRouter.sol
│   │   ├── PriceOracle.sol
│   │   └── Permit2.sol
│   │
│   ├── privacy/                  # Privacy 컨트랙트
│   │   ├── ERC5564Announcer.sol
│   │   ├── ERC6538Registry.sol
│   │   ├── PrivateBank.sol
│   │   └── StealthLib.sol
│   │
│   ├── subscription/             # Subscription 컨트랙트
│   │   ├── ERC7715PermissionManager.sol
│   │   ├── ERC7710DelegationManager.sol
│   │   └── SubscriptionManager.sol
│   │
│   ├── bridge/                   # Bridge 컨트랙트
│   │   ├── SecureBridge.sol
│   │   ├── BridgeValidator.sol
│   │   ├── OptimisticVerifier.sol
│   │   ├── FraudProofVerifier.sol
│   │   ├── BridgeRateLimiter.sol
│   │   └── BridgeGuardian.sol
│   │
│   ├── tokens/                   # 토큰 컨트랙트
│   │   ├── WKRW.sol              # Wrapped KRW
│   │   ├── MockUSDT.sol          # Test USDT
│   │   └── BridgedToken.sol      # Bridge용 래핑 토큰
│   │
│   └── libraries/                # 공통 라이브러리
│       ├── P256.sol              # P256 서명 검증
│       ├── MerkleProof.sol
│       ├── ExecutionLib.sol
│       └── ModeLib.sol
│
├── test/                         # 테스트
│   ├── core/
│   │   ├── EntryPoint.t.sol
│   │   ├── Kernel.t.sol
│   │   └── KernelFactory.t.sol
│   ├── modules/
│   │   ├── validators/
│   │   ├── executors/
│   │   └── hooks/
│   ├── paymaster/
│   ├── defi/
│   ├── privacy/
│   ├── subscription/
│   ├── bridge/
│   └── integration/              # 통합 테스트
│       ├── E2EUserOp.t.sol
│       ├── E2EPaymaster.t.sol
│       └── E2EBridge.t.sol
│
├── script/                       # 배포 스크립트
│   ├── Deploy.s.sol              # 전체 배포
│   ├── DeployCore.s.sol          # Core 배포
│   ├── DeployModules.s.sol       # Module 배포
│   ├── DeployPaymaster.s.sol     # Paymaster 배포
│   ├── DeployDeFi.s.sol          # DeFi 배포
│   ├── DeployPrivacy.s.sol       # Privacy 배포
│   ├── DeploySubscription.s.sol  # Subscription 배포
│   ├── DeployBridge.s.sol        # Bridge 배포
│   └── helpers/
│       └── DeployHelpers.s.sol
│
└── deployments/                  # 배포 결과
    ├── devnet.json
    ├── testnet.json
    └── mainnet.json
```

---

## 3. TypeScript SDK (packages/sdk)

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsup.config.ts                # 빌드 설정
│
├── src/
│   ├── index.ts                  # 메인 엔트리
│   │
│   ├── account/                  # Smart Account 관리
│   │   ├── index.ts
│   │   ├── kernel.ts             # Kernel 클라이언트
│   │   ├── factory.ts            # Factory 클라이언트
│   │   └── types.ts
│   │
│   ├── bundler/                  # Bundler 클라이언트
│   │   ├── index.ts
│   │   ├── client.ts             # Bundler RPC 클라이언트
│   │   ├── userOp.ts             # UserOp 생성 헬퍼
│   │   └── types.ts
│   │
│   ├── paymaster/                # Paymaster 연동
│   │   ├── index.ts
│   │   ├── verifying.ts          # VerifyingPaymaster
│   │   ├── erc20.ts              # ERC20Paymaster
│   │   ├── permit2.ts            # Permit2Paymaster
│   │   └── types.ts
│   │
│   ├── modules/                  # Module 관리
│   │   ├── index.ts
│   │   ├── validators/
│   │   │   ├── ecdsa.ts
│   │   │   ├── webauthn.ts
│   │   │   └── multisig.ts
│   │   ├── executors/
│   │   │   ├── sessionKey.ts
│   │   │   └── recurringPayment.ts
│   │   └── hooks/
│   │       ├── spendingLimit.ts
│   │       └── audit.ts
│   │
│   ├── stealth/                  # Stealth Address
│   │   ├── index.ts
│   │   ├── keys.ts               # 키 생성/관리
│   │   ├── address.ts            # 주소 계산
│   │   ├── scan.ts               # Announcement 스캔
│   │   └── types.ts
│   │
│   ├── subscription/             # 정기 결제
│   │   ├── index.ts
│   │   ├── permission.ts         # ERC-7715 권한
│   │   ├── subscription.ts       # 구독 관리
│   │   └── types.ts
│   │
│   ├── bridge/                   # Bridge 클라이언트
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── status.ts             # 상태 조회
│   │   └── types.ts
│   │
│   ├── defi/                     # DeFi 헬퍼
│   │   ├── index.ts
│   │   ├── swap.ts               # 스왑 헬퍼
│   │   ├── liquidity.ts          # 유동성 헬퍼
│   │   └── types.ts
│   │
│   └── utils/                    # 유틸리티
│       ├── index.ts
│       ├── encoding.ts
│       ├── signature.ts
│       └── constants.ts
│
├── test/
│   ├── account.test.ts
│   ├── bundler.test.ts
│   ├── paymaster.test.ts
│   ├── stealth.test.ts
│   └── subscription.test.ts
│
└── examples/                     # 예제
    ├── create-account.ts
    ├── send-userOp.ts
    ├── stealth-transfer.ts
    └── create-subscription.ts
```

---

## 4. Chrome Extension Wallet (apps/wallet-extension)

```
apps/wallet-extension/
├── package.json
├── vite.config.ts                # Vite 설정
├── manifest.json                 # Extension 매니페스트 v3
│
├── src/
│   ├── background/               # Background Script
│   │   ├── index.ts              # 엔트리
│   │   ├── keyring.ts            # 키 관리
│   │   ├── rpc.ts                # RPC 처리
│   │   ├── userOp.ts             # UserOp 처리
│   │   └── storage.ts            # 저장소 관리
│   │
│   ├── popup/                    # Popup UI
│   │   ├── main.tsx              # React 엔트리
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Welcome.tsx       # 초기 화면
│   │   │   ├── Create.tsx        # 계정 생성
│   │   │   ├── Import.tsx        # 계정 가져오기
│   │   │   ├── Home.tsx          # 메인 화면
│   │   │   ├── Send.tsx          # 전송
│   │   │   ├── Receive.tsx       # 수신
│   │   │   ├── Activity.tsx      # 활동 내역
│   │   │   ├── Settings.tsx      # 설정
│   │   │   └── Modules.tsx       # 모듈 관리
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Balance.tsx
│   │   │   ├── TokenList.tsx
│   │   │   ├── TransactionItem.tsx
│   │   │   ├── ModuleCard.tsx
│   │   │   └── PaymasterSelector.tsx
│   │   ├── hooks/
│   │   │   ├── useAccount.ts
│   │   │   ├── useBalance.ts
│   │   │   ├── useUserOp.ts
│   │   │   └── usePaymaster.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   ├── content/                  # Content Script
│   │   ├── index.ts
│   │   └── inject.ts             # Provider 주입
│   │
│   ├── lib/                      # 공통 라이브러리
│   │   ├── account.ts
│   │   ├── bundler.ts
│   │   ├── paymaster.ts
│   │   ├── stealth.ts
│   │   └── types.ts
│   │
│   └── assets/
│       ├── icons/
│       └── images/
│
├── public/
│   ├── icons/
│   └── popup.html
│
└── test/
    ├── background.test.ts
    └── popup.test.tsx
```

---

## 5. Backend Services

### 5.1 Bundler (services/bundler)

```
services/bundler/
├── package.json
├── tsconfig.json
├── Dockerfile
│
├── src/
│   ├── index.ts                  # 엔트리
│   ├── server.ts                 # Fastify 서버
│   │
│   ├── rpc/                      # RPC 핸들러
│   │   ├── index.ts
│   │   ├── eth_sendUserOperation.ts
│   │   ├── eth_estimateUserOperationGas.ts
│   │   ├── eth_getUserOperationByHash.ts
│   │   ├── eth_getUserOperationReceipt.ts
│   │   └── eth_supportedEntryPoints.ts
│   │
│   ├── mempool/                  # Mempool 관리
│   │   ├── index.ts
│   │   ├── mempool.ts
│   │   ├── validation.ts         # UserOp 검증
│   │   └── reputation.ts         # 평판 관리
│   │
│   ├── executor/                 # Bundle 실행
│   │   ├── index.ts
│   │   ├── bundler.ts
│   │   ├── gasEstimator.ts
│   │   └── nonceManager.ts
│   │
│   ├── simulation/               # UserOp 시뮬레이션
│   │   ├── index.ts
│   │   └── simulator.ts
│   │
│   └── utils/
│       ├── config.ts
│       ├── logger.ts
│       └── types.ts
│
├── test/
│   ├── rpc.test.ts
│   ├── mempool.test.ts
│   └── executor.test.ts
│
└── config/
    ├── default.json
    └── production.json
```

### 5.2 Stealth Server (services/stealth-server)

```
services/stealth-server/
├── Cargo.toml
├── Dockerfile
│
├── src/
│   ├── main.rs                   # 엔트리
│   │
│   ├── api/                      # REST API
│   │   ├── mod.rs
│   │   ├── announcements.rs      # Announcement 조회
│   │   ├── registry.rs           # 키 등록
│   │   └── scan.rs               # 스캔 API
│   │
│   ├── indexer/                  # 이벤트 인덱서
│   │   ├── mod.rs
│   │   ├── announcer.rs          # Announcement 인덱싱
│   │   └── registry.rs           # Registry 인덱싱
│   │
│   ├── db/                       # 데이터베이스
│   │   ├── mod.rs
│   │   ├── schema.rs             # SQL 스키마
│   │   ├── models.rs             # 데이터 모델
│   │   └── queries.rs            # 쿼리
│   │
│   ├── crypto/                   # 암호화
│   │   ├── mod.rs
│   │   ├── stealth.rs            # Stealth 연산
│   │   └── viewtag.rs            # ViewTag 필터링
│   │
│   └── config.rs
│
├── migrations/                   # DB 마이그레이션
│   └── 001_initial.sql
│
└── tests/
    ├── api_test.rs
    └── indexer_test.rs
```

### 5.3 다른 서비스 구조 (간략)

```
services/paymaster-proxy/         # ERC-7677 Proxy
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── sponsor.ts            # 스폰서 정책
│   │   └── validate.ts           # 검증
│   └── providers/                # Paymaster 연동
│       ├── verifying.ts
│       └── erc20.ts

services/order-router/            # Smart Order Router
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── quote.ts              # 견적
│   │   └── swap.ts               # 스왑 실행
│   ├── routing/
│   │   ├── pathfinder.ts         # 경로 탐색
│   │   └── optimizer.ts          # 최적화
│   └── oracle/
│       └── price.ts              # 가격 정보

services/subscription-executor/   # Subscription Executor
├── src/
│   ├── server.ts
│   ├── scheduler/
│   │   └── cron.ts               # 스케줄러
│   ├── executor/
│   │   └── payment.ts            # 결제 실행
│   └── queue/
│       └── bull.ts               # 작업 큐

services/bridge-relayer/          # Bridge Relayer
├── src/
│   ├── server.ts
│   ├── relayer/
│   │   ├── source.ts             # 소스 체인 모니터
│   │   └── target.ts             # 타겟 체인 실행
│   ├── mpc/
│   │   └── signer.ts             # MPC 서명 조율
│   └── monitor/
│       └── alerts.ts             # 알림
```

---

## 6. Simulators

```
simulators/
├── bank/                         # 은행 API 시뮬레이터
│   ├── src/
│   │   ├── server.go
│   │   ├── handlers/
│   │   │   ├── account.go        # 계좌 조회
│   │   │   ├── transfer.go       # 이체
│   │   │   └── webhook.go        # 웹훅
│   │   └── data/
│   │       └── accounts.json     # 테스트 데이터
│   └── Dockerfile
│
├── pg/                           # PG사 시뮬레이터
│   ├── src/
│   │   ├── server.go
│   │   ├── handlers/
│   │   │   ├── payment.go        # 결제
│   │   │   ├── cancel.go         # 취소
│   │   │   └── billing.go        # 정기결제
│   │   └── data/
│   │       └── merchants.json
│   └── Dockerfile
│
└── onramp/                       # On-Ramp 시뮬레이터
    ├── src/
    │   ├── server.go
    │   ├── handlers/
    │   │   ├── deposit.go        # 입금
    │   │   ├── withdraw.go       # 출금
    │   │   └── kyc.go            # KYC
    │   └── data/
    │       └── users.json
    └── Dockerfile
```

---

## 7. dApps

### 7.1 Payment dApp (apps/payment-dapp)

```
apps/payment-dapp/
├── package.json
├── next.config.js
├── tailwind.config.js
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 메인
│   │   ├── pay/
│   │   │   └── page.tsx          # 결제 화면
│   │   ├── receive/
│   │   │   └── page.tsx          # 결제 수신
│   │   ├── history/
│   │   │   └── page.tsx          # 거래 내역
│   │   └── subscription/
│   │       ├── page.tsx          # 구독 목록
│   │       └── [id]/
│   │           └── page.tsx      # 구독 상세
│   │
│   ├── components/
│   │   ├── QRCode.tsx
│   │   ├── PaymentForm.tsx
│   │   ├── SubscriptionCard.tsx
│   │   └── TransactionList.tsx
│   │
│   ├── hooks/
│   │   ├── usePayment.ts
│   │   └── useSubscription.ts
│   │
│   └── lib/
│       ├── sdk.ts
│       └── config.ts
│
└── public/
```

### 7.2 기타 dApps (간략)

```
apps/defi-dapp/                   # DeFi dApp
├── src/app/
│   ├── swap/                     # 스왑
│   ├── pool/                     # 유동성
│   └── bridge/                   # 브릿지

apps/enterprise-dapp/             # Enterprise dApp
├── src/app/
│   ├── payroll/                  # 급여 지급
│   ├── expense/                  # 경비 관리
│   └── audit/                    # 감사 로그

apps/marketplace/                 # Module Marketplace
├── src/app/
│   ├── browse/                   # 모듈 탐색
│   ├── detail/[id]/              # 모듈 상세
│   └── manage/                   # 설치된 모듈
```

---

## 8. 인프라 설정

### 8.1 Docker

```
infra/docker/
├── docker-compose.yml            # 로컬 개발 환경
├── docker-compose.prod.yml       # 프로덕션
│
├── bundler/
│   └── Dockerfile
├── stealth-server/
│   └── Dockerfile
├── paymaster-proxy/
│   └── Dockerfile
├── order-router/
│   └── Dockerfile
├── subscription-executor/
│   └── Dockerfile
├── bridge-relayer/
│   └── Dockerfile
└── simulators/
    ├── bank/Dockerfile
    ├── pg/Dockerfile
    └── onramp/Dockerfile
```

### 8.2 docker-compose.yml

```yaml
version: '3.8'

services:
  # DevNet Node
  devnet:
    image: go-stablenet:latest
    ports:
      - "8545:8545"
      - "8546:8546"
    volumes:
      - devnet-data:/data

  # Bundler
  bundler:
    build: ./bundler
    ports:
      - "4337:4337"
    environment:
      - RPC_URL=http://devnet:8545
      - ENTRY_POINT=${ENTRY_POINT_ADDRESS}
    depends_on:
      - devnet

  # Stealth Server
  stealth-server:
    build: ./stealth-server
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/stealth
      - RPC_URL=http://devnet:8545
    depends_on:
      - devnet
      - postgres

  # Paymaster Proxy
  paymaster-proxy:
    build: ./paymaster-proxy
    ports:
      - "3002:3002"
    environment:
      - RPC_URL=http://devnet:8545
      - BUNDLER_URL=http://bundler:4337
    depends_on:
      - bundler

  # Order Router
  order-router:
    build: ./order-router
    ports:
      - "3003:3003"
    environment:
      - RPC_URL=http://devnet:8545
    depends_on:
      - devnet

  # Subscription Executor
  subscription-executor:
    build: ./subscription-executor
    ports:
      - "3004:3004"
    environment:
      - RPC_URL=http://devnet:8545
      - REDIS_URL=redis://redis:6379
    depends_on:
      - devnet
      - redis

  # Simulators
  bank-simulator:
    build: ./simulators/bank
    ports:
      - "4001:4001"

  pg-simulator:
    build: ./simulators/pg
    ports:
      - "4002:4002"

  onramp-simulator:
    build: ./simulators/onramp
    ports:
      - "4003:4003"

  # Infrastructure
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: stealth
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis-data:/data

volumes:
  devnet-data:
  postgres-data:
  redis-data:
```

---

## 9. 환경 설정

### 9.1 루트 package.json

```json
{
  "name": "stable-platform",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*",
    "services/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev",
    "clean": "turbo run clean",
    "deploy:devnet": "turbo run deploy --filter=@stable/contracts -- --network devnet",
    "start:services": "docker-compose up -d"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

### 9.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "deploy": {
      "dependsOn": ["build", "test"]
    }
  }
}
```

### 9.3 .env.example

```bash
# Network
RPC_URL=http://localhost:8545
CHAIN_ID=8453

# Contracts
ENTRY_POINT_ADDRESS=0x...
KERNEL_FACTORY_ADDRESS=0x...
PAYMASTER_ADDRESS=0x...

# Services
BUNDLER_URL=http://localhost:4337
STEALTH_SERVER_URL=http://localhost:3001
PAYMASTER_PROXY_URL=http://localhost:3002
ORDER_ROUTER_URL=http://localhost:3003

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/stealth

# Redis
REDIS_URL=redis://localhost:6379

# Keys (개발용)
DEPLOYER_PRIVATE_KEY=0x...
BUNDLER_PRIVATE_KEY=0x...
PAYMASTER_SIGNER_KEY=0x...
```

---

## 10. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [03_Development_Roadmap.md](./03_Development_Roadmap.md) - 개발 로드맵
- [04_Secure_Bridge.md](./04_Secure_Bridge.md) - 브릿지 상세 설계

---

*문서 끝*
