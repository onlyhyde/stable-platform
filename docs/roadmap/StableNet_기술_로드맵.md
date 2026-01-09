# StableNet 기술 로드맵

> **문서 버전**: 1.0
> **작성일**: 2025-01-09
> **작성자**: CTO Office
> **상태**: Draft for Review

---

## 1. Executive Summary

StableNet은 KRW 기반 L1 블록체인으로, 기존 퍼블릭 체인의 가스비 문제와 규제 준수 한계를 해결하는 것을 목표로 합니다. 본 로드맵은 24개월에 걸친 단계별 구현 계획을 제시하며, 각 단계별 기술적 타당성 검증을 포함합니다.

### 1.1 핵심 목표
- **1초 블록 완결성**: WBFT 합의 알고리즘 기반
- **3,000 TPS 처리량**: 실결제 서비스 수준의 처리 능력
- **KRW 네이티브 가스**: 원화 스테이블코인으로 가스비 직접 지불
- **규제 준수**: 4-Layer Governance 및 Blacklist 시스템
- **프라이버시 옵션**: ERC-5564 기반 Secret Account

---

## 2. 기술 로드맵 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        StableNet 24-Month Roadmap                           │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│   Phase 1   │   Phase 2   │   Phase 3   │   Phase 4   │      Phase 5        │
│ Foundation  │   Core      │  Ecosystem  │ Production  │   Scale & Evolve    │
│  (M1-M4)    │  (M5-M10)   │  (M11-M15)  │  (M16-M20)  │     (M21-M24)       │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│ • WBFT Core │ • Minter    │ • Bridge    │ • Mainnet   │ • Cross-chain       │
│ • Genesis   │   System    │   Protocol  │   Launch    │   Expansion         │
│ • Basic TX  │ • Governance│ • EIP-7702  │ • Minter    │ • DeFi Integration  │
│ • DevNet    │ • Blacklist │ • Secret    │   Onboard   │ • Advanced Privacy  │
│             │ • TestNet   │   Account   │             │                     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
```

---

## 3. Phase 1: Foundation (M1-M4)

### 3.1 목표
- WBFT 합의 알고리즘 구현 및 검증
- 네이티브 KRW 코인 시스템 구축
- 개발 환경 및 DevNet 구축

### 3.2 세부 마일스톤

#### M1: Core Protocol Setup (Week 1-4)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| WBFT-001 | go-ethereum fork 및 QBFT 베이스 설정 | 수정된 go-ethereum 코드베이스 | 빌드 성공, 단위 테스트 통과 |
| WBFT-002 | 1초 블록 타임 파라미터 설정 | consensus/config 수정 | 블록 생성 시간 측정 |
| WBFT-003 | 네이티브 코인 genesis 설정 | genesis.json 템플릿 | 초기 발행량 검증 |
| CORE-001 | 블록 보상 비활성화 (No Inflation) | consensus 수정 | 보상 0 확인 |

**기술 검증 포인트**:
```yaml
WBFT_Validation:
  block_time:
    target: 1000ms
    tolerance: ±50ms
    measurement: "100 연속 블록 평균"

  byzantine_tolerance:
    formula: "n ≥ 3f + 1"
    min_validators: 4
    test_scenario: "1 노드 장애 시 합의 지속"
```

#### M2: Native Coin System (Week 5-8)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| COIN-001 | NativeCoinAdapter 컨트랙트 구현 | NativeCoinAdapter.sol | ERC20 인터페이스 완전 호환 |
| COIN-002 | 네이티브 → ERC20 래핑 로직 | wrap/unwrap 함수 | 1:1 변환 정확성 |
| COIN-003 | Transfer 이벤트 로깅 시스템 | 이벤트 인덱싱 | 모든 전송에 이벤트 기록 |
| GAS-001 | KRW 가스비 계산 로직 | core/gas.go 수정 | 1원 = 1 gas unit 검증 |

**NativeCoinAdapter 스펙**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INativeCoinAdapter {
    // ERC20 Standard
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // Native Coin Operations
    function deposit() external payable;
    function withdraw(uint256 amount) external;

    // Events
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);
}
```

#### M3: Fee System & DevNet (Week 9-12)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| FEE-001 | BaseFee 안정화 알고리즘 | core/fee.go | 평상시 1원 유지 |
| FEE-002 | Priority Fee 제한 로직 | 마이너 단독 인상 방지 | 정책 적용 검증 |
| FEE-003 | DoS 방어 BaseFee 증가 | 혼잡 시 동적 조정 | 부하 테스트 통과 |
| NET-001 | DevNet 4노드 구성 | Docker Compose 스택 | 합의 동작 확인 |

**수수료 체계 설계**:
```yaml
Fee_Model:
  base_fee:
    default: 1  # KRW
    adjustment_rate: 12.5%  # EIP-1559 기반
    target_utilization: 50%
    max_block_gas: 30_000_000

  priority_fee:
    min: 0
    max: 10  # KRW (제한)
    miner_override: false  # 마이너 단독 조정 불가

  congestion_response:
    threshold: 80%  # 블록 사용률
    multiplier: 1.125  # 12.5% 증가
    max_base_fee: 100  # KRW 상한
```

#### M4: Core Validation & Integration Tests (Week 13-16)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| TEST-001 | 합의 알고리즘 스트레스 테스트 | 테스트 리포트 | 1000 블록 연속 생성 |
| TEST-002 | TPS 벤치마크 | 성능 보고서 | 목표 3000 TPS 달성률 |
| TEST-003 | 장애 복구 시나리오 테스트 | 복구 매뉴얼 | MTTR < 5분 |
| DOC-001 | Phase 1 기술 문서 | 아키텍처 문서 | 리뷰 완료 |

**성능 검증 기준**:
```yaml
Performance_Targets:
  TPS:
    target: 3000
    minimum_acceptable: 2500
    test_duration: 30분
    test_tx_type: "simple transfer"

  Latency:
    block_time: 1000ms ± 50ms
    tx_finality: 1 block
    p99_latency: < 1500ms

  Reliability:
    uptime: 99.9%
    byzantine_recovery: < 10s
    data_integrity: 100%
```

### 3.3 Phase 1 위험 요소 및 완화 방안

| 위험 | 영향도 | 발생확률 | 완화 방안 |
|------|--------|----------|-----------|
| WBFT 1초 달성 불가 | High | Medium | 네트워크 최적화, 블록 사이즈 조정 |
| go-ethereum 호환성 이슈 | Medium | Medium | 버전 고정, 점진적 업그레이드 |
| 가스비 계산 오류 | High | Low | 단위 테스트 강화, 수학적 검증 |

---

## 4. Phase 2: Core Systems (M5-M10)

### 4.1 목표
- Minter 시스템 구현
- 4-Layer Governance 시스템 구현
- Blacklist/Authorized Account 기능 구현
- Public TestNet 출시

### 4.2 세부 마일스톤

#### M5-M6: Minter System (Week 17-24)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| MINT-001 | MinterRegistry 컨트랙트 | MinterRegistry.sol | Minter CRUD 동작 |
| MINT-002 | Mint/Burn 권한 관리 | 권한 매트릭스 | 권한 분리 검증 |
| MINT-003 | Proof of Reserve 연동 | Certik PoR 인터페이스 | 예치금 검증 |
| MINT-004 | On-Ramp Controller | Off-chain 서비스 | 입금 플로우 검증 |
| MINT-005 | KYC 연동 인터페이스 | API Gateway | 외부 KYC 연동 |

**Minter 시스템 아키텍처**:
```
┌─────────────────────────────────────────────────────────────────┐
│                      Minter System Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    Bank      │────▶│  On-Ramp     │────▶│  Chain Gov   │    │
│  │  (입금)      │     │  Controller  │     │  Manager     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    SoF       │     │    KYC       │     │   Mainnet    │    │
│  │ (자금출처)   │     │  Verify      │     │   (발행)     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                  │
│  [Compliance Layer]                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Certik     │     │  Chainalysis │     │   Internal   │    │
│  │   Skynet     │     │  Monitoring  │     │   AML Check  │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Minter 컨트랙트 인터페이스**:
```solidity
interface IMinterRegistry {
    enum MinterStatus { Pending, Active, Suspended, Revoked }

    struct MinterInfo {
        address minterAddress;
        string name;
        MinterStatus status;
        uint256 mintLimit;
        uint256 totalMinted;
        uint256 totalBurned;
        uint256 registeredAt;
    }

    // Minter Management
    function registerMinter(address minter, string calldata name, uint256 mintLimit) external;
    function suspendMinter(address minter, string calldata reason) external;
    function revokeMinter(address minter) external;
    function updateMintLimit(address minter, uint256 newLimit) external;

    // Mint/Burn Operations
    function mint(address to, uint256 amount, bytes32 proofOfReserve) external;
    function burn(uint256 amount) external;

    // View Functions
    function getMinterInfo(address minter) external view returns (MinterInfo memory);
    function isMinter(address account) external view returns (bool);
    function getTotalSupply() external view returns (uint256);

    // Events
    event MinterRegistered(address indexed minter, string name, uint256 mintLimit);
    event MinterStatusChanged(address indexed minter, MinterStatus newStatus, string reason);
    event Minted(address indexed minter, address indexed to, uint256 amount, bytes32 proofOfReserve);
    event Burned(address indexed minter, uint256 amount);
}
```

#### M7-M8: Governance System (Week 25-32)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| GOV-001 | GovValidator 컨트랙트 | GovValidator.sol | 검증자 관리 동작 |
| GOV-002 | GovMasterMinter 컨트랙트 | GovMasterMinter.sol | Master Minter 권한 관리 |
| GOV-003 | GovMinter 컨트랙트 | GovMinter.sol | 일반 Minter 거버넌스 |
| GOV-004 | GovCouncil 컨트랙트 | GovCouncil.sol | 의사결정 투표 시스템 |
| GOV-005 | Multi-sig 투표 로직 | 합의 로직 | 정족수 검증 |

**4-Layer Governance 구조**:
```yaml
Governance_Hierarchy:
  GovCouncil:
    role: "최상위 의사결정 기구"
    members: "5-11명 (홀수)"
    quorum: "2/3 이상"
    powers:
      - "프로토콜 파라미터 변경"
      - "긴급 정지 발동"
      - "GovValidator 멤버 추가/제거"
      - "GovMasterMinter 권한 부여"

  GovValidator:
    role: "검증자 노드 관리"
    members: "검증자 운영 기관"
    quorum: "과반수"
    powers:
      - "검증자 추가/제거"
      - "노드 운영 정책 설정"
      - "네트워크 파라미터 조정"

  GovMasterMinter:
    role: "Minter 총괄 관리"
    members: "금융기관 대표"
    quorum: "과반수"
    powers:
      - "Minter 등록 승인"
      - "Mint 한도 설정"
      - "Minter 정지/해제"

  GovMinter:
    role: "발행/소각 실무"
    members: "승인된 Minter들"
    quorum: "단독 + Master 승인"
    powers:
      - "스테이블코인 발행"
      - "스테이블코인 소각"
      - "예치금 증명 제출"
```

**Governance 컨트랙트 구조**:
```solidity
// Base Governance Contract
abstract contract GovernanceBase {
    enum VoteType { Against, For, Abstain }
    enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        bytes callData;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    function propose(string calldata description, bytes calldata callData) external virtual returns (uint256);
    function vote(uint256 proposalId, VoteType voteType) external virtual;
    function execute(uint256 proposalId) external virtual;
    function cancel(uint256 proposalId) external virtual;
    function getQuorum() external view virtual returns (uint256);
}

// GovCouncil - 최상위 거버넌스
contract GovCouncil is GovernanceBase {
    uint256 public constant QUORUM_PERCENTAGE = 66; // 2/3
    uint256 public constant VOTING_PERIOD = 7 days;

    mapping(address => bool) public councilMembers;
    uint256 public memberCount;

    function emergencyPause() external onlyCouncil;
    function updateProtocolParams(bytes calldata params) external onlyCouncil;
}

// GovValidator - 검증자 관리
contract GovValidator is GovernanceBase {
    struct Validator {
        address nodeAddress;
        string name;
        bool isActive;
        uint256 stake;
    }

    function addValidator(address validator, string calldata name) external;
    function removeValidator(address validator) external;
    function updateValidatorStake(address validator, uint256 newStake) external;
}
```

#### M9-M10: Blacklist & TestNet (Week 33-40)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| BL-001 | Blacklist 컨트랙트 | Blacklist.sol | 계정 동결 동작 |
| BL-002 | Authorized Account 시스템 | AuthorizedAccount.sol | 우선 처리 검증 |
| BL-003 | Chainalysis 연동 | API 인터페이스 | 실시간 모니터링 |
| BL-004 | Certik Skynet 연동 | API 인터페이스 | 위험 감지 알림 |
| TEST-004 | Public TestNet 출시 | TestNet 인프라 | 외부 접속 가능 |
| TEST-005 | TestNet Faucet 구축 | Faucet 서비스 | 테스트 토큰 배포 |

**Blacklist 시스템 설계**:
```solidity
interface IBlacklistManager {
    enum BlacklistReason {
        AML_VIOLATION,
        FRAUD_DETECTED,
        REGULATORY_ORDER,
        HACK_ASSOCIATED,
        MANUAL_BLOCK
    }

    struct BlacklistEntry {
        address account;
        BlacklistReason reason;
        uint256 blockedAt;
        address blockedBy;
        string description;
        bool isBlacklisted;
    }

    // Blacklist Operations
    function addToBlacklist(address account, BlacklistReason reason, string calldata description) external;
    function removeFromBlacklist(address account) external;
    function isBlacklisted(address account) external view returns (bool);
    function getBlacklistEntry(address account) external view returns (BlacklistEntry memory);

    // Batch Operations (for associated addresses)
    function batchAddToBlacklist(address[] calldata accounts, BlacklistReason reason) external;

    // Events
    event AddedToBlacklist(address indexed account, BlacklistReason reason, address indexed blockedBy);
    event RemovedFromBlacklist(address indexed account, address indexed removedBy);
}

// Authorized Account for Priority Processing
interface IAuthorizedAccount {
    struct AuthorizedInfo {
        address account;
        uint8 priorityLevel; // 1-10, higher = more priority
        uint256 authorizedAt;
        bool isAuthorized;
    }

    function authorizeAccount(address account, uint8 priorityLevel) external;
    function revokeAuthorization(address account) external;
    function isAuthorized(address account) external view returns (bool);
    function getPriorityLevel(address account) external view returns (uint8);
}
```

### 4.3 Phase 2 기술 검증 포인트

```yaml
Minter_System_Validation:
  security:
    - "권한 분리 확인: Mint ≠ Burn ≠ Admin"
    - "Proof of Reserve 검증 로직"
    - "Rate Limit 적용 확인"

  compliance:
    - "KYC 연동 정상 동작"
    - "AML 체크 플로우 검증"
    - "감사 로그 완전성"

  reliability:
    - "장애 시 복구 절차"
    - "중복 발행 방지"
    - "총 발행량 일관성"

Governance_Validation:
  voting:
    - "정족수 계산 정확성"
    - "투표 집계 로직"
    - "제안 실행 조건"

  security:
    - "권한 에스컬레이션 방지"
    - "긴급 정지 메커니즘"
    - "Time-lock 적용"

  operations:
    - "멀티시그 동작 검증"
    - "거버넌스 업그레이드 경로"
    - "역할 변경 감사 로그"

Blacklist_Validation:
  functionality:
    - "즉시 동결 확인"
    - "연관 계정 추적"
    - "해제 절차 검증"

  performance:
    - "동결 적용 지연 시간 < 1초"
    - "대량 동결 처리 능력"
    - "블랙리스트 조회 성능"
```

---

## 5. Phase 3: Ecosystem (M11-M15)

### 5.1 목표
- Native Bridge 프로토콜 구현
- EIP-7702 Smart Account 시스템
- ERC-5564 Secret Account 시스템
- Wallet 앱 MVP

### 5.2 세부 마일스톤

#### M11-M12: Bridge Protocol (Week 41-48)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| BR-001 | Bridge 컨트랙트 (StableNet측) | StableNetBridge.sol | Burn 동작 검증 |
| BR-002 | Bridge 컨트랙트 (타체인) | RemoteBridge.sol | Mint 동작 검증 |
| BR-003 | Relayer 노드 구현 | bridge-relayer 서비스 | 메시지 전달 검증 |
| BR-004 | Ethereum Bridge 연동 | Ethereum 배포 | 양방향 전송 테스트 |
| BR-005 | Base Chain Bridge 연동 | Base 배포 | 양방향 전송 테스트 |

**Bridge 아키텍처 (Burn and Mint)**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Native Bridge Architecture                    │
│                      (Burn and Mint Model)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  StableNet                              Target Chain            │
│  ┌──────────────┐                      ┌──────────────┐         │
│  │   User A     │                      │   User A     │         │
│  │  Balance:    │                      │  Balance:    │         │
│  │  1000 KRW    │                      │  0 wKRW      │         │
│  └──────────────┘                      └──────────────┘         │
│         │                                     ▲                  │
│         │ 1. Burn Request                     │                  │
│         ▼                                     │                  │
│  ┌──────────────┐      Relayer Network  ┌──────────────┐        │
│  │   Bridge     │◀────────────────────▶│   Bridge     │        │
│  │  Contract    │      3. Relay Proof   │  Contract    │        │
│  │  (Burn)      │                       │  (Mint)      │        │
│  └──────────────┘                       └──────────────┘        │
│         │                                     │                  │
│         │ 2. Burn Event                       │ 4. Mint         │
│         ▼                                     ▼                  │
│  ┌──────────────┐                      ┌──────────────┐         │
│  │  StableNet   │                      │   wKRW       │         │
│  │  Total:      │                      │  Total:      │         │
│  │  -1000       │                      │  +1000       │         │
│  └──────────────┘                      └──────────────┘         │
│                                                                  │
│  Total Supply Invariant: StableNet + All_Bridges = Constant     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Bridge 컨트랙트 인터페이스**:
```solidity
// StableNet Side Bridge
interface IStableNetBridge {
    struct BridgeRequest {
        uint256 id;
        address sender;
        uint256 amount;
        uint256 targetChainId;
        address targetAddress;
        uint256 timestamp;
        bytes32 proofHash;
        bool processed;
    }

    // Burn for Bridge
    function bridgeOut(
        uint256 amount,
        uint256 targetChainId,
        address targetAddress
    ) external returns (uint256 requestId);

    // Mint from Bridge (called by relayer)
    function bridgeIn(
        address recipient,
        uint256 amount,
        uint256 sourceChainId,
        bytes32 sourceTxHash,
        bytes calldata proof
    ) external;

    // View Functions
    function getBridgeRequest(uint256 requestId) external view returns (BridgeRequest memory);
    function getSupportedChains() external view returns (uint256[] memory);
    function getChainBridgeBalance(uint256 chainId) external view returns (uint256);

    // Events
    event BridgeOutInitiated(uint256 indexed requestId, address indexed sender, uint256 amount, uint256 targetChainId);
    event BridgeInCompleted(address indexed recipient, uint256 amount, uint256 sourceChainId, bytes32 sourceTxHash);
}

// Remote Chain Bridge (ERC20 Token)
interface IRemoteBridge {
    function mint(address to, uint256 amount, bytes32 sourceProof) external;
    function burn(uint256 amount, address stableNetRecipient) external;
}
```

#### M13-M14: Smart Account (EIP-7702) (Week 49-56)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| SA-001 | EIP-7702 프로토콜 구현 | core/eip7702.go | 표준 호환성 검증 |
| SA-002 | Smart Account 컨트랙트 | SmartAccount.sol | 기능 테스트 |
| SA-003 | Gas Sponsor 시스템 | Paymaster 컨트랙트 | 대납 동작 검증 |
| SA-004 | Sub-Account 관리 | 권한 위임 로직 | 권한 분리 테스트 |
| SA-005 | Smart Wallet Server | Backend 서비스 | API 동작 검증 |

**EIP-7702 Smart Account 설계**:
```yaml
EIP7702_Implementation:
  protocol_support:
    - "SET_CODE_TX_TYPE: 0x04"
    - "Authorization List 처리"
    - "Code Designation 검증"

  smart_account_features:
    gas_sponsorship:
      - "Paymaster 연동"
      - "외부 토큰(USDC, USDT) 가스비 지불"
      - "카드사/은행 대납 시스템"

    access_control:
      - "Password 기반 인증"
      - "2FA 지원"
      - "복구 키 시스템"

    sub_accounts:
      - "권한 제한된 하위 계정"
      - "Bot 계정 지원"
      - "일일 한도 설정"

    key_management:
      - "서버 측 키 보관 (Custodial)"
      - "HSM 연동"
      - "키 분실 복구"
```

**Smart Account 컨트랙트**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SmartAccount {
    address public owner;
    address public guardian;
    mapping(address => SubAccount) public subAccounts;
    mapping(bytes32 => bool) public usedNonces;

    struct SubAccount {
        bool isActive;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastResetTime;
        uint8 permissions; // Bitmap: transfer, approve, call
    }

    // Gas Sponsorship
    function executeWithSponsor(
        address target,
        uint256 value,
        bytes calldata data,
        address sponsor,
        bytes calldata sponsorSignature
    ) external returns (bytes memory);

    // Sub Account Management
    function createSubAccount(
        address subAccount,
        uint256 dailyLimit,
        uint8 permissions
    ) external onlyOwner;

    function executeFromSubAccount(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySubAccount;

    // Recovery
    function initiateRecovery(address newOwner) external onlyGuardian;
    function completeRecovery() external; // After timelock

    // Batch Operations
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwner returns (bytes[] memory);
}
```

#### M15: Secret Account (ERC-5564) (Week 57-60)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| SEC-001 | ERC-5564 Stealth Address 구현 | StealthAddress.sol | 표준 호환성 |
| SEC-002 | Secret Transfer Server | Backend 서비스 | 배치 전송 테스트 |
| SEC-003 | View Key 관리 시스템 | Key Management | 키 등록/조회 |
| SEC-004 | PrivateBank 컨트랙트 | PrivateBank.sol | 비밀 전송 검증 |
| SEC-005 | 규제 백도어 구현 | Compliance API | 조회 기능 검증 |

**Secret Account 아키텍처**:
```
┌─────────────────────────────────────────────────────────────────┐
│                   Secret Account Flow (ERC-5564)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Registration                                                 │
│  ┌──────────┐                    ┌──────────────────┐           │
│  │  User A  │──── Register ────▶│ Secret Transfer   │           │
│  │          │   (viewKey, addr)  │     Server       │           │
│  └──────────┘                    └──────────────────┘           │
│                                                                  │
│  2. Secret Transfer Request                                      │
│  ┌──────────┐   "Send 230K to B"  ┌──────────────────┐          │
│  │  User A  │─────────────────▶  │ Secret Transfer   │          │
│  └──────────┘                     │     Server       │          │
│                                   └──────────────────┘          │
│                                           │                      │
│  3. Stealth Address Generation & Batch TX │                      │
│                                           ▼                      │
│  ┌────────────────────────────────────────────────────┐         │
│  │                  StableNet Mainnet                  │         │
│  │  ┌─────────────────────────────────────────────┐   │         │
│  │  │  Before:                                     │   │         │
│  │  │  A_Stealth1: 200,000 | A_Stealth2: 52,000   │   │         │
│  │  │  B_Stealth3: 0                               │   │         │
│  │  └─────────────────────────────────────────────┘   │         │
│  │                      │                              │         │
│  │                      ▼ (Batch TX)                   │         │
│  │  ┌─────────────────────────────────────────────┐   │         │
│  │  │  After:                                      │   │         │
│  │  │  A_Stealth1: 0 | A_Stealth2: 0              │   │         │
│  │  │  A_Stealth4: 22,000 (잔액)                   │   │         │
│  │  │  B_Stealth3: 230,000 (수신)                  │   │         │
│  │  └─────────────────────────────────────────────┘   │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  4. Regulatory Compliance                                        │
│  ┌──────────────┐    Request    ┌──────────────────┐            │
│  │  Regulator   │─────────────▶│ Secret Transfer   │            │
│  │              │◀─────────────│     Server       │            │
│  └──────────────┘  Full History └──────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Phase 3 기술 검증 포인트

```yaml
Bridge_Validation:
  security:
    - "Relayer 다중화 (3 of 5 Threshold)"
    - "Replay Attack 방지"
    - "총량 불변 검증"
    - "긴급 정지 메커니즘"

  reliability:
    - "Finality 대기 (소스 체인)"
    - "실패 시 환불 로직"
    - "네트워크 장애 복구"

  compliance:
    - "브릿지 거래 모니터링"
    - "블랙리스트 연동"
    - "AML 필터링"

Smart_Account_Validation:
  eip7702_compliance:
    - "Authorization 검증"
    - "Code Designation 무결성"
    - "Gas Estimation 정확성"

  security:
    - "Reentrancy 방지"
    - "권한 에스컬레이션 방지"
    - "Replay Attack 방지"

  usability:
    - "가스 대납 UX"
    - "복구 플로우"
    - "Sub-account 격리"

Secret_Account_Validation:
  privacy:
    - "Stealth Address 추적 불가"
    - "금액 비공개 (배치 혼합)"
    - "View Key 안전성"

  compliance:
    - "규제 기관 조회 가능"
    - "감사 로그 보존"
    - "선택적 공개 기능"

  performance:
    - "배치 처리 지연 < 10초"
    - "동시 요청 처리 > 100 TPS"
```

---

## 6. Phase 4: Production (M16-M20)

### 6.1 목표
- Mainnet 런칭
- 초기 Minter 온보딩
- 보안 감사 완료
- 운영 인프라 구축

### 6.2 세부 마일스톤

#### M16-M17: Pre-Launch Preparation (Week 61-68)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| SEC-006 | 외부 보안 감사 (Certik) | 감사 보고서 | Critical 0건 |
| SEC-007 | 침투 테스트 | 취약점 보고서 | 취약점 해결 완료 |
| SEC-008 | 버그 바운티 프로그램 | 프로그램 런칭 | 커뮤니티 참여 |
| OPS-001 | 모니터링 시스템 구축 | Grafana Dashboard | 메트릭 수집 확인 |
| OPS-002 | 알림 시스템 구축 | PagerDuty 연동 | 알림 동작 확인 |
| OPS-003 | 인시던트 대응 매뉴얼 | Runbook | 리뷰 완료 |

**보안 감사 체크리스트**:
```yaml
Security_Audit_Scope:
  smart_contracts:
    - "모든 Governance 컨트랙트"
    - "Minter 시스템 컨트랙트"
    - "Bridge 컨트랙트"
    - "NativeCoinAdapter"
    - "Blacklist/AuthorizedAccount"
    - "Smart Account 구현"

  protocol_level:
    - "WBFT 합의 알고리즘"
    - "EIP-7702 구현"
    - "가스비 계산 로직"
    - "블록 생성/검증 로직"

  infrastructure:
    - "노드 구성 보안"
    - "키 관리 시스템"
    - "API 보안"
    - "네트워크 보안"

  audit_criteria:
    critical: 0  # 필수
    high: 0      # 필수
    medium: "해결 또는 수용"
    low: "문서화"
```

#### M18-M19: Mainnet Launch (Week 69-76)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| LAUNCH-001 | Genesis 블록 생성 | Mainnet Genesis | 검증자 합의 |
| LAUNCH-002 | 초기 검증자 노드 배포 | 7+ Validators | 합의 동작 |
| LAUNCH-003 | Explorer 런칭 | Block Explorer | 실시간 데이터 |
| LAUNCH-004 | 공식 RPC 엔드포인트 | API Gateway | 가용성 99.9% |
| MINT-006 | 파일럿 Minter 온보딩 | 2-3 Minters | 발행 테스트 |
| WALLET-001 | 공식 Wallet 앱 출시 | iOS/Android 앱 | 앱스토어 등록 |

**Mainnet 런칭 체크리스트**:
```yaml
Launch_Checklist:
  pre_launch:
    - "보안 감사 완료 및 이슈 해결"
    - "Genesis 블록 파라미터 확정"
    - "초기 검증자 7개 이상 확보"
    - "모니터링 시스템 가동"
    - "인시던트 대응팀 24/7 대기"

  launch_day:
    - "Genesis 블록 생성 (타임스탬프 고정)"
    - "검증자 노드 순차 시작"
    - "합의 정상 동작 확인"
    - "Explorer 데이터 동기화"
    - "공식 RPC 오픈"

  post_launch:
    - "24시간 안정성 모니터링"
    - "파일럿 Minter 발행 테스트"
    - "Wallet 앱 연동 테스트"
    - "커뮤니티 공지"

Validator_Requirements:
  hardware:
    cpu: "16 cores"
    memory: "64 GB"
    storage: "1 TB NVMe SSD"
    network: "1 Gbps dedicated"

  software:
    os: "Ubuntu 22.04 LTS"
    node: "StableNet v1.0.0+"
    monitoring: "Prometheus + Grafana"

  operational:
    uptime_sla: "99.9%"
    response_time: "< 15 minutes"
    backup: "Daily snapshot"
```

#### M20: Initial Operations (Week 77-80)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| OPS-004 | 운영 안정화 | 성능 보고서 | SLA 충족 |
| MINT-007 | 추가 Minter 온보딩 | 5+ Minters | 발행 다각화 |
| DOC-002 | 개발자 문서 | Developer Portal | 문서 완성도 |
| SDK-001 | JavaScript SDK | npm package | API 커버리지 100% |
| SDK-002 | Mobile SDK | iOS/Android SDK | 기능 동작 검증 |

---

## 7. Phase 5: Scale & Evolve (M21-M24)

### 7.1 목표
- 크로스체인 확장
- DeFi 생태계 연동
- 고급 프라이버시 기능
- 성능 최적화

### 7.2 세부 마일스톤

#### M21-M22: Cross-Chain Expansion (Week 81-88)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| BR-006 | Arbitrum Bridge | 배포 및 테스트 | 양방향 전송 |
| BR-007 | Tron Bridge | 배포 및 테스트 | 양방향 전송 |
| BR-008 | CCIP 연동 | Chainlink CCIP | USDC 브릿지 |
| DEFI-001 | DEX 통합 (Uniswap V3 Fork) | DEX 컨트랙트 | 스왑 동작 |
| DEFI-002 | Lending Protocol | Lending 컨트랙트 | 대출/상환 |

#### M23-M24: Advanced Features (Week 89-96)

| Task | 설명 | 산출물 | 검증 기준 |
|------|------|--------|-----------|
| PRIV-001 | ZK 프라이버시 R&D | 연구 보고서 | PoC 구현 |
| PERF-001 | 병렬 처리 최적화 | 성능 개선 | TPS 향상률 |
| PERF-002 | 상태 압축 | 스토리지 최적화 | 용량 절감률 |
| ECO-001 | 파트너 온보딩 프로그램 | 프로그램 문서 | 파트너 5+ |
| ECO-002 | 개발자 그랜트 프로그램 | 그랜트 런칭 | 프로젝트 10+ |

---

## 8. 기술 스택 요약

### 8.1 Core Layer
```yaml
Blockchain_Core:
  base: "go-ethereum v1.13+"
  consensus: "WBFT (QBFT-based)"
  language: "Go 1.21+"
  evm: "EVM Shanghai+"

Smart_Contracts:
  language: "Solidity 0.8.20+"
  framework: "Foundry"
  testing: "Forge"
  deployment: "Hardhat/Foundry"
```

### 8.2 Backend Services
```yaml
Services:
  language: "Go / Rust"
  api: "gRPC + REST (OpenAPI 3.0)"
  message_queue: "Apache Kafka"
  cache: "Redis Cluster"
  database: "PostgreSQL 15+"

Security:
  key_management: "HashiCorp Vault"
  hsm: "AWS CloudHSM / Thales Luna"
  tee: "AWS Nitro Enclaves"
  secrets: "AWS Secrets Manager"
```

### 8.3 Infrastructure
```yaml
Cloud:
  primary: "AWS"
  regions: "ap-northeast-2 (Seoul), us-east-1"
  kubernetes: "EKS"

Monitoring:
  metrics: "Prometheus + Grafana"
  logging: "ELK Stack"
  tracing: "Jaeger"
  alerting: "PagerDuty"

CI_CD:
  pipeline: "GitHub Actions"
  registry: "ECR"
  iac: "Terraform"
```

---

## 9. 리스크 매트릭스

| 리스크 | 영향도 | 발생확률 | 완화 전략 |
|--------|--------|----------|-----------|
| WBFT 성능 미달 | High | Medium | 블록 사이즈 조정, 네트워크 최적화 |
| 보안 취약점 발견 | Critical | Medium | 다중 감사, 버그 바운티, 점진적 출시 |
| 규제 변경 | High | Medium | 법률 자문, 거버넌스 유연성 확보 |
| Minter 온보딩 지연 | Medium | High | 파일럿 프로그램, 인센티브 설계 |
| 경쟁사 선점 | Medium | High | 차별화 기능 집중, 빠른 출시 |
| 팀 이탈 | High | Low | 문서화, 지식 공유, 인센티브 |

---

## 10. 성공 지표 (KPIs)

### 10.1 기술 지표
```yaml
Performance:
  TPS: ">= 3000"
  Block_Time: "1000ms ± 50ms"
  Finality: "1 block"
  Uptime: ">= 99.9%"

Security:
  Audit_Score: "No Critical/High"
  Incident_Response: "< 15 minutes"
  Bug_Bounty_Resolved: "100%"

Quality:
  Test_Coverage: ">= 90%"
  Documentation: "100% API coverage"
  SDK_Adoption: "3+ languages"
```

### 10.2 비즈니스 지표
```yaml
Ecosystem:
  Minters: ">= 10 by M20"
  Daily_Transactions: ">= 100K by M24"
  Total_Supply: ">= 10B KRW by M24"

Partnerships:
  Payment_Partners: ">= 5"
  Exchange_Listings: ">= 3"
  DeFi_Integrations: ">= 5"
```

---

## 11. 거버넌스 및 의사결정

### 11.1 기술 위원회 구성
- CTO (의장)
- VP Engineering
- Head of Security
- Head of Infrastructure
- Lead Protocol Engineer

### 11.2 의사결정 프로세스
1. **일반 기술 결정**: 담당 리드 승인
2. **아키텍처 변경**: 기술 위원회 투표 (과반수)
3. **프로토콜 변경**: 기술 위원회 + CEO 승인
4. **보안 관련**: CISO + CTO 공동 승인

---

## 12. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-09 | 초안 작성 | CTO Office |

---

## 부록

### A. 용어 정의
- **WBFT**: Weighted Byzantine Fault Tolerance
- **TPS**: Transactions Per Second
- **EIP-7702**: Native Account Abstraction
- **ERC-5564**: Stealth Address Standard

### B. 참조 문서
- StableNet_Key.md: 원본 기획 문서
- StableNet_구현레벨_기술검토.md: 상세 기술 검토
- EIP-7702 Specification: https://eips.ethereum.org/EIPS/eip-7702
- ERC-5564 Specification: https://eips.ethereum.org/EIPS/eip-5564
