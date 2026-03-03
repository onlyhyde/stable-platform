# 03. ERC-4337 버전 변천: v0.6 -> v0.9 (상세판)

## 1) 왜 변천사를 반드시 설명해야 하는가

현업 개발자는 스펙 문서만 보지 않는다. 오픈소스 구현체, SDK, 인프라가 서로 다른 시점의 버전을 반영한다. 따라서 "왜 바뀌었는지"를 이해하지 못하면, 필드/해시/검증 로직에서 쉽게 불일치가 발생한다.

## 2) 변천 요약

- v0.6 (Final 표준으로 많이 인식)
- 기반을 확립했지만, 실전 운영에서 개선 포인트 다수 노출

- v0.7
- Packed 포맷/가스 필드 구조/검증 경계 개선

- v0.9 (현재 본 프로젝트 기준)
- EIP-712 기반 해시 정렬 강화
- 7702 initCode 경로 통합 지원
- 실행/정산 관련 안정성 강화

## 3) 이번 프로젝트에서 v0.9를 기준으로 잡은 이유

1. 7702 통합 흐름을 실습 중심으로 설명하기 용이
2. 7579 Kernel과 결합 시 검증/실행 경로 표현이 명확
3. SDK-지갑-서비스 레이어를 하나의 해시/패킹 규칙으로 통일 가능

## 4) 코드에서 확인되는 v0.9 정렬 포인트

### 4.1 UserOp Hash (EIP-712)

- TS SDK: `stable-platform/packages/sdk-ts/core/src/utils/userOperation.ts`
- Go SDK: `stable-platform/packages/sdk-go/core/userop/hash.go`
- EntryPoint: `poc-contract/src/erc4337-entrypoint/EntryPoint.sol`

공통 핵심:

- 도메인: name=`ERC4337`, version=`1`, chainId, verifyingContract=EntryPoint
- struct hash 후 `\x19\x01 || domainSeparator || structHash`

### 4.2 7702 initCode 경로

- EntryPoint는 `initCode` 시작부가 `0x7702` marker일 때 별도 분기
- 코드: `poc-contract/src/erc4337-entrypoint/Eip7702Support.sol`

## 5) v0.6 코드/문서와 섞일 때 발생하는 대표 문제

- 해시 불일치: 서명 검증 실패
- paymaster 필드 파싱 오해: `paymasterAndData` 분해 오류
- gas 추정 오해: preVerificationGas/verificationGasLimit 기준 혼동
- 이벤트 기반 추적 불일치: receipt 조회 실패

## 6) 세미나에서 강조할 "호환성" 메시지

- "Final" 문구만으로 충분하지 않다.
- 실제 구현은 버전 차이를 포함한다.
- 따라서 팀 내 기준 버전(여기서는 v0.9)을 명시하고, 모든 레이어를 그 기준으로 동기화해야 한다.

## 7) 마이그레이션 체크리스트 (요약)

- EntryPoint 주소/ABI/해시 계산 로직 통일
- SDK TS/Go의 pack/unpack 로직 동일성 확인
- Wallet/DApp이 보내는 RPC payload 포맷 고정
- Bundler/Paymaster가 기대하는 chainId, hex 포맷 고정
- 통합 테스트에 `eth_getUserOperationReceipt` 경로 포함

## 8) 현재 코드 검토 시 확인된 주의 지점

- Go SmartAccount 전략(`stable-platform/packages/sdk-go/transaction/strategies/smart_account.go`)은
  - 기본 EntryPoint 주석/상수에 과거 버전 표기가 남아 있고,
  - `Nonce: 0` placeholder 경로가 남아 있어,
  - 세미나에서는 "TS 구현이 기준, Go는 보강 필요"로 명확히 구분 설명이 필요하다.

## 9) 발표 문장

- "4337은 하나의 고정 스냅샷이 아니라, 운영 이슈와 확장 요구를 반영해 진화해왔다."
- "지금 중요한 건 v0.9 기준으로 전 레이어를 정렬해 재현 가능한 개발 체계를 만드는 것이다."
