# Task 5: Batch 트랜잭션 지원

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools 훅, AddLiquidity/RemoveLiquidity 온체인 호출.
> **Task 2 (Merchant Dashboard)**: 이벤트 로그 기반 분석 차트, 트랜잭션 목록.
> **Task 3 (Marketplace Registry)**: 동적 모듈 레지스트리 로드, Uninstall 기능.
> **Task 4 (Tx SpeedUp/Cancel)**: useTransactionManager 훅, 가스 범핑/nonce 대체, History 페이지 UI.

---

## 현재 상태

### SDK 구현 (이미 존재)
- `packages/sdk-ts/core/src/transaction/batch.ts` (529줄)
- **BatchBuilder 클래스**: Fluent API로 다중 호출 구성
- **Multicall3 인코딩**: aggregate, tryAggregate, aggregate3, aggregate3Value
- **ERC-7579 배치 실행**: encodeBatchExecution (Smart Account 전용)
- **EXEC_MODE**: DEFAULT, BATCH, TRY, DELEGATE

### wallet-extension 구현 (참조)
- Send 페이지에서 배치 트랜잭션 지원
- `TransactionMode.tsx`: 모드별 가스 비교 테이블

### web app 현재 상태
- `app/payment/send/page.tsx`: 단일 전송만 지원
- BatchBuilder 미사용
- 다중 수신자 UI 없음

---

## 구현 계획

### 1. useBatchTransaction 훅 생성

**파일**: `hooks/useBatchTransaction.ts` (신규)

**기능**: 다중 전송을 단일 트랜잭션으로 묶어 실행

```typescript
interface BatchCall {
  target: Address
  data: Hex
  value: bigint
}

interface UseBatchTransactionReturn {
  calls: BatchCall[]
  addCall: (call: BatchCall) => void
  removeCall: (index: number) => void
  clearCalls: () => void
  executeBatch: () => Promise<Hex>
  estimateBatchGas: () => Promise<bigint>
  isExecuting: boolean
  error: string | null
}
```

**SDK 연동**:
```typescript
import { createBatchBuilder, encodeBatchExecution, EXEC_MODE } from '@stablenet/core'

// Smart Account 모드: ERC-7579 배치 실행
const batch = createBatchBuilder()
calls.forEach(call => batch.add(call.target, call.data, { value: call.value }))
const calldata = batch.buildUserOpCalldata()  // execute(BATCH, encodedCalls)

// EOA 모드: Multicall3
const calldata = batch.buildMulticall('aggregate3')  // aggregate3(calls)
```

### 2. Send 페이지 배치 모드 추가

**파일**: `app/payment/send/page.tsx`

**현재 플로우**: 단일 수신자 → 금액 → 전송

**변경**:
- "Add Recipient" 버튼 추가 (배치 모드 활성화)
- 다중 수신자 목록 UI
- 각 항목: 주소 + 금액 + 토큰 + 삭제 버튼
- 총 합계 표시
- 잔액 검증 (총합 vs 보유량)

```tsx
// 배치 모드 토글
const [isBatchMode, setIsBatchMode] = useState(false)
const [recipients, setRecipients] = useState<BatchRecipient[]>([
  { address: '', amount: '', token: selectedAsset }
])

// 수신자 추가
const addRecipient = () => {
  setRecipients(prev => [...prev, { address: '', amount: '', token: selectedAsset }])
}
```

### 3. BatchRecipientList 컴포넌트

**파일**: `components/payment/BatchRecipientList.tsx` (신규)

**UI 구성**:
```
┌──────────────────────────────────────────┐
│ Recipient #1                        [X]  │
│ Address: [0x...]                         │
│ Amount:  [100]  Token: [USDC ▼]         │
├──────────────────────────────────────────┤
│ Recipient #2                        [X]  │
│ Address: [0x...]                         │
│ Amount:  [50]   Token: [USDC ▼]         │
├──────────────────────────────────────────┤
│        [+ Add Recipient]                 │
├──────────────────────────────────────────┤
│ Total: 150 USDC  |  Balance: 500 USDC   │
│ Estimated Gas: ~0.001 ETH (Sponsored)    │
└──────────────────────────────────────────┘
```

### 4. 배치 실행 로직

**Smart Account 경로** (권장):
```typescript
// 1. 각 전송을 call로 변환
const calls = recipients.map(r => {
  if (r.token.isNative) {
    return { target: r.address, data: '0x', value: parseEther(r.amount) }
  } else {
    return {
      target: r.token.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [r.address, parseUnits(r.amount, r.token.decimals)]
      }),
      value: 0n
    }
  }
})

// 2. BatchBuilder로 UserOp calldata 생성
const batch = createBatchBuilder()
calls.forEach(c => batch.add(c.target, c.data, { value: c.value }))
const calldata = batch.buildUserOpCalldata()

// 3. UserOp 전송
await sendUserOp({ target: account, data: calldata, value: totalNativeValue })
```

**EOA 경로** (Multicall3 사용):
```typescript
// Multicall3 컨트랙트 주소
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'

const batch = createBatchBuilder()
calls.forEach(c => batch.add(c.target, c.data, { value: c.value }))
const calldata = batch.buildMulticall('aggregate3Value')

await walletClient.sendTransaction({
  to: MULTICALL3,
  data: calldata,
  value: totalNativeValue
})
```

### 5. 가스 절약 표시

**UI**: 배치 vs 개별 전송 가스 비교
```
Individual: ~0.005 ETH (5 transactions)
Batch:      ~0.002 ETH (1 transaction)
Savings:    ~60%
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hooks/useBatchTransaction.ts` | **신규** - 배치 트랜잭션 훅 |
| `components/payment/BatchRecipientList.tsx` | **신규** - 다중 수신자 UI |
| `app/payment/send/page.tsx` | 배치 모드 토글, 다중 수신자 지원 |
| `hooks/useUserOp.ts` | 배치 calldata 지원 확인 |

## SDK 참조

### BatchBuilder API (packages/sdk-ts/core/src/transaction/batch.ts)
```typescript
createBatchBuilder(): BatchBuilder

class BatchBuilder {
  add(target: Address, data: Hex, options?: { value?: bigint }): this
  addOptional(target: Address, data: Hex, value?: bigint): this
  buildMulticall(mode: 'strict' | 'tryAggregate' | 'aggregate3'): Hex
  buildExecution(): Hex                    // ERC-7579 single/batch
  buildUserOpCalldata(): Hex               // Smart Account calldata
  getCalls(): Call[]
  size(): number
  clear(): this
}
```

### ERC-7579 Execution Modes
```typescript
EXEC_MODE = {
  DEFAULT:  '0x0000...',  // 단일 실행
  BATCH:    '0x0100...',  // 다중 실행
  TRY:      '0x0001...',  // 실패 허용 배치
  DELEGATE: '0x00ff...',  // Delegatecall
}
```

### Multicall3 ABI
```solidity
function aggregate3(Call3[] calldata calls) returns (Result[] memory)
function aggregate3Value(Call3Value[] calldata calls) returns (Result[] memory)

struct Call3 { address target; bool allowFailure; bytes callData; }
struct Call3Value { address target; bool allowFailure; uint256 value; bytes callData; }
struct Result { bool success; bytes returnData; }
```
