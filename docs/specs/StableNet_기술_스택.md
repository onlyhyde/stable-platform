# StableNet 기술 스택 명세서

> **문서 버전**: 1.0
> **작성일**: 2025-01-09
> **작성자**: CTO Office
> **상태**: Draft for Review

---

## 1. 개요

본 문서는 StableNet 블록체인 플랫폼 구현을 위한 상세 기술 스택을 정의합니다. 각 레이어별 기술 선택의 근거와 대안, 그리고 구체적인 구성 방법을 포함합니다.

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          StableNet Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Presentation Layer                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │  Web Wallet │  │ Mobile App  │  │  Explorer   │  │  Dev Portal│ │   │
│  │  │  (React)    │  │(React Native)│ │  (Next.js)  │  │  (Next.js) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Gateway Layer                            │   │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────────┐  │   │
│  │  │   Kong / Traefik    │  │          Rate Limiting               │  │   │
│  │  │   (API Gateway)     │  │          Authentication              │  │   │
│  │  └─────────────────────┘  └─────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Application Layer                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │   │
│  │  │  Minter   │ │ Governance│ │  Bridge   │ │  Secret   │          │   │
│  │  │  Service  │ │  Service  │ │  Relayer  │ │  Transfer │          │   │
│  │  │  (Go)     │ │  (Go)     │ │  (Rust)   │ │  (Rust)   │          │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │   │
│  │  │  Smart    │ │ Compliance│ │  Indexer  │ │  Notifier │          │   │
│  │  │  Wallet   │ │  Engine   │ │  Service  │ │  Service  │          │   │
│  │  │  (Go)     │ │  (Go)     │ │  (Rust)   │ │  (Go)     │          │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Blockchain Layer                              │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    StableNet Node (go-ethereum)              │   │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │   │   │
│  │  │  │  WBFT   │  │  EVM    │  │ EIP-7702│  │ System Contracts│ │   │   │
│  │  │  │Consensus│  │ Runtime │  │  AA     │  │ (Governance,etc)│ │   │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Data Layer                                    │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │   │
│  │  │PostgreSQL │ │  Redis    │ │  Kafka    │ │   S3      │          │   │
│  │  │ (OLTP)    │ │  (Cache)  │ │  (Queue)  │ │ (Archive) │          │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Infrastructure Layer                            │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │   │
│  │  │  AWS EKS  │ │ CloudHSM  │ │  Nitro    │ │  VPC/     │          │   │
│  │  │(Kubernetes│ │ (Keys)    │ │ (TEE)     │ │  Network  │          │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Blockchain Core Layer

### 3.1 StableNet Node

#### 3.1.1 기본 정보
```yaml
Base:
  framework: "go-ethereum"
  version: "v1.13.x"
  fork_point: "v1.13.14"
  license: "LGPL-3.0"

Modifications:
  - "WBFT Consensus (QBFT 기반)"
  - "Native KRW Coin"
  - "EIP-7702 Account Abstraction"
  - "Custom Fee Model"
  - "System Contracts Integration"
```

#### 3.1.2 WBFT 합의 알고리즘
```yaml
Consensus:
  name: "Weighted Byzantine Fault Tolerance"
  base: "QBFT (Quorum Byzantine Fault Tolerant)"

  parameters:
    block_time: 1000  # ms
    round_timeout: 3000  # ms
    min_validators: 4
    byzantine_tolerance: "n >= 3f + 1"

  modifications:
    - description: "블록 생성 보상 비활성화"
      file: "consensus/wbft/wbft.go"
      function: "Finalize()"
      change: "Remove block reward calculation"

    - description: "Authorized Account 우선 처리"
      file: "core/txpool/txpool.go"
      function: "promoteExecutables()"
      change: "Priority queue for authorized accounts"

    - description: "BaseFee 안정화"
      file: "core/fee_model.go"
      function: "CalcBaseFee()"
      change: "Modified EIP-1559 with stabilization"

Code_Structure:
  consensus/wbft/:
    - "wbft.go"           # 메인 합의 로직
    - "backend.go"        # 백엔드 인터페이스
    - "core.go"           # 코어 합의 함수
    - "handler.go"        # 메시지 핸들러
    - "types.go"          # 타입 정의
    - "validator.go"      # 검증자 관리
    - "snapshot.go"       # 스냅샷 관리
```

#### 3.1.3 시스템 컨트랙트 주소
```yaml
System_Contracts:
  # Governance
  GovCouncil:
    address: "0x0000000000000000000000000000000000001001"
    description: "최상위 거버넌스 컨트랙트"

  GovValidator:
    address: "0x0000000000000000000000000000000000001002"
    description: "검증자 관리 컨트랙트"

  GovMasterMinter:
    address: "0x0000000000000000000000000000000000001003"
    description: "Master Minter 관리"

  GovMinter:
    address: "0x0000000000000000000000000000000000001004"
    description: "Minter 발행/소각 관리"

  # Utility
  NativeCoinAdapter:
    address: "0x0000000000000000000000000000000000001010"
    description: "ERC20 래퍼"

  Blacklist:
    address: "0x0000000000000000000000000000000000001011"
    description: "블랙리스트 관리"

  AuthorizedAccount:
    address: "0x0000000000000000000000000000000000001012"
    description: "우선처리 계정 관리"

  # Bridge
  NativeBridge:
    address: "0x0000000000000000000000000000000000001020"
    description: "브릿지 컨트랙트"

  # Secret Account
  StealthRegistry:
    address: "0x0000000000000000000000000000000000001030"
    description: "ERC-5564 레지스트리"

  PrivateBank:
    address: "0x0000000000000000000000000000000000001031"
    description: "비밀 전송 컨트랙트"
```

#### 3.1.4 노드 구성
```yaml
Node_Configuration:
  # config.toml
  [Eth]
  NetworkId = 8453  # StableNet Chain ID
  SyncMode = "snap"

  [Eth.WBFT]
  BlockPeriod = 1
  RequestTimeout = 3000
  EpochLength = 30000

  [Node]
  DataDir = "/data/stablenet"
  HTTPHost = "0.0.0.0"
  HTTPPort = 8545
  HTTPVirtualHosts = ["*"]
  HTTPModules = ["eth", "net", "web3", "txpool", "debug"]
  WSHost = "0.0.0.0"
  WSPort = 8546

  [Node.P2P]
  ListenAddr = ":30303"
  MaxPeers = 50

Hardware_Requirements:
  validator:
    cpu: "16 cores (AMD EPYC or Intel Xeon)"
    memory: "64 GB DDR4"
    storage: "2 TB NVMe SSD (RAID 1)"
    network: "1 Gbps dedicated"

  rpc_node:
    cpu: "8 cores"
    memory: "32 GB"
    storage: "1 TB NVMe SSD"
    network: "1 Gbps"

  archive_node:
    cpu: "16 cores"
    memory: "128 GB"
    storage: "4 TB NVMe SSD (RAID 10)"
    network: "10 Gbps"
```

### 3.2 Smart Contract Development

#### 3.2.1 개발 환경
```yaml
Solidity:
  version: "0.8.20"
  optimizer:
    enabled: true
    runs: 200
  via_ir: true

Framework:
  primary: "Foundry"
  version: "latest"
  components:
    - "forge"   # 컴파일 & 테스트
    - "cast"    # CLI 유틸리티
    - "anvil"   # 로컬 노드
    - "chisel"  # REPL

Alternative:
  secondary: "Hardhat"
  use_case: "프론트엔드 통합, 레거시 호환"
  plugins:
    - "@nomicfoundation/hardhat-toolbox"
    - "@nomicfoundation/hardhat-verify"
    - "hardhat-gas-reporter"
    - "solidity-coverage"

Testing:
  unit_tests: "Forge Test"
  integration_tests: "Forge Fork Tests"
  fuzzing: "Forge Fuzz"
  invariant_testing: "Forge Invariant"
  coverage_target: ">= 90%"

Static_Analysis:
  - tool: "Slither"
    severity: "high, medium"

  - tool: "Mythril"
    analysis: "symbolic execution"

  - tool: "Aderyn"
    focus: "security patterns"
```

#### 3.2.2 프로젝트 구조
```
contracts/
├── src/
│   ├── governance/
│   │   ├── GovCouncil.sol
│   │   ├── GovValidator.sol
│   │   ├── GovMasterMinter.sol
│   │   ├── GovMinter.sol
│   │   └── interfaces/
│   │       └── IGovernance.sol
│   │
│   ├── minter/
│   │   ├── MinterRegistry.sol
│   │   ├── MintController.sol
│   │   └── interfaces/
│   │       └── IMinter.sol
│   │
│   ├── token/
│   │   ├── NativeCoinAdapter.sol
│   │   ├── StableToken.sol
│   │   └── interfaces/
│   │       └── IERC20Extended.sol
│   │
│   ├── security/
│   │   ├── Blacklist.sol
│   │   ├── AuthorizedAccount.sol
│   │   └── interfaces/
│   │       └── ISecurity.sol
│   │
│   ├── bridge/
│   │   ├── NativeBridge.sol
│   │   ├── RemoteToken.sol
│   │   └── interfaces/
│   │       └── IBridge.sol
│   │
│   ├── account/
│   │   ├── SmartAccount.sol
│   │   ├── Paymaster.sol
│   │   ├── StealthRegistry.sol
│   │   ├── PrivateBank.sol
│   │   └── interfaces/
│   │       └── IAccount.sol
│   │
│   └── libraries/
│       ├── SafeMath.sol
│       ├── ECDSA.sol
│       └── StealthAddress.sol
│
├── test/
│   ├── governance/
│   ├── minter/
│   ├── token/
│   ├── security/
│   ├── bridge/
│   ├── account/
│   └── invariant/
│
├── script/
│   ├── Deploy.s.sol
│   ├── Upgrade.s.sol
│   └── helpers/
│
└── foundry.toml
```

#### 3.2.3 Foundry 설정
```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = true
evm_version = "shanghai"

[profile.default.fuzz]
runs = 1000
max_test_rejects = 65536

[profile.default.invariant]
runs = 256
depth = 15
fail_on_revert = false

[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 512, depth = 25 }

[rpc_endpoints]
stablenet = "${STABLENET_RPC_URL}"
stablenet_testnet = "${STABLENET_TESTNET_RPC_URL}"
ethereum = "${ETHEREUM_RPC_URL}"

[etherscan]
stablenet = { key = "${STABLENET_API_KEY}" }
```

---

## 4. Application Layer

### 4.1 Backend Services

#### 4.1.1 Minter Service
```yaml
Service:
  name: "minter-service"
  language: "Go"
  version: "1.21+"

Framework:
  web: "Gin / Echo"
  grpc: "grpc-go"
  orm: "GORM"

Architecture:
  pattern: "Clean Architecture"
  layers:
    - "Handler (HTTP/gRPC)"
    - "UseCase (Business Logic)"
    - "Repository (Data Access)"
    - "Entity (Domain Models)"

Dependencies:
  - "github.com/gin-gonic/gin"
  - "google.golang.org/grpc"
  - "github.com/ethereum/go-ethereum"
  - "gorm.io/gorm"
  - "github.com/go-redis/redis/v9"
  - "github.com/segmentio/kafka-go"
  - "go.uber.org/zap"
  - "github.com/prometheus/client_golang"

API_Endpoints:
  gRPC:
    service: "MinterService"
    methods:
      - "RegisterMinter"
      - "GetMinterInfo"
      - "RequestMint"
      - "ConfirmMint"
      - "RequestBurn"
      - "GetMintHistory"

  REST:
    prefix: "/api/v1/minter"
    endpoints:
      - "POST /register"
      - "GET /{address}"
      - "POST /mint/request"
      - "POST /mint/confirm"
      - "POST /burn"
      - "GET /history"
```

**Minter Service gRPC 정의**:
```protobuf
// minter_service.proto
syntax = "proto3";

package stablenet.minter.v1;

option go_package = "github.com/stablenet/services/minter/v1;minterv1";

service MinterService {
  // Minter Registration
  rpc RegisterMinter(RegisterMinterRequest) returns (RegisterMinterResponse);
  rpc GetMinterInfo(GetMinterInfoRequest) returns (GetMinterInfoResponse);
  rpc UpdateMinterStatus(UpdateMinterStatusRequest) returns (UpdateMinterStatusResponse);

  // Mint Operations
  rpc RequestMint(MintRequest) returns (MintResponse);
  rpc ConfirmMint(ConfirmMintRequest) returns (ConfirmMintResponse);
  rpc GetMintStatus(GetMintStatusRequest) returns (GetMintStatusResponse);

  // Burn Operations
  rpc RequestBurn(BurnRequest) returns (BurnResponse);

  // History
  rpc GetMintHistory(GetHistoryRequest) returns (GetHistoryResponse);
  rpc GetBurnHistory(GetHistoryRequest) returns (GetHistoryResponse);
}

message RegisterMinterRequest {
  string name = 1;
  string address = 2;
  string kyc_proof = 3;
  uint64 requested_limit = 4;
}

message MintRequest {
  string minter_address = 1;
  string recipient_address = 2;
  string amount = 3;  // String for big numbers
  string proof_of_reserve = 4;
  string deposit_tx_hash = 5;
}

message MintResponse {
  string request_id = 1;
  string status = 2;
  string tx_hash = 3;
  int64 timestamp = 4;
}

// ... additional messages
```

#### 4.1.2 Bridge Relayer Service
```yaml
Service:
  name: "bridge-relayer"
  language: "Rust"
  version: "1.75+"

Framework:
  async_runtime: "Tokio"
  web: "Axum"
  ethereum: "ethers-rs / alloy"

Architecture:
  pattern: "Event-Driven"
  components:
    - "Event Listener"
    - "Message Queue Consumer"
    - "Transaction Submitter"
    - "Proof Verifier"

Dependencies:
  # Cargo.toml
  tokio: "1.35"
  axum: "0.7"
  ethers: "2.0"
  alloy: "0.1"
  sqlx: "0.7"
  redis: "0.24"
  rdkafka: "0.36"
  tracing: "0.1"
  prometheus: "0.13"

Security:
  threshold_signature: "3-of-5"
  key_storage: "HSM + Vault"
  proof_verification: "Merkle Proof"
```

**Bridge Relayer 구조**:
```rust
// src/main.rs (Rust)
use axum::{Router, routing::get};
use tokio::sync::mpsc;
use std::sync::Arc;

mod config;
mod listener;
mod submitter;
mod verifier;
mod db;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::init();

    // Load configuration
    let config = config::load()?;

    // Initialize database pool
    let db_pool = db::create_pool(&config.database_url).await?;

    // Create channels for inter-component communication
    let (event_tx, event_rx) = mpsc::channel(1000);
    let (submit_tx, submit_rx) = mpsc::channel(1000);

    // Start components
    let listener = listener::EventListener::new(config.chains.clone(), event_tx);
    let verifier = verifier::ProofVerifier::new(event_rx, submit_tx, db_pool.clone());
    let submitter = submitter::TxSubmitter::new(submit_rx, config.chains.clone());

    // Start HTTP server for health checks and metrics
    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/metrics", get(metrics_handler));

    // Run all components concurrently
    tokio::select! {
        _ = listener.run() => {}
        _ = verifier.run() => {}
        _ = submitter.run() => {}
        _ = axum::Server::bind(&config.server_addr).serve(app.into_make_service()) => {}
    }

    Ok(())
}
```

#### 4.1.3 Secret Transfer Server
```yaml
Service:
  name: "secret-transfer-server"
  language: "Rust"
  version: "1.75+"

Features:
  - "Stealth Address 생성/관리"
  - "배치 트랜잭션 처리"
  - "규제 기관 조회 API"

Security:
  encryption: "AES-256-GCM"
  key_derivation: "Argon2id"
  view_key_storage: "HSM"

Architecture:
  batching:
    interval: "5 seconds"
    max_batch_size: 100
    min_batch_size: 3  # 프라이버시를 위한 최소 혼합
```

#### 4.1.4 Indexer Service
```yaml
Service:
  name: "indexer-service"
  language: "Rust"
  version: "1.75+"

Purpose:
  - "블록체인 데이터 인덱싱"
  - "이벤트 로그 파싱"
  - "분석 데이터 생성"

Database:
  primary: "PostgreSQL"
  timeseries: "TimescaleDB"
  search: "Elasticsearch"

Performance:
  block_processing: "< 100ms per block"
  query_latency: "< 50ms (p99)"
  reorg_handling: "Up to 10 blocks"
```

### 4.2 API Gateway

#### 4.2.1 Kong Gateway 설정
```yaml
# kong.yml
_format_version: "3.0"

services:
  - name: minter-service
    url: http://minter-service:8080
    routes:
      - name: minter-route
        paths:
          - /api/v1/minter
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 1000
          policy: local
      - name: jwt
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
            - PUT
            - DELETE
          headers:
            - Authorization
            - Content-Type

  - name: bridge-service
    url: http://bridge-service:8080
    routes:
      - name: bridge-route
        paths:
          - /api/v1/bridge
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt

  - name: public-rpc
    url: http://rpc-nodes:8545
    routes:
      - name: rpc-route
        paths:
          - /rpc
    plugins:
      - name: rate-limiting
        config:
          minute: 10000
          policy: local
      - name: request-size-limiting
        config:
          allowed_payload_size: 1
          size_unit: megabytes

plugins:
  - name: prometheus
  - name: file-log
    config:
      path: /var/log/kong/access.log
```

### 4.3 gRPC 서비스 통신

#### 4.3.1 서비스 간 통신 매트릭스
```yaml
Service_Communication:
  Minter_Service:
    calls:
      - service: "Compliance Engine"
        protocol: "gRPC"
        methods: ["CheckKYC", "CheckAML", "VerifySoF"]

      - service: "Blockchain Node"
        protocol: "JSON-RPC"
        methods: ["eth_sendTransaction", "eth_getTransactionReceipt"]

      - service: "Notifier Service"
        protocol: "Kafka"
        topics: ["mint.completed", "burn.completed"]

  Bridge_Relayer:
    calls:
      - service: "Source Chain Node"
        protocol: "WebSocket"
        subscription: "newHeads, logs"

      - service: "Target Chain Node"
        protocol: "JSON-RPC"
        methods: ["eth_sendRawTransaction"]

      - service: "HSM"
        protocol: "PKCS#11"
        operations: ["sign"]

  Secret_Transfer:
    calls:
      - service: "Blockchain Node"
        protocol: "JSON-RPC"
        methods: ["eth_sendTransaction"]

      - service: "Key Vault"
        protocol: "gRPC"
        methods: ["GetViewKey", "DeriveStealthAddress"]
```

---

## 5. Data Layer

### 5.1 PostgreSQL

#### 5.1.1 데이터베이스 설계
```yaml
Database:
  name: "stablenet"
  version: "PostgreSQL 16"
  extensions:
    - "uuid-ossp"
    - "pgcrypto"
    - "timescaledb"

Schemas:
  public:
    description: "Core business tables"
    tables:
      - "minters"
      - "mint_requests"
      - "burn_requests"
      - "bridge_transactions"

  governance:
    description: "Governance related data"
    tables:
      - "proposals"
      - "votes"
      - "council_members"
      - "validators"

  compliance:
    description: "Compliance and audit"
    tables:
      - "kyc_records"
      - "aml_checks"
      - "blacklist_entries"
      - "audit_logs"

  indexer:
    description: "Blockchain indexed data"
    tables:
      - "blocks"
      - "transactions"
      - "events"
      - "token_transfers"
```

#### 5.1.2 주요 테이블 스키마
```sql
-- minters table
CREATE TABLE minters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    mint_limit NUMERIC(78, 0) NOT NULL,
    total_minted NUMERIC(78, 0) NOT NULL DEFAULT 0,
    total_burned NUMERIC(78, 0) NOT NULL DEFAULT 0,
    kyc_verified_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT minters_status_check
        CHECK (status IN ('pending', 'active', 'suspended', 'revoked'))
);

CREATE INDEX idx_minters_status ON minters(status);
CREATE INDEX idx_minters_address ON minters(address);

-- mint_requests table
CREATE TABLE mint_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    minter_id UUID NOT NULL REFERENCES minters(id),
    recipient_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    proof_of_reserve BYTEA NOT NULL,
    deposit_tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    chain_tx_hash VARCHAR(66),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT mint_requests_status_check
        CHECK (status IN ('pending', 'approved', 'submitted', 'confirmed', 'failed', 'rejected'))
);

CREATE INDEX idx_mint_requests_minter ON mint_requests(minter_id);
CREATE INDEX idx_mint_requests_status ON mint_requests(status);
CREATE INDEX idx_mint_requests_created ON mint_requests(created_at DESC);

-- audit_logs table (compliance schema)
CREATE TABLE compliance.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    actor_address VARCHAR(42),
    actor_type VARCHAR(20),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_action ON compliance.audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON compliance.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON compliance.audit_logs(created_at DESC);

-- TimescaleDB hypertable for transactions
CREATE TABLE indexer.transactions (
    block_number BIGINT NOT NULL,
    tx_index INTEGER NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value NUMERIC(78, 0) NOT NULL,
    gas_used INTEGER NOT NULL,
    gas_price NUMERIC(78, 0) NOT NULL,
    input_data BYTEA,
    status SMALLINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

    PRIMARY KEY (block_number, tx_index)
);

SELECT create_hypertable('indexer.transactions', 'created_at');

CREATE INDEX idx_transactions_from ON indexer.transactions(from_address, created_at DESC);
CREATE INDEX idx_transactions_to ON indexer.transactions(to_address, created_at DESC);
CREATE INDEX idx_transactions_hash ON indexer.transactions(tx_hash);
```

### 5.2 Redis

#### 5.2.1 Redis 설정
```yaml
Redis:
  deployment: "Redis Cluster"
  version: "7.2"
  nodes: 6  # 3 masters, 3 replicas

Configuration:
  maxmemory: "8gb"
  maxmemory-policy: "allkeys-lru"
  appendonly: "yes"
  appendfsync: "everysec"

Use_Cases:
  session:
    prefix: "session:"
    ttl: 3600
    data: "JWT tokens, user sessions"

  cache:
    prefix: "cache:"
    ttl: 300
    data: "API responses, query results"

  rate_limit:
    prefix: "ratelimit:"
    ttl: 60
    data: "Request counters"

  pending_tx:
    prefix: "pending:"
    ttl: 3600
    data: "Pending transaction tracking"

  nonce:
    prefix: "nonce:"
    ttl: 0  # No expiry
    data: "Transaction nonce management"
```

### 5.3 Apache Kafka

#### 5.3.1 Kafka 토픽 설계
```yaml
Kafka:
  version: "3.6"
  deployment: "AWS MSK"

Topics:
  # Minter Events
  minter.registered:
    partitions: 6
    replication_factor: 3
    retention_ms: 604800000  # 7 days

  mint.requested:
    partitions: 12
    replication_factor: 3
    retention_ms: 604800000

  mint.completed:
    partitions: 12
    replication_factor: 3
    retention_ms: 2592000000  # 30 days

  burn.completed:
    partitions: 12
    replication_factor: 3
    retention_ms: 2592000000

  # Bridge Events
  bridge.out.initiated:
    partitions: 6
    replication_factor: 3

  bridge.in.completed:
    partitions: 6
    replication_factor: 3

  # Compliance Events
  compliance.alert:
    partitions: 3
    replication_factor: 3
    retention_ms: 31536000000  # 1 year

  # Blockchain Events
  blockchain.blocks:
    partitions: 1
    replication_factor: 3

  blockchain.transactions:
    partitions: 24
    replication_factor: 3
```

---

## 6. Security Layer

### 6.1 Key Management

#### 6.1.1 HashiCorp Vault 설정
```yaml
Vault:
  version: "1.15"
  deployment: "HA Cluster"
  backend: "Raft"

Secret_Engines:
  kv:
    path: "secret"
    version: 2
    use: "Configuration secrets"

  transit:
    path: "transit"
    use: "Encryption as a Service"
    keys:
      - name: "minter-key"
        type: "aes256-gcm96"
      - name: "bridge-key"
        type: "ecdsa-p256"

  pki:
    path: "pki"
    use: "Internal TLS certificates"

Policies:
  minter-service:
    capabilities:
      - path: "secret/data/minter/*"
        operations: ["read"]
      - path: "transit/sign/minter-key"
        operations: ["update"]

  bridge-relayer:
    capabilities:
      - path: "secret/data/bridge/*"
        operations: ["read"]
      - path: "transit/sign/bridge-key"
        operations: ["update"]
```

#### 6.1.2 AWS CloudHSM 연동
```yaml
CloudHSM:
  cluster_type: "hsm1.medium"
  ha: true
  region: "ap-northeast-2"

Key_Types:
  validator_keys:
    algorithm: "ECDSA"
    curve: "secp256k1"
    purpose: "Block signing"

  bridge_keys:
    algorithm: "ECDSA"
    curve: "secp256k1"
    purpose: "Bridge transaction signing"
    threshold: "3-of-5"

  encryption_keys:
    algorithm: "AES"
    size: 256
    purpose: "Data encryption"
```

### 6.2 Network Security

#### 6.2.1 네트워크 구성
```yaml
VPC_Configuration:
  cidr: "10.0.0.0/16"

Subnets:
  public:
    - "10.0.1.0/24"   # AZ-a (ALB, NAT)
    - "10.0.2.0/24"   # AZ-b
    - "10.0.3.0/24"   # AZ-c

  private:
    - "10.0.10.0/24"  # AZ-a (Services)
    - "10.0.11.0/24"  # AZ-b
    - "10.0.12.0/24"  # AZ-c

  database:
    - "10.0.20.0/24"  # AZ-a (RDS, Redis)
    - "10.0.21.0/24"  # AZ-b

  blockchain:
    - "10.0.30.0/24"  # AZ-a (Validators)
    - "10.0.31.0/24"  # AZ-b
    - "10.0.32.0/24"  # AZ-c

Security_Groups:
  api-gateway:
    inbound:
      - port: 443
        source: "0.0.0.0/0"
      - port: 80
        source: "0.0.0.0/0"

  services:
    inbound:
      - port: 8080
        source: "sg-api-gateway"
      - port: 9090
        source: "sg-services"  # gRPC

  validators:
    inbound:
      - port: 30303
        source: "0.0.0.0/0"  # P2P
      - port: 8545
        source: "sg-services"  # RPC (internal only)

  database:
    inbound:
      - port: 5432
        source: "sg-services"
      - port: 6379
        source: "sg-services"
```

### 6.3 TEE (Trusted Execution Environment)

#### 6.3.1 AWS Nitro Enclaves
```yaml
Nitro_Enclaves:
  use_cases:
    - "Private key operations"
    - "KYC data processing"
    - "Secret Transfer computation"

Configuration:
  vcpu: 4
  memory: 8192  # MB

Integration:
  vsock:
    enclave_cid: 16
    port: 5000

  attestation:
    enabled: true
    pcr_validation: true
```

---

## 7. Infrastructure Layer

### 7.1 Kubernetes (EKS)

#### 7.1.1 클러스터 구성
```yaml
EKS_Cluster:
  name: "stablenet-prod"
  version: "1.29"
  region: "ap-northeast-2"

Node_Groups:
  services:
    instance_types:
      - "m6i.2xlarge"
    min_size: 3
    max_size: 10
    desired_size: 5
    labels:
      workload: "services"

  validators:
    instance_types:
      - "c6i.4xlarge"
    min_size: 7
    max_size: 21
    desired_size: 7
    labels:
      workload: "blockchain"
    taints:
      - key: "blockchain"
        value: "true"
        effect: "NoSchedule"

  monitoring:
    instance_types:
      - "m6i.xlarge"
    min_size: 2
    max_size: 4
    desired_size: 2
    labels:
      workload: "monitoring"

Addons:
  - "vpc-cni"
  - "coredns"
  - "kube-proxy"
  - "aws-ebs-csi-driver"
  - "aws-load-balancer-controller"
  - "cluster-autoscaler"
  - "metrics-server"
```

#### 7.1.2 Helm Charts
```yaml
Helm_Releases:
  # Infrastructure
  - name: "cert-manager"
    repo: "jetstack"
    chart: "cert-manager"
    version: "v1.14.0"

  - name: "external-secrets"
    repo: "external-secrets"
    chart: "external-secrets"
    version: "0.9.11"

  # Observability
  - name: "prometheus-stack"
    repo: "prometheus-community"
    chart: "kube-prometheus-stack"
    version: "56.0.0"

  - name: "loki"
    repo: "grafana"
    chart: "loki-stack"
    version: "2.10.0"

  - name: "jaeger"
    repo: "jaegertracing"
    chart: "jaeger"
    version: "2.0.0"

  # Networking
  - name: "kong"
    repo: "kong"
    chart: "kong"
    version: "2.35.0"
```

### 7.2 모니터링

#### 7.2.1 Prometheus 메트릭
```yaml
Metrics:
  # Blockchain Metrics
  stablenet_block_height:
    type: "gauge"
    help: "Current block height"

  stablenet_tps:
    type: "gauge"
    help: "Transactions per second"

  stablenet_validator_count:
    type: "gauge"
    help: "Active validator count"

  stablenet_consensus_round_duration:
    type: "histogram"
    buckets: [0.1, 0.5, 1, 2, 5]
    help: "Consensus round duration in seconds"

  # Service Metrics
  minter_mint_requests_total:
    type: "counter"
    labels: ["status"]
    help: "Total mint requests"

  bridge_transfers_total:
    type: "counter"
    labels: ["direction", "chain", "status"]
    help: "Total bridge transfers"

  # Business Metrics
  stablenet_total_supply:
    type: "gauge"
    help: "Total stablecoin supply"

  stablenet_minter_count:
    type: "gauge"
    labels: ["status"]
    help: "Minter count by status"
```

#### 7.2.2 Grafana 대시보드
```yaml
Dashboards:
  - name: "StableNet Overview"
    panels:
      - "Block Height & TPS"
      - "Total Supply"
      - "Active Validators"
      - "Network Health"

  - name: "Minter Operations"
    panels:
      - "Mint/Burn Volume"
      - "Request Success Rate"
      - "Processing Time"
      - "Top Minters"

  - name: "Bridge Monitoring"
    panels:
      - "Transfer Volume by Chain"
      - "Pending Transfers"
      - "Relayer Status"
      - "Error Rate"

  - name: "Security Alerts"
    panels:
      - "Blacklist Events"
      - "Suspicious Activity"
      - "Failed Authentication"
      - "Rate Limit Hits"
```

### 7.3 CI/CD

#### 7.3.1 GitHub Actions Workflows
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v4

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - run: go test -v -race -coverprofile=coverage.txt ./...
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'

  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      - run: forge build
      - run: forge test -vvv
      - name: Run Slither
        uses: crytic/slither-action@v0.3.0

  build:
    needs: [lint, test, security, contracts]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.ECR_REGISTRY }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.ECR_REGISTRY }}/stablenet:${{ github.sha }}
```

#### 7.3.2 Terraform 구성
```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "s3" {
    bucket         = "stablenet-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "stablenet-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false

  tags = local.common_tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.2.0"

  cluster_name    = "stablenet-prod"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    services = {
      instance_types = ["m6i.2xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 5
    }
    validators = {
      instance_types = ["c6i.4xlarge"]
      min_size       = 7
      max_size       = 21
      desired_size   = 7

      taints = [{
        key    = "blockchain"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  tags = local.common_tags
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.4.0"

  identifier = "stablenet-db"
  engine     = "postgres"
  engine_version = "16.1"

  instance_class = "db.r6g.xlarge"
  allocated_storage = 100

  multi_az = true

  vpc_security_group_ids = [module.security_groups.database_sg_id]
  subnet_ids             = module.vpc.database_subnets

  tags = local.common_tags
}
```

---

## 8. 외부 서비스 연동

### 8.1 Compliance Services

```yaml
Certik:
  services:
    - name: "Skynet"
      purpose: "기업 평가, 보안 모니터링"
      integration: "REST API"

    - name: "Proof of Reserve"
      purpose: "예치금 증명"
      integration: "REST API + On-chain Oracle"

Chainalysis:
  services:
    - name: "KYT (Know Your Transaction)"
      purpose: "실시간 트랜잭션 모니터링"
      integration: "REST API + Webhook"

    - name: "Reactor"
      purpose: "주소 클러스터링, 자금 추적"
      integration: "REST API"
```

### 8.2 Banking Integration

```yaml
Banking_APIs:
  deposit_notification:
    protocol: "REST"
    auth: "OAuth 2.0 / API Key"
    webhook: "Deposit event notification"

  source_of_funds:
    protocol: "REST"
    auth: "mTLS"
    data: "자금 출처 검증"
```

---

## 9. 기술 스택 요약 표

| Layer | Component | Technology | Version |
|-------|-----------|------------|---------|
| **Blockchain** | Node | go-ethereum (fork) | 1.13+ |
| | Consensus | WBFT | Custom |
| | EVM | Shanghai | - |
| **Smart Contracts** | Language | Solidity | 0.8.20 |
| | Framework | Foundry | Latest |
| | Testing | Forge | Latest |
| **Backend** | Primary | Go | 1.21+ |
| | Secondary | Rust | 1.75+ |
| | gRPC | grpc-go | 1.60+ |
| | REST | Gin/Echo | Latest |
| **Database** | RDBMS | PostgreSQL | 16 |
| | TimeSeries | TimescaleDB | 2.14+ |
| | Cache | Redis | 7.2 |
| | Queue | Apache Kafka | 3.6 |
| | Search | Elasticsearch | 8.x |
| **Security** | Secrets | HashiCorp Vault | 1.15 |
| | HSM | AWS CloudHSM | - |
| | TEE | AWS Nitro | - |
| **Infrastructure** | Container | Kubernetes (EKS) | 1.29 |
| | IaC | Terraform | 1.6+ |
| | CI/CD | GitHub Actions | - |
| **Monitoring** | Metrics | Prometheus | 2.x |
| | Visualization | Grafana | 10.x |
| | Logging | ELK Stack | 8.x |
| | Tracing | Jaeger | 1.x |
| **Frontend** | Web | React/Next.js | 14+ |
| | Mobile | React Native | 0.73+ |

---

## 10. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-09 | 초안 작성 | CTO Office |

---

## 부록

### A. 버전 관리 정책
- **Major**: 호환성 파괴 변경
- **Minor**: 기능 추가 (하위 호환)
- **Patch**: 버그 수정

### B. 기술 부채 관리
- 분기별 기술 부채 리뷰
- 리팩토링 스프린트 (연 2회)
- 의존성 업데이트 자동화 (Dependabot)

### C. 참조 문서
- go-ethereum: https://github.com/ethereum/go-ethereum
- EIP-7702: https://eips.ethereum.org/EIPS/eip-7702
- ERC-5564: https://eips.ethereum.org/EIPS/eip-5564
- Foundry: https://book.getfoundry.sh/
