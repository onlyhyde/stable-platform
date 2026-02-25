# 07. Real Use Cases And Architecture Mapping

대상: Smart Account 기반 서비스를 구현하는 개발자  
목표: 실제 유즈케이스를 ERC-4337 / EIP-7702 / ERC-7579 책임 레이어에 정확히 매핑

## 1. 이 세션에서 답할 질문
- 어떤 유즈케이스에서 4337만으로 충분하고, 언제 7579 모듈이 필요한가?
- native coin 유무, ERC-20 보유 여부에 따라 가스 정산 흐름이 어떻게 달라지는가?
- AI agent 자동화는 어떤 권한 경계 위에서 안전하게 동작해야 하는가?

## 2. 공통 아키텍처 맵

| 레이어 | 책임 | 핵심 컴포넌트 |
|---|---|---|
| 실행/정산 레이어 | UserOperation 검증, 실행, 정산 | EntryPoint, Bundler, Paymaster (ERC-4337) |
| 계정 전환/주소 유지 레이어 | EOA 주소 유지 + 코드 위임 | EIP-7702 |
| 계정 내부 확장 레이어 | 검증/실행/정책 모듈화 | Validator/Executor/Hook/Fallback (ERC-7579) |

핵심 원칙:
- 4337은 외부 파이프라인(전달/검증/정산)
- 7579는 계정 내부 모듈 구조
- 7702는 EOA를 Smart Account 실행 모델로 연결하는 전환 장치

## 3. 유즈케이스 A: Native Coin 없는 유저, Paymaster 스폰서 가스

### 문제
- 신규 유저는 native coin이 없어 첫 트랜잭션 자체가 불가능.

### 해결 패턴
- Paymaster가 가스를 선지불(sponsor)하고 UserOperation을 실행.

### 실행 흐름
1. 지갑이 UserOperation 생성
2. Paymaster 정책에 필요한 데이터(paymasterAndData) 구성
3. Bundler가 시뮬레이션(validateUserOp + validatePaymasterUserOp)
4. EntryPoint 실행
5. postOp에서 Paymaster 내부 회계 처리

### 입력 파라미터(핵심)
- `userOp.paymasterAndData`
- `paymasterVerificationGasLimit`, `paymasterPostOpGasLimit`
- Paymaster 정책 데이터(만료시간, 서명, quota 등)

### 실패 포인트
- Paymaster deposit 부족
- Paymaster 정책 거절(서명/만료/한도)
- postOp 실패로 인한 정산 이슈

### 책임 매핑
- 4337: 필수
- 7579: 선택(계정 내부 정책 확장 시)
- 7702: 선택(EOA 주소 유지 요구 시)

## 4. 유즈케이스 B: Native Coin 있는 유저, Bundler 정산 비용 지불

### 문제
- Paymaster 없이도 4337 파이프라인을 사용하고 싶음.

### 해결 패턴
- Account가 직접 prefund/deposit 기반으로 비용을 부담.

### 실행 흐름
1. 유저가 userOpHash 서명
2. Bundler 시뮬레이션
3. EntryPoint가 `validateUserOp` 호출
4. `missingAccountFunds`가 있으면 Account가 EntryPoint로 보충
5. 실행/정산 후 Bundler beneficiary 지급

### 입력 파라미터(핵심)
- `preVerificationGas`, `accountGasLimits`, `gasFees`
- `signature`, `nonce`

### 실패 포인트
- `missingAccountFunds` 미보충
- nonce 충돌/서명 오류
- 가스 한도 과소 설정

### 책임 매핑
- 4337: 필수
- 7579: 선택(모듈형 계정이면 내부 검증/실행 위임)
- 7702: 선택

## 5. 유즈케이스 C: Native Coin 없음 + ERC-20 보유, Paymaster 선지불 후 ERC-20 정산

### 문제
- 유저는 ERC-20은 있지만 native coin은 없음.

### 해결 패턴
- Paymaster가 우선 native gas를 지불하고, 실행 후 ERC-20으로 회수.

### 실행 흐름
1. 유저가 Paymaster에 권한 부여(approve 또는 permit2 서명)
2. userOp에 ERC-20 결제 정책을 포함한 paymasterData 삽입
3. EntryPoint 검증 단계에서 Paymaster가 정책/가격/한도 검증
4. 실행 후 postOp에서 실제 가스비를 ERC-20으로 정산

### 입력 파라미터(핵심)
- `paymasterAndData` 내부 토큰/정산 파라미터
- Permit2 서명 데이터 또는 allowance 상태
- 가격 오라클 참조값(구현체 정책)

### 실패 포인트
- 권한 미설정/allowance 부족
- 토큰 가격 stale/오라클 오류
- postOp 시점 잔액 부족

### 책임 매핑
- 4337: 필수
- 7579: 선택
- 7702: 선택

## 6. 유즈케이스 D: 7579 DeFi Swap 모듈 + AI Agent로 DCA/Limit Order 자동 실행

### 문제
- 반복 주문(DCA), 조건 주문(limit)은 사용자가 매번 수동 트랜잭션을 보내야 함.

### 해결 패턴
- Smart Account에 swap executor module(7579) 설치
- 유저가 사전 승인한 권한 범위 내에서 AI agent가 실행 트리거

### 실행 흐름
1. 계정에 Executor/Hook 모듈 설치 (권한/한도/대상 제약 포함)
2. 유저가 자동화 정책 승인(예: 최대 금액, 대상 DEX, 기간)
3. AI agent가 조건 충족 시 UserOperation 생성/제출
4. EntryPoint 실행, 모듈이 실제 스왑 수행
5. Hook이 사전/사후 정책 검증 및 기록

### 입력 파라미터(핵심)
- 모듈 설치 데이터(`installModule`용 initData)
- 정책 파라미터(슬리피지, 한도, 허용 토큰/프로토콜)
- 실행 조건(가격, 시간 주기, 만료)

### 실패 포인트
- agent 권한 초과 요청
- hook 정책 위반으로 revert
- 시장 변동으로 슬리피지/가격 조건 불충족

### 책임 매핑
- 4337: 필수(실행 전달/정산)
- 7579: 필수(모듈형 자동화)
- 7702: 선택(EOA 주소 기반 전환이 필요할 때)

## 7. 유즈케이스 선택 가이드

| 요구사항 | 권장 조합 |
|---|---|
| 첫 거래 온보딩(가스 없음) | 4337 + Paymaster |
| 기본 AA 전환(사용자 자가 비용 지불) | 4337 Account |
| 토큰 가스 결제 UX | 4337 + ERC20/Permit2 Paymaster |
| 자동화/에이전트 실행 | 4337 + 7579 Executor/Hook |
| 기존 EOA 주소 유지가 중요 | 7702 + (4337 필요 시 결합) |

## 8. 구현 체크리스트
- UserOp 구성 시 필수 필드(`nonce/gas/signature`) 누락 방지
- `supportsExecutionMode`와 실제 실행 경로 일치 확인
- Paymaster 정책 데이터 포맷과 SDK 인코더 일치
- postOp 실패 시 정산/회계 영향 시나리오 테스트
- Agent 자동화 경로에 권한 상한, 만료, 취소 메커니즘 포함

## 9. 세미나 전달 포인트(요약)
- Smart Account는 “하나의 기능”이 아니라 “레이어 조합 아키텍처”다.
- 유즈케이스별로 필요한 표준 조합이 다르다.
- 구현 안정성은 기능 수보다 경계 설계(권한/정산/nonce/시뮬레이션 일치)에서 결정된다.
