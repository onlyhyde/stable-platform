# StableNet SDK Tutorial: Getting Started

> **Version**: 1.0.0
> **Last Updated**: 2026-01-27

## Introduction

이 튜토리얼에서는 StableNet SDK를 사용하여 ERC-4337 스마트 계정을 생성하고, 가스 후원을 통한 트랜잭션 전송, 스텔스 주소를 활용한 프라이버시 결제까지 단계별로 학습합니다.

## Prerequisites

- Node.js 18+ 또는 20+ LTS
- TypeScript 5.0+
- 기본적인 Ethereum 및 viem 이해

---

## Step 1: Project Setup

### 1.1 Create New Project

```bash
mkdir my-stablenet-app
cd my-stablenet-app
npm init -y
```

### 1.2 Install Dependencies

```bash
npm install viem @stablenet/core @stablenet/accounts @stablenet/plugin-ecdsa @stablenet/plugin-paymaster
npm install -D typescript ts-node @types/node
```

### 1.3 Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

---

## Step 2: Create Smart Account

### 2.1 Basic Setup

```typescript
// src/01-create-account.ts
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'

async function main() {
  // 1. Create public client
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'),
  })

  // 2. Create owner account (EOA)
  // ⚠️ Never hardcode private keys in production!
  const owner = privateKeyToAccount('0x...')
  console.log('Owner EOA:', owner.address)

  // 3. Create ECDSA validator
  const validator = createEcdsaValidator({
    signer: owner,
  })

  // 4. Create Kernel smart account
  const account = await toKernelSmartAccount({
    client: publicClient,
    owner,
    validator,
    index: 0n, // Use different index for multiple accounts
  })

  console.log('Smart Account Address:', account.address)
  console.log('Is deployed:', await account.isDeployed())

  return account
}

main().catch(console.error)
```

### 2.2 Run the Script

```bash
npx ts-node src/01-create-account.ts
```

**Expected Output:**
```
Owner EOA: 0x1234...
Smart Account Address: 0xABCD...
Is deployed: false
```

> **Note**: Smart Account는 counterfactual address입니다. 첫 번째 트랜잭션 전송 시 자동으로 배포됩니다.

---

## Step 3: Send UserOperation

### 3.1 Create Smart Account Client

```typescript
// src/02-send-userop.ts
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
import { createSmartAccountClient, createBundlerClient } from '@stablenet/core'

async function main() {
  // Setup clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'),
  })

  const owner = privateKeyToAccount('0x...')

  // Create smart account
  const account = await toKernelSmartAccount({
    client: publicClient,
    owner,
    validator: createEcdsaValidator({ signer: owner }),
  })

  // Create smart account client with bundler
  const client = createSmartAccountClient({
    account,
    chain: sepolia,
    transport: http('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'),
    bundlerTransport: http('https://bundler.stablenet.io/sepolia'),
  })

  // Send UserOperation
  console.log('Sending UserOperation...')

  const hash = await client.sendUserOperation({
    calls: [
      {
        to: '0x0000000000000000000000000000000000000001', // Example recipient
        value: parseEther('0.001'),
        data: '0x',
      },
    ],
  })

  console.log('UserOperation Hash:', hash)

  // Wait for receipt
  const receipt = await client.waitForUserOperationReceipt({ hash })
  console.log('Transaction Hash:', receipt.receipt.transactionHash)
  console.log('Success:', receipt.success)
}

main().catch(console.error)
```

### 3.2 Batch Transactions

```typescript
// Multiple calls in single UserOperation
const hash = await client.sendUserOperation({
  calls: [
    // Approve token
    {
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, parseUnits('100', 6)],
      }),
    },
    // Transfer token
    {
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [RECIPIENT, parseUnits('50', 6)],
      }),
    },
  ],
})
```

---

## Step 4: Gas Sponsorship (Paymaster)

### 4.1 Using Verifying Paymaster

```typescript
// src/03-paymaster.ts
import { createSmartAccountClient } from '@stablenet/core'
import { createVerifyingPaymaster } from '@stablenet/plugin-paymaster'

// Create paymaster client
const paymaster = createVerifyingPaymaster({
  paymasterAddress: '0x...', // Paymaster contract address
  signer: paymasterSigner,    // Paymaster signer account
  chainId: 11155111n,         // Sepolia
  validitySeconds: 300,       // 5 minutes validity
})

// Create client with paymaster
const client = createSmartAccountClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
  bundlerTransport: http(BUNDLER_URL),
  paymaster, // 👈 Add paymaster
})

// Send gasless transaction
const hash = await client.sendUserOperation({
  calls: [
    {
      to: RECIPIENT,
      value: parseEther('0.01'),
      data: '0x',
    },
  ],
})

// User pays nothing for gas! 🎉
```

### 4.2 Using Sponsor Paymaster (API-based)

```typescript
import { createSponsorPaymaster } from '@stablenet/plugin-paymaster'

const paymaster = createSponsorPaymaster({
  paymasterUrl: 'https://paymaster.stablenet.io',
  apiKey: 'YOUR_API_KEY',
  chainId: 11155111n,
})

// Same usage as verifying paymaster
const client = createSmartAccountClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
  bundlerTransport: http(BUNDLER_URL),
  paymaster,
})
```

---

## Step 5: Stealth Addresses (Privacy)

### 5.1 Setup Stealth Keys

```typescript
// src/04-stealth.ts
import {
  generateStealthKeyPair,
  encodeStealthMetaAddressUri,
  parseStealthMetaAddressUri,
} from '@stablenet/plugin-stealth'

// Generate stealth key pair for receiver
const { spendingKeyPair, viewingKeyPair } = generateStealthKeyPair()

console.log('Spending Private Key:', spendingKeyPair.privateKey)
console.log('Viewing Private Key:', viewingKeyPair.privateKey)

// Create stealth meta-address URI to share with senders
const metaAddressUri = encodeStealthMetaAddressUri({
  spendingPubKey: spendingKeyPair.publicKey,
  viewingPubKey: viewingKeyPair.publicKey,
  chainPrefix: 'eth',
})

console.log('Share this with senders:', metaAddressUri)
// st:eth:0x04abc...def
```

### 5.2 Send Payment to Stealth Address

```typescript
import {
  generateStealthAddress,
  createStealthClient,
} from '@stablenet/plugin-stealth'

// Sender generates stealth address for recipient
const { stealthAddress, ephemeralPubKey, viewTag } = generateStealthAddress({
  stealthMetaAddressUri: 'st:eth:0x04abc...', // Recipient's meta-address
})

console.log('Stealth Address:', stealthAddress)

// Send payment to stealth address
const hash = await client.sendUserOperation({
  calls: [
    {
      to: stealthAddress,
      value: parseEther('1.0'),
      data: '0x',
    },
  ],
})

// Announce on-chain (so recipient can find it)
const stealthClient = createStealthClient({
  publicClient,
  walletClient,
})

await stealthClient.announce({
  schemeId: 1,
  stealthAddress,
  ephemeralPubKey,
  metadata: viewTag,
})
```

### 5.3 Receive Stealth Payment

```typescript
import {
  watchAnnouncementsWithKey,
  computeStealthKey,
} from '@stablenet/plugin-stealth'

// Recipient watches for incoming payments
const unwatch = watchAnnouncementsWithKey({
  client: stealthClient,
  spendingPrivateKey: '0x...', // Your spending key
  viewingPrivateKey: '0x...',  // Your viewing key
  onAnnouncement: (announcement, stealthKey) => {
    console.log('🎉 Received payment!')
    console.log('Stealth Address:', stealthKey.stealthAddress)
    console.log('Private Key:', stealthKey.stealthPrivateKey)

    // Now you can spend from this address using the private key
  },
})

// Cleanup when done
// unwatch()
```

---

## Step 6: Error Handling

### 6.1 Handling SDK Errors

```typescript
import {
  isBundlerError,
  isUserOperationError,
  SdkError,
  withErrorHandling,
} from '@stablenet/core'

try {
  await client.sendUserOperation({ calls })
} catch (error) {
  if (isBundlerError(error)) {
    // Bundler-specific errors
    switch (error.code) {
      case 'AA21':
        console.error('Account has insufficient funds for gas')
        break
      case 'AA23':
        console.error('Reverted during validation:', error.message)
        break
      case 'AA25':
        console.error('Invalid nonce')
        break
      default:
        console.error('Bundler error:', error.code, error.message)
    }
  } else if (isUserOperationError(error)) {
    console.error('UserOperation failed:', error.reason)
  } else {
    throw error
  }
}
```

### 6.2 Using withErrorHandling Wrapper

```typescript
const result = await withErrorHandling(
  () => client.sendUserOperation({ calls }),
  {
    retries: 3,
    retryDelay: 1000,
    onRetry: (error, attempt) => {
      console.log(`Retry ${attempt}: ${error.message}`)
    },
  }
)
```

---

## Step 7: Complete Example

```typescript
// src/complete-example.ts
import { createPublicClient, http, parseEther, parseUnits } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { toKernelSmartAccount } from '@stablenet/accounts'
import { createEcdsaValidator } from '@stablenet/plugin-ecdsa'
import { createSmartAccountClient } from '@stablenet/core'
import { createSponsorPaymaster } from '@stablenet/plugin-paymaster'

const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'
const BUNDLER_URL = 'https://bundler.stablenet.io/sepolia'
const PAYMASTER_URL = 'https://paymaster.stablenet.io/sepolia'

async function main() {
  // 1. Setup
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  })

  const owner = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)

  // 2. Create Smart Account
  const account = await toKernelSmartAccount({
    client: publicClient,
    owner,
    validator: createEcdsaValidator({ signer: owner }),
  })

  console.log('Smart Account:', account.address)

  // 3. Create Paymaster
  const paymaster = createSponsorPaymaster({
    paymasterUrl: PAYMASTER_URL,
    apiKey: process.env.PAYMASTER_API_KEY!,
    chainId: 11155111n,
  })

  // 4. Create Client
  const client = createSmartAccountClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
    bundlerTransport: http(BUNDLER_URL),
    paymaster,
  })

  // 5. Send Gasless Transaction
  console.log('Sending transaction...')

  const hash = await client.sendUserOperation({
    calls: [
      {
        to: '0x0000000000000000000000000000000000000001',
        value: parseEther('0.001'),
        data: '0x',
      },
    ],
  })

  console.log('UserOp Hash:', hash)

  // 6. Wait for confirmation
  const receipt = await client.waitForUserOperationReceipt({ hash })

  console.log('✅ Transaction confirmed!')
  console.log('TX Hash:', receipt.receipt.transactionHash)
  console.log('Gas Used:', receipt.actualGasUsed)
}

main().catch(console.error)
```

---

## Next Steps

- 📚 [SDK API Reference](../sdk/api/README.md) - 전체 API 문서
- 🔧 [Service API Reference](../services/README.md) - 서비스 API 문서
- 🚀 [Deployment Guide](../deployment/README.md) - 배포 가이드
- 📊 [Operations Guide](../operations/README.md) - 운영 가이드

## Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-5564 Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Viem Documentation](https://viem.sh)

---

## Troubleshooting

### "AA21: didn't pay prefund"

스마트 계정에 가스비를 위한 ETH가 부족합니다. 계정에 ETH를 충전하거나 Paymaster를 사용하세요.

### "AA25: invalid nonce"

잘못된 nonce입니다. 이전 트랜잭션이 완료될 때까지 기다리거나, 올바른 nonce를 확인하세요.

### "execution reverted"

트랜잭션 실행이 실패했습니다. 컨트랙트 호출 데이터와 권한을 확인하세요.
