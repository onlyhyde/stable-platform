# Smart Account 트랜잭션 분석 및 가스 결제 옵션 구현 계획

> 작성일: 2026-03-04
> 대상: `apps/web/` 전수 조사 결과

---

## 1. 현황 요약

### 1.1 핵심 문제

Smart Account(EIP-7702 + Kernel v3)가 설정된 지갑에서 **모든 트랜잭션이 실패**하며, 가스 결제 옵션이 UI에 완전히 누락되어 있다.

| 구분 | 상태 | 영향도 |
|------|------|--------|
| Smart Account TX 전송 | **전부 실패 (AA24)** | CRITICAL |
| 가스 결제 모드 선택 UI | **미구현** | HIGH |
| usePaymaster 훅 연동 | **Send 페이지 미연결** | HIGH |
| EntryPoint Deposit 관리 | **미구현** | MEDIUM |
| ERC-20 토큰 가스 결제 | **미구현** | MEDIUM |
| 가스 비용 추정 표시 | **하드코딩** | LOW |

### 1.2 AA24 근본 원인 (해결됨)

`wallet_delegateAccount` 핸들러에서 EIP-7702 delegation 트랜잭션을 보낼 때 `data: '0x'`(빈 데이터)로 전송하여, Kernel 컨트랙트 코드만 설정하고 `initialize()`를 호출하지 않았다.

**결과**:
- `rootValidator = 0x0000000000000000000000000000000000000000` (미설정)
- ECDSA Validator의 owner = zero address
- EntryPoint가 `validateUserOp` 호출 시 서명 검증 실패 → `AA24 signature error`

**수정**: `handler.ts`에 `encodeKernelInitialize()` 헬퍼를 추가하여, delegation 트랜잭션의 `data` 필드에 Kernel 초기화 calldata를 포함시켰다.

---

## 2. 코드 분석 결과

### 2.1 `useSmartAccount.ts` — 하드코딩된 주소

```typescript
// 문제: Anvil devnet 주소가 하드코딩됨 (StableNet Local chain 8283과 불일치)
const DEFAULT_KERNEL_IMPLEMENTATION = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
const ECDSA_VALIDATOR = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
const KERNEL_FACTORY = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
const ENTRY_POINT = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
```

**실제 StableNet Local (chain 8283) 배포 주소**:
- EntryPoint: `0x2ef7E4897d71647502e2Fe60F707AcD9a110660C`
- Kernel: `0x92458C9920376Ddd0152dbA56888ac60547408E6`
- KernelFactory: `0xA18C1d76de513FEa27127E2508de43AdC0820a72`
- ECDSA Validator: `0xFaf73bf2E642ADD50cf9d9853C44553ECCdFC670`

**해결 방안**: `@stablenet/contracts`의 `getChainAddresses(chainId)`를 사용하여 동적으로 해석.

### 2.2 `usePaymaster.ts` — 구현 완료, 미연결

이 훅은 ERC-7677 호환 Paymaster 통합을 완전히 구현하고 있다:
- `getPaymasterStubData()` — 가스 추정용 stub 데이터
- `getPaymasterData()` — 최종 서명된 데이터
- `checkSponsorshipEligibility()` — 스폰서십 자격 확인
- `getSponsorshipPolicies()` — 정책 목록 조회
- `getPaymasterBalance()` — Paymaster 잔액 조회
- `getSupportedTokens()` — 지원 ERC-20 토큰 목록

**문제**: Send 페이지(`app/payment/send/page.tsx`)에서 `usePaymaster`를 import하지 않는다. `useUserOp`만 사용하며, 가스 결제 옵션을 전달하지 않는다.

### 2.3 `app/payment/send/page.tsx` — 가스 정보 하드코딩

```tsx
// 라인 409-411: 단일 전송 시 가스 정보가 하드코딩
<p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
  Gas fees will be sponsored by the Paymaster
</p>
```

**누락된 기능**:
1. 가스 결제 모드 선택 (Self-pay / ERC-20 / Sponsored)
2. 선택된 모드에 따른 가스 비용 표시
3. Self-pay 시 EntryPoint deposit 잔액 표시
4. ERC-20 결제 시 토큰별 가스 비용 환산
5. Paymaster 훅 연동

### 2.4 `useUserOp.ts` — Paymaster 옵션 미전달

```typescript
// 현재: Paymaster 정보 없이 단순 전송
const txHash = await provider.sendTransaction(
  { from: sender, to: params.to, value: params.value, data: params.data },
  { waitForConfirmation: true }
)
```

**필요**: `gasPaymentMode` 파라미터를 받아서 extension에 전달해야 한다.

### 2.5 `useBatchTransaction.ts` — UserOp/Bundler 미연동

배치 트랜잭션이 `walletClient.sendTransaction()`을 직접 사용하며, Bundler를 통한 UserOp 제출이 아닌 일반 트랜잭션으로 처리된다. Smart Account의 경우 ERC-7579 execute를 self-call로 처리하나, Paymaster 연동이 없다.

---

## 3. ERC-4337 가스 결제 모드 (스펙 기반)

ERC-4337 스펙에 따르면, UserOperation의 가스 비용은 3가지 방식으로 처리 가능:

### 3.1 Mode A: Self-Pay (Native Coin via EntryPoint Deposit)

```
사용자 → EntryPoint.depositTo(sender) → 잔액 적립
UserOp 실행 시 → EntryPoint가 sender의 deposit에서 가스 비용 차감
paymasterAndData = empty (0x)
```

**요구사항**:
- 사용자의 EntryPoint deposit 잔액이 `maxFeePerGas * (callGasLimit + verificationGasLimit + preVerificationGas)` 이상
- UI에서 deposit 잔액 조회 및 추가 입금 기능 필요

### 3.2 Mode B: ERC-20 Token via Paymaster

```
1. DApp → pm_getPaymasterStubData(userOp) → stub paymasterData
2. DApp → eth_estimateUserOperationGas(userOp with stub) → gas limits
3. DApp → pm_getPaymasterData(userOp with gas) → final paymasterData + signature
4. User signs UserOp → eth_sendUserOperation
5. EntryPoint → validatePaymasterUserOp → context + validationData
6. EntryPoint → execute callData
7. EntryPoint → postOp → Paymaster가 user의 ERC-20 토큰에서 가스 비용 회수
```

**요구사항**:
- 사용자가 ERC-20 토큰을 Paymaster 컨트랙트에 approve
- UI에서 지원 토큰 목록, 토큰별 가스 비용 환산, approve 상태 표시

### 3.3 Mode C: Sponsored (Third-Party Pays)

```
1. DApp → pm_getPaymasterStubData(userOp, policyId)
2. DApp → pm_getPaymasterData(userOp, policyId)
3. Paymaster가 자체 deposit에서 가스 비용 지불
4. 사용자는 가스 비용 0
```

**요구사항**:
- 스폰서십 정책(policy) 선택 UI
- 자격 확인(eligibility check)
- 스폰서 한도 표시

---

## 4. Atomic Feature 목록

### P0 — Smart Account TX 정상화 (즉시 수정)

#### F-01: `useSmartAccount` 동적 컨트랙트 주소 해석

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/hooks/useSmartAccount.ts` |
| **변경** | 하드코딩된 Anvil 주소 → `@stablenet/contracts`의 `getChainAddresses(chainId)` 사용 |
| **의존성** | `@stablenet/contracts` 패키지 |
| **수용 기준** | chainId에 따라 올바른 주소 반환, 미지원 체인 시 fallback 동작 |

**테스트 케이스** (RED):
- `getContractAddresses(8283)` → StableNet Local 주소 반환
- `getContractAddresses(31337)` → Anvil 주소 반환 (fallback)
- `getContractAddresses(99999)` → 미지원 체인 시 기본값 또는 에러

---

### P1 — 가스 결제 모드 선택

#### F-02: `useGasPaymentMode` 훅

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/hooks/useGasPaymentMode.ts` (신규) |
| **역할** | 가스 결제 모드(self-pay/erc20/sponsored) 상태 관리 |
| **의존성** | `usePaymaster`, `useSmartAccount` |
| **수용 기준** | 모드 전환 시 관련 데이터 자동 갱신, Smart Account 아닌 경우 self-pay만 허용 |

**테스트 케이스** (RED):
- 초기 모드 = `sponsored` (기본값)
- EOA 지갑일 때 `erc20`, `sponsored` 모드 비활성화
- 모드 변경 시 `selectedMode` 상태 업데이트
- `self-pay` 선택 시 EntryPoint deposit 잔액 자동 조회

#### F-03: `GasPaymentSelector` UI 컴포넌트

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/components/payment/GasPaymentSelector.tsx` (신규) |
| **역할** | 3가지 가스 결제 모드를 시각적으로 선택하는 UI |
| **의존성** | `useGasPaymentMode` |
| **수용 기준** | 각 모드별 설명 표시, 비활성화 모드 grayed-out, 선택 시 콜백 |

**테스트 케이스** (RED):
- 3개 옵션 렌더링: Self-Pay, Pay with Token, Sponsored
- Smart Account 미설정 시 Self-Pay만 활성화
- 클릭 시 `onModeChange` 콜백 호출
- 선택된 모드 하이라이트

---

### P2 — EntryPoint Deposit 관리

#### F-04: `useEntryPointDeposit` 훅

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/hooks/useEntryPointDeposit.ts` (신규) |
| **역할** | sender의 EntryPoint deposit 잔액 조회 |
| **의존성** | `@stablenet/contracts` (EntryPoint ABI + 주소) |
| **수용 기준** | `balanceOf(sender)` 결과를 bigint로 반환, 주기적 갱신 |

**테스트 케이스** (RED):
- `getDeposit(sender)` 호출 시 EntryPoint `balanceOf` 실행
- 잔액을 ETH 단위로 포맷팅
- 에러 시 `null` 반환 + error 상태 설정

---

### P3 — ERC-20 토큰 가스 결제

#### F-05: ERC-20 토큰 가스 비용 추정 표시

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/hooks/useGasPaymentMode.ts` 확장 |
| **역할** | ERC-20 모드 선택 시 토큰별 가스 비용 환산 표시 |
| **의존성** | `usePaymaster.getSupportedTokens()`, Paymaster proxy의 `pm_estimateTokenPayment` |
| **수용 기준** | 지원 토큰 목록 표시, 선택 토큰에 대한 예상 비용 표시 |

**테스트 케이스** (RED):
- `getSupportedTokens()` 호출 시 토큰 목록 반환
- 토큰 선택 시 예상 가스 비용(토큰 단위) 계산
- Paymaster 서비스 불가 시 graceful fallback

---

## 5. 구현 순서 (TDD RED→GREEN)

```
F-01 (P0) → F-02 (P1) → F-04 (P2) → F-03 (P1) → F-05 (P3)
  │              │            │            │           │
  ├─ RED: 테스트  ├─ RED       ├─ RED       ├─ RED      ├─ RED
  └─ GREEN: 구현  └─ GREEN     └─ GREEN     └─ GREEN    └─ GREEN
```

**F-01**은 기존 코드 수정이므로 먼저 처리. **F-02**와 **F-04**는 훅이므로 UI 없이 독립 구현 가능. **F-03**은 F-02에 의존. **F-05**는 F-02+F-04 위에 구축.

---

## 6. 스펙 준수 참조

### ERC-4337 v0.7+ (EntryPoint v0.7)
- `UserOperation.paymasterAndData` 포맷: `paymaster(20B) + verifyGasLimit(16B) + postOpGasLimit(16B) + paymasterData(variable)`
- `validationData` 패킹: `authorizer(20B) + validUntil(6B) + validAfter(6B)`
- Unused gas penalty: callGasLimit와 paymasterPostOpGasLimit 각각에 10% 패널티

### ERC-7579 (Kernel v3)
- Module Type: 1=Validator, 2=Executor, 3=Fallback, 4=Hook
- Execute mode: `bytes32` encoding (callType + execType + modeSelector + modePayload)
- Single call encoding: `abi.encodePacked(target, value, callData)`
- Batch call encoding: `abi.encode(Execution[])`

### ERC-7677 (Paymaster RPC)
- `pm_getPaymasterStubData` → 가스 추정용
- `pm_getPaymasterData` → 최종 서명 데이터
- Two-stage flow: stub → estimate → final → sign → submit
