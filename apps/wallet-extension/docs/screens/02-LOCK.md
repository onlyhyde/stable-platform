# 02. Lock Screen

**Source**: `src/ui/pages/Lock.tsx`
**진입 조건**: `isInitialized === true && isUnlocked === false`

## UI 구성

1. **로고** - 그라디언트 배경 "S" 아이콘 (w-16 h-16)
2. **제목** - "Welcome Back"
3. **설명** - "Enter your password to unlock"
4. **비밀번호 입력**
   - `<Input>` 공통 컴포넌트 사용
   - show/hide 토글 (눈 아이콘)
   - autoFocus 설정
   - 에러 메시지 표시 (localError 또는 props.error)
5. **Unlock 버튼** - `<Button>` 공통 컴포넌트, 로딩 상태 지원
6. **Forgot Password** 링크 - 클릭 시 리셋 확인 UI 토글
7. **Reset Wallet 확인** - 경고 메시지 + 초기화 버튼 (시드 문구 필요 안내)
8. **Password Hint Card** - `<Card>` 컴포넌트로 힌트 표시

## 동작

```
handleSubmit(e):
  1. e.preventDefault()
  2. password 비어있으면 return
  3. isLoading = true
  4. onUnlock(password) 호출
  5. 실패 시 localError 설정
  6. finally: isLoading = false
```

## Props

```typescript
interface LockProps {
  onUnlock: (password: string) => Promise<void>
  onResetWallet?: () => void
  error?: string
}
```

- `onUnlock`: App.tsx에서 `unlockWallet(password)` 호출
- `onResetWallet`: 지갑 초기화 (선택적, 미구현 시 disabled)
- `error`: useWalletStore의 글로벌 에러

## Issue Checklist

- [x] "Forgot Password" 버튼이 아무 동작도 하지 않음 (onClick 없음) → **수정 완료**: 클릭 시 리셋 경고 UI 토글 + onResetWallet prop 추가
- [x] 비밀번호 입력 후 Enter 키로 제출 가능 여부 (form onSubmit으로 처리됨 - OK)
- [x] 에러 메시지 초기화 타이밍 → **수정 완료**: password 입력 시 localError 초기화 + onUnlock 호출 전 글로벌 error 초기화
- [ ] 반복 실패 시 잠금 또는 딜레이 메커니즘 없음
- [x] 지갑이 pannel 상태로 존재할때, 잠금 ui 가 활성화되지 않은채 내부 잠금 상태인 경우가 존재 → **수정 완료**: App.tsx에 visibilitychange 리스너 추가, 페이지 visible 시 background 재동기화

### 수정 내역 (2026-03-10)
1. `Lock.tsx`: "Forgot Password" 클릭 → 리셋 확인 UI 토글 (경고 + Reset Wallet 버튼)
2. `Lock.tsx`: `onResetWallet` optional prop 추가 (미구현 시 버튼 disabled)
3. `Lock.tsx`: password 입력 시 `localError` 즉시 초기화
4. `App.tsx`: `onUnlock` 호출 전 `setError(null)` 추가하여 글로벌 에러 초기화
5. `App.tsx`: `visibilitychange` 이벤트 리스너 추가 → sidepanel 복귀 시 background 재동기화
6. `lock.json` (en/ko): `resetWarning`, `resetWallet` 번역 키 추가
