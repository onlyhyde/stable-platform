# Multi-Mode Transaction & Modular Smart Account System Design

## Overview

StableNet Wallet Extension의 **다중 모드 트랜잭션 시스템**과 **모듈형 Smart Account 아키텍처** 설계 문서입니다.

### Core Concepts

1. **Multi-Mode Transactions**: EOA, EIP-7702, Smart Account (ERC-4337) 모드 지원
2. **Modular Smart Account**: ERC-7579 기반 플러그인 아키텍처
3. **Package Structure**: `@stablenet/core`에서 재사용 가능한 로직 분리

---

## Package Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        apps/wallet-extension                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  UI Layer                                                             │  │
│  │  • Send.tsx (Transaction UI)                                          │  │
│  │  • ModuleManager.tsx (Plugin Management UI)                           │  │
│  │  • TransactionModeSelector, GasPaymentOptions, etc.                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Extension Layer (Chrome-specific)                                    │  │
│  │  • State Management (chrome.storage)                                  │  │
│  │  • Keyring / Approval Flow                                            │  │
│  │  • Message Routing                                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          @stablenet/core                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Transaction Layer                                                      ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ ││
│  │  │ EOA          │  │ EIP-7702     │  │ Smart Account (ERC-4337)       │ ││
│  │  │ Transaction  │  │ Transaction  │  │ UserOperation Builder          │ ││
│  │  │ Builder 🆕   │  │ Builder 🆕   │  │ ✅ (smartAccountClient)        │ ││
│  │  └──────────────┘  └──────────────┘  └────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Client Layer                                                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │  │ Bundler      │  │ Paymaster    │  │ Gas          │  │ Module       │ ││
│  │  │ Client ✅    │  │ Client 🆕    │  │ Estimator 🆕 │  │ Client 🆕    │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Module Layer (ERC-7579)                                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │  │ Validator    │  │ Executor     │  │ Hook         │  │ Fallback     │ ││
│  │  │ Manager 🆕   │  │ Manager 🆕   │  │ Manager 🆕   │  │ Manager 🆕   │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Utils & ABIs                                                           ││
│  │  • Contract ABIs (Kernel, Validators, Executors, Hooks, Fallbacks)      ││
│  │  • Encoding/Decoding utilities                                          ││
│  │  • EIP-7702 utilities ✅                                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          @stablenet/types                                   │
│  • UserOperation, Module, Validator, Executor, Hook types                   │
│  • Network, Transaction, Gas types                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Transaction Mode System

### Mode Overview

| Mode | Description | RPC Method | Use Case |
|------|-------------|------------|----------|
| **EOA** | Direct EOA transaction | `eth_sendTransaction` | 일반 전송, EOA 지갑 |
| **EIP-7702** | SetCode delegation transaction | Type 4 TX | Smart Account 설정/해제 |
| **Smart Account** | UserOperation via Bundler | `eth_sendUserOperation` | AA 트랜잭션 |

### Transaction Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Send UI                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Asset] [Recipient] [Amount]                                               │
│                                                                             │
│  ┌─ Transaction Mode ───────────────────────────────────────────────────┐   │
│  │  ○ Direct (EOA)        - Fast, standard transaction                  │   │
│  │  ● Smart Account       - Bundler + optional gas sponsorship          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Gas Payment (Smart Account only) ───────────────────────────────────┐   │
│  │  ● Sponsored (Free)    - Paymaster pays gas                          │   │
│  │  ○ Native Token        - Pay with ETH                                │   │
│  │  ○ ERC20 Token         - Pay with USDC, DAI, etc.                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │   EOA Mode      │   │  EIP-7702 Mode  │   │ Smart Account   │
    │                 │   │                 │   │     Mode        │
    │ buildEOATx()    │   │ build7702Tx()   │   │ buildUserOp()   │
    │       │         │   │       │         │   │       │         │
    │       ▼         │   │       ▼         │   │       ▼         │
    │ signTransaction │   │ signTransaction │   │ applyPaymaster  │
    │       │         │   │ (with authList) │   │       │         │
    │       ▼         │   │       │         │   │       ▼         │
    │ sendRawTx       │   │       ▼         │   │ signUserOp      │
    │       │         │   │ sendRawTx       │   │       │         │
    │       ▼         │   │       │         │   │       ▼         │
    │   RPC Node      │   │       ▼         │   │ sendUserOp      │
    └─────────────────┘   │   RPC Node      │   │       │         │
                          └─────────────────┘   │       ▼         │
                                                │    Bundler      │
                                                └─────────────────┘
```

---

## Smart Account Module Architecture (ERC-7579)

### Module Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Kernel Smart Account (ERC-7579)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ VALIDATOR (Type 1) ─────────────────────────────────────────────────┐   │
│  │  Authentication & Authorization                                       │   │
│  │  • ECDSAValidator      - 기본 ECDSA 서명 검증                         │   │
│  │  • WebAuthnValidator   - Passkey/생체인증                            │   │
│  │  • MultiSigValidator   - M-of-N 다중서명                             │   │
│  │  • WeightedValidator   - 가중치 기반 다중서명                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ EXECUTOR (Type 2) ──────────────────────────────────────────────────┐   │
│  │  Delegated Execution                                                  │   │
│  │  • SessionKeyExecutor  - 세션 키 (시간/권한 제한)                     │   │
│  │  • RecurringPayment    - 자동 정기결제                               │   │
│  │  • OnRampPlugin        - 법정화폐 온램프                             │   │
│  │  • AutoSwapPlugin      - 자동 스왑                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ HOOK (Type 4) ──────────────────────────────────────────────────────┐   │
│  │  Pre/Post Execution Guards                                            │   │
│  │  • SpendingLimitHook   - 지출 한도 (시간대별)                         │   │
│  │  • AuditHook           - 감사 로깅                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ FALLBACK (Type 3) ──────────────────────────────────────────────────┐   │
│  │  Function Routing                                                     │   │
│  │  • TokenReceiverFallback - ERC-721/1155/777 수신 처리                 │   │
│  │  • FlashLoanFallback     - Flash Loan 콜백                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Module Installation Flow                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   UI: "Add Spending Limit"                                                   │
│          │                                                                   │
│          ▼                                                                   │
│   ┌──────────────────┐                                                       │
│   │ ModuleManager UI │  Select module type, configure parameters             │
│   └────────┬─────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────────────────────────────────────────────────┐           │
│   │ @stablenet/core - ModuleClient                               │           │
│   │                                                              │           │
│   │ buildInstallModuleCalldata({                                 │           │
│   │   moduleType: MODULE_TYPE.HOOK,                              │           │
│   │   moduleAddress: SPENDING_LIMIT_HOOK_ADDRESS,                │           │
│   │   initData: encodeHookInitData({                             │           │
│   │     dailyLimit: parseEther('1'),                             │           │
│   │     tokens: [ETH_ADDRESS, USDC_ADDRESS]                      │           │
│   │   })                                                         │           │
│   │ })                                                           │           │
│   └────────┬─────────────────────────────────────────────────────┘           │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────────────────────────────────────────────────┐           │
│   │ SmartAccountClient.sendUserOperation({                       │           │
│   │   calls: [{ to: kernel, data: installModuleCalldata }]       │           │
│   │ })                                                           │           │
│   └────────┬─────────────────────────────────────────────────────┘           │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────────────────────────────────────────────────┐           │
│   │ On-chain: Kernel.installModule()                             │           │
│   │   → Module.onInstall(initData)                               │           │
│   │   → Hook registered in HookManager                           │           │
│   └──────────────────────────────────────────────────────────────┘           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### Transaction Types

```typescript
// @stablenet/types/src/transaction.ts

/**
 * Transaction execution mode
 */
export type TransactionMode = 'eoa' | 'eip7702' | 'smartAccount'

/**
 * Gas payment strategy for Smart Account mode
 */
export type GasPaymentType = 'sponsor' | 'native' | 'erc20'

export interface GasPaymentConfig {
  type: GasPaymentType
  /** ERC20 token address (required when type is 'erc20') */
  tokenAddress?: Address
  /** Token symbol for display */
  tokenSymbol?: string
  /** Estimated token amount for gas */
  estimatedAmount?: bigint
}

/**
 * Multi-mode transaction request
 */
export interface MultiModeTransactionRequest {
  mode: TransactionMode
  from: Address
  to: Address
  value: bigint
  data: Hex

  // EOA/EIP-7702 specific
  gas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number

  // EIP-7702 specific
  authorizationList?: SignedAuthorization[]

  // Smart Account specific
  gasPayment?: GasPaymentConfig
}
```

### Module Types

```typescript
// @stablenet/types/src/module.ts

/**
 * ERC-7579 Module Types
 */
export const MODULE_TYPE = {
  VALIDATOR: 1n,
  EXECUTOR: 2n,
  FALLBACK: 3n,
  HOOK: 4n,
  POLICY: 5n,
  SIGNER: 6n,
} as const

export type ModuleType = (typeof MODULE_TYPE)[keyof typeof MODULE_TYPE]

/**
 * Module installation config
 */
export interface ModuleConfig {
  type: ModuleType
  address: Address
  initData: Hex
  /** For hooks: which validator/executor to pair with */
  hookConfig?: {
    hookType: 'global' | 'selector' | 'sig'
    selector?: Hex  // function selector for selector-specific hooks
  }
}

/**
 * Installed module info
 */
export interface InstalledModule {
  type: ModuleType
  address: Address
  name: string
  description: string
  isActive: boolean
  config?: Record<string, unknown>
}

/**
 * Module registry entry
 */
export interface ModuleRegistryEntry {
  address: Address
  name: string
  description: string
  type: ModuleType
  version: string
  audited: boolean
  /** ABI for encoding init/config data */
  abi: Abi
  /** Schema for UI configuration */
  configSchema?: JsonSchema
}
```

### Account Types

```typescript
// @stablenet/types/src/account.ts

export type AccountType = 'eoa' | 'smart' | 'delegated'

export interface Account {
  address: Address
  name: string
  type: AccountType
  keyringType?: KeyringType
  index?: number

  // Smart Account specific
  delegateAddress?: Address  // Kernel address if delegated
  isDeployed?: boolean

  // Installed modules (Smart Account only)
  installedModules?: InstalledModule[]

  createdAt?: number
}

/**
 * Get available transaction modes for account
 */
export function getAvailableTransactionModes(account: Account): TransactionMode[] {
  switch (account.type) {
    case 'eoa':
      return ['eoa', 'eip7702']
    case 'delegated':
      return ['eoa', 'smartAccount']  // Can use both
    case 'smart':
      return ['smartAccount']
    default:
      return ['eoa']
  }
}
```

---

## @stablenet/core Implementation

### Directory Structure

```
packages/sdk/packages/core/src/
├── index.ts                         # Main exports
│
├── clients/
│   ├── bundlerClient.ts            ✅ Exists
│   ├── smartAccountClient.ts       ✅ Exists
│   ├── indexerClient.ts            ✅ Exists
│   ├── paymasterClient.ts          🆕 NEW - Paymaster RPC client
│   └── moduleClient.ts             🆕 NEW - Module management
│
├── transaction/
│   ├── index.ts                    🆕 NEW
│   ├── eoaTransaction.ts           🆕 NEW - EOA tx builder
│   ├── eip7702Transaction.ts       🆕 NEW - EIP-7702 tx builder
│   ├── gasEstimator.ts             🆕 NEW - Unified gas estimation
│   └── transactionRouter.ts        🆕 NEW - Mode routing
│
├── modules/                         🆕 NEW - ERC-7579 Module support
│   ├── index.ts
│   ├── types.ts                    # Module type definitions
│   ├── registry.ts                 # Module registry (known modules)
│   ├── encoder.ts                  # Init data encoding
│   ├── validators/
│   │   ├── index.ts
│   │   ├── ecdsa.ts               # ECDSAValidator utils
│   │   ├── webauthn.ts            # WebAuthnValidator utils
│   │   └── multisig.ts            # MultiSigValidator utils
│   ├── executors/
│   │   ├── index.ts
│   │   ├── sessionKey.ts          # SessionKeyExecutor utils
│   │   └── recurringPayment.ts    # RecurringPayment utils
│   ├── hooks/
│   │   ├── index.ts
│   │   └── spendingLimit.ts       # SpendingLimitHook utils
│   └── fallbacks/
│       ├── index.ts
│       └── tokenReceiver.ts       # TokenReceiverFallback utils
│
├── abis/                            🆕 NEW - Contract ABIs
│   ├── index.ts
│   ├── kernel.ts                   # Kernel ABI
│   ├── kernelFactory.ts            # KernelFactory ABI
│   ├── validators/
│   │   ├── ecdsaValidator.ts
│   │   ├── webauthnValidator.ts
│   │   └── multisigValidator.ts
│   ├── executors/
│   │   ├── sessionKeyExecutor.ts
│   │   └── recurringPaymentExecutor.ts
│   ├── hooks/
│   │   └── spendingLimitHook.ts
│   └── fallbacks/
│       └── tokenReceiverFallback.ts
│
├── eip7702/                         ✅ Exists
│   ├── index.ts
│   ├── authorization.ts
│   ├── constants.ts
│   └── types.ts
│
├── utils/
│   ├── userOperation.ts            ✅ Exists
│   ├── execution.ts                🆕 NEW - Execution mode encoding
│   └── calldata.ts                 🆕 NEW - Calldata building utils
│
└── errors/                          ✅ Exists
    └── ...
```

### Key Implementations

#### 1. PaymasterClient

```typescript
// @stablenet/core/src/clients/paymasterClient.ts

export interface PaymasterClient {
  /** Get sponsored paymaster data */
  getSponsoredData(userOp: UserOperation): Promise<PaymasterData>

  /** Get paymaster data for ERC20 payment */
  getERC20PaymasterData(userOp: UserOperation, token: Address): Promise<PaymasterData>

  /** Get supported tokens for gas payment */
  getSupportedTokens(): Promise<SupportedToken[]>

  /** Get token exchange rate (token per ETH) */
  getExchangeRate(token: Address): Promise<bigint>
}

export interface PaymasterData {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

export interface SupportedToken {
  address: Address
  symbol: string
  decimals: number
  exchangeRate: bigint
}

export function createPaymasterClient(url: string): PaymasterClient {
  // Implementation...
}
```

#### 2. ModuleClient

```typescript
// @stablenet/core/src/clients/moduleClient.ts

export interface ModuleClient {
  /** Build calldata to install a module */
  buildInstallCalldata(config: ModuleConfig): Hex

  /** Build calldata to uninstall a module */
  buildUninstallCalldata(type: ModuleType, address: Address, deInitData?: Hex): Hex

  /** Check if module is installed */
  isModuleInstalled(account: Address, type: ModuleType, module: Address): Promise<boolean>

  /** Get all installed modules for account */
  getInstalledModules(account: Address): Promise<InstalledModule[]>

  /** Encode init data for specific module */
  encodeInitData(moduleAddress: Address, params: Record<string, unknown>): Hex
}

export function createModuleClient(rpcUrl: string): ModuleClient {
  // Implementation...
}
```

#### 3. Transaction Router

```typescript
// @stablenet/core/src/transaction/transactionRouter.ts

export interface TransactionRouter {
  /** Route transaction based on mode */
  send(request: MultiModeTransactionRequest, signer: Signer): Promise<Hex>

  /** Estimate gas for transaction */
  estimateGas(request: MultiModeTransactionRequest): Promise<GasEstimate>

  /** Get recommended mode for account */
  getRecommendedMode(account: Account): TransactionMode
}

export function createTransactionRouter(config: TransactionRouterConfig): TransactionRouter {
  const { rpcUrl, bundlerUrl, paymasterUrl } = config

  return {
    async send(request, signer) {
      switch (request.mode) {
        case 'eoa':
          return sendEOATransaction(request, signer, rpcUrl)
        case 'eip7702':
          return sendEIP7702Transaction(request, signer, rpcUrl)
        case 'smartAccount':
          return sendSmartAccountTransaction(request, signer, bundlerUrl, paymasterUrl)
      }
    },
    // ...
  }
}
```

#### 4. Module Encoding Utilities

```typescript
// @stablenet/core/src/modules/encoder.ts

import { encodeAbiParameters } from 'viem'
import { SPENDING_LIMIT_HOOK_ABI } from '../abis/hooks/spendingLimitHook'

/**
 * Encode SpendingLimitHook init data
 */
export function encodeSpendingLimitInitData(params: {
  tokens: Address[]
  limits: { token: Address; limit: bigint; period: 'hourly' | 'daily' | 'weekly' | 'monthly' }[]
}): Hex {
  return encodeAbiParameters(
    [{ type: 'address[]' }, { type: 'tuple[]', components: [...] }],
    [params.tokens, params.limits.map(l => ({ ... }))]
  )
}

/**
 * Encode SessionKeyExecutor init data
 */
export function encodeSessionKeyInitData(params: {
  sessionKey: Address
  validAfter: bigint
  validUntil: bigint
  targets: Address[]
  selectors: Hex[]
  spendingLimit?: bigint
}): Hex {
  // Implementation...
}

/**
 * Encode WebAuthnValidator init data
 */
export function encodeWebAuthnInitData(params: {
  publicKey: { x: bigint; y: bigint }
  credentialId: Hex
}): Hex {
  // Implementation...
}
```

---

## Contract ABIs

### Source Extraction

ABIs will be extracted from compiled contracts at `/poc-contract/out/`:

```typescript
// @stablenet/core/src/abis/kernel.ts

export const KERNEL_ABI = [
  // Account management
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'mode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' }
    ],
    outputs: []
  },
  {
    name: 'installModule',
    type: 'function',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'initData', type: 'bytes' }
    ],
    outputs: []
  },
  {
    name: 'uninstallModule',
    type: 'function',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'deInitData', type: 'bytes' }
    ],
    outputs: []
  },
  {
    name: 'isModuleInstalled',
    type: 'function',
    inputs: [
      { name: 'moduleTypeId', type: 'uint256' },
      { name: 'module', type: 'address' },
      { name: 'additionalContext', type: 'bytes' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  // ... more functions
] as const
```

### Supported Modules Registry

```typescript
// @stablenet/core/src/modules/registry.ts

export const MODULE_REGISTRY: Record<string, ModuleRegistryEntry> = {
  // Validators
  ECDSA_VALIDATOR: {
    address: '0x...',
    name: 'ECDSA Validator',
    description: 'Standard ECDSA signature validation',
    type: MODULE_TYPE.VALIDATOR,
    version: '1.0.0',
    audited: true,
    abi: ECDSA_VALIDATOR_ABI,
  },
  WEBAUTHN_VALIDATOR: {
    address: '0x...',
    name: 'WebAuthn Validator',
    description: 'Passkey/biometric authentication',
    type: MODULE_TYPE.VALIDATOR,
    version: '1.0.0',
    audited: true,
    abi: WEBAUTHN_VALIDATOR_ABI,
    configSchema: {
      type: 'object',
      properties: {
        credentialId: { type: 'string', format: 'hex' },
        publicKeyX: { type: 'string' },
        publicKeyY: { type: 'string' },
      },
      required: ['credentialId', 'publicKeyX', 'publicKeyY']
    }
  },
  MULTISIG_VALIDATOR: {
    address: '0x...',
    name: 'Multi-Signature Validator',
    description: 'M-of-N multi-signature validation',
    type: MODULE_TYPE.VALIDATOR,
    version: '1.0.0',
    audited: true,
    abi: MULTISIG_VALIDATOR_ABI,
    configSchema: {
      type: 'object',
      properties: {
        signers: { type: 'array', items: { type: 'string', format: 'address' } },
        threshold: { type: 'number', minimum: 1 }
      },
      required: ['signers', 'threshold']
    }
  },

  // Executors
  SESSION_KEY_EXECUTOR: {
    address: '0x...',
    name: 'Session Key',
    description: 'Time-limited delegated execution with permissions',
    type: MODULE_TYPE.EXECUTOR,
    version: '1.0.0',
    audited: true,
    abi: SESSION_KEY_EXECUTOR_ABI,
    configSchema: {
      type: 'object',
      properties: {
        sessionKey: { type: 'string', format: 'address' },
        validAfter: { type: 'number' },
        validUntil: { type: 'number' },
        allowedTargets: { type: 'array', items: { type: 'string', format: 'address' } },
        allowedSelectors: { type: 'array', items: { type: 'string', format: 'bytes4' } },
        spendingLimit: { type: 'string' }
      },
      required: ['sessionKey', 'validUntil']
    }
  },
  RECURRING_PAYMENT_EXECUTOR: {
    address: '0x...',
    name: 'Recurring Payment',
    description: 'Automated recurring payments (subscriptions)',
    type: MODULE_TYPE.EXECUTOR,
    version: '1.0.0',
    audited: true,
    abi: RECURRING_PAYMENT_EXECUTOR_ABI,
  },

  // Hooks
  SPENDING_LIMIT_HOOK: {
    address: '0x...',
    name: 'Spending Limit',
    description: 'Enforce spending limits per token per time period',
    type: MODULE_TYPE.HOOK,
    version: '1.0.0',
    audited: true,
    abi: SPENDING_LIMIT_HOOK_ABI,
    configSchema: {
      type: 'object',
      properties: {
        limits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              token: { type: 'string', format: 'address' },
              limit: { type: 'string' },
              period: { type: 'string', enum: ['hourly', 'daily', 'weekly', 'monthly'] }
            }
          }
        }
      }
    }
  },

  // Fallbacks
  TOKEN_RECEIVER_FALLBACK: {
    address: '0x...',
    name: 'Token Receiver',
    description: 'Handle ERC-721, ERC-1155, ERC-777 token receipts',
    type: MODULE_TYPE.FALLBACK,
    version: '1.0.0',
    audited: true,
    abi: TOKEN_RECEIVER_FALLBACK_ABI,
  },
}
```

---

## UI Components (wallet-extension)

### Module Management UI

```
src/ui/
├── components/
│   ├── send/
│   │   ├── TransactionModeSelector.tsx
│   │   ├── GasPaymentOptions.tsx
│   │   ├── GasEstimation.tsx
│   │   └── TransactionSummary.tsx
│   │
│   └── modules/                      🆕 NEW
│       ├── ModuleList.tsx           # List of installed modules
│       ├── ModuleCard.tsx           # Single module display
│       ├── ModuleInstallModal.tsx   # Install new module
│       ├── ModuleConfigForm.tsx     # Configure module params
│       ├── ModuleRegistry.tsx       # Browse available modules
│       │
│       ├── validators/
│       │   ├── ECDSAValidatorConfig.tsx
│       │   ├── WebAuthnValidatorConfig.tsx
│       │   └── MultiSigValidatorConfig.tsx
│       │
│       ├── executors/
│       │   ├── SessionKeyConfig.tsx
│       │   └── RecurringPaymentConfig.tsx
│       │
│       └── hooks/
│           └── SpendingLimitConfig.tsx
│
├── pages/
│   ├── Send.tsx                     # Refactored with mode support
│   └── Modules.tsx                  🆕 NEW - Module management page
│
└── hooks/
    ├── useTransactionMode.ts
    ├── useGasEstimation.ts
    ├── usePaymaster.ts
    └── useModules.ts                🆕 NEW - Module management hook
```

### Module Management Page Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Modules Page                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Installed Modules ──────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │ 🔐 ECDSA Validator                              [Active] [⚙️] │    │   │
│  │  │    Standard signature validation                              │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │ 💰 Spending Limit                               [Active] [⚙️] │    │   │
│  │  │    Daily: 1 ETH, 1000 USDC                                    │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │ 🎮 Session Key                                  [Active] [⚙️] │    │   │
│  │  │    Game: 0x1234... (expires in 2 hours)                       │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    [+ Add Module]                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              │ Click "Add Module"
                              ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                      Module Registry                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Category: [All ▼]                                                          │
│                                                                             │
│  ┌─ Validators ─────────────────────────────────────────────────────────┐   │
│  │  ○ WebAuthn Validator - Passkey authentication          [Install]   │   │
│  │  ○ Multi-Sig Validator - M-of-N signatures              [Install]   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Security ───────────────────────────────────────────────────────────┐   │
│  │  ○ Spending Limit - Daily/weekly spending caps          [Installed] │   │
│  │  ○ Audit Hook - Transaction logging                     [Install]   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Automation ─────────────────────────────────────────────────────────┐   │
│  │  ○ Session Key - Delegated execution                    [Installed] │   │
│  │  ○ Recurring Payment - Subscriptions                    [Install]   │   │
│  │  ○ Auto Swap - Limit orders                             [Install]   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

#### @stablenet/types
- [ ] Add `TransactionMode`, `GasPaymentConfig`, `GasPaymentType`
- [ ] Add `ModuleType`, `ModuleConfig`, `InstalledModule`, `ModuleRegistryEntry`
- [ ] Update `Account` type with `installedModules`

#### @stablenet/core
- [ ] Create `transaction/eoaTransaction.ts`
- [ ] Create `transaction/eip7702Transaction.ts`
- [ ] Create `transaction/gasEstimator.ts`
- [ ] Create `transaction/transactionRouter.ts`
- [ ] Create `clients/paymasterClient.ts`

### Phase 2: Module System (Week 2-3)

#### @stablenet/core
- [ ] Create `modules/types.ts`
- [ ] Create `modules/registry.ts`
- [ ] Create `modules/encoder.ts`
- [ ] Create `clients/moduleClient.ts`

#### Contract ABIs
- [ ] Extract ABIs from compiled contracts
- [ ] Create `abis/kernel.ts`
- [ ] Create `abis/validators/*.ts`
- [ ] Create `abis/executors/*.ts`
- [ ] Create `abis/hooks/*.ts`
- [ ] Create `abis/fallbacks/*.ts`

### Phase 3: Module Utilities (Week 3-4)

#### @stablenet/core
- [ ] Create `modules/validators/ecdsa.ts`
- [ ] Create `modules/validators/webauthn.ts`
- [ ] Create `modules/validators/multisig.ts`
- [ ] Create `modules/executors/sessionKey.ts`
- [ ] Create `modules/executors/recurringPayment.ts`
- [ ] Create `modules/hooks/spendingLimit.ts`
- [ ] Create `modules/fallbacks/tokenReceiver.ts`

### Phase 4: UI Components (Week 4-5)

#### wallet-extension
- [ ] Refactor `Send.tsx` with mode support
- [ ] Create `TransactionModeSelector.tsx`
- [ ] Create `GasPaymentOptions.tsx`
- [ ] Create `Modules.tsx` page
- [ ] Create `ModuleList.tsx`
- [ ] Create `ModuleInstallModal.tsx`
- [ ] Create module-specific config forms

### Phase 5: Integration & Testing (Week 5-6)

- [ ] Integration tests for transaction modes
- [ ] Integration tests for module management
- [ ] E2E tests for Send flow
- [ ] E2E tests for Module installation

---

## Security Considerations

### Transaction Security
1. **Mode Validation**: Verify account type supports selected mode
2. **Gas Limit Caps**: Prevent excessive gas usage
3. **Paymaster Verification**: Validate paymaster response data
4. **Nonce Management**: Proper nonce handling per mode

### Module Security
1. **Registry Verification**: Only allow audited modules
2. **Init Data Validation**: Validate module configuration
3. **Uninstall Protection**: Prevent removing root validator
4. **Hook Ordering**: Ensure proper pre/post hook execution

### Extension Security
1. **Origin Validation**: Handle internal vs external requests
2. **Account Authorization**: Verify sender is wallet account
3. **Approval Flow**: User confirmation for sensitive operations

---

## Contract Addresses (To Be Deployed)

```typescript
// @stablenet/core/src/constants/addresses.ts

export const KERNEL_ADDRESSES = {
  // Mainnet
  1: {
    KERNEL_FACTORY: '0x...',
    KERNEL_IMPLEMENTATION: '0x...',
  },
  // Sepolia
  11155111: {
    KERNEL_FACTORY: '0x...',
    KERNEL_IMPLEMENTATION: '0x...',
  },
  // Local
  31337: {
    KERNEL_FACTORY: '0x...',
    KERNEL_IMPLEMENTATION: '0x...',
  },
}

export const MODULE_ADDRESSES = {
  // Validators
  ECDSA_VALIDATOR: '0x...',
  WEBAUTHN_VALIDATOR: '0x...',
  MULTISIG_VALIDATOR: '0x...',

  // Executors
  SESSION_KEY_EXECUTOR: '0x...',
  RECURRING_PAYMENT_EXECUTOR: '0x...',

  // Hooks
  SPENDING_LIMIT_HOOK: '0x...',
  AUDIT_HOOK: '0x...',

  // Fallbacks
  TOKEN_RECEIVER_FALLBACK: '0x...',

  // Plugins
  ONRAMP_PLUGIN: '0x...',
  AUTO_SWAP_PLUGIN: '0x...',
  MICRO_LOAN_PLUGIN: '0x...',
}
```

---

## References

- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-7579: Minimal Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [Kernel v0.3.3 Documentation](https://docs.zerodev.app/)
