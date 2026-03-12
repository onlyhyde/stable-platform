# 02. Payment

## 02-A. Payment Hub

**Source**: `app/payment/page.tsx`
**Route**: `/payment`

- 3개 네비게이션 카드 (Send, Receive, History)
- 순수 프레젠테이션, hooks 없음, 이슈 없음

---

## 02-B. Send

**Source**: `app/payment/send/page.tsx`
**Route**: `/payment/send`

### Flow

```
Form -> Review -> Pending -> (Success Toast | Error Toast)
```

### Step 1: Form (`step === 'form'`)

#### 전송 모드 토글
- **Single Transfer** / **Batch Transfer** 버튼

#### Asset Selector
- Grid 버튼: native + 상위 5개 ERC-20 토큰
- 선택된 자산 잔고 표시

#### Single Mode
- **Recipient**: 주소 입력 (isAddress 검증)
- **Amount**: 금액 입력 + MAX 버튼

#### Batch Mode
- `<BatchRecipientList>` 컴포넌트
- 가스 절약 추정 표시

#### Gas Payment (PaymasterSelector)
- **Native**: EntryPoint deposit에서 가스비 지불 (잔고/Top Up 표시)
- **Sponsored**: 무료 (pm_getSponsorPolicy 조회)
- **ERC-20**: 토큰으로 가스비 지불 (pm_supportedTokens → 토큰 선택 → 승인)

#### ERC-20 토큰 전송
```typescript
// native가 아닌 토큰 전송 시 transfer() calldata 인코딩
const data = encodeFunctionData({
  abi: ERC20_TRANSFER_ABI,
  functionName: 'transfer',
  args: [recipient, parseUnits(amount, decimals)],
})
```

### Step 2: Review (`step === 'review'`)
- 거래 요약 (수신자, 금액, 가스 결제 모드)
- Back / Confirm & Send 버튼

### Step 3: Pending (`step === 'pending'`)
- 로딩 스피너 + 상태 메시지

## 데이터 흐름

```
Hooks (8개):
  - useWallet() → address, isConnected
  - useWalletAssets() → native, tokens, isSupported
  - useUserOp() → sendUserOp(), isLoading, error
  - usePaymaster() → getSupportedTokens(), checkSponsorshipEligibility(), paymasterAddress
  - useEntryPointDeposit() → formattedDeposit, fetchDeposit
  - useTokenGasEstimate() → formattedTokenCost, estimateTokenCost()
  - useTokenApproval() → checkAllowance(), approve(), status
  - useBatchTransaction() → recipients, executeBatch(), estimateGasSavings

State:
  - step: 'form' | 'review' | 'pending'
  - gasMode: 'native' | 'sponsor' | 'erc20'
  - selectedAsset, recipient, amount, isBatchMode
  - supportedTokens, sponsorAvailable, gasTokenAddress
```

## Issue Checklist

- [x] `supportedTokens?.find()` — optional chaining 적용 완료
- [x] `paymasterAddress`가 undefined일 때 ERC-20 approve 호출 실패 가능 — guard 적용 완료
- [x] 가스 모드 전환 시 이전 모드의 `supportedTokens` 상태가 남아있음 — `handleGasModeChange`로 reset 추가
- [x] `parseUnits(amount, decimals)` — `hasExcessDecimals` 검증 + 에러 메시지 추가
- [x] Review 단계에서 `recipient`이 빈 문자열이면 `recipient.slice()` 크래시 가능 — 삼항 연산자 방어
- [x] Batch recipients 금액 파싱 실패 시 조용히 skip — `batchParseErrors` 카운트 + 경고 UI 추가
- [x] `paymasterError`가 `sendError || batchError`에 포함되지 않아 토큰 로드 실패 시 에러 미표시 — 조건에 추가
- [x] deposit topup 금액 `parseEther('0.01')` 하드코딩 — `DEPOSIT_AMOUNT` 상수 + 네이티브 심볼 적용
- [x] erc-20 token(usdc) approve tx에 `gasPayment: { type: 'sponsor' }` 적용 (wallet-extension 방식과 동일)

---

## 02-C. Receive

**Source**: `app/payment/receive/page.tsx`
**Route**: `/payment/receive`

### UI 구성
- QR 코드 (`QRCodeSVG`)
- 주소 표시 (code 태그)
- Copy 버튼 (2초간 "Copied!" 피드백)
- 네트워크 경고 메시지

### 데이터 흐름
```
Hooks:
  - useWallet() → address, isConnected
State:
  - copied: boolean (2초 타이머)
```

### Issue Checklist

- [x] `copyToClipboard()` 실패 시 사용자 피드백 없음 — 에러 toast 추가
- [x] Copy 버튼 연속 클릭 시 이전 타이머 미정리 — `clearTimeout` 후 새 타이머 설정

---

## 02-D. History

**Source**: `app/payment/history/page.tsx`
**Route**: `/payment/history`

### UI 구성

#### Pending Operations Banner
- 대기중 UserOp 목록
- Speed Up / Cancel / Recheck / Dismiss 버튼

#### Recent Transactions (페이지네이션)
- 10건/페이지
- 거래 방향 아이콘, 주소, 시간, 금액, 상태 뱃지
- 빈 상태 메시지

### 데이터 흐름
```
Hooks:
  - useTransactionHistory() → transactions[], isLoading, error
  - useUserOp() → recheckUserOp(), getPendingUserOps(), removePendingUserOp()
  - useTransactionManager() → speedUpTransaction(), cancelTransaction()

State:
  - currentPage, pendingOps[], recheckingHash, actionHash
```

### Issue Checklist

- [x] `_showPending` (searchParams) 미사용 — dead code 제거
- [x] Speed Up / Cancel / Recheck 동시 클릭 가능 — `disabled={actionHash !== null}` 적용
- [x] `recheckUserOp` 성공 후 거래 이력 미갱신 — `refresh()` 호출 추가
- [x] `currentPage`가 데이터 변경 시 리셋 안됨 — transactions 변경 시 1페이지로 리셋
- [x] `op.to.slice(0, 8)` — `op.to ?` null guard 적용
- [x] `formatRelativeTime(op.timestamp)` — undefined timestamp 삼항 연산자 방어
- [x] 모든 거래에 동일 방향 아이콘(send) 표시 — from/to 비교하여 send/receive 아이콘+색상 구분
