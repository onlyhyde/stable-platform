# StableNet 제품 요구사항 명세서 (PRD)

> **문서 버전**: 1.0
> **작성일**: 2025-01-09
> **작성자**: CTO Office
> **상태**: Draft for Review

---

## 1. 제품 개요

### 1.1 제품 비전
StableNet은 원화(KRW) 기반 L1 블록체인으로, 일반 사용자가 암호화폐 전문 지식 없이도 원화 스테이블코인을 실생활에서 사용할 수 있게 하는 플랫폼입니다.

### 1.2 문제 정의

| 기존 문제 | StableNet 해결책 |
|----------|-----------------|
| 가스비를 위해 별도 암호화폐 필요 | KRW로 가스비 직접 지불 |
| 스테이블코인 신뢰성 불확실 | 엄격한 Minter 시스템, Proof of Reserve |
| 복잡한 지갑 주소 | QR 코드 기반 간편 결제 |
| 거래 내역 공개 | Secret Account로 프라이버시 보호 |
| 해킹 시 대응 불가 | 즉시 블랙리스팅, 계정 동결 |
| 느린 결제 속도 | 1초 블록 완결성 |
| 네트워크 혼잡 시 지연 | Authorized Account 우선 처리 |

### 1.3 목표 사용자

| 사용자 유형 | 설명 | 주요 요구사항 |
|------------|------|-------------|
| **일반 사용자** | 결제, 송금 사용 | 간편한 UX, 빠른 처리, 프라이버시 |
| **Minter (금융기관)** | 스테이블코인 발행/소각 | 안정적 시스템, 규제 준수, 감사 기능 |
| **가맹점** | 결제 수령 | 즉시 정산, 낮은 수수료, 안정적 처리 |
| **개발자** | DApp 개발 | EVM 호환, 문서, SDK |
| **규제 기관** | 모니터링, 감독 | 투명성, 조회 기능, 긴급 조치 |

---

## 2. 기능 요구사항

### 2.1 Core Blockchain (PRD-CORE)

#### PRD-CORE-001: WBFT 합의 알고리즘
```yaml
ID: PRD-CORE-001
Title: WBFT 합의 알고리즘 구현
Priority: P0 (Critical)
Status: Planned

Description: |
  1초 블록 타임과 1블록 완결성을 제공하는 WBFT 합의 알고리즘 구현

Requirements:
  Functional:
    - FR-001: 블록 생성 주기 1000ms ± 50ms
    - FR-002: 1블록 완결성 (finality)
    - FR-003: 비잔틴 장애 허용 (n ≥ 3f + 1)
    - FR-004: 검증자 노드 동적 추가/제거
    - FR-005: 블록 생성 보상 없음 (No Inflation)

  Non-Functional:
    - NFR-001: 처리량 ≥ 3,000 TPS
    - NFR-002: 노드 장애 복구 < 10초
    - NFR-003: 네트워크 파티션 복구 < 30초

Acceptance_Criteria:
  - AC-001: 100개 연속 블록 평균 생성 시간 1000ms ± 50ms
  - AC-002: 3000 TPS 부하 테스트 30분 안정 운영
  - AC-003: 1/3 노드 장애 시 합의 지속
  - AC-004: 검증자 변경 후 합의 정상 동작

Dependencies:
  - go-ethereum v1.13+
  - QBFT 구현체

Risks:
  - 네트워크 지연으로 인한 블록 타임 미달
  - 검증자 수 증가 시 합의 지연
```

#### PRD-CORE-002: Native KRW Coin
```yaml
ID: PRD-CORE-002
Title: Native KRW 코인 시스템
Priority: P0 (Critical)
Status: Planned

Description: |
  원화 스테이블코인을 네이티브 코인으로 사용하며, ERC20 호환 래퍼 제공

Requirements:
  Functional:
    - FR-001: 네이티브 코인으로 KRW 스테이블코인 사용
    - FR-002: NativeCoinAdapter를 통한 ERC20 인터페이스 제공
    - FR-003: 모든 전송에 Transfer 이벤트 로깅
    - FR-004: wrap/unwrap 기능 (Native ↔ ERC20)

  Non-Functional:
    - NFR-001: wrap/unwrap 가스비 < 50,000 gas
    - NFR-002: 잔액 조회 지연 < 10ms

Acceptance_Criteria:
  - AC-001: Native → ERC20 → Native 변환 후 잔액 일치
  - AC-002: Transfer 이벤트 100% 기록
  - AC-003: 모든 ERC20 함수 정상 동작

Dependencies:
  - PRD-CORE-001
```

#### PRD-CORE-003: 수수료 체계
```yaml
ID: PRD-CORE-003
Title: 안정적 수수료 체계
Priority: P0 (Critical)
Status: Planned

Description: |
  평상시 1원 수수료, 혼잡 시 동적 조정되는 안정적 수수료 체계

Requirements:
  Functional:
    - FR-001: 기본 트랜잭션 수수료 1원 (평상시)
    - FR-002: 블록 혼잡 시 BaseFee 자동 증가
    - FR-003: 마이너의 Priority Fee 단독 인상 불가
    - FR-004: 수수료 상한선 설정 (100원)

  Non-Functional:
    - NFR-001: 수수료 계산 오버헤드 < 1ms
    - NFR-002: 수수료 예측 정확도 > 95%

Acceptance_Criteria:
  - AC-001: 정상 상태에서 기본 전송 수수료 1원
  - AC-002: 80% 블록 사용률에서 BaseFee 증가 시작
  - AC-003: DoS 공격 시 수수료 증가로 방어
```

### 2.2 Minter System (PRD-MINTER)

#### PRD-MINTER-001: Minter 등록/관리
```yaml
ID: PRD-MINTER-001
Title: Minter 등록 및 관리 시스템
Priority: P0 (Critical)
Status: Planned

Description: |
  KYC를 통과한 금융기관을 Minter로 등록하고 관리하는 시스템

Requirements:
  Functional:
    - FR-001: Minter 등록 신청 기능
    - FR-002: KYC 검증 프로세스 (Certik Skynet 연동)
    - FR-003: 신용도 평가 연동
    - FR-004: AML 체크 프로세스
    - FR-005: Minter 상태 관리 (Pending, Active, Suspended, Revoked)
    - FR-006: Mint 한도 설정 및 관리
    - FR-007: Minter 정보 조회 API

  Non-Functional:
    - NFR-001: 등록 처리 시간 < 24시간 (자동화 부분)
    - NFR-002: API 응답 시간 < 100ms

Acceptance_Criteria:
  - AC-001: KYC 미통과 기관 등록 불가
  - AC-002: 상태 변경 시 이벤트 발생 및 알림
  - AC-003: 한도 초과 발행 시 거부

User_Stories:
  - US-001: |
      As a 금융기관 관리자
      I want to Minter로 등록 신청
      So that 원화 스테이블코인을 발행할 수 있다

  - US-002: |
      As a 운영자
      I want to Minter 상태를 관리
      So that 문제 발생 시 즉시 정지할 수 있다
```

#### PRD-MINTER-002: 발행/소각 프로세스
```yaml
ID: PRD-MINTER-002
Title: 스테이블코인 발행/소각 프로세스
Priority: P0 (Critical)
Status: Planned

Description: |
  원화 입금 확인 후 스테이블코인 발행, 출금 요청 시 소각하는 프로세스

Requirements:
  Functional:
    # 발행 (Mint)
    - FR-001: 원화 입금 알림 수신 (Banking API)
    - FR-002: 자금 출처 검사 (SoF)
    - FR-003: Governance 다중 승인 (GovMasterMinter, GovMinter)
    - FR-004: Proof of Reserve 온체인 기록
    - FR-005: 스테이블코인 발행 트랜잭션 생성

    # 소각 (Burn)
    - FR-006: Minter의 소각 요청
    - FR-007: 소각 트랜잭션 처리
    - FR-008: 원화 출금 트리거

    # 추적성
    - FR-009: 모든 발행/소각 이력 기록
    - FR-010: 입금 TX 해시와 발행 TX 연결

  Non-Functional:
    - NFR-001: 발행 처리 시간 < 5분 (정상 케이스)
    - NFR-002: 동시 발행 요청 처리 > 100/분

Acceptance_Criteria:
  - AC-001: 입금액과 발행액 1:1 일치
  - AC-002: 모든 발행에 Proof of Reserve 첨부
  - AC-003: 소각 후 총 발행량 정확히 감소
  - AC-004: 감사 로그에 전체 이력 기록

Business_Rules:
  - BR-001: Minter만 발행/소각 가능
  - BR-002: 일반 사용자는 직접 출금(소각) 불가
  - BR-003: 발행 한도 초과 시 자동 거부
  - BR-004: 블랙리스트 계정으로 발행 불가
```

### 2.3 Governance (PRD-GOV)

#### PRD-GOV-001: 4-Layer Governance
```yaml
ID: PRD-GOV-001
Title: 4단계 거버넌스 시스템
Priority: P0 (Critical)
Status: Planned

Description: |
  GovCouncil, GovValidator, GovMasterMinter, GovMinter 4단계 거버넌스

Requirements:
  Functional:
    # GovCouncil
    - FR-001: 최상위 의사결정 기구
    - FR-002: 프로토콜 파라미터 변경 권한
    - FR-003: 긴급 정지 발동 권한
    - FR-004: 2/3 이상 정족수 투표

    # GovValidator
    - FR-005: 검증자 노드 관리
    - FR-006: 검증자 추가/제거
    - FR-007: 네트워크 파라미터 조정
    - FR-008: 과반수 투표

    # GovMasterMinter
    - FR-009: Minter 총괄 관리
    - FR-010: Minter 등록 승인
    - FR-011: Mint 한도 설정
    - FR-012: 과반수 투표

    # GovMinter
    - FR-013: 발행/소각 실행
    - FR-014: 예치금 증명 제출
    - FR-015: Master Minter 승인 필요

  Non-Functional:
    - NFR-001: 제안서 투표 기간: 7일 (기본)
    - NFR-002: 긴급 투표 기간: 24시간
    - NFR-003: 투표 집계 지연 < 1분

Acceptance_Criteria:
  - AC-001: 권한 계층 구조 정상 동작
  - AC-002: 정족수 미달 시 제안 자동 기각
  - AC-003: Time-lock 후 실행
  - AC-004: 권한 없는 실행 시도 거부
```

### 2.4 Security (PRD-SEC)

#### PRD-SEC-001: Blacklist 시스템
```yaml
ID: PRD-SEC-001
Title: Blacklist 관리 시스템
Priority: P0 (Critical)
Status: Planned

Description: |
  위험 계정을 즉시 동결하고 관리하는 블랙리스트 시스템

Requirements:
  Functional:
    - FR-001: 계정 블랙리스트 등록
    - FR-002: 즉시 계정 동결 (전송 불가)
    - FR-003: 블랙리스트 사유 기록
    - FR-004: 연관 계정 일괄 등록
    - FR-005: 블랙리스트 해제 (Governance 승인)
    - FR-006: Chainalysis 연동 자동 등록
    - FR-007: Certik Skynet 연동

  Non-Functional:
    - NFR-001: 등록 후 적용 시간 < 1초
    - NFR-002: 블랙리스트 조회 < 1ms
    - NFR-003: 대량 등록 처리 > 1000개/초

Acceptance_Criteria:
  - AC-001: 블랙리스트 계정 전송 시도 즉시 거부
  - AC-002: 블랙리스트 계정으로 수신 불가
  - AC-003: 해제 후 정상 거래 가능
  - AC-004: 모든 변경 이력 감사 로그 기록

Integration:
  - Chainalysis KYT API
  - Certik Skynet API
```

#### PRD-SEC-002: Authorized Account
```yaml
ID: PRD-SEC-002
Title: Authorized Account 우선처리 시스템
Priority: P1 (High)
Status: Planned

Description: |
  네트워크 혼잡 시에도 인증된 계정의 트랜잭션을 우선 처리

Requirements:
  Functional:
    - FR-001: Authorized Account 등록
    - FR-002: 우선순위 레벨 설정 (1-10)
    - FR-003: 블록 패킹 시 우선 포함
    - FR-004: Minter 자동 Authorized 부여
    - FR-005: 권한 해제 기능

  Non-Functional:
    - NFR-001: 혼잡 시 우선 처리 보장 > 99%
    - NFR-002: 일반 TX 불이익 최소화 (< 20% 지연)

Acceptance_Criteria:
  - AC-001: 90% 블록 사용률에서 Authorized TX 우선 포함
  - AC-002: 우선순위 레벨에 따른 정렬
  - AC-003: 권한 없는 계정은 일반 처리
```

### 2.5 Bridge (PRD-BRIDGE)

#### PRD-BRIDGE-001: Native Bridge
```yaml
ID: PRD-BRIDGE-001
Title: Native Bridge 프로토콜
Priority: P1 (High)
Status: Planned

Description: |
  Burn and Mint 방식의 크로스체인 브릿지

Requirements:
  Functional:
    - FR-001: Bridge Out (StableNet → 타체인)
      - Burn TX 생성
      - 타체인에 Mint 요청
    - FR-002: Bridge In (타체인 → StableNet)
      - 타체인 Burn 확인
      - StableNet에 Mint
    - FR-003: Relayer 노드 다중화 (3-of-5)
    - FR-004: 지원 체인: Ethereum, Base, Arbitrum, Tron
    - FR-005: 브릿지 수수료 설정
    - FR-006: 최소/최대 브릿지 금액 설정
    - FR-007: 긴급 정지 기능

  Non-Functional:
    - NFR-001: 브릿지 완료 시간 < 30분 (체인별 상이)
    - NFR-002: 실패 시 환불 처리 < 24시간
    - NFR-003: Relayer 가용성 > 99.9%

Acceptance_Criteria:
  - AC-001: 총 발행량 불변 (StableNet + 모든 브릿지)
  - AC-002: 양방향 전송 성공률 > 99.9%
  - AC-003: 실패 시 원본 체인에서 환불
  - AC-004: 블랙리스트 계정 브릿지 거부

Security_Requirements:
  - SR-001: Relayer Threshold Signature (3-of-5)
  - SR-002: Finality 대기 후 처리
  - SR-003: Replay Attack 방지
  - SR-004: Rate Limiting
```

### 2.6 Wallet System (PRD-WALLET)

#### PRD-WALLET-001: Normal Account
```yaml
ID: PRD-WALLET-001
Title: Normal Account (일반 지갑)
Priority: P0 (Critical)
Status: Planned

Description: |
  표준 EOA 기반 탈중앙 지갑

Requirements:
  Functional:
    - FR-001: Private Key / Mnemonic 생성
    - FR-002: 잔액 조회
    - FR-003: 전송 기능
    - FR-004: 트랜잭션 이력 조회
    - FR-005: DApp 연동 (WalletConnect)
    - FR-006: QR 코드 송금
    - FR-007: 수취인 별명 표시
    - FR-008: 정기 결제 설정

  Non-Functional:
    - NFR-001: 지갑 생성 < 1초
    - NFR-002: 잔액 조회 < 500ms
    - NFR-003: 전송 확인 < 2초

Acceptance_Criteria:
  - AC-001: Mnemonic으로 복구 성공
  - AC-002: MetaMask 등 외부 지갑 호환
  - AC-003: 모든 DApp 연동 정상
```

#### PRD-WALLET-002: Smart Account (EIP-7702)
```yaml
ID: PRD-WALLET-002
Title: Smart Account (EIP-7702)
Priority: P1 (High)
Status: Planned

Description: |
  EIP-7702 기반 스마트 계정으로 가스비 대납, 계정 복구 등 지원

Requirements:
  Functional:
    - FR-001: EIP-7702 Authorization
    - FR-002: 가스비 대납 (Paymaster)
    - FR-003: 외부 토큰으로 가스비 지불 (USDC, USDT)
    - FR-004: Password 기반 접근
    - FR-005: 2FA 지원
    - FR-006: Sub Account 생성 (권한 제한)
    - FR-007: 키 분실 복구

  Non-Functional:
    - NFR-001: 가스비 대납 오버헤드 < 10%
    - NFR-002: 복구 시간 < 24시간 (Time-lock)

Acceptance_Criteria:
  - AC-001: ETH 없이 트랜잭션 전송 성공
  - AC-002: Sub Account 권한 범위 내 동작
  - AC-003: 복구 프로세스 완료 후 정상 사용

User_Stories:
  - US-001: |
      As a 일반 사용자
      I want to 비밀번호로 지갑 접근
      So that Private Key 관리 없이 사용할 수 있다

  - US-002: |
      As a 카드사
      I want to 고객의 가스비 대납
      So that 고객이 편리하게 서비스 이용
```

#### PRD-WALLET-003: Secret Account (ERC-5564)
```yaml
ID: PRD-WALLET-003
Title: Secret Account (프라이버시 계정)
Priority: P2 (Medium)
Status: Planned

Description: |
  ERC-5564 Stealth Address 기반 프라이버시 보호 계정

Requirements:
  Functional:
    - FR-001: Stealth Address 생성
    - FR-002: View Key 등록
    - FR-003: 비밀 송금 (배치 처리)
    - FR-004: 잔액 분해 및 재구성
    - FR-005: Normal Account에서 입금
    - FR-006: Normal Account로 출금
    - FR-007: 규제 기관 조회 API (백도어)

  Non-Functional:
    - NFR-001: 배치 처리 주기 < 10초
    - NFR-002: 최소 혼합 수 3개 (프라이버시)
    - NFR-003: 수신 알림 < 30초

Acceptance_Criteria:
  - AC-001: 체인 분석으로 송수신자 추적 불가
  - AC-002: 규제 기관은 전체 이력 조회 가능
  - AC-003: 입출금 흐름 정상 동작

Privacy_Requirements:
  - PR-001: 배치 내 최소 3건 혼합
  - PR-002: 금액 분해로 패턴 숨김
  - PR-003: Stealth Address 추적 방지
```

### 2.7 External Integration (PRD-EXT)

#### PRD-EXT-001: Chainalysis 연동
```yaml
ID: PRD-EXT-001
Title: Chainalysis KYT 연동
Priority: P1 (High)
Status: Planned

Description: |
  Chainalysis의 KYT (Know Your Transaction) 서비스 연동

Requirements:
  Functional:
    - FR-001: 실시간 트랜잭션 모니터링
    - FR-002: 위험 점수 수신
    - FR-003: 고위험 거래 자동 알림
    - FR-004: 블랙리스트 자동 연동
    - FR-005: 조사 도구 (Reactor) 연동

  Non-Functional:
    - NFR-001: 분석 결과 수신 < 5초
    - NFR-002: API 가용성 > 99.9%

Acceptance_Criteria:
  - AC-001: 위험 거래 감지 시 알림 발생
  - AC-002: 고위험 주소 자동 블랙리스트
  - AC-003: 감사 로그에 분석 결과 기록
```

#### PRD-EXT-002: Certik 연동
```yaml
ID: PRD-EXT-002
Title: Certik Skynet 연동
Priority: P1 (High)
Status: Planned

Description: |
  Certik의 Skynet 보안 모니터링 및 Proof of Reserve 서비스 연동

Requirements:
  Functional:
    - FR-001: 기업 보안 평가
    - FR-002: 스마트 컨트랙트 모니터링
    - FR-003: Proof of Reserve 검증
    - FR-004: 이상 탐지 알림

  Non-Functional:
    - NFR-001: PoR 검증 주기: 일 1회
    - NFR-002: 이상 탐지 알림 < 1분

Acceptance_Criteria:
  - AC-001: Minter 등록 시 Certik 평가 반영
  - AC-002: PoR 불일치 시 자동 알림
  - AC-003: 컨트랙트 위협 감지 시 알림
```

---

## 3. 비기능 요구사항

### 3.1 성능 (Performance)

```yaml
Performance_Requirements:
  Throughput:
    - TPS: ">= 3,000 (simple transfer)"
    - API_RPS: ">= 10,000"
    - Bridge_TPS: ">= 100"

  Latency:
    - Block_Time: "1000ms ± 50ms"
    - TX_Finality: "1 block"
    - API_P50: "< 50ms"
    - API_P99: "< 200ms"
    - Blacklist_Apply: "< 1 second"

  Scalability:
    - Validators: "7 → 100+"
    - Daily_TX: "100M+"
    - Concurrent_Users: "100K+"
```

### 3.2 가용성 (Availability)

```yaml
Availability_Requirements:
  SLA:
    - Blockchain: "99.99%"
    - API: "99.9%"
    - Bridge: "99.9%"

  Recovery:
    - RTO: "< 1 hour"
    - RPO: "0 (no data loss)"

  Failover:
    - Validator_Failover: "< 10 seconds"
    - Service_Failover: "< 30 seconds"
    - Database_Failover: "< 60 seconds"
```

### 3.3 보안 (Security)

```yaml
Security_Requirements:
  Authentication:
    - API: "OAuth 2.0 / JWT"
    - Internal: "mTLS"
    - Admin: "MFA required"

  Authorization:
    - RBAC: "Role-based access control"
    - ABAC: "Attribute-based for sensitive ops"

  Encryption:
    - At_Rest: "AES-256"
    - In_Transit: "TLS 1.3"
    - Keys: "HSM stored"

  Audit:
    - All_Actions_Logged: true
    - Retention: "7 years"
    - Tamper_Proof: true

  Compliance:
    - VASP_Requirements: true
    - AML_CTF: true
    - Data_Privacy: "GDPR aligned"
```

### 3.4 운영성 (Operability)

```yaml
Operability_Requirements:
  Monitoring:
    - Metrics: "Prometheus + Grafana"
    - Logging: "ELK Stack"
    - Tracing: "Jaeger"
    - Alerting: "PagerDuty"

  Deployment:
    - Strategy: "Blue-Green / Canary"
    - Rollback: "< 5 minutes"
    - Zero_Downtime: true

  Maintenance:
    - Upgrade_Window: "Off-peak hours"
    - Backup: "Daily + Real-time replication"
    - DR_Site: "Cross-region"
```

---

## 4. 인터페이스 요구사항

### 4.1 API 인터페이스

#### 4.1.1 Public API
```yaml
Public_API:
  Protocol: "JSON-RPC 2.0 (Ethereum compatible)"
  Base_URL: "https://rpc.stablenet.io"

  Endpoints:
    Standard_Ethereum:
      - "eth_chainId"
      - "eth_blockNumber"
      - "eth_getBlockByNumber"
      - "eth_getTransactionByHash"
      - "eth_sendRawTransaction"
      - "eth_call"
      - "eth_estimateGas"
      - "eth_getBalance"
      - "eth_getTransactionReceipt"
      # ... (full Ethereum JSON-RPC)

    StableNet_Extensions:
      - "stablenet_getMinterInfo"
      - "stablenet_getTotalSupply"
      - "stablenet_isBlacklisted"
      - "stablenet_isAuthorized"
      - "stablenet_getBridgeStatus"

  Rate_Limits:
    default: "100 requests/second"
    authenticated: "1000 requests/second"
```

#### 4.1.2 Minter API
```yaml
Minter_API:
  Protocol: "REST (OpenAPI 3.0) + gRPC"
  Base_URL: "https://api.stablenet.io/v1/minter"
  Authentication: "OAuth 2.0 + API Key"

  Endpoints:
    # Minter Management
    - method: "POST"
      path: "/register"
      description: "Minter 등록 신청"
      auth: "required"

    - method: "GET"
      path: "/{address}"
      description: "Minter 정보 조회"
      auth: "required"

    - method: "PUT"
      path: "/{address}/status"
      description: "Minter 상태 변경 (Admin)"
      auth: "admin"

    # Mint Operations
    - method: "POST"
      path: "/mint/request"
      description: "발행 요청"
      auth: "required"
      body:
        recipient: "address"
        amount: "uint256"
        proofOfReserve: "bytes32"
        depositTxHash: "string"

    - method: "POST"
      path: "/mint/confirm"
      description: "발행 확인"
      auth: "required"

    - method: "GET"
      path: "/mint/{requestId}"
      description: "발행 요청 상태"
      auth: "required"

    # Burn Operations
    - method: "POST"
      path: "/burn"
      description: "소각 요청"
      auth: "required"
      body:
        amount: "uint256"

    # History
    - method: "GET"
      path: "/history"
      description: "발행/소각 이력"
      auth: "required"
      params:
        page: "integer"
        limit: "integer"
        type: "mint|burn"
        from: "timestamp"
        to: "timestamp"
```

#### 4.1.3 Bridge API
```yaml
Bridge_API:
  Protocol: "REST + WebSocket"
  Base_URL: "https://api.stablenet.io/v1/bridge"

  REST_Endpoints:
    - method: "POST"
      path: "/out"
      description: "Bridge Out 요청"
      body:
        amount: "uint256"
        targetChainId: "uint256"
        targetAddress: "address"

    - method: "POST"
      path: "/in"
      description: "Bridge In 확인"
      body:
        sourceChainId: "uint256"
        sourceTxHash: "bytes32"

    - method: "GET"
      path: "/status/{requestId}"
      description: "브릿지 상태 조회"

    - method: "GET"
      path: "/supported-chains"
      description: "지원 체인 목록"

  WebSocket:
    endpoint: "wss://api.stablenet.io/v1/bridge/ws"
    subscriptions:
      - "bridge.out.initiated"
      - "bridge.in.completed"
      - "bridge.failed"
```

### 4.2 UI 인터페이스

#### 4.2.1 Wallet App
```yaml
Wallet_App:
  Platforms: ["iOS", "Android", "Web"]
  Framework: "React Native (Mobile), React (Web)"

  Screens:
    Common:
      - "Onboarding"
      - "Login/Auth"
      - "Main Dashboard"
      - "Settings"

    Normal_Account:
      - "Balance View"
      - "Send"
      - "Receive (QR)"
      - "Transaction History"
      - "DApp Browser"

    Smart_Account:
      - "Account Setup"
      - "Sub-Account Management"
      - "Gas Sponsor Settings"
      - "Recovery Setup"

    Secret_Account:
      - "Secret Balance View"
      - "Secret Send"
      - "Deposit from Normal"
      - "Withdraw to Normal"

  Design_Requirements:
    - "Accessible (WCAG 2.1 AA)"
    - "Dark Mode Support"
    - "Multi-language (KO, EN, JP, CN)"
    - "Offline Mode (View Only)"
```

#### 4.2.2 Block Explorer
```yaml
Block_Explorer:
  URL: "https://explorer.stablenet.io"
  Framework: "Next.js"

  Features:
    - "Block Search"
    - "Transaction Search"
    - "Address Search"
    - "Token Tracker"
    - "Validator List"
    - "Governance Dashboard"
    - "API Documentation"

  Pages:
    - "/blocks"
    - "/block/{number}"
    - "/tx/{hash}"
    - "/address/{address}"
    - "/tokens"
    - "/validators"
    - "/governance"
    - "/api-docs"
```

---

## 5. 데이터 요구사항

### 5.1 데이터 모델

```yaml
Core_Entities:
  Minter:
    fields:
      - id: UUID
      - address: string(42)
      - name: string
      - status: enum
      - mintLimit: uint256
      - totalMinted: uint256
      - totalBurned: uint256
      - kycVerifiedAt: timestamp
      - registeredAt: timestamp

  MintRequest:
    fields:
      - id: UUID
      - minterId: UUID
      - recipientAddress: string(42)
      - amount: uint256
      - proofOfReserve: bytes32
      - depositTxHash: string(66)
      - status: enum
      - chainTxHash: string(66)
      - createdAt: timestamp
      - confirmedAt: timestamp

  BridgeTransaction:
    fields:
      - id: UUID
      - direction: enum(in, out)
      - sourceChainId: uint256
      - targetChainId: uint256
      - senderAddress: string(42)
      - recipientAddress: string(42)
      - amount: uint256
      - status: enum
      - sourceTxHash: string(66)
      - targetTxHash: string(66)
      - createdAt: timestamp
      - completedAt: timestamp

  BlacklistEntry:
    fields:
      - id: UUID
      - address: string(42)
      - reason: enum
      - description: string
      - blockedBy: string(42)
      - blockedAt: timestamp
      - isActive: boolean
```

### 5.2 데이터 보존 정책

```yaml
Data_Retention:
  Transaction_Data:
    type: "Blockchain"
    retention: "Permanent"
    location: "On-chain"

  Audit_Logs:
    type: "Compliance"
    retention: "7 years"
    location: "PostgreSQL + S3 Archive"

  KYC_Documents:
    type: "PII"
    retention: "Account lifetime + 5 years"
    location: "Encrypted S3"
    encryption: "AES-256"

  Operational_Logs:
    type: "Logs"
    retention: "90 days"
    location: "Elasticsearch"

  Metrics:
    type: "Monitoring"
    retention: "1 year"
    location: "Prometheus + S3"
```

---

## 6. 규제 및 컴플라이언스

### 6.1 VASP 요구사항

```yaml
VASP_Compliance:
  Travel_Rule:
    threshold: "1,000,000 KRW"
    required_info:
      originator:
        - "name"
        - "account_number"
        - "address"
        - "national_id"
      beneficiary:
        - "name"
        - "account_number"

  Customer_Due_Diligence:
    levels:
      - tier: "Basic"
        limit: "1,000,000 KRW/day"
        verification: "Email, Phone"
      - tier: "Standard"
        limit: "10,000,000 KRW/day"
        verification: "ID Document"
      - tier: "Enhanced"
        limit: "Unlimited"
        verification: "Full KYC + Source of Funds"

  Transaction_Monitoring:
    - "Large transaction alerts"
    - "Suspicious pattern detection"
    - "Cross-border transaction tracking"
```

### 6.2 AML/CTF

```yaml
AML_CTF:
  Screening:
    - "OFAC SDN List"
    - "UN Sanctions List"
    - "PEP Database"

  Monitoring:
    - "Real-time transaction monitoring"
    - "Behavioral analysis"
    - "Chainalysis integration"

  Reporting:
    - "Suspicious Transaction Report (STR)"
    - "Large Transaction Report"
    - "Cross-border Report"
```

---

## 7. 출시 계획

### 7.1 출시 단계

```yaml
Release_Phases:
  Phase_1_DevNet:
    target: "M4"
    scope:
      - "Core blockchain (WBFT)"
      - "Basic TX processing"
      - "Internal testing"

  Phase_2_TestNet:
    target: "M10"
    scope:
      - "Minter system"
      - "Governance"
      - "Blacklist"
      - "Public testing"

  Phase_3_Beta:
    target: "M15"
    scope:
      - "Bridge"
      - "Smart Account"
      - "Secret Account"
      - "Limited partners"

  Phase_4_Mainnet:
    target: "M18"
    scope:
      - "Full production"
      - "Initial Minters"
      - "Public access"

  Phase_5_Expansion:
    target: "M24"
    scope:
      - "Multi-chain bridges"
      - "DeFi integrations"
      - "Ecosystem growth"
```

### 7.2 성공 지표

```yaml
Success_Metrics:
  Technical:
    - metric: "TPS"
      target: ">= 3000"
      measurement: "30분 지속 부하 테스트"

    - metric: "Uptime"
      target: ">= 99.99%"
      measurement: "30일 평균"

    - metric: "Finality"
      target: "1 block"
      measurement: "전체 TX 분석"

  Business:
    - metric: "Total Supply"
      target: ">= 10B KRW"
      timeframe: "M24"

    - metric: "Daily Active Users"
      target: ">= 100K"
      timeframe: "M24"

    - metric: "Minter Count"
      target: ">= 10"
      timeframe: "M20"

    - metric: "Exchange Listings"
      target: ">= 3"
      timeframe: "M24"
```

---

## 8. 부록

### A. 용어 정의

| 용어 | 정의 |
|------|------|
| Minter | 스테이블코인 발행 권한을 가진 인증된 금융기관 |
| WBFT | Weighted Byzantine Fault Tolerance, 합의 알고리즘 |
| Stealth Address | 추적이 어려운 일회용 주소 (ERC-5564) |
| Paymaster | 가스비를 대납하는 컨트랙트/서비스 |
| Bridge | 체인 간 자산 전송 프로토콜 |

### B. 참조 문서

- StableNet_Key.md: 원본 기획서
- StableNet_기술_로드맵.md: 기술 로드맵
- StableNet_기술_스택.md: 상세 기술 스택
- EIP-7702 Specification
- ERC-5564 Specification

### C. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-09 | 초안 작성 | CTO Office |
