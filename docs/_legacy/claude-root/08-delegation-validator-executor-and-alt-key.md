# 8. Validator/Executor를 통한 위임 실행과 대리 키 인증

## 8.1 위임 실행의 필요성

```mermaid
flowchart TB
    subgraph "전통 EOA"
        A["매번 소유자가 직접 서명"]
        B["자동화 불가"]
        C["24시간 대기해야 함"]
    end

    subgraph "Smart Account 위임 실행"
        D["세션 키로 제한된 자동 실행"]
        E["정기결제 자동화"]
        F["다중 서명자 분산 운영"]
    end

    A --> D
    B --> E
    C --> F
```

## 8.2 Validator 기반 서명 위임

### Validation Type과 서명 경로

```mermaid
flowchart TB
    A["UserOp 수신"] --> B{nonce에서 Validation Type 추출}

    B -->|"0x00 ROOT"| C["Root Validator<br/>최상위 권한 서명"]
    B -->|"0x00 7702"| D["EOA 직접 서명<br/>(7702 delegation)"]
    B -->|"0x01 VALIDATOR"| E["지정된 Validator<br/>플러그인 서명"]
    B -->|"0x02 PERMISSION"| F["Permission 기반<br/>(Signer + Policy)"]

    C --> G["validateUserOp()"]
    D --> H["_verify7702Signature()"]
    E --> I["validator.validateUserOp()"]
    F --> J["signer.checkUserOpSignature()<br/>+ policy.checkUserOpPolicy()"]
```

### Root Validator 위임

```solidity
// Root Validator 변경으로 서명 권한 위임
function changeRootValidator(
    ValidationId newRoot,
    IHook hook,
    bytes calldata validatorData,
    bytes calldata hookData
) external payable onlyEntryPointOrSelfOrRoot {
    _changeRootValidator(newRoot, hook, validatorData, hookData);
}
```

| 매개변수 | 설명 |
|---|---|
| `newRoot` | 새 Root Validator ID (validator 주소 + 타입) |
| `hook` | 연결할 Hook (없으면 address(0)) |
| `validatorData` | 새 validator 초기화 데이터 |
| `hookData` | hook 초기화 데이터 |

### 대리 Validator 추가

기존 rootValidator를 유지하면서 추가 Validator를 설치:

```mermaid
flowchart TB
    subgraph "계정의 Validator 구성"
        RV["Root Validator<br/>ECDSAValidator<br/>(소유자 키)"]
        V1["Validator 1<br/>WebAuthnValidator<br/>(패스키)"]
        V2["Validator 2<br/>SessionKeyValidator<br/>(세션 키)"]
    end

    subgraph "각 Validator에 허용된 Selector"
        RV --> S1["모든 함수"]
        V1 --> S2["execute, installModule"]
        V2 --> S3["execute (transfer만)"]
    end
```

## 8.3 Executor 기반 위임 실행

### Executor의 실행 경로

```mermaid
sequenceDiagram
    participant Ext as 외부 호출자
    participant Exec as Executor (설치된 모듈)
    participant Kernel as Kernel
    participant Target as 대상 컨트랙트

    Ext->>Exec: 1. 실행 요청 (서명 또는 직접 호출)
    Exec->>Exec: 2. 자체 검증 (세션키, 시간, 한도 등)
    Exec->>Kernel: 3. executeFromExecutor(execMode, executionCalldata)
    Kernel->>Kernel: 4. Executor 등록 여부 확인
    Kernel->>Kernel: 5. Hook preCheck (설정 시)
    Kernel->>Target: 6. 실제 호출 실행
    Target-->>Kernel: 7. 결과 반환
    Kernel->>Kernel: 8. Hook postCheck (설정 시)
    Kernel-->>Exec: 9. 결과 반환
```

### executeFromExecutor 구현 (Kernel.sol)

```solidity
function executeFromExecutor(
    ExecMode execMode,
    bytes calldata executionCalldata
) external payable returns (bytes[] memory returnData) {
    // 1. Executor 등록 확인
    if (!_isExecutorInstalled(msg.sender)) {
        revert InvalidExecutor();
    }

    // 2. Hook preCheck
    IHook hook = _getExecutorHook(msg.sender);
    bytes memory hookRet;
    if (address(hook) != HOOK_MODULE_NOT_INSTALLED) {
        hookRet = hook.preCheck(msg.sender, msg.value, msg.data);
    }

    // 3. 실행
    returnData = ExecLib._execute(execMode, executionCalldata);

    // 4. Hook postCheck
    if (hookRet.length > 0) {
        hook.postCheck(hookRet);
    }
}
```

## 8.4 SessionKeyExecutor 상세

### 세션 키 아키텍처

```mermaid
flowchart TB
    subgraph "Session Key 설정"
        A["세션 키 생성<br/>(임시 키쌍)"]
        B["유효 기간 설정<br/>validAfter ~ validUntil"]
        C["지출 한도 설정<br/>spendingLimit"]
        D["허용 대상 설정<br/>target + selector"]
    end

    subgraph "세션 키 실행"
        E["세션 키로 서명"]
        F["SessionKeyExecutor 호출"]
        G["검증: 시간, 한도, 대상"]
        H["Kernel.executeFromExecutor()"]
    end

    A --> B --> C --> D
    D --> E --> F --> G --> H
```

### Session Key 설정 구조

```solidity
struct SessionKeyConfig {
    address sessionKey;       // 세션 키 주소
    uint48 validAfter;        // 세션 시작 시간
    uint48 validUntil;        // 세션 만료 시간
    uint256 spendingLimit;    // 총 지출 한도 (wei)
    uint256 spentAmount;      // 현재까지 사용 금액
    uint256 nonce;            // 재생 방지 nonce
    bool isActive;            // 활성화 상태
}

struct Permission {
    address target;           // 호출 가능 컨트랙트
    bytes4 selector;          // 허용 함수 selector
    uint256 maxValue;         // 건당 최대 금액 (0=무제한)
    bool allowed;             // 허용 여부
}
```

### 실행 방법 비교

| 방법 | 함수 | 호출자 | 검증 방식 |
|---|---|---|---|
| 서명 기반 | `executeOnBehalf()` | 누구나 | 세션 키 서명 검증 |
| 직접 호출 | `executeAsSessionKey()` | 세션 키 소유자 | msg.sender == sessionKey |

### 세션 키 생명주기

```mermaid
flowchart LR
    A["addSessionKey()<br/>세션 생성"] --> B["Active<br/>실행 가능"]
    B --> C{만료 확인}
    C -->|"block.timestamp > validUntil"| D["만료<br/>실행 불가"]
    C -->|"아직 유효"| E{한도 확인}
    E -->|"spent >= limit"| F["한도 초과<br/>실행 불가"]
    E -->|"여유 있음"| G["실행"]
    B --> H["revokeSessionKey()<br/>명시적 취소"]
    H --> I["비활성<br/>실행 불가"]
```

## 8.5 Permission 기반 세분화 위임

### Permission = Signer + Policy 조합

```mermaid
flowchart TB
    subgraph "Permission ID: 0xABCD..."
        S["Signer Module<br/>(서명 검증)"]
        P1["Policy 1<br/>(시간 제한)"]
        P2["Policy 2<br/>(금액 제한)"]
        P3["Policy 3<br/>(대상 제한)"]
    end

    A["UserOp 수신<br/>nonce type = PERMISSION"] --> S
    S -->|서명 유효| P1
    P1 -->|통과| P2
    P2 -->|통과| P3
    P3 -->|통과| B["✅ 실행 허용"]

    S -->|서명 무효| C["❌ 거부"]
    P1 -->|실패| D["❌ PolicyFailed(0)"]
    P2 -->|실패| E["❌ PolicyFailed(1)"]
    P3 -->|실패| F["❌ PolicyFailed(2)"]
```

### Permission 설치 과정

```mermaid
sequenceDiagram
    participant Owner as 계정 소유자
    participant Kernel as Kernel
    participant Signer as Signer Module
    participant Policy as Policy Module

    Owner->>Kernel: 1. installModule(6, signerAddr, data)<br/>(Signer 설치)
    Kernel->>Signer: 2. onInstall(initData)

    Owner->>Kernel: 3. installModule(5, policy1Addr, data)<br/>(Policy 1 설치)
    Kernel->>Policy: 4. onInstall(initData)

    Owner->>Kernel: 5. installModule(5, policy2Addr, data)<br/>(Policy 2 설치)
    Kernel->>Policy: 6. onInstall(initData)

    Note over Kernel: Permission = Signer + [Policy1, Policy2]<br/>permissionId로 식별
```

### PassFlag 제어

```solidity
// Permission 검증 시 skip 플래그
PassFlag constant SKIP_USEROP = PassFlag.wrap(0x0001);
// → UserOp 정책 검사 생략 (서명 정책만 적용)

PassFlag constant SKIP_SIGNATURE = PassFlag.wrap(0x0002);
// → 서명 정책 검사 생략 (UserOp 정책만 적용)
```

## 8.6 대리 키 인증 (Alternative Key Authorization)

### 대리 키의 개념

```mermaid
flowchart TB
    subgraph "EOA 소유자 키"
        PK["Private Key<br/>(최고 권한)"]
    end

    subgraph "대리 키 (Alternative Keys)"
        WA["WebAuthn Key<br/>(패스키/생체)"]
        SK["Session Key<br/>(임시 키)"]
        MK["Manager Key<br/>(관리자 키)"]
        BK["Backup Key<br/>(복구 키)"]
    end

    PK -->|"rootValidator 또는<br/>7702 서명"| A[최고 권한 작업]
    WA -->|"WebAuthnValidator"| B[일반 트랜잭션]
    SK -->|"SessionKeyExecutor"| C[제한된 자동 실행]
    MK -->|"MultiSigValidator"| D[공동 승인 작업]
    BK -->|"WeightedECDSA"| E[계정 복구]
```

### 키 유형별 설정

| 키 유형 | 모듈 | 권한 범위 | 유효 기간 |
|---|---|---|---|
| EOA Private Key | 7702 직접 / ECDSA Root | 무제한 | 영구 |
| WebAuthn Key | WebAuthnValidator | 설정된 selector | 영구 (패스키 수명) |
| Session Key | SessionKeyExecutor | 특정 target+selector | 제한 (시간+한도) |
| Guardian Key | WeightedECDSAValidator | 복구/변경 | 영구 (가중치 제한) |
| Sub-account Key | Permission (Signer+Policy) | Policy에 의해 제한 | Policy 규칙에 따름 |

### WebAuthn 대리 키 설정

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Browser as 브라우저
    participant Kernel as Kernel
    participant WA as WebAuthnValidator

    User->>Browser: 1. 패스키 등록 요청
    Browser->>Browser: 2. 디바이스 생체인증
    Browser->>Browser: 3. P-256 키쌍 생성
    Browser-->>User: 4. 공개키 반환

    User->>Kernel: 5. installModule(1, webAuthnAddr, publicKey)
    Kernel->>WA: 6. onInstall(publicKey)

    User->>Kernel: 7. grantAccess(webAuthnId, 'execute', true)

    Note over Kernel: 이제 패스키로 트랜잭션 서명 가능
```

### Guardian 기반 계정 복구

```mermaid
flowchart TB
    subgraph "WeightedECDSA Guardian 설정"
        G1["Guardian A<br/>weight: 3"]
        G2["Guardian B<br/>weight: 2"]
        G3["Guardian C<br/>weight: 1"]
        TH["Threshold: 4"]
    end

    subgraph "복구 시나리오"
        A["소유자 키 분실"]
        A --> B["Guardian A + B 서명<br/>(weight 3+2=5 >= 4)"]
        B --> C["rootValidator 변경<br/>(새 소유자 키 설정)"]
    end

    subgraph "일반 사용"
        D["소유자만으로 실행<br/>(rootValidator)"]
    end
```

### 복구 흐름 상세

```mermaid
sequenceDiagram
    participant G1 as Guardian A
    participant G2 as Guardian B
    participant WV as WeightedECDSAValidator
    participant Kernel as Kernel

    G1->>WV: 1. 복구 제안 생성<br/>(새 rootValidator 정보)
    WV->>WV: 2. Proposal 저장

    G2->>WV: 3. 제안 승인 (서명)
    WV->>WV: 4. weight 합산 확인

    alt weight >= threshold
        WV->>WV: 5. delay 시작 (설정된 시간)
        Note over WV: 대기 시간 동안 veto 가능
        WV->>Kernel: 6. changeRootValidator(newRoot)
        Kernel->>Kernel: 7. 새 rootValidator 설정
    else weight < threshold
        WV-->>G2: 추가 서명 필요
    end
```

## 8.7 EIP-7702 + Validator 위임 조합

### 이중 서명 체계

```mermaid
flowchart TB
    subgraph "Layer 1: EIP-7702"
        A["EOA Private Key"]
        A --> B["7702 Authorization 서명"]
        B --> C["Kernel delegate 설정"]
    end

    subgraph "Layer 2: Validator"
        C --> D["Root: ECDSAValidator<br/>(같은 EOA 키 또는 다른 키)"]
        C --> E["추가: WebAuthnValidator"]
        C --> F["추가: SessionKeyValidator"]
    end

    subgraph "Layer 3: Permission"
        C --> G["Permission 1:<br/>Signer + [Policy, Policy]"]
        C --> H["Permission 2:<br/>Signer + [Policy]"]
    end
```

### 키 분리 전략

| 전략 | EOA 키 용도 | Root Validator 키 | 장점 |
|---|---|---|---|
| 동일 키 | 7702 + Root | EOA 키 = Root | 단순, 호환성 |
| 분리 | 7702만 | 별도 키 (콜드월렛) | 보안 강화 |
| Guardian | 7702만 | MultiSig/Weighted | 최고 보안, 복구 가능 |

## 8.8 실전 위임 시나리오

### 시나리오: 게임 dApp 자동실행

```mermaid
flowchart TB
    A["게임 dApp에 세션키 발급"]
    A --> B["SessionKeyExecutor 설치"]
    B --> C["Permission 설정:<br/>- target: GameContract만<br/>- selector: play(), claim()만<br/>- 시간: 24시간<br/>- 한도: 0.1 ETH"]
    C --> D["게임이 세션키로<br/>자동 실행"]

    D --> E{24시간 경과?}
    E -->|Yes| F["세션 만료<br/>재발급 필요"]
    E -->|No| G{한도 초과?}
    G -->|Yes| H["실행 차단"]
    G -->|No| I["계속 실행"]
```

### 시나리오: 기업 급여 자동 지급

```mermaid
flowchart TB
    A["HR 관리자 키 설정"]
    A --> B["RecurringPaymentExecutor 설치"]
    B --> C["월급 결제 설정:<br/>- recipient: 직원 주소<br/>- amount: 정해진 금액<br/>- interval: MONTHLY<br/>- token: USDC"]
    C --> D["매월 자동 실행<br/>(누구나 트리거 가능)"]
```

## 8.9 비즈니스 자동화 시나리오

### 이커머스 결제 자동화

```mermaid
flowchart LR
    subgraph "설정"
        A["SessionKeyExecutor<br/>+ SpendingLimitHook"]
    end

    subgraph "운영"
        B["사용자 결제 요청"] --> C["세션키로 USDC 전송"]
        C --> D["Hook: 일일 한도 확인"]
        D --> E["자동 승인/차단"]
    end

    subgraph "수익 모델"
        F["Per-TX 수수료<br/>0.1~0.5%"]
    end

    A --> B
    E --> F
```

| 구성 요소 | 모듈 | 파라미터 |
|---|---|---|
| 결제 키 | SessionKeyExecutor | target: 결제 컨트랙트, validUntil: 구매 세션 |
| 지출 한도 | SpendingLimitHook | USDC 일일 1,000, 건당 500 |
| 감사 로그 | AuditHook | 모든 결제 기록 온체인 |
| **수익**: per-tx 수수료 (0.1~0.5%) 또는 월정액 SaaS | | |

### DeFi 자동 리밸런싱

```mermaid
flowchart LR
    subgraph "설정"
        A["SessionKeyExecutor<br/>+ HealthFactorHook"]
    end

    subgraph "운영"
        B["봇이 포트폴리오 모니터링"] --> C["리밸런싱 필요 감지"]
        C --> D["세션키로 DEX swap 실행"]
        D --> E["Hook: target/amount 검증"]
    end

    subgraph "수익 모델"
        F["성과 보수<br/>수익의 5~20%"]
    end

    A --> B
    E --> F
```

| 구성 요소 | 모듈 | 파라미터 |
|---|---|---|
| 자동화 키 | SessionKeyExecutor | targets: [Uniswap, Aave], validUntil: 30일 |
| 건전성 확인 | HealthFactorHook | minHealthFactor: 1.5 (청산 방지) |
| 지출 한도 | SpendingLimitHook | 일일 포트폴리오 10% 이내 |
| **수익**: 성과 보수 (수익의 5~20%) 또는 per-rebalance 수수료 | | |

### 기업 급여 + 감사 시스템

```mermaid
flowchart LR
    subgraph "설정"
        A["RecurringPaymentExecutor<br/>+ AuditHook<br/>+ WeightedECDSAValidator"]
    end

    subgraph "운영"
        B["매월 자동 실행 트리거"] --> C["급여 USDC 지급"]
        C --> D["AuditHook: 거래 기록"]
        D --> E["월간 보고서 생성"]
    end

    subgraph "수익 모델"
        F["SaaS 수수료<br/>월정액 + 인원당"]
    end

    A --> B
    E --> F
```

| 구성 요소 | 모듈 | 파라미터 |
|---|---|---|
| 급여 자동화 | RecurringPaymentExecutor | recipients: 직원 목록, interval: MONTHLY |
| 다중 승인 | WeightedECDSAValidator | CFO(60) + HR(40), threshold: 80 |
| 감사 추적 | AuditHook | 모든 급여 지급 이벤트 기록 |
| 지출 통제 | SpendingLimitHook | 월 급여 총액 한도 |
| **수익**: SaaS 구독 (월정액 + 인원당 과금) | | |

---

## 8.10 세션 키 서비스 설계 패턴

### 패턴 1: Time-boxed (게임/소셜)

```
┌─────────────────────────────────────────┐
│ Time-boxed Session Key                  │
├─────────────┬───────────────────────────┤
│ 유효 기간    │ 1~24시간                   │
│ 대상 제한    │ 특정 게임 컨트랙트           │
│ 가치 제한    │ 매우 낮음 (0.01 ETH)        │
│ 모듈 조합    │ SessionKey + PolicyHook     │
│ 적합 서비스  │ 게임, 소셜 dApp             │
│ 가스 비용    │ 설치 ~200K gas              │
│ 보안 수준    │ 중 (시간 제한이 핵심)         │
└─────────────┴───────────────────────────┘
```

### 패턴 2: Budget-controlled (DeFi)

```
┌─────────────────────────────────────────┐
│ Budget-controlled Session Key           │
├─────────────┬───────────────────────────┤
│ 유효 기간    │ 7~30일                     │
│ 대상 제한    │ 승인된 DEX/Lending 프로토콜   │
│ 가치 제한    │ 일일/주간 예산 기반           │
│ 모듈 조합    │ SessionKey + SpendingLimit  │
│              │ + HealthFactorHook         │
│ 적합 서비스  │ DeFi 자동화, 봇              │
│ 가스 비용    │ 설치 ~350K gas              │
│ 보안 수준    │ 높음 (예산 + 건전성 체크)      │
└─────────────┴───────────────────────────┘
```

### 패턴 3: Approval-gated (기업)

```
┌─────────────────────────────────────────┐
│ Approval-gated Session Key              │
├─────────────┬───────────────────────────┤
│ 유효 기간    │ 무기한 (권한으로 관리)        │
│ 대상 제한    │ 내부 컨트랙트 + 승인 목록     │
│ 가치 제한    │ 다중 서명 승인 필요           │
│ 모듈 조합    │ WeightedECDSA + SessionKey  │
│              │ + AuditHook + SpendingLimit │
│ 적합 서비스  │ 기업 재무, DAO               │
│ 가스 비용    │ 설치 ~500K gas              │
│ 보안 수준    │ 최고 (다중 서명 + 감사)        │
└─────────────┴───────────────────────────┘
```

### 패턴 비교 요약

| 항목 | Time-boxed | Budget-controlled | Approval-gated |
|---|---|---|---|
| 대상 | 게임/소셜 | DeFi | 기업/DAO |
| 유효 기간 | 시간 단위 | 일/주 단위 | 무기한 |
| 핵심 제한 | 시간 | 예산 | 승인 |
| 모듈 수 | 2개 | 3개 | 4개 |
| 설치 가스 | ~200K | ~350K | ~500K |
| 수익 모델 | 무료/광고 | 성과 보수 | SaaS |

---

> **핵심 메시지**: ERC-7579의 Validator와 Executor 조합으로 "누가(Signer), 무엇을(Policy), 어떻게(Executor)" 실행할 수 있는지 세밀하게 제어합니다. EOA 키는 최고 권한으로 보존하면서, 대리 키로 일상 운영을 자동화하세요.
