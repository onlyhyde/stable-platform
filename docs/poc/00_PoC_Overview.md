# StableNet PoC 종합 설계서

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. Executive Summary

StableNet PoC는 **EIP-7702 기반 Account Abstraction**을 핵심으로 하는 **블록체인 금융 시스템** 전체를 구축하는 프로젝트입니다. 웹 기반 우선 전략으로 결제, DeFi, 프라이버시, 크로스체인 기능을 포함한 완전한 금융 인프라를 구현합니다.

### 1.1 프로젝트 목표

| 목표 | 설명 |
|------|------|
| **Account Abstraction** | EIP-7702 + ERC-4337 기반 Smart Account 구현 |
| **가스비 추상화** | Paymaster를 통한 가스비 대납 및 토큰 결제 |
| **모듈형 계정** | ERC-7579 모듈 시스템으로 확장 가능한 계정 |
| **DeFi 인프라** | Uniswap V3 기반 DEX 및 스왑 기능 |
| **프라이버시** | ERC-5564 Stealth Address로 프라이버시 보호 |
| **정기 결제** | ERC-7715/7710 기반 구독 및 자동 결제 |
| **크로스체인** | 보안 강화된 Bridge로 자산 이동 |
| **규제 준수** | 기업용 급여 지급, 감사 기능 지원 |

### 1.2 핵심 기능 범위

```
┌────────────────────────────────────────────────────────────────────┐
│                    StableNet PoC 8대 핵심 기능                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. EOA → Smart Account 전환 ─────────────────────── EIP-7702      │
│                                                                     │
│  2. 가스비 대납 (Paymaster) ──────────────────────── ERC-4337      │
│                                                                     │
│  3. 토큰으로 가스비 지불 ─────────────────────────── Paymaster+DEX │
│                                                                     │
│  4. 정기 구독 결제 ───────────────────────────────── ERC-7715/7710 │
│                                                                     │
│  5. Plugin형 권한 부여 ───────────────────────────── ERC-7579      │
│                                                                     │
│  6. DEX 지원 ─────────────────────────────────────── Uniswap V3    │
│                                                                     │
│  7. Bundler 지원 ─────────────────────────────────── ERC-4337      │
│                                                                     │
│  8. Stealth Addresses ────────────────────────────── EIP-5564      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Use Cases

### 2.1 일반 사용자 (End User)

| Use Case | 설명 | 관련 기능 |
|----------|------|----------|
| **간편 결제** | QR 코드로 원화 스테이블코인 결제 | Smart Account, Paymaster |
| **가스비 없는 전송** | 가맹점이 가스비 대납 | ERC-4337 Paymaster |
| **토큰으로 가스비** | USDT로 가스비 지불 | ERC20Paymaster, DEX |
| **정기 구독** | 넷플릭스 등 월 구독 자동 결제 | ERC-7715/7710 |
| **프라이버시 송금** | 거래 내역 비공개 전송 | Stealth Address |

### 2.2 가맹점 (Merchant)

| Use Case | 설명 | 관련 기능 |
|----------|------|----------|
| **결제 수신** | 고객 결제 수신 및 즉시 정산 | Smart Account |
| **구독 설정** | 정기 결제 상품 등록 | Subscription Module |
| **가스비 스폰서** | 고객 가스비 대납 설정 | ERC-7677 Proxy |
| **수익 관리** | 정산 및 출금 관리 | dApp |

### 2.3 기업 (Enterprise)

| Use Case | 설명 | 관련 기능 |
|----------|------|----------|
| **급여 지급** | 직원 급여 일괄 전송 (프라이버시 보호) | Stealth Address, Batch |
| **경비 관리** | 부서별 예산 관리 및 자동 지급 | Sub-Account, Spending Limit |
| **감사 대응** | 규제 기관 요청 시 내역 제공 | Audit Log |
| **자산 이동** | 다른 체인에서 자산 이동 | Secure Bridge |

### 2.4 개발자 (Developer)

| Use Case | 설명 | 관련 기능 |
|----------|------|----------|
| **dApp 개발** | 결제 연동 dApp 개발 | SDK |
| **모듈 개발** | ERC-7579 모듈 개발 및 배포 | Module System |
| **Paymaster 운영** | 가스비 대납 서비스 운영 | Paymaster, 7677 Proxy |

---

## 3. 기술 스택 요약

### 3.1 Blockchain Layer

| 구성요소 | 기술 | 비고 |
|----------|------|------|
| **Chain** | go-stablenet (go-ethereum fork) | EIP-7702 지원 |
| **Consensus** | WBFT (QBFT 기반) | 1초 블록, 즉시 완결성 |
| **Contract Language** | Solidity 0.8.20+ | Foundry Framework |

### 3.2 Backend Layer

| 서비스 | 기술 | 역할 |
|--------|------|------|
| **Bundler** | TypeScript + Fastify | UserOp 처리 |
| **Stealth Server** | Rust + Actix | 프라이버시 인덱싱 |
| **7677 Proxy** | TypeScript + Fastify | Paymaster 라우팅 |
| **Smart Order Router** | TypeScript + Fastify | DEX 최적 경로 |
| **Subscription Executor** | TypeScript + Bull | 정기 결제 |
| **Simulators** | Go + Gin | Bank, PG, On-Ramp |

### 3.3 Frontend Layer

| 컴포넌트 | 기술 | 역할 |
|----------|------|------|
| **Wallet Extension** | React + TypeScript + Vite | Chrome 확장 지갑 |
| **dApps** | Next.js 14 + wagmi + viem | 결제, DeFi, 기업용 |
| **Marketplace** | Next.js 14 | 모듈 탐색/설치 |
| **SDK** | TypeScript | 개발자 도구 |

---

## 4. 개발 일정 요약

| Phase | 기간 | 주요 산출물 |
|-------|------|------------|
| **Phase 0** | Week 1-4 | 인프라, EntryPoint, SmartAccount |
| **Phase 1** | Week 5-8 | Kernel, Paymaster, Bundler, Wallet |
| **Phase 2** | Week 9-11 | Uniswap V3, DEX dApp |
| **Phase 3** | Week 12-14 | Stealth, Privacy, Enterprise dApp |
| **Phase 4** | Week 15-17 | Subscription, PG 연동 |
| **Phase 5** | Week 18-21 | Bridge, On-Ramp, Marketplace |
| **Phase 6** | Week 22-24 | 통합 테스트, 문서화 |

**총 개발 기간: 24주 (약 6개월)**

---

## 5. 산출물 목록

### 5.1 소프트웨어 산출물

| 카테고리 | 산출물 | 수량 |
|----------|--------|------|
| **Smart Contracts** | Core, Modules, Paymaster, DeFi, Privacy, Subscription, Bridge | 40+ |
| **Backend Services** | Bundler, Stealth, 7677 Proxy, Router, Executor, Simulators | 9 |
| **Frontend Apps** | Extension, Payment dApp, DeFi dApp, Enterprise dApp, Marketplace | 5 |
| **SDK** | TypeScript SDK | 1 |

### 5.2 문서 산출물

| 문서 | 설명 |
|------|------|
| **PRD** | 제품 요구사항 명세서 |
| **IA** | 정보 아키텍처 |
| **Development Guide** | 개발자 가이드 |
| **API Reference** | API 문서 |
| **Security Guidelines** | 보안 가이드라인 |

---

## 6. 제외 범위 (Out of Scope)

| 항목 | 이유 | 향후 계획 |
|------|------|----------|
| **ZK Privacy** | 복잡도 높음 | Mainnet 이후 R&D |
| **Mobile App** | Web 우선 전략 | Phase 2 이후 |
| **Multi-chain Bridge** | PoC는 단일 체인 우선 | Mainnet 이후 확장 |
| **Hardware Wallet** | 우선순위 낮음 | 추후 지원 |

---

## 7. 리스크 및 완화 방안

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|----------|
| EIP-7702 호환성 | 높음 | DevNet에서 철저히 검증 |
| 복잡도 증가 | 중간 | 모듈별 독립 개발, 점진적 통합 |
| 일정 지연 | 중간 | 2주 버퍼, 우선순위 조정 |
| 보안 취약점 | 높음 | 내부 리뷰, 외부 감사 계획 |

---

## 8. 관련 문서

- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [03_Development_Roadmap.md](./03_Development_Roadmap.md) - 개발 로드맵
- [04_Secure_Bridge.md](./04_Secure_Bridge.md) - 보안 브릿지 아키텍처
- [05_Project_Structure.md](./05_Project_Structure.md) - 프로젝트 디렉토리 구조
- [06_PRD_Framework.md](./06_PRD_Framework.md) - PRD 프레임워크
- [07_IA_Framework.md](./07_IA_Framework.md) - IA 프레임워크

---

*문서 끝*
