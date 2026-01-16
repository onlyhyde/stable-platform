# StableNet PoC 규제 준수 아키텍처

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 개요

StableNet PoC는 프라이버시 보호(Stealth Address)와 규제 준수를 동시에 만족시키는 **이중 레이어 아키텍처**를 구현합니다. 일반 사용자에게는 프라이버시를 보장하면서, 규제 기관에게는 법적 요구 시 자금 추적이 가능한 구조를 제공합니다.

### 1.1 규제 준수 목표

| 목표 | 설명 | 관련 규제 |
|------|------|----------|
| **자금 추적** | 규제 기관의 합법적 요청 시 자금 흐름 추적 | AML/CFT, FATF Travel Rule |
| **세금 보고** | 국세청 요청 시 거래 내역 제공 | 소득세법, 법인세법 |
| **지급 준비금 증명** | 100% 준비금 실시간 검증 | MiCA, GENIUS Act, 각국 스테이블코인 규제 |
| **KYC/AML 연동** | 고객 신원 확인 및 자금세탁 방지 | FATF 권고사항, 특금법 |
| **감사 대응** | 외부 감사인 및 규제기관 감사 지원 | AICPA, AT-C 205 |

### 1.2 이중 레이어 아키텍처

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     StableNet 이중 레이어 아키텍처                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PUBLIC LAYER (일반 사용자)                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │  Block Explorer │  │  Transaction    │  │   Account       │      │   │
│  │  │  (공개)         │  │  Privacy        │  │   Privacy       │      │   │
│  │  │                 │  │  (Stealth Addr) │  │  (Stealth Key)  │      │   │
│  │  │  • 블록 정보    │  │                 │  │                 │      │   │
│  │  │  • 공개 Tx      │  │  • 송금자 익명  │  │  • 수신자 익명  │      │   │
│  │  │  • 컨트랙트     │  │  • 금액 비공개  │  │  • 잔액 비공개  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     │ Regulatory Viewing Key                │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  REGULATORY LAYER (인가된 규제기관)                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │  Compliance     │  │  Tax Authority  │  │   AML/KYT       │      │   │
│  │  │  Portal         │  │  Interface      │  │   System        │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │  • 자금 추적    │  │  • 과세 정보    │  │  • 의심 거래    │      │   │
│  │  │  • 감사 보고서  │  │  • 신고 지원    │  │  • 위험 평가    │      │   │
│  │  │  • 준비금 증명  │  │  • 원천징수     │  │  • FATF 준수    │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regulatory Viewing Key System

Stealth Address의 프라이버시를 유지하면서 규제 기관에게 추적 권한을 부여하는 핵심 메커니즘입니다.

### 2.1 키 계층 구조

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     Stealth Address 키 계층 구조                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  사용자 키 (User Keys)                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ┌────────────────────┐     ┌────────────────────┐                   │  │
│  │  │   Spending Key     │     │   Viewing Key      │                   │  │
│  │  │   (개인 보관)       │     │   (사용자 보관)     │                   │  │
│  │  │                    │     │                    │                   │  │
│  │  │   • 자금 출금 권한 │     │   • 입금 확인      │                   │  │
│  │  │   • 절대 공유 불가 │     │   • 개인 사용      │                   │  │
│  │  └────────────────────┘     └────────────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│                                      │ 암호학적 파생                         │
│                                      ▼                                      │
│  규제기관 키 (Regulatory Keys)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ┌────────────────────┐     ┌────────────────────┐                   │  │
│  │  │ Regulatory Viewing │     │ Master Regulatory  │                   │  │
│  │  │ Key (RVK)          │     │ Key (MRK)          │                   │  │
│  │  │                    │     │                    │                   │  │
│  │  │ • 거래 조회 전용   │     │ • HSM 보관         │                   │  │
│  │  │ • 출금 권한 없음   │     │ • 다중 서명 필요   │                   │  │
│  │  │ • 법적 요청 시만   │     │ • 감사 로그 기록   │                   │  │
│  │  └────────────────────┘     └────────────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  키 관계:                                                                   │
│  • RVK = ECDH(MRK_private, User_ViewingKey_public)                         │
│  • RVK는 조회만 가능, 자금 이동 불가                                        │
│  • MRK는 2-of-3 다중서명으로 보호                                           │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Regulatory Viewing Key 생성 프로세스

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Regulatory Viewing Key 생성 흐름                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] 초기 설정 (시스템 배포 시)                                              │
│                                                                             │
│  규제기관           HSM              Smart Contract                          │
│    │                 │                    │                                  │
│    │  1. MRK 생성    │                    │                                  │
│    │ ───────────────►│                    │                                  │
│    │  (2-of-3 다중서명)                   │                                  │
│    │                 │                    │                                  │
│    │  2. MRK 공개키  │                    │                                  │
│    │ ◄───────────────│                    │                                  │
│    │                 │                    │                                  │
│    │  3. MRK 공개키 등록                  │                                  │
│    │ ─────────────────────────────────────►│                                │
│    │                 │                    │                                  │
│                                                                             │
│  [2] 사용자 계정 생성 시                                                     │
│                                                                             │
│  사용자             Registry           Compliance Server                     │
│    │                   │                    │                                │
│    │  4. Meta-Address  │                    │                                │
│    │     등록          │                    │                                │
│    │ ─────────────────►│                    │                                │
│    │                   │                    │                                │
│    │                   │  5. ViewingKey     │                                │
│    │                   │     공개키 전달    │                                │
│    │                   │ ──────────────────►│                                │
│    │                   │                    │                                │
│    │                   │  6. RVK 생성       │                                │
│    │                   │     (ECDH 연산)    │                                │
│    │                   │                    │                                │
│    │                   │  7. RVK Hash 저장  │                                │
│    │                   │     (Privacy 보호) │                                │
│    │                   │                    │                                │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 자금 추적 프로세스

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      규제기관 자금 추적 프로세스                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  규제기관      Compliance Portal      HSM           Stealth DB              │
│    │               │                   │                │                   │
│    │  1. 조회 요청 │                   │                │                   │
│    │  (법적 근거   │                   │                │                   │
│    │   + 대상 주소)│                   │                │                   │
│    │ ─────────────►│                   │                │                   │
│    │               │                   │                │                   │
│    │               │  2. 요청 검증     │                │                   │
│    │               │  • 법적 권한 확인 │                │                   │
│    │               │  • 2-of-3 승인    │                │                   │
│    │               │                   │                │                   │
│    │               │  3. RVK 파생 요청 │                │                   │
│    │               │ ─────────────────►│                │                   │
│    │               │                   │                │                   │
│    │               │  4. RVK 반환      │                │                   │
│    │               │ ◄─────────────────│                │                   │
│    │               │                   │                │                   │
│    │               │  5. Stealth Tx    │                │                   │
│    │               │     스캔 요청     │                │                   │
│    │               │ ──────────────────┼───────────────►│                   │
│    │               │                   │                │                   │
│    │               │  6. 매칭된 Tx     │                │                   │
│    │               │     목록 반환     │                │                   │
│    │               │ ◄─────────────────┼────────────────│                   │
│    │               │                   │                │                   │
│    │  7. 추적 결과 │                   │                │                   │
│    │  (감사 로그   │                   │                │                   │
│    │   포함)       │                   │                │                   │
│    │ ◄─────────────│                   │                │                   │
│    │               │                   │                │                   │
│                                                                             │
│  ⚠️ 모든 조회는 감사 로그에 기록되며, 법적 근거 없이는 접근 불가             │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 시스템 아키텍처

### 3.1 전체 규제 준수 아키텍처

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Regulatory Compliance System Architecture                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        REGULATORY INTERFACES                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Compliance │  │ Tax        │  │ Law        │  │ Auditor    │     │  │
│  │  │ Portal     │  │ Authority  │  │ Enforcement│  │ Interface  │     │  │
│  │  │ (FIU/FSC)  │  │ (NTS)      │  │ (Police)   │  │ (CPA/감사) │     │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │  │
│  │        │               │               │               │             │  │
│  └────────┼───────────────┼───────────────┼───────────────┼─────────────┘  │
│           │               │               │               │                 │
│           └───────────────┴───────────────┴───────────────┘                 │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        COMPLIANCE GATEWAY                             │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │  • Authentication (mTLS + API Key)                            │   │  │
│  │  │  • Authorization (RBAC + Legal Basis Verification)            │   │  │
│  │  │  • Rate Limiting (Abuse Prevention)                           │   │  │
│  │  │  • Audit Logging (All Access Recorded)                        │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        COMPLIANCE SERVICES                            │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │ Transaction │  │   KYT/AML   │  │   Proof of  │  │    Tax      │ │  │
│  │  │ Tracer      │  │   Engine    │  │   Reserve   │  │  Reporter   │ │  │
│  │  │             │  │             │  │             │  │             │ │  │
│  │  │ • RVK 기반  │  │ • 위험 평가 │  │ • Chainlink │  │ • 과세 정보 │ │  │
│  │  │   추적      │  │ • 패턴 탐지 │  │   PoR 연동  │  │ • 원천징수  │ │  │
│  │  │ • 자금 흐름 │  │ • 블랙리스트│  │ • Merkle    │  │ • 신고 지원 │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │  │
│  │         │                │                │                │        │  │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────┘  │
│            │                │                │                │            │
│            └────────────────┴────────────────┴────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          DATA LAYER                                   │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │ Stealth DB  │  │   KYC DB    │  │  Reserve DB │  │  Audit DB   │ │  │
│  │  │             │  │             │  │             │  │             │ │  │
│  │  │ • Announce  │  │ • KYC 상태  │  │ • 준비금    │  │ • 접근 로그 │ │  │
│  │  │   Event     │  │ • 위험 등급 │  │   잔액      │  │ • 조회 기록 │ │  │
│  │  │ • ViewTag   │  │ • 제재 목록 │  │ • 증명 기록 │  │ • 승인 기록 │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    BLOCKCHAIN LAYER (go-stablenet)                    │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                   Compliance Smart Contracts                  │   │  │
│  │  │  • RegulatoryRegistry    • ProofOfReserve    • KYCRegistry   │   │  │
│  │  │  • AuditLogger           • TaxReporter       • Sanctions     │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 규제기관 접근 권한 매트릭스

| 규제기관 | 접근 범위 | 권한 수준 | 법적 근거 |
|----------|----------|----------|----------|
| **금융정보분석원 (FIU)** | 의심 거래 전체 | Full Trace | 특정금융정보법 |
| **금융감독원 (FSC)** | 라이선스 발급자 거래 | Audit | 전자금융거래법 |
| **국세청 (NTS)** | 과세 대상 거래 | Tax View | 국세기본법 |
| **경찰/검찰** | 수사 대상 계정 | Case-based | 형사소송법 |
| **외부 감사인** | 준비금 증명 | PoR Only | 감사 계약 |

---

## 4. 스마트 컨트랙트

### 4.1 컨트랙트 구조

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Compliance Smart Contract Architecture                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Core Compliance Contracts                        │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  RegulatoryRegistry.sol                                         │  │  │
│  │  │  • 규제기관 등록 및 권한 관리                                    │  │  │
│  │  │  • MRK 공개키 저장                                              │  │  │
│  │  │  • 다중서명 승인 로직                                           │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ProofOfReserve.sol                                             │  │  │
│  │  │  • Chainlink PoR 오라클 연동                                    │  │  │
│  │  │  • 준비금 비율 실시간 검증                                      │  │  │
│  │  │  • 준비금 부족 시 자동 Pause                                    │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  KYCRegistry.sol                                                │  │  │
│  │  │  • KYC 상태 온체인 기록                                         │  │  │
│  │  │  • 허용/차단 목록 관리                                          │  │  │
│  │  │  • 제재 목록 (OFAC) 연동                                        │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  AuditLogger.sol                                                │  │  │
│  │  │  • 규제기관 접근 기록                                           │  │  │
│  │  │  • 불변 감사 추적                                               │  │  │
│  │  │  • 이벤트 기반 로깅                                             │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  MonthlyAttestation.sol                                         │  │  │
│  │  │  • CEO/CFO 월간 증명 기록                                       │  │  │
│  │  │  • GENIUS Act 준수                                              │  │  │
│  │  │  • 증명 누락 시 알림                                            │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 RegulatoryRegistry 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title RegulatoryRegistry
 * @notice 규제기관 등록 및 권한 관리
 * @dev MRK 공개키 저장 및 다중서명 승인 로직 포함
 */
contract RegulatoryRegistry is AccessControlUpgradeable, UUPSUpgradeable {

    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    // Master Regulatory Key 공개키 (secp256k1)
    bytes public masterRegulatoryKeyPubKey;

    // 규제기관 정보
    struct Regulator {
        string name;           // 기관명 (예: "금융정보분석원")
        string jurisdiction;   // 관할권 (예: "KR")
        uint8 accessLevel;     // 접근 수준 (1-5)
        bool isActive;
        uint256 registeredAt;
    }

    // 조회 요청 정보
    struct TraceRequest {
        address regulator;
        address targetAccount;
        bytes32 legalBasisHash;  // 법적 근거 해시
        uint256 requestedAt;
        uint8 approvalCount;
        bool isApproved;
        bool isExecuted;
    }

    mapping(address => Regulator) public regulators;
    mapping(bytes32 => TraceRequest) public traceRequests;
    mapping(bytes32 => mapping(address => bool)) public approvals;

    uint8 public constant REQUIRED_APPROVALS = 2;  // 2-of-3 다중서명

    event RegulatorRegistered(address indexed regulator, string name);
    event TraceRequested(bytes32 indexed requestId, address indexed regulator, address targetAccount);
    event TraceApproved(bytes32 indexed requestId, address indexed approver);
    event TraceExecuted(bytes32 indexed requestId);

    function initialize(bytes calldata _mrkPubKey) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        masterRegulatoryKeyPubKey = _mrkPubKey;
    }

    /**
     * @notice 규제기관 등록
     * @param regulatorAddr 규제기관 주소
     * @param name 기관명
     * @param jurisdiction 관할권
     * @param accessLevel 접근 수준
     */
    function registerRegulator(
        address regulatorAddr,
        string calldata name,
        string calldata jurisdiction,
        uint8 accessLevel
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(accessLevel >= 1 && accessLevel <= 5, "Invalid access level");

        regulators[regulatorAddr] = Regulator({
            name: name,
            jurisdiction: jurisdiction,
            accessLevel: accessLevel,
            isActive: true,
            registeredAt: block.timestamp
        });

        _grantRole(REGULATOR_ROLE, regulatorAddr);

        emit RegulatorRegistered(regulatorAddr, name);
    }

    /**
     * @notice 자금 추적 요청 생성
     * @param targetAccount 추적 대상 계정
     * @param legalBasisHash 법적 근거 문서 해시
     */
    function requestTrace(
        address targetAccount,
        bytes32 legalBasisHash
    ) external onlyRole(REGULATOR_ROLE) returns (bytes32) {
        require(regulators[msg.sender].isActive, "Regulator not active");

        bytes32 requestId = keccak256(abi.encodePacked(
            msg.sender,
            targetAccount,
            legalBasisHash,
            block.timestamp
        ));

        traceRequests[requestId] = TraceRequest({
            regulator: msg.sender,
            targetAccount: targetAccount,
            legalBasisHash: legalBasisHash,
            requestedAt: block.timestamp,
            approvalCount: 0,
            isApproved: false,
            isExecuted: false
        });

        emit TraceRequested(requestId, msg.sender, targetAccount);

        return requestId;
    }

    /**
     * @notice 추적 요청 승인 (다중서명)
     * @param requestId 요청 ID
     */
    function approveTrace(bytes32 requestId) external onlyRole(APPROVER_ROLE) {
        TraceRequest storage request = traceRequests[requestId];
        require(request.requestedAt > 0, "Request not found");
        require(!request.isApproved, "Already approved");
        require(!approvals[requestId][msg.sender], "Already approved by this approver");

        approvals[requestId][msg.sender] = true;
        request.approvalCount++;

        if (request.approvalCount >= REQUIRED_APPROVALS) {
            request.isApproved = true;
        }

        emit TraceApproved(requestId, msg.sender);
    }

    /**
     * @notice 승인된 추적 요청 확인
     */
    function isTraceApproved(bytes32 requestId) external view returns (bool) {
        return traceRequests[requestId].isApproved;
    }

    /**
     * @notice 추적 실행 완료 기록
     */
    function markTraceExecuted(bytes32 requestId) external onlyRole(REGULATOR_ROLE) {
        TraceRequest storage request = traceRequests[requestId];
        require(request.isApproved, "Not approved");
        require(!request.isExecuted, "Already executed");
        require(request.regulator == msg.sender, "Not requester");

        request.isExecuted = true;
        emit TraceExecuted(requestId);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
```

### 4.3 ProofOfReserve 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ProofOfReserve
 * @notice 100% 준비금 증명 및 검증
 * @dev Chainlink Proof of Reserve 오라클 연동
 */
contract ProofOfReserve is PausableUpgradeable, OwnableUpgradeable {

    // Chainlink PoR 오라클
    AggregatorV3Interface public reserveOracle;

    // 스테이블코인 총 공급량 참조
    address public stablecoinToken;

    // 최소 준비금 비율 (100% = 10000 basis points)
    uint256 public constant MIN_RESERVE_RATIO = 10000;

    // 마지막 검증 시간
    uint256 public lastVerificationTime;

    // 검증 주기 (예: 1시간)
    uint256 public verificationInterval;

    // 준비금 상태
    struct ReserveStatus {
        uint256 totalSupply;
        uint256 totalReserve;
        uint256 reserveRatio;  // basis points
        uint256 timestamp;
        bool isHealthy;
    }

    ReserveStatus public currentStatus;

    event ReserveVerified(uint256 totalSupply, uint256 totalReserve, uint256 ratio);
    event ReserveUnhealthy(uint256 totalSupply, uint256 totalReserve, uint256 ratio);
    event OracleUpdated(address indexed newOracle);

    function initialize(
        address _reserveOracle,
        address _stablecoinToken,
        uint256 _verificationInterval
    ) external initializer {
        __Pausable_init();
        __Ownable_init();

        reserveOracle = AggregatorV3Interface(_reserveOracle);
        stablecoinToken = _stablecoinToken;
        verificationInterval = _verificationInterval;
    }

    /**
     * @notice 준비금 상태 검증
     * @dev Chainlink 오라클에서 준비금 데이터 조회
     */
    function verifyReserve() external returns (bool) {
        // 스테이블코인 총 공급량 조회
        uint256 totalSupply = _getTotalSupply();

        // Chainlink PoR 오라클에서 준비금 조회
        (, int256 reserveAnswer, , uint256 updatedAt, ) = reserveOracle.latestRoundData();
        require(reserveAnswer > 0, "Invalid reserve data");
        require(block.timestamp - updatedAt < 1 hours, "Stale oracle data");

        uint256 totalReserve = uint256(reserveAnswer);

        // 준비금 비율 계산 (basis points)
        uint256 ratio = (totalReserve * 10000) / totalSupply;

        // 상태 업데이트
        bool isHealthy = ratio >= MIN_RESERVE_RATIO;

        currentStatus = ReserveStatus({
            totalSupply: totalSupply,
            totalReserve: totalReserve,
            reserveRatio: ratio,
            timestamp: block.timestamp,
            isHealthy: isHealthy
        });

        lastVerificationTime = block.timestamp;

        if (isHealthy) {
            emit ReserveVerified(totalSupply, totalReserve, ratio);
        } else {
            emit ReserveUnhealthy(totalSupply, totalReserve, ratio);
            _pause();  // 준비금 부족 시 자동 일시정지
        }

        return isHealthy;
    }

    /**
     * @notice 현재 준비금 상태 조회
     */
    function getReserveStatus() external view returns (
        uint256 totalSupply,
        uint256 totalReserve,
        uint256 reserveRatio,
        uint256 timestamp,
        bool isHealthy
    ) {
        ReserveStatus memory status = currentStatus;
        return (
            status.totalSupply,
            status.totalReserve,
            status.reserveRatio,
            status.timestamp,
            status.isHealthy
        );
    }

    /**
     * @notice 준비금 증명 (Merkle Proof 포함)
     * @dev 외부 감사인용 증명 생성
     */
    function generateProof() external view returns (
        uint256 totalSupply,
        uint256 totalReserve,
        uint256 ratio,
        uint256 timestamp,
        bytes32 proofHash
    ) {
        ReserveStatus memory status = currentStatus;

        bytes32 hash = keccak256(abi.encodePacked(
            status.totalSupply,
            status.totalReserve,
            status.reserveRatio,
            status.timestamp,
            block.chainid
        ));

        return (
            status.totalSupply,
            status.totalReserve,
            status.reserveRatio,
            status.timestamp,
            hash
        );
    }

    function _getTotalSupply() internal view returns (uint256) {
        // ERC20 총 공급량 조회
        (bool success, bytes memory data) = stablecoinToken.staticcall(
            abi.encodeWithSignature("totalSupply()")
        );
        require(success, "Failed to get total supply");
        return abi.decode(data, (uint256));
    }

    function updateOracle(address _newOracle) external onlyOwner {
        reserveOracle = AggregatorV3Interface(_newOracle);
        emit OracleUpdated(_newOracle);
    }
}
```

### 4.4 KYCRegistry 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title KYCRegistry
 * @notice KYC 상태 온체인 기록 및 관리
 * @dev 허용/차단 목록 관리, 제재 목록 연동
 */
contract KYCRegistry is AccessControlUpgradeable {

    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");
    bytes32 public constant SANCTIONS_ADMIN_ROLE = keccak256("SANCTIONS_ADMIN_ROLE");

    enum KYCStatus {
        NONE,           // 미인증
        PENDING,        // 인증 진행중
        VERIFIED,       // 인증 완료
        REJECTED,       // 인증 거부
        EXPIRED         // 인증 만료
    }

    enum RiskLevel {
        LOW,            // 저위험
        MEDIUM,         // 중위험
        HIGH,           // 고위험
        PROHIBITED      // 거래 금지
    }

    struct KYCRecord {
        KYCStatus status;
        RiskLevel riskLevel;
        uint256 verifiedAt;
        uint256 expiresAt;
        bytes32 kycProviderHash;  // KYC 제공자 해시 (프라이버시 보호)
        string jurisdiction;      // 관할권 (예: "KR", "US")
    }

    // 주소 → KYC 정보
    mapping(address => KYCRecord) public kycRecords;

    // 제재 목록 (OFAC, UN 등)
    mapping(address => bool) public sanctionedAddresses;

    // 국가별 제재 목록
    mapping(string => bool) public sanctionedJurisdictions;

    // KYC 유효기간 (기본 1년)
    uint256 public constant DEFAULT_KYC_VALIDITY = 365 days;

    event KYCStatusUpdated(address indexed account, KYCStatus status, RiskLevel riskLevel);
    event SanctionAdded(address indexed account, string reason);
    event SanctionRemoved(address indexed account);

    function initialize() external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice KYC 상태 업데이트
     * @param account 대상 계정
     * @param status KYC 상태
     * @param riskLevel 위험 등급
     * @param kycProviderHash KYC 제공자 해시
     * @param jurisdiction 관할권
     */
    function updateKYCStatus(
        address account,
        KYCStatus status,
        RiskLevel riskLevel,
        bytes32 kycProviderHash,
        string calldata jurisdiction
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(!sanctionedAddresses[account], "Account is sanctioned");
        require(!sanctionedJurisdictions[jurisdiction], "Jurisdiction is sanctioned");

        uint256 expiresAt = status == KYCStatus.VERIFIED
            ? block.timestamp + DEFAULT_KYC_VALIDITY
            : 0;

        kycRecords[account] = KYCRecord({
            status: status,
            riskLevel: riskLevel,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt,
            kycProviderHash: kycProviderHash,
            jurisdiction: jurisdiction
        });

        emit KYCStatusUpdated(account, status, riskLevel);
    }

    /**
     * @notice KYC 상태 확인
     * @param account 확인할 계정
     */
    function isKYCVerified(address account) external view returns (bool) {
        KYCRecord memory record = kycRecords[account];

        if (sanctionedAddresses[account]) return false;
        if (record.status != KYCStatus.VERIFIED) return false;
        if (record.expiresAt < block.timestamp) return false;
        if (record.riskLevel == RiskLevel.PROHIBITED) return false;

        return true;
    }

    /**
     * @notice 제재 목록 추가
     */
    function addToSanctionList(
        address account,
        string calldata reason
    ) external onlyRole(SANCTIONS_ADMIN_ROLE) {
        sanctionedAddresses[account] = true;

        // KYC 상태 무효화
        if (kycRecords[account].status == KYCStatus.VERIFIED) {
            kycRecords[account].status = KYCStatus.REJECTED;
            kycRecords[account].riskLevel = RiskLevel.PROHIBITED;
        }

        emit SanctionAdded(account, reason);
    }

    /**
     * @notice 제재 목록 제거
     */
    function removeFromSanctionList(
        address account
    ) external onlyRole(SANCTIONS_ADMIN_ROLE) {
        sanctionedAddresses[account] = false;
        emit SanctionRemoved(account);
    }

    /**
     * @notice 거래 허용 여부 확인 (다른 컨트랙트에서 호출)
     */
    function canTransact(address account) external view returns (bool) {
        if (sanctionedAddresses[account]) return false;

        KYCRecord memory record = kycRecords[account];
        if (record.riskLevel == RiskLevel.PROHIBITED) return false;

        return true;
    }

    /**
     * @notice 위험 등급 조회
     */
    function getRiskLevel(address account) external view returns (RiskLevel) {
        if (sanctionedAddresses[account]) return RiskLevel.PROHIBITED;
        return kycRecords[account].riskLevel;
    }
}
```

### 4.5 AuditLogger 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditLogger
 * @notice 불변 감사 로그 기록
 * @dev 모든 규제기관 접근 및 조회 기록
 */
contract AuditLogger {

    enum ActionType {
        TRACE_REQUEST,      // 추적 요청
        TRACE_APPROVAL,     // 추적 승인
        TRACE_EXECUTION,    // 추적 실행
        DATA_ACCESS,        // 데이터 접근
        REPORT_GENERATION,  // 보고서 생성
        KYC_UPDATE,         // KYC 업데이트
        RESERVE_VERIFY      // 준비금 검증
    }

    struct AuditLog {
        uint256 timestamp;
        address actor;          // 행위자 (규제기관)
        ActionType actionType;
        address targetAccount;  // 대상 계정 (해당 시)
        bytes32 dataHash;       // 관련 데이터 해시
        string jurisdiction;    // 관할권
        bytes32 legalBasisHash; // 법적 근거 해시
    }

    // 로그 저장 (인덱스 → 로그)
    mapping(uint256 => AuditLog) public logs;
    uint256 public logCount;

    // 행위자별 로그 인덱스
    mapping(address => uint256[]) public actorLogs;

    // 대상별 로그 인덱스
    mapping(address => uint256[]) public targetLogs;

    event AuditLogCreated(
        uint256 indexed logId,
        address indexed actor,
        ActionType actionType,
        address indexed targetAccount
    );

    /**
     * @notice 감사 로그 기록
     */
    function log(
        ActionType actionType,
        address targetAccount,
        bytes32 dataHash,
        string calldata jurisdiction,
        bytes32 legalBasisHash
    ) external returns (uint256) {
        uint256 logId = logCount++;

        logs[logId] = AuditLog({
            timestamp: block.timestamp,
            actor: msg.sender,
            actionType: actionType,
            targetAccount: targetAccount,
            dataHash: dataHash,
            jurisdiction: jurisdiction,
            legalBasisHash: legalBasisHash
        });

        actorLogs[msg.sender].push(logId);
        if (targetAccount != address(0)) {
            targetLogs[targetAccount].push(logId);
        }

        emit AuditLogCreated(logId, msg.sender, actionType, targetAccount);

        return logId;
    }

    /**
     * @notice 특정 기간 로그 조회
     */
    function getLogsByTimeRange(
        uint256 startTime,
        uint256 endTime
    ) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](logCount);
        uint256 count = 0;

        for (uint256 i = 0; i < logCount; i++) {
            if (logs[i].timestamp >= startTime && logs[i].timestamp <= endTime) {
                result[count++] = i;
            }
        }

        // 결과 크기 조정
        uint256[] memory trimmed = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            trimmed[i] = result[i];
        }

        return trimmed;
    }

    /**
     * @notice 행위자별 로그 조회
     */
    function getLogsByActor(address actor) external view returns (uint256[] memory) {
        return actorLogs[actor];
    }

    /**
     * @notice 대상별 로그 조회
     */
    function getLogsByTarget(address target) external view returns (uint256[] memory) {
        return targetLogs[target];
    }
}
```

---

## 5. Backend Services

### 5.1 Compliance Server 아키텍처

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      Compliance Server Architecture                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        API Layer (Fastify)                            │  │
│  │                                                                       │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ /trace         │  │ /kyc           │  │ /reserve       │         │  │
│  │  │                │  │                │  │                │         │  │
│  │  │ POST /request  │  │ GET /status    │  │ GET /proof     │         │  │
│  │  │ GET /status    │  │ POST /update   │  │ GET /history   │         │  │
│  │  │ GET /result    │  │ GET /risk      │  │ POST /verify   │         │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  │                                                                       │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ /tax           │  │ /audit         │  │ /sanctions     │         │  │
│  │  │                │  │                │  │                │         │  │
│  │  │ GET /report    │  │ GET /logs      │  │ GET /check     │         │  │
│  │  │ POST /withhold │  │ POST /export   │  │ POST /screen   │         │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Service Layer                                  │  │
│  │                                                                       │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ TraceService   │  │ KYTService     │  │ TaxService     │         │  │
│  │  │                │  │                │  │                │         │  │
│  │  │ • RVK 파생     │  │ • Chainalysis  │  │ • 과세 정보    │         │  │
│  │  │ • Stealth 스캔 │  │   KYT 연동     │  │   집계         │         │  │
│  │  │ • 자금 흐름    │  │ • 위험 평가    │  │ • 원천징수     │         │  │
│  │  │   재구성      │  │ • 알림 생성    │  │   계산         │         │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  │                                                                       │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ ReserveService │  │ AuditService   │  │ SanctionService│         │  │
│  │  │                │  │                │  │                │         │  │
│  │  │ • PoR 오라클   │  │ • 로그 기록    │  │ • OFAC 조회    │         │  │
│  │  │   연동         │  │ • 보고서 생성  │  │ • 실시간 스캔  │         │  │
│  │  │ • 증명 생성    │  │ • 내보내기     │  │ • 차단 처리    │         │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Integration Layer                              │  │
│  │                                                                       │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ HSM Client     │  │ Blockchain     │  │ External APIs  │         │  │
│  │  │                │  │ Client         │  │                │         │  │
│  │  │ • MRK 연산     │  │ • Contract     │  │ • Chainalysis  │         │  │
│  │  │ • RVK 파생     │  │   호출         │  │ • Elliptic     │         │  │
│  │  │ • 서명 생성    │  │ • Event 구독   │  │ • OFAC API     │         │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  기술 스택: TypeScript, Fastify, PostgreSQL, Redis, AWS CloudHSM           │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Transaction Tracer Service

```typescript
// services/compliance/src/services/TransactionTracer.ts

import { HSMClient } from '../clients/HSMClient';
import { StealthDB } from '../db/StealthDB';
import { AuditLogger } from '../utils/AuditLogger';

interface TraceRequest {
  requestId: string;
  regulatorId: string;
  targetAddress: string;
  legalBasisHash: string;
  startBlock?: number;
  endBlock?: number;
}

interface TraceResult {
  targetAddress: string;
  stealthAddresses: string[];
  transactions: TransactionDetail[];
  totalInflow: bigint;
  totalOutflow: bigint;
  timeline: TimelineEntry[];
}

interface TransactionDetail {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  value: bigint;
  stealthAddress: string;
  ephemeralPubKey: string;
}

export class TransactionTracer {
  constructor(
    private hsmClient: HSMClient,
    private stealthDB: StealthDB,
    private auditLogger: AuditLogger
  ) {}

  /**
   * 규제기관 자금 추적 실행
   */
  async executeTrace(request: TraceRequest): Promise<TraceResult> {
    // 1. 감사 로그 기록
    await this.auditLogger.log({
      action: 'TRACE_EXECUTION',
      actor: request.regulatorId,
      target: request.targetAddress,
      legalBasis: request.legalBasisHash,
    });

    // 2. 대상 계정의 Meta-Address 조회
    const metaAddress = await this.getMetaAddress(request.targetAddress);
    if (!metaAddress) {
      throw new Error('Meta-address not found for target');
    }

    // 3. HSM에서 Regulatory Viewing Key 파생
    const rvk = await this.hsmClient.deriveRegulatoryViewingKey(
      metaAddress.viewingKeyPubKey
    );

    // 4. Stealth DB에서 관련 Announcement 스캔
    const announcements = await this.stealthDB.scanWithViewingKey(
      rvk,
      request.startBlock,
      request.endBlock
    );

    // 5. 각 Stealth Address의 거래 내역 조회
    const transactions: TransactionDetail[] = [];
    const stealthAddresses: string[] = [];

    for (const announcement of announcements) {
      const stealthAddr = await this.deriveStealthAddress(
        announcement,
        rvk
      );

      if (stealthAddr) {
        stealthAddresses.push(stealthAddr);

        const txs = await this.getTransactionsForAddress(stealthAddr);
        transactions.push(...txs.map(tx => ({
          ...tx,
          stealthAddress: stealthAddr,
          ephemeralPubKey: announcement.ephemeralPubKey,
        })));
      }
    }

    // 6. 자금 흐름 분석
    const { totalInflow, totalOutflow } = this.calculateFlows(transactions);

    // 7. 타임라인 생성
    const timeline = this.buildTimeline(transactions);

    // 8. 결과 반환 및 로깅
    const result: TraceResult = {
      targetAddress: request.targetAddress,
      stealthAddresses,
      transactions,
      totalInflow,
      totalOutflow,
      timeline,
    };

    await this.auditLogger.log({
      action: 'TRACE_COMPLETED',
      actor: request.regulatorId,
      target: request.targetAddress,
      result: this.hashResult(result),
    });

    return result;
  }

  /**
   * 자금 흐름 시각화 데이터 생성
   */
  async generateFlowChart(traceResult: TraceResult): Promise<FlowChartData> {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    // 노드 생성 (주소별)
    const addressSet = new Set<string>();
    for (const tx of traceResult.transactions) {
      addressSet.add(tx.from);
      addressSet.add(tx.to);
    }

    for (const addr of addressSet) {
      const isTarget = traceResult.stealthAddresses.includes(addr);
      nodes.push({
        id: addr,
        type: isTarget ? 'target' : 'external',
        label: this.truncateAddress(addr),
      });
    }

    // 엣지 생성 (거래별)
    for (const tx of traceResult.transactions) {
      edges.push({
        source: tx.from,
        target: tx.to,
        value: tx.value.toString(),
        txHash: tx.txHash,
        timestamp: tx.timestamp,
      });
    }

    return { nodes, edges };
  }

  private async getMetaAddress(address: string): Promise<MetaAddress | null> {
    // ERC6538Registry에서 조회
    // ...
  }

  private async deriveStealthAddress(
    announcement: Announcement,
    rvk: Buffer
  ): Promise<string | null> {
    // ECDH로 Stealth Address 파생
    // ...
  }

  private calculateFlows(transactions: TransactionDetail[]) {
    let totalInflow = 0n;
    let totalOutflow = 0n;

    for (const tx of transactions) {
      if (tx.to === tx.stealthAddress) {
        totalInflow += tx.value;
      } else {
        totalOutflow += tx.value;
      }
    }

    return { totalInflow, totalOutflow };
  }

  private buildTimeline(transactions: TransactionDetail[]): TimelineEntry[] {
    return transactions
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(tx => ({
        timestamp: tx.timestamp,
        type: tx.to === tx.stealthAddress ? 'INFLOW' : 'OUTFLOW',
        amount: tx.value.toString(),
        counterparty: tx.to === tx.stealthAddress ? tx.from : tx.to,
        txHash: tx.txHash,
      }));
  }
}
```

### 5.3 KYT (Know Your Transaction) Service

```typescript
// services/compliance/src/services/KYTService.ts

import { ChainalysisClient } from '../clients/ChainalysisClient';
import { EllipticClient } from '../clients/EllipticClient';

interface RiskAssessment {
  address: string;
  riskScore: number;        // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  sanctions: SanctionMatch[];
  exposures: ExposureDetail[];
  recommendation: string;
}

interface RiskFactor {
  category: string;
  description: string;
  severity: number;
}

interface SanctionMatch {
  listName: string;         // 'OFAC', 'UN', 'EU' 등
  matchType: string;        // 'EXACT', 'PARTIAL'
  matchedEntity: string;
  confidence: number;
}

export class KYTService {
  constructor(
    private chainalysis: ChainalysisClient,
    private elliptic: EllipticClient
  ) {}

  /**
   * 주소 위험 평가
   */
  async assessRisk(address: string): Promise<RiskAssessment> {
    // 1. Chainalysis KYT API 호출
    const chainalysisResult = await this.chainalysis.screenAddress(address);

    // 2. Elliptic Navigator 호출 (크로스체인 분석)
    const ellipticResult = await this.elliptic.analyzeAddress(address);

    // 3. 제재 목록 확인
    const sanctions = await this.checkSanctions(address);

    // 4. 종합 위험 점수 계산
    const riskScore = this.calculateRiskScore(
      chainalysisResult,
      ellipticResult,
      sanctions
    );

    // 5. 위험 등급 결정
    const riskLevel = this.determineRiskLevel(riskScore);

    // 6. 위험 요인 식별
    const riskFactors = this.identifyRiskFactors(
      chainalysisResult,
      ellipticResult
    );

    // 7. 노출 분석
    const exposures = this.analyzeExposures(chainalysisResult);

    return {
      address,
      riskScore,
      riskLevel,
      riskFactors,
      sanctions,
      exposures,
      recommendation: this.generateRecommendation(riskLevel),
    };
  }

  /**
   * 실시간 거래 모니터링
   */
  async monitorTransaction(txHash: string): Promise<TransactionAlert[]> {
    const alerts: TransactionAlert[] = [];

    // 1. 거래 세부 정보 조회
    const txDetails = await this.getTransactionDetails(txHash);

    // 2. 발신자 위험 평가
    const senderRisk = await this.assessRisk(txDetails.from);
    if (senderRisk.riskLevel === 'HIGH' || senderRisk.riskLevel === 'CRITICAL') {
      alerts.push({
        type: 'HIGH_RISK_SENDER',
        severity: senderRisk.riskLevel,
        address: txDetails.from,
        details: senderRisk.riskFactors,
      });
    }

    // 3. 수신자 위험 평가
    const receiverRisk = await this.assessRisk(txDetails.to);
    if (receiverRisk.riskLevel === 'HIGH' || receiverRisk.riskLevel === 'CRITICAL') {
      alerts.push({
        type: 'HIGH_RISK_RECEIVER',
        severity: receiverRisk.riskLevel,
        address: txDetails.to,
        details: receiverRisk.riskFactors,
      });
    }

    // 4. 금액 패턴 분석
    const amountAlerts = await this.analyzeAmountPatterns(txDetails);
    alerts.push(...amountAlerts);

    // 5. 제재 목록 확인
    const sanctionAlerts = await this.checkSanctionAlerts(txDetails);
    alerts.push(...sanctionAlerts);

    return alerts;
  }

  /**
   * 의심거래 보고서 생성 (STR)
   */
  async generateSTR(
    address: string,
    alerts: TransactionAlert[]
  ): Promise<SuspiciousTransactionReport> {
    const riskAssessment = await this.assessRisk(address);
    const transactionHistory = await this.getTransactionHistory(address);

    return {
      reportId: this.generateReportId(),
      reportDate: new Date(),
      subject: {
        address,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
      },
      alerts,
      transactionSummary: {
        totalCount: transactionHistory.length,
        totalVolume: this.calculateTotalVolume(transactionHistory),
        dateRange: this.getDateRange(transactionHistory),
      },
      riskAnalysis: {
        factors: riskAssessment.riskFactors,
        exposures: riskAssessment.exposures,
        sanctions: riskAssessment.sanctions,
      },
      narrative: this.generateNarrative(riskAssessment, alerts),
      recommendation: riskAssessment.recommendation,
    };
  }

  private calculateRiskScore(
    chainalysis: any,
    elliptic: any,
    sanctions: SanctionMatch[]
  ): number {
    let score = 0;

    // Chainalysis 점수 (40%)
    score += (chainalysis.riskScore || 0) * 0.4;

    // Elliptic 점수 (40%)
    score += (elliptic.riskScore || 0) * 0.4;

    // 제재 목록 (20%)
    if (sanctions.length > 0) {
      const maxConfidence = Math.max(...sanctions.map(s => s.confidence));
      score += maxConfidence * 0.2;
    }

    return Math.min(100, Math.round(score));
  }

  private determineRiskLevel(score: number): RiskAssessment['riskLevel'] {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }
}
```

---

## 6. Tax Authority Integration

### 6.1 세금 보고 아키텍처

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     Tax Authority Integration Architecture                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Tax Reporting Flow                             │  │
│  │                                                                       │  │
│  │  사용자 거래         Compliance Server        국세청 (NTS)            │  │
│  │       │                    │                      │                   │  │
│  │       │  1. 거래 발생      │                      │                   │  │
│  │       │ ──────────────────►│                      │                   │  │
│  │       │                    │                      │                   │  │
│  │       │                    │  2. 과세 대상        │                   │  │
│  │       │                    │     판단             │                   │  │
│  │       │                    │     • 양도소득?     │                   │  │
│  │       │                    │     • 이자소득?     │                   │  │
│  │       │                    │     • 사업소득?     │                   │  │
│  │       │                    │                      │                   │  │
│  │       │                    │  3. 과세 정보 집계  │                   │  │
│  │       │                    │     • 취득가액      │                   │  │
│  │       │                    │     • 양도가액      │                   │  │
│  │       │                    │     • 보유기간      │                   │  │
│  │       │                    │                      │                   │  │
│  │       │                    │  4. (선택적)        │                   │  │
│  │       │                    │     원천징수 신고   │                   │  │
│  │       │                    │ ────────────────────►│                   │  │
│  │       │                    │                      │                   │  │
│  │       │                    │  5. 연간 보고서     │                   │  │
│  │       │                    │ ────────────────────►│                   │  │
│  │       │                    │                      │                   │  │
│  │       │  6. 세금 신고      │                      │                   │  │
│  │       │     지원 자료      │                      │                   │  │
│  │       │ ◄──────────────────│                      │                   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Tax Data Model                                 │  │
│  │                                                                       │  │
│  │  TaxableEvent {                                                       │  │
│  │    eventType: 'TRANSFER' | 'SWAP' | 'STAKE_REWARD' | 'INTEREST'      │  │
│  │    timestamp: DateTime                                                │  │
│  │    amount: BigInt                                                     │  │
│  │    assetType: 'STABLECOIN' | 'OTHER_TOKEN'                           │  │
│  │    acquisitionCost: BigInt      // 취득가액                           │  │
│  │    disposalValue: BigInt        // 양도가액                           │  │
│  │    gainLoss: BigInt             // 손익                               │  │
│  │    holdingPeriod: Number        // 보유기간 (일)                      │  │
│  │    taxJurisdiction: String      // 과세 관할권                        │  │
│  │  }                                                                    │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Tax Reporter Service

```typescript
// services/compliance/src/services/TaxReporter.ts

interface TaxReport {
  taxpayerId: string;
  reportingPeriod: { start: Date; end: Date };
  summary: TaxSummary;
  transactions: TaxableEvent[];
  schedules: TaxSchedule[];
}

interface TaxSummary {
  totalAcquisitionCost: bigint;
  totalDisposalValue: bigint;
  totalGainLoss: bigint;
  totalWithheldTax: bigint;
  estimatedTaxLiability: bigint;
}

export class TaxReporter {
  /**
   * 연간 세금 보고서 생성
   */
  async generateAnnualReport(
    address: string,
    year: number
  ): Promise<TaxReport> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // 1. 해당 기간 거래 조회
    const transactions = await this.getTransactionsInPeriod(
      address,
      startDate,
      endDate
    );

    // 2. 과세 대상 이벤트 식별
    const taxableEvents = this.identifyTaxableEvents(transactions);

    // 3. FIFO 기준 취득가액 계산
    const eventsWithCostBasis = await this.calculateCostBasis(
      address,
      taxableEvents
    );

    // 4. 손익 계산
    const eventsWithGainLoss = this.calculateGainLoss(eventsWithCostBasis);

    // 5. 요약 생성
    const summary = this.calculateSummary(eventsWithGainLoss);

    // 6. 세금 스케줄 생성
    const schedules = this.generateSchedules(eventsWithGainLoss);

    return {
      taxpayerId: address,
      reportingPeriod: { start: startDate, end: endDate },
      summary,
      transactions: eventsWithGainLoss,
      schedules,
    };
  }

  /**
   * 원천징수 계산 및 신고
   */
  async calculateWithholding(
    transaction: Transaction,
    payerAddress: string,
    payeeAddress: string
  ): Promise<WithholdingResult> {
    // 1. 거래 유형에 따른 원천징수 대상 판단
    const isWithholdable = this.isWithholdable(transaction);
    if (!isWithholdable) {
      return { required: false };
    }

    // 2. 지급자 거주지 확인
    const payerJurisdiction = await this.getJurisdiction(payerAddress);

    // 3. 수취인 거주지 확인
    const payeeJurisdiction = await this.getJurisdiction(payeeAddress);

    // 4. 원천징수율 결정
    const rate = this.getWithholdingRate(
      payerJurisdiction,
      payeeJurisdiction,
      transaction.type
    );

    // 5. 원천징수 금액 계산
    const withholdingAmount = (transaction.value * BigInt(rate)) / 10000n;

    // 6. 원천징수 기록
    const record = await this.recordWithholding({
      transaction,
      payerAddress,
      payeeAddress,
      amount: withholdingAmount,
      rate,
      timestamp: new Date(),
    });

    return {
      required: true,
      amount: withholdingAmount,
      rate,
      recordId: record.id,
    };
  }

  /**
   * 국세청 API 연동 (실시간 신고)
   */
  async submitToNTS(report: TaxReport): Promise<SubmissionResult> {
    // 1. 보고서 포맷 변환 (국세청 양식)
    const ntsFormat = this.convertToNTSFormat(report);

    // 2. 전자서명
    const signedReport = await this.signReport(ntsFormat);

    // 3. 국세청 API 호출
    const response = await this.ntsClient.submit(signedReport);

    // 4. 제출 결과 기록
    await this.recordSubmission({
      reportId: report.taxpayerId,
      submissionDate: new Date(),
      status: response.status,
      receiptNumber: response.receiptNumber,
    });

    return {
      success: response.status === 'ACCEPTED',
      receiptNumber: response.receiptNumber,
      message: response.message,
    };
  }

  private identifyTaxableEvents(
    transactions: Transaction[]
  ): TaxableEvent[] {
    return transactions
      .filter(tx => this.isTaxable(tx))
      .map(tx => ({
        eventType: this.classifyEventType(tx),
        timestamp: tx.timestamp,
        amount: tx.value,
        assetType: this.classifyAsset(tx.tokenAddress),
        txHash: tx.hash,
      }));
  }

  private calculateCostBasis(
    address: string,
    events: TaxableEvent[]
  ): Promise<TaxableEvent[]> {
    // FIFO (선입선출) 방식으로 취득가액 계산
    // ...
  }

  private getWithholdingRate(
    payerJurisdiction: string,
    payeeJurisdiction: string,
    transactionType: string
  ): number {
    // 한국 원천징수율 (예시)
    const rates: Record<string, number> = {
      'KR:KR:INTEREST': 1540,      // 15.4% (이자소득)
      'KR:KR:DIVIDEND': 1540,      // 15.4% (배당소득)
      'KR:FOREIGN:INTEREST': 2200, // 22% (비거주자)
    };

    const key = `${payerJurisdiction}:${payeeJurisdiction}:${transactionType}`;
    return rates[key] || 0;
  }
}
```

---

## 7. 데이터 흐름

### 7.1 규제 준수 데이터 흐름

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Regulatory Compliance Data Flow                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] 사용자 거래 발생                                                        │
│                                                                             │
│  사용자 ─────► Smart Account ─────► Blockchain                              │
│                    │                    │                                    │
│                    │                    ├────► Stealth Announcement         │
│                    │                    │           │                        │
│                    │                    │           ▼                        │
│                    │                    │      Stealth Server               │
│                    │                    │           │                        │
│                    │                    │           │ ViewTag 인덱싱         │
│                    │                    │           ▼                        │
│                    │                    │      Stealth DB                   │
│                    │                    │                                    │
│                    │                    └────► Transaction Event            │
│                    │                              │                          │
│                    │                              ▼                          │
│                    │                         KYT Engine                      │
│                    │                              │                          │
│                    │                              │ 위험 평가                 │
│                    │                              ▼                          │
│                    │                         Alert 생성                      │
│                    │                              │                          │
│                    │                              ▼                          │
│                    │                         Compliance DB                   │
│                    │                                                         │
│                    └─────────────────────────────────────────────────────── │
│                                                                             │
│  [2] 규제기관 조회 요청                                                       │
│                                                                             │
│  규제기관 ──────► Compliance Portal                                          │
│                        │                                                     │
│                        │ 1. 인증 (mTLS + API Key)                            │
│                        │ 2. 권한 확인 (RBAC)                                  │
│                        │ 3. 법적 근거 검증                                    │
│                        │                                                     │
│                        ▼                                                     │
│                   RegulatoryRegistry (2-of-3 승인)                           │
│                        │                                                     │
│                        │ 승인 완료                                            │
│                        ▼                                                     │
│                   HSM (RVK 파생)                                             │
│                        │                                                     │
│                        ▼                                                     │
│                   Transaction Tracer                                         │
│                        │                                                     │
│                        │ Stealth DB 스캔                                     │
│                        ▼                                                     │
│                   추적 결과 + 감사 로그                                       │
│                        │                                                     │
│                        ▼                                                     │
│                   규제기관                                                    │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 글로벌 규제 준수 매핑

### 8.1 주요국 규제 요구사항 매핑

| 규제 요구사항 | 한국 | 싱가포르 | EU (MiCA) | 미국 (GENIUS) | 구현 기능 |
|--------------|------|---------|-----------|--------------|----------|
| **100% 준비금** | ✅ | ✅ | ✅ | ✅ | ProofOfReserve |
| **분리 수탁** | ✅ | ✅ | ✅ | ✅ | SegregatedTreasury |
| **AML/KYC** | ✅ | ✅ | ✅ | ✅ | KYCRegistry, KYTService |
| **월간 증명** | - | ✅ | - | ✅ | MonthlyAttestation |
| **연간 감사** | ✅ | ✅ | ✅ | ✅ | AuditLogger |
| **실시간 환매** | ✅ | ✅ | ✅ | ✅ | RedemptionManager |
| **자금 추적** | ✅ | ✅ | ✅ | ✅ | TransactionTracer |
| **제재 스크리닝** | ✅ | ✅ | ✅ | ✅ | SanctionService |

### 8.2 관할권별 특수 요구사항

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Jurisdiction-Specific Requirements                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  한국 (KR)                                                                   │
│  ├── 특금법 (VASP 등록)                                                      │
│  ├── 트래블룰 (FATF)                                                         │
│  └── 국세청 연동 (원천징수)                                                   │
│                                                                             │
│  싱가포르 (SG)                                                               │
│  ├── MAS 라이선스 (MPI/PSA)                                                  │
│  ├── 월간 CEO/CFO 증명                                                       │
│  └── 6개월 내 환매 의무                                                       │
│                                                                             │
│  EU (MiCA)                                                                   │
│  ├── ARTs/EMTs 분류                                                          │
│  ├── 백서 발행 의무                                                          │
│  └── 대규모 발행자 추가 규제 (>500만 EUR/일)                                  │
│                                                                             │
│  미국 (GENIUS Act)                                                           │
│  ├── 연방/주 라이선스                                                        │
│  ├── 월간 증명서 발행                                                        │
│  ├── 소비자 보호 조항                                                        │
│  └── OFAC 준수 (2일 내 동결)                                                 │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 보안 고려사항

### 9.1 Regulatory Key 보호

| 보호 대상 | 보호 방법 | 접근 제어 |
|----------|----------|----------|
| **Master Regulatory Key** | HSM (FIPS 140-2 Level 3) | 2-of-3 다중서명 |
| **Regulatory Viewing Key** | 메모리 내 파생, 저장 안함 | 승인된 요청 시에만 |
| **감사 로그** | 불변 온체인 기록 | 읽기 전용 공개 |
| **KYC 데이터** | 암호화 저장 (AES-256) | 규제기관 + 승인 |

### 9.2 접근 로깅 및 감사

```
모든 규제기관 접근은 다음을 기록:
├── 요청자 (규제기관 ID)
├── 대상 (계정 주소)
├── 법적 근거 (해시)
├── 타임스탬프
├── 승인자 목록
├── 조회 범위
└── 결과 해시
```

---

## 10. 개발 로드맵

### 10.1 Phase별 구현 계획

| Phase | 기간 | 구현 항목 |
|-------|------|----------|
| **Phase 3** | Week 12-14 | RegulatoryRegistry, Viewing Key System |
| **Phase 4** | Week 15-17 | ProofOfReserve, KYCRegistry |
| **Phase 5** | Week 18-21 | KYT Integration, Tax Reporter |
| **Phase 6** | Week 22-24 | Compliance Portal, 통합 테스트 |

### 10.2 외부 연동 일정

| 연동 대상 | 예상 시기 | 비고 |
|----------|----------|------|
| **Chainalysis KYT** | Week 18 | API 계약 필요 |
| **Chainlink PoR** | Week 15 | 오라클 배포 |
| **OFAC API** | Week 19 | 공개 API |
| **국세청 API** | Post-PoC | 사업자 등록 후 |

---

## 11. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 종합 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [03_Development_Roadmap.md](./03_Development_Roadmap.md) - 개발 로드맵

### 참고 자료

- [규제준수_기술_실제사례_조사.md](../규제준수_기술_실제사례_조사.md) - 규제 준수 기술 사례
- [규제준수_컨트랙트_기술구현_가이드.md](../규제준수_컨트랙트_기술구현_가이드.md) - 컨트랙트 구현 가이드
- [글로벌_스테이블코인_규제_기술요건_분석.md](../글로벌_스테이블코인_규제_기술요건_분석.md) - 글로벌 규제 분석

---

*문서 끝*
