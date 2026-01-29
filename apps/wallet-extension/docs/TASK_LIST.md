# Wallet Extension Refactoring Task List

> **작성일**: 2026-01-29
> **기반 문서**: `ARCHITECTURE_ANALYSIS.md`
> **목표**: 지갑 확장 프로그램의 이벤트 시스템 수정 및 SDK 구조 구현
> **최종 업데이트**: 2026-01-29

---

## Phase 1: 이벤트 시스템 긴급 수정 (Critical) ✅ COMPLETED

> **목표**: dApp과의 통신 정상화
> **예상 소요**: 2-3일
> **실제 완료**: 2026-01-29

### Task 1.1: EventBroadcaster 유틸리티 생성 ✅
- [x] `src/background/utils/eventBroadcaster.ts` 생성
- [x] Origin별 탭 필터링 로직 구현
- [x] 이벤트 타입별 브로드캐스트 메서드 구현
  - [x] `broadcastConnect(origin, chainId)`
  - [x] `broadcastDisconnect(origin)`
  - [x] `broadcastAccountsChanged(origin, accounts)`
  - [x] `broadcastChainChanged(chainId, connectedOrigins)` - 모든 연결 사이트에
- [x] 보안 기능 추가: Origin 검증, 데이터 정제, 주소 형식 검증

```typescript
// 예상 구조
export class EventBroadcaster {
  private async getTabsForOrigin(origin: string): Promise<chrome.tabs.Tab[]>
  private async sendToTab(tabId: number, event: ProviderEvent): Promise<void>

  async broadcastConnect(origin: string, accounts: string[]): Promise<void>
  async broadcastDisconnect(origin: string): Promise<void>
  async broadcastAccountsChanged(origin: string, accounts: string[]): Promise<void>
  async broadcastChainChanged(chainId: string): Promise<void>
}
```

### Task 1.2: `connect` 이벤트 발생 추가 ✅
- [x] `src/background/rpc/handler.ts` 수정
- [x] `eth_requestAccounts` 성공 시 `connect` 이벤트 발생
- [x] 연결된 계정 목록과 함께 `accountsChanged` 이벤트 발생

```typescript
// 수정 위치: eth_requestAccounts 핸들러
case 'eth_requestAccounts': {
  const approval = await approvalController.requestConnect(origin, ...)
  if (approval.approved) {
    walletState.addConnectedSite(origin, approval.accounts)

    // ✅ 추가: 이벤트 브로드캐스트
    await eventBroadcaster.broadcastConnect(origin, approval.accounts)

    return approval.accounts
  }
}
```

### Task 1.3: `disconnect` 이벤트 발생 추가 ✅
- [x] `src/background/index.ts` 수정
- [x] `MESSAGE_TYPES.DISCONNECT` 메시지 처리 시 `disconnect` 이벤트 발생
- [x] `DISCONNECT_SITE` 메시지 처리 시 `disconnect` 이벤트 발생

```typescript
// 수정 위치: DISCONNECT 메시지 핸들러
case 'DISCONNECT': {
  const origin = payload.origin
  walletState.removeConnectedSite(origin)

  // ✅ 추가: 이벤트 브로드캐스트
  await eventBroadcaster.broadcastDisconnect(origin)

  return { type: 'DISCONNECTED' }
}
```

### Task 1.4: Origin별 계정 필터링 수정 ✅ (SEC-1 해결)
- [x] `src/background/index.ts` 의 `broadcastStateUpdate` 수정
- [x] 모든 계정 대신 Origin별 연결된 계정만 전송
- [x] 각 탭에 해당 Origin의 계정만 전달
- [x] 선택된 계정이 첫 번째로 오도록 정렬

```typescript
// 현재 (문제):
accounts: state.connections.connectedSites.flatMap((s) => s.accounts)

// 수정 후:
// 탭별로 origin을 확인하고 해당 origin의 계정만 전송
for (const site of state.connections.connectedSites) {
  await eventBroadcaster.broadcastAccountsChanged(site.origin, site.accounts)
}
```

### Task 1.5: 계정 선택 변경 시 이벤트 발생 ✅
- [x] `src/background/index.ts` 의 `selectAccount` 핸들러 수정
- [x] 계정 선택 시 모든 연결된 사이트에 `accountsChanged` 발생
- [x] 선택된 계정이 연결된 경우 첫 번째로 정렬

```typescript
case 'selectAccount': {
  walletState.selectAccount(payload.address)

  // ✅ 추가: 모든 연결된 사이트에 accountsChanged 브로드캐스트
  const connectedSites = walletState.getConnectedSites()
  for (const site of connectedSites) {
    const accountsForSite = getAccountsForOrigin(site.origin, payload.address)
    await eventBroadcaster.broadcastAccountsChanged(site.origin, accountsForSite)
  }

  return { type: 'STATE_UPDATE' }
}
```

### Task 1.6: 네트워크 변경 시 이벤트 정리 ✅
- [x] `src/background/index.ts` 의 네트워크 변경 로직 검토
- [x] `broadcastChainChanged` 함수를 eventBroadcaster 사용으로 수정
- [x] 모든 연결된 사이트에 `chainChanged` 이벤트 발생

### Task 1.7: Origin 검증 보안 수정 ✅ (SEC-3 해결)
- [x] `src/background/index.ts` 의 `handleMessage` 함수 수정
- [x] `message.origin` 신뢰 제거 (스푸핑 방지)
- [x] `sender.tab.url` 또는 `sender.origin` 에서만 origin 추출
- [x] 유효하지 않은 origin 형식 검증 및 로깅

---

## Phase 2: Inpage Provider 개선 (High) ✅ COMPLETED

> **목표**: 페이지 로드 시 연결 상태 복원
> **예상 소요**: 1-2일
> **실제 완료**: 2026-01-29

### Task 2.1: 초기 연결 상태 확인 ✅
- [x] `src/inpage/index.ts` 수정
- [x] 프로바이더 초기화 시 기존 연결 확인 로직 추가
- [x] 연결되어 있으면 `connect` + `accountsChanged` 이벤트 발생
- [x] `_isConnected` 상태 추적 추가

### Task 2.2: 이벤트 수신 개선 ✅
- [x] `PROVIDER_EVENT` 메시지 타입 처리 추가
- [x] `handleProviderEvent()` 메서드로 이벤트 타입별 핸들링
- [x] 중복 이벤트 방지 (상태 변경 시에만 emit)

### Task 2.3: Provider 상태 동기화 ✅
- [x] `chainId`, `selectedAddress`, `_isConnected` 상태 일관성 유지
- [x] `connect` 이벤트: chainId 업데이트, isConnected = true
- [x] `disconnect` 이벤트: selectedAddress = null, isConnected = false
- [x] `accountsChanged` 이벤트: selectedAddress 업데이트
- [x] `chainChanged` 이벤트: chainId 업데이트

---

## Phase 3: 상태 관리 개선 (Medium) ✅ COMPLETED

> **목표**: 상태 관리 안정성 향상
> **예상 소요**: 1일
> **실제 완료**: 2026-01-29

### Task 3.1: WalletStateManager 개선 ✅
- [x] `src/background/state/store.ts` 수정
- [x] `src/background/state/utils.ts` 생성 (deepMerge, normalizeOrigin)
- [x] Deep merge 구현으로 중첩 객체 손실 방지
- [x] 상태 업데이트 시 불변성 보장

```typescript
// 구현된 Deep merge
import { deepMerge } from './utils'

setState(newState: Partial<WalletState>) {
  this.state = deepMerge(this.state, newState)
  this.notifyListeners()
}

// 옵션 2: Immer 사용
import { produce } from 'immer'

setState(updater: (draft: WalletState) => void) {
  this.state = produce(this.state, updater)
  this.notifyListeners()
}
```

### Task 3.2: Origin 정규화 ✅
- [x] Origin 비교 시 일관된 정규화 적용
- [x] `normalizeOrigin()`: 대소문자 변환, trailing slash 제거
- [x] `originsMatch()`: 정규화된 비교 유틸리티
- [x] `addConnectedSite`, `removeConnectedSite`, `isConnected` 업데이트

### Task 3.3: 연결된 계정 조회 개선 ✅
- [x] `getConnectedAccounts(origin)` 메서드 수정
- [x] 선택된 계정이 첫 번째로 오도록 정렬
- [x] 정규화된 origin 비교 적용

---

## Phase 4: SDK 레이어 구현 (Medium)

> **목표**: apps/web에서 사용할 SDK 제공
> **예상 소요**: 3-5일

### Task 4.1: SDK 패키지 생성
- [ ] `packages/wallet-sdk/` 디렉토리 생성
- [ ] `package.json` 설정
- [ ] TypeScript 설정
- [ ] 빌드 설정 (tsup 또는 rollup)

```json
{
  "name": "@stablenet/wallet-sdk",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./react": {
      "import": "./dist/react.mjs",
      "require": "./dist/react.js",
      "types": "./dist/react.d.ts"
    }
  }
}
```

### Task 4.2: Provider Wrapper 구현
- [ ] `src/provider/StableNetProvider.ts` 생성
- [ ] EIP-1193 인터페이스 래핑
- [ ] 타입 안전한 메서드 제공

```typescript
export class StableNetProvider {
  private provider: EIP1193Provider

  async connect(): Promise<string[]>
  async disconnect(): Promise<void>
  async getAccounts(): Promise<string[]>
  async getChainId(): Promise<string>
  async switchChain(chainId: number): Promise<void>
  async signMessage(message: string): Promise<string>
  async sendTransaction(tx: TransactionRequest): Promise<string>

  on(event: 'accountsChanged', handler: (accounts: string[]) => void): void
  on(event: 'chainChanged', handler: (chainId: string) => void): void
  on(event: 'connect', handler: (info: ConnectInfo) => void): void
  on(event: 'disconnect', handler: (error: ProviderRpcError) => void): void
}
```

### Task 4.3: WalletClient 구현
- [ ] `src/client/WalletClient.ts` 생성
- [ ] 고수준 API 제공
- [ ] 상태 관리 포함

```typescript
export class WalletClient {
  private provider: StableNetProvider
  private state: WalletState

  // 상태 접근자
  get isConnected(): boolean
  get account(): string | null
  get chainId(): number | null
  get balance(): bigint | null

  // 액션
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  async switchNetwork(chainId: number): Promise<void>
  async getBalance(address?: string): Promise<bigint>
  async signMessage(message: string): Promise<string>
  async sendTransaction(tx: TransactionRequest): Promise<string>

  // 이벤트 구독
  subscribe(listener: (state: WalletState) => void): () => void
}
```

### Task 4.4: React Hooks 구현
- [ ] `src/hooks/useWallet.ts` 생성
- [ ] `src/hooks/useAccount.ts` 생성
- [ ] `src/hooks/useNetwork.ts` 생성
- [ ] `src/hooks/useBalance.ts` 생성

```typescript
// useWallet.ts
export function useWallet() {
  const [state, setState] = useState<WalletState>(initialState)

  useEffect(() => {
    const client = getWalletClient()
    return client.subscribe(setState)
  }, [])

  return {
    isConnected: state.isConnected,
    account: state.account,
    chainId: state.chainId,
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    switchNetwork: (chainId: number) => client.switchNetwork(chainId),
  }
}
```

### Task 4.5: WalletProvider Context 구현
- [ ] `src/react/WalletProvider.tsx` 생성
- [ ] Context를 통한 전역 상태 공유
- [ ] 자동 초기화 및 정리

```typescript
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new WalletClient())

  useEffect(() => {
    client.initialize()
    return () => client.destroy()
  }, [client])

  return (
    <WalletContext.Provider value={client}>
      {children}
    </WalletContext.Provider>
  )
}
```

---

## Phase 5: apps/web 통합 (Medium)

> **목표**: SDK를 사용하여 apps/web 리팩토링
> **예상 소요**: 2-3일

### Task 5.1: SDK 의존성 추가
- [ ] `apps/web/package.json`에 `@stablenet/wallet-sdk` 추가
- [ ] pnpm workspace 설정

### Task 5.2: WalletProvider 설정
- [ ] `apps/web/providers/WalletProvider.tsx` 생성
- [ ] 기존 wagmi 프로바이더와 통합

### Task 5.3: 기존 훅 마이그레이션
- [ ] `useWallet.ts` → SDK 훅 사용으로 전환
- [ ] `useBalance.ts` → SDK 훅 사용으로 전환
- [ ] `useSessionKey.ts` 검토 및 필요시 수정
- [ ] `useSubscription.ts` 검토 및 필요시 수정

### Task 5.4: 컴포넌트 업데이트
- [ ] `WalletSelectorModal.tsx` 수정
- [ ] `Header.tsx` 계정/네트워크 표시 수정
- [ ] 연결 상태에 따른 UI 반응성 확인

---

## Phase 6: 테스트 및 검증 (High)

> **목표**: 모든 시나리오 동작 확인
> **예상 소요**: 1-2일

### Task 6.1: 이벤트 시스템 테스트
- [ ] 연결 승인 후 `connect` 이벤트 확인
- [ ] 연결 해제 후 `disconnect` 이벤트 확인
- [ ] 계정 변경 후 `accountsChanged` 이벤트 확인
- [ ] 네트워크 변경 후 `chainChanged` 이벤트 확인

### Task 6.2: 계정 타입별 테스트
- [ ] HD 계정 생성 → 연결 → 트랜잭션 서명
- [ ] 가져온 계정 → 연결 → 트랜잭션 서명
- [ ] 계정 전환 시 dApp 반영 확인

### Task 6.3: 페이지 새로고침 테스트
- [ ] 연결 후 새로고침 → 연결 상태 유지 확인
- [ ] 계정 변경 후 새로고침 → 선택된 계정 유지 확인
- [ ] 네트워크 변경 후 새로고침 → 선택된 네트워크 유지 확인

### Task 6.4: 다중 탭 테스트
- [ ] 탭 A에서 연결 → 탭 B에서 연결 상태 확인
- [ ] 탭 A에서 계정 변경 → 탭 B에서 반영 확인
- [ ] 탭 A에서 연결 해제 → 탭 B에서 반영 확인

---

## Phase 7: 코드 품질 개선 (Low)

> **목표**: 유지보수성 향상
> **예상 소요**: 1일

### Task 7.1: 계정 이름 규칙 통일
- [ ] 계정 이름 생성 유틸리티 함수 생성
- [ ] HD 계정: `Account ${index + 1}`
- [ ] 가져온 계정: `Imported ${index + 1}`

### Task 7.2: 상수 정리
- [ ] 하드코딩된 값 상수로 추출
- [ ] 네트워크 설정 완성도 확인
- [ ] 타임아웃 값 등 설정 통일

### Task 7.3: 에러 핸들링 개선
- [ ] RPC 에러 코드 표준화
- [ ] 사용자 친화적 에러 메시지
- [ ] 에러 로깅 일관성

### Task 7.4: 타입 안전성 강화
- [ ] `any` 타입 제거
- [ ] 엄격한 null 체크
- [ ] 이벤트 타입 정의

---

## Summary

| Phase | 작업 수 | 우선순위 | 예상 소요 |
|-------|---------|----------|-----------|
| Phase 1: 이벤트 시스템 | 6 | 🔴 Critical | 2-3일 |
| Phase 2: Inpage Provider | 3 | 🔴 High | 1-2일 |
| Phase 3: 상태 관리 | 3 | 🟡 Medium | 1일 |
| Phase 4: SDK 구현 | 5 | 🟡 Medium | 3-5일 |
| Phase 5: apps/web 통합 | 4 | 🟡 Medium | 2-3일 |
| Phase 6: 테스트 | 4 | 🔴 High | 1-2일 |
| Phase 7: 코드 품질 | 4 | 🟢 Low | 1일 |
| **Total** | **29** | - | **11-17일** |

---

## Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 6
    │
    └──→ Phase 3

Phase 4 ──→ Phase 5 ──→ Phase 6

Phase 7 (독립적, 언제든 진행 가능)
```

---

## Quick Win (즉시 적용 가능)

가장 빠르게 문제를 해결할 수 있는 최소 작업:

1. **Task 1.2**: `connect` 이벤트 추가 (30분)
2. **Task 1.5**: 계정 선택 시 `accountsChanged` 추가 (30분)
3. **Task 1.4**: Origin별 계정 필터링 (1시간)

이 3개 작업만으로도 현재 가장 큰 문제인 "계정 연결 후 dApp 미반영" 문제를 해결할 수 있습니다.

---

## Security Review (2026-01-29)

> **검토자**: security-reviewer agent
> **위험 수준**: CRITICAL - 지갑 확장 프로그램은 암호화폐 키와 사용자 자금을 다루므로 즉각적인 조치 필요

### Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 5 |
| 🟢 LOW | 4 |

---

### CRITICAL Issues (즉시 수정 필요)

#### SEC-1: 개인정보 누출 - 모든 연결 사이트가 모든 계정 정보 수신
- **위치**: `src/background/index.ts:831-833`
- **문제**: `broadcastStateUpdate()`가 모든 사이트의 계정을 모든 탭에 전송
- **영향**:
  - 개인정보 침해: 다른 dApp에 연결된 계정 정보 노출
  - 계정 연관 공격: 악의적 사이트가 사용자 활동 추적 가능
- **해결**: Task 1.4에서 Origin별 필터링 구현 시 적용

```typescript
// 수정 전 (보안 취약)
accounts: state.connections.connectedSites.flatMap((s) => s.accounts)

// 수정 후 (보안 적용)
for (const site of connectedSites) {
  await broadcastToOrigin(site.origin, 'accountsChanged', site.accounts)
}
```

#### SEC-2: Content Script localStorage 직접 접근 - 크로스 컨텍스트 데이터 노출
- **위치**: `src/contentscript/index.ts:41`
- **문제**: `window.localStorage`에 직접 쓰기로 페이지 스크립트에 설정 노출
- **영향**: 악의적 페이지 스크립트가 지갑 설정 읽기/수정 가능
- **해결**: `chrome.storage.local` 사용 후 스크립트 주입 시 설정 전달

#### SEC-3: 메시지 핸들러 Origin 검증 부족
- **위치**: `src/background/index.ts:355`
- **문제**: Origin을 메시지 페이로드에서 가져오는 폴백 체인 존재
- **영향**: Origin 스푸핑을 통한 권한 우회 가능
- **해결**: `sender.tab.url`에서만 Origin 추출, 폴백 제거

```typescript
// 수정 전 (취약)
const origin = message.origin ?? sender.origin ?? originFromUrl(sender.tab?.url) ?? 'unknown'

// 수정 후 (보안)
const origin = sender.tab?.url ? originFromUrl(sender.tab.url) : sender.origin
if (!origin || origin === 'unknown') {
  throw new Error('Cannot determine message origin')
}
```

---

### HIGH Issues (배포 전 수정 필요)

#### SEC-4: 민감 작업 Rate Limiting 부재
- **위치**: `src/background/index.ts:325-346`
- **문제**: 메시지 처리에 Rate Limiting 없음
- **영향**: 브루트포스 공격, 승인 팝업 스팸, DoS
- **해결**: 메시지 핸들러에 Rate Limiter 추가

#### SEC-5: Typed Data 서명 시 Domain 검증 없음
- **위치**: `src/background/rpc/handler.ts:264-333`
- **문제**: `eth_signTypedData_v4`에서 요청 Origin과 Domain 불일치 허용
- **영향**: 피싱 서명 공격 (Permit 토큰 탈취)
- **해결**: Permit 타입 서명 시 Domain 경고 표시

#### SEC-6: Session Storage 비암호화 개인키 저장
- **위치**: `src/background/keyring/vault.ts:297-316`
- **문제**: `chrome.storage.session`에 개인키 포함 데이터 평문 저장
- **해결**: 세션 데이터 추가 암호화 또는 메모리 전용 저장 검토

#### SEC-7: RPC 핸들러 입력 검증 부재
- **위치**: `src/background/rpc/handler.ts:854-886`
- **문제**: `inputValidator` 모듈이 있으나 RPC 요청에 적용 안됨
- **해결**: 모든 RPC 요청에 대해 입력 검증 적용

#### SEC-8: Mnemonic 접근 시 재인증 없음
- **위치**: `src/background/index.ts:588-595`
- **문제**: `GET_MNEMONIC` 메시지가 추가 검증 없이 니모닉 반환
- **해결**: 비밀번호 재입력 필수, 팝업 컨텍스트에서만 허용

#### SEC-9: connect/disconnect 이벤트 미발생
- **위치**: `src/background/rpc/handler.ts:78-102`
- **영향**: dApp이 연결 상태를 정확히 추적 불가
- **해결**: Phase 1 Task 1.2, 1.3에서 해결

---

### MEDIUM Issues

#### SEC-10: 상태 Shallow Merge로 인한 데이터 손실 가능
- **위치**: `src/background/state/store.ts:96-100`
- **해결**: Task 3.1에서 Deep merge 구현

#### SEC-11: Origin 비교 시 정규화 없음
- **위치**: `src/background/state/store.ts:271-273`
- **해결**: Task 3.2에서 Origin 정규화 적용

#### SEC-12: 승인 팝업 URL 인코딩 누락
- **위치**: `src/background/controllers/approvalController.ts:390`
- **해결**: `encodeURIComponent()` 적용

#### SEC-13: RPC URL HTTPS 강제 없음
- **위치**: `src/config/constants.ts:69-84`
- **영향**: 중간자 공격 가능
- **해결**: 프로덕션 URL HTTPS 검증 추가

#### SEC-14: 트랜잭션 위험 평가 불충분
- **위치**: `src/background/controllers/approvalController.ts:527-545`
- **누락 검사**: 스캠 컨트랙트, 무제한 토큰 승인, 첫 상호작용 경고
- **해결**: 종합적 트랜잭션 분석 구현

---

### LOW Issues

- **SEC-15**: 에러 메시지 내부 정보 노출
- **SEC-16**: 민감 작업 감사 로깅 없음
- **SEC-17**: Content Security Policy 미설정
- **SEC-18**: 레거시 API 지원 시 경고 없음

---

### EventBroadcaster 보안 설계 권장사항

```typescript
export class EventBroadcaster {
  async broadcastToOrigin(origin: string, event: string, data: unknown): Promise<void> {
    // 1. Origin 형식 검증
    if (!this.isValidOrigin(origin)) {
      throw new Error('Invalid origin')
    }

    // 2. 해당 Origin 탭만 조회
    const tabs = await chrome.tabs.query({ url: `${origin}/*` })

    for (const tab of tabs) {
      if (!tab.id || !tab.url?.startsWith(origin)) continue

      // 3. 이벤트 데이터 정제
      await chrome.tabs.sendMessage(tab.id, {
        type: 'PROVIDER_EVENT',
        event,
        data: this.sanitizeEventData(event, data),
        origin,
      }).catch(() => {})
    }
  }

  private sanitizeEventData(event: string, data: unknown): unknown {
    switch (event) {
      case 'accountsChanged':
        if (!Array.isArray(data)) return []
        return data.filter(a => typeof a === 'string' && isAddress(a))
      case 'chainChanged':
        if (typeof data !== 'string') return null
        return data
      default:
        return data
    }
  }

  private isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }
}
```

---

### SDK 보안 체크리스트

- [ ] React DevTools에 민감 데이터 노출 방지
- [ ] 이벤트 데이터 검증 및 정제
- [ ] 승인 플로우 우회 방지
- [ ] API 호출 Rate Limiting
- [ ] 요청 중복 제거

---

### 배포 전 보안 체크리스트

- [ ] 하드코딩된 시크릿 없음
- [ ] 입력 검증 적용
- [ ] Origin별 계정 필터링
- [ ] Rate Limiting 구현
- [ ] HTTPS 강제
- [ ] Origin 격리 이벤트 브로드캐스팅
- [ ] 니모닉 접근 시 재인증
- [ ] 세션 스토리지 암호화 검토
- [ ] CSP 헤더 설정
- [ ] 감사 로깅 구현
- [ ] 종합적 트랜잭션 분석
- [ ] Typed Data Domain 검증

---

### 권장 조치 순서

**Phase 0 (즉시)**: CRITICAL 이슈 3개 수정
1. SEC-1: Origin별 계정 필터링 (Task 1.4와 함께)
2. SEC-2: localStorage 접근 제거
3. SEC-3: Origin 검증 강화

**Phase 1-2**: HIGH 이슈 수정
- Rate Limiting 구현
- Typed Data Domain 검증
- 니모닉 접근 재인증
- 입력 검증 적용

**Phase 3-4**: MEDIUM 이슈 수정
- 트랜잭션 분석 개선
- 감사 로깅 추가
- CSP 헤더 설정

**Phase 5-7**: 외부 보안 감사 권장
- 제3자 보안 감사
- 버그 바운티 프로그램
- 침투 테스트
