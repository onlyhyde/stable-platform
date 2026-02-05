# 06. Remaining Tasks - Smart Contract Implementation

> **Last Updated**: 2025-02-05
> **Status**: Active Development

## Overview

StableNet Smart Contract 프로젝트의 남은 작업 리스트입니다.

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Core | ✅ Complete | 100% |
| Phase 2: Paymaster & Modules | ✅ Complete | ~98% |
| Phase 3: Privacy | ✅ Complete | 100% |
| Phase 4: DeFi & Extensions | ✅ Complete | 100% |
| Phase 5: Integration | ✅ Complete | 100% |

---

## Completed Work

### Phase 1: Core (194 tests passed)
- ✅ EntryPoint (with EIP-7702 support)
- ✅ Kernel Smart Account
- ✅ KernelFactory
- ✅ ECDSAValidator

### Phase 2: Paymaster & Modules
- ✅ VerifyingPaymaster
- ✅ ERC20Paymaster
- ✅ Permit2Paymaster
- ✅ SponsorPaymaster
- ✅ WebAuthnValidator
- ✅ MultiSigValidator
- ✅ WeightedECDSAValidator
- ✅ MultiChainValidator
- ✅ SessionKeyExecutor
- ✅ RecurringPaymentExecutor
- ✅ SpendingLimitHook
- ✅ AuditHook
- ✅ TokenReceiverFallback
- ✅ FlashLoanFallback

### Phase 3: Privacy
- ✅ ERC5564Announcer (Standard Stealth)
- ✅ ERC6538Registry (Standard Stealth)
- ✅ PrivateBank
- ✅ StealthVault (Enterprise)
- ✅ StealthLedger (Enterprise)
- ✅ WithdrawalManager (Enterprise)
- ✅ RoleManager (Enterprise)

### Phase 4: DeFi (Partial)
- ✅ LendingPool (standalone)
- ✅ PriceOracle (TWAP-based)
- ✅ StakingVault (standalone)
- ✅ SubscriptionManager
- ✅ ERC7715PermissionManager

---

## Remaining Tasks

### Priority Legend
- 🔴 **Critical**: Required for core functionality
- 🟠 **High**: Important for complete feature set
- 🟡 **Medium**: SDK/Integration work
- 🟢 **Low**: Optional/Enhancement

---

### 🔴 Critical Tasks

#### P2-GAP-001: PolicyHook
```yaml
task_id: P2-GAP-001
title: "PolicyHook Implementation"
priority: critical
estimated_hours: 8
location: /poc-contract/src/erc7579-hooks/PolicyHook.sol
dependencies: [Phase2.Hook]
description: |
  ERC-7579 Policy validation Hook module
  - Pre-execution policy verification
  - Whitelist/Blacklist validation
  - Amount limit policies
  - Target contract restrictions
acceptance_criteria:
  - IHook interface implementation
  - Policy configuration per account
  - preCheck/postCheck validation
  - Policy update with owner permission
```

#### P4-DEFI-001: SwapExecutor
```yaml
task_id: P4-DEFI-001
title: "SwapExecutor Implementation"
priority: critical
estimated_hours: 19
location: /poc-contract/src/erc7579-executors/SwapExecutor.sol
dependencies: [Phase2.Executor]
description: |
  ERC-7579 Executor for DEX swaps from Smart Account
  - Uniswap V3 SwapRouter integration
  - Single-hop & Multi-hop swaps
  - Slippage protection
  - Token whitelist
subtasks:
  - id: T4.1.1.1
    title: "Contract skeleton & SwapRouter integration"
    hours: 4
  - id: T4.1.1.2
    title: "exactInputSingle swap implementation"
    hours: 6
  - id: T4.1.1.3
    title: "Multi-hop swap (path-based)"
    hours: 5
  - id: T4.1.1.4
    title: "Swap limits & security"
    hours: 4
```

#### P4-DEFI-002: ChainlinkOracle
```yaml
task_id: P4-DEFI-002
title: "ChainlinkOracle Implementation"
priority: critical
estimated_hours: 13
location: /poc-contract/src/defi/ChainlinkOracle.sol
dependencies: [IPriceOracle]
description: |
  Production-grade Chainlink price oracle
  - AggregatorV3Interface integration
  - Staleness validation (configurable period)
  - 18 decimals normalization
  - getPrice/getQuote/isSupportedToken
subtasks:
  - id: T4.1.2.1
    title: "IPriceOracle implementation"
    hours: 5
  - id: T4.1.2.2
    title: "Price feed management"
    hours: 4
  - id: T4.1.2.3
    title: "Quote calculation"
    hours: 4
```

---

### 🟠 High Priority Tasks

#### P4-DEFI-003: LendingExecutor
```yaml
task_id: P4-DEFI-003
title: "LendingExecutor Implementation"
priority: high
estimated_hours: 23
location: /poc-contract/src/erc7579-executors/LendingExecutor.sol
dependencies: [Phase2.Executor, LendingPool]
description: |
  ERC-7579 Executor for AAVE V3 lending operations
  - Supply/Withdraw functionality
  - Borrow/Repay functionality
  - Smart Account permission verification
subtasks:
  - id: T4.2.1.1
    title: "Contract structure & IPool integration"
    hours: 4
  - id: T4.2.1.2
    title: "Supply implementation"
    hours: 5
  - id: T4.2.1.3
    title: "Withdraw implementation"
    hours: 4
  - id: T4.2.1.4
    title: "Borrow implementation"
    hours: 6
  - id: T4.2.1.5
    title: "Repay implementation"
    hours: 4
```

#### P4-DEFI-004: HealthFactorHook
```yaml
task_id: P4-DEFI-004
title: "HealthFactorHook Implementation"
priority: high
estimated_hours: 5
location: /poc-contract/src/erc7579-hooks/HealthFactorHook.sol
dependencies: [LendingExecutor]
description: |
  Collateral health verification Hook
  - AAVE getUserAccountData integration
  - Health Factor threshold validation
  - Transaction rejection on liquidation risk
```

#### P4-DEFI-005: StakingExecutor
```yaml
task_id: P4-DEFI-005
title: "StakingExecutor Implementation"
priority: high
estimated_hours: 17
location: /poc-contract/src/erc7579-executors/StakingExecutor.sol
dependencies: [Phase2.Executor, StakingVault]
description: |
  ERC-7579 Executor for staking operations
  - stake/unstake functionality
  - claimRewards/compoundRewards
  - Pool registry management
```

#### P4-SUB-001: MerchantRegistry
```yaml
task_id: P4-SUB-001
title: "MerchantRegistry Implementation"
priority: high
estimated_hours: 5
location: /poc-contract/src/subscription/MerchantRegistry.sol
dependencies: [SubscriptionManager]
description: |
  Merchant registration and management
  - Merchant registration/verification
  - Fee rate configuration
  - Verifier role management
```

---

### 🟡 Medium Priority Tasks (SDK Integration)

#### P5-SDK-001: Contract ABIs & Types
```yaml
task_id: P5-SDK-001
title: "Contract ABI & TypeScript Types"
priority: medium
estimated_hours: 4
location: /stable-platform/packages/sdk/
description: |
  - Foundry → TypeScript ABI extraction
  - viem type generation
  - Package exports configuration
```

#### P5-SDK-002: StableNetClient
```yaml
task_id: P5-SDK-002
title: "StableNetClient Implementation"
priority: medium
estimated_hours: 8
location: /stable-platform/packages/sdk/packages/core/
dependencies: [P5-SDK-001]
description: |
  - Viem-based client
  - Chain configuration management
  - EntryPoint/Factory integration
  - Error handling
```

#### P5-SDK-003: Account Operations SDK
```yaml
task_id: P5-SDK-003
title: "Account Operations SDK"
priority: medium
estimated_hours: 10
location: /stable-platform/packages/sdk/packages/core/
dependencies: [P5-SDK-002]
description: |
  - createSmartAccount
  - buildUserOp
  - signUserOp
  - sendUserOp
```

#### P5-SDK-004: Paymaster SDK
```yaml
task_id: P5-SDK-004
title: "Paymaster SDK"
priority: medium
estimated_hours: 8
location: /stable-platform/packages/sdk/packages/core/
dependencies: [P5-SDK-003]
description: |
  - getPaymasterData
  - sponsorUserOp
  - ERC-20 payment support
```

#### P5-SDK-005: Module SDK
```yaml
task_id: P5-SDK-005
title: "Module SDK"
priority: medium
estimated_hours: 8
location: /stable-platform/packages/sdk/packages/core/
dependencies: [P5-SDK-003]
description: |
  - installModule / uninstallModule
  - Validator helpers
  - Executor helpers
  - Hook helpers
```

#### P5-SDK-006: Stealth Address SDK
```yaml
task_id: P5-SDK-006
title: "Stealth Address SDK"
priority: medium
estimated_hours: 10
location: /stable-platform/packages/sdk/packages/core/
dependencies: [P5-SDK-003]
description: |
  - generateStealthAddress
  - scanAnnouncements
  - computeStealthKey
  - Enterprise stealth support
```

---

### 🟢 Low Priority Tasks (Optional)

#### P4-DEFI-006: PerpetualExecutor
```yaml
task_id: P4-DEFI-006
title: "PerpetualExecutor Implementation"
priority: low
estimated_hours: 18
description: |
  Perpetual trading (GMX/dYdX integration)
  - openPosition / closePosition
  - Risk management Hook
```

#### P5-REACT-001: React Hooks
```yaml
task_id: P5-REACT-001
title: "React Hooks Implementation"
priority: low
estimated_hours: 16
description: |
  - StableNetProvider
  - useSmartAccount
  - useUserOp
  - usePaymaster
```

#### P5-TEST-001: Mainnet Fork Tests
```yaml
task_id: P5-TEST-001
title: "Mainnet Fork Tests"
priority: low
estimated_hours: 14
description: |
  - Uniswap V3 Fork Tests
  - AAVE V3 Fork Tests
```

#### P5-SEC-001: Security Testing
```yaml
task_id: P5-SEC-001
title: "Security Testing"
priority: low
estimated_hours: 16
description: |
  - Echidna Fuzzing
  - Slither Static Analysis
```

---

## Time Estimation Summary

| Priority | Tasks | Hours |
|----------|-------|-------|
| 🔴 Critical | 3 | ~40h |
| 🟠 High | 4 | ~50h |
| 🟡 Medium | 6 | ~48h |
| 🟢 Low | 4 | ~64h |
| **Total** | **17** | **~202h** |

---

## Recommended Execution Order

### Week 1-2: Phase 4 DeFi Executors
1. ✅ P2-GAP-001: PolicyHook (8h) - **COMPLETED 2025-02-05**
2. ✅ P4-DEFI-001: SwapExecutor (19h) - **COMPLETED 2025-02-05**
3. ✅ P4-DEFI-002: ChainlinkOracle (13h) - **Already in PriceOracle.sol** (42 tests)

### Week 3: Phase 4 DeFi Completion
4. ✅ P4-DEFI-003: LendingExecutor (23h) - **COMPLETED 2025-02-05**
5. ✅ P4-DEFI-004: HealthFactorHook (5h) - **COMPLETED 2025-02-05**

### Week 4: Phase 4 Wrap-up + SDK Start
6. ✅ P4-DEFI-005: StakingExecutor (17h) - **COMPLETED 2025-02-05**
7. ✅ P4-SUB-001: MerchantRegistry (5h) - **COMPLETED 2025-02-05**
8. ✅ P5-SDK-001: SDK ABIs/Types (4h) - **COMPLETED 2025-02-05**

### Week 5-6: Phase 5 SDK Integration
9. ✅ P5-SDK-002: SDK Client (8h) - **Already implemented in @stablenet/core**
10. ✅ P5-SDK-003: Account SDK (10h) - **Already implemented in @stablenet/core**
11. ✅ P5-SDK-004: Paymaster SDK (8h) - **Already implemented in @stablenet/plugin-paymaster**
12. ✅ P5-SDK-005: Module SDK (8h) - **COMPLETED 2025-02-05**
13. ✅ P5-SDK-006: Stealth SDK (10h) - **Already implemented in @stablenet/plugin-stealth**

### After: Optional
- ⬜ P4-DEFI-006: PerpetualExecutor
- ✅ P5-REACT-001: React Hooks - **COMPLETED 2025-02-05**
- ⬜ P5-TEST-001: Fork Tests
- ✅ P5-SEC-001: Security Testing - **COMPLETED 2025-02-05**

---

## Progress Tracking

### Completed
| Task ID | Title | Date | Notes |
|---------|-------|------|-------|
| P2-GAP-001 | PolicyHook | 2025-02-05 | 39 tests passed |
| P4-DEFI-001 | SwapExecutor | 2025-02-05 | 40 tests passed |
| P4-DEFI-002 | ChainlinkOracle | 2025-02-05 | Already in PriceOracle.sol (42 tests) |
| P4-DEFI-003 | LendingExecutor | 2025-02-05 | 42 tests passed |
| P4-DEFI-004 | HealthFactorHook | 2025-02-05 | 31 tests passed |
| P4-DEFI-005 | StakingExecutor | 2025-02-05 | 36 tests passed |
| P4-SUB-001 | MerchantRegistry | 2025-02-05 | 38 tests passed |
| P5-SDK-001 | Contract ABIs & Types | 2025-02-05 | @stablenet/plugin-defi (30 tests) |
| P5-SDK-002 | StableNetClient | 2025-02-05 | Already in @stablenet/core |
| P5-SDK-003 | Account Operations SDK | 2025-02-05 | Already in @stablenet/core |
| P5-SDK-004 | Paymaster SDK | 2025-02-05 | Already in @stablenet/plugin-paymaster |
| P5-SDK-005 | Module SDK | 2025-02-05 | @stablenet/plugin-modules (31 tests) |
| P5-SDK-006 | Stealth Address SDK | 2025-02-05 | Already in @stablenet/plugin-stealth |
| P5-REACT-001 | React Hooks | 2025-02-05 | usePaymaster, useModule hooks added |
| P5-SEC-001 | Security Testing | 2025-02-05 | Echidna fuzzing + Slither + Mythril |

### In Progress
| Task ID | Title | Started | ETA |
|---------|-------|---------|-----|
| - | - | - | - |

---

## Notes

### Technical Decisions
- All DeFi Executors implement `IExecutor` from ERC-7579
- ChainlinkOracle implements existing `IPriceOracle` interface
- SDK uses viem for type-safe contract interactions

### Dependencies
- poc-contract: `/Users/wm-it-22-00661/Work/github/stable-net/poc/poc-contract/`
- stable-platform: `/Users/wm-it-22-00661/Work/github/stable-net/poc/stable-platform/`

### Testing Strategy
- TDD approach: RED → GREEN → REFACTOR
- Foundry for Solidity unit tests
- Fork tests for mainnet integration validation
