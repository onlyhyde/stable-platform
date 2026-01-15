# StableNet PoC 문서 검토 가이드

**문서 버전**: 1.0
**작성일**: 2026-01-15
**목적**: PoC 구현을 위한 문서 검토 순서 및 핵심 포인트 정리

---

## 목차

1. [개요](#1-개요)
2. [문서 검토 순서](#2-문서-검토-순서)
3. [PoC 구현 현황](#3-poc-구현-현황)
4. [다음 구현 대상](#4-다음-구현-대상)
5. [모노레포 구조](#5-모노레포-구조)
6. [참고 사항](#6-참고-사항)

---

## 1. 개요

### 1.1 프로젝트 목표

StableNet 블록체인 기반의 stable coin 활용 시나리오에 대한 PoC 구현:
- 지갑 (Wallet)
- 서버 (Bundler, Paymaster 등)
- 스마트 컨트랙트
- 프론트엔드

### 1.2 저장소 구조

| 저장소 | 목적 |
|--------|------|
| `stable-platform/` | 모노레포 (앱, 패키지, 문서) |
| `stable-poc-contract/` | 스마트 컨트랙트 구현 |

---

## 2. 문서 검토 순서

PoC 구현 목표에 맞춰 **컨텍스트 이해 → 기술 스펙 → 구현 참조** 순서로 정리합니다.

### 2.1 1단계: 핵심 컨텍스트 이해 (필수)

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 1 | StableNet_Key.md | `docs/` | 프로젝트 핵심 개념 및 방향성 파악 | 🔴 Critical |
| 2 | StableNet_PRD.md | `docs/prd/` | 제품 요구사항 및 기능 범위 확인 | 🔴 Critical |

**핵심 내용**:
- 원화 네이티브 L1 블록체인
- Minter 시스템 (규제 친화적 발행 구조)
- Secret Account (프라이버시 계층)
- 4계층 온체인 거버넌스

### 2.2 2단계: PoC 기술 명세 (핵심 구현 가이드)

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 3 | StableNet_SmartAccount_PoC_기술명세서.md | `docs/` | **가장 중요** - 상세 구현 명세 | 🔴 Critical |
| 4 | StableNet_기술_스택.md | `docs/specs/` | 전체 기술 스택 및 아키텍처 | 🟠 High |

**PoC 기술명세서 핵심 구현 항목**:
- EIP-7702 구현 (go-stablenet에 이미 포함)
- ERC-4337 Account Abstraction (EntryPoint, SmartAccount)
- ERC-7579 모듈러 아키텍처
- Paymaster (가스 스폰서십, 토큰 결제)
- Subscription Module (ERC-7715)
- Stealth Payment Contract (EIP-5564 기반)
- Bundler 구현
- DEX Integration (Uniswap V3)

### 2.3 3단계: 시스템 아키텍처 및 구현 레벨

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 5 | StableNet_IA.md | `docs/architecture/` | 정보 아키텍처 및 시스템 구조 | 🟠 High |
| 6 | StableNet_구현레벨_기술검토.md | `docs/` | 모듈별 기술 스택, 스마트 컨트랙트 구조 | 🟠 High |

**구현레벨 기술검토 핵심 내용**:
- 9개 핵심 모듈 식별 (M1~M9)
- Blockchain Core 기술 스택 (go-ethereum, WBFT)
- Smart Contract 구조 및 보안 체크리스트
- 서비스 간 통신 프로토콜

### 2.4 4단계: 기술 검증 및 리스크 인지

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 7 | StableNet_기술_심층검토_보고서.md | `docs/` | 기술적 실현 가능성, VASP 라이센스 요건 | 🟡 Medium |
| 8 | StableNet_신뢰성_검토_보고서.md | `docs/` | 기술/비즈니스 모델 검증, SWOT 분석 | 🟡 Medium |

**주요 인사이트**:
- EIP-7702: 2025년 5월 Pectra 업그레이드로 메인넷 라이브 ✅
- ERC-5564: Release Candidate 단계, Trail of Bits 감사 중 ⚠️
- QBFT 3000 TPS: 벤치마크상 200 TPS 수준, 검증 필요 ❌

### 2.5 5단계: 경쟁 분석 및 로드맵

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 9 | StableNet_경쟁사_차별점_분석.md | `docs/` | Arc, Tempo 등 경쟁사 대비 포지셔닝 | 🟢 Low |
| 10 | StableNet_기술_로드맵.md | `docs/roadmap/` | 24개월 개발 로드맵 (5단계) | 🟢 Low |

**경쟁사 현황 (2026년 1월)**:
| 체인 | 발행사 | 타겟 통화 | 상태 |
|------|--------|----------|------|
| Arc | Circle | USD (USDC) | 테스트넷 (2025.10) |
| Tempo | Stripe/Paradigm | 다중 스테이블코인 | 테스트넷 (2025.12) |
| Stable | Tether/Bitfinex | USD (USDT) | 개발중 |
| **StableNet** | 미공개 | **KRW (원화)** | 개발중 |

### 2.6 6단계: Tempo/Reth 참조 (선택적)

| 순서 | 문서 | 경로 | 목적 | 우선순위 |
|------|------|------|------|----------|
| 11 | tempo-reth-analysis.md | `docs/tempo-reth/` | Tempo 프로젝트 분석, Reth SDK 구조 | 🔵 Optional |
| 12 | tempo-reth-detailed-comparison.md | `docs/tempo-reth/` | Tempo vs Reth 기술 비교 | 🔵 Optional |

**Tempo 핵심 기술**:
- TIP-20 토큰 표준 (Enshrined ERC-20)
- Simplex Consensus (Sub-second finality)
- 2D Nonce 시스템 (병렬 트랜잭션 처리)
- WebAuthn/P256 서명 지원
- Reth SDK 기반 확장

---

## 3. PoC 구현 현황

### 3.1 완료된 구현 (stable-poc-contract)

| 항목 | 상태 | 파일/위치 |
|------|------|----------|
| EIP-7702 지원 | ✅ 완료 | `foundry.toml` (evm_version = "prague") |
| SmartAccountWithKernel | ✅ 완료 | `src/smart-account/SmartAccountWithKernel.sol` |
| ECDSAValidator | ✅ 완료 | `lib/kernel/` 모듈 활용 |
| Stealth Payment Contract | ✅ 완료 | `src/stealth-payment/` |
| 배포 스크립트 | ✅ 완료 | `script/DeploySmartAccount.s.sol` |

### 3.2 테스트 현황

```
테스트 결과: 26개 테스트 전체 통과
- StealthPaymentTest: 11개
- SmartAccountTest: 12개
- ECDSAValidatorTest: 3개
```

---

## 4. 다음 구현 대상

PoC 기술명세서 기준 우선순위별 구현 대상입니다.

### 4.1 Phase 1: 핵심 인프라

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| **Paymaster** | 가스 스폰서십, 토큰 결제 지원 | 🔴 Critical |
| **Bundler** | UserOperation 수집 및 EntryPoint 제출 | 🔴 Critical |

### 4.2 Phase 2: 확장 모듈

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| **Subscription Module** | ERC-7715 기반 정기 결제 | 🟠 High |
| **Session Key Module** | 임시 권한 위임 | 🟠 High |

### 4.3 Phase 3: 통합

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| **DEX Integration** | Uniswap V3 연동 | 🟡 Medium |
| **Frontend** | 지갑 UI 및 서비스 프론트엔드 | 🟡 Medium |

---

## 5. 모노레포 구조

### 5.1 권장 구조 (stable-platform)

```
stable-platform/
├── apps/
│   ├── wallet/               # 지갑 앱 (React Native / Web)
│   ├── bundler/              # Bundler 서버 (TypeScript/Go)
│   ├── paymaster/            # Paymaster 서버 (TypeScript/Go)
│   ├── relayer/              # Relayer 서버
│   └── frontend/             # 웹 프론트엔드 (Next.js)
│
├── packages/
│   ├── sdk/                  # StableNet SDK
│   ├── contracts/            # → stable-poc-contract 심링크 또는 서브모듈
│   ├── types/                # 공통 타입 정의
│   └── utils/                # 공통 유틸리티
│
├── docs/                     # 문서 (현재 위치)
│
└── tools/
    ├── scripts/              # 빌드/배포 스크립트
    └── config/               # 공통 설정 (ESLint, Prettier 등)
```

### 5.2 기술 스택 권장

| 영역 | 권장 스택 |
|------|----------|
| **Bundler** | TypeScript + ethers.js v6 또는 Go + go-ethereum |
| **Paymaster** | TypeScript + Viem 또는 Go |
| **Frontend** | Next.js 14+ + TailwindCSS + shadcn/ui |
| **Wallet** | React Native (모바일) / Vite + React (웹) |
| **SDK** | TypeScript + Viem + abitype |

---

## 6. 참고 사항

### 6.1 EVM Version 관련

현재 `foundry.toml`에 `evm_version = "prague"`가 설정되어 있으나, 라이브러리 의존성에서 경고가 발생합니다:

```
Warning: solady uses paris EVM version
Warning: singleton-paymaster uses cancun EVM version
```

이는 라이브러리의 기본 설정이며, 컴파일에는 영향 없습니다. 프로젝트 정리 시 서브모듈 최적화 예정입니다.

### 6.2 핵심 표준 참조

| 표준 | 용도 | 상태 |
|------|------|------|
| EIP-7702 | Native Account Abstraction | ✅ 메인넷 라이브 |
| ERC-4337 | Account Abstraction | ✅ 프로덕션 |
| ERC-7579 | 모듈러 Smart Account | ✅ 프로덕션 |
| EIP-5564 | Stealth Address | ⚠️ RC 단계 |
| ERC-6538 | Stealth Address Registry | ⚠️ RC 단계 |
| ERC-7715 | Subscription | ⚠️ Draft |

### 6.3 문서 디렉토리 구조

```
docs/
├── StableNet_Key.md                      # 핵심 개념
├── StableNet_SmartAccount_PoC_기술명세서.md  # PoC 상세 명세
├── StableNet_경쟁사_차별점_분석.md          # 경쟁 분석
├── StableNet_구현레벨_기술검토.md           # 구현 레벨 검토
├── StableNet_기술_심층검토_보고서.md        # 기술 심층 검토
├── StableNet_신뢰성_검토_보고서.md          # 신뢰성 검토
├── StableNet_PoC_문서검토_가이드.md         # 본 문서
│
├── architecture/
│   └── StableNet_IA.md                   # 정보 아키텍처
│
├── prd/
│   └── StableNet_PRD.md                  # 제품 요구사항
│
├── roadmap/
│   └── StableNet_기술_로드맵.md            # 24개월 로드맵
│
├── specs/
│   └── StableNet_기술_스택.md              # 기술 스택
│
└── tempo-reth/
    ├── tempo-reth-analysis.md            # Tempo/Reth 분석
    └── tempo-reth-detailed-comparison.md # 상세 비교
```

---

**문서 끝**

*본 문서는 PoC 구현 진행에 따라 지속적으로 업데이트됩니다.*
