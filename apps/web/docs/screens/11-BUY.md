# 11. Buy (OnRamp)

**Source**: `app/buy/page.tsx`
**Route**: `/buy`

## UI 구성

### Tab: Buy
- KYC Status Banner (none/pending/verified/rejected 색상 구분)
- Quote Form:
  - Fiat Amount + Currency 선택 (USD/EUR/KRW)
  - Crypto 선택 (ETH/USDC/USDT, 3-버튼 grid)
  - Payment Method (bank_transfer/card/wire)
  - Bank Account 선택 (bank_transfer 선택 시)
  - Get Quote 버튼
- QuoteDisplay: 환율, 수수료, 만료 카운트다운
- Buy Now / New Quote 버튼

### Tab: Orders
- 주문 목록 (페이지네이션)
- Cancel 버튼 (pending 상태)

## 데이터 흐름

```
Hooks:
  - useWallet() → address, isConnected
  - useOnRamp() → quote, orders, kycStatus
    - getQuote(), createOrder(), cancelOrder(), refreshOrders(), checkKycStatus()
  - useBankAccounts() → accounts

State:
  - activeTab: 'buy' | 'orders'
  - fiatAmount, fiatCurrency, cryptoCurrency, paymentMethod, selectedAccount
  - QuoteDisplay 내부: timeLeft (setInterval 카운트다운)

Effects:
  - address 변경 → checkKycStatus()
  - orders 탭 → refreshOrders()
```

## Issue Checklist

- [ ] KYC 상태 로딩 중 "Buy Now" 버튼 활성화 가능 — 체크 완료 전 kycStatus가 `'none'`이면 비활성이지만, 로딩 상태 미표시
- [ ] `paymentMethod === 'bank_transfer'` 시 `selectedAccount` 미선택 상태로 주문 생성 가능 — 빈 문자열 검증 필요
- [ ] Quote 만료 카운트다운 interval 미정리 — 컴포넌트 언마운트 후에도 계속 실행
- [ ] `new Date(quote.expiresAt).getTime()` — 비표준 날짜 형식 시 NaN 반환. "NaN:NaN" 표시
- [ ] `Number(fiatAmount)` — `"-100"` → `-100`, 음수 허용. 최소 금액 검증 필요
- [ ] orders 탭 count 표시 지연 — refreshOrders 완료 전 이전 count 표시
- [ ] `order.createdAt` 날짜 포맷 미검증 — "Invalid Date" 표시 가능
