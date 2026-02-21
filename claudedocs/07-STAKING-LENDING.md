# Task 7: Staking/Lending UI 추가

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools 훅, Uniswap V2 Router 유동성 로직.
> **Task 2 (Merchant Dashboard)**: 이벤트 로그 분석, 실시간 통계.
> **Task 3 (Marketplace Registry)**: 동적 모듈 레지스트리, Uninstall.
> **Task 4 (Tx SpeedUp/Cancel)**: useTransactionManager, 가스 범핑/nonce 대체.
> **Task 5 (Batch Transactions)**: useBatchTransaction, BatchBuilder 연동, 다중 수신자 Send.
> **Task 6 (Fiat On-Ramp)**: useOnRamp/useBankAccounts 훅, Buy/Bank 페이지, 시뮬레이터 API 연동.

---

## 현재 상태

### SDK 구현 (이미 존재)
- `packages/sdk-ts/plugins/defi/` - Staking/Lending 플러그인
- **StakingExecutor**: stake, unstake, claimRewards, compoundRewards
- **LendingExecutor**: supply, withdraw, borrow, repay
- **HealthFactorHook**: 건전성 비율 모니터링
- 인코딩 함수: `encodeStakingExecutorInitData`, `encodeLendingExecutorInitData`, `encodeHealthFactorHookInitData`
- 상수: `DEFAULTS.MAX_LTV`, `DEFAULTS.MIN_HEALTH_FACTOR`, `SCALE.WAD`

### 컨트랙트 주소 (chain 8283)
```typescript
getLendingPool(chainId)     // Lending pool 주소
getStakingVault(chainId)    // Staking vault 주소
getPriceOracle(chainId)     // Price oracle 주소
```

### web app 현재 상태
- DeFi 섹션에 Swap, Pool만 존재
- Staking/Lending 페이지, 훅, 컴포넌트 **없음**
- DeFi 허브 (`/defi`) 네비게이션에 Staking/Lending 카드 없음

---

## 구현 계획

### 1. 타입 정의

**파일**: `types/defi.ts` (신규)

```typescript
// === Staking ===
export interface StakingPool {
  address: Address
  stakingToken: Token
  rewardToken: Token
  minStake: bigint
  maxStake: bigint
  apr: number          // 연간 수익률 %
  tvl: bigint          // 총 예치량
  isRegistered: boolean
}

export interface StakingPosition {
  pool: Address
  stakedAmount: bigint
  rewardsEarned: bigint
  stakingToken: Token
  rewardToken: Token
  stakedAt: number     // timestamp
}

export interface StakingAccountConfig {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
  dailyUsed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}

// === Lending ===
export type LendingPoolType = 'AAVE_V3' | 'COMPOUND_V3' | 'MORPHO'

export interface LendingPool {
  address: Address
  poolType: LendingPoolType
  supplyAssets: Token[]
  borrowAssets: Token[]
  supplyAPY: number    // 공급 수익률
  borrowAPY: number    // 대출 이자율
  tvl: bigint
  isWhitelisted: boolean
}

export interface LendingPosition {
  pool: Address
  poolType: LendingPoolType
  suppliedAssets: { token: Token; amount: bigint; value: bigint }[]
  borrowedAssets: { token: Token; amount: bigint; value: bigint }[]
  healthFactor: bigint    // scaled by 1e18
  netAPY: number
}

export interface LendingAccountConfig {
  maxLtv: number            // basis points (8000 = 80%)
  minHealthFactor: bigint   // scaled by 1e18 (1.2e18 = 1.2)
  dailyBorrowLimit: bigint
  dailyBorrowed: bigint
  lastResetTime: bigint
  isActive: boolean
  isPaused: boolean
}
```

### 2. useStaking 훅

**파일**: `hooks/useStaking.ts` (신규)

```typescript
interface UseStakingReturn {
  // State
  pools: StakingPool[]
  positions: StakingPosition[]
  accountConfig: StakingAccountConfig | null
  isLoading: boolean
  error: string | null

  // Operations
  stake: (pool: Address, amount: bigint) => Promise<Hex | null>
  unstake: (pool: Address, amount: bigint) => Promise<Hex | null>
  claimRewards: (pool: Address) => Promise<Hex | null>
  compoundRewards: (pool: Address) => Promise<Hex | null>

  // Queries
  fetchPools: () => Promise<void>
  fetchPositions: () => Promise<void>
  refetch: () => Promise<void>
}
```

**구현 패턴** (ERC-7579 모듈 기반):
```typescript
// Staking Executor 모듈이 설치된 Smart Account에서 실행
// SDK에서 calldata 인코딩 → useUserOp으로 전송

import { encodeStakingExecutorInitData } from '@stablenet/plugins/defi'

// Stake
const calldata = encodeFunctionData({
  abi: STAKING_EXECUTOR_ABI,
  functionName: 'stake',
  args: [poolAddress, amount]
})
await sendUserOp({ target: stakingExecutorAddress, data: calldata })

// Unstake
const calldata = encodeFunctionData({
  abi: STAKING_EXECUTOR_ABI,
  functionName: 'unstake',
  args: [poolAddress, amount]
})

// Claim Rewards
const calldata = encodeFunctionData({
  abi: STAKING_EXECUTOR_ABI,
  functionName: 'claimRewards',
  args: [poolAddress]
})
```

### 3. useLending 훅

**파일**: `hooks/useLending.ts` (신규)

```typescript
interface UseLendingReturn {
  // State
  pools: LendingPool[]
  positions: LendingPosition[]
  accountConfig: LendingAccountConfig | null
  healthFactor: bigint | null
  isLoading: boolean
  error: string | null

  // Operations
  supply: (pool: Address, asset: Address, amount: bigint) => Promise<Hex | null>
  withdraw: (pool: Address, asset: Address, amount: bigint) => Promise<Hex | null>
  borrow: (pool: Address, asset: Address, amount: bigint) => Promise<Hex | null>
  repay: (pool: Address, asset: Address, amount: bigint) => Promise<Hex | null>

  // Queries
  getHealthFactor: () => Promise<bigint | null>
  fetchPools: () => Promise<void>
  fetchPositions: () => Promise<void>
  refetch: () => Promise<void>
}
```

**건전성 비율 계산** (SDK 참조):
```typescript
import { calculateHealthFactor, isLiquidatable, SCALE } from '@stablenet/plugins/defi'

// healthFactor = (collateralValue * liquidationThreshold) / debtValue
const hf = calculateHealthFactor(collateralValue, debtValue, liquidationThreshold)
const isRisky = isLiquidatable(hf)  // hf < SCALE.WAD (1e18)
```

### 4. Staking 페이지

**파일**: `app/defi/stake/page.tsx` (신규)

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│  Staking                         [< DeFi]   │
│                                              │
│  ┌── Your Positions ─────────────────────┐  │
│  │ Pool A:  500 TOKEN staked             │  │
│  │   Rewards: 12.5 REWARD (Claimable)    │  │
│  │   APR: 8.5%                           │  │
│  │   [Claim] [Compound] [Unstake]        │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌── Available Pools ────────────────────┐  │
│  │ Pool    | APR    | TVL     | Action   │  │
│  │ ETH     | 5.2%   | $10M    | [Stake]  │  │
│  │ USDC    | 3.8%   | $25M    | [Stake]  │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌── Stake Modal ────────────────────────┐  │
│  │ Pool: ETH Staking                     │  │
│  │ Amount: [______] [MAX]                │  │
│  │ Balance: 10.0 ETH                     │  │
│  │ APR: 5.2%                             │  │
│  │ Daily Limit: 1.5/10 ETH used          │  │
│  │ [Stake]                               │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**컴포넌트**:
- `components/defi/staking/StakingPoolCard.tsx`
- `components/defi/staking/StakingPositionCard.tsx`
- `components/defi/staking/StakeModal.tsx`
- `components/defi/staking/UnstakeModal.tsx`

### 5. Lending 페이지

**파일**: `app/defi/lend/page.tsx` (신규)

**레이아웃**:
```
┌─────────────────────────────────────────────┐
│  Lending                         [< DeFi]   │
│                                              │
│  ┌── Health Factor ──────────────────────┐  │
│  │ ██████████████░░░░  1.85x             │  │
│  │ Safe (>1.5)  |  At Risk (<1.2)        │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌── Your Positions ─────────────────────┐  │
│  │ Supplied:                             │  │
│  │   1,000 USDC ($1,000) | APY 3.2%     │  │
│  │   [Withdraw]                          │  │
│  │                                       │  │
│  │ Borrowed:                             │  │
│  │   0.3 ETH ($600) | APY 4.5%          │  │
│  │   [Repay]                             │  │
│  │                                       │  │
│  │ Net APY: +1.2%                        │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌── Available Markets ──────────────────┐  │
│  │ Asset  | Supply APY | Borrow APY      │  │
│  │ ETH    | 2.1%       | 4.5%           │  │
│  │ USDC   | 3.2%       | 5.1%           │  │
│  │ [Supply] [Borrow]                    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**컴포넌트**:
- `components/defi/lending/HealthFactorCard.tsx` - 건전성 비율 게이지
- `components/defi/lending/LendingPositionCard.tsx` - 포지션 요약
- `components/defi/lending/LendingMarketCard.tsx` - 시장 목록
- `components/defi/lending/SupplyModal.tsx` - 공급 모달
- `components/defi/lending/BorrowModal.tsx` - 대출 모달
- `components/defi/lending/WithdrawModal.tsx` - 인출 모달
- `components/defi/lending/RepayModal.tsx` - 상환 모달

### 6. DeFi 허브 네비게이션 확장

**파일**: `app/defi/page.tsx`

**현재**: Swap, Pool 2개 카드
**추가**: Staking, Lending 카드

```tsx
// 기존 네비게이션 카드에 추가
{ title: 'Staking', description: 'Earn rewards by staking tokens', href: '/defi/stake', icon: '⚡' }
{ title: 'Lending', description: 'Supply & borrow assets', href: '/defi/lend', icon: '🏦' }
```

### 7. 사이드바 DeFi 서브메뉴

**현재 DeFi 메뉴**: `/defi` 단일 항목
**추가**: 서브 항목 펼침
```
DeFi
 ├── Swap     (/defi/swap)
 ├── Pool     (/defi/pool)
 ├── Staking  (/defi/stake)   ← 신규
 └── Lending  (/defi/lend)    ← 신규
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `types/defi.ts` | **신규** - Staking/Lending 타입 |
| `hooks/useStaking.ts` | **신규** - Staking 훅 |
| `hooks/useLending.ts` | **신규** - Lending 훅 |
| `app/defi/stake/page.tsx` | **신규** - Staking 페이지 |
| `app/defi/lend/page.tsx` | **신규** - Lending 페이지 |
| `app/defi/page.tsx` | Staking/Lending 네비게이션 카드 추가 |
| `components/defi/staking/*.tsx` | **신규** - Staking 컴포넌트 4개 |
| `components/defi/lending/*.tsx` | **신규** - Lending 컴포넌트 7개 |
| `components/layout/Sidebar.tsx` | DeFi 서브메뉴 추가 |
| `hooks/index.ts` | 새 훅 export |

## SDK 참조

### Plugin Exports (packages/sdk-ts/plugins/defi/)
```typescript
// Staking
encodeStakingExecutorInitData(config: StakingExecutorInitData): Hex
// config: { maxStakePerPool: bigint, dailyStakeLimit: bigint }

// Lending
encodeLendingExecutorInitData(config: LendingExecutorInitData): Hex
// config: { maxLtv: number, minHealthFactor: bigint, dailyBorrowLimit: bigint }

// Health Factor
encodeHealthFactorHookInitData(config: HealthFactorHookInitData): Hex
// config: { minHealthFactor: bigint }

// Utilities
calculateHealthFactor(collateral: bigint, debt: bigint, threshold: number): bigint
isLiquidatable(healthFactor: bigint): boolean
calculateMinOutput(amount: bigint, slippageBps: number): bigint
calculateFee(amount: bigint, feeBps: number): bigint
```

### 상수
```typescript
DEFAULTS = {
  MAX_SLIPPAGE_BPS: 100,           // 1%
  DAILY_LIMIT: 10n * 10n**18n,     // 10 ETH
  MAX_LTV: 8000,                   // 80%
  MIN_HEALTH_FACTOR: 12n * 10n**17n, // 1.2
}

SCALE = {
  BPS: 10000,
  WAD: 10n**18n,
  RAY: 10n**27n,
}

MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
}
```

### 컨트랙트 주소 (chain 8283)
```typescript
import { getLendingPool, getStakingVault, getPriceOracle } from '@stablenet/contracts'

const lendingPool = getLendingPool(8283)
const stakingVault = getStakingVault(8283)
const priceOracle = getPriceOracle(8283)
```

## 전제 조건
- Smart Account 활성화 필요 (ERC-7579 모듈 사용)
- Staking Executor 모듈 설치 필요 (Marketplace에서)
- Lending Executor 모듈 설치 필요
- Health Factor Hook 설치 권장 (대출 안전성)
- 페이지 진입 시 모듈 설치 여부 확인 → 미설치시 안내 배너
