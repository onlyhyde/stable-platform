# Web App 미구현 기능 검토 보고서

> 검토일: 2026-02-11 (4차 검토 완료), 2026-02-12 (5차 검토 완료)
> 설계 검증: 2026-02-12 (6건 논리적 오류 정정 완료)
> 대상: `apps/web` (Next.js 15 + React 19)
> 총 미구현 항목: 83건

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

---

## 요약

| 우선순위 | 영역 | 문제 수 | 핵심 문제 |
|----------|------|---------|-----------|
| **CRITICAL** | **Swap 실행 불가** | **3** | **sendUserOp 미전달, Order Router localhost 하드코딩** |
| HIGH | Merchant Dashboard | 12 | 전체 mock 데이터, 모든 핸들러 빈 함수 |
| HIGH | Data Hooks | 6 | usePools, usePayroll, useExpenses, useAuditLogs, useTokens, useTransactionHistory 데이터 소스 미연결 |
| HIGH | Overview 페이지 통계 | 5 | stealth, enterprise, defi, subscription, dashboard 통계 하드코딩 |
| HIGH | Token Approval | 2 | Swap/Subscription에서 ERC-20 approve 미처리 |
| HIGH | Session Key | 1 | 생성 시 랜덤 주소만, 실제 키페어 아님 |
| MEDIUM | Security Settings | 4 | Toggle/Button 동작 안 함 |
| MEDIUM | Subscription Edit | 3 | Edit/Deactivate 버튼 미구현 |
| MEDIUM | DeFi Pool | 2 | Add/Remove Liquidity 콜백 미연결 |
| MEDIUM | QR Code | 1 | 실제 QR 생성 미구현 |
| MEDIUM | Enterprise Payroll | 3 | Process Payments, Export Report, Add Employee 미연결 |
| MEDIUM | Enterprise Expenses | 1 | Submit Expense 콜백 미연결 |
| MEDIUM | 컴포넌트 미연결 콜백 | 6 | SessionKey Detail, Subscription Manage, Expense approve/reject, Payroll Edit, Module Uninstall |
| MEDIUM | 하드코딩 네트워크 URL | 2 | Etherscan URL 네트워크별 미분기 |
| MEDIUM | Stealth Withdraw | 1 | onWithdraw 콜백 미전달, 인출 불가 |
| MEDIUM | ErrorBoundary | 2 | 구현됨 but 앱 전체에 미적용 |
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
| LOW | Footer 링크 | 1 | 8개 미존재 페이지 링크 (/blog, /about, /careers, /contact, /docs/api, /docs/tutorials, /privacy, /terms) |
| **합계** | | **83** | |

---

## 1. Swap 실행 불가

**심각도: CRITICAL** *(4차 검토 추가)*

Swap 페이지의 토큰 교환 기능이 전혀 동작하지 않음. 3가지 연쇄 문제로 인해 전체 Swap 플로우가 불가능.

### 1-1. sendUserOp 미전달

**파일:** `app/defi/swap/page.tsx:13`, `hooks/useSwap.ts:66-72`

```typescript
// swap/page.tsx - config 없이 호출
const { quote, isLoading, error, getQuote, executeSwap } = useSwap()

// useSwap.ts:171-174 - sendUserOp가 없으면 즉시 실패
if (!sendUserOp) {
  setError(new Error('sendUserOp function not provided'))
  return null
}
```

Swap 페이지에서 `useSwap()`을 config 없이 호출하므로 `sendUserOp`가 undefined.
"Swap" 버튼 클릭 시 에러만 발생하고 트랜잭션 실행 불가.

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

- `useUserOp` hook의 **`sendUserOp`** (raw function)을 `useSwap` config로 전달
  - ⚠️ `sendTransaction`은 `data: '0x'`로 하드코딩된 래퍼이므로 swap calldata 전달 불가
  - `sendUserOp(sender, { to, value?, data })` 시그니처가 필요
- `useSwap`의 `UseSwapConfig.sendUserOp` 타입에서 `minAmountOut` 필드 제거 (현재 `SendUserOpParams`에 해당 필드 없어 무시됨)
- Order Router URL을 환경변수(`NEXT_PUBLIC_ORDER_ROUTER_URL`)로 분리
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

### 5-1. Swap 시 Token Approval 누락

**파일:** `hooks/useSwap.ts:165-207`

`executeSwap`에서 ERC-20 토큰 swap 실행 전 allowance 확인/승인 단계가 없음.

```typescript
// useSwap.ts - 바로 swap 실행, approve 체크 없음
const result = await sendUserOp(recipient, {
  to: routerAddress,
  value: isETHIn ? swapQuote.amountIn : undefined,
  data: calldata,
  // approve(routerAddress, amountIn) 호출 없음!
})
```

사용자가 USDC → ETH swap을 시도하면 "insufficient allowance" 에러로 실패.

### 5-2. Subscription 시 Token Approval 누락

**파일:** `hooks/useSubscription.ts`

Subscription 생성의 두 경로 모두 ERC-20 approve가 없음:
- **Primary (ERC-7715 `wallet_grantPermissions`)**: 컨트랙트 실행 **권한 부여**이지, ERC-20 `approve()`가 아님
- **Fallback (PermissionManager `grantPermission`)**: 권한 레코드 등록이지, 토큰 approve가 아님

⚠️ ERC-7715 permission과 ERC-20 approval은 완전히 다른 개념. ERC-7715는 "누가 무엇을 실행할 수 있는가"의 권한이고, ERC-20 approve는 "누가 얼마만큼 토큰을 전송할 수 있는가"의 허용량. 양쪽 경로 모두 토큰 transfer 메커니즘이 구현에서 빠져있음.

### 해결 방안

- swap 실행 전 `allowance()` 조회 후 부족 시 `approve()` 트랜잭션 선행
- ERC-4337 스마트 계정의 경우 UserOperation calldata에 approve + swap을 batch로 인코딩 (단, 현재 코드베이스에 batch/multicall 인프라가 없으므로 구현 필요)
- subscription의 경우 PermissionManager/recurringPaymentExecutor가 실제로 토큰을 transfer하는 메커니즘 확인 필요 (현재 구현에 토큰 transfer 로직 부재)

---

## 6. Session Key 생성 Placeholder

**심각도: HIGH** *(4차 검토 추가)*
**파일:** `hooks/useSessionKey.ts:379-385`

```typescript
// Generate a cryptographically secure random session key address
// In production, this would be a full keypair with the private key stored securely
const randomBytes = new Uint8Array(20)
crypto.getRandomValues(randomBytes)
const sessionKey = `0x${Array.from(randomBytes)
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')}` as Address
```

세션 키 생성 시 랜덤 20바이트 주소만 생성. 실제 키페어(공개키 + 개인키)가 아니므로:
- 생성된 세션 키로 트랜잭션 서명 불가
- 개인키가 저장/반환되지 않음
- 온체인에 등록된 세션 키와 매칭되는 서명 생성 불가능

### 해결 방안

- ~~`crypto.subtle.generateKey()`~~ WebCrypto API는 secp256k1 미지원 (P-256/P-384/P-521만 지원)
- `@noble/curves/secp256k1` 사용 (이미 워크스페이스 `@stablenet/plugin-stealth`에 의존성 존재)
  - 참고: `packages/sdk-ts/plugins/stealth/src/crypto/stealth.ts:63-85`의 `generateStealthKeyPair()` 활용 가능
  - 또는 viem의 `generatePrivateKey()` + `privateKeyToAccount()` 활용
- 개인키를 `secureKeyStore`(이미 `lib/secureKeyStore.ts`에 구현됨, XOR 암호화 + 60초 자동 만료)에 안전하게 저장
- 공개키에서 derive된 주소를 세션 키 주소로 사용

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

### 13-1. ErrorBoundary 컴포넌트 구현 완료, 사용처 0건

**파일:** `components/error/ErrorBoundary.tsx`

- `ErrorBoundary` 클래스 컴포넌트 완전 구현
- `withErrorBoundary` HOC까지 제공
- `ErrorFallback` UI도 완성

하지만 `app/` 디렉토리 전체에서 **단 한 곳도 사용하지 않음**. 클라이언트 사이드 에러 발생 시 앱이 그대로 크래시됨.

### 13-2. 적용 필요 페이지

| 페이지 | 이유 |
|--------|------|
| `app/payment/send/page.tsx` | 트랜잭션 실행 중 에러 가능 |
| `app/smart-account/page.tsx` | 컨트랙트 호출 에러 가능 |
| `app/defi/swap/page.tsx` | DEX 트랜잭션 에러 가능 |
| `app/stealth/send/page.tsx` | 스텔스 트랜잭션 에러 가능 |
| `app/subscription/page.tsx` | 구독 관련 컨트랙트 에러 가능 |

### 해결 방안

- 트랜잭션 관련 페이지에 `ErrorBoundary` 래핑 적용
- 또는 `app/layout.tsx`에 전역 ErrorBoundary 추가
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

Footer에 아래 페이지로 링크가 있으나, 해당 페이지가 실제로 존재하지 않음:

- `/blog` — 블로그 페이지 없음
- `/about` — About 페이지 없음
- `/careers` — 채용 페이지 없음
- `/contact` — 연락처 페이지 없음
- `/docs/api` — API Reference 페이지 없음 *(4차 검토 추가)*
- `/docs/tutorials` — Tutorials 페이지 없음 *(4차 검토 추가)*
- `/privacy` — 개인정보처리방침 페이지 없음 *(4차 검토 추가)*
- `/terms` — 이용약관 페이지 없음 *(4차 검토 추가)*

### 해결 방안

- 해당 페이지를 실제로 구현하거나
- 존재하는 페이지로 링크 변경 또는 링크 자체 제거
- `/privacy`, `/terms`는 법적 요건 상 반드시 구현 권장

---

## 구현 우선순위 제안

### Phase 0 - CRITICAL 수정 (즉시)
1. **Swap 실행 복구**: `useSwap()`에 `sendUserOp` config 전달, Order Router URL 환경변수 분리, Router address 네트워크별 분기
2. **ERC-20 Token Approval**: Swap/Subscription 실행 전 allowance 확인 및 approve 트랜잭션 추가
3. **Session Key 키페어 생성**: 랜덤 주소 대신 실제 secp256k1 키페어 생성 + 개인키 secureKeyStore 저장

### Phase 1 - 핵심 기능 연결 (HIGH)
4. Data Hooks에 실제 데이터 소스 연결 (usePools, usePayroll, useExpenses, useAuditLogs, useTokens, useTransactionHistory)
5. Merchant Dashboard mock 데이터를 useSubscription hook으로 교체
6. Overview 페이지 통계를 실제 hook 데이터와 연결 (stealth, enterprise, defi, subscription, dashboard)

### Phase 2 - 사용자 경험 (MEDIUM)
7. 모바일 반응형 구현 (햄버거 메뉴, sidebar drawer, `ml-64` → `md:ml-64`)
8. Header 계정 드롭다운 구현 (Copy Address, Settings, Disconnect 확인)
9. Swap UI 완성 (실제 잔액 조회, 슬리피지 설정, Gas 동적 표시)
10. QR Code 생성 라이브러리 연동
11. Security Settings 기능 구현 (설정 저장, Spending Limits, Recovery)
12. Enterprise Quick Actions 및 모달 콜백 연결
13. DeFi Pool add/remove liquidity 연결
14. Subscription Edit/Deactivate 기능 구현
15. 컴포넌트 콜백 연결 (SessionKey Details, Subscription Manage, Expense approve/reject, Payroll Edit, Module Uninstall)
16. Block explorer URL 동적 분기
17. Stealth Withdraw 콜백 연결 (스텔스 자금 인출)
18. ErrorBoundary를 주요 페이지에 적용 (payment, defi, smart-account)
19. Toast 알림을 모든 폼 제출/트랜잭션 결과에 추가
20. Account Settings 완성 (계정 이름 저장, Smart Account 실제 상태 조회, 복사 피드백)
21. 페이지네이션 구현 (Payment History, Audit Logs)
22. 미지원 네트워크 경고 UI 추가 (배너 + 원클릭 전환)
23. UserOp timeout 후 재확인 수단 제공 (pending 목록, 재확인 버튼)

### Phase 3 - 완성도 (LOW)
24. Send 폼 잔액 초과 검증 추가 (`amount <= balance`)
25. Next.js 라우트 파일 추가 (loading.tsx, error.tsx, not-found.tsx)
26. Recurring Payment의 실제 scheduleId 파싱
27. Subscription Revenue 계산 구현
28. Marketplace 동적 카탈로그
29. Payroll YTD 계산
30. 인프라 하드코딩 제거 (wagmi RPC, moduleAddresses, constants, docs)
31. Footer 링크 정리 (8개 미존재 페이지)
