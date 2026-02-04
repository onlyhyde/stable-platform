# Asset Management Implementation Plan

## Overview

Wallet Extension을 자산 관리의 Single Source of Truth로 구현하여, DApp에서 중복 구현 없이 지갑의 자산 정보를 활용할 수 있도록 합니다.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DApp (apps/web)                         │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  useWalletAssets  │  │    useBalance     │                  │
│  │   (StableNet)     │  │  (wagmi fallback) │                  │
│  └─────────┬─────────┘  └─────────┬─────────┘                  │
│            │                      │                             │
│            ▼                      ▼                             │
│  ┌──────────────────────────────────────────┐                  │
│  │         EIP-1193 Provider                │                  │
│  │  - wallet_getAssets                      │                  │
│  │  - wallet_addToken                       │                  │
│  │  - assetsChanged event                   │                  │
│  └──────────────────┬───────────────────────┘                  │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Wallet Extension                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Asset Manager                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  Native ETH │  │ ERC-20      │  │ Token Discovery │   │  │
│  │  │  Balance    │  │ Tokens      │  │ (Indexer)       │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Event Broadcaster                         │  │
│  │  - chainChanged, accountsChanged                          │  │
│  │  - assetsChanged (NEW)                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **자산 발견**: Indexer → TokenController → walletState
2. **자산 조회**: DApp → wallet_getAssets RPC → Asset response
3. **토큰 추가**: DApp → wallet_addToken RPC → TokenController → assetsChanged event
4. **자산 변경 알림**: Wallet → assetsChanged event → DApp

---

## Phase 1: Wallet Extension 자산 관리 기반

### 1.1 walletState에 assets 상태 추가

- [x] AssetState 타입 정의 (types/asset.ts)
- [x] WalletState interface에 assets 추가
- [x] store.ts 초기 상태 및 액션 메서드 추가
- [x] TokenController 연동

### 1.2 wallet_getAssets RPC 구현

- [x] RPC handler에 wallet_getAssets 추가
- [x] Native balance + Token balances 반환
- [x] Origin 연결 확인

### 1.3 wallet_addToken RPC 구현

- [x] RPC handler에 wallet_addToken 추가
- [x] 토큰 메타데이터 검증
- [x] TokenController.addToken 연동
- [x] assetsChanged 이벤트 트리거

### 1.4 assetsChanged 이벤트 브로드캐스트

- [x] EventBroadcaster에 assetsChanged 이벤트 타입 추가
- [x] broadcastAssetsChanged 메서드 구현
- [x] 토큰 추가/제거 시 이벤트 발생
- [x] inpage provider에 이벤트 리스너 추가

---

## Phase 2: Wallet Extension UI (Completed)

### 2.1 자산 목록 컴포넌트

- [x] TokenList 컴포넌트 개선 (TokenList.tsx)
- [x] Native balance 표시
- [x] Token balance 목록 표시 (indexer + custom tokens 병합)
- [x] 토큰 아이콘 및 메타데이터
- [x] useAssets hook 구현 (useAssets.ts)
- [x] Home.tsx 연동

### 2.2 토큰 추가 UI

- [x] AddTokenModal 컴포넌트 구현 (AddTokenModal.tsx)
- [x] 토큰 컨트랙트 주소 입력
- [x] 토큰 메타데이터 자동 조회 (eth_call)
- [x] 토큰 추가 확인 UI
- [x] Advanced options (symbol, name, decimals, logoURI)

### 2.3 토큰 숨기기/표시 기능

- [x] 토큰 visibility 상태 관리 (useAssets.toggleTokenVisibility)
- [x] 토큰 컨텍스트 메뉴 (TokenList.tsx)
- [x] Hide/Show 토글 기능
- [x] Hidden 토큰 표시 옵션

---

## Phase 3: Web App 연동 (Completed)

### 3.1 useWalletAssets hook 구현

- [x] wallet_getAssets RPC 호출 (hooks/useWalletAssets.ts)
- [x] assetsChanged 이벤트 리스닝
- [x] 자동 refresh 로직 (account/chain 변경 시)
- [x] StableNet Wallet 지원 여부 감지 (isSupported flag)

### 3.2 Fallback 구현

- [x] eth_getBalance 기반 fallback 구현
- [x] wallet_getAssets 미지원 지갑 대응
- [x] 기존 useBalance.ts 유지 (호환성)

### 3.3 자산 목록 UI 업데이트

- [x] Dashboard 페이지 자산 목록 업데이트 (app/page.tsx)
- [x] useWalletAssets hook 연동
- [x] TokenList 컴포넌트 추가
- [x] Send 페이지 토큰 선택 UI (app/payment/send/page.tsx)
- [x] addToken 함수 지원 (wallet_addToken)

---

## API Reference

### wallet_getAssets

Returns all assets (native + tokens) for the connected account.

**Request:**
```typescript
{
  method: 'wallet_getAssets',
  params: []
}
```

**Response:**
```typescript
{
  chainId: number
  account: Address
  native: {
    symbol: string
    name: string
    decimals: number
    balance: string        // wei
    formattedBalance: string
  }
  tokens: Array<{
    address: Address
    symbol: string
    name: string
    decimals: number
    balance: string
    formattedBalance: string
    logoURI?: string
  }>
  updatedAt: number
}
```

### wallet_addToken

Request to add a token to the wallet's tracked tokens.

**Request:**
```typescript
{
  method: 'wallet_addToken',
  params: [{
    address: Address      // required
    symbol?: string       // optional, fetched from contract if not provided
    name?: string         // optional
    decimals?: number     // optional
    logoURI?: string      // optional
  }]
}
```

**Response:**
```typescript
{
  success: boolean
  token?: {
    address: Address
    symbol: string
    name: string
    decimals: number
    chainId: number
    logoURI?: string
  }
  error?: string
}
```

### assetsChanged Event

Emitted when the wallet's assets change (token added/removed, significant balance change).

**Event Data:**
```typescript
{
  chainId: number
  account: Address
  reason: 'token_added' | 'token_removed' | 'balance_changed' | 'chain_switched'
  timestamp: number
}
```

---

## Implementation Notes

### Compatibility

- **StableNet Wallet**: Full support (wallet_getAssets, wallet_addToken, assetsChanged)
- **MetaMask/Others**: Fallback to wagmi useBalance for native balance only

### Security Considerations

- Origin validation for all RPC calls
- Token address validation (checksum)
- Rate limiting for balance queries

### Performance

- Cache token balances in walletState
- Debounce balance refresh
- Batch RPC calls where possible

---

## Progress Tracking

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Wallet Extension 기반 | ✅ Complete | 100% |
| Phase 2: Wallet Extension UI | ⏳ Pending | 0% |
| Phase 3: Web App 연동 | ⏳ Pending | 0% |

Last Updated: 2026-02-04
