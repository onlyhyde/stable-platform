# 08. Smart Account Dashboard

**Source**: `src/ui/pages/SmartAccountDashboard.tsx`
**Page Key**: `dashboard`

## UI 구성

### Header
- Back 버튼 -> Home
- 제목: "Dashboard" (i18n: tx.dashboardTitle)

### Status Card (그라디언트)
- **계정 타입 뱃지**: Smart Account Active / Delegated (EIP-7702) / EOA
  - smart/delegated: 초록 반투명 배경
  - eoa: 흰색 반투명 배경
- **배포 상태**: "Deployed" 뱃지 (isDeployed일 때)
- **주소**: font-mono, 전체 표시
- **Account ID**: 있으면 표시 (opacity-60)

### Delegation Info (delegated일 때만)
- secondary 카드
- "Delegation Target" 라벨
- truncated address (6...4)
- 복사 버튼

### Root Validator (있을 때만)
- secondary 카드
- "Root Validator" 라벨
- truncated address
- "Change" 버튼 -> Settings 페이지

### Installed Modules Grid (smart/delegated일 때)
- 2x2 그리드
- Validators / Executors / Hooks / Fallbacks
- 각각 count 표시 (로딩 중: '-')
- 색상: primary / accent / warning / success

### Quick Actions
| 액션 | 대상 페이지 | 조건 |
|------|-----------|------|
| Install Module | `modules` | 항상 |
| Enable Delegation | `modules` | EOA일 때만 |
| View Activity | `activity` | 항상 |

## 데이터 흐름

```
Hooks:
  - useWalletStore: selectedAccount, accounts, setPage
  - useSmartAccountInfo: info (accountType, isDeployed, isDelegated, delegationTarget, rootValidator, accountId)
  - useModules: installedModules

Module Count:
  - type 1n -> validator
  - type 2n -> executor
  - type 4n -> hook
  - type 3n -> fallback
```

## Issue Checklist

- [x] i18n 네임스페이스 'tx' → 'dashboard' 분리 → **수정 완료**: `dashboard.json` (en/ko) 생성, `useTranslation('dashboard')` 변경, tx.json에서 dashboard 키 제거
- [x] Enable Delegation 버튼 → modules 페이지 이동 → OK: Modules 페이지에서 `DelegateSetup` 컴포넌트로 실제 delegation 설정 제공 중
- [x] Root Validator Change → Settings 이동 → OK: Settings에서 `handleSetRootValidator` 기능 구현되어 있음
- [x] 계정 없을 때 처리 → OK: "No account selected" 이미 구현됨
- [x] delegationTarget 복사 피드백 없음 → **수정 완료**: `delegationCopied` 상태 추가, 복사 시 체크 아이콘 + 초록색 전환 (2초), try/catch 에러 처리

### 수정 내역 (2026-03-11)
1. `dashboard.json` (en/ko): 신규 생성 — dashboard 전용 i18n 키 분리 (22개 키)
2. `i18n/index.ts`: `dashboard` 네임스페이스 등록
3. `SmartAccountDashboard.tsx`: `useTranslation('tx')` → `useTranslation('dashboard')`, `dashboardTitle` → `title`
4. `SmartAccountDashboard.tsx`: delegationTarget 복사에 `delegationCopied` 상태 + 체크 아이콘 피드백 추가
5. `tx.json` (en/ko): dashboard 전용 키 제거 (TransactionDetail 키만 유지)
