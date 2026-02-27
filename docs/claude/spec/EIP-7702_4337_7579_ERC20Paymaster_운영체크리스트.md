# EIP-7702 + ERC-4337 + ERC-7579 + ERC20Paymaster 운영 체크리스트

작성일: 2026-02-27  
연계 문서: `EIP-7702_4337_7579_ERC20Paymaster_메시지플로우.md`

## 1. 사전 체크 (런칭 전)

## 1.1 네트워크/주소 설정
- [ ] `EntryPoint` 주소가 wallet / dapp / bundler / paymaster-proxy / paymaster 컨트랙트에서 동일한가
- [ ] `Kernel` delegate 주소(EIP-7702 대상)가 환경별로 올바른가
- [ ] `bundlerUrl`, `paymasterUrl`, `rpcUrl`가 같은 체인을 가리키는가
- [ ] `chainId`가 모든 컴포넌트에서 일치하는가

## 1.2 EIP-7702 위임
- [ ] `wallet_delegateAccount` 호출 후 계정이 `delegated` 상태로 저장되는가
- [ ] 위임 트랜잭션(type 0x04/eip7702) 브로드캐스트 성공 확인
- [ ] 재위임/철회 시나리오 테스트(롤백 가능성 포함)

## 1.3 Kernel/모듈 구성
- [ ] root validator 설치 및 활성화 확인
- [ ] 필요한 executor/fallback/hook 모듈 설치 확인
- [ ] `supportsExecutionMode`와 실제 `ExecLib.execute` 분기 정합성 확인
- [ ] `supportsModule`, `isModuleInstalled` 결과가 실제 상태와 일치하는가

## 1.4 Paymaster 준비
- [ ] EntryPoint에 Paymaster deposit 충분한가
- [ ] ERC20Paymaster에서 USDC `supportedTokens[token]=true` 설정됨
- [ ] 가격 오라클/markup 설정이 의도대로인가
- [ ] 사용자 측 allowance(approve)가 충분한가

## 1.5 Bundler 준비
- [ ] `eth_sendUserOperation`, `eth_estimateUserOperationGas`, `eth_getUserOperationReceipt` 정상 동작
- [ ] simulation/opcode/reputation 정책이 운영 의도와 일치하는가
- [ ] 번들 제출 계정(beneficiary 수취 계정) 자금/권한 정상

---

## 2. 실행 체크 (요청 처리 중)

## 2.1 클라이언트(UserOp 생성)
- [ ] `callData`가 Kernel `execute(bytes32,bytes)` ABI로 인코딩되었는가
- [ ] mode가 계정 지원 모드인지 확인 (`supportsExecutionMode`)
- [ ] nonce/gas/fee 값이 0 또는 비정상 값이 아닌가

## 2.2 Paymaster 데이터 주입
- [ ] `pm_getPaymasterStubData` 호출 성공
- [ ] `pm_getPaymasterData` 호출 성공
- [ ] UserOp에 `paymaster`, `paymasterData`, `paymasterVerificationGasLimit`, `paymasterPostOpGasLimit` 반영됨
- [ ] ERC20 시나리오에서는 context에 `paymasterType='erc20'`, `tokenAddress`가 일관되게 전달되는가

## 2.3 Bundler 수신/검증
- [ ] `eth_sendUserOperation` 수신 후 validator 파이프라인 통과
- [ ] 시뮬레이션 결과에서 signature/timestamp/paymaster validation 실패 없음
- [ ] mempool 적재 후 상태가 `pending/submitted`로 전환됨

## 2.4 On-chain 실행
- [ ] EntryPoint `handleOps` 트랜잭션 전송 성공
- [ ] `validateUserOp` 호출 성공
- [ ] `validatePaymasterUserOp` 호출 성공
- [ ] `execute` 경로에서 USDC `transfer` 수행 성공
- [ ] `postOp` 호출 성공

---

## 3. 사후 체크 (실행 후)

## 3.1 성공 판정
- [ ] `eth_getUserOperationReceipt(userOpHash)`에서 success=true 확인
- [ ] receipt의 실제 txHash와 내부 pending 트래커 매핑 완료
- [ ] UserOp 이벤트(UserOperationEvent) 확인

## 3.2 정산 검증
- [ ] beneficiary가 ETH 수수료 수취했는가
- [ ] Paymaster가 사용자로부터 토큰 회수했는가 (`safeTransferFrom`)
- [ ] 예상/실제 토큰 비용 차이(슬리피지, markup, gas 변동) 분석

## 3.3 회귀/보안
- [ ] 실패 UserOp가 mempool에서 적절히 정리(drop/fail)되었는가
- [ ] 재시도 정책이 중복 실행/중복 과금을 유발하지 않는가
- [ ] Hook/Fallback 경로에서 비정상 revert/DoS 패턴 없는가

---

## 4. 장애 대응 체크리스트

## 4.1 자주 나는 실패 원인
- [ ] `AA23/AA24/AA25/AA26` 계정 검증/nonce/gas 문제
- [ ] `AA31/AA32/AA33/AA34/AA36/AA37` paymaster deposit/validation/time-range 문제
- [ ] paymaster 토큰 allowance/balance 부족
- [ ] `supportsExecutionMode`와 실제 mode 분기 불일치
- [ ] fallback sender-context 불일치(20B vs 40B) 관련 revert

## 4.2 즉시 점검 순서
1. `userOpHash` 기준 bundler 상태 조회
2. `eth_getUserOperationReceipt` 조회
3. EntryPoint tx receipt/log에서 FailedOp 코드 확인
4. paymaster 잔고/deposit/allowance/price feed 확인
5. Kernel 모듈 설치상태(`isModuleInstalled`) 재검증

---

## 5. 운영 모니터링 지표 (권장)
- UserOp 수신 수 / 성공률 / 실패률
- 실패 코드 분포(AAxx)
- paymaster별 소진량(ETH) / 회수량(ERC20)
- 평균 `verificationGasLimit`, `callGasLimit`, `postOpGas`
- bundler queue depth / bundle interval / inclusion latency
- delegated account(EIP-7702) 비율 및 위임 실패율

---

## 6. 현재 코드 기준 특별 주의사항
- [ ] fallback sender-context 20B/40B 불일치 이슈 추적 필요
- [ ] wallet-extension의 paymaster context 필드와 paymaster-proxy 스키마 필드 정합성(`token` vs `tokenAddress`) 점검 필요

---

## 7. 최종 Go-Live 체크
- [ ] 소액 실거래(USDC transfer + ERC20 gas payment) 10회 연속 성공
- [ ] 실패 케이스(allowance 부족, deposit 부족, 만료된 paymasterData) 의도된 에러로 귀결
- [ ] 장애 대응 runbook 문서화 및 on-call 공유 완료
