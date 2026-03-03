# Docs Audit And Cleanup Plan (2026-03-02)

## Scope

- 대상: `stable-platform/docs/` 하위 Markdown 문서 전체
- 총 문서 수: **150**
- 목적:
  - 오래된 문서/중복 문서 식별
  - canonical 정본 경로 확정
  - 세미나 준비를 위한 실행 계획 정리

## Method (Automated + Spot Review)

다음 기준으로 전수 스캔 후 핵심 문서는 수동 확인했다.

1. 디렉터리/파일 인벤토리 및 수량 집계
2. stale signal 검색:
   - `v0.6`, `v0.7`, `0x9fE467...`, `0xCf7Ed3...`, `TBD`, `TODO`, `deprecated`
3. 동일 basename 중복 탐지
4. 세미나 관련 문서군(`claude`, `claude/seminar`, `seminar-7702-4337-7579`, `seminar-deck`) 교차 확인

## Inventory Snapshot

- 상위 분포(파일 수):
  - `docs/claude`: 44
  - `docs/simulator`: 24
  - `docs/seminar-7702-4337-7579`: 17
  - `docs/stable`: 15
  - `docs/seminar-deck`: 9
  - `docs/poc`: 8

## Major Findings

### F1) 동일 주제 다중 세트 운영 (정합성 위험)

- 세미나 주제가 세 군데 이상으로 분산:
  - `docs/claude/00~09`
  - `docs/seminar-7702-4337-7579/00~15`
  - `docs/claude/seminar/00~08(+paymaster)`
- 결과: 버전/주소/흐름 설명이 서로 달라질 가능성이 높음.

### F2) 일부 문서의 구버전(v0.7) 표기 잔존

대표 사례:
- `docs/SMART_WALLET_ARCHITECTURE.md`
- `docs/poc/02_Smart_Contracts.md`
- `docs/poc/05_Project_Structure.md`
- `docs/claude/04-7702-7579-with-4337.md`
- `docs/claude/spec/ERC4337_EIP7702_COMPLETE_FLOW_KO.md`
- `docs/claude/spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM_KO.md`

### F3) 주소 하드코딩/구주소 잔존

대표 사례:
- `0x9fE467...` / `0xCf7Ed3...` 등 로컬 샘플 주소 기반 설명 잔존 파일 존재
- 최신 generated 주소 기반 문서와 불일치 가능

### F4) 세미나 문서 번호 체계 혼선

- `docs/claude/seminar/`에 `07-*` 파일 2개가 존재:
  - `07-real-use-cases-and-architecture-mapping.md`
  - `07-seminar-lab-and-qa.md`
- `08-seminar-lab-and-qa.md`도 존재하여 순서 체계가 불명확

### F5) 날짜 고정 리뷰/분석 문서의 active 혼입

- `docs/review/PROJECT_REVIEW_2025-02-11.md`
- `docs/review/CODE_REVIEW_REPORT_2025-02-09.md`
- 운영 문서 탐색 시 active 문서로 오해될 여지

## Canonical Decision (Proposed)

### Active (정본)

1. Smart Account 표준/플로우:
   - `docs/claude/spec/`
2. 세미나 내러티브:
   - `docs/claude/seminar/`
3. 세미나 슬라이드 원본:
   - `docs/seminar-deck/*.marp.md`

### Legacy (보관)

1. `docs/seminar-7702-4337-7579/`
2. `docs/claude/00~09`
3. `docs/review/` (날짜 고정 리포트)

## Cleanup Plan

### Phase 1 (즉시, 1~2일)

1. 루트 문서 허브(`docs/README.md`)로 canonical 경로 명시
2. legacy 디렉터리 README에 보관 상태와 대체 경로 링크 명시
3. 세미나 운영 준비 문서(리허설/실습/데모 체크리스트) 작성

### Phase 2 (단기, 3~5일)

1. `docs/claude/spec/*_KO.md`를 최신 EN 기준으로 동기화
2. `docs/services/README.md` / `docs/sdk/api/README.md`의 주소/버전 샘플 최신화
3. `docs/claude/seminar/` 번호 체계 정리(07 중복 해소)

### Phase 3 (중기, 1주)

1. legacy 문서 헤더에 `Legacy` 배지 추가(자동 스크립트 권장)
2. 문서 CI 체크 도입:
   - stale address 패턴
   - forbidden version label 패턴
   - broken internal link 탐지

## Seminar Preparation Readiness

- 세미나 준비 실행 문서:
  - `docs/seminar-deck/SEMINAR_PREP_PLAN_2026-03-02.md`
- 핵심 메시지 구조:
  - Track A: 현재 구현
  - Track B: 목표 확장 로드맵(M1~M6)

## Done In This Pass

1. 문서 허브 추가: `docs/README.md`
2. 세미나 준비 계획 추가: `docs/seminar-deck/SEMINAR_PREP_PLAN_2026-03-02.md`
3. legacy 세트 안내 업데이트:
   - `docs/seminar-7702-4337-7579/README.md`
   - `docs/claude/README.md`

