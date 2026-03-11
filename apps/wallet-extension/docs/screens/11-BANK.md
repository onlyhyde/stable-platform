# 11. Bank

**Source**: `src/ui/pages/Bank.tsx`
**Page Key**: `bank`

## UI 구성

### Header
- Back 버튼 (optional, onBack prop)
- 제목: "Bank Accounts"
- "Link Account" 버튼

### Tabs
- **Accounts** | **Transfer**

### Accounts Tab

#### 연결된 계좌 없을 때
- 카드 아이콘 + "No linked accounts" + "Link First Account" 버튼

#### 연결된 계좌 있을 때
- `<BankAccountCard>` 컴포넌트 목록
  - 계좌 번호 + 타입
  - 잔액
  - 마지막 동기화 시간
  - Sync 버튼
  - Unlink 버튼

### Transfer Tab

#### 계좌 2개 미만
- "Need at least two accounts" 메시지

#### 2개 이상
- `<TransferForm>` 컴포넌트
  - From 계좌 선택
  - To 계좌 선택
  - Amount 입력
  - Description (선택)
  - Transfer 버튼

### Link Account Modal
- Account Number 입력
- Account Type 선택 (Checking / Savings)
- Owner Name 입력
- Cancel / Link Account 버튼

## 데이터 흐름

```
Message Types (chrome.runtime.sendMessage):
  - GET_LINKED_BANK_ACCOUNTS -> { accounts: LinkedBankAccount[] }
  - LINK_BANK_ACCOUNT -> { account: LinkedBankAccount } | { error: string }
  - UNLINK_BANK_ACCOUNT -> void
  - SYNC_BANK_ACCOUNT -> { account: LinkedBankAccount }
  - BANK_TRANSFER -> { error?: string }

State:
  - linkedAccounts: LinkedBankAccount[]
  - 로딩 시 mount에서 GET_LINKED_BANK_ACCOUNTS

Transfer 후:
  - loadLinkedAccounts() 새로고침
  - accounts 탭으로 전환
```

## Issue Checklist

- [x] Bank 기능이 실제 구현되어 있는지 (background controller) → NOTE: message type은 schema/types에 등록됨, background handler는 미구현 (향후 과제)
- [x] 에러 표시: gray 하드코딩 색상 사용 (text-gray-500, bg-gray-100) → **수정 완료**: CSS variable (`--secondary`, `--muted-foreground`)로 교체
- [x] Unlink 확인 대화상자 없음 (즉시 삭제) → **수정 완료**: `window.confirm()` + i18n 키 `confirmUnlink` 추가
- [x] Transfer 에러 처리: catch에서 아무것도 안 함 (isTransferring만 false) → **수정 완료**: catch 블록 + `setError()` + i18n 키 `transferFailed` 추가
- [x] Link modal validation: accountNo, ownerName만 체크 (형식 검증 없음) → **수정 완료**: 계좌번호 6~20자리 숫자 형식 검증 + i18n 키 `invalidAccountNumber` 추가
- [x] i18n: 'buy' 네임스페이스 사용 (별도 'bank' 네임스페이스가 적합) → **수정 완료**: `bank.json` (en/ko) 생성, `useTranslation('bank')` 변경, buy.json에서 bank 키 제거
- [ ] onramp 처럼 지원되는 ui 가 필요. (buy 항목과 유사) → NOTE: 향후 과제, BuyPage와 Bank 통합 또는 onramp 플로우 구현 필요

### 수정 내역 (2026-03-11)
1. `bank.json` (en/ko): 신규 생성 — bank 전용 i18n 키 분리 (23개 키, 신규 3개: confirmUnlink, transferFailed, invalidAccountNumber)
2. `buy.json` (en/ko): bank 전용 키 제거 (checking/savings는 BuyPage에서도 사용하므로 유지)
3. `i18n/index.ts`: `bank` 네임스페이스 등록
4. `Bank.tsx`: `useTranslation('buy')` → `useTranslation('bank')`
5. `Bank.tsx`: 하드코딩 gray 색상 → CSS variable (`--secondary`, `--muted-foreground`) 교체
6. `Bank.tsx`: `handleUnlinkAccount`에 `window.confirm(t('confirmUnlink'))` 추가
7. `Bank.tsx`: `handleTransfer`에 catch 블록 + `setError()` 추가
8. `Bank.tsx`: `handleLinkAccount`에 계좌번호 형식 검증 (6~20자리 숫자) 추가