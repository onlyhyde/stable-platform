# Task 6: Fiat On-Ramp 페이지 추가

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools 훅, Uniswap V2 Router 유동성 로직.
> **Task 2 (Merchant Dashboard)**: 이벤트 로그 분석, 실시간 통계.
> **Task 3 (Marketplace Registry)**: 동적 모듈 레지스트리, Uninstall.
> **Task 4 (Tx SpeedUp/Cancel)**: useTransactionManager, 가스 범핑/nonce 대체.
> **Task 5 (Batch Transactions)**: useBatchTransaction, BatchBuilder 연동, 다중 수신자 Send.

---

## 현재 상태

### wallet-extension 구현 (완전, 참조)
- **BuyPage.tsx**: 2탭 (Buy / Orders), 견적 조회, 결제 방법 선택, 주문 관리
- **Bank.tsx**: 2탭 (Accounts / Transfer), 은행 계좌 관리, 이체
- **useOnRamp 훅**: 견적/주문 CRUD, 15초 주문 폴링
- **useBankAccounts 훅**: 계좌 연동/해제/동기화/이체
- **타입**: onramp.ts, bank.ts에 전체 정의

### 백엔드 서비스 (이미 존재)
- **onramp-simulator** (Go, port 3002): 견적/주문/KYC API
- **bank-simulator** (Go, port 3001): 계좌/이체/인증 API

### web app 현재 상태
- On-Ramp/Bank 관련 페이지, 훅, 컴포넌트 **전혀 없음**

---

## 구현 계획

### 1. 타입 정의

**파일**: `types/onramp.ts` (신규)

```typescript
// Fiat currencies
export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'KRW' | 'JPY'
export type CryptoCurrency = 'ETH' | 'USDC' | 'USDT' | 'DAI'
export type PaymentMethod = 'bank_transfer' | 'card' | 'wire'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected'

export interface QuoteFees {
  networkFee: number
  serviceFee: number
  processingFee: number
  total: number
}

export interface OnRampQuote {
  id: string
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount: number
  cryptoAmount: string
  exchangeRate: number
  fees: QuoteFees
  totalFiatAmount: number
  expiresAt: string
  createdAt: string
}

export interface OnRampOrder {
  id: string
  quoteId?: string
  status: OrderStatus
  fiatCurrency: FiatCurrency
  cryptoCurrency: CryptoCurrency
  fiatAmount: number
  cryptoAmount: string
  exchangeRate: number
  fees: QuoteFees
  totalFiatAmount: number
  paymentMethod: PaymentMethod
  recipientAddress: Address
  bankAccountNo?: string
  txHash?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  failureReason?: string
}

export interface PaymentInstructions {
  type: PaymentMethod
  bankName?: string
  bankAccountNo?: string
  routingNumber?: string
  reference?: string
  expiresAt: string
}
```

**파일**: `types/bank.ts` (신규)

```typescript
export type BankAccountStatus = 'active' | 'frozen' | 'closed'
export type BankAccountType = 'checking' | 'savings'

export interface LinkedBankAccount {
  id: string
  accountNo: string
  accountType: BankAccountType
  ownerName: string
  linkedAt: number
  lastSynced?: number
  balance?: number
}

export interface BankTransfer {
  id: string
  fromAccount: string
  toAccount: string
  amount: number
  currency: string
  description?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  failureReason?: string
}
```

### 2. useOnRamp 훅

**파일**: `hooks/useOnRamp.ts` (신규)

**API 베이스**: `http://localhost:3002/api/v1`

```typescript
interface UseOnRampReturn {
  // State
  quote: OnRampQuote | null
  orders: OnRampOrder[]
  kycStatus: KycStatus
  supportedAssets: { fiat: FiatCurrency[]; crypto: CryptoCurrency[] }
  isLoadingQuote: boolean
  isLoadingOrders: boolean
  isCreatingOrder: boolean
  error: string | null

  // Operations
  getQuote: (fiat: FiatCurrency, crypto: CryptoCurrency, amount: number) => Promise<OnRampQuote | null>
  createOrder: (params: CreateOrderParams) => Promise<OnRampOrder | null>
  cancelOrder: (orderId: string) => Promise<boolean>
  refreshOrders: () => Promise<void>
  checkKycStatus: (address: Address) => Promise<KycStatus>
  clearQuote: () => void
  clearError: () => void
}
```

**API 호출**:
```typescript
// 견적 조회
POST /api/v1/quotes  { fiatCurrency, cryptoCurrency, fiatAmount }

// 주문 생성
POST /api/v1/orders  { quoteId, paymentMethod, recipientAddress, bankAccountNo? }

// 주문 목록
GET  /api/v1/orders?status=pending

// 주문 취소
POST /api/v1/orders/:id/cancel

// KYC 상태
GET  /api/v1/kyc/status/:address

// 지원 자산
GET  /api/v1/supported-assets
```

### 3. useBankAccounts 훅

**파일**: `hooks/useBankAccounts.ts` (신규)

**API 베이스**: `http://localhost:3001/api/v1`

```typescript
interface UseBankAccountsReturn {
  accounts: LinkedBankAccount[]
  isLoading: boolean
  error: string | null
  linkAccount: (accountNo: string, type: BankAccountType, ownerName: string) => Promise<LinkedBankAccount | null>
  unlinkAccount: (accountNo: string) => Promise<boolean>
  syncAccount: (accountNo: string) => Promise<LinkedBankAccount | null>
  transfer: (from: string, to: string, amount: number, desc?: string) => Promise<BankTransfer | null>
  refresh: () => Promise<void>
}
```

**API 호출**:
```typescript
// 계좌 연동 (로컬 저장 + 잔액 조회)
GET  /api/v1/accounts/:accountNo  → 계좌 존재 확인
// localStorage에 연동 정보 저장

// 잔액 동기화
GET  /api/v1/accounts/:accountNo  → balance

// 이체
POST /api/v1/transfers  { fromAccount, toAccount, amount, currency, description }
```

### 4. Buy 페이지

**파일**: `app/buy/page.tsx` (신규)

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│  Buy Crypto                                  │
│                                              │
│  [Buy Tab] [Orders Tab]                      │
│                                              │
│  ┌── KYC Status Banner ──────────────────┐  │
│  │ Status: Verified ✓                     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Amount: [______] [USD ▼]                    │
│  Receive: ~0.05 ETH  [ETH ▼]               │
│  Payment: [Bank Transfer ▼]                  │
│  Bank Account: [My Checking ▼]              │
│                                              │
│  ┌── Quote Card ─────────────────────────┐  │
│  │ Rate: 1 ETH = $2,000                  │  │
│  │ Fees: Network $0.50 + Service $1.00   │  │
│  │ Total: $101.50                         │  │
│  │ Expires in: 2:45                       │  │
│  │ [Buy Now]                              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Orders Tab:                                 │
│  ┌── Order #1 ───────────────────────────┐  │
│  │ Status: Processing ⏳                  │  │
│  │ $100 → 0.05 ETH                       │  │
│  │ 2024-01-15 14:30                       │  │
│  │ [Cancel]                               │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**컴포넌트**:
- `components/buy/QuoteCard.tsx` - 견적 표시 (만료 카운트다운)
- `components/buy/OrderCard.tsx` - 주문 상태 표시
- `components/buy/PaymentMethodSelector.tsx` - 결제 수단 선택
- `components/buy/KycStatusBanner.tsx` - KYC 상태 배너

### 5. Bank 페이지

**파일**: `app/bank/page.tsx` (신규)

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│  Bank Accounts                               │
│                                              │
│  [Accounts Tab] [Transfer Tab]               │
│                                              │
│  ┌── Link Account Form ─────────────────┐   │
│  │ Account No: [______]                  │   │
│  │ Type: [Checking ▼]                    │   │
│  │ Owner: [______]                       │   │
│  │ [Link Account]                        │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌── Account Card ───────────────────────┐  │
│  │ Checking ****1234  |  $5,000.00       │  │
│  │ Last synced: 5 min ago                │  │
│  │ [Sync] [Unlink]                       │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  Transfer Tab:                               │
│  From: [Checking ****1234 ▼]                │
│  To:   [Savings ****5678  ▼]                │
│  Amount: [______]                            │
│  [Transfer]                                  │
└─────────────────────────────────────────────┘
```

**컴포넌트**:
- `components/bank/BankAccountCard.tsx` - 계좌 카드
- `components/bank/LinkAccountForm.tsx` - 계좌 연동 폼
- `components/bank/TransferForm.tsx` - 이체 폼

### 6. 사이드바 네비게이션 추가

**기존 사이드바에 추가**:
- "Buy" (💳) → `/buy`
- "Bank" (🏦) → `/bank`

DeFi 섹션 아래 또는 Payment 섹션에 배치.

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `types/onramp.ts` | **신규** - On-Ramp 타입 |
| `types/bank.ts` | **신규** - Bank 타입 |
| `hooks/useOnRamp.ts` | **신규** - On-Ramp 훅 |
| `hooks/useBankAccounts.ts` | **신규** - Bank 훅 |
| `app/buy/page.tsx` | **신규** - Buy 페이지 |
| `app/buy/layout.tsx` | **신규** - Buy 레이아웃 |
| `app/bank/page.tsx` | **신규** - Bank 페이지 |
| `app/bank/layout.tsx` | **신규** - Bank 레이아웃 |
| `components/buy/QuoteCard.tsx` | **신규** |
| `components/buy/OrderCard.tsx` | **신규** |
| `components/buy/PaymentMethodSelector.tsx` | **신규** |
| `components/buy/KycStatusBanner.tsx` | **신규** |
| `components/bank/BankAccountCard.tsx` | **신규** |
| `components/bank/LinkAccountForm.tsx` | **신규** |
| `components/bank/TransferForm.tsx` | **신규** |
| `components/layout/Sidebar.tsx` | Buy/Bank 메뉴 항목 추가 |
| `hooks/index.ts` | 새 훅 export |

## 서비스 URL 설정

**lib/config/env.ts에 추가**:
```typescript
// 이미 존재할 수 있는 환경변수
NEXT_PUBLIC_LOCAL_ONRAMP_URL     // default: http://localhost:3002
NEXT_PUBLIC_LOCAL_BANK_URL       // default: http://localhost:3001
```

## 백엔드 서비스 참조

### onramp-simulator (port 3002)
```
GET    /api/v1/supported-assets
POST   /api/v1/quotes
POST   /api/v1/orders
GET    /api/v1/orders?status=pending
GET    /api/v1/orders/:id
POST   /api/v1/orders/:id/cancel
GET    /api/v1/kyc/status/:address
POST   /api/v1/kyc/verify
GET    /api/v1/exchange-rates
```

### bank-simulator (port 3001)
```
POST   /api/v1/accounts                    Create account
GET    /api/v1/accounts                    List accounts
GET    /api/v1/accounts/:accountNo         Get account
POST   /api/v1/transfers                   Create transfer
GET    /api/v1/transfers/:id               Get transfer
POST   /api/v1/accounts/verify/initiate    1-won verification
POST   /api/v1/accounts/verify/complete    Complete verification
```

## docker-compose 참조
onramp-simulator, bank-simulator가 docker-compose.yml에 정의되어 있으므로
`docker compose up onramp-simulator bank-simulator`로 실행 가능.
