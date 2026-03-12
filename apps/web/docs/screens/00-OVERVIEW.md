# Web App - UI Page Overview

## App Architecture

```
layout.tsx (app/layout.tsx)
  |-- Header
  |-- Sidebar (md:ml-64)
  |-- Main Content (page routes)
  |-- Footer
  |-- ErrorBoundary

Providers: StableNetProvider (wagmi, chainId, paymasterUrl, entryPoint)
Styling: Tailwind CSS + CSS Variables (rgb(var(--primary)))
Router: Next.js App Router (file-based)
State: Local useState + Custom hooks (no global store)
```

## Page List

| # | Page | Route | Source File | 상태 |
|---|------|-------|-------------|------|
| 1 | [Dashboard](./01-DASHBOARD.md) | `/` | `app/page.tsx` | |
| 2 | [Payment](./02-PAYMENT.md) | `/payment/*` | `app/payment/` | |
| 3 | [DeFi](./03-DEFI.md) | `/defi/*` | `app/defi/` | |
| 4 | [Smart Account](./04-SMART-ACCOUNT.md) | `/smart-account` | `app/smart-account/page.tsx` | |
| 5 | [Session Keys](./05-SESSION-KEYS.md) | `/session-keys` | `app/session-keys/page.tsx` | |
| 6 | [Stealth](./06-STEALTH.md) | `/stealth/*` | `app/stealth/` | |
| 7 | [Subscription](./07-SUBSCRIPTION.md) | `/subscription/*` | `app/subscription/` | |
| 8 | [Enterprise](./08-ENTERPRISE.md) | `/enterprise/*` | `app/enterprise/` | |
| 9 | [Marketplace](./09-MARKETPLACE.md) | `/marketplace` | `app/marketplace/page.tsx` | |
| 10 | [Bank](./10-BANK.md) | `/bank` | `app/bank/page.tsx` | |
| 11 | [Buy](./11-BUY.md) | `/buy` | `app/buy/page.tsx` | |
| 12 | [Settings](./12-SETTINGS.md) | `/settings` | `app/settings/page.tsx` | |
| 13 | [Docs](./13-DOCS.md) | `/docs/*` | `app/docs/` | |

## Shared Components

| Component | File | 용도 |
|-----------|------|------|
| PageHeader | `components/common/PageHeader.tsx` | 페이지 타이틀/설명 |
| ConnectWalletCard | `components/common/ConnectWalletCard.tsx` | 지갑 미연결 시 안내 |
| PaymasterSelector | `components/common/PaymasterSelector.tsx` | 가스 결제 모드 선택 (3종) |
| InfoBanner | `components/common/InfoBanner.tsx` | 교육용 안내 배너 |
| Card / CardContent | `components/ui/Card.tsx` | 카드 컨테이너 |
| BatchRecipientList | `components/payment/BatchRecipientList.tsx` | 배치 전송 수신자 목록 |

## Navigation Flow

```
/ (Dashboard)
  +-> /payment/send -> Review -> Pending
  +-> /payment/receive
  +-> /payment/history
  +-> /defi/swap
  +-> /defi/lend (Lending Executor 필요)
  +-> /defi/pool
  +-> /defi/stake (Staking Executor 필요)
  +-> /smart-account (EIP-7702 업그레이드/다운그레이드)
  +-> /session-keys
  +-> /stealth/send -> Generate -> Send
  +-> /stealth/receive -> Derive Keys -> Scan -> Withdraw
  +-> /subscription -> /subscription/plans
  +-> /subscription/merchant
  +-> /enterprise/payroll
  +-> /enterprise/expenses
  +-> /enterprise/audit
  +-> /marketplace (ERC-7579 모듈)
  +-> /bank
  +-> /buy
  +-> /settings
```

## Common Hooks

| Hook | 사용 빈도 | 용도 |
|------|-----------|------|
| `useWallet()` | 거의 모든 페이지 | 지갑 연결 상태, 주소 |
| `useToast()` | 대부분 페이지 | 알림 피드백 |
| `usePaymaster()` | Send, Swap | 가스 결제 (pm_getSponsorPolicy, pm_supportedTokens) |
| `useUserOp()` | Send, History | UserOperation 전송/관리 |
| `useSmartAccount()` | Smart Account, Marketplace | EIP-7702 상태 |
| `useStableNetContext()` | 내부적으로 사용 | chainId, paymasterUrl, entryPoint |

## How to Use This Document

각 화면 문서에는 다음 정보가 포함되어 있습니다:
- **기능 목록**: 화면이 제공하는 모든 기능
- **UI 구성 요소**: 실제 코드에서 렌더링하는 요소들
- **데이터 흐름**: hooks, API 호출, state 관리
- **이슈 체크리스트**: 코드 검토 결과 발견된 버그/개선 사항 (빈 체크박스)

수정이 필요한 항목은 각 문서의 체크리스트에서 체크한 후 작업을 진행하세요.
