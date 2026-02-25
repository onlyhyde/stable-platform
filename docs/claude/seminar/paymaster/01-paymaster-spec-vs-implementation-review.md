# [01] Paymaster 스펙 경계 리뷰

작성일: 2026-02-24  
목적: EIP-4337에서 정의한 범위와 서비스 구현 범위를 명확히 분리한다.

## 1. 스펙 정의 영역

- EntryPoint 호출 프레임
  - `validatePaymasterUserOp`
  - `postOp`
- `paymasterAndData`의 위치/파싱
- deposit/stake 및 validationData 처리

## 2. 서비스 구현 영역 (스펙 예외)

- `paymasterData` 내부 ABI 규약
- 타입별 정책(Verifying/Sponsor/ERC20/Permit2)
- 오프체인 서명 발급 및 정책 API
- userOpHash 기반 후정산
- 운영 지표/알람

## 3. 구현 책임 분리

| 레이어 | 책임 |
|---|---|
| Contract | on-chain 검증/정산, 입력 검증, validationData 반환 |
| Proxy | policy 검증, paymasterData 생성, reservation 추적 |
| SDK | 인코딩/해싱 유틸, 클라이언트 재사용 API |
| Ops | 모니터링, top-up, incident 대응 |

## 4. 결론

EIP-4337은 "호출 프레임"을 정의하고, 실제 제품 동작(정책/회계/리스크)은 서비스 구현으로 완성한다.  
개발자는 이 경계를 전제로 Contract/Proxy/SDK를 분리 설계해야 한다.
