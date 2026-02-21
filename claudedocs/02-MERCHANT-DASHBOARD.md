# Task 2: Merchant Dashboard 완성

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools 훅에 Order Router API 연동, AddLiquidityModal에 Uniswap V2 Router addLiquidity/removeLiquidity 온체인 호출 구현, 슬리피지 설정 UI 추가. useUserOp + encodeFunctionData 패턴 사용.

---

## 현재 상태

### 완성된 부분
- MerchantDashboard 컴포넌트 (4탭: Overview, Plans, Webhooks, API Keys)
- SubscriptionPlansCard - 플랜 카드 표시, 생성 모달
- MerchantStatsCards - 4개 통계 카드 (매출, 구독수, 결제, 평균값)
- WebhookSettingsCard - 엔드포인트 관리 (localStorage)
- ApiKeysCard - API 키 생성/해지 (localStorage)
- useSubscription 훅 - 온체인 플랜 CRUD, 구독 관리
- types/subscription.ts - 전체 타입 정의

### 미구현/문제 부분
1. **PaymentAnalyticsCard**: 차트 데이터 소스 없음 (빈 상태)
2. **RecentTransactionsCard**: 트랜잭션 데이터 소스 없음 (빈 상태)
3. **MerchantStatsCards**: 변화율(%) 항상 0 (이전 기간 데이터 없음)
4. **Plan Update/Toggle**: 컨트랙트 미지원으로 info toast만 표시
5. **Webhook/API Keys**: localStorage 전용 (서버 미연동)
6. **토큰 지원 제한**: USDC, ETH만 하드코딩 (USDT, DAI UI에만 존재)

---

## 구현 계획

### 1. PaymentAnalyticsCard 데이터 연동

**파일**: `components/merchant/cards/PaymentAnalyticsCard.tsx`

**현재**: 빈 `payments` 배열, 빈 차트

**구현 방향**: 온체인 이벤트 기반 데이터 수집
- SubscriptionManager 컨트랙트의 `PaymentProcessed` 이벤트 조회
- `publicClient.getLogs()` 사용하여 결제 이벤트 수집
- 기간별(7d/30d/90d) 필터링 적용
- 일별 집계로 차트 데이터 생성

```typescript
// 이벤트 시그니처 (SubscriptionManager 컨트랙트)
event PaymentProcessed(uint256 indexed planId, address indexed subscriber, uint256 amount, uint256 timestamp)
event SubscriptionCreated(uint256 indexed planId, address indexed subscriber)
event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber)
```

**대안** (인덱서 없는 경우):
- `getBlockNumber()` → 기간에 해당하는 블록 범위 계산
- `getLogs({ fromBlock, toBlock, address, event })` 사용
- 클라이언트 사이드에서 일별 집계

### 2. RecentTransactionsCard 데이터 연동

**파일**: `components/merchant/cards/RecentTransactionsCard.tsx`

**현재**: 빈 `transactions` 배열

**구현 방향**:
- 동일하게 `PaymentProcessed` 이벤트 조회 (최근 20건)
- 트랜잭션 해시, 구독자 주소, 금액, 시간 표시
- 블록 탐색기 링크 연결

### 3. MerchantStatsCards 실시간 통계

**파일**: `components/merchant/cards/MerchantStatsCards.tsx`

**현재**: `merchantStats`에서 기본 통계만 표시, 변화율 0%

**구현**:
- 이전 기간 대비 변화율 계산 (현재 30일 vs 이전 30일)
- `PaymentProcessed` 이벤트에서 성공/실패 구분
- 평균 트랜잭션 값 = 총 결제액 / 결제 건수

### 4. Plan Update/Toggle 기능

**현재**: "Plan updates not yet supported" toast

**구현 방향**:
- 컨트랙트에 `updatePlan`, `togglePlan` 함수 없는 경우:
  - UI에서 "Coming Soon" 상태로 명확히 표시
  - 또는 새 플랜 생성 + 기존 플랜 비활성화 워크플로우
- 컨트랙트가 지원하는 경우:
  - `useSubscription` 훅에 `updatePlan()`, `togglePlan()` 추가

### 5. Webhook/API Key 서버 연동

**현재**: localStorage만 사용

**구현 옵션 A** (로컬 환경, 추천):
- localStorage 유지하되 UI/UX 개선
- "Local Only" 배지 표시
- 데이터 export/import 기능

**구현 옵션 B** (향후 서버 연동):
- API 엔드포인트 필요: `POST /api/webhooks`, `GET /api/webhooks`, etc.
- 현재는 옵션 A로 진행

### 6. useSubscriptionEvents 신규 훅

**파일**: `hooks/useSubscriptionEvents.ts` (신규)

**목적**: PaymentAnalyticsCard, RecentTransactionsCard에 데이터 제공

```typescript
interface UseSubscriptionEventsReturn {
  payments: PaymentEvent[]
  subscriptionEvents: SubscriptionEvent[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface PaymentEvent {
  planId: bigint
  subscriber: Address
  amount: bigint
  timestamp: bigint
  txHash: Hex
  blockNumber: bigint
}
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hooks/useSubscriptionEvents.ts` | **신규** - 이벤트 로그 조회 훅 |
| `components/merchant/cards/PaymentAnalyticsCard.tsx` | 이벤트 데이터 연동, 차트 렌더링 |
| `components/merchant/cards/RecentTransactionsCard.tsx` | 이벤트 데이터 연동, 트랜잭션 목록 |
| `components/merchant/cards/MerchantStatsCards.tsx` | 실시간 통계 + 변화율 |
| `components/merchant/MerchantDashboard.tsx` | 신규 훅 연결, 데이터 전달 |
| `components/merchant/cards/SubscriptionPlansCard.tsx` | Plan toggle UI 개선 |

## 컨트랙트 참조

```typescript
// 주소
subscriptionManager: '0x9d4454B023096f34B160D6B654540c56A1F81688'
permissionManager: '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf'
recurringPaymentExecutor: '0x998abeb3E57409262aE5b751f60747921B33613E'

// 토큰
USDC: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44'
ETH: '0x0000000000000000000000000000000000000000'

// ABI 함수 (useSubscription.ts에 이미 정의)
- planCount() → uint256
- plans(planId) → Plan
- getMerchantPlans(merchant) → uint256[]
- createPlan(name, desc, price, interval, token, trial, grace)
- subscribe(planId, permissionId)
- cancelSubscription(planId)
```
