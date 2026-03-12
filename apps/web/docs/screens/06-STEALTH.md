# 06. Stealth

## 06-A. Stealth Hub

**Source**: `app/stealth/page.tsx`
**Route**: `/stealth`

### UI 구성
- PageHeader + StealthInfoBanner
- StealthNavigationCards (Send, Receive)
- HowItWorksCard (작동 방식 설명)
- StealthStatsCards (연결 시만): 고유 주소 수, 수신 건수, 총 ETH 수신액

### 데이터 흐름
```
Hooks:
  - useWallet() → isConnected
  - useStealth() → announcements[]
Computed (useMemo):
  - uniqueAddresses = new Set(announcements.map(a => a.stealthAddress)).size
  - totalReceived = formatEther(sum of values)
```

### Issue Checklist

- [v] `formatEther(totalWei)` — BigInt 변환 실패 시 에러 throw. try-catch 필요
- [v] 주소 Set 대소문자 민감 — 같은 주소의 checksum 차이로 중복 카운트 가능
- [v] stats가 Receive 페이지 Scan 후 업데이트 안됨 — useStealth 데이터 갱신 메커니즘 없음

---

## 06-B. Stealth Send

**Source**: `app/stealth/send/page.tsx`
**Route**: `/stealth/send`

### Flow
```
Input Meta-Address + Amount -> Generate Stealth Address -> Send -> Auto-redirect (2초)
```

### UI 구성
- ConnectWalletCard (미연결)
- StealthTransferCard:
  - Stealth meta-address 입력 (`st:eth:...` 형식)
  - Amount 입력 + 잔고 표시
  - Generated stealth address 표시
  - Generate / Send / Cancel 버튼
  - txHash 표시 (성공 시)

### 데이터 흐름
```
Hooks:
  - useWallet() → address, isConnected
  - useBalance() → balance, decimals, symbol
  - useStealth() → generateStealthAddress(), sendToStealthAddress()

State:
  - stealthMetaAddress, amount, generatedAddress, ephemeralPubKey
  - txHash, isSending

Validation:
  - canGenerate = startsWith('st:eth:') && amount > 0 && isConnected
```

### Issue Checklist

- [v] meta-address 형식 검증 부족 — `startsWith('st:eth:')` 만 체크. 길이/구조 미검증
- [v] amount > 0 검증만, 잔고 초과 체크 없음 — 전송 실패 가능
- [v] `parseUnits()` try-catch 없음 — 잘못된 소수점 입력 시 uncaught error
- [v] catch 블록에서 `if (!error)` — error 변수 혼동 (catch의 err vs hook의 error). 로직 반전
- [v] `navTimerRef` — 컴포넌트 언마운트 시 타이머 미정리. memory leak + 지연 네비게이션
- [v] `ephemeralPubKey` `Hex` 캐스팅 검증 없음 — API가 잘못된 데이터 반환 시 타입 안전성 위반

---

## 06-C. Stealth Receive

**Source**: `app/stealth/receive/page.tsx`
**Route**: `/stealth/receive`

### Flow
```
Register Meta-Address -> Derive Keys (서명) -> Scan Announcements -> Withdraw
```

### UI 구성
- StealthMetaAddressCard: 등록된 meta-address + Register 버튼
- Stealth Keys Card:
  - 잠김: "Unlock Stealth Keys" 서명 버튼
  - 해제: Ready 상태 표시
- IncomingPaymentsCard: announcement 목록 + Scan/Withdraw 버튼
- Error card

### 키 유도
```typescript
const message = "Generate StableNet Stealth Keys v1"
const sig = await signMessageAsync({ message })
const spendingKey = keccak256(sig + '0x00')
const viewingKey  = keccak256(sig + '0x01')
```

### 데이터 흐름
```
Hooks:
  - useStealth() → registerStealthMetaAddress(), scanForAnnouncements(), withdrawFromStealthAddress()
  - useSignMessage() → signMessageAsync()

State:
  - isRegistering, isScanning, isDeriving
  - stealthKeys: { spending: Hex, viewing: Hex } | null
```

### Issue Checklist

- [v] **보안**: stealth keys가 React state에 저장 — DevTools에서 노출, XSS 취약. Smart Account 페이지의 SecureKeyStore 패턴 적용 필요
- [v] `useStealth()` 빈 config — registerStealthMetaAddress() 호출 시 필수 콜백 미제공. 등록 항상 실패
- [v] `handleRegister()` 파라미터 미전달 — hook이 콜백 함수를 config에서 기대하지만 미제공
- [v] `handleWithdraw()` keys와 announcement 매칭 검증 없음 — 잘못된 키로 인출 시도 가능
- [v] stealth keys 언마운트/네비게이션 시 미초기화 — 메모리에 영구 유지
- [v] keys가 32바이트 유효성 검증 없음 — 잘못된 길이 키 허용
