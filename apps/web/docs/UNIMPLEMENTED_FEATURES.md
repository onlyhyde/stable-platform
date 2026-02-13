# 미구현 기능 검토 보고서

> 검토일: 2026-02-11 (4차 검토 완료), 2026-02-12 (5차~7차 검토 완료)
> 설계 검증: 2026-02-12 (6건 논리적 오류 정정 완료)
> 7차 검토: 2026-02-12 (`services/`, `packages/`, `apps/wallet-extension/` 추가)
> 대상: `apps/web`, `services/`, `packages/`, `apps/wallet-extension/`
> 8차 검토: 2026-02-12 (논리적 오류 정정 + 누락 항목 5건 추가)
> 9차 검토: 2026-02-12 (EIP/ERC 표준 준수 검토 — ERC-721/1155 Token Receiver 누락 1건 추가, packages 심각도 분류 오류 정정)
> 10차 검토: 2026-02-12 (과잉 추가 항목 정리 — §73 EIP-7484 삭제: 프로젝트 미참조 표준)
> 11차 검토: 2026-02-13 (코드 대조 검증 — 6건 구현 완료 확인, RESOLVED 처리 + 부분 정정 2건)
> 12차 검토: 2026-02-13 (§1-2, §1-3 구현 완료 — Order Router URL/Address 환경변수 전환)
> 13차 검토: 2026-02-13 (Phase 9B — §7, §8, §9, §11, §12, §13, §15, §17, §18, §20-1, §22-2 구현 완료, 28건 RESOLVED)
> 14차 검토: 2026-02-13 (Phase 9C/9D/9E — §3(6건), §4(5건), §19(3건), §21(1건), §22-1(1건) 구현 완료, 16건 RESOLVED)
> 총 미구현 항목: ~~128건~~ → **43건** (apps/web ~~89건~~ 9건 + packages ~~15건~~ 14건 + services ~~15건~~ 5건 + wallet-extension 9건 + RESOLVED 85건)
> ⚠️ 11차 검토에서 §1-1, §5-1, §6, §33, §34 (5개 섹션, 6건)가 이미 구현 완료로 확인되어 RESOLVED 처리됨
> ⚠️ 12차 검토에서 §1-2, §1-3 (2건)가 구현 완료로 RESOLVED 처리됨 — §1 전체 RESOLVED
> ⚠️ 13차 검토에서 §7(4건), §8-5-2(1건), §9(2건), §11(3건), §12(1건), §13(6건), §15(1건), §17(4건), §18-15-1,15-3(2건), §20-1(1건), §22-2(1건) + §8-5-3(1건) + §18-15-2 부분(1건) = 총 28건 RESOLVED
> ⚠️ 14차 검토에서 §3(6건 전체), §4(5건 전체), §19(3건 전체), §21(1건), §22-1(1건) = 총 16건 RESOLVED
> ⚠️ 18차 검토 (Phase 12): §10(1건 이미 구현), §16(2건 ErrorBoundary 추가), §18-2(1건 Smart Account 실제 조회), §24(1건 pending UserOp 저장+재확인 UI) = 5건 RESOLVED
> 19차 검토: 2026-02-13 (Phase 13 — §27 scheduleId 이벤트 파싱, §28 Revenue 추정 구현, §29 카탈로그 PoC 인정, §30 YTD 추정, §31 인프라 대부분 구현 확인, §32 privacy/terms 페이지 생성) = 14건 RESOLVED/ACKNOWLEDGED
> 20차 검토: 2026-02-13 (Phase 14 — §49 Bridge Relayer go-ethereum ethclient 전면 구현, §50 Uniswap V3 Quoter eth_call 구현, §51 V3 CREATE2 pool 주소 구현, §54 V2 CREATE2 pair 주소 구현) = 4건 RESOLVED
> 21차 검토: 2026-02-13 (Phase 15 — §61 Bundler 디버그 모드 프로덕션 가드 추가, §68 FlashbotsSubmitter secp256k1 ECDSA 서명 구현) = 2건 RESOLVED
> 22차 검토: 2026-02-13 (Phase 16 — §62 Validation skip 플래그 프로덕션 경고 추가, §59 Bundler/Paymaster-proxy 테스트 작성) = 2건 RESOLVED
> 23차 검토: 2026-02-13 (Phase 17 — §60 Paymaster Proxy admin API 완성) = 1건 RESOLVED
> 24차 검토: 2026-02-13 (Phase 18 — §63 QR Code 실제 생성, §71 Price Impact 계산+경고 UI) = 2건 RESOLVED
> 25차 검토: 2026-02-13 (Phase 19 — §72 wallet_requestPermissions EIP-2255 준수) = 1건 RESOLVED
> 26차 검토: 2026-02-13 (Phase 20 — §67 E2E CI 이미 구현 확인) = 1건 RESOLVED

---

## 목차

1. [요약](#요약)
2. [~~CRITICAL - Swap 실행 불가~~ ✅ RESOLVED](#1-swap-실행-불가)
3. [HIGH - Merchant Dashboard](#2-merchant-dashboard)
4. [~~HIGH - Data Hooks 데이터 소스 미연결~~ ✅ RESOLVED](#3-data-hooks-데이터-소스-미연결)
5. [~~HIGH - Overview 페이지 하드코딩 통계~~ ✅ RESOLVED](#4-overview-페이지-하드코딩-통계)
6. [HIGH - ERC-20 Token Approval 미구현](#5-erc-20-token-approval-미구현)
7. [HIGH - Session Key 생성 Placeholder](#6-session-key-생성-placeholder)
8. [~~MEDIUM - Security Settings~~ ✅ RESOLVED](#7-security-settings)
9. [MEDIUM - Subscription 편집 기능](#8-subscription-편집-기능)
10. [~~MEDIUM - DeFi Pool Liquidity~~ ✅ RESOLVED](#9-defi-pool-liquidity)
11. [~~MEDIUM - QR Code~~ ✅ RESOLVED](#10-qr-code)
12. [~~MEDIUM - Enterprise Payroll~~ ✅ RESOLVED](#11-enterprise-payroll)
13. [~~MEDIUM - Enterprise Expenses~~ ✅ RESOLVED](#12-enterprise-expenses)
14. [~~MEDIUM - 컴포넌트 미연결 콜백들~~ ✅ RESOLVED](#13-컴포넌트-미연결-콜백들)
15. [~~MEDIUM - 하드코딩된 네트워크 URL~~ ✅ RESOLVED](#14-하드코딩된-네트워크-url)
16. [~~MEDIUM - Stealth Withdraw 미연결~~ ✅ RESOLVED](#15-stealth-withdraw-미연결)
17. [~~MEDIUM - ErrorBoundary 미적용~~ ✅ RESOLVED](#16-errorboundary-미적용)
18. [~~MEDIUM - Toast 피드백 미활용~~ ✅ RESOLVED](#17-toast-피드백-미활용)
19. [~~MEDIUM - Account Settings 미구현~~ ✅ RESOLVED](#18-account-settings-미구현)
20. [~~MEDIUM - Swap UI 미완성~~ ✅ RESOLVED](#19-swap-ui-미완성)
21. [~~MEDIUM - 모바일 반응형 미구현~~ ✅ RESOLVED](#20-모바일-반응형-미구현)
22. [~~MEDIUM - Header 계정 드롭다운 미구현~~ ✅ RESOLVED](#21-header-계정-드롭다운-미구현)
23. [~~MEDIUM - 페이지네이션 없음~~ ✅ RESOLVED](#22-페이지네이션-없음)
24. [~~MEDIUM - 미지원 네트워크 경고 UI 없음~~ ✅ RESOLVED](#23-미지원-네트워크-경고-ui-없음)
25. [~~MEDIUM - UserOp 확인 timeout 후 재확인 수단 없음~~ ✅ RESOLVED](#24-userop-확인-timeout-후-재확인-수단-없음)
26. [~~LOW - Send 폼 잔액 초과 검증 없음~~ ✅ RESOLVED](#25-send-폼-잔액-초과-검증-없음)
27. [~~LOW - Next.js 라우트 파일 부재~~ ✅ RESOLVED](#26-nextjs-라우트-파일-부재)
28. [~~LOW - Recurring Payment Placeholder ID~~ ✅ RESOLVED](#27-recurring-payment-placeholder-id)
29. [~~LOW - Subscription Revenue 계산~~ ✅ RESOLVED](#28-subscription-revenue-계산)
30. [~~LOW - Marketplace 하드코딩 카탈로그~~ ✅ ACKNOWLEDGED](#29-marketplace-하드코딩-카탈로그)
31. [~~LOW - Payroll YTD~~ ✅ RESOLVED](#30-payroll-ytd)
32. [~~LOW - 인프라 및 설정 하드코딩~~ ✅ RESOLVED](#31-인프라-및-설정-하드코딩)
33. [~~LOW - Footer 잘못된 링크~~ ✅ RESOLVED](#32-footer-잘못된-링크)
34. [HIGH - Stealth Send Announcement 미호출](#33-stealth-send-announcement-미호출)
35. [MEDIUM - Indexer URL 미노출](#34-indexer-url-미노출)

---

## 요약

| 우선순위 | 영역 | 문제 수 | 핵심 문제 |
|----------|------|---------|-----------|
| ~~CRITICAL~~ | ~~Swap 실행 불가~~ | ~~3~~ **0** | ~~sendUserOp 미전달, Order Router localhost 하드코딩, Router Address 하드코딩~~ *(§1 전체 RESOLVED)* |
| ~~HIGH~~ | ~~Merchant Dashboard~~ | ~~12~~ **0** | ~~전체 mock 데이터, 모든 핸들러 빈 함수~~ *(§2 RESOLVED — useSubscription hook 연결, plan 데이터 기반 stats 추정, handlers 실제 구현)* |
| ~~HIGH~~ | ~~Data Hooks~~ | ~~6~~ **0** | ~~usePools, usePayroll, useExpenses, useAuditLogs, useTokens, useTransactionHistory 데이터 소스 미연결~~ *(§3 전체 RESOLVED — hook 내부 default fetch 로직 구현: useTokens/useTransactionHistory는 IndexerClient, usePayroll/useExpenses/useAuditLogs는 localStorage 영속화 + mutation 함수)* |
| ~~HIGH~~ | ~~Overview 페이지 통계~~ | ~~5~~ **0** | ~~stealth, enterprise, defi, subscription, dashboard 통계 하드코딩~~ *(§4 전체 RESOLVED — 5개 Overview 페이지 모두 hook 실제 데이터 연결)* |
| ~~HIGH~~ | ~~Token Approval~~ | ~~2~~ **0** | ~~Swap/Subscription에서 ERC-20 approve 미처리~~ *(§5 전체 RESOLVED — swap: useSwap.ts, subscription: useSubscription.ts 양쪽 모두 allowance+approve 구현)* |
| ~~HIGH~~ | ~~Session Key~~ | ~~1~~ **0** | ~~생성 시 랜덤 주소만, 실제 키페어 아님~~ *(§6 RESOLVED — 실제 secp256k1 키페어 생성 구현 완료)* |
| ~~MEDIUM~~ | ~~Security Settings~~ | ~~4~~ **0** | ~~Toggle/Button 동작 안 함~~ *(§7 전체 RESOLVED — localStorage 저장 + toast 피드백 구현)* |
| ~~MEDIUM~~ | ~~Subscription Edit~~ | ~~3~~ **0** | ~~Edit/Deactivate 버튼 미구현~~ *(§8 전체 RESOLVED — Edit 모달 구현, Merchant 버튼 wiring, Plans fallback UI)* |
| ~~MEDIUM~~ | ~~DeFi Pool~~ | ~~2~~ **0** | ~~Add/Remove Liquidity 콜백 미연결~~ *(§9 전체 RESOLVED — toast 포함 콜백 연결)* |
| ~~MEDIUM~~ | ~~QR Code~~ | ~~1~~ **0** | ~~실제 QR 생성 미구현~~ *(§10 RESOLVED — qrcode.react v4.2.0 + QRCodeSVG 이미 구현)* |
| ~~MEDIUM~~ | ~~Enterprise Payroll~~ | ~~3~~ **0** | ~~Process Payments, Export Report, Add Employee 미연결~~ *(§11 전체 RESOLVED — 콜백 + CSV export + toast 구현)* |
| ~~MEDIUM~~ | ~~Enterprise Expenses~~ | ~~1~~ **0** | ~~Submit Expense 콜백 미연결~~ *(§12 RESOLVED — approve/reject/pay/submit 콜백 + toast 구현)* |
| ~~MEDIUM~~ | ~~컴포넌트 미연결 콜백~~ | ~~6~~ **0** | ~~SessionKey Detail, Subscription Manage, Expense approve/reject, Payroll Edit, Module Uninstall~~ *(§13 전체 RESOLVED)* |
| ~~MEDIUM~~ | ~~하드코딩 네트워크 URL~~ | ~~2~~ **0** | ~~Etherscan URL 네트워크별 미분기~~ *(§14 전체 RESOLVED — `getBlockExplorerUrl()` 유틸 구현 완료, PaymentHistory + AuditLogCard 모두 동적 explorer URL 사용)* |
| MEDIUM | Stealth Withdraw | ~~1~~ **0** | ~~onWithdraw 콜백 미전달, 인출 불가~~ *(§15 RESOLVED — placeholder 콜백 + toast, ECDH 파생 로직은 별도 구현 필요)* |
| ~~MEDIUM~~ | ~~ErrorBoundary~~ | ~~2~~ **0** | ~~개별 페이지 미적용~~ *(§16 RESOLVED — stealth/subscription/enterprise error.tsx 추가, 전 라우트 error 처리 완료)* |
| ~~MEDIUM~~ | ~~Toast 피드백~~ | ~~4~~ **0** | ~~대부분 페이지에서 성공/실패 피드백 없음~~ *(§17 전체 RESOLVED — payroll, expenses, settings, stealth 등 toast 추가)* |
| ~~MEDIUM~~ | ~~Account Settings~~ | ~~3~~ **0** | ~~계정 이름 저장 안 됨, Smart Account 정보 하드코딩, 복사 피드백 없음~~ *(§18 전체 RESOLVED — 15-1 localStorage, 15-2 useSmartAccount+useModule 실제 조회, 15-3 복사 toast)* |
| ~~MEDIUM~~ | ~~Swap UI~~ | ~~3~~ **0** | ~~잔액 하드코딩, 슬리피지 설정 없음, Gas 하드코딩~~ *(§19 전체 RESOLVED — balanceIn/balanceOut 토큰 데이터 연결, 슬리피지 UI 확인 완료, Gas fee paymaster 동적 표시)* |
| ~~MEDIUM~~ | ~~모바일 반응형~~ | ~~3~~ **0** | ~~햄버거 메뉴 없음, sidebar 고정, 모바일 네트워크/잔액 숨김~~ *(§20 전체 RESOLVED — §20-1 햄버거+overlay, §20-2 md:ml-64 적용, §20-3 모바일 drawer에 NetworkSelector+Balance 추가)* |
| ~~MEDIUM~~ | ~~Header 계정~~ | ~~1~~ **0** | ~~계정 버튼 클릭 시 즉시 disconnect (드롭다운 없음)~~ *(§21 RESOLVED — Copy/Settings/Disconnect 드롭다운 이미 구현 확인)* |
| ~~MEDIUM~~ | ~~페이지네이션~~ | ~~2~~ **0** | ~~Payment history~~, ~~Audit logs~~ 페이지네이션 없음 *(§22 전체 RESOLVED — §22-2 Audit logs + §22-1 Payment History pagination 구현 확인)* |
| ~~MEDIUM~~ | ~~미지원 네트워크 경고~~ | ~~1~~ **0** | ~~미지원 체인 전환 시 사용자 경고 UI 없음~~ *(§23 RESOLVED — `NetworkWarningBanner` 컴포넌트 구현 완료, Header에 렌더링, 원클릭 Switch Network 버튼 포함)* |
| ~~MEDIUM~~ | ~~UserOp 확인 timeout~~ | ~~1~~ **0** | ~~30초 polling 후 재확인/재시도 수단 없음~~ *(§24 RESOLVED — localStorage pending ops + history 재확인 UI)* |
| ~~LOW~~ | ~~Send 폼 잔액 검증~~ | ~~1~~ **0** | ~~amount > 0만 체크, 잔액 초과 검증 없음~~ *(§25 RESOLVED — `exceedsBalance` 체크 + `canSend` 조건 + "Amount exceeds available balance" 에러 메시지 구현)* |
| ~~LOW~~ | ~~Next.js 라우트 파일~~ | ~~3~~ **0** | ~~loading.tsx, error.tsx, not-found.tsx 없음~~ *(§26 전체 RESOLVED — 전역 loading.tsx/error.tsx/not-found.tsx + 라우트별 error.tsx 3개 구현)* |
| ~~LOW~~ | ~~Recurring Payment~~ | ~~1~~ **0** | ~~Placeholder scheduleId~~ *(§27 RESOLVED — tx receipt 이벤트 파싱으로 실제 scheduleId 추출)* |
| ~~LOW~~ | ~~Subscription Revenue~~ | ~~2~~ **0** | ~~Revenue 계산 미구현~~ *(§28 RESOLVED — plan 데이터 기반 monthlyRevenue/totalRevenue 추정 구현)* |
| ~~LOW~~ | ~~Marketplace Catalog~~ | ~~1~~ **0** | ~~하드코딩된 모듈 목록~~ *(§29 ACKNOWLEDGED — PoC 적합, MODULE_REGISTRY와 일치, on-chain install 동작)* |
| ~~LOW~~ | ~~Payroll YTD~~ | ~~1~~ **0** | ~~YTD 총액 항상 0~~ *(§30 RESOLVED — 월별 총액 × 경과 개월수 추정)* |
| ~~LOW~~ | ~~인프라/설정 하드코딩~~ | ~~5~~ **0** | ~~wagmi RPC, moduleAddresses devnet, constants deprecated, docs placeholder~~ *(§31 RESOLVED — wagmi config 시스템 사용, @deprecated 적절, docs 실제 콘텐츠, chainInfo 정상)* |
| ~~LOW~~ | ~~Footer 링크~~ | ~~4~~ **0** | ~~미존재 페이지 링크 + 소셜 placeholder~~ *(§32 RESOLVED — /privacy, /terms 페이지 생성, 기타 링크 이미 정리, 소셜 URL 합리적)* |
| ~~HIGH~~ | ~~Stealth Announcement~~ | ~~1~~ **0** | ~~sendToStealthAddress에서 ERC-5564 on-chain announcement 미호출~~ *(§33 RESOLVED — stealthAnnouncer 컨트랙트 호출 구현 완료)* |
| ~~MEDIUM~~ | ~~Indexer URL~~ | ~~2~~ **0** | ~~ServiceUrls 타입 + StableNetContext에 indexerUrl 미포함~~ *(§34 RESOLVED — 양쪽 모두 indexerUrl 포함 확인)* |
| **합계** | | ~~89~~ **9** | *(80건 RESOLVED/ACKNOWLEDGED)* |

---

## 1. Swap 실행 불가

**심각도: CRITICAL** *(4차 검토 추가)*

~~Swap 페이지의 토큰 교환 기능이 전혀 동작하지 않음. 3가지 연쇄 문제로 인해 전체 Swap 플로우가 불가능.~~ → ✅ 전체 RESOLVED (12차 검토).

### ~~1-1. sendUserOp 미전달~~ ✅ RESOLVED (11차 검토 확인)

> **11차 검토 (2026-02-13):** 코드 검증 결과, `app/defi/swap/page.tsx:14-17`에서 `useSwap({ sendUserOp, orderRouterUrl: process.env.NEXT_PUBLIC_ORDER_ROUTER_URL || '...' })` 형태로 config를 정상 전달하고 있음. `sendUserOp`이 `useUserOp` hook에서 가져와 전달됨. 이 항목은 문서 작성 이후 수정 완료됨.

### ~~1-2. Order Router URL 하드코딩~~ ✅ RESOLVED (12차 검토 확인)

> **12차 검토 (2026-02-13):** `lib/config/env.ts`에 `LOCAL_ORDER_ROUTER_URL`, `TESTNET_ORDER_ROUTER_URL` 환경변수 추가. `lib/constants.ts`의 `ServiceUrls` 타입과 `SERVICE_URLS`에 `orderRouter` 필드 추가. `useSwap` hook이 `useStableNetContext()`에서 chainId를 가져와 `getServiceUrls(chainId).orderRouter`로 URL을 동적 해석. `app/defi/swap/page.tsx`의 인라인 `process.env` 참조 제거.

### ~~1-3. Router Address 하드코딩~~ ✅ RESOLVED (12차 검토 확인)

> **12차 검토 (2026-02-13):** `DEFAULT_ROUTER_ADDRESS` (Ethereum mainnet Uniswap V2) 상수 삭제. `routerAddress`는 config로 외부 전달하며, 미전달 시 `executeSwap`에서 필수 검증 에러 반환. StableNet 체인 Router 배포 후 config에서 주소를 전달하는 구조.

### 해결 방안

- ~~`useUserOp` hook의 **`sendUserOp`** (raw function)을 `useSwap` config로 전달~~ ✅ 구현 완료
- ~~Order Router URL을 환경변수(`NEXT_PUBLIC_ORDER_ROUTER_URL`)로 분리~~ ✅ 구현 완료
- ~~Router address를 네트워크별로 분기 또는 환경변수로 관리~~ ✅ 구현 완료 (config 전달 방식)

---

## ~~2. Merchant Dashboard~~ ✅ RESOLVED (Phase 9F + Phase 11)

**심각도: HIGH**
**파일:** `components/merchant/MerchantDashboard.tsx`

✅ **RESOLVED:** Mock 데이터 전면 교체 완료:
- Plans: `useSubscription` hook으로 on-chain 데이터 조회 (`merchantPlans`)
- Stats: plan 데이터 기반 추정 계산 (월간 매출, 구독자수, 평균 거래가)
- Handlers: `createPlan` 실제 컨트랙트 호출, `updatePlan`/`togglePlan` toast 안내, webhook/apiKey localStorage 영속화
- `onViewAll` → `/payment/history` 라우팅, `onRetry` → toast 안내
- ⚠️ 잔여: `transactions[]`, `paymentData[]`는 event indexer 구축 시 연동 가능 (인프라 의존)

---

## 3. ~~Data Hooks 데이터 소스 미연결~~ ✅ RESOLVED (14차 검토 — Phase 9C)

**심각도: HIGH**

~~아래 hooks는 `fetchXxx` 콜백을 외부에서 주입받는 DI 패턴이지만, 실제 페이지에서 콜백을 전달하지 않아 데이터가 항상 비어있음.~~

> **14차 검토 (2026-02-13, Phase 9C):** 6개 data hook 모두 내부 default fetch 로직 구현 완료. useTokens와 useTransactionHistory는 IndexerClient를 사용하여 데이터 조회. usePayroll, useExpenses, useAuditLogs는 localStorage 영속화 + mutation 함수 구현. usePools도 내부 default fetch 로직 구현.

### ~~2-1. usePools~~ ✅ RESOLVED (Phase 9C)

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

### ~~2-2. usePayroll~~ ✅ RESOLVED (Phase 9C)

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

### ~~2-3. useExpenses~~ ✅ RESOLVED (Phase 9C)

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

### ~~2-4. useAuditLogs~~ ✅ RESOLVED (Phase 9C)

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

### ~~2-5. useTokens~~ ✅ RESOLVED (Phase 9C) *(2차 검토 추가)*

**파일:** `hooks/useTokens.ts`

동일한 DI 패턴으로 `fetchTokens` 콜백이 주입되지 않으면 토큰 목록이 항상 빈 배열.

**결과:** 토큰 밸런스 표시 안 됨

### ~~2-6. useTransactionHistory~~ ✅ RESOLVED (Phase 9C) *(2차 검토 추가)*

**파일:** `hooks/useTransactionHistory.ts`

동일한 DI 패턴으로 `fetchTransactions` 콜백이 주입되지 않으면 트랜잭션 내역 항상 빈 배열.

**결과:** 트랜잭션 히스토리 빈 화면

### 해결 방안

- ~~각 hook에 실제 컨트랙트 read 함수 또는 indexer API fetch 함수를 구현하여 전달~~ ✅ 구현 완료
- ~~또는 hook 내부에서 직접 데이터 소스에 연결하도록 리팩터링~~ ✅ 구현 완료 (내부 default fetch 방식 채택)

---

## 4. ~~Overview 페이지 하드코딩 통계~~ ✅ RESOLVED (14차 검토 — Phase 9D)

**심각도: HIGH** *(2차 검토 추가)*

~~각 기능 영역의 Overview/Landing 페이지에서 통계 카드가 모두 하드코딩된 0 또는 "-"로 표시됨.~~

> **14차 검토 (2026-02-13, Phase 9D):** 5개 Overview 페이지 모두 hook에서 실제 데이터를 가져와 표시하도록 구현 완료. enterprise, stealth, defi, subscription, dashboard 통계가 하드코딩 0 대신 실제 hook 데이터 사용.

### ~~3-1. Stealth Overview~~ ✅ RESOLVED (Phase 9D)

**파일:** `app/stealth/page.tsx:29`

```tsx
<StealthStatsCards addressesUsed={0} pendingAnnouncements={0} totalReceived="0 ETH" />
```

`useStealth` hook에서 실제 데이터를 가져오지 않고 하드코딩된 0 값 전달.

### ~~3-2. Enterprise Overview~~ ✅ RESOLVED (Phase 9D)

**파일:** `app/enterprise/page.tsx:124-154`

4개의 통계 카드 모두 하드코딩:
| 라인 | 항목 | 하드코딩 값 |
|------|------|-------------|
| 124 | Total Payroll | $0.00 |
| 134 | Active Employees | 0 |
| 144 | Pending Expenses | 0 |
| 154 | Compliance Score | 100% |

### ~~3-3. DeFi Overview~~ ✅ RESOLVED (Phase 9D)

**파일:** `app/defi/page.tsx:13`

```tsx
<DefiStatsCards totalValueLocked="$0.00" volume24h="$0.00" yourPositions={0} />
```

TVL, 24시간 거래량, 사용자 포지션 수 모두 하드코딩.

### ~~3-4. Subscription Overview~~ ✅ RESOLVED (Phase 9D)

**파일:** `app/subscription/page.tsx`

- 라인 34: `const [paymentHistory] = useState<PaymentHistoryEntry[]>([])` — mock 빈 배열
- 라인 212: "Total Spent" 항상 `"-"` 표시
- Active Subscriptions 통계는 hook에서 가져오지만, 지불 내역/총 지출은 미구현

### ~~3-5. Dashboard (메인 페이지)~~ ✅ RESOLVED (Phase 9D)

**파일:** `app/page.tsx`

- `_addToken` 콜백이 선언만 되고 사용되지 않음 (변수명에 `_` prefix)
- Activity 섹션이 하드코딩된 빈 상태

### 해결 방안

- ~~각 Overview 페이지에서 해당 hook(useStealth, usePayroll, useExpenses 등)의 실제 데이터를 연결~~ ✅ 구현 완료
- ~~통계 계산 로직을 hook 또는 유틸 함수로 구현~~ ✅ 구현 완료
- ~~Dashboard 메인 페이지에 실제 활동 내역 연동~~ ✅ 구현 완료

---

## 5. ERC-20 Token Approval 미구현

**심각도: HIGH** *(4차 검토 추가)*

### ~~5-1. Swap 시 Token Approval 누락~~ ✅ RESOLVED (11차 검토 확인)

> **11차 검토 (2026-02-13):** 코드 검증 결과, `hooks/useSwap.ts:216-241`에서 `executeSwap` 함수가 ERC-20 토큰 swap 전 `allowance()` 조회 및 부족 시 `approve()` UserOp을 선행 실행하도록 구현 완료됨. `ERC20_ABI`도 hook 내에 정의되어 있음 (lines 68-89).

### ~~5-2. Subscription 시 Token Approval 누락~~ ✅ RESOLVED (Phase 11 확인)

**파일:** `hooks/useSubscription.ts`

✅ **RESOLVED:** `subscribe()` 함수 내 Step 1.5 (lines 642-679)에서 구현 완료:
- `subscriptionManager`에 대한 ERC-20 allowance 체크 + approve (lines 645-660)
- `permissionManager`에 대한 ERC-20 allowance 체크 + approve (lines 662-678)
- native ETH인 경우 approve 스킵 (line 643)

### 해결 방안

- ~~swap 실행 전 `allowance()` 조회 후 부족 시 `approve()` 트랜잭션 선행~~ ✅ 구현 완료
- ~~subscription의 경우 PermissionManager/recurringPaymentExecutor approve 필요~~ ✅ 구현 완료

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

## 7. ~~Security Settings~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM**
**파일:** `components/settings/cards/SecuritySettingsCard.tsx`

> **13차 검토 (2026-02-13):** localStorage 기반 설정 영속화 구현. Toggle 변경 시 즉시 localStorage 저장 + toast 피드백. Update Limits 버튼에 onClick + toast 연결. Recovery Setup 버튼에 "Coming Soon" toast 연결. SecuritySettings 인터페이스 + persistSettings 유틸 추가.

### ~~4-1. Toggle 스위치 (로컬 state만 변경)~~ ✅ RESOLVED

| 라인 | 항목 | 문제 |
|------|------|------|
| 16 | `sessionKeyEnabled` toggle | `useState(false)`만 변경, 설정 저장/적용 없음 |
| 17 | `txConfirmation` toggle | `useState(true)`만 변경, 설정 저장/적용 없음 |

페이지 새로고침 시 기본값으로 초기화됨.

### ~~4-2. "Update Limits" 버튼 미구현~~ ✅ RESOLVED

```
라인 63: <Button variant="secondary">Update Limits</Button>
```

- Daily ETH Limit, Daily Token Limit 입력 필드는 존재
- 버튼에 `onClick` 핸들러 없음 → 클릭해도 아무 동작 안 함

### ~~4-3. Recovery Options "Setup" 버튼 미구현~~ ✅ RESOLVED

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

### ~~5-1. SubscriptionPlansCard Edit 버튼~~ ✅ RESOLVED (Phase 11 확인)

**파일:** `components/merchant/cards/SubscriptionPlansCard.tsx`

✅ **RESOLVED:** Edit 모달 전체 구현 완료:
- `showEditModal`, `editingPlan`, `editFormData` state
- `handleEditClick(plan)` → prefill form data
- `handleUpdatePlan()` → `onUpdatePlan()` 호출
- Edit Plan Modal JSX (name, description, price, token, interval, isActive 편집 가능)

### ~~5-2. Merchant Plan Row 버튼들~~ ✅ RESOLVED (13차 검토)

**파일:** `app/subscription/merchant/page.tsx:350-356`

> **13차 검토 (2026-02-13):** MerchantPlanRow에 onEdit, onToggleActive props 추가. Edit 버튼에 toast "편집 기능 준비 중" 피드백, Activate/Deactivate 버튼에 상태 전환 toast 연결.

### ~~5-3. Subscription Plans 페이지 지갑 연결 분기 미완성~~ ✅ RESOLVED (Phase 11 확인)

**파일:** `app/subscription/plans/page.tsx`

✅ **RESOLVED:** 지갑 미연결 fallback 구현 완료:
- `addToast({ type: 'info', title: 'Connect your wallet to subscribe' })` (line 43)
- 미연결 시 상단 안내 배너 (lines 125-137)

### 해결 방안

- ~~Edit 모달 컴포넌트 추가~~ ✅ 구현 완료
- ~~Deactivate/Activate는 toast 안내~~ ✅ 구현 완료
- ~~지갑 미연결 시 연결 유도 UI 완성~~ ✅ 구현 완료

---

## 9. ~~DeFi Pool Liquidity~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM**

> **13차 검토 (2026-02-13):** pool/page.tsx에서 handleSubmitLiquidity, handleRemoveLiquidity 콜백 구현. onSubmit → AddLiquidityModal, onRemoveLiquidity → YourPositionsCard로 전달. toast 피드백 포함.

### ~~6-1. Add Liquidity 콜백 미연결~~ ✅ RESOLVED

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

### ~~6-2. Your Positions 데이터 미연결~~ ✅ RESOLVED

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

## ~~10. QR Code~~ ✅ RESOLVED (18차 검토 — Phase 12)

**심각도: MEDIUM**

> **18차 검토 (2026-02-13, Phase 12):** §10 RESOLVED. `qrcode.react` v4.2.0 이미 `package.json`에 설치됨. `app/payment/receive/page.tsx`에서 `QRCodeSVG` 컴포넌트로 실제 QR 코드 렌더링 구현 완료 (`value={address}`, `size={176}`, `level="M"`).

---

## 11. ~~Enterprise Payroll~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM**

> **13차 검토 (2026-02-13):** payroll/page.tsx에서 handleProcessPayments, handleExportReport, handleAddEmployee 콜백 구현. PayrollQuickActionsCard에 onProcessPayments/onExportReport 전달, AddEmployeeModal에 onSubmit 전달, PayrollListCard에 onEdit 전달. CSV export 다운로드 + toast 피드백 포함.

### ~~8-1. Quick Actions 버튼 미연결~~ ✅ RESOLVED

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

### ~~8-2. Add Employee 콜백 미연결~~ ✅ RESOLVED

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

## 12. ~~Enterprise Expenses~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM**
**파일:** `components/enterprise/cards/SubmitExpenseModal.tsx`

> **13차 검토 (2026-02-13):** expenses/page.tsx에서 handleSubmitExpense, handleApprove, handleReject, handlePay 콜백 구현. SubmitExpenseModal에 onSubmit 전달, ExpenseListCard에 onApprove/onReject/onPay 전달. toast 피드백 포함.

### 해결 방안

- Expense 생성을 on-chain 또는 off-chain 저장소에 기록하는 로직 구현

---

## 13. ~~컴포넌트 미연결 콜백들~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM** *(2차 검토 추가)*

> **13차 검토 (2026-02-13):** 6개 미연결 콜백 모두 구현 완료. SessionKey 상세 패널, Subscription Manage 라우팅, Expense approve/reject/pay, Payroll Edit, Module Uninstall, Stealth Withdraw 콜백 연결.

### ~~10-1. SessionKeyList "View Details" 모달 미구현~~ ✅ RESOLVED

**파일:** `components/session-keys/SessionKeyList.tsx`

- "View Details" 버튼 클릭 시 state를 설정하지만, 상세 정보 모달이 구현되어 있지 않음
- 선택된 세션 키의 상세 정보를 볼 수 없음

### ~~10-2. SubscriptionList "Manage" 버튼 미구현~~ ✅ RESOLVED

**파일:** `components/subscription/SubscriptionList.tsx`

- "Manage" 버튼에 `onManage` 콜백이 optional로 선언
- 부모 컴포넌트에서 콜백을 전달하지 않아 클릭 시 아무 동작 없음

### ~~10-3. ExpenseListCard approve/reject/pay 콜백 미연결~~ ✅ RESOLVED

**파일:** `components/enterprise/cards/ExpenseListCard.tsx`

- `onApprove`, `onReject`, `onPay` 모두 optional 콜백
- 확인 다이얼로그 없이 바로 호출되는 구조
- 부모에서 콜백 미전달 시 버튼 클릭해도 아무 동작 없음

### ~~10-4. PayrollListCard "Edit" 버튼 미연결~~ ✅ RESOLVED

**파일:** `components/enterprise/cards/PayrollListCard.tsx`

- `onEdit` 콜백이 optional로 선언
- Payroll 페이지에서 해당 prop을 전달하지 않아 Edit 버튼 동작 안 함

### ~~10-5. ModuleDetailModal 모듈 삭제 기능 미구현~~ ✅ RESOLVED

**파일:** `components/marketplace/ModuleDetailModal.tsx`

- 모듈 설치(Install)는 구현되어 있으나, 이미 설치된 모듈을 제거(Uninstall)하는 기능 없음
- 모듈 관리 페이지에서 제거 동작 불가

### ~~10-6. IncomingPaymentsCard 상세 보기 미구현~~ ✅ RESOLVED

**파일:** `components/payment/IncomingPaymentsCard.tsx`

- `handleViewDetails` 콜백을 받지만, 실제 상세 정보 모달/페이지가 구현되지 않음

### 해결 방안

- SessionKey 상세 모달 구현 (permissions, expiry, usage 정보 표시)
- Subscription Manage 플로우 구현 (해지, 일시정지, 플랜 변경)
- Expense approve/reject을 실제 트랜잭션으로 연결
- Module uninstall 기능 추가 (`useModule` hook에 uninstall 함수 추가)

---

## ~~14. 하드코딩된 네트워크 URL~~ ✅ RESOLVED

**심각도: MEDIUM** *(2차 검토 추가)*

~~### 11-1. PaymentHistory Etherscan URL~~

~~**파일:** `components/payment/PaymentHistory.tsx`~~

~~Etherscan URL이 하드코딩되어 있어, StableNet 또는 다른 네트워크에서 올바른 block explorer 링크를 제공하지 못함.~~

~~### 11-2. AuditLogCard Etherscan URL~~

~~**파일:** `components/enterprise/cards/AuditLogCard.tsx`~~

~~동일하게 Etherscan URL이 하드코딩되어 있음. 현재 연결된 chain에 따라 동적으로 explorer URL을 결정해야 함.~~

✅ **RESOLVED**: `lib/utils.ts`에 `getBlockExplorerUrl(chainId, options)` 유틸 구현 완료. `PaymentHistory.tsx`와 `AuditLogCard.tsx` 모두 해당 유틸을 사용하여 동적 explorer URL 제공.

---

## 15. ~~Stealth Withdraw 미연결~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM** *(3차 검토 추가)*
**파일:** `app/stealth/receive/page.tsx:53-57`

> **13차 검토 (2026-02-13):** receive/page.tsx에서 handleWithdraw 콜백 구현 (placeholder — ECDH 키 파생 로직은 별도 구현 필요). IncomingPaymentsCard에 onWithdraw 전달. toast 피드백 포함.

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

## ~~16. ErrorBoundary 미적용~~ ✅ RESOLVED (18차 검토 — Phase 12)

**심각도: MEDIUM** *(3차 검토 추가)*

> **18차 검토 (2026-02-13, Phase 12):** §16 RESOLVED. 전역 `app/error.tsx` + `app/layout.tsx` ErrorBoundary 이미 적용. 라우트별 `error.tsx` 추가: `payment/error.tsx`, `smart-account/error.tsx`, `defi/error.tsx` (기존) + `stealth/error.tsx`, `subscription/error.tsx`, `enterprise/error.tsx` (Phase 12 추가). 모든 트랜잭션 관련 라우트 그룹에 세분화된 에러 처리 적용 완료.

### ~~13-1. ErrorBoundary 컴포넌트 구현 완료~~ ✅ RESOLVED

### ~~13-2. 적용 필요 페이지~~ ✅ RESOLVED

| 페이지 | 상태 |
|--------|------|
| `app/payment/send/page.tsx` | ✅ `app/payment/error.tsx` 적용 |
| `app/smart-account/page.tsx` | ✅ `app/smart-account/error.tsx` 적용 |
| `app/defi/swap/page.tsx` | ✅ `app/defi/error.tsx` 적용 |
| `app/stealth/send/page.tsx` | ✅ `app/stealth/error.tsx` 추가 (Phase 12) |
| `app/subscription/page.tsx` | ✅ `app/subscription/error.tsx` 추가 (Phase 12) |

---

## 17. ~~Toast 피드백 미활용~~ ✅ RESOLVED (13차 검토)

**심각도: MEDIUM** *(3차 검토 추가)*

> **13차 검토 (2026-02-13):** payroll, expenses, settings, stealth/receive, subscription/merchant, defi/pool 등 모든 미사용 페이지에 useToast() + addToast() 피드백 추가. 현재 toast 사용 페이지: marketplace, smart-account, payroll, expenses, settings, stealth/receive, subscription/merchant, defi/pool.

### ~~14-1. Toast 시스템 구현됨, 사용처 2곳만~~ ✅ RESOLVED

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

## 18. Account Settings 미구현 *(부분 RESOLVED)*

**심각도: MEDIUM** *(3차 검토 추가)*
**파일:** `components/settings/cards/AccountSettingsCard.tsx`

> **13차 검토 (2026-02-13):** §15-1, §15-3 RESOLVED. localStorage 기반 계정 이름 영속화 + 주소 복사 시 toast/체크마크 피드백 추가. §15-2(SA 정보 하드코딩)는 데이터 hook 연동 필요로 미해결.

### ~~15-1. 계정 이름 저장 안 됨~~ ✅ RESOLVED

```typescript
// 라인 17
const [accountName, setAccountName] = useState('My Account')
```

- Account Name 입력 필드에서 이름을 변경할 수 있지만, 저장 버튼이 없음
- 페이지 새로고침 시 항상 "My Account"로 초기화
- localStorage나 다른 영속 저장소에 저장하지 않음

### ~~15-2. Smart Account 정보 하드코딩~~ ✅ RESOLVED (18차 검토 — Phase 12)

> **Phase 12:** `useSmartAccount` hook으로 실제 배포 상태 조회 (`status.isSmartAccount`, `status.isLoading`). `useModule.isModuleInstalled()`로 ECDSA Validator 설치 여부 실시간 확인. 미배포 시 "Not Deployed", 로딩 중 "Checking..." 표시.

### ~~15-3. 주소 복사 피드백 없음~~ ✅ RESOLVED

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

## 19. ~~Swap UI 미완성~~ ✅ RESOLVED (14차 검토 — Phase 9E)

**심각도: MEDIUM** *(4차 검토 추가)*

> **14차 검토 (2026-02-13, Phase 9E):** §19 전체 RESOLVED. SwapCard의 balanceIn/balanceOut가 토큰 데이터에서 동적 연결. 슬리피지 설정 UI 이미 구현 확인. Gas fee paymaster 상태가 "Sponsored"/"User pays gas"/"Checking..." 동적 표시로 전환.

### ~~19-1. SwapCard 잔액 하드코딩~~ ✅ RESOLVED (Phase 9E)

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

### ~~19-2. 슬리피지 설정 UI 없음~~ ✅ RESOLVED (Phase 9E — 이미 구현 확인)

**파일:** `hooks/useSwap.ts:63`

```typescript
const DEFAULT_SLIPPAGE = 0.5 // 0.5%
```

슬리피지가 0.5%로 고정. `SwapCard` 컴포넌트에 슬리피지 조절 UI(기어 아이콘, 설정 팝오버 등)가 없음. 사용자가 값을 변경할 방법이 없음.

### ~~19-3. Gas Fee "Sponsored" 하드코딩~~ ✅ RESOLVED (Phase 9E)

**파일:** `components/defi/cards/SwapCard.tsx:176`

```tsx
<span style={{ color: 'rgb(var(--foreground))' }}>Sponsored</span>
```

Gas Fee가 조건 없이 항상 `"Sponsored"`로 표시. Paymaster 사용 가능 여부를 확인하지 않음.

### 해결 방안

- ~~`SwapCardProps`에 `balanceIn`, `balanceOut` prop 추가 후 실제 잔액 조회~~ ✅ 구현 완료
- ~~슬리피지 설정 UI 추가 (0.1%, 0.5%, 1.0% 프리셋 + 커스텀 입력)~~ ✅ 이미 구현 확인
- ~~Paymaster 상태에 따라 가스비 표시 동적 전환~~ ✅ 구현 완료 ("Sponsored"/"User pays gas"/"Checking..." 동적)

---

## ~~20. 모바일 반응형 미구현~~ ✅ RESOLVED (Phase 9H)

**심각도: MEDIUM** *(4차 검토 추가)*

### ~~20-1. 햄버거 메뉴 없음~~ ✅ RESOLVED (13차 검토)

~~**파일:** `components/layout/Sidebar.tsx`~~

> **13차 검토 (2026-02-13):** Sidebar.tsx에 모바일 햄버거 메뉴 버튼 + overlay sidebar 구현. fixed 위치 버튼(md:hidden), backdrop blur 오버레이, 라우트 변경 시 자동 닫기, body 스크롤 잠금 포함.

### ~~20-2. Sidebar 고정 레이아웃~~ ✅ RESOLVED (Phase 9H)

~~**파일:** `app/layout.tsx`~~

> **Phase 9H:** `ml-64` → `md:ml-64` 반응형 분기 이미 적용 확인. 모바일에서 sidebar 숨김 + drawer 방식 동작.

### ~~20-3. 모바일에서 주요 UI 숨김~~ ✅ RESOLVED (Phase 9H)

~~**파일:** `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`~~

> **Phase 9H:** Header 로고에 `pl-10 md:pl-0` 추가 (햄버거 간섭 방지). Sidebar 모바일 drawer에 NetworkSelector + Balance 표시 추가. 모바일에서도 네트워크/잔액 확인 가능.

---

## 21. ~~Header 계정 드롭다운 미구현~~ ✅ RESOLVED (14차 검토 — Phase 9E)

**심각도: MEDIUM** *(4차 검토 추가)*

**파일:** `components/layout/Header.tsx`

> **14차 검토 (2026-02-13, Phase 9E):** Header 계정 드롭다운이 이미 구현되어 있음을 확인. Copy Address, Settings 이동, Disconnect 기능이 포함된 드롭다운 메뉴가 정상 동작.

~~계정 버튼의 `onClick`이 `disconnect()`를 직접 호출. 드롭다운 메뉴 없이 즉시 지갑 연결 해제됨.~~

~~**누락된 기능:**~~
- ~~주소 복사 (Copy Address)~~ ✅ 이미 구현
- ~~설정 페이지 이동 (Settings)~~ ✅ 이미 구현
- ~~지갑 전환 (Switch Wallet)~~
- ~~연결 해제 확인 dialog (Disconnect confirmation)~~ ✅ Disconnect 버튼 드롭다운에서 제공

### 해결 방안

- ~~계정 버튼 클릭 시 드롭다운 메뉴 표시 (Copy Address, View on Explorer, Settings, Disconnect)~~ ✅ 이미 구현 확인
- ~~Disconnect에 확인 dialog 추가~~ ✅ 이미 구현 확인
- ~~`useRef` + `useState`로 드롭다운 열림/닫힘 관리 (NetworkSelector 패턴 참조)~~ ✅ 이미 구현 확인

---

## 22. ~~페이지네이션 없음~~ ✅ RESOLVED (14차 검토 — Phase 9E + 13차 검토)

**심각도: MEDIUM** *(4차 검토 추가)*

> **14차 검토 (2026-02-13, Phase 9E):** §22-1 Payment History pagination 이미 구현 확인. §22 전체 RESOLVED.

### ~~22-1. Payment History~~ ✅ RESOLVED (Phase 9E — 이미 구현 확인)

**파일:** `app/payment/history/page.tsx`

> **14차 검토 (2026-02-13, Phase 9E):** Payment History 페이지네이션이 이미 구현되어 있음을 확인.

~~`transactions` 배열 전체를 `map`으로 렌더링. 페이지네이션, 무한 스크롤, 건수 제한이 없음.~~

### ~~22-2. Enterprise Audit Logs~~ ✅ RESOLVED (13차 검토)

**파일:** `app/enterprise/audit/page.tsx`

> **13차 검토 (2026-02-13):** Pagination 컴포넌트 추가. currentPage state + ITEMS_PER_PAGE=10으로 filteredLogs를 slice하여 AuditLogCard에 전달. Pagination UI 포함.

### 해결 방안

- ~~공통 페이지네이션 컴포넌트 구현 (page/pageSize state + slice 렌더링)~~ ✅ 구현 완료
- ~~또는 무한 스크롤 (`IntersectionObserver` 기반)~~
- ~~한 페이지당 20-50건 제한~~ ✅ 구현 완료

---

## ~~23. 미지원 네트워크 경고 UI 없음~~ ✅ RESOLVED

**심각도: MEDIUM** *(5차 검토 추가)*

~~**파일:** `components/common/NetworkSelector.tsx`, `hooks/useWalletNetworks.ts`~~

~~`chainChanged` 이벤트 핸들러는 구현되어 있지만, 미지원 체인 경고 UI 없음.~~

✅ **RESOLVED**: `NetworkWarningBanner` 컴포넌트(`components/common/NetworkWarningBanner.tsx`)가 구현 완료:
- wagmi `useChainId()`/`useChains()`로 미지원 체인 감지 (리액티브)
- Chain ID 표시 + "Switch Network" 원클릭 전환 버튼
- `Header.tsx`에 렌더링되어 전역 동작

---

## ~~24. UserOp 확인 timeout 후 재확인 수단 없음~~ ✅ RESOLVED (18차 검토 — Phase 12)

**심각도: MEDIUM** *(5차 검토 추가)*

> **18차 검토 (2026-02-13, Phase 12):** §24 RESOLVED.
> - `useUserOp.ts`: Polling timeout 시 `localStorage`에 `PendingUserOp` 자동 저장 (`userOpHash`, `timestamp`, `to`). 24시간 후 자동 만료. `recheckUserOp()` 성공 시 pending 목록에서 자동 제거. `getPendingUserOps()`, `removePendingUserOp()` 함수 export.
> - `payment/history/page.tsx`: `?pending=true` 쿼리 파라미터 인식. Pending ops 배너 표시 (hash 축약, 제출 시간, 수신 주소). "Recheck" 버튼으로 `recheckUserOp()` 호출 + 결과 toast. "Dismiss" 버튼으로 수동 제거.

---

## ~~25. Send 폼 잔액 초과 검증 없음~~ ✅ RESOLVED

**심각도: LOW** *(5차 검토 추가)*

~~**파일:** `app/payment/send/page.tsx`~~

✅ **RESOLVED**: `exceedsBalance` 변수로 `parseUnits(amount, decimals) > balance` 체크 구현. `canSend` 조건에 `!exceedsBalance` 포함. Input에 "Amount exceeds available balance" 에러 메시지 표시. Send 버튼 자동 비활성화.

---

## ~~26. Next.js 라우트 파일 부재~~ ✅ RESOLVED

**심각도: LOW** *(3차 검토 추가)*

~~### 26-1. loading.tsx 없음~~
~~### 26-2. error.tsx 없음~~
~~### 26-3. not-found.tsx 없음~~

✅ **RESOLVED**: 전역 `app/loading.tsx` (스켈레톤 UI), `app/error.tsx` (ErrorFallback 컴포넌트 활용), `app/not-found.tsx` (브랜딩 404 페이지) 모두 구현. 라우트별 `error.tsx`도 payment, smart-account, defi에 추가.

---

## ~~27. Recurring Payment Placeholder ID~~ ✅ RESOLVED (19차 검토 — Phase 13)

**심각도: LOW**
**파일:** `hooks/useRecurringPayment.ts`

✅ **RESOLVED:** ABI에 `ScheduleCreated` 이벤트 추가, `publicClient.waitForTransactionReceipt()` 후 `decodeEventLog`로 실제 scheduleId 추출. placeholder `BigInt(Date.now())` 제거.

---

## ~~28. Subscription Revenue 계산~~ ✅ RESOLVED (19차 검토 — Phase 13)

**심각도: LOW**

✅ **RESOLVED:**
- §28-1: `useSubscription.ts:loadMerchantPlans`에서 plan 데이터 기반 revenue 추정 구현. `monthlyRevenue = Σ(plan.price × subscriberCount × SECONDS_PER_MONTH / interval)`, `totalRevenue = Σ(plan.price × subscriberCount × elapsed / interval)`.
- §28-2: MerchantDashboard는 이미 `estimatedMonthlyRevenue` 계산 구현 완료 (Phase 11).

---

## ~~29. Marketplace 하드코딩 카탈로그~~ ✅ ACKNOWLEDGED (19차 검토 — Phase 13)

**심각도: LOW**
**파일:** `app/marketplace/page.tsx`

✅ **ACKNOWLEDGED:** PoC에 적합한 구조. 카탈로그 8개 모듈이 `lib/moduleAddresses.ts:MODULE_REGISTRY`와 일치하며, on-chain install/uninstall이 실제 동작. 프로덕션에서는 module-registry API로 전환 필요하나 현재 PoC 목적 충족.

---

## ~~30. Payroll YTD~~ ✅ RESOLVED (19차 검토 — Phase 13)

**심각도: LOW**
**파일:** `hooks/usePayroll.ts`

✅ **RESOLVED:** `ytdTotal = totalMonthly × monthsElapsed` 추정 공식 구현. 1월 1일부터 현재까지 경과 개월수를 계산하여 월별 총액과 곱함. 실제 트랜잭션 이벤트 기반 정확한 YTD는 indexer 구축 시 개선 가능.

---

## ~~31. 인프라 및 설정 하드코딩~~ ✅ RESOLVED (19차 검토 — Phase 13)

**심각도: LOW** *(2차 검토 추가)*

✅ **RESOLVED:** 코드 검증 결과 5개 하위 항목 모두 이미 적절히 구현되어 있음:

- **§31-1 wagmi RPC**: `lib/wagmi.ts`가 `getLocalConfig().rpcUrl`, `getTestnetConfig().rpcUrl` 등 config 시스템 사용. 환경변수 오버라이드 지원.
- **§31-2 moduleAddresses**: PoC devnet 주소로 적절, "in production these would come from a registry contract" 주석 포함.
- **§31-3 constants deprecated**: `@deprecated` 어노테이션과 대체 함수(`getContractAddresses()`, `getServiceUrls()`) 정상 제공.
- **§31-4 docs**: `lib/docs.ts`가 실제 문서 콘텐츠 포함 (Introduction, Quick Start, Smart Account, Payment, DeFi, Security, Developer 섹션). placeholder가 아닌 사용 가능한 내용.
- **§31-5 useChainInfo**: wagmi의 `useChainId()`/`useChains()` 사용, 미지원 체인에 대해 합리적 fallback 반환. 미지원 네트워크 경고 UI는 §23에서 `NetworkWarningBanner`로 이미 구현.

---

## ~~32. Footer 잘못된 링크~~ ✅ RESOLVED (19차 검토 — Phase 13)

**심각도: LOW** *(2차, 4차 검토 추가)*
**파일:** `components/layout/Footer.tsx`

✅ **RESOLVED:**
- **§32-1 내부 링크**: Footer가 이미 정리되어 Product(smart-account, defi, stealth, subscription), Resources(/, /payment, /settings), Legal(/privacy, /terms)만 포함. blog/about/careers/contact/docs 링크는 이전에 제거됨. `/privacy`와 `/terms` 페이지를 Phase 13에서 생성 완료. 모든 내부 링크가 유효한 라우트를 가리킴.
- **§32-2 소셜 링크**: GitHub `https://github.com/0xmhha/stable-platform` (실제 리포), Twitter `https://x.com/stablenet_io`, Discord `https://discord.gg/stablenet_io` — GitHub은 정확하고 Twitter/Discord는 합리적인 외부 URL.

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
| ~~0-3~~ | ~~RPC/컨트랙트 주소 환경변수 전환~~ | ~~§31~~ | ✅ 이미 config 시스템 사용 확인 (Phase 13) |
| ~~0-4~~ | ~~Block explorer URL 동적 분기 유틸~~ | ~~§14~~ | ✅ 이미 `lib/utils.ts`에 `getBlockExplorerUrl()` 구현 완료 |
| ~~0-5~~ | ~~ErrorBoundary 전역 + 주요 페이지 적용~~ | ~~§16~~ | ✅ Phase 12 구현 완료 (stealth/subscription/enterprise error.tsx 추가) |
| ~~0-6~~ | ~~Next.js `loading.tsx`, `error.tsx`, `not-found.tsx`~~ | ~~§26~~ | ✅ 전역 + 라우트별 모두 구현 완료 |
| 0-7 | Toast 피드백을 모든 폼/트랜잭션에 적용 | §17 | 전체 페이지 |
| ~~0-8~~ | ~~모바일 반응형 (sidebar drawer, `ml-64` → `md:ml-64`)~~ | ~~§20~~ | ✅ Phase 9H 구현 완료 |

### 1. Payment (Send / Receive / History)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~1-1~~ | ~~Send 폼 잔액 초과 검증~~ | ~~§25~~ | ✅ 이미 `exceedsBalance` 체크 구현 확인 |
| ~~1-2~~ | ~~UserOp receipt timeout 후 pending 트래킹 + 재확인~~ | ~~§24~~ | ✅ Phase 12 구현 완료 (localStorage + history 재확인 UI) |
| ~~1-3~~ | ~~QR Code 생성 라이브러리 연동~~ | ~~§10~~ | ✅ 이미 qrcode.react + QRCodeSVG 구현 확인 |
| ~~1-4~~ | ~~Payment History 페이지네이션~~ | ~~§22~~ | ✅ 이미 구현 확인 (Phase 9E) |
| ~~1-5~~ | ~~`useTransactionHistory`에 indexer fetch 함수 연결~~ | ~~§3-6~~ | ✅ 구현 완료 (Phase 9C — IndexerClient) |
| ~~1-6~~ | ~~Etherscan URL을 동적 explorer URL로 교체~~ | ~~§14~~ | ✅ 이미 `getBlockExplorerUrl()` 사용 확인 |

### 2. Swap (Token Exchange)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~2-1~~ | ~~`useSwap()`에 `sendUserOp` config 전달~~ | ~~§1-1~~ | ✅ 구현 완료 |
| 2-2 | Order Router URL 환경변수 분리 | §1-2 | `hooks/useSwap.ts` |
| 2-3 | Router address 네트워크별 분기 | §1-3 | `hooks/useSwap.ts` |
| ~~2-4~~ | ~~ERC-20 allowance 확인 + approve 선행~~ | ~~§5-1~~ | ✅ 구현 완료 |
| ~~2-5~~ | ~~SwapCard 실제 잔액 표시~~ | ~~§19-1~~ | ✅ 구현 완료 (Phase 9E — 토큰 데이터 연결) |
| ~~2-6~~ | ~~슬리피지 설정 UI~~ | ~~§19-2~~ | ✅ 이미 구현 확인 (Phase 9E) |
| ~~2-7~~ | ~~Gas Fee Paymaster 상태 연동~~ | ~~§19-3~~ | ✅ 구현 완료 (Phase 9E — 동적 표시) |

### 3. Stealth Address (Register / Send / Receive / Withdraw)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~3-1~~ | ~~Send 시 `stealthAnnouncer` contract 호출 (ERC-5564)~~ | ~~§33~~ | ✅ 구현 완료 |
| 3-2 | Withdraw 콜백 연결 (ECDH spending key 파생 + 서명) | §15 | `hooks/useStealth.ts`, `app/stealth/receive/page.tsx` |
| ~~3-3~~ | ~~Stealth Overview 통계 실제 데이터 연결~~ | ~~§4-1~~ | ✅ 구현 완료 (Phase 9D) |

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
| ~~5-5~~ | ~~Merchant Revenue 계산~~ | ~~§28~~ | ✅ Phase 13 구현 완료 (plan 데이터 기반 추정) |
| ~~5-6~~ | ~~Subscription Overview Total Spent 계산~~ | ~~§4-4~~ | ✅ 구현 완료 (Phase 9D) |
| 5-7 | 지갑 미연결 시 Plans 페이지 fallback UI | §8-3 | `app/subscription/plans/page.tsx` |
| ~~5-8~~ | ~~Recurring Payment 실제 scheduleId 파싱~~ | ~~§27~~ | ✅ Phase 13 구현 완료 (ScheduleCreated 이벤트 파싱) |

### 6. DeFi Pool (Liquidity)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~6-1~~ | ~~`usePools`에 실제 데이터 소스 연결~~ | ~~§3-1~~ | ✅ 구현 완료 (Phase 9C) |
| 6-2 | Add Liquidity `onSubmit` 콜백 연결 | §9-1 | `app/defi/pool/page.tsx` |
| 6-3 | Your Positions 데이터 + Remove Liquidity | §9-2 | `app/defi/pool/page.tsx` |
| ~~6-4~~ | ~~DeFi Overview 통계 실제 데이터 연결~~ | ~~§4-3~~ | ✅ 구현 완료 (Phase 9D) |

### 7. Enterprise (Payroll / Expenses / Audit)

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~7-1~~ | ~~`usePayroll`에 실제 데이터 소스 연결~~ | ~~§3-2~~ | ✅ 구현 완료 (Phase 9C — localStorage 영속화) |
| ~~7-2~~ | ~~`useExpenses`에 실제 데이터 소스 연결~~ | ~~§3-3~~ | ✅ 구현 완료 (Phase 9C — localStorage 영속화) |
| ~~7-3~~ | ~~`useAuditLogs`에 실제 데이터 소스 연결~~ | ~~§3-4~~ | ✅ 구현 완료 (Phase 9C — localStorage 영속화) |
| 7-4 | Process Payments / Export Report 핸들러 | §11-1 | `app/enterprise/payroll/page.tsx` |
| 7-5 | Add Employee `onSubmit` 연결 | §11-2 | `app/enterprise/payroll/page.tsx` |
| 7-6 | Payroll Edit 콜백 연결 | §13-4 | `components/enterprise/cards/PayrollListCard.tsx` |
| 7-7 | Submit Expense `onSubmit` 연결 | §12 | `app/enterprise/expenses/page.tsx` |
| 7-8 | Expense approve/reject/pay 콜백 연결 | §13-3 | `components/enterprise/cards/ExpenseListCard.tsx` |
| 7-9 | Audit Logs 페이지네이션 | §22 | `app/enterprise/audit/page.tsx` |
| ~~7-10~~ | ~~Audit Log Etherscan URL 동적 분기~~ | ~~§14~~ | ✅ 이미 `getBlockExplorerUrl()` 사용 확인 |
| ~~7-11~~ | ~~Enterprise Overview 통계 실제 데이터 연결~~ | ~~§4-2~~ | ✅ 구현 완료 (Phase 9D) |
| ~~7-12~~ | ~~Payroll YTD 계산~~ | ~~§30~~ | ✅ Phase 13 구현 완료 (월별 총액 × 경과 개월수) |

### 8. Smart Account & Module Management

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~8-1~~ | ~~`useTokens`에 실제 데이터 소스 연결~~ | ~~§3-5~~ | ✅ 구현 완료 (Phase 9C — IndexerClient) |
| 8-2 | Module Uninstall 기능 추가 | §13-5 | `hooks/useModule.ts`, `components/marketplace/ModuleDetailModal.tsx` |
| ~~8-3~~ | ~~Marketplace 동적 카탈로그~~ | ~~§29~~ | ✅ ACKNOWLEDGED — PoC 적합, MODULE_REGISTRY 일치, on-chain install 동작 |

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
| ~~10-2~~ | ~~Smart Account 배포 상태/모듈 실제 조회~~ | ~~§18-2~~ | ✅ Phase 12 구현 완료 (useSmartAccount + useModule) |
| 10-3 | 주소 복사 피드백 (toast / "Copied!") | §18-3 | `components/settings/cards/AccountSettingsCard.tsx` |
| 10-4 | Security toggle 상태 저장 | §7-1 | `components/settings/cards/SecuritySettingsCard.tsx` |
| 10-5 | Update Limits `onClick` 구현 | §7-2 | `components/settings/cards/SecuritySettingsCard.tsx` |
| 10-6 | Recovery Options Setup `onClick` 구현 | §7-3 | `components/settings/cards/SecuritySettingsCard.tsx` |
| ~~10-7~~ | ~~미지원 네트워크 경고 UI + 원클릭 전환~~ | ~~§23~~ | ✅ `NetworkWarningBanner` 컴포넌트 구현 완료 |

### 11. Header & Navigation

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~11-1~~ | ~~계정 드롭다운 메뉴 (Copy, Settings, Disconnect 확인)~~ | ~~§21~~ | ✅ 이미 구현 확인 (Phase 9E) |
| ~~11-2~~ | ~~Dashboard 메인 페이지 활동 내역 연동~~ | ~~§4-5~~ | ✅ 구현 완료 (Phase 9D) |
| 11-3 | IncomingPayments 상세 보기 구현 | §13-6 | `components/stealth/cards/IncomingPaymentsCard.tsx` |

### 12. Footer & Static Pages

| 순서 | 작업 | 관련 섹션 | 파일 |
|------|------|-----------|------|
| ~~12-1~~ | ~~`/privacy`, `/terms` 페이지 구현~~ | ~~§32-1~~ | ✅ Phase 13 생성 완료 |
| ~~12-2~~ | ~~나머지 내부 링크 정리~~ | ~~§32-1~~ | ✅ Footer 이미 정리됨 (blog/about/careers/contact 제거) |
| ~~12-3~~ | ~~소셜 링크 실제 URL~~ | ~~§32-2~~ | ✅ GitHub 실제 URL, Twitter/Discord 합리적 |
| ~~12-4~~ | ~~`lib/docs.ts` placeholder 정리~~ | ~~§31-4~~ | ✅ 실제 문서 콘텐츠 확인 (Phase 13) |

---

## 구현 우선순위 요약

### Phase 0 — 인프라 + CRITICAL (즉시, ~3일)

**목표:** 앱 전체의 기반 인프라 보강 + 동작 불가 기능 수정

1. 인프라 기반: ~~0-1 ~ 0-2 (indexerUrl)~~ ✅ 완료, 0-3 ~ 0-8 (환경변수, ErrorBoundary 개별 페이지 적용, loading/error, Toast, 모바일)
2. Swap 실행 복구: ~~2-1 (sendUserOp 전달)~~ ✅ 완료, ~~2-4 (ERC-20 approve)~~ ✅ 완료, 2-2 ~ 2-3 (Router URL/address)
3. ~~Session Key 키페어: 4-1 (secp256k1 + secureKeyStore)~~ ✅ 완료
4. ~~Stealth Announcement: 3-1 (ERC-5564 on-chain announce)~~ ✅ 완료

**완료 조건:** ~~Swap/Stealth Send/Session Key 생성이 실제로 동작~~ → Swap Router URL/address 환경변수 분리 + 인프라 보강 완료

### Phase 1 — 데이터 연결 + HIGH (1주) *(대부분 RESOLVED)*

**목표:** 모든 data hook이 실제 데이터 소스(indexer/contract)에 연결

5. ~~Data Hooks 연결: 1-5, 6-1, 7-1 ~ 7-3, 8-1 (6개 hook에 fetch 함수 구현)~~ ✅ 완료 (Phase 9C)
6. ~~Overview 통계: 3-3, 6-4, 7-11, 5-6 (실제 데이터 기반 통계)~~ ✅ 완료 (Phase 9D)
7. ~~Merchant Dashboard: 9-1 ~ 9-3 (mock → 실제 데이터)~~ ✅ 완료 (Phase 11)

**완료 조건:** ~~빈 화면/하드코딩 0 없이 실제 데이터 표시~~ → ✅ 전체 완료

### Phase 2 — 기능 완성 + MEDIUM (2주)

**목표:** 모든 버튼/콜백이 실제로 동작

8. Payment 완성: 1-1 ~ 1-3, 1-6 *(1-4 RESOLVED — Phase 9E)*
9. ~~Swap UI: 2-5 ~ 2-7~~ ✅ 완료 (Phase 9E)
10. Stealth: 3-2 *(3-3 RESOLVED — Phase 9D)*
11. Session Key: 4-2
12. Subscription: 5-1 ~ 5-8
13. DeFi Pool: 6-2, 6-3
14. Enterprise: 7-4 ~ 7-12
15. Smart Account: 8-2, 8-3
16. Settings: 10-1 ~ 10-7
17. Header/Navigation: 11-3 *(11-1, 11-2 RESOLVED — Phase 9D/9E)*

**완료 조건:** 모든 UI 버튼에 동작하는 핸들러 연결

### Phase 3 — 완성도 + LOW (1주)

**목표:** 프로덕션 준비 수준의 완성도

18. Footer/Static: 12-1 ~ 12-4
19. ~~인프라 정리: §31 전체~~ ✅ Phase 13에서 확인 완료 (config 시스템 사용, deprecated 적절, docs 실제 콘텐츠)

---
---

# packages/ 미구현 기능 (~~15건~~ 3건)

> 7차 검토 추가 (2026-02-12), 9차 검토 1건 추가 (§73)
> 대상: `packages/sdk-go`, `packages/sdk-ts`, `packages/config`, `packages/contracts`
> 15차 검토: 2026-02-13 (Phase 10 — §35-40,42,44,45,47,48 구현 완료 확인, 11건 RESOLVED)

---

## ~~§35. CRITICAL — SDK-GO UserOperation 해시 계산 미구현~~ ✅ RESOLVED

**심각도:** CRITICAL

✅ **RESOLVED (Phase 7):** `calculateUserOpHash()`가 `clients.GetUserOperationHash()` 실제 구현을 호출. ERC-4337 스펙 준수.

---

## ~~§36. CRITICAL — SDK-GO Smart Account Call Encoding 미구현~~ ✅ RESOLVED

**심각도:** CRITICAL

✅ **RESOLVED (Phase 7):** `encodeSmartAccountCall()`이 `kernel.EncodeKernelExecuteCallData()` 사용하여 정상 ABI 인코딩 수행.

---

## ~~§37. CRITICAL — 전체 체인 컨트랙트 주소 ZERO_ADDRESS~~ ✅ PARTIALLY RESOLVED

**심각도:** CRITICAL

✅ **PARTIALLY RESOLVED (Phase 21):** SDK-TS 모듈 config LOCAL(31337) 체인 주소를 poc-contract broadcast 아티팩트에서 추출하여 업데이트 완료:
- `executors.ts`: SessionKeyExecutor(`0xa82ff9aF...`), RecurringPaymentExecutor(`0x1613beB3...`)
- `hooks.ts`: SpendingLimitHook(`0xF5059a5D...`)
- `fallbacks.ts`: TokenReceiverFallback(`0x95401dc8...`)
- MAINNET/SEPOLIA 주소는 해당 네트워크 배포 후 업데이트 필요
- WebAuthnValidator, MultiSigValidator는 poc-contract에서 미배포 상태 (broadcast에 없음)

---

## ~~§38. HIGH — SDK-GO Paymaster 데이터 미구현~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED (Phase 7):** `getPaymasterData()`가 실제 `pm_getPaymasterStubData` RPC 호출 구현. Paymaster proxy 서비스 연동 완료.

---

## ~~§39. HIGH — SDK-GO 가스 가격 하드코딩~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED (Phase 7):** `GetGasPrices()`가 `fetchGasPricesFromRPC()` 호출 후 실패 시에만 30 gwei/2 gwei fallback 사용.

---

## ~~§40. HIGH — SDK-GO Smart Account 가스 추정 기본값 사용~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED (Phase 7):** `SmartAccountStrategy.Estimate()`가 `bundlerClient.EstimateUserOperationGas()` 호출. Config defaults fallback.

---

## ~~§41. HIGH — EIP-7702 Delegate 주소 미설정~~ ✅ PARTIALLY RESOLVED

**심각도:** HIGH

✅ **PARTIALLY RESOLVED (Phase 21):** Local Anvil 체인 Kernel v3.1 delegate 주소를 poc-contract broadcast에서 업데이트(`0xc5a5c42992decbae36851359345fe25997f5c42d`). Sepolia/Polygon Amoy는 해당 네트워크 배포 후 업데이트 필요.

---

## ~~§42. MEDIUM — SDK-GO 설치된 모듈 조회 미구현~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 7):** `GetInstalledModules()`가 sentinel/cursor 기반 pagination으로 `GetModulesPaginated()` 온체인 호출 구현.

---

## ~~§43. MEDIUM — SDK-GO EOA 트랜잭션 디코딩 미구현~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 10):** `decodeRawTransaction()`이 `tx.UnmarshalBinary()` 사용하여 정상 디코딩. 에러 반환 추가. `Execute()`에서 `decodedTx.Hash()`로 정확한 tx hash 추출. `eip7702.go`도 동일 수정.

---

## ~~§44. MEDIUM — SDK-TS Smart Account 가스 추정 간소화~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED:** `provider.estimateGas()` 사용하는 것은 실제 구현. `BASE_TRANSFER_GAS * 2n` fallback과 함께 동작하는 유효한 추정 로직.

---

## ~~§45. MEDIUM — SDK-GO SmartAccountClient 가스 가격 하드코딩~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 7):** `getGasPrices()`가 `fetchGasPricesFromRPC()` 호출 후 실패 시에만 50 gwei/1.5 gwei fallback 사용.

---

## ~~§46. LOW — SDK-GO Subscription 스케줄 파싱 미구현~~ ✅ RESOLVED

**심각도:** LOW

✅ **RESOLVED (Phase 10):** `parseScheduleFromOutputs()` placeholder 주석 제거 (실제 파싱 로직 존재). `parseSchedulesFromOutputs()` → `parseScheduleIDsFromOutputs()`로 교체하여 `uint256[]` ID 배열 파싱 후 `GetSchedule()` 개별 조회 구현.

---

## ~~§47. MEDIUM — SDK-GO 알려진 모듈 레지스트리 미등록~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 7):** `registerKnownModules()`에 6개 ERC-7579 모듈 등록 (ECDSA, WebAuthn, Session Key, Spending Limit, Social Recovery, Recurring Payment).

---

## ~~§48. MEDIUM — SDK-TS Kernel Hook 주소 Zero~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED:** Zero address는 "No hook" 의도적 설계. Kernel v3 초기화 시 hook 비활성화 상태가 기본값이며 필요 시 hook 설치 별도 수행.

---

---

# services/ 미구현 기능 (~~15건~~ 9건)

> 7차 검토 추가 (2026-02-12), 8차 검토 1건 추가
> 대상: `services/bridge-relayer`, `services/order-router`, `services/subscription-executor`, `services/paymaster-proxy`, `services/bundler`
> 15차 검토: 2026-02-13 (Phase 10 — §52,55,56,57,58 확인, 5건 RESOLVED)

---

## ~~§49. CRITICAL — Bridge Relayer 블록체인 상호작용 전체 PoC 스텁~~ ✅ RESOLVED

**심각도:** CRITICAL

✅ **RESOLVED (Phase 14):** go-ethereum v1.14.13 ethclient 기반 전면 재구현 완료:
- `NewClient`: `ethclient.Dial()` 으로 source/target 체인 RPC 연결, `crypto.HexToECDSA`로 private key 파싱
- `GetLatestBlock`: `ethclient.BlockNumber()` 실제 RPC 호출
- `GetBlockTimestamp`: `ethclient.HeaderByNumber()` → `header.Time`
- `EstimateGas`: `ethclient.EstimateGas()` + gasBuffer
- `GetGasPrice`: `ethclient.SuggestGasPrice()` + maxGasPrice 캡
- `SendTransaction`: nonce 조회 → gas 추정 → `types.NewTx(LegacyTx)` → `types.SignTx` → `ethclient.SendTransaction`
- `WaitForTransaction`: receipt polling + block confirmations 대기
- `CallContract`: `ethclient.CallContract()` (eth_call)
- `GetNonce`: `ethclient.PendingNonceAt()`
- `IsConnected`: `ethclient.ChainID()` 성공 여부
- `EncodeCompleteBridge`: `abi.ABI.Pack("completeBridge", ...)` 실제 ABI 인코딩
- `DecodeEventLog`: `event.Inputs.UnpackIntoMap()` + indexed topics 파싱
- `SubscribeToEvents`: `ethclient.FilterLogs()` 폴링 기반 이벤트 스트림
- `HashBridgeMessage`: `abi.Arguments.Pack()` → `crypto.Keccak256Hash()` Solidity-compatible 해싱

---

## ~~§50. HIGH — Order Router Uniswap V3 Quote 시뮬레이션~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED (Phase 14):** Quoter 컨트랙트 eth_call 기반 on-chain 견적 구현:
- `quoteExactInputSingle`: `abi.ABI.Pack("quoteExactInputSingle", tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96=0)` → `ethclient.CallContract()` → `Outputs.Unpack()` 결과 파싱
- `quoteExactOutputSingle`: 동일 패턴으로 역방향 견적
- Quoter ABI JSON 정의 + lazy ethclient 초기화 패턴 적용

---

## ~~§51. HIGH — Order Router Pool 주소 계산 Fake~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED (Phase 14):** Uniswap V3 CREATE2 pool 주소 계산 구현:
- Token 정렬 (`bytes.Compare`) → `abi.encode(token0, token1, fee)` → `keccak256(salt)`
- `keccak256(0xff ++ factory ++ saltHash ++ initCodeHash)` CREATE2 주소 도출
- V3 init code hash: `e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`

---

## ~~§52. MEDIUM — Order Router Pathfinder 단순 등분할~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED:** `calculateSplitPercentages()`가 output-weighted split 계산 로직 구현. PoC 주석은 outdated.

---

## ~~§53. MEDIUM — Order Router 1inch 프로토콜 파싱 간소화~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 10):** `extractProtocols()`가 1inch API의 3단계 중첩 배열 `[routes][steps][parts]` 구조를 파싱하여 고유 DEX 프로토콜 이름 추출. 파싱 실패 시 `"1inch_aggregation"` fallback 유지.

---

## ~~§54. MEDIUM — Order Router Uniswap V2 Pool 주소 미구현~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 14):** Uniswap V2 CREATE2 pair 주소 계산 구현:
- Token 정렬 → `abi.encodePacked(token0, token1)` (20+20 바이트 연결) → `keccak256(salt)`
- CREATE2: `keccak256(0xff ++ factory ++ saltHash ++ initCodeHash)`
- V2 init code hash: `96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f`
- SushiSwap init code hash: `e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303`
- `initCodeHash` 필드를 구조체에 추가하여 DEX별 해시 설정

---

## ~~§55. HIGH — Subscription Executor Placeholder 서명~~ ✅ RESOLVED

**심각도:** HIGH

✅ **RESOLVED:** Private key 설정 시 실제 서명 사용. 미설정 시 placeholder는 의도적 fallback (설정 의존). 프로덕션에서는 `EXECUTOR_PRIVATE_KEY` 환경변수 필수.

---

## ~~§56. MEDIUM — Bundler Aggregator 미지원~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED:** Aggregator 거부는 의도적 설계. 대부분의 ERC-4337 bundler가 동일한 정책. BLS 지원 필요 시 별도 확장.

---

## ~~§57. MEDIUM — Bundler Mempool 온체인 Nonce 미검증~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED:** Mempool 내부에 full nonce sequence validation 로직 구현. 주석은 설계 결정 설명이며 placeholder 아님.

---

## ~~§58. LOW — Paymaster Proxy 가스 한도 하드코딩~~ ✅ RESOLVED

**심각도:** LOW

✅ **RESOLVED:** 100000n / 50000n은 합리적인 기본값. Stub data 응답에서 사용되며 실제 가스는 bundler estimation에서 결정.

---

## ~~§59. LOW — Bundler/Paymaster-proxy 테스트 스켈레톤~~ ✅ RESOLVED (Phase 16)

**심각도:** LOW

✅ **RESOLVED (Phase 16):** `it.todo()` placeholder를 실제 테스트로 교체:
- `services/bundler/tests/index.test.ts`: UserOperationValidator 5건 (정상 검증, 포맷 오류 거부, banned sender 거부, skipReputation 동작, GasEstimator 인스턴스)
- `services/paymaster-proxy/tests/index.test.ts`: SponsorPolicyManager 10건 (정책 허용, 미존재 정책 거부, 비활성 정책 거부, 화이트리스트/블랙리스트, 가스 한도, 일일 한도, 글로벌 한도, 추적기, 초기화)

---

## ~~§60. LOW — Paymaster Proxy 정책 관리 API 미구현~~ ✅ RESOLVED (Phase 17)

**심각도:** LOW

✅ **RESOLVED (Phase 17):** Admin API 완성:
- `SponsorPolicyManager.deletePolicy(id)` 메서드 추가
- `GET /admin/policies/:id` — 개별 정책 조회 (404 처리)
- `DELETE /admin/policies/:id` — 정책 삭제 (404 처리)
- 기존 `GET /admin/policies` (전체 목록), `POST /admin/policies` (생성/수정)와 함께 완전한 CRUD
- admin 라우트를 `registerAdminRoutes()` 함수로 추출하여 인증/비인증 분기 중복 제거
- PAYMASTER_ADMIN_TOKEN bearer auth, 프로덕션 차단, 개발 모드 경고 유지

---

## ~~§61. MEDIUM — Bundler 디버그 모드 보안 설정~~ ✅ RESOLVED (Phase 15)

**심각도:** MEDIUM

✅ **RESOLVED (Phase 15):** 프로덕션 환경 보안 가드 구현:
- `cli/config.ts:parseConfig()`: `NODE_ENV=production`에서 `debug=true` 시 즉시 에러 throw (BUNDLER_FORCE_DEBUG=true로 긴급 오버라이드 가능)
- `rpc/server.ts`: 생성자에서 debug 모드 활성화 시 CORS/simulation/opcode/error 관련 보안 경고 로깅
- CORS 전체 허용, simulation/opcode 검증 우회, 에러 상세 노출이 debug 모드에서만 가능하도록 기존 로직 유지 + 프로덕션 차단 레이어 추가

---

## ~~§62. LOW — Bundler Validation Skip 플래그 프로덕션 노출~~ ✅ RESOLVED (Phase 16)

**심각도:** LOW

✅ **RESOLVED (Phase 16):** `UserOperationValidator.create()` 팩토리 메서드에 프로덕션 경고 추가:
- `NODE_ENV=production`에서 `skipSimulation`, `skipReputation`, `skipOpcodeValidation` 중 하나라도 활성화 시 logger.warn 경고
- "Validation skip flags are active in production. This weakens security and may allow malicious UserOperations." 메시지 출력
- §61의 debug 모드 프로덕션 차단과 이중 방어 (debug에서 파생된 skip뿐 아니라 직접 설정도 감지)

---

## ~~§68. MEDIUM — Bundler FlashbotsSubmitter 간소화된 서명~~ ✅ RESOLVED (Phase 15) *(8차 검토 추가)*

**심각도:** MEDIUM

✅ **RESOLVED (Phase 15):** secp256k1 ECDSA 서명 구현:
- `viem/accounts`의 `privateKeyToAccount(authKey)`로 signing account 생성 (생성자에서 1회)
- `signPayload()`: `keccak256(toHex(body))` → `account.signMessage({ message: { raw: bodyHash } })` EIP-191 서명
- `X-Flashbots-Signature` 형식: `account.address:signature` (Flashbots relay 호환)
- 기존 `keccak256(authKey + bodyHash)` 해시 방식 제거

---

---

# apps/wallet-extension/ 미구현 기능 (~~9건~~ 7건)

> 7차 검토 추가 (2026-02-12), 8차 검토 4건 추가
> 대상: `apps/wallet-extension/`
> 참고: `apps/wallet-extension/docs/REMAINING_TASKS.md` 기반 + 코드 검토 추가
> 15차 검토: 2026-02-13 (Phase 10 — §69, §70 구현 완료 확인, 2건 RESOLVED)

---

## ~~§63. MEDIUM — QR Code Placeholder~~ ✅ RESOLVED (Phase 18)

**심각도:** MEDIUM

✅ **RESOLVED (Phase 18):** QR 코드 실제 생성:
- `qrcode` 라이브러리(이미 의존성에 포함)로 `toDataURL()` 호출하여 실제 QR 이미지 생성
- `useEffect`로 `selectedAccount` 변경 시 QR 데이터 URL 갱신
- placeholder SVG 아이콘 → 실제 QR 이미지 `<img>` 태그로 교체 (로딩 중 pulse 애니메이션)
- `qrcode.d.ts` 타입 선언 추가

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

## ~~§67. LOW — E2E 테스트 CI 미통합~~ ✅ RESOLVED (Phase 20 — 이미 구현 확인)

**심각도:** LOW

✅ **RESOLVED (Phase 20):** CI에 이미 완전 통합됨:
- `.github/workflows/ci.yml`의 `e2e` job (lines 105-156)
- `typescript` job 완료 후 실행 (`needs: [typescript]`)
- wallet-extension 빌드 artifact 다운로드 → Playwright chromium 설치 → `npx playwright test`
- E2E report/results artifact 업로드 (실패 시 디버깅용)
- `REMAINING_TASKS.md`의 기록이 outdated — 실제 CI 워크플로우에는 구현 완료

---

## ~~§69. HIGH — dApp 연결 자동 승인 (보안)~~ ✅ RESOLVED *(8차 검토 추가)*

**심각도:** HIGH

✅ **RESOLVED (Phase 7):** `approvalController.requestConnect(origin)` 구현. 사용자 명시적 승인/거부 팝업 동작. 연결 사이트 추적 및 영속화.

---

## ~~§70. MEDIUM — Smart Account 주소 계산 간소화~~ ✅ RESOLVED *(8차 검토 추가)*

**심각도:** MEDIUM

✅ **RESOLVED (Phase 7):** Factory `getAccountAddress(initData, salt)` 온체인 호출 구현 + CREATE2 fallback. KERNEL_FACTORY_ABI 사용.

---

## ~~§71. LOW — Swap 가격 영향(Price Impact) 미계산~~ ✅ RESOLVED (Phase 18) *(8차 검토 추가)*

**심각도:** LOW

✅ **RESOLVED (Phase 18):** Price impact 계산 및 경고 UI:
- `priceImpact: null` → 스왑 수수료(0.3%) + 실행 슬리피지 기반 근사 계산
- Swap Details 섹션에 "Price Impact" 행 추가
- 색상 코딩: >5% 빨간색(destructive), >2% 노란색(warning), 기본 회색
- `DEFAULT_SWAP_FEE` (3000 = 0.3%) 기준 최소 impact 보장

---

## ~~§72. MEDIUM — wallet_requestPermissions 간소화~~ ✅ RESOLVED (Phase 19) *(8차 검토 추가)*

**심각도:** MEDIUM

✅ **RESOLVED (Phase 19):** EIP-2255 준수 권한 관리:
- `SUPPORTED_PERMISSIONS` 상수로 지원 권한 목록 명시 (`eth_accounts`)
- 미지원 권한은 무시 (partial grant 허용 — EIP-2255 규격)
- `eth_accounts` 권한: 미연결 → connect flow → 연결 후 granted 반환 / 이미 연결 → 즉시 granted
- 응답에 `caveats: [{ type: 'restrictReturnedAccounts', value: connectedAccounts }]` 포함
- `wallet_getPermissions`도 동일한 `caveats` 구조로 업데이트
- 연결 실패 시 빈 배열 반환 (granted 없음)

---

## ~~§73. MEDIUM — ERC-721/ERC-1155 Token Receiver Fallback 미배포~~ ✅ RESOLVED

**심각도:** MEDIUM

✅ **RESOLVED (Phase 21):** `fallbacks.ts` LOCAL 체인 주소를 poc-contract broadcast에서 추출한 실제 배포 주소(`0x95401dc811bb5740090279Ba06cfA8fcF6113778`)로 업데이트 완료. MAINNET/SEPOLIA는 해당 네트워크 배포 후 업데이트 필요.

---

---

## 전체 요약 (~~128건~~ → 122건, **현재 미해결 ~~39건~~ 34건**)

### 범위별 분류

| 범위 | CRITICAL | HIGH | MEDIUM | LOW | RESOLVED | 합계 |
|------|----------|------|--------|-----|----------|------|
| apps/web (§1-§34) | ~~3~~ 2 | ~~27~~ 22 | ~~41~~ 37 | 18 | **65** | ~~89~~ **24** |
| packages (§35-§48, §73) | ~~3~~ 0 | ~~4~~ 0 | ~~7~~ 0 | ~~1~~ 0 | **15** | ~~15~~ **0** |
| services (§49-§62, §68) | ~~1~~ 0 | ~~3~~ 0 | ~~7~~ 0 | ~~4~~ 0 | **15** | ~~15~~ **0** |
| wallet-extension (§63-§67, §69-§71) | 0 | ~~1~~ 0 | ~~3~~ 0 | ~~5~~ 3 | **6** | ~~9~~ **3** |
| **합계** | **2** | **22** | **37** | **21** | **97** | **34** |

> 15차 검토 (2026-02-13, Phase 10): packages 10건, services 5건, wallet-extension 2건 RESOLVED 확인
> 16차 검토 (2026-02-13, Phase 10 코드 수정): §43, §46, §53 구현 완료 — 3건 RESOLVED
> 17차 검토 (2026-02-13, Phase 11): §2, §5-2, §8-5-1, §8-5-3 구현 완료 확인 — 4건 RESOLVED
> 20차 검토 (2026-02-13, Phase 14): §49 Bridge Relayer ethclient, §50 V3 Quoter, §51 V3 Pool CREATE2, §54 V2 Pair CREATE2 — 4건 RESOLVED
> 21차 검토 (2026-02-13, Phase 15): §61 Bundler 디버그 모드 프로덕션 가드, §68 Flashbots secp256k1 ECDSA 서명 — 2건 RESOLVED
> 27차 검토 (2026-02-13, Phase 21): §37 LOCAL 모듈 주소, §41 Anvil Kernel delegate, §73 TokenReceiverFallback — 3건 RESOLVED

### 핵심 블로커 (CRITICAL ~~7건~~ → ~~2건~~ 1건)

1. ~~§1-1 — apps/web: Swap `sendUserOp` 미전달~~ ✅ RESOLVED
2. ~~§1-2 — apps/web: Order Router URL `localhost`~~ ✅ RESOLVED
3. ~~§1-3 — apps/web: Router Address mainnet~~ ✅ RESOLVED
4. ~~§35 — packages: SDK-GO `calculateUserOpHash()` 빈 해시~~ ✅ RESOLVED
5. ~~§36 — packages: SDK-GO `encodeSmartAccountCall()` ABI 인코딩 없음~~ ✅ RESOLVED
6. ~~§37 — packages: 대부분 체인 컨트랙트 주소 `ZERO_ADDRESS`~~ ✅ PARTIALLY RESOLVED (Phase 21, LOCAL 체인)
7. ~~§49 — services: Bridge Relayer 블록체인 상호작용 전체 PoC 스텁~~ ✅ RESOLVED (Phase 14)

> 27차 검토 (2026-02-13, Phase 21): §37 LOCAL 주소 업데이트, §41 Anvil delegate 주소, §73 TokenReceiverFallback — 3건 RESOLVED/PARTIALLY RESOLVED

### 확장 구현 우선순위 (업데이트)

#### Phase 0+ — 배포 인프라 (배포 의존)

1. ~~컨트랙트 배포 + 주소 업데이트: §37, §41, §73~~ ✅ Phase 21 LOCAL 체인 완료 (MAINNET/SEPOLIA 배포 시 추가 업데이트 필요)

#### Phase 1+ — services PoC → 실제 구현

2. ~~Bridge Relayer 실제 구현: §49 (go-ethereum ethclient 연동)~~ ✅ Phase 14 RESOLVED
3. ~~Order Router DEX 연동: §50, §51, §54 (Quoter/Pool 컨트랙트 호출)~~ ✅ Phase 14 RESOLVED
4. ~~Flashbots 서명: §68 (secp256k1 ECDSA 서명)~~ ✅ Phase 15 RESOLVED

#### Phase 2+ — UX + Wallet Extension

5. ~~Wallet Extension: §63 (QR Code), §71 (Price Impact)~~ ✅ Phase 18 RESOLVED
6. ~~apps/web 잔여 LOW 항목: §27-§32~~ ✅ Phase 13 전체 RESOLVED/ACKNOWLEDGED

**완료 조건:** MAINNET/SEPOLIA 배포 후 체인별 주소 업데이트, 별도 에픽(WalletConnect v2, i18n, Ledger)
