# 06. Activity

**Source**: `src/ui/pages/Activity.tsx`
**Page Key**: `activity`

## UI 구성

### Header
- 제목: "Activity"
- 새로고침 버튼 (spin 애니메이션)

### Indexer 상태 배너
- `isIndexerAvailable === false`: info 스타일 알림
- `indexerError`: destructive 스타일 + Retry 버튼

### Loading 상태
- spinner + "Loading..." 텍스트 (트랜잭션 없을 때만)

### Empty 상태
- 클립보드 아이콘 (w-16 h-16)
- "No transactions" 메시지

### Transaction List

#### Pending Section
- warning 색상 라벨 "Pending Transactions"
- 각 TX를 TransactionItem으로 표시

#### Confirmed Section (날짜별 그룹)
- 그룹 라벨: Today / Yesterday / "Mar 5, 2026" 형식
- 각 TX를 TransactionItem으로 표시

#### TransactionItem
- **아이콘**: 수신(초록 ↓) / 송신(파랑 ↑)
- **라벨**: send/receive/swap/approve/contract/userOp
- **상대 주소**: from(수신) 또는 to(송신), truncated
- **금액**: 토큰 전송이면 토큰 금액, 아니면 native 금액
  - 수신: `+` 접두사 (green)
  - 송신: `-` 접두사
- **상태 뱃지**: pending(warning)/submitted(info)/confirmed(success)/failed(destructive)/cancelled(muted)
  - pending/submitted: animate-pulse dot
- **Method name**: contract 타입일 때 `methodName()` 표시
- **시간**: timestamp -> toLocaleTimeString()

#### Load More
- indexer 가능 + hasMore일 때 버튼 표시

### Transaction Click
- `setSelectedTxId(tx.id)` + `setPage('txDetail')`

## 데이터 흐름

```
Hooks:
  - useWalletStore: pendingTransactions, history, syncWithBackground, setSelectedTxId, setPage
  - useIndexerData: transactions, isIndexerAvailable, isLoadingTransactions, hasMore, loadMoreTransactions, refreshTransactions

Merge Logic (allTransactions):
  1. local txs = [...pendingTransactions, ...history]
  2. indexed txs = indexedTransactions.map(toDisplayTransaction)
  3. 중복 제거: local txHash가 있으면 indexed에서 제외
  4. 합쳐서 timestamp 내림차순 정렬

Auto-refresh:
  - pending TX 존재 시 5초마다 syncWithBackground()

Date Grouping:
  - Today / Yesterday / "Month Day, Year"
```

### toDisplayTransaction 변환
```
IndexedTransaction -> PendingTransaction:
  - hash -> id, txHash
  - direction: 'in' -> 'receive', else -> 'send'
  - status: 'success' -> 'confirmed'
  - chainId: 0 (미사용)
```

## Issue Checklist

- [x] Indexer + Local TX 병합 시 중복 처리 검증 → **수정 완료**: userOpHash도 dedup Set에 포함하여 indexer의 실제 txHash와 local의 userOpHash 간 중복 방지
- [x] pending TX 자동 갱신 정상 동작 → OK: 5초 interval + cleanup 정상
- [x] Load More 페이지네이션 동작 → OK: `isTxIndexerAvailable && hasMore` 조건 사용
- [x] 날짜 그룹핑 정확성 (timezone) → OK: local timezone 기반 Date 비교 정상
- [x] Token transfer 금액 표시 정확성 → OK: tokenTransfer 있으면 토큰 금액, 없으면 native 금액 표시
- [x] TransactionItem 클릭 -> TxDetail 네비게이션 → OK: `handleTxClick` 정상
- [x] 빈 상태 UI → OK: 트랜잭션 없을 때 클립보드 아이콘 + 메시지 표시
- [x] 트랜잭션 히스토리를 불러오는데도, 에러 문구 계속 출력 → **수정 완료**: `useIndexerData` 에러 상태를 `tokenError`/`txError`로 분리, Activity에서 `txError`만 표시
- [x] userOp hash로 인한 indexer 검색 불일치 → **수정 완료**: dedup 로직에서 `txHash` + `userOpHash` 모두 비교
- [x] 새로고침 시 "온체인 히스토리 사용 불가" 문구 출력 → **수정 완료**: `isIndexerAvailable`을 `isTokenIndexerAvailable`/`isTxIndexerAvailable`로 분리, Activity에서 `isTxIndexerAvailable`만 참조

### 수정 내역 (2026-03-10)
1. `useIndexerData.ts`: 공유 `error`/`isIndexerAvailable` 상태를 `tokenError`/`txError`, `isTokenIndexerAvailable`/`isTxIndexerAvailable`로 분리 → 병렬 호출 race condition 해결
2. `useIndexerData.ts`: 하위 호환을 위해 `isIndexerAvailable` (OR 결합)과 `error` (txError 우선) 파생 값 유지
3. `Activity.tsx`: indexer unavailable 배너를 `isTxIndexerAvailable` 기준으로 변경
4. `Activity.tsx`: 에러 배너를 `txError` 기준으로 변경
5. `Activity.tsx`: dedup 로직에 `userOpHash`도 포함 → userOp 트랜잭션의 중복 표시 방지
6. `Home.tsx`: token discovery 배너를 `isTokenIndexerAvailable` 기준으로 변경
