# 8) 다른 지갑 권한 위임(validator/executor, 대체 키 허용) 기술과 장단점

## 목표
- 주 지갑 외에 세션키/서브키/다른 지갑에 제한 권한 부여
- 자동화 트랜잭션(구독, 봇, 결제) 수행

## 권한 위임 모델
```mermaid
flowchart LR
  OW[Owner Key] --> RV[Root Validator]
  RV --> PV[Permission Validator/Signer]
  PV --> SK[Session Key]
  SK --> EX[Executor]
  EX --> TX[Limited Transactions]
```

## 구현 패턴
- Validator 분리: root(강권한) vs permission(약권한)
- Selector 제한: 특정 함수만 허용
- 금액/시간 제한: policy 모듈 및 off-chain policy 동시 적용
- 폐기 전략: nonce invalidation + module uninstall

## 장점
- UX 개선: 반복 승인 감소
- 운영 효율: 자동화/백그라운드 실행
- 보안 분리: 주 키 노출 최소화

## 단점/리스크
- 정책 복잡도 증가
- 과도한 권한 부여 시 피해 범위 확대
- 키 관리 표면 확장(분실/탈취 포인트 증가)

## 필수 통제
| 통제 | 이유 |
|---|---|
| 세션키 만료시간 | 장기 노출 완화 |
| 함수/토큰/금액 제한 | 권한 남용 방지 |
| 긴급 회수 트랜잭션 | 사고시 즉시 차단 |
| 감사로그/알림 | 이상징후 조기탐지 |
