# SDK Remaining Tasks

> **Version**: 1.0
> **Last Updated**: 2025-02-05
> **Status**: Active Development

---

## 1. 개요

StableNet SDK의 남은 작업 목록입니다.

### 1.1 완성도 요약

| 영역 | 완성도 | 비고 |
|------|--------|------|
| Core Packages | ~85% | EIP-7702 완료, 일부 유틸 추가 필요 |
| Plugin - ECDSA | ✅ 100% | |
| Plugin - Session Keys | ✅ 100% | |
| Plugin - Subscription | ~90% | MerchantRegistry 연동 완료 |
| Plugin - Paymaster | ~95% | ERC20Paymaster 미완성 |
| Plugin - Stealth | ~90% | Enterprise Stealth 미지원 |
| Plugin - DeFi | ✅ 100% | 2025-02-05 완료 |
| Plugin - Modules | ✅ 100% | 2025-02-05 완료 |
| **전체** | **~92%** | |

---

## 2. 완료된 작업

### 2.1 최근 완료 (2025-02-05)

| Task ID | 제목 | 패키지 | 비고 |
|---------|------|--------|------|
| SDK-DEFI-001 | SwapExecutor ABI & Types | `@stablenet/plugin-defi` | 40 tests |
| SDK-DEFI-002 | LendingExecutor ABI & Types | `@stablenet/plugin-defi` | 42 tests |
| SDK-DEFI-003 | StakingExecutor ABI & Types | `@stablenet/plugin-defi` | 36 tests |
| SDK-DEFI-004 | HealthFactorHook ABI & Types | `@stablenet/plugin-defi` | 31 tests |
| SDK-DEFI-005 | MerchantRegistry ABI & Types | `@stablenet/plugin-defi` | 38 tests |
| SDK-MOD-001 | Module InitData Encoders | `@stablenet/plugin-modules` | All executors/hooks |
| SDK-MOD-002 | Module Installation Actions | `@stablenet/plugin-modules` | install/uninstall |

### 2.2 기존 완료

| 패키지 | 완료일 | 주요 기능 |
|--------|--------|----------|
| `@stablenet/core` | 2025-01 | BundlerClient, SmartAccountClient, EIP-7702 |
| `@stablenet/plugin-ecdsa` | 2025-01 | ECDSAValidator 통합 |
| `@stablenet/plugin-session-keys` | 2025-01 | SessionKeyExecutor 통합 |
| `@stablenet/plugin-paymaster` | 2025-01 | Verifying, Sponsor, Permit2 Paymaster |
| `@stablenet/plugin-stealth` | 2025-01 | EIP-5564/6538 완전 지원 |
| `@stablenet/plugin-subscription` | 2025-01 | SubscriptionManager, RecurringPayment |

---

## 3. 남은 작업

### 3.1 우선순위 범례

- 🔴 **Critical**: 핵심 기능 완성에 필수
- 🟠 **High**: 중요 기능, 빠른 구현 권장
- 🟡 **Medium**: 유용하지만 필수 아님
- 🟢 **Low**: Optional, 향후 구현

---

### 3.2 🔴 Critical Tasks

#### SDK-CORE-001: StableNetClient 통합

```yaml
task_id: SDK-CORE-001
title: "StableNetClient 통합 클라이언트"
priority: critical
estimated_hours: 8
package: "@stablenet/core"
description: |
  모든 기능을 통합하는 고수준 클라이언트 구현
  - 체인 설정 자동 관리
  - 플러그인 자동 로드
  - 에러 핸들링 통합
acceptance_criteria:
  - createStableNetClient() 함수 구현
  - 체인별 주소 자동 설정
  - 플러그인 레이지 로딩
  - 통합 에러 타입
```

**예상 인터페이스:**

```typescript
const client = createStableNetClient({
  chain: sepolia,
  signer: privateKeyToAccount('0x...'),
  bundlerUrl: 'https://bundler.example.com',
  paymasterUrl: 'https://paymaster.example.com', // optional
  plugins: ['ecdsa', 'stealth', 'defi'], // optional
})

// Auto-configured
await client.account.sendTransaction({ to, value })
await client.stealth.generateAddress(recipient)
await client.defi.swap({ tokenIn, tokenOut, amount })
```

---

### 3.3 🟠 High Priority Tasks

#### SDK-CORE-002: Account SDK 고도화

```yaml
task_id: SDK-CORE-002
title: "Account SDK 고도화"
priority: high
estimated_hours: 10
package: "@stablenet/accounts"
description: |
  Smart Account 관리 기능 확장
  - 다양한 signer 타입 지원
  - 계정 복구 기능
  - 배치 트랜잭션 유틸
acceptance_criteria:
  - WalletConnect signer 지원
  - Social recovery 유틸
  - Batch execution helper
```

#### SDK-PAY-001: ERC20Paymaster 완성

```yaml
task_id: SDK-PAY-001
title: "ERC20Paymaster SDK"
priority: high
estimated_hours: 6
package: "@stablenet/plugin-paymaster"
description: |
  ERC-20 토큰 결제 Paymaster 지원
  - ERC20Paymaster 클라이언트
  - 토큰 가격 조회
  - 가스 예상 계산
acceptance_criteria:
  - createERC20Paymaster() 함수
  - 토큰 allowance 체크
  - 가스비 토큰 환산
```

#### SDK-VAL-001: MultiChainValidator SDK

```yaml
task_id: SDK-VAL-001
title: "MultiChainValidator SDK"
priority: high
estimated_hours: 8
package: "@stablenet/plugin-modules"
description: |
  멀티체인 서명 검증 지원
  - Merkle Proof 생성
  - Cross-chain 서명 검증
  - 체인별 설정 관리
acceptance_criteria:
  - encodeMultiChainValidatorInitData()
  - generateMerkleProof()
  - verifyAcrossChains()
```

---

### 3.4 🟡 Medium Priority Tasks

#### SDK-STEALTH-001: Enterprise Stealth SDK

```yaml
task_id: SDK-STEALTH-001
title: "Enterprise Stealth SDK"
priority: medium
estimated_hours: 16
package: "@stablenet/plugin-stealth"
description: |
  Enterprise Stealth 기능 지원
  - StealthVault 통합
  - StealthLedger 조회
  - WithdrawalManager 인터페이스
  - RoleManager 인터페이스
acceptance_criteria:
  - Enterprise Stealth 전체 플로우 지원
  - Multi-sig 출금 요청
  - UTXO 조회 및 관리
```

#### SDK-PLUGIN-001: AutoSwapPlugin SDK

```yaml
task_id: SDK-PLUGIN-001
title: "AutoSwapPlugin SDK"
priority: medium
estimated_hours: 8
package: "@stablenet/plugin-defi"
description: |
  자동 스왑 플러그인 지원
  - DCA 주문 생성
  - Limit Order 설정
  - Stop Loss / Take Profit
acceptance_criteria:
  - AutoSwapPluginAbi export
  - Order 타입 및 생성 헬퍼
  - Order 상태 조회
```

#### SDK-VAL-002: WeightedECDSAValidator SDK

```yaml
task_id: SDK-VAL-002
title: "WeightedECDSAValidator SDK"
priority: medium
estimated_hours: 4
package: "@stablenet/plugin-modules"
description: |
  가중치 기반 ECDSA 검증 지원
  - Signer 가중치 설정
  - 임계값 계산
acceptance_criteria:
  - encodeWeightedECDSAValidatorInitData()
  - 가중치 계산 헬퍼
```

---

### 3.5 🟢 Low Priority Tasks

#### SDK-BRIDGE-001: Bridge SDK

```yaml
task_id: SDK-BRIDGE-001
title: "Bridge SDK"
priority: low
estimated_hours: 20
package: "@stablenet/plugin-bridge" (신규)
description: |
  크로스체인 브릿지 SDK
  - SecureBridge 통합
  - 브릿지 상태 추적
  - 챌린지 기간 모니터링
```

#### SDK-COMPLY-001: Compliance SDK

```yaml
task_id: SDK-COMPLY-001
title: "Compliance SDK"
priority: low
estimated_hours: 12
package: "@stablenet/plugin-compliance" (신규)
description: |
  규제 준수 SDK
  - KYC 상태 조회
  - 감사 로그 조회
  - 규제 체크
```

#### SDK-REACT-001: React Hooks

```yaml
task_id: SDK-REACT-001
title: "React Hooks"
priority: low
estimated_hours: 16
package: "@stablenet/react" (신규)
description: |
  React 통합
  - StableNetProvider
  - useSmartAccount
  - useUserOp
  - usePaymaster
  - useStealth
```

#### SDK-TEST-001: E2E Integration Tests

```yaml
task_id: SDK-TEST-001
title: "E2E Integration Tests"
priority: low
estimated_hours: 16
description: |
  SDK ↔ Contract E2E 테스트
  - Anvil fork 테스트
  - 실제 컨트랙트 연동
  - 전체 플로우 검증
```

---

## 4. 시간 예상 요약

| Priority | Tasks | 예상 시간 |
|----------|-------|----------|
| 🔴 Critical | 1 | ~8h |
| 🟠 High | 3 | ~24h |
| 🟡 Medium | 3 | ~28h |
| 🟢 Low | 4 | ~64h |
| **Total** | **11** | **~124h** |

---

## 5. 권장 실행 순서

### Phase 1: Core 완성 (1주)

1. ✅ SDK-DEFI-* (완료)
2. ✅ SDK-MOD-* (완료)
3. ⬜ SDK-CORE-001: StableNetClient 통합
4. ⬜ SDK-CORE-002: Account SDK 고도화

### Phase 2: Paymaster & Validators (1주)

5. ⬜ SDK-PAY-001: ERC20Paymaster
6. ⬜ SDK-VAL-001: MultiChainValidator

### Phase 3: Extended Features (2주)

7. ⬜ SDK-STEALTH-001: Enterprise Stealth
8. ⬜ SDK-PLUGIN-001: AutoSwapPlugin
9. ⬜ SDK-VAL-002: WeightedECDSAValidator

### Phase 4: Optional (향후)

10. ⬜ SDK-BRIDGE-001: Bridge SDK
11. ⬜ SDK-COMPLY-001: Compliance SDK
12. ⬜ SDK-REACT-001: React Hooks
13. ⬜ SDK-TEST-001: E2E Tests

---

## 6. Contract 문서와의 동기화

### 6.1 업데이트 필요 항목

`docs/contracts/06_REMAINING_TASKS.md` 파일에서 다음 항목들이 완료 처리되어야 합니다:

| Task ID | 제목 | 상태 변경 |
|---------|------|----------|
| P5-SDK-001 | Contract ABIs & Types | ⬜ → ✅ |
| P5-SDK-004 | Paymaster SDK | ⬜ → ✅ (부분) |
| P5-SDK-005 | Module SDK | ⬜ → ✅ |
| P5-SDK-006 | Stealth SDK | ⬜ → ✅ |

### 6.2 새로 추가된 SDK 완료 항목

```yaml
completed:
  - task: "P5-SDK-007: DeFi Plugin"
    date: "2025-02-05"
    package: "@stablenet/plugin-defi"
    contents:
      - SwapExecutor ABI & Types
      - LendingExecutor ABI & Types
      - StakingExecutor ABI & Types
      - HealthFactorHook ABI & Types
      - MerchantRegistry ABI & Types
      - Helper functions (calculateHealthFactor, calculateMinOutput, etc.)

  - task: "P5-SDK-008: Modules Plugin"
    date: "2025-02-05"
    package: "@stablenet/plugin-modules"
    contents:
      - Module installation/uninstallation utilities
      - All InitData encoders
      - Module query functions
```

---

## 7. 기술 결정 사항

### 7.1 별도 Contract SDK 불필요

**결론:** 기존 SDK 구조로 충분히 모든 Contract를 지원할 수 있습니다.

**이유:**
1. 모든 Contract ABI가 이미 플러그인에 포함됨
2. InitData encoder가 구현됨
3. 타입 정의가 완전함
4. 플러그인 아키텍처가 확장 가능

### 7.2 Enterprise Stealth SDK 확장 방식

`@stablenet/plugin-stealth` 패키지를 확장하여 Enterprise 기능 추가 권장:

```
plugin-stealth/
├── src/
│   ├── standard/     # 기존 EIP-5564/6538
│   │   ├── crypto.ts
│   │   ├── client.ts
│   │   └── actions.ts
│   │
│   └── enterprise/   # 신규 Enterprise
│       ├── vault.ts      # StealthVault
│       ├── ledger.ts     # StealthLedger
│       ├── withdrawal.ts # WithdrawalManager
│       └── roles.ts      # RoleManager
```

---

## 8. 관련 문서

- [00_SDK_OVERVIEW.md](./00_SDK_OVERVIEW.md) - SDK 개요
- [01_CONTRACT_SDK_MAPPING.md](./01_CONTRACT_SDK_MAPPING.md) - Contract ↔ SDK 매핑
- [../contracts/06_REMAINING_TASKS.md](../contracts/06_REMAINING_TASKS.md) - Contract 남은 작업

---

*문서 끝*
