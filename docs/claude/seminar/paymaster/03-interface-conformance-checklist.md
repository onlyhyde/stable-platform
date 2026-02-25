# [03] Paymaster 인터페이스 정합 체크리스트

작성일: 2026-02-24  
기준: `00-paymaster-final-spec-and-implementation.md`

## 1. 목표

- Contract/Proxy/SDK 간 바이트/해시/정책 정합을 릴리즈 전에 차단한다.

## 2. 필수 정합 항목

1. 포맷 정합
- proxy 생성 `paymasterData`가 contract 파서 기대값과 byte-level 동일

2. 해시 정합
- proxy/SDK hash == contract hash fixture 동치

3. 타입 정합
- verifying/sponsor/erc20/permit2 각 타입 payload decode 성공

4. 정산 정합
- reservation -> receipt settle/cancel 일관성

5. 경계 검증
- supported chain
- EntryPoint allowlist

## 3. 실패 케이스

- 만료(validUntil)
- 서명 불일치
- unsupported paymasterType
- unsupported token
- permit/allowance 실패
- postOp 실패

## 4. 릴리즈 게이트

- 모든 필수 정합 항목 PASS
- 실패 케이스 의도대로 차단
- 회귀 테스트 100% 통과
