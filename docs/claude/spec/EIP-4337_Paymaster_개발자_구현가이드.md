# EIP-4337 Paymaster 개발자 구현 가이드

작성일: 2026-02-24  
참조 문서:
- `docs/claude/spec/EIP-4337_스펙표준_정리.md` (Paymaster 섹션)
- `docs/claude/seminar/paymaster/00-paymaster-final-spec-and-implementation.md` (최종 구현 기준)

## 1. 이 문서의 목적

Paymaster를 실제로 구현/운영해야 하는 개발자를 위해, EIP-4337 스펙 범위와 실서비스 구현 범위를 분리해 정리하고, Contract/Proxy/SDK 관점에서 필요한 지식을 한 번에 제공한다.

## 2. 스펙 범위 vs 구현 범위

### 2.1 EIP-4337 스펙이 정의하는 것
- `paymasterAndData` 필드의 존재 및 기본 레이아웃
- EntryPoint가 `validatePaymasterUserOp`/`postOp`를 호출하는 표준 훅
- Deposit/Stake 기반 자금/안정성 모델
- `validationData(validUntil/validAfter)`에 의한 유효 시간 처리

### 2.2 스펙이 정의하지 않는 것 (구현체 책임)
- `paymasterData` 내부 business payload 포맷
- 승인 정책(allowlist, quota, risk score, campaign)
- 오프체인 서명 서버/정책 엔진
- userOpHash 기반 후정산/회계/모니터링

## 3. 필수 개념

### 3.1 `paymasterAndData` 레이아웃

`paymasterAndData`는 Solidity struct가 아니라 bytes 컨테이너다.

일반 해석:
- `paymaster(20)`
- `paymasterVerificationGasLimit(16)`
- `paymasterPostOpGasLimit(16)`
- `paymasterData(variable)`

### 3.2 Paymaster 훅
- `validatePaymasterUserOp(userOp, userOpHash, maxCost)`
  - 스폰서 승인 여부 결정
  - `context`, `validationData` 반환
- `postOp(mode, context, actualGasCost, actualUserOpFeePerGas)`
  - 실행 후 실제 비용 기준 정산/후처리

### 3.3 Deposit / Stake 책임
- Paymaster: EntryPoint deposit 필수(실제 차감 원천)
- Stake: 운영 안정성/DoS 완화 측면
- Bundler: deposit/stake 주체가 아니라 시뮬레이션/선별 주체

## 4. 구현 권장 아키텍처 (현재 최종 기준)

### 4.1 온체인(Contract)
- 공통:
  - paymasterData 파싱 진입점 통일
  - domain separator/userOp core hash 계산 공통화
- 타입별:
  - Verifying: 오프체인 서명 검증
  - Sponsor: 정책 payload + 오프체인 서명 검증
  - ERC20: 토큰 비용 계산 및 정산
  - Permit2: Permit2 payload 검증 및 정산

### 4.2 오프체인(Proxy)
- `pm_getPaymasterStubData`: 가스 추정용
- `pm_getPaymasterData`: 제출용
- EntryPoint allowlist + chain allowlist 필수 검증
- 승인 시 reservation 생성
- userOpHash 기반 receipt 후정산(settle/cancel)

### 4.3 SDK
- TS/Go 공통 코덱/해셔 제공
- paymaster payload 인코딩 유틸 제공
- Contract와 동일 해시 규칙 유지

## 5. 단일 포맷 전략 (강력 권장)

핵심 원칙:
- 타입별로 파편화된 raw byte 파싱을 피하고, 공통 envelope를 먼저 decode
- envelope `paymasterType` 확인 후 타입별 payload decode
- hash 계산 규칙은 Contract/Proxy/SDK에서 완전히 동일해야 함

실무 이점:
- 타입 추가/변경 시 리스크 감소
- Cross-layer conformance 테스트 단순화
- 운영 디버깅(파싱/해시 불일치) 속도 향상

## 6. End-to-End 처리 흐름

1. Wallet이 UserOp 작성
2. 필요 시 paymaster-proxy에 stub 요청(`pm_getPaymasterStubData`)
3. 가스 추정 반영 후 최종 데이터 요청(`pm_getPaymasterData`)
4. Proxy 정책 검증 + paymasterData 생성 + reservation 기록
5. Wallet이 UserOp 서명 후 Bundler 제출
6. Bundler가 simulateValidation 수행
7. EntryPoint가 `validateUserOp` + `validatePaymasterUserOp` 실행
8. 실행 후 EntryPoint가 `postOp` 호출
9. Off-chain settlement worker가 receipt로 reservation settle/cancel

## 7. 구현 체크리스트

### 7.1 Contract
- `validatePaymasterUserOp`에서 입력 길이/타입/유효기간 검증
- `validationData`를 명확히 설정(실패/성공/시간 범위)
- `postOp`에서 mode 분기 처리
- 재진입/예외/과금 상한 방어

### 7.2 Proxy
- EntryPoint allowlist 비활성 상태 금지
- chainId/entryPoint/paymaster type 검증
- policy reserve -> receipt settle/cancel 흐름 보장
- 에러 코드를 정책/포맷/정산별로 분리

### 7.3 SDK
- 코덱/해셔를 중앙 모듈로 제공
- 로컬 인코딩 구현 중복 금지
- 버전/체인별 주소/ABI 관리 일원화

## 8. 테스트 전략

필수 테스트 계층:
- Unit: envelope encode/decode, payload encode/decode
- Contract: 각 paymaster의 validate/postOp 정상/실패 케이스
- Cross-layer: Proxy가 만든 바이트 == Contract 파서 기대값
- Hash fixture: Proxy/SDK hash == Contract hash
- Integration: bundler receipt 기반 settle/cancel

필수 실패 케이스:
- 만료(validUntil)
- 서명 불일치
- unsupported token/type
- deposit 부족
- postOp 실패

## 9. 운영 지표

최소 모니터링 항목:
- 승인율/거절율(거절 사유 분포)
- 평균 sponsor 비용
- reservation pending/expired 비율
- settlement 성공률, receipt 조회 실패율
- deposit/stake 잔량 및 top-up 이벤트

## 10. 실수하기 쉬운 포인트

- Contract/Proxy/SDK 도메인 해시 규칙 불일치
- EntryPoint allowlist를 옵션으로 두고 실제론 비활성화
- request 시점 선차감(정산 일관성 깨짐)
- paymaster type별 포맷 분기 남발로 유지보수 복잡도 증가
- Permit2/ERC20 payload 파싱과 validationData 시간 처리 누락

## 11. 결론

Paymaster 구현의 본질은 다음 3가지다.
- EntryPoint 표준 훅을 정확히 따르는 온체인 안전성
- 정책/서명/정산을 분리한 오프체인 운영성
- Contract/Proxy/SDK 간 바이트/해시 정합성

이 3가지를 유지하면 EIP-4337 기반 Paymaster는 타입 확장(Verifying/Sponsor/ERC20/Permit2)과 운영 자동화를 안정적으로 수용할 수 있다.
