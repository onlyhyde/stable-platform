# StableNet SDK API Reference

> **Version**: 1.0.0
> **Last Updated**: 2026-01-27

## Overview

StableNet SDK는 ERC-4337 Account Abstraction 기반의 스마트 계정 개발을 위한 TypeScript SDK입니다.

## Packages

| Package | Description | NPM |
|---------|-------------|-----|
| `@stablenet/core` | Core client and utilities | [![npm](https://img.shields.io/npm/v/@stablenet/core)](https://npmjs.com/package/@stablenet/core) |
| `@stablenet/accounts` | Smart account implementations | [![npm](https://img.shields.io/npm/v/@stablenet/accounts)](https://npmjs.com/package/@stablenet/accounts) |
| `@stablenet/types` | TypeScript type definitions | [![npm](https://img.shields.io/npm/v/@stablenet/types)](https://npmjs.com/package/@stablenet/types) |
| `@stablenet/config` | Network and contract configuration | [![npm](https://img.shields.io/npm/v/@stablenet/config)](https://npmjs.com/package/@stablenet/config) |

### Plugins

| Plugin | Description |
|--------|-------------|
| `@stablenet/plugin-ecdsa` | ECDSA validator for transaction signing |
| `@stablenet/plugin-paymaster` | Gas sponsorship (Verifying/Sponsor Paymaster) |
| `@stablenet/plugin-session-keys` | Session key management for delegated signing |
| `@stablenet/plugin-stealth` | Stealth addresses (EIP-5564/6538) |
| `@stablenet/plugin-subscription` | Recurring payment subscriptions |

---

## @stablenet/core

### Clients

#### `createSmartAccountClient`

Smart Account와 상호작용하는 클라이언트를 생성합니다.

```typescript
import { createSmartAccountClient } from '@stablenet/core'
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createVerifyingPaymaster } from '@stablenet/plugin-paymaster'

const client = createSmartAccountClient({
  account: await toKernelSmartAccount({ ... }),
  chain: mainnet,
  transport: http(),
  paymaster: createVerifyingPaymaster({ ... }),  // optional
  bundlerTransport: http('https://bundler.example.com'),
})
```

**Config Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `account` | `SmartAccount` | Yes | Smart account instance |
| `chain` | `Chain` | Yes | Target blockchain |
| `transport` | `Transport` | Yes | RPC transport |
| `paymaster` | `PaymasterClient` | No | Paymaster for gas sponsorship |
| `bundlerTransport` | `Transport` | No | Bundler RPC transport |

**Actions:**

```typescript
// Send UserOperation
const hash = await client.sendUserOperation({
  calls: [
    { to: '0x...', value: parseEther('0.1'), data: '0x' },
  ],
})

// Send transaction (simplified)
const txHash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
})

// Wait for receipt
const receipt = await client.waitForUserOperationReceipt({ hash })
```

#### `createBundlerClient`

ERC-4337 Bundler와 통신하는 클라이언트를 생성합니다.

```typescript
import { createBundlerClient } from '@stablenet/core'

const bundler = createBundlerClient({
  transport: http('https://bundler.example.com'),
  entryPoint: ENTRY_POINT_V07_ADDRESS,
})

// Estimate gas
const gasEstimate = await bundler.estimateUserOperationGas(userOp)

// Send UserOperation
const hash = await bundler.sendUserOperation(userOp)

// Get receipt
const receipt = await bundler.getUserOperationReceipt(hash)
```

### EIP-7702 Support

EOA에 스마트 컨트랙트 코드를 위임하는 EIP-7702를 지원합니다.

```typescript
import {
  createAuthorization,
  createSignedAuthorization,
  isDelegatedAccount,
  getDelegationStatus,
  DELEGATE_PRESETS,
} from '@stablenet/core'

// Create authorization
const auth = createAuthorization({
  chainId: 1n,
  address: DELEGATE_PRESETS.kernel.address, // delegate contract
  nonce: 0n,
})

// Sign authorization
const signedAuth = createSignedAuthorization(auth, signature)

// Check delegation status
const status = await getDelegationStatus(publicClient, eoaAddress)
// { isDelegated: true, delegateAddress: '0x...', delegateType: 'kernel' }
```

### Error Handling

SDK는 구조화된 에러 타입을 제공합니다.

```typescript
import {
  SdkError,
  BundlerError,
  UserOperationError,
  isBundlerError,
  withErrorHandling,
  SDK_ERROR_CODES,
} from '@stablenet/core'

try {
  await client.sendUserOperation({ calls })
} catch (error) {
  if (isBundlerError(error)) {
    console.error('Bundler error:', error.code, error.message)
    // AA21: didn't pay prefund
    // AA23: reverted (reason)
  }
}

// Or use withErrorHandling wrapper
const result = await withErrorHandling(
  () => client.sendUserOperation({ calls }),
  { retries: 3, retryDelay: 1000 }
)
```

### Utilities

```typescript
import {
  packUserOperation,
  unpackUserOperation,
  getUserOperationHash,
} from '@stablenet/core'

// Pack UserOperation for bundler
const packed = packUserOperation(userOp)

// Get UserOperation hash
const hash = getUserOperationHash(userOp, entryPoint, chainId)
```

---

## @stablenet/accounts

### `toKernelSmartAccount`

Kernel v3.1 스마트 계정을 생성합니다.

```typescript
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
import { privateKeyToAccount } from 'viem/accounts'

const owner = privateKeyToAccount('0x...')

const account = await toKernelSmartAccount({
  client: publicClient,
  owner,
  validator: createEcdsaValidator({ signer: owner }),
  index: 0n, // optional: salt for address derivation
})

console.log('Smart Account:', account.address)
```

**Config Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `client` | `PublicClient` | Yes | Viem public client |
| `owner` | `Account` | Yes | Owner account (EOA) |
| `validator` | `Validator` | Yes | Validation module |
| `index` | `bigint` | No | Salt for counterfactual address |
| `factoryAddress` | `Address` | No | Custom factory address |
| `entryPoint` | `Address` | No | Custom EntryPoint address |

### Encoding Utilities

```typescript
import {
  encodeSingleCall,
  encodeBatchCalls,
  encodeExecutionMode,
} from '@stablenet/accounts'

// Single call
const callData = encodeSingleCall({
  to: '0x...',
  value: parseEther('0.1'),
  data: '0x',
})

// Batch calls
const batchData = encodeBatchCalls([
  { to: '0x...', value: 0n, data: approveData },
  { to: '0x...', value: 0n, data: transferData },
])
```

---

## @stablenet/plugin-paymaster

### Verifying Paymaster

오프체인 서명 기반 가스 후원:

```typescript
import {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
} from '@stablenet/plugin-paymaster'

// With signer account
const paymaster = createVerifyingPaymaster({
  paymasterAddress: '0x...',
  signer: privateKeyToAccount('0x...'),
  chainId: 1n,
  validitySeconds: 300, // 5 minutes
})

// Or from private key directly
const paymaster = createVerifyingPaymasterFromPrivateKey({
  paymasterAddress: '0x...',
  privateKey: '0x...',
  chainId: 1n,
})
```

### Sponsor Paymaster

API 기반 가스 후원:

```typescript
import {
  createSponsorPaymaster,
  createSponsorPaymasterWithPolicy,
} from '@stablenet/plugin-paymaster'

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
    maxGasLimit: 500000n,
    allowedContracts: ['0x...'],
  },
})
```

---

## @stablenet/plugin-stealth

### Stealth Address Generation

```typescript
import {
  createStealthClient,
  generateStealthAddress,
  computeStealthKey,
  watchAnnouncementsWithKey,
  parseStealthMetaAddressUri,
} from '@stablenet/plugin-stealth'

// Parse recipient's stealth meta-address
const metaAddress = parseStealthMetaAddressUri('st:eth:0x...')

// Generate stealth address for payment
const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
  stealthMetaAddressUri: 'st:eth:0x...',
})

// Send payment to stealthAddress
await client.sendTransaction({
  to: stealthAddress,
  value: parseEther('1.0'),
})

// Announce on-chain
await stealthClient.announce({
  schemeId: 1,
  stealthAddress,
  ephemeralPubKey,
  metadata: viewTag,
})
```

### Watching for Payments

```typescript
const stealthClient = createStealthClient({
  publicClient,
  walletClient,
})

// Watch for incoming stealth payments
const unwatch = watchAnnouncementsWithKey({
  client: stealthClient,
  spendingPrivateKey: '0x...',
  viewingPrivateKey: '0x...',
  onAnnouncement: (announcement, stealthKey) => {
    console.log('Received payment!')
    console.log('Stealth address:', stealthKey.stealthAddress)
    console.log('Private key:', stealthKey.stealthPrivateKey)
  },
})

// Cleanup
unwatch()
```

### Registry Operations

```typescript
// Register stealth meta-address
await stealthClient.registerStealthMetaAddress({
  spendingPublicKey: '0x...',
  viewingPublicKey: '0x...',
})

// Get registered meta-address
const metaAddress = await stealthClient.getStealthMetaAddress(ownerAddress)
```

---

## @stablenet/plugin-subscription

### Creating Subscriptions

```typescript
import {
  createSubscriptionClient,
  createSubscription,
  cancelSubscription,
} from '@stablenet/plugin-subscription'

const subscriptionClient = createSubscriptionClient({
  publicClient,
  walletClient,
  executorUrl: 'https://subscription.stablenet.io',
})

// Create recurring payment
const subscription = await subscriptionClient.createSubscription({
  recipient: '0x...',
  token: USDC_ADDRESS,
  amount: parseUnits('10', 6), // 10 USDC
  intervalDays: 30,
  maxExecutions: 12, // 1 year
})

console.log('Subscription ID:', subscription.id)
```

### Managing Subscriptions

```typescript
// Get subscription details
const sub = await subscriptionClient.getSubscription(subscriptionId)

// Pause subscription
await subscriptionClient.pauseSubscription(subscriptionId)

// Resume subscription
await subscriptionClient.resumeSubscription(subscriptionId)

// Cancel subscription
await subscriptionClient.cancelSubscription(subscriptionId)

// List all subscriptions for account
const subscriptions = await subscriptionClient.getSubscriptionsByAccount(
  accountAddress
)
```

---

## Constants

```typescript
import {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  KERNEL_ADDRESSES,
  MODULE_TYPE,
  EXEC_MODE,
  CALL_TYPE,
} from '@stablenet/core'

// EntryPoint v0.7
ENTRY_POINT_V07_ADDRESS // '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

// Kernel addresses by chain
KERNEL_ADDRESSES[1] // mainnet addresses
KERNEL_ADDRESSES[11155111] // sepolia addresses

// Module types for ERC-7579
MODULE_TYPE.VALIDATOR // 1
MODULE_TYPE.EXECUTOR  // 2
MODULE_TYPE.FALLBACK  // 3
MODULE_TYPE.HOOK      // 4
```

---

## Type Definitions

주요 타입 정의는 `@stablenet/types` 패키지에서 제공됩니다:

```typescript
import type {
  UserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  SmartAccount,
  Validator,
  PaymasterClient,
  BundlerClient,
  Call,
} from '@stablenet/types'
```

전체 타입 정의는 [TypeScript declarations](../../packages/sdk/packages/types/src/index.ts)를 참조하세요.

---

## Related Documentation

- [SDK Tutorial](../tutorials/getting-started.md)
- [Service API Reference](../../services/README.md)
- [Deployment Guide](../../deployment/README.md)
