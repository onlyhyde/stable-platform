# StableNet 정보 아키텍처 (IA) 문서

> **문서 버전**: 1.0
> **작성일**: 2025-01-09
> **작성자**: CTO Office
> **상태**: Draft for Review

---

## 1. 개요

### 1.1 문서 목적
본 문서는 StableNet 블록체인 플랫폼의 정보 아키텍처를 정의합니다. 시스템 구성요소 간의 관계, 데이터 흐름, 통신 패턴을 명세하여 구현의 기준을 제공합니다.

### 1.2 범위
- 전체 시스템 아키텍처
- 모듈별 상세 설계
- 데이터 모델 및 흐름
- 통신 프로토콜 및 인터페이스
- 보안 아키텍처
- 배포 아키텍처

---

## 2. 시스템 컨텍스트

### 2.1 시스템 컨텍스트 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            External Context                                      │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Banking   │  │  Chainalysis│  │   Certik    │  │  External   │            │
│  │   Systems   │  │    KYT      │  │   Skynet    │  │   Chains    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                │                    │
│         ▼                ▼                ▼                ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          StableNet Platform                              │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                     Application Services                         │   │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │   │
│  │  │  │  Minter   │ │ Governance│ │  Bridge   │ │  Wallet   │       │   │   │
│  │  │  │  Service  │ │  Service  │ │  Relayer  │ │  Service  │       │   │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                  │                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                     StableNet Blockchain                         │   │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │   │
│  │  │  │   WBFT    │ │   EVM     │ │  System   │ │  State    │       │   │   │
│  │  │  │ Consensus │ │  Runtime  │ │ Contracts │ │  Storage  │       │   │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│         ▲                ▲                ▲                ▲                    │
│         │                │                │                │                    │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐            │
│  │   Minters   │  │  End Users  │  │  Merchants  │  │ Developers  │            │
│  │(금융기관)   │  │ (일반사용자)│  │  (가맹점)   │  │ (DApp 개발) │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 주요 액터

| 액터 | 설명 | 상호작용 |
|------|------|----------|
| End Users | 일반 사용자 | Wallet App, DApps |
| Minters | 금융기관 (발행자) | Minter API, Admin Console |
| Merchants | 가맹점 | Payment API, SDK |
| Developers | DApp 개발자 | Public RPC, SDK |
| Validators | 검증자 노드 운영자 | Node Operation |
| Regulators | 규제 기관 | Compliance API |
| Banking Systems | 은행 시스템 | Deposit/Withdrawal API |
| Compliance Services | Chainalysis, Certik | Monitoring API |
| External Chains | Ethereum, Base 등 | Bridge Protocol |

---

## 3. 논리적 아키텍처

### 3.1 레이어 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 Layer Architecture                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Layer 1: Presentation Layer                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Mobile App │  │   Web App   │  │  Explorer   │  │ Admin Portal│    │   │
│  │  │(React Native│  │   (React)   │  │  (Next.js)  │  │  (React)    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 2: API Gateway Layer                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │   │
│  │  │                        Kong API Gateway                            │ │   │
│  │  │  • Rate Limiting  • Authentication  • Load Balancing  • Routing   │ │   │
│  │  └───────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 3: Application Service Layer                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│  │  │ Minter  │ │Governance│ │ Bridge  │ │ Wallet  │ │Compliance│          │   │
│  │  │ Service │ │ Service │ │ Relayer │ │ Service │ │ Engine  │          │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│  │  │ Indexer │ │Notifier │ │ Secret  │ │ Pricing │ │Analytics │          │   │
│  │  │ Service │ │ Service │ │Transfer │ │ Oracle  │ │ Service │          │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 4: Domain Layer                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │   Minting   │ │  Governance │ │   Bridge    │ │   Account   │       │   │
│  │  │   Domain    │ │   Domain    │ │   Domain    │ │   Domain    │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 5: Blockchain Layer                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                      StableNet Node                              │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │   │
│  │  │  │  WBFT   │ │   EVM   │ │ EIP-7702│ │ System  │ │  State  │  │   │   │
│  │  │  │Consensus│ │ Runtime │ │   AA    │ │Contracts│ │ Storage │  │   │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 6: Data Layer                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │ PostgreSQL  │ │    Redis    │ │   Kafka     │ │Elasticsearch│       │   │
│  │  │   (OLTP)    │ │   (Cache)   │ │  (Events)   │ │  (Search)   │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  Layer 7: Infrastructure Layer                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │  AWS EKS    │ │  CloudHSM   │ │   Nitro     │ │   Vault     │       │   │
│  │  │(Kubernetes) │ │   (HSM)     │ │   (TEE)     │ │  (Secrets)  │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 컴포넌트 다이어그램

#### 3.2.1 Minter System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Minter System Components                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  External Systems                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                             │
│  │   Banking   │  │   Certik    │  │  Chainalysis│                             │
│  │     API     │  │   Skynet    │  │     KYT     │                             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                             │
│         │                │                │                                      │
│         ▼                ▼                ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Minter Service                                   │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                      API Layer (REST + gRPC)                     │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │  Minter API │  │  Mint API   │  │  Burn API   │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                     Use Case Layer                               │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │  Register   │  │  Process    │  │  Process    │             │   │   │
│  │  │  │   Minter    │  │    Mint     │  │    Burn     │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │   Verify    │  │   Check     │  │   Generate  │             │   │   │
│  │  │  │    KYC      │  │    AML      │  │    PoR      │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Repository Layer                              │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │   Minter    │  │    Mint     │  │    Burn     │             │   │   │
│  │  │  │    Repo     │  │    Repo     │  │    Repo     │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  └──────────────────────────────────────────────────────────────────────────│   │
│         │                       │                       │                       │
│         ▼                       ▼                       ▼                       │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐              │
│  │ PostgreSQL  │         │    Redis    │         │    Kafka    │              │
│  └─────────────┘         └─────────────┘         └─────────────┘              │
│                                 │                                               │
│                                 ▼                                               │
│                          ┌─────────────┐                                        │
│                          │  StableNet  │                                        │
│                          │  Blockchain │                                        │
│                          └─────────────┘                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Wallet System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Wallet System Components                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          Wallet Application                              │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                       UI Components                              │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │   Normal    │  │   Smart     │  │   Secret    │             │   │   │
│  │  │  │  Wallet UI  │  │  Wallet UI  │  │  Wallet UI  │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                     State Management                             │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │   Account   │  │Transaction  │  │   Settings  │             │   │   │
│  │  │  │    Store    │  │   Store     │  │    Store    │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │                      Service Layer                               │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │   │
│  │  │  │   Wallet    │  │Transaction  │  │   DApp      │             │   │   │
│  │  │  │   Service   │  │   Service   │  │   Bridge    │             │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│  ┌────────────────────────────────────┼────────────────────────────────────┐   │
│  │                                    │                                     │   │
│  │  ┌─────────────┐            ┌──────┴──────┐            ┌─────────────┐ │   │
│  │  │   Smart     │            │   Public    │            │   Secret    │ │   │
│  │  │   Wallet    │            │    RPC      │            │   Transfer  │ │   │
│  │  │   Server    │            │   (JSON)    │            │   Server    │ │   │
│  │  └──────┬──────┘            └─────────────┘            └──────┬──────┘ │   │
│  │         │                                                      │        │   │
│  │         │                                                      │        │   │
│  │  ┌──────┴──────┐                                        ┌──────┴──────┐│   │
│  │  │   Vault     │                                        │   HSM       ││   │
│  │  │  (Keys)     │                                        │ (ViewKeys)  ││   │
│  │  └─────────────┘                                        └─────────────┘│   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│                                ┌──────┴──────┐                                  │
│                                │  StableNet  │                                  │
│                                │  Blockchain │                                  │
│                                └─────────────┘                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 Bridge System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Bridge System Components                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  StableNet Side                              Target Chain Side                   │
│  ┌─────────────────────────────┐            ┌─────────────────────────────┐    │
│  │                             │            │                             │    │
│  │  ┌───────────────────────┐ │            │ ┌───────────────────────┐  │    │
│  │  │   StableNet Bridge    │ │            │ │   Remote Bridge       │  │    │
│  │  │      Contract         │ │            │ │     Contract          │  │    │
│  │  │                       │ │            │ │                       │  │    │
│  │  │  • bridgeOut()        │ │◄──────────►│ │  • mint()             │  │    │
│  │  │  • bridgeIn()         │ │            │ │  • burn()             │  │    │
│  │  │  • verifyProof()      │ │   Relayer  │ │  • verifyProof()      │  │    │
│  │  └───────────────────────┘ │   Network  │ └───────────────────────┘  │    │
│  │                             │            │                             │    │
│  │  ┌───────────────────────┐ │            │ ┌───────────────────────┐  │    │
│  │  │   StableNet Node      │ │            │ │   Target Chain Node   │  │    │
│  │  │                       │ │            │ │   (Ethereum, Base..)  │  │    │
│  │  └───────────────────────┘ │            │ └───────────────────────┘  │    │
│  │                             │            │                             │    │
│  └─────────────────────────────┘            └─────────────────────────────┘    │
│                    │                                       │                    │
│                    └───────────────────┬───────────────────┘                    │
│                                        │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Bridge Relayer Network                           │   │
│  │                                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Relayer 1  │  │  Relayer 2  │  │  Relayer 3  │  │  Relayer N  │    │   │
│  │  │  (Active)   │  │  (Active)   │  │  (Active)   │  │  (Standby)  │    │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘    │   │
│  │         │                │                │                             │   │
│  │         └────────────────┼────────────────┘                             │   │
│  │                          │                                              │   │
│  │                   ┌──────┴──────┐                                       │   │
│  │                   │  Threshold  │                                       │   │
│  │                   │  Signature  │                                       │   │
│  │                   │   (3/5)     │                                       │   │
│  │                   └──────┬──────┘                                       │   │
│  │                          │                                              │   │
│  │  ┌───────────────────────┴────────────────────────────────────────┐    │   │
│  │  │                    Relayer Components                           │    │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │    │   │
│  │  │  │   Event     │ │   Proof     │ │Transaction  │              │    │   │
│  │  │  │  Listener   │ │  Generator  │ │ Submitter   │              │    │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘              │    │   │
│  │  └────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 데이터 아키텍처

### 4.1 데이터 모델 (Entity-Relationship)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Core Data Model                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────┐           ┌───────────────┐           ┌───────────────┐     │
│  │    Minter     │           │  MintRequest  │           │  BurnRequest  │     │
│  ├───────────────┤           ├───────────────┤           ├───────────────┤     │
│  │ id            │1─────────*│ id            │           │ id            │     │
│  │ address       │           │ minter_id     │           │ minter_id     │     │
│  │ name          │           │ recipient     │           │ amount        │     │
│  │ status        │           │ amount        │           │ status        │     │
│  │ mint_limit    │           │ proof_of_res  │           │ tx_hash       │     │
│  │ total_minted  │           │ deposit_tx    │           │ created_at    │     │
│  │ total_burned  │           │ status        │           │ completed_at  │     │
│  │ registered_at │           │ chain_tx_hash │           └───────────────┘     │
│  └───────────────┘           │ created_at    │                                  │
│         │                    └───────────────┘                                  │
│         │                                                                        │
│         │                    ┌───────────────┐           ┌───────────────┐     │
│         │                    │   Proposal    │           │     Vote      │     │
│         │                    ├───────────────┤           ├───────────────┤     │
│         │                    │ id            │1─────────*│ id            │     │
│         │                    │ proposer      │           │ proposal_id   │     │
│         │                    │ gov_type      │           │ voter         │     │
│         │                    │ description   │           │ vote_type     │     │
│         │                    │ call_data     │           │ voted_at      │     │
│         │                    │ status        │           └───────────────┘     │
│         │                    │ for_votes     │                                  │
│         │                    │ against_votes │                                  │
│         │                    │ created_at    │                                  │
│         │                    └───────────────┘                                  │
│         │                                                                        │
│         │    ┌───────────────┐           ┌───────────────┐                     │
│         │    │  BlacklistEn  │           │ AuthorizedAcc │                     │
│         │    ├───────────────┤           ├───────────────┤                     │
│         │    │ id            │           │ id            │                     │
│         │    │ address       │           │ address       │                     │
│         │    │ reason        │           │ priority_lvl  │                     │
│         │    │ blocked_by    │           │ authorized_at │                     │
│         │    │ blocked_at    │           │ authorized_by │                     │
│         │    │ is_active     │           │ is_active     │                     │
│         │    └───────────────┘           └───────────────┘                     │
│         │                                                                        │
│  ┌──────┴────────┐           ┌───────────────┐                                 │
│  │  BridgeTx     │           │  StealthAddr  │                                 │
│  ├───────────────┤           ├───────────────┤                                 │
│  │ id            │           │ id            │                                 │
│  │ direction     │           │ owner_id      │                                 │
│  │ source_chain  │           │ stealth_addr  │                                 │
│  │ target_chain  │           │ balance       │                                 │
│  │ sender        │           │ created_at    │                                 │
│  │ recipient     │           │ spent_at      │                                 │
│  │ amount        │           └───────────────┘                                 │
│  │ source_tx     │                                                              │
│  │ target_tx     │                                                              │
│  │ status        │                                                              │
│  │ created_at    │                                                              │
│  └───────────────┘                                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 데이터 흐름

#### 4.2.1 Mint Flow
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Mint Data Flow                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   User          Bank           Minter          Governance       Blockchain      │
│    │             │            Service           Service           Node          │
│    │             │               │                │                │            │
│    │  1. Deposit │               │                │                │            │
│    │────────────►│               │                │                │            │
│    │             │               │                │                │            │
│    │             │ 2. Notify     │                │                │            │
│    │             │──────────────►│                │                │            │
│    │             │               │                │                │            │
│    │             │               │ 3. Verify SoF  │                │            │
│    │             │               │◄──────────────►│                │            │
│    │             │               │                │                │            │
│    │             │               │ 4. Create PoR  │                │            │
│    │             │               │───────────────►│                │            │
│    │             │               │                │                │            │
│    │             │               │         5. Multi-sig Approval   │            │
│    │             │               │                │◄──────────────►│            │
│    │             │               │                │                │            │
│    │             │               │                │ 6. Mint TX     │            │
│    │             │               │                │───────────────►│            │
│    │             │               │                │                │            │
│    │             │               │                │    7. Confirm  │            │
│    │◄─────────────────────────────────────────────────────────────│            │
│    │             │               │                │                │            │
│                                                                                  │
│  Data Objects:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  D1: DepositNotification { amount, account, bank_ref }                   │   │
│  │  D2: MintRequest { recipient, amount, deposit_proof }                    │   │
│  │  D3: SoFResult { verified: bool, source: string }                        │   │
│  │  D4: ProofOfReserve { hash, certik_attestation }                         │   │
│  │  D5: GovernanceApproval { signatures[], quorum_met }                     │   │
│  │  D6: MintTransaction { tx_hash, block_number, status }                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Bridge Flow
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Bridge Data Flow (Out)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   User        StableNet       Bridge         Relayer        Target Chain        │
│    │           Node          Contract        Network           Node             │
│    │             │               │               │                │             │
│    │ 1. Request  │               │               │                │             │
│    │────────────►│               │               │                │             │
│    │             │               │               │                │             │
│    │             │ 2. Burn TX    │               │                │             │
│    │             │──────────────►│               │                │             │
│    │             │               │               │                │             │
│    │             │        3. Emit Event          │                │             │
│    │             │               │──────────────►│                │             │
│    │             │               │               │                │             │
│    │             │               │     4. Verify & Sign           │             │
│    │             │               │               │◄──────────────►│             │
│    │             │               │               │                │             │
│    │             │               │               │ 5. Mint TX     │             │
│    │             │               │               │───────────────►│             │
│    │             │               │               │                │             │
│    │         6. Confirmation                                      │             │
│    │◄────────────────────────────────────────────────────────────│             │
│    │             │               │               │                │             │
│                                                                                  │
│  Data Objects:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  D1: BridgeRequest { amount, target_chain, target_address }              │   │
│  │  D2: BurnEvent { request_id, amount, target_info }                       │   │
│  │  D3: RelayProof { source_tx, merkle_proof, signatures[] }                │   │
│  │  D4: MintExecution { recipient, amount, proof_verified }                 │   │
│  │  D5: Confirmation { source_tx, target_tx, status }                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 통신 아키텍처

### 5.1 프로토콜 매트릭스

| Source | Target | Protocol | Format | Auth |
|--------|--------|----------|--------|------|
| Mobile App | API Gateway | HTTPS | JSON | JWT |
| Web App | API Gateway | HTTPS | JSON | JWT |
| API Gateway | Minter Service | gRPC | Protobuf | mTLS |
| API Gateway | Public RPC | HTTP | JSON-RPC | API Key |
| Minter Service | PostgreSQL | TCP | Binary | Password |
| Minter Service | Redis | TCP | RESP | Password |
| Minter Service | Kafka | TCP | Binary | SASL |
| Minter Service | StableNet Node | HTTP | JSON-RPC | None |
| Bridge Relayer | StableNet Node | WS | JSON-RPC | None |
| Bridge Relayer | Target Node | WS | JSON-RPC | None |
| Bridge Relayer | HSM | PKCS#11 | Binary | Certificate |
| Secret Transfer | StableNet Node | HTTP | JSON-RPC | None |
| Secret Transfer | HSM | PKCS#11 | Binary | Certificate |
| Services | Vault | HTTPS | JSON | Token |
| Services | Certik API | HTTPS | JSON | API Key |
| Services | Chainalysis API | HTTPS | JSON | API Key |

### 5.2 API 계약

#### 5.2.1 gRPC Service Definitions
```protobuf
// governance_service.proto
syntax = "proto3";

package stablenet.governance.v1;

service GovernanceService {
  // Proposal Management
  rpc CreateProposal(CreateProposalRequest) returns (CreateProposalResponse);
  rpc GetProposal(GetProposalRequest) returns (GetProposalResponse);
  rpc ListProposals(ListProposalsRequest) returns (ListProposalsResponse);

  // Voting
  rpc CastVote(CastVoteRequest) returns (CastVoteResponse);
  rpc GetVotes(GetVotesRequest) returns (GetVotesResponse);

  // Execution
  rpc ExecuteProposal(ExecuteProposalRequest) returns (ExecuteProposalResponse);
  rpc CancelProposal(CancelProposalRequest) returns (CancelProposalResponse);

  // Governance Info
  rpc GetGovernanceInfo(GetGovernanceInfoRequest) returns (GetGovernanceInfoResponse);
  rpc GetMemberInfo(GetMemberInfoRequest) returns (GetMemberInfoResponse);
}

message CreateProposalRequest {
  GovernanceType gov_type = 1;
  string description = 2;
  bytes call_data = 3;
  uint64 voting_period = 4;
}

message Proposal {
  string id = 1;
  address proposer = 2;
  GovernanceType gov_type = 3;
  string description = 4;
  bytes call_data = 5;
  ProposalStatus status = 6;
  uint64 for_votes = 7;
  uint64 against_votes = 8;
  uint64 abstain_votes = 9;
  int64 start_time = 10;
  int64 end_time = 11;
  bool executed = 12;
}

enum GovernanceType {
  GOV_TYPE_UNSPECIFIED = 0;
  GOV_TYPE_COUNCIL = 1;
  GOV_TYPE_VALIDATOR = 2;
  GOV_TYPE_MASTER_MINTER = 3;
  GOV_TYPE_MINTER = 4;
}

enum ProposalStatus {
  PROPOSAL_STATUS_UNSPECIFIED = 0;
  PROPOSAL_STATUS_PENDING = 1;
  PROPOSAL_STATUS_ACTIVE = 2;
  PROPOSAL_STATUS_CANCELED = 3;
  PROPOSAL_STATUS_DEFEATED = 4;
  PROPOSAL_STATUS_SUCCEEDED = 5;
  PROPOSAL_STATUS_QUEUED = 6;
  PROPOSAL_STATUS_EXECUTED = 7;
}
```

#### 5.2.2 REST API OpenAPI Spec
```yaml
openapi: 3.0.3
info:
  title: StableNet Bridge API
  version: 1.0.0

paths:
  /v1/bridge/out:
    post:
      summary: Initiate Bridge Out
      operationId: bridgeOut
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BridgeOutRequest'
      responses:
        '200':
          description: Bridge request created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BridgeResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized

  /v1/bridge/status/{requestId}:
    get:
      summary: Get Bridge Status
      operationId: getBridgeStatus
      parameters:
        - name: requestId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Bridge status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BridgeStatus'

components:
  schemas:
    BridgeOutRequest:
      type: object
      required:
        - amount
        - targetChainId
        - targetAddress
      properties:
        amount:
          type: string
          description: Amount in wei
        targetChainId:
          type: integer
          description: Target chain ID
        targetAddress:
          type: string
          description: Recipient address on target chain

    BridgeResponse:
      type: object
      properties:
        requestId:
          type: string
        status:
          type: string
          enum: [pending, processing, completed, failed]
        txHash:
          type: string
        timestamp:
          type: integer

    BridgeStatus:
      type: object
      properties:
        requestId:
          type: string
        direction:
          type: string
          enum: [in, out]
        sourceChain:
          type: integer
        targetChain:
          type: integer
        amount:
          type: string
        status:
          type: string
        sourceTxHash:
          type: string
        targetTxHash:
          type: string
        createdAt:
          type: integer
        completedAt:
          type: integer

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### 5.3 이벤트 아키텍처

#### 5.3.1 Kafka Event Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MintCompleted",
  "type": "object",
  "required": ["event_id", "event_type", "timestamp", "data"],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid"
    },
    "event_type": {
      "type": "string",
      "const": "mint.completed"
    },
    "timestamp": {
      "type": "integer",
      "description": "Unix timestamp in milliseconds"
    },
    "data": {
      "type": "object",
      "required": ["request_id", "minter_address", "recipient_address", "amount", "tx_hash"],
      "properties": {
        "request_id": {
          "type": "string",
          "format": "uuid"
        },
        "minter_address": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{40}$"
        },
        "recipient_address": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{40}$"
        },
        "amount": {
          "type": "string",
          "description": "Amount in wei"
        },
        "tx_hash": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{64}$"
        },
        "block_number": {
          "type": "integer"
        },
        "proof_of_reserve": {
          "type": "string"
        }
      }
    }
  }
}
```

---

## 6. 보안 아키텍처

### 6.1 보안 레이어

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Security Architecture                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Layer 1: Perimeter Security                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │   WAF       │  │   DDoS      │  │  Rate       │  │  Geo        │    │   │
│  │  │ Protection  │  │  Protection │  │  Limiting   │  │  Blocking   │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Layer 2: Network Security                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │   VPC       │  │  Security   │  │  Network    │  │  TLS 1.3    │    │   │
│  │  │  Isolation  │  │   Groups    │  │   ACLs      │  │  Everywhere │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Layer 3: Application Security                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  OAuth 2.0  │  │   RBAC      │  │   Input     │  │   Audit     │    │   │
│  │  │  + JWT      │  │   + ABAC    │  │ Validation  │  │   Logging   │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Layer 4: Data Security                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  AES-256    │  │   HSM       │  │   Vault     │  │   TEE       │    │   │
│  │  │ Encryption  │  │   Keys      │  │   Secrets   │  │  (Nitro)    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Layer 5: Blockchain Security                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Blacklist  │  │  Multi-sig  │  │  Timelock   │  │  Contract   │    │   │
│  │  │  System     │  │  Governance │  │   Delays    │  │   Audits    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 키 관리 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Key Management Architecture                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Key Hierarchy                                     │   │
│  │                                                                          │   │
│  │                      ┌─────────────────┐                                │   │
│  │                      │   Master Key    │                                │   │
│  │                      │   (HSM Root)    │                                │   │
│  │                      └────────┬────────┘                                │   │
│  │                               │                                          │   │
│  │          ┌────────────────────┼────────────────────┐                    │   │
│  │          │                    │                    │                    │   │
│  │  ┌───────┴───────┐   ┌───────┴───────┐   ┌───────┴───────┐            │   │
│  │  │  Validator    │   │   Service     │   │   Bridge      │            │   │
│  │  │  Key (HSM)    │   │   Keys (Vault)│   │   Keys (TSS)  │            │   │
│  │  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘            │   │
│  │          │                   │                   │                      │   │
│  │  ┌───────┴───────┐   ┌───────┴───────┐   ┌───────┴───────┐            │   │
│  │  │ Block Signing │   │  API Signing  │   │ 3-of-5 Shares │            │   │
│  │  │    Keys       │   │    Keys       │   │   (Relayers)  │            │   │
│  │  └───────────────┘   └───────────────┘   └───────────────┘            │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Key Storage:                                                                    │
│  ┌─────────────────┬───────────────────────────────────────────────────────┐   │
│  │ Key Type        │ Storage Location                                      │   │
│  ├─────────────────┼───────────────────────────────────────────────────────┤   │
│  │ Master Key      │ AWS CloudHSM (FIPS 140-2 Level 3)                     │   │
│  │ Validator Keys  │ AWS CloudHSM (per validator)                          │   │
│  │ Service Keys    │ HashiCorp Vault (Transit Engine)                      │   │
│  │ Bridge Keys     │ Threshold Signature Scheme (3-of-5)                   │   │
│  │ Encryption Keys │ AWS KMS + Vault                                       │   │
│  │ User Keys       │ Client-side + Smart Wallet Server (optional)          │   │
│  │ View Keys       │ HSM (for Secret Account)                              │   │
│  └─────────────────┴───────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 접근 제어 매트릭스

| Role | Minter API | Governance API | Bridge API | Admin API | Compliance API |
|------|------------|----------------|------------|-----------|----------------|
| Anonymous | - | - | Read | - | - |
| User | - | - | Read/Write | - | - |
| Minter | Read/Write | Vote | Read/Write | - | Read |
| Validator | - | Vote/Execute | - | Read | Read |
| Council | - | Full Access | - | Read | Read |
| Admin | Read | Read | Read | Full Access | Full Access |
| Regulator | Read | Read | Read | Read | Full Access |

---

## 7. 배포 아키텍처

### 7.1 AWS 배포 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        AWS Deployment Architecture                               │
│                            (ap-northeast-2)                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           Internet                                       │   │
│  └─────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                                │
│  ┌─────────────────────────────┼───────────────────────────────────────────┐   │
│  │                      CloudFront + WAF                                    │   │
│  └─────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                                │
│  ┌──────────────────────────VPC (10.0.0.0/16)──────────────────────────────┐   │
│  │                                                                          │   │
│  │  Public Subnets (10.0.1.0/24, 10.0.2.0/24, 10.0.3.0/24)                │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐                           │   │
│  │  │    ALB    │  │    NAT    │  │  Bastion  │                           │   │
│  │  │  (Kong)   │  │  Gateway  │  │   Host    │                           │   │
│  │  └─────┬─────┘  └─────┬─────┘  └───────────┘                           │   │
│  │        │              │                                                 │   │
│  │  ──────┼──────────────┼─────────────────────────────────────────────── │   │
│  │        │              │                                                 │   │
│  │  Private Subnets (10.0.10.0/24, 10.0.11.0/24, 10.0.12.0/24)           │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │                       EKS Cluster                               │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │   │
│  │  │  │   Service   │  │   Service   │  │  Monitoring │            │   │   │
│  │  │  │ Node Group  │  │ Node Group  │  │ Node Group  │            │   │   │
│  │  │  │  (m6i.2xl)  │  │  (m6i.2xl)  │  │  (m6i.xl)   │            │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │        │                                                                │   │
│  │  ──────┼────────────────────────────────────────────────────────────── │   │
│  │        │                                                                │   │
│  │  Blockchain Subnets (10.0.30.0/24, 10.0.31.0/24, 10.0.32.0/24)        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │   │
│  │  │ Validator 1 │  │ Validator 2 │  │ Validator N │                    │   │
│  │  │  (c6i.4xl)  │  │  (c6i.4xl)  │  │  (c6i.4xl)  │                    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │   │
│  │        │                                                                │   │
│  │  ──────┼────────────────────────────────────────────────────────────── │   │
│  │        │                                                                │   │
│  │  Database Subnets (10.0.20.0/24, 10.0.21.0/24)                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │   │
│  │  │ RDS Primary │  │  RDS        │  │ElastiCache  │                    │   │
│  │  │ (r6g.xl)    │  │  Replica    │  │  (Redis)    │                    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  External Services:                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  CloudHSM   │  │     MSK     │  │     S3      │  │   Secrets   │            │
│  │   Cluster   │  │   (Kafka)   │  │  (Archive)  │  │   Manager   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Kubernetes 배포 구조

```yaml
# Namespace Structure
namespaces:
  - stablenet-system      # Core system components
  - stablenet-services    # Application services
  - stablenet-blockchain  # Blockchain nodes
  - stablenet-monitoring  # Monitoring stack
  - stablenet-ingress     # Ingress controllers

# Service Deployments
deployments:
  minter-service:
    replicas: 3
    resources:
      requests:
        memory: "512Mi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "2"
    hpa:
      minReplicas: 3
      maxReplicas: 10
      targetCPU: 70%

  bridge-relayer:
    replicas: 5  # Threshold signature requirement
    resources:
      requests:
        memory: "1Gi"
        cpu: "1"
      limits:
        memory: "4Gi"
        cpu: "4"

  indexer-service:
    replicas: 2
    resources:
      requests:
        memory: "2Gi"
        cpu: "1"
      limits:
        memory: "8Gi"
        cpu: "4"

  validator-node:
    replicas: 7  # Minimum for BFT
    nodeSelector:
      workload: blockchain
    tolerations:
      - key: "blockchain"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
    resources:
      requests:
        memory: "16Gi"
        cpu: "4"
      limits:
        memory: "64Gi"
        cpu: "16"
```

---

## 8. 모니터링 아키텍처

### 8.1 Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Observability Architecture                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           Data Sources                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Services   │  │  Blockchain │  │Infrastructure│  │   External  │    │   │
│  │  │  (Apps)     │  │   Nodes     │  │   (K8s)     │  │   APIs      │    │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │   │
│  │         │                │                │                │            │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────────┘   │
│            │                │                │                │                 │
│  ┌─────────┼────────────────┼────────────────┼────────────────┼────────────┐   │
│  │         │    Collection Layer             │                │            │   │
│  │  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐   │   │
│  │  │ Prometheus  │  │  Filebeat   │  │   Jaeger    │  │  Custom     │   │   │
│  │  │  (Metrics)  │  │   (Logs)    │  │  (Traces)   │  │  Exporters  │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │   │
│  │         │                │                │                │           │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼───────────┘   │
│            │                │                │                │                │
│  ┌─────────┼────────────────┼────────────────┼────────────────┼───────────┐   │
│  │         │    Storage Layer                │                │           │   │
│  │  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  │   │
│  │  │ Prometheus  │  │Elasticsearch│  │   Jaeger    │  │     S3      │  │   │
│  │  │   (TSDB)    │  │   (Logs)    │  │  Backend    │  │  (Archive)  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘  │   │
│  │         │                │                │                          │   │
│  └─────────┼────────────────┼────────────────┼──────────────────────────┘   │
│            │                │                │                               │
│  ┌─────────┼────────────────┼────────────────┼──────────────────────────┐   │
│  │         │   Visualization & Alerting      │                          │   │
│  │  ┌──────┴──────────────────────────────────────────────────────┐    │   │
│  │  │                        Grafana                               │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │    │   │
│  │  │  │  Dashboards │  │   Alerts    │  │  Reports    │         │    │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘         │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                              │                                        │   │
│  │                       ┌──────┴──────┐                                │   │
│  │                       │  PagerDuty  │                                │   │
│  │                       │   (Alerts)  │                                │   │
│  │                       └─────────────┘                                │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 핵심 메트릭

```yaml
Blockchain_Metrics:
  - name: "stablenet_block_height"
    type: gauge
    labels: [node]

  - name: "stablenet_tps"
    type: gauge
    labels: [node]

  - name: "stablenet_block_time_seconds"
    type: histogram
    buckets: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0]

  - name: "stablenet_consensus_round_duration"
    type: histogram
    labels: [round_type]

  - name: "stablenet_peer_count"
    type: gauge
    labels: [node]

Service_Metrics:
  - name: "minter_requests_total"
    type: counter
    labels: [status, operation]

  - name: "minter_request_duration_seconds"
    type: histogram
    labels: [operation]

  - name: "bridge_transfers_total"
    type: counter
    labels: [direction, chain, status]

  - name: "blacklist_entries_total"
    type: gauge
    labels: [reason]

Business_Metrics:
  - name: "stablenet_total_supply"
    type: gauge

  - name: "stablenet_daily_volume"
    type: gauge

  - name: "stablenet_active_minters"
    type: gauge
```

---

## 9. 재해 복구

### 9.1 DR 전략

```yaml
DR_Configuration:
  RPO: "0 (Zero Data Loss)"
  RTO: "< 1 hour"

  Backup_Strategy:
    blockchain_state:
      method: "Continuous Replication"
      frequency: "Real-time"
      retention: "Permanent"

    database:
      method: "Point-in-Time Recovery"
      frequency: "Continuous + Daily Snapshot"
      retention: "30 days"

    configuration:
      method: "GitOps"
      frequency: "On Change"
      retention: "All history"

  Failover_Regions:
    primary: "ap-northeast-2 (Seoul)"
    secondary: "ap-northeast-1 (Tokyo)"
    tertiary: "us-east-1 (Virginia)"

  Recovery_Procedures:
    blockchain_failure:
      - "Detect validator failure"
      - "Remove from consensus"
      - "Sync replacement node"
      - "Rejoin consensus"
      - "RTO: < 10 minutes"

    service_failure:
      - "Health check failure"
      - "Kubernetes restart pod"
      - "Load balancer reroute"
      - "RTO: < 1 minute"

    region_failure:
      - "Detect region unavailability"
      - "DNS failover (Route 53)"
      - "Activate DR region"
      - "Sync any pending data"
      - "RTO: < 30 minutes"
```

---

## 10. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-09 | 초안 작성 | CTO Office |

---

## 부록

### A. 다이어그램 범례
- **실선 화살표**: 동기 통신
- **점선 화살표**: 비동기 통신
- **두꺼운 박스**: 외부 시스템
- **얇은 박스**: 내부 컴포넌트

### B. 약어 정의
- **EKS**: Elastic Kubernetes Service
- **HSM**: Hardware Security Module
- **TEE**: Trusted Execution Environment
- **TSS**: Threshold Signature Scheme
- **WBFT**: Weighted Byzantine Fault Tolerance

### C. 참조 문서
- StableNet_기술_로드맵.md
- StableNet_기술_스택.md
- StableNet_PRD.md
