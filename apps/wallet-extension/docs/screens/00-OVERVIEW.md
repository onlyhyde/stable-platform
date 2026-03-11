# Wallet Extension - UI Screen Overview

## App Architecture

```
App.tsx (src/ui/App.tsx)
  |-- Loading Spinner (초기화 전)
  |-- Onboarding (미초기화 시)
  |-- Lock Screen (잠금 시)
  |-- Main Layout (해제 후)
       |-- Header (네트워크/계정 선택)
       |-- Error Banner (글로벌 에러)
       |-- Loading Overlay
       |-- Main Content (currentPage에 따라 렌더링)
       |-- Navigation (하단 5개 탭)
```

## Screen List

| # | Screen | Page Key | Source File | 상태 |
|---|--------|----------|-------------|------|
| 1 | [Onboarding](./01-ONBOARDING.md) | - | `pages/Onboarding/index.tsx` | |
| 2 | [Lock](./02-LOCK.md) | - | `pages/Lock.tsx` | |
| 3 | [Home](./03-HOME.md) | `home` | `pages/Home.tsx` | |
| 4 | [Send](./04-SEND.md) | `send` | `pages/Send/index.tsx` | |
| 5 | [Receive](./05-RECEIVE.md) | `receive` | `pages/Receive.tsx` | |
| 6 | [Activity](./06-ACTIVITY.md) | `activity` | `pages/Activity.tsx` | |
| 7 | [Transaction Detail](./07-TX-DETAIL.md) | `txDetail` | `pages/TransactionDetail.tsx` | |
| 8 | [Smart Account Dashboard](./08-SA-DASHBOARD.md) | `dashboard` | `pages/SmartAccountDashboard.tsx` | |
| 9 | [Modules](./09-MODULES.md) | `modules` | `pages/Modules/index.tsx` | |
| 10 | [Swap](./10-SWAP.md) | `swap` | `pages/SwapPage.tsx` | |
| 11 | [Bank](./11-BANK.md) | `bank` | `pages/Bank.tsx` | |
| 12 | [Buy](./12-BUY.md) | `buy` | `pages/BuyPage.tsx` | |
| 13 | [Settings](./13-SETTINGS.md) | `settings` | `pages/Settings.tsx` | |
| 14 | [Approval (별도 윈도우)](./14-APPROVAL.md) | - | `approval/` | |

## Shared Components

| Component | File | 용도 |
|-----------|------|------|
| Header | `components/Header.tsx` | 로고, 네트워크 선택, 계정 선택 |
| Navigation | `components/Navigation.tsx` | 하단 탭바 (Home, Send, Modules, Activity, Settings) |
| AccountSelector | `components/common/AccountSelector.tsx` | 계정 드롭다운 |
| TokenList | `components/TokenList.tsx` | 토큰 목록 (Home에서 사용) |
| AddTokenModal | `components/AddTokenModal.tsx` | 커스텀 토큰 추가 모달 |
| TransactionStepper | `components/common/TransactionStepper.tsx` | Tx 진행 상태 표시 |

## Navigation Flow

```
Onboarding -> Lock -> Home (default)
                       |
                       +-> Send -> Review -> Pending -> Success
                       +-> Receive
                       +-> Activity -> TxDetail
                       +-> Dashboard (Smart Account only)
                       +-> Modules -> Install/Details/DelegateSetup/...
                       +-> Swap (Smart Account + Swap Module)
                       +-> Bank
                       +-> Buy
                       +-> Settings
```

## State Management

- **Store**: Zustand (`useWalletStore`)
- **페이지 라우팅**: `currentPage` state (switch/case in App.tsx:102-129)
- **Background 통신**: `chrome.runtime.sendMessage` (RPC_REQUEST, STATE_UPDATE 등)
- **자동 동기화**: STATE_UPDATE 메시지 수신 시 `syncWithBackground()` 호출

## How to Use This Document

각 화면 문서에는 다음 정보가 포함되어 있습니다:
- **기능 목록**: 화면이 제공하는 모든 기능
- **UI 구성 요소**: 실제 코드에서 렌더링하는 요소들
- **데이터 흐름**: hooks, API 호출, state 관리
- **이슈 체크리스트**: 수정 작업 시 체크할 항목 (빈 체크박스)

수정이 필요한 항목은 각 문서의 체크리스트에 표시한 후 작업을 진행하세요.
