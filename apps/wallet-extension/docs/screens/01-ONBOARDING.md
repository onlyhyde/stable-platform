# 01. Onboarding

**Source**: `src/ui/pages/Onboarding/index.tsx`
**진입 조건**: `isInitialized === false`

## Flow

```
Welcome -> [Create New] -> CreatePassword -> SeedPhrase -> ConfirmSeed -> Complete
Welcome -> [Import]     -> ImportWallet -> CreatePassword (importPassword) -> Complete
```

## Sub-screens

### Welcome (`Welcome.tsx`)
- 로고 + 앱 이름
- "Create New Wallet" 버튼
- "Import Existing Wallet" 버튼

### CreatePassword (`CreatePassword.tsx`)
- 비밀번호 입력 필드
- 비밀번호 확인 필드
- 뒤로 가기 버튼
- 로딩 상태 표시
- `createWallet(password)` -> mnemonic + address 반환

### SeedPhrase (`SeedPhrase.tsx`)
- 생성된 mnemonic 표시 (12/24 word)
- "I've saved it" 확인 버튼
- 뒤로 가기 버튼

### ConfirmSeed (`ConfirmSeed.tsx`)
- 시드 구문 순서 확인 (셔플된 단어 선택)
- 뒤로 가기 버튼

### ImportWallet (`ImportWallet.tsx`)
- mnemonic 입력 필드
- 에러 메시지 표시
- 뒤로 가기 버튼
- `restoreWallet(password, mnemonic)` -> address 반환

### Complete (`Complete.tsx`)
- 생성된 주소 표시
- "Start Using Wallet" 버튼
- 완료 시 sensitive data(password, mnemonic) 초기화

## 데이터 흐름

```
createWallet(pwd) -> { mnemonic, address }
restoreWallet(pwd, mnemonic) -> address
onComplete() -> syncWithBackground()
```

## Issue Checklist

- [x] 비밀번호 강도 검증 UI 존재 여부 -> 이미 구현됨 (5단계 strength bar + 8자/대소문자/숫자 검증)
- [x] 시드 구문 백업 경고 메시지 -> 이미 구현됨 (destructive 경고 + blur + "written down" 토글)
- [x] Import 시 유효하지 않은 mnemonic 에러 처리 -> **수정 완료**: BIP-39 단어 목록 + checksum 검증 추가
- [x] 뒤로 가기 시 상태 초기화 여부 -> **수정 완료**: step별 민감 데이터 선택적 초기화 추가
- [x] Complete에서 민감 데이터 정리 확인 -> **수정 완료**: unmount cleanup + clearSensitiveState 유틸 추가

### 수정 내역 (2026-03-10)
1. `ImportWallet.tsx`: `@scure/bip39` 기반 BIP-39 단어 목록 + checksum 검증 3단계 추가
2. `ImportWallet.tsx`: 하드코딩 색상 `rgb(234 179 8)` -> `rgb(var(--warning))` 수정
3. `index.tsx`: `handleBack`에서 step별 민감 데이터 선택적 초기화 (seedPhrase→createPassword: mnemonic 삭제)
4. `index.tsx`: `clearSensitiveState` 유틸 + unmount cleanup effect 추가
