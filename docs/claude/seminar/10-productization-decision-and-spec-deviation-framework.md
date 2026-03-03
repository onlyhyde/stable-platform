# 10. 제품화 의사결정과 스펙 편차 프레임워크 (상세판)

## 1) 왜 필요한가

PoC는 "가능성 검증"이 목표이고, 제품은 "지속 운영"이 목표다. 따라서 스펙 준수 자체보다 중요한 것은, 어떤 항목을 왜 유지/편차할지 추적 가능한 방식으로 결정하는 것이다.

## 2) 의사결정 원칙

- 원칙 1: 기본값은 스펙 준수
- 원칙 2: 편차는 반드시 문서화
- 원칙 3: 편차는 롤백 가능하게 설계
- 원칙 4: 보안/운영 비용을 수치로 평가

## 3) 의사결정 4단계

1. 문제 정의
- 어떤 사용자/운영 문제를 해결하려는지 명시

2. 스펙 기준선 확인
- EIP MUST/SHOULD 항목과 현재 코드 위치 연결

3. 편차 설계
- 편차 내용, 기대 이득, 리스크, 모니터링 지표 정의

4. 통제 계획
- feature flag, 점진 rollout, rollback 시나리오 정의

## 4) 편차 기록 템플릿

- 항목명
- 기준 스펙
- 현재 구현
- 편차 여부 (Yes/No)
- 편차 사유
- 보안 영향
- 호환성 영향
- 운영 지표
- 롤백 방법
- 책임자/검토일

## 5) 이번 코드베이스에 적용 가능한 대표 의사결정 항목

- Paymaster 정책
- 공개 mempool 호환성을 우선할지, 내부/허가형 환경 최적화를 우선할지

- Module 강제 해제 정책
- uninstall revert를 어떻게 운영 정책으로 다룰지

- SDK 정렬 전략
- TS를 레퍼런스로 삼고 Go를 추격 정렬할지

- Wallet API 범위
- `stablenet_*` custom RPC를 어디까지 공개할지

## 6) 위험 분류 프레임

- P0: 보안/자금 손실 위험
- P1: 호환성/실행 실패 위험
- P2: UX/운영 비용 증가
- P3: 문서/가이드 불일치

## 7) 제품화 준비 체크리스트

- 스펙-코드 trace matrix 최신화
- 에러 코드/운영 런북 문서화
- SDK 버전 정책(semver + migration note)
- 관측 지표(성공률, 실패코드, 정산 누락) 대시보드
- 보안 리뷰(권한, nonce, replay, delegatecall 정책)

## 8) 세미나에서 전달할 메시지

- "스펙을 정확히 이해한 팀만이, 의도적으로 스펙에서 벗어날 수 있다."
- "편차는 실력이 아니라 책임이다. 기록과 복구 계획이 없으면 편차가 아니라 장애다."

## 9) 코드 근거

- `stable-platform/docs/claude/spec/EIP-4337_7579_통합_스펙준수_보고서.md`
- `stable-platform/packages/sdk-go/transaction/strategies/smart_account.go`
- `poc-contract/src/erc7579-smartaccount/Kernel.sol`
- `poc-contract/src/erc4337-paymaster/*.sol`
