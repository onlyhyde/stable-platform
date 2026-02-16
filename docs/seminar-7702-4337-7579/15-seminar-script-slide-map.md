# 15) 90분 대본 슬라이드 매핑 (30장 기준)

## 문서 목적
`13-seminar-script-90min.md`의 발표 흐름을 `00-master-deck-30-slides.md`의 30장에 1:1로 연결합니다.

참조:
- 슬라이드 원본: `stable-platform/docs/seminar-deck/00-master-deck-30-slides.md`
- 기본 대본: `stable-platform/docs/seminar-7702-4337-7579/13-seminar-script-90min.md`

---

## 사용 방법
1. 각 슬라이드당 `2~3분`을 기본으로 잡습니다.
2. 데모는 Slide 13~24 구간에 삽입합니다.
3. Q&A는 Slide 29~30 이후 10분 확보를 권장합니다.

---

## 슬라이드별 매핑

### Slide 1. 제목 (2분)
- 핵심 멘트: "오늘은 EOA를 버리지 않고 Smart Account 경험을 만드는 방법을 설명합니다."
- 청중 포인트: 공통 오프닝

### Slide 2. 오늘의 목표 (2분)
- 핵심 멘트: "같은 기술을 BD/개발/CTO 관점에서 각각 어떤 의사결정으로 연결할지 보여드리겠습니다."
- 청중 포인트:
  - BD: 전환율/리텐션
  - 개발: 구현/검증 경로
  - CTO: 운영/리스크

### Slide 3. 왜 지금 필요한가 (3분)
- 핵심 멘트: "EOA는 단순하지만 자동화가 약하고, 기존 CA는 주소 이전 비용이 큽니다."
- 사업 포인트: 주소 유지 + UX 개선의 동시 달성 필요성

### Slide 4. 큰 그림 (3분)
- 핵심 멘트: "7702는 전환, 7579는 계정 내부 확장, 4337은 실행 인프라입니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/types/Constants.sol:51`
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:89`

### Slide 5. 핵심 개념 1: EIP-7702 (3분)
- 핵심 멘트: "기존 주소를 유지한 채 delegate code를 설정해 계정 능력을 확장합니다."
- 코드 포인트:
  - `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:752`
  - `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1322`

### Slide 6. 핵심 개념 2: ERC-7579 Kernel (3분)
- 핵심 멘트: "Kernel은 validator/executor/hook/fallback을 조합하는 모듈 런타임입니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:235`
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:342`

### Slide 7. 핵심 개념 3: ERC-4337 (3분)
- 핵심 멘트: "UserOperation은 일반 tx와 분리된 실행/정산 트랙입니다."
- 코드 포인트:
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:89`
  - `stable-platform/services/bundler/src/rpc/server.ts:291`

### Slide 8. 왜 조합이 강한가 (2분)
- 핵심 멘트: "주소 연속성 + 확장성 + 운영 자동화를 한 세트로 얻습니다."
- 청중 포인트:
  - BD: 사용성
  - 개발: 아키텍처 분리
  - CTO: 비용/리스크 균형

### Slide 9. PoC 코드 맵 (3분)
- 핵심 멘트: "컨트랙트는 규칙, 서비스는 실행, 앱/SDK는 사용자 경험을 담당합니다."
- 코드 포인트:
  - `poc-contract/src/`
  - `stable-platform/services/`
  - `stable-platform/apps/`
  - `stable-platform/packages/`

### Slide 10. 트랜잭션 모델 (3분)
- 핵심 멘트: "4337에서는 packed UserOp를 기준으로 엔드포인트가 동작합니다."
- 코드 포인트:
  - `stable-platform/packages/sdk-ts/core/src/clients/bundlerClient.ts:117`
  - `stable-platform/services/bundler/src/rpc/utils.ts:8`

### Slide 11. 필수 필드 (2분)
- 핵심 멘트: "필수 필드는 sender/nonce/callData와 가스/수수료/서명입니다."
- 코드 포인트:
  - `poc-contract/src/erc4337-entrypoint/interfaces/PackedUserOperation.sol`

### Slide 12. 옵션 필드 (2분)
- 핵심 멘트: "initCode는 온보딩, paymasterAndData는 비용 추상화에 사용됩니다."
- 코드 포인트:
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:770`

### Slide 13. 7702 온보딩 흐름 (4분)
- 핵심 멘트: "권한 서명 -> authorizationList tx -> delegated account 활성화 순서입니다."
- 데모 연결: 데모 1 시작
- 코드 포인트:
  - `stable-platform/apps/web/hooks/useSmartAccount.ts:253`
  - `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:897`

### Slide 14. EVM 처리 절차 (4분)
- 핵심 멘트: "simulateValidation으로 사전 검증하고 handleOps에서 실제 실행/정산합니다."
- 코드 포인트:
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:974`
  - `poc-contract/src/erc4337-entrypoint/EntryPoint.sol:89`

### Slide 15. Kernel 내부 검증 포인트 (3분)
- 핵심 멘트: "nonce type/validator id/selector 접근권한이 핵심 통제점입니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:235`

### Slide 16. Kernel 내부 실행 포인트 (3분)
- 핵심 멘트: "hook pre/post와 executor/fallback 분기에서 실제 권한 모델이 작동합니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:295`
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:317`

### Slide 17. 장점 요약 (2분)
- 핵심 멘트: "전환 비용, 확장성, 운영성 세 축을 동시에 개선합니다."

### Slide 18. 단점/주의점 요약 (3분)
- 핵심 멘트: "delegate 변경 리스크와 정책 복잡도를 운영 통제로 반드시 보완해야 합니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:438`

### Slide 19. 모듈 카탈로그(Validator) (2분)
- 핵심 멘트: "인증 방식은 validator 모듈로 교체 가능한 전략으로 관리합니다."

### Slide 20. 모듈 카탈로그(Executor/Hook/Fallback) (3분)
- 핵심 멘트: "자동화/제약/호환성은 executor/hook/fallback 모듈 조합으로 만듭니다."

### Slide 21. 설치 라이프사이클 (4분)
- 핵심 멘트: "설치는 onInstall로 시작하고 grantAccess로 실행 범위를 고정합니다."
- 데모 연결: 데모 2
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:342`
  - `stable-platform/apps/wallet-extension/src/background/rpc/handler.ts:1769`

### Slide 22. 권한 위임 시나리오 (3분)
- 핵심 멘트: "root key는 최소 사용, session key는 제한 실행, policy는 상한 통제로 조합합니다."

### Slide 23. Paymaster 정책 (4분)
- 핵심 멘트: "paymaster는 sponsor 여부를 정책 엔진으로 결정합니다."
- 코드 포인트:
  - `stable-platform/services/paymaster-proxy/src/app.ts:275`
  - `stable-platform/services/paymaster-proxy/src/schemas/index.ts:72`

### Slide 24. Bundler 검증 (4분)
- 핵심 멘트: "format/reputation/state/simulation/opcode 순으로 reject 비용을 최소화합니다."
- 데모 연결: 데모 3
- 코드 포인트:
  - `stable-platform/services/bundler/src/validation/validator.ts:135`

### Slide 25. 호환성 전략 (2분)
- 핵심 멘트: "ERC-1271과 fallback adapter로 기존 dApp을 단계적으로 흡수합니다."

### Slide 26. 보안/운영 필수 통제 (3분)
- 핵심 멘트: "allowlist, nonce invalidation, 감사로그가 최소 운영 세트입니다."
- 코드 포인트:
  - `poc-contract/src/erc7579-smartaccount/Kernel.sol:434`
  - `stable-platform/services/bundler/src/rpc/server.ts:169`

### Slide 27. BD 인사이트 (2분)
- 핵심 멘트: "sponsored tx와 원클릭 온보딩이 성장 실험의 핵심 레버입니다."

### Slide 28. 개발 로드맵 (2분)
- 핵심 멘트: "MVP는 단순 validator + sponsor paymaster, 이후 session key와 고급 정책으로 확장합니다."

### Slide 29. CTO 의사결정 프레임 (3분)
- 핵심 멘트: "기술 선택보다 운영 성숙도와 정책 거버넌스가 성공 확률을 좌우합니다."

### Slide 30. 결론 (2분)
- 핵심 멘트: "7702는 전환, 7579는 확장, 4337은 운영입니다. 세 축의 균형이 제품 성공 조건입니다."
- 마무리 질문: "우리 서비스에서 가장 먼저 줄이고 싶은 사용자 friction은 무엇인가?"

---

## 데모 삽입 타임라인 (권장)

1. Demo A (7702 전환): Slide 13~14 사이, 8분
2. Demo B (7579 모듈 설치): Slide 21~22 사이, 7분
3. Demo C (Paymaster 후원): Slide 23~24 사이, 8분

---

## 발표 리허설 체크리스트

1. Slide 13 데모 계정 nonce 상태 사전 확인
2. Slide 21 설치 모듈 주소/타입 고정값 준비
3. Slide 23 paymaster `chainId` hex 패킷 준비
4. Slide 24 bundler 에러 케이스(Invalid params, EntryPoint mismatch) 캡처 준비
5. Slide 30에서 사업/기술/운영 액션 아이템 1개씩 제시
