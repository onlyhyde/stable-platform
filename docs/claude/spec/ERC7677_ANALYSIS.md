# ERC-7677 Paymaster Proxy 분석 및 통합 가이드

## 개요

이 문서는 ERC-7677 표준과 StableNet PoC 프로젝트들 간의 관계를 분석하고, 통합 방안을 제시합니다.

---

## ERC-7677 표준이란?

**ERC-7677**은 **Paymaster 서비스를 위한 표준 JSON-RPC 인터페이스**입니다.

### 목적
- dApp과 Paymaster 서비스 간 통신 표준화
- 다양한 Paymaster 구현체에 대한 일관된 API 제공
- 가스 스폰서링 정책 관리 및 검증

### 핵심 RPC 메서드

| 메서드 | 용도 |
|--------|------|
| `pm_getPaymasterStubData` | 가스 추정용 stub 데이터 조회 |
| `pm_getPaymasterData` | 트랜잭션 실행용 실제 paymaster 데이터 조회 |

### 아키텍처 흐름

```
┌─────────────┐    ERC-7677    ┌─────────────────┐    ┌─────────────────┐
│   dApp      │ ◄───────────► │  ERC7677-proxy  │ ◄──│  Paymaster      │
│  (Frontend) │    표준 API    │  (중개 서버)     │    │  (on-chain)     │
└─────────────┘               └─────────────────┘    └─────────────────┘
```

---

## 프로젝트별 분석

### 1. erc7677-proxy (현재 위치: `paymaster/erc7677-proxy/`)

**역할**: API 통신 계층 (JSON-RPC 프록시 서버)

**기술 스택**:
- Hono 4.3 (웹 프레임워크)
- viem 2.40 (이더리움 클라이언트)
- permissionless 0.3 (Account Abstraction 유틸리티)
- Zod 4.1 (스키마 검증)

**주요 기능**:
- JSON-RPC 요청 검증 및 라우팅
- 다중 체인 지원 (Chain ID 화이트리스트)
- EntryPoint 버전 관리 (0.6, 0.7, 0.8)
- 스폰서십 정책 검증
- Pimlico Paymaster 서비스 연동

**현재 상태**: Pimlico 연동용으로 구성됨, 자체 Paymaster 연동을 위한 수정 필요

---

### 2. stable-poc-contract

**역할**: 온체인 스마트 컨트랙트

**Paymaster 구현체**:

| 구현체 | 파일 | 기능 |
|--------|------|------|
| **VerifyingPaymaster** | `src/paymaster/VerifyingPaymaster.sol` | 오프체인 서명 검증 기반 가스 스폰서링 |
| **ERC20Paymaster** | `src/paymaster/ERC20Paymaster.sol` | ERC-20 토큰으로 가스비 지불 |

**지원 표준**:
- ERC-4337 (Account Abstraction)
- EIP-7702 (EOA → Smart Account 위임)
- ERC-7579 (모듈러 스마트 계정)
- EIP-5564 (스텔스 주소)

---

### 3. stable-platform

**역할**: 설계 문서 및 아키텍처 명세

**상태**: 코드 없음, 문서만 존재

**권장사항**: ERC-7677 API 계층을 아키텍처 문서에 포함

---

## ERC7677-proxy 필요성 분석

### stable-poc-contract

| 관점 | 필요 여부 | 이유 |
|------|----------|------|
| 스마트 컨트랙트 | ❌ 불필요 | 온체인 로직과 무관 |
| 프론트엔드 통합 | ✅ 유용 | 표준화된 API로 paymaster 연동 |
| 외부 번들러 연동 | ✅ 유용 | ERC-7677 규격 기대하는 서비스 사용 시 |
| 멀티체인 지원 | ✅ 유용 | 단일 엔드포인트로 여러 체인 관리 |

### stable-platform

| 관점 | 필요 여부 | 이유 |
|------|----------|------|
| 아키텍처 설계 | ✅ 권장 | KRW 가스 스폰서링 서비스 표준 인터페이스 |
| dApp 개발자 지원 | ✅ 권장 | 일관된 API 제공으로 개발 편의성 향상 |

---

## 권장 통합 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    StableNet Ecosystem                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────┐        ┌────────────────┐                   │
│   │  dApp     │───────▶│ ERC7677-proxy  │                   │
│   │  (React)  │ JSON   │ (표준 API)     │                   │
│   └───────────┘ -RPC   └───────┬────────┘                   │
│                                │                             │
│                    ┌───────────┴───────────┐                │
│                    ▼                       ▼                │
│        ┌──────────────────┐    ┌──────────────────┐        │
│        │VerifyingPaymaster│    │  ERC20Paymaster  │        │
│        │ (무료 스폰서링)   │    │ (KRW로 가스비)  │        │
│        └──────────────────┘    └──────────────────┘        │
│                         │                                   │
│                         ▼                                   │
│               ┌──────────────────┐                         │
│               │    EntryPoint    │                         │
│               │   (ERC-4337)     │                         │
│               └──────────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 다음 단계

### Phase 1: 기본 통합
1. [ ] erc7677-proxy를 자체 Paymaster(VerifyingPaymaster, ERC20Paymaster)와 연동하도록 수정
2. [ ] StableNet 체인 ID 및 EntryPoint 주소 설정

### Phase 2: 기능 확장
1. [ ] KRW 토큰 기반 가스비 정책 구현
2. [ ] 스폰서십 정책 커스터마이징 (사용자별, dApp별)
3. [ ] 인증/인가 미들웨어 추가 (Bearer token, JWT 등)

### Phase 3: 운영 준비
1. [ ] stable-platform 문서에 ERC-7677 API 계층 명시
2. [ ] 프론트엔드 SDK에서 ERC-7677 표준 API 사용
3. [ ] 모니터링 및 로깅 구성

---

## 파일 구조

```
poc/
├── paymaster/
│   └── erc7677-proxy/          # ERC-7677 프록시 서버
│       ├── api/                # Vercel serverless 함수
│       ├── src/                # 소스 코드
│       │   ├── app.ts          # 메인 애플리케이션
│       │   ├── env.ts          # 환경 변수
│       │   ├── providers.ts    # Pimlico 연동
│       │   └── schemas/        # Zod 스키마
│       └── package.json
│
├── stable-poc-contract/        # 온체인 컨트랙트
│   └── src/paymaster/
│       ├── VerifyingPaymaster.sol
│       └── ERC20Paymaster.sol
│
├── stable-platform/            # 설계 문서
│   └── docs/
│
└── docs/
    └── ERC7677_ANALYSIS.md     # 본 문서
```

---

## 참고 자료

- [ERC-7677 Specification](https://eips.ethereum.org/EIPS/eip-7677)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [permissionless.js](https://docs.pimlico.io/permissionless)
