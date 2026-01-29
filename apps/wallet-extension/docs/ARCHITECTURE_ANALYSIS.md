# Wallet Extension Architecture Analysis

> **분석 일자**: 2026-01-29
> **분석 대상**: `apps/wallet-extension/`
> **목적**: 지갑 확장 프로그램의 구조적 문제점 파악 및 개선 방향 수립

---

## 1. Executive Summary

### 1.1 현재 상태
`wallet-extension`은 기본적인 지갑 기능(계정 생성, 가져오기, 트랜잭션 서명)을 갖추고 있으나, **dApp과의 통신을 위한 이벤트 시스템이 불완전**하여 `apps/web`과의 연동에서 심각한 문제가 발생하고 있습니다.

### 1.2 핵심 문제
| 카테고리 | 문제 수 | 심각도 |
|----------|---------|--------|
| 이벤트 시스템 | 5개 | 🔴 Critical |
| 상태 관리 | 2개 | 🟡 Medium |
| SDK 구조 | 1개 | 🟡 Medium |
| 코드 품질 | 3개 | 🟢 Low |

### 1.3 영향
- 지갑에서 생성한 계정과 가져온 계정의 동작 차이
- 네트워크 변경 시 dApp에 반영 안됨
- 계정 변경 시 dApp에 반영 안됨
- 페이지 새로고침 후 연결 상태 유실

---

## 2. Architecture Overview

### 2.1 디렉토리 구조
```
src/
├── approval/                    # 승인 팝업 UI
│   ├── pages/
│   │   ├── ConnectApproval.tsx     # 연결 승인
│   │   ├── SignatureApproval.tsx   # 서명 승인
│   │   └── TransactionApproval.tsx # 트랜잭션 승인
│   ├── App.tsx
│   └── main.tsx
│
├── background/                  # Service Worker (핵심 로직)
│   ├── index.ts                    # 메시지 핸들러 & 이벤트 시스템
│   ├── controllers/
│   │   ├── approvalController.ts   # 승인 관리
│   │   ├── networkController.ts    # 네트워크 관리
│   │   ├── transactionController.ts# 트랜잭션 관리
│   │   ├── TokenController.ts      # 토큰 관리
│   │   ├── permissionController.ts # 권한 관리
│   │   └── controllerMessenger.ts  # 컨트롤러 간 통신
│   ├── keyring/
│   │   ├── hdKeyring.ts            # HD 지갑 (BIP-44)
│   │   ├── simpleKeyring.ts        # 단일 키 지갑
│   │   ├── vault.ts                # 암호화 저장소
│   │   └── index.ts                # KeyringController
│   ├── rpc/
│   │   └── handler.ts              # JSON-RPC 핸들러
│   └── state/
│       └── store.ts                # WalletStateManager
│
├── contentscript/               # 콘텐츠 스크립트
│   └── index.ts                    # 페이지 ↔ 백그라운드 브릿지
│
├── inpage/                      # 인페이지 프로바이더
│   └── index.ts                    # window.ethereum 구현
│
├── ui/                          # 팝업 UI
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── styles/
│
├── shared/                      # 공유 유틸리티
│   ├── constants.ts
│   ├── errors/
│   ├── security/
│   └── utils/
│
└── types/                       # TypeScript 타입 정의
```

### 2.2 통신 흐름
```
┌─────────────────────────────────────────────────────────────────────┐
│                          Page Context                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  window.ethereum (StableNetProvider)                         │   │
│  │  ├── request(method, params) → JSON-RPC 호출                │   │
│  │  ├── on('accountsChanged', callback)                         │   │
│  │  ├── on('chainChanged', callback)                            │   │
│  │  └── on('connect'/'disconnect', callback)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ window.postMessage()                  │
│                              ▼                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│  Content Script              │                                       │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │  Message Relay                                                │   │
│  │  ├── window.addEventListener('message', ...)                  │   │
│  │  └── chrome.runtime.sendMessage(...)                          │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               │ chrome.runtime.sendMessage()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Background Script (Service Worker)                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Message Handler                                             │   │
│  │  ├── RPC Handler (eth_*, wallet_*, personal_*)               │   │
│  │  ├── Internal Messages (CREATE_WALLET, LOCK, etc.)           │   │
│  │  └── State Broadcaster                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Keyring      │  │ Network      │  │ Approval     │              │
│  │ Controller   │  │ Controller   │  │ Controller   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  WalletStateManager (Central State)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Identified Issues

### 3.1 이벤트 시스템 문제 (Critical)

#### Issue #1: `connect` 이벤트 미발생
- **위치**: `src/background/rpc/handler.ts` (eth_requestAccounts)
- **문제**: 사용자가 연결을 승인해도 `connect` 이벤트가 발생하지 않음
- **영향**: dApp이 초기 연결을 감지하지 못해 UI가 업데이트되지 않음
- **현재 코드**:
```typescript
case 'eth_requestAccounts': {
  const approval = await approvalController.requestConnect(origin, ...)
  if (approval.approved) {
    walletState.addConnectedSite(origin, approval.accounts)
    return approval.accounts  // ❌ connect 이벤트 없이 반환만 함
  }
}
```

#### Issue #2: `disconnect` 이벤트 미발생
- **위치**: `src/background/index.ts` (DISCONNECT 메시지)
- **문제**: 사이트 연결 해제 시 `disconnect` 이벤트가 발생하지 않음
- **영향**: dApp이 연결 해제를 인지하지 못하고 연결된 상태로 표시됨
- **현재 코드**:
```typescript
case 'DISCONNECT': {
  walletState.removeConnectedSite(payload.origin)
  return { type: 'DISCONNECTED' }  // ❌ disconnect 이벤트 브로드캐스트 없음
}
```

#### Issue #3: 잘못된 `accountsChanged` 브로드캐스트
- **위치**: `src/background/index.ts` (Line 831-833)
- **문제**: 모든 연결된 사이트의 계정을 합쳐서 전송 (Origin 필터링 없음)
- **영향**: **개인정보 누출** - A 사이트에서 B 사이트의 연결된 계정이 노출됨
- **현재 코드**:
```typescript
const payload = {
  chainId: networkController.getChainIdHex(),
  accounts: state.connections.connectedSites.flatMap((s) => s.accounts),
  // ❌ 모든 사이트의 계정을 합쳐서 전송
}
```

#### Issue #4: 계정 선택 변경 시 이벤트 미발생
- **위치**: `src/background/index.ts` (selectAccount)
- **문제**: 계정 선택 변경 시 `accountsChanged` 이벤트가 발생하지 않음
- **영향**: dApp이 사용자의 계정 변경을 인지하지 못함
- **현재 코드**:
```typescript
case 'selectAccount': {
  walletState.selectAccount(payload.address)
  return { type: 'STATE_UPDATE' }  // ❌ accountsChanged 이벤트 없음
}
```

#### Issue #5: 초기 연결 상태 확인 없음
- **위치**: `src/inpage/index.ts` (초기화)
- **문제**: 페이지 로드 시 기존 연결 상태를 확인하지 않음
- **영향**: 페이지 새로고침 후 연결이 유지되어도 dApp은 인지하지 못함

### 3.2 상태 관리 문제 (Medium)

#### Issue #6: 상태 업데이트 불완전
- **위치**: `src/background/state/store.ts`
- **문제**: `setState()`가 shallow merge만 수행하여 중첩 객체가 손실될 수 있음
- **현재 코드**:
```typescript
setState(newState: Partial<WalletState>) {
  this.state = { ...this.state, ...newState }  // shallow merge only
}
```

#### Issue #7: 연결된 사이트 상태 Origin 미검증
- **위치**: `src/background/state/store.ts`
- **문제**: `getConnectedAccounts(origin)` 호출 시 대소문자 정규화 불일치

### 3.3 SDK 구조 부재 (Medium)

#### Issue #8: SDK 레이어 없음
- **현재 상태**: `apps/web`이 `window.ethereum`을 직접 호출
- **문제점**:
  - 각 컴포넌트가 개별적으로 RPC 호출
  - 이벤트 리스닝 로직 중복
  - 상태 동기화 메커니즘 없음
  - 에러 핸들링 일관성 없음

### 3.4 코드 품질 문제 (Low)

#### Issue #9: 계정 이름 규칙 불일치
- HD 계정: `'Account 1'`, `'Account 2'`, ...
- 가져온 계정: `'Imported Account'`
- 추가 HD 계정: `'Account ${index + 1}'`

#### Issue #10: 일부 네트워크 설정 불완전
- localhost 네트워크의 bundler URL 등 일부 설정값 비어있음

#### Issue #11: 콘텐츠 스크립트 보안
- `window.localStorage` 직접 접근으로 페이지 컨텍스트 노출 가능성

---

## 4. Account Type Comparison

### 4.1 HD 계정 (생성)
```
생성 경로: CREATE_NEW_WALLET → KeyringController.createNewVault()
          → HDKeyring.initializeNewMnemonic(12)
          → HDKeyring.addAccount()

저장 구조:
{
  keyringType: 'hd',
  address: '0x...',
  name: 'Account 1',
  index: 0,
  path: "m/44'/60'/0'/0/0"  // BIP-44
}

특징:
- 시드 구문으로 복구 가능
- 추가 계정 파생 가능 (index 증가)
- 모든 계정이 동일 시드에서 파생
```

### 4.2 Simple 계정 (가져오기)
```
생성 경로: IMPORT_PRIVATE_KEY → KeyringController.importPrivateKey()
          → SimpleKeyring.importAccount()

저장 구조:
{
  keyringType: 'simple',
  address: '0x...',
  name: 'Imported Account',
  index: null,
  path: null
}

특징:
- 개인키로만 복구 가능
- 추가 파생 불가
- 각 계정이 독립적
```

### 4.3 동작 차이 원인
두 계정 타입 모두 **동일한 연결 승인 플로우**를 거쳐야 하지만, 이벤트 시스템 결함으로 인해:
- 승인 후 `connect` 이벤트 미발생 → dApp UI 미업데이트
- 계정 선택 변경 시 이벤트 미발생 → 선택된 계정 불일치

---

## 5. Recommended Architecture

### 5.1 이벤트 시스템 개선
```typescript
// 권장: 이벤트 브로드캐스트 유틸리티
class EventBroadcaster {
  async broadcastToOrigin(origin: string, event: string, data: unknown) {
    const tabs = await chrome.tabs.query({ url: `${origin}/*` })
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id!, {
        type: 'PROVIDER_EVENT',
        event,
        data,
        origin
      })
    }
  }

  async broadcastConnect(origin: string, accounts: string[]) {
    await this.broadcastToOrigin(origin, 'connect', { chainId: getChainIdHex() })
    await this.broadcastToOrigin(origin, 'accountsChanged', accounts)
  }

  async broadcastDisconnect(origin: string) {
    await this.broadcastToOrigin(origin, 'disconnect', { code: 4900, message: 'Disconnected' })
  }

  async broadcastAccountsChanged(origin: string, accounts: string[]) {
    await this.broadcastToOrigin(origin, 'accountsChanged', accounts)
  }

  async broadcastChainChanged(chainId: string) {
    // 모든 연결된 사이트에 브로드캐스트
    const connectedSites = walletState.getConnectedSites()
    for (const site of connectedSites) {
      await this.broadcastToOrigin(site.origin, 'chainChanged', chainId)
    }
  }
}
```

### 5.2 SDK 레이어 구조
```
packages/
└── wallet-sdk/
    ├── src/
    │   ├── provider/
    │   │   ├── StableNetProvider.ts    # EIP-1193 프로바이더
    │   │   └── events.ts               # 이벤트 타입 정의
    │   ├── client/
    │   │   ├── WalletClient.ts         # 고수준 API
    │   │   ├── AccountManager.ts       # 계정 관리
    │   │   ├── NetworkManager.ts       # 네트워크 관리
    │   │   └── TransactionManager.ts   # 트랜잭션 관리
    │   ├── hooks/                      # React 훅 (선택적)
    │   │   ├── useWallet.ts
    │   │   ├── useAccount.ts
    │   │   ├── useNetwork.ts
    │   │   └── useBalance.ts
    │   └── index.ts
    └── package.json

사용 예시 (apps/web):
import { WalletClient, useWallet } from '@stablenet/wallet-sdk'

// React 훅 사용
function App() {
  const { isConnected, account, chainId, connect, disconnect } = useWallet()

  // 자동으로 이벤트 구독 및 상태 동기화
  // accountsChanged → account 업데이트
  // chainChanged → chainId 업데이트
  // disconnect → isConnected = false
}
```

---

## 6. Next Steps

이 분석 결과를 바탕으로 `TASK_LIST.md`에 구체적인 작업 항목을 정의합니다.
