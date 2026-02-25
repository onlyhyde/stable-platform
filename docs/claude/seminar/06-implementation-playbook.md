# 06. 구현 플레이북 (개발자용)

## 배경
스펙을 이해해도 실제 구현에서는 파라미터 누락, 경계 조건, 운영 이슈에서 실패가 난다.

## 문제
- UserOperation 필드 인코딩 오류
- simulate 성공/실제 제출 실패 불일치
- 모듈 권한 관리 누락
- paymaster 리스크(과금/도배) 통제 실패

## 해결: 단계별 체크리스트

### 1) 계정/전환 계층
- 7702 authorization 생성/검증 테스트
- delegation 대상 코드 해시/버전 검증
- 전환 직후 초기화 트랜잭션 원자성 점검

### 2) 모듈 계층(7579)
- Validator/Executor/Hook/Fallback 호출 순서 테스트
- install/uninstall 권한 분리(Owner, Guardian, Session)
- 모듈 제거 시 잔여 권한/스토리지 정리 테스트

### 3) 실행 파이프라인(4337)
- `accountGasLimits`, `gasFees` 패킹 단위 테스트
- `simulateValidation` 실패 코드 매핑
- paymaster 사용/미사용 경로 각각 E2E 검증

### 4) 운영 계층
- Bundler 장애/지연 시 재시도 정책
- 실패율, 리버트 원인, 가스 편차 모니터링
- 체인별 EntryPoint/정책 구성 분리

## 실패 패턴과 대응
- 증상: nonce 충돌  
원인: key-sequence 관리 부재  
대응: nonce key 정책 문서화 및 서버 단 일관성 보장

- 증상: 특정 모듈 설치 후 실행 실패  
원인: hook/validator 순서 가정 불일치  
대응: 실행 경로 통합 테스트와 이벤트 트레이싱

- 증상: paymaster 비용 급증  
원인: 정책 없는 스폰서십  
대응: rate limit, allowlist, quota, 서명 정책 적용

## 최소 출시 기준(MVP)
- 7702 전환 성공/복구 시나리오
- 4337 userOp 송신/실행/정산 E2E
- 7579 모듈 1개 이상 설치/제거/재설치
- 실패 케이스(서명 오류, 가스 부족, 정책 위반) 회귀 테스트
