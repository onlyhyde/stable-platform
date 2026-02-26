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

v0.9 옵션 suffix (스펙표준 line 999-1001):
- `[optional] paymasterSignature(variable)`
- `[optional] uint16(paymasterSignature.length)`
- `[optional] PAYMASTER_SIG_MAGIC (0x22e325a297439656)`

옵션 suffix는 **병렬 서명**을 위한 설계이다. Paymaster 서명이 `userOpHash`에 포함되지 않으므로, Account 서명과 Paymaster 서명을 독립적으로(병렬로) 생성할 수 있다. 이는 서명 서버와 사용자 지갑 간의 round-trip을 줄여 UX를 개선한다.

### 3.2 Paymaster 훅

**`validatePaymasterUserOp`**:
```solidity
function validatePaymasterUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
) external returns (bytes memory context, uint256 validationData);
```
- 스폰서 승인 여부 결정
- `context`와 `validationData` 반환
- **`context` 빈값 반환 시 `postOp`이 호출되지 않음** (스펙표준 line 358). 가스 최적화 기회로 활용 가능.

**`postOp`**:
```solidity
function postOp(
    PostOpMode mode,
    bytes calldata context,
    uint256 actualGasCost,
    uint256 actualUserOpFeePerGas
) external;
```
- 실행 후 실제 비용 기준 정산/후처리

**PostOpMode enum (v0.9)**:
```solidity
enum PostOpMode {
    opSucceeded,  // UserOp 실행 성공
    opReverted    // UserOp 실행 revert (Paymaster는 여전히 가스비 부담)
}
```
- v0.9에서 paymaster에 전달되는 유효 값은 `opSucceeded`(0)와 `opReverted`(1) **2개뿐**이다.
- 참조 구현의 enum에는 `postOpReverted`가 포함되어 있으나, 이는 EntryPoint 내부 제어용이며 `paymaster.postOp()`에 전달되지 않는다.
- 그러나 `IPaymaster.postOp()`은 public external이므로 EntryPoint 외부에서 직접 호출될 수 있다. 따라서 `postOpReverted` 분기를 포함하는 것은 **방어적 코딩(defensive coding)**으로 유효하다.
- 참조: 스펙표준 line 342-348

**v0.9 postOp 정산 메커니즘 변경**:
- v0.9에서는 `postOp` revert 시 EntryPoint가 `PostOpReverted` 모드로 재호출하지 않고, 실행을 revert하고 prefund에서 직접 가스비를 정산한다 (이중 호출 제거).
- 참조: 스펙표준 line 342-348 (PostOpMode 정의), 기술가이드 §6.3 (line 714)

### 3.2.1 validationData 패킹 형식

`validationData`는 `uint256`으로 반환되며, 아래와 같이 패킹된다:

```
| authorizer (20 bytes) | validUntil (6 bytes) | validAfter (6 bytes) |
```

- **authorizer**: 0 = 유효, 1 = SIG_VALIDATION_FAILED, 기타 = aggregator 주소
- **validUntil**: 유효 만료 시간 (0 = 무한)
- **validAfter**: 유효 시작 시간

코드 예시:
```solidity
// validationData 패킹
uint256 validationData = uint256(uint160(authorizer))
    | (uint256(validUntil) << 160)
    | (uint256(validAfter) << (160 + 48));

// validUntil/validAfter만 패킹 (authorizer = 0, 성공)
uint256 validationData = (uint256(validUntil) << 160)
    | (uint256(validAfter) << (160 + 48));
```

**Block Number Mode (bit 47)**: `validUntil`과 `validAfter`의 최상위 비트(bit 47)를 1로 설정하면 timestamp 대신 block number 기준으로 동작한다. 동일 UserOperation 내에서 timestamp과 block number를 혼용할 수 없다.
- 참조: 스펙표준 line 211-228

### 3.3 Deposit / Stake 책임
- Paymaster: EntryPoint deposit 필수(실제 차감 원천)
- Stake: 운영 안정성/DoS 완화 측면
- Bundler: deposit/stake 주체가 아니라 시뮬레이션/선별 주체

- **스테이킹 필수 조건** (스펙표준 §7.3 line 497-502):
  - `postOp`이 있는 Paymaster(즉 `context`가 비어있지 않은 경우)는 반드시 스테이킹해야 함
  - 자체 스토리지(sender-associated가 아닌)에 접근하는 Paymaster도 스테이킹 필요
  - 미스테이킹 시 번들러가 해당 Paymaster를 사용하는 UserOp을 거부할 수 있음

### 3.4 검증 단계 제한 사항 (Bundler Spec)

검증 코드(`validateUserOp`, `validatePaymasterUserOp`, factory 호출)에서의 제한:

| 주체 상태 | 허용 스토리지 범위 |
|-----------|-------------------|
| Unstaked entity | sender 자체 storage만 접근 가능 |
| Staked entity | 제한적 확장 허용 (충돌 패턴 제외) |
| 모든 entity | 같은 번들 내 다른 sender 주소 접근 금지 |

금지 opcode (검증 단계):
- `BLOCK_*` 계열 opcode (staked entity 예외 가능)
- delegation call
- sender 자체 storage 외 접근 (unstaked entity의 경우)

**실무 영향**:
- validation 단계에서 외부 상태변경(예: Permit2 `permit()`)은 BUNDLER COMPAT 리스크 발생
- 외부 스토리지 접근이 필요한 경우 스테이킹을 통해 완화 가능
- 참조: 스펙표준 line 483-502

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
6. Bundler가 `handleOps()` view/trace call로 시뮬레이션 수행 (스펙표준 line 119-121)
7. EntryPoint가 `validateUserOp` + `validatePaymasterUserOp` 실행
8. 실행 후 EntryPoint가 `postOp` 호출
9. Off-chain settlement worker가 receipt로 reservation settle/cancel

## 7. 구현 체크리스트

### 7.1 Contract
- `validatePaymasterUserOp`에서 입력 길이/타입/유효기간 검증
- `validationData`를 명확히 설정(실패/성공/시간 범위)
- `postOp`에서 mode 분기 처리 (v0.9: `opSucceeded`/`opReverted` 2개 값. `postOpReverted`는 방어적 코딩용으로만 유지)
- `context` 빈값 반환 시 postOp 미호출 규칙 인지 (가스 최적화 기회)
- `validationData` 패킹 형식 확인 (authorizer + validUntil + validAfter)
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
- 10% 미사용 가스 페널티 미인지: `callGasLimit` 및 `paymasterPostOpGasLimit`에 **각각** 개별 적용됨. 각 가스 한도에서 미사용분이 40,000 gas 이상이면 해당 미사용분의 10%가 페널티로 부과됨 (스펙표준 line 578-581, `EntryPoint.sol:842,866`)

## 11. 결론

Paymaster 구현의 본질은 다음 3가지다.
- EntryPoint 표준 훅을 정확히 따르는 온체인 안전성
- 정책/서명/정산을 분리한 오프체인 운영성
- Contract/Proxy/SDK 간 바이트/해시 정합성

이 3가지를 유지하면 EIP-4337 기반 Paymaster는 타입 확장(Verifying/Sponsor/ERC20/Permit2)과 운영 자동화를 안정적으로 수용할 수 있다.
