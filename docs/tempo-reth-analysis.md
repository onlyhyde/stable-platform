# Tempo & Reth 프로젝트 분석 보고서

> 분석 일자: 2026-01-09

---

## 목차

1. [Tempo 프로젝트](#1-tempo-프로젝트)
2. [Reth 프로젝트](#2-reth-프로젝트)
3. [프로젝트 관계 분석](#3-프로젝트-관계-분석)
4. [종합 요약](#4-종합-요약)

---

## 1. Tempo 프로젝트

### 개요

**Tempo**는 대규모 스테이블코인 결제를 위해 설계된 블록체인입니다. Reth SDK 기반으로 구축되어 EVM 호환성을 유지하면서 결제에 최적화된 기능을 제공합니다.

| 속성 | 값 |
|------|-----|
| **버전** | `1.0.0-rc.1` |
| **Rust 에디션** | 2024 |
| **MSRV** | 1.91.0 |
| **라이선스** | MIT OR Apache-2.0 |
| **Chain ID** | 42429 |
| **테스트넷 RPC** | `https://rpc.testnet.tempo.xyz` |
| **블록 익스플로러** | `https://explore.tempo.xyz` |

### 핵심 특징

#### TIP-20 토큰 표준
- ERC-20 확장 표준 (enshrined)
- 전용 결제 레인으로 예측 가능한 처리량 (noisy-neighbor 문제 해결)
- 온체인 메모 및 커밋먼트 패턴 지원 (hash/locator)
- TIP-403 Policy Registry를 통한 컴플라이언스 (단일 정책, 다중 토큰 적용)

#### 수수료 구조
- USD 스테이블코인으로 직접 가스 지불
- Fee AMM을 통한 밸리데이터 선호 스테이블코인 자동 변환
- TIP-20 전송 목표 비용: <$0.001 (sub-millidollar)

#### Tempo Transactions (네이티브 스마트 계정)
- **배치 결제**: 원자적 다중 작업 (급여, 정산, 환불)
- **수수료 스폰서십**: 앱이 사용자 가스비 대납
- **예약 결제**: 프로토콜 레벨 시간 윈도우 (정기/예약 지급)
- **현대적 인증**: WebAuthn/P256 passkeys (생체 인증, Secure Enclave, 크로스 디바이스 동기화)

#### 컨센서스
- **Simplex Consensus** (Commonware 기반)
- Sub-second finality (정상 조건)
- 불안정 네트워크에서 graceful degradation

#### EVM 호환성
- Osaka 하드포크 타겟
- Solidity, Foundry, Hardhat 등 기존 도구 호환
- 모든 Ethereum JSON-RPC 메서드 지원

### Crate 구조 (19개)

```
tempo/crates/
├── alloy/                    # Alloy 라이브러리 통합
├── chainspec/                # Tempo 체인 스펙 정의
├── commonware-node/          # Commonware 노드 통합
├── commonware-node-config/   # Commonware 노드 설정
├── consensus/                # Simplex 컨센서스 구현
├── contracts/                # 스마트 컨트랙트 (TIP-20, Policy 등)
├── dkg-onchain-artifacts/    # DKG 온체인 아티팩트
├── e2e/                      # E2E 테스트
├── evm/                      # EVM 커스터마이징
├── eyre/                     # 에러 핸들링 유틸리티
├── faucet/                   # 테스트넷 Faucet
├── node/                     # 노드 빌더 및 런처
├── payload/                  # 페이로드 빌더/타입
│   ├── builder/
│   └── types/
├── precompiles/              # 커스텀 프리컴파일 (결제 최적화)
├── precompiles-macros/       # 프리컴파일 매크로
├── primitives/               # 기본 타입 정의
├── revm/                     # REVM 커스터마이징
├── telemetry-util/           # 텔레메트리 유틸리티
└── transaction-pool/         # 결제 우선순위 트랜잭션 풀
```

### 바이너리

```
tempo/bin/
├── tempo/           # 메인 노드 바이너리
├── tempo-bench/     # 벤치마크 도구
└── tempo-sidecar/   # 사이드카 서비스
```

### 주요 의존성

| 카테고리 | 패키지 | 버전/참조 |
|----------|--------|-----------|
| **Reth SDK** | `reth-*` | `d76babb2f17773f79c9cf1eda497c539bd5cf553` (reth/rc.2-cc) |
| **Commonware** | `commonware-*` | `0.0.64` → `5ca1fb0bba4f2f04bf27d1da2b68ef034dca93be` (패치) |
| **Revm** | `revm` | `33.1.0` |
| **Alloy** | `alloy-*` | `1.1.3` |
| **Alloy Primitives** | `alloy-primitives` | `1.5.0` |

### 빌드 및 실행

```bash
# 의존성 설치
just

# 빌드
just build-all

# 테스트
cargo nextest run

# 로컬넷 실행
just localnet
```

---

## 2. Reth 프로젝트

### 개요

**Reth** (Rust Ethereum)는 Paradigm이 개발한 고성능 이더리움 실행 클라이언트입니다. 모듈성, 성능, 확장성에 중점을 둡니다.

| 속성 | 값 |
|------|-----|
| **버전** | `1.9.3` |
| **Rust 에디션** | 2024 |
| **MSRV** | 1.88 |
| **라이선스** | MIT OR Apache-2.0 |
| **상태** | Production Ready (2024년 6월 1.0 릴리스) |
| **홈페이지** | https://reth.rs |
| **저장소** | https://github.com/paradigmxyz/reth |

### 설계 목표

1. **모듈성**: 모든 컴포넌트가 독립 라이브러리로 사용 가능
2. **성능**: Erigon Staged Sync 아키텍처, 병렬 처리, 최적화된 자료구조
3. **자유로운 사용**: Apache/MIT 듀얼 라이선스
4. **클라이언트 다양성**: 이더리움 네트워크 안티프래질리티 기여
5. **다중 체인 지원**: Ethereum, Optimism, Polygon, BNB Chain 등
6. **설정 가능성**: 다양한 운영 프로파일 지원

### 핵심 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                       Reth Node                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Engine    │  │   RPC API    │  │    Networking    │   │
│  │ (newPayload │  │  (JSON-RPC)  │  │   (P2P, discv4   │   │
│  │  FCU, etc)  │  │              │  │    discv5, DNS)  │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │             │
│  ┌──────┴────────────────┴────────────────────┴──────────┐  │
│  │                    Node Builder                        │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │                Pipeline (Staged Sync)                  │  │
│  │   Headers → Bodies → Senders → Execution → ...        │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │                                   │
│  ┌─────────┐  ┌──────────┴─────────┐  ┌─────────────────┐   │
│  │ EVM     │  │    Storage         │  │    Trie         │   │
│  │ (revm)  │  │ (MDBX + Static)    │  │  (Merkle PT)    │   │
│  └─────────┘  └────────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Crate 구조 (150+ crate)

#### Core Infrastructure
| Crate | 설명 |
|-------|------|
| `crates/chain-state/` | 체인 상태 관리 |
| `crates/chainspec/` | 체인 스펙 정의 |
| `crates/primitives/` | 기본 타입 |
| `crates/primitives-traits/` | 기본 trait 정의 |
| `crates/errors/` | 에러 타입 |
| `crates/config/` | 설정 관리 |

#### Storage Layer
| Crate | 설명 |
|-------|------|
| `crates/storage/db/` | MDBX 데이터베이스 |
| `crates/storage/db-api/` | DB API 추상화 |
| `crates/storage/db-common/` | DB 공통 유틸리티 |
| `crates/storage/db-models/` | DB 모델 정의 |
| `crates/storage/provider/` | 상태 프로바이더 |
| `crates/storage/libmdbx-rs/` | libmdbx Rust 바인딩 |
| `crates/storage/nippy-jar/` | 압축 아카이브 |
| `crates/storage/codecs/` | 데이터 직렬화 |
| `crates/storage/storage-api/` | 스토리지 API |
| `crates/storage/errors/` | 스토리지 에러 |
| `crates/static-file/` | 정적 파일 저장소 |

#### Execution
| Crate | 설명 |
|-------|------|
| `crates/evm/evm/` | EVM 인터페이스 |
| `crates/evm/execution-errors/` | 실행 에러 |
| `crates/evm/execution-types/` | 실행 타입 |
| `crates/revm/` | REVM 통합 |
| `crates/stages/` | Staged sync 파이프라인 |
| `crates/trie/` | Merkle Patricia Trie |

#### Networking
| Crate | 설명 |
|-------|------|
| `crates/net/network/` | P2P 네트워크 코어 |
| `crates/net/network-api/` | 네트워크 API |
| `crates/net/network-types/` | 네트워크 타입 |
| `crates/net/discv4/` | Discovery v4 |
| `crates/net/discv5/` | Discovery v5 |
| `crates/net/dns/` | DNS 디스커버리 |
| `crates/net/eth-wire/` | ETH 와이어 프로토콜 |
| `crates/net/eth-wire-types/` | ETH 와이어 타입 |
| `crates/net/p2p/` | P2P 추상화 |
| `crates/net/peers/` | 피어 관리 |
| `crates/net/downloaders/` | 블록/헤더 다운로더 |
| `crates/net/ecies/` | ECIES 암호화 |
| `crates/net/nat/` | NAT traversal |
| `crates/net/banlist/` | 피어 밴리스트 |

#### RPC
| Crate | 설명 |
|-------|------|
| `crates/rpc/rpc/` | JSON-RPC 구현 |
| `crates/rpc/rpc-api/` | RPC API 정의 |
| `crates/rpc/rpc-builder/` | RPC 서버 빌더 |
| `crates/rpc/rpc-engine-api/` | Engine API |
| `crates/rpc/rpc-eth-api/` | eth_* API |
| `crates/rpc/rpc-eth-types/` | eth 타입 |
| `crates/rpc/rpc-convert/` | RPC 변환 |
| `crates/rpc/rpc-layer/` | RPC 미들웨어 |
| `crates/rpc/ipc/` | IPC 전송 |

#### Engine (Consensus Layer 통합)
| Crate | 설명 |
|-------|------|
| `crates/engine/tree/` | 블록 트리 관리 |
| `crates/engine/local/` | 로컬 엔진 (테스트용) |
| `crates/engine/service/` | 엔진 서비스 |
| `crates/engine/primitives/` | 엔진 프리미티브 |
| `crates/engine/util/` | 엔진 유틸리티 |
| `crates/engine/invalid-block-hooks/` | 무효 블록 훅 |

#### Node
| Crate | 설명 |
|-------|------|
| `crates/node/builder/` | 노드 빌더 |
| `crates/node/core/` | 노드 코어 |
| `crates/node/api/` | 노드 API |
| `crates/node/types/` | 노드 타입 |
| `crates/node/events/` | 노드 이벤트 |
| `crates/node/metrics/` | 노드 메트릭 |
| `crates/node/ethstats/` | ethstats 통합 |

#### Payload
| Crate | 설명 |
|-------|------|
| `crates/payload/basic/` | 기본 페이로드 빌더 |
| `crates/payload/builder/` | 페이로드 빌더 |
| `crates/payload/builder-primitives/` | 빌더 프리미티브 |
| `crates/payload/primitives/` | 페이로드 프리미티브 |
| `crates/payload/validator/` | 페이로드 검증 |
| `crates/payload/util/` | 페이로드 유틸리티 |

#### Ethereum 특화
| Crate | 설명 |
|-------|------|
| `crates/ethereum/reth/` | Ethereum Reth |
| `crates/ethereum/node/` | Ethereum 노드 |
| `crates/ethereum/evm/` | Ethereum EVM |
| `crates/ethereum/consensus/` | Ethereum 컨센서스 |
| `crates/ethereum/primitives/` | Ethereum 프리미티브 |
| `crates/ethereum/hardforks/` | Ethereum 하드포크 |
| `crates/ethereum/cli/` | Ethereum CLI |
| `crates/ethereum/payload/` | Ethereum 페이로드 |
| `crates/ethereum/engine-primitives/` | Ethereum 엔진 프리미티브 |

#### Optimism 지원
| Crate | 설명 |
|-------|------|
| `crates/optimism/bin/` | OP 바이너리 |
| `crates/optimism/reth/` | OP Reth |
| `crates/optimism/node/` | OP 노드 |
| `crates/optimism/evm/` | OP EVM |
| `crates/optimism/consensus/` | OP 컨센서스 |
| `crates/optimism/primitives/` | OP 프리미티브 |
| `crates/optimism/chainspec/` | OP 체인스펙 |
| `crates/optimism/hardforks/` | OP 하드포크 |
| `crates/optimism/cli/` | OP CLI |
| `crates/optimism/payload/` | OP 페이로드 |
| `crates/optimism/rpc/` | OP RPC |
| `crates/optimism/storage/` | OP 스토리지 |
| `crates/optimism/txpool/` | OP 트랜잭션 풀 |
| `crates/optimism/flashblocks/` | OP 플래시블록 |

#### ExEx (Execution Extensions)
| Crate | 설명 |
|-------|------|
| `crates/exex/exex/` | ExEx 프레임워크 |
| `crates/exex/types/` | ExEx 타입 |
| `crates/exex/test-utils/` | ExEx 테스트 유틸리티 |

#### Trie
| Crate | 설명 |
|-------|------|
| `crates/trie/trie/` | 메인 Trie |
| `crates/trie/common/` | Trie 공통 |
| `crates/trie/db/` | Trie DB |
| `crates/trie/parallel/` | 병렬 Trie |
| `crates/trie/sparse/` | 희소 Trie |
| `crates/trie/sparse-parallel/` | 병렬 희소 Trie |

#### 기타
| Crate | 설명 |
|-------|------|
| `crates/consensus/` | 컨센서스 검증 |
| `crates/transaction-pool/` | 트랜잭션 풀 |
| `crates/prune/` | 상태 정리 |
| `crates/tasks/` | 비동기 태스크 관리 |
| `crates/metrics/` | 메트릭 |
| `crates/tracing/` | 트레이싱 |
| `crates/cli/` | CLI 도구 |
| `crates/era/` | ERA 형식 |
| `crates/etl/` | ETL 처리 |
| `crates/stateless/` | Stateless 클라이언트 |
| `crates/ress/` | RESS 프로토콜 |
| `crates/fs-util/` | 파일시스템 유틸리티 |
| `crates/tokio-util/` | Tokio 유틸리티 |

### 주요 의존성

| 카테고리 | 패키지 | 버전 |
|----------|--------|------|
| **Revm** | `revm` | `33.1.0` |
| **Alloy** | `alloy-*` | `1.2.1` |
| **Alloy Primitives** | `alloy-primitives` | `1.5.0` |
| **OP Alloy** | `op-alloy-*` | `0.23.1` |
| **Tokio** | `tokio` | `1.44.2` |
| **Serde** | `serde` | `1.0` |

### 빌드 및 테스트

```bash
# 포맷팅
cargo +nightly fmt --all

# 린트
RUSTFLAGS="-D warnings" cargo +nightly clippy --workspace --all-features --locked

# 테스트
cargo nextest run --workspace

# 릴리스 빌드
cargo build --release --features "jemalloc asm-keccak"

# 문서 빌드
cargo docs --document-private-items
```

---

## 3. 프로젝트 관계 분석

### 아키텍처 관계

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tempo                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Tempo-specific Components                               │    │
│  │  • TIP-20 Token Standard                                 │    │
│  │  • Simplex Consensus (Commonware)                        │    │
│  │  • Custom Precompiles (결제 최적화)                       │    │
│  │  • Payment-optimized Transaction Pool                    │    │
│  │  • Fee AMM                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Reth SDK                             │    │
│  │  (Execution, Storage, RPC, Node Builder, etc.)          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 의존성 매핑

| Tempo Crate | Reth 의존성 |
|-------------|-------------|
| `tempo-node` | `reth-node-builder`, `reth-node-core`, `reth-node-api` |
| `tempo-evm` | `reth-evm`, `reth-evm-ethereum`, `reth-revm` |
| `tempo-chainspec` | `reth-chainspec` |
| `tempo-payload-builder` | `reth-payload-builder`, `reth-basic-payload-builder` |
| `tempo-payload-types` | `reth-payload-primitives` |
| `tempo-transaction-pool` | `reth-transaction-pool` |
| `tempo-consensus` | `reth-consensus`, `reth-consensus-common` |
| `tempo-primitives` | `reth-primitives-traits`, `reth-ethereum-primitives` |
| `tempo-revm` | `reth-revm` |

### Tempo의 Reth 확장 포인트

#### 1. 컨센서스 교체
- **Reth 기본**: Engine API를 통한 PoS Consensus Layer 연동
- **Tempo**: Commonware Simplex 컨센서스로 대체
- **이유**: Sub-second finality 달성, 결제 최적화

#### 2. EVM 커스터마이징
- **커스텀 프리컴파일**: 결제 특화 기능 (메모, 정책 검증 등)
- **가스 계산**: 스테이블코인 기반 수수료 모델

#### 3. 트랜잭션 풀
- **TIP-20 우선순위**: 결제 트랜잭션 전용 레인
- **수수료 스폰서십**: 앱이 사용자 가스비 대납 지원

#### 4. 페이로드 빌더
- **결제 레인 분리**: TIP-20 전송과 일반 트랜잭션 분리
- **배치 트랜잭션**: 원자적 다중 결제 지원

### 버전 호환성

```toml
# Tempo의 Reth 의존성 (Cargo.toml)
reth-* = {
    git = "https://github.com/paradigmxyz/reth",
    rev = "d76babb2f17773f79c9cf1eda497c539bd5cf553"  # reth/rc.2-cc 브랜치
}
```

- Tempo는 Reth의 특정 커밋에 고정
- Reth `v1.10.0-rc.2` 기반
- 향후 Reth 업데이트 시 Tempo 패치 검토 필요

### 코드 공유 패턴

```
Reth (Upstream)
    │
    ├── reth-node-builder  ──────────┐
    ├── reth-evm           ──────────┤
    ├── reth-storage       ──────────┼──→ Tempo (Consumer)
    ├── reth-rpc           ──────────┤        │
    └── reth-transaction-pool ───────┘        │
                                              ▼
                                    tempo-specific crates
```

---

## 4. 종합 요약

### 프로젝트 비교

| 구분 | Tempo | Reth |
|------|-------|------|
| **목적** | 결제 최적화 L1 블록체인 | 범용 이더리움 실행 클라이언트 |
| **개발사** | Tempo Labs | Paradigm |
| **관계** | Reth SDK 기반 확장 | 기반 프레임워크 |
| **컨센서스** | Simplex (Commonware) | Engine API (PoS CL 연동) |
| **특화 기능** | TIP-20, 결제 레인, 스테이블코인 수수료 | 모듈성, 성능, 확장성 |
| **Crate 수** | ~20개 | ~150+개 |
| **성숙도** | RC (1.0.0-rc.1) | Production (1.9.3) |
| **Rust 에디션** | 2024 | 2024 |
| **MSRV** | 1.91.0 | 1.88 |

### 핵심 인사이트

#### 1. Tempo는 Reth의 "포크"가 아닌 "확장"
- Reth SDK를 라이브러리로 사용
- 핵심 인프라(저장소, RPC, 네트워크 스택)는 Reth 그대로 활용
- 결제 특화 기능만 상위 레이어에서 추가/교체

#### 2. 아키텍처적 결정
- **Commonware Simplex**: 빠른 finality를 위한 자체 컨센서스
- **EVM 호환**: 기존 Ethereum 도구(Solidity, Foundry, Hardhat) 호환 유지
- **JSON-RPC 호환**: 기존 지갑, dApp과 호환

#### 3. 개발 워크플로우 고려사항
- Tempo 수정 시 Reth API 변경 사항 주의
- Reth 업그레이드 시 Tempo 패치 테스트 필요
- 공통 의존성(revm, alloy) 버전 동기화 중요

### 개발 환경 설정

#### Tempo
```bash
cd tempo
just                    # 의존성 설치
just build-all          # 전체 빌드
cargo nextest run       # 테스트
just localnet           # 로컬넷 실행
```

#### Reth
```bash
cd reth
cargo +nightly fmt --all    # 포맷팅
cargo nextest run --workspace   # 테스트
cargo build --release           # 릴리스 빌드
```

---

## 부록: 디렉토리 구조 요약

### Tempo
```
tempo/
├── bin/
│   ├── tempo/           # 메인 노드
│   ├── tempo-bench/     # 벤치마크
│   └── tempo-sidecar/   # 사이드카
├── crates/              # 19개 crate
├── contrib/             # 기여 관련
├── docs/                # 문서
├── generated/           # 생성된 파일
├── scripts/             # 스크립트
├── tempoup/             # 업데이트 도구
└── xtask/               # 빌드 태스크
```

### Reth
```
reth/
├── bin/
│   ├── reth/            # 메인 노드
│   ├── reth-bench/      # 벤치마크
│   └── reth-bench-compare/
├── crates/              # 150+ crate
├── docs/                # 문서
├── examples/            # 예제
├── testing/             # 테스트 인프라
├── assets/              # 에셋
├── audit/               # 감사 보고서
├── etc/                 # 설정 파일
└── pkg/                 # 패키징
```
