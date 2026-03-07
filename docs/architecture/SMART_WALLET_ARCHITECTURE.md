# StableNet Smart Wallet Architecture

## Overview

EOA → EIP-7702 (Kernel Contract) → ERC-7579 Modules → Bundler → EntryPoint

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User Wallet (EOA)                                 │
│                    Private Key: secp256k1 signature                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────────────┐
            │ EOA Mode  │   │EIP-7702   │   │ Smart Account     │
            │ (Legacy)  │   │ Mode      │   │ Mode (ERC-4337)   │
            └───────────┘   └───────────┘   └───────────────────┘
                    │               │               │
                    │               ▼               │
                    │    ┌──────────────────┐      │
                    │    │ Kernel Contract  │      │
                    │    │ (Code Delegation)│      │
                    │    │ 0xef0100 + addr  │      │
                    │    └──────────────────┘      │
                    │               │               │
                    │               ▼               │
                    │    ┌──────────────────┐      │
                    │    │  ERC-7579 Modules │◄────┘
                    │    │  ┌────────────┐  │
                    │    │  │ Validators │  │  Type 1: ECDSA, WebAuthn, MultiSig
                    │    │  │ Executors  │  │  Type 2: SessionKey, Swap, Stake
                    │    │  │ Hooks      │  │  Type 4: SpendingLimit, Policy
                    │    │  │ Fallbacks  │  │  Type 3: TokenReceiver, FlashLoan
                    │    │  └────────────┘  │
                    │    └──────────────────┘
                    │               │
                    ▼               ▼
            ┌─────────────────────────────────────┐
            │              Bundler                 │
            │    eth_sendUserOperation            │
            │    eth_estimateUserOperationGas     │
            └─────────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────────┐
            │         EntryPoint v0.7             │
            │    handleOps() / handleAggregatedOps│
            └─────────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────────┐
            │         Target Contracts            │
            │    DeFi, NFT, Token Transfers       │
            └─────────────────────────────────────┘
```

---

## Current Implementation Status

### SDK (`@stablenet/core`) - 96% Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Bundler Client | ✅ | `createBundlerClient()` |
| Gas Estimator | ✅ | Multi-mode support |
| Transaction Router | ✅ | EOA/EIP-7702/Smart Account |
| UserOperation Utils | ✅ | Pack/unpack/hash |
| Security Module | ✅ | Risk analysis, input validation |
| EIP-7702 Utils | ✅ | Authorization signing |
| Paymaster Client | ✅ | ERC-20/Sponsor support |
| Module Registry | ✅ | Built-in module definitions |
| Module Utils | ✅ | Encoder/decoder per module type |

### Wallet Extension - 85% Complete

| Component | Status | Notes |
|-----------|--------|-------|
| SDK Integration | ✅ | 22 files use SDK |
| Module Install UI | ✅ | Basic wizard |
| EIP-7702 Signing | ✅ | Authorization flow |
| Bundler Integration | ✅ | UserOp submission |
| WebAuthn Validator | ⚠️ | Needs passkey UI |
| Session Key Executor | ⚠️ | Needs management UI |
| Spending Limit Hook | ⚠️ | Needs configuration UI |
| MultiSig Validator | ❌ | Not implemented |
| DeFi Executors | ❌ | Swap/Stake/Lend UI needed |

### Bundler Service - 100% Complete

| Component | Status | Notes |
|-----------|--------|-------|
| ERC-4337 v0.7 | ✅ | Full compliance |
| Gas Estimation | ✅ | Binary search |
| Mempool | ✅ | Priority strategies |
| Reputation | ✅ | Ban/throttle system |
| Metrics | ✅ | Prometheus endpoint |

### Smart Contracts (`poc-contract`) - 100% Complete

| Component | Count | Status |
|-----------|-------|--------|
| Validators | 5 | ✅ ECDSA, WebAuthn, MultiSig, MultiChain, Weighted |
| Executors | 5+ | ✅ SessionKey, Swap, Stake, Lend, Recurring |
| Hooks | 4 | ✅ SpendingLimit, HealthFactor, Policy, Audit |
| Fallbacks | 2+ | ✅ TokenReceiver, FlashLoan |
| Paymasters | 5 | ✅ ERC20, Permit2, Sponsor, Verifying |

---

## Gap Analysis: Required Features

### Phase 1: Core Module UIs (Priority: HIGH)

#### 1.1 WebAuthn Validator UI
- Passkey registration flow
- Credential management (add/remove)
- Biometric authentication UI
- Recovery options

#### 1.2 Session Key Executor UI
- Create session key with permissions
- Set time bounds (validAfter/validUntil)
- Define spending limits per session
- Whitelist function selectors
- Revoke sessions

#### 1.3 Spending Limit Hook UI
- Configure per-token limits
- Set time periods (hourly/daily/weekly/monthly)
- Emergency pause toggle
- Whitelist addresses for unlimited

### Phase 2: MultiSig & Advanced Validators (Priority: MEDIUM)

#### 2.1 MultiSig Validator UI
- Add/remove signers
- Configure threshold (M-of-N)
- Pending transaction queue
- Signature collection UI
- Signer replacement flow

#### 2.2 Validator Switching
- Switch between validators (ECDSA ↔ WebAuthn ↔ MultiSig)
- Backup validator configuration
- Root validator management

### Phase 3: DeFi Executors (Priority: MEDIUM)

#### 3.1 Swap Executor UI
- DEX selection (Uniswap, etc.)
- Slippage settings
- Auto-swap triggers
- Price alerts

#### 3.2 Staking Executor UI
- Stake/unstake interface
- Validator selection
- Rewards tracking
- Auto-compound settings

#### 3.3 Lending Executor UI
- Deposit/withdraw collateral
- Borrow/repay interface
- Health factor monitoring
- Liquidation alerts

#### 3.4 Recurring Payment Executor UI
- Subscription management
- Payment schedule configuration
- Merchant registry integration

### Phase 4: Enhanced Bundler Integration (Priority: MEDIUM)

#### 4.1 UserOperation Status Tracking
- Real-time status updates (pending → submitted → included)
- Transaction history with UserOp details
- Failed operation recovery
- Gas cost analysis

#### 4.2 Paymaster Integration Enhancements
- ERC-20 gas token selection UI
- Sponsorship policy display
- Gas estimation comparison

### Phase 5: Privacy & Compliance (Priority: LOW)

#### 5.1 Stealth Address Support
- ERC-5564 announcer integration
- ERC-6538 registry lookup
- Private receive address generation

#### 5.2 Audit Logging
- Transaction audit trail
- Compliance export (CSV/PDF)
- Role-based access (enterprise)

---

## Implementation Tasks

### SDK Enhancements

```
SDK-1: Add module-specific init data encoders
  - encodeWebAuthnValidatorInit(credentials)
  - encodeSessionKeyInit(config)
  - encodeSpendingLimitInit(limits)
  - encodeMultiSigInit(signers, threshold)

SDK-2: Add module calldata builders
  - buildInstallModuleCalldata(type, address, initData)
  - buildUninstallModuleCalldata(type, address)
  - buildExecuteCalldata(calls[])

SDK-3: Add UserOperation status polling
  - pollUserOperationStatus(hash, options)
  - createUserOperationTracker(bundlerClient)
```

### Wallet UI Components

```
UI-1: WebAuthnSetup component
  - Passkey registration
  - Credential list
  - Remove credential

UI-2: SessionKeyManager component
  - Create session key form
  - Active sessions list
  - Revoke session button

UI-3: SpendingLimitConfig component
  - Token selector
  - Amount input
  - Period selector
  - Whitelist management

UI-4: MultiSigSetup component
  - Signer address inputs
  - Threshold slider
  - Pending tx queue

UI-5: DeFiDashboard component
  - Swap widget
  - Staking positions
  - Lending positions
  - Recurring payments
```

### RPC Handler Updates

```
RPC-1: Add module query methods
  - wallet_getInstalledModules
  - wallet_getModuleConfig
  - wallet_getSupportedModules

RPC-2: Add session key methods
  - wallet_createSessionKey
  - wallet_revokeSessionKey
  - wallet_getActiveSessions

RPC-3: Add spending limit methods
  - wallet_getSpendingLimits
  - wallet_setSpendingLimit
  - wallet_getSpendingStatus
```

---

## Contract Addresses (Testnet)

```typescript
const CONTRACTS = {
  // EntryPoint
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',

  // Kernel Factory
  kernelFactory: '0x...',

  // Validators
  ecdsaValidator: '0x...',
  webAuthnValidator: '0x...',
  multiSigValidator: '0x...',

  // Executors
  sessionKeyExecutor: '0x...',
  swapExecutor: '0x...',
  stakingExecutor: '0x...',

  // Hooks
  spendingLimitHook: '0x...',
  healthFactorHook: '0x...',

  // Paymasters
  erc20Paymaster: '0x...',
  sponsorPaymaster: '0x...',
}
```

---

## Architecture Decision Records

### ADR-1: Module Storage Pattern
**Decision**: Use per-account mapping for module state
**Rationale**: Isolates module data between accounts, prevents cross-account interference

### ADR-2: Validation Nonce Encoding
**Decision**: Encode validation mode/type/id in userOp.nonce upper bits
**Rationale**: Allows flexible validation without additional storage reads

### ADR-3: Hook Execution Order
**Decision**: Pre-hook before execution, post-hook after with rollback
**Rationale**: Enables both prevention (spending limit) and verification (audit)

---

## Next Steps

1. **Immediate**: Implement WebAuthn Validator UI
2. **Short-term**: Add Session Key management
3. **Medium-term**: Build DeFi executor interfaces
4. **Long-term**: Privacy features and compliance tools
