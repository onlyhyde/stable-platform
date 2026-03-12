# 04. Smart Account

**Source**: `app/smart-account/page.tsx`
**Route**: `/smart-account`

## 기능
- EIP-7702 Smart Account 업그레이드/다운그레이드
- Private Key 또는 StableNet Wallet 서명
- 보안 키 저장 (XOR 암호화, 60초 자동 삭제)
- Authorization 이력
- EOA vs Smart Account 기능 비교

## UI 구성

### 1. InfoBanner
- EIP-7702 개념 설명

### 2. AccountStatusCard
- 연결 상태 + Smart Account 여부

### 3. SigningMethodCard
- Radio: `privateKey` | `stablenet`

### 4. PrivateKeyCard (privateKey 모드)
- Private key 입력 (보안 input)
- Anvil 계정 auto-fill 버튼

### 5. UpgradeCard / RevokeCard
- UpgradeCard: delegate 선택 dropdown + Upgrade 버튼
- RevokeCard: Revoke 버튼 (이미 Smart Account인 경우)

### 6. 하단 카드
- AuthorizationDetailsCard: 마지막 EIP-7702 authorization
- FeatureComparisonCard: EOA vs Smart Account 비교 테이블
- ContractAddressesCard: 계약 주소 참조

## 데이터 흐름

```
Hooks:
  - useWallet() → wallet connection, connectors
  - useSmartAccount() → status, contracts, anvilAccounts
    - upgradeToSmartAccount(key, delegate)
    - revokeSmartAccount(key)
    - upgradeWithStableNet(delegate)
    - revokeWithStableNet()

Secure Storage:
  - secureKeyStore: XOR 암호화, auto-clear 60초
  - store() → retrieveAndClear() → clear()
  - React state에 저장하지 않음 (DevTools 노출 방지)

State:
  - signingMethod: 'privateKey' | 'stablenet'
  - selectedDelegate: Address
  - hasPrivateKey: boolean (UI flag only)
```

## Issue Checklist

- [x] `retrieveAndClear()` 반환값 null 체크 없이 `setHasPrivateKey(false)` 호출 — key 회수 실패 시 상태 불일치. null 체크 후 `setHasPrivateKey(false)` + 에러 toast 표시
- [x] `selectedDelegate`가 `getDelegatePresets()`와 `contracts.defaultKernelImplementation` 모두 없으면 undefined — hardcoded 31337 제거, chainId 기반 useEffect 동기화
- [x] 성공 후 `lastAuthorization`, `lastTxHash`가 영구 유지 — `clearLastTransaction()` 메서드 추가, 각 operation 시작 시 호출
- [x] `selectedDelegate` null 검증 없이 `upgradeWithStableNet()` 호출 가능 — handleUpgrade에 null guard + 에러 toast 추가
- [x] delegated address 를 full 로 정확하게 표기 — ContractAddressesCard에서 full address 표시 + 반응형 레이아웃 적용
- [x] smart account invoke 기능으로 smart account 상태 원복 모드 지원 — re-delegation 모드 추가 (RevokeCard에 "Change Delegate" 버튼, UpgradeCard에 re-delegation UI)
