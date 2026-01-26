# StableNet PoC IA (Information Architecture)

> **문서 버전**: 1.0
> **작성일**: 2026-01-16
> **상태**: Draft

---

## 1. 정보 구조 개요

### 1.1 시스템 구성 요소

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     StableNet Information Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Interfaces                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Wallet    │ │  Payment    │ │    DeFi     │ │ Enterprise  │           │
│  │ Extension   │ │    dApp     │ │    dApp     │ │    dApp     │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                   │                                          │
│                         ┌─────────▼─────────┐                               │
│                         │   TypeScript SDK   │                               │
│                         └─────────┬─────────┘                               │
│                                   │                                          │
│  Backend Services                 │                                          │
│  ┌────────────────────────────────┼──────────────────────────────────┐      │
│  │                                │                                   │      │
│  │  ┌────────┐ ┌────────┐ ┌──────▼─┐ ┌────────┐ ┌────────┐ ┌──────┐│      │
│  │  │Bundler │ │Stealth │ │Paymstr │ │ Order  │ │Subscr. │ │Bridge││      │
│  │  │        │ │Server  │ │ Proxy  │ │ Router │ │Executor│ │Relayer│      │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └──────┘│      │
│  │                                                                   │      │
│  └────────────────────────────────┬──────────────────────────────────┘      │
│                                   │                                          │
│  Blockchain Layer                 │                                          │
│  ┌────────────────────────────────┼────────────────────────────────┐        │
│  │                                │                                 │        │
│  │  ┌─────────┐ ┌─────────┐ ┌────▼────┐ ┌─────────┐ ┌─────────┐  │        │
│  │  │Core     │ │Modules  │ │Paymaster│ │  DeFi   │ │ Privacy │  │        │
│  │  │Contracts│ │         │ │         │ │         │ │         │  │        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │        │
│  │                                                                │        │
│  │  ┌─────────┐ ┌─────────┐                                      │        │
│  │  │Subscript│ │ Bridge  │                                      │        │
│  │  │         │ │         │                                      │        │
│  │  └─────────┘ └─────────┘                                      │        │
│  │                                                                │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 흐름 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Primary Data Flows                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. UserOp Flow                                                              │
│     User → Wallet → SDK → Bundler → EntryPoint → Smart Account              │
│                                                                              │
│  2. Payment Flow                                                             │
│     Payer → dApp → SDK → Paymaster Proxy → Bundler → Settlement             │
│                                                                              │
│  3. Stealth Flow                                                             │
│     Sender → PrivateBank → Announcer → Stealth Server → Recipient           │
│                                                                              │
│  4. Subscription Flow                                                        │
│     Scheduler → Executor → Permission Check → Payment → Notification        │
│                                                                              │
│  5. Bridge Flow                                                              │
│     Source Lock → MPC Sign → Optimistic Wait → Target Release               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 모델

### 2.1 Core Entities

#### Smart Account

```typescript
interface SmartAccount {
  // Identity
  address: Address;
  owner: Address;
  factory: Address;

  // Configuration
  installedModules: Module[];
  currentValidator: Address;

  // State
  nonce: bigint;
  balance: Balance[];

  // Metadata
  createdAt: number;
  updatedAt: number;
}

interface Module {
  address: Address;
  type: ModuleType;  // 'validator' | 'executor' | 'hook' | 'fallback'
  isInstalled: boolean;
  config: bytes;
}
```

#### UserOperation

```typescript
interface PackedUserOperation {
  // Identity
  sender: Address;
  nonce: bigint;

  // Deployment
  initCode: bytes;  // factory + initData if new account

  // Execution
  callData: bytes;

  // Gas
  accountGasLimits: bytes32;  // callGasLimit | verificationGasLimit
  preVerificationGas: bigint;
  gasFees: bytes32;  // maxPriorityFeePerGas | maxFeePerGas

  // Paymaster
  paymasterAndData: bytes;

  // Authorization
  signature: bytes;
}

interface UserOpReceipt {
  userOpHash: bytes32;
  sender: Address;
  nonce: bigint;
  paymaster: Address | null;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  success: boolean;
  reason: string | null;
  logs: Log[];
  receipt: TransactionReceipt;
}
```

### 2.2 Paymaster Entities

```typescript
interface PaymasterConfig {
  address: Address;
  type: PaymasterType;  // 'verifying' | 'erc20' | 'permit2'

  // For VerifyingPaymaster
  signer?: Address;
  sponsorDeposit?: bigint;

  // For ERC20Paymaster
  supportedTokens?: Address[];
  tokenMarkup?: Record<Address, number>;  // basis points

  // For Permit2Paymaster
  permit2Address?: Address;
}

interface SponsorPolicy {
  sponsorId: string;
  allowedSenders: Address[] | 'any';
  allowedTargets: Address[] | 'any';
  allowedSelectors: bytes4[] | 'any';
  maxGasPerOp: bigint;
  dailyBudget: bigint;
  usedBudget: bigint;
  validUntil: number;
}
```

### 2.3 Stealth Entities

```typescript
interface StealthMetaAddress {
  schemeId: number;  // 1 = secp256k1
  spendingPubKey: bytes;
  viewingPubKey: bytes;
}

interface StealthAnnouncement {
  schemeId: number;
  stealthAddress: Address;
  ephemeralPubKey: bytes;
  viewTag: bytes1;
  metadata: bytes;
  blockNumber: number;
  txHash: bytes32;
  logIndex: number;
}

interface StealthTransfer {
  stealthAddress: Address;
  token: Address;
  amount: bigint;
  ephemeralPubKey: bytes;
  viewTag: bytes1;
  timestamp: number;
  claimed: boolean;
}
```

### 2.4 Subscription Entities

```typescript
interface Permission {
  id: bytes32;
  account: Address;
  grantee: Address;

  // Scope
  targets: Address[];
  selectors: bytes4[];
  maxValue: bigint;

  // Time
  validAfter: number;
  validUntil: number;

  // Usage
  usageLimit: number;
  usageCount: number;

  active: boolean;
}

interface Subscription {
  id: bytes32;
  permissionId: bytes32;

  // Parties
  subscriber: Address;
  merchant: Address;

  // Payment
  token: Address;
  amount: bigint;
  interval: number;  // seconds

  // State
  nextPayment: number;
  endTime: number;
  active: boolean;

  // Metadata
  planId: string;
  createdAt: number;
}

interface PaymentRecord {
  subscriptionId: bytes32;
  paymentIndex: number;
  amount: bigint;
  timestamp: number;
  txHash: bytes32;
  success: boolean;
  error?: string;
}
```

### 2.5 Bridge Entities

```typescript
interface BridgeRequest {
  id: bytes32;

  // Parties
  sender: Address;
  recipient: Address;

  // Asset
  sourceToken: Address;
  targetToken: Address;
  amount: bigint;

  // Chains
  sourceChain: number;
  targetChain: number;

  // State
  status: BridgeStatus;
  timestamp: number;
  challengeDeadline: number;

  // Verification
  messageHash: bytes32;
  mpcSignature?: bytes;
}

enum BridgeStatus {
  Pending = 0,
  Approved = 1,
  Challenged = 2,
  Executed = 3,
  Refunded = 4,
  Cancelled = 5
}

interface Challenge {
  requestId: bytes32;
  challenger: Address;
  fraudProof: bytes;
  bond: bigint;
  submittedAt: number;
  resolved: boolean;
  fraudProven: boolean;
}
```

### 2.6 DeFi Entities

```typescript
interface Pool {
  address: Address;
  token0: Address;
  token1: Address;
  fee: number;  // 100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%

  // State
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;

  // TWAP
  observationIndex: number;
  observationCardinality: number;
}

interface Position {
  tokenId: bigint;
  owner: Address;
  pool: Address;

  // Range
  tickLower: number;
  tickUpper: number;

  // Liquidity
  liquidity: bigint;

  // Fees
  feeGrowthInside0: bigint;
  feeGrowthInside1: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

interface SwapQuote {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  path: Address[];
  pools: Address[];
  priceImpact: number;
  gasEstimate: bigint;
}
```

---

## 3. API 구조

### 3.1 Bundler API (ERC-4337)

```yaml
Base URL: /rpc

Methods:
  eth_sendUserOperation:
    params:
      - userOp: PackedUserOperation
      - entryPoint: Address
    returns: bytes32  # userOpHash

  eth_estimateUserOperationGas:
    params:
      - userOp: PartialUserOperation
      - entryPoint: Address
    returns:
      preVerificationGas: bigint
      verificationGasLimit: bigint
      callGasLimit: bigint

  eth_getUserOperationByHash:
    params:
      - hash: bytes32
    returns: UserOperationWithInfo | null

  eth_getUserOperationReceipt:
    params:
      - hash: bytes32
    returns: UserOpReceipt | null

  eth_supportedEntryPoints:
    returns: Address[]

  eth_chainId:
    returns: number
```

### 3.2 Paymaster Proxy API (ERC-7677)

```yaml
Base URL: /api/v1

Endpoints:
  POST /sponsor/policy:
    body:
      sponsorId: string
      policy: SponsorPolicy
    returns:
      policyId: string

  POST /paymaster-data:
    body:
      userOp: PartialUserOperation
      sponsorId: string
    returns:
      paymasterAndData: bytes
      preVerificationGas: bigint
      verificationGasLimit: bigint
      postOpGasLimit: bigint

  GET /sponsor/{sponsorId}/balance:
    returns:
      balance: bigint
      usedToday: bigint
      dailyLimit: bigint
```

### 3.3 Stealth Server API

```yaml
Base URL: /api/v1

Endpoints:
  POST /register:
    body:
      address: Address
      schemeId: number
      stealthMetaAddress: bytes
      signature: bytes
    returns:
      success: boolean

  GET /meta-address/{address}:
    params:
      schemeId: number (optional)
    returns:
      stealthMetaAddress: bytes

  GET /announcements:
    params:
      viewTag: bytes1 (optional)
      fromBlock: number (optional)
      toBlock: number (optional)
      limit: number (default: 100)
    returns:
      announcements: StealthAnnouncement[]
      nextCursor: string

  POST /scan:
    body:
      viewingKey: bytes
      fromBlock: number
      toBlock: number
    returns:
      transfers: StealthTransfer[]
```

### 3.4 Order Router API

```yaml
Base URL: /api/v1

Endpoints:
  GET /quote:
    params:
      tokenIn: Address
      tokenOut: Address
      amountIn: bigint
      slippageTolerance: number (default: 0.5%)
    returns:
      quote: SwapQuote

  POST /swap:
    body:
      tokenIn: Address
      tokenOut: Address
      amountIn: bigint
      minAmountOut: bigint
      recipient: Address
      deadline: number
    returns:
      callData: bytes
      to: Address
      value: bigint

  GET /pools:
    params:
      token0: Address (optional)
      token1: Address (optional)
    returns:
      pools: Pool[]

  GET /price/{token}:
    returns:
      price: bigint  # in WKRW
      source: string
      timestamp: number
```

### 3.5 Subscription API

```yaml
Base URL: /api/v1

Endpoints:
  GET /subscriptions:
    params:
      subscriber: Address (optional)
      merchant: Address (optional)
      active: boolean (optional)
    returns:
      subscriptions: Subscription[]

  GET /subscriptions/{id}:
    returns:
      subscription: Subscription
      payments: PaymentRecord[]

  GET /pending-payments:
    params:
      before: number (optional)
    returns:
      pendingPayments: {
        subscriptionId: bytes32
        dueAt: number
        amount: bigint
      }[]

  POST /execute-payment:
    body:
      subscriptionId: bytes32
    returns:
      txHash: bytes32
      success: boolean
```

### 3.6 Bridge API

```yaml
Base URL: /api/v1

Endpoints:
  GET /supported-tokens:
    returns:
      tokens: {
        sourceChain: number
        sourceToken: Address
        targetChain: number
        targetToken: Address
        minAmount: bigint
        maxAmount: bigint
      }[]

  GET /limits:
    returns:
      perTx: bigint
      hourly: bigint
      daily: bigint
      remainingHourly: bigint
      remainingDaily: bigint

  GET /requests/{id}:
    returns:
      request: BridgeRequest
      challenge: Challenge | null

  GET /requests:
    params:
      sender: Address (optional)
      recipient: Address (optional)
      status: BridgeStatus (optional)
    returns:
      requests: BridgeRequest[]

  GET /estimate:
    params:
      token: Address
      amount: bigint
      sourceChain: number
      targetChain: number
    returns:
      fee: bigint
      estimatedTime: number
      challengePeriod: number
```

---

## 4. 화면 구조

### 4.1 Wallet Extension

```
┌─────────────────────────────────────────┐
│         Wallet Extension IA             │
├─────────────────────────────────────────┤
│                                         │
│  Welcome                                │
│  ├── Create Account                     │
│  │   ├── Set Password                   │
│  │   ├── Generate Keys                  │
│  │   └── Backup Phrase                  │
│  └── Import Account                     │
│      ├── From Seed Phrase               │
│      └── From Private Key               │
│                                         │
│  Home                                   │
│  ├── Balance Overview                   │
│  │   ├── Total Balance                  │
│  │   └── Token List                     │
│  ├── Quick Actions                      │
│  │   ├── Send                           │
│  │   ├── Receive                        │
│  │   └── Swap                           │
│  └── Recent Activity                    │
│                                         │
│  Send                                   │
│  ├── Recipient Input                    │
│  ├── Token Selection                    │
│  ├── Amount Input                       │
│  ├── Gas Options                        │
│  │   ├── Pay with ETH                   │
│  │   ├── Pay with Token                 │
│  │   └── Sponsor (if available)         │
│  └── Confirmation                       │
│                                         │
│  Activity                               │
│  ├── Transaction List                   │
│  │   ├── Sent                           │
│  │   ├── Received                       │
│  │   └── Swaps                          │
│  └── Transaction Detail                 │
│                                         │
│  Modules                                │
│  ├── Installed Modules                  │
│  │   ├── Module Info                    │
│  │   └── Uninstall                      │
│  └── Browse Marketplace                 │
│      ├── Categories                     │
│      ├── Search                         │
│      └── Install                        │
│                                         │
│  Settings                               │
│  ├── Account                            │
│  │   ├── Export Keys                    │
│  │   └── Recovery Setup                 │
│  ├── Network                            │
│  │   ├── RPC Settings                   │
│  │   └── Chain Selection                │
│  ├── Security                           │
│  │   ├── Change Password                │
│  │   └── Auto-lock                      │
│  └── About                              │
│                                         │
└─────────────────────────────────────────┘
```

### 4.2 Payment dApp

```
┌─────────────────────────────────────────┐
│           Payment dApp IA               │
├─────────────────────────────────────────┤
│                                         │
│  Home                                   │
│  ├── Connect Wallet                     │
│  ├── Balance Display                    │
│  └── Quick Pay                          │
│                                         │
│  Pay                                    │
│  ├── QR Scanner                         │
│  ├── Manual Input                       │
│  │   ├── Recipient                      │
│  │   └── Amount                         │
│  ├── Gas Options                        │
│  └── Confirmation                       │
│                                         │
│  Receive                                │
│  ├── QR Code Display                    │
│  ├── Address Display                    │
│  └── Amount Request                     │
│                                         │
│  Subscriptions                          │
│  ├── Active Subscriptions               │
│  │   ├── Subscription Card              │
│  │   │   ├── Merchant Info              │
│  │   │   ├── Amount/Period              │
│  │   │   ├── Next Payment               │
│  │   │   └── Actions                    │
│  │   │       ├── View Details           │
│  │   │       └── Cancel                 │
│  │   └── Subscription Detail            │
│  │       ├── Payment History            │
│  │       └── Permission Info            │
│  └── New Subscription                   │
│      ├── Plan Selection                 │
│      ├── Permission Review              │
│      └── Approval                       │
│                                         │
│  History                                │
│  ├── Filters                            │
│  │   ├── Date Range                     │
│  │   ├── Type                           │
│  │   └── Status                         │
│  ├── Transaction List                   │
│  └── Export                             │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 DeFi dApp

```
┌─────────────────────────────────────────┐
│            DeFi dApp IA                 │
├─────────────────────────────────────────┤
│                                         │
│  Swap                                   │
│  ├── Token Selection                    │
│  │   ├── From Token                     │
│  │   └── To Token                       │
│  ├── Amount Input                       │
│  ├── Route Display                      │
│  │   ├── Best Route                     │
│  │   ├── Price Impact                   │
│  │   └── Minimum Received               │
│  ├── Slippage Settings                  │
│  └── Swap Button                        │
│                                         │
│  Pool                                   │
│  ├── My Positions                       │
│  │   ├── Position Card                  │
│  │   │   ├── Token Pair                 │
│  │   │   ├── Fee Tier                   │
│  │   │   ├── Range                      │
│  │   │   ├── Liquidity                  │
│  │   │   └── Uncollected Fees           │
│  │   └── Position Detail                │
│  │       ├── Add Liquidity              │
│  │       ├── Remove Liquidity           │
│  │       └── Collect Fees               │
│  └── Add Position                       │
│      ├── Token Pair Selection           │
│      ├── Fee Tier Selection             │
│      ├── Price Range                    │
│      ├── Deposit Amounts                │
│      └── Preview & Create               │
│                                         │
│  Bridge                                 │
│  ├── Chain Selection                    │
│  │   ├── From Chain                     │
│  │   └── To Chain                       │
│  ├── Token Selection                    │
│  ├── Amount Input                       │
│  ├── Fee & Time Estimate                │
│  ├── Recipient (optional)               │
│  └── Bridge Button                      │
│                                         │
│  Bridge History                         │
│  ├── Pending Transfers                  │
│  │   ├── Status                         │
│  │   └── Challenge Period               │
│  └── Completed Transfers                │
│                                         │
└─────────────────────────────────────────┘
```

### 4.4 Enterprise dApp

```
┌─────────────────────────────────────────┐
│         Enterprise dApp IA              │
├─────────────────────────────────────────┤
│                                         │
│  Dashboard                              │
│  ├── Balance Overview                   │
│  ├── Recent Activity                    │
│  └── Pending Approvals                  │
│                                         │
│  Payroll                                │
│  ├── Employee List                      │
│  │   ├── Add Employee                   │
│  │   │   ├── Name                       │
│  │   │   ├── Stealth Meta-Address       │
│  │   │   └── Salary                     │
│  │   ├── Edit Employee                  │
│  │   └── Remove Employee                │
│  ├── Run Payroll                        │
│  │   ├── Select Employees               │
│  │   ├── Review Amounts                 │
│  │   ├── Preview (Stealth Addresses)    │
│  │   └── Execute                        │
│  └── Payroll History                    │
│                                         │
│  Expense                                │
│  ├── Departments                        │
│  │   ├── Department Settings            │
│  │   │   ├── Budget                     │
│  │   │   ├── Spending Limits            │
│  │   │   └── Approvers                  │
│  │   └── Sub-Accounts                   │
│  ├── Expense Reports                    │
│  │   ├── Submit Expense                 │
│  │   ├── Approval Workflow              │
│  │   └── Reimbursement                  │
│  └── Budget Tracking                    │
│                                         │
│  Audit                                  │
│  ├── Audit Log                          │
│  │   ├── Filters                        │
│  │   │   ├── Date Range                 │
│  │   │   ├── User                       │
│  │   │   ├── Action Type                │
│  │   │   └── Amount Range               │
│  │   └── Log Entries                    │
│  ├── Compliance Reports                 │
│  │   ├── Generate Report                │
│  │   └── Export                         │
│  └── Access Control                     │
│      ├── Auditor Permissions            │
│      └── Audit Requests                 │
│                                         │
│  Settings                               │
│  ├── Organization                       │
│  ├── Multi-sig Configuration            │
│  ├── Spending Policies                  │
│  └── Integration                        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 5. 네비게이션 구조

### 5.1 Global Navigation

```
Primary Navigation (Top/Side Bar)
├── Home
├── Pay / Swap / Payroll (context-dependent)
├── History / Activity
├── Settings
└── Help
```

### 5.2 User Flow Diagrams

#### 5.2.1 First Payment Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Install │───▶│  Create  │───▶│  Backup  │───▶│   Home   │
│  Wallet  │    │  Account │    │  Phrase  │    │          │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
                                                     ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Complete │◀───│  Confirm │◀───│  Select  │◀───│   Scan   │
│          │    │   Pay    │    │   Gas    │    │    QR    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

#### 5.2.2 Subscription Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Browse  │───▶│  Select  │───▶│  Review  │───▶│  Approve │
│  Service │    │   Plan   │    │Permission│    │  in Wallet│
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
                                                     ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Manage  │◀───│  Active  │◀───│  First   │◀───│Subscription│
│   Sub    │    │Subscription│   │ Payment  │    │  Created │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

#### 5.2.3 Bridge Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Select  │───▶│  Enter   │───▶│  Review  │───▶│  Approve │
│  Chains  │    │  Amount  │    │  Details │    │   Lock   │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
                                                     ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Received │◀───│ Execute  │◀───│Challenge │◀───│  Pending │
│ on Target│    │ Release  │    │  Period  │    │   State  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 6. 상태 관리

### 6.1 Client State

```typescript
// Wallet Extension State
interface WalletState {
  // Auth
  isUnlocked: boolean;

  // Account
  currentAccount: Address | null;
  accounts: SmartAccount[];

  // Network
  chainId: number;
  rpcUrl: string;

  // Balances
  balances: Record<Address, Balance[]>;

  // Pending
  pendingUserOps: UserOperation[];

  // UI
  activeTab: string;
}

// dApp State
interface DAppState {
  // Connection
  isConnected: boolean;
  walletAddress: Address | null;

  // Data
  subscriptions: Subscription[];
  positions: Position[];
  bridgeRequests: BridgeRequest[];

  // Loading
  isLoading: boolean;
  error: Error | null;
}
```

### 6.2 Server State

```typescript
// Bundler State
interface BundlerState {
  mempool: Map<bytes32, UserOperation>;
  reputations: Map<Address, ReputationEntry>;
  executedOps: Set<bytes32>;
}

// Stealth Server State
interface StealthState {
  lastIndexedBlock: number;
  announcements: StealthAnnouncement[];
  registrations: Map<Address, StealthMetaAddress>;
}

// Subscription Executor State
interface ExecutorState {
  pendingQueue: SubscriptionPayment[];
  failedQueue: SubscriptionPayment[];
  lastProcessed: number;
}
```

---

## 7. 에러 처리

### 7.1 에러 코드 체계

```typescript
enum ErrorCode {
  // Account Errors (1xxx)
  ACCOUNT_NOT_FOUND = 1001,
  ACCOUNT_ALREADY_EXISTS = 1002,
  INVALID_SIGNATURE = 1003,
  INSUFFICIENT_BALANCE = 1004,

  // Module Errors (2xxx)
  MODULE_NOT_INSTALLED = 2001,
  MODULE_ALREADY_INSTALLED = 2002,
  INVALID_MODULE_TYPE = 2003,

  // Paymaster Errors (3xxx)
  PAYMASTER_REJECTED = 3001,
  INSUFFICIENT_SPONSOR_DEPOSIT = 3002,
  UNSUPPORTED_TOKEN = 3003,

  // UserOp Errors (4xxx)
  USEROPERATIONERROR_SIMULATION_FAILED = 4001,
  USEROPERATION_EXPIRED = 4002,
  USEROPERATION_INVALID_NONCE = 4003,

  // Bridge Errors (5xxx)
  BRIDGE_RATE_LIMIT_EXCEEDED = 5001,
  BRIDGE_TOKEN_NOT_SUPPORTED = 5002,
  BRIDGE_CHALLENGE_PERIOD_NOT_ENDED = 5003,

  // Subscription Errors (6xxx)
  SUBSCRIPTION_NOT_FOUND = 6001,
  PERMISSION_EXPIRED = 6002,
  PAYMENT_FAILED = 6003,
}
```

### 7.2 에러 응답 형식

```typescript
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}
```

---

## 8. 관련 문서

- [00_PoC_Overview.md](./00_PoC_Overview.md) - PoC 개요
- [01_System_Architecture.md](./01_System_Architecture.md) - 시스템 아키텍처
- [02_Smart_Contracts.md](./02_Smart_Contracts.md) - 스마트 컨트랙트 구조
- [05_Project_Structure.md](./05_Project_Structure.md) - 프로젝트 구조
- [06_PRD_Framework.md](./06_PRD_Framework.md) - PRD 프레임워크

---

*문서 끝*
