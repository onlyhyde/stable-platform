# 세미나 산출물 3: 개발자 Q&A 30 (KO)

작성일: 2026-03-02  
용도: 발표자 핸드북(질문 대응 스크립트)

---

## 1) 핵심 개념 Q&A (1~10)

### Q1. Smart Account를 한 문장으로 정의하면?
A. "트랜잭션 승인/실행/수수료 정책을 계정 코드로 프로그래밍 가능한 계정"이다.

### Q2. 왜 EOA만으로는 한계가 있나?
A. EOA는 코드 실행 로직을 직접 가질 수 없어, 조건부 승인/자동 실행/모듈 확장 같은 지갑 정책을 계정 자체에 내장하기 어렵다.

### Q3. ERC-4337의 철학은 무엇인가?
A. 사용자 요청을 UserOp로 분리하고, 트랜잭션 제출/검증/정산을 EntryPoint 중심의 계약된 경계로 재구성하는 것이다.

### Q4. ERC-4337에서 새로 등장한 핵심 actor는?
A. Bundler, EntryPoint, Smart Account(Account contract), Paymaster다.

### Q5. 왜 "UserOp != L1 트랜잭션"으로 설명해야 하나?
A. UserOp는 실행 요청 메시지이고, 실제 체인 tx는 Bundler가 제출하기 때문이다.

### Q6. ERC-4337 Final 스펙과 EntryPoint v0.9를 같이 말해도 되나?
A. 가능하지만 반드시 구분해서 설명해야 한다. 스펙 문서 상태와 참조 구현 버전 진화는 동일 개념이 아니다.

### Q7. EIP-7702의 핵심 가치는?
A. EOA를 delegation 기반으로 확장해, 계정 전환 UX와 스마트 실행 경로를 더 유연하게 만든다.

### Q8. ERC-7579의 핵심 가치는?
A. Smart Account를 validator/executor/fallback/hook 모듈로 분리해 확장성과 유지보수성을 높인다.

### Q9. 왜 4337 + 7702 + 7579를 조합하나?
A. 4337은 실행 파이프라인, 7702는 EOA 전환/호환, 7579는 모듈 확장 책임을 분리해 실무 운영성을 확보하기 위해서다.

### Q10. 세미나에서 가장 먼저 이해시켜야 할 한 가지는?
A. "어떤 상황에서 어떤 파라미터를 누가 채우는지"다.

---

## 2) 버전/스펙 진화 Q&A (11~15)

### Q11. 왜 v0.6 이후 버전 진화가 필요했나?
A. 운영 현실(정합성, 보안 규칙, 상호운용성, 가스/추적 문제) 때문에 오프체인/온체인 경계를 더 엄격히 맞출 필요가 있었기 때문이다.

### Q12. v0.9에서 발표자가 특히 강조해야 할 포인트는?
A. EIP-712 기반 `userOpHash` 정합성, EIP-7702 경로 고려, off-chain 동기화 중요성이다.

### Q13. "스펙 준수"와 "구현 선택"은 어떻게 구분하나?
A. MUST/SHOULD 위반 여부와 무관하게, 운영상 선택(예: 모드 분리 정책)은 별도 Decision Log로 관리한다.

### Q14. 스펙 충돌이 있으면 어떻게 대응하나?
A. 충돌 지점(요구사항/현재 코드/리스크/완화책/되돌릴 조건)을 문서화하고, 데모에서는 현상과 이유를 함께 설명한다.

### Q15. 공개 구현 코드가 버전별로 다른데 학습은 어떻게 시작해야 하나?
A. 프로젝트가 핀한 기준(EntryPoint v0.9 + Kernel 기반 7579 + 7702)을 canonical로 고정하고 거기서 확장해야 한다.

---

## 3) 구현/파라미터 Q&A (16~24)

### Q16. EIP-7702 authorization nonce와 tx nonce는 같은가?
A. 다르다. authorization nonce는 delegation 승인 문맥 nonce이고, tx nonce는 네트워크 트랜잭션 nonce다.

### Q17. type-4 전송에서 가장 흔한 실수는?
A. `authorizationList` 누락, chainId 불일치, delegate address 오설정이다.

### Q18. UserOp 서명 실패의 1순위 원인은?
A. `userOpHash` 계산 경로 불일치(패킹/도메인/entryPoint/chainId mismatch)다.

### Q19. `callData`는 누가 만들고 무엇을 인코딩하나?
A. DApp/SDK가 Kernel execute 규칙에 맞게 인코딩한다. single call에서는 target/value/callData를 규칙대로 패킹해야 한다.

### Q20. Paymaster 연동은 왜 2단계(stub -> final)인가?
A. gas 추정 정확도를 확보한 뒤 최종 서명된 paymasterData를 붙여야 하기 때문이다.

### Q21. PaymasterData에서 반드시 지켜야 할 포맷은?
A. envelope 헤더(25 bytes)와 payload 구조, 시간 필드(validUntil/validAfter), nonce, signature 결합 규칙이다.

### Q22. `paymasterVerificationGasLimit`과 `paymasterPostOpGasLimit`을 왜 분리하나?
A. 검증 단계와 정산(postOp) 단계의 가스 특성이 다르기 때문이다.

### Q23. ERC-7579 install/uninstall에서 실패가 자주 나는 이유는?
A. 권한 경계 미설정, init/deInitData 불일치, 기존 selector/fallback 충돌 때문이다.

### Q24. Wallet과 DApp에서 같은 로직을 복붙하지 말아야 하는 이유는?
A. 해시/패킹/가스 규칙 중복은 곧 정합성 분산이다. SDK 중심 단일 구현이 유지보수 비용을 줄인다.

---

## 4) 운영/리스크 Q&A (25~30)

### Q25. Trusted bundler와 Public mempool 운영의 차이는?
A. Public에서는 시뮬레이션-온체인 사이 상태 변화 리스크가 커져 opcode/storage/reputation 정책이 훨씬 엄격해야 한다.

### Q26. receipt 추적이 왜 중요한가?
A. 정산/회계/사용자 상태 업데이트가 receipt를 기준으로 이어지기 때문이다.

### Q27. "스펙 일부 미준수" 결정을 해도 되나?
A. 가능하다. 단, 스펙을 정확히 이해한 뒤 리스크/완화/복귀 조건까지 문서화한 경우에만 허용해야 한다.

### Q28. 세미나 데모가 실패했을 때 발표자는 무엇을 보여줘야 하나?
A. 실패를 숨기지 말고, 해시/nonce/가스/entryPoint/이벤트 대조 순서로 디버깅 프레임을 보여줘야 한다.

### Q29. 제품화 시 가장 먼저 고정해야 할 기술 정책은?
A. EntryPoint 버전 정책, hash canonical 경로, 네트워크/주소 레지스트리, 운영 모드(trusted/public) 분리다.

### Q30. 이 PoC를 실서비스로 옮길 때 한 줄 원칙은?
A. "계정 실행 규칙은 컨트랙트에, 조립 규칙은 SDK에, 운영 정책은 오프체인 서비스에" 고정한다.

---

## 5) 발표자 빠른 답변 프레임

질문을 받으면 아래 4단계로 답하면 일관성이 유지된다.

1. 개념: 어떤 레이어의 질문인지(4337/7702/7579/운영)
2. 스펙: MUST/SHOULD/선택 사항인지
3. 코드: 구현 경로(컨트랙트/SDK/앱/서비스)
4. 결정: 현재 상태(PASS/PARTIAL/DECISION)와 다음 조치

