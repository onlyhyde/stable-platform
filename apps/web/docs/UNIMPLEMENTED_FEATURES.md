# 미구현 기능 목록

> 최종 검토: 2026-02-14 (코드 대조 검증 기반)
> 대상: `apps/web`, `services/`, `packages/`, `apps/wallet-extension/`
> 이전 128건 중 실제 구현 완료 항목 삭제, toast-only placeholder 항목 재분류

---

## 요약

| 우선순위 | 영역 | 건수 | 핵심 문제 |
|----------|------|------|-----------|
| MEDIUM | DeFi Pool Liquidity | 2 | Add/Remove Liquidity 핸들러가 toast만 표시, 실제 컨트랙트 호출 없음 |
| MEDIUM | Subscription Plan 편집 | 2 | updatePlan/togglePlan이 "Not Supported" toast만 표시 |
| MEDIUM | Enterprise Payroll | 3 | Process Payments, Add Employee, Edit가 toast만 표시 (Export CSV는 실제 동작) |
| MEDIUM | Enterprise Expenses | 4 | submit/approve/reject/pay 4개 핸들러 모두 toast만 표시 |
| LOW | Stealth Withdraw | 1 | withdrawFromStealthAddress 호출은 있으나 ECDH spending key 파생 불완전 |
| **합계** | | **12** | |

---

## §1. DeFi Pool — Liquidity 핸들러 미구현

**심각도: MEDIUM**
**파일:** `app/defi/pool/page.tsx`

### 현재 상태

`handleSubmitLiquidity`와 `handleRemoveLiquidity`가 toast만 표시하고 실제 컨트랙트 호출이 없음.

```typescript
// app/defi/pool/page.tsx:28-36
const handleSubmitLiquidity = useCallback(async (data: LiquidityFormData) => {
  addToast({
    type: 'loading',
    title: 'Adding Liquidity',
    message: `Adding liquidity to pool ${data.poolAddress.slice(0, 8)}...`,
    persistent: true,
  })
  handleCloseModal()
}, [addToast])

// app/defi/pool/page.tsx:38-45
const handleRemoveLiquidity = useCallback((position: LiquidityPosition) => {
  addToast({
    type: 'loading',
    title: 'Removing Liquidity',
    message: `Removing liquidity from ${position.token0.symbol}/${position.token1.symbol} pool...`,
    persistent: true,
  })
}, [addToast])
```

### 필요 작업

1. **Add Liquidity**: ERC-20 approve → Router `addLiquidity()` 컨트랙트 호출
2. **Remove Liquidity**: LP 토큰 approve → Router `removeLiquidity()` 컨트랙트 호출
3. Position 데이터 연동 (현재 빈 배열)

---

## §2. Subscription Plan — 편집/토글 미구현

**심각도: MEDIUM**
**파일:** `components/merchant/MerchantDashboard.tsx`

### 현재 상태

`handleCreatePlan`은 실제 컨트랙트 호출이 구현되어 있으나, `handleUpdatePlan`과 `handleTogglePlan`은 "Not Supported" toast만 표시.

```typescript
// components/merchant/MerchantDashboard.tsx:263-277
const handleUpdatePlan = async (_id: string, _updates: Partial<SubscriptionPlan>) => {
  addToast({
    type: 'info',
    title: 'Not Supported',
    message: 'Plan update requires a contract upgrade',
  })
}

const handleTogglePlan = async (_id: string, _isActive: boolean) => {
  addToast({
    type: 'info',
    title: 'Not Supported',
    message: 'Plan toggle requires a contract upgrade',
  })
}
```

### 필요 작업

1. 구독 컨트랙트에 `updatePlan` / `togglePlan` 함수 추가 (스마트 컨트랙트 변경 필요)
2. 핸들러에서 실제 컨트랙트 호출 구현
3. 또는 현재 컨트랙트 제약 사항을 UI에서 명확히 안내 (편집/비활성화 버튼 숨김)

---

## §3. Enterprise Payroll — 핸들러 미구현

**심각도: MEDIUM**
**파일:** `app/enterprise/payroll/page.tsx`

### 현재 상태

`handleExportReport`는 실제 CSV 파일 생성/다운로드가 동작하나, 나머지 3개 핸들러는 toast만 표시.

```typescript
// handleAddEmployee (lines 41-48) — toast only
const handleAddEmployee = useCallback((data: EmployeeFormData) => {
  addToast({
    type: 'success',
    title: 'Employee Added',
    message: `Added ${data.walletAddress.slice(0, 8)}...`,
  })
  setIsAddModalOpen(false)
}, [addToast])

// handleProcessPayments (lines 50-62) — toast only
const handleProcessPayments = useCallback(() => {
  // ... toast only, no actual batch transfer
}, [payrollEntries, addToast])

// onEdit (line 132) — toast only
onEdit={(id) => {
  addToast({ type: 'info', title: 'Edit Employee', message: `Editing payroll entry ${id}` })
}}
```

### 필요 작업

1. **Add Employee**: `usePayroll.addEntry()` 호출 → localStorage 영속화 (hook은 이미 구현됨)
2. **Process Payments**: batch ERC-20 transfer 또는 payroll 컨트랙트 호출
3. **Edit**: `usePayroll.updateEntry()` 호출 → 편집 모달 구현

---

## §4. Enterprise Expenses — 전체 핸들러 미구현

**심각도: MEDIUM**
**파일:** `app/enterprise/expenses/page.tsx`

### 현재 상태

4개 핸들러 모두 toast만 표시. 실제 데이터 변경이나 컨트랙트 호출 없음.

```typescript
// handleSubmitExpense (lines 40-47) — toast only
// handleApprove (lines 49-51) — toast only
// handleReject (lines 53-55) — toast only
// handlePay (lines 57-64) — toast only, no actual transfer
```

### 필요 작업

1. **Submit**: `useExpenses.addExpense()` 호출 → localStorage 영속화 (hook은 이미 구현됨)
2. **Approve/Reject**: `useExpenses.updateExpense()` 호출 → 상태 변경
3. **Pay**: ERC-20 transfer 실행 → 상태를 `paid`로 업데이트

---

## §5. Stealth Withdraw — ECDH 파생 불완전

**심각도: LOW**
**파일:** `app/stealth/receive/page.tsx`, `hooks/useStealth.ts`

### 현재 상태

`handleWithdraw`가 `withdrawFromStealthAddress()` hook을 호출하고 트랜잭션 해시를 표시하는 UI 흐름은 구현되어 있으나, stealth spending key 파생이 서명 기반 `keccak256` 해싱으로만 구현되어 있고 ERC-5564 규격의 ECDH 파생이 완전하지 않음.

### 필요 작업

1. ERC-5564 ECDH 규격에 맞는 spending key 파생 구현
2. announcement 데이터에서 ephemeral public key 추출 → ECDH shared secret 계산
3. 파생된 stealth private key로 실제 서명 및 자산 인출

---

## 완료된 항목 (삭제됨)

이전 128건 중 위 12건을 제외한 116건은 코드 검증 결과 실제 구현 완료되어 이 문서에서 삭제함.

### 주요 완료 영역

- **CRITICAL (7건 전부 해결)**: Swap sendUserOp/Router URL/Address, SDK-GO UserOpHash/CallEncoding/ContractAddresses, Bridge Relayer
- **packages/ (15건 전부 해결)**: SDK-GO/SDK-TS 전체, 컨트랙트 주소 업데이트
- **services/ (15건 전부 해결)**: Bridge Relayer, Order Router, Bundler, Paymaster Proxy, Subscription Executor
- **wallet-extension (9건 전부 해결)**: QR Code, Ledger 하드웨어 지갑, WalletConnect v2, i18n, E2E CI, dApp 승인, Smart Account 주소 계산, Price Impact, EIP-2255
- **apps/web 기반 인프라**: ErrorBoundary, 라우트 파일, 모바일 반응형, 네트워크 경고, 페이지네이션, Header 드롭다운, 잔액 검증, QR Code 등
- **Data Hooks**: 6개 hook 모두 IndexerClient/localStorage 기반 실제 데이터 연결 완료
- **Overview 통계**: 5개 Overview 페이지 모두 hook 실제 데이터 연결 완료
- **Merchant Dashboard**: createPlan 실제 컨트랙트 호출, webhook/apiKey localStorage 영속화
- **Settings**: localStorage 저장, Smart Account 실제 조회, 복사 toast
