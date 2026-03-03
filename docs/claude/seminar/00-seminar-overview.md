# Smart Account 세미나 자료 개요

주제: Smart Account를 왜/어떻게 쓰는가 (ERC-4337, EIP-7702, ERC-7579)

대상: Smart Account 기술로 실제 개발을 수행해야 하는 개발자

## 세미나 목표

- Smart Account 관련 표준을 이해한다.
- 각 표준이 해결하려는 문제 경계를 분리해서 이해한다.
- 구현 시 어떤 조합을 선택해야 하는지 의사결정 기준을 확보한다.

## 핵심 메시지

- Ethereum은 상태 기반 상태 머신(state transition machine)이다.
- EOA 트랜잭션 모델은 단순하지만, 고급 권한/자동화/UX 요구를 직접 담기 어렵다.
- 그래서 계정 추상화가 등장했고, 4337/7702/7579는 서로 다른 레이어 문제를 해결한다.

## 세미나 흐름(목차)

1. `01-state-machine-and-account-limits.md`
   배경: Ethereum 상태 전이 모델과 EOA/CA 기본 구조  
   문제: EOA 중심 트랜잭션 모델의 한계  
   해결 방향: 계정 추상화 필요성

2. `02-erc-4337-background-problem-solution.md`  
   배경: 프로토콜 변경의 어려움  
   문제: 네이티브 계정 추상화 부재, 가스/자동화/배치 한계  
   해결: EntryPoint + UserOperation + Bundler + Paymaster

3. `03-eip-7702-background-problem-solution.md`  
   배경: 기존 EOA 자산/이력/승인 생태계  
   문제: CA 전환 시 주소 변경과 마이그레이션 비용  
   해결: EOA 주소 유지 + delegation code (type-0x04)

4. `04-erc-7579-background-problem-solution.md`  
   배경: Smart Account 구현 파편화  
   문제: 모듈 생태계 상호운용성 부족  
   해결: 모듈형 계정 표준(Validator/Executor/Hook/Fallback)

5. `05-how-they-fit-together.md`  
   배경: 실제 서비스는 단일 표준으로 완결되지 않음  
   문제: 4337/7702/7579 역할 혼동  
   해결: 레이어별 책임 분리와 조합 패턴

6. `06-implementation-playbook.md`  
   배경: 이론 이해 후 구현 간극  
   문제: 파라미터/검증/운영 포인트 누락  
   해결: 개발 체크리스트와 실패 패턴 기반 플레이북

7. `07-real-use-cases-and-architecture-mapping.md`  
   배경: 스펙 이해와 실제 서비스 요구 사이의 간극  
   문제: “왜 이 조합을 쓰는지”가 흐려져 구현 우선순위가 흔들림  
   해결: Smart Account 실전 유즈케이스 4종을 4337/7702/7579 책임에 매핑

- 유즈케이스 A: native coin 없는 유저, Paymaster 스폰서 가스
- 유즈케이스 B: native coin 있는 유저, Bundler 정산 비용 지불
- 유즈케이스 C: native coin 없음 + ERC-20 보유, Paymaster 선지불 후 ERC-20 사후 정산
- 유즈케이스 D: 7579 DeFi swap 모듈 + AI agent로 DCA/Limit order 자동 실행

8. `08-seminar-lab-and-qa.md`  
   실습/질의응답 중심 마무리

## 선행 읽기

- `docs/claude/spec/EIP-4337_스펙표준_정리.md`
- `docs/claude/spec/EIP-7702_스펙표준_정리.md`
- `docs/claude/spec/EIP-7579_스펙표준_정리.md`
