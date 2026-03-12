# 08. Enterprise

## 08-A. Enterprise Hub

**Source**: `app/enterprise/page.tsx`
**Route**: `/enterprise`

### UI 구성
- Header + Feature Cards (Payroll, Expenses, Audit Log)
- Stats grid (4-col, 연결 시만): MTD Payroll, Pending Expenses, Active Employees, Compliance Score

### 데이터 흐름
```
Hooks:
  - usePayroll() → summary (totalMonthly, activeEmployees)
  - useExpenses() → expenses (pending 필터용)
```

### Issue Checklist

- [ ] stats 렌더링 시 `isLoading` 미체크 — 데이터 로딩 중 0/빈 값 표시
- [ ] Compliance Score `100%` 하드코딩 — 실제 데이터 또는 "N/A" 표시 필요
- [ ] `usePayroll()`, `useExpenses()` 에러 무시 — 데이터 로드 실패 시 사용자 알림 없음

---

## 08-B. Payroll

**Source**: `app/enterprise/payroll/page.tsx`
**Route**: `/enterprise/payroll`

### UI 구성
- Header + "Add Employee" 버튼
- Summary Cards (4개): Monthly Payroll, Active Employees, Next Payment, YTD Payments
- Payroll List (edit 가능)
- Quick Actions: Process Payments, Export Report
- Add Employee Modal

### 데이터 흐름
```
Hooks:
  - usePayroll() → payrollEntries, summary, isLoading, error

Handlers:
  - handleAddEmployee: toast만 표시 (실제 추가 로직 없음)
  - handleProcessPayments: toast만 표시 (실제 결제 로직 없음)
  - handleExportReport: CSV 생성 + 다운로드
```

### Issue Checklist

- [ ] **`handleAddEmployee` no-op** — toast만 표시, `addEntry()` 등 실제 추가 로직 없음. 사용자에게 오해 유발
- [ ] **`handleProcessPayments` no-op** — toast만 표시, 실제 결제 실행 없음
- [ ] Export CSV — 필드 quote escaping 불완전. recipient/amount에 쉼표 포함 시 CSV 깨짐
- [ ] `linkAccountType` 성공 후 초기화 안됨 — 다음 추가 시 이전 타입 유지
- [ ] `formatNextPayment` — 유효하지 않은 Date 객체 미처리

---

## 08-C. Expenses

**Source**: `app/enterprise/expenses/page.tsx`
**Route**: `/enterprise/expenses`

### UI 구성
- Header + "Submit Expense" 버튼
- Summary Cards (4개): Pending Total, Approved Total, Paid MTD, Total Count
- Expense List (상태별 필터: all/pending/approved/rejected/paid)
- Submit Expense Modal

### 데이터 흐름
```
Hooks:
  - useExpenses({ filter }) → filtered expenses
  - useExpenses() → allExpenses (summary 계산용)

Handlers:
  - handleSubmitExpense: toast만 (no-op)
  - handleApprove/Reject/Pay: toast만 (no-op)
```

### Issue Checklist

- [ ] `useExpenses()` 2번 호출 — 동일 hook 다른 config로 2번 호출. 단일 호출 + computed 필터로 통합 필요
- [ ] **금액 계산에 USDC decimals (1e6) 하드코딩** — 다른 토큰 사용 시 금액 오류. `expense.token.decimals` 사용 필요
- [ ] **Submit/Approve/Reject/Pay 모두 no-op** — toast만 표시, 실제 트랜잭션/상태 변경 없음
- [ ] 에러 상태 미표시 — hook error 무시

---

## 08-D. Audit

**Source**: `app/enterprise/audit/page.tsx`
**Route**: `/enterprise/audit`

### UI 구성
- Header + "Export Logs" 버튼
- Summary Cards (4개): Total Actions, Unique Actors, On-Chain %, Compliance Status
- Filter Card: 검색 + 액션 타입 드롭다운
- Paginated Audit Log (10건/페이지)
- Compliance Info Card

### 데이터 흐름
```
Hooks:
  - useAuditLogs({ filter }) → logs[], isLoading, error

State:
  - searchQuery, filterAction, currentPage

Computed:
  - filteredLogs = client-side search (details/actor/txHash)
```

### Issue Checklist

- [ ] `onChainPercentage` `100%`, `complianceStatus` `Compliant` 하드코딩 — 실제 데이터 기반 계산 필요
- [ ] CSV export — details만 quote escaping. actor, target 필드도 escaping 필요
- [ ] `filterAction` 변경 시 `currentPage` 미초기화 — 존재하지 않는 페이지 표시 가능
- [ ] 검색 결과 없을 때 빈 상태 메시지 미표시
