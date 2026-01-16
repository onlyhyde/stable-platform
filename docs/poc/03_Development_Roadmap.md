# StableNet PoC 개발 로드맵

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 개발 일정 총괄

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      StableNet PoC 24주 개발 로드맵                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 0 ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Week 1-4       │
│  Foundation & Core Infrastructure                                            │
│                                                                              │
│  Phase 1 ░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Week 5-8       │
│  Module System & Wallet                                                      │
│                                                                              │
│  Phase 2 ░░░░░░░░░░░░░░░░██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Week 9-11      │
│  DeFi & Payment Infrastructure                                               │
│                                                                              │
│  Phase 3 ░░░░░░░░░░░░░░░░░░░░░░██████░░░░░░░░░░░░░░░░░░░░░░ Week 12-14     │
│  Privacy & Enterprise Features                                               │
│                                                                              │
│  Phase 4 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████░░░░░░░░░░░░░░░░ Week 15-17     │
│  Subscription & Recurring Payments                                           │
│                                                                              │
│  Phase 5 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░ Week 18-21     │
│  Bridge & Cross-chain                                                        │
│                                                                              │
│  Phase 6 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████░░ Week 22-24     │
│  Integration & Documentation                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 0: Foundation (Week 1-4)

### 2.1 목표
- DevNet 환경 구축
- ERC-4337 Core 컨트랙트 배포
- 기본 Smart Account 구현 및 테스트
- 개발 환경 표준화

### 2.2 주간 상세

#### Week 1: 개발 환경 구축

| Task | 담당 | 산출물 |
|------|------|--------|
| DevNet 노드 설정 | Infra | go-stablenet 노드 실행 |
| Foundry 프로젝트 초기화 | Contract | foundry.toml, remappings |
| CI/CD 파이프라인 | DevOps | GitHub Actions 설정 |
| 코드 스타일 가이드 | All | .solhint.json, prettier 설정 |

```bash
# DevNet 설정
Chain ID: 8453
Block Time: 1 second
Consensus: WBFT (QBFT-based)
RPC: http://localhost:8545
```

#### Week 2: EntryPoint & Factory

| Task | 담당 | 산출물 |
|------|------|--------|
| EntryPoint v0.7 배포 | Contract | EntryPoint.sol |
| AccountFactory 구현 | Contract | AccountFactory.sol |
| CREATE2 주소 계산 | Contract | 결정론적 주소 생성 |
| 단위 테스트 작성 | QA | test/EntryPoint.t.sol |

**EntryPoint 주요 기능 체크리스트**:
- [ ] handleOps 구현
- [ ] depositTo/withdrawTo 구현
- [ ] getNonce 구현
- [ ] getUserOpHash 구현
- [ ] Gas 계산 로직

#### Week 3: Kernel Smart Account

| Task | 담당 | 산출물 |
|------|------|--------|
| Kernel v3.1 구현 | Contract | Kernel.sol |
| ERC-7579 인터페이스 | Contract | IERC7579Account.sol |
| Storage Layout 설계 | Contract | ERC-7201 namespaced storage |
| 기본 Validator 연동 | Contract | ECDSAValidator.sol |

**Kernel 구현 체크리스트**:
- [ ] validateUserOp (ERC-4337)
- [ ] execute/executeBatch (ERC-7579)
- [ ] installModule/uninstallModule
- [ ] isModuleInstalled
- [ ] supportsInterface

#### Week 4: 기본 통합 및 테스트

| Task | 담당 | 산출물 |
|------|------|--------|
| E2E 테스트 작성 | QA | test/integration/ |
| UserOp 생성 스크립트 | Contract | script/CreateUserOp.s.sol |
| Gas 프로파일링 | QA | gas-report.md |
| Phase 0 문서화 | Docs | phase0-report.md |

### 2.3 Phase 0 마일스톤

```
✓ DevNet 운영 중
✓ EntryPoint v0.7 배포 완료
✓ Kernel Smart Account 생성 가능
✓ ECDSAValidator로 UserOp 서명/검증
✓ 기본 E2E 테스트 통과
```

---

## 3. Phase 1: Module System & Wallet (Week 5-8)

### 3.1 목표
- ERC-7579 모듈 시스템 완성
- Paymaster 구현
- Bundler 서비스 구축
- Chrome Extension Wallet MVP

### 3.2 주간 상세

#### Week 5: Validator Modules

| Task | 담당 | 산출물 |
|------|------|--------|
| WebAuthnValidator | Contract | WebAuthnValidator.sol |
| MultiSigValidator | Contract | MultiSigValidator.sol |
| Validator 모듈 테스트 | QA | test/validators/ |
| P256 라이브러리 통합 | Contract | P256.sol |

#### Week 6: Executor & Hook Modules

| Task | 담당 | 산출물 |
|------|------|--------|
| SessionKeyExecutor | Contract | SessionKeyExecutor.sol |
| SpendingLimitHook | Contract | SpendingLimitHook.sol |
| AuditHook | Contract | AuditHook.sol |
| 모듈 조합 테스트 | QA | test/modules/ |

#### Week 7: Paymaster & Bundler

| Task | 담당 | 산출물 |
|------|------|--------|
| VerifyingPaymaster | Contract | VerifyingPaymaster.sol |
| ERC20Paymaster (기본) | Contract | ERC20Paymaster.sol |
| Bundler MVP | Backend | bundler/ |
| ERC-7677 Proxy | Backend | paymaster-proxy/ |

**Bundler 아키텍처**:
```
┌─────────────────────────────────────────────────────────┐
│                    Bundler Service                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   RPC API   │  │  Mempool    │  │  Executor   │     │
│  │  (Fastify)  │  │  Manager    │  │  Service    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│              ┌─────────────────────┐                    │
│              │    EntryPoint       │                    │
│              │    handleOps()      │                    │
│              └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

#### Week 8: Chrome Extension Wallet MVP

| Task | 담당 | 산출물 |
|------|------|--------|
| Extension 구조 설계 | Frontend | manifest.json, 디렉토리 |
| Background Script | Frontend | background.ts |
| Popup UI (계정 생성) | Frontend | popup/ |
| UserOp 서명 로직 | Frontend | lib/userOp.ts |

**Wallet MVP 기능**:
- [ ] 계정 생성 (Kernel + ECDSAValidator)
- [ ] ETH/ERC20 잔액 조회
- [ ] 기본 전송 (UserOp 생성 및 서명)
- [ ] Bundler 연동

### 3.3 Phase 1 마일스톤

```
✓ ERC-7579 모듈 시스템 완료
  - 3개 Validator (ECDSA, WebAuthn, MultiSig)
  - 1개 Executor (SessionKey)
  - 2개 Hook (SpendingLimit, Audit)
✓ Paymaster 2종 운영
✓ Bundler 서비스 운영 (eth_sendUserOperation 지원)
✓ Chrome Extension MVP (계정 생성, 전송)
```

---

## 4. Phase 2: DeFi & Payment (Week 9-11)

### 4.1 목표
- Uniswap V3 배포 및 유동성 풀 생성
- ERC20Paymaster DEX 연동
- Smart Order Router 구현
- Payment dApp 개발

### 4.2 주간 상세

#### Week 9: Uniswap V3 Core

| Task | 담당 | 산출물 |
|------|------|--------|
| UniswapV3Factory 배포 | Contract | UniswapV3Factory.sol |
| WKRW/USDT Pool | Contract | Pool 생성 |
| WKRW/ETH Pool | Contract | Pool 생성 |
| 초기 유동성 제공 | Contract | 테스트 유동성 |

**유동성 풀 설정**:
```
WKRW/USDT Pool
- Fee Tier: 0.01% (100)
- Initial Price: 1 WKRW = 0.00075 USDT (1 USD ≈ 1,333 KRW)

WKRW/ETH Pool
- Fee Tier: 0.3% (3000)
- Initial Price: 1 ETH = 4,000,000 WKRW
```

#### Week 10: Router & Oracle

| Task | 담당 | 산출물 |
|------|------|--------|
| UniversalRouter 배포 | Contract | UniversalRouter.sol |
| PriceOracle 구현 | Contract | PriceOracle.sol (TWAP) |
| Permit2 연동 | Contract | Permit2Paymaster.sol |
| Smart Order Router | Backend | order-router/ |

**Smart Order Router**:
```typescript
// 최적 경로 계산
interface RouteQuote {
  path: string[];      // [tokenIn, ..., tokenOut]
  pools: string[];     // Pool addresses
  amountOut: bigint;
  priceImpact: number;
  gasEstimate: bigint;
}

async function findBestRoute(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<RouteQuote>;
```

#### Week 11: Payment dApp

| Task | 담당 | 산출물 |
|------|------|--------|
| Payment dApp UI | Frontend | apps/payment/ |
| QR 코드 결제 | Frontend | QR 생성/스캔 |
| Paymaster 연동 UI | Frontend | 가스비 옵션 선택 |
| 결제 이력 조회 | Frontend | 거래 내역 페이지 |

**Payment dApp 기능**:
- [ ] QR 코드로 결제 요청 생성
- [ ] 결제 수신 (가맹점)
- [ ] 가스비 옵션 (대납/토큰 결제)
- [ ] 실시간 환율 표시

### 4.3 Phase 2 마일스톤

```
✓ Uniswap V3 운영 (3개 풀)
✓ TWAP 오라클 운영
✓ Permit2Paymaster로 승인 없는 토큰 결제
✓ Smart Order Router API
✓ Payment dApp MVP
```

---

## 5. Phase 3: Privacy & Enterprise (Week 12-14)

### 5.1 목표
- ERC-5564/6538 Stealth Address 구현
- Stealth Server 구축
- Enterprise dApp 개발
- 급여 지급 프라이버시 보호

### 5.2 주간 상세

#### Week 12: Stealth Contracts

| Task | 담당 | 산출물 |
|------|------|--------|
| ERC5564Announcer | Contract | ERC5564Announcer.sol |
| ERC6538Registry | Contract | ERC6538Registry.sol |
| PrivateBank | Contract | PrivateBank.sol |
| Stealth Key 생성 | Contract | StealthLib.sol |

**Stealth Address 흐름**:
```
1. Sender: Get recipient's stealth meta-address from Registry
2. Sender: Generate ephemeral key pair
3. Sender: Compute stealth address using ECDH
4. Sender: Send tokens to stealth address
5. Sender: Announce ephemeral public key
6. Recipient: Scan announcements with viewing key
7. Recipient: Compute spending key for stealth address
```

#### Week 13: Stealth Server

| Task | 담당 | 산출물 |
|------|------|--------|
| Stealth Server (Rust) | Backend | stealth-server/ |
| Announcement 인덱싱 | Backend | PostgreSQL 스키마 |
| ViewTag 필터링 | Backend | 효율적 스캔 |
| REST API | Backend | OpenAPI spec |

**Stealth Server API**:
```
GET  /announcements?viewTag={tag}&from={block}
POST /register-keys
GET  /scan?spendingKey={key}
GET  /health
```

#### Week 14: Enterprise dApp

| Task | 담당 | 산출물 |
|------|------|--------|
| Enterprise dApp UI | Frontend | apps/enterprise/ |
| 급여 지급 기능 | Frontend | Batch + Stealth |
| 경비 관리 | Frontend | Sub-Account, Limit |
| 감사 로그 조회 | Frontend | Audit Hook 연동 |

**Enterprise 기능**:
- [ ] 직원 Stealth Address 등록
- [ ] 일괄 급여 지급 (프라이버시 보호)
- [ ] 부서별 예산 관리 (SpendingLimitHook)
- [ ] 규제 대응 감사 로그

### 5.3 Phase 3 마일스톤

```
✓ Stealth Address 시스템 운영
✓ Stealth Server 운영 (Rust + PostgreSQL)
✓ ViewTag 기반 효율적 스캔 (<1초)
✓ Enterprise dApp MVP
✓ 프라이버시 보호 급여 지급 시연
```

---

## 6. Phase 4: Subscription (Week 15-17)

### 6.1 목표
- ERC-7715/7710 권한 시스템 구현
- 정기 결제 자동화
- Subscription Executor 구현
- PG 시뮬레이터 연동

### 6.2 주간 상세

#### Week 15: Permission System

| Task | 담당 | 산출물 |
|------|------|--------|
| ERC7715PermissionManager | Contract | ERC7715PermissionManager.sol |
| ERC7710DelegationManager | Contract | ERC7710DelegationManager.sol |
| RecurringPaymentExecutor | Contract | RecurringPaymentExecutor.sol |
| Permission 테스트 | QA | test/permissions/ |

#### Week 16: Subscription Infrastructure

| Task | 담당 | 산출물 |
|------|------|--------|
| SubscriptionManager | Contract | SubscriptionManager.sol |
| Subscription Executor | Backend | subscription-executor/ |
| PG Simulator | Backend | simulators/pg/ |
| Bank Simulator | Backend | simulators/bank/ |

**Subscription Executor 아키텍처**:
```
┌─────────────────────────────────────────────────────────┐
│                Subscription Executor                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Scheduler │  │   Queue     │  │  Executor   │     │
│  │   (Cron)    │  │  (Bull/MQ)  │  │  Worker     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │             │
│         ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SubscriptionManager                 │   │
│  │              processPayment()                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Week 17: Subscription dApp

| Task | 담당 | 산출물 |
|------|------|--------|
| Subscription UI (사용자) | Frontend | apps/payment/subscription |
| Subscription UI (가맹점) | Frontend | 구독 상품 관리 |
| Wallet Extension 연동 | Frontend | 권한 승인 UI |
| E2E 테스트 | QA | 전체 흐름 검증 |

**구독 흐름**:
```
1. 사용자: 구독 상품 선택
2. 사용자: ERC-7715 Permission 승인 (Wallet)
3. 시스템: SubscriptionManager.createSubscription()
4. 자동: Subscription Executor가 주기적 결제 실행
5. 사용자: 구독 관리 (취소, 변경)
```

### 6.3 Phase 4 마일스톤

```
✓ ERC-7715/7710 권한 시스템 운영
✓ SubscriptionManager 운영
✓ Subscription Executor 자동 결제
✓ PG/Bank 시뮬레이터 연동
✓ 정기 구독 E2E 시연
```

---

## 7. Phase 5: Bridge (Week 18-21)

### 7.1 목표
- MPC + Optimistic 보안 브릿지 구현
- 크로스체인 자산 이동
- Fraud Proof 시스템
- On-Ramp 시뮬레이터

### 7.2 주간 상세

#### Week 18: Bridge Core

| Task | 담당 | 산출물 |
|------|------|--------|
| SecureBridge 컨트랙트 | Contract | SecureBridge.sol |
| BridgeValidator | Contract | BridgeValidator.sol |
| MPC 서명 로직 | Contract | 5-of-7 threshold |
| Rate Limiting | Contract | 시간당/일일 한도 |

#### Week 19: Optimistic Verification

| Task | 담당 | 산출물 |
|------|------|--------|
| Challenge 시스템 | Contract | Challenge Period 6h |
| Fraud Proof 검증 | Contract | FraudProofVerifier.sol |
| MessageVerifier | Contract | MessageVerifier.sol |
| 보안 테스트 | QA | Security scenarios |

#### Week 20: Bridge Infrastructure

| Task | 담당 | 산출물 |
|------|------|--------|
| Bridge Relayer | Backend | bridge-relayer/ |
| MPC Signer Service | Backend | mpc-signer/ |
| On-Ramp Simulator | Backend | simulators/onramp/ |
| Bridge Monitor | Backend | 실시간 모니터링 |

**Bridge 보안 레이어**:
```
Layer 1: MPC Signing (5-of-7 threshold)
Layer 2: Optimistic Challenge (6h PoC / 24h Mainnet)
Layer 3: Fraud Proofs (merkle + state proof)
Layer 4: Rate Limiting (hourly + daily caps)
Layer 5: Emergency Pause (Guardian multisig)
```

#### Week 21: Bridge UI & Testing

| Task | 담당 | 산출물 |
|------|------|--------|
| Bridge UI | Frontend | apps/defi/bridge |
| On-Ramp UI | Frontend | 법정화폐 입금 |
| 보안 감사 준비 | Security | 감사 체크리스트 |
| 통합 테스트 | QA | Bridge E2E |

### 7.3 Phase 5 마일스톤

```
✓ SecureBridge 운영 (MPC + Optimistic)
✓ Fraud Proof 시스템 운영
✓ Bridge Relayer 운영
✓ On-Ramp 시뮬레이터 연동
✓ 크로스체인 자산 이동 시연
```

---

## 8. Phase 6: Integration & Documentation (Week 22-24)

### 8.1 목표
- 전체 시스템 통합 테스트
- Module Marketplace 개발
- SDK 완성 및 문서화
- 운영 가이드 작성

### 8.2 주간 상세

#### Week 22: Module Marketplace

| Task | 담당 | 산출물 |
|------|------|--------|
| Marketplace UI | Frontend | apps/marketplace |
| 모듈 등록 시스템 | Backend | Module Registry |
| 모듈 검증 파이프라인 | DevOps | CI/CD for modules |
| Wallet 연동 | Frontend | 모듈 설치/제거 |

**Marketplace 기능**:
- [ ] 검증된 모듈 목록
- [ ] 모듈 상세 정보 (기능, 보안 등급)
- [ ] 원클릭 설치
- [ ] 사용 통계

#### Week 23: SDK & Documentation

| Task | 담당 | 산출물 |
|------|------|--------|
| TypeScript SDK 완성 | Frontend | @stablenet/sdk |
| API Reference | Docs | docs/api/ |
| Tutorial 작성 | Docs | docs/tutorials/ |
| Example 프로젝트 | Docs | examples/ |

**SDK 구조**:
```typescript
@stablenet/sdk
├── account/     # Smart Account 관리
├── bundler/     # Bundler 클라이언트
├── paymaster/   # Paymaster 연동
├── stealth/     # Stealth Address
├── subscription/# 정기 결제
└── bridge/      # Bridge 클라이언트
```

#### Week 24: Final Integration & Launch

| Task | 담당 | 산출물 |
|------|------|--------|
| 전체 E2E 테스트 | QA | All scenarios |
| 성능 테스트 | QA | Load testing |
| 보안 최종 검토 | Security | Security checklist |
| 운영 가이드 | Docs | Operations guide |
| PoC 데모 준비 | All | Demo scenario |

### 8.3 Phase 6 마일스톤

```
✓ Module Marketplace 운영
✓ SDK v1.0 출시
✓ 전체 문서화 완료
✓ 모든 E2E 테스트 통과
✓ PoC 데모 완료
```

---

## 9. 리소스 계획

### 9.1 팀 구성

| 역할 | 인원 | 주요 업무 |
|------|------|----------|
| Smart Contract | 2 | 컨트랙트 개발 및 테스트 |
| Backend | 2 | Bundler, Stealth, Bridge 서비스 |
| Frontend | 2 | Wallet, dApps, SDK |
| DevOps | 1 | 인프라, CI/CD |
| QA | 1 | 테스트, 보안 검토 |
| PM/Tech Lead | 1 | 전체 조율, 기술 의사결정 |

**총 9명**

### 9.2 Phase별 리소스 배분

```
Phase 0: Contract(100%), Backend(50%), DevOps(100%), QA(50%)
Phase 1: Contract(100%), Backend(100%), Frontend(100%), QA(100%)
Phase 2: Contract(80%), Backend(100%), Frontend(100%), QA(100%)
Phase 3: Contract(80%), Backend(100%), Frontend(80%), QA(100%)
Phase 4: Contract(60%), Backend(100%), Frontend(100%), QA(100%)
Phase 5: Contract(100%), Backend(100%), Frontend(80%), QA(100%)
Phase 6: Contract(50%), Backend(80%), Frontend(100%), QA(100%), Docs(100%)
```

---

## 10. 리스크 관리

### 10.1 기술 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| EIP-7702 호환성 | 중 | 높음 | DevNet 철저 검증, 대안 경로 준비 |
| MPC 구현 복잡도 | 중 | 중 | 검증된 라이브러리 활용 |
| Uniswap V3 라이선스 | 낮음 | 중 | GPL 호환성 검토 |
| 성능 병목 | 중 | 중 | 초기 프로파일링, 최적화 |

### 10.2 일정 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| 요구사항 변경 | 중 | 중 | 스프린트 단위 피드백, 버퍼 확보 |
| 외부 의존성 | 낮음 | 중 | 사전 PoC, Mock 서비스 |
| 인력 이탈 | 낮음 | 높음 | 지식 공유, 문서화 |

### 10.3 버퍼 계획

- 각 Phase에 1주 버퍼 내재
- 전체 일정 24주 중 실 개발 22주, 버퍼 2주
- 우선순위 조정 가능한 기능 식별 완료

---

## 11. 품질 게이트

### 11.1 Phase별 통과 기준

| Phase | 코드 커버리지 | 보안 검토 | 성능 기준 |
|-------|--------------|----------|----------|
| Phase 0 | 80% | 내부 리뷰 | - |
| Phase 1 | 80% | 내부 리뷰 | UserOp < 2s |
| Phase 2 | 85% | 외부 리뷰 준비 | Swap < 3s |
| Phase 3 | 85% | 내부 리뷰 | Scan < 1s |
| Phase 4 | 85% | 내부 리뷰 | Payment < 2s |
| Phase 5 | 90% | 외부 감사 | Bridge < 10s |
| Phase 6 | 90% | 최종 검토 | 전체 시나리오 |

### 11.2 문서화 기준

- [ ] 모든 Public API 문서화
- [ ] 모든 컨트랙트 NatSpec 완성
- [ ] 통합 테스트 시나리오 문서화
- [ ] 운영 가이드 작성
- [ ] 장애 대응 매뉴얼 작성

---

## 12. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [04_Secure_Bridge.md](./04_Secure_Bridge.md) - 브릿지 상세 설계
- [05_Project_Structure.md](./05_Project_Structure.md) - 프로젝트 디렉토리 구조

---

*문서 끝*
