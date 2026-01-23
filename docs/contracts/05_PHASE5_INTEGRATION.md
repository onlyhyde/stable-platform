# Phase 5: Integration, Testing & Deployment

## 개요

Phase 5는 모든 컨트랙트의 통합, 종합 테스트, SDK 연동, 그리고 배포를 다룹니다.

| 구분 | 내용 |
|------|------|
| **기간** | 5-6주 (예상, ~222h) |
| **의존성** | Phase 1-4 완료 |
| **목표** | 프로덕션 레디 상태 달성 |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Production Deployment                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Mainnet    │  │   Testnet    │  │   Staging    │  │   Local     │  │
│  │   Deploy     │  │   Deploy     │  │   Deploy     │  │   Deploy    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                      │
│  ┌─────────────────────────────────┴─────────────────────────────────┐   │
│  │                     Deployment Scripts                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │  │ Deploy Core │  │Deploy Module│  │Deploy Privacy│                │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └───────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                           SDK Integration                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  TypeScript  │  │   React      │  │    Viem      │                   │
│  │    Client    │  │   Hooks      │  │  Extensions  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
├─────────────────────────────────────────────────────────────────────────┤
│                        Testing Infrastructure                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Unit Tests   │  │ Integration  │  │  Fork Tests  │  │ Fuzzing     │  │
│  │  (Foundry)   │  │   Tests      │  │  (Mainnet)   │  │ (Echidna)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component 5.1: Comprehensive Testing

### C5.1.1: Unit Test Suite

모든 컨트랙트의 단위 테스트.

```solidity
// test/unit/EntryPointTest.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "../../src/core/EntryPoint.sol";

contract EntryPointTest is Test {
    function test_handleOps_single() public { }
    function test_handleOps_batch() public { }
    function test_depositTo() public { }
    function test_withdrawTo() public { }
    function test_revert_invalidNonce() public { }
}
```

#### Tasks

##### T5.1.1.1: Core Contract Unit Tests
```yaml
task_id: T5.1.1.1
title: "Core 컨트랙트 단위 테스트"
priority: critical
estimated_hours: 12
dependencies: [Phase1.Complete]
acceptance_criteria:
  - EntryPoint 연동 테스트 (handleOps, deposit, withdraw)
  - Kernel 테스트 (execute, validateUserOp)
  - KernelFactory 테스트 (createAccount)
  - DelegateKernel 테스트 (EIP-7702 delegation) - 제한적 테스트
  - ECDSAValidator 테스트 (signature verification)
  - 각 테스트 최소 5개 시나리오
subtasks:
  - id: T5.1.1.1.1
    title: "EntryPoint 연동 테스트 작성"
    hours: 3
  - id: T5.1.1.1.2
    title: "Kernel 테스트 작성"
    hours: 3
  - id: T5.1.1.1.3
    title: "KernelFactory 테스트"
    hours: 2
  - id: T5.1.1.1.4
    title: "DelegateKernel 테스트 (시뮬레이션)"
    hours: 2
  - id: T5.1.1.1.5
    title: "ECDSAValidator 테스트"
    hours: 2
```

> **EIP-7702 테스트 제한사항**:
> - Anvil은 현재 EIP-7702 (SetCode 트랜잭션 type 0x04)를 네이티브 지원하지 않음
> - DelegateKernel 테스트는 다음 방법으로 수행:
>   1. `vm.etch()`를 사용한 EOA 코드 주입 시뮬레이션
>   2. 실제 7702 지원 테스트넷 (Sepolia + Prague 활성화) 사용
>   3. Geth 개발 모드에서 7702 플래그 활성화
> - 프로덕션 테스트는 반드시 7702 지원 환경에서 수행

##### T5.1.1.2: Paymaster Unit Tests
```yaml
task_id: T5.1.1.2
title: "Paymaster 단위 테스트"
priority: critical
estimated_hours: 10
dependencies: [Phase2.Complete]
acceptance_criteria:
  - VerifyingPaymaster 서명 검증 테스트
  - ERC20Paymaster 토큰 결제 테스트
  - Permit2Paymaster 가스없는 승인 테스트
  - 에러 케이스 테스트
subtasks:
  - id: T5.1.1.2.1
    title: "VerifyingPaymaster 테스트"
    hours: 3
  - id: T5.1.1.2.2
    title: "ERC20Paymaster 테스트"
    hours: 4
  - id: T5.1.1.2.3
    title: "Permit2Paymaster 테스트"
    hours: 3
```

##### T5.1.1.3: Module Unit Tests
```yaml
task_id: T5.1.1.3
title: "ERC-7579 모듈 단위 테스트"
priority: high
estimated_hours: 12
dependencies: [Phase2.Complete]
acceptance_criteria:
  - Validator 모듈 테스트 (WebAuthn, MultiSig)
  - Executor 모듈 테스트 (SessionKey, Recurring)
  - Hook 모듈 테스트 (SpendingLimit, Audit)
subtasks:
  - id: T5.1.1.3.1
    title: "WebAuthnValidator 테스트"
    hours: 3
  - id: T5.1.1.3.2
    title: "MultiSigValidator 테스트"
    hours: 3
  - id: T5.1.1.3.3
    title: "SessionKeyExecutor 테스트"
    hours: 2
  - id: T5.1.1.3.4
    title: "SpendingLimitHook 테스트"
    hours: 2
  - id: T5.1.1.3.5
    title: "AuditHook 테스트"
    hours: 2
```

##### T5.1.1.4: Privacy Module Unit Tests
```yaml
task_id: T5.1.1.4
title: "Privacy 모듈 단위 테스트"
priority: high
estimated_hours: 10
dependencies: [Phase3.Complete]
acceptance_criteria:
  - ERC5564Announcer 테스트
  - ERC6538Registry 테스트
  - PrivateBank 테스트
  - StealthVault/Ledger/WithdrawalManager 테스트
subtasks:
  - id: T5.1.1.4.1
    title: "Standard Stealth 테스트"
    hours: 4
  - id: T5.1.1.4.2
    title: "Enterprise Stealth 테스트"
    hours: 4
  - id: T5.1.1.4.3
    title: "권한 및 에러 테스트"
    hours: 2
```

##### T5.1.1.5: DeFi Module Unit Tests
```yaml
task_id: T5.1.1.5
title: "DeFi 모듈 단위 테스트"
priority: medium
estimated_hours: 10
dependencies: [Phase4.Complete]
acceptance_criteria:
  - SwapExecutor 테스트
  - LendingExecutor 테스트
  - StakingExecutor 테스트
  - SubscriptionManager 테스트
subtasks:
  - id: T5.1.1.5.1
    title: "Swap 테스트"
    hours: 2
  - id: T5.1.1.5.2
    title: "Lending 테스트"
    hours: 3
  - id: T5.1.1.5.3
    title: "Staking 테스트"
    hours: 2
  - id: T5.1.1.5.4
    title: "Subscription 테스트"
    hours: 3
```

### C5.1.2: Integration Tests

컨트랙트 간 상호작용 테스트.

```solidity
// test/integration/FullFlowTest.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "../../src/core/EntryPoint.sol";
import {Kernel} from "../../src/account/Kernel.sol";
import {VerifyingPaymaster} from "../../src/paymaster/VerifyingPaymaster.sol";

contract FullFlowTest is Test {
    function test_createAccount_validateOp_execute() public { }
    function test_gasSponsorship_fullFlow() public { }
    function test_moduleInstall_execute_flow() public { }
}
```

#### Tasks

##### T5.1.2.1: Account Creation Flow
```yaml
task_id: T5.1.2.1
title: "계정 생성 통합 테스트"
priority: critical
estimated_hours: 6
dependencies: [T5.1.1.1]
acceptance_criteria:
  - Factory → Account 생성 플로우
  - 초기 Validator 설치
  - EntryPoint 등록 확인
  - 첫 번째 UserOp 실행
subtasks:
  - id: T5.1.2.1.1
    title: "Factory 통합 테스트"
    hours: 2
  - id: T5.1.2.1.2
    title: "Validator 설치 테스트"
    hours: 2
  - id: T5.1.2.1.3
    title: "첫 UserOp 테스트"
    hours: 2
```

##### T5.1.2.2: Gas Sponsorship Flow
```yaml
task_id: T5.1.2.2
title: "가스 후원 통합 테스트"
priority: critical
estimated_hours: 8
dependencies: [T5.1.1.2]
acceptance_criteria:
  - Paymaster 서명 생성 → 검증 플로우
  - ERC-20 결제 전체 플로우
  - Permit2 승인 → 결제 플로우
  - 가스 환불 검증
subtasks:
  - id: T5.1.2.2.1
    title: "Verifying 플로우 테스트"
    hours: 2
  - id: T5.1.2.2.2
    title: "ERC20 플로우 테스트"
    hours: 3
  - id: T5.1.2.2.3
    title: "Permit2 플로우 테스트"
    hours: 3
```

##### T5.1.2.3: Module Lifecycle Flow
```yaml
task_id: T5.1.2.3
title: "모듈 라이프사이클 테스트"
priority: high
estimated_hours: 6
dependencies: [T5.1.1.3]
acceptance_criteria:
  - 모듈 설치 → 활성화 → 실행 → 제거
  - 다중 모듈 상호작용
  - Hook 체인 실행
subtasks:
  - id: T5.1.2.3.1
    title: "모듈 설치/제거 테스트"
    hours: 2
  - id: T5.1.2.3.2
    title: "다중 모듈 테스트"
    hours: 2
  - id: T5.1.2.3.3
    title: "Hook 체인 테스트"
    hours: 2
```

##### T5.1.2.4: Stealth Address Flow
```yaml
task_id: T5.1.2.4
title: "Stealth Address 통합 테스트"
priority: high
estimated_hours: 8
dependencies: [T5.1.1.4]
acceptance_criteria:
  - Standard: 등록 → 생성 → 전송 → 스캔 → 출금
  - Enterprise: 입금 → 할당 → 기록 → 출금 요청 → 다중서명
subtasks:
  - id: T5.1.2.4.1
    title: "Standard Stealth 플로우"
    hours: 3
  - id: T5.1.2.4.2
    title: "Enterprise Stealth 플로우"
    hours: 4
  - id: T5.1.2.4.3
    title: "에러 시나리오"
    hours: 1
```

##### T5.1.2.5: DeFi Integration Flow
```yaml
task_id: T5.1.2.5
title: "DeFi 통합 테스트"
priority: medium
estimated_hours: 8
dependencies: [T5.1.1.5]
acceptance_criteria:
  - Smart Account → Swap 실행
  - Smart Account → Lending 풀 작업
  - 구독 결제 전체 플로우
subtasks:
  - id: T5.1.2.5.1
    title: "Swap 통합 테스트"
    hours: 2
  - id: T5.1.2.5.2
    title: "Lending 통합 테스트"
    hours: 3
  - id: T5.1.2.5.3
    title: "Subscription 통합 테스트"
    hours: 3
```

### C5.1.3: Fork Tests

메인넷 포크를 사용한 실제 환경 테스트.

```solidity
// test/fork/MainnetForkTest.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

contract MainnetForkTest is Test {
    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
    }

    function test_uniswapSwap_mainnet() public { }
    function test_aaveLending_mainnet() public { }
}
```

#### Tasks

##### T5.1.3.1: Mainnet Fork Setup
```yaml
task_id: T5.1.3.1
title: "메인넷 포크 테스트 환경"
priority: high
estimated_hours: 4
dependencies: [T5.1.2.5]
acceptance_criteria:
  - Foundry fork 설정
  - 실제 컨트랙트 주소 매핑
  - 토큰 잔액 설정 (vm.deal, vm.store)
subtasks:
  - id: T5.1.3.1.1
    title: "Fork 환경 구성"
    hours: 2
  - id: T5.1.3.1.2
    title: "주소 매핑 헬퍼"
    hours: 1
  - id: T5.1.3.1.3
    title: "잔액 설정 유틸"
    hours: 1
```

##### T5.1.3.2: Uniswap Fork Tests
```yaml
task_id: T5.1.3.2
title: "Uniswap V3 포크 테스트"
priority: high
estimated_hours: 5
dependencies: [T5.1.3.1]
acceptance_criteria:
  - 실제 Uniswap 라우터와 스왑
  - 실제 가격 데이터 사용
  - 슬리피지 실제 검증
subtasks:
  - id: T5.1.3.2.1
    title: "ETH/USDC 스왑 테스트"
    hours: 2
  - id: T5.1.3.2.2
    title: "멀티홉 스왑 테스트"
    hours: 2
  - id: T5.1.3.2.3
    title: "슬리피지 에지 케이스"
    hours: 1
```

##### T5.1.3.3: AAVE Fork Tests
```yaml
task_id: T5.1.3.3
title: "AAVE V3 포크 테스트"
priority: high
estimated_hours: 5
dependencies: [T5.1.3.1]
acceptance_criteria:
  - 실제 AAVE Pool과 상호작용
  - 실제 금리 및 Health Factor
  - 실제 aToken/debtToken
subtasks:
  - id: T5.1.3.3.1
    title: "Supply/Withdraw 테스트"
    hours: 2
  - id: T5.1.3.3.2
    title: "Borrow/Repay 테스트"
    hours: 2
  - id: T5.1.3.3.3
    title: "Health Factor 검증"
    hours: 1
```

### C5.1.4: Security Testing

보안 테스트 및 퍼징.

#### Tasks

##### T5.1.4.1: Fuzzing Setup
```yaml
task_id: T5.1.4.1
title: "Foundry Fuzzing 설정"
priority: critical
estimated_hours: 6
dependencies: [T5.1.2.1]
acceptance_criteria:
  - Foundry fuzz 테스트 구성
  - Invariant 테스트 정의
  - 시드 설정 및 실행 횟수
subtasks:
  - id: T5.1.4.1.1
    title: "Fuzz 테스트 구조"
    hours: 2
  - id: T5.1.4.1.2
    title: "Invariant 정의"
    hours: 2
  - id: T5.1.4.1.3
    title: "테스트 실행 설정"
    hours: 2
```

##### T5.1.4.2: Critical Path Fuzzing
```yaml
task_id: T5.1.4.2
title: "핵심 경로 퍼징"
priority: critical
estimated_hours: 8
dependencies: [T5.1.4.1]
acceptance_criteria:
  - UserOp 검증 퍼징
  - 서명 검증 퍼징
  - Paymaster 검증 퍼징
  - Nonce 처리 퍼징
subtasks:
  - id: T5.1.4.2.1
    title: "UserOp 퍼징"
    hours: 3
  - id: T5.1.4.2.2
    title: "Signature 퍼징"
    hours: 2
  - id: T5.1.4.2.3
    title: "Paymaster 퍼징"
    hours: 2
  - id: T5.1.4.2.4
    title: "Nonce 퍼징"
    hours: 1
```

##### T5.1.4.3: Echidna Integration
```yaml
task_id: T5.1.4.3
title: "Echidna 고급 퍼징"
priority: high
estimated_hours: 6
dependencies: [T5.1.4.2]
acceptance_criteria:
  - Echidna 설정 및 실행
  - 상태 기반 퍼징
  - 커버리지 분석
subtasks:
  - id: T5.1.4.3.1
    title: "Echidna 설정"
    hours: 2
  - id: T5.1.4.3.2
    title: "Property 테스트"
    hours: 2
  - id: T5.1.4.3.3
    title: "커버리지 분석"
    hours: 2
```

##### T5.1.4.4: Slither Static Analysis
```yaml
task_id: T5.1.4.4
title: "Slither 정적 분석"
priority: high
estimated_hours: 4
dependencies: [Phase4.Complete]
acceptance_criteria:
  - Slither 실행 및 리포트
  - High/Medium 이슈 해결
  - False positive 문서화
subtasks:
  - id: T5.1.4.4.1
    title: "Slither 실행"
    hours: 1
  - id: T5.1.4.4.2
    title: "이슈 분석 및 해결"
    hours: 2
  - id: T5.1.4.4.3
    title: "리포트 작성"
    hours: 1
```

---

## Component 5.2: SDK Integration

### C5.2.1: TypeScript SDK

```typescript
// packages/sdk/packages/core/src/index.ts
export { StableNetClient } from './client';
export { createSmartAccount } from './account';
export { createPaymaster } from './paymaster';
export { createBundler } from './bundler';
export * from './types';
```

#### Tasks

##### T5.2.1.1: Contract ABIs & Types
```yaml
task_id: T5.2.1.1
title: "컨트랙트 ABI 및 타입 생성"
priority: critical
estimated_hours: 4
dependencies: [Phase4.Complete]
acceptance_criteria:
  - Foundry → TypeScript ABI 추출
  - typechain 또는 viem 타입 생성
  - 버전 관리 및 내보내기
subtasks:
  - id: T5.2.1.1.1
    title: "ABI 추출 스크립트"
    hours: 1
  - id: T5.2.1.1.2
    title: "타입 생성"
    hours: 2
  - id: T5.2.1.1.3
    title: "내보내기 설정"
    hours: 1
```

##### T5.2.1.2: Client Implementation
```yaml
task_id: T5.2.1.2
title: "StableNetClient 구현"
priority: critical
estimated_hours: 8
dependencies: [T5.2.1.1]
acceptance_criteria:
  - Viem 기반 클라이언트
  - 체인 설정 관리
  - EntryPoint/Factory 연동
  - 에러 처리
subtasks:
  - id: T5.2.1.2.1
    title: "Client 기본 구조"
    hours: 2
  - id: T5.2.1.2.2
    title: "체인 설정"
    hours: 2
  - id: T5.2.1.2.3
    title: "컨트랙트 연동"
    hours: 2
  - id: T5.2.1.2.4
    title: "에러 처리"
    hours: 2
```

##### T5.2.1.3: Account Operations
```yaml
task_id: T5.2.1.3
title: "계정 작업 SDK"
priority: critical
estimated_hours: 10
dependencies: [T5.2.1.2]
acceptance_criteria:
  - createSmartAccount
  - buildUserOp
  - signUserOp
  - sendUserOp
subtasks:
  - id: T5.2.1.3.1
    title: "계정 생성 함수"
    hours: 3
  - id: T5.2.1.3.2
    title: "UserOp 빌더"
    hours: 3
  - id: T5.2.1.3.3
    title: "서명 함수"
    hours: 2
  - id: T5.2.1.3.4
    title: "전송 함수"
    hours: 2
```

##### T5.2.1.4: Paymaster SDK
```yaml
task_id: T5.2.1.4
title: "Paymaster SDK"
priority: high
estimated_hours: 8
dependencies: [T5.2.1.3]
acceptance_criteria:
  - getPaymasterData
  - sponsorUserOp
  - ERC-20 결제 지원
subtasks:
  - id: T5.2.1.4.1
    title: "Paymaster 데이터 생성"
    hours: 3
  - id: T5.2.1.4.2
    title: "후원 요청 함수"
    hours: 3
  - id: T5.2.1.4.3
    title: "ERC-20 통합"
    hours: 2
```

##### T5.2.1.5: Module SDK
```yaml
task_id: T5.2.1.5
title: "Module SDK"
priority: high
estimated_hours: 8
dependencies: [T5.2.1.3]
acceptance_criteria:
  - installModule
  - uninstallModule
  - 모듈별 헬퍼 함수
subtasks:
  - id: T5.2.1.5.1
    title: "모듈 설치/제거"
    hours: 3
  - id: T5.2.1.5.2
    title: "Validator 헬퍼"
    hours: 2
  - id: T5.2.1.5.3
    title: "Executor 헬퍼"
    hours: 2
  - id: T5.2.1.5.4
    title: "Hook 헬퍼"
    hours: 1
```

##### T5.2.1.6: Stealth SDK
```yaml
task_id: T5.2.1.6
title: "Stealth Address SDK"
priority: high
estimated_hours: 10
dependencies: [T5.2.1.3]
acceptance_criteria:
  - generateStealthAddress
  - scanAnnouncements
  - computeStealthKey
  - Enterprise Stealth 지원
subtasks:
  - id: T5.2.1.6.1
    title: "주소 생성 함수"
    hours: 3
  - id: T5.2.1.6.2
    title: "스캔 함수"
    hours: 3
  - id: T5.2.1.6.3
    title: "키 계산"
    hours: 2
  - id: T5.2.1.6.4
    title: "Enterprise 함수"
    hours: 2
```

### C5.2.2: React Hooks

```typescript
// packages/sdk/packages/react/src/hooks/useSmartAccount.ts
export function useSmartAccount(config: SmartAccountConfig) {
  // ...
}

export function useUserOp(account: SmartAccount) {
  // ...
}

export function usePaymaster(config: PaymasterConfig) {
  // ...
}
```

#### Tasks

##### T5.2.2.1: React Provider Setup
```yaml
task_id: T5.2.2.1
title: "React Provider 설정"
priority: high
estimated_hours: 4
dependencies: [T5.2.1.2]
acceptance_criteria:
  - StableNetProvider 컴포넌트
  - Context 설정
  - 설정 관리
subtasks:
  - id: T5.2.2.1.1
    title: "Provider 구현"
    hours: 2
  - id: T5.2.2.1.2
    title: "Context 설정"
    hours: 2
```

##### T5.2.2.2: Account Hooks
```yaml
task_id: T5.2.2.2
title: "계정 관련 Hooks"
priority: high
estimated_hours: 6
dependencies: [T5.2.2.1]
acceptance_criteria:
  - useSmartAccount
  - useAccountBalance
  - useAccountModules
subtasks:
  - id: T5.2.2.2.1
    title: "useSmartAccount"
    hours: 2
  - id: T5.2.2.2.2
    title: "useAccountBalance"
    hours: 2
  - id: T5.2.2.2.3
    title: "useAccountModules"
    hours: 2
```

##### T5.2.2.3: Transaction Hooks
```yaml
task_id: T5.2.2.3
title: "트랜잭션 Hooks"
priority: high
estimated_hours: 6
dependencies: [T5.2.2.2]
acceptance_criteria:
  - useUserOp
  - useSendTransaction
  - useTransactionStatus
subtasks:
  - id: T5.2.2.3.1
    title: "useUserOp"
    hours: 2
  - id: T5.2.2.3.2
    title: "useSendTransaction"
    hours: 2
  - id: T5.2.2.3.3
    title: "useTransactionStatus"
    hours: 2
```

---

## Component 5.3: Deployment

### C5.3.1: Deployment Scripts

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

contract DeployCore is Script {
    function run() external {
        vm.startBroadcast();
        // Deploy EntryPoint, Kernel, Factory
        vm.stopBroadcast();
    }
}
```

#### Tasks

##### T5.3.1.1: Core Deployment Script
```yaml
task_id: T5.3.1.1
title: "Core 배포 스크립트"
priority: critical
estimated_hours: 4
dependencies: [T5.1.2.1]
acceptance_criteria:
  - EntryPoint 배포
  - Kernel 구현체 배포
  - KernelFactory 배포
  - 주소 기록 및 검증
subtasks:
  - id: T5.3.1.1.1
    title: "배포 스크립트 작성"
    hours: 2
  - id: T5.3.1.1.2
    title: "주소 검증 로직"
    hours: 1
  - id: T5.3.1.1.3
    title: "환경별 설정"
    hours: 1
```

##### T5.3.1.2: Module Deployment Script
```yaml
task_id: T5.3.1.2
title: "모듈 배포 스크립트"
priority: high
estimated_hours: 4
dependencies: [T5.3.1.1]
acceptance_criteria:
  - Paymaster 배포
  - Validator 배포
  - Executor 배포
  - Hook 배포
subtasks:
  - id: T5.3.1.2.1
    title: "Paymaster 배포"
    hours: 1
  - id: T5.3.1.2.2
    title: "Validator 배포"
    hours: 1
  - id: T5.3.1.2.3
    title: "Executor 배포"
    hours: 1
  - id: T5.3.1.2.4
    title: "Hook 배포"
    hours: 1
```

##### T5.3.1.3: Privacy Deployment Script
```yaml
task_id: T5.3.1.3
title: "Privacy 모듈 배포 스크립트"
priority: high
estimated_hours: 4
dependencies: [T5.3.1.2]
acceptance_criteria:
  - Standard Stealth 컨트랙트 배포
  - Enterprise Stealth 컨트랙트 배포
  - 초기 설정 (roles, operators)
subtasks:
  - id: T5.3.1.3.1
    title: "Standard Stealth 배포"
    hours: 1.5
  - id: T5.3.1.3.2
    title: "Enterprise Stealth 배포"
    hours: 1.5
  - id: T5.3.1.3.3
    title: "초기 설정"
    hours: 1
```

### C5.3.2: Verification & Documentation

#### Tasks

##### T5.3.2.1: Contract Verification
```yaml
task_id: T5.3.2.1
title: "컨트랙트 검증"
priority: critical
estimated_hours: 4
dependencies: [T5.3.1.3]
acceptance_criteria:
  - Etherscan/Blockscout 소스코드 검증
  - 검증 스크립트 자동화
  - 모든 체인에서 검증
subtasks:
  - id: T5.3.2.1.1
    title: "검증 스크립트"
    hours: 2
  - id: T5.3.2.1.2
    title: "체인별 실행"
    hours: 2
```

##### T5.3.2.2: Deployment Documentation
```yaml
task_id: T5.3.2.2
title: "배포 문서화"
priority: high
estimated_hours: 4
dependencies: [T5.3.2.1]
acceptance_criteria:
  - 체인별 배포 주소 문서
  - 배포 절차 가이드
  - 트러블슈팅 가이드
subtasks:
  - id: T5.3.2.2.1
    title: "주소 문서"
    hours: 1
  - id: T5.3.2.2.2
    title: "배포 가이드"
    hours: 2
  - id: T5.3.2.2.3
    title: "트러블슈팅"
    hours: 1
```

### C5.3.3: Multi-Chain Deployment

#### Tasks

##### T5.3.3.1: Testnet Deployment
```yaml
task_id: T5.3.3.1
title: "테스트넷 배포"
priority: critical
estimated_hours: 6
dependencies: [T5.3.1.3]
acceptance_criteria:
  - Sepolia 배포
  - Base Sepolia 배포
  - Arbitrum Sepolia 배포
  - 통합 테스트 실행
subtasks:
  - id: T5.3.3.1.1
    title: "Sepolia 배포"
    hours: 2
  - id: T5.3.3.1.2
    title: "Base Sepolia 배포"
    hours: 2
  - id: T5.3.3.1.3
    title: "Arbitrum Sepolia 배포"
    hours: 2
```

##### T5.3.3.2: Mainnet Deployment
```yaml
task_id: T5.3.3.2
title: "메인넷 배포"
priority: critical
estimated_hours: 8
dependencies: [T5.3.3.1, T5.1.4.4]
acceptance_criteria:
  - 보안 감사 완료
  - 멀티시그 소유권 설정
  - Ethereum Mainnet 배포
  - L2 배포 (Base, Arbitrum)
subtasks:
  - id: T5.3.3.2.1
    title: "배포 전 체크리스트"
    hours: 2
  - id: T5.3.3.2.2
    title: "Ethereum 배포"
    hours: 2
  - id: T5.3.3.2.3
    title: "Base 배포"
    hours: 2
  - id: T5.3.3.2.4
    title: "Arbitrum 배포"
    hours: 2
```

---

## 테스트 매트릭스

### Coverage Requirements

| Category | Target | Metric |
|----------|--------|--------|
| Unit Tests | 90%+ | Line Coverage |
| Integration | 80%+ | Branch Coverage |
| Critical Paths | 100% | Path Coverage |

### Test Execution Matrix

| Environment | Unit | Integration | Fork | Fuzz |
|-------------|------|-------------|------|------|
| Local | ✅ | ✅ | ✅ | ✅ |
| CI | ✅ | ✅ | ⏳ | ⏳ |
| Pre-deploy | ✅ | ✅ | ✅ | ✅ |

---

## 의존성 그래프

```
Phase 1-4 Complete
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
┌───────────────────┐                    ┌───────────────────┐
│  Unit Tests       │                    │  SDK Types/ABIs   │
│  [T5.1.1.*]       │                    │  [T5.2.1.1]       │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│ Integration Tests │                    │  SDK Client       │
│  [T5.1.2.*]       │                    │  [T5.2.1.2-6]     │
└─────────┬─────────┘                    └─────────┬─────────┘
          │                                        │
          ├────────────────────────────────────────┤
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│   Fork Tests      │                    │   React Hooks     │
│  [T5.1.3.*]       │                    │  [T5.2.2.*]       │
└─────────┬─────────┘                    └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Security Tests   │
│  [T5.1.4.*]       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Deploy Scripts   │
│  [T5.3.1.*]       │
└─────────┬─────────┘
          │
          ├──────────────────┐
          ▼                  ▼
┌───────────────────┐  ┌───────────────────┐
│  Testnet Deploy   │  │  Verification     │
│  [T5.3.3.1]       │  │  [T5.3.2.*]       │
└─────────┬─────────┘  └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Mainnet Deploy   │
│  [T5.3.3.2]       │
└───────────────────┘
```

---

## 시간 추정

| Component | Tasks | 예상 시간 |
|-----------|-------|-----------|
| C5.1.1 Unit Tests | 5 | 54h |
| C5.1.2 Integration | 5 | 36h |
| C5.1.3 Fork Tests | 3 | 14h |
| C5.1.4 Security | 4 | 24h |
| C5.2.1 TypeScript SDK | 6 | 48h |
| C5.2.2 React Hooks | 3 | 16h |
| C5.3 Deployment | 5 | 30h |
| **Total** | **31** | **~222h (5-6 weeks)** |

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/contracts.yml
name: Contracts CI

on:
  push:
    paths:
      - 'packages/contracts/**'
  pull_request:
    paths:
      - 'packages/contracts/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test -vvv
      - run: forge coverage

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Slither
        uses: crytic/slither-action@v0.3.0
```

### Pre-deployment Checklist

```yaml
checklist:
  security:
    - [ ] Slither 분석 통과
    - [ ] Echidna 퍼징 완료
    - [ ] 외부 감사 완료 (선택)

  testing:
    - [ ] Unit test 90%+ 커버리지
    - [ ] Integration test 통과
    - [ ] Fork test 통과

  documentation:
    - [ ] NatSpec 완료
    - [ ] 배포 가이드 완료
    - [ ] SDK 문서 완료

  deployment:
    - [ ] 테스트넷 배포 검증
    - [ ] 멀티시그 설정
    - [ ] 소스코드 검증
```

---

## 다음 단계

Phase 5 완료 후:
1. 외부 보안 감사 진행
2. 프로덕션 모니터링 설정
3. 버그 바운티 프로그램 시작
4. 사용자 피드백 수집 및 개선
