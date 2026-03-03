# 01. Ethereum 상태 머신과 계정 모델 한계

## 배경

Ethereum은 "**트랜잭션 입력 -> 상태 전이 -> 상태 기록**"으로 동작하는 상태 기반 상태 머신이다.
Ethereum에서 네이티브 트랜잭션을 만들고 네트워크에 요청하는 주체는 EOA다. 문제는 기존 프로토콜에서 EOA는 코드를 가질 수 없다는 점이다. 이 제약 때문에 제품에서 필요한 정책 실행, 자동화, 위임, 가스 대납 같은 기능은 별도 구조가 필요해진다.

### 상태 전이 구조

- 입력: tx
  - 필수 입력(실질적으로 항상 필요): `chainId`, `nonce`, `gasLimit`, `to`(컨트랙트 배포 시 생략), `value`, `data`, `signature(v,r,s)`
  - 수수료 입력(타입별 필수): `gasPrice`(Legacy) 또는 `maxPriorityFeePerGas` + `maxFeePerGas`(EIP-1559 계열)
  - 확장 입력(타입별 필수): `accessList`(2930/1559/7702), blob 관련 필드(4844), `authorizationList`(7702)
  - 선택 입력(진짜 옵션): 해당 tx 타입에서 해석되지 않고 생략해도 실행 의미가 바뀌지 않는 필드만 해당
- 전이 함수: EVM 실행
- 출력: state root 변경, 로그, 영수증

### 기본 계정 타입

- EOA
  - 특징: private key로 서명, 코드 없음
  - 장점: 단순함, 네이티브 호환성
  - 한계: 정책 실행/모듈 확장/자동화에 취약

- Contract Account (CA)
  - 특징: 코드 보유, 로직 실행 가능
  - 장점: 확장성, 정책화, 복합 실행
  - 한계: 기본 상태에서는 "Tx 직접 발신 주체"가 아님

### Tx 처리 구조

```mermaid
%%{init: {
  "flowchart": {
    "useMaxWidth": true,
    "nodeSpacing": 40,
    "rankSpacing": 30,
    "htmlLabels": true,
    "curve": "basis"
  },
  "themeVariables": {
    "fontSize": "12px"
  }
}}%%
flowchart TB
    subgraph N["Native Transaction (Protocol Path)"]
        N1["1) 유효성 검증<br/>nonce, signature, balance, intrinsic gas, chainId/type"] --> N2["2) EVM 실행<br/>to/data/value 실행"]
        N2 --> N3["3) 상태 반영<br/>성공/실패<br/>(가스소모/nonce 반영+상태변경+로그)"]
        N3 --> N4["4) 블록 포함/영수증 생성<br/>receipt(status, gasUsed, logs)"]
    end
```

### 네이티브 Tx 흐름

```mermaid
sequenceDiagram
  participant U as User
  participant W as EOA Wallet
  participant N as Ethereum Node
  participant C as Contract

  U->>W: Tx 생성 요청
  W->>W: 개인키 서명
  W->>N: eth_sendRawTransaction
  N->>C: EVM 실행
  C-->>N: 결과
  N-->>W: txHash/receipt
```

## 문제

EOA 중심 모델의 구조적 한계:

- 단일 서명 규칙: 멀티시그/소셜복구/세션키를 네이티브로 표현하기 어렵다.
- 가스 결제 고정: ETH(Native Coin) 없는 사용자는 시작 자체가 어렵다.
- 자동화 부재: 조건부/반복 실행 로직을 계정 레벨에서 갖기 어렵다. EOA는 code가 없으므로(`code.length == 0`) 계정 내부에 실행 로직을 둘 수 없다.
- 정책 부재: 지출 한도, dApp allowlist 같은 권한 정책을 네이티브로 강제하기 어렵다.

## 해결 방향

핵심 아이디어는 "트랜잭션 처리 로직을 프로토콜 tx 형식 밖으로 추상화"하는 것이다. 이것이 **Account Abstraction**이며, 구체적 실현은 UserOperation 기반 실행 경로로 나타난다.

- 검증/실행/정산 로직을 컨트랙트 계층으로 올린다.
  - EntryPoint + Account + Paymaster
- 계정을 단순 주소가 아니라 정책(1일 출금한도, 특정 컨트랙트만 호출 허용등)을 강제할 수 있는 실행 주체로 본다.
- 이 방향에서 4337(처리 경로), 7702(EOA 전환), 7579(모듈 구조)가 등장한다.

---
