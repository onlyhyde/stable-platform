# Seminar v2 슬라이드 동기화 맵 (KO)

작성일: 2026-03-02

## 목적

`docs/claude/seminar` v2 본문과 발표 덱의 1:1 매핑을 고정한다.

## 매핑 표

| 세미나 본문(v2) | 슬라이드 섹션 | 비고 |
|---|---|---|
| `00-seminar-goal-and-decision-frame.md` | 오프닝/목표 | 발표 목적 합의 |
| `01-evm-account-model-and-eoa-limit.md` | 문제 정의 | EOA 한계 |
| `02-erc4337-philosophy-actors-and-flow.md` | 4337 핵심 | actor/flow |
| `03-erc4337-version-history-v06-to-v09.md` | 변천사 | Final vs 구현 버전 |
| `04-eip7702-delegation-and-type4-transaction.md` | 7702 핵심 | type-4 / auth nonce |
| `05-erc7579-modular-account-and-lifecycle.md` | 7579 핵심 | module lifecycle |
| `06-fee-models-self-sponsored-erc20-settlement.md` | 수수료 모델 | self/sponsor/erc20 |
| `07-transaction-cookbook-wiring-guide.md` | 구현 가이드 | 모드별 wiring |
| `08-codebase-mapping-wallet-dapp-sdk-services-contract.md` | 코드맵 | 역할 분리 |
| `09-poc-demo-script-and-failure-recovery.md` | 라이브 데모 | 실패 복구 |
| `10-productization-decision-and-spec-deviation-framework.md` | 제품화 의사결정 | 편차 프레임워크 |
| `11-seminar-lab-checklist-and-qa.md` | 실습/Q&A | 운영 체크리스트 |

## 권장 덱 사용

1. Master intro: `00-master-deck-30-slides.marp.md` (개요)
2. Engineering 본발표: `04-track-engineering-v2.marp.md` (주 발표)
3. Track 분기:
   - BD: `01-track-bd.marp.md`
   - CTO: `03-track-cto.marp.md`

## 동기화 규칙

1. EntryPoint 표기는 v0.9 기준으로 통일한다.
2. "스펙 Final"과 "참조 구현 버전"은 슬라이드에서 분리 표기한다.
3. 파라미터 표(`nonce/hash/gas/paymasterData`) 없는 슬라이드는 구현 세션에서 사용하지 않는다.
4. PARTIAL 항목은 FAQ 슬라이드에 공개한다.
