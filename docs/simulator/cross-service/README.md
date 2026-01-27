# Cross-Service Integration

시뮬레이터 서비스 간 연동 개요 및 설계입니다.

## 현재 상태

각 서비스는 독립적으로 동작하며 서비스 간 실제 연동이 없습니다.

```
현재:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ bank-simulator  │     │  pg-simulator   │     │onramp-simulator │
│                 │     │                 │     │                 │
│ - 계좌 관리      │     │ - 카드 결제      │     │ - 주문 관리      │
│ - 계좌 간 이체   │     │ - 3DS 인증       │     │ - 환율 계산      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       ↑                       ↑                       ↑
       └───────────────────────┴───────────────────────┘
                    연동 없음 (각자 독립 동작)
```

## 목표 상태

```
목표:
┌─────────────────┐
│ bank-simulator  │
│                 │
│ - 계좌 관리      │
│ - 이체/입출금    │
│ - Direct Debit  │◀────────────────┐
└─────────────────┘                 │
       ▲                            │
       │ 정산 입금                   │ bank_transfer
       │                            │
┌─────────────────┐          ┌─────────────────┐
│  pg-simulator   │◀─────────│onramp-simulator │
│                 │ card     │                 │
│ - 카드 결제      │ payment  │ - 주문 관리      │
│ - 은행 이체 결제 │          │ - 결제 연동      │
│ - Checkout      │          │ - KYC           │
└─────────────────┘          └─────────────────┘
```

## 연동 시나리오

### 1. Onramp 카드 결제

```
사용자 → Onramp: 주문 생성 (card)
         Onramp → PG: 결제 요청
                  PG: 카드 검증/3DS
         Onramp ← PG: 결제 결과
사용자 ← Onramp: 주문 완료/실패
```

### 2. Onramp 은행 이체

```
사용자 → Onramp: 주문 생성 (bank_transfer)
         Onramp → Bank: 출금 요청 (Direct Debit)
                  Bank: 잔액 확인/차감
         Onramp ← Bank: 출금 결과
사용자 ← Onramp: 주문 완료/실패
```

### 3. PG 은행 이체 결제

```
가맹점 → PG: 결제 생성 (bank_transfer)
         PG → Bank: 가상계좌 발급 요청 (또는 Direct Debit)
         PG ← Bank: 결과
가맹점 ← PG: 결제 결과
(이후 정산 시)
         PG → Bank: 가맹점 계좌 입금
```

## 연동 방식

### HTTP 동기 호출

각 서비스가 다른 서비스의 REST API를 직접 호출합니다.

**장점**:
- 구현이 단순함
- 즉각적인 결과 확인
- PoC에 적합

**단점**:
- 서비스 간 강결합
- 장애 전파 가능성

### 환경 변수 설정

각 서비스에 연동 대상 서비스 URL을 환경변수로 설정합니다.

```bash
# pg-simulator
BANK_SIMULATOR_URL=http://localhost:4350

# onramp-simulator
PG_SIMULATOR_URL=http://localhost:4351
BANK_SIMULATOR_URL=http://localhost:4350
```

## 상세 스펙

연동 상세 설계: [integration-specs.md](./integration-specs.md)

## 관련 기능

| 서비스 | 기능 | 역할 |
|--------|------|------|
| bank-simulator | Direct Debit API | 출금 수신자 |
| bank-simulator | 입금 API | 정산 수신자 |
| pg-simulator | bank_transfer 결제 | bank 출금 요청자 |
| pg-simulator | 정산 | bank 입금 요청자 |
| onramp-simulator | card 결제 연동 | PG 결제 요청자 |
| onramp-simulator | bank_transfer 연동 | bank 출금 요청자 |
