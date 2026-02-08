# EVM 기반 블록체인 지갑 오픈소스 프로젝트 레퍼런스

> 조사일: 2026-02-08

---

## 1. 모바일 지갑 앱

### 1-1. Rainbow Wallet

| 항목 | 내용 |
|------|------|
| **GitHub** | [rainbow-me/rainbow](https://github.com/rainbow-me/rainbow) |
| **Stars** | ~4,300 |
| **기술 스택** | TypeScript (91.5%), React Native, Expo |
| **라이선스** | GPL-3.0 |
| **유지보수** | 활발 (2026년 2월 v2.0.18) |

**핵심 특징:**
- React Native 기반 EVM 지갑의 대표적 프로덕션 사례
- L2 체인 네이티브 지원 (Arbitrum, Optimism, Base, Polygon, Zora)
- 가스비 최적화, 토큰 스왑 내장, NFT 관리
- 모노레포 구조, RainbowKit(2,700+ stars) 별도 운영

---

### 1-2. Uniswap Wallet

| 항목 | 내용 |
|------|------|
| **GitHub** | [Uniswap/interface](https://github.com/Uniswap/interface) (apps/mobile) |
| **Stars** | ~5,500 |
| **기술 스택** | TypeScript (96.3%), React Native, Turborepo |
| **라이선스** | BSL / GPL |
| **유지보수** | 활발 |

**핵심 특징:**
- DEX 스왑과 지갑의 긴밀한 통합 아키텍처
- 모노레포(Turborepo) 기반 웹+모바일 코드 공유 모범 사례
- `apps/mobile`, `apps/web`, `packages/` 구조로 효율적 관리

---

### 1-3. MetaMask Mobile

| 항목 | 내용 |
|------|------|
| **GitHub** | [MetaMask/metamask-mobile](https://github.com/MetaMask/metamask-mobile) |
| **Stars** | ~2,800 |
| **기술 스택** | TypeScript/JavaScript, React Native |
| **유지보수** | 활발 (12,600+ 커밋) |

**핵심 특징:**
- 업계 표준 지갑의 모바일 버전, 가장 넓은 dApp 호환성
- 하드웨어 지갑 연동(Ledger), WalletConnect v2, MetaMask Snaps
- iOS/Android SDK 별도 제공 (Swift/Kotlin 네이티브)

---

### 1-4. AlphaWallet (네이티브)

| 항목 | 내용 |
|------|------|
| **GitHub** | [AlphaWallet/alpha-wallet-ios](https://github.com/AlphaWallet/alpha-wallet-ios) / [alpha-wallet-android](https://github.com/AlphaWallet/alpha-wallet-android) |
| **Stars** | iOS ~628 |
| **기술 스택** | iOS: Swift / Android: Kotlin |
| **라이선스** | MIT |

**핵심 특징:**
- 네이티브(Swift/Kotlin) 프로덕션 EVM 지갑
- Secure Enclave 활용 하드웨어 수준 키 보안
- TokenScript 프레임워크, 화이트 라벨 커스터마이징 용이

---

### 1-5. Trust Wallet Core (크로스 플랫폼 코어 라이브러리)

| 항목 | 내용 |
|------|------|
| **GitHub** | [trustwallet/wallet-core](https://github.com/trustwallet/wallet-core) |
| **Stars** | ~3,500 |
| **기술 스택** | C++ (38.7%), Rust (32.5%), Swift/Kotlin 바인딩 |
| **라이선스** | Apache-2.0 |
| **유지보수** | 활발 (2026년 1월 v4.6.0) |

**핵심 특징:**
- 60+ 블록체인 지원 저수준 암호화 라이브러리
- C++ 코어 → FFI → Swift/Kotlin/JS 바인딩 아키텍처
- 키 관리, 주소 생성, 트랜잭션 서명의 표준 구현체
- 지갑 앱 구축 시 핵심 코어로 활용 가능 (강력 추천)

---

## 2. 브라우저 확장 지갑

### 2-1. MetaMask Extension

| 항목 | 내용 |
|------|------|
| **GitHub** | [MetaMask/metamask-extension](https://github.com/MetaMask/metamask-extension) |
| **Stars** | ~13,100 |
| **기술 스택** | JavaScript/TypeScript |
| **유지보수** | 활발 (28,300+ 커밋) |

**핵심 특징:**
- EVM 지갑의 사실상 업계 표준
- EIP-1193 Provider API 원조 구현체
- Snaps 확장 시스템, 트랜잭션 시뮬레이션, 보안 경고
- Service Worker (Manifest V3) 기반, 컨트롤러 패턴 상태 관리

---

### 2-2. Rabby Wallet (by DeBank) ⭐ 참고 대상

| 항목 | 내용 |
|------|------|
| **GitHub** | [RabbyHub/Rabby](https://github.com/RabbyHub/Rabby) |
| **Stars** | ~1,800 |
| **기술 스택** | TypeScript (93.8%), Less CSS |
| **유지보수** | 활발 (2026년 2월 v0.93.77) |

**핵심 특징:**
- **사전 서명 보안 엔진(Pre-sign Security Engine)** — 트랜잭션 시뮬레이션으로 결과 미리 표시
- 피싱 공격 및 악성 컨트랙트 자동 감지/경고
- 100+ EVM 체인 지원, 자동 네트워크 전환
- Ledger/Trezor 하드웨어 지갑 연동
- DeBank 포트폴리오 트래킹 통합
- 보안 엔진이 아키텍처의 핵심 계층으로 내장

---

### 2-3. Rainbow Browser Extension ⭐ 참고 대상

| 항목 | 내용 |
|------|------|
| **GitHub** | [rainbow-me/browser-extension](https://github.com/rainbow-me/browser-extension) |
| **Stars** | ~188 |
| **기술 스택** | TypeScript (99.1%) |
| **라이선스** | GPL-3.0 |
| **유지보수** | 활발 (2,500+ 커밋) |

**핵심 특징:**
- "속도를 위해 설계된" 이더리움 지갑
- L2 체인 네이티브 지원
- TypeScript 99.1%의 거의 완벽한 타입 커버리지
- 깔끔하고 직관적인 UI, 모바일과 일관된 UX

---

### 2-4. Enkrypt (by MyEtherWallet)

| 항목 | 내용 |
|------|------|
| **GitHub** | [enkryptcom/enKrypt](https://github.com/enkryptcom/enKrypt) |
| **Stars** | ~428 |
| **기술 스택** | TypeScript (59.1%), Vue (37.7%) |
| **라이선스** | MIT |

**핵심 특징:**
- 70+ 체인 멀티체인 지갑 (EVM + Solana + Polkadot + Bitcoin)
- 하나의 시드구문으로 이종 체인 관리
- 체인별 모듈화, 크로스체인 아키텍처 참고 사례

---

### 2-5. Frame (데스크톱 네이티브)

| 항목 | 내용 |
|------|------|
| **GitHub** | [floating/frame](https://github.com/floating/frame) |
| **Stars** | ~1,200 |
| **기술 스택** | JavaScript (59.0%) |
| **라이선스** | GPL-3.0 |

**핵심 특징:**
- 시스템 전체에서 동작하는 데스크톱 네이티브 Web3 지갑
- 프라이버시 중심 설계, Cure53/Doyensec 보안 감사 수행
- 하드웨어 지갑 통합 아키텍처 참고 사례

---

## 3. 웹 기반 지갑

### 3-1. MyEtherWallet (MEW)

| 항목 | 내용 |
|------|------|
| **GitHub** | [MyEtherWallet/MyEtherWallet](https://github.com/MyEtherWallet/MyEtherWallet) |
| **Stars** | ~1,600 |
| **기술 스택** | SCSS, Vue, JavaScript |
| **라이선스** | MIT |

**핵심 특징:**
- 최초이자 가장 오래된 이더리움 오픈소스 지갑
- 완전한 클라이언트 사이드 실행 (서버에 키 미전송)
- 하드웨어 지갑 연동, HackenProof 버그 바운티

---

### 3-2. Safe{Wallet} 웹 인터페이스

| 항목 | 내용 |
|------|------|
| **GitHub** | [safe-global/safe-wallet-monorepo](https://github.com/safe-global/safe-wallet-monorepo) |
| **Stars** | ~543 |
| **기술 스택** | TypeScript (89.6%) |
| **라이선스** | GPL-3.0 |
| **유지보수** | 활발 (2026년 1월 v1.80.1, 4,200+ 커밋) |

**핵심 특징:**
- 멀티시그(다중서명) 스마트 컨트랙트 지갑의 표준 웹 인터페이스
- $1000억+ TVL 보호 프로덕션 시스템
- 트랜잭션 큐, 배치 처리, 가스 추정

---

## 4. 스마트 컨트랙트 지갑 / Account Abstraction (ERC-4337)

### 4-1. Safe Smart Account

| 항목 | 내용 |
|------|------|
| **GitHub** | [safe-fndn/safe-smart-account](https://github.com/safe-fndn/safe-smart-account) |
| **Stars** | ~2,100 |
| **기술 스택** | TypeScript (61.6%), Solidity (30.0%) |
| **라이선스** | LGPL-3.0 |

**핵심 특징:**
- 스마트 컨트랙트 지갑의 업계 표준, $1000억+ TVL
- ModuleManager, GuardManager, FallbackManager 모듈형 아키텍처
- 프록시 팩토리 패턴으로 가스 효율적 배포
- 광범위한 보안 감사 (OpenZeppelin, Trail of Bits)

---

### 4-2. eth-infinitism/account-abstraction (ERC-4337 레퍼런스)

| 항목 | 내용 |
|------|------|
| **GitHub** | [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction) |
| **Stars** | ~1,900 |
| **기술 스택** | TypeScript (55.5%), Solidity (43.4%) |
| **라이선스** | GPL-3.0 |

**핵심 특징:**
- ERC-4337 공식 레퍼런스 구현체
- EntryPoint, BaseAccount, BasePaymaster, StakeManager, NonceManager
- EIP-7702 네이티브 지원 (v0.8.0+)

---

### 4-3. Coinbase Smart Wallet

| 항목 | 내용 |
|------|------|
| **GitHub** | [coinbase/smart-wallet](https://github.com/coinbase/smart-wallet) |
| **Stars** | ~469 |
| **기술 스택** | Solidity (92.4%) |
| **라이선스** | MIT |

**핵심 특징:**
- Passkey(WebAuthn) 기반 패스워드리스 인증
- 가스 스폰서십 내장, Base 체인 통합

---

### 4-4. ZeroDev Kernel

| 항목 | 내용 |
|------|------|
| **GitHub** | [zerodevapp/kernel](https://github.com/zerodevapp/kernel) |
| **Stars** | ~237 |
| **기술 스택** | Solidity (99.7%) |
| **라이선스** | MIT |

**핵심 특징:**
- 가장 널리 사용되는 모듈형 스마트 어카운트
- ERC-4337 + ERC-7579 플러그인 호환
- Validator, Executor, Hook 모듈 분리
- 세션 키, 소셜 로그인, 가스 스폰서십 SDK

---

### 4-5. Biconomy Nexus

| 항목 | 내용 |
|------|------|
| **GitHub** | [bcnmy/nexus](https://github.com/bcnmy/nexus) / [bcnmy/biconomy-client-sdk](https://github.com/bcnmy/biconomy-client-sdk) |
| **기술 스택** | Nexus: Solidity (83.6%), SDK: TypeScript (100%) |
| **라이선스** | MIT |

**핵심 특징:**
- ERC-7579 모듈형 스마트 어카운트
- 배치 트랜잭션, 가스 스폰서십, 소셜 로그인 SDK
- viem 기반 TypeScript SDK

---

## 5. AA SDK / 인프라 도구

| 프로젝트 | GitHub | Stars | 특징 |
|----------|--------|-------|------|
| Alchemy aa-sdk | [alchemyplatform/aa-sdk](https://github.com/alchemyplatform/aa-sdk) | ~296 | viem 기반, Light Account 포함, Gas Manager API |
| permissionless.js | [pimlicolabs/permissionless.js](https://github.com/pimlicolabs/permissionless.js) | ~243 | 벤더 중립, viem 기반, Safe/Kernel/Biconomy 모두 지원 |
| Coinbase Wallet SDK | [coinbase/coinbase-wallet-sdk](https://github.com/coinbase/coinbase-wallet-sdk) | ~1,700 | dApp-지갑 연결 프로토콜, Smart Wallet 통합 |

---

## 카테고리별 최우선 추천

| 목적 | 추천 프로젝트 | 이유 |
|------|-------------|------|
| 모바일 지갑 (RN) | **Rainbow Wallet** | 프로덕션 품질, 깔끔한 아키텍처 |
| 모바일 모노레포 | **Uniswap Interface** | 웹+모바일 코드 공유 모범 사례 |
| 네이티브 코어 라이브러리 | **Trust Wallet Core** | C++/Rust 기반 키 관리의 표준 |
| 브라우저 확장 | **MetaMask + Rabby** | 표준 + 보안 엔진 모범 사례 |
| 스마트 컨트랙트 지갑 | **Safe Smart Account** | $1000억+ TVL, 업계 표준 |
| ERC-4337 구현 | **eth-infinitism** | 공식 레퍼런스 |
| 모듈형 AA | **ZeroDev Kernel** | ERC-7579, 가장 널리 사용 |
| AA SDK | **permissionless.js** | 벤더 중립, 경량, viem 기반 |

---

## 보안 모범 사례 TOP 5

1. **Trust Wallet Core** — C++/Rust 기반 키 관리, Secure Enclave 활용
2. **Rabby Wallet** — 사전 서명 시뮬레이션, 피싱 탐지 엔진
3. **Safe Smart Account** — 멀티시그, 가드 시스템, 광범위한 감사
4. **MetaMask Extension** — 트랜잭션 시뮬레이션, Snaps 보안 샌드박스
5. **AlphaWallet** — Secure Enclave 기반 하드웨어급 키 보안

## 키 관리 모범 사례 TOP 4

1. **Trust Wallet Core** — C++/Rust 레벨의 안전한 키 생성/저장/서명
2. **AlphaWallet (iOS)** — iOS Keychain + Secure Enclave 활용
3. **Coinbase Smart Wallet** — Passkey(WebAuthn) 기반 패스워드리스 키 관리
4. **Safe** — 멀티시그를 통한 키 분산 및 소셜 복구

## 트랜잭션 서명 모범 사례 TOP 4

1. **eth-infinitism** — UserOperation 서명 및 검증 파이프라인
2. **Safe Smart Account** — 다중서명 승인 워크플로우
3. **ZeroDev Kernel** — 세션 키, 위임 서명 패턴
4. **Trust Wallet Core** — 체인별 트랜잭션 직렬화 및 서명
