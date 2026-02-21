# Task 1: DeFi Pool 유동성 로직 구현

## 선행 작업 요약
> 첫 번째 작업이므로 선행 작업 없음.

---

## 현재 상태

### 완성된 부분
- Pool 페이지 레이아웃 (`app/defi/pool/page.tsx`)
- AddLiquidityModal UI (토큰 입력, 풀 지분 계산, 검증)
- AvailablePoolsCard 테이블 UI
- YourPositionsCard 포지션 표시 UI
- `usePools` 훅 스켈레톤
- Pool, LiquidityPosition 타입 정의 (`types/index.ts`)

### 미구현 부분
1. **`usePools` 훅**: `fetchPools` 콜백 비어있음 - 풀 데이터 소스 없음
2. **`handleSubmitLiquidity`**: toast만 표시, 실제 온체인 호출 없음
3. **`handleRemoveLiquidity`**: toast만 표시, 실제 온체인 호출 없음
4. **ERC-20 Approval**: 유동성 추가 전 토큰 승인 플로우 없음
5. **Slippage/Deadline**: 모달에 슬리피지 입력 없음

---

## 구현 계획

### 1. usePools 훅 완성

**파일**: `apps/web/hooks/usePools.ts`

**필요 기능**:
- Order Router API (`http://localhost:8087`)에서 풀 목록 조회
- 사용자 LP 포지션 조회
- TVL, APR 계산

**참조 패턴**: `useSwap.ts`가 동일한 Order Router를 사용
```
getServiceUrls(chainId) → orderRouterUrl
fetch(`${orderRouterUrl}/pools`) → Pool[]
fetch(`${orderRouterUrl}/positions/${address}`) → LiquidityPosition[]
```

**구현 항목**:
- `fetchPools()`: 전체 풀 목록 + TVL/APR
- `fetchPositions(address)`: 사용자 LP 포지션
- `refetch()`: 수동 리프레시
- 에러/로딩 상태 관리

### 2. AddLiquidity 트랜잭션 로직

**파일**: `components/defi/cards/AddLiquidityModal.tsx`

**트랜잭션 플로우**:
1. ERC-20 토큰 approve (Router에 대한 allowance 확인)
2. Uniswap V2 Router `addLiquidity()` 호출

**Uniswap V2 Router ABI** (사용할 함수):
```solidity
function addLiquidity(
  address tokenA, address tokenB,
  uint amountADesired, uint amountBDesired,
  uint amountAMin, uint amountBMin,
  address to, uint deadline
) external returns (uint amountA, uint amountB, uint liquidity);
```

**Router 주소**: `getUniswapRouter(chainId)` from `@stablenet/contracts`

**구현 순서**:
1. `useUserOp.sendUserOp()`으로 approve calldata 전송
2. approve 확인 후 `addLiquidity` calldata 전송
3. 또는 BatchBuilder로 approve + addLiquidity 원자적 실행

**Slippage 계산**:
```typescript
const amountAMin = amountA * (10000n - slippageBps) / 10000n
const amountBMin = amountB * (10000n - slippageBps) / 10000n
const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30분
```

### 3. RemoveLiquidity 트랜잭션 로직

**파일**: `components/defi/cards/YourPositionsCard.tsx` (또는 별도 모달)

**Uniswap V2 Router ABI**:
```solidity
function removeLiquidity(
  address tokenA, address tokenB,
  uint liquidity,
  uint amountAMin, uint amountBMin,
  address to, uint deadline
) external returns (uint amountA, uint amountB);
```

**구현 순서**:
1. LP 토큰 approve (Router에 대한 allowance)
2. `removeLiquidity` 호출
3. 잔액 업데이트

### 4. UI 개선

**AddLiquidityModal에 추가**:
- 슬리피지 설정 (0.1%, 0.5%, 1.0% 프리셋 + 커스텀)
- 트랜잭션 진행 상태 표시 (approve → add liquidity → confirmed)
- 에러 메시지 표시

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hooks/usePools.ts` | fetchPools/fetchPositions 구현 |
| `components/defi/cards/AddLiquidityModal.tsx` | 트랜잭션 로직 + 슬리피지 UI |
| `components/defi/cards/YourPositionsCard.tsx` | Remove 버튼 핸들러 구현 |
| `components/defi/cards/AvailablePoolsCard.tsx` | 풀 데이터 연동 확인 |
| `app/defi/pool/page.tsx` | 훅 연결 확인 |

## 참조 코드

### useSwap.ts 패턴 (동일한 서비스 구조)
```typescript
// lib/config/env.ts에서 서비스 URL 가져오기
const { orderRouterUrl } = getServiceUrls(chainId)

// encodeFunctionData로 calldata 생성
import { encodeFunctionData } from 'viem'
const calldata = encodeFunctionData({
  abi: UNISWAP_V2_ROUTER_ABI,
  functionName: 'addLiquidity',
  args: [tokenA, tokenB, amountA, amountB, amountAMin, amountBMin, to, deadline]
})

// useUserOp으로 트랜잭션 전송
const { sendUserOp } = useUserOp()
await sendUserOp({ target: routerAddress, data: calldata, value: 0n })
```

### 컨트랙트 주소 참조
```typescript
import { getUniswapRouter, getChainAddresses } from '@stablenet/contracts'
const router = getUniswapRouter(chainId) // Uniswap V2 Router
```

## 타입 정의 (이미 존재)
```typescript
// types/index.ts
interface Pool {
  address: Address; token0: Token; token1: Token;
  reserve0: bigint; reserve1: bigint;
  fee: number; tvl: number; apr: number;
}

interface LiquidityPosition {
  poolAddress: Address; token0: Token; token1: Token;
  liquidity: bigint; token0Amount: bigint; token1Amount: bigint;
  shareOfPool: number;
}
```
