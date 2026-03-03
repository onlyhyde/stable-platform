# Seminar Prep Plan (2026-03-02)

## Objective

Smart Account 세미나를 **재현 가능한 데모 + 일관된 스토리라인**으로 운영한다.

핵심 목표:
1. 개발자가 4337/7702/7579 조합의 필요성과 동작 흐름을 이해
2. 현재 구현(Track A)과 확장 아키텍처(Track B)를 명확히 구분
3. 실습/질의응답에서 실패 없는 데모 수행

## Canonical Source Set

발표/리허설 기준 문서:

- Story:
  - `docs/claude/seminar/00-seminar-goal-and-decision-frame.md`
  - `docs/claude/seminar/01-evm-account-model-and-eoa-limit.md`
  - `docs/claude/seminar/02-erc4337-philosophy-actors-and-flow.md`
  - `docs/claude/seminar/03-erc4337-version-history-v06-to-v09.md`
  - `docs/claude/seminar/04-eip7702-delegation-and-type4-transaction.md`
  - `docs/claude/seminar/05-erc7579-modular-account-and-lifecycle.md`
  - `docs/claude/seminar/06-fee-models-self-sponsored-erc20-settlement.md`
  - `docs/claude/seminar/07-transaction-cookbook-wiring-guide.md`
  - `docs/claude/seminar/08-codebase-mapping-wallet-dapp-sdk-services-contract.md`
  - `docs/claude/seminar/09-poc-demo-script-and-failure-recovery.md`
  - `docs/claude/seminar/10-productization-decision-and-spec-deviation-framework.md`
  - `docs/claude/seminar/11-seminar-lab-checklist-and-qa.md`
  - `docs/claude/seminar/SEMINAR_SPEC_CODE_TRACE_MATRIX_KO_2026-03-02.md`
  - `docs/claude/seminar/SEMINAR_TRANSACTION_COOKBOOK_KO_2026-03-02.md`
  - `docs/claude/seminar/SEMINAR_QA_30_KO_2026-03-02.md`

- Flow/Spec:
  - `docs/claude/spec/EIP-4337_스펙표준_정리.md`
  - `docs/claude/spec/EIP-7579_스펙표준_정리.md`
  - `docs/claude/spec/EIP-7702_스펙표준_정리.md`
  - `docs/claude/spec/ERC4337_EIP7702_COMPLETE_FLOW.md`
  - `docs/claude/spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM.md`

- Slides:
  - `docs/seminar-deck/00-master-deck-30-slides.marp.md`
  - `docs/seminar-deck/01-track-bd.marp.md`
  - `docs/seminar-deck/04-track-engineering-v2.marp.md`
  - `docs/seminar-deck/03-track-cto.marp.md`
  - `docs/seminar-deck/SEMINAR_V2_SLIDE_SYNC_KO_2026-03-02.md`

## Workstreams

## WS1. Content Consistency Lock

1. Track A/Track B 구분 문구를 덱 첫 3장에 고정
2. EntryPoint 버전 표기를 전 슬라이드에서 v0.9 기준으로 통일
3. 구주소/구시퀀스(legacy 예시) 제거 또는 "historical" 표기
4. v2 세미나 본문(00~11)과 Engineering v2 덱의 섹션 번호를 1:1 동기화

Exit criteria:
- 30장 기준 “v0.7 current-state” 오해를 유발하는 표현 0건

## WS2. Demo Reliability

1. delegation(type-4) 선행 단계 스크립트와 handleOps 단계 스크립트 분리
2. 데모 전 체크리스트:
   - chain id
   - EntryPoint/Kernel/paymaster 주소
   - USDC allowance
   - paymaster deposit
3. 실패 시 fallback 데모(사전 녹화 or 로그 기반 walk-through) 준비
4. 실패 복구는 `09-poc-demo-script-and-failure-recovery.md` 순서로 즉시 실행

Exit criteria:
- 리허설 3회 연속 성공

## WS3. Q&A Readiness

예상 질문과 답변 준비:

1. "왜 7702가 필요한가?"
2. "4337만으로 안 되는 것은 무엇인가?"
3. "7579 모듈 구조가 운영에서 주는 이점은?"
4. "v0.6 -> v0.9 변경 이유는?"
5. "실서비스 전환 시 보안/운영 리스크는?"

Exit criteria:
- 15분 Q&A 모의 세션 2회 수행

## WS4. Audience Track Split

1. BD 트랙: 비즈니스 임팩트/도입 전략 중심
2. Engineering 트랙: nonce/hash/execution/detail 중심
3. CTO 트랙: 리스크/운영/조직 전개 중심

Exit criteria:
- 트랙별 슬라이드 목표(메시지/콜투액션) 한 줄로 요약 가능

## Timeline (Suggested)

1. D-5: 문서 정합성 고정(WS1)
2. D-4 ~ D-3: 데모 스크립트/리허설(WS2)
3. D-2: Q&A 모의 세션(WS3)
4. D-1: 트랙별 최종 덱 freeze(WS4)
5. D-Day: 발표 + 실습 + 피드백 수집

## Preflight Checklist (D-Day)

1. 최신 canonical 문서 링크 확인
2. v2 문서와 덱 동기화 문서(`SEMINAR_V2_SLIDE_SYNC_KO_2026-03-02.md`) 확인
2. 발표용 PDF 생성 완료(Marp)
3. 데모 계정/토큰/가스 상태 확인
4. 네트워크 장애 대비 대체 플랜 준비
5. 세션 녹화/로그 수집 경로 준비

## Post-Seminar Outputs

1. Q&A 로그 정리본
2. 수정 필요 문서 이슈 목록
3. Track B 구현 백로그(M1~M6) 우선순위 업데이트
