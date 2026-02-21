# Task 3: Marketplace 레지스트리 API 연동

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools에 Order Router API 연동, AddLiquidity에 Uniswap V2 Router 온체인 호출 구현.
> **Task 2 (Merchant Dashboard)**: useSubscriptionEvents 훅으로 온체인 이벤트 조회, PaymentAnalyticsCard/RecentTransactionsCard 데이터 연동, 실시간 통계 계산.

---

## 현재 상태

### 완성된 부분
- ModuleCard, ModuleDetailModal, InstallModuleModal, CategoryFilter 컴포넌트
- useModule 훅 - 모듈 인코딩 (ECDSA, MultiSig, SpendingLimit 등)
- useModuleInstall 훅 - 설치/상태확인 플로우
- moduleAddresses.ts - 8개 모듈의 체인별 주소 매핑
- 카테고리/타입 필터링 UI
- 모듈별 설정 폼 (ECDSA, Multisig, SpendingLimit)

### 미구현 부분
1. **하드코딩된 MODULE_CATALOG**: 8개 모듈이 page.tsx에 인라인 정의
2. **동적 레지스트리 미사용**: wallet-extension의 `stablenet_getRegistryModules` RPC 미활용
3. **모듈 Uninstall**: UI에 placeholder 메시지만
4. **레지스트리 기반 주소 해석**: 현재 `moduleAddresses.ts` 수동 매핑

---

## 구현 계획

### 1. useModuleRegistry 훅 생성

**파일**: `hooks/useModuleRegistry.ts` (신규)

**기능**: 동적으로 모듈 레지스트리에서 모듈 목록 조회

**데이터 소스 옵션**:

**옵션 A - @stablenet/core 직접 사용 (권장)**:
```typescript
import { createModuleRegistry } from '@stablenet/core'

// wallet-extension handler.ts (line 2361-2385) 참조
const registry = createModuleRegistry(publicClient)
const modules = await registry.getRegisteredModules()
// 타입 필터: registry.getRegisteredModules({ type: moduleType })
```

**옵션 B - RPC 통한 조회** (StableNet 지갑 연결 시):
```typescript
const modules = await provider.request({
  method: 'stablenet_getRegistryModules',
  params: [{ chainId, type: filterType }]
})
```

**반환 타입**:
```typescript
interface RegistryModule {
  metadata: {
    address: Address
    type: bigint        // 1=Validator, 2=Executor, 3=Fallback, 4=Hook
    name: string
    description: string
    version: string
    isVerified?: boolean
    logoUrl?: string
    tags?: string[]
  }
  configSchema: unknown
  addresses: Record<number, Address>  // chainId → address
  supportedChains: number[]
}

interface UseModuleRegistryReturn {
  modules: RegistryModule[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}
```

### 2. Marketplace 페이지 리팩토링

**파일**: `app/marketplace/page.tsx`

**변경**:
- `MODULE_CATALOG` 하드코딩 제거
- `useModuleRegistry()` 훅으로 동적 로드
- 레지스트리 모듈 → 기존 ModuleCard 포맷 매핑
- 로딩/에러 상태 추가
- 폴백: 레지스트리 실패 시 기존 하드코딩 데이터 사용

```typescript
// 기존
const MODULE_CATALOG: MarketplaceModule[] = [ ... 8개 하드코딩 ]

// 변경 후
const { modules: registryModules, isLoading } = useModuleRegistry()
const displayModules = registryModules.length > 0
  ? mapRegistryToDisplay(registryModules)
  : FALLBACK_CATALOG  // 기존 하드코딩을 폴백으로 유지
```

### 3. 모듈 Uninstall 기능 추가

**파일**: `hooks/useModuleInstall.ts`, `components/marketplace/ModuleDetailModal.tsx`

**현재 useModule.ts에 이미 존재**:
```typescript
encodeUninstallModule(moduleType, moduleAddress, deInitData)
```

**필요 구현**:
- `useModuleInstall`에 `uninstallModule()` 함수 추가
- ModuleDetailModal에 "Uninstall" 버튼 추가
- 확인 모달 (위험 경고 포함)
- 설치 상태에 따른 버튼 토글 (Install ↔ Uninstall)

### 4. moduleAddresses.ts 동적 해석

**현재**: 수동 매핑 테이블
```typescript
const MODULE_REGISTRY: Record<string, ModuleRegistryEntry> = {
  'ecdsa-validator': { address: '0x...', type: 'VALIDATOR' },
  // ... 8개 수동 등록
}
```

**변경**: 레지스트리에서 주소를 가져오되, 로컬 매핑을 폴백으로 유지
```typescript
export function getModuleAddress(moduleId: string, chainId: number): Address | null {
  // 1차: 레지스트리 캐시에서 조회
  // 2차: 로컬 매핑 폴백
  return MODULE_REGISTRY[moduleId]?.address ?? null
}
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hooks/useModuleRegistry.ts` | **신규** - 레지스트리 조회 훅 |
| `app/marketplace/page.tsx` | 하드코딩 제거, 동적 로드 |
| `hooks/useModuleInstall.ts` | uninstallModule() 추가 |
| `components/marketplace/ModuleDetailModal.tsx` | Uninstall 버튼 추가 |
| `components/marketplace/ModuleCard.tsx` | Install/Uninstall 상태 토글 |
| `lib/moduleAddresses.ts` | 폴백 구조로 리팩토링 |

## 참조 코드

### wallet-extension RPC 핸들러 (handler.ts:2361-2385)
```typescript
case 'stablenet_getRegistryModules': {
  const registry = createModuleRegistry(client)
  const modules = await registry.getRegisteredModules()
  // type 필터 적용
  return modules
}
```

### @stablenet/contracts 주소 (chain 8283)
```
ecdsa-validator:         0xb33DC2d82eAee723ca7687D70209ed9A861b3B46
session-key-validator:   0x621b0872c00F6328BD9001A121AF09DD18B193E0
subscription-executor:   0x3157C4a86d07a223E3B46F20633f5486E96B8F3C
spending-limit-hook:     0x304cb9f3725e8B807C2FE951C8DB7fea4176f1c5
social-recovery:         0x38Fb544BEEe122A2Ea593e7d9c8f019751273287
dex-swap-executor:       0x2f86f04c1D29Ac39752384B34167a42E6d1730F9
stealth-address-fallback:0x430669578b1E8f02Ab648832ef4eC823d814726B
multisig-validator:      0x284D8e1D4864BfAB4EA1dfE283F7f849C075bFa5
```

### Kernel Module ABI
```solidity
function installModule(uint256 moduleTypeId, address module, bytes calldata initData)
function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)
function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata context) → bool
```
