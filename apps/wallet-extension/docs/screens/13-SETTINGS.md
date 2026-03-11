# 13. Settings

**Source**: `src/ui/pages/Settings.tsx`
**Page Key**: `settings`

## UI 구성 (섹션별)

### 1. Wallet Management
- **Lock Wallet** 버튼
  - `lockWallet()` 호출

### 2. Import Private Key
- "Import Private Key" 버튼 -> 토글
- 입력 필드: private key (textarea)
- Import 버튼: `importPrivateKey(key)`
- 성공/에러 메시지

### 3. Export Private Key
- "Export Private Key" 버튼
- 비밀번호 확인 모달
- 확인 후 key 표시 + 복사 버튼

### 4. Ledger Hardware Wallet
- "Connect Ledger" 버튼
- Discover accounts 기능
- Import selected accounts

### 5. Network Management
- **현재 네트워크 목록**
  - 각 네트워크: 이름 + chainId
  - Edit / Delete 버튼
- **Add Network 버튼 -> 모달**
  - Name
  - Chain ID
  - RPC URL
  - Bundler URL (optional)
  - Explorer URL (optional)
  - Indexer URL (optional)
- **Edit Network 다이얼로그**
- **Import Networks from File**

### 6. Connected Sites (dApp 연결 관리)
- 연결된 사이트 목록
- 각 사이트: origin + 권한 해제 버튼

### 7. Smart Account Settings (Smart Account일 때)
- SA 정보: type, deployment status, root validator
- Root Validator 변경

### 8. Preferences
- **Language**: 언어 선택 드롭다운 (i18n)
- **MetaMask Mode**: 토글 (EIP-1193 호환 모드)
- **Auto-lock Timeout**: 분 단위 입력

## 데이터 흐름

```
Hooks:
  - useWalletStore: networks, selectedChainId, selectedAccount, accounts,
    selectNetwork, lockWallet, importPrivateKey, addNetwork, removeNetwork,
    updateNetwork, syncWithBackground
  - useTranslation: 'settings', 'common'

Network 관리:
  - addNetwork(networkForm) -> chrome.runtime.sendMessage
  - removeNetwork(chainId)
  - updateNetwork(chainId, updatedData)

Connected Sites:
  - chrome.runtime.sendMessage({ type: 'GET_CONNECTED_SITES' })
  - chrome.runtime.sendMessage({ type: 'REVOKE_SITE_PERMISSION', payload: { origin } })

MetaMask Mode:
  - chrome.runtime.sendMessage({ type: 'SET_METAMASK_MODE', payload: { enabled } })

Auto-lock:
  - chrome.runtime.sendMessage({ type: 'SET_AUTO_LOCK_TIMEOUT', payload: { minutes } })

Settings 로드:
  - mount 시 GET_SETTINGS -> metaMaskMode, autoLockMinutes

Export Key:
  - chrome.runtime.sendMessage({ type: 'EXPORT_PRIVATE_KEY', payload: { password } })

Ledger:
  - chrome.runtime.sendMessage({ type: 'CONNECT_LEDGER' })
  - chrome.runtime.sendMessage({ type: 'DISCOVER_LEDGER_ACCOUNTS' })
  - chrome.runtime.sendMessage({ type: 'IMPORT_LEDGER_ACCOUNTS', payload: { accounts } })
```

## Issue Checklist

- [x] Settings 파일이 매우 큼 (~800줄+) - 분리 필요할 수 있음 → NOTE: 현재 2034줄, 향후 섹션별 컴포넌트 분리 필요 (NetworkSettings, LedgerSettings, SmartAccountSettings 등)
- [x] Network 삭제 확인 대화상자 존재 여부 → OK: `confirm(t('removeNetworkConfirm'))` 구현됨
- [x] Export Private Key: 비밀번호 검증 후 key 노출 시 보안 경고 → OK: `exportKeyWarning` ("Never share your private key...") 표시 후 export. wallet unlock 상태에서만 접근 가능
- [x] Ledger 연결: WebHID/WebUSB API 브라우저 호환성 → OK: UI는 chrome.runtime.sendMessage만 사용, WebHID/USB는 background에서 처리
- [x] MetaMask Mode 토글: 실제 동작 확인 → OK: `SET_METAMASK_MODE` + `chrome.storage.local` 연동 + 에러 시 revert
- [x] Auto-lock timeout: 값 범위 검증 → OK: select 기반 고정 옵션 (1/5/15/30/60/0분), 자유 입력 없음
- [x] Import Networks from File: 파일 포맷 검증 → OK: JSON 파싱, 배열/객체 포맷 분기, 필수 필드(name/chainId/rpcUrl) 검증, 결과 리포트
- [x] Connected Sites: 권한 해제 후 UI 즉시 반영 → OK: disconnect 후 `loadConnectedSites()` 재호출
- [x] Root Validator 변경 기능 구현 완성도 → OK: 주소 형식 검증 + `stablenet_setRootValidator` RPC + SA info 갱신 + 에러/성공 피드백
- [x] Language 변경 시 즉시 반영 → OK: `changeLanguage()` → `i18n.changeLanguage()` → React 자동 리렌더
- [x] `isSmartAccount` 체크가 `type === 'smart'`만 포함 → **수정 완료**: `type !== 'eoa'`로 변경하여 delegated 계정에서도 SA Settings 섹션 표시

### 수정 내역 (2026-03-11)
1. `Settings.tsx`: `isSmartAccount` 조건을 `type === 'smart'` → `type !== 'eoa'`로 변경 (delegated 계정 지원)
