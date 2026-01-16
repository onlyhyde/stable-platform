# StableNet Secure Bridge 아키텍처

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 개요

### 1.1 기존 Bridge 해킹 사례 분석

| 사례 | 피해액 | 취약점 | 교훈 |
|------|--------|--------|------|
| **Ronin Bridge** (2022) | $625M | 5-of-9 multisig 중 5개 키 탈취 | 서명자 분산 부족 |
| **Wormhole** (2022) | $320M | 서명 검증 우회 취약점 | 코드 감사 필수 |
| **Nomad** (2022) | $190M | Merkle root 초기화 버그 | 상태 검증 필수 |
| **Harmony Horizon** (2022) | $100M | 2-of-5 multisig 탈취 | 낮은 threshold |
| **BNB Bridge** (2022) | $570M | IAVL 증명 검증 우회 | 증명 검증 강화 |

### 1.2 StableNet Bridge 설계 원칙

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     StableNet Secure Bridge 설계 원칙                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Defense in Depth (다층 방어)                                             │
│     └─ 단일 실패점 제거, 여러 보안 레이어                                    │
│                                                                              │
│  2. MPC + Optimistic (이중 검증)                                             │
│     └─ 즉각적 검증 + 사후 챌린지 기간                                        │
│                                                                              │
│  3. Rate Limiting (속도 제한)                                                │
│     └─ 대규모 탈취 방지, 점진적 한도                                         │
│                                                                              │
│  4. Emergency Response (긴급 대응)                                           │
│     └─ 자동 탐지, 즉시 정지, Guardian 시스템                                 │
│                                                                              │
│  5. Transparent Monitoring (투명한 모니터링)                                  │
│     └─ 실시간 알림, 공개 대시보드                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 아키텍처 개요

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Secure Bridge Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Source Chain (Ethereum)              Target Chain (StableNet)            │
│    ┌─────────────────────┐              ┌─────────────────────┐            │
│    │                     │              │                     │            │
│    │  ┌───────────────┐  │              │  ┌───────────────┐  │            │
│    │  │ SecureBridge  │  │              │  │ SecureBridge  │  │            │
│    │  │   (Source)    │  │              │  │   (Target)    │  │            │
│    │  └───────┬───────┘  │              │  └───────┬───────┘  │            │
│    │          │          │              │          │          │            │
│    │  ┌───────▼───────┐  │              │  ┌───────▼───────┐  │            │
│    │  │ TokenVault    │  │              │  │ TokenMinter   │  │            │
│    │  │   (Lock)      │  │              │  │   (Mint)      │  │            │
│    │  └───────────────┘  │              │  └───────────────┘  │            │
│    │                     │              │                     │            │
│    └──────────┬──────────┘              └──────────┬──────────┘            │
│               │                                    │                        │
│               │         ┌─────────────────┐        │                        │
│               │         │                 │        │                        │
│               └────────▶│  Bridge Layer   │◀───────┘                        │
│                         │                 │                                  │
│                         └────────┬────────┘                                  │
│                                  │                                           │
│              ┌───────────────────┼───────────────────┐                      │
│              ▼                   ▼                   ▼                      │
│    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│    │   MPC Signers   │  │   Challengers   │  │    Guardians    │           │
│    │   (5-of-7)      │  │  (Fraud Proof)  │  │  (Emergency)    │           │
│    └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 보안 레이어

| Layer | 역할 | 구현 |
|-------|------|------|
| **Layer 1: MPC Signing** | 분산 서명 | 5-of-7 threshold signature |
| **Layer 2: Optimistic Verification** | 사후 검증 | 6시간 challenge period |
| **Layer 3: Fraud Proof** | 부정 증명 | Merkle + State proof |
| **Layer 4: Rate Limiting** | 속도 제한 | 시간당/일일 한도 |
| **Layer 5: Guardian System** | 긴급 대응 | 3-of-5 multisig pause |

---

## 3. MPC Signing System

### 3.1 설계

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MPC Signing Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │Signer 1 │ │Signer 2 │ │Signer 3 │ │Signer 4 │ │Signer 5 │ ...         │
│  │ (AWS)   │ │ (GCP)   │ │ (Azure) │ │(On-prem)│ │(On-prem)│              │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘              │
│       │          │          │          │          │                        │
│       └──────────┴──────────┼──────────┴──────────┘                        │
│                             ▼                                               │
│              ┌──────────────────────────┐                                   │
│              │    Threshold Signature   │                                   │
│              │        (5-of-7)          │                                   │
│              └──────────────────────────┘                                   │
│                                                                              │
│  Key Generation: Distributed Key Generation (DKG)                           │
│  Protocol: GG20 (Gennaro-Goldfeder 2020)                                   │
│  Security: No single party knows full private key                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 서명자 분산 전략

| Signer | 위치 | 운영 주체 | Key Shard 보관 |
|--------|------|----------|---------------|
| Signer 1 | AWS (us-east-1) | StableNet | HSM |
| Signer 2 | GCP (us-central1) | StableNet | HSM |
| Signer 3 | Azure (eastus) | StableNet | HSM |
| Signer 4 | On-premise | Partner A | HSM |
| Signer 5 | On-premise | Partner B | HSM |
| Signer 6 | AWS (eu-west-1) | StableNet | HSM |
| Signer 7 | GCP (europe-west1) | Partner C | HSM |

**분산 원칙**:
- 최소 3개 클라우드 프로바이더
- 최소 2개 지리적 리전
- 최소 2개 외부 파트너
- 모든 키는 HSM에 보관

### 3.3 MPC 프로토콜

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BridgeValidator
 * @notice MPC 서명 검증 컨트랙트
 */
contract BridgeValidator {
    // MPC public key (aggregated)
    bytes32 public mpcPublicKeyX;
    bytes32 public mpcPublicKeyY;

    // Signer rotation
    uint256 public signerSetVersion;
    mapping(uint256 => bytes32) public signerSetHashes;

    // Nonce tracking (replay prevention)
    mapping(bytes32 => bool) public usedNonces;

    struct BridgeMessage {
        bytes32 requestId;
        address sender;
        address recipient;
        address token;
        uint256 amount;
        uint256 sourceChain;
        uint256 targetChain;
        uint256 nonce;
        uint256 deadline;
    }

    function verifyMPCSignature(
        BridgeMessage calldata message,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 messageHash = keccak256(abi.encode(
            message.requestId,
            message.sender,
            message.recipient,
            message.token,
            message.amount,
            message.sourceChain,
            message.targetChain,
            message.nonce,
            message.deadline
        ));

        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(messageHash);

        // MPC aggregated signature verification
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);

        address recovered = ecrecover(ethSignedHash, v, r, s);
        address expected = _computeAddress(mpcPublicKeyX, mpcPublicKeyY);

        return recovered == expected;
    }

    function rotateMPCKey(
        bytes32 newPublicKeyX,
        bytes32 newPublicKeyY,
        bytes calldata rotationProof
    ) external {
        // Key rotation with proof from old key set
        require(_verifyRotationProof(rotationProof), "Invalid rotation proof");

        mpcPublicKeyX = newPublicKeyX;
        mpcPublicKeyY = newPublicKeyY;
        signerSetVersion++;

        emit MPCKeyRotated(signerSetVersion, newPublicKeyX, newPublicKeyY);
    }
}
```

---

## 4. Optimistic Verification

### 4.1 Challenge Period 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Optimistic Verification Flow                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Time ─────────────────────────────────────────────────────────────────▶    │
│                                                                              │
│  T+0              T+6h (PoC)           T+24h (Mainnet)                      │
│   │                  │                      │                               │
│   ▼                  ▼                      ▼                               │
│  ┌────────┐      ┌────────┐            ┌────────┐                          │
│  │ Submit │      │ Ready  │            │ Ready  │                          │
│  │Request │      │  to    │            │  to    │                          │
│  │        │      │Execute │            │Execute │                          │
│  └────────┘      └────────┘            └────────┘                          │
│                                                                              │
│       ◀──────── Challenge Period ────────▶                                  │
│                                                                              │
│  During Challenge Period:                                                    │
│  - Anyone can submit fraud proof                                            │
│  - If valid fraud proof: request cancelled, challenger rewarded            │
│  - If no challenge: request can be executed after period                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Challenge Period 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OptimisticVerifier
 * @notice Challenge period 관리 및 fraud proof 검증
 */
contract OptimisticVerifier {
    uint256 public constant CHALLENGE_PERIOD_POC = 6 hours;
    uint256 public constant CHALLENGE_PERIOD_MAINNET = 24 hours;

    uint256 public challengePeriod = CHALLENGE_PERIOD_POC;
    uint256 public challengeBond = 1 ether;
    uint256 public challengerReward = 0.5 ether;

    struct PendingRequest {
        bytes32 requestId;
        bytes32 messageHash;
        uint256 submittedAt;
        uint256 challengeDeadline;
        bool challenged;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => PendingRequest) public pendingRequests;
    mapping(bytes32 => address) public challengers;

    event RequestSubmitted(
        bytes32 indexed requestId,
        bytes32 messageHash,
        uint256 challengeDeadline
    );

    event RequestChallenged(
        bytes32 indexed requestId,
        address indexed challenger,
        bytes fraudProof
    );

    event ChallengeResolved(
        bytes32 indexed requestId,
        bool fraudProven,
        address winner
    );

    /**
     * @notice 새 요청 제출 (MPC 서명 검증 후)
     */
    function submitRequest(
        bytes32 requestId,
        bytes32 messageHash
    ) external returns (uint256 challengeDeadline) {
        require(
            pendingRequests[requestId].submittedAt == 0,
            "Request already exists"
        );

        challengeDeadline = block.timestamp + challengePeriod;

        pendingRequests[requestId] = PendingRequest({
            requestId: requestId,
            messageHash: messageHash,
            submittedAt: block.timestamp,
            challengeDeadline: challengeDeadline,
            challenged: false,
            executed: false,
            cancelled: false
        });

        emit RequestSubmitted(requestId, messageHash, challengeDeadline);
    }

    /**
     * @notice Fraud proof 제출
     */
    function challenge(
        bytes32 requestId,
        bytes calldata fraudProof
    ) external payable {
        PendingRequest storage request = pendingRequests[requestId];

        require(request.submittedAt > 0, "Request not found");
        require(!request.executed, "Already executed");
        require(!request.challenged, "Already challenged");
        require(
            block.timestamp < request.challengeDeadline,
            "Challenge period ended"
        );
        require(msg.value >= challengeBond, "Insufficient bond");

        request.challenged = true;
        challengers[requestId] = msg.sender;

        emit RequestChallenged(requestId, msg.sender, fraudProof);
    }

    /**
     * @notice Challenge 결과 판정
     */
    function resolveChallenge(
        bytes32 requestId,
        bool fraudProven
    ) external onlyArbiter {
        PendingRequest storage request = pendingRequests[requestId];

        require(request.challenged, "Not challenged");

        address challenger = challengers[requestId];

        if (fraudProven) {
            // Fraud 증명됨: 요청 취소, challenger에게 보상
            request.cancelled = true;
            payable(challenger).transfer(challengeBond + challengerReward);

            emit ChallengeResolved(requestId, true, challenger);
        } else {
            // Fraud 증명 실패: challenger bond 몰수
            request.challenged = false;
            // Bond goes to protocol treasury

            emit ChallengeResolved(requestId, false, address(0));
        }
    }

    /**
     * @notice Challenge period 종료 후 실행 가능 여부
     */
    function canExecute(bytes32 requestId) external view returns (bool) {
        PendingRequest storage request = pendingRequests[requestId];

        return request.submittedAt > 0 &&
               !request.executed &&
               !request.cancelled &&
               !request.challenged &&
               block.timestamp >= request.challengeDeadline;
    }
}
```

---

## 5. Fraud Proof System

### 5.1 Fraud Proof 유형

| Type | 검증 대상 | 증명 방법 |
|------|----------|----------|
| **Invalid Signature** | MPC 서명 | 서명 검증 실패 증명 |
| **Double Spending** | 동일 요청 중복 실행 | 이전 실행 증거 제시 |
| **Invalid Amount** | 금액 불일치 | 소스 체인 상태 증명 |
| **Invalid Token** | 토큰 주소 불일치 | 컨트랙트 상태 증명 |
| **Replay Attack** | Nonce 재사용 | 이전 사용 증거 |

### 5.2 Fraud Proof 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FraudProofVerifier
 * @notice Fraud proof 검증 로직
 */
contract FraudProofVerifier {
    enum FraudType {
        InvalidSignature,
        DoubleSpending,
        InvalidAmount,
        InvalidToken,
        ReplayAttack
    }

    struct FraudProof {
        FraudType fraudType;
        bytes32 requestId;
        bytes evidence;
        bytes stateProof;
    }

    /**
     * @notice Fraud proof 검증
     */
    function verifyFraudProof(
        FraudProof calldata proof,
        bytes32 messageHash
    ) external view returns (bool isValid, string memory reason) {
        if (proof.fraudType == FraudType.InvalidSignature) {
            return _verifyInvalidSignature(proof, messageHash);
        } else if (proof.fraudType == FraudType.DoubleSpending) {
            return _verifyDoubleSpending(proof);
        } else if (proof.fraudType == FraudType.InvalidAmount) {
            return _verifyInvalidAmount(proof);
        } else if (proof.fraudType == FraudType.InvalidToken) {
            return _verifyInvalidToken(proof);
        } else if (proof.fraudType == FraudType.ReplayAttack) {
            return _verifyReplayAttack(proof);
        }

        return (false, "Unknown fraud type");
    }

    /**
     * @notice 잘못된 서명 증명
     */
    function _verifyInvalidSignature(
        FraudProof calldata proof,
        bytes32 messageHash
    ) internal view returns (bool, string memory) {
        bytes memory signature = proof.evidence;

        // MPC 서명 검증 시도
        bool isValidSig = bridgeValidator.verifyMPCSignature(
            messageHash,
            signature
        );

        if (!isValidSig) {
            return (true, "Invalid MPC signature");
        }

        return (false, "Signature is valid");
    }

    /**
     * @notice 이중 지출 증명
     */
    function _verifyDoubleSpending(
        FraudProof calldata proof
    ) internal view returns (bool, string memory) {
        // 이전 실행 기록 검색
        (bytes32 originalRequestId, uint256 executedAt) =
            abi.decode(proof.evidence, (bytes32, uint256));

        if (bridge.executedRequests(originalRequestId) &&
            originalRequestId == proof.requestId) {
            return (true, "Double spending detected");
        }

        return (false, "No double spending");
    }

    /**
     * @notice 금액 불일치 증명 (Cross-chain state proof)
     */
    function _verifyInvalidAmount(
        FraudProof calldata proof
    ) internal view returns (bool, string memory) {
        // Merkle proof로 소스 체인 상태 검증
        (
            bytes32 stateRoot,
            bytes memory merkleProof,
            uint256 claimedAmount,
            uint256 actualAmount
        ) = abi.decode(
            proof.stateProof,
            (bytes32, bytes, uint256, uint256)
        );

        // State root 검증 (Light client 또는 Oracle)
        require(
            _verifyStateRoot(stateRoot),
            "Invalid state root"
        );

        // Merkle proof 검증
        bool proofValid = MerkleProof.verify(
            merkleProof,
            stateRoot,
            keccak256(abi.encodePacked(proof.requestId, actualAmount))
        );

        if (proofValid && claimedAmount != actualAmount) {
            return (true, "Amount mismatch");
        }

        return (false, "Amount is correct");
    }
}
```

---

## 6. Rate Limiting

### 6.1 한도 설정

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Rate Limiting Strategy                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Per-Transaction Limits:                                                     │
│  ├─ Single TX Max: $1,000,000 (PoC: $100,000)                               │
│  └─ Requires additional approval above threshold                            │
│                                                                              │
│  Hourly Limits:                                                              │
│  ├─ Total Volume: $5,000,000 (PoC: $500,000)                                │
│  └─ Reset every hour on the hour                                            │
│                                                                              │
│  Daily Limits:                                                               │
│  ├─ Total Volume: $50,000,000 (PoC: $5,000,000)                             │
│  └─ Reset at 00:00 UTC                                                      │
│                                                                              │
│  Emergency Threshold:                                                        │
│  ├─ If hourly > 80% of limit → Alert                                        │
│  └─ If hourly > 95% of limit → Auto-pause                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Rate Limiter 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BridgeRateLimiter
 * @notice 브릿지 전송 속도 제한
 */
contract BridgeRateLimiter {
    struct RateLimitConfig {
        uint256 maxPerTx;
        uint256 hourlyLimit;
        uint256 dailyLimit;
        uint256 alertThreshold;      // 80%
        uint256 autoPauseThreshold;  // 95%
    }

    struct UsageTracker {
        uint256 hourlyUsed;
        uint256 dailyUsed;
        uint256 lastHourlyReset;
        uint256 lastDailyReset;
    }

    RateLimitConfig public config;
    mapping(address => UsageTracker) public tokenUsage;

    event RateLimitAlert(
        address indexed token,
        uint256 usage,
        uint256 limit,
        string alertType
    );

    event AutoPaused(address indexed token, string reason);

    function checkAndUpdateLimit(
        address token,
        uint256 amount
    ) external returns (bool allowed) {
        _resetIfNeeded(token);

        UsageTracker storage usage = tokenUsage[token];

        // Per-TX check
        require(amount <= config.maxPerTx, "Exceeds per-tx limit");

        // Hourly check
        uint256 newHourlyUsage = usage.hourlyUsed + amount;
        if (newHourlyUsage > config.hourlyLimit) {
            return false;
        }

        // Daily check
        uint256 newDailyUsage = usage.dailyUsed + amount;
        if (newDailyUsage > config.dailyLimit) {
            return false;
        }

        // Update usage
        usage.hourlyUsed = newHourlyUsage;
        usage.dailyUsed = newDailyUsage;

        // Alert checks
        _checkAlerts(token, newHourlyUsage);

        return true;
    }

    function _checkAlerts(address token, uint256 hourlyUsage) internal {
        uint256 usagePercent = (hourlyUsage * 100) / config.hourlyLimit;

        if (usagePercent >= config.autoPauseThreshold) {
            // Auto-pause
            _pauseToken(token);
            emit AutoPaused(token, "Hourly limit threshold exceeded");
        } else if (usagePercent >= config.alertThreshold) {
            emit RateLimitAlert(
                token,
                hourlyUsage,
                config.hourlyLimit,
                "Approaching hourly limit"
            );
        }
    }

    function _resetIfNeeded(address token) internal {
        UsageTracker storage usage = tokenUsage[token];

        // Hourly reset
        uint256 currentHour = block.timestamp / 1 hours;
        if (currentHour > usage.lastHourlyReset / 1 hours) {
            usage.hourlyUsed = 0;
            usage.lastHourlyReset = block.timestamp;
        }

        // Daily reset
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > usage.lastDailyReset / 1 days) {
            usage.dailyUsed = 0;
            usage.lastDailyReset = block.timestamp;
        }
    }

    function getRemainingLimit(
        address token
    ) external view returns (
        uint256 remainingHourly,
        uint256 remainingDaily
    ) {
        UsageTracker storage usage = tokenUsage[token];

        remainingHourly = config.hourlyLimit > usage.hourlyUsed
            ? config.hourlyLimit - usage.hourlyUsed
            : 0;

        remainingDaily = config.dailyLimit > usage.dailyUsed
            ? config.dailyLimit - usage.dailyUsed
            : 0;
    }
}
```

---

## 7. Guardian System

### 7.1 Guardian 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Guardian System                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Guardian Multisig: 3-of-5 for Emergency Actions                            │
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │Guardian │ │Guardian │ │Guardian │ │Guardian │ │Guardian │              │
│  │   1     │ │   2     │ │   3     │ │   4     │ │   5     │              │
│  │(Internal│ │(Internal│ │(External│ │(External│ │(External│              │
│  │  Team)  │ │  Team)  │ │ Partner)│ │ Partner)│ │ Partner)│              │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘              │
│       │          │          │          │          │                        │
│       └──────────┴──────────┼──────────┴──────────┘                        │
│                             ▼                                               │
│              ┌──────────────────────────┐                                   │
│              │   Guardian Multisig      │                                   │
│              │        (3-of-5)          │                                   │
│              └──────────────────────────┘                                   │
│                             │                                               │
│              ┌──────────────┼──────────────┐                               │
│              ▼              ▼              ▼                               │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐                           │
│        │Emergency │  │  Token   │  │  Config  │                           │
│        │  Pause   │  │ Blacklist│  │  Update  │                           │
│        └──────────┘  └──────────┘  └──────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Guardian 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BridgeGuardian
 * @notice 긴급 대응을 위한 Guardian 시스템
 */
contract BridgeGuardian {
    address[] public guardians;
    uint8 public constant THRESHOLD = 3;

    mapping(bytes32 => uint8) public actionApprovals;
    mapping(bytes32 => mapping(address => bool)) public hasApproved;

    enum ActionType {
        EmergencyPause,
        EmergencyUnpause,
        BlacklistToken,
        UnblacklistToken,
        UpdateConfig,
        RotateMPCKey
    }

    event ActionProposed(
        bytes32 indexed actionId,
        ActionType actionType,
        address proposer,
        bytes data
    );

    event ActionApproved(
        bytes32 indexed actionId,
        address approver,
        uint8 currentApprovals
    );

    event ActionExecuted(bytes32 indexed actionId, ActionType actionType);

    modifier onlyGuardian() {
        require(_isGuardian(msg.sender), "Not a guardian");
        _;
    }

    /**
     * @notice 긴급 정지 제안
     */
    function proposeEmergencyPause(
        string calldata reason
    ) external onlyGuardian returns (bytes32 actionId) {
        actionId = keccak256(abi.encodePacked(
            ActionType.EmergencyPause,
            reason,
            block.timestamp
        ));

        emit ActionProposed(
            actionId,
            ActionType.EmergencyPause,
            msg.sender,
            bytes(reason)
        );

        // 제안자의 첫 승인
        _approve(actionId, ActionType.EmergencyPause, bytes(reason));
    }

    /**
     * @notice 액션 승인
     */
    function approveAction(
        bytes32 actionId,
        ActionType actionType,
        bytes calldata data
    ) external onlyGuardian {
        _approve(actionId, actionType, data);
    }

    function _approve(
        bytes32 actionId,
        ActionType actionType,
        bytes memory data
    ) internal {
        require(!hasApproved[actionId][msg.sender], "Already approved");

        hasApproved[actionId][msg.sender] = true;
        actionApprovals[actionId]++;

        emit ActionApproved(actionId, msg.sender, actionApprovals[actionId]);

        // Threshold 도달 시 실행
        if (actionApprovals[actionId] >= THRESHOLD) {
            _executeAction(actionId, actionType, data);
        }
    }

    function _executeAction(
        bytes32 actionId,
        ActionType actionType,
        bytes memory data
    ) internal {
        if (actionType == ActionType.EmergencyPause) {
            bridge.pause();
        } else if (actionType == ActionType.EmergencyUnpause) {
            bridge.unpause();
        } else if (actionType == ActionType.BlacklistToken) {
            address token = abi.decode(data, (address));
            bridge.blacklistToken(token);
        } else if (actionType == ActionType.UpdateConfig) {
            (uint256 param, uint256 value) = abi.decode(data, (uint256, uint256));
            bridge.updateConfig(param, value);
        }

        emit ActionExecuted(actionId, actionType);
    }

    /**
     * @notice 즉시 정지 (단일 Guardian - 비상시에만)
     * @dev 24시간 내 다른 Guardian 승인 필요, 미승인 시 자동 해제
     */
    function instantPause() external onlyGuardian {
        bridge.pause();
        // Start 24h timer for confirmation
        pauseConfirmationDeadline = block.timestamp + 24 hours;
        pauseInitiator = msg.sender;

        emit InstantPause(msg.sender, pauseConfirmationDeadline);
    }
}
```

---

## 8. SecureBridge 메인 컨트랙트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SecureBridge
 * @notice MPC + Optimistic 검증 기반 보안 브릿지
 */
contract SecureBridge is ReentrancyGuard, Pausable {
    // Components
    IBridgeValidator public validator;
    IOptimisticVerifier public optimisticVerifier;
    IFraudProofVerifier public fraudVerifier;
    IBridgeRateLimiter public rateLimiter;
    IBridgeGuardian public guardian;

    // Token mappings
    mapping(address => address) public tokenMappings; // source => target
    mapping(address => bool) public blacklistedTokens;

    // Request tracking
    mapping(bytes32 => BridgeRequest) public requests;
    mapping(bytes32 => bool) public executedRequests;

    struct BridgeRequest {
        bytes32 id;
        address sender;
        address recipient;
        address sourceToken;
        address targetToken;
        uint256 amount;
        uint256 sourceChain;
        uint256 targetChain;
        uint256 timestamp;
        uint256 challengeDeadline;
        BridgeStatus status;
    }

    enum BridgeStatus {
        Pending,
        Approved,
        Challenged,
        Executed,
        Refunded,
        Cancelled
    }

    event TokensLocked(
        bytes32 indexed requestId,
        address indexed sender,
        address token,
        uint256 amount,
        uint256 targetChain
    );

    event TokensReleased(
        bytes32 indexed requestId,
        address indexed recipient,
        address token,
        uint256 amount
    );

    /**
     * @notice 토큰 잠금 (브릿지 시작)
     */
    function lockTokens(
        address token,
        uint256 amount,
        uint256 targetChain,
        address recipient
    ) external nonReentrant whenNotPaused returns (bytes32 requestId) {
        require(!blacklistedTokens[token], "Token blacklisted");
        require(tokenMappings[token] != address(0), "Token not supported");
        require(rateLimiter.checkAndUpdateLimit(token, amount), "Rate limit exceeded");

        // Generate request ID
        requestId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            token,
            amount,
            targetChain,
            block.timestamp,
            block.number
        ));

        require(requests[requestId].timestamp == 0, "Request exists");

        // Lock tokens
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Create request
        requests[requestId] = BridgeRequest({
            id: requestId,
            sender: msg.sender,
            recipient: recipient,
            sourceToken: token,
            targetToken: tokenMappings[token],
            amount: amount,
            sourceChain: block.chainid,
            targetChain: targetChain,
            timestamp: block.timestamp,
            challengeDeadline: 0, // Set on target chain
            status: BridgeStatus.Pending
        });

        emit TokensLocked(requestId, msg.sender, token, amount, targetChain);
    }

    /**
     * @notice 토큰 릴리즈 승인 (MPC 서명 후)
     */
    function approveRelease(
        bytes32 requestId,
        BridgeMessage calldata message,
        bytes calldata mpcSignature
    ) external nonReentrant whenNotPaused {
        require(!executedRequests[requestId], "Already executed");

        // Verify MPC signature
        require(
            validator.verifyMPCSignature(message, mpcSignature),
            "Invalid MPC signature"
        );

        // Submit to optimistic verifier
        uint256 deadline = optimisticVerifier.submitRequest(
            requestId,
            keccak256(abi.encode(message))
        );

        requests[requestId].challengeDeadline = deadline;
        requests[requestId].status = BridgeStatus.Approved;

        emit ReleaseApproved(requestId, deadline);
    }

    /**
     * @notice 토큰 릴리즈 실행 (Challenge period 종료 후)
     */
    function executeRelease(
        bytes32 requestId
    ) external nonReentrant whenNotPaused {
        BridgeRequest storage request = requests[requestId];

        require(request.status == BridgeStatus.Approved, "Not approved");
        require(!executedRequests[requestId], "Already executed");
        require(
            optimisticVerifier.canExecute(requestId),
            "Cannot execute yet"
        );

        executedRequests[requestId] = true;
        request.status = BridgeStatus.Executed;

        // Mint or release tokens
        _releaseTokens(request.recipient, request.targetToken, request.amount);

        emit TokensReleased(
            requestId,
            request.recipient,
            request.targetToken,
            request.amount
        );
    }

    /**
     * @notice Fraud proof로 요청 취소
     */
    function cancelWithFraudProof(
        bytes32 requestId,
        FraudProof calldata proof
    ) external {
        BridgeRequest storage request = requests[requestId];

        require(request.status == BridgeStatus.Approved, "Not approved");
        require(!executedRequests[requestId], "Already executed");

        (bool isValid, string memory reason) = fraudVerifier.verifyFraudProof(
            proof,
            keccak256(abi.encode(request))
        );

        require(isValid, reason);

        request.status = BridgeStatus.Cancelled;

        // Reward challenger
        _rewardChallenger(msg.sender);

        emit RequestCancelled(requestId, reason);
    }

    /**
     * @notice 환불 요청 (소스 체인)
     */
    function requestRefund(
        bytes32 requestId,
        bytes calldata cancellationProof
    ) external nonReentrant {
        BridgeRequest storage request = requests[requestId];

        require(request.sender == msg.sender, "Not sender");
        require(request.status == BridgeStatus.Pending, "Invalid status");

        // Verify cancellation from target chain
        require(_verifyCancellation(requestId, cancellationProof), "Invalid proof");

        request.status = BridgeStatus.Refunded;

        // Return tokens to sender
        IERC20(request.sourceToken).transfer(msg.sender, request.amount);

        emit RefundCompleted(requestId, msg.sender, request.amount);
    }
}
```

---

## 9. 모니터링 및 알림

### 9.1 모니터링 대시보드

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Bridge Monitoring Dashboard                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Real-time Metrics                     Alerts                               │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐      │
│  │ Pending Requests: 23        │      │ ⚠️ Rate limit at 78%        │      │
│  │ Daily Volume: $4.2M / $5M   │      │ ℹ️ MPC signer 3 latency     │      │
│  │ Hourly Volume: $380K / $500K│      │ ✅ All systems operational  │      │
│  │ Avg Challenge Time: 0.3s    │      │                             │      │
│  └─────────────────────────────┘      └─────────────────────────────┘      │
│                                                                              │
│  MPC Signer Status                     Recent Challenges                    │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐      │
│  │ Signer 1: ✅ Online (45ms)  │      │ 0x1234... Invalid Sig ❌    │      │
│  │ Signer 2: ✅ Online (52ms)  │      │ 0x5678... Double Spend ✅   │      │
│  │ Signer 3: ⚠️ Slow (230ms)   │      │ 0x9abc... Amount ❌        │      │
│  │ Signer 4: ✅ Online (67ms)  │      │                             │      │
│  │ Signer 5: ✅ Online (89ms)  │      │                             │      │
│  └─────────────────────────────┘      └─────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 알림 설정

| 이벤트 | 심각도 | 알림 채널 | 대응 |
|--------|--------|----------|------|
| Rate limit 80% | Warning | Slack, Email | 모니터링 강화 |
| Rate limit 95% | Critical | PagerDuty | 자동 정지 |
| MPC signer offline | Critical | PagerDuty | 수동 확인 |
| Challenge submitted | Info | Slack | 검토 |
| Fraud proof valid | Critical | PagerDuty | 즉시 조사 |
| Guardian action | Critical | All channels | 상황 공유 |

---

## 10. 배포 및 운영

### 10.1 배포 순서

```
1. BridgeValidator (MPC 검증)
2. OptimisticVerifier (Challenge 관리)
3. FraudProofVerifier (Fraud proof 검증)
4. BridgeRateLimiter (속도 제한)
5. BridgeGuardian (긴급 대응)
6. SecureBridge (메인 컨트랙트)
7. Token 매핑 설정
8. Rate limit 설정
9. Guardian 등록
10. MPC key 설정
```

### 10.2 운영 체크리스트

**일일 점검**:
- [ ] MPC signer 상태 확인
- [ ] Rate limit 사용량 검토
- [ ] Pending request 수 확인
- [ ] Challenge 현황 검토

**주간 점검**:
- [ ] MPC key rotation 검토
- [ ] Guardian 응답 시간 테스트
- [ ] 보안 로그 분석
- [ ] 성능 메트릭 검토

**월간 점검**:
- [ ] 전체 보안 감사
- [ ] Rate limit 임계값 조정 검토
- [ ] Guardian 구성 검토
- [ ] 재해 복구 테스트

---

## 11. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [03_Development_Roadmap.md](./03_Development_Roadmap.md) - 개발 로드맵

---

*문서 끝*
