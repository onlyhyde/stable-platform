# 03. DeFi

## 03-A. DeFi Hub

**Source**: `app/defi/page.tsx`
**Route**: `/defi`

### UI 구성
- PageHeader + DefiNavigationCards (Swap, Lend, Pool, Stake)
- DefiStatsCards: TVL, 24h Volume, Your Positions

### 데이터 흐름
```
Hooks:
  - usePools() → pools (TVL 계산용)
Computed:
  - totalValueLocked = pools.reduce(sum TVL)
  - volume24h = '$0.00' (하드코딩, indexer 미연동)
  - yourPositions = pools.length
```

### Issue Checklist

- [x] `volume24h` 하드코딩 `'$0.00'` — "Coming soon" 표시로 변경
- [x] `yourPositions`가 풀 수를 표시하지 유저 실제 포지션 수가 아님 — `positions.length` 사용
- [x] pool 정보 표기. pool 을 클릭하여 swap/유동성 제공 — Available Pools 카드 + Swap/Add Liquidity 링크 추가

---

## 03-B. Swap

**Source**: `app/defi/swap/page.tsx`
**Route**: `/defi/swap`

### UI 구성
- PaymasterSelector (sponsor/erc20 가스 결제)
- SwapCard: 토큰 선택, 금액 입력, 슬리피지, 견적 표시, Swap 버튼

### 데이터 흐름
```
Hooks:
  - useWallet() → address, isConnected
  - useSwap() → quote, getQuote(), executeSwap()
  - usePaymaster() → checkSponsorshipEligibility(), getSupportedTokens()
  - useTokens() → 토큰 목록
  - useUserOp() → sendUserOp

State:
  - tokenIn, tokenOut, amountIn, slippage (0.5 default)
  - gasMode, gasTokenAddress, gasSponsored, supportedTokens

Effects:
  - mount: checkSponsorshipEligibility(address)
  - gasMode === 'erc20': getSupportedTokens()
```

### Issue Checklist

- [ ] `handleSwap()` catch에서 `error?.message`를 hook state에서 가져옴 — catch 블록의 실제 err 사용 필요
- [ ] `checkSponsorshipEligibility()` abort controller 없음 — address 빠르게 변경 시 이전 요청이 새 결과 덮어쓸 수 있음
- [ ] `getSupportedTokens()` 실패 시 에러 UI 없음 — 로딩 상태 무한 표시
- [ ] slippage 범위 검증 없음 (0-100) — 사용자가 100% 이상 입력 가능
- [ ] `gasSponsored` 상태가 gasMode 변경 시 초기화 안됨 — stale 값 유지

---

## 03-C. Lending

**Source**: `app/defi/lend/page.tsx`
**Route**: `/defi/lend`

### 전제 조건
- Lending Executor 모듈 설치 필요

### UI 구성
- Module Installation Banner (미설치 시 경고)
- HealthFactorCard: 건전성 지표 progress bar (safe/caution/at-risk/liquidatable)
- Account Summary: Borrow Limit, Total Borrowed, Min Health Factor
- Your Positions: Supplied / Borrowed 목록 (APY, Withdraw/Repay 버튼)
- Action Form: Supply/Withdraw/Borrow/Repay 모달
- Markets Table: 전체 시장 목록 (utilization bar)

### 데이터 흐름
```
Hooks:
  - useLending() → markets, positions, accountConfig, healthFactor
    - executorInstalled flag
    - supply(), withdraw(), borrow(), repay()

State:
  - actionMode: null | 'supply' | 'withdraw' | 'borrow' | 'repay'
  - selectedAsset, amount
```

### Issue Checklist

- [ ] `markets.find(...)!` non-null assertion — market 미발견 시 크래시. fallback 필요
- [ ] `handleAction()` switch에 default case 없음 — 인식 안 되는 mode에서 결과 null인데 성공 toast 표시
- [ ] `positions`가 항상 빈 배열 반환 (indexer 미연동) — UI에 "Coming soon" 표시 또는 실제 데이터 연동 필요
- [ ] supply/borrow 실행 전 잔고 검증 없음 — 온체인 실패 전에 클라이언트 검증 필요
- [ ] Lending Executor 주소 하드코딩 — 환경 변수 또는 contract addresses에서 가져와야 함
- [ ] executor 설치 상태가 페이지 로드 이후 변경되면 반영 안됨 — 폴링 또는 이벤트 기반 업데이트 필요
- [ ] WAD 상수 (`1e18`) 페이지와 hook에서 중복 정의 — 공유 상수로 통합 필요

---

## 03-D. Pool

**Source**: `app/defi/pool/page.tsx`
**Route**: `/defi/pool`

### UI 구성
- YourPositionsCard: LP 포지션 목록 (Remove 버튼)
- AvailablePoolsCard: 유동성 추가 가능한 풀 목록
- AddLiquidityModal: token0/token1 금액 입력 → 승인 → 제출

### 데이터 흐름
```
Hooks:
  - usePools() → pools, positions
  - usePoolLiquidity() → addLiquidity(), removeLiquidity(), step, error

State:
  - selectedPool, isAddLiquidityOpen
```

### Issue Checklist

- [ ] `handleRemoveLiquidity()` 풀 검색 후 null guard 없음 — position 데이터 불일치 시 크래시
- [ ] `addLiquidity` 전 token0/token1 잔고 검증 없음 — 승인 성공 후 실제 트랜잭션 실패 가능
- [ ] `usePoolLiquidity.ensureAllowance()`가 EOA 패턴 (`walletClient.sendTransaction()`) 사용 — Smart Account UserOp 패턴과 불일치
- [ ] 모달 실패 시 상태 leak — 실패 상태가 다음 모달 열기에 유지됨. 모달 열 때 step/error 초기화 필요
- [ ] 슬리피지 표시/조정 UI 없음 — 기본 50bps가 묵시적 적용

---

## 03-E. Staking

**Source**: `app/defi/stake/page.tsx`
**Route**: `/defi/stake`

### 전제 조건
- Staking Executor 모듈 설치 필요

### UI 구성
- Module Installation Banner
- Account Config: Daily Limit, Used Today, Status
- Your Positions: 스테이킹 포지션 목록 (Claim/Compound/Unstake)
- Unstake Modal: 금액 입력 + MAX
- Available Pools: APR, TVL, Min/Max 표시
- Stake Form: 금액 입력 + Stake 버튼

### 데이터 흐름
```
Hooks:
  - useStaking() → pools, positions, accountConfig
    - executorInstalled flag
    - stake(), unstake(), claimRewards(), compoundRewards()

State:
  - selectedPool, stakeAmount, unstakePool, unstakeAmount
```

### Issue Checklist

- [ ] `positions.find(...)` null guard 없음 — position 미발견 시 destructuring 크래시
- [ ] `handleStake()`/`handleUnstake()` min/max 범위 검증 없음 — 풀의 minStake, maxStake 미체크
- [ ] 스테이킹 전 토큰 잔고 검증 없음 — 클라이언트 사전 검증 필요
- [ ] `claimRewards()`/`compoundRewards()` 실패 시 에러 toast 없음 — hook error만 설정되고 사용자 피드백 없음
- [ ] 풀 선택 후 스테이킹 실패 시 상태 미초기화 — selectedPool과 stakeAmount 유지
- [ ] Staking Executor 주소 하드코딩 — 환경 변수로 이동 필요
- [ ] Unstake MAX 클릭 시 포맷된 문자열 재파싱 — 부동소수점 정밀도 손실 가능
