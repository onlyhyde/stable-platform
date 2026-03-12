# 07. Subscription

## 07-A. Subscription Dashboard

**Source**: `app/subscription/page.tsx`
**Route**: `/subscription`

### UI 구성
- Header + "Browse Plans" 버튼
- Stats (3개): Active Subscriptions, Upcoming Payments, Total Spent
- 2-column: Active Subscriptions 리스트 + Payment History
- Quick Actions: Browse Plans, Merchant Dashboard

### 데이터 흐름
```
Hooks:
  - useWallet() → isConnected, address
  - useSubscription() → mySubscriptions[], isLoading, isCancelling, error
    - loadMySubscriptions(), cancelSubscription()

Computed:
  - totalSpent = sum(subscriptions with lastPaymentTime > 0)
  - activeCount = filter(status === 'active' || 'trial')
```

### Issue Checklist

- [v] `mySubscriptions[0]?.plan.tokenDecimals` — 배열 길이 0일 때 undefined 접근 가능
- [v] `paymentHistory` 하드코딩 빈 배열 — "In production..." 주석만 있고 구현 없음
- [v] `cancelSubscription()` 전 error 초기화 안됨 — 이전 에러 메시지 잔존
- [v] cancel 후 `loadMySubscriptions()` await 없이 `finally` 실행 — 데이터 갱신 전 UI 업데이트

---

## 07-B. Plans

**Source**: `app/subscription/plans/page.tsx`
**Route**: `/subscription/plans`

### UI 구성
- Header + "My Subscriptions" 버튼
- Info banner (ERC-7715 보안)
- Plans grid (responsive 1→2→3 col, 중간 featured)
- PermissionModal (구독 확인)

### 데이터 흐름
```
Hooks:
  - useSubscription() → plans[], subscribe(), loadPlans(), loadMySubscriptions()

State:
  - selectedPlan, isModalOpen

Effect:
  - mount: loadPlans() + (isConnected ? loadMySubscriptions() : skip)

Computed:
  - subscribedPlanIds = Set(mySubscriptions.map(s => s.planId))
```

### Issue Checklist

- [v] Effect dependency에 `loadMySubscriptions` 누락 — exhaustive-deps rule 위반
- [v] `handleConfirmSubscribe()` — `loadMySubscriptions()` await 없이 모달 즉시 닫힘
- [v] `subscribe()` 에러 catch 없음 — 구독 실패 시 사용자 피드백 없이 모달 닫힘
- [v] `featured={index === 1}` — 플랜 수 변경 시 깨짐. featured 플래그 기반으로 변경 필요

---

## 07-C. Merchant Dashboard

**Source**: `app/subscription/merchant/page.tsx`
**Route**: `/subscription/merchant`

- 지갑 연결 guard → `<MerchantDashboard />` 컴포넌트 렌더
- 실제 로직은 MerchantDashboard 내부에 있음 — 별도 검토 필요
