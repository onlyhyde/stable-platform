# Contract ↔ SDK Mapping

> **Version**: 1.0
> **Last Updated**: 2025-02-05
> **Status**: Active Development

---

## 1. 개요

이 문서는 `poc-contract`의 Solidity 컨트랙트와 `packages/sdk`의 TypeScript SDK 간의 매핑 관계를 정리합니다.

### 1.1 전체 매핑 현황

| 영역 | Contract 완성도 | SDK 지원 | 통합 상태 |
|------|----------------|---------|----------|
| Core | 100% | ~90% | ✅ |
| Validators | 100% | ~90% | ✅ |
| Executors | 100% | ~95% | ✅ |
| Hooks | 100% | ~90% | ✅ |
| Paymasters | 100% | ~95% | ✅ |
| Privacy (Standard) | 100% | ~90% | ✅ |
| Privacy (Enterprise) | 100% | ❌ | ⬜ |
| Subscription | 100% | ~90% | ✅ |
| Bridge | 100% | ❌ | ⬜ |
| Compliance | 100% | ❌ | ⬜ |

---

## 2. Core Contracts

### 2.1 EntryPoint

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `EntryPoint.sol` | `@stablenet/core` | `ENTRY_POINT_V07_ADDRESS` | ✅ |
| `UserOperationLib.sol` | `@stablenet/core` | `packUserOperation`, `getUserOperationHash` | ✅ |
| `NonceManager.sol` | `@stablenet/core` | (내부 사용) | ✅ |
| `StakeManager.sol` | `@stablenet/core` | (미노출) | ⚠️ |

**SDK 사용 예시:**

```typescript
import {
  ENTRY_POINT_V07_ADDRESS,
  packUserOperation,
  getUserOperationHash,
} from '@stablenet/core'

const packedOp = packUserOperation(userOp)
const opHash = getUserOperationHash(packedOp, ENTRY_POINT_V07_ADDRESS, chainId)
```

### 2.2 Kernel Smart Account

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `Kernel.sol` | `@stablenet/accounts` | `createKernelAccount` | ✅ |
| `KernelFactory.sol` | `@stablenet/core` | `KERNEL_V3_1_FACTORY_ADDRESS` | ✅ |
| `ValidationManager.sol` | `@stablenet/plugin-modules` | `getRootValidator` | ✅ |
| `ExecutorManager.sol` | `@stablenet/plugin-modules` | `isModuleInstalled` | ✅ |

### 2.3 EIP-7702 Support

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `Eip7702Support.sol` | `@stablenet/core` | `EIP7702_MAGIC`, `isDelegatedAccount`, `getDelegationStatus` | ✅ |

**SDK 사용 예시:**

```typescript
import {
  createAuthorization,
  createSignedAuthorization,
  isDelegatedAccount,
  extractDelegateAddress,
  getDelegationStatus,
  DELEGATE_PRESETS,
} from '@stablenet/core'

// Check if EOA is delegated
const isDelegated = await isDelegatedAccount(publicClient, eoaAddress)

// Get delegation details
const status = await getDelegationStatus(publicClient, eoaAddress)
// { isDelegated: true, delegateAddress: '0x...', delegateType: 'kernel' }
```

---

## 3. Validators

### 3.1 매핑 테이블

| Contract | SDK Package | ABI Export | InitData Encoder | 상태 |
|----------|-------------|------------|------------------|------|
| `ECDSAValidator.sol` | `@stablenet/plugin-ecdsa` | `ECDSAValidatorAbi` | `encodeECDSAValidatorInitData` | ✅ |
| `WebAuthnValidator.sol` | `@stablenet/plugin-modules` | - | `encodeWebAuthnValidatorInitData` | ✅ |
| `MultiSigValidator.sol` | `@stablenet/plugin-modules` | - | `encodeMultiSigValidatorInitData` | ✅ |
| `MultiChainValidator.sol` | - | - | - | ❌ |
| `WeightedECDSAValidator.sol` | - | - | - | ❌ |

### 3.2 ECDSA Validator

**Contract 인터페이스:**

```solidity
// ECDSAValidator.sol
function onInstall(bytes calldata data) external;
function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external;
```

**SDK 사용 예시:**

```typescript
import { encodeECDSAValidatorInitData } from '@stablenet/plugin-modules'
import { ECDSAValidatorAbi, ECDSA_VALIDATOR_ADDRESS } from '@stablenet/plugin-ecdsa'

const initData = encodeECDSAValidatorInitData(ownerAddress)

// Install via Kernel
await client.installModule({
  moduleType: MODULE_TYPES.VALIDATOR,
  module: ECDSA_VALIDATOR_ADDRESS,
  initData,
})
```

---

## 4. Executors

### 4.1 매핑 테이블

| Contract | SDK Package | ABI Export | InitData Encoder | 상태 |
|----------|-------------|------------|------------------|------|
| `SessionKeyExecutor.sol` | `@stablenet/plugin-session-keys` | `SessionKeyExecutorAbi` | `encodeSessionKeyExecutorInitData` | ✅ |
| `RecurringPaymentExecutor.sol` | `@stablenet/plugin-subscription` | - | - | ✅ |
| `SwapExecutor.sol` | `@stablenet/plugin-defi` | `SwapExecutorAbi` | `encodeSwapExecutorInitData` | ✅ |
| `LendingExecutor.sol` | `@stablenet/plugin-defi` | `LendingExecutorAbi` | `encodeLendingExecutorInitData` | ✅ |
| `StakingExecutor.sol` | `@stablenet/plugin-defi` | `StakingExecutorAbi` | `encodeStakingExecutorInitData` | ✅ |

### 4.2 SwapExecutor

**Contract 인터페이스:**

```solidity
// SwapExecutor.sol
struct SwapParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

function executeSwap(IERC7579Account account, SwapParams calldata params) external;
function executeMultiHopSwap(IERC7579Account account, bytes calldata path, uint256 amountIn, uint256 amountOutMinimum) external;
```

**SDK 사용 예시:**

```typescript
import {
  SwapExecutorAbi,
  encodeSwapExecutorInitData,
  calculateMinOutput,
  DEFAULTS,
} from '@stablenet/plugin-defi'

// Install
const initData = encodeSwapExecutorInitData({
  maxSlippageBps: DEFAULTS.MAX_SLIPPAGE_BPS, // 1%
  dailyLimit: parseEther('10'),
})

// Execute swap
const minOutput = calculateMinOutput(amountIn, 50) // 0.5% slippage

const tx = await client.sendTransaction({
  to: swapExecutorAddress,
  data: encodeFunctionData({
    abi: SwapExecutorAbi,
    functionName: 'executeSwap',
    args: [accountAddress, { tokenIn, tokenOut, fee: 3000, amountIn, amountOutMinimum: minOutput }],
  }),
})
```

### 4.3 LendingExecutor

**Contract 인터페이스:**

```solidity
// LendingExecutor.sol
function supply(address asset, uint256 amount) external;
function withdraw(address asset, uint256 amount) external;
function borrow(address asset, uint256 amount, uint256 interestRateMode) external;
function repay(address asset, uint256 amount, uint256 interestRateMode) external;
```

**SDK 사용 예시:**

```typescript
import {
  LendingExecutorAbi,
  encodeLendingExecutorInitData,
  calculateHealthFactor,
  isLiquidatable,
} from '@stablenet/plugin-defi'

// Check health factor before borrowing
const hf = calculateHealthFactor(collateralValue, debtValue, liquidationThreshold)
if (isLiquidatable(hf)) {
  throw new Error('Position would be liquidatable')
}

// Execute borrow
await client.sendTransaction({
  to: lendingExecutorAddress,
  data: encodeFunctionData({
    abi: LendingExecutorAbi,
    functionName: 'borrow',
    args: [assetAddress, borrowAmount, 2n], // Variable rate
  }),
})
```

---

## 5. Hooks

### 5.1 매핑 테이블

| Contract | SDK Package | ABI Export | InitData Encoder | 상태 |
|----------|-------------|------------|------------------|------|
| `SpendingLimitHook.sol` | `@stablenet/plugin-modules` | `SpendingLimitHookAbi` | `encodeSpendingLimitHookInitData` | ✅ |
| `HealthFactorHook.sol` | `@stablenet/plugin-defi` | `HealthFactorHookAbi` | `encodeHealthFactorHookInitData` | ✅ |
| `PolicyHook.sol` | `@stablenet/plugin-modules` | - | `encodePolicyHookInitData` | ✅ |
| `AuditHook.sol` | - | - | - | ❌ |

### 5.2 HealthFactorHook

**Contract 인터페이스:**

```solidity
// HealthFactorHook.sol
function preCheck(address msgSender, uint256 value, bytes calldata msgData) external returns (bytes memory);
function postCheck(bytes calldata hookData) external;
function setMinHealthFactor(uint256 minHealthFactor) external;
```

**SDK 사용 예시:**

```typescript
import {
  HealthFactorHookAbi,
  encodeHealthFactorHookInitData,
  DEFAULTS,
} from '@stablenet/plugin-defi'

// Install with minimum health factor 1.2
const initData = encodeHealthFactorHookInitData({
  minHealthFactor: DEFAULTS.MIN_HEALTH_FACTOR, // 1.2e18
})

await client.installModule({
  moduleType: MODULE_TYPES.HOOK,
  module: healthFactorHookAddress,
  initData,
})
```

---

## 6. Paymasters

### 6.1 매핑 테이블

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `VerifyingPaymaster.sol` | `@stablenet/plugin-paymaster` | `createVerifyingPaymaster` | ✅ |
| `ERC20Paymaster.sol` | `@stablenet/plugin-paymaster` | (미구현) | ⚠️ |
| `SponsorPaymaster.sol` | `@stablenet/plugin-paymaster` | `createSponsorPaymaster` | ✅ |
| `Permit2Paymaster.sol` | `@stablenet/plugin-paymaster` | `createPermit2Paymaster` | ✅ |

### 6.2 Verifying Paymaster

**SDK 사용 예시:**

```typescript
import {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
} from '@stablenet/plugin-paymaster'

// From account
const paymaster = createVerifyingPaymaster({
  paymasterAddress: '0x...',
  signer: account,
  chainId: 1n,
})

// From private key
const paymaster = createVerifyingPaymasterFromPrivateKey({
  paymasterAddress: '0x...',
  privateKey: '0x...',
  chainId: 1n,
})

// Use with client
const client = createSmartAccountClient({
  account,
  paymaster,
  // ...
})
```

### 6.3 Sponsor Paymaster (API-based)

**SDK 사용 예시:**

```typescript
import {
  createSponsorPaymaster,
  createSponsorPaymasterWithPolicy,
} from '@stablenet/plugin-paymaster'

// Basic sponsor
const paymaster = createSponsorPaymaster({
  paymasterUrl: 'https://paymaster.stablenet.io',
  apiKey: 'your-api-key',
  chainId: 1n,
})

// With sponsorship policy
const paymaster = createSponsorPaymasterWithPolicy({
  paymasterUrl: 'https://paymaster.stablenet.io',
  apiKey: 'your-api-key',
  chainId: 1n,
  policy: {
    sponsorshipType: 'full', // or 'partial'
    maxGasLimit: 500000n,
  },
})
```

---

## 7. Privacy (Stealth Address)

### 7.1 매핑 테이블

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `ERC5564Announcer.sol` | `@stablenet/plugin-stealth` | `announce`, `fetchAnnouncements` | ✅ |
| `ERC6538Registry.sol` | `@stablenet/plugin-stealth` | `registerStealthMetaAddress`, `getStealthMetaAddress` | ✅ |
| `PrivateBank.sol` | `@stablenet/plugin-stealth` | (부분 지원) | ⚠️ |

### 7.2 Enterprise Stealth (미지원)

| Contract | SDK Package | 상태 |
|----------|-------------|------|
| `StealthVault.sol` | - | ❌ |
| `StealthLedger.sol` | - | ❌ |
| `WithdrawalManager.sol` | - | ❌ |
| `RoleManager.sol` | - | ❌ |

### 7.3 Standard Stealth 사용 예시

**생성 및 전송:**

```typescript
import {
  createStealthClient,
  generateStealthAddress,
  registerStealthMetaAddress,
  announce,
} from '@stablenet/plugin-stealth'

// Receiver: Register stealth meta-address
await registerStealthMetaAddress({
  client,
  spendingPublicKey: '0x...',
  viewingPublicKey: '0x...',
})

// Sender: Generate stealth address
const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
  stealthMetaAddressUri: 'st:eth:0x...',
})

// Sender: Transfer + Announce
await client.sendTransaction({ to: stealthAddress, value: parseEther('1') })
await announce({
  client,
  schemeId: 1,
  stealthAddress,
  ephemeralPubKey,
  metadata: createMetadata(viewTag, tokenAddress, amount),
})
```

**수신 스캔:**

```typescript
import {
  watchAnnouncementsWithKey,
  computeStealthKey,
} from '@stablenet/plugin-stealth'

// Watch for incoming payments
const unwatch = watchAnnouncementsWithKey({
  client,
  spendingPrivateKey: '0x...',
  viewingPrivateKey: '0x...',
  onAnnouncement: async (announcement, stealthKey) => {
    console.log('Received payment!')
    console.log('Stealth address:', stealthKey.stealthAddress)
    console.log('Private key:', stealthKey.stealthPrivateKey)
    // Now can spend from this address
  },
})
```

---

## 8. Subscription

### 8.1 매핑 테이블

| Contract | SDK Package | SDK Export | 상태 |
|----------|-------------|------------|------|
| `SubscriptionManager.sol` | `@stablenet/plugin-subscription` | `SubscriptionClient` | ✅ |
| `ERC7715PermissionManager.sol` | `@stablenet/plugin-subscription` | `PermissionClient` | ✅ |
| `MerchantRegistry.sol` | `@stablenet/plugin-defi` | `MerchantRegistryAbi` | ✅ |

---

## 9. Module Management

### 9.1 @stablenet/plugin-modules

모든 ERC-7579 모듈의 설치/제거를 위한 통합 유틸리티를 제공합니다.

**주요 기능:**

| 기능 | 함수 | 설명 |
|------|------|------|
| 모듈 설치 | `buildInstallModuleCall` | 설치 calldata 생성 |
| 모듈 제거 | `buildUninstallModuleCall` | 제거 calldata 생성 |
| 일괄 설치 | `buildBatchInstallModuleCalls` | 여러 모듈 한번에 설치 |
| 설치 확인 | `isModuleInstalled` | 모듈 설치 여부 확인 |
| Root Validator | `getRootValidator` | 루트 Validator 조회 |

**InitData Encoders:**

```typescript
// Validators
encodeECDSAValidatorInitData(owner: Address)
encodeWebAuthnValidatorInitData(credentialId: Hex, pubKeyX: bigint, pubKeyY: bigint)
encodeMultiSigValidatorInitData(owners: Address[], threshold: number)

// Executors
encodeSessionKeyExecutorInitData(sessionKey: Address, validUntil: bigint, validAfter: bigint)
encodeSwapExecutorInitData(config: { maxSlippageBps: number, dailyLimit: bigint })
encodeLendingExecutorInitData(config: { maxLtv: number, minHealthFactor: bigint, dailyBorrowLimit: bigint })
encodeStakingExecutorInitData(config: { maxStakePerPool: bigint, dailyStakeLimit: bigint })

// Hooks
encodeSpendingLimitHookInitData(limit: bigint, period: bigint)
encodeHealthFactorHookInitData(config: { minHealthFactor: bigint })
encodePolicyHookInitData(policies: PolicyConfig[])
```

---

## 10. 미지원 Contract

다음 Contract들은 현재 SDK에서 지원되지 않습니다:

### 10.1 Bridge System

| Contract | 설명 | SDK 필요성 |
|----------|------|-----------|
| `SecureBridge.sol` | 크로스체인 브릿지 | 🟡 Medium |
| `BridgeValidator.sol` | MPC 검증 | 🟡 Medium |
| `BridgeRateLimiter.sol` | Rate Limiting | 🟢 Low |
| `BridgeGuardian.sol` | 긴급 대응 | 🟢 Low |
| `OptimisticVerifier.sol` | Optimistic 검증 | 🟢 Low |
| `FraudProofVerifier.sol` | 사기 증명 | 🟢 Low |

### 10.2 Compliance System

| Contract | 설명 | SDK 필요성 |
|----------|------|-----------|
| `KYCRegistry.sol` | KYC 관리 | 🟡 Medium |
| `AuditLogger.sol` | 감사 로그 | 🟢 Low |
| `RegulatoryRegistry.sol` | 규제 기관 | 🟢 Low |
| `ProofOfReserve.sol` | 준비금 증명 | 🟢 Low |

### 10.3 Tokens

| Contract | 설명 | SDK 필요성 |
|----------|------|-----------|
| `StableToken.sol` | 스테이블코인 | 🟢 Low (표준 ERC-20) |
| `WKRW.sol` | Wrapped KRW | 🟢 Low (표준 ERC-20) |

### 10.4 ERC-7579 Plugins

| Contract | 설명 | SDK 필요성 |
|----------|------|-----------|
| `AutoSwapPlugin.sol` | 자동 스왑 | 🟡 Medium |
| `MicroLoanPlugin.sol` | 소액 대출 | 🟡 Medium |
| `OnRampPlugin.sol` | Fiat 온램프 | 🟡 Medium |

### 10.5 Additional Validators

| Contract | 설명 | SDK 필요성 |
|----------|------|-----------|
| `MultiChainValidator.sol` | 멀티체인 검증 | 🔴 High |
| `WeightedECDSAValidator.sol` | 가중치 ECDSA | 🟡 Medium |

---

## 11. 관련 문서

- [00_SDK_OVERVIEW.md](./00_SDK_OVERVIEW.md) - SDK 개요
- [02_SDK_REMAINING_TASKS.md](./02_SDK_REMAINING_TASKS.md) - 남은 작업
- [../contracts/00_CONTRACTS_OVERVIEW.md](../contracts/00_CONTRACTS_OVERVIEW.md) - Contract 개요

---

*문서 끝*
