# 12. Buy (On-Ramp)

**Source**: `src/ui/pages/BuyPage.tsx`
**Page Key**: `buy`

## UI 구성

### Header
- Back 버튼 (optional)
- 제목: "Buy Crypto"

### Tabs
- **Buy** | **Orders** (pending 수량 뱃지)

### Buy Tab

#### KYC 상태 배너
- `rejected`: destructive 배너
- `pending`: warning 배너
- KYC API: `http://localhost:3002/api/v1/kyc/status/{address}`

#### Amount Card
- **Fiat 금액 입력**: number type
- **Fiat 통화 선택**: USD, EUR, GBP, KRW, JPY
- ↓ 화살표 아이콘
- **Crypto 선택**: ETH, USDC, USDT, DAI
- **Get Quote 버튼**

#### Quote 표시
- `<QuoteCard>` 컴포넌트 (환율, 수수료, 예상 수령량)
- Quote 만료: expiresAt 기반 1초 체크, 만료 시 null

#### Payment Method 선택
- `<PaymentMethodSelector>` 컴포넌트
- bank_transfer 선택 시: 연결된 은행 계좌 선택 드롭다운
- "Continue to Payment" 버튼

### Orders Tab
- 빈 상태: "No orders" + "Buy Crypto" 버튼
- `<OrderCard>` 목록: 주문 상태, 취소 버튼

### Payment Instructions Modal
- 결제 금액 + 통화
- Reference (orderId 앞 12자)
- bank_transfer: 은행 이체 정보
- "Completed Payment" 버튼

## 데이터 흐름

```
Mount 시 로드:
  - GET_LINKED_BANK_ACCOUNTS
  - GET_ONRAMP_ORDERS
  - KYC status: fetch('http://localhost:3002/api/v1/kyc/status/{address}')
  - Supported assets: fetch('http://localhost:3002/api/v1/supported-assets')

Quote:
  - GET_ONRAMP_QUOTE -> { quote: OnRampQuote }
  - Quote 만료 타이머 (1초 간격)

Order:
  - CREATE_ONRAMP_ORDER -> { order: OnRampOrder }
  - GET_ONRAMP_ORDERS (폴링)
  - CANCEL_ONRAMP_ORDER

Polling:
  - pending/processing 주문 있으면 15초 간격 GET_ONRAMP_ORDERS

통화 목록:
  - API 응답 있으면 동적, 없으면 DEFAULT 사용
```

## Types

```typescript
type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'KRW' | 'JPY'
type CryptoCurrency = 'ETH' | 'USDC' | 'USDT' | 'DAI'
type PaymentMethod = 'card' | 'bank_transfer' | ...

interface OnRampQuote {
  id: string
  expiresAt: string
  // rate, fees, etc.
}

interface OnRampOrder {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed'
  fiatCurrency: string
  totalFiatAmount: number
  paymentMethod: string
}
```

## Issue Checklist

- [x] KYC API URL 하드코딩 (localhost:3002) - 환경변수 필요 → **수정 완료**: `getApiConfig().onrampApiUrl` 사용 (VITE_WALLET_ONRAMP_API_URL 오버라이드 가능)
- [x] Supported assets API URL 하드코딩 (localhost:3002) → **수정 완료**: 동일하게 `getApiConfig().onrampApiUrl` 사용
- [x] KYC rejected/pending 상태에서도 구매 진행 가능 (차단 없음) → **수정 완료**: KYC rejected 시 Get Quote 버튼 disabled
- [x] Quote 만료 시 사용자 알림 없음 (조용히 null) → **수정 완료**: 만료 시 `quoteExpired` 에러 메시지 표시
- [x] Payment Instructions modal: 은행 정보가 하드코딩 placeholder → NOTE: 실제 은행 정보는 onramp API 응답에서 제공해야 함 (향후 과제)
- [x] Order 취소 에러 처리 없음 (빈 catch) → **수정 완료**: response.error 체크 + catch 블록에 `cancelOrderFailed` 에러 표시
- [x] gray 하드코딩 색상 사용 (text-gray-500 등) → **수정 완료**: CSS variable (`--secondary`, `--muted-foreground`, `--foreground`, `--warning`) 전환
- [x] _isPollingOrder, _isLoadingCurrencies: unused state (prefix _ 사용) → **수정 완료**: `_` prefix 제거, `[, setter]` 패턴으로 변경
- [x] bank simulator, pg simulator 연동 (.env 지원) → OK: `config/constants.ts`에 `BANK_API_URL`, `ONRAMP_API_URL` env 매핑 이미 존재

### 수정 내역 (2026-03-11)
1. `BuyPage.tsx`: `http://localhost:3002/api/v1` 하드코딩 → `getApiConfig().onrampApiUrl` (KYC + supported-assets 2곳)
2. `BuyPage.tsx`: KYC rejected 시 Get Quote 버튼 disabled 추가
3. `BuyPage.tsx`: Quote 만료 시 `setQuoteError(t('quoteExpired'))` 알림 추가
4. `BuyPage.tsx`: `handleCancelOrder`에 에러 처리 (response.error 체크 + catch) 추가
5. `BuyPage.tsx`: gray 하드코딩 색상 → CSS variable 전환 (amount card 화살표, orders empty state, payment modal)
6. `BuyPage.tsx`: `_isPollingOrder` → `[, setIsPollingOrder]`, `_isLoadingCurrencies` → `[, setIsLoadingCurrencies]`
7. `buy.json` (en/ko): `quoteExpired`, `cancelOrderFailed` 키 추가