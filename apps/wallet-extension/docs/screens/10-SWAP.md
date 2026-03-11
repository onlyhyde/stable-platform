# 10. Swap

**Source**: `src/ui/pages/SwapPage.tsx`
**Page Key**: `swap`

## 전제 조건
- Smart Account (type !== 'eoa')
- Swap Executor 모듈 설치됨

## UI 구성

### Header
- Back 버튼 -> Home
- 제목: "Swap"

### From Token 영역
- "From" 라벨
- Max 버튼 (잔액 표시: `Max: 1.2345`)
- **금액 입력**: text, inputMode=decimal, 2xl 크기
- **토큰 선택**: `<select>` (native + assetTokens)
- USD 환산: `~$xxx.xx`

### Swap Direction 버튼
- 중앙 원형 버튼 (↕)
- 클릭 시 from/to 토큰 교환

### To Token 영역
- "To (estimated)" 라벨
- **예상 출력**: readOnly, estimate.estimatedOutput
- **토큰 선택**: fromToken 제외한 assetTokens
- USD 환산

### Swap Details (estimate 존재 시)
| 항목 | 값 |
|------|-----|
| Rate | `1 ETH = 1234.567890 USDC` |
| Minimum Received | `minOutput + symbol` |
| Slippage Tolerance | `0.5%` / `1%` / `2%` |
| Price Impact | `0.30%` (>2%: warning, >5%: destructive) |
| Fee Tier | `0.3%` (DEFAULT_SWAP_FEE = 3000) |

### Slippage Tolerance 선택
- 3개 버튼: 0.5% / 1% / 2%

### Error / Success 알림
- 에러: destructive 스타일 카드
- 성공: success 스타일 카드 + txHash (0x...인 경우)

### Swap 버튼
- 상태별 텍스트:
  - Swapping... (로딩)
  - Smart account required (EOA)
  - Install swap module (모듈 미설치)
  - Select token (to 미선택)
  - Enter amount (금액 미입력)
  - Swap (정상)

### 추가 안내
- EOA: "Swap requires smart account" warning
- Smart + 모듈 미설치: "Install swap module →" 링크 -> modules 페이지

## 데이터 흐름

```
Hooks:
  - useWalletStore: selectedAccount, accounts, balances, setPage
  - useAssets: tokens (커스텀 토큰 목록)
  - useSelectedNetwork: currentNetwork
  - useNetworkCurrency: nativeSymbol
  - useTokenPrices: prices

Swap Executor 조회:
  - stablenet_getInstalledModules RPC
  - type === 2 (Executor) && name에 'swap' 포함

Estimate 계산 (클라이언트사이드):
  - fromPrice * fromAmount / toPrice = estimatedOutput
  - minOutput = estimatedOutput * (1 - slippage)
  - priceImpact ≈ max(fee, execution slip) * 100

Swap 실행:
  - stablenet_executeSwap RPC
  - params: account, swapExecutorAddress, tokenIn, tokenOut, fee, amountIn, amountOutMinimum, deadline, chainId
  - deadline: 현재 + 20분
  - fee: 3000 (0.3%)

Max Amount:
  - native: balance - 0.01 (가스비 예약)
  - token: formattedBalance 사용
```

### parseAmountToWei
```typescript
// "1.5" + decimals=18 -> 1500000000000000000n
// whole + paddedFraction -> BigInt
```

## Issue Checklist

- [x] Estimate가 클라이언트사이드 가격 기반 (실제 DEX quote 아님) → NOTE: 설계 한계, 향후 DEX aggregator API 연동 필요
- [x] To 토큰에 native token이 없음 (assetTokens만 표시) → **수정 완료**: To select에 native token option 추가 (fromToken이 native가 아닐 때)
- [x] Price Impact 계산이 단순화됨 (실제 유동성 기반 아님) → NOTE: 설계 한계, 실제 유동성 풀 데이터 연동 필요
- [x] Swap 성공 후 잔액 자동 갱신 없음 → **수정 완료**: 성공 후 `syncWithBackground()` 호출
- [x] swapExecutorAddress 찾기: metadata.name에 'swap' 포함 여부만 체크 → NOTE: 현재 동작, 향후 module type ID 기반 조회로 개선 가능
- [x] parseAmountToWei: 소수점 없는 경우 whole만 사용 → OK: `fraction = ''` → `padEnd(decimals, '0')` → 정상 동작 확인
- [x] Max 클릭 시 가스비 예약량(0.01) 적절한지 → OK: 일반적 가스비 수준에서 합리적, 네트워크별 동적 조정은 향후 과제
- [x] `isSmartAccount` 체크가 `type === 'smart'`만 포함 → **수정 완료**: `type !== 'eoa'`로 변경하여 delegated 계정 지원
- [x] `priceImpact` i18n 키 누락 (fallback string 사용) → **수정 완료**: en/ko swap.json에 키 추가

### 수정 내역 (2026-03-11)
1. `SwapPage.tsx`: `isSmartAccount` 조건을 `type === 'smart'` → `type !== 'eoa'`로 변경 (delegated 계정 지원)
2. `SwapPage.tsx`: To 토큰 select에 native token option 추가 (fromToken !== nativeSymbol 조건)
3. `SwapPage.tsx`: Swap 성공 후 `syncWithBackground()` 호출하여 잔액 자동 갱신
4. `SwapPage.tsx`: `t('priceImpact', 'Price Impact')` fallback 제거 → `t('priceImpact')` 정상 i18n 호출
5. `swap.json` (en/ko): `priceImpact` 번역 키 추가
6. `SwapPage.tsx`: `syncWithBackground` destructure from `useWalletStore`
