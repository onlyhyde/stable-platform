# 04. Send

**Source**: `src/ui/pages/Send/index.tsx`
**Page Key**: `send`

## Flow

```
Form -> Review -> Pending -> Confirming -> (Confirmed | Failed)
                                        -> Error (pre-submission)
```

## UI 구성

### Step 1: Form (`step === 'form'`)

#### Transaction Mode Selector
- 사용 가능 모드: `getAvailableTransactionModes(selectedAccount)`
- EOA: EOA 모드만
- Smart Account: EOA + Smart Account + EIP-7702
- 버튼으로 전환

#### SendForm (`SendForm.tsx`)
- **Recipient**: 주소 입력 (isAddress 검증)
- **Amount**: 금액 입력 (ETH)
- **Data**: 커스텀 데이터 필드 (기본값 '0x')

#### Gas Payment (Smart Account 모드 전용)
- **Native**: 네이티브 토큰으로 가스비 지불
- **Sponsored**: 무료 (Paymaster)
- radio 버튼으로 선택

#### Gas Estimate
- `useGasEstimate` hook
- recipient + amount 입력 시 자동 추정
- `formatEther(gasEstimate.estimatedCost)` 표시
- Sponsored 선택 시 "Gas will be sponsored" 메시지

#### Review Button
- `isFormValid && !isEstimating`일 때 활성화

### Step 2: Review (`step === 'review'`)
- **Transaction Summary Card**:
  - Mode (EOA / EIP-7702 / Smart Account)
  - To (truncated address)
  - Amount + currency symbol
  - Gas (sponsored 또는 ETH 비용)
- **Back / Confirm 버튼**

### Step 3: Pending/Confirming
- `<TransactionStepper>` 컴포넌트
- 상태: submitting -> pending -> confirmed / failed
- txHash 표시 + explorer 링크
- "Send Another" / "View Activity" 버튼

### Step 4: Error (pre-submission)
- 빨간 X 아이콘
- "Transaction Failed" + 에러 메시지
- "Try Again" 버튼

## 데이터 흐름

```
Hooks:
  - useWalletStore: accounts, selectedAccount, pendingTransactions, history, syncWithBackground
  - useSelectedNetwork: explorerUrl
  - useNetworkCurrency: symbol
  - useGasEstimate: gasEstimate, isLoading
  - useSendTransaction: sendTransaction, isPending

sendTransaction({mode, from, to, value, data, gasPayment}):
  -> chrome.runtime.sendMessage (background에서 실제 TX 실행)
  -> TransactionResult { hash }

Polling (confirming):
  - 3초마다 syncWithBackground()
  - trackedTx 상태가 confirmed/failed면 폴링 중단
```

## Issue Checklist

- [x] 토큰 전송 모드 지원 여부 (현재 native ETH만) → **수정 완료** (03-HOME에서 ERC-20 tokenContext + transfer calldata 구현)
- [x] selectedSendToken 프리셋 활용 (Home에서 토큰 클릭 시) → **수정 완료** (03-HOME에서 구현)
- [x] Gas estimate 실패 시 UX → **수정 완료**: gasEstimateError 메시지 UI 표시 추가
- [x] Review에서 Back 시 form 데이터 유지 확인 (OK - 기존 정상)
- [x] Pending 상태에서 Speed Up / Cancel 미노출 (OK - TransactionStepper에서 처리)
- [x] 에러 후 retry 시 폼 상태 유지 (OK - 기존 정상)
- [x] pollingRef cleanup 확인 (OK - 기존 정상)
- [x] EOA는 legacy eoa 모드로 전송 (OK - useSendTransaction에서 eth_sendTransaction 사용)
- [x] EOA는 가스 결제 선택 불가, WKRC 직접 결제 (OK - GasPaymentSelector는 Smart Account 모드에서만 표시)
- [x] Smart Account는 eip-4337 기반 userOp 전송 (OK - useSendTransaction에서 eth_sendUserOperation 사용)
- [x] Smart Account 가스 결제 WKRC/ERC-20/무료(후원) 3종 선택 → **수정 완료**: 인라인 radio를 `GasPaymentSelector` 컴포넌트로 교체
- [x] WKRC 결제 시 EntryPoint deposit 체크 (초록/붉은색 표시) → **수정 완료**: `balanceOf(account)` 조회 + depositStatus 표시
- [x] ERC-20 결제 시 paymaster 선택/협의 UI → **수정 완료**: `GasPaymentSelector` + `usePaymasterClient` 연결 (pm_supportedTokens, pm_estimateERC20)
- [x] 무료(후원) 결제 시 paymaster 선택 UI → **수정 완료**: `SponsorInfo` 컴포넌트 (pm_sponsorPolicy, dailyLimit, perTxLimit)

### 수정 내역 (2026-03-10)
1. `Send/index.tsx`: 인라인 Transaction Mode Selector → `TransactionModeSelector` 컴포넌트 교체 (카드 UI, 기능 설명, 계정 타입 표시)
2. `Send/index.tsx`: 인라인 Gas Payment radio → `GasPaymentSelector` 컴포넌트 교체 (native/erc20/sponsor 3종)
3. `Send/index.tsx`: `useGasEstimate.error` UI 표시 추가 (가스 추정 실패 시 에러 메시지)
4. `GasPayment.tsx`: EntryPoint `balanceOf(account)` 조회 → native 결제 옵션에 deposit 상태 표시 (초록: sufficient, 빨강: insufficient)
5. 기존 미사용 컴포넌트(`GasPaymentSelector`, `TransactionModeSelector`, `usePaymasterClient`) 연결 완료

