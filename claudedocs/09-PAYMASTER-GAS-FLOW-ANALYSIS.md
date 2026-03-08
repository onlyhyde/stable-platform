# Paymaster Gas Flow 종합 분석 보고서

> **분석 대상**: bundler, paymaster-proxy, wallet-extension, web app
> **기준 문서**: `docs/claude/seminar-final/08-real-use-cases-and-architecture-mapping.md` (Use Case A-D)
> **분석일**: 2026-03-09

---

## 1. 요약

Web app의 Send 페이지에서 paymaster를 선택해도 **실제 UserOperation이 생성되지 않고 일반 EOA 트랜잭션(`eth_sendTransaction`)으로 처리**되는 것이 모든 가스 에러의 근본 원인이다.

wallet-extension의 `sponsorAndSign` 함수에 ERC-7677 4단계 플로우가 올바르게 구현되어 있으나, web app에서 이 경로를 호출하지 않는다. ERC-20 토큰 결제와 Permit2 플로우는 UI 수준에서 끊어져 있고, extension의 RPC 스텁 핸들러가 하드코딩 응답을 반환한다.

**영향 범위**:
- Use Case A (Sponsor): paymaster 무시됨 → native=0 유저 가스 부족
- Use Case B (Self-Pay): UserOp 대신 일반 트랜잭션 → EntryPoint deposit 미사용
- Use Case C (ERC-20): 토큰 목록 비어있음 + permit 서명 미전달 + approve 미구현
- Use Case D (Module): module install 시 paymaster UI 미연결

---

## 2. 아키텍처 현황

### 2.1 현재 Web App Send Flow (문제)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ PaymasterSelector│     │  useUserOp        │     │ Extension           │
│  (선택값 존재)    │──X──│  sendTransaction  │────▶│  eth_sendTransaction│
│  submission 미전달│     │  (EOA 경로)       │     │  (일반 L1 트랜잭션)  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                         paymaster 정보 누락        UserOp 미생성
```

- `useUserOp.sendTransaction` → `provider.sendTransaction` → Extension의 `eth_sendTransaction`
- `eth_sendTransaction`는 일반 EOA 핸들러 — UserOp 생성, paymaster 호출 모두 없음
- `PaymasterSelector`에서 선택한 모드/토큰 정보가 `handleSend`에 전달되지 않음

### 2.2 필요한 Web App Send Flow (목표)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ PaymasterSelector│     │  useUserOp        │     │ Extension           │
│  모드 + 토큰     │────▶│  sendUserOp       │────▶│  eth_sendUserOp     │
│  + permit sig    │     │  gasPayment 포함   │     │  sponsorAndSign     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                         paymaster context 포함     ERC-7677 4단계 실행
```

### 2.3 Extension 내부 ERC-7677 플로우 (이미 구현됨)

```
sponsorAndSign (paymaster.ts:186)
├── Step 1: pm_getPaymasterStubData → stub paymaster + gas limits
├── Step 2: bundler.estimateUserOperationGas (stub 포함)
│            └── verificationGasLimit, callGasLimit에 20% 버퍼 추가
├── Step 3: pm_getPaymasterData → 최종 서명된 paymasterData
│            └── isFinal=true면 스킵
└── Step 4: UserOp 서명 (EIP-712)
```

---

## 3. Use Case별 검증 결과

### 3.1 Use Case A: Sponsor Gas (native=0 유저)

**세미나 스펙**: pm_getPaymasterStubData → gas estimation → pm_getPaymasterData → submit

| 구간 | 파일 | 상태 | 상세 |
|------|------|------|------|
| Paymaster-proxy stub 핸들러 | `paymaster-proxy/src/handlers/getPaymasterStubData.ts` | ✅ 구현됨 | verifying/sponsor 타입 stub 생성, 동적 gas limit 계산, zero-filled stub 서명 |
| Paymaster-proxy data 핸들러 | `paymaster-proxy/src/handlers/getPaymasterData.ts` | ✅ 구현됨 | ECDSA 서명, policy checkAndReserve, settlement tracking |
| Bundler gas estimation | `bundler/src/gas/gasEstimator.ts` | ✅ 구현됨 | binary search 기반, paymaster gas 별도 estimation |
| Bundler UserOp 검증 | `bundler/src/validation/validator.ts` | ✅ 구현됨 | 6단계 검증 (format → reputation → state → simulation → result → opcode) |
| Extension `sponsorAndSign` | `wallet-extension/src/background/rpc/paymaster.ts:186` | ✅ 구현됨 | ERC-7677 4단계 완전 구현 |
| Extension `eth_sendUserOperation` | `wallet-extension/src/background/rpc/handler.ts:1291` | ✅ 구현됨 | sponsor 타입 감지 → `sponsorAndSign` 호출 |
| **Web app Send → UserOp** | `web/hooks/useUserOp.ts` | ❌ 끊어짐 | `eth_sendTransaction`으로 라우팅, UserOp 미생성 |
| **Web app paymaster 선택 전달** | `web/app/payment/send/page.tsx` | ❌ 끊어짐 | 선택값이 submission에 미전달 |

**결론**: Backend(bundler + proxy + extension)는 완전히 구현됨. **Web app → Extension 연결만 수정하면 동작**.

### 3.2 Use Case B: Self-Pay (EntryPoint deposit)

**세미나 스펙**: 사용자가 EntryPoint에 deposit → paymaster 없이 UserOp 전송

| 구간 | 파일 | 상태 | 상세 |
|------|------|------|------|
| Extension self-pay 경로 | `handler.ts:1570` | ✅ 구현됨 | paymaster 없이 bundler estimation → 서명 → submit |
| Bundler deposit 검증 | `validator.ts:263` | ✅ 구현됨 | sender deposit ≥ max_gas_cost 확인 |
| Web app deposit 조회 | `web/hooks/useEntryPointDeposit.ts` | ✅ 구현됨 | `balanceOf` 쿼리 |
| **Web app deposit top-up** | `web/app/payment/send/page.tsx` | ⚠️ 버그 | plain ETH 전송, `depositTo()` ABI 미호출 |
| **Web app → UserOp 라우팅** | `web/hooks/useUserOp.ts` | ❌ 끊어짐 | EOA 트랜잭션으로 처리 |

**결론**: Extension 내부 경로는 동작하나, Web app에서 UserOp 경로를 타지 않음. Deposit top-up은 `depositTo()` ABI 호출로 수정 필요.

### 3.3 Use Case C: ERC-20 Token Payment (postOp settlement)

**세미나 스펙**: approve/permit2 → stub → estimation → data(token context) → submit → postOp transferFrom

| 구간 | 파일 | 상태 | 상세 |
|------|------|------|------|
| Proxy ERC-20 stub/data | `getPaymasterStubData.ts:284`, `getPaymasterData.ts:242` | ✅ 구현됨 | oracle 기반 검증, envelope 인코딩 |
| Proxy token estimation | `estimateTokenPayment.ts` | ✅ 구현됨 | on-chain `calculateTokenAmount` |
| Proxy Permit2 핸들러 | `getPaymasterData.ts:314` | ✅ 구현됨 | permitSig context에서 envelope 빌드 |
| Extension `sponsorAndSign` | `paymaster.ts:186` | ✅ 구현됨 | erc20/permit2 context 전달 |
| **Extension `pm_supportedTokens`** | `handler.ts:4224` | ❌ 스텁 | native token(zero address)만 반환, ERC-20 미포함 |
| **Extension `pm_estimateERC20`** | `handler.ts:4298` | ❌ 스텁 | 항상 `{ supported: false }` 반환 |
| **Web app Permit2 서명 전달** | `usePermit2Approval.ts` | ❌ 끊어짐 | 서명을 React state에만 저장, submission 미전달 |
| **Web app token approve** | - | ❌ 미구현 | on-chain `approve()` 트랜잭션 없음 |
| Proxy `exchangeRate` 반환 | `estimateTokenPayment.ts:83` | ⚠️ 버그 | 항상 `'0'` 반환 |

**결론**: Proxy 측 구현 완료. Extension RPC 스텁 2개 수정 + Web app approve/permit2 연결 필요.

### 3.4 Use Case D: 7579 Module + AI Agent Automation

| 구간 | 파일 | 상태 | 상세 |
|------|------|------|------|
| Extension module install | `handler.ts` (`stablenet_installModule`) | ✅ 구현됨 | `sponsorAndSign` 사용 |
| Proxy 리스크 스코어링 | `riskScorer.ts` | ✅ 구현됨 | module 셀렉터 감지, 고위험 차단 |
| Proxy sponsor policy | `sponsorPolicy.ts` | ✅ 구현됨 | TOCTOU-safe `checkAndReserve` |
| **Web app module 설치 시 paymaster UI** | - | ❌ 미연결 | 모듈 설치에 paymaster 선택 없음 |

---

## 4. 버그 목록

### 4.1 🔴 Critical (서비스 불가)

| ID | 위치 | 설명 | 영향 |
|----|------|------|------|
| **C1** | `web/hooks/useUserOp.ts` | `provider.sendTransaction` → `eth_sendTransaction` 라우팅. UserOp 미생성 | 모든 Use Case에서 paymaster 무시 |
| **C2** | `web/app/payment/send/page.tsx` | `PaymasterSelector` 선택값이 `handleSend`에 전달되지 않음 | 가스 모드 선택이 무의미 |
| **C3** | `wallet-extension/src/background/rpc/handler.ts:4298` | `pm_estimateERC20` 항상 `{ supported: false }` 하드코딩 | ERC-20 가스 비용 미리보기 불가 |
| **C4** | `wallet-extension/src/background/rpc/handler.ts:4224` | `pm_supportedTokens` native token만 반환 | ERC-20 옵션 목록 항상 비어있음 |
| **C5** | `web/hooks/usePermit2Approval.ts` | `permitSignature`가 submission에 전달되지 않음 | Permit2 flow 완전 끊어짐 |

### 4.2 🟡 Important (기능 저하)

| ID | 위치 | 설명 | 영향 |
|----|------|------|------|
| **I1** | `handler.ts:3879` | `stablenet_estimateGas`에서 paymaster stub 미포함한 partial UserOp 사용 | 스폰서 모드 가스 미리보기가 실제보다 낮게 표시 |
| **I2** | `handler.ts:4283` | `pm_sponsorPolicy` 하드코딩 응답 (`maxGas: 0.0001`, `dailyLimit: 0.1`) | SponsorInfo에 잘못된 정책 데이터 표시 |
| **I3** | `paymaster.ts:252` | `preVerificationGas`에 버퍼 0% (verification/call은 20%) | 비대칭 버퍼링으로 preVerification 과소 추정 가능 |
| **I4** | `estimateTokenPayment.ts:83` | `exchangeRate` 항상 `'0'` 반환 | 토큰 환율 정보 미표시 |
| **I5** | `getPaymasterData.ts:191` | envelope `nonce` 항상 `0n` | 동시 요청 시 nonce 충돌 가능 |
| **I6** | `send/page.tsx` (`handleDepositTopUp`) | EntryPoint `depositTo()` 대신 plain ETH 전송 | Deposit top-up 미작동 |
| **I7** | `gasEstimator.ts:393` | `FailedOp` 에러를 "gas sufficient"로 분류 | stub data로 estimation 시 서명 실패가 성공으로 오판 → 가스 과소 추정 |

### 4.3 🟢 Minor (코드 품질)

| ID | 위치 | 설명 |
|----|------|------|
| **M1** | Bundler | `packForContract` 로직 3중 중복 (`packUserOp.ts`, `simulationValidator.ts`, `validator.ts`) |
| **M2** | Proxy | v0.9 parallel signing format 코덱 존재하나 미사용 |
| **M3** | Proxy `sponsorPolicy.ts:37` | `pm_getSponsorPolicy`가 항상 'default' 정책만 조회 |
| **M4** | Extension | `MultiModeTransactionController`가 메인 Send flow에 미연결 (병렬 구현 존재) |
| **M5** | Proxy `constants.ts:266` | `FLAGS_BLOCK_NUMBER_MODE` 정의됨, TODO, 미사용 |

---

## 5. UI 개선 사항

### 5.1 Send 페이지 — 가스 모드 → Submission 연결

**현재**: `PaymasterSelector`에서 모드를 선택해도 `handleSend`에 전달되지 않음
**필요**: 선택된 `gasPaymentMode`, `selectedToken`, `permitSignature`를 `useUserOp`의 submission context로 전달

```typescript
// 목표 인터페이스
interface SendWithPaymaster {
  to: Address
  value: bigint
  gasPayment: {
    type: 'none' | 'sponsor' | 'erc20' | 'permit2'
    tokenAddress?: Address
    permitSignature?: Hex
    maxTokenCost?: bigint
  }
}
```

### 5.2 ERC-20 토큰 선택 UI

**현재**: 토큰 목록이 항상 비어있음 (`pm_supportedTokens` 스텁)
**필요**:
- paymaster-proxy의 `pm_supportedTokens`를 실제 호출하여 ERC-20 토큰 목록 표시
- 토큰별 환율 표시 (현재 `exchangeRate: '0'` → on-chain oracle 값 표시)
- 토큰 잔액 확인 및 부족 시 경고 표시
- 예상 토큰 소비량 표시 (`pm_estimateTokenPayment` 결과)

### 5.3 Token Approval 플로우

**현재**: approve/permit 없이 submission 시도 → postOp에서 allowance 부족 revert
**필요**:
- **ERC-20 모드**: `approve(paymaster, maxTokenCost)` 트랜잭션 서명 UI
  - 현재 allowance 확인 → 부족 시 approve 요청 → 승인 후 submit 활성화
- **Permit2 모드**: `usePermit2Approval` 서명 → paymaster context에 `permitSig` 포함
  - 서명 상태 표시 (needed → signing → signed)
  - 서명 만료 시간 표시

### 5.4 가스 미리보기 정확도

**현재**: `stablenet_estimateGas`가 paymaster stub 없는 partial UserOp으로 estimation → 스폰서 모드에서 과소 표시
**필요**:
- 스폰서 모드: stub data 포함한 estimation으로 정확한 총 가스 표시
- ERC-20 모드: ETH 가스 비용 대신 토큰 수량으로 표시
- self-pay 모드: EntryPoint deposit 잔액과 예상 가스 비교 표시

### 5.5 EntryPoint Deposit 관리

**현재**: `handleDepositTopUp`이 plain ETH 전송 (EntryPoint에 deposit되지 않음)
**필요**:
- EntryPoint `depositTo(sender)` ABI 호출로 수정
- 현재 deposit 잔액 표시
- 예상 소요 가스와 deposit 잔액 비교 UI
- deposit 부족 시 필요 금액 계산 및 top-up 제안

### 5.6 에러 핸들링 UI

**현재**: 에러 시 raw 메시지 표시
**필요**: AA 에러 코드별 사용자 친화적 메시지

| 에러 코드 | 의미 | 사용자 메시지 |
|-----------|------|--------------|
| AA21 | prefund 부족 | "가스 비용을 충당할 잔액이 부족합니다. EntryPoint에 deposit을 추가하세요." |
| AA23 | validation revert | "트랜잭션 검증에 실패했습니다. 입력값을 확인하세요." |
| AA25 | invalid nonce | "트랜잭션 순서 오류입니다. 페이지를 새로고침하세요." |
| AA33 | paymaster revert | "가스 대납 서비스에서 거절되었습니다. 다른 결제 방식을 선택하세요." |
| AA34 | paymaster signature | "가스 대납 서명 검증에 실패했습니다." |

### 5.7 Paymaster Health & Policy 표시

**현재**: `pm_sponsorPolicy` 하드코딩 응답, health check 30초 폴링
**필요**:
- paymaster-proxy의 실제 `pm_getSponsorPolicy` 응답 사용
- 일일 한도 잔여량, 건당 한도 실시간 표시
- paymaster offline 시 sponsor/erc20 옵션 비활성화 + 안내 메시지

---

## 6. 서비스별 상세 분석

### 6.1 Bundler (`services/bundler/`)

**핵심 파일**:
- `src/rpc/server.ts` — JSON-RPC 엔드포인트, method dispatch
- `src/gas/gasEstimator.ts` — binary search 기반 gas estimation
- `src/validation/validator.ts` — 6단계 검증 파이프라인
- `src/executor/bundleExecutor.ts` — 번들 실행, 실패 진단
- `src/shared/packUserOp.ts` — PackedUserOperation 인코딩

**구현 상태**: 대부분 완전 구현

**주요 특성**:
- EntryPoint v0.7 PackedUserOperation 포맷 지원
- `accountGasLimits` = pad16(verificationGasLimit) || pad16(callGasLimit)
- `gasFees` = pad16(maxPriorityFeePerGas) || pad16(maxFeePerGas)
- `paymasterAndData` = paymaster(20B) || pad16(pvgl) || pad16(ppgl) || paymasterData
- paymaster gas estimation: `binarySearchPaymasterVerificationGas`, `binarySearchPaymasterPostOpGas`
- fallback estimation: 300k(verification), 200k(call) — 시뮬레이션 실패 시

**이슈**:
- `FailedOp` 에러를 binary search에서 "gas sufficient"로 분류 (I7) — stub data의 zero-signature로 인한 `FailedOp`가 성공으로 오판될 수 있음
- `packForContract` 3중 중복 (M1)
- ERC-7562 storage access 규칙 미완전 적용

### 6.2 Paymaster-Proxy (`services/paymaster-proxy/`)

**핵심 파일**:
- `src/handlers/getPaymasterStubData.ts` — stub 핸들러 (4개 타입)
- `src/handlers/getPaymasterData.ts` — 서명 핸들러
- `src/signer/paymasterSigner.ts` — ECDSA/ERC-1271 서명
- `src/policy/sponsorPolicy.ts` — 정책 관리, TOCTOU-safe reservation
- `src/policy/riskScorer.ts` — 4-factor 리스크 스코어링
- `src/settlement/settlementWorker.ts` — 영수증 기반 정산

**구현 상태**: 거의 완전 구현

**paymasterData 인코딩 형식**:
```
[version: 1B = 0x01]
[type: 1B]         0=verifying, 1=sponsor, 2=erc20, 3=permit2
[flags: 1B]
[validUntil: 6B]   unix timestamp (seconds)
[validAfter: 6B]
[nonce: 8B]
[payloadLen: 2B]
[payload: NB]      ABI-encoded type-specific data
[signature: 65B or 86B]  verifying/sponsor only
```

**Gas Limit 동적 계산** (stub 응답):

| 타입 | pvgl 기본 | ppgl 기본 | 추가 오버헤드 |
|------|----------|----------|-------------|
| verifying | 100,000 | 50,000 | +50k(factory), +20k(callData>1KB), +30k(pmData>256B) |
| sponsor | 100,000 | 50,000 | 동일 |
| erc20 | 150,000 | 100,000 | +50k(postOp), +50k(factory) |
| permit2 | 200,000 | 100,000 | +50k(postOp), +50k(factory) |

**이슈**:
- `exchangeRate` 항상 `'0'` (I4)
- envelope `nonce` 항상 `0n` (I5)
- `pm_getSponsorPolicy`가 'default' 정책만 조회 (M3)

### 6.3 Wallet Extension (`apps/wallet-extension/`)

**핵심 파일**:
- `src/background/rpc/paymaster.ts` — `sponsorAndSign` (ERC-7677 4단계)
- `src/background/rpc/handler.ts` — `eth_sendUserOperation` (line 1291), `pm_*` 스텁 핸들러
- `src/ui/pages/Send/GasPayment.tsx` — `GasPaymentSelector` (NATIVE/SPONSOR/ERC20)
- `src/ui/pages/Send/hooks/usePaymasterClient.ts` — UI paymaster 훅

**구현 상태**: 핵심 로직 구현됨, RPC 스텁 미완성

**`eth_sendUserOperation` 흐름**:
```
params 파싱 → gasPayment 추출 → nonce 조회 → factory 확인
→ gas price (25% 버퍼) → shouldSponsor 판단
→ sponsor: sponsorAndSign(4단계) → 실패 시 self-pay fallback
→ self-pay: bundler estimation(버퍼 0%) → 서명 → submit
```

**이슈**:
- `pm_supportedTokens`: native token만 반환 (C4)
- `pm_estimateERC20`: 항상 `{ supported: false }` (C3)
- `pm_sponsorPolicy`: 하드코딩 응답 (I2)
- `stablenet_estimateGas`: paymaster stub 미포함 (I1)
- `preVerificationGas` 버퍼 0% (I3)

### 6.4 Web App (`apps/web/`)

**핵심 파일**:
- `app/payment/send/page.tsx` — Send 페이지
- `hooks/useUserOp.ts` — UserOp dispatch (현재 EOA 경로)
- `hooks/usePaymaster.ts` — ERC-7677 wrapper (미연결)
- `hooks/usePermit2Approval.ts` — Permit2 서명 (미전달)
- `hooks/useTokenGasEstimate.ts` — 토큰 가스 비용 (표시 전용)
- `hooks/useGasPaymentMode.ts` — 모드 선택 state (미연결)
- `components/common/PaymasterSelector.tsx` — UI 컴포넌트

**구현 상태**: UI 컴포넌트 존재, submission 연결 미완성

**문제의 핵심**:
```typescript
// useUserOp.ts — 현재
const sendTransaction = async (from, to, amount) => {
  await provider.sendTransaction({ from, to, value })  // → eth_sendTransaction (EOA)
}

// useUserOp.ts — 필요
const sendUserOp = async (from, to, amount, gasPayment) => {
  await provider.sendUserOperation({    // → eth_sendUserOperation
    sender: from, target: to, value,
    gasPayment                           // paymaster context 포함
  })
}
```

---

## 7. 수정 계획

### Phase 1: 핵심 경로 수정 — C1, C2 (최우선)

**목표**: Web app Send → `eth_sendUserOperation` → `sponsorAndSign` 연결

**수정 대상**:
- `web/hooks/useUserOp.ts` — `sendUserOperation` 경로 사용, `gasPayment` context 전달
- `web/app/payment/send/page.tsx` — `PaymasterSelector` 선택값을 `handleSend`에 포함
- `wallet-sdk/src/provider/StableNetProvider.ts` — `sendUserOperation` EIP-1193 wrapper 확인

**검증 방법**:
- Use Case A: sponsor 모드 선택 → `sponsorAndSign` 호출 확인 → UserOp 제출 성공
- Use Case B: self-pay 모드 → `eth_sendUserOperation` self-pay 경로 → deposit 차감 확인

### Phase 2: ERC-20 활성화 — C3, C4, I4

**목표**: ERC-20 토큰 목록 표시, 가스 비용 추정, 환율 표시

**수정 대상**:
- `handler.ts:4224` — `pm_supportedTokens`를 paymaster-proxy에 위임
- `handler.ts:4298` — `pm_estimateERC20`를 paymaster-proxy의 `pm_estimateTokenPayment`에 위임
- `estimateTokenPayment.ts:83` — `exchangeRate` 실제 값 반환
- `web/app/payment/send/page.tsx` — 토큰 선택 시 approve 트랜잭션 플로우 추가

**검증 방법**:
- ERC-20 토큰 목록 표시 확인
- 토큰 선택 → 예상 비용 표시 확인
- approve → submit → postOp settlement 성공 확인

### Phase 3: Permit2 연결 — C5

**목표**: Permit2 서명 → paymaster context → submission 연결

**수정 대상**:
- `web/app/payment/send/page.tsx` — `permitSignature`를 gasPayment context에 포함
- `web/hooks/useUserOp.ts` — `gasPayment.permitSignature`를 extension에 전달

**검증 방법**:
- Permit2 서명 요청 → 서명 완료 → context 포함 → UserOp 제출 성공

### Phase 4: 가스 정확도 및 기타 — I1, I3, I6, I7

**수정 대상**:
- `handler.ts:3879` — `stablenet_estimateGas`에 paymaster stub 포함 옵션
- `paymaster.ts:252` — `preVerificationGas`에도 버퍼 추가 (5-10%)
- `send/page.tsx` — `handleDepositTopUp`에서 EntryPoint `depositTo()` ABI 호출
- `gasEstimator.ts:393` — `FailedOp` 에러 분류 로직 개선

---

## 8. 참고: 정상 동작하는 구간

다음 구간들은 추가 수정 불필요:

- **Paymaster-proxy 전체 핸들러** (stub, data, estimation, policy, settlement)
- **Bundler 핵심 로직** (gas estimation, validation, bundle execution, error diagnosis)
- **Extension `sponsorAndSign`** (ERC-7677 4단계 완전 구현)
- **Extension `eth_sendUserOperation`** (sponsor/self-pay 분기, gasPayment context 처리)
- **SDK paymasterDataCodec** (v0.7 wire format 인코딩/디코딩)
- **SDK paymasterHasher** (EIP-712 해시 구성)
- **SDK payloadEncoder** (4개 타입 ABI 인코딩)
- **Proxy 정책 관리** (TOCTOU-safe reservation, 리스크 스코어링, 일일 한도)
- **Proxy 정산** (receipt polling, actual gas cost reconciliation)
