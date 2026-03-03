# StableNet Documentation Hub

이 문서는 `stable-platform/docs/` 전체의 정본(canonical) 경로와 문서 상태를 정의한다.

## 1) Canonical Sources (현재 기준)

### Smart Account / AA 표준
- Canonical spec set: `docs/claude/spec/`
- 핵심 플로우(최신 반영):
  - `docs/claude/spec/ERC4337_EIP7702_COMPLETE_FLOW.md`
  - `docs/claude/spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM.md`

### 세미나(개발자 대상)
- Canonical seminar narrative: `docs/claude/seminar/`
- Canonical deck source: `docs/seminar-deck/*.marp.md`
- Seminar execution plan: `docs/seminar-deck/SEMINAR_PREP_PLAN_2026-03-02.md`

### 서비스/시뮬레이터/API
- Services: `docs/services/README.md`
- Simulator: `docs/simulator/README.md`
- SDK API: `docs/sdk/api/README.md`

## 2) Legacy / Historical Sets

아래 경로는 참고용 보관 문서로 간주한다. 신규 작성/수정 시 정본 경로를 우선한다.

- `docs/seminar-7702-4337-7579/`
- `docs/claude/00-overview.md` ~ `docs/claude/09-compatibility-with-existing-contracts.md`
- 날짜 고정 리뷰 문서: `docs/review/`

## 3) Current Risks (Audit Summary)

상세 보고서: `docs/DOCS_AUDIT_AND_CLEANUP_PLAN_2026-03-02.md`

핵심 리스크:
- 동일 주제 문서군이 다중 디렉터리에 분산되어 정합성 붕괴 위험
- 일부 문서의 `EntryPoint v0.7`/구주소/구시퀀스가 최신 구현(v0.9 + 7702 경로)와 불일치
- 세미나 문서 번호 체계 중복(예: `07-*`)로 발표 흐름 혼선 가능

## 4) Documentation Policy

신규 문서 작성/수정 시 다음 원칙을 따른다.

1. 기술 정합성 기준은 코드와 최신 canonical spec 문서를 우선한다.
2. 같은 주제는 하나의 canonical 파일만 운영하고, 나머지는 링크/보관으로 정리한다.
3. 주소, 버전, 해시 공식은 하드코딩 대신 generated source 또는 명시된 기준 파일을 참조한다.
4. 세미나 자료는 `narrative(claude/seminar)`와 `deck(marp)`를 분리하되 번호 체계는 동일하게 맞춘다.

