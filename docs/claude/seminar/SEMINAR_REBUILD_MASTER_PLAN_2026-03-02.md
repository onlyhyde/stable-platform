# Smart Account Seminar Rebuild Master Plan (2026-03-02)

## 0. 왜 이 문서를 만들었는가

현재 `docs/claude/seminar/` 하위 문서는 토픽별 설명은 있으나, 아래 이유로 "개발자가 실제 구현까지 연결하는 세미나"로는 부족하다.

1. 배경 설명과 코드/파라미터 설명이 분리되어 있다.
2. ERC-4337 Final 스펙과 EntryPoint v0.7/v0.8/v0.9 구현 변천사가 하나의 흐름으로 정리되지 않았다.
3. EIP-7702, ERC-7579를 결합할 때 실제 트랜잭션 구성 규칙과 실패 포인트가 실습 중심으로 고정되어 있지 않다.
4. PoC 시연 시나리오(성공 경로 + 실패 복구 경로)가 발표 스크립트 수준으로 고정되지 않았다.

이 문서는 세미나를 **재작성하기 위한 기준 문서**다.

---

## 1. 세미나 목표 (확정)

세미나 종료 시 참가자가 다음을 할 수 있어야 한다.

1. Smart Account의 본질을 설명할 수 있다.
2. ERC-4337 / EIP-7702 / ERC-7579의 역할 분리를 설명할 수 있다.
3. 어떤 상황에서 어떤 트랜잭션/파라미터를 넣어야 하는지 결정할 수 있다.
4. PoC 코드(`apps`, `packages`, `services`, `poc-contract`)를 읽고 자신의 제품 코드로 옮길 수 있다.
5. 스펙 준수 vs 의도적 편차를 구분해 기술 의사결정을 할 수 있다.

---

## 2. 핵심 서사 (발표 논리)

세미나는 반드시 아래 순서로 진행한다.

### 2.1 EVM 계정 모델의 출발점

1. 이더리움 트랜잭션의 원발신자는 EOA다.
2. EOA는 코드 실행 규칙을 직접 내장할 수 없다.
3. 따라서 "지갑 동작 정책/검증/수수료 처리"를 계정 자체 로직으로 확장하기 어렵다.

### 2.2 ERC-4337 등장 배경과 철학

1. 사용자 요청을 `UserOperation` 메시지로 추상화한다.
2. 실제 L1/L2 트랜잭션 제출은 Bundler가 담당한다.
3. 검증/실행/정산을 EntryPoint + Account + Paymaster의 계약된 경계로 코드화한다.
4. 즉, "트랜잭션 처리 스킴을 프로토콜 외부(컨트랙트 계층)로 재구성"한 모델이다.

### 2.3 ERC-4337 이후의 현실적 문제와 버전 변천

핵심 메시지:

1. EIP-4337 문서의 Final 상태와 현업 구현(EntryPoint 버전 진화)은 동일 개념이 아니다.
2. 운영 이슈/상호운용성/보안 제약으로 참조 구현이 v0.7 → v0.8 → v0.9로 진화했다.
3. 세미나에서는 "문서 규격"과 "현장 구현 버전"을 분리해서 설명해야 혼선이 줄어든다.

필수 설명 포인트:

1. 왜 hash/domain/gas/accounting 규칙이 더 엄격해졌는가
2. 왜 off-chain(Bundler/SDK/Proxy)와 on-chain(EntryPoint/Account) 정합성이 중요해졌는가
3. v0.9 기준에서 무엇이 canonical인지

### 2.4 EIP-7702: EOA를 Delegation 기반 실행 계정으로 확장

1. delegation authorization으로 EOA가 smart behavior를 위임 가능
2. authorization 처리 nonce(트랜잭션 nonce와 별개) 관리 필요
3. type-4 세트코드 트랜잭션 구성 시 필드/서명/검증 규칙을 정확히 맞춰야 함
4. 4337과 결합 시 초기 진입 UX/호환성에서 실무 이점이 큼

### 2.5 ERC-7579: 모듈형 Smart Account 표준화

1. ERC-4337의 Account 개념을 모듈 시스템으로 일반화
2. validator / executor / fallback / hook 중심의 확장 구조
3. install/uninstall/replace lifecycle과 권한 경계를 명시
4. 스펙 충돌 지점(4337과 결합 시 충돌한 구현 포인트)을 실제 수정 사례와 함께 설명

### 2.6 수수료 모델의 진화

1. self-paid (native gas)
2. sponsor-paid (paymaster 대납)
3. sponsor 선처리 + ERC-20 post-settlement
4. 운영 시 deposit/stake/reputation/정산 실패 경로까지 설명

### 2.7 제품 적용 결론

1. Wallet/App는 SDK를 통해 공통 트랜잭션 조립을 재사용
2. 오프체인 서비스는 정책/리스크/정산을 집중 관리
3. 컨트랙트는 최소 안정 코어 + 모듈 확장으로 유지

---

## 3. 프로젝트 코드 기준 역할 분리 (세미나에서 고정 설명)

### 3.1 Wallet

- 경로: `apps/wallet-extension`
- 책임:
  - 트랜잭션 서명
  - 트랜잭션/유저오퍼레이션 전송
  - 계정/체인 변경 이벤트 브로드캐스트
  - 권한 승인 UX

### 3.2 Demo DApp (PoC 검증)

- 경로: `apps/web`
- 책임:
  - 지갑 연결 후 Smart Account 세팅(EIP-7702)
  - EOA/CA 동작 비교
  - ERC-4337/7579 기능 체험 UI
  - 개발자 예제 시나리오 제공

### 3.3 Core SDK

- 경로: `packages/sdk-ts`, `packages/sdk-go`
- 책임:
  - UserOp/Authorization/모듈 호출의 표준 조립 로직
  - 해시/인코딩/가스/nonce 등 핵심 규칙 재사용
  - 언어별 동일 로직 정합성 유지

### 3.4 Wallet-DApp Bridge SDK

- 경로: `packages/wallet-sdk`
- 책임:
  - 지갑 연결/해제
  - 서명 API
  - 계정/네트워크/체인 변경 이벤트 동기화
  - DApp-지갑 상태 일관성 유지

### 3.5 Off-chain Services

- 경로: `services/*`
- 책임:
  - bundler
  - paymaster proxy
  - subscription executor 등
  - 운영 관점 정책/리스크/정산

### 3.6 Smart Contracts

- 경로: `poc-contract/src/*`
- 책임:
  - EntryPoint / Kernel / Paymaster / Module 컨트랙트
  - 온체인 검증/실행/정산의 최종 신뢰 경계

---

## 4. 세미나에서 반드시 전달할 "트랜잭션 구성" 핵심

발표에서 코드 예시 없이 개념만 설명하면 실패한다. 아래를 반드시 파라미터 단위로 전달한다.

### 4.1 EIP-7702 Transaction

1. 언제 type-4를 쓰는가
2. authorization tuple의 구성 요소와 서명 입력
3. delegation nonce 관리 규칙
4. 실패 시 대표 증상(서명 불일치/nonce 충돌/체인 mismatch)

### 4.2 ERC-4337 UserOperation

1. 필수 필드와 packed 필드 구성 규칙
2. `preVerificationGas`, `verificationGasLimit`, `callGasLimit` 산정 원칙
3. paymaster 사용 시 `paymasterVerificationGasLimit`, `paymasterPostOpGasLimit`, `paymasterData`의 의미
4. `userOpHash` 계산 경로와 signer 경계(account signer vs paymaster signer)
5. bundler 제출 후 receipt/이벤트 추적 방법

### 4.3 ERC-7579 Module 호출

1. 어떤 동작이 validator/executor/fallback/hook에 매핑되는가
2. install/uninstall/replace 시 호출 순서와 권한 체크
3. 모듈 조합 시 실패 패턴(권한 누락, hook 과도 사용, fallback 충돌)

---

## 5. 세미나 구성안 (Rebuild v2)

아래 구조로 `docs/claude/seminar/`를 재작성한다.

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

원칙:

1. 파일 하나당 하나의 학습 목적만 가진다.
2. 각 파일 마지막에 "구현 체크리스트 + 실패 포인트 + 코드 경로"를 붙인다.
3. 각 파일에서 spec 문서 링크를 canonical로 고정한다.

---

## 6. 현재 문서에서 확인된 공백 (재작성 대상)

1. "왜 이 스펙 조합이 필요한가"에 대한 제품 관점 연결이 약함
2. ERC-4337 버전 변천 설명이 이벤트 중심으로 부족함
3. EIP-7702 type-4 구성/nonce 처리 설명이 실습 레벨로 고정되지 않음
4. ERC-7579 lifecycle을 실제 코드 호출 흐름과 1:1 매칭한 표가 부족함
5. 트랜잭션 파라미터 cookbook이 독립 문서로 존재하지 않음
6. 실습 실패 복구(runbook)와 발표 대체 시나리오가 약함

---

## 7. 실행 단계 (문서 재작성 워크플로우)

### Phase A. 설계 고정

1. 세미나 핵심 메시지 6개 확정
2. 트랙별 목표(Engineering/CTO/BD) 한 줄 정의
3. "준수/편차" 의사결정 템플릿 확정

### Phase B. 본문 재작성

1. v2 구조(12개 파일) 생성
2. 각 파일에 코드 경로 + 파라미터 테이블 삽입
3. COMPLETE_FLOW/SEQUENCE_DIAGRAM과 상호 링크

### Phase C. 실습 패키지

1. PoC 시연 스크립트(성공/실패 복구) 작성
2. 체크리스트(사전 점검, 운영 점검) 작성
3. 질의응답 문서(기술 난이도별) 작성

### Phase D. 리허설 및 고정

1. 리허설 3회
2. 실패 사례 로그 반영
3. 발표본 freeze

---

## 8. 다음 턴에서 생성할 3개 산출물 (요청 반영)

다음 턴에서 아래 3개를 작성한다.

1. Spec -> Code Trace Matrix (스펙 요구사항과 코드 위치 매핑)
2. Transaction Cookbook (TS/Go + Wallet/DApp wiring 중심)
3. Seminar Q&A 30문항 (개발자 심화형)

---

## 9. 완료 기준 (Definition of Done)

아래 조건을 충족해야 "세미나 준비 완료"로 본다.

1. 참가자가 "무엇을 왜 쓰는지"를 설명할 수 있다.
2. 참가자가 "어떤 파라미터를 어디에 넣는지"를 실습으로 재현할 수 있다.
3. 참가자가 "스펙 준수 vs 의도적 편차"를 문서화해 팀 의사결정할 수 있다.
4. PoC 시연이 실패해도 대체 시나리오로 메시지 전달이 가능하다.

