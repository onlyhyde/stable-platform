# 05. Receive

**Source**: `src/ui/pages/Receive.tsx`
**Page Key**: `receive`

## UI 구성

1. **제목**: "Receive" (중앙 정렬)
2. **QR Code**
   - `qrcode` 라이브러리 사용 (QRCode.toDataURL)
   - 크기: 192x192, margin: 1
   - 색상: dark #000000 / light #ffffff
   - 로딩 중: placeholder 아이콘 + animate-pulse
   - 컨테이너: w-48 h-48, rounded-2xl, border
3. **Account Address**
   - secondary 배경 카드
   - "Account Address" 라벨
   - 전체 주소 (code, break-all)
4. **Copy Button**
   - 전체 너비
   - 복사 시 "Copied!" + 체크 아이콘 (2초간)
   - 기본: "Copy Address" + 복사 아이콘
5. **경고 메시지**
   - "Only send assets on the same network..."

## 데이터 흐름

```
Hooks:
  - useWalletStore: selectedAccount, accounts

QR Code 생성:
  - selectedAccount 변경 시 QRCode.toDataURL() 호출
  - 실패 시 null (placeholder 표시)

Copy:
  - navigator.clipboard.writeText(selectedAccount)
  - 2초 타이머로 "Copied!" 상태 복귀
```

## Issue Checklist

- [x] QR Code 생성 실패 시 대체 UI → **수정 완료**: `qrFailed` 상태 분리, 실패 시 경고 아이콘 + "Failed to generate QR code" 메시지 표시
- [x] Dark mode에서 QR 가독성 (현재 항상 black/white) → OK: QR 이미지 자체가 white 배경이므로 dark mode에서도 가독성 문제 없음
- [x] 복사 실패 시 에러 처리 없음 → **수정 완료**: try/catch 추가, 실패 시 `copyError` 상태 + "Copy failed" 버튼 UI (3초간)
- [x] 네트워크 이름 표시 없음 (경고만 있음) → **수정 완료**: `useSelectedNetwork` 연동, 네트워크 이름 뱃지 + 경고 메시지에 네트워크명 포함

### 수정 내역 (2026-03-10)
1. `Receive.tsx`: QR 생성 실패 시 로딩/실패 상태 분리 (`qrFailed` state) → 실패 시 경고 아이콘 UI
2. `Receive.tsx`: `copyAddress()` try/catch 추가 → 실패 시 `copyError` 상태 + X 아이콘 버튼 (3초 후 복귀)
3. `Receive.tsx`: `useSelectedNetwork` 연동 → 네트워크 이름 뱃지 + 경고 메시지에 네트워크명 삽입
4. `common.json` (en/ko): `qrCodeFailed`, `copyFailed`, `receiveWarningNetwork`, `currentNetwork` 번역 키 추가
