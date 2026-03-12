# 10. Bank

**Source**: `app/bank/page.tsx`
**Route**: `/bank`

## UI 구성

### Tab: Accounts
- Link Account Form: 계좌번호, 계좌유형 (checking/savings), 예금주명
- Linked Accounts: AccountCard 목록 (잔고, 마지막 동기화, Sync/Unlink 버튼)
- Refresh All 버튼

### Tab: Transfer
- From Account (select), To Account (input), Amount, Description
- Transfer 버튼

## 데이터 흐름

```
Hooks:
  - useWallet() → isConnected
  - useBankAccounts() → accounts[], isTransferring, error
    - linkAccount(), unlinkAccount(), syncAccount(), transfer(), refresh()
    - localStorage: stablenet:linked-bank-accounts
    - API: NEXT_PUBLIC_BANK_API_URL

State:
  - activeTab: 'accounts' | 'transfer'
  - linkAccountNo, linkAccountType, linkOwnerName
  - fromAccount, toAccount, transferAmount, transferDesc
```

## Issue Checklist

- [ ] `Number(transferAmount)` — NaN 변환 가능 (`"abc"` → NaN). 숫자 형식 검증 필요
- [ ] `linkAccountType` 성공 후 초기화 안됨 — 다음 연결 시 이전 계좌유형 유지
- [ ] `transfer()` 실패 시 에러 미표시 — hook error 있으나 UI에 미연결. 성공 toast만 존재
- [ ] 계좌 중복 연결 시 사용자 피드백 없음 — hook에서 중복 체크하지만 결과 무시
- [ ] `Number("1e10")`, `Number("Infinity")` 등 비정상 값 허용 — strict 파싱 필요
- [ ] `accountNo.slice(-4)` — 4자 미만 계좌번호에서 예상치 못한 결과
