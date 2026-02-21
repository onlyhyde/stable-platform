# Task 4: Tx Speed-Up/Cancel 기능 추가

## 선행 작업 요약
> **Task 1 (DeFi Pool)**: usePools 훅 완성, AddLiquidity/RemoveLiquidity 온체인 호출 구현.
> **Task 2 (Merchant Dashboard)**: 이벤트 로그 조회 훅, 분석 차트/트랜잭션 목록 데이터 연동.
> **Task 3 (Marketplace Registry)**: useModuleRegistry 훅으로 동적 모듈 로드, Uninstall 기능 추가.

---

## 현재 상태

### wallet-extension 구현 (참조)
- `stablenet_speedUpTransaction`: 가스 10% 범핑 후 동일 nonce로 재전송
- `stablenet_cancelTransaction`: 동일 nonce + 0-value self-transfer로 원본 대체
- handler.ts (lines 2791-2902)에 완전 구현

### web app 현재 상태
- `useUserOp.ts`: pending ops를 localStorage에 저장, 24시간 자동 정리
- `app/payment/history/page.tsx`: 트랜잭션 목록 표시, pending ops 배너 (recheck/dismiss만)
- Speed-Up/Cancel 기능 **전혀 없음**

---

## 구현 계획

### 1. useTransactionManager 훅 생성

**파일**: `hooks/useTransactionManager.ts` (신규)

**기능**:
- 트랜잭션 Speed-Up (가스 범핑)
- 트랜잭션 Cancel (nonce 대체)
- EOA와 Smart Account(UserOp) 모드 모두 지원

```typescript
interface UseTransactionManagerReturn {
  speedUpTransaction: (txHash: Hex) => Promise<Hex>     // 새 txHash 반환
  cancelTransaction: (txHash: Hex) => Promise<Hex>       // 대체 txHash 반환
  isSpeedingUp: boolean
  isCancelling: boolean
  error: string | null
}
```

### 2. EOA 트랜잭션 Speed-Up 구현

**로직** (wallet-extension handler.ts 참조):
```typescript
async function speedUpTransaction(txHash: Hex): Promise<Hex> {
  // 1. 원본 트랜잭션 조회
  const tx = await publicClient.getTransaction({ hash: txHash })

  // 2. 가스 10% 범핑
  const bumpedGas = tx.maxFeePerGas
    ? { maxFeePerGas: (tx.maxFeePerGas * 110n) / 100n,
        maxPriorityFeePerGas: (tx.maxPriorityFeePerGas * 110n) / 100n }
    : { gasPrice: (tx.gasPrice * 110n) / 100n }

  // 3. 동일 nonce로 재전송
  const newHash = await walletClient.sendTransaction({
    to: tx.to,
    value: tx.value,
    data: tx.input,
    nonce: tx.nonce,
    ...bumpedGas,
  })

  return newHash
}
```

### 3. EOA 트랜잭션 Cancel 구현

**로직**:
```typescript
async function cancelTransaction(txHash: Hex): Promise<Hex> {
  // 1. 원본 트랜잭션 조회 (nonce, gas 정보)
  const tx = await publicClient.getTransaction({ hash: txHash })

  // 2. 가스 10% 범핑
  const bumpedGas = tx.maxFeePerGas
    ? { maxFeePerGas: (tx.maxFeePerGas * 110n) / 100n,
        maxPriorityFeePerGas: (tx.maxPriorityFeePerGas * 110n) / 100n }
    : { gasPrice: (tx.gasPrice * 110n) / 100n }

  // 3. 자기 자신에게 0-value 전송 (동일 nonce)
  const cancelHash = await walletClient.sendTransaction({
    to: address,          // self-transfer
    value: 0n,
    data: '0x',
    nonce: tx.nonce,
    gas: 21000n,          // 최소 가스
    ...bumpedGas,
  })

  return cancelHash
}
```

### 4. Smart Account (UserOp) Speed-Up

**로직**:
- UserOp은 bundler를 통해 전송되므로 직접 nonce 교체 불가
- Bundler에 `eth_getUserOperationByHash`로 상태 확인
- 아직 포함 안 된 경우: 더 높은 gas로 새 UserOp 제출
- 이미 포함된 경우: Speed-Up 불가능 알림

```typescript
async function speedUpUserOp(userOpHash: Hex): Promise<Hex | null> {
  // 1. 기존 UserOp 상태 확인
  const receipt = await bundlerClient.getUserOperationReceipt(userOpHash)
  if (receipt) {
    throw new Error('Transaction already confirmed')
  }

  // 2. pending ops에서 원본 데이터 복구
  const pendingOp = getPendingUserOps().find(op => op.hash === userOpHash)
  if (!pendingOp) throw new Error('UserOp not found in pending list')

  // 3. 새 UserOp 빌드 (동일 nonce, 높은 gas)
  // sendUserOp에서 gas 파라미터를 범핑하여 재전송
  // bundler가 동일 sender+nonce의 기존 op를 대체
}
```

### 5. History 페이지 UI 확장

**파일**: `app/payment/history/page.tsx`

**현재 pending ops 배너**:
- "Recheck" 버튼 (상태 확인)
- "Dismiss" 버튼 (목록에서 제거)

**추가할 UI**:
- "Speed Up" 버튼 (가스 범핑)
- "Cancel" 버튼 (트랜잭션 대체)
- 확인 모달 (가스 비용 표시)
- 진행 상태 표시 (속도 올리는 중... / 취소 중...)

```tsx
// Pending ops 항목에 추가
<button onClick={() => handleSpeedUp(op.hash)}>Speed Up</button>
<button onClick={() => handleCancel(op.hash)}>Cancel</button>
```

### 6. TransactionDetail 페이지 확장

**파일**: `app/payment/history/page.tsx` (또는 별도 트랜잭션 상세 모달)

**추가**:
- pending 상태 트랜잭션에 Speed Up/Cancel 버튼
- 가스 정보 표시 (현재 가스 vs 범핑된 가스)
- 대체 트랜잭션 해시 표시

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hooks/useTransactionManager.ts` | **신규** - Speed-Up/Cancel 훅 |
| `hooks/useUserOp.ts` | pending ops에 원본 tx 데이터 저장 확장 |
| `app/payment/history/page.tsx` | Speed Up/Cancel 버튼, 확인 모달 |
| `hooks/useTransactionHistory.ts` | 대체 트랜잭션 추적 |

## 핵심 참조

### wallet-extension Speed-Up (handler.ts:2793-2847)
```typescript
// EIP-1559 범핑
maxFeePerGas: (originalMaxFee * 110n) / 100n
maxPriorityFeePerGas: (originalPriorityFee * 110n) / 100n

// Legacy 범핑
gasPrice: (originalGasPrice * 110n) / 100n
```

### wallet-extension Cancel (handler.ts:2852-2902)
```typescript
// Self-transfer로 원본 대체
{ to: from, value: '0x0', data: '0x', gas: '0x5208', nonce: originalNonce }
```

## 제약 사항
- Speed-Up/Cancel은 pending 상태에서만 가능
- 이미 확인된 트랜잭션은 대체 불가
- Smart Account UserOp의 Speed-Up은 bundler 지원에 따라 제한적
- Cancel은 가스 비용이 발생 (21000 gas)
