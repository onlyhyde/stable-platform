# 09. Marketplace

**Source**: `app/marketplace/page.tsx`
**Route**: `/marketplace`

## 기능
- ERC-7579 모듈 마켓플레이스
- 모듈 검색, 카테고리/타입 필터
- 모듈 설치/제거
- Featured 모듈 섹션

## UI 구성

### 미연결
- PageHeader + ConnectWalletCard

### 연결
- Smart Account upgrade 경고 배너 (필요 시)
- Stats (3개): Total Modules, Total Installs, Audited/Verified count
- Search + CategoryFilter
- Featured Modules (필터 미활성 시만)
- All Modules grid
- InstallModuleModal + ModuleDetailModal

## 데이터 흐름

```
Hooks:
  - useWallet() → address, connectors
  - useSmartAccount() → status
  - useModuleRegistry() → MODULE_CATALOG
  - useModuleInstall() → install(), uninstall(), loadInstalledModules(), installedModules

State:
  - searchQuery, selectedCategory, selectedType
  - installModalModule, detailModalModule

Effect:
  - Smart Account ready + MODULE_CATALOG 존재 → loadInstalledModules()

Computed (useMemo):
  - filteredModules = search → category → type 3단 필터
```

## Issue Checklist

- [ ] `MODULE_CATALOG` 변경마다 effect 재실행 위험 — `useModuleRegistry()`가 memoize 안 하면 무한 루프
- [ ] Install 실패 시 `installModalModule` 미초기화 — 모달 열린 상태 유지
- [ ] Detail 모달 → Install 클릭 시 모달 즉시 닫힘 — 사용자가 변환 과정 미인지
- [ ] Uninstall 시 모달 즉시 닫힘 → 실패 시 에러 표시 부재 — toast만 표시
- [ ] Smart Account 업그레이드 중 `installedModules` 미초기화 — EOA 시절 캐시 잔존
- [ ] `installedModules.has(module.id)` 캐시 stale — 서버 사이드 설치/제거 미반영
- [ ] featured 모듈 `m.featured` undefined 체크 없음
