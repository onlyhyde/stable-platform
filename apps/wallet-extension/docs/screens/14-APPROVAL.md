# 14. Approval (별도 윈도우)

**Source**: `src/approval/`
**진입 방식**: background에서 `chrome.windows.create()` (400x600px)

## Entry Point
- `approval.html` -> `src/approval/main.tsx` -> `src/approval/App.tsx`
- `useApproval` hook으로 approval 요청 데이터 수신

## Approval Types

### 1. ConnectApproval (`ConnectApproval.tsx`)
- dApp에서 지갑 연결 요청
- 표시: origin URL, 요청된 계정 목록
- Approve / Reject 버튼

### 2. TransactionApproval (`TransactionApproval.tsx`)
- 트랜잭션 승인 요청
- 표시: to, value, data
- Gas estimate
- `<TransactionSimulation>` 컴포넌트: 시뮬레이션 결과
- `<ApprovalWarnings>` 컴포넌트: 피싱/보안 경고
- Approve / Reject 버튼 (비밀번호 확인)

### 3. SignatureApproval (`SignatureApproval.tsx`)
- 메시지/TypedData 서명 요청
- 표시: 서명할 메시지 또는 structured data
- Signer account 표시
- 피싱 감지 + 위험도 분석
- Approve / Reject 버튼

### 4. AuthorizationApproval (`AuthorizationApproval.tsx`)
- EIP-7702 delegation 승인
- Delegation 상세 표시
- Approve / Reject 버튼

## Shared Components

### ApprovalWarnings (`components/ApprovalWarnings.tsx`)
- 보안 경고 메시지 표시
- 위험 수준별 스타일

### TransactionSimulation (`components/TransactionSimulation.tsx`)
- TX 시뮬레이션 결과 시각화
- 예상 상태 변경 표시

## 데이터 흐름

```
Background -> Approval Window:
  1. chrome.windows.create({ url: 'approval.html?id=...' })
  2. useApproval hook: GET_APPROVAL 메시지로 데이터 수신
  3. 사용자 결정: APPROVAL_RESPONSE 메시지 전송

Message Types:
  - GET_APPROVAL -> { type: 'connect' | 'transaction' | 'signature' | 'authorization', data: ... }
  - APPROVAL_RESPONSE -> { approved: boolean, ... }
```

## Issue Checklist

- [x] Approval 윈도우 크기/위치 적절성 → OK: `chrome.windows.create({ width: 400, height: 600, type: 'popup', focused: true })`
- [x] TX 시뮬레이션 구현 완성도 → OK: `TransactionSimulation` 컴포넌트 — decoded calldata, balance changes, revert reason, unknown function 경고 구현
- [x] 피싱 감지 정확성 → OK: `ApprovalWarnings` — severity 분류 (critical/high/medium/info), 키워드 기반 분류, 정렬된 경고 표시
- [x] 비밀번호 확인 (TX approval) 구현 → OK: wallet unlock 상태에서만 approval 윈도우 접근 가능, TransactionApproval에서 Confirm/Reject 선택
- [x] EIP-7702 authorization 상세 표시 → OK: `AuthorizationApproval` — 계정/컨트랙트 주소, chainId/nonce, contractInfo (name/description/features), risk level 뱃지, revocation 분기, critical warning 상세
- [x] 윈도우 닫기 = Reject로 처리되는지 → **수정 완료**: `ApprovalController.handleWindowClosed()` 추가 + `chrome.windows.onRemoved` 리스너 등록
- [x] 다중 approval 큐 관리 → OK: `pendingApprovals` Map 기반, 기존 윈도우 재활용 (`tabs.update`), expiry timer 관리
- [x] 하드코딩 warning 색상 (`rgb(234 179 8)`) → **수정 완료**: CSS variable `rgb(var(--warning, 234 179 8))` 전환 (3곳)

### 수정 내역 (2026-03-11)
1. `approvalController.ts`: `handleWindowClosed(windowId)` 메서드 추가 — 윈도우 닫기 시 모든 pending approval reject
2. `background/index.ts`: `chrome.windows.onRemoved` 리스너 등록 → `approvalController.handleWindowClosed(windowId)` 호출
3. `ConnectApproval.tsx`: `rgb(234 179 8)` → `rgb(var(--warning, 234 179 8))` 전환
4. `TransactionSimulation.tsx`: `rgb(234 179 8)` → `rgb(var(--warning, 234 179 8))` 전환
5. `ApprovalWarnings.tsx`: `rgb(234 179 8)` → `rgb(var(--warning, 234 179 8))` 전환
