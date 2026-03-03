# 09 — Paymaster ERC-7677 정렬 작업 브리프

작성일: 2026-03-04  
대상: 다음 세션 구현 담당자 (Wallet/Paymaster/Bundler/문서 담당)

---

## 0. 목적

본 문서는 다음 두 가지를 다음 세션에서 바로 구현할 수 있도록 정리한다.

1. **ERC-7677 스타일 호출 흐름 정렬**
   - 목표: `stub -> estimate -> final` + `isFinal` 최적화
2. **표준 지원 범위 명확화**
   - 목표: ERC-4337 / ERC-7677 / 프로젝트 확장 필드를 분리해서 설명 및 구현

추가 결정사항:
- **User 서명은 최종 단계 유지** (`final paymasterData` 반영 후 User 서명)

---

## 1. 현재 상태 (코드 기준)

### 1.1 Wallet Extension

- `requestPaymasterSponsorship()`는 현재 항상 `pm_getPaymasterStubData` 이후 `pm_getPaymasterData`를 연속 호출한다.
- `isFinal` 분기 처리가 없다.
- 코드:
  - `apps/wallet-extension/src/background/rpc/paymaster.ts`
  - `apps/wallet-extension/src/background/rpc/handler.ts`

### 1.2 Paymaster Proxy

- Stub 응답의 `isFinal`은 모든 타입에서 `false`를 반환한다.
- 코드:
  - `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts`

### 1.3 표준/스키마 측면

- `pm_getPaymasterStubData`, `pm_getPaymasterData` 스키마/핸들러는 이미 존재한다.
- `context`는 프로젝트 확장 필드(`paymasterType`, `tokenAddress`, `policyId`)를 사용한다.
- 코드:
  - `services/paymaster-proxy/src/schemas/index.ts`
  - `services/paymaster-proxy/src/types/index.ts`

---

## 2. 목표 흐름 (다음 세션 구현 목표)

### 2.1 표준 목표 플로우

```text
Step 1) Wallet -> pm_getPaymasterStubData(userOp, entryPoint, chainId, context)
Step 2) Wallet checks isFinal
  - isFinal = true  -> pm_getPaymasterData 생략
  - isFinal = false -> estimate 반영 후 pm_getPaymasterData 호출
Step 3) Wallet이 최종 UserOp 서명
Step 4) eth_sendUserOperation 제출
```

핵심:
- User 서명은 항상 최종 UserOp 기준으로 수행한다.
- `isFinal=true`일 때만 `pm_getPaymasterData`를 생략한다.

### 2.2 `eth_sendUserOperation` 경로 목표

- Sponsor/erc20 모두 동일한 플로우 엔진을 사용하도록 정렬한다.
- 가능하면 `requestPaymasterSponsorship()`가 다음을 반환하도록 확장:
  - `isFinal` 여부
  - stub/final에서 확정된 paymaster 필드
  - (선택) estimate 재요청 필요 여부

### 2.3 모듈 lifecycle (`stablenet_*`) 경로 목표

- 현재도 `gasPaymentMode`로 sponsor/erc20 분기하고 있으므로,
- 동일 `isFinal` 분기 로직을 재사용하도록 공통 함수화한다.

---

## 3. 구현 작업 분해 (다음 세션용)

## 3.1 Wallet Extension

1. `requestPaymasterSponsorship()` 인터페이스 확장
- Stub 응답의 `isFinal`을 파싱
- `isFinal=true`면 final RPC 생략 가능하게 처리

2. `eth_sendUserOperation` 경로 정렬
- 현재 흐름: 가스 추정 -> sponsorship -> user 서명
- 목표 흐름: stub -> (`isFinal=false`이면 estimate 재반영) -> final(optional) -> user 서명

3. Sponsor/erc20 context 일관화
- `eth_sendUserOperation`에서도 필요 시 `context.paymasterType/tokenAddress` 전달 경로 명확화

### 3.2 Paymaster Proxy

1. `isFinal=true` 지원 정책 정의
- 후보: ERC20/Permit2 중 서명 불필요/가스 안정적인 경우
- 정책 조건이 불명확하면 우선 `false` 유지 + TODO 문서화

2. Stub/Final 길이/가스 추정 영향 검증
- `preVerificationGas` 오차가 커지지 않는지 검증 테스트 필요

### 3.3 테스트

1. Wallet 단위 테스트
- `isFinal=true`일 때 final RPC 미호출 검증
- `isFinal=false`일 때 final RPC 호출 검증

2. E2E 테스트 (최소 2개)
- sponsor: `isFinal=false` 경로
- erc20: `isFinal=true` 또는 `false` 정책 경로

3. 회귀 테스트
- User 서명 타이밍이 마지막 단계로 유지되는지 확인

---

## 4. 표준 지원 범위 정리 (1:1 기준)

## 4.1 ERC-4337 (온체인 표준)

표준 범위:
- `validatePaymasterUserOp`, `postOp`
- `paymasterAndData`를 포함한 UserOp 검증/정산 문맥

비고:
- `pm_*` 웹 RPC는 ERC-4337 자체 범위가 아니라 별도(ERC-7677) 영역

## 4.2 ERC-7677 (오프체인 Paymaster RPC 표준)

표준 범위:
- `pm_getPaymasterStubData`
- `pm_getPaymasterData`
- `isFinal` 기반 최적화 분기

비고:
- Wallet이 Paymaster 서비스와 통신하는 방법을 표준화

## 4.3 프로젝트 확장 (표준 외)

아래 항목은 구현 확장으로 분리 표기해야 한다.

1. Context 확장 필드
- `paymasterType`
- `tokenAddress`
- `policyId`

2. 확장 RPC 메서드
- `pm_supportedTokens`
- `pm_estimateTokenPayment`
- `pm_getSponsorPolicy`
- `pm_sponsorUserOperation`

3. 스폰서 UI 메타
- `sponsor.name`, `sponsor.icon`

---

## 5. 문서/커뮤니케이션 규칙 (다음 세션 반영)

1. 문서에서 "표준"과 "프로젝트 확장"을 같은 레벨로 섞지 않는다.
2. 흐름 설명 시 다음 순서를 고정한다.
- `stub -> (isFinal 분기) -> final(optional) -> user 서명 -> 제출`
3. User 서명 타이밍은 항상 "최종 UserOp 기준"으로 명시한다.

---

## 6. 수락 기준 (Definition of Done)

아래를 모두 만족하면 정렬 작업 완료로 본다.

1. 코드
- Wallet 경로에 `isFinal` 분기 구현
- User 서명이 최종 단계 유지
- sponsor/erc20 경로 동작 차이가 문서와 일치

2. 테스트
- `isFinal=true/false` 분기 테스트 통과
- `eth_sendUserOperation` 정상 제출/receipt 확인

3. 문서
- seminar-final 02/06/07/08 + trace matrix 표현이 동일
- "표준 vs 확장" 구분이 명확

---

## 7. 빠른 시작 체크리스트 (다음 세션 첫 30분)

- [ ] `apps/wallet-extension/src/background/rpc/paymaster.ts`에서 `isFinal` 파싱 추가
- [ ] `eth_sendUserOperation` 경로의 sponsorship 순서 리팩터링
- [ ] `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts`의 `isFinal` 정책 정의
- [ ] `wallet-extension`/`paymaster-proxy` 테스트 추가
- [ ] seminar-final 문구 동기화 최종 점검

