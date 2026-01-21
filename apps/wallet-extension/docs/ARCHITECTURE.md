# StableNet Wallet Extension - Architecture Document

## Overview

MetaMask 스타일의 Chrome Extension 지갑 애플리케이션으로, Bank/OnRamp 시뮬레이터 통합, DApp 통신, 사용자 친화적 UI를 제공합니다.

### Tech Stack
- **Framework**: React 19 + TypeScript
- **State**: Zustand 5 (UI) + Custom Manager (Background)
- **Styling**: Tailwind CSS 3.4
- **Bundler**: Vite 6
- **Ethereum**: Viem 2.21

---

## 1. Directory Structure

```
/apps/wallet-extension/src/
├── background/                     # Service Worker (persistent)
│   ├── index.ts                    # Entry point, message router
│   ├── state/
│   │   ├── store.ts               # Persistent state manager
│   │   └── migrations.ts          # State version migrations
│   ├── rpc/
│   │   ├── handler.ts             # RPC request dispatcher
│   │   ├── methods/               # Individual method handlers
│   │   │   ├── accounts.ts        # eth_accounts, eth_requestAccounts
│   │   │   ├── chain.ts           # eth_chainId, wallet_switchEthereumChain
│   │   │   ├── signing.ts         # personal_sign, eth_signTypedData_v4
│   │   │   ├── transaction.ts     # eth_sendTransaction
│   │   │   └── userOp.ts          # eth_sendUserOperation
│   │   └── permissions.ts
│   ├── controllers/
│   │   ├── accountController.ts
│   │   ├── networkController.ts
│   │   ├── keyringController.ts   # Keyring orchestration
│   │   ├── transactionController.ts
│   │   ├── approvalController.ts  # Approval queue management
│   │   └── notificationController.ts
│   ├── services/
│   │   ├── bundler.ts             # Bundler API client
│   │   ├── paymaster.ts           # Paymaster integration
│   │   └── rpcProvider.ts         # JSON-RPC provider
│   └── keyring/                    # Key management
│       ├── index.ts               # Keyring facade
│       ├── hdKeyring.ts           # HD wallet (BIP-39/44)
│       ├── simpleKeyring.ts       # Imported private keys
│       ├── vault.ts               # AES-GCM encrypted storage
│       └── crypto.ts              # Encryption utilities
│
├── ui/                            # Popup UI (React)
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Router & layout
│   ├── popup.html                 # HTML template
│   ├── components/
│   │   ├── common/                # Design system primitives
│   │   │   ├── Button.tsx         # variant: primary|secondary|ghost|danger
│   │   │   ├── Card.tsx           # + CardHeader, CardContent, CardFooter
│   │   │   ├── Input.tsx          # label, error, hint support
│   │   │   ├── Modal.tsx          # Overlay dialogs
│   │   │   ├── Select.tsx         # Dropdown select
│   │   │   ├── Toggle.tsx         # Switch component
│   │   │   ├── Badge.tsx          # Status badges
│   │   │   ├── Spinner.tsx        # Loading indicator
│   │   │   ├── Toast.tsx          # Notifications
│   │   │   ├── QRCode.tsx         # QR code display
│   │   │   ├── AddressDisplay.tsx # Address with copy/QR
│   │   │   ├── TokenAmount.tsx    # Formatted amounts
│   │   │   └── index.ts           # Barrel export
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Account/network selector
│   │   │   ├── Navigation.tsx     # Bottom tab nav
│   │   │   └── PageContainer.tsx  # Standard page wrapper
│   │   ├── account/
│   │   │   ├── AccountSelector.tsx
│   │   │   ├── AccountCard.tsx
│   │   │   ├── CreateAccountForm.tsx
│   │   │   └── ImportAccountForm.tsx
│   │   ├── network/
│   │   │   ├── NetworkSelector.tsx
│   │   │   ├── NetworkCard.tsx
│   │   │   └── AddNetworkForm.tsx
│   │   ├── transaction/
│   │   │   ├── TransactionCard.tsx
│   │   │   ├── TransactionDetails.tsx
│   │   │   └── TransactionList.tsx
│   │   ├── bank/                   # Bank simulator components
│   │   │   ├── BankAccountCard.tsx
│   │   │   ├── BankAccountList.tsx
│   │   │   └── TransferForm.tsx
│   │   └── onramp/                 # OnRamp simulator components
│   │       ├── QuoteCard.tsx
│   │       ├── OrderCard.tsx
│   │       ├── PaymentMethodSelector.tsx
│   │       └── BuyCryptoForm.tsx
│   ├── pages/
│   │   ├── index.ts               # Barrel export
│   │   ├── Home.tsx               # Balance, quick actions
│   │   ├── Send.tsx               # Send transaction form
│   │   ├── Receive.tsx            # QR code, address copy
│   │   ├── Activity.tsx           # Transaction history
│   │   ├── Settings.tsx           # Wallet settings
│   │   ├── Bank.tsx               # Bank accounts management
│   │   ├── BuyPage.tsx            # Buy crypto with fiat
│   │   ├── ConnectedSites.tsx     # Manage dApp connections
│   │   ├── Onboarding/            # First-time setup
│   │   │   ├── Welcome.tsx
│   │   │   ├── CreatePassword.tsx
│   │   │   ├── SeedPhrase.tsx
│   │   │   ├── ConfirmSeed.tsx
│   │   │   ├── ImportWallet.tsx
│   │   │   └── Complete.tsx
│   │   └── Lock.tsx               # Unlock screen
│   ├── hooks/
│   │   ├── useWalletStore.ts      # Zustand UI state
│   │   ├── useBackgroundState.ts  # Background sync
│   │   ├── useAccount.ts          # Account operations
│   │   ├── useNetwork.ts          # Network operations
│   │   ├── useBalance.ts          # Balance queries
│   │   ├── useTokenBalances.ts    # ERC-20 balances
│   │   ├── useTransactions.ts     # Transaction history
│   │   ├── useBankAccounts.ts     # Bank simulator hook
│   │   ├── useOnRamp.ts           # OnRamp simulator hook
│   │   ├── useApproval.ts         # Approval flow hook
│   │   └── index.ts
│   ├── lib/
│   │   ├── utils.ts               # cn(), formatAddress()
│   │   ├── messaging.ts           # Chrome messaging helpers
│   │   ├── qrcode.ts              # QR generation
│   │   └── validation.ts          # Input validation (zod)
│   └── styles/
│       └── globals.css            # Tailwind base
│
├── approval/                      # Approval Popup Window
│   ├── main.tsx                   # Entry point
│   ├── App.tsx                    # Approval router
│   ├── approval.html              # HTML template
│   └── pages/
│       ├── ConnectApproval.tsx    # dApp connection
│       ├── SignatureApproval.tsx  # Message signing
│       ├── TransactionApproval.tsx # Transaction approval
│       └── PermissionApproval.tsx # Permission request
│
├── contentscript/
│   └── index.ts                   # Page bridge
│
├── inpage/
│   ├── index.ts                   # EIP-1193 provider
│   └── eip6963.ts                 # EIP-6963 announcer
│
├── shared/
│   ├── constants.ts               # Networks, storage keys
│   ├── errors.ts                  # Error definitions
│   └── events.ts                  # Event types
│
├── types/
│   ├── index.ts                   # Main exports
│   ├── account.ts                 # Account types
│   ├── network.ts                 # Network types
│   ├── transaction.ts             # Transaction/UserOp types
│   ├── keyring.ts                 # Keyring types
│   ├── approval.ts                # Approval types
│   ├── bank.ts                    # Bank simulator types
│   ├── onramp.ts                  # OnRamp types
│   └── rpc.ts                     # RPC types
│
└── lib/
    ├── api/                       # API clients
    │   ├── baseApi.ts             # Base HTTP client
    │   ├── bankApi.ts             # Bank simulator
    │   └── onrampApi.ts           # OnRamp simulator
    ├── userOp/
    │   ├── builder.ts             # UserOperation builder
    │   ├── signer.ts              # UserOp signing
    │   └── types.ts               # UserOp types
    └── eip7702/
        ├── authorization.ts       # EIP-7702 signing
        └── delegation.ts          # Delegation helpers
```

---

## 2. Component Architecture

### 2.1 Design System Components

재사용 가능한 기본 컴포넌트 (web app 패턴 기반):

```typescript
// Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  size: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  disabled?: boolean
}

// Card.tsx
interface CardProps {
  variant?: 'default' | 'gradient' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}
// Subcomponents: CardHeader, CardContent, CardFooter

// Input.tsx
interface InputProps {
  label?: string
  error?: string
  hint?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
}

// Modal.tsx
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
}

// QRCode.tsx
interface QRCodeProps {
  value: string
  size?: number
  logo?: string
}

// AddressDisplay.tsx
interface AddressDisplayProps {
  address: `0x${string}`
  truncate?: boolean
  showCopy?: boolean
  showQR?: boolean
}

// TokenAmount.tsx
interface TokenAmountProps {
  amount: bigint
  decimals: number
  symbol: string
  showUsd?: boolean
}
```

### 2.2 Domain Components

| Category | Components | Purpose |
|----------|------------|---------|
| **Account** | AccountSelector, AccountCard, CreateAccountForm, ImportAccountForm | 계정 관리 |
| **Network** | NetworkSelector, NetworkCard, AddNetworkForm | 네트워크 전환 |
| **Transaction** | TransactionCard, TransactionDetails, TransactionList | 트랜잭션 표시 |
| **Bank** | BankAccountCard, BankAccountList, TransferForm | 은행 시뮬레이터 |
| **OnRamp** | QuoteCard, OrderCard, PaymentMethodSelector, BuyCryptoForm | 암호화폐 구매 |

---

## 3. Hooks Architecture

### 3.1 UI State Hook (Zustand)

```typescript
// useWalletStore.ts
interface UIWalletState {
  // UI-only state (ephemeral)
  currentPage: Page
  isLoading: boolean
  error: string | null

  // Cached from background (synced)
  accounts: Account[]
  selectedAccount: Address | null
  networks: Network[]
  selectedChainId: number
  isUnlocked: boolean
  pendingTransactions: PendingTransaction[]
  history: HistoryTransaction[]
  connectedSites: ConnectedSite[]

  // Balance cache
  balances: Record<Address, bigint>
  tokenBalances: Record<Address, TokenBalance[]>

  // Actions
  setPage: (page: Page) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  syncWithBackground: () => Promise<void>

  // Account actions (forward to background)
  selectAccount: (address: Address) => Promise<void>
  createAccount: (name?: string) => Promise<Account>
  importAccount: (privateKey: Hex, name?: string) => Promise<Account>

  // Network actions (forward to background)
  selectNetwork: (chainId: number) => Promise<void>
  addNetwork: (network: Network) => Promise<void>
}
```

### 3.2 Domain Hooks

```typescript
// useAccount.ts
function useAccount() {
  return {
    currentAccount: Account | null,
    accounts: Account[],
    createAccount: (name?: string) => Promise<Account>,
    importAccount: (privateKey: Hex, name?: string) => Promise<Account>,
    selectAccount: (address: Address) => void,
    removeAccount: (address: Address) => Promise<void>,
    renameAccount: (address: Address, name: string) => Promise<void>,
  }
}

// useNetwork.ts
function useNetwork() {
  return {
    currentNetwork: Network | null,
    networks: Network[],
    switchNetwork: (chainId: number) => Promise<void>,
    addNetwork: (network: Network) => Promise<void>,
    removeNetwork: (chainId: number) => Promise<void>,
  }
}

// useBalance.ts
function useBalance(address?: Address) {
  return {
    balance: bigint | undefined,
    isLoading: boolean,
    refetch: () => Promise<void>,
  }
}

// useTransactions.ts
function useTransactions() {
  return {
    pending: PendingTransaction[],
    history: HistoryTransaction[],
    getTransaction: (hash: Hex) => Transaction | null,
  }
}

// useBankAccounts.ts
function useBankAccounts() {
  return {
    accounts: BankAccount[],
    isLoading: boolean,
    createAccount: (req: CreateBankAccountRequest) => Promise<BankAccount>,
    getTransfers: (accountNo: string) => Promise<BankTransfer[]>,
    transfer: (req: TransferRequest) => Promise<BankTransfer>,
  }
}

// useOnRamp.ts
function useOnRamp() {
  return {
    quote: Quote | null,
    orders: Order[],
    isLoadingQuote: boolean,
    getQuote: (req: QuoteRequest) => Promise<Quote>,
    createOrder: (req: CreateOrderRequest) => Promise<Order>,
    getOrder: (id: string) => Promise<Order>,
    cancelOrder: (id: string) => Promise<void>,
  }
}

// useApproval.ts
function useApproval() {
  return {
    pendingApproval: ApprovalRequest | null,
    approve: (id: string) => Promise<void>,
    reject: (id: string, reason?: string) => Promise<void>,
  }
}
```

---

## 4. State Management

### 4.1 Two-Tier Architecture

```
┌─────────────────────────────────────────────────────┐
│              Background (Service Worker)             │
│  WalletStateManager (Persistent - chrome.storage)   │
│  - accounts, networks, transactions                 │
│  - encrypted keyring vault                          │
│  - connected sites, approval queue                  │
└────────────────────────┬────────────────────────────┘
                         │ chrome.runtime.sendMessage
                         ▼
┌─────────────────────────────────────────────────────┐
│              UI (Popup / Approval Window)            │
│  Zustand Store (Ephemeral)                          │
│  - UI state: currentPage, isLoading, error          │
│  - Cached copy of background state                  │
│  - Sync on mount + state change events              │
└─────────────────────────────────────────────────────┘
```

### 4.2 Background State Manager

```typescript
// background/state/store.ts
interface PersistedState {
  accounts: {
    accounts: Account[]
    selectedAccount: Address | null
  }
  networks: {
    networks: Network[]
    selectedChainId: number
  }
  transactions: {
    pending: Map<string, PendingTransaction>
    history: HistoryTransaction[]
  }
  connections: {
    sites: Map<string, ConnectedSite>
  }
  keyring: {
    isUnlocked: boolean
    encryptedVault: string | null
    derivationPath: string
    accountCount: number
  }
  approvals: {
    queue: ApprovalRequest[]
  }
  preferences: {
    currency: string
    locale: string
    autoLockTimeout: number
  }
}

class WalletStateManager {
  private state: PersistedState
  private listeners: Set<(state: PersistedState) => void>

  async initialize(): Promise<void>
  async unlock(password: string): Promise<boolean>
  lock(): void
  getState(): PersistedState
  getPublicState(): PublicState  // Safe subset for UI
  async setState(partial: Partial<PersistedState>): Promise<void>
  subscribe(listener): () => void
}
```

---

## 5. Security Layer

### 5.1 Keyring Architecture

```
┌─────────────────────────────────────────────────────┐
│                  KeyringController                   │
│  ┌───────────────────────────────────────────────┐  │
│  │                    Vault                       │  │
│  │  - AES-GCM encryption                         │  │
│  │  - PBKDF2 key derivation (100k iterations)    │  │
│  │  - Salt per vault                             │  │
│  └───────────────────────────────────────────────┘  │
│                         │                           │
│           ┌─────────────┼─────────────┐            │
│           ▼             ▼             ▼            │
│    ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│    │ HDKeyring │ │SimpleKey- │ │ Hardware  │      │
│    │ (BIP-39)  │ │   ring    │ │ (future)  │      │
│    └───────────┘ └───────────┘ └───────────┘      │
└─────────────────────────────────────────────────────┘
```

### 5.2 Vault Implementation

```typescript
// background/keyring/vault.ts
interface VaultData {
  salt: string   // Base64
  iv: string     // Base64
  data: string   // Encrypted JSON (Base64)
}

class Vault {
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>
  async encrypt(password: string, data: unknown): Promise<VaultData>
  async decrypt<T>(password: string, vault: VaultData): Promise<T>
}
```

### 5.3 Keyring Controller

```typescript
// background/keyring/index.ts
class KeyringController {
  private vault: Vault
  private hdKeyring: HDKeyring | null
  private simpleKeyring: SimpleKeyring | null
  private isUnlocked: boolean

  async createNewVault(password: string, mnemonic?: string): Promise<void>
  async unlock(password: string): Promise<boolean>
  lock(): void
  getAccounts(): Address[]
  async addHDAccount(): Promise<Account>
  async importPrivateKey(privateKey: Hex): Promise<Account>
  async signMessage(address: Address, message: Hex): Promise<Hex>
  async signTypedData(address: Address, data: TypedData): Promise<Hex>
  async signUserOperation(
    address: Address,
    userOp: UserOperation,
    entryPoint: Address,
    chainId: number
  ): Promise<Hex>
}
```

### 5.4 Approval Controller

```typescript
// background/controllers/approvalController.ts
type ApprovalType = 'connect' | 'sign' | 'signTypedData' | 'transaction' | 'switchChain' | 'addNetwork'

interface ApprovalRequest {
  id: string
  type: ApprovalType
  origin: string
  favicon?: string
  data: ApprovalData
  timestamp: number
}

class ApprovalController {
  private queue: Map<string, ApprovalRequest>
  private pending: Map<string, { resolve, reject }>

  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<unknown>
  approve(id: string, result?: unknown): void
  reject(id: string, reason?: string): void
  getCurrentApproval(): ApprovalRequest | null
}
```

---

## 6. Service Integration

### 6.1 Base API Client

```typescript
// lib/api/baseApi.ts
class BaseApiClient {
  constructor(private baseUrl: string) {}

  protected async get<T>(path: string, params?: Record<string, string>): Promise<T>
  protected async post<T, D>(path: string, data: D): Promise<T>
  protected async put<T, D>(path: string, data: D): Promise<T>
  protected async delete<T>(path: string): Promise<T>
}
```

### 6.2 Bank Simulator Client

```typescript
// lib/api/bankApi.ts
const BANK_API_URL = 'http://localhost:8081'

class BankApiClient extends BaseApiClient {
  // Accounts
  createAccount(req: CreateAccountRequest): Promise<BankAccount>
  getAccounts(): Promise<BankAccount[]>
  getAccount(accountNo: string): Promise<BankAccount>
  freezeAccount(accountNo: string): Promise<void>
  unfreezeAccount(accountNo: string): Promise<void>

  // Transfers
  transfer(req: TransferRequest): Promise<Transfer>
  getTransfer(id: string): Promise<Transfer>
  getAccountTransfers(accountNo: string): Promise<Transfer[]>
}

export const bankApi = new BankApiClient()
```

### 6.3 OnRamp Simulator Client

```typescript
// lib/api/onrampApi.ts
const ONRAMP_API_URL = 'http://localhost:8082'

class OnRampApiClient extends BaseApiClient {
  // Quotes
  getQuote(req: QuoteRequest): Promise<QuoteResponse>

  // Orders
  createOrder(req: CreateOrderRequest): Promise<Order>
  getOrder(id: string): Promise<Order>
  cancelOrder(id: string): Promise<Order>
  getUserOrders(userId: string): Promise<Order[]>
}

export const onrampApi = new OnRampApiClient()
```

---

## 7. DApp Communication

### 7.1 EIP-1193 Provider

```typescript
// inpage/index.ts
class StableNetProvider implements EIP1193Provider {
  readonly isStableNet = true

  chainId: string | null = null
  selectedAddress: string | null = null

  async request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: string, listener: EventListener): this
  removeListener(event: string, listener: EventListener): this

  // Legacy methods
  enable(): Promise<string[]>
  send(methodOrPayload, paramsOrCallback): Promise<unknown> | void
  sendAsync(payload, callback): void
}

// Exposed as window.stablenet
```

### 7.2 EIP-6963 Provider Announcement

```typescript
// inpage/eip6963.ts
interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string  // Base64 data URI
  rdns: string  // Reverse DNS
}

export function announceProvider(provider: EIP1193Provider): void {
  const info: EIP6963ProviderInfo = {
    uuid: crypto.randomUUID(),
    name: 'StableNet Wallet',
    icon: 'data:image/svg+xml;base64,...',
    rdns: 'dev.stablenet.wallet',
  }

  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: { info, provider }
    })
  )

  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: { info, provider }
      })
    )
  })
}
```

### 7.3 Supported RPC Methods

| Method | Requires Approval | Description |
|--------|-------------------|-------------|
| `eth_accounts` | No | Get connected accounts |
| `eth_requestAccounts` | Yes | Request connection |
| `eth_chainId` | No | Get current chain ID |
| `wallet_switchEthereumChain` | Yes | Switch network |
| `wallet_addEthereumChain` | Yes | Add new network |
| `personal_sign` | Yes | Sign message |
| `eth_signTypedData_v4` | Yes | Sign typed data |
| `eth_sendTransaction` | Yes | Send legacy transaction |
| `eth_sendUserOperation` | Yes | Send UserOperation |
| `eth_estimateUserOperationGas` | No | Estimate gas |
| `eth_getBalance` | No | Get balance |
| `eth_call` | No | Read-only call |
| `eth_blockNumber` | No | Get block number |

---

## 8. Page Flow

### 8.1 Main Navigation

```
┌─────────────────────────────────────────────────────┐
│                    Main Wallet                       │
│                                                     │
│  ┌─────┬─────┬─────────┬──────────┬──────────┐     │
│  │Home │Send │Receive  │Activity  │Settings  │     │
│  └─────┴─────┴─────────┴──────────┴──────────┘     │
│                                                     │
│  Additional pages (from Settings/Home):            │
│  - Bank (linked bank accounts)                     │
│  - Buy (buy crypto with fiat)                      │
│  - Connected Sites (dApp management)               │
└─────────────────────────────────────────────────────┘
```

### 8.2 Onboarding Flow

```
Welcome → Create Password → [New Wallet | Import Wallet]
                              ↓              ↓
                        Seed Phrase    Enter Seed/Key
                              ↓              ↓
                        Confirm Seed        │
                              ↓              │
                        Complete ←──────────┘
```

### 8.3 Approval Flow

```
dApp Request → Background → ApprovalController → Popup Window
                                                      │
                          ┌───────────────────────────┤
                          ↓           ↓               ↓
                     Connect     Sign Msg      Transaction
                     (accounts)  (risk)        (gas estimate)
                          │           │               │
                          └───────────┴───────────────┘
                                      │
                            User Approve/Reject
                                      │
                            Response to dApp
```

---

## 9. Types

### 9.1 Core Types

```typescript
// types/account.ts
interface Account {
  address: `0x${string}`
  name: string
  type: 'eoa' | 'smart'
  isDeployed?: boolean
  derivationPath?: string
}

// types/network.ts
interface Network {
  chainId: number
  name: string
  rpcUrl: string
  bundlerUrl: string
  paymasterUrl?: string
  explorerUrl?: string
  currency: { name: string; symbol: string; decimals: number }
  isTestnet?: boolean
}

// types/transaction.ts
interface UserOperation {
  sender: `0x${string}`
  nonce: bigint
  factory?: `0x${string}`
  factoryData?: `0x${string}`
  callData: `0x${string}`
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: `0x${string}`
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: `0x${string}`
  signature: `0x${string}`
}

type TransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'

interface PendingTransaction {
  id: string
  type: 'userOp' | 'legacy'
  userOpHash?: `0x${string}`
  txHash?: `0x${string}`
  sender: `0x${string}`
  to?: `0x${string}`
  value?: bigint
  chainId: number
  status: TransactionStatus
  timestamp: number
  error?: string
}
```

### 9.2 Service Types

```typescript
// types/bank.ts
type BankAccountStatus = 'active' | 'frozen' | 'closed'
type TransferStatus = 'pending' | 'completed' | 'failed'

interface BankAccount {
  id: string
  accountNo: string
  name: string
  currency: string
  balance: string
  status: BankAccountStatus
  createdAt: string
  updatedAt: string
}

interface BankTransfer {
  id: string
  fromAccountNo: string
  toAccountNo: string
  amount: string
  currency: string
  reference: string
  status: TransferStatus
  failureReason?: string
  createdAt: string
  completedAt?: string
}

// types/onramp.ts
type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'kyc_required'
type PaymentMethod = 'card' | 'bank_transfer' | 'apple_pay' | 'google_pay'

interface OnRampOrder {
  id: string
  userId: string
  walletAddress: `0x${string}`
  fiatAmount: string
  fiatCurrency: string
  cryptoAmount: string
  cryptoCurrency: string
  exchangeRate: string
  fee: string
  paymentMethod: PaymentMethod
  status: OrderStatus
  txHash?: `0x${string}`
  chainId: number
  createdAt: string
  completedAt?: string
}

interface QuoteResponse {
  fiatAmount: string
  fiatCurrency: string
  cryptoAmount: string
  cryptoCurrency: string
  exchangeRate: string
  fee: string
  feePercent: string
  expiresAt: string
}
```

### 9.3 Approval Types

```typescript
// types/approval.ts
type ApprovalType = 'connect' | 'sign' | 'signTypedData' | 'transaction' | 'switchChain' | 'addNetwork'

interface ApprovalRequest {
  id: string
  type: ApprovalType
  origin: string
  favicon?: string
  timestamp: number
  data: ApprovalData
}

type ApprovalData =
  | ConnectApprovalData
  | SignApprovalData
  | TransactionApprovalData
  | SwitchChainApprovalData
  | AddNetworkApprovalData

interface ConnectApprovalData {
  accounts: `0x${string}`[]
  permissions: string[]
}

interface SignApprovalData {
  message: `0x${string}` | string
  account: `0x${string}`
  isTypedData?: boolean
}

interface TransactionApprovalData {
  userOp: UserOperation
  estimatedGas: bigint
  estimatedFee: bigint
}
```

---

## 10. Implementation Priority

### Phase 1: Core Infrastructure
1. Directory restructure
2. Design system components
3. Keyring controller with vault encryption
4. Enhanced state management
5. Background-UI messaging

### Phase 2: Security & Approvals
1. Approval controller
2. Approval popup window
3. Connect/Sign/Transaction approval flows
4. Lock/unlock mechanism

### Phase 3: UserOperation Support
1. UserOperation builder
2. Signing integration
3. Bundler client
4. Paymaster integration

### Phase 4: Service Integration
1. Bank API client + UI
2. OnRamp API client + UI
3. Real-time status updates

### Phase 5: Polish
1. QR code generation
2. Onboarding flow
3. EIP-6963 provider
4. Error handling

---

## 11. Testing

### Build & Type Check
```bash
pnpm --filter wallet-extension build
pnpm --filter wallet-extension typecheck
```

### Manual Testing
1. Load extension: `chrome://extensions` → Load unpacked → `apps/wallet-extension/dist`
2. Complete onboarding
3. Connect to dApp
4. Test transactions

### Run Simulators
```bash
docker-compose up -d bank-simulator onramp-simulator
```

---

## 12. Dependencies

```json
{
  "dependencies": {
    "qrcode": "^1.5.3",
    "@noble/hashes": "^1.3.3",
    "bip39": "^3.1.0"
  }
}
```
