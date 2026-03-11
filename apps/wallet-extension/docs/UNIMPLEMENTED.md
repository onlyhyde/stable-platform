# 미구현 항목 종합 (Wallet Extension)

> 2026-03-11 기준, 화면별 코드 리뷰(01-14) 완료 후 남은 미구현/향후 과제 항목 정리

## 요약

| 분류 | 항목 수 |
|------|---------|
| 미구현 (코드 작업 필요) | 3 |
| 설계 한계 (아키텍처/API 변경 필요) | 6 |
| 리팩토링 (코드 품질) | 2 |
| **합계** | **11** |

---

## 1. 미구현 (코드 작업 필요)

### 1-1. Lock Screen — 반복 실패 잠금/딜레이 메커니즘
- **화면**: 02-LOCK
- **파일**: `src/ui/pages/Lock.tsx`, `src/background/controllers/`
- **현황**: 비밀번호 무제한 시도 가능. brute-force 방어 없음
- **필요 작업**:
  - 연속 N회 실패 시 점진적 딜레이 (예: 3회 → 5초, 5회 → 30초, 10회 → 5분)
  - Background에서 실패 횟수 추적 + 잠금 상태 관리
  - UI에 남은 대기 시간 카운트다운 표시
- **우선순위**: 🔴 높음 (보안)

### 1-2. Bank — onramp 통합 UI
- **화면**: 11-BANK
- **파일**: `src/ui/pages/Bank.tsx`
- **현황**: Bank 페이지는 계좌 연동/이체만 제공. BuyPage처럼 onramp 플로우 미지원
- **필요 작업**:
  - Bank 계좌 → 크립토 구매 플로우 (BuyPage와 통합 또는 별도 구현)
  - 또는 Bank/Buy 탭 통합 UI 설계
- **우선순위**: 🟡 중간 (기능)

### 1-3. Bank — Background handler 미구현
- **화면**: 11-BANK
- **파일**: `src/background/index.ts`
- **현황**: Bank 관련 message type(`GET_LINKED_BANK_ACCOUNTS`, `LINK_BANK_ACCOUNT`, `UNLINK_BANK_ACCOUNT`, `SYNC_BANK_ACCOUNT`, `BANK_TRANSFER`)이 type schema에는 등록되어 있으나 background handler가 미구현
- **필요 작업**:
  - `BankController` 생성 또는 기존 handler에 bank 메시지 타입 처리 추가
  - Bank API (simulator) 연동
- **우선순위**: 🔴 높음 (Bank 페이지 전체가 동작하지 않음)

---

## 2. 설계 한계 (아키텍처/API 변경 필요)

### 2-1. Swap — 클라이언트사이드 가격 기반 estimate
- **화면**: 10-SWAP
- **파일**: `src/ui/pages/SwapPage.tsx`
- **현황**: 스왑 예상 금액이 토큰 가격 비율로 계산됨 (실제 DEX quote 아님)
- **향후 과제**: DEX aggregator API (1inch, 0x, Uniswap) 연동으로 실제 quote 제공
- **영향**: 사용자가 보는 예상 금액과 실제 수령 금액 차이 발생 가능

### 2-2. Swap — Price Impact 계산 단순화
- **화면**: 10-SWAP
- **파일**: `src/ui/pages/SwapPage.tsx`
- **현황**: Price Impact가 fee 기반 추정치 (실제 유동성 풀 데이터 미반영)
- **향후 과제**: DEX 유동성 풀 데이터 연동으로 실제 price impact 계산

### 2-3. Swap — Swap Executor 모듈 식별 방식
- **화면**: 10-SWAP
- **파일**: `src/ui/pages/SwapPage.tsx`
- **현황**: `metadata.name`에 'swap' 문자열 포함 여부로 Swap Executor 식별
- **향후 과제**: Module type ID 또는 interface 기반 정확한 모듈 식별

### 2-4. Swap — 가스비 예약량 고정
- **화면**: 10-SWAP
- **파일**: `src/ui/pages/SwapPage.tsx`
- **현황**: Max 클릭 시 가스비 예약이 0.01 ETH로 고정
- **향후 과제**: 네트워크별 현재 가스 가격 기반 동적 예약량 계산

### 2-5. Buy — Payment Instructions 은행 정보 하드코딩
- **화면**: 12-BUY
- **파일**: `src/ui/pages/BuyPage.tsx`
- **현황**: `bank_transfer` 결제 시 표시되는 은행 정보가 placeholder
- **향후 과제**: Onramp API 응답에서 실제 은행 이체 정보 제공

### 2-6. ApprovalWarnings — 키워드 기반 피싱 감지
- **화면**: 14-APPROVAL
- **파일**: `src/approval/components/ApprovalWarnings.tsx`
- **현황**: 경고 분류가 단순 키워드 매칭 (`unlimited`, `simulation failed` 등)
- **향후 과제**: ML 기반 피싱 감지 또는 외부 security API (GoPlus, ScamSniffer) 연동

---

## 3. 리팩토링 (코드 품질)

### 3-1. Settings.tsx 파일 분리
- **화면**: 13-SETTINGS
- **파일**: `src/ui/pages/Settings.tsx` (2034줄)
- **현황**: 단일 파일에 모든 설정 섹션이 포함됨 (800줄 권장 기준 2.5배 초과)
- **필요 작업**:
  - `Settings/index.tsx` — 메인 라우터/레이아웃
  - `Settings/NetworkSettings.tsx` — 네트워크 관리
  - `Settings/LedgerSettings.tsx` — Ledger 연결
  - `Settings/SmartAccountSettings.tsx` — SA 설정
  - `Settings/PreferencesSettings.tsx` — 언어/MetaMask/Auto-lock
  - `Settings/KeyManagement.tsx` — Import/Export Private Key
  - `Settings/ConnectedSites.tsx` — dApp 연결 관리
- **우선순위**: 🟡 중간 (유지보수성)

### 3-2. ApprovalWarnings — medium severity 색상 불일치
- **화면**: 14-APPROVAL
- **파일**: `src/approval/components/ApprovalWarnings.tsx`
- **현황**: `SEVERITY_STYLES.medium`에서 `icon`만 CSS variable 사용 (`rgb(var(--warning, 234 179 8))`), `bg`/`border`/`text`는 여전히 하드코딩 (`rgb(234 179 8 / 0.x)`)
- **필요 작업**: medium severity의 모든 색상을 CSS variable 기반으로 통일
- **우선순위**: 🟢 낮음 (스타일)

---

## 화면별 완료 현황

| # | 화면 | 전체 항목 | 완료 | 미구현/NOTE |
|---|------|----------|------|------------|
| 01 | ONBOARDING | 5 | 5 | 0 |
| 02 | LOCK | 5 | 4 | 1 |
| 03 | HOME | 8 | 8 | 0 |
| 04 | SEND | 12 | 12 | 0 |
| 05 | RECEIVE | 4 | 4 | 0 |
| 06 | ACTIVITY | 10 | 10 | 0 |
| 07 | TX-DETAIL | 6 | 6 | 0 |
| 08 | SA-DASHBOARD | 5 | 5 | 0 |
| 09 | MODULES | 9 | 9 | 0 |
| 10 | SWAP | 9 | 9 | 4 NOTE |
| 11 | BANK | 7 | 6 | 1 미구현 + 1 NOTE |
| 12 | BUY | 9 | 9 | 1 NOTE |
| 13 | SETTINGS | 11 | 11 | 1 NOTE |
| 14 | APPROVAL | 8 | 8 | 1 NOTE |
| **합계** | | **108** | **106** | **11** |
