# Phase 3: Privacy (Stealth Address)

> **Version**: 1.0
> **Duration**: 2-3 주
> **Priority**: High
> **Dependencies**: Phase 1 완료

---

## 1. 개요

Phase 3는 프라이버시 보호 전송을 위한 Stealth Address 시스템을 구축합니다.

### 1.1 목표
- **표준 Stealth**: EIP-5564/EIP-6538 호환 구현
- **Enterprise Stealth**: Off-chain UTXO + On-chain 자금 관리 하이브리드 시스템

### 1.2 핵심 차별점

| 구분 | 표준 Stealth | Enterprise Stealth |
|------|-------------|-------------------|
| 자금 흐름 | EOA → Stealth Address (직접) | EOA → Vault → EOA (간접) |
| 추적성 | On-chain 불가 | On-chain 불가, Off-chain 가능 |
| 출금 방식 | Private key로 직접 | Multi-sig 승인 필요 |
| 사용 사례 | P2P 프라이버시 | 기업 급여, 규제 준수 필요 |

### 1.3 산출물
- EIP-5564/6538 표준 컨트랙트
- Enterprise Stealth 컨트랙트 세트
- Off-chain 서비스 인터페이스 정의

---

## 2. 컴포넌트 목록

### 2.1 Standard Stealth (EIP-5564/6538)

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 |
|----|----------|------|---------|--------|
| C3.1 | ERC5564Announcer | `privacy/standard/ERC5564Announcer.sol` | P0 | Low |
| C3.2 | ERC6538Registry | `privacy/standard/ERC6538Registry.sol` | P0 | Low |
| C3.3 | PrivateBank | `privacy/standard/PrivateBank.sol` | P0 | Medium |

### 2.2 Enterprise Stealth

| ID | 컴포넌트 | 파일 | 우선순위 | 복잡도 |
|----|----------|------|---------|--------|
| C3.4 | StealthVault | `privacy/enterprise/StealthVault.sol` | P0 | High |
| C3.5 | StealthLedger | `privacy/enterprise/StealthLedger.sol` | P0 | Medium |
| C3.6 | WithdrawalManager | `privacy/enterprise/WithdrawalManager.sol` | P0 | High |
| C3.7 | RoleManager | `privacy/enterprise/RoleManager.sol` | P1 | Medium |

---

## 3. 아키텍처 상세

### 3.1 표준 Stealth 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Standard Stealth Address Flow                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [1. Meta-Address 등록]                                                  │
│  수신자 Bob:                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ stealthMetaAddress = "st:eth:" + spendingPubKey + viewingPubKey │    │
│  │                                                                  │    │
│  │ ERC6538Registry.registerKeys(schemeId, stealthMetaAddress)      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [2. Stealth Address 생성] (송신자 Alice, Off-chain)                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 1. 임시 키쌍 생성: (r, R = r*G)                                   │    │
│  │ 2. 공유 비밀 계산: S = r * viewingPubKey                          │    │
│  │ 3. Stealth pubKey: P = spendingPubKey + hash(S) * G              │    │
│  │ 4. Stealth address: address(P)                                   │    │
│  │ 5. ViewTag: hash(S)[0]                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [3. 자금 전송 + Announcement] (On-chain)                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Alice → stealthAddress: ETH/Token 전송                           │    │
│  │                                                                  │    │
│  │ ERC5564Announcer.announce(                                       │    │
│  │   schemeId = 1,                                                  │    │
│  │   stealthAddress,                                                │    │
│  │   ephemeralPubKey = R,                                           │    │
│  │   metadata = [viewTag, token, amount]                            │    │
│  │ )                                                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [4. 수신자 스캔] (Bob, Off-chain)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ For each announcement:                                           │    │
│  │   1. ViewTag 확인 (빠른 필터링)                                   │    │
│  │   2. 공유 비밀 계산: S' = viewingPrivKey * ephemeralPubKey       │    │
│  │   3. Stealth pubKey 재계산: P' = spendingPubKey + hash(S') * G   │    │
│  │   4. if address(P') == stealthAddress: 내 자금!                  │    │
│  │   5. Stealth privKey = spendingPrivKey + hash(S')                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [5. 자금 사용] (Bob)                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Stealth privKey로 서명하여 자금 전송                              │    │
│  │ (일반 EOA처럼 사용)                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Enterprise Stealth 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Enterprise Stealth Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                          ROLES                                   │    │
│  │  DEPOSITOR: 자금 예치 가능                                        │    │
│  │  RECORDER: 분배 기록 가능                                         │    │
│  │  WITHDRAWER: 출금 승인 가능 (Multi-sig 3-of-5)                    │    │
│  │  ADMIN: 역할 관리                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [Phase 1: DEPOSIT] ─────────────────────────────────────────────────   │
│  │                                                                       │
│  │  Depositor (Company EOA)                                             │
│  │       │                                                               │
│  │       │ deposit(token, amount, depositId)                            │
│  │       ▼                                                               │
│  │  ┌──────────────────────────────────────────┐                        │
│  │  │            StealthVault                   │                        │
│  │  │  - ERC20.transferFrom(depositor, vault)  │                        │
│  │  │  - deposits[depositId] = DepositInfo     │                        │
│  │  │  - emit Deposited(depositId, depositor)  │                        │
│  │  └──────────────────────────────────────────┘                        │
│  │                                                                       │
│  │  [On-chain 기록: depositId, depositor, amount, timestamp]            │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [Phase 2: OFF-CHAIN ALLOCATION] ───────────────────────────────────    │
│  │                                                                       │
│  │  Off-chain Server (UTXO Style)                                       │
│  │  ┌─────────────────────────────────────────────────────────────┐    │
│  │  │                                                              │    │
│  │  │  1. Stealth Address 생성 (수신자별)                          │    │
│  │  │     recipient1 → stealthAddr1                                │    │
│  │  │     recipient2 → stealthAddr2                                │    │
│  │  │                                                              │    │
│  │  │  2. UTXO 생성                                                │    │
│  │  │     ┌────────────────────────────────────────────────┐      │    │
│  │  │     │ UTXO #1                                         │      │    │
│  │  │     │   id: "utxo_001"                                │      │    │
│  │  │     │   depositId: "dep_001"                          │      │    │
│  │  │     │   sender: "0xCompany..."                        │      │    │
│  │  │     │   recipient: "st:eth:0x..." (stealthMetaAddr)   │      │    │
│  │  │     │   stealthAddress: "0xStealth1..."               │      │    │
│  │  │     │   amount: 1000 USDT                             │      │    │
│  │  │     │   spent: false                                  │      │    │
│  │  │     │   ephemeralPubKey: "0x..."                      │      │    │
│  │  │     │   viewTag: "0xAB"                               │      │    │
│  │  │     └────────────────────────────────────────────────┘      │    │
│  │  │                                                              │    │
│  │  │  3. 수신자 알림 (Off-chain, 선택적)                          │    │
│  │  │                                                              │    │
│  │  └─────────────────────────────────────────────────────────────┘    │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [Phase 3: ON-CHAIN RECORD] ────────────────────────────────────────    │
│  │                                                                       │
│  │  Recorder (Authorized Backend)                                       │
│  │       │                                                               │
│  │       │ recordDistribution(batchId, distributionHash, merkleRoot)    │
│  │       ▼                                                               │
│  │  ┌──────────────────────────────────────────┐                        │
│  │  │            StealthLedger                  │                        │
│  │  │  - require(hasRole(RECORDER_ROLE))       │                        │
│  │  │  - distributions[batchId] = {            │                        │
│  │  │      hash: distributionHash,             │                        │
│  │  │      merkleRoot: merkleRoot,             │                        │
│  │  │      timestamp: block.timestamp          │                        │
│  │  │    }                                     │                        │
│  │  │  - emit DistributionRecorded(batchId)    │                        │
│  │  └──────────────────────────────────────────┘                        │
│  │                                                                       │
│  │  [On-chain 기록: batchId, hash만 저장 (상세 데이터 없음)]            │
│  │  [Off-chain DB와 batchId로 매칭 가능]                                │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [Phase 4: WITHDRAWAL REQUEST] ─────────────────────────────────────    │
│  │                                                                       │
│  │  Recipient (Off-chain)                                               │
│  │  ┌─────────────────────────────────────────────────────────────┐    │
│  │  │                                                              │    │
│  │  │  1. Stealth Address 소유권 증명                              │    │
│  │  │     - Private key로 challenge 서명                           │    │
│  │  │     - 또는 EIP-712 typed data 서명                           │    │
│  │  │                                                              │    │
│  │  │  2. 출금 요청 제출                                            │    │
│  │  │     POST /withdrawal-request                                 │    │
│  │  │     {                                                        │    │
│  │  │       utxoId: "utxo_001",                                   │    │
│  │  │       recipientEOA: "0xBob...",                             │    │
│  │  │       amount: 1000,                                         │    │
│  │  │       proof: { signature, message }                         │    │
│  │  │     }                                                        │    │
│  │  │                                                              │    │
│  │  │  3. 서버 검증                                                 │    │
│  │  │     - 서명 검증                                               │    │
│  │  │     - UTXO spent 상태 확인                                    │    │
│  │  │     - 금액 일치 확인                                          │    │
│  │  │                                                              │    │
│  │  └─────────────────────────────────────────────────────────────┘    │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [Phase 5: MULTI-SIG WITHDRAWAL] ───────────────────────────────────    │
│  │                                                                       │
│  │  WithdrawalManager (Multi-sig 3-of-5)                                │
│  │                                                                       │
│  │  Step 1: 출금 요청 생성                                              │
│  │  ┌──────────────────────────────────────────┐                        │
│  │  │ createWithdrawal(                         │                        │
│  │  │   withdrawalId,                           │                        │
│  │  │   recipient,                              │                        │
│  │  │   token,                                  │                        │
│  │  │   amount,                                 │                        │
│  │  │   merkleProof                             │                        │
│  │  │ )                                         │                        │
│  │  │                                           │                        │
│  │  │ → withdrawals[id] = { status: PENDING }   │                        │
│  │  └──────────────────────────────────────────┘                        │
│  │                                                                       │
│  │  Step 2: 다중 승인                                                   │
│  │  ┌──────────────────────────────────────────┐                        │
│  │  │ Signer 1: approveWithdrawal(id) ✓        │                        │
│  │  │ Signer 2: approveWithdrawal(id) ✓        │                        │
│  │  │ Signer 3: approveWithdrawal(id) ✓        │                        │
│  │  │ ─────────────────────────────────────────│                        │
│  │  │ Threshold (3) reached!                   │                        │
│  │  └──────────────────────────────────────────┘                        │
│  │                                                                       │
│  │  Step 3: 출금 실행                                                   │
│  │  ┌──────────────────────────────────────────┐                        │
│  │  │ executeWithdrawal(id)                     │                        │
│  │  │                                           │                        │
│  │  │ → StealthVault.withdraw(recipient, token, amount)                 │
│  │  │ → emit WithdrawalExecuted(id, recipient)  │                        │
│  │  └──────────────────────────────────────────┘                        │
│  │                                                                       │
│  │  [On-chain 기록: withdrawalId, recipient, amount, timestamp]         │
│  │  [Off-chain: UTXO spent = true]                                      │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  [RESULT]                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  On-chain 관점:                                                  │    │
│  │    Company EOA → StealthVault → Bob EOA                         │    │
│  │    (Company가 누구에게 얼마를 줬는지 직접 연결 불가)              │    │
│  │                                                                  │    │
│  │  Off-chain 관점:                                                 │    │
│  │    Company → (Stealth st:Bob) → Bob                             │    │
│  │    (완전한 추적 가능, 규제 준수)                                  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Standard Stealth 태스크 분해

### 4.1 ERC5564Announcer (T3.1)

#### T3.1.1 Announcement 이벤트
```yaml
파일: src/privacy/standard/ERC5564Announcer.sol
작업:
  - [ ] Announcement event 정의
    - schemeId (indexed)
    - stealthAddress (indexed)
    - caller (indexed)
    - ephemeralPubKey
    - metadata
예상시간: 30m
의존성: Phase 1 완료
```

**Announcement Event**:
```solidity
event Announcement(
    uint256 indexed schemeId,
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata
);
```

#### T3.1.2 announce() 함수
```yaml
작업:
  - [ ] announce() public 함수
  - [ ] 파라미터 검증
  - [ ] Announcement 이벤트 발행
예상시간: 1h
의존성: T3.1.1
```

```solidity
function announce(
    uint256 schemeId,
    address stealthAddress,
    bytes calldata ephemeralPubKey,
    bytes calldata metadata
) external {
    emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
}
```

#### T3.1.3 Scheme 상수
```yaml
작업:
  - [ ] SCHEME_ID_SECP256K1 = 1
  - [ ] SCHEME_ID_ED25519 = 2
  - [ ] 추가 scheme 지원 가능하도록 설계
예상시간: 30m
의존성: T3.1.1
```

---

### 4.2 ERC6538Registry (T3.2)

#### T3.2.1 기본 구조
```yaml
파일: src/privacy/standard/ERC6538Registry.sol
작업:
  - [ ] stealthMetaAddresses mapping
    - registrant → schemeId → bytes
예상시간: 1h
의존성: Phase 1 완료
```

#### T3.2.2 registerKeys()
```yaml
작업:
  - [ ] registerKeys(schemeId, stealthMetaAddress)
  - [ ] msg.sender 기반 등록
  - [ ] StealthMetaAddressSet 이벤트
예상시간: 1h
의존성: T3.2.1
```

#### T3.2.3 registerKeysOnBehalf()
```yaml
작업:
  - [ ] registerKeysOnBehalf(registrant, schemeId, stealthMetaAddress, signature)
  - [ ] EIP-712 서명 검증
  - [ ] 대리 등록 지원
예상시간: 2h
의존성: T3.2.2
```

**EIP-712 Domain**:
```solidity
bytes32 constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 constant REGISTER_TYPEHASH = keccak256(
    "Register(address registrant,uint256 schemeId,bytes stealthMetaAddress,uint256 nonce)"
);
```

#### T3.2.4 조회 함수
```yaml
작업:
  - [ ] getStealthMetaAddress(registrant, schemeId) view
  - [ ] 존재 여부 확인
예상시간: 30m
의존성: T3.2.1
```

---

### 4.3 PrivateBank (T3.3)

#### T3.3.1 기본 구조
```yaml
파일: src/privacy/standard/PrivateBank.sol
작업:
  - [ ] announcer immutable
  - [ ] registry immutable
  - [ ] SCHEME_ID constant
예상시간: 1h
의존성: T3.1, T3.2
```

#### T3.3.2 sendToStealth() - ERC20
```yaml
작업:
  - [ ] sendToStealth(recipient, token, amount, ephemeralPubKey, stealthAddress, viewTag)
  - [ ] token.transferFrom(msg.sender, stealthAddress, amount)
  - [ ] metadata 인코딩 (viewTag + token + amount)
  - [ ] announcer.announce() 호출
  - [ ] StealthTransfer 이벤트
예상시간: 3h
의존성: T3.3.1
```

#### T3.3.3 sendETHToStealth() - Native
```yaml
작업:
  - [ ] sendETHToStealth(recipient, ephemeralPubKey, stealthAddress, viewTag) payable
  - [ ] stealthAddress.call{value: msg.value}("")
  - [ ] metadata 인코딩 (viewTag + address(0) + msg.value)
  - [ ] announcer.announce() 호출
예상시간: 2h
의존성: T3.3.1
```

#### T3.3.4 Batch 전송
```yaml
작업:
  - [ ] batchSendToStealth() - 다수 수신자
  - [ ] 가스 최적화
예상시간: 2h
의존성: T3.3.2
```

---

## 5. Enterprise Stealth 태스크 분해

### 5.1 StealthVault (T3.4)

#### T3.4.1 기본 구조
```yaml
파일: src/privacy/enterprise/StealthVault.sol
작업:
  - [ ] AccessControl 상속
  - [ ] ReentrancyGuard 상속
  - [ ] Pausable 상속
  - [ ] DEPOSITOR_ROLE, WITHDRAWER_ROLE 정의
예상시간: 2h
의존성: Phase 1 완료
```

**역할 정의**:
```solidity
bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
```

#### T3.4.2 DepositInfo 구조체
```yaml
작업:
  - [ ] DepositInfo struct
    - depositor: address
    - token: address
    - amount: uint256
    - timestamp: uint48
    - withdrawn: uint256
    - status: DepositStatus (ACTIVE, COMPLETED, CANCELLED)
  - [ ] deposits mapping (depositId → DepositInfo)
  - [ ] depositorDeposits mapping (depositor → depositId[])
예상시간: 2h
의존성: T3.4.1
```

#### T3.4.3 deposit()
```yaml
작업:
  - [ ] deposit(token, amount, depositId)
  - [ ] require(hasRole(DEPOSITOR_ROLE))
  - [ ] require(!deposits[depositId].exists)
  - [ ] IERC20.transferFrom()
  - [ ] deposits[depositId] 저장
  - [ ] Deposited 이벤트
예상시간: 3h
의존성: T3.4.2
```

**deposit 흐름**:
```solidity
function deposit(
    address token,
    uint256 amount,
    bytes32 depositId
) external onlyRole(DEPOSITOR_ROLE) nonReentrant whenNotPaused {
    require(deposits[depositId].depositor == address(0), "Deposit exists");

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    deposits[depositId] = DepositInfo({
        depositor: msg.sender,
        token: token,
        amount: amount,
        timestamp: uint48(block.timestamp),
        withdrawn: 0,
        status: DepositStatus.ACTIVE
    });

    depositorDeposits[msg.sender].push(depositId);

    emit Deposited(depositId, msg.sender, token, amount);
}
```

#### T3.4.4 withdraw()
```yaml
작업:
  - [ ] withdraw(recipient, token, amount, withdrawalId)
  - [ ] require(hasRole(WITHDRAWER_ROLE))
  - [ ] 잔액 확인
  - [ ] IERC20.transfer()
  - [ ] Withdrawn 이벤트
예상시간: 3h
의존성: T3.4.2
```

#### T3.4.5 조회 함수
```yaml
작업:
  - [ ] getDeposit(depositId) view
  - [ ] getDepositorDeposits(depositor) view
  - [ ] getVaultBalance(token) view
  - [ ] getTotalDeposited(token) view
예상시간: 2h
의존성: T3.4.2
```

#### T3.4.6 Emergency 기능
```yaml
작업:
  - [ ] pause() / unpause() (onlyAdmin)
  - [ ] emergencyWithdraw() (onlyAdmin, only when paused)
예상시간: 2h
의존성: T3.4.1
```

---

### 5.2 StealthLedger (T3.5)

#### T3.5.1 기본 구조
```yaml
파일: src/privacy/enterprise/StealthLedger.sol
작업:
  - [ ] AccessControl 상속
  - [ ] RECORDER_ROLE 정의
예상시간: 1h
의존성: Phase 1 완료
```

#### T3.5.2 DistributionRecord 구조체
```yaml
작업:
  - [ ] DistributionRecord struct
    - hash: bytes32 (off-chain 데이터 해시)
    - merkleRoot: bytes32 (UTXO merkle root)
    - timestamp: uint48
    - recordedBy: address
  - [ ] distributions mapping (batchId → DistributionRecord)
예상시간: 2h
의존성: T3.5.1
```

#### T3.5.3 recordDistribution()
```yaml
작업:
  - [ ] recordDistribution(batchId, distributionHash, merkleRoot)
  - [ ] require(hasRole(RECORDER_ROLE))
  - [ ] require(!distributions[batchId].exists)
  - [ ] distributions[batchId] 저장
  - [ ] DistributionRecorded 이벤트
예상시간: 2h
의존성: T3.5.2
```

**distributionHash 및 Merkle Leaf 계산** (Off-chain):
```javascript
// Off-chain에서 계산
const utxos = [
  {
    id: "utxo_001",
    recipient: "st:eth:0x...",
    stealthAddress: "0xStealth1...",
    token: "0xUSDT...",
    amount: 1000,
    withdrawalNonce: 0  // Replay 방지용 nonce
  },
  {
    id: "utxo_002",
    recipient: "st:eth:0x...",
    stealthAddress: "0xStealth2...",
    token: "0xUSDT...",
    amount: 2000,
    withdrawalNonce: 0
  },
];

// Merkle Leaf 구조 (replay 방지 포함)
function hashUTXO(utxo) {
  return keccak256(abi.encodePacked(
    utxo.id,
    utxo.stealthAddress,
    utxo.token,
    utxo.amount,
    utxo.withdrawalNonce  // 출금 시 증가하여 재사용 방지
  ));
}

const distributionHash = keccak256(JSON.stringify(utxos));
const merkleRoot = getMerkleRoot(utxos.map(u => hashUTXO(u)));
```

> **Replay Attack 방지**:
> - 각 UTXO에 `withdrawalNonce`를 포함
> - 출금 시 nonce가 포함된 merkle proof 검증
> - 이미 사용된 utxoHash는 `usedUTXOs` mapping에서 추적
> - 동일한 UTXO로 중복 출금 시도 시 실패

#### T3.5.4 Merkle 검증
```yaml
작업:
  - [ ] verifyDistribution(batchId, utxoHash, merkleProof) view
  - [ ] MerkleProof.verify() 사용
예상시간: 2h
의존성: T3.5.3
```

#### T3.5.5 조회 함수
```yaml
작업:
  - [ ] getDistribution(batchId) view
  - [ ] isRecorded(batchId) view
예상시간: 1h
의존성: T3.5.2
```

---

### 5.3 WithdrawalManager (T3.6)

#### T3.6.1 기본 구조
```yaml
파일: src/privacy/enterprise/WithdrawalManager.sol
작업:
  - [ ] AccessControl 상속
  - [ ] ReentrancyGuard 상속
  - [ ] SIGNER_ROLE 정의
  - [ ] threshold 설정 (3-of-5)
  - [ ] stealthVault 참조
  - [ ] stealthLedger 참조
예상시간: 2h
의존성: T3.4, T3.5
```

#### T3.6.2 WithdrawalRequest 구조체
```yaml
작업:
  - [ ] WithdrawalRequest struct
    - recipient: address
    - token: address
    - amount: uint256
    - batchId: bytes32
    - utxoHash: bytes32
    - createdAt: uint48
    - executedAt: uint48
    - status: WithdrawalStatus (PENDING, APPROVED, EXECUTED, CANCELLED)
    - approvalCount: uint8
  - [ ] withdrawals mapping (withdrawalId → WithdrawalRequest)
  - [ ] approvals mapping (withdrawalId → signer → bool)
  - [ ] usedUTXOs mapping (utxoHash → bool) - Replay 방지
예상시간: 2h
의존성: T3.6.1
```

> **Replay 방지**: `usedUTXOs` mapping으로 동일 UTXO의 중복 출금을 방지합니다.

#### T3.6.3 createWithdrawal()
```yaml
작업:
  - [ ] createWithdrawal(withdrawalId, recipient, token, amount, batchId, utxoHash, merkleProof)
  - [ ] Merkle proof 검증
  - [ ] withdrawals[withdrawalId] 저장
  - [ ] WithdrawalCreated 이벤트
예상시간: 4h
의존성: T3.6.2
```

**createWithdrawal 흐름**:
```solidity
function createWithdrawal(
    bytes32 withdrawalId,
    address recipient,
    address token,
    uint256 amount,
    bytes32 batchId,
    bytes32 utxoHash,
    bytes32[] calldata merkleProof
) external nonReentrant {
    // Replay 방지: 이미 사용된 UTXO 확인
    require(!usedUTXOs[utxoHash], "UTXO already spent");

    // Merkle proof 검증
    require(
        stealthLedger.verifyDistribution(batchId, utxoHash, merkleProof),
        "Invalid merkle proof"
    );

    // 중복 확인
    require(withdrawals[withdrawalId].recipient == address(0), "Withdrawal exists");

    // UTXO 사용 처리 (Replay 방지)
    usedUTXOs[utxoHash] = true;

    // 출금 요청 생성
    withdrawals[withdrawalId] = WithdrawalRequest({
        recipient: recipient,
        token: token,
        amount: amount,
        batchId: batchId,
        utxoHash: utxoHash,
        createdAt: uint48(block.timestamp),
        executedAt: 0,
        status: WithdrawalStatus.PENDING,
        approvalCount: 0
    });

    emit WithdrawalCreated(withdrawalId, recipient, token, amount);
}
```

#### T3.6.4 approveWithdrawal()
```yaml
작업:
  - [ ] approveWithdrawal(withdrawalId)
  - [ ] require(hasRole(SIGNER_ROLE))
  - [ ] require(!approvals[withdrawalId][msg.sender])
  - [ ] approvals[withdrawalId][msg.sender] = true
  - [ ] approvalCount++
  - [ ] WithdrawalApproved 이벤트
예상시간: 2h
의존성: T3.6.3
```

#### T3.6.5 executeWithdrawal()
```yaml
작업:
  - [ ] executeWithdrawal(withdrawalId)
  - [ ] require(approvalCount >= threshold)
  - [ ] require(status == PENDING)
  - [ ] stealthVault.withdraw() 호출
  - [ ] status = EXECUTED
  - [ ] WithdrawalExecuted 이벤트
예상시간: 3h
의존성: T3.6.4
```

#### T3.6.6 cancelWithdrawal()
```yaml
작업:
  - [ ] cancelWithdrawal(withdrawalId)
  - [ ] 권한 확인 (생성자 또는 Admin)
  - [ ] status = CANCELLED
  - [ ] WithdrawalCancelled 이벤트
예상시간: 1h
의존성: T3.6.3
```

#### T3.6.7 Threshold 관리
```yaml
작업:
  - [ ] setThreshold(newThreshold) (onlyAdmin)
  - [ ] require(newThreshold <= signerCount)
  - [ ] getThreshold() view
  - [ ] getSignerCount() view
예상시간: 2h
의존성: T3.6.1
```

---

### 5.4 RoleManager (T3.7)

#### T3.7.1 기본 구조
```yaml
파일: src/privacy/enterprise/RoleManager.sol
작업:
  - [ ] AccessControlEnumerable 상속
  - [ ] 모든 역할 중앙 관리
예상시간: 1h
의존성: Phase 1 완료
```

#### T3.7.2 역할 정의
```yaml
작업:
  - [ ] ADMIN_ROLE = DEFAULT_ADMIN_ROLE
  - [ ] DEPOSITOR_ROLE
  - [ ] RECORDER_ROLE
  - [ ] SIGNER_ROLE (Multi-sig)
  - [ ] OPERATOR_ROLE (일반 운영)
예상시간: 1h
의존성: T3.7.1
```

#### T3.7.3 역할 관리 함수
```yaml
작업:
  - [ ] grantRole() - 상속
  - [ ] revokeRole() - 상속
  - [ ] renounceRole() - 상속
  - [ ] getRoleMembers() - 상속 (Enumerable)
  - [ ] getRoleMemberCount() - 상속 (Enumerable)
예상시간: 1h
의존성: T3.7.2
```

#### T3.7.4 컨트랙트 연결
```yaml
작업:
  - [ ] setStealthVault()
  - [ ] setStealthLedger()
  - [ ] setWithdrawalManager()
  - [ ] 각 컨트랙트에 적절한 역할 부여
예상시간: 2h
의존성: T3.7.3
```

---

## 6. Off-chain 서비스 인터페이스

### 6.1 UTXO 데이터 모델

```typescript
interface UTXO {
  id: string;                    // 고유 ID
  depositId: string;             // 연관된 deposit
  batchId: string;               // 분배 배치 ID

  // 송수신 정보
  sender: Address;               // 예치자 EOA
  recipientMetaAddress: string;  // st:eth:0x... 형식
  stealthAddress: Address;       // 생성된 stealth address

  // 금액
  token: Address;
  amount: bigint;

  // Stealth 암호화
  ephemeralPubKey: Hex;
  viewTag: Hex;                  // 1 byte

  // 상태
  spent: boolean;
  spentAt?: number;
  withdrawalId?: string;

  // 타임스탬프
  createdAt: number;
  recordedAt?: number;           // On-chain 기록 시점
}
```

### 6.2 API 엔드포인트

```yaml
# Deposit 관련
POST /api/deposits
  - 새 deposit 생성 (on-chain tx 후 호출)
GET /api/deposits/:depositId
  - deposit 조회
GET /api/deposits/depositor/:address
  - 예치자별 deposit 목록

# Distribution 관련
POST /api/distributions
  - 분배 생성 (UTXO 생성)
POST /api/distributions/:batchId/record
  - On-chain 기록 요청
GET /api/distributions/:batchId
  - 분배 조회

# UTXO 관련
GET /api/utxos/:utxoId
  - UTXO 조회
GET /api/utxos/recipient/:stealthMetaAddress
  - 수신자별 UTXO 목록

# Withdrawal 관련
POST /api/withdrawals/request
  - 출금 요청 (소유권 증명 포함)
GET /api/withdrawals/:withdrawalId
  - 출금 상태 조회
POST /api/withdrawals/:withdrawalId/approve
  - Signer 승인 (off-chain 수집 후 on-chain 제출)
```

### 6.3 소유권 증명 메시지

```typescript
// EIP-712 Typed Data for Ownership Proof
const DOMAIN = {
  name: 'StableNet Enterprise Stealth',
  version: '1',
  chainId: 31337,
  verifyingContract: withdrawalManagerAddress,
};

const OWNERSHIP_PROOF_TYPE = {
  OwnershipProof: [
    { name: 'stealthAddress', type: 'address' },
    { name: 'recipientEOA', type: 'address' },
    { name: 'utxoId', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

// 수신자가 서명
const signature = await wallet.signTypedData(DOMAIN, OWNERSHIP_PROOF_TYPE, {
  stealthAddress: stealthAddr,
  recipientEOA: myEOA,
  utxoId: utxoId,
  amount: amount,
  nonce: nonce,
});
```

---

## 7. 테스트 작성 (T3.8)

### T3.8.1 Standard Stealth 테스트
```yaml
파일: test/privacy/standard/*.t.sol
작업:
  - [ ] ERC5564Announcer.t.sol
    - announce() 이벤트 검증
    - 다양한 schemeId 테스트
  - [ ] ERC6538Registry.t.sol
    - registerKeys 테스트
    - registerKeysOnBehalf 서명 검증
  - [ ] PrivateBank.t.sol
    - sendToStealth ERC20 전송
    - sendETHToStealth ETH 전송
    - Announcement 정확성 검증
예상시간: 8h
의존성: T3.1 ~ T3.3
```

### T3.8.2 Enterprise Stealth 테스트
```yaml
파일: test/privacy/enterprise/*.t.sol
작업:
  - [ ] StealthVault.t.sol
    - deposit 테스트
    - withdraw 테스트
    - 역할 기반 접근 제어
    - Emergency 기능
  - [ ] StealthLedger.t.sol
    - recordDistribution 테스트
    - Merkle proof 검증
  - [ ] WithdrawalManager.t.sol
    - createWithdrawal 테스트
    - Multi-sig 승인 흐름
    - threshold 변경
예상시간: 12h
의존성: T3.4 ~ T3.7
```

### T3.8.3 Integration 테스트
```yaml
파일: test/privacy/integration/*.t.sol
작업:
  - [ ] FullStealthFlow.t.sol
    - 표준 Stealth 전체 흐름
  - [ ] EnterpriseFlow.t.sol
    - Deposit → Distribution → Withdrawal 전체 흐름
    - Multi-sig 시나리오
예상시간: 8h
의존성: T3.8.1, T3.8.2
```

---

## 8. 배포 스크립트 (T3.9)

### T3.9.1 DeployStandardStealth.s.sol
```yaml
파일: script/DeployStandardStealth.s.sol
작업:
  - [ ] ERC5564Announcer 배포
  - [ ] ERC6538Registry 배포
  - [ ] PrivateBank 배포
  - [ ] 주소 저장
예상시간: 1h
의존성: T3.8.1
```

### T3.9.2 DeployEnterpriseStealth.s.sol
```yaml
파일: script/DeployEnterpriseStealth.s.sol
작업:
  - [ ] RoleManager 배포
  - [ ] StealthVault 배포
  - [ ] StealthLedger 배포
  - [ ] WithdrawalManager 배포
  - [ ] 역할 설정
  - [ ] 주소 저장
예상시간: 2h
의존성: T3.8.2
```

---

## 9. 의존성 그래프

```
Phase 1 (Core) 완료
    │
    ├── T3.1 (ERC5564Announcer)
    │   ├── T3.1.1 Announcement 이벤트
    │   ├── T3.1.2 announce() ◄── T3.1.1
    │   └── T3.1.3 Scheme 상수 ◄── T3.1.1
    │
    ├── T3.2 (ERC6538Registry)
    │   ├── T3.2.1 기본 구조
    │   ├── T3.2.2 registerKeys ◄── T3.2.1
    │   ├── T3.2.3 registerKeysOnBehalf ◄── T3.2.2
    │   └── T3.2.4 조회 함수 ◄── T3.2.1
    │
    ├── T3.3 (PrivateBank) ◄── T3.1, T3.2
    │   ├── T3.3.1 기본 구조
    │   ├── T3.3.2 sendToStealth ◄── T3.3.1
    │   ├── T3.3.3 sendETHToStealth ◄── T3.3.1
    │   └── T3.3.4 Batch 전송 ◄── T3.3.2
    │
    ├── T3.4 (StealthVault)
    │   ├── T3.4.1 기본 구조
    │   ├── T3.4.2 DepositInfo ◄── T3.4.1
    │   ├── T3.4.3 deposit() ◄── T3.4.2
    │   ├── T3.4.4 withdraw() ◄── T3.4.2
    │   ├── T3.4.5 조회 함수 ◄── T3.4.2
    │   └── T3.4.6 Emergency ◄── T3.4.1
    │
    ├── T3.5 (StealthLedger)
    │   ├── T3.5.1 기본 구조
    │   ├── T3.5.2 DistributionRecord ◄── T3.5.1
    │   ├── T3.5.3 recordDistribution ◄── T3.5.2
    │   ├── T3.5.4 Merkle 검증 ◄── T3.5.3
    │   └── T3.5.5 조회 함수 ◄── T3.5.2
    │
    ├── T3.6 (WithdrawalManager) ◄── T3.4, T3.5
    │   ├── T3.6.1 기본 구조
    │   ├── T3.6.2 WithdrawalRequest ◄── T3.6.1
    │   ├── T3.6.3 createWithdrawal ◄── T3.6.2
    │   ├── T3.6.4 approveWithdrawal ◄── T3.6.3
    │   ├── T3.6.5 executeWithdrawal ◄── T3.6.4
    │   ├── T3.6.6 cancelWithdrawal ◄── T3.6.3
    │   └── T3.6.7 Threshold 관리 ◄── T3.6.1
    │
    └── T3.7 (RoleManager)
        ├── T3.7.1 기본 구조
        ├── T3.7.2 역할 정의 ◄── T3.7.1
        ├── T3.7.3 역할 관리 ◄── T3.7.2
        └── T3.7.4 컨트랙트 연결 ◄── T3.7.3

T3.8 (테스트) ◄── T3.1 ~ T3.7
T3.9 (배포) ◄── T3.8
```

---

## 10. 일정 추정

| Week | 작업 그룹 | 예상 시간 |
|------|----------|-----------|
| Week 1 Day 1 | T3.1 ERC5564Announcer | 2h |
| Week 1 Day 1-2 | T3.2 ERC6538Registry | 5h |
| Week 1 Day 2-3 | T3.3 PrivateBank | 8h |
| Week 1 Day 4-5 | T3.4 StealthVault | 14h |
| Week 2 Day 1-2 | T3.5 StealthLedger | 8h |
| Week 2 Day 2-4 | T3.6 WithdrawalManager | 14h |
| Week 2 Day 5 | T3.7 RoleManager | 5h |
| Week 3 Day 1-3 | T3.8 테스트 | 28h |
| Week 3 Day 4 | T3.9 배포 | 3h |

**총 예상 시간**: ~87h (3주)

---

## 11. 체크리스트

### Phase 3 완료 조건

**Standard Stealth**:
- [ ] ERC5564Announcer 이벤트 발행 확인
- [ ] ERC6538Registry 등록/조회 동작
- [ ] PrivateBank ERC20/ETH 전송 성공

**Enterprise Stealth**:
- [ ] StealthVault deposit/withdraw 동작
- [ ] StealthLedger 기록 및 Merkle 검증
- [ ] WithdrawalManager Multi-sig 흐름 완료
- [ ] RoleManager 역할 관리 동작

**통합**:
- [ ] 전체 흐름 E2E 테스트 통과
- [ ] 테스트 커버리지 80%+
- [ ] Anvil devnet 배포 완료

---

*Phase 3 문서 끝*
