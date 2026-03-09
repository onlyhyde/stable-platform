# Smart Account & Paymaster 통합 구현 계획서

> **작성일**: 2026-03-09
> **기반 문서**: `08-SMART-ACCOUNT-TX-ANALYSIS.md`, `09-PAYMASTER-GAS-FLOW-ANALYSIS.md`
> **목적**: 세션 간 컨텍스트 유지가 가능한 완전한 실행 계획

---

## 1. 현재 상태 (Baseline)

### 1.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                          apps/web (Next.js)                         │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │PaymasterSel. │  │useGasPayment  │  │useUserOp                 │  │
│  │(UI 컴포넌트)  │  │Mode (상태관리) │  │ sendUserOp (gasPayment)  │  │
│  └──────┬───────┘  └───────┬───────┘  └────────────┬─────────────┘  │
│         └──────────────────┘                       │                │
│                                                    ▼                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ provider.request({ method: 'eth_sendUserOperation' })        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────┘
                                         │ EIP-1193 RPC
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    wallet-extension (Background)                     │
│  ┌──────────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │eth_sendUserOp    │  │sponsorAndSign│  │pm_supportedTokens     │  │
│  │(handler.ts:1331) │─▶│(paymaster.ts)│  │pm_estimateERC20       │  │
│  └──────────────────┘  └──────┬──────┘  │pm_sponsorPolicy       │  │
│                               │         └──────────┬─────────────┘  │
└───────────────────────────────┼─────────────────────┼───────────────┘
                                │                     │
                    ┌───────────┼─────────────────────┼──────────┐
                    ▼           ▼                     ▼          │
              ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
              │ Bundler   │ │Paymaster-Proxy│ │ EntryPoint      │  │
              │ :4337     │ │   :3000       │ │ (on-chain)      │  │
              └──────────┘ └──────────────┘ └─────────────────┘  │
```

### 1.2 이미 완료된 작업

| ID | 설명 | 완료 세션 | 수정 파일 |
|----|------|-----------|-----------|
| **C1** | `useUserOp.ts` — `provider.request()` + `eth_sendUserOperation` + `gasPayment` 전달 | 현재 세션 | `apps/web/hooks/useUserOp.ts` |
| **C2** | `send/page.tsx` — `buildGasPayment()` 헬퍼, `handleSend`에서 gasPayment 전달 | 현재 세션 | `apps/web/app/payment/send/page.tsx` |
| **C3** | `pm_estimateERC20` — paymaster-proxy `pm_estimateTokenPayment` 포워딩 | 현재 세션 | `apps/wallet-extension/src/background/rpc/handler.ts` |
| **C4** | `pm_supportedTokens` — paymaster-proxy 포워딩 + native token 병합 | 현재 세션 | `apps/wallet-extension/src/background/rpc/handler.ts` |
| **C5** | `permitSignature` — `buildGasPayment()`에서 `gasPayment.permitSignature`에 포함 | 현재 세션 | `apps/web/app/payment/send/page.tsx` |
| **I3** | `preVerificationGas` 10% 버퍼 추가 | 현재 세션 | `apps/wallet-extension/src/background/rpc/paymaster.ts` |
| **I6** | `handleDepositTopUp` — `depositTo()` ABI 호출로 수정 | 현재 세션 | `apps/web/app/payment/send/page.tsx` |
| **I7** | `FailedOp` 에러 명시적 감지 → fallback estimation 전환 | 현재 세션 | `services/bundler/src/gas/gasEstimator.ts` |
| **F-01** | `useSmartAccount` — `@stablenet/contracts` 동적 주소 해석 | 이전 세션 | `apps/web/hooks/useSmartAccount.ts` |
| **F-02** | `useGasPaymentMode` 훅 | 이전 세션 | `apps/web/hooks/useGasPaymentMode.ts` |
| **F-03** | `GasPaymentSelector` UI 컴포넌트 | 이전 세션 | `apps/web/components/payment/GasPaymentSelector.tsx` |
| **F-04** | `useEntryPointDeposit` 훅 | 이전 세션 | `apps/web/hooks/useEntryPointDeposit.ts` |
| **번들러** | preflightValidation — `handleOps` eth_call 사용 (stateOverride 제거) | 이전 세션 | `services/bundler/src/executor/bundleExecutor.ts` |
| **번들러** | gasEstimator merge conflict 해결 | 이전 세션 | `services/bundler/src/gas/gasEstimator.ts` |
| **번들러** | CALL_TYPE 중복 export 제거 | 이전 세션 | `packages/types/src/constants.ts` |
| **AA24** | Kernel `initialize()` calldata 포함 | 이전 세션 | `apps/wallet-extension/src/background/rpc/handler.ts` |

### 1.3 테스트 상태

- 번들러: **461 tests passing** (18 test files)
- 타입 체크: 수정된 파일에 **에러 없음**
- 커밋: **미커밋** (현재 세션 변경 사항)

---

## 2. 남은 작업 목록

### 2.1 작업 총괄표

| Phase | ID | 우선순위 | 대상 | 설명 | 난이도 |
|-------|----|----------|------|------|--------|
| **S1** | I1 | HIGH | Extension | `stablenet_estimateGas`에 paymaster stub 포함 | 중 |
| **S1** | I2 | MEDIUM | Extension | `pm_sponsorPolicy` 하드코딩 → proxy 포워딩 | 낮음 |
| **S2** | I4 | MEDIUM | Proxy | `exchangeRate` 실제 oracle 값 반환 | 중 |
| **S2** | I5 | MEDIUM | Proxy | `getPaymasterData` nonce 순차 생성 | 중 |
| **S3** | UI-5.2 | MEDIUM | Web | ERC-20 토큰 선택 UI (토큰 목록, 잔액, 환율) | 중 |
| **S3** | UI-5.3 | HIGH | Web | Token Approval 플로우 (approve + Permit2 UX) | 높음 |
| **S3** | UI-5.4 | MEDIUM | Web | 가스 미리보기 정확도 (모드별 표시) | 중 |
| **S3** | UI-5.5 | MEDIUM | Web | EntryPoint Deposit 관리 UI (잔액, 비교, top-up 제안) | 중 |
| **S3** | UI-5.6 | LOW | Web | AA 에러 코드별 사용자 친화적 메시지 | 낮음 |
| **S3** | UI-5.7 | LOW | Web | Paymaster Health & Policy 표시 | 낮음 |
| **S4** | F-05 | MEDIUM | Web | ERC-20 토큰 가스 비용 추정 (useGasPaymentMode 확장) | 중 |
| **S5** | M1 | LOW | Bundler | `packForContract` 3중 중복 통합 | 낮음 |
| **S5** | M2 | LOW | Proxy | v0.9 parallel signing format 미사용 코드 정리 | 낮음 |
| **S5** | M3 | LOW | Proxy | `pm_getSponsorPolicy` 다중 정책 지원 | 중 |
| **S5** | M4 | LOW | Extension | `MultiModeTransactionController` 메인 Send flow 연결 | 중 |
| **S5** | M5 | LOW | Proxy | `FLAGS_BLOCK_NUMBER_MODE` 미사용 코드 정리 | 낮음 |
| **S3** | UC-D | MEDIUM | Web | Module 설치 시 paymaster UI 연결 | 중 |
| **S4** | Batch | MEDIUM | Web | `useBatchTransaction` UserOp/paymaster 연동 | 높음 |

---

## 3. 세션별 실행 계획

### Session 1: Extension 가스 추정 & 정책 정확도 (I1, I2)

**목표**: Extension RPC 핸들러의 가스 추정과 정책 응답 정확도 개선

#### Task 1-1: `stablenet_estimateGas` paymaster stub 포함 (I1)

**파일**: `apps/wallet-extension/src/background/rpc/handler.ts:3877`

**현재 문제**:
```typescript
// handler.ts:3919 — paymaster stub 없이 estimation
const partialUserOp: Partial<UserOperation> = {
  sender: estimateParams.from as Address,
  callData: encodeKernelExecute(...),
  // ❌ paymaster 관련 필드 없음
  nonce: 0n,
  signature: '0x' as Hex,
  // ...
}
```

**수정 방향**:
- `gasPayment` 파라미터가 있고 `type !== 'none'`이면:
  1. `fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterStubData', [...])` 호출
  2. stub 결과에서 `paymaster`, `paymasterData`, `paymasterVerificationGasLimit`, `paymasterPostOpGasLimit` 추출
  3. `partialUserOp`에 paymaster 필드 포함하여 bundler estimation
- 스폰서 모드의 가스 미리보기가 실제보다 정확해짐

**검증**:
- `gasPayment: { type: 'sponsor' }`로 estimation 호출 → stub 포함 여부 확인
- 반환값의 `estimatedCost`가 paymaster 포함 시 더 높은지 확인

#### Task 1-2: `pm_sponsorPolicy` proxy 포워딩 (I2)

**파일**: `apps/wallet-extension/src/background/rpc/handler.ts:4296`

**현재 문제**:
```typescript
// handler.ts:4320-4324 — 하드코딩 응답
return {
  isAvailable: true,
  sponsor: { name: 'StableNet Paymaster' },
  maxGas: '100000000000000',      // 하드코딩
  dailyLimit: '100000000000000000', // 하드코딩
}
```

**수정 방향**:
- paymaster-proxy의 `pm_getSponsorPolicy` RPC를 호출하여 실제 정책 데이터 반환
- proxy에서 실패 시 현재 하드코딩 값을 fallback으로 유지
- 반환 필드: `isAvailable`, `sponsor`, `maxGas`, `dailyLimit`, `usedToday`, `remainingDaily`

**검증**:
- proxy 연결 시 실제 정책 데이터 반환 확인
- proxy 미연결 시 fallback 동작 확인

#### Task 1-3: 커밋

이전 세션 + 현재 세션의 모든 변경 사항 커밋:
- `fix(bundler): replace stateOverride preflight with handleOps eth_call`
- `fix(web): wire gasPayment context through Send flow (C1, C2, C5)`
- `fix(extension): forward pm_supportedTokens and pm_estimateERC20 to proxy (C3, C4)`
- `fix(extension): add preVerificationGas 10% buffer (I3)`
- `fix(bundler): detect FailedOp in gas estimator binary search (I7)`
- `fix(web): use depositTo() ABI for EntryPoint deposit top-up (I6)`
- `feat(extension): add paymaster stub to stablenet_estimateGas (I1)`
- `fix(extension): forward pm_sponsorPolicy to proxy (I2)`

---

### Session 2: Paymaster-Proxy 정확도 개선 (I4, I5)

**목표**: 토큰 환율 및 nonce 정확도 개선

#### Task 2-1: `exchangeRate` 실제 oracle 값 반환 (I4)

**파일**: `services/paymaster-proxy/src/handlers/estimateTokenPayment.ts:82`

**현재 문제**:
```typescript
return {
  tokenAddress,
  estimatedAmount: tokenAmount.toString(),
  exchangeRate: '0', // ❌ 항상 '0'
  markup: tokenConfig.markup,
}
```

**수정 방향**:
- `calculateTokenAmount` 결과에서 oracle 가격 정보를 추출
- 또는 별도로 `getTokenPrice(client, erc20PaymasterAddress, tokenAddress)` 호출
- `exchangeRate`에 실제 wei/token 비율 반환

**관련 파일 확인 필요**:
- `services/paymaster-proxy/src/chain/contracts.ts` — `calculateTokenAmount`, `getTokenConfig` 구현 확인
- oracle 컨트랙트의 가격 조회 함수 확인

**검증**:
- `pm_estimateTokenPayment` 호출 시 `exchangeRate !== '0'` 확인

#### Task 2-2: `getPaymasterData` nonce 순차 생성 (I5)

**파일**: `services/paymaster-proxy/src/handlers/getPaymasterData.ts:297, 358`

**현재 문제**:
```typescript
nonce: 0n, // ❌ 항상 0 → 동시 요청 시 충돌 가능
```

**수정 방향**:
- 옵션 A: `Date.now()` 기반 timestamp nonce (간단, 충돌 가능성 낮음)
- 옵션 B: Redis/in-memory counter 기반 순차 nonce (확실하지만 인프라 의존)
- 옵션 C: `crypto.randomBytes(8)` 기반 랜덤 nonce (충돌 확률 극히 낮음)
- 권장: 옵션 A — `BigInt(Date.now())` 사용, ms 단위로 충분한 유니크성 확보

**검증**:
- 동시에 2개 요청 시 서로 다른 nonce 확인
- 서명 검증 시 nonce 포함 여부 확인 (paymasterHasher 연동)

---

### Session 3: Web App UI 완성 (UI-5.2 ~ 5.7, UC-D)

**목표**: 가스 결제 관련 UI/UX 완성

#### Task 3-1: ERC-20 토큰 선택 UI (UI-5.2)

**파일**: `apps/web/app/payment/send/page.tsx`, 컴포넌트 확장

**현재 상태**: `PaymasterSelector`에서 erc20 모드 선택 가능하나, 토큰 목록이 비어있음 (C3/C4로 백엔드 준비 완료)

**구현 내용**:
1. `pm_supportedTokens`로 토큰 목록 조회 (extension RPC)
2. 토큰 선택 드롭다운 UI
3. 선택된 토큰에 대한 `pm_estimateERC20`로 예상 비용 표시
4. 토큰 잔액 조회 (`balanceOf`) 및 부족 시 경고

**의존**: C3 (pm_estimateERC20 포워딩), C4 (pm_supportedTokens 포워딩) — ✅ 완료

#### Task 3-2: Token Approval 플로우 (UI-5.3)

**파일**: `apps/web/app/payment/send/page.tsx`, `apps/web/hooks/useTokenApproval.ts` (신규)

**구현 내용**:
1. **ERC-20 모드**:
   - 현재 allowance 확인 (`allowance(sender, paymaster)`)
   - 부족 시 `approve(paymaster, amount)` 트랜잭션 요청 UI
   - 상태: needs-approval → approving → approved → ready-to-send
2. **Permit2 모드**:
   - 기존 `usePermit2Approval` 활용 (이미 구현됨)
   - 서명 상태 표시: needed → signing → signed
   - 서명 만료 시간 표시

**의존**: Task 3-1 (토큰 선택)

#### Task 3-3: 가스 미리보기 정확도 (UI-5.4)

**파일**: `apps/web/app/payment/send/page.tsx`

**구현 내용**:
- 스폰서 모드: "Gas: Free (Sponsored)" 표시
- ERC-20 모드: "Gas: ~X.XX USDC" (토큰 단위)
- Self-pay 모드: "Gas: ~X.XXXX WKRC" + "Deposit: Y.YYYY WKRC" + 부족 경고

**의존**: I1 (stablenet_estimateGas 정확도) — Session 1에서 완료 예정

#### Task 3-4: EntryPoint Deposit 관리 UI (UI-5.5)

**파일**: `apps/web/app/payment/send/page.tsx`

**현재 상태**: `useEntryPointDeposit` 훅은 구현됨 (F-04). `handleDepositTopUp`은 `depositTo()` 수정됨 (I6).

**추가 구현**:
1. Self-pay 모드 선택 시 자동으로 deposit 잔액 표시
2. 예상 가스 비용과 deposit 잔액 비교
3. deposit 부족 시: 필요 금액 계산 → "Top Up X.XX WKRC" 버튼 → `depositTo()` 호출

#### Task 3-5: AA 에러 핸들링 UI (UI-5.6)

**파일**: `apps/web/lib/aaErrors.ts` (신규), `apps/web/app/payment/send/page.tsx`

**구현 내용**:
```typescript
const AA_ERROR_MESSAGES: Record<string, string> = {
  'AA21': '가스 비용을 충당할 잔액이 부족합니다. EntryPoint에 deposit을 추가하세요.',
  'AA23': '트랜잭션 검증에 실패했습니다. 입력값을 확인하세요.',
  'AA25': '트랜잭션 순서 오류입니다. 페이지를 새로고침하세요.',
  'AA33': '가스 대납 서비스에서 거절되었습니다. 다른 결제 방식을 선택하세요.',
  'AA34': '가스 대납 서명 검증에 실패했습니다.',
}
```
- Send 실패 시 에러 메시지에서 AA 코드 파싱 → 사용자 친화적 메시지 표시
- 에러 유형에 따른 액션 제안 (deposit top-up, 모드 변경 등)

#### Task 3-6: Paymaster Health & Policy 표시 (UI-5.7)

**파일**: `apps/web/app/payment/send/page.tsx`

**구현 내용**:
- `pm_sponsorPolicy` 결과에서 일일 한도, 건당 한도, 잔여량 표시
- Paymaster offline 시 sponsor/erc20 옵션 비활성화 + 안내 메시지
- 30초 폴링으로 health 상태 업데이트 (기존 로직 활용)

**의존**: I2 (pm_sponsorPolicy 실제 데이터) — Session 1에서 완료 예정

#### Task 3-7: Module 설치 시 Paymaster UI (UC-D)

**파일**: `apps/web/app/modules/` 관련 페이지

**현재 상태**: 모듈 설치 시 extension의 `sponsorAndSign`이 사용되지만, web app에서 paymaster 선택 UI가 없음

**구현 내용**:
- 모듈 설치 페이지에 `GasPaymentSelector` 컴포넌트 추가
- 선택된 가스 결제 모드를 `useModuleInstall` 훅에 전달
- 모듈 설치 UserOp에 gasPayment context 포함

---

### Session 4: 데이터 계층 확장 (F-05, Batch)

**목표**: 토큰 가스 비용 추정 로직 완성, 배치 트랜잭션 UserOp 연동

#### Task 4-1: ERC-20 토큰 가스 비용 추정 (F-05)

**파일**: `apps/web/hooks/useGasPaymentMode.ts` 확장

**현재 상태**: `useGasPaymentMode`에 모드 선택 로직만 있음. 토큰별 가스 비용 추정 로직 없음.

**구현 내용**:
1. `useGasPaymentMode`에 `estimatedTokenCost` state 추가
2. ERC-20 모드 + 토큰 선택 시 → extension RPC `pm_estimateERC20` 호출
3. 결과를 `{ tokenAddress, estimatedAmount, exchangeRate }` 형태로 반환
4. UI에서 예상 토큰 비용 표시

**의존**: C3 (pm_estimateERC20 포워딩), I4 (exchangeRate 정확도)

#### Task 4-2: `useBatchTransaction` UserOp/Paymaster 연동 (Batch)

**파일**: `apps/web/hooks/useBatchTransaction.ts`

**현재 문제** (08 문서 2.5절):
```
배치 트랜잭션이 walletClient.sendTransaction()을 직접 사용하며,
Bundler를 통한 UserOp 제출이 아닌 일반 트랜잭션으로 처리된다.
```

**수정 방향**:
- Smart Account인 경우: `eth_sendUserOperation`으로 배치 실행
  - ERC-7579 batch execute 인코딩 (`CALL_TYPE.BATCH`)
  - gasPayment context 포함
- EOA인 경우: 기존 `sendTransaction` 유지

---

### Session 5: 코드 품질 개선 (M1-M5)

**목표**: 중복 제거, 미사용 코드 정리, 아키텍처 개선

#### Task 5-1: `packForContract` 3중 중복 통합 (M1)

**현재 위치**:
- `services/bundler/src/shared/packUserOp.ts` — 원본
- `services/bundler/src/gas/gasEstimator.ts` — import하여 사용
- `services/bundler/src/executor/bundleExecutor.ts` — import하여 사용

**확인 필요**: `simulationValidator.ts`, `validator.ts`에 별도 구현이 있는지 확인
**수정**: 단일 소스(`packUserOp.ts`)에서만 export, 나머지는 import으로 통일

#### Task 5-2: v0.9 parallel signing format 미사용 코드 정리 (M2)

**파일**: `services/paymaster-proxy/` 내 v0.9 관련 코드
**수정**: 미사용 코덱 제거 또는 `// TODO: v0.9 support` 주석으로 명시

#### Task 5-3: `pm_getSponsorPolicy` 다중 정책 지원 (M3)

**파일**: `services/paymaster-proxy/src/policy/sponsorPolicy.ts:37`
**현재**: 항상 'default' 정책만 조회
**수정**: policyId 파라미터 지원, 다중 정책 조회 로직

#### Task 5-4: `MultiModeTransactionController` 메인 Send flow 연결 (M4)

**파일**: `apps/wallet-extension/src/background/controllers/MultiModeTransactionController.ts`
**현재**: 완전 구현되었으나 메인 Send flow에서 사용하지 않음 (병렬 구현)
**수정**: `eth_sendUserOperation` 핸들러가 `MultiModeTransactionController`를 활용하도록 통합, 또는 아키텍처 결정 필요

#### Task 5-5: `FLAGS_BLOCK_NUMBER_MODE` 미사용 코드 정리 (M5)

**파일**: `services/paymaster-proxy/src/constants.ts:266`
**수정**: TODO 이행 또는 미사용 코드 제거

---

## 4. 세션 컨텍스트 전달 가이드

### 새 세션 시작 시 전달할 정보

```
이전 세션에서 10-IMPLEMENTATION-PLAN.md 문서의 Session [N] 작업을 완료했습니다.
현재 Session [N+1]을 시작합니다.

완료된 항목: [완료된 Task ID 목록]
미완료 항목: [미완료 Task ID 목록, 사유]

@claudedocs/10-IMPLEMENTATION-PLAN.md 문서의 Session [N+1]을 진행해주세요.
```

### 각 세션 종료 시 업데이트 필수

이 문서의 Section 1.2 "이미 완료된 작업" 테이블에 완료 항목 추가:
```
| **[ID]** | [설명] | Session [N] | `[수정 파일]` |
```

---

## 5. 파일 참조 맵

### 수정 대상 파일 전체 목록

```
apps/web/
├── app/payment/send/page.tsx          ← C2, C5, UI-5.2~5.5, UI-5.7
├── app/modules/                       ← UC-D
├── hooks/
│   ├── useUserOp.ts                   ← C1 ✅
│   ├── useSmartAccount.ts             ← F-01 ✅
│   ├── useGasPaymentMode.ts           ← F-02 ✅, F-05
│   ├── useEntryPointDeposit.ts        ← F-04 ✅
│   ├── usePermit2Approval.ts          ← C5 ✅
│   ├── useBatchTransaction.ts         ← Batch
│   └── useTokenApproval.ts            ← UI-5.3 (신규)
├── components/
│   └── payment/GasPaymentSelector.tsx ← F-03 ✅
└── lib/
    └── aaErrors.ts                    ← UI-5.6 (신규)

apps/wallet-extension/src/background/rpc/
├── handler.ts                         ← C3 ✅, C4 ✅, I1, I2
└── paymaster.ts                       ← I3 ✅

services/bundler/src/
├── gas/gasEstimator.ts                ← I7 ✅, M1
├── executor/bundleExecutor.ts         ← 번들러 fix ✅
└── shared/packUserOp.ts              ← M1

services/paymaster-proxy/src/
├── handlers/estimateTokenPayment.ts   ← I4
├── handlers/getPaymasterData.ts       ← I5
├── policy/sponsorPolicy.ts            ← M3
└── constants.ts                       ← M5

packages/types/src/
└── constants.ts                       ← CALL_TYPE 중복 제거 ✅
```

### 핵심 참조 파일 (읽기 전용)

```
services/paymaster-proxy/src/handlers/getPaymasterStubData.ts  ← stub 핸들러 참조
services/paymaster-proxy/src/signer/paymasterSigner.ts         ← 서명 로직 참조
services/paymaster-proxy/src/chain/contracts.ts                ← oracle 함수 참조
apps/wallet-extension/src/background/rpc/paymaster.ts          ← sponsorAndSign 참조
packages/wallet-sdk/src/provider/StableNetProvider.ts          ← SDK API 참조
```

---

## 6. 검증 체크리스트

### Use Case A: Sponsor Gas (native=0 유저)

- [ ] Web app에서 sponsor 모드 선택 → `eth_sendUserOperation` 호출 확인
- [ ] Extension의 `sponsorAndSign` 4단계 실행 확인
- [ ] Bundler에 UserOp 제출 성공 확인
- [ ] 사용자 잔액 변동 없음 확인

### Use Case B: Self-Pay (EntryPoint deposit)

- [ ] Web app에서 self-pay 모드 선택 → `eth_sendUserOperation` 호출 확인
- [ ] EntryPoint deposit 잔액 표시 확인
- [ ] Deposit 부족 시 top-up 제안 UI 확인
- [ ] `depositTo()` 호출로 deposit 증가 확인
- [ ] UserOp 실행 후 deposit 차감 확인

### Use Case C: ERC-20 Token Payment

- [ ] `pm_supportedTokens`로 토큰 목록 표시 확인
- [ ] 토큰 선택 → 예상 비용 표시 확인 (`pm_estimateTokenPayment`)
- [ ] ERC-20 모드: approve 필요 시 approve 요청 UI 확인
- [ ] Permit2 모드: 서명 요청 → context 포함 → 제출 성공 확인
- [ ] postOp에서 토큰 차감 확인

### Use Case D: Module Installation + Paymaster

- [ ] 모듈 설치 페이지에 가스 결제 선택 UI 확인
- [ ] 선택된 모드로 모듈 설치 UserOp 제출 확인

### 에러 핸들링

- [ ] AA21 (prefund 부족) → 사용자 친화적 메시지 + deposit top-up 제안
- [ ] AA33 (paymaster revert) → 다른 결제 방식 제안
- [ ] Paymaster offline → sponsor/erc20 옵션 비활성화

---

## 7. 의존 관계 다이어그램

```
Session 1 (Extension 정확도)
├── I1: stablenet_estimateGas + paymaster stub
└── I2: pm_sponsorPolicy → proxy
         │
         ▼
Session 2 (Proxy 정확도)
├── I4: exchangeRate oracle 값
└── I5: nonce 순차 생성
         │
         ▼
Session 3 (Web UI 완성) ─── Session 4 (데이터 계층)
├── UI-5.2: 토큰 선택 UI      ├── F-05: 토큰 비용 추정
│   (I4에 의존)                │   (I4, C3에 의존)
├── UI-5.3: Approval 플로우    └── Batch: UserOp 연동
│   (UI-5.2에 의존)
├── UI-5.4: 가스 미리보기
│   (I1에 의존)
├── UI-5.5: Deposit 관리 UI
├── UI-5.6: AA 에러 메시지
├── UI-5.7: Policy 표시
│   (I2에 의존)
└── UC-D: Module paymaster
         │
         ▼
Session 5 (코드 품질)
├── M1: packForContract 통합
├── M2: v0.9 코드 정리
├── M3: 다중 정책 지원
├── M4: MultiModeTransactionController 연결
└── M5: 미사용 코드 정리
```

---

## 8. 위험 요소 및 대응

| 위험 | 확률 | 영향 | 대응 |
|------|------|------|------|
| Oracle 컨트랙트 미배포 (I4) | 중 | I4, F-05 지연 | `exchangeRate` 계산 로직 확인 후 mock 가능 |
| Permit2 컨트랙트 미배포 (StableNet Local) | 중 | UI-5.3 Permit2 모드 테스트 불가 | ERC-20 approve 모드 우선 구현 |
| `MultiModeTransactionController` 구조 불일치 (M4) | 높 | 통합 복잡도 증가 | 아키텍처 결정 후 진행 (통합 vs 병행) |
| `useBatchTransaction` ERC-7579 인코딩 복잡 (Batch) | 중 | Session 4 지연 | `@stablenet/types`의 `encodeExecutionMode` 활용 |

---

## 9. 완료 기준

모든 작업이 완료되면:

1. **C1-C5**: 5/5 Critical 이슈 해결 ✅ (C1-C5 모두 현재 세션에서 완료)
2. **I1-I7**: 7/7 Important 이슈 해결 (I3, I6, I7 완료 / I1, I2, I4, I5 남음)
3. **M1-M5**: 5/5 Minor 이슈 해결
4. **F-01~F-05**: 5/5 Feature 구현 (F-01~F-04 완료 / F-05 남음)
5. **UI 5.1~5.7**: 7/7 UI 개선 (5.1 부분 완료 / 나머지 남음)
6. **UC-A~D**: 4/4 Use Case 검증
7. **Batch**: 배치 트랜잭션 UserOp 연동
8. 번들러 테스트 전체 통과
9. 타입 체크 에러 없음
10. 모든 변경 사항 커밋 완료
