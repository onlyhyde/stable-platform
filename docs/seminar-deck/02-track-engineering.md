# Engineering Track (구현 중심)

## 구현 순서
1. 7702 delegate 세팅
2. Kernel initialize(root validator)
3. 필수 모듈 설치
4. bundler/paymaster 연동
5. 모니터링/리스크 컨트롤

## 필수 체크
- nonce key/sequence 관리
- selector access 제한
- module install/uninstall 테스트
- simulateValidation 기반 사전검증

## 최소 구현 스택
- Account: Kernel + ECDSAValidator
- Infra: EntryPoint + Bundler
- Cost: SponsorPaymaster + policy

## 테스트 우선순위
1. validateUserOp 실패 케이스
2. paymaster 한도 초과 거절
3. session key 만료/회수
4. 호환성(ERC-1271, 토큰 수신)
