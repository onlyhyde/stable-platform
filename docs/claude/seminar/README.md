# Smart Account Seminar Docs (KO, 상세판)

이 디렉터리는 Smart Account 세미나 정본 문서 세트다.

세미나 목적:

- Smart Account를 구성하는 표준(ERC-4337, EIP-7702, ERC-7579)을 배경부터 구현까지 설명
- 실제 코드에서 트랜잭션/UserOp를 어떻게 구성하고 전송하는지 재현 가능한 형태로 전달
- 스펙 준수와 제품화 편차 의사결정을 분리해서 전달

## 권장 읽기 순서 (v2 Canonical)

1. `00-seminar-goal-and-decision-frame.md`
2. `01-evm-account-model-and-eoa-limit.md`
3. `02-erc4337-philosophy-actors-and-flow.md`
4. `03-erc4337-version-history-v06-to-v09.md`
5. `04-eip7702-delegation-and-type4-transaction.md`
6. `05-erc7579-modular-account-and-lifecycle.md`
7. `06-fee-models-self-sponsored-erc20-settlement.md`
8. `07-transaction-cookbook-wiring-guide.md`
9. `08-codebase-mapping-wallet-dapp-sdk-services-contract.md`
10. `09-poc-demo-script-and-failure-recovery.md`
11. `10-productization-decision-and-spec-deviation-framework.md`
12. `11-seminar-lab-checklist-and-qa.md`
13. `12-seminar-script-90min-final.md`
14. `13-demo-rehearsal-runbook.md`
15. `14-developer-lab-handbook-rpc-code-templates.md`

## 함께 보는 보조 문서

- `SEMINAR_REBUILD_MASTER_PLAN_2026-03-02.md`
- `SEMINAR_SPEC_CODE_TRACE_MATRIX_KO_2026-03-02.md`
- `SEMINAR_TRANSACTION_COOKBOOK_KO_2026-03-02.md`
- `SEMINAR_QA_30_KO_2026-03-02.md`

## 근거 스펙 문서

- `../spec/EIP-4337_스펙표준_정리.md`
- `../spec/EIP-4337_Paymaster_개발자_구현가이드.md`
- `../spec/EIP-7579_스펙표준_정리.md`
- `../spec/EIP-7702_스펙표준_정리.md`
- `../spec/EIP-4337_7579_통합_스펙준수_보고서.md`
- `../spec/ERC4337_EIP7702_COMPLETE_FLOW.md`
- `../spec/ERC4337_EIP7702_SEQUENCE_DIAGRAM.md`

## 참고(과거 버전 문서)

- `../../seminar-7702-4337-7579/` 하위 문서는 과거 세미나 준비 자료다.
- 필요한 상세 예시는 참조하되, 본 세미나에서는 본 디렉터리(v2 상세판)를 기준으로 사용한다.
