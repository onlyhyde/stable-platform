# 03. Home

**Source**: `src/ui/pages/Home.tsx`
**Page Key**: `home` (default)

## UI 구성

### 1. Balance Card (그라디언트 카드)
- **잔액 표시**: `formatEther(balance)` + currency symbol (소수점 4자리)
- **USD 환산**: `balanceUsd` (nativePriceUsd * balance)
- **계정 타입 뱃지**: EOA / Smart Account
- **미배포 뱃지**: `isDeployed === false`일 때 "Not Deployed"
- **로딩 상태**: animate-pulse 텍스트

### 2. Quick Actions (2x2 또는 3x2 그리드)
| 버튼 | 대상 페이지 | 조건 |
|------|-----------|------|
| Send | `send` | 항상 |
| Receive | `receive` | 항상 |
| Smart Account | `dashboard` | Smart Account일 때 |
| Upgrade (EIP-7702) | `modules` | EOA일 때 |
| Swap | `swap` | Smart Account일 때 |
| Activity | `activity` | 항상 |

### 3. Token List (`<TokenList>` 컴포넌트)
- **Native 토큰 잔액** 표시
- **Indexer 토큰 잔액** (tokenBalances from useIndexerData)
- **커스텀 토큰** (assetTokens from useAssets)
- **토큰 가격** (USD, useTokenPrices hook)
- **토큰 클릭** -> Send 페이지로 이동 (selectedSendToken 설정)
- **토큰 추가** -> AddTokenModal 오픈
- **가시성 토글** -> toggleTokenVisibility
- **새로고침** -> loadBalance + refreshTokenBalances + refreshAssets

### 4. Indexer 상태
- `isIndexerAvailable === false`: "Token discovery unavailable" 메시지

### 5. Account Address 영역
- 전체 주소 표시 (code 태그)
- 복사 버튼

### 6. Add Token Modal (`<AddTokenModal>`)

## 데이터 흐름

```
Hooks:
  - useWalletStore: selectedAccount, accounts, balances, updateBalance, setPage, setSelectedSendToken
  - useNetworkCurrency: symbol
  - useIndexerData: tokenBalances, isLoadingTokens, refreshTokenBalances, isIndexerAvailable
  - useAssets: tokens, isLoading, refresh, toggleTokenVisibility
  - useTokenPrices: prices (USD 환산용)

Balance Polling:
  - mount + 매 15초마다 loadBalance() 호출
  - chrome.runtime.sendMessage({ type: 'RPC_REQUEST', method: 'eth_getBalance' })
```

## Issue Checklist

- [x] 잔액이 undefined일 때 `-- WKRC` 표시 (OK - 기존 정상)
- [x] 토큰 가격이 없을 때 USD 숨김 (OK - 기존 정상)
- [x] Quick Actions 그리드 레이아웃 (EOA: 2x2, Smart: 3x2) 확인 (OK - 기존 정상)
- [x] 토큰 클릭 시 Send 페이지 토큰 프리셋 동작 (OK - 기존 정상)
- [x] 새로고침 버튼 동작 확인 (OK - 기존 정상)
- [x] 15초 폴링 cleanup 확인 (OK - 기존 정상)
- [x] Indexer 미사용 시 토큰 목록 빈 상태 (OK - 기존 정상)
- [x] Assets 의 '+' 버튼으로 Add Token 을 할때, 주소를 입력하면, 해당 주소가 ERC-20 토큰이 맞는지 체크해서, 맞는 경우, 현재 선택된 계정의 주소에 대한 balance 를 조회해서 Assets 리스트에 토큰 추가와 자산 출력을 처리 → **수정 완료**

### 수정 내역 (2026-03-10)
1. `AddTokenModal.tsx`: ERC-20 메타데이터 조회를 `Promise.all`로 병렬화 (symbol/name/decimals 동시 호출)
2. `AddTokenModal.tsx`: 토큰 주소 입력 후 `balanceOf(selectedAccount)` 조회 추가 → 프리뷰 카드에 현재 계정의 잔액 표시
3. `AddTokenModal.tsx`: 미사용 `wallet_getTokenMetadata` RPC 호출 제거
4. `useTokenPrices.ts`: symbols 배열 참조 안정화 (`useMemo` + `useRef`) → 무한 폴링 루프 버그 수정, 미사용 `totalValueUsd` 제거
5. `Send/index.tsx`: `selectedSendToken` 소비 로직 추가 → ERC-20 토큰 클릭 시 Send 페이지에 토큰 컨텍스트 배너 표시 + `transfer()` calldata 자동 구성
6. `send.json` (en/ko): `sendingToken` 번역 키 추가

