# StableNet 구현 레벨 기술 검토 보고서

**문서 버전**: 1.0
**작성일**: 2026-01-09
**검토 목적**: 구현 가능성, 보안 타당성, 효율성 분석 및 모듈별 기술 스택/프로토콜 정의

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [모듈별 기술 스택 상세](#2-모듈별-기술-스택-상세)
3. [서비스 간 통신 프로토콜](#3-서비스-간-통신-프로토콜)
4. [보안 아키텍처 분석](#4-보안-아키텍처-분석)
5. [구현 가능성 평가](#5-구현-가능성-평가)
6. [성능 및 효율성 분석](#6-성능-및-효율성-분석)
7. [보안 개선을 위한 추가 기술 스택](#7-보안-개선을-위한-추가-기술-스택)
8. [권장 구현 아키텍처](#8-권장-구현-아키텍처)
9. [구현 로드맵](#9-구현-로드맵)

---

## 1. 시스템 아키텍처 개요

### 1.1 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              StableNet Architecture                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         External Layer                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │   DApps     │  │   Wallets   │  │  Exchanges  │  │   Minters   │    │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼───────────┘   │
│            │                │                │                │               │
│  ┌─────────▼────────────────▼────────────────▼────────────────▼───────────┐   │
│  │                         API Gateway Layer                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  JSON-RPC API  │  REST API  │  WebSocket API  │  GraphQL API    │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────┬───────────────────────────────────────┘   │
│                                   │                                           │
│  ┌────────────────────────────────▼───────────────────────────────────────┐   │
│  │                         Service Layer                                   │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐│   │
│  │  │  Minter   │ │  Secret   │ │   KYC/    │ │  Bridge   │ │Governance ││   │
│  │  │  Manager  │ │  Transfer │ │   AML     │ │  Service  │ │  Service  ││   │
│  │  │  Service  │ │  Server   │ │  Service  │ │           │ │           ││   │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘│   │
│  └────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────┘   │
│           │             │             │             │             │          │
│  ┌────────▼─────────────▼─────────────▼─────────────▼─────────────▼──────┐   │
│  │                         Blockchain Core Layer                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      EVM Execution Engine                        │  │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │   │
│  │  │  │ Smart        │  │ Account      │  │ State        │          │  │   │
│  │  │  │ Contracts    │  │ Abstraction  │  │ Management   │          │  │   │
│  │  │  │ (Solidity)   │  │ (EIP-7702)   │  │ (MPT)        │          │  │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      Consensus Layer (WBFT)                      │  │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │   │
│  │  │  │ Block        │  │ Validator    │  │ Finality     │          │  │   │
│  │  │  │ Producer     │  │ Selection    │  │ Manager      │          │  │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      Network Layer (P2P)                         │  │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │   │
│  │  │  │ libp2p /     │  │ Block        │  │ Transaction  │          │  │   │
│  │  │  │ devp2p       │  │ Propagation  │  │ Pool         │          │  │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         Data Layer                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │  LevelDB/    │  │  PostgreSQL  │  │  Redis       │  │  IPFS/     │ │  │
│  │  │  Pebble      │  │  (Off-chain) │  │  (Cache)     │  │  Arweave   │ │  │
│  │  │  (Chain)     │  │              │  │              │  │  (Storage) │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 모듈 식별

| 모듈 ID | 모듈명 | 유형 | 핵심 기능 |
|---------|--------|------|----------|
| M1 | Blockchain Core | On-chain | WBFT 합의, EVM 실행 |
| M2 | Smart Contracts | On-chain | 토큰, 거버넌스, Blacklist |
| M3 | Minter Manager | Off-chain | 발행/소각 관리, 은행 연동 |
| M4 | Secret Transfer Server | Off-chain | 프라이버시 거래 처리 |
| M5 | KYC/AML Service | Off-chain | 신원확인, 이상거래 탐지 |
| M6 | Bridge Service | Hybrid | 크로스체인 자산 이동 |
| M7 | Governance Service | Hybrid | 온체인 투표, 정책 관리 |
| M8 | API Gateway | Off-chain | 외부 인터페이스 |
| M9 | Monitoring/Alerting | Off-chain | 시스템 모니터링 |

---

## 2. 모듈별 기술 스택 상세

### 2.1 M1: Blockchain Core

#### 기술 스택

```yaml
blockchain_core:
  base_implementation:
    primary: go-ethereum (geth) v1.13+
    alternative: Hyperledger Besu (Java)
    rationale: "QBFT 지원, 프로덕션 검증됨, 활발한 커뮤니티"

  consensus:
    algorithm: WBFT (QBFT 커스터마이징)
    library: istanbul-tools (go-ethereum/istanbul)
    block_time: 1s
    finality: instant (1 block)

  execution:
    engine: EVM (Shanghai/Cancun spec)
    account_abstraction: EIP-7702 구현
    gas_model: EIP-1559 기반 커스텀

  state_management:
    trie: Modified Merkle Patricia Trie
    db_backend:
      primary: Pebble (성능 최적화)
      alternative: LevelDB
    pruning: archive 모드 권장 (감사 추적)

  networking:
    protocol: devp2p (eth/68 이상)
    discovery: discv5
    transport: TCP + QUIC (선택적)

  language: Go 1.21+

  dependencies:
    - github.com/ethereum/go-ethereum
    - github.com/consensys/quorum (QBFT 참조)
    - github.com/libp2p/go-libp2p (선택적)
```

#### WBFT 합의 구현 상세

```go
// WBFT 핵심 인터페이스 정의 (pseudo-code)
package consensus

type WBFTConfig struct {
    BlockPeriod        uint64        // 블록 생성 주기 (1초)
    RequestTimeout     time.Duration // 합의 요청 타임아웃
    ValidatorSet       []common.Address
    WeightedVoting     bool          // 가중 투표 여부
    MinValidatorWeight uint64        // 최소 검증자 가중치
}

type WBFTEngine interface {
    // 블록 제안
    Propose(block *types.Block) error

    // Pre-prepare 단계
    HandlePrePrepare(msg *PrePrepareMsg) error

    // Prepare 단계 (2/3 이상 동의 필요)
    HandlePrepare(msg *PrepareMsg) error

    // Commit 단계
    HandleCommit(msg *CommitMsg) error

    // Finality 확인
    VerifyFinality(block *types.Block) (bool, error)

    // 검증자 관리
    AddValidator(addr common.Address, weight uint64) error
    RemoveValidator(addr common.Address) error
    UpdateValidatorWeight(addr common.Address, weight uint64) error
}
```

#### 구현 난이도 및 리스크

| 항목 | 난이도 | 리스크 | 비고 |
|------|--------|--------|------|
| QBFT 포크 | 중 | 낮음 | Besu/Quorum 참조 가능 |
| EIP-7702 구현 | 상 | 중 | 메인넷 검증 필요 |
| 3000 TPS 달성 | 상 | 높음 | 검증자 수 제한 필요 |
| 1초 Finality | 중 | 중 | 네트워크 지연 고려 |

---

### 2.2 M2: Smart Contracts

#### 기술 스택

```yaml
smart_contracts:
  language:
    primary: Solidity 0.8.20+
    alternative: Vyper 0.3.10+ (보안 크리티컬)

  framework:
    development: Foundry (forge, cast, anvil)
    alternative: Hardhat
    rationale: "빠른 컴파일, 퍼징 테스트 내장"

  libraries:
    - "@openzeppelin/contracts": "5.0+"
    - "@openzeppelin/contracts-upgradeable": "5.0+"
    - "@chainlink/contracts": CCIP, Price Feeds

  patterns:
    upgradability: UUPS Proxy (EIP-1822)
    access_control: AccessControlEnumerable
    pausable: Pausable + Emergency Stop

  security_tools:
    static_analysis:
      - slither
      - mythril
      - securify2
    fuzzing:
      - echidna
      - foundry fuzz
    formal_verification:
      - certora (권장)
      - solidity-smt-checker

  testing:
    unit: forge test
    integration: forge script
    coverage: forge coverage (목표: 95%+)
```

#### 핵심 컨트랙트 구조

```
contracts/
├── core/
│   ├── StableToken.sol           # ERC20 + 추가 기능
│   ├── NativeCoinAdapter.sol     # Native ↔ ERC20 래퍼
│   └── GasStation.sol            # 가스비 대납 (EIP-7702)
├── minter/
│   ├── MinterRegistry.sol        # Minter 등록/관리
│   ├── MintController.sol        # 발행/소각 로직
│   └── ReserveOracle.sol         # PoR 오라클 연동
├── governance/
│   ├── GovCouncil.sol            # 최고 의결 기구
│   ├── GovMasterMinter.sol       # Minter 정책 관리
│   ├── GovValidator.sol          # 검증자 정책 관리
│   ├── TimelockController.sol    # 실행 지연
│   └── ProposalManager.sol       # 제안 관리
├── security/
│   ├── Blacklist.sol             # 계정 동결
│   ├── EmergencyStop.sol         # 긴급 중단
│   └── RateLimiter.sol           # 대량 이체 제한
├── privacy/
│   ├── StealthAddressRegistry.sol # ERC-6538 구현
│   ├── StealthAnnouncer.sol       # ERC-5564 구현
│   └── PrivateBank.sol            # Secret Account 관리
├── bridge/
│   ├── BridgeRouter.sol          # CCIP 연동
│   ├── LockAndMint.sol           # Lock & Mint 로직
│   └── BurnAndRelease.sol        # Burn & Release 로직
└── interfaces/
    ├── IStableToken.sol
    ├── IMinter.sol
    ├── IGovernance.sol
    └── IBridge.sol
```

#### StableToken 컨트랙트 예시

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title StableToken
 * @notice 원화 페깅 스테이블코인 (KRW Stablecoin)
 * @dev ERC20 + Blacklist + Minter 권한 관리
 */
contract StableToken is
    ERC20Upgradeable,
    AccessControlEnumerableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE = keccak256("BLACKLISTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Blacklist
    mapping(address => bool) private _blacklisted;

    // Rate Limiting
    mapping(address => uint256) public dailyMinted;
    mapping(address => uint256) public lastMintDay;
    uint256 public maxDailyMint;

    // Events
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    // Errors
    error AccountBlacklisted(address account);
    error DailyMintLimitExceeded(address minter, uint256 requested, uint256 remaining);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address admin,
        uint256 _maxDailyMint
    ) public initializer {
        __ERC20_init(name, symbol);
        __AccessControlEnumerable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        maxDailyMint = _maxDailyMint;
    }

    // ============ Mint/Burn Functions ============

    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        _checkNotBlacklisted(to);
        _checkDailyMintLimit(msg.sender, amount);

        _updateDailyMint(msg.sender, amount);
        _mint(to, amount);
    }

    function burn(uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    // ============ Blacklist Functions ============

    function blacklist(address account)
        external
        onlyRole(BLACKLISTER_ROLE)
    {
        _blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account)
        external
        onlyRole(BLACKLISTER_ROLE)
    {
        _blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    // ============ Transfer Override ============

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        _checkNotBlacklisted(from);
        _checkNotBlacklisted(to);
        super._update(from, to, value);
    }

    // ============ Internal Functions ============

    function _checkNotBlacklisted(address account) internal view {
        if (_blacklisted[account]) {
            revert AccountBlacklisted(account);
        }
    }

    function _checkDailyMintLimit(address minter, uint256 amount) internal view {
        uint256 today = block.timestamp / 1 days;
        uint256 minted = lastMintDay[minter] == today ? dailyMinted[minter] : 0;

        if (minted + amount > maxDailyMint) {
            revert DailyMintLimitExceeded(minter, amount, maxDailyMint - minted);
        }
    }

    function _updateDailyMint(address minter, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (lastMintDay[minter] != today) {
            dailyMinted[minter] = 0;
            lastMintDay[minter] = today;
        }
        dailyMinted[minter] += amount;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}
```

#### 보안 체크리스트

```yaml
security_checklist:
  access_control:
    - [ ] 모든 민감 함수에 역할 기반 접근 제어
    - [ ] DEFAULT_ADMIN_ROLE 분리 (멀티시그)
    - [ ] 역할 부여/해제 이벤트 로깅

  reentrancy:
    - [ ] ReentrancyGuard 적용 (외부 호출 포함 함수)
    - [ ] CEI 패턴 준수 (Checks-Effects-Interactions)
    - [ ] nonReentrant modifier 사용

  overflow:
    - [ ] Solidity 0.8+ 기본 보호 활용
    - [ ] 명시적 unchecked 블록 최소화

  upgrade_safety:
    - [ ] UUPS 패턴 사용 (투명 프록시 대비 가스 효율)
    - [ ] 업그레이드 권한 타임락 적용
    - [ ] 스토리지 레이아웃 검증 (openzeppelin-upgrades)

  external_calls:
    - [ ] 신뢰할 수 없는 컨트랙트 호출 최소화
    - [ ] 호출 실패 적절히 처리
    - [ ] 가스 제한 설정
```

---

### 2.3 M3: Minter Manager Service

#### 기술 스택

```yaml
minter_manager:
  language: Go 1.21+ (또는 Rust)

  framework:
    api: go-chi / gin-gonic
    grpc: google.golang.org/grpc

  database:
    primary: PostgreSQL 15+
    cache: Redis 7+
    encryption: pgcrypto + Vault

  key_management:
    hsm: AWS CloudHSM / Azure Dedicated HSM
    software: HashiCorp Vault (비HSM 환경)
    signing: ECDSA secp256k1

  bank_integration:
    protocol: 금융공동망 또는 오픈뱅킹 API
    message_format: ISO 20022 / 전문통신
    security: TLS 1.3 + 상호 인증서

  message_queue:
    broker: Apache Kafka (이벤트 소싱)
    alternative: RabbitMQ

  observability:
    metrics: Prometheus + Grafana
    tracing: OpenTelemetry + Jaeger
    logging: Structured JSON (ELK Stack)
```

#### 서비스 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Minter Manager Service                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │   API Layer     │     │  Business Logic │     │   Data Layer    │  │
│  │                 │     │                 │     │                 │  │
│  │ ┌─────────────┐│     │ ┌─────────────┐ │     │ ┌─────────────┐ │  │
│  │ │ REST API    ││◄───►│ │ Mint        │ │◄───►│ │ PostgreSQL  │ │  │
│  │ │ (External)  ││     │ │ Controller  │ │     │ │ (State)     │ │  │
│  │ └─────────────┘│     │ └─────────────┘ │     │ └─────────────┘ │  │
│  │                 │     │                 │     │                 │  │
│  │ ┌─────────────┐│     │ ┌─────────────┐ │     │ ┌─────────────┐ │  │
│  │ │ gRPC API    ││◄───►│ │ Burn        │ │◄───►│ │ Redis       │ │  │
│  │ │ (Internal)  ││     │ │ Controller  │ │     │ │ (Cache)     │ │  │
│  │ └─────────────┘│     │ └─────────────┘ │     │ └─────────────┘ │  │
│  │                 │     │                 │     │                 │  │
│  │ ┌─────────────┐│     │ ┌─────────────┐ │     │ ┌─────────────┐ │  │
│  │ │ Webhook     ││◄───►│ │ Reserve     │ │◄───►│ │ Kafka       │ │  │
│  │ │ (Bank)      ││     │ │ Manager     │ │     │ │ (Events)    │ │  │
│  │ └─────────────┘│     │ └─────────────┘ │     │ └─────────────┘ │  │
│  └─────────────────┘     └────────┬────────┘     └─────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────▼────────────────────────────────┐  │
│  │                      Integration Layer                           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│  │
│  │  │ Blockchain │  │   Bank     │  │   HSM/     │  │  PoR       ││  │
│  │  │ Client     │  │   Gateway  │  │   Vault    │  │  Oracle    ││  │
│  │  │ (geth RPC) │  │            │  │            │  │  (Certik)  ││  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘│  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 핵심 플로우: Mint 요청

```go
// Mint 요청 처리 플로우 (pseudo-code)
package minter

type MintRequest struct {
    MinterID      string          `json:"minter_id"`
    Amount        *big.Int        `json:"amount"`
    Recipient     common.Address  `json:"recipient"`
    BankTxRef     string          `json:"bank_tx_ref"`     // 은행 거래 참조
    DepositProof  *DepositProof   `json:"deposit_proof"`   // 입금 증빙
    Timestamp     time.Time       `json:"timestamp"`
    Signature     []byte          `json:"signature"`
}

type MintService struct {
    db            *sql.DB
    redis         *redis.Client
    blockchain    BlockchainClient
    hsm           HSMClient
    bankGateway   BankGateway
    kafka         *kafka.Producer
}

func (s *MintService) ProcessMint(ctx context.Context, req *MintRequest) (*MintResponse, error) {
    // 1. 요청 검증
    if err := s.validateRequest(ctx, req); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }

    // 2. Minter 권한 확인
    minter, err := s.verifyMinterAuthorization(ctx, req.MinterID)
    if err != nil {
        return nil, fmt.Errorf("minter verification failed: %w", err)
    }

    // 3. 일일 한도 확인
    if err := s.checkDailyLimit(ctx, minter, req.Amount); err != nil {
        return nil, fmt.Errorf("daily limit exceeded: %w", err)
    }

    // 4. 은행 입금 확인 (중요!)
    bankVerification, err := s.bankGateway.VerifyDeposit(ctx, req.BankTxRef, req.Amount)
    if err != nil || !bankVerification.Confirmed {
        return nil, fmt.Errorf("bank deposit not verified: %w", err)
    }

    // 5. 트랜잭션 생성 (HSM 서명)
    tx, err := s.buildMintTransaction(ctx, minter, req)
    if err != nil {
        return nil, fmt.Errorf("tx build failed: %w", err)
    }

    signedTx, err := s.hsm.SignTransaction(ctx, tx)
    if err != nil {
        return nil, fmt.Errorf("HSM signing failed: %w", err)
    }

    // 6. 트랜잭션 전송
    txHash, err := s.blockchain.SendTransaction(ctx, signedTx)
    if err != nil {
        return nil, fmt.Errorf("tx broadcast failed: %w", err)
    }

    // 7. 상태 저장 및 이벤트 발행
    mintRecord := &MintRecord{
        TxHash:    txHash,
        MinterID:  req.MinterID,
        Amount:    req.Amount,
        Recipient: req.Recipient,
        BankRef:   req.BankTxRef,
        Status:    "PENDING",
        CreatedAt: time.Now(),
    }

    if err := s.db.SaveMintRecord(ctx, mintRecord); err != nil {
        // 롤백 로직 필요
        return nil, fmt.Errorf("db save failed: %w", err)
    }

    // Kafka 이벤트 발행 (비동기 처리용)
    s.kafka.Produce(ctx, "mint-events", &MintEvent{
        Type:      "MINT_INITIATED",
        TxHash:    txHash,
        MinterID:  req.MinterID,
        Amount:    req.Amount,
        Timestamp: time.Now(),
    })

    return &MintResponse{
        TxHash:  txHash,
        Status:  "PENDING",
        Message: "Mint transaction submitted",
    }, nil
}
```

---

### 2.4 M4: Secret Transfer Server

#### 기술 스택

```yaml
secret_transfer:
  language: Rust (성능 + 메모리 안전성)

  framework:
    api: Actix-web 4.x
    async: Tokio runtime

  cryptography:
    stealth_address:
      - secp256k1 (ECDH)
      - BN254 (선택적, ZK용)
    encryption:
      - AES-256-GCM (데이터 암호화)
      - ChaCha20-Poly1305 (대체)
    hashing:
      - Keccak256 (이더리움 호환)
      - Poseidon (ZK 친화적, 선택적)

  database:
    primary: PostgreSQL (암호화 저장)
    encryption_at_rest:
      - Transparent Data Encryption (TDE)
      - Application-level encryption

  key_management:
    master_key: HSM 저장
    encryption_keys: Vault 또는 AWS KMS
    rotation: 90일 주기 자동 회전

  privacy_tech:
    current: Server-based Stealth (중앙화)
    recommended_upgrade:
      - ZK-SNARKs (groth16 / plonk)
      - TEE (Intel SGX / AWS Nitro)
```

#### 현재 구조 문제점 및 개선안

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Secret Transfer: 현재 vs 개선안                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [현재 구조 - 중앙화 문제]                                                │
│                                                                         │
│  Sender ──► Secret Transfer Server ──► Recipient                        │
│                     │                                                   │
│                     │ (모든 정보 보유)                                   │
│                     ▼                                                   │
│              ┌─────────────┐                                            │
│              │  Database   │ ◄── 해킹 시 전체 프라이버시 노출            │
│              │  (평문/암호화)│                                            │
│              └─────────────┘                                            │
│                                                                         │
│  문제점:                                                                 │
│  1. 서버가 Single Point of Failure                                      │
│  2. 서버 운영자가 모든 정보 열람 가능                                     │
│  3. "Secret" 명칭과 실제 구조의 괴리                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [개선안 A: TEE (Trusted Execution Environment)]                        │
│                                                                         │
│  Sender ──► TEE Enclave ──► Recipient                                   │
│                  │                                                      │
│                  │ (Enclave 내부에서만 복호화)                            │
│                  ▼                                                      │
│           ┌─────────────┐                                               │
│           │  Encrypted  │ ◄── 서버 운영자도 열람 불가                    │
│           │  Storage    │                                               │
│           └─────────────┘                                               │
│                                                                         │
│  기술 스택:                                                              │
│  - Intel SGX / AMD SEV                                                  │
│  - AWS Nitro Enclaves                                                   │
│  - Azure Confidential Computing                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [개선안 B: ZK-based Privacy]                                           │
│                                                                         │
│  Sender ──► ZK Proof Generation ──► On-chain Verification               │
│                                           │                             │
│                                           ▼                             │
│                                    ┌─────────────┐                      │
│                                    │ StealthAddr │                      │
│                                    │ (ERC-5564)  │                      │
│                                    └─────────────┘                      │
│                                           │                             │
│                                           ▼                             │
│                               Recipient (View Key로 스캔)               │
│                                                                         │
│  기술 스택:                                                              │
│  - circom + snarkjs (클라이언트 증명 생성)                               │
│  - groth16 / plonk verifier (온체인)                                    │
│  - arkworks-rs (Rust 구현)                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### TEE 기반 구현 예시

```rust
// TEE Enclave 내부 로직 (pseudo-code)
use sgx_tstd::*;
use aes_gcm::{Aes256Gcm, Key, Nonce};

/// Enclave 내부에서만 실행되는 함수
#[no_mangle]
pub extern "C" fn ecall_process_secret_transfer(
    sealed_sender_key: &[u8],
    sealed_recipient_key: &[u8],
    encrypted_amount: &[u8],
    encrypted_memo: &[u8],
) -> SgxResult<SecretTransferResult> {
    // 1. Sealed 데이터 복호화 (Enclave 내부에서만 가능)
    let sender_key = unseal_data(sealed_sender_key)?;
    let recipient_key = unseal_data(sealed_recipient_key)?;

    // 2. 암호화된 데이터 복호화
    let amount = decrypt_in_enclave(encrypted_amount, &sender_key)?;
    let memo = decrypt_in_enclave(encrypted_memo, &sender_key)?;

    // 3. Stealth Address 생성
    let (stealth_addr, ephemeral_pubkey) = generate_stealth_address(&recipient_key)?;

    // 4. 수신자만 복호화 가능하도록 재암호화
    let recipient_encrypted = encrypt_for_recipient(&amount, &memo, &recipient_key)?;

    // 5. Enclave 외부로 전달할 데이터 (암호화 상태 유지)
    Ok(SecretTransferResult {
        stealth_address: stealth_addr,
        ephemeral_pubkey,
        encrypted_payload: recipient_encrypted,
        announcement: generate_announcement(&stealth_addr, &ephemeral_pubkey)?,
    })
}
```

---

### 2.5 M5: KYC/AML Service

#### 기술 스택

```yaml
kyc_aml:
  language: Python 3.11+ (또는 Go)

  framework:
    api: FastAPI
    async: asyncio + httpx

  external_integrations:
    blockchain_analytics:
      primary: Chainalysis KYT API
      alternative: Elliptic, TRM Labs

    identity_verification:
      primary: 본인확인기관 연동 (PASS 인증 등)
      alternative: Jumio, Onfido

    sanctions_screening:
      - OFAC SDN List
      - UN Sanctions List
      - 금융위 제재 목록

  rule_engine:
    framework: custom rules engine 또는 Drools
    rules:
      - 대량 이체 탐지 (CTR: 1000만원 이상)
      - 구조화 거래 탐지 (Structuring)
      - 고위험 국가 거래
      - 의심 패턴 (ML 기반)

  machine_learning:
    framework: scikit-learn / PyTorch
    models:
      - Anomaly Detection (Isolation Forest)
      - Graph Neural Network (거래 패턴)
      - Sequence Model (행동 패턴)

  database:
    primary: PostgreSQL (규제 데이터)
    graph: Neo4j (거래 관계 분석)
    search: Elasticsearch (로그 분석)

  compliance:
    travel_rule: TRISA / OpenVASP 프로토콜
    reporting:
      - STR (의심거래보고)
      - CTR (고액현금거래보고)
```

#### Travel Rule 구현

```python
# Travel Rule 구현 (pseudo-code)
from dataclasses import dataclass
from enum import Enum
import httpx

class TravelRuleProtocol(Enum):
    TRISA = "trisa"
    OPENVASP = "openvasp"
    SYGNA = "sygna"

@dataclass
class TravelRuleData:
    """Travel Rule 전송 데이터 (FATF 권고안 기반)"""
    # Originator (송금인) 정보
    originator_name: str
    originator_account: str
    originator_address: str  # 물리적 주소
    originator_id_type: str  # 신분증 종류
    originator_id_number: str

    # Beneficiary (수취인) 정보
    beneficiary_name: str
    beneficiary_account: str
    beneficiary_vasp: str  # 수취 VASP 식별자

    # Transaction 정보
    amount: str
    currency: str
    tx_hash: str
    timestamp: str

class TravelRuleService:
    def __init__(self, config: TravelRuleConfig):
        self.protocol = config.protocol
        self.vasp_id = config.vasp_id
        self.private_key = config.private_key

    async def send_travel_rule_data(
        self,
        data: TravelRuleData,
        counterparty_vasp: str
    ) -> TravelRuleResponse:
        """
        100만원 이상 가상자산 이전 시 Travel Rule 데이터 전송
        """
        # 1. 상대방 VASP 조회 (TRISA Directory)
        counterparty = await self.lookup_vasp(counterparty_vasp)
        if not counterparty:
            raise VASPNotFoundError(counterparty_vasp)

        # 2. 데이터 암호화 (상대방 공개키로)
        encrypted_data = self.encrypt_for_vasp(data, counterparty.public_key)

        # 3. 서명
        signature = self.sign_message(encrypted_data)

        # 4. 전송
        response = await self.client.post(
            counterparty.endpoint,
            json={
                "protocol_version": "1.0",
                "sender_vasp": self.vasp_id,
                "encrypted_data": encrypted_data,
                "signature": signature,
            }
        )

        # 5. 응답 검증
        if response.status_code == 200:
            return TravelRuleResponse(
                status="ACCEPTED",
                reference_id=response.json()["reference_id"]
            )
        else:
            return TravelRuleResponse(
                status="REJECTED",
                reason=response.json().get("reason")
            )

    async def receive_travel_rule_data(
        self,
        encrypted_data: bytes,
        sender_vasp: str,
        signature: bytes
    ) -> TravelRuleData:
        """Travel Rule 데이터 수신 및 검증"""
        # 1. 서명 검증
        sender = await self.lookup_vasp(sender_vasp)
        if not self.verify_signature(encrypted_data, signature, sender.public_key):
            raise InvalidSignatureError()

        # 2. 복호화
        data = self.decrypt_data(encrypted_data)

        # 3. 데이터 검증
        self.validate_travel_rule_data(data)

        # 4. 저장 (규제 요구사항: 5년 보관)
        await self.store_travel_rule_record(data)

        return data
```

---

### 2.6 M6: Bridge Service

#### 기술 스택

```yaml
bridge:
  architecture: Lock-and-Mint / Burn-and-Release

  cross_chain_protocol:
    primary: Chainlink CCIP
    alternative:
      - LayerZero
      - Axelar
      - Wormhole

  language: Solidity (컨트랙트) + Go/Rust (릴레이어)

  security:
    multisig:
      threshold: 5-of-8 (최소)
      signers: 분산된 지리적 위치
    timelock: 24시간 (대량 출금)
    rate_limiting:
      per_tx: 10억원
      daily: 100억원
    monitoring:
      - 실시간 유동성 모니터링
      - 이상 거래 탐지

  supported_chains:
    initial:
      - Ethereum Mainnet
      - Polygon PoS
    planned:
      - Arbitrum One
      - Optimism
      - Base
```

#### CCIP 연동 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CCIP Bridge Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  StableNet                              Ethereum                        │
│  ┌─────────────────┐                    ┌─────────────────┐            │
│  │                 │                    │                 │            │
│  │  BridgeRouter   │                    │  BridgeRouter   │            │
│  │  (Source)       │                    │  (Destination)  │            │
│  │                 │                    │                 │            │
│  │  ┌───────────┐  │                    │  ┌───────────┐  │            │
│  │  │   Lock    │  │                    │  │   Mint    │  │            │
│  │  │  KRW-SC   │  │                    │  │  wKRW-SC  │  │            │
│  │  └───────────┘  │                    │  └───────────┘  │            │
│  └────────┬────────┘                    └────────▲────────┘            │
│           │                                      │                      │
│           │ CCIP Message                         │                      │
│           ▼                                      │                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Chainlink CCIP                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │ Committing│  │ Risk     │  │ Executing│  │ Off-chain │        │   │
│  │  │ DON      │  │ Management│  │ DON      │  │ Reporting │        │   │
│  │  │          │  │ Network  │  │          │  │           │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Security Layers:                                                       │
│  1. Source Chain Finality Wait                                         │
│  2. Risk Management Network (이상 탐지)                                 │
│  3. Rate Limiting (온체인)                                              │
│  4. Multisig Emergency Pause                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2.7 M7: Governance Service

#### 기술 스택

```yaml
governance:
  on_chain:
    framework: OpenZeppelin Governor (커스터마이징)
    voting:
      - Token-weighted voting
      - Quadratic voting (선택적)
      - Conviction voting (선택적)
    timelock: TimelockController (48시간+)

  off_chain:
    snapshot: Snapshot.org 연동 (가스비 절감)
    discussion: Discourse 또는 Commonwealth

  proposal_types:
    - Parameter Change (수수료, 한도 등)
    - Minter Management (추가/제거)
    - Validator Management
    - Emergency Actions
    - Upgrade Proposals
```

---

## 3. 서비스 간 통신 프로토콜

### 3.1 프로토콜 매트릭스

| 통신 경로 | 프로토콜 | 포맷 | 보안 | 용도 |
|----------|---------|------|------|------|
| Client ↔ API Gateway | HTTPS | JSON | TLS 1.3 | 외부 API |
| API Gateway ↔ Services | gRPC | Protobuf | mTLS | 내부 통신 |
| Services ↔ Blockchain | JSON-RPC | JSON | TLS | 체인 조회/TX |
| Services ↔ Kafka | Kafka Protocol | Avro/Protobuf | SASL_SSL | 이벤트 |
| Validators ↔ Validators | devp2p | RLP | libp2p noise | P2P 합의 |
| Bridge ↔ CCIP | CCIP Protocol | ABI Encoded | - | 크로스체인 |
| KYC ↔ Chainalysis | HTTPS | JSON | API Key + TLS | 외부 API |

### 3.2 API 스키마 정의

#### gRPC Service Definitions

```protobuf
// minter_service.proto
syntax = "proto3";

package stablenet.minter;

import "google/protobuf/timestamp.proto";

service MinterService {
    // Mint 요청
    rpc RequestMint(MintRequest) returns (MintResponse);

    // Burn 요청
    rpc RequestBurn(BurnRequest) returns (BurnResponse);

    // Minter 상태 조회
    rpc GetMinterStatus(MinterStatusRequest) returns (MinterStatusResponse);

    // 실시간 Mint/Burn 이벤트 스트림
    rpc SubscribeMintEvents(SubscribeRequest) returns (stream MintEvent);
}

message MintRequest {
    string minter_id = 1;
    string amount = 2;  // Wei 단위 문자열
    string recipient = 3;  // 0x address
    string bank_tx_ref = 4;
    DepositProof deposit_proof = 5;
    google.protobuf.Timestamp timestamp = 6;
    bytes signature = 7;
}

message DepositProof {
    string bank_code = 1;
    string account_number = 2;
    string depositor_name = 3;
    string amount = 4;
    google.protobuf.Timestamp deposit_time = 5;
    string bank_reference = 6;
}

message MintResponse {
    string tx_hash = 1;
    MintStatus status = 2;
    string message = 3;
    google.protobuf.Timestamp estimated_confirmation = 4;
}

enum MintStatus {
    MINT_STATUS_UNSPECIFIED = 0;
    MINT_STATUS_PENDING = 1;
    MINT_STATUS_CONFIRMED = 2;
    MINT_STATUS_FAILED = 3;
}

message MintEvent {
    string event_id = 1;
    string event_type = 2;  // INITIATED, CONFIRMED, FAILED
    string tx_hash = 3;
    string minter_id = 4;
    string amount = 5;
    string recipient = 6;
    google.protobuf.Timestamp timestamp = 7;
    map<string, string> metadata = 8;
}
```

#### REST API (External)

```yaml
# openapi.yaml (일부)
openapi: 3.1.0
info:
  title: StableNet API
  version: 1.0.0

paths:
  /v1/accounts/{address}/balance:
    get:
      summary: 계정 잔액 조회
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
            pattern: "^0x[a-fA-F0-9]{40}$"
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BalanceResponse'

  /v1/transfers:
    post:
      summary: 일반 이체
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransferRequest'
      responses:
        '202':
          description: 요청 접수됨
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransferResponse'

  /v1/secret-transfers:
    post:
      summary: Secret Account 이체
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SecretTransferRequest'
      responses:
        '202':
          description: 요청 접수됨

components:
  schemas:
    TransferRequest:
      type: object
      required:
        - from
        - to
        - amount
      properties:
        from:
          type: string
          description: 송신 주소
        to:
          type: string
          description: 수신 주소
        amount:
          type: string
          description: 금액 (Wei 단위)
        memo:
          type: string
          maxLength: 256
          description: 메모 (선택)

    SecretTransferRequest:
      type: object
      required:
        - from_secret_account
        - to_stealth_meta_address
        - amount
      properties:
        from_secret_account:
          type: string
        to_stealth_meta_address:
          type: string
          description: 수신자의 Stealth Meta Address
        amount:
          type: string
        encrypted_memo:
          type: string
          description: 암호화된 메모

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### 3.3 이벤트 스키마 (Kafka)

```json
// Avro Schema: mint_event.avsc
{
  "type": "record",
  "name": "MintEvent",
  "namespace": "com.stablenet.events",
  "fields": [
    {"name": "event_id", "type": "string"},
    {"name": "event_type", "type": {"type": "enum", "name": "EventType", "symbols": ["INITIATED", "PENDING", "CONFIRMED", "FAILED"]}},
    {"name": "tx_hash", "type": ["null", "string"]},
    {"name": "minter_id", "type": "string"},
    {"name": "amount", "type": "string"},
    {"name": "recipient", "type": "string"},
    {"name": "block_number", "type": ["null", "long"]},
    {"name": "timestamp", "type": "long", "logicalType": "timestamp-millis"},
    {"name": "metadata", "type": {"type": "map", "values": "string"}}
  ]
}
```

### 3.4 통신 시퀀스 다이어그램

#### Mint 요청 시퀀스

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Minter │     │   API   │     │ Minter  │     │  Bank   │     │Blockchain│
│  Client │     │ Gateway │     │ Manager │     │ Gateway │     │  Node   │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ POST /mint    │               │               │               │
     │──────────────►│               │               │               │
     │               │ gRPC: RequestMint             │               │
     │               │──────────────►│               │               │
     │               │               │               │               │
     │               │               │ VerifyDeposit │               │
     │               │               │──────────────►│               │
     │               │               │               │               │
     │               │               │◄──────────────│               │
     │               │               │  DepositConfirmed              │
     │               │               │               │               │
     │               │               │ HSM Sign      │               │
     │               │               │───────┐       │               │
     │               │               │◄──────┘       │               │
     │               │               │               │               │
     │               │               │ eth_sendRawTransaction        │
     │               │               │──────────────────────────────►│
     │               │               │               │               │
     │               │               │◄──────────────────────────────│
     │               │               │  tx_hash                      │
     │               │               │               │               │
     │               │◄──────────────│               │               │
     │               │ MintResponse  │               │               │
     │◄──────────────│               │               │               │
     │  202 Accepted │               │               │               │
     │               │               │               │               │
     │               │               │ Kafka: MintEvent (PENDING)    │
     │               │               │───────────────────────────────┤
     │               │               │               │               │
     │               │               │               │  NewBlock     │
     │               │               │◄──────────────────────────────│
     │               │               │               │               │
     │               │               │ Kafka: MintEvent (CONFIRMED)  │
     │               │               │───────────────────────────────┤
     │               │               │               │               │
```

---

## 4. 보안 아키텍처 분석

### 4.1 위협 모델링 (STRIDE)

| 위협 유형 | 대상 | 시나리오 | 현재 대응 | 개선 필요 |
|----------|------|---------|----------|----------|
| **S**poofing | Minter API | 위조된 Minter 요청 | API Key + Signature | HSM 기반 인증 |
| **T**ampering | 트랜잭션 | 중간자 공격 | TLS | mTLS + 서명 검증 |
| **R**epudiation | Mint/Burn | 거래 부인 | 로깅 | 온체인 증거 + HSM 로그 |
| **I**nformation Disclosure | Secret Account | 서버 해킹 | 암호화 저장 | TEE / ZK |
| **D**enial of Service | Blockchain | 스팸 공격 | BaseFee 증가 | Rate Limiting 강화 |
| **E**levation of Privilege | Governance | 권한 탈취 | Role-based | Timelock + Multisig |

### 4.2 컨트랙트 보안 분석

#### 취약점 체크리스트

```yaml
vulnerability_check:
  high_severity:
    - reentrancy:
        status: "ReentrancyGuard 필요"
        affected: "모든 external 함수"
        mitigation: "OpenZeppelin ReentrancyGuard 적용"

    - access_control:
        status: "Role 기반 구현 필요"
        affected: "mint, burn, blacklist, upgrade"
        mitigation: "AccessControlEnumerable + 멀티시그"

    - upgrade_vulnerability:
        status: "UUPS 패턴 권장"
        affected: "프록시 컨트랙트"
        mitigation: "Timelock + 멀티시그 업그레이드"

  medium_severity:
    - front_running:
        status: "잠재적 위험"
        affected: "대량 이체, 거버넌스 투표"
        mitigation: "Commit-Reveal 또는 Flashbots"

    - oracle_manipulation:
        status: "PoR 오라클 의존"
        affected: "Reserve 검증"
        mitigation: "Chainlink 다중 오라클 + 지연 시간"

    - dos_gas_limit:
        status: "배열 순회 주의"
        affected: "Blacklist 일괄 처리"
        mitigation: "페이지네이션, 가스 제한"

  low_severity:
    - timestamp_dependence:
        status: "1일 계산에 사용"
        affected: "dailyMinted 체크"
        mitigation: "허용 가능한 수준"

    - integer_overflow:
        status: "Solidity 0.8+ 기본 보호"
        mitigation: "추가 조치 불필요"
```

### 4.3 키 관리 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Key Management Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         HSM Cluster                              │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │   │
│  │  │  Master Key   │  │  Signing Keys │  │  Encryption   │       │   │
│  │  │  (Root)       │  │  (Minter)     │  │  Keys         │       │   │
│  │  │               │  │               │  │               │       │   │
│  │  │  FIPS 140-2   │  │  secp256k1    │  │  AES-256      │       │   │
│  │  │  Level 3      │  │               │  │               │       │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      HashiCorp Vault                             │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │   │
│  │  │  Transit      │  │  KV Secrets   │  │  PKI          │       │   │
│  │  │  Engine       │  │  Engine       │  │  Engine       │       │   │
│  │  │               │  │               │  │               │       │   │
│  │  │  - Encrypt    │  │  - API Keys   │  │  - TLS Certs  │       │   │
│  │  │  - Decrypt    │  │  - DB Creds   │  │  - mTLS       │       │   │
│  │  │  - Sign       │  │  - Tokens     │  │               │       │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Key Hierarchy                               │   │
│  │                                                                  │   │
│  │  Master Key (HSM)                                                │   │
│  │       │                                                          │   │
│  │       ├── KEK (Key Encryption Key)                               │   │
│  │       │       │                                                  │   │
│  │       │       ├── Minter Signing Keys                            │   │
│  │       │       ├── Service Encryption Keys                        │   │
│  │       │       └── API Authentication Keys                        │   │
│  │       │                                                          │   │
│  │       ├── Validator Keys                                         │   │
│  │       │       │                                                  │   │
│  │       │       ├── Consensus Signing                              │   │
│  │       │       └── P2P Identity                                   │   │
│  │       │                                                          │   │
│  │       └── Admin Keys (Multisig)                                  │   │
│  │               │                                                  │   │
│  │               ├── Upgrade Authority (3-of-5)                     │   │
│  │               ├── Emergency Pause (2-of-3)                       │   │
│  │               └── Blacklist Authority (2-of-3)                   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Key Rotation Policy:                                                   │
│  - Master Key: 연 1회 (HSM 내부)                                        │
│  - KEK: 분기 1회                                                        │
│  - Service Keys: 월 1회 자동 회전                                        │
│  - API Keys: 90일 자동 만료                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 네트워크 보안

```yaml
network_security:
  perimeter:
    waf: AWS WAF / Cloudflare
    ddos: AWS Shield / Cloudflare DDoS Protection
    cdn: CloudFront / Cloudflare CDN

  api_gateway:
    rate_limiting:
      anonymous: 100 req/min
      authenticated: 1000 req/min
      minter: 10000 req/min
    authentication:
      - JWT (short-lived)
      - API Key + HMAC Signature
    input_validation:
      - JSON Schema validation
      - SQL injection prevention
      - XSS prevention

  internal:
    network: VPC with private subnets
    communication: mTLS everywhere
    secrets: Vault integration

  blockchain:
    p2p_encryption: libp2p noise protocol
    validator_network: Private subnet
    rpc_access: Whitelist only (초기)
```

---

## 5. 구현 가능성 평가

### 5.1 모듈별 구현 난이도

| 모듈 | 난이도 | 예상 기간 | 팀 규모 | 리스크 |
|------|--------|----------|---------|--------|
| Blockchain Core (WBFT) | 상 | 6-9개월 | 4-5명 | 높음 |
| Smart Contracts | 중 | 3-4개월 | 2-3명 | 중간 |
| Minter Manager | 중 | 3-4개월 | 2-3명 | 중간 |
| Secret Transfer (현재) | 중 | 2-3개월 | 2명 | 낮음 |
| Secret Transfer (TEE) | 상 | 4-6개월 | 3명 | 높음 |
| KYC/AML | 중 | 3-4개월 | 2-3명 | 중간 |
| Bridge (CCIP) | 중상 | 4-5개월 | 2-3명 | 중간 |
| Governance | 중 | 2-3개월 | 2명 | 낮음 |
| API Gateway | 중하 | 2-3개월 | 2명 | 낮음 |

### 5.2 기술적 실현 가능성 매트릭스

| 기능 | 기술 성숙도 | 구현 복잡도 | 종합 평가 |
|------|-----------|-----------|----------|
| WBFT (QBFT 기반) | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 실현 가능 |
| EIP-7702 Account Abstraction | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 실현 가능 |
| 3000 TPS | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ 조건부 |
| 1초 Finality | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 실현 가능 |
| Secret Account (현재) | ⭐⭐⭐ | ⭐⭐ | ⚠️ 보안 우려 |
| Secret Account (TEE) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ 권장 |
| CCIP Bridge | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 실현 가능 |
| Travel Rule | ⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ 실현 가능 |

### 5.3 3000 TPS 달성 조건 분석

```yaml
tps_analysis:
  target: 3000 TPS

  qbft_baseline:
    measured: ~200 TPS (4-12 validators)
    source: "Web3 Labs, Hyperledger Besu benchmarks"

  gap: 15x improvement required

  optimization_strategies:
    1_validator_reduction:
      description: "검증자 수 최소화"
      target_validators: 4-7
      expected_gain: "1.5-2x"
      trade_off: "탈중앙화 감소"

    2_block_optimization:
      description: "블록 크기 및 가스 리밋 최적화"
      block_gas_limit: "30M → 100M+"
      expected_gain: "2-3x"
      trade_off: "노드 요구사양 증가"

    3_hardware_optimization:
      description: "고성능 하드웨어 + 전용 네트워크"
      specs:
        cpu: "64+ cores"
        ram: "256GB+"
        storage: "NVMe SSD RAID"
        network: "10Gbps dedicated"
      expected_gain: "2-3x"
      trade_off: "운영 비용 증가"

    4_consensus_optimization:
      description: "WBFT 자체 최적화"
      techniques:
        - "메시지 압축"
        - "배치 검증"
        - "병렬 실행"
        - "파이프라이닝"
      expected_gain: "1.5-2x"
      trade_off: "개발 복잡도 증가"

  combined_estimate:
    optimistic: "200 × 2 × 3 × 2 = 2400 TPS"
    realistic: "200 × 1.5 × 2 × 1.5 = 900 TPS"
    pessimistic: "200 × 1.2 × 1.5 × 1.2 = 432 TPS"

  conclusion: |
    3000 TPS 달성은 매우 도전적.
    현실적으로 1000-1500 TPS가 달성 가능한 목표.
    3000 TPS 주장을 위해서는 독립 벤치마크 결과 공개 필수.
```

---

## 6. 성능 및 효율성 분석

### 6.1 처리량 분석

```yaml
throughput_analysis:
  blockchain_layer:
    block_time: 1s
    block_gas_limit: 30_000_000 (기본)
    simple_transfer_gas: ~21_000
    erc20_transfer_gas: ~65_000

    theoretical_tps:
      simple_transfer: "30M / 21K = ~1428 TPS"
      erc20_transfer: "30M / 65K = ~461 TPS"

    practical_tps:
      with_state_access: "~300-500 TPS"
      with_complex_logic: "~100-200 TPS"

  service_layer:
    minter_manager:
      target: "1000 req/s"
      bottleneck: "HSM 서명 속도"
      mitigation: "HSM 클러스터링, 배치 서명"

    secret_transfer:
      target: "500 req/s"
      bottleneck: "암호화 연산"
      mitigation: "하드웨어 가속 (AES-NI)"

    api_gateway:
      target: "10000 req/s"
      technology: "NGINX + Go"
      scaling: "수평 확장"
```

### 6.2 지연 시간 분석

```yaml
latency_analysis:
  end_to_end_mint:
    target: "< 3s (확정까지)"
    breakdown:
      api_processing: "50ms"
      bank_verification: "500ms-2s (외부 의존)"
      hsm_signing: "50ms"
      tx_broadcast: "100ms"
      block_inclusion: "1s (1 block)"
      confirmation: "0ms (instant finality)"
    total: "1.7s - 3.2s"

  end_to_end_transfer:
    target: "< 2s"
    breakdown:
      api_processing: "30ms"
      tx_broadcast: "100ms"
      block_inclusion: "1s"
    total: "~1.2s"

  secret_transfer:
    target: "< 5s"
    breakdown:
      encryption: "100ms"
      server_processing: "200ms"
      batch_wait: "1-3s (배치 주기)"
      tx_broadcast: "100ms"
      block_inclusion: "1s"
    total: "2.4s - 4.4s"
```

### 6.3 확장성 분석

```yaml
scalability:
  vertical:
    current: "단일 체인"
    limit: "~1000 TPS (현실적)"

  horizontal:
    approach: "샤딩 없음 (초기)"
    future_options:
      - "L2 Rollup (ZK/Optimistic)"
      - "App-specific Rollup"
      - "Validium"

  service_layer:
    approach: "마이크로서비스 + K8s"
    auto_scaling:
      metric: "CPU/Memory/Request Rate"
      min_replicas: 3
      max_replicas: 50
```

---

## 7. 보안 개선을 위한 추가 기술 스택

### 7.1 필수 보안 강화 기술

#### 7.1.1 TEE (Trusted Execution Environment)

```yaml
tee_implementation:
  purpose: "Secret Account 프라이버시 강화"

  options:
    aws_nitro_enclaves:
      pros:
        - "AWS 네이티브 통합"
        - "관리형 서비스"
        - "PCR 기반 증명"
      cons:
        - "AWS 종속"
        - "성능 오버헤드"
      use_case: "클라우드 환경 권장"

    intel_sgx:
      pros:
        - "하드웨어 레벨 격리"
        - "넓은 생태계"
        - "Gramine 등 프레임워크"
      cons:
        - "사이드채널 취약점 이력"
        - "메모리 제한"
      use_case: "온프레미스 환경"

    amd_sev:
      pros:
        - "VM 레벨 암호화"
        - "대용량 메모리"
      cons:
        - "SGX 대비 덜 성숙"
      use_case: "VM 기반 워크로드"

  recommended: "AWS Nitro Enclaves (클라우드) + Intel SGX (온프레미스)"
```

#### 7.1.2 ZK (Zero Knowledge) 기술

```yaml
zk_implementation:
  purpose: "프라이버시 + 확장성"

  use_cases:
    privacy:
      target: "Secret Account 진정한 프라이버시"
      approach: "ZK-SNARK 잔액 증명"
      stack:
        proving_system: "Groth16 또는 PLONK"
        circuit_language: "Circom 2.0"
        library: "snarkjs / rapidsnark"

    scalability:
      target: "TPS 확장"
      approach: "ZK-Rollup"
      stack:
        framework: "zkSync Era / Scroll / Polygon zkEVM"
        prover: "GPU 가속"

  implementation_complexity:
    privacy_proof: "중상 (3-4개월)"
    zk_rollup: "상 (6-12개월)"

  recommended: |
    단기: TEE 기반 Secret Account
    중기: ZK-SNARK 잔액 증명 추가
    장기: ZK-Rollup L2 검토
```

#### 7.1.3 MPC (Multi-Party Computation)

```yaml
mpc_implementation:
  purpose: "키 관리 분산화"

  use_cases:
    threshold_signature:
      target: "Minter 서명 키 분산"
      approach: "TSS (Threshold Signature Scheme)"
      threshold: "3-of-5 또는 5-of-8"
      stack:
        library: "tss-lib (Binance)"
        protocol: "GG20 / CGGMP"

    key_generation:
      target: "분산 키 생성"
      approach: "DKG (Distributed Key Generation)"
      stack:
        library: "FROST / DKLS"

  benefits:
    - "단일 장애점 제거"
    - "내부자 공격 방지"
    - "키 분실 복구 가능"

  recommended: |
    Minter 서명 키: TSS 3-of-5
    Governance 키: TSS 5-of-8
    Emergency 키: TSS 2-of-3
```

### 7.2 추가 보안 인프라

```yaml
security_infrastructure:
  waf_and_ddos:
    primary: "Cloudflare Enterprise"
    alternative: "AWS WAF + Shield"
    features:
      - "Rate limiting"
      - "Bot protection"
      - "DDoS mitigation"
      - "Custom rules"

  secrets_management:
    primary: "HashiCorp Vault Enterprise"
    features:
      - "Dynamic secrets"
      - "Auto-rotation"
      - "Audit logging"
      - "HSM integration"

  siem_and_monitoring:
    siem: "Splunk / Elastic SIEM"
    monitoring: "Datadog / Grafana"
    alerting: "PagerDuty"
    features:
      - "Real-time threat detection"
      - "Anomaly detection (ML)"
      - "Compliance reporting"
      - "Incident response automation"

  vulnerability_management:
    container_scanning: "Snyk / Trivy"
    dependency_scanning: "Dependabot / Renovate"
    penetration_testing: "연 2회 (외부 업체)"
    bug_bounty: "Immunefi 등록"

  code_security:
    sast: "SonarQube / Semgrep"
    smart_contract:
      - "Slither"
      - "Mythril"
      - "Certora Prover"
    audit: "Trail of Bits / OpenZeppelin"
```

### 7.3 보안 강화 로드맵

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Security Enhancement Roadmap                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: Foundation (0-3 months)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ □ HSM 구축 (AWS CloudHSM)                                        │   │
│  │ □ Vault 구축 및 시크릿 마이그레이션                                │   │
│  │ □ WAF/DDoS 구성 (Cloudflare)                                     │   │
│  │ □ 기본 모니터링/알람 구축                                         │   │
│  │ □ 스마트 컨트랙트 1차 감사                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Phase 2: Enhancement (3-6 months)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ □ TEE 기반 Secret Transfer 구현 (AWS Nitro)                      │   │
│  │ □ TSS 기반 Minter 키 분산                                        │   │
│  │ □ SIEM 구축 (Splunk)                                             │   │
│  │ □ 버그 바운티 프로그램 런칭                                        │   │
│  │ □ 침투 테스트 1차                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Phase 3: Advanced (6-12 months)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ □ ZK-SNARK 잔액 증명 (선택적)                                     │   │
│  │ □ 정형 검증 (Certora)                                            │   │
│  │ □ SOC 2 Type II 인증                                             │   │
│  │ □ 침투 테스트 2차                                                 │   │
│  │ □ Red Team 훈련                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Phase 4: Maturity (12+ months)                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ □ ISO 27001 인증                                                  │   │
│  │ □ 자동화된 보안 테스트 파이프라인                                   │   │
│  │ □ 24/7 SOC 운영                                                   │   │
│  │ □ 재해 복구 훈련                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 권장 구현 아키텍처

### 8.1 최종 권장 기술 스택 요약

```yaml
recommended_stack:
  blockchain:
    base: "go-ethereum v1.13+ (포크)"
    consensus: "WBFT (QBFT 커스터마이징)"
    execution: "EVM (Shanghai+)"
    account_abstraction: "EIP-7702"

  smart_contracts:
    language: "Solidity 0.8.20+"
    framework: "Foundry"
    libraries: "OpenZeppelin 5.0+"
    patterns: "UUPS Proxy, AccessControl"

  backend_services:
    language: "Go 1.21+ (주요), Rust (암호화)"
    api: "gRPC (내부), REST (외부)"
    database: "PostgreSQL 15+"
    cache: "Redis 7+"
    queue: "Kafka"

  security:
    hsm: "AWS CloudHSM"
    secrets: "HashiCorp Vault"
    tee: "AWS Nitro Enclaves"
    mpc: "tss-lib (TSS)"

  infrastructure:
    cloud: "AWS (주요), GCP (DR)"
    container: "Kubernetes (EKS)"
    ci_cd: "GitHub Actions + ArgoCD"
    monitoring: "Prometheus + Grafana + Datadog"

  compliance:
    kyc: "본인확인기관 연동"
    aml: "Chainalysis KYT"
    travel_rule: "TRISA / OpenVASP"
```

### 8.2 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Production Deployment Architecture                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Region: ap-northeast-2 (Seoul)         Region: ap-northeast-1 (Tokyo)  │
│  ┌─────────────────────────────┐       ┌─────────────────────────────┐ │
│  │      Production (Primary)    │       │      DR (Secondary)         │ │
│  │                              │       │                              │ │
│  │  ┌────────────────────────┐ │       │  ┌────────────────────────┐ │ │
│  │  │    EKS Cluster         │ │       │  │    EKS Cluster         │ │ │
│  │  │  ┌──────┐ ┌──────┐    │ │       │  │  ┌──────┐ ┌──────┐    │ │ │
│  │  │  │ API  │ │Minter│    │ │       │  │  │ API  │ │Minter│    │ │ │
│  │  │  │ GW   │ │ Mgr  │    │ │       │  │  │ GW   │ │ Mgr  │    │ │ │
│  │  │  └──────┘ └──────┘    │ │       │  │  └──────┘ └──────┘    │ │ │
│  │  │  ┌──────┐ ┌──────┐    │ │       │  │  ┌──────┐ ┌──────┐    │ │ │
│  │  │  │Secret│ │ KYC/ │    │ │       │  │  │Secret│ │ KYC/ │    │ │ │
│  │  │  │ Xfer │ │ AML  │    │ │       │  │  │ Xfer │ │ AML  │    │ │ │
│  │  │  └──────┘ └──────┘    │ │       │  │  └──────┘ └──────┘    │ │ │
│  │  └────────────────────────┘ │       │  └────────────────────────┘ │ │
│  │                              │       │                              │ │
│  │  ┌────────────────────────┐ │       │  ┌────────────────────────┐ │ │
│  │  │   Validator Nodes      │ │  ◄──► │  │   Validator Nodes      │ │ │
│  │  │   (Private Subnet)     │ │ P2P   │  │   (Private Subnet)     │ │ │
│  │  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐  │ │       │  │  ┌──┐ ┌──┐            │ │ │
│  │  │  │V1│ │V2│ │V3│ │V4│  │ │       │  │  │V5│ │V6│            │ │ │
│  │  │  └──┘ └──┘ └──┘ └──┘  │ │       │  │  └──┘ └──┘            │ │ │
│  │  └────────────────────────┘ │       │  └────────────────────────┘ │ │
│  │                              │       │                              │ │
│  │  ┌────────────────────────┐ │       │  ┌────────────────────────┐ │ │
│  │  │   Data Layer           │ │       │  │   Data Layer (Replica) │ │ │
│  │  │  ┌────┐ ┌────┐ ┌────┐ │ │       │  │  ┌────┐ ┌────┐ ┌────┐ │ │ │
│  │  │  │ RDS│ │Redis│ │Kafka││ │ ──►   │  │  │ RDS│ │Redis│ │Kafka││ │ │
│  │  │  │(PG)│ │Clstr│ │     ││ │ Sync  │  │  │(RR)│ │Clstr│ │     ││ │ │
│  │  │  └────┘ └────┘ └────┘ │ │       │  │  └────┘ └────┘ └────┘ │ │ │
│  │  └────────────────────────┘ │       │  └────────────────────────┘ │ │
│  │                              │       │                              │ │
│  │  ┌────────────────────────┐ │       │                              │ │
│  │  │   Security             │ │       │                              │ │
│  │  │  ┌────┐ ┌────┐        │ │       │                              │ │
│  │  │  │HSM │ │Vault│        │ │       │                              │ │
│  │  │  └────┘ └────┘        │ │       │                              │ │
│  │  └────────────────────────┘ │       │                              │ │
│  └─────────────────────────────┘       └─────────────────────────────┘ │
│                                                                         │
│  Global:                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Cloudflare (WAF, DDoS, CDN, DNS)                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 구현 로드맵

### 9.1 Phase별 구현 계획

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Implementation Roadmap                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: Core Development (Month 1-6)                                  │
│  ══════════════════════════════════════                                 │
│  M1-M2: Blockchain Core                                                 │
│    □ go-ethereum 포크 및 환경 구성                                       │
│    □ WBFT 합의 구현 (QBFT 기반)                                         │
│    □ EIP-7702 Account Abstraction 통합                                  │
│    □ 단위 테스트 및 통합 테스트                                          │
│                                                                         │
│  M2-M4: Smart Contracts                                                 │
│    □ StableToken 컨트랙트 개발                                          │
│    □ Governance 컨트랙트 개발                                           │
│    □ Blacklist/Emergency 컨트랙트 개발                                  │
│    □ 내부 감사 및 테스트                                                 │
│                                                                         │
│  M3-M5: Backend Services                                                │
│    □ Minter Manager 서비스 개발                                         │
│    □ API Gateway 구현                                                   │
│    □ 기본 모니터링 구축                                                  │
│                                                                         │
│  M5-M6: Integration & Testing                                           │
│    □ 전체 시스템 통합                                                    │
│    □ 내부 테스트넷 운영                                                  │
│    □ 부하 테스트 및 벤치마크                                             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 2: Security & Compliance (Month 6-9)                             │
│  ════════════════════════════════════════════                           │
│  M6-M7: Security Enhancement                                            │
│    □ HSM 구축 및 키 마이그레이션                                         │
│    □ Vault 구축                                                         │
│    □ WAF/DDoS 구성                                                      │
│                                                                         │
│  M7-M8: External Audit                                                  │
│    □ 스마트 컨트랙트 외부 감사 (1차)                                     │
│    □ 인프라 보안 감사                                                    │
│    □ 취약점 조치                                                        │
│                                                                         │
│  M8-M9: Compliance                                                      │
│    □ KYC/AML 서비스 구현                                                │
│    □ Chainalysis 연동                                                   │
│    □ Travel Rule 구현 (기본)                                            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 3: Public Testnet (Month 9-12)                                   │
│  ═══════════════════════════════════════                                │
│  M9-M10: Testnet Preparation                                            │
│    □ 퍼블릭 테스트넷 인프라 구축                                         │
│    □ 블록 익스플로러 개발                                                │
│    □ Faucet 구현                                                        │
│    □ 개발자 문서 작성                                                    │
│                                                                         │
│  M10-M11: Testnet Launch                                                │
│    □ 퍼블릭 테스트넷 런칭                                                │
│    □ 커뮤니티 테스트                                                     │
│    □ 버그 바운티 프로그램                                                │
│                                                                         │
│  M11-M12: Iteration                                                     │
│    □ 피드백 반영 및 개선                                                 │
│    □ 성능 최적화                                                        │
│    □ 스마트 컨트랙트 외부 감사 (2차)                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 4: Mainnet Preparation (Month 12-15)                             │
│  ═════════════════════════════════════════════                          │
│  M12-M13: Production Readiness                                          │
│    □ 프로덕션 인프라 구축                                                │
│    □ DR 환경 구축                                                       │
│    □ 운영 절차 수립                                                     │
│                                                                         │
│  M13-M14: Minter Onboarding                                             │
│    □ 첫 Minter 기술 연동                                                │
│    □ 파일럿 운영                                                        │
│    □ 은행 연동 테스트                                                    │
│                                                                         │
│  M14-M15: Final Preparation                                             │
│    □ 최종 보안 감사                                                      │
│    □ 침투 테스트                                                        │
│    □ 런칭 체크리스트 완료                                                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 5: Mainnet Launch (Month 15-18)                                  │
│  ════════════════════════════════════════                               │
│  M15: Mainnet Beta                                                      │
│    □ 제한적 메인넷 런칭                                                  │
│    □ 모니터링 강화                                                       │
│                                                                         │
│  M16-M18: Full Launch                                                   │
│    □ 메인넷 정식 런칭                                                    │
│    □ 추가 Minter 온보딩                                                  │
│    □ Bridge 활성화                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 필요 리소스

```yaml
team_requirements:
  blockchain_core:
    senior_engineers: 3
    skills: "Go, Consensus, P2P, EVM"

  smart_contracts:
    senior_engineers: 2
    skills: "Solidity, Security, Foundry"

  backend:
    senior_engineers: 3
    skills: "Go/Rust, gRPC, Kafka, PostgreSQL"

  devops:
    engineers: 2
    skills: "K8s, AWS, Terraform, Monitoring"

  security:
    engineers: 2
    skills: "Cryptography, HSM, Penetration Testing"

  total: 12-15 engineers

budget_estimate:
  development: "~$2-3M (18개월)"
  infrastructure: "~$50-100K/월"
  security_audits: "~$200-500K"
  hsm_and_security: "~$100-200K"
  total_18_months: "~$4-6M"
```

---

## 부록: 체크리스트

### A. 구현 전 검증 체크리스트

```yaml
pre_implementation:
  technical:
    - [ ] WBFT 알고리즘 설계 문서 작성
    - [ ] EIP-7702 구현 스펙 확정
    - [ ] 컨트랙트 인터페이스 설계
    - [ ] API 스키마 확정
    - [ ] 데이터베이스 스키마 설계

  security:
    - [ ] 위협 모델링 완료
    - [ ] 보안 요구사항 정의
    - [ ] 키 관리 정책 수립
    - [ ] 접근 제어 정책 수립

  compliance:
    - [ ] ISMS 요구사항 매핑
    - [ ] VASP 기술 요건 확인
    - [ ] 개인정보 처리 방침 수립
```

### B. 런칭 전 보안 체크리스트

```yaml
pre_launch_security:
  smart_contracts:
    - [ ] 외부 감사 2회 이상 완료
    - [ ] 정형 검증 (Certora) 완료
    - [ ] 버그 바운티 최소 3개월 운영
    - [ ] 모든 Critical/High 취약점 해결

  infrastructure:
    - [ ] HSM 프로덕션 구성
    - [ ] Vault 이중화 구성
    - [ ] WAF 룰 최적화
    - [ ] DDoS 테스트 완료

  operations:
    - [ ] 24/7 모니터링 체계
    - [ ] 인시던트 대응 절차
    - [ ] 키 복구 절차 테스트
    - [ ] DR 복구 테스트 완료

  compliance:
    - [ ] ISMS 예비 인증 완료
    - [ ] 침투 테스트 완료
    - [ ] 취약점 조치 완료
```

---

**문서 끝**

*본 문서는 구현 레벨의 기술 검토를 위해 작성되었으며, 실제 구현 시 추가 상세 설계가 필요합니다.*
