# 05. Session Keys

**Source**: `app/session-keys/page.tsx`
**Route**: `/session-keys`

## UI 구성
- 미연결: 잠금 아이콘 + 연결 안내 메시지
- 연결:
  - Page header
  - Info banner ("What are Session Keys?")
  - `<SessionKeyList>` 컴포넌트 (키 목록 + 생성/폐기)
  - Security notice banner

## 데이터 흐름

```
Hooks:
  - useWallet() → isConnected, address
  - useSessionKey() → sessionKeys[], isLoading, error
    - createSessionKey(), revokeSessionKey(), refresh(), clearError()
```

## Issue Checklist

- [v] `_address` (useWallet), `_clearError` (useSessionKey) — destructure 후 미사용. dead code
- [v] 페이지 자체에 에러 표시 없음 — SessionKeyList 내부에서만 에러 처리. 컴포넌트 렌더 실패 시 에러 미표시
- [v] 세션 키 생성 후 자동 갱신 없음 — 사용자가 수동 Refresh 필요
