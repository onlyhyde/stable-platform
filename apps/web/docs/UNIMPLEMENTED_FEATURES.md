# 미구현 기능 검토 보고서

> 검토일: 2026-02-11 (4차 검토 완료), 2026-02-12 (5차~7차 검토 완료)
> 설계 검증: 2026-02-12 (6건 논리적 오류 정정 완료)
> 7차 검토: 2026-02-12 (`services/`, `packages/`, `apps/wallet-extension/` 추가)
> 대상: `apps/web`, `services/`, `packages/`, `apps/wallet-extension/`
> 8차 검토: 2026-02-12 (논리적 오류 정정 + 누락 항목 5건 추가)
> 9차 검토: 2026-02-12 (EIP/ERC 표준 준수 검토 — ERC-721/1155 Token Receiver 누락 1건 추가, packages 심각도 분류 오류 정정)
> 10차 검토: 2026-02-12 (과잉 추가 항목 정리 — §73 EIP-7484 삭제: 프로젝트 미참조 표준)
> 11차 검토: 2026-02-13 (코드 대조 검증 — 6건 구현 완료 확인, RESOLVED 처리 + 부분 정정 2건)
> 총 미구현 항목: ~~128건~~ → **122건** (apps/web ~~89건~~ 83건 + packages ~~15건~~ 14건 + services 15건 + wallet-extension 9건 + RESOLVED 6건)
> ⚠️ 11차 검토에서 §1-1, §5-1, §6, §33, §34 (5개 섹션, 6건)가 이미 구현 완료로 확인되어 RESOLVED 처리됨

---

## 목차

1. [요약](#요약)
2. [CRITICAL - Swap 실행 불가](#1-swap-실행-불가)
3. [HIGH - Merchant Dashboard](#2-merchant-dashboard)
4. [HIGH - Data Hooks 데이터 소스 미연결](#3-data-hooks-데이터-소스-미연결)
5. [HIGH - Overview 페이지 하드코딩 통계](#4-overview-페이지-하드코딩-통계)
6. [HIGH - ERC-20 Token Approval 미구현](#5-erc-20-token-approval-미구현)
7. [HIGH - Session Key 생성 Placeholder](#6-session-key-생성-placeholder)
8. [MEDIUM - Security Settings](#7-security-settings)
9. [MEDIUM - Subscription 편집 기능](#8-subscription-편집-기능)
10. [MEDIUM - DeFi Pool Liquidity](#9-defi-pool-liquidity)
11. [MEDIUM - QR Code](#10-qr-code)
12. [MEDIUM - Enterprise Payroll](#11-enterprise-payroll)
13. [MEDIUM - Enterprise Expenses](#12-enterprise-expenses)
14. [MEDIUM - 컴포넌트 미연결 콜백들](#13-컴포넌트-미연결-콜백들)
15. [MEDIUM - 하드코딩된 네트워크 URL](#14-하드코딩된-네트워크-url)
16. [MEDIUM - Stealth Withdraw 미연결](#15-stealth-withdraw-미연결)
17. [MEDIUM - ErrorBoundary 미적용](#16-errorboundary-미적용)
18. [MEDIUM - Toast 피드백 미활용](#17-toast-피드백-미활용)
19. [MEDIUM - Account Settings 미구현](#18-account-settings-미구현)
20. [MEDIUM - Swap UI 미완성](#19-swap-ui-미완성)
21. [MEDIUM - 모바일 반응형 미구현](#20-모바일-반응형-미구현)
22. [MEDIUM - Header 계정 드롭다운 미구현](#21-header-계정-드롭다운-미구현)
23. [MEDIUM - 페이지네이션 없음](#22-페이지네이션-없음)
24. [MEDIUM - 미지원 네트워크 경고 UI 없음](#23-미지원-네트워크-경고-ui-없음)
25. [MEDIUM - UserOp 확인 timeout 후 재확인 수단 없음](#24-userop-확인-timeout-후-재확인-수단-없음)
26. [LOW - Send 폼 잔액 초과 검증 없음](#25-send-폼-잔액-초과-검증-없음)
27. [LOW - Next.js 라우트 파일 부재](#26-nextjs-라우트-파일-부재)
28. [LOW - Recurring Payment Placeholder ID](#27-recurring-payment-placeholder-id)
29. [LOW - Subscription Revenue 계산](#28-subscription-revenue-계산)
30. [LOW - Marketplace 하드코딩 카탈로그](#29-marketplace-하드코딩-카탈로그)
31. [LOW - Payroll YTD](#30-payroll-ytd)
32. [LOW - 인프라 및 설정 하드코딩](#31-인프라-및-설정-하드코딩)
33. [LOW - Footer 잘못된 링크](#32-footer-잘못된-링크)
34. [HIGH - Stealth Send Announcement 미호출](#33-stealth-send-announcement-미호출)
35. [MEDIUM - Indexer URL 미노출](#34-indexer-url-미노출)

---

## 요약

| 우선순위 | 영역 | 문제 수 | 핵심 문제 |
|----------|------|---------|-----------|
| **CRITICAL** | **Swap 실행 불가** | ~~3~~ **2** | ~~sendUserOp 미전달~~, Order Router localhost 하드코딩 *(§1-1 RESOLVED)* |
| HIGH | Merchant Dashboard | 12 | 전체 mock 데이터, 모든 핸들러 빈 함수 |
| HIGH | Data Hooks | 6 | usePools, usePayroll, useExpenses, useAuditLogs, useTokens, useTransactionHistory 데이터 소스 미연결 |
| HIGH | Overview 페이지 통계 | 5 | stealth, enterprise, defi, subscription, dashboard 통계 하드코딩 |
| HIGH | Token Approval | ~~2~~ **1** | ~~Swap~~/Subscription에서 ERC-20 approve 미처리 *(§5-1 RESOLVED)* |
| ~~HIGH~~ | ~~Session Key~~ | ~~1~~ **0** | ~~생성 시 랜덤 주소만, 실제 키페어 아님~~ *(§6 RESOLVED — 실제 secp256k1 키페어 생성 구현 완료)* |
| MEDIUM | Security Settings | 4 | Toggle/Button 동작 안 함 |
| MEDIUM | Subscription Edit | 3 | Edit/Deactivate 버튼 미구현 |
| MEDIUM | DeFi Pool | 2 | Add/Remove Liquidity 콜백 미연결 |
| MEDIUM | QR Code | 1 | 실제 QR 생성 미구현 |
| MEDIUM | Enterprise Payroll | 3 | Process Payments, Export Report, Add Employee 미연결 |
| MEDIUM | Enterprise Expenses | 1 | Submit Expense 콜백 미연결 |
| MEDIUM | 컴포넌트 미연결 콜백 | 6 | SessionKey Detail, Subscription Manage, Expense approve/reject, Payroll Edit, Module Uninstall |
| MEDIUM | 하드코딩 네트워크 URL | 2 | Etherscan URL 네트워크별 미분기 |
| MEDIUM | Stealth Withdraw | 1 | onWithdraw 콜백 미전달, 인출 불가 |
| MEDIUM | ErrorBoundary | 2 | 구현됨, `app/layout.tsx`에 전역 적용 but 개별 페이지 미적용 *(정정)* |
| MEDIUM | Toast 피드백 | 4 | 대부분 페이지에서 성공/실패 피드백 없음 |
| MEDIUM | Account Settings | 3 | 계정 이름 저장 안 됨, Smart Account 정보 하드코딩, 복사 피드백 없음 |
| MEDIUM | Swap UI | 3 | 잔액 하드코딩, 슬리피지 설정 없음, Gas 하드코딩 |
| MEDIUM | 모바일 반응형 | 3 | 햄버거 메뉴 없음, sidebar 고정, 모바일 네트워크/잔액 숨김 |
| MEDIUM | Header 계정 | 1 | 계정 버튼 클릭 시 즉시 disconnect (드롭다운 없음) |
| MEDIUM | 페이지네이션 | 2 | Payment history, Audit logs 페이지네이션 없음 |
| MEDIUM | 미지원 네트워크 경고 | 1 | 미지원 체인 전환 시 사용자 경고 UI 없음 |
| MEDIUM | UserOp 확인 timeout | 1 | 30초 polling 후 재확인/재시도 수단 없음 |
| LOW | Send 폼 잔액 검증 | 1 | amount > 0만 체크, 잔액 초과 검증 없음 |
| LOW | Next.js 라우트 파일 | 3 | loading.tsx, error.tsx, not-found.tsx 없음 |
| LOW | Recurring Payment | 1 | Placeholder scheduleId |
| LOW | Subscription Revenue | 2 | Revenue 계산 미구현 |
| LOW | Marketplace Catalog | 1 | 하드코딩된 모듈 목록 |
| LOW | Payroll YTD | 1 | YTD 총액 항상 0 |
| LOW | 인프라/설정 하드코딩 | 5 | wagmi RPC, moduleAddresses devnet, constants deprecated, docs placeholder |
| LOW | Footer 링크 | 4 | 8개 미존재 페이지 링크 + 3개 소셜 placeholder URL |
| ~~HIGH~~ | ~~Stealth Announcement~~ | ~~1~~ **0** | ~~sendToStealthAddress에서 ERC-5564 on-chain announcement 미호출~~ *(§33 RESOLVED — stealthAnnouncer 컨트랙트 호출 구현 완료)* |
| ~~MEDIUM~~ | ~~Indexer URL~~ | ~~2~~ **0** | ~~ServiceUrls 타입 + StableNetContext에 indexerUrl 미포함~~ *(§34 RESOLVED — 양쪽 모두 indexerUrl 포함 확인)* |
| **합계** | | ~~89~~ **83** | *(6건 RESOLVED)* |

---

## 1. Swap 실행 불가

**심각도: CRITICAL** *(4차 검토 추가)*

~~Swap 페이지의 토큰 교환 기능이 전혀 동작하지 않음. 3가지 연쇄 문제로 인해 전체 Swap 플로우가 불가능.~~ → 2건 잔존 (Order Router URL/Address 하드코딩).

### ~~1-1. sendUserOp 미전달~~ ✅ RESOLVED (11차 검토 확인)

> **11차 검토 (2026-02-13):** 코드 검증 결과, `app/defi/swap/page.tsx:14-17`에서 `useSwap({ sendUserOp, orderRouterUrl: process.env.NEXT_PUBLIC_ORDER_ROUTER_URL || '...' })` 형태로 config를 정상 전달하고 있음. `sendUserOp`이 `useUserOp` hook에서 가져와 전달됨. 이 항목은 문서 작성 이후 수정 완료됨.

### 1-2. Order Router URL 하드코딩

**파일:** `hooks/useSwap.ts:61`

```typescript
const DEFAULT_ORDER_ROUTER_URL = 'http://localhost:4340'
```

Quote 요청 URL이 `localhost:4340`으로 하드코딩. 로컬 개발 환경이 아니면 quote 조회 자체가 실패.
환경변수(`NEXT_PUBLIC_ORDER_ROUTER_URL` 등)로 분리 필요.

### 1-3. Router Address 하드코딩

**파일:** `hooks/useSwap.ts:62`

```typescript
const DEFAULT_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address
```

Uniswap V2 Router 주소가 Ethereum mainnet 주소로 하드코딩. StableNet 체인에서는 해당 주소에 컨트랙트가 없음.

### 해결 방안

- ~~`useUserOp` hook의 **`sendUserOp`** (raw function)을 `useSwap` config로 전달~~ ✅ 구현 완료
- Order Router URL을 환경변수(`NEXT_PUBLIC_ORDER_ROUTER_URL`)로 분리 (기본값 fallback은 존재하나 localhost 하드코딩)
- Router address를 네트워크별로 분기 또는 환경변수로 관리

---

## 2. Merchant Dashboard

**심각도: HIGH**
**파일:** `components/merchant/MerchantDashboard.tsx`

### 1-1. 전체 Mock 데이터 사용

대시보드 전체가 하드코딩된 가짜 데이터로 구성되어 있으며, API 연동이 전혀 되어 있지 않음.

```
라인 99: // Mock data - in real app, these would come from API
```

| 라인 | 항목 | 설명 |
|------|------|------|
| 100-109 | `MerchantStats` | 하드코딩된 통계 숫자 (매출, 구독수, 성공률 등) |
| 111-120 | `PaymentData[]` | `Math.random()`으로 생성된 30일 차트 데이터 |
| 122-153 | `Transaction[]` | 하드코딩된 3건의 거래 내역 |
| 155-180 | `SubscriptionPlan[]` | 하드코딩된 2개 플랜 (Basic, Pro) |
| 182-192 | `WebhookEndpoint[]` | 하드코딩된 1개 웹훅 |
| 194-203 | `ApiKey[]` | 하드코딩된 1개 API 키 |

### 1-2. 빈 핸들러 함수 (9건 TODO)

모든 CRUD 핸들러가 TODO 주석만 있고 구현이 없음.

| 라인 | 함수명 | TODO 내용 |
|------|--------|-----------|
| 209 | `handleCreatePlan` | `// TODO: API call to create plan` |
| 213 | `handleUpdatePlan` | `// TODO: API call to update plan` |
| 217 | `handleTogglePlan` | `// TODO: API call to toggle plan` |
| 221 | `handleAddWebhook` | `// TODO: API call to add webhook` |
| 225 | `handleDeleteWebhook` | `// TODO: API call to delete webhook` |
| 229 | `handleToggleWebhook` | `// TODO: API call to toggle webhook` |
| 233 | `handleRegenerateSecret` | 하드코딩 반환: `'whsec_new_secret_xyz'` |
| 238 | `handleCreateApiKey` | 하드코딩 반환: `'sk_live_new_key_abc123...'` |
| 243 | `handleRevokeApiKey` | `// TODO: API call to revoke API key` |

### 1-3. console.log 플레이스홀더 (2건)

| 라인 | 코드 | 설명 |
|------|------|------|
| 286 | `onViewAll={() => console.log('View all transactions')}` | 전체 거래 내역 보기 미구현 |
| 287 | `onRetry={async (id) => console.log('Retry:', id)}` | 거래 재시도 미구현 |

### 해결 방안

- Merchant API 서비스 구축 또는 `useSubscription` hook의 merchant 기능 활용
- 각 핸들러를 실제 컨트랙트 호출 또는 API 호출로 교체
- Mock 데이터를 실제 데이터 fetch로 교체

---

## 3. Data Hooks 데이터 소스 미연결

**심각도: HIGH**

아래 hooks는 `fetchXxx` 콜백을 외부에서 주입받는 DI 패턴이지만, 실제 페이지에서 콜백을 전달하지 않아 데이터가 항상 비어있음.

### 2-1. usePools

**파일:** `hooks/usePools.ts`

```typescript
// hooks/usePools.ts:24-28
const refresh = useCallback(async () => {
  if (!fetchPools) {     // fetchPools가 없으면
    setIsLoading(false)  // 즉시 로딩 종료
    return               // 빈 배열 유지
  }
```

**사용처:** `app/defi/pool/page.tsx:12`
```typescript
const { pools, isLoading, error } = usePools()  // fetchPools 미제공
```

**결과:** 풀 목록이 항상 빈 배열 → "No liquidity pools" 빈 화면

### 2-2. usePayroll

**파일:** `hooks/usePayroll.ts`

```typescript
// hooks/usePayroll.ts:32-36
const refresh = useCallback(async () => {
  if (!fetchPayroll) {
    setIsLoading(false)
    return
  }
```

**사용처:** `app/enterprise/payroll/page.tsx:16`
```typescript
const { payrollEntries, summary, isLoading, error } = usePayroll()  // fetchPayroll 미제공
```

**결과:** 직원 목록 항상 비어있음

### 2-3. useExpenses

**파일:** `hooks/useExpenses.ts`

```typescript
// hooks/useExpenses.ts:31-35
const refresh = useCallback(async () => {
  if (!fetchExpenses) {
    setIsLoading(false)
    return
  }
```

**결과:** 경비 목록 항상 비어있음

### 2-4. useAuditLogs

**파일:** `hooks/useAuditLogs.ts`

```typescript
// hooks/useAuditLogs.ts:32-36
const refresh = useCallback(async () => {
  if (!fetchLogs) {
    setIsLoading(false)
    return
  }
```

**결과:** 감사 로그 항상 비어있음

### 2-5. useTokens *(2차 검토 추가)*

**파일:** `hooks/useTokens.ts`

동일한 DI 패턴으로 `fetchTokens` 콜백이 주입되지 않으면 토큰 목록이 항상 빈 배열.

**결과:** 토큰 밸런스 표시 안 됨

### 2-6. useTransactionHistory *(2차 검토 추가)*

**파일:** `hooks/useTransactionHistory.ts`

동일한 DI 패턴으로 `fetchTransactions` 콜백이 주입되지 않으면 트랜잭션 내역 항상 빈 배열.

**결과:** 트랜잭션 히스토리 빈 화면

### 해결 방안

- 각 hook에 실제 컨트랙트 read 함수 또는 indexer API fetch 함수를 구현하여 전달
- 또는 hook 내부에서 직접 데이터 소스에 연결하도록 리팩터링

---

## 4. Overview 페이지 하드코딩 통계

**심각도: HIGH** *(2차 검토 추가)*

각 기능 영역의 Overview/Landing 페이지에서 통계 카드가 모두 하드코딩된 0 또는 "-"로 표시됨.

### 3-1. Stealth Overview

**파일:** `app/stealth/page.tsx:29`

```tsx
<StealthStatsCards addressesUsed={0} pendingAnnouncements={0} totalReceived="0 ETH" />
```

`useStealth` hook에서 실제 데이터를 가져오지 않고 하드코딩된 0 값 전달.

### 3-2. Enterprise Overview

**파일:** `app/enterprise/page.tsx:124-154`

4개의 통계 카드 모두 하드코딩:
| 라인 | 항목 | 하드코딩 값 |
|------|------|-------------|
| 124 | Total Payroll | $0.00 |
| 134 | Active Employees | 0 |
| 144 | Pending Expenses | 0 |
| 154 | Compliance Score | 100% |

### 3-3. DeFi Overview

**파일:** `app/defi/page.tsx:13`

```tsx
<DefiStatsCards totalValueLocked="$0.00" volume24h="$0.00" yourPositions={0} />
```

TVL, 24시간 거래량, 사용자 포지션 수 모두 하드코딩.

### 3-4. Subscription Overview

**파일:** `app/subscription/page.tsx`

- 라인 34: `const [paymentHistory] = useState<PaymentHistoryEntry[]>([])` — mock 빈 배열
- 라인 212: "Total Spent" 항상 `"-"` 표시
- Active Subscriptions 통계는 hook에서 가져오지만, 지불 내역/총 지출은 미구현

### 3-5. Dashboard (메인 페이지)

**파일:** `app/page.tsx`

- `_addToken` 콜백이 선언만 되고 사용되지 않음 (변수명에 `_` prefix)
- Activity 섹션이 하드코딩된 빈 상태

### 해결 방안

- 각 Overview 페이지에서 해당 hook(useStealth, usePayroll, useExpenses 등)의 실제 데이터를 연결
- 통계 계산 로직을 hook 또는 유틸 함수로 구현
- Dashboard 메인 페이지에 실제 활동 내역 연동

---

## 5. ERC-20 Token Approval 미구현

**심각도: HIGH** *(4차 검토 추가)*

### ~~5-1. Swap 시 Token Approval 누락~~ ✅ RESOLVED (11차 검토 확인)

> **11차 검토 (2026-02-13):** 코드 검증 결과, `hooks/useSwap.ts:216-241`에서 `executeSwap` 함수가 ERC-20 토큰 swap 전 `allowance()` 조회 및 부족 시 `approve()` UserOp을 선행 실행하도록 구현 완료됨. `ERC20_ABI`도 hook 내에 정의되어 있음 (lines 68-89).

### 5-2. Subscription 시 Token Approval 누락

**파일:** `hooks/useSubscription.ts`

Subscription 생성의 두 경로 모두 ERC-20 approve가 없음:
- **Primary (ERC-7715 `wallet_grantPermissions`)**: 컨트랙트 실행 **권한 부여**이지, ERC-20 `approve()`가 아님
- **Fallback (PermissionManager `grantPermission`)**: 권한 레코드 등록이지, 토큰 approve가 아님

⚠️ ERC-7715 permission과 ERC-20 approval은 완전히 다른 개념. ERC-7715는 "누가 무엇을 실행할 수 있는가"의 권한이고, ERC-20 approve는 "누가 얼마만큼 토큰을 전송할 수 있는가"의 허용량. 양쪽 경로 모두 토큰 transfer 메커니즘이 구현에서 빠져있음.

### 해결 방안

- ~~swap 실행 전 `allowance()` 조회 후 부족 시 `approve()` 트랜잭션 선행~~ ✅ 구현 완료
- subscription의 경우 PermissionManager/recurringPaymentExecutor가 실제로 토큰을 transfer하는 메커니즘 확인 필요 (현재 구현에 토큰 transfer 로직 부재)

---

## ~~6. Session Key 생성 Placeholder~~ ✅ RESOLVED (11차 검토 확인)

~~**심각도: HIGH**~~ *(4차 검토 추가)*
**파일:** `hooks/useSessionKey.ts:381-387`

> **11차 검토 (2026-02-13):** 코드 검증 결과, 실제 secp256k1 키페어 생성이 구현 완료됨.
>
> ```typescript
> // 현재 코드 (구현 완료):
> const privateKey = generatePrivateKey()
> const account = privateKeyToAccount(privateKey)
> const sessionKey = account.address
> secureKeyStore.store(privateKey)
> ```
>
> viem의 `generatePrivateKey()` + `privateKeyToAccount()`로 실제 키페어를 생성하고, `secureKeyStore`에 개인키를 안전하게 저장함. 이 항목은 문서 작성 이후 수정 완료됨.

---

## 7. Security Settings

**심각도: MEDIUM**
**파일:** `components/settings/cards/SecuritySettingsCard.tsx`

### 4-1. Toggle 스위치 (로컬 state만 변경)

| 라인 | 항목 | 문제 |
|------|------|------|
| 16 | `sessionKeyEnabled` toggle | `useState(false)`만 변경, 설정 저장/적용 없음 |
| 17 | `txConfirmation` toggle | `useState(true)`만 변경, 설정 저장/적용 없음 |

페이지 새로고침 시 기본값으로 초기화됨.

### 4-2. "Update Limits" 버튼 미구현

```
라인 63: <Button variant="secondary">Update Limits</Button>
```

- Daily ETH Limit, Daily Token Limit 입력 필드는 존재
- 버튼에 `onClick` 핸들러 없음 → 클릭해도 아무 동작 안 함

### 4-3. Recovery Options "Setup" 버튼 미구현

```
라인 76-78:
<RecoveryOption icon={<EmailIcon />} title="Email Recovery" status="Not configured" />
<RecoveryOption icon={<SocialIcon />} title="Social Recovery" status="Not configured" />
```

라인 119에서 렌더링되는 "Setup" 버튼에 `onClick` 핸들러 없음.

### 해결 방안

- Toggle 상태를 localStorage 또는 스마트 컨트랙트에 저장
- Spending Limits 연동 시 **두 시스템 간 관계 정리 필요**:
  - ① `useSessionKey.ts`의 SessionKeyManager `spendingLimit` (세션 키별 한도)
  - ② `lib/moduleAddresses.ts`의 ERC-7579 Spending Limit Hook 모듈 (계정 전체 한도)
  - Security Settings UI가 어느 시스템과 연동할지 결정 필요 (또는 양쪽 모두)
- Recovery는 Social Recovery 모듈(`lib/moduleAddresses.ts`에 주소 존재) 설치 플로우와 연결
  - 단, 현재 모듈 설치(`useModule`)만 가능하고 복구 트리거(guardian 추가, 복구 실행) 전용 UI/로직 별도 구현 필요

---

## 8. Subscription 편집 기능

**심각도: MEDIUM**

### 5-1. SubscriptionPlansCard Edit 버튼

**파일:** `components/merchant/cards/SubscriptionPlansCard.tsx:217-219`

```typescript
onClick={() => {
  /* TODO: Edit modal */
}}
```

Edit 버튼 클릭 시 아무 동작 없음. 편집 모달 구현 필요.

### 5-2. Merchant Plan Row 버튼들

**파일:** `app/subscription/merchant/page.tsx:350-356`

```tsx
<Button variant="ghost" size="sm">Edit</Button>
<Button variant="ghost" size="sm">{plan.isActive ? 'Deactivate' : 'Activate'}</Button>
```

두 버튼 모두 `onClick` 핸들러 자체가 없음.

### 5-3. Subscription Plans 페이지 지갑 연결 분기 미완성 *(2차 검토 추가)*

**파일:** `app/subscription/plans/page.tsx:40-43`

지갑 미연결 시 fallback UI가 불완전함. 연결 유도 플로우 필요.

### 해결 방안

- Edit 모달 컴포넌트 추가 (CreatePlanForm과 유사한 구조)
- Deactivate/Activate는 `useSubscription` hook에 togglePlan 함수 추가
- 지갑 미연결 시 연결 유도 UI 완성

---

## 9. DeFi Pool Liquidity

**심각도: MEDIUM**

### 6-1. Add Liquidity 콜백 미연결

**파일:** `components/defi/cards/AddLiquidityModal.tsx`

모달 UI는 완성되어 있지만, `app/defi/pool/page.tsx:68`에서 `onSubmit` prop을 전달하지 않음.

```tsx
// pool/page.tsx
<AddLiquidityModal
  isOpen={isAddLiquidityOpen}
  onClose={handleCloseModal}
  selectedPool={selectedPool}
  // onSubmit 미전달 → Add Liquidity 버튼 클릭 시 early return
/>
```

### 6-2. Your Positions 데이터 미연결

**파일:** `components/defi/cards/YourPositionsCard.tsx`

```tsx
// pool/page.tsx:64
<YourPositionsCard />  // positions, onRemoveLiquidity 미전달
```

- `positions` 기본값이 빈 배열 → 항상 "No liquidity positions yet" 표시
- `onRemoveLiquidity` 미전달 → Remove 버튼 동작 안 함

### 해결 방안

- 유동성 풀 컨트랙트(Uniswap V2 Router 등)와 연동하는 addLiquidity/removeLiquidity 함수 구현
- 사용자 포지션 조회 로직 구현

---

## 10. QR Code

**심각도: MEDIUM**
**파일:** `app/payment/receive/page.tsx:47-70`

```tsx
{/* QR Code Placeholder */}
<div className="w-48 h-48 border-2 rounded-2xl flex items-center justify-center">
  {/* SVG 아이콘만 표시 */}
  <p className="text-xs mt-2">QR Code</p>
</div>
```

실제 QR 코드 생성 라이브러리(qrcode.react 등)가 연동되지 않음. 지갑 주소를 담은 QR 코드를 보여줘야 하지만 현재는 정적 아이콘만 표시.

### 해결 방안

- `qrcode.react` 또는 `next-qrcode` 패키지 설치
- address를 인코딩한 QR 코드 렌더링

---

## 11. Enterprise Payroll

**심각도: MEDIUM**

### 8-1. Quick Actions 버튼 미연결

**파일:** `components/enterprise/cards/PayrollQuickActionsCard.tsx`

```typescript
interface PayrollQuickActionsCardProps {
  onProcessPayments?: () => void   // optional
  onExportReport?: () => void      // optional
}
```

**사용처:** `app/enterprise/payroll/page.tsx:78`
```tsx
<PayrollQuickActionsCard />  // 두 prop 모두 미전달
```

- "Process All Payments" 버튼 → 클릭해도 아무 동작 안 함
- "Export Report" 버튼 → 클릭해도 아무 동작 안 함

### 8-2. Add Employee 콜백 미연결

**파일:** `app/enterprise/payroll/page.tsx:80`
```tsx
<AddEmployeeModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
// onSubmit 미전달
```

모달의 form validation은 구현되어 있지만, `onSubmit`을 전달하지 않아 "Add Employee" 버튼 클릭 시 `onSubmit?.(formData)` → undefined → 아무 동작 안 함.

### 해결 방안

- Recurring Payment 컨트랙트를 통한 급여 지급 플로우 구현
- CSV/PDF export 기능 구현
- 직원 추가를 recurring payment schedule 생성으로 연결

---

## 12. Enterprise Expenses

**심각도: MEDIUM**
**파일:** `components/enterprise/cards/SubmitExpenseModal.tsx`

모달 UI와 form validation은 완성되어 있지만, expenses 페이지에서 `onSubmit` 콜백 연결이 필요.

### 해결 방안

- Expense 생성을 on-chain 또는 off-chain 저장소에 기록하는 로직 구현

---

## 13. 컴포넌트 미연결 콜백들

**심각도: MEDIUM** *(2차 검토 추가)*

여러 컴포넌트에서 버튼/액션은 존재하지만, 콜백이 optional로 선언되어 전달되지 않거나, 핸들러가 비어있음.

### 10-1. SessionKeyList "View Details" 모달 미구현

**파일:** `components/session-keys/SessionKeyList.tsx`

- "View Details" 버튼 클릭 시 state를 설정하지만, 상세 정보 모달이 구현되어 있지 않음
- 선택된 세션 키의 상세 정보를 볼 수 없음

### 10-2. SubscriptionList "Manage" 버튼 미구현

**파일:** `components/subscription/SubscriptionList.tsx`

- "Manage" 버튼에 `onManage` 콜백이 optional로 선언
- 부모 컴포넌트에서 콜백을 전달하지 않아 클릭 시 아무 동작 없음

### 10-3. ExpenseListCard approve/reject/pay 콜백 미연결

**파일:** `components/enterprise/cards/ExpenseListCard.tsx`

- `onApprove`, `onReject`, `onPay` 모두 optional 콜백
- 확인 다이얼로그 없이 바로 호출되는 구조
- 부모에서 콜백 미전달 시 버튼 클릭해도 아무 동작 없음

### 10-4. PayrollListCard "Edit" 버튼 미연결

**파일:** `components/enterprise/cards/PayrollListCard.tsx`

- `onEdit` 콜백이 optional로 선언
- Payroll 페이지에서 해당 prop을 전달하지 않아 Edit 버튼 동작 안 함

### 10-5. ModuleDetailModal 모듈 삭제 기능 미구현

**파일:** `components/marketplace/ModuleDetailModal.tsx`

- 모듈 설치(Install)는 구현되어 있으나, 이미 설치된 모듈을 제거(Uninstall)하는 기능 없음
- 모듈 관리 페이지에서 제거 동작 불가

### 10-6. IncomingPaymentsCard 상세 보기 미구현

**파일:** `components/payment/IncomingPaymentsCard.tsx`

- `handleViewDetails` 콜백을 받지만, 실제 상세 정보 모달/페이지가 구현되지 않음

### 해결 방안

- SessionKey 상세 모달 구현 (permissions, expiry, usage 정보 표시)
- Subscription Manage 플로우 구현 (해지, 일시정지, 플랜 변경)
- Expense approve/reject을 실제 트랜잭션으로 연결
- Module uninstall 기능 추가 (`useModule` hook에 uninstall 함수 추가)

---

## 14. 하드코딩된 네트워크 URL

**심각도: MEDIUM** *(2차 검토 추가)*

### 11-1. PaymentHistory Etherscan URL

**파일:** `components/payment/PaymentHistory.tsx`

Etherscan URL이 하드코딩되어 있어, StableNet 또는 다른 네트워크에서 올바른 block explorer 링크를 제공하지 못함.

### 11-2. AuditLogCard Etherscan URL

**파일:** `components/enterprise/cards/AuditLogCard.tsx`

동일하게 Etherscan URL이 하드코딩되어 있음. 현재 연결된 chain에 따라 동적으로 explorer URL을 결정해야 함.

### 해결 방안

- `useChainInfo` hook 또는 wagmi의 chain config에서 block explorer URL을 동적으로 가져오도록 수정
- `getBlockExplorerUrl(chainId)` 유틸 함수 구현

---

## 15. Stealth Withdraw 미연결

**심각도: MEDIUM** *(3차 검토 추가)*
**파일:** `app/stealth/receive/page.tsx:53-57`

```tsx
<IncomingPaymentsCard
  announcements={announcements}
  isScanning={isScanning}
  onScan={handleScan}
  // onWithdraw 미전달!
/>
```

IncomingPaymentsCard에 `onWithdraw` 콜백이 전달되지 않음. Withdraw 버튼 UI는 존재하지만(`components/stealth/cards/IncomingPaymentsCard.tsx:138`), 클릭 시 `onWithdraw`가 undefined이므로 아무 동작 안 함.

스텔스 주소로 받은 자금을 실제로 인출할 수 없음.

### 해결 방안

- `useStealth` hook에 withdraw 함수 추가 — 단순 "자금 이동"이 아닌 ERC-5564 프로토콜 준수 필요:
  1. Announcement에서 ephemeral public key 복원
  2. Viewing private key + ephemeral pubkey로 **spending key 파생** (ECDH)
  3. 파생된 spending key로 트랜잭션 **서명**
  4. Stealth address에서 메인 지갑으로 자금 transfer
- `@stablenet/plugin-stealth`의 crypto 함수(`packages/sdk-ts/plugins/stealth/src/crypto/stealth.ts`) 활용
- receive 페이지에서 `onWithdraw` 콜백 전달

---

## 16. ErrorBoundary 미적용

**심각도: MEDIUM** *(3차 검토 추가)*

### 13-1. ErrorBoundary 컴포넌트 구현 완료, 사용처 1건 *(11차 검토 정정)*

**파일:** `components/error/ErrorBoundary.tsx`

- `ErrorBoundary` 클래스 컴포넌트 완전 구현
- `withErrorBoundary` HOC까지 제공
- `ErrorFallback` UI도 완성

~~하지만 `app/` 디렉토리 전체에서 **단 한 곳도 사용하지 않음**.~~ → **정정:** `app/layout.tsx`에서 전역 ErrorBoundary로 1곳 사용 중. 단, 개별 트랜잭션 페이지에는 미적용되어 세분화된 에러 처리가 부족함.

### 13-2. 적용 필요 페이지

| 페이지 | 이유 |
|--------|------|
| `app/payment/send/page.tsx` | 트랜잭션 실행 중 에러 가능 |
| `app/smart-account/page.tsx` | 컨트랙트 호출 에러 가능 |
| `app/defi/swap/page.tsx` | DEX 트랜잭션 에러 가능 |
| `app/stealth/send/page.tsx` | 스텔스 트랜잭션 에러 가능 |
| `app/subscription/page.tsx` | 구독 관련 컨트랙트 에러 가능 |

### 해결 방안

- ~~또는 `app/layout.tsx`에 전역 ErrorBoundary 추가~~ ✅ 이미 적용됨
- 트랜잭션 관련 페이지에 개별 `ErrorBoundary` 래핑 추가 적용
- `withErrorBoundary` HOC를 high-risk 컴포넌트에 적용

---

## 17. Toast 피드백 미활용

**심각도: MEDIUM** *(3차 검토 추가)*

### 14-1. Toast 시스템 구현됨, 사용처 2곳만

**파일:** `components/common/Toast.tsx`

Toast 시스템(success/error/info/loading)은 완전히 구현되어 있으나, `useToast()`를 사용하는 곳이 단 2곳:
- `app/marketplace/page.tsx`
- `app/smart-account/page.tsx`

### 14-2. Toast 미사용 페이지

| 페이지 | 누락된 피드백 |
|--------|-------------|
| `app/payment/send/page.tsx` | 전송 성공/실패 시 toast 없음 (router.push만 수행) |
| `app/enterprise/payroll/page.tsx` | 급여 처리/직원 추가 성공 피드백 없음 |
| `app/enterprise/expenses/page.tsx` | 경비 제출 성공 피드백 없음 |
| `app/settings/page.tsx` | 설정 변경 피드백 없음 |

### 해결 방안

- 모든 폼 제출/트랜잭션 후 `useToast()`로 성공/실패 알림 추가
- 트랜잭션 pending → confirmed 상태 전환 시 toast 업데이트

---

## 18. Account Settings 미구현

**심각도: MEDIUM** *(3차 검토 추가)*
**파일:** `components/settings/cards/AccountSettingsCard.tsx`

### 15-1. 계정 이름 저장 안 됨

```typescript
// 라인 17
const [accountName, setAccountName] = useState('My Account')
```

- Account Name 입력 필드에서 이름을 변경할 수 있지만, 저장 버튼이 없음
- 페이지 새로고침 시 항상 "My Account"로 초기화
- localStorage나 다른 영속 저장소에 저장하지 않음

### 15-2. Smart Account 정보 하드코딩

```typescript
// 라인 158-173
Deployment Status → 항상 "Deployed"
Modules → 항상 "ECDSA Validator"
```

- 실제 스마트 계정의 배포 상태를 확인하지 않음 (미배포 상태에서도 "Deployed" 표시)
- 설치된 모듈 목록을 조회하지 않음 (항상 "ECDSA Validator" 고정)

### 15-3. 주소 복사 피드백 없음

```typescript
// 라인 23-26
const copyAddress = () => {
  if (address) {
    navigator.clipboard.writeText(address)
    // 피드백 없음! (receive 페이지는 "Copied!" 표시함)
  }
}
```

- `app/payment/receive/page.tsx`에서는 `copyToClipboard()` + `setCopied(true)`로 "Copied!" 피드백 제공
- 하지만 Settings의 복사 버튼은 피드백 없이 조용히 복사됨

### 해결 방안

- accountName을 localStorage에 저장 + 저장 버튼 또는 자동 저장(debounce) 구현
- 배포 상태: `useSmartAccount` hook에서 조회 가능 (`isSmartAccount`, `implementation`)
- 설치된 모듈: `useModule.isModuleInstalled()`로 개별 모듈별 확인 필요 (현재 "전체 모듈 목록 조회" 함수 부재 — 구현 필요)
- 복사 시 toast 또는 "Copied!" 피드백 추가 (receive 페이지 패턴 참조)

---

## 19. Swap UI 미완성

**심각도: MEDIUM** *(4차 검토 추가)*

### 19-1. SwapCard 잔액 하드코딩

**파일:** `components/defi/cards/SwapCard.tsx:57-58, 125-126`

```tsx
// 라인 57-58 (tokenIn 잔액)
<span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
  Balance: 0.00
</span>

// 라인 125-126 (tokenOut 잔액)
<span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
  Balance: 0.00
</span>
```

tokenIn, tokenOut 모두 잔액이 `"0.00"`으로 하드코딩. `SwapCard` 컴포넌트가 잔액 prop을 받지 않으며, `SwapCardProps` 인터페이스(라인 7-21)에도 balance 관련 필드가 없음.

### 19-2. 슬리피지 설정 UI 없음

**파일:** `hooks/useSwap.ts:63`

```typescript
const DEFAULT_SLIPPAGE = 0.5 // 0.5%
```

슬리피지가 0.5%로 고정. `SwapCard` 컴포넌트에 슬리피지 조절 UI(기어 아이콘, 설정 팝오버 등)가 없음. 사용자가 값을 변경할 방법이 없음.

### 19-3. Gas Fee "Sponsored" 하드코딩

**파일:** `components/defi/cards/SwapCard.tsx:176`

```tsx
<span style={{ color: 'rgb(var(--foreground))' }}>Sponsored</span>
```

Gas Fee가 조건 없이 항상 `"Sponsored"`로 표시. Paymaster 사용 가능 여부를 확인하지 않음.

### 해결 방안

- `SwapCardProps`에 `balanceIn`, `balanceOut` prop 추가 후 실제 잔액 조회
- 슬리피지 설정 UI 추가 (0.1%, 0.5%, 1.0% 프리셋 + 커스텀 입력)
- Paymaster 상태에 따라 가스비 표시 동적 전환

---

## 20. 모바일 반응형 미구현

**심각도: MEDIUM** *(4차 검토 추가)*

### 20-1. 햄버거 메뉴 없음

**파일:** `components/layout/Header.tsx`

Header 컴포넌트 전체에 모바일용 햄버거 메뉴 버튼이 없음. 작은 화면에서 Sidebar에 접근할 방법이 없음.

### 20-2. Sidebar 고정 레이아웃

**파일:** `app/layout.tsx:85, 89`

```tsx
// 라인 85
<main className="flex-1 ml-64 min-h-[calc(100vh-4rem)]">

// 라인 89
<div className="ml-64">
  <Footer />
</div>
```

`ml-64`(256px 좌측 마진)가 반응형 분기(`md:ml-64` 등) 없이 모든 화면 크기에 고정 적용됨. Sidebar도 `w-64`로 고정 너비이며 `hidden`/`block` 반응형 분기 없음.

### 20-3. 모바일에서 주요 UI 숨김

**파일:** `components/layout/Header.tsx:67, 73`

```tsx
// 라인 67 - NetworkSelector
<NetworkSelector className="hidden md:flex" />

// 라인 73 - Balance 영역
<div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl" ...>
```

`NetworkSelector`는 768px 미만에서 숨김. Balance는 640px 미만에서 숨김. 이를 대체하는 모바일 UI가 없음.

### 해결 방안

- Header에 모바일용 햄버거 메뉴 토글 버튼 추가 (`md:hidden`)
- 모바일용 drawer/sheet 방식 Sidebar 구현
- `ml-64`를 `md:ml-64`로 변경
- 모바일 drawer에 네트워크/잔액 정보 표시

---

## 21. Header 계정 드롭다운 미구현

**심각도: MEDIUM** *(4차 검토 추가)*

**파일:** `components/layout/Header.tsx:91-127`

```tsx
<button
  type="button"
  onClick={() => disconnect()}  // 클릭 시 즉시 disconnect!
  className="flex items-center gap-2 px-3 py-2 rounded-xl ..."
>
  <div className="w-7 h-7 rounded-full bg-gradient-to-br ..." />
  <div className="flex flex-col items-start">
    <span className="text-sm font-semibold">{formatAddress(address)}</span>
    <span className="text-2xs">Connected</span>
  </div>
</button>
```

계정 버튼의 `onClick`이 `disconnect()`를 직접 호출. 드롭다운 메뉴 없이 즉시 지갑 연결 해제됨.

**누락된 기능:**
- 주소 복사 (Copy Address)
- 설정 페이지 이동 (Settings)
- 지갑 전환 (Switch Wallet)
- 연결 해제 확인 dialog (Disconnect confirmation)

### 해결 방안

- 계정 버튼 클릭 시 드롭다운 메뉴 표시 (Copy Address, View on Explorer, Settings, Disconnect)
- Disconnect에 확인 dialog 추가
- `useRef` + `useState`로 드롭다운 열림/닫힘 관리 (NetworkSelector 패턴 참조)

---

## 22. 페이지네이션 없음

**심각도: MEDIUM** *(4차 검토 추가)*

### 22-1. Payment History

**파일:** `app/payment/history/page.tsx:76-80`

```tsx
<div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
  {transactions.map((tx) => (
    <TransactionItem key={tx.hash} transaction={tx} />
  ))}
</div>
```

`transactions` 배열 전체를 `map`으로 렌더링. 페이지네이션, 무한 스크롤, 건수 제한이 없음.

### 22-2. Enterprise Audit Logs

**파일:** `app/enterprise/audit/page.tsx:129`

```tsx
<AuditLogCard logs={filteredLogs} />
```

`filteredLogs` 전체를 전달. 클라이언트 사이드 검색 필터링은 있으나 페이지 분할 없음.

### 해결 방안

- 공통 페이지네이션 컴포넌트 구현 (page/pageSize state + slice 렌더링)
- 또는 무한 스크롤 (`IntersectionObserver` 기반)
- 한 페이지당 20-50건 제한

---

## 23. 미지원 네트워크 경고 UI 없음

**심각도: MEDIUM** *(5차 검토 추가)*

**파일:** `components/common/NetworkSelector.tsx`, `hooks/useWalletNetworks.ts`

`chainChanged` 이벤트 핸들러(`hooks/useWalletNetworks.ts:152-154`)는 구현되어 있지만, 체인 변경 시 `fetchWalletNetworks()`만 호출할 뿐 미지원 체인 여부를 검증하지 않음:

```typescript
// hooks/useWalletNetworks.ts:152-154
const handleChainChanged = () => {
  fetchWalletNetworks()
}
```

사용자가 MetaMask 등에서 직접 미지원 체인으로 전환하면:
- `NetworkSelector`에 "Unknown Network"만 표시
- 경고 배너/모달이 없어 사용자가 왜 기능이 동작하지 않는지 알 수 없음
- 미지원 체인 상태에서 트랜잭션 시도 시 암호화된 에러 메시지만 발생

### 해결 방안

- `app/layout.tsx` 또는 Header 하단에 미지원 체인 경고 배너 추가
- 배너에 "Switch to StableNet" 원클릭 전환 버튼 포함
- `useWalletNetworks`에 `isUnsupportedChain` 상태 추가

---

## 24. UserOp 확인 timeout 후 재확인 수단 없음

**심각도: MEDIUM** *(5차 검토 추가)*

**파일:** `hooks/useUserOp.ts:78-111`

```typescript
const waitForUserOpReceipt = useCallback(
  async (
    userOpHash: Hex,
    maxAttempts = 15,
    intervalMs = 2000
  ): Promise<{ transactionHash: Hex; success: boolean } | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      // ... polling logic ...
    }
    return null  // 30초 후 null 반환
  },
  [bundlerUrl]
)
```

15회 × 2초 = 30초간 polling 후 `null` 반환 시 status가 `'submitted'`로 설정됨. Send 페이지에서 `router.push('/payment/history?pending=true')`로 이동하지만:
- Payment History에서 `?pending=true` 쿼리 파라미터를 처리하는 로직 없음
- `userOpHash`가 저장/전달되지 않아 재확인 불가
- 네트워크 혼잡 시 사용자는 트랜잭션 성공/실패 확인 불가

### 해결 방안

- Pending 트랜잭션 목록 표시 (localStorage에 `userOpHash` + 타임스탬프 저장)
- Payment History에서 pending 트랜잭션의 백그라운드 polling 또는 "재확인" 버튼 제공
- Block explorer 링크 제공 (`userOpHash`로 조회)

---

## 25. Send 폼 잔액 초과 검증 없음

**심각도: LOW** *(5차 검토 추가)*

**파일:** `app/payment/send/page.tsx:31-33`

```typescript
const isValidRecipient = recipient === '' || isAddress(recipient)
const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)
const canSend = isAddress(recipient) && Number(amount) > 0 && isConnected && address
```

`balance`를 조회하여 화면에 표시하지만(라인 24-29), 입력된 `amount`가 잔액을 초과하는지 검증하지 않음:
- 잔액 0.1 ETH일 때 100 ETH 입력 가능
- "Send" 버튼 활성화되어 온체인 트랜잭션 시도 → 실패
- "MAX" 버튼(라인 176-184)은 존재하지만 초과 입력 사전 경고 없음

### 해결 방안

- `canSend` 조건에 잔액 초과 검증 추가:
  ```typescript
  const amountBigInt = parseUnits(amount || '0', decimals)
  const canSend = isAddress(recipient) && Number(amount) > 0 && amountBigInt <= balance && isConnected && address
  ```
- 잔액 초과 시 `"Insufficient balance"` 에러 메시지 표시
- "Send" 버튼 비활성화로 불필요한 온체인 트랜잭션 방지

---

## 26. Next.js 라우트 파일 부재

**심각도: LOW** *(3차 검토 추가)*

### 26-1. loading.tsx 없음

`app/` 디렉토리 전체에 `loading.tsx` 파일이 하나도 없음.
- Next.js App Router의 Streaming/Suspense 기반 로딩 UI 미활용
- 현재 각 컴포넌트에서 inline `isLoading` 체크로 처리 중
- 페이지 전환 시 스켈레톤 UI 없이 빈 화면 표시

### 26-2. error.tsx 없음

`app/` 디렉토리에 `error.tsx` 파일이 없음.
- 서버 사이드 또는 클라이언트 사이드 에러 시 기본 Next.js 에러 화면만 표시
- 사용자 친화적 에러 페이지 없음

### 26-3. not-found.tsx 없음

`app/` 디렉토리에 `not-found.tsx` 파일이 없음.
- 존재하지 않는 URL 접근 시 기본 404 화면 표시
- Footer의 잘못된 링크(/blog, /about 등) 접근 시 브랜딩된 404 페이지 없음

### 해결 방안

- `app/loading.tsx` 전역 로딩 스켈레톤 추가
- `app/error.tsx` 전역 에러 페이지 추가 (ErrorBoundary 활용)
- `app/not-found.tsx` 커스텀 404 페이지 추가
- 데이터 무거운 라우트(`/enterprise/*`, `/payment/history`)에 라우트별 `loading.tsx` 추가

---

## 27. Recurring Payment Placeholder ID

**심각도: LOW**
**파일:** `hooks/useRecurringPayment.ts:484-486`

```typescript
// For now, return a placeholder scheduleId
// In production, we'd wait for the transaction and get the actual ID from events
const scheduleId = BigInt(Date.now())
```

트랜잭션 receipt의 이벤트 로그에서 실제 scheduleId를 파싱해야 하지만, 현재는 timestamp를 대체값으로 사용.

### 해결 방안

- `publicClient.waitForTransactionReceipt()` 후 이벤트 로그에서 scheduleId 추출
- `useSubscription` hook의 `requestPermission` 함수와 동일한 패턴 적용

---

## 28. Subscription Revenue 계산

**심각도: LOW**

### 28-1. Hook 레벨

**파일:** `hooks/useSubscription.ts:459-460`
```typescript
setMerchantStats({
  ...
  totalRevenue: 0n,    // Would need to query events
  monthlyRevenue: 0n,
})
```

### 28-2. UI 레벨

**파일:** `app/subscription/merchant/page.tsx:184-185`
```tsx
<p className="text-3xl font-bold">-</p>  // Monthly Revenue 항상 '-' 표시
```

### 해결 방안

- SubscriptionManager 컨트랙트의 PaymentProcessed 이벤트 로그를 조회하여 revenue 계산
- 또는 별도 indexer/subgraph 활용

---

## 29. Marketplace 하드코딩 카탈로그

**심각도: LOW**
**파일:** `app/marketplace/page.tsx:17-146`

```typescript
/**
 * Default module catalog (PoC - served inline; production would fetch from module-registry API)
 */
const MODULE_CATALOG: ModuleCardData[] = [
  // 8개 모듈이 하드코딩
]
```

Install counts, ratings 등이 모두 고정값. 프로덕션에서는 module-registry API에서 동적으로 가져와야 함.

### 해결 방안

- Module Registry API 또는 on-chain registry 컨트랙트에서 동적 fetch
- 설치 수/평점을 실시간 조회

---

## 30. Payroll YTD

**심각도: LOW**
**파일:** `hooks/usePayroll.ts:89`

```typescript
return {
  ...
  ytdTotal: 0, // Would need historical data
}
```

Year-to-date 총 지급액이 항상 0으로 표시됨.

### 해결 방안

- 과거 트랜잭션 이벤트 로그 또는 indexer 데이터로 YTD 계산

---

## 31. 인프라 및 설정 하드코딩

**심각도: LOW** *(2차 검토 추가)*

### 31-1. wagmi 설정 하드코딩

**파일:** `lib/wagmi.ts`

- placeholder icon URL 사용
- RPC URL이 하드코딩되어 있음 (환경변수로 분리 필요)

### 31-2. moduleAddresses devnet 전용

**파일:** `lib/moduleAddresses.ts`

- 모든 모듈 주소가 devnet 전용 주소
- init data에 `'0x'` placeholder 사용
- 네트워크별 주소 분기 없음 (testnet, mainnet 미지원)

### 31-3. constants.ts deprecated 함수 사용 중

**파일:** `lib/constants.ts`

- deprecated로 표시된 상수/함수가 여전히 다른 곳에서 import되어 사용 중
- StableNet 체인 전용 토큰 목록 누락

### 31-4. docs.ts 플레이스홀더

**파일:** `lib/docs.ts`

- 전체 문서 내용이 하드코딩
- 문서 URL들이 placeholder (#, javascript:void(0) 등)
- 프로덕션에서는 CMS 또는 실제 문서 사이트 연동 필요

### 31-5. useChainInfo 미지원 체인 처리

**파일:** `hooks/useChainInfo.ts`

- 지원되지 않는 chain ID에 대해 하드코딩된 placeholder 반환
- 사용자에게 미지원 체인임을 알리는 UI 없음

### 해결 방안

- RPC URL, 컨트랙트 주소 등을 환경변수 기반으로 전환
- 네트워크별 주소 매핑 구현 (devnet, testnet, mainnet)
- deprecated 함수를 새로운 구현으로 마이그레이션
- 문서를 실제 문서 사이트 또는 CMS와 연동

---

## 32. Footer 잘못된 링크

**심각도: LOW** *(2차, 4차 검토 추가)*
**파일:** `components/layout/Footer.tsx`

### 32-1. 내부 페이지 링크 (8건)

Footer에 아래 페이지로 링크가 있으나, 해당 페이지가 실제로 존재하지 않음:

- `/blog` — 블로그 페이지 없음
- `/about` — About 페이지 없음
- `/careers` — 채용 페이지 없음
- `/contact` — 연락처 페이지 없음
- `/docs/api` — API Reference 페이지 없음 *(4차 검토 추가)*
- `/docs/tutorials` — Tutorials 페이지 없음 *(4차 검토 추가)*
- `/privacy` — 개인정보처리방침 페이지 없음 *(4차 검토 추가)*
- `/terms` — 이용약관 페이지 없음 *(4차 검토 추가)*

### 32-2. 소셜 링크 placeholder URL (3건) *(6차 검토 추가)*

**파일:** `components/layout/Footer.tsx:29-60`

```typescript
const socialLinks = [
  { name: 'GitHub', href: 'https://github.com/stablenet', ... },
  { name: 'Twitter', href: 'https://twitter.com/stablenet', ... },
  { name: 'Discord', href: 'https://discord.gg/stablenet', ... },
]
```

3개 소셜 링크 URL이 placeholder. 실제 프로젝트 계정/채널이 존재하지 않으면 404/빈 페이지로 이동.

### 해결 방안

- 내부 페이지를 실제로 구현하거나 링크 변경/제거
- `/privacy`, `/terms`는 법적 요건 상 반드시 구현 권장
- 소셜 링크를 실제 계정 URL로 교체 또는 환경변수로 분리

---

## ~~33. Stealth Send Announcement 미호출~~ ✅ RESOLVED (11차 검토 확인)

~~**심각도: HIGH**~~ *(6차 검토 추가)*
**파일:** `hooks/useStealth.ts:329-346`

> **11차 검토 (2026-02-13):** 코드 검증 결과, `sendToStealthAddress`에서 `stealthAnnouncer` 컨트랙트의 `announce()` 함수를 `encodeFunctionData`로 인코딩하여 ERC-5564 on-chain announcement를 정상 수행하고 있음 (lines 330-339에서 announce calldata 인코딩, lines 342-346에서 `stealthAnnouncer`로 트랜잭션 전송). 이 항목은 문서 작성 이후 수정 완료됨.

---

## ~~34. Indexer URL 미노출~~ ✅ RESOLVED (11차 검토 확인)

~~**심각도: MEDIUM**~~ *(6차 검토 추가)*

> **11차 검토 (2026-02-13):** 코드 검증 결과, 두 항목 모두 이미 구현 완료됨.
>
> - **34-1:** `lib/constants.ts:29`의 `ServiceUrls` 타입에 `indexer: string` 필드가 **이미 포함**되어 있음. 모든 서비스 URL 설정에서 `indexer` 필드 존재.
> - **34-2:** `providers/StableNetProvider.tsx:15`의 `StableNetContextValue`에 `indexerUrl: string`이 **이미 포함**되어 있으며, provider에서 `indexerUrl: services?.indexer ?? defaultServices.indexer`로 정상 매핑됨.
>
> 데이터 hooks가 `fetchXxx` 콜백을 외부 주입받는 DI 패턴 자체는 변경되지 않았으나, indexer URL 접근 경로는 확보된 상태.

---

## 기능별 구현 계획

> 아래는 앱이 지원하는 **모든 기능 영역별** 완성 계획.
> 각 기능이 end-to-end로 동작하도록 관련 미구현 항목을 묶어 정리.

### 0. 인프라 기반 (모든 기능의 선행 조건)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~0-1~~ | ~~`ServiceUrls` 타입에 `indexer` 추가~~ | ~~§34~~ | ✅ 구현 완료 |
| ~~0-2~~ | ~~`StableNetContext`에 `indexerUrl` 추가~~ | ~~§34~~ | ✅ 구현 완료 |
| 0-3 | RPC/컨트랙트 주소 환경변수 전환 | §31 | `lib/wagmi.ts`, `lib/moduleAddresses.ts`, `lib/constants.ts` |
| 0-4 | Block explorer URL 동적 분기 유틸 | §14 | `lib/utils.ts` (신규: `getBlockExplorerUrl()`) |
| 0-5 | ErrorBoundary 전역 + 주요 페이지 적용 | §16 | `app/layout.tsx`, 트랜잭션 관련 페이지 |
| 0-6 | Next.js `loading.tsx`, `error.tsx`, `not-found.tsx` | §26 | `app/` |
| 0-7 | Toast 피드백을 모든 폼/트랜잭션에 적용 | §17 | 전체 페이지 |
| 0-8 | 모바일 반응형 (sidebar drawer, `ml-64` → `md:ml-64`) | §20 | `app/layout.tsx`, `Header.tsx`, `Sidebar.tsx` |

### 1. Payment (Send / Receive / History)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 1-1 | Send 폼 잔액 초과 검증 | §25 | `app/payment/send/page.tsx` |
| 1-2 | UserOp receipt timeout 후 pending 트래킹 + 재확인 | §24 | `hooks/useUserOp.ts`, `app/payment/history/page.tsx` |
| 1-3 | QR Code 생성 라이브러리 연동 | §10 | `app/payment/receive/page.tsx` |
| 1-4 | Payment History 페이지네이션 | §22 | `app/payment/history/page.tsx` |
| 1-5 | `useTransactionHistory`에 indexer fetch 함수 연결 | §3-6 | `hooks/useTransactionHistory.ts` |
| 1-6 | Etherscan URL을 동적 explorer URL로 교체 | §14 | `components/payment/PaymentHistory.tsx` |

### 2. Swap (Token Exchange)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~2-1~~ | ~~`useSwap()`에 `sendUserOp` config 전달~~ | ~~§1-1~~ | ✅ 구현 완료 |
| 2-2 | Order Router URL 환경변수 분리 | §1-2 | `hooks/useSwap.ts` |
| 2-3 | Router address 네트워크별 분기 | §1-3 | `hooks/useSwap.ts` |
| ~~2-4~~ | ~~ERC-20 allowance 확인 + approve 선행~~ | ~~§5-1~~ | ✅ 구현 완료 |
| 2-5 | SwapCard 실제 잔액 표시 | §19-1 | `components/defi/cards/SwapCard.tsx` |
| 2-6 | 슬리피지 설정 UI | §19-2 | `components/defi/cards/SwapCard.tsx` |
| 2-7 | Gas Fee Paymaster 상태 연동 | §19-3 | `components/defi/cards/SwapCard.tsx` |

### 3. Stealth Address (Register / Send / Receive / Withdraw)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~3-1~~ | ~~Send 시 `stealthAnnouncer` contract 호출 (ERC-5564)~~ | ~~§33~~ | ✅ 구현 완료 |
| 3-2 | Withdraw 콜백 연결 (ECDH spending key 파생 + 서명) | §15 | `hooks/useStealth.ts`, `app/stealth/receive/page.tsx` |
| 3-3 | Stealth Overview 통계 실제 데이터 연결 | §4-1 | `app/stealth/page.tsx` |

### 4. Session Key Management

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~4-1~~ | ~~실제 secp256k1 키페어 생성 + secureKeyStore 저장~~ | ~~§6~~ | ✅ 구현 완료 |
| 4-2 | SessionKey Detail 모달 구현 | §13-1 | `components/session-keys/SessionKeyList.tsx` |

### 5. Subscription (Subscriber / Merchant)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 5-1 | ERC-20 approve 메커니즘 구현 | §5-2 | `hooks/useSubscription.ts` |
| 5-2 | Edit Plan 모달 구현 | §8-1, §8-2 | `components/merchant/cards/SubscriptionPlansCard.tsx`, `app/subscription/merchant/page.tsx` |
| 5-3 | Plan Activate/Deactivate 핸들러 연결 | §8-2 | `app/subscription/merchant/page.tsx` |
| 5-4 | Manage 버튼 콜백 (해지/일시정지/변경) | §13-2 | `components/subscription/SubscriptionList.tsx` |
| 5-5 | Merchant Revenue 계산 (이벤트 로그 조회) | §28 | `hooks/useSubscription.ts`, `app/subscription/merchant/page.tsx` |
| 5-6 | Subscription Overview Total Spent 계산 | §4-4 | `app/subscription/page.tsx` |
| 5-7 | 지갑 미연결 시 Plans 페이지 fallback UI | §8-3 | `app/subscription/plans/page.tsx` |
| 5-8 | Recurring Payment 실제 scheduleId 파싱 | §27 | `hooks/useRecurringPayment.ts` |

### 6. DeFi Pool (Liquidity)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 6-1 | `usePools`에 실제 데이터 소스 연결 | §3-1 | `hooks/usePools.ts`, `app/defi/pool/page.tsx` |
| 6-2 | Add Liquidity `onSubmit` 콜백 연결 | §9-1 | `app/defi/pool/page.tsx` |
| 6-3 | Your Positions 데이터 + Remove Liquidity | §9-2 | `app/defi/pool/page.tsx` |
| 6-4 | DeFi Overview 통계 실제 데이터 연결 | §4-3 | `app/defi/page.tsx` |

### 7. Enterprise (Payroll / Expenses / Audit)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 7-1 | `usePayroll`에 실제 데이터 소스 연결 | §3-2 | `hooks/usePayroll.ts` |
| 7-2 | `useExpenses`에 실제 데이터 소스 연결 | §3-3 | `hooks/useExpenses.ts` |
| 7-3 | `useAuditLogs`에 실제 데이터 소스 연결 | §3-4 | `hooks/useAuditLogs.ts` |
| 7-4 | Process Payments / Export Report 핸들러 | §11-1 | `app/enterprise/payroll/page.tsx` |
| 7-5 | Add Employee `onSubmit` 연결 | §11-2 | `app/enterprise/payroll/page.tsx` |
| 7-6 | Payroll Edit 콜백 연결 | §13-4 | `components/enterprise/cards/PayrollListCard.tsx` |
| 7-7 | Submit Expense `onSubmit` 연결 | §12 | `app/enterprise/expenses/page.tsx` |
| 7-8 | Expense approve/reject/pay 콜백 연결 | §13-3 | `components/enterprise/cards/ExpenseListCard.tsx` |
| 7-9 | Audit Logs 페이지네이션 | §22 | `app/enterprise/audit/page.tsx` |
| 7-10 | Audit Log Etherscan URL 동적 분기 | §14 | `components/enterprise/cards/AuditLogCard.tsx` |
| 7-11 | Enterprise Overview 통계 실제 데이터 연결 | §4-2 | `app/enterprise/page.tsx` |
| 7-12 | Payroll YTD 계산 | §30 | `hooks/usePayroll.ts` |

### 8. Smart Account & Module Management

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 8-1 | `useTokens`에 실제 데이터 소스 연결 | §3-5 | `hooks/useTokens.ts` |
| 8-2 | Module Uninstall 기능 추가 | §13-5 | `hooks/useModule.ts`, `components/marketplace/ModuleDetailModal.tsx` |
| 8-3 | Marketplace 동적 카탈로그 (module-registry API) | §29 | `app/marketplace/page.tsx` |

### 9. Merchant Dashboard

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 9-1 | Mock 데이터를 실제 API/hook으로 교체 | §2-1 | `components/merchant/MerchantDashboard.tsx` |
| 9-2 | 9개 핸들러 함수 구현 | §2-2 | `components/merchant/MerchantDashboard.tsx` |
| 9-3 | onViewAll / onRetry 콜백 구현 | §2-3 | `components/merchant/MerchantDashboard.tsx` |

### 10. Settings (Account / Security / Network)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 10-1 | 계정 이름 localStorage 저장 | §18-1 | `components/settings/cards/AccountSettingsCard.tsx` |
| 10-2 | Smart Account 배포 상태/모듈 실제 조회 | §18-2 | `components/settings/cards/AccountSettingsCard.tsx` |
| 10-3 | 주소 복사 피드백 (toast / "Copied!") | §18-3 | `components/settings/cards/AccountSettingsCard.tsx` |
| 10-4 | Security toggle 상태 저장 | §7-1 | `components/settings/cards/SecuritySettingsCard.tsx` |
| 10-5 | Update Limits `onClick` 구현 | §7-2 | `components/settings/cards/SecuritySettingsCard.tsx` |
| 10-6 | Recovery Options Setup `onClick` 구현 | §7-3 | `components/settings/cards/SecuritySettingsCard.tsx` |
| 10-7 | 미지원 네트워크 경고 UI + 원클릭 전환 | §23 | `app/layout.tsx`, `hooks/useWalletNetworks.ts` |

### 11. Header & Navigation

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 11-1 | 계정 드롭다운 메뉴 (Copy, Settings, Disconnect 확인) | §21 | `components/layout/Header.tsx` |
| 11-2 | Dashboard 메인 페이지 활동 내역 연동 | §4-5 | `app/page.tsx` |
| 11-3 | IncomingPayments 상세 보기 구현 | §13-6 | `components/stealth/cards/IncomingPaymentsCard.tsx` |

### 12. Footer & Static Pages

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| 12-1 | `/privacy`, `/terms` 페이지 구현 (법적 요건) | §32-1 | `app/privacy/`, `app/terms/` |
| 12-2 | 나머지 내부 링크 정리 (구현 또는 제거) | §32-1 | `components/layout/Footer.tsx` |
| 12-3 | 소셜 링크 실제 URL 또는 환경변수 전환 | §32-2 | `components/layout/Footer.tsx` |
| 12-4 | `lib/docs.ts` placeholder 정리 | §31-4 | `lib/docs.ts` |

---

## 구현 우선순위 요약

### Phase 0 — 인프라 + CRITICAL (즉시, ~3일)

**목표:** 앱 전체의 기반 인프라 보강 + 동작 불가 기능 수정

1. 인프라 기반: ~~0-1 ~ 0-2 (indexerUrl)~~ ✅ 완료, 0-3 ~ 0-8 (환경변수, ErrorBoundary 개별 페이지 적용, loading/error, Toast, 모바일)
2. Swap 실행 복구: ~~2-1 (sendUserOp 전달)~~ ✅ 완료, ~~2-4 (ERC-20 approve)~~ ✅ 완료, 2-2 ~ 2-3 (Router URL/address)
3. ~~Session Key 키페어: 4-1 (secp256k1 + secureKeyStore)~~ ✅ 완료
4. ~~Stealth Announcement: 3-1 (ERC-5564 on-chain announce)~~ ✅ 완료

**완료 조건:** ~~Swap/Stealth Send/Session Key 생성이 실제로 동작~~ → Swap Router URL/address 환경변수 분리 + 인프라 보강 완료

### Phase 1 — 데이터 연결 + HIGH (1주)

**목표:** 모든 data hook이 실제 데이터 소스(indexer/contract)에 연결

5. Data Hooks 연결: 1-5, 6-1, 7-1 ~ 7-3, 8-1 (6개 hook에 fetch 함수 구현)
6. Overview 통계: 3-3, 6-4, 7-11, 5-6 (실제 데이터 기반 통계)
7. Merchant Dashboard: 9-1 ~ 9-3 (mock → 실제 데이터)

**완료 조건:** 빈 화면/하드코딩 0 없이 실제 데이터 표시

### Phase 2 — 기능 완성 + MEDIUM (2주)

**목표:** 모든 버튼/콜백이 실제로 동작

8. Payment 완성: 1-1 ~ 1-4, 1-6
9. Swap UI: 2-5 ~ 2-7
10. Stealth: 3-2, 3-3
11. Session Key: 4-2
12. Subscription: 5-1 ~ 5-8
13. DeFi Pool: 6-2, 6-3
14. Enterprise: 7-4 ~ 7-12
15. Smart Account: 8-2, 8-3
16. Settings: 10-1 ~ 10-7
17. Header/Navigation: 11-1 ~ 11-3

**완료 조건:** 모든 UI 버튼에 동작하는 핸들러 연결

### Phase 3 — 완성도 + LOW (1주)

**목표:** 프로덕션 준비 수준의 완성도

18. Footer/Static: 12-1 ~ 12-4
19. 인프라 정리: §31 전체 (deprecated 제거, docs 정리)

---
---

# packages/ 미구현 기능 (15건)

> 7차 검토 추가 (2026-02-12), 9차 검토 1건 추가 (§73)
> 대상: `packages/sdk-go`, `packages/sdk-ts`, `packages/config`, `packages/contracts`

---

## §35. CRITICAL — SDK-GO UserOperation 해시 계산 미구현

**심각도:** CRITICAL
**파일:** `packages/sdk-go/transaction/strategies/smart_account.go:312-321`

**현상:** `calculateUserOpHash()` 함수가 빈 해시(`Hash{}`)를 반환한다.

```go
func calculateUserOpHash(userOp *sdktypes.UserOperation, entryPoint sdktypes.Address, chainId uint64) sdktypes.Hash {
    // This is a placeholder - real implementation would:
    // 1. Pack the UserOperation
    // 2. Hash with keccak256
    // 3. Combine with entryPoint and chainId
    // 4. Hash again
    return sdktypes.Hash{}
}
```

**영향:**
- Go SDK를 통한 Smart Account 트랜잭션 서명이 불가능
- 빈 해시로 서명 시 EntryPoint에서 서명 검증 실패

**해결 방안:**
- ERC-4337 스펙에 따른 `keccak256(abi.encode(pack(userOp), entryPoint, chainId))` 구현
- `go-ethereum/crypto` 패키지의 `Keccak256` 사용

---

## §36. CRITICAL — SDK-GO Smart Account Call Encoding 미구현

**심각도:** CRITICAL
**파일:** `packages/sdk-go/transaction/strategies/smart_account.go:300-310`

**현상:** `encodeSmartAccountCall()` 함수가 ABI 인코딩 없이 raw data를 그대로 반환한다.

```go
func encodeSmartAccountCall(to sdktypes.Address, value *big.Int, data sdktypes.Hex) sdktypes.Hex {
    // This is a placeholder - real implementation would use proper ABI encoding
    // For now, just return the data as-is
    return data
}
```

**영향:**
- Kernel `execute(address,uint256,bytes,uint8)` 함수 호출이 잘못된 calldata로 실행됨
- Smart Account 트랜잭션이 on-chain에서 실패

**해결 방안:**
- `abi.Pack("execute", to, value, data, uint8(0))` 형태의 ABI 인코딩 구현
- `go-ethereum/accounts/abi` 패키지 활용

---

## §37. CRITICAL — 전체 체인 컨트랙트 주소 ZERO_ADDRESS

**심각도:** CRITICAL
**파일:** `packages/config/src/chains.ts:14-176`, `packages/contracts/src/generated/addresses.ts:11-55`

**현상:** Anvil(31337), StableNet Local(8283), Sepolia(11155111) 모든 체인에서 **대부분의** 컨트랙트 주소가 ZERO_ADDRESS이다. *(11차 검토 정정: subscription 관련 3개 주소는 실제 배포 주소 존재)*

```typescript
const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

export const ANVIL_ADDRESSES: ChainAddresses = {
    core: { kernel: ZERO_ADDRESS, kernelFactory: ZERO_ADDRESS },
    validators: { ecdsaValidator: ZERO_ADDRESS, webAuthnValidator: ZERO_ADDRESS, multiEcdsaValidator: ZERO_ADDRESS },
    executors: { ownableExecutor: ZERO_ADDRESS },
    hooks: { spendingLimitHook: ZERO_ADDRESS },
    paymasters: { verifyingPaymaster: ZERO_ADDRESS, tokenPaymaster: ZERO_ADDRESS },
    privacy: { stealthAnnouncer: ZERO_ADDRESS, stealthRegistry: ZERO_ADDRESS },
    compliance: { kycRegistry: ZERO_ADDRESS, complianceValidator: ZERO_ADDRESS },
}
```

**영향:**
- Smart Account 생성/배포 불가 (factory가 zero address)
- 모든 validator/executor/hook/paymaster가 동작 불가
- Stealth, Compliance 기능 전체 비활성화

> *(11차 검토 정정)* `addresses.ts`에서 chain 31337의 subscription 관련 3개 컨트랙트는 실제 배포 주소 존재:
> - `subscriptionManager: '0x9d4454B023096f34B160D6B654540c56A1F81688'`
> - `recurringPaymentExecutor: '0x998abeb3E57409262aE5b751f60747921B33613E'`
> - `permissionManager: '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf'`

**해결 방안:**
- 각 체인별로 실제 배포된 컨트랙트 주소 입력 (subscription 외 전체)
- 배포 스크립트 실행 후 자동으로 주소를 업데이트하는 파이프라인 구축

---

## §38. HIGH — SDK-GO Paymaster 데이터 미구현

**심각도:** HIGH
**파일:** `packages/sdk-go/transaction/strategies/smart_account.go:266-271`

**현상:** `getPaymasterData()` 함수가 항상 `nil`을 반환한다.

```go
func (s *SmartAccountStrategy) getPaymasterData(ctx context.Context, ...) (*PaymasterData, error) {
    // This is a placeholder - real implementation would call the paymaster service
    return nil, nil
}
```

**영향:** Go SDK에서 Paymaster를 통한 가스 스폰서링 불가

**해결 방안:** Paymaster proxy 서비스(`services/paymaster-proxy`)로 `pm_getPaymasterStubData` / `pm_getPaymasterData` RPC 호출 구현

---

## §39. HIGH — SDK-GO 가스 가격 하드코딩

**심각도:** HIGH
**파일:** `packages/sdk-go/gas/estimator.go:160-177`

**현상:** `GetGasPrices()`가 RPC를 호출하지 않고 하드코딩된 값(30 gwei base, 2 gwei priority)을 반환한다.

```go
baseFee := new(big.Int).Mul(big.NewInt(30), big.NewInt(1e9))       // 30 gwei
maxPriorityFee := new(big.Int).Mul(big.NewInt(2), big.NewInt(1e9)) // 2 gwei
```

**영향:**
- 실제 네트워크 가스 가격과 무관한 추정값 사용
- 과소 추정 시 트랜잭션 포함 지연, 과대 추정 시 불필요한 비용 발생

**해결 방안:** `eth_gasPrice`, `eth_feeHistory` RPC 호출로 실시간 가스 가격 조회

---

## §40. HIGH — SDK-GO Smart Account 가스 추정 기본값 사용

**심각도:** HIGH
**파일:** `packages/sdk-go/gas/estimator.go:381-404`

**현상:** Smart Account 가스 추정 시 Bundler의 `eth_estimateUserOperationGas`를 호출하지 않고 기본값을 사용한다.

**영향:** UserOperation 가스 한도가 실제 소비량과 다를 수 있어 실행 실패 또는 불필요한 비용 발생

**해결 방안:** Bundler RPC `eth_estimateUserOperationGas` 엔드포인트 호출 구현

---

## §41. HIGH — EIP-7702 Delegate 주소 미설정

**심각도:** HIGH
**파일:** `packages/sdk-go/eip7702/constants.go:32,41,50`

**현상:** Sepolia, Polygon Amoy, Local Anvil 3개 체인 모두 Kernel v3.1 delegate 주소가 zero address이다.

```go
Address: common.HexToAddress("0x0000000000000000000000000000000000000000"), // TODO: Update with actual address
```

**영향:** Go SDK에서 EIP-7702 delegation이 불가 (zero address로 위임 시 EOA 코드가 비어 있는 주소를 참조)

**해결 방안:** 각 테스트넷에 실제 배포된 Kernel v3.1 주소 입력

---

## §42. MEDIUM — SDK-GO 설치된 모듈 조회 미구현

**심각도:** MEDIUM
**파일:** `packages/sdk-go/modules/client/client.go:74-78`

**현상:** `GetInstalledModules()`가 항상 빈 리스트를 반환한다.

```go
func (c *QueryClient) GetInstalledModules(...) ([]types.InstalledModule, error) {
    // For now, return empty list - in production, integrate with indexer
    return []types.InstalledModule{}, nil
}
```

**영향:** Go SDK에서 Smart Account에 설치된 모듈 목록을 확인할 수 없음

**해결 방안:** 인덱서 API 또는 `getModulesPaginated()` 온체인 호출로 구현

---

## §43. MEDIUM — SDK-GO EOA 트랜잭션 디코딩 미구현

**심각도:** MEDIUM
**파일:** `packages/sdk-go/transaction/strategies/eoa.go:280-285`

**현상:** `decodeRawTransaction()`이 항상 `nil`을 반환한다.

```go
func decodeRawTransaction(raw sdktypes.Hex) *types.Transaction {
    // This is a placeholder - real implementation would decode the raw transaction
    return nil
}
```

**영향:** 서명된 raw 트랜잭션의 디코딩 불가

**해결 방안:** `rlp.DecodeBytes()` 또는 `types.Transaction.UnmarshalBinary()` 사용

---

## §44. MEDIUM — SDK-TS Smart Account 가스 추정 간소화

**심각도:** MEDIUM
**파일:** `packages/sdk-ts/core/src/gas/strategies/smartAccountGasStrategy.ts:50-78`

**현상:** Bundler의 `eth_estimateUserOperationGas`를 호출하지 않고 `provider.estimateGas()`로 간소화된 추정을 한다.

```typescript
// For now, use simplified estimation
// Real implementation would call bundler's eth_estimateUserOperationGas
let callGasLimit: bigint
try {
    callGasLimit = await provider.estimateGas({ from, to, value, data })
} catch {
    callGasLimit = BASE_TRANSFER_GAS * 2n
}
```

**영향:** `verificationGasLimit`, `preVerificationGas`가 고정 상수이므로 복잡한 UserOp에서 가스 부족 가능

**해결 방안:** Bundler RPC `eth_estimateUserOperationGas` 연동

---

## §45. MEDIUM — SDK-GO SmartAccountClient 가스 가격 하드코딩

**심각도:** MEDIUM
**파일:** `packages/sdk-go/clients/smart_account.go:378-385`

**현상:** `getGasPrices()`가 50 gwei / 1.5 gwei 고정값을 반환한다.

**영향:** §39와 동일 — 실시간 가스 가격 미반영

---

## §46. LOW — SDK-GO Subscription 스케줄 파싱 미구현

**심각도:** LOW
**파일:** `packages/sdk-go/plugins/subscription/client.go:334-376`

**현상:** `parseScheduleFromOutputs()`, `parseSchedulesFromOutputs()` 두 함수가 placeholder이다.

```go
func parseSchedulesFromOutputs(outputs []interface{}) []*PaymentSchedule {
    // This is a placeholder - real implementation would parse array properly
    return []*PaymentSchedule{}
}
```

**영향:** Go SDK에서 구독 스케줄 데이터를 컨트랙트에서 파싱할 수 없음

---

## §47. MEDIUM — SDK-GO 알려진 모듈 레지스트리 미등록

**심각도:** MEDIUM
**파일:** `packages/sdk-go/modules/client/client.go:388-391`

**현상:** `registerKnownModules()` 함수 본문이 비어 있다.

```go
func (r *ModuleRegistry) registerKnownModules() {
    // These would be populated with actual module addresses for each network
}
```

**영향:** Go SDK 모듈 레지스트리에 사전 정의된 모듈 정보가 없음

---

## §48. MEDIUM — SDK-TS Kernel Hook 주소 Zero

**심각도:** MEDIUM
**파일:** `packages/sdk-ts/accounts/src/kernel/utils.ts:110-111`

**현상:** Kernel 초기화 시 hook 주소가 zero address로 하드코딩되어 있다.

```typescript
const hookAddress = '0x0000000000000000000000000000000000000000' as Address // No hook
const hookData = '0x' as Hex
```

**영향:** Kernel v3 hook 기능(예: SpendingLimitHook) 사용 불가

---

---

# services/ 미구현 기능 (15건)

> 7차 검토 추가 (2026-02-12), 8차 검토 1건 추가
> 대상: `services/bridge-relayer`, `services/order-router`, `services/subscription-executor`, `services/paymaster-proxy`, `services/bundler`

---

## §49. CRITICAL — Bridge Relayer 블록체인 상호작용 전체 PoC 스텁

**심각도:** CRITICAL
**파일:** `services/bridge-relayer/internal/ethereum/client.go:46-227`

**현상:** Ethereum 클라이언트의 약 15개 핵심 함수가 모두 시뮬레이션 값을 반환한다. 실제 RPC 호출이 전혀 없다.

| 함수 | 현재 동작 | 라인 |
|------|-----------|------|
| `GetBalance()` | "For PoC, we simulate a balance" | 39-44 |
| `GetBlockNumber()` | 상수 1000000 반환 | 49-51 |
| `GetBlockTimestamp()` | `time.Now()` 반환 | 55-57 |
| `EstimateGas()` | 상수 200000 반환 | 61-64 |
| `GetGasPrice()` | 30 gwei 고정 | 68-78 |
| `SendTransaction()` | 시간 기반 fake hash 반환 | 82-91 |
| `WaitForTransaction()` | 2초 후 무조건 성공 | 95-108 |
| `CallContract()` | 빈 바이트 반환 | 111-114 |
| `GetNonce()` | 0 반환 | 118-120 |
| `IsConnected()` | 항상 true | 124-126 |
| `EncodeCompleteBridge()` | placeholder selector | 138-157 |
| `DecodeEventLog()` | 빈 맵 반환 | 161-163 |
| `SubscribeToEvents()` | 이벤트 없는 빈 goroutine | 167-193 |
| `HashBridgeMessage()` | requestID 복사 (keccak256 아님) | 209-226 |

**영향:** Bridge relayer가 실제 크로스 체인 브릿지 처리를 전혀 수행하지 않음

**해결 방안:**
- `go-ethereum/ethclient`를 사용한 실제 RPC 연결 구현
- ABI 바인딩(`abigen`)을 통한 컨트랙트 인코딩/디코딩

---

## §50. HIGH — Order Router Uniswap V3 Quote 시뮬레이션

**심각도:** HIGH
**파일:** `services/order-router/internal/provider/uniswap_v3.go:197-222`

**현상:** Quoter 컨트랙트를 호출하지 않고 수수료 기반 단순 계산으로 시뮬레이션한다.

```go
func (p *UniswapV3Provider) quoteExactInputSingle(...) (*big.Int, error) {
    // In production, this would call the Quoter contract
    // For PoC, we simulate with a simple calculation
    feeFactor := big.NewInt(int64(1000000 - fee))
    amountOut := new(big.Int).Mul(amountIn, feeFactor)
    amountOut = new(big.Int).Div(amountOut, big.NewInt(1000000))
    return amountOut, nil
}
```

**영향:**
- 실제 DEX 유동성/가격 반영 안 됨
- 슬리피지, 가격 영향(price impact) 계산 불가

**해결 방안:** Uniswap V3 `Quoter` 또는 `QuoterV2` 컨트랙트의 `quoteExactInputSingle()` on-chain call 구현

---

## §51. HIGH — Order Router Pool 주소 계산 Fake

**심각도:** HIGH
**파일:** `services/order-router/internal/provider/uniswap_v3.go:218-222`

**현상:** CREATE2 주소 계산 대신 "deterministic fake address"를 반환한다.

```go
func (p *UniswapV3Provider) computePoolAddress(tokenA, tokenB string, fee int) string {
    // In production, compute CREATE2 address
    return fmt.Sprintf("0x%s", strings.Repeat("0", 38)+"01")
}
```

**영향:** 모든 토큰 쌍이 동일한 pool 주소를 가리킴 → 풀 존재 여부 확인 불가

---

## §52. MEDIUM — Order Router Pathfinder 단순 등분할

**심각도:** MEDIUM
**파일:** `services/order-router/internal/router/pathfinder.go:205-206`

**현상:** 최적 스왑 분할 비율 대신 단순 등분할을 한다.

```go
// For PoC: simple equal split among top routes
percentages := pf.calculateSplitPercentages(routes[:maxSplits], amountIn)
```

**영향:** 최적 경로 분배로 인한 가격 개선이 없음 — 사용자가 최상의 가격을 얻지 못함

**해결 방안:** 각 경로별 유동성/가격 영향 기반의 최적 분배 알고리즘 구현

---

## §53. MEDIUM — Order Router 1inch 프로토콜 파싱 간소화

**심각도:** MEDIUM
**파일:** `services/order-router/internal/aggregator/oneinch.go:179-183`

**현상:** 1inch API 응답의 중첩 프로토콜 구조를 파싱하지 않고 단일 문자열을 반환한다.

```go
func extractProtocols(raw json.RawMessage) []string {
    // Simplified protocol extraction
    // In production, properly parse the nested protocol structure
    return []string{"1inch_aggregation"}
}
```

**영향:** 사용된 DEX 프로토콜 정보를 사용자에게 표시할 수 없음

---

## §54. MEDIUM — Order Router Uniswap V2 Pool 주소 미구현

**심각도:** MEDIUM
**파일:** `services/order-router/internal/provider/uniswap_v2.go:195`

**현상:** "In production, compute CREATE2 address" 주석 — V3와 동일한 placeholder 패턴

---

## §55. HIGH — Subscription Executor Placeholder 서명

**심각도:** HIGH
**파일:** `services/subscription-executor/internal/service/executor.go:48-60`

**현상:** `EXECUTOR_PRIVATE_KEY`가 설정되지 않으면 placeholder 서명을 사용한다.

```go
if cfg.ExecutorPrivateKey != "" {
    signer, err = client.NewUserOpSigner(cfg.ExecutorPrivateKey, ...)
} else {
    log.Warn("EXECUTOR_PRIVATE_KEY not set, using placeholder signatures")
}
```

**영향:** Private key 미설정 시 구독 결제 UserOp가 잘못된 서명으로 제출되어 on-chain 실패

---

## §56. MEDIUM — Bundler Aggregator 미지원

**심각도:** MEDIUM
**파일:** `services/bundler/src/validation/validator.ts:313-321`

**현상:** ERC-4337 Aggregator가 명시적으로 거부된다.

```typescript
if (aggregator) {
    throw new RpcError(
        `aggregator ${aggregator} not supported`,
        RPC_ERROR_CODES.UNSUPPORTED_AGGREGATOR
    )
}
```

**영향:** Aggregator 기반 서명 방식(BLS 등)을 사용하는 UserOp가 거부됨

---

## §57. MEDIUM — Bundler Mempool 온체인 Nonce 미검증

**심각도:** MEDIUM
**파일:** `services/bundler/src/mempool/mempool.ts:254`

**현상:** Nonce를 mempool 내부에서만 검증하고 on-chain nonce와 비교하지 않는다.

```typescript
// (In production, we'd check against on-chain nonce)
```

**영향:** 이미 실행된 nonce의 UserOp가 mempool에 남을 수 있음

---

## §58. LOW — Paymaster Proxy 가스 한도 하드코딩

**심각도:** LOW
**파일:** `services/paymaster-proxy/src/handlers/getPaymasterStubData.ts:16-19`

**현상:** Paymaster 가스 한도가 고정 상수이다.

```typescript
const DEFAULT_GAS_LIMITS = {
    paymasterVerificationGasLimit: 100000n,
    paymasterPostOpGasLimit: 50000n,
} as const
```

**영향:** 복잡한 paymaster 로직에서 가스 부족 가능

---

## §59. LOW — Bundler/Paymaster-proxy 테스트 스켈레톤

**심각도:** LOW
**파일:** `services/bundler/tests/index.test.ts:4-5`, `services/paymaster-proxy/tests/index.test.ts:4-5`

**현상:** 각각 2개의 `it.todo()` placeholder 테스트가 있다.

```typescript
// bundler
it.todo('should bundle user operations')
it.todo('should estimate gas')

// paymaster-proxy
it.todo('should proxy paymaster requests')
it.todo('should validate sponsorship policy')
```

**영향:** 핵심 통합 테스트 부재

---

## §60. LOW — Paymaster Proxy 정책 관리 API 미구현

**심각도:** LOW
**파일:** `services/paymaster-proxy/src/policy/sponsorPolicy.ts:107-127`

**현상:** 정책의 `startTime`/`endTime` 필드를 검증하지만 이를 관리할 admin API가 없다.

**영향:** 시간 기반 스폰서링 정책을 프로그래밍 방식으로 관리할 수 없음

---

## §61. MEDIUM — Bundler 디버그 모드 보안 설정

**심각도:** MEDIUM
**파일:** `services/bundler/src/rpc/server.ts:143-150, 254-260`

**현상:** 디버그 모드에서 CORS 전체 허용 + 에러 메시지 노출

**영향:** 프로덕션 배포 시 보안 취약점 — 디버그 모드 비활성화 필수

---

## §62. LOW — Bundler Validation Skip 플래그 프로덕션 노출

**심각도:** LOW
**파일:** `services/bundler/src/validation/validator.ts:96,129,138,149`

**현상:** `skipSimulation`, `skipReputation`, `skipOpcodeValidation` 플래그가 프로덕션에서도 설정 가능

**영향:** 잘못된 설정 시 보안 검증 우회 가능

---

## §68. MEDIUM — Bundler FlashbotsSubmitter 간소화된 서명 *(8차 검토 추가)*

**심각도:** MEDIUM
**파일:** `services/bundler/src/executor/flashbotsSubmitter.ts:132-138`

**현상:** Flashbots relay 인증 서명이 secp256k1 ECDSA가 아닌 `keccak256(authKey + bodyHash)` 해시로 간소화되어 있다.

```typescript
private async signPayload(body: string): Promise<string> {
    const bodyHash = keccak256(toHex(body))
    // Simple signature using auth key hash (in production, use secp256k1 signing)
    const sigHash = keccak256(`0x${this.config.authKey.slice(2)}${bodyHash.slice(2)}` as Hex)
    return `${this.config.authKey.slice(0, 42)}:${sigHash}`
}
```

**영향:** Flashbots relay가 올바른 `X-Flashbots-Signature` 형식을 요구하므로, 실제 relay에 제출 시 인증 실패

**해결 방안:** `secp256k1` 개인키로 `eth_sign` 방식의 ECDSA 서명 구현

---

---

# apps/wallet-extension/ 미구현 기능 (9건)

> 7차 검토 추가 (2026-02-12), 8차 검토 4건 추가
> 대상: `apps/wallet-extension/`
> 참고: `apps/wallet-extension/docs/REMAINING_TASKS.md` 기반 + 코드 검토 추가

---

## §63. MEDIUM — QR Code Placeholder

**심각도:** MEDIUM
**파일:** `apps/wallet-extension/src/ui/pages/Receive.tsx:37-58`

**현상:** apps/web과 동일하게 QR 코드가 placeholder 텍스트이다.

**영향:** Receive 페이지에서 주소 QR 코드를 스캔할 수 없음

---

## §64. LOW — 하드웨어 지갑 (Ledger) 미지원

**심각도:** LOW
**파일:** `apps/wallet-extension/docs/REMAINING_TASKS.md:241-243`

**현상:** Ledger USB HID 연동, 트랜잭션 서명, 계정 관리가 미구현이다.

**영향:** 하드웨어 지갑 사용자가 월렛 익스텐션을 사용할 수 없음

---

## §65. LOW — WalletConnect v2 미지원

**심각도:** LOW
**파일:** `apps/wallet-extension/docs/REMAINING_TASKS.md:246-247`

**현상:** WalletConnect v2 프로토콜과 Deep linking이 미구현이다.

**영향:** 모바일 dApp에서 월렛 연결 불가

---

## §66. LOW — 다국어 지원 (i18n) 미구현

**심각도:** LOW
**파일:** `apps/wallet-extension/docs/REMAINING_TASKS.md:249-251`

**현상:** i18n 프레임워크 미설정, 한국어/영어 번역 파일 미생성

**영향:** 영어 이외 언어 지원 불가

---

## §67. LOW — E2E 테스트 CI 미통합

**심각도:** LOW
**파일:** `apps/wallet-extension/docs/REMAINING_TASKS.md:257`

**현상:** Playwright E2E 테스트(27개)가 로컬에서만 실행되고 CI에 통합되지 않았다.

**영향:** PR 머지 시 E2E 회귀 테스트가 자동 실행되지 않음

---

## §69. HIGH — dApp 연결 자동 승인 (보안) *(8차 검토 추가)*

**심각도:** HIGH
**파일:** `apps/wallet-extension/src/background/index.ts:520-526`

**현상:** dApp 연결 요청 시 사용자 승인 팝업 없이 자동으로 연결을 승인한다.

```typescript
// Auto-approve connection (in production, show popup for user approval)
await walletState.addConnectedSite({
    origin,
    accounts,
    permissions: ['eth_accounts'],
    connectedAt: Date.now(),
})
```

**영향:** 악의적인 dApp이 사용자 동의 없이 지갑 주소에 접근 가능 — 프로덕션 보안 취약점

**해결 방안:** 연결 요청 시 Approval popup을 표시하여 사용자가 명시적으로 승인/거부하도록 구현

---

## §70. MEDIUM — Smart Account 주소 계산 간소화 *(8차 검토 추가)*

**심각도:** MEDIUM
**파일:** `apps/wallet-extension/src/background/controller/accountController.ts:22-30`

**현상:** Smart Account 주소를 factory 컨트랙트 호출 대신 단순 해시 기반으로 계산한다.

```typescript
// For now, use a deterministic address based on owner and index
// In production, this would call the factory contract
const address = getAddress(`0x${salt.slice(26)}`) as Address
```

**영향:** 계산된 주소가 실제 factory에서 배포될 주소와 불일치할 수 있음 → 자금 손실 위험

**해결 방안:** `KernelFactory.getAccountAddress(owner, salt)` 온체인 호출 또는 CREATE2 주소 계산 구현

---

## §71. LOW — Swap 가격 영향(Price Impact) 미계산 *(8차 검토 추가)*

**심각도:** LOW
**파일:** `apps/wallet-extension/src/ui/pages/SwapPage.tsx:116`

**현상:** 스왑 견적에서 `priceImpact`가 항상 `null`이다.

```typescript
priceImpact: null, // Real price impact requires on-chain data
```

**영향:** 사용자가 불리한 스왑 비율(높은 가격 영향)을 인지하지 못함

---

## §72. MEDIUM — wallet_requestPermissions 간소화 *(8차 검토 추가)*

**심각도:** MEDIUM
**파일:** `apps/wallet-extension/src/background/rpc/handler.ts:2870`

**현상:** `wallet_requestPermissions` RPC 메서드가 모든 권한 요청을 단순 연결 요청으로 처리한다.

```typescript
// For now, treat permission request like a connect request
if (requestedMethods.includes('eth_accounts')) {
    const handler = handlers['eth_requestAccounts']
    // ...delegates to connect flow
}
```

**영향:** EIP-2255 세분화된 권한 관리 미지원 — 개별 메서드별 권한 부여/회수 불가

---

## §73. MEDIUM — ERC-721/ERC-1155 Token Receiver Fallback 미배포 *(9차 검토 추가)*

**심각도:** MEDIUM
**파일:** `packages/sdk-ts/core/src/modules/config/fallbacks.ts:25-47`

**현상:** Smart Account에서 ERC-721(NFT) 및 ERC-1155(Multi-Token) 수신을 위한 Token Receiver Fallback 모듈이 정의되어 있으나, 주소가 `ZERO_ADDRESS`로 미배포 상태이다.

```typescript
export const TOKEN_RECEIVER_FALLBACK: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address, // 미배포
    type: MODULE_TYPE.FALLBACK,
    name: 'Token Receiver',
    description: 'Enable receiving ERC721, ERC1155, and other token standards',
    // ...
  },
  // 모든 체인에서 ZERO_ADDRESS
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x000...000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x000...000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x000...000' as Address,
  },
)
```

**영향:** Smart Account가 ERC-721 NFT 및 ERC-1155 토큰을 수신할 수 없음 — `onERC721Received`, `onERC1155Received` 콜백 미제공으로 `safeTransferFrom` 호출 시 revert

---

---

## 전체 요약 (~~128건~~ → 122건)

### 범위별 분류

| 범위 | CRITICAL | HIGH | MEDIUM | LOW | RESOLVED | 합계 |
|------|----------|------|--------|-----|----------|------|
| apps/web (§1-§34) | ~~3~~ 2 | ~~27~~ 24 | ~~41~~ 39 | 18 | **6** | ~~89~~ **83** |
| packages (§35-§48, §73) | 3 | 4 | 7 | 1 | 0 | **15** |
| services (§49-§62, §68) | 1 | 3 | 7 | 4 | 0 | **15** |
| wallet-extension (§63-§67, §69-§72) | 0 | 1 | 3 | 5 | 0 | **9** |
| **합계** | **6** | **32** | **56** | **28** | **6** | **122** |

> 11차 검토 (2026-02-13) RESOLVED 6건: §1-1 (CRITICAL→RESOLVED), §5-1 (HIGH→RESOLVED), §6 (HIGH→RESOLVED), §33 (HIGH→RESOLVED), §34-1 (MEDIUM→RESOLVED), §34-2 (MEDIUM→RESOLVED)
> 부분 정정 2건: §16 (ErrorBoundary — layout.tsx에서 1곳 사용 중), §37 (ZERO_ADDRESS — subscription 3개 주소는 실제 배포 주소)

### 핵심 블로커 (CRITICAL ~~7건~~ → 6건)

1. ~~§1-1 — apps/web: Swap `sendUserOp` 미전달 (실행 불가)~~ ✅ RESOLVED
2. §1-2 — apps/web: Order Router URL `localhost` 하드코딩
3. §1-3 — apps/web: Router Address mainnet 하드코딩
4. §35 — packages: SDK-GO `calculateUserOpHash()` 빈 해시 반환
5. §36 — packages: SDK-GO `encodeSmartAccountCall()` ABI 인코딩 없음
6. §37 — packages: 대부분 체인 컨트랙트 주소 `ZERO_ADDRESS` *(정정: subscription 3개 제외)*
7. §49 — services: Bridge Relayer 블록체인 상호작용 전체 PoC 스텁

### 확장 구현 우선순위

#### Phase 0+ — packages/services CRITICAL (즉시, ~5일)

**목표:** SDK 및 서비스 인프라 기반 기능 복구

1. 컨트랙트 배포 + 주소 업데이트: §37, §41, §73 (Anvil/Sepolia 배포 후 config 업데이트, Token Receiver Fallback 포함 — subscription 3개 주소는 배포 완료)
2. SDK-GO Smart Account 핵심: §35, §36, §38 (UserOp 해시, ABI 인코딩, Paymaster)
3. SDK 가스 추정 연동: §39, §40, §44 (RPC 및 Bundler 연동)

**완료 조건:** Go SDK로 Smart Account 트랜잭션 생성 → Bundler 제출 → on-chain 실행 성공

#### Phase 1+ — services 기능 완성 (~1주)

4. Bridge Relayer 실제 구현: §49 (go-ethereum ethclient 연동)
5. Order Router DEX 연동: §50, §51, §52 (Quoter 컨트랙트 호출)
6. Subscription Executor 서명: §55 (private key 관리)
7. SDK 추가 구현: §42, §43, §47 (모듈 조회, 트랜잭션 디코딩)
8. Wallet Extension 보안: §69 (dApp 연결 승인 팝업), §70 (factory 주소 계산)

**완료 조건:** 크로스 체인 브릿지, DEX 스왑이 실제 컨트랙트와 상호작용, 지갑 보안 기본 요건 충족
