# Hook Migration Issues: poc-platform → stable-platform

## 개요

stable-platform에서 web app의 hook들이 대폭 변경되었다.
핵심 변경: **provider 접근 방식**이 `detectProvider()` 직접 호출에서 `connector.getProvider()` wagmi 경유로 전환.
이 변경이 5개 hook에 파급되어 잠재적 이슈를 발생시킨다.

### 근본 원인

```
poc-platform:    detectProvider({ timeout: 2000 }) → StableNetProvider 직접 획득
stable-platform: connector.getProvider()           → wagmi connector 경유 (간접)
```

wagmi.ts에 `stableNetWallet()` 커넥터가 신규 추가되었고, 이 커넥터의 `getProvider()` 반환값이
전체 hook 체인의 전제 조건이다.

---

## 변경 파일 목록

| # | 파일 | 위험도 | 변경 유형 |
|---|------|--------|----------|
| 1 | `lib/wagmi.ts` | 높음 | `stableNetWallet()` 커넥터 추가 |
| 2 | `hooks/useUserOp.ts` | 높음 | provider 획득 방식 변경 |
| 3 | `hooks/useWallet.ts` | 높음 | event listener 방식 변경 |
| 4 | `hooks/useBatchTransaction.ts` | 높음 | provider 획득 방식 변경 |
| 5 | `hooks/useWalletAssets.ts` | 중간 | 토큰 잔고 조회 방식 대폭 변경 |
| 6 | `hooks/useBalance.ts` | 중간 | raw RPC → publicClient 마이그레이션 |
| 7 | `hooks/useTokens.ts` | 중간 | indexer → on-chain 조회 변경 |
| 8 | `providers/StableNetProvider.tsx` | 낮음 | 체인별 publicClient 분기 추가 |
| 9 | `services/paymaster-proxy/src/chain/contracts.ts` | 해결됨 | getSupportedTokens ABI 수정 |

---

## 이슈 상세

### Issue 1: wagmi.ts — stableNetWallet() 커넥터 추가

**파일**: `lib/wagmi.ts`
**위험도**: 높음 (다른 모든 hook의 전제 조건)

**변경 내용**:
```typescript
// poc-platform
connectors: [injected()]  // EIP-6963 multi-wallet discovery

// stable-platform
connectors: [
  stableNetWallet(),  // 신규 추가
  injected(),
]
```

**잠재 이슈**:
- `stableNetWallet()` 커넥터가 `getProvider()`에서 올바른 StableNetProvider를 반환하지 않으면 모든 hook 실패
- `injected()` 대비 우선순위가 높아서, 지갑 미설치 시 연결 실패 가능

**검증 항목**:
- [ ] `stableNetWallet().getProvider()`가 StableNetProvider 인스턴스를 반환하는지
- [ ] 지갑 미설치 환경에서 `injected()`로 올바르게 fallback 되는지
- [ ] `connector.id`가 `'stableNetWallet'`으로 올바르게 설정되는지

---

### Issue 2: useUserOp.ts — Provider 탐지 방식 변경

**파일**: `hooks/useUserOp.ts`
**위험도**: 높음 (UserOp 전송 불가 → 모든 트랜잭션 실패)

**변경 내용**:
```typescript
// poc-platform
import { detectProvider } from '@stablenet/wallet-sdk'
useEffect(() => {
  detectProvider({ timeout: 2000 })
    .then((p) => { if (p) setProvider(p) })
    .catch(() => { /* Provider not available */ })
}, [])

// stable-platform
import { useAccount } from 'wagmi'
const { connector } = useAccount()
useEffect(() => {
  if (!connector) { setProvider(null); return }
  connector.getProvider()
    .then((p) => { if (p) setProvider(p as unknown as StableNetProvider) })
    .catch(() => { setProvider(null) })
}, [connector])
```

**잠재 이슈**:
- `connector`가 undefined인 시점에 `setProvider(null)` → 이후 `sendUserOp` 호출 시 null 에러
- `connector.getProvider()`가 generic EIP-1193 provider를 반환할 수 있음 → `as unknown as StableNetProvider` 캐스팅이 런타임에서 메서드 누락 발생 가능
- `connector` 변경 시 effect 재실행되지만, 이전 provider가 정리(cleanup)되지 않음

**검증 항목**:
- [ ] 지갑 연결 후 `connector.getProvider()`가 `sendUserOp` 메서드를 가진 provider를 반환하는지
- [ ] 지갑 연결 전 상태에서 UserOp 관련 UI가 올바르게 disabled 되는지
- [ ] MetaMask 등 다른 지갑 연결 시에도 provider가 올바르게 설정되는지

---

### Issue 3: useWallet.ts — Event Listener 방식 변경

**파일**: `hooks/useWallet.ts`
**위험도**: 높음 (체인/계정 변경 감지 실패 → stale data)

**변경 내용**:
```typescript
// poc-platform
const [stableNetProvider, setStableNetProvider] = useState(null)
detectProvider({ timeout: 2000 }).then(setStableNetProvider)
// wallet-sdk의 onNetworkChange / onAccountChange 사용
stableNetProvider.onNetworkChange(() => queryClient.invalidateQueries())
stableNetProvider.onAccountChange(() => queryClient.invalidateQueries())

// stable-platform
// wagmi connector에서 provider를 꺼내서 직접 on('chainChanged', ...) 등록
const setupListeners = async () => {
  const resolved = await connector.getProvider()
  resolved.on('accountsChanged', invalidate)
  resolved.on('chainChanged', invalidate)
  cleanup = () => {
    resolved.removeListener?.('accountsChanged', invalidate)
    resolved.removeListener?.('chainChanged', invalidate)
  }
}
setupListeners()
```

**잠재 이슈**:
- `setupListeners()`가 async → cleanup 함수가 설정되기 전에 useEffect return 실행될 수 있음
- wallet-sdk의 `onNetworkChange`/`onAccountChange`는 내부적으로 debounce/normalize할 수 있지만, raw `on('chainChanged')` 는 그렇지 않음
- `connector`가 변경되면 이전 provider의 listener가 정리되지 않을 수 있음 (race condition)

**검증 항목**:
- [ ] 체인 변경 시 잔고/트랜잭션 데이터가 즉시 갱신되는지
- [ ] 계정 변경 시 주소와 잔고가 올바르게 업데이트되는지
- [ ] 빠른 체인 전환 시 listener leak 발생하지 않는지

---

### Issue 4: useBatchTransaction.ts — Provider 획득 방식 변경

**파일**: `hooks/useBatchTransaction.ts`
**위험도**: 높음 (Batch 전송 실패)

**변경 내용**:
```typescript
// poc-platform
detectProvider({ timeout: 2000 }).then(setProvider)

// stable-platform
const { connector } = useAccount()
connector.getProvider().then((p) => setProvider(p as unknown as StableNetProvider))
```

**잠재 이슈**:
- useUserOp.ts와 동일한 패턴 → 동일한 이슈 (connector undefined, type casting)
- Batch 모드에서 multiple UserOp을 순차 전송할 때 provider 상태 일관성 문제

**검증 항목**:
- [ ] Batch 전송이 정상 동작하는지
- [ ] 단일 전송 → Batch 전환 시 provider가 유지되는지

---

### Issue 5: useWalletAssets.ts — 토큰 잔고 조회 대폭 변경

**파일**: `hooks/useWalletAssets.ts`
**위험도**: 중간

**변경 내용**:
```
poc-platform:
  1. wallet_getAssets 호출 → 지갑이 알려주는 토큰 목록
  2. 실패 시 eth_getBalance fallback (native만)
  3. window.ethereum 직접 접근

stable-platform:
  1. wallet_getAssets 호출 → 지갑 토큰 목록
  2. getDefaultTokens() + publicClient.readContract(balanceOf) → on-chain 조회
  3. mergeOnChainTokens()으로 병합 (on-chain이 authoritative)
  4. window.stablenet 우선, fallback window.ethereum
  5. assetsChanged 이벤트만 구독 (chainChanged/accountsChanged 제거)
```

**잠재 이슈**:
- `publicClient`의 RPC URL이 현재 체인과 불일치하면 잔고 전부 0 표시
- `getDefaultTokens(chainId)` 결과가 비어있으면 ERC-20 토큰이 표시 안됨
- `chainChanged`/`accountsChanged` 이벤트 구독 제거 → `useWallet`에서만 처리되는데 타이밍 차이 가능
- `useStableNetContext().chainId` 사용 → `useChainId()` (wagmi) 와 값이 다를 수 있음

**검증 항목**:
- [ ] 대시보드에서 USDC 등 ERC-20 토큰 잔고가 표시되는지
- [ ] 체인 전환 후 토큰 목록이 갱신되는지
- [ ] `getDefaultTokens(8283)` 이 올바른 토큰 목록을 반환하는지

---

### Issue 6: useBalance.ts — raw RPC → publicClient 마이그레이션

**파일**: `hooks/useBalance.ts`
**위험도**: 중간

**변경 내용**:
```typescript
// poc-platform: manual ABI encoding
const data = `0x70a08231000000000000000000000000${address.slice(2)}`
await windowProvider.request({ method: 'eth_call', params: [{ to: token, data }, 'latest'] })

// stable-platform: viem readContract (type-safe)
await publicClient.readContract({
  address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address]
})
```

**잠재 이슈**:
- `publicClient`가 null이면 fallback 경로를 타야 하는데, fallback 코드가 제대로 유지되었는지 확인 필요
- 체인 전환 시 `publicClient`가 이전 체인의 RPC를 가리킬 수 있음

**검증 항목**:
- [ ] Payment Send 페이지에서 잔고가 올바르게 표시되는지
- [ ] 토큰 잔고와 native 잔고가 모두 정상인지

---

### Issue 7: useTokens.ts — Indexer → On-chain 조회 변경

**파일**: `hooks/useTokens.ts`
**위험도**: 중간

**변경 내용**:
```typescript
// poc-platform
const client = createIndexerClient(indexerUrl)
const balances = await client.getTokenBalances(address, 'ERC20')

// stable-platform
const knownTokens = getDefaultTokens(chainId)
await publicClient.readContract({ abi: erc20Abi, functionName: 'balanceOf', ... })
```

**잠재 이슈**:
- Indexer 의존 제거는 좋지만, `getDefaultTokens()`에 없는 토큰은 표시 불가
- publicClient 가용성에 의존

**검증 항목**:
- [ ] Swap 페이지에서 토큰 목록이 올바르게 표시되는지
- [ ] 커스텀 토큰 (getDefaultTokens에 없는) 처리가 필요한지

---

### Issue 8: StableNetProvider.tsx — 체인별 publicClient 분기

**파일**: `providers/StableNetProvider.tsx`
**위험도**: 낮음

**변경 내용**:
```typescript
// poc-platform
const chain = getStablenetLocal()  // 고정

// stable-platform
const chain = currentChainId === 82830 ? stablenetTestnet
            : currentChainId === 31337 ? anvilLocal
            : stablenetLocal
```

**잠재 이슈**:
- `currentChainId`가 초기에 잘못된 값이면 잘못된 RPC로 publicClient 생성
- 이 publicClient를 사용하는 모든 hook에 영향

**검증 항목**:
- [ ] 앱 시작 시 올바른 chainId로 publicClient가 생성되는지
- [ ] Settings에서 체인 변경 시 publicClient가 갱신되는지

---

### Issue 9: paymaster-proxy contracts.ts — getSupportedTokens ABI (해결됨)

**파일**: `services/paymaster-proxy/src/chain/contracts.ts`
**상태**: stable-platform에서 이미 수정됨

**변경 내용**:
```
poc-platform: getSupportedTokens() ABI로 직접 호출 → 컨트랙트에 함수 없음 → revert
stable-platform: getDefaultTokens() + isTokenSupported() 개별 검증 → 정상 동작
```

poc-platform에 이 수정이 아직 반영되지 않았다. 다음 sync 시 적용 필요.

---

## 검증 순서 (권장)

검증은 의존성 순서대로 아래에서 위로 진행한다:

```
Step 1: wagmi.ts (stableNetWallet 커넥터)
  ↓
Step 2: useUserOp.ts + useBatchTransaction.ts (provider 획득)
  ↓
Step 3: useWallet.ts (event listener)
  ↓
Step 4: StableNetProvider.tsx (publicClient 생성)
  ↓
Step 5: useWalletAssets.ts + useBalance.ts + useTokens.ts (데이터 조회)
```

각 단계에서 poc-platform의 동작과 비교하면서 검증한다.

---

## 참고: poc-platform → stable-platform 동기화 시 주의

`docs/` 디렉토리를 제외하고 poc-platform에 동기화할 때,
아래 파일은 **stable-platform의 수정이 더 최신**이므로 역방향으로 덮어쓰면 안 된다:

- `services/paymaster-proxy/src/chain/contracts.ts` (getSupportedTokens 수정)
- `apps/web/docs/screens/` (이슈 체크리스트)
