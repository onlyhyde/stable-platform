# 07. Transaction Detail

**Source**: `src/ui/pages/TransactionDetail.tsx`
**Page Key**: `txDetail`

## UI 구성

### Header
- Back 버튼 -> Activity 페이지
- 제목: "Transaction Detail"

### Transaction Stepper
- `<TransactionStepper>` 컴포넌트
- 상태: submitted / pending / confirmed / failed

### Detail Card (secondary 배경)

| 필드 | 표시 조건 | 포맷 |
|------|----------|------|
| Transaction Hash | displayHash 존재 | truncated (10...8) + 복사 + explorer 링크 |
| From | 항상 | full address, break-all |
| To | 항상 | full address 또는 '-' |
| Value | 항상 | formatEther, 소수점 6자리 + symbol |
| Gas Used | tx.gasUsed | toString() |
| Gas Price | tx.gasPrice | toString() |
| Block Number | tx.blockNumber | toString() |
| Timestamp | 항상 | toLocaleString() |
| UserOp Hash | tx.userOpHash | truncated + 복사 버튼 |

### Waiting for Bundler
- txHash가 없고 UserOp인 경우: "Waiting for bundler..." italic 텍스트

### Pending Actions (pending/submitted 상태)
- **Speed Up** 버튼 (warning 스타일)
  - `stablenet_speedUpTransaction` RPC
- **Cancel** 버튼 (destructive 스타일)
  - `stablenet_cancelTransaction` RPC

## 데이터 흐름

```
Hooks:
  - useWalletStore: selectedTxId, pendingTransactions, history, syncWithBackground
  - useSelectedNetwork: explorerUrl
  - useNetworkCurrency: symbol

TX 조회:
  - selectedTxId로 pendingTransactions + history에서 검색

Auto-refresh:
  - pending/submitted 상태일 때 3초마다 syncWithBackground()

Explorer 링크:
  - chrome.tabs.create({ url: `${explorerUrl}/tx/${txHash}` })
```

## Issue Checklist

- [x] Gas Price 표시: raw bigint → Gwei 변환 → **수정 완료**: `formatGwei(tx.gasPrice)` + "Gwei" 접미사
- [x] Gas Used 표시: raw bigint → 가독성 포맷 → **수정 완료**: `Number(tx.gasUsed).toLocaleString()` 천 단위 구분자
- [x] Speed Up / Cancel 실패 시 에러 표시 → **수정 완료**: response.payload.error 체크 + catch 에러 → `actionFeedback` 상태로 에러 배너 표시 (3초)
- [x] Speed Up / Cancel 성공 시 UI 피드백 → **수정 완료**: 성공 시 success 배너 표시 + `syncWithBackground()` 호출
- [x] selectedTxId null 처리 → OK: "No transaction selected" 이미 구현됨
- [x] Explorer 링크 sidepanel 호환 → **수정 완료**: `openExplorer()` 함수로 분리, `chrome.tabs.create` 실패 시 `window.open` fallback

### 수정 내역 (2026-03-11)
1. `TransactionDetail.tsx`: Gas Price를 `formatGwei()` (viem)로 변환 + "Gwei" 접미사
2. `TransactionDetail.tsx`: Gas Used를 `Number().toLocaleString()`으로 천 단위 구분
3. `TransactionDetail.tsx`: Speed Up/Cancel에 `ActionFeedback` 상태 추가 → 성공/실패 배너 표시 (3초)
4. `TransactionDetail.tsx`: `openExplorer()` 함수로 `chrome.tabs.create` + `window.open` fallback
5. `tx.json` (en/ko): `speedUpSuccess`, `speedUpFailed`, `cancelSuccess`, `cancelFailed`, `waitingForBundler` 번역 키 추가
