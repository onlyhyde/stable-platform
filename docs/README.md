# StableNet Documentation Hub

> Last updated: 2026-03-08

이 문서는 `stable-platform/docs/` 전체의 정본(canonical) 경로와 문서 상태를 정의한다.

---

## 1) Canonical Sources (정본)

### Smart Account / AA 표준 스펙

정본 경로: `claude/spec/`

| 문서 | 설명 |
|------|------|
| `EIP-4337_스펙표준_정리.md` | EIP-4337 스펙 (v0.6~v0.9 변동 히스토리 포함) |
| `ERC-4337-기술-가이드.md` | ERC-4337 공식 Final 스펙 기준 (v0.6) 기술 가이드 |
| `EIP-7579_스펙표준_정리.md` | ERC-7579 모듈러 계정 스펙 |
| `EIP-7702_스펙표준_정리.md` | EIP-7702 코드 위임 스펙 |
| `EIP-4337_Paymaster_개발자_구현가이드.md` | Paymaster 구현 가이드 |
| `ERC4337_EIP7702_COMPLETE_FLOW.md` | ERC-4337 + EIP-7702 통합 플로우 (EN) |
| `ERC4337_EIP7702_SEQUENCE_DIAGRAM.md` | 시퀀스 다이어그램 (EN) |
| `ERC7677_ANALYSIS.md` | ERC-7677 Paymaster 웹 서비스 분석 |
| `transaction-format.md` | ERC-7579 execute() 인코딩 레퍼런스 |

감사/준수 보고서:

| 문서 | 설명 |
|------|------|
| `EIP-4337_7579_통합_스펙준수_보고서.md` | 통합 스펙 준수 감사 |
| `EIP-4337_7579_코드정합성_검토결과_2026-03-02.md` | 컨트랙트 코드 정합성 |
| `SDK_코드정합성_검토결과_2026-03-02.md` | SDK 코드 정합성 |
| `EIP-7579_컨트랙트_준수_감사표.md` | ERC-7579 컨트랙트 체크리스트 (67/68 통과) |

운영/가이드:

| 문서 | 설명 |
|------|------|
| `EIP-7702_4337_7579_ERC20Paymaster_메시지플로우.md` | 통합 메시지 플로우 |
| `EIP-7702_4337_7579_ERC20Paymaster_운영체크리스트.md` | 운영 체크리스트 |
| `EIP-7579_주니어개발자_온보딩가이드.md` | 주니어 개발자 온보딩 |
| `Roadmap.md` | 잔여 작업 및 로드맵 |

### 세미나 (개발자 대상)

| 경로 | 역할 |
|------|------|
| `claude/seminar-final/` (00~09) | 기술 내러티브 정제본 (학습용) |
| `claude/seminar/` (00~11) | 운영 자료: 실습, 스크립트, 데모, 쿡북 |
| `claude/seminar/paymaster/` (00~06) | Paymaster 스펙/적합성 테스트 자료 |
| `seminar-deck/*.marp.md` | 프레젠테이션 슬라이드 (BD/Engineering/CTO 트랙) |

### 제품/아키텍처

| 경로 | 설명 |
|------|------|
| `prd/StableNet_PRD.md` | 제품 요구사항 정의서 |
| `architecture/` | 정보 아키텍처, 월렛 아키텍처 |
| `roadmap/StableNet_기술_로드맵.md` | 24개월 기술 로드맵 |
| `specs/StableNet_기술_스택.md` | 기술 스택 명세 |
| `poc/` (00~08) | PoC 설계 문서 (시스템/컨트랙트/브릿지/규제) |
| `eip/ERC-4337.md` | ERC-4337 원문 기준 스펙 |

### 서비스/운영

| 경로 | 설명 |
|------|------|
| `services/README.md` | 마이크로서비스 API 레퍼런스 (8개 서비스) |
| `services/SRS_Contract_Registry_Service.md` | Contract Registry SRS |
| `operations/README.md` | 운영 가이드 (모니터링/알림/장애대응) |
| `operations/deployment.md` | 배포 가이드 (Docker/K8s/환경설정) |
| `operations/VULNERABILITY_REMEDIATION.md` | 보안 취약점 추적 (28건 해결, 0건 미해결) |

### SDK/튜토리얼

| 경로 | 설명 |
|------|------|
| `sdk/api/README.md` | SDK API 레퍼런스 |
| `sdk/00_SDK_OVERVIEW.md` | SDK 개요 |
| `sdk/01_CONTRACT_SDK_MAPPING.md` | 컨트랙트-SDK 매핑 |
| `sdk/02_SDK_REMAINING_TASKS.md` | SDK 잔여 작업 |
| `tutorials/getting-started.md` | 시작 가이드 |

### 시뮬레이터

| 경로 | 설명 |
|------|------|
| `simulator/README.md` | 시뮬레이터 개요 |
| `simulator/bank-simulator/` | 은행 시뮬레이터 (계좌/입출금/자동이체) |
| `simulator/onramp-simulator/` | 온램프 시뮬레이터 (KYC/결제/환율) |
| `simulator/pg-simulator/` | PG 시뮬레이터 (체크아웃/정산) |

### 기술 조사/리서치

| 경로 | 설명 |
|------|------|
| `research/README.md` | 리서치 문서 인덱스 |
| `research/Alto_vs_AccountAbstraction_분석.md` | Bundler vs Contract Library |
| `research/Privacy_Protocol_조사_Umbra_Railgun.md` | Stealth Address 프로토콜 |
| `research/Transaction_Priority_조사_MEV_PrivateMempool.md` | MEV/Private Mempool |
| `research/wallet-reference.md` | 오픈소스 지갑 서베이 |
| `research/STEALTH_SDK_COMPARISON.md` | Stealth SDK 구조 비교 |
| `research/STEALTH_PLUGIN_COMPARISON.md` | Stealth Plugin re-export 분석 |
| `research/tempo-reth/` | Tempo Reth 실행 클라이언트 평가 |

### StableNet 전략 분석

경로: `stable/` (15개 문서) — 경쟁사 분석, 규제 검토, 파트너십 전략, 차별점 분석 등

### 루트 파일

| 파일 | 설명 |
|------|------|
| `ASSET_MANAGEMENT_IMPLEMENTATION.md` | Wallet Extension 자산 관리 설계 |
| `EIP7702_Subscription_Implementation_Plan.md` | 구독 결제 구현 계획서 |
| `ERC7579_SUPPORTED_PROJECTS.md` | 워크스페이스 내 ERC-7579 지원 프로젝트 정리 |
| `DOCS_AUDIT_AND_CLEANUP_PLAN_2026-03-02.md` | 문서 감사 및 정리 계획 |

---

## 2) Legacy / Archived

참고용 보관 문서: `_legacy/`

| 경로 | 원래 위치 | 대체 정본 |
|------|-----------|-----------|
| `_legacy/seminar-v1/` | `seminar-7702-4337-7579/` | `claude/seminar-final/` |
| `_legacy/claude-root/` | `claude/00~12-*.md` | `claude/seminar-final/` |
| `_legacy/seminar-drafts/` | `claude/seminar/` 초안 13개 | `claude/seminar-final/` |
| `_legacy/review/` | `review/` | (날짜 고정 스냅샷) |
| `_legacy/ENTRYPOINT_COMPLIANCE_REVIEW.md` | 루트 | `claude/spec/` |
| `_legacy/ERC4337_COMPLIANCE_REVIEW.md` | 루트 | `claude/spec/` |

삭제된 파일:
- `claude/spec/ERC4337_EIP7702_COMPLETE_FLOW_KO.md` — EN 원본의 미동기화 번역본
- `claude/spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM_KO.md` — EN 원본의 미동기화 번역본

---

## 3) Known Issues

| 상태 | 항목 |
|------|------|
| ~~해결~~ | 동일 주제 문서군 다중 디렉토리 분산 (2026-03-08) |
| ~~해결~~ | 세미나 문서 번호 체계 중복 (2026-03-08) |
| 잔존 | 일부 문서의 `EntryPoint v0.7`/구주소가 최신(v0.9)과 불일치 가능 |

상세: `DOCS_AUDIT_AND_CLEANUP_PLAN_2026-03-02.md`

---

## 4) Documentation Policy

1. 기술 정합성 기준은 코드와 최신 canonical spec 문서(`claude/spec/`)를 우선한다.
2. 같은 주제는 하나의 canonical 파일만 운영하고, 나머지는 `_legacy/`로 보관한다.
3. 주소, 버전, 해시 값은 하드코딩 대신 generated source 또는 명시된 기준 파일을 참조한다.
4. 세미나: `seminar-final/`(내러티브) + `seminar/`(운영) + `seminar-deck/`(슬라이드) 분리 운영.
5. 신규 조사/분석 문서는 `research/`에, 구현 계획서는 루트에 배치한다.

