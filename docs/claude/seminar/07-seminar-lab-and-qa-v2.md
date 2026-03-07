# 08. Seminar Lab And Q&A

대상: Smart Account 기능을 실제로 구현/운영해야 하는 개발자  
연계 문서: `docs/claude/seminar/07-real-use-cases-and-architecture-mapping.md`

## 1. 실습 목표
- 유즈케이스 A~D를 코드/파라미터 관점으로 재현한다.
- 4337/7579/7702의 책임 경계를 “동작 결과”로 확인한다.
- 실패 케이스를 의도적으로 만들고 디버깅 포인트를 익힌다.

## 2. 실습 환경 전제
- EntryPoint, Bundler RPC, Paymaster API(또는 로컬 mock) 준비
- Smart Account 배포/초기화 스크립트 준비
- 테스트 토큰(ERC-20), 스왑 대상 프로토콜 mock 또는 테스트넷 주소 준비
- 로그 수집 포인트:
  - `eth_sendUserOperation` 응답 `userOpHash`
  - `eth_getUserOperationByHash`
  - `eth_getUserOperationReceipt`
  - EntryPoint 이벤트(`UserOperationEvent`, revert reason 계열)

## 3. Lab Track

### Lab A. Native coin 없는 유저 스폰서 가스

목표:
- Paymaster sponsor 경로로 첫 거래를 성공시킨다.

절차:
1. native coin 0인 테스트 계정 준비
2. paymasterData 포함 UserOperation 생성
3. Bundler로 제출
4. Receipt에서 Paymaster 경유 실행 확인

체크 포인트:
- `validatePaymasterUserOp` 통과 여부
- Paymaster deposit 감소 여부
- `postOp` 후 내부 회계 값 변화

실패 실습:
- paymaster 서명을 고의로 틀리게 해서 거절 코드 확인
- paymaster deposit 부족 상태에서 실패 확인

---

### Lab B. Native coin 있는 유저가 직접 비용 지불

목표:
- Paymaster 없이 4337 실행/정산을 완료한다.

절차:
1. native coin 보유 계정으로 UserOperation 생성 (`paymasterAndData=0x`)
2. `missingAccountFunds` 상황/비상황 각각 실행
3. EntryPoint 정산 결과 확인

체크 포인트:
- `validateUserOp` 통과
- nonce 증가
- beneficiary 수수료 지급

실패 실습:
- signature 변조
- nonce 충돌
- gas limit 과소 설정

---

### Lab C. ERC-20 가스 정산 (native coin 없음)

목표:
- Paymaster가 선지불 후 ERC-20으로 사후 회수하는 흐름을 재현한다.

절차:
1. 유저에게 ERC-20 지급, native coin은 0 유지
2. approve 또는 permit2 권한 설정
3. ERC-20 결제 payload로 UserOperation 제출
4. postOp 이후 토큰 회수/정산 확인

체크 포인트:
- 권한(allowance/permit) 검증 통과
- 실제 gas cost 대비 토큰 차감량 검증
- 오라클/마크업 파라미터 반영 여부

실패 실습:
- allowance 부족
- permit 만료
- 오라클 stale 데이터

---

### Lab D. 7579 모듈 + AI Agent 자동 실행 (DCA/Limit)

목표:
- Executor/Hook 모듈 조합으로 자동화 거래를 실행한다.

절차:
1. 계정에 swap executor + 정책 hook 설치
2. 정책(한도/슬리피지/허용 대상) 설정
3. agent가 조건 충족 시 UserOperation 생성/제출
4. 모듈 실행 및 hook pre/post 검증 로그 확인

체크 포인트:
- `executeFromExecutor` 권한 검증
- hook 정책 위반 시 정확히 revert
- 조건 충족 시 자동 주문 성공

실패 실습:
- agent가 허용 범위를 넘는 요청 제출
- 슬리피지 조건 위반
- 만료된 정책으로 실행 시도

## 4. 공통 디버깅 체크리스트
- `supportsExecutionMode`와 실제 실행 경로 일치 여부
- validationData(validAfter/validUntil/authorizer) 해석 일치 여부
- paymasterAndData 인코딩 파서 일치 여부(컨트랙트 vs SDK)
- UserOp hash 도메인 분리(chainId/EntryPoint) 일치 여부
- 실패 시 AA 코드 + 모듈 커스텀 에러를 함께 수집하는지

## 5. Q&A 가이드

권장 질문 순서:
1. “이 요구사항은 4337/7579/7702 중 어느 레이어 문제인가?”
2. “실패는 validation/execute/postOp 중 어디서 발생했는가?”
3. “정책 실패인가, 포맷 실패인가, 자금/권한 실패인가?”
4. “온체인 수정이 필요한가, SDK/서버 인코딩 수정이 필요한가?”

자주 나오는 질문:
- Q: Paymaster를 쓰면 계정 deposit은 완전히 불필요한가?  
  A: 아니며 fallback/비상 경로를 고려해 최소 전략을 둘 수 있다.
- Q: 7579 모듈을 쓰면 4337 없이도 되나?  
  A: 모듈 구조(7579)와 실행 전달/정산(4337)은 별개다. 자동화 서비스는 보통 둘을 결합한다.
- Q: AI agent 실행은 누가 책임지나?  
  A: 최종 책임은 계정 권한 모델과 정책 모듈 설계에 있다(권한 상한/만료/취소 필수).

## 6. 실습 완료 기준
- A~D 각 유즈케이스 최소 1회 성공 로그 확보
- A~D 각 유즈케이스 최소 1회 실패 로그 확보
- 실패 원인을 validation/execute/postOp 단계로 분류 가능
- 문서화 산출물:
  - 사용한 입력 파라미터
  - 성공/실패 트랜잭션 해시
  - 재현 절차
  - 개선 액션
