# ERC-4337 Bundler Validation Implementation Plan

## Overview

This document outlines the implementation plan for adding missing ERC-4337 validation features to the bundler service.

**Current State**: POC (no validation logic, ~1,863 LOC)
**Target**: ERC-4337 compliant validation system

### Implementation Settings
- **Scope**: Phase 1-6 (Full) - All validation features
- **Reputation Storage**: In-memory (resets on restart)
- **Testing Strategy**: TDD (test-first approach)

---

## Architecture

### New Directory Structure
```
src/
├── abi/                           # NEW
│   ├── index.ts
│   └── entryPointV07.ts           # EntryPoint v0.7 ABI
├── validation/                    # NEW
│   ├── index.ts
│   ├── types.ts                   # ValidationResult, StakeInfo, etc.
│   ├── validator.ts               # UserOperationValidator (orchestrator)
│   ├── formatValidator.ts         # Format/schema validation
│   ├── simulationValidator.ts     # EntryPoint.simulateValidation
│   ├── reputationManager.ts       # Ban/throttle system
│   └── errors.ts                  # Revert parsing utilities
└── [existing files...]
```

### Validation Pipeline
```
eth_sendUserOperation
    │
    ▼
┌─────────────────────────────────┐
│  1. Format Validation           │  ← Static checks (no RPC)
│  - Zod schema validation        │
│  - Address format               │
│  - Gas range checks             │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  2. Reputation Check            │  ← Ban/throttle lookup
│  - Sender banned?               │
│  - Factory banned?              │
│  - Paymaster banned?            │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  3. State Validation            │  ← Chain state queries
│  - Nonce ordering               │
│  - Balance checks               │
│  - Account code existence       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  4. Simulation                  │  ← EntryPoint call
│  - simulateValidation           │
│  - Parse ValidationResult       │
│  - Signature/timestamp check    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  5. Add to Mempool              │  ← Success path
└─────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Types & ABI)
**Estimated Time**: 2-3 hours

**New Files**:
- `src/abi/index.ts` - ABI exports
- `src/abi/entryPointV07.ts` - Complete EntryPoint v0.7 ABI
- `src/validation/types.ts` - Validation types

**Key Types**:
```typescript
interface ValidationResult {
  returnInfo: ReturnInfo
  senderInfo: StakeInfo
  factoryInfo: StakeInfo
  paymasterInfo: StakeInfo
}

interface ReturnInfo {
  preOpGas: bigint
  prefund: bigint
  accountValidationData: bigint
  paymasterValidationData: bigint
  paymasterContext: Hex
}

interface StakeInfo {
  stake: bigint
  unstakeDelaySec: bigint
}

interface ReputationEntry {
  address: Address
  opsSeen: number
  opsIncluded: number
  status: 'ok' | 'throttled' | 'banned'
  lastUpdated: number
}
```

### Phase 2: Format Validation
**Estimated Time**: 3-4 hours

**New Files**:
- `src/validation/formatValidator.ts`
- `src/validation/errors.ts`

**Validation Rules**:
- Zod schema validation for all UserOperation fields
- Address format (0x-prefixed, 42 chars)
- Gas limits sanity checks:
  - `preVerificationGas >= 21000`
  - `verificationGasLimit >= 10000`
  - `callGasLimit >= 9000`
  - `maxFeePerGas > 0`
  - `maxPriorityFeePerGas <= maxFeePerGas`
- Signature length (minimum 65 bytes)
- Factory/factoryData consistency
- Paymaster field consistency

### Phase 3: Reputation Management
**Estimated Time**: 4-5 hours

**New Files**:
- `src/validation/reputationManager.ts`

**Configuration**:
```typescript
const REPUTATION_CONFIG = {
  minInclusionDenominator: 10,
  throttlingSlack: 10,
  banSlack: 50,
  minStake: parseEther('0.1'),
  minUnstakeDelay: 86400, // 1 day
}
```

**Features**:
- In-memory reputation store
- Check reputation status: `ok` | `throttled` | `banned`
- Track ops seen/included per address
- Separate tracking for senders, factories, paymasters
- Ban/unban functionality

### Phase 4: Simulation Integration
**Estimated Time**: 5-6 hours

**New Files**:
- `src/validation/simulationValidator.ts`

**Features**:
- Call `EntryPoint.simulateValidation()`
- Parse revert data (ValidationResult comes as error)
- Handle error types:
  - `FailedOp(uint256 opIndex, string reason)`
  - `FailedOpWithRevert(uint256 opIndex, string reason, bytes inner)`
- Validate timestamps (`validAfter`, `validUntil`)
- Extract gas estimates from simulation

### Phase 5: Main Validator & Integration
**Estimated Time**: 4-5 hours

**New Files**:
- `src/validation/validator.ts`
- `src/validation/index.ts`

**Modified Files**:
- `src/rpc/server.ts` - Integrate validator
- `src/mempool/mempool.ts` - Add nonce validation

**Main Validator**:
```typescript
class UserOperationValidator {
  async validate(userOp: UserOperation): Promise<ValidationResult> {
    // Phase 1: Format validation (fast rejection)
    this.formatValidator.validate(userOp)

    // Phase 2: Reputation check
    this.checkAllReputations(userOp)

    // Phase 3: State validation
    await this.validateState(userOp)

    // Phase 4: Simulation
    const result = await this.simulationValidator.simulate(userOp)

    // Phase 5: Signature/timestamp validation
    this.validateSignatureResult(result)

    return result
  }
}
```

### Phase 6: Bundle Validation & Receipt Parsing
**Estimated Time**: 3-4 hours

**Modified Files**:
- `src/executor/bundleExecutor.ts`

**Features**:
- Pre-flight bundle validation
- Re-simulate all ops before bundling
- Remove invalid ops from bundle
- Parse `FailedOp` errors on bundle failure
- Extract `UserOperationEvent` from receipts
- Update reputation on success/failure

---

## ERC-4337 Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32500 | REJECTED_BY_EP_OR_ACCOUNT | Rejected by EntryPoint or account |
| -32501 | REJECTED_BY_PAYMASTER | Rejected by paymaster |
| -32502 | BANNED_OPCODE | Banned opcode detected |
| -32503 | SHORT_DEADLINE | Timestamp too short |
| -32504 | BANNED_OR_THROTTLED | Address banned or throttled |
| -32505 | STAKE_OR_UNSTAKE_DELAY | Stake/unstake delay issue |
| -32506 | UNSUPPORTED_AGGREGATOR | Aggregator not supported |
| -32507 | INVALID_SIGNATURE | Invalid signature |

---

## File Summary

### New Files (9)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/abi/index.ts` | ABI exports | 10 |
| `src/abi/entryPointV07.ts` | EntryPoint v0.7 ABI | 200 |
| `src/validation/index.ts` | Module exports | 20 |
| `src/validation/types.ts` | Validation types | 100 |
| `src/validation/errors.ts` | Revert parsing | 150 |
| `src/validation/formatValidator.ts` | Format validation | 150 |
| `src/validation/reputationManager.ts` | Ban/throttle | 250 |
| `src/validation/simulationValidator.ts` | Simulation | 250 |
| `src/validation/validator.ts` | Main validator | 200 |

### Modified Files (4)
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add ValidationResult, StakeInfo types |
| `src/rpc/server.ts` | Integrate validator, improve errors |
| `src/mempool/mempool.ts` | Add nonce validation |
| `src/executor/bundleExecutor.ts` | Pre-flight validation, receipt parsing |

---

## Testing Strategy

### Test Structure
```
tests/
├── validation/
│   ├── formatValidator.test.ts
│   ├── reputationManager.test.ts
│   ├── simulationValidator.test.ts
│   └── validator.test.ts
└── integration/
    └── validation-flow.test.ts
```

### Test Cases by Component

**FormatValidator**:
- Valid/invalid addresses
- Gas limits (edge cases, overflow)
- Signature length validation
- Factory/factoryData consistency
- Paymaster field consistency

**ReputationManager**:
- Initial state (new address = 'ok')
- Throttle threshold transition
- Ban threshold transition
- Update seen/included counters
- Manual ban/unban

**SimulationValidator**:
- Parse ValidationResult success
- Parse FailedOp error
- Parse FailedOpWithRevert error
- Timestamp validation (validAfter, validUntil)

**Integration**:
- Full validation flow (happy path)
- Rejection at each phase
- Error code mapping

---

## Verification Commands

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Build
pnpm build

# Local testing (with Anvil)
anvil --fork-url https://rpc.sepolia.org &
pnpm start -- run \
  --network devnet \
  --beneficiary 0x... \
  --private-key 0x...
```

---

## Estimated Timeline

| Phase | Content | Est. Time |
|-------|---------|-----------|
| 1 | Foundation (Types & ABI) | 2-3h |
| 2 | Format Validation | 3-4h |
| 3 | Reputation Management | 4-5h |
| 4 | Simulation Integration | 5-6h |
| 5 | Main Validator & Integration | 4-5h |
| 6 | Bundle Validation & Receipt | 3-4h |
| **Total** | | **21-27h** |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Invalid ops rejected before simulation | > 80% |
| Simulation success rate for valid ops | > 99% |
| Average validation latency | < 500ms |
| Bundle execution success rate | > 95% |
| Test coverage for validation module | > 90% |
