# 09. Modules

**Source**: `src/ui/pages/Modules/index.tsx`
**Page Key**: `modules`

## View System

ModulesPage는 내부적으로 여러 view를 관리합니다:

```
overview -> list -> details
              |-> install
         -> delegate (setup/revoke)
         -> gas-sponsorship
         -> session-keys
         -> spending-limits
         -> deposit
```

## Guard: Smart Account Required

`selectedAccount`이 없거나 smart/delegated가 아닌 경우:
- "Smart Account Required" 메시지
- "Enable Smart Account" 버튼 -> delegate view

## Views

### 1. Overview (`SmartAccountDashboard` - Modules 내부 버전)
**Source**: `src/ui/pages/Modules/SmartAccountDashboard.tsx`
- Status card, delegation info, root validator, installed modules
- Quick action 네비게이션:
  - Modules List, Install Module
  - Gas Sponsorship, Session Keys, Spending Limits, Deposit
  - Revoke Delegation

### 2. Module List (`view === 'list'`)
- **Header**: Back(→overview) + "Modules" 제목 + "Add Module" 버튼
- **Tab Toggle**: Installed | Browse All
- **Installed Tab**:
  - ModuleCategoryTabs (2x2 grid: Validators, Executors, Hooks, Fallbacks)
  - ModuleList 컴포넌트 (설치된 모듈 표시)
- **Browse Tab**:
  - Registry modules from `useModuleMarketplace`
  - 각 모듈: 아이콘 + 이름 + 설명 + 타입 뱃지 + 버전 + Verified 뱃지
  - 이미 설치: "Installed" 뱃지
  - 미설치: "Install" 버튼

### 3. Module Details (`ModuleDetails.tsx`)
- 선택된 모듈의 상세 정보
- Uninstall 버튼

### 4. Install Module Wizard (`InstallModule.tsx`)
- Marketplace에서 모듈 선택
- 설정 옵션 구성
- Preview + Install

### 5. Delegate Setup (`DelegateSetup.tsx`)
- EIP-7702 delegation 설정 또는 해제
- mode: 'setup' | 'revoke'
- 완료 시: refetchSmartAccountInfo + syncWithBackground

### 6. Gas Sponsorship (`GasSponsorshipView.tsx`)
- 스폰서 트랜잭션 설정

### 7. Session Keys (`SessionKeysView.tsx`)
- 설치된 session key validator 조회
- Install 네비게이션

### 8. Spending Limits (`SpendingLimitsView.tsx`)
- 지출 한도 설정/관리

### 9. EntryPoint Deposit (`EntryPointDeposit.tsx`)
- EntryPoint 컨트랙트에 예치금 입금

## Module Config Components
- `SwapExecutorConfig.tsx`
- `LendingExecutorConfig.tsx`
- `StakingExecutorConfig.tsx`
- `RecurringPaymentConfig.tsx`
- `SpendingLimitConfig.tsx`
- `MultiSigConfig.tsx`
- `WebAuthnConfig.tsx`
- `SessionKeyConfig.tsx`
- `ModuleConfig.tsx` (generic)

## 데이터 흐름

```
Hooks:
  - useWalletStore: accounts, selectedAccount, syncWithBackground
  - useSelectedNetwork: currentNetwork
  - useModules: installedModules, isLoading, error, refetch
  - useModuleMarketplace: registryModules, isLoading
  - useSmartAccountInfo: info, isLoading, refetch

Account Type Sync:
  - smartAccountInfo.accountType !== selectedAccount.type이면
    useWalletStore.setState()로 직접 업데이트
```

## Module Types

| Type | BigInt | 아이콘 | 설명 |
|------|--------|------|------|
| Validator | 1n | 🔐 | 인증/권한 |
| Executor | 2n | ⚡ | 배치 TX, 스왑, 대출, 스테이킹 |
| Fallback | 3n | 🔄 | 복구 메커니즘 |
| Hook | 4n | 🪝 | pre/post 실행 로직 |

## Issue Checklist

- [x] Account type 동기화 → OK: Zustand `setState()` 직접 호출은 안전한 패턴 (React 외부에서도 동작)
- [x] Module uninstall 완성도 → OK: `uninstallModule` + `forceUninstallModule` + confirm 다이얼로그 + 에러 처리
- [x] Browse marketplace 로딩 실패 시 에러 표시 → **수정 완료**: `registryError` destructure + 에러 UI 추가
- [x] DelegateSetup revoke 완료 후 UI 업데이트 → OK: `refetchSmartAccountInfo` + `syncWithBackground` + `refetch` 호출
- [x] 각 Config 컴포넌트 구현 완성도 → OK: 8개 Config UI 모두 구현 + import 연결됨
- [x] Install wizard flow 전체 동작 → OK: select-type → select-module → configure → confirm → pending → success
- [x] known contract 주소 적용 → OK: `useContractAddresses` → `@stablenet/contracts` `getChainAddresses()` 연동
- [x] installed module 조회/UI → OK: `useModules` → ModuleList 연동
- [x] installed module uninstall 지원 → OK: ModuleDetails → uninstall + force uninstall + revoke session key

### 수정 내역 (2026-03-11)
1. `Modules/index.tsx`: `useModuleMarketplace`의 `error`를 `registryError`로 destructure + Browse 탭에 에러 UI 추가
2. `modules.json` (en/ko): `failedToLoadRegistry` 번역 키 추가
