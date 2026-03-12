# 01. Dashboard

**Source**: `app/page.tsx`
**Route**: `/`

## UI 구성

### 1. Balance Card (그라디언트 배경)
- 네이티브 토큰 잔고 (`formatTokenBalance(balance, decimals)` — `@stablenet/core`)
- 지갑 주소 표시 (`formatAddress(address, 6)`)
- Refresh 버튼 (`refetch()`)

### 2. Token List Card
- ERC-20 토큰 목록 (로고/심볼/이름/잔고)
- 토큰 로고: 깨진 이미지 시 심볼 첫 글자 fallback
- Fallback 경로: 직접 on-chain `balanceOf()` 호출로 ERC-20 잔고 조회

### 3. Quick Actions (2x2 grid)
| 버튼 | 대상 | 조건 |
|------|------|------|
| Send | `/payment/send` | 항상 |
| Receive | `/payment/receive` | 항상 |
| Swap | `/defi/swap` | 항상 |
| Stealth | `/stealth` | 항상 |

### 4. Recent Activity
- 최근 거래 내역 (ERC-20 Transfer 이벤트 기반)
- 거래 방향 아이콘, 주소, 시간, 금액
- ERC-20 transfer에 토큰 심볼/소수점 표시 (DEFAULT_TOKENS 메타데이터)
- 에러 상태 표시 (경고 아이콘 + 메시지)
- 로딩 상태 표시

## 데이터 흐름

```
Hooks:
  - useWallet() → address, isConnected, connect()
  - useWalletAssets() → native, tokens[], isSupported, refetch()
    - wallet_getAssets (StableNet) → fallback: eth_getBalance + on-chain balanceOf()
  - useTransactionHistory() → transactions[], isLoading, error
    - publicClient.getLogs() → ERC-20 Transfer events (최근 5000 블록)

On-Chain 조회 (IndexerClient 대체):
  - publicClient.readContract() → erc20Abi.balanceOf(address) 병렬 호출
  - publicClient.getLogs() → Transfer(from, to, value) 이벤트
  - DEFAULT_TOKENS[chainId] → 토큰 메타데이터 (symbol, decimals, name)

SDK 활용:
  - @stablenet/core → formatTokenBalance (잔고 포맷팅)
  - viem → erc20Abi, parseAbiItem (on-chain 호출)

렌더링:
  - 미연결: ConnectWalletCard
  - 연결: Balance + Tokens + Actions + Activity
  - 최근 내역: transactions.slice(0, 5)
```

## Issue Checklist

- [x] `useTransactionHistory()`의 `error` 상태를 UI에 표시하지 않음 — ✅ 에러/로딩 상태 분기 추가
- [x] `addToken` (`_addToken`) import 후 미사용 — ✅ dead code 제거
- [x] 트랜잭션 항목에서 `tx.from`, `tx.to` 미검증 후 `formatAddress()` 호출 — ✅ optional chaining + 'Unknown' fallback 추가
- [x] ERC-20 토큰 잔고 미표시 — ✅ IndexerClient(GraphQL) → on-chain `balanceOf()` 직접 호출로 전환
- [x] Activity에서 GraphQL 실패 — ✅ IndexerClient → `publicClient.getLogs()` Transfer 이벤트 조회로 전환
