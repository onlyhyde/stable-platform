/**
 * Bundler UserOp E2E Test Script
 *
 * Tests the full flow:
 * 1. Calculate counterfactual smart account address via Factory
 * 2. Build UserOp with initCode (account creation) + simple callData
 * 3. Sign the UserOp with ECDSA validator
 * 4. Send to bundler via eth_sendUserOperation
 * 5. Verify the result
 */

import {
  type Address,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  pad,
  stringToHex,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  bundlerUrl: 'http://localhost:4337',
  chainId: 8283n,

  // Contracts
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  factory: '0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3' as Address,
  ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  paymaster: '0x4217f538f989f617b5f8afdf5b18568ffd5bb271' as Address,

  // Sender (owner) private key
  senderPrivateKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
}

// =============================================================================
// ABIs
// =============================================================================

const KERNEL_ACCOUNT_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'mode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'rootValidator', type: 'bytes21' },
      { name: 'hook', type: 'address' },
      { name: 'validatorData', type: 'bytes' },
      { name: 'hookData', type: 'bytes' },
      { name: 'initConfig', type: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const KERNEL_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getAddress',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

const ENTRY_POINT_ABI = [
  {
    type: 'function',
    name: 'getNonce',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// =============================================================================
// Encoding Helpers
// =============================================================================

/** Encode root validator: bytes21 = MODULE_TYPE(1 byte) + address(20 bytes) */
function encodeRootValidator(validatorAddress: Address): Hex {
  const moduleTypeByte = pad(toHex(1n), { size: 1 }) // VALIDATOR = 1
  return concat([moduleTypeByte, validatorAddress]) as Hex
}

/** Encode Kernel initialize function data */
function encodeInitializeData(validatorAddress: Address, signerAddress: Address): Hex {
  const rootValidator = encodeRootValidator(validatorAddress)
  const hookAddress = '0x0000000000000000000000000000000000000000' as Address
  const hookData = '0x' as Hex
  const initConfig: Hex[] = []

  return encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'initialize',
    args: [rootValidator, hookAddress, signerAddress, hookData, initConfig],
  })
}

/** Encode factory createAccount call data */
function encodeFactoryData(initializeData: Hex, salt: Hex): Hex {
  return encodeFunctionData({
    abi: KERNEL_FACTORY_ABI,
    functionName: 'createAccount',
    args: [initializeData, salt],
  })
}

/** Encode single call execution for Kernel execute */
function encodeKernelExecuteCallData(to: Address, value: bigint, data: Hex): Hex {
  // Single call mode: callType=0x00, execMode=0x00
  const mode = `0x${'00'.repeat(32)}` as Hex

  // Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
  const executionCalldata = concat([
    to,                              // 20 bytes: target address
    pad(toHex(value), { size: 32 }), // 32 bytes: value
    data,                            // variable: raw calldata
  ]) as Hex

  return encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [mode, executionCalldata],
  })
}

/** Pack UserOp for v0.7 RPC format */
function packForRpc(userOp: {
  sender: Address
  nonce: bigint
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: Address
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: Hex
  signature: Hex
}) {
  // initCode = factory + factoryData (or 0x if no factory)
  const initCode =
    userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

  // accountGasLimits = verificationGasLimit(16 bytes) + callGasLimit(16 bytes)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  // gasFees = maxPriorityFeePerGas(16 bytes) + maxFeePerGas(16 bytes)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  // paymasterAndData = paymaster(20) + paymasterVerificationGasLimit(16) + paymasterPostOpGasLimit(16) + paymasterData
  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    paymasterAndData = concat([
      userOp.paymaster,
      pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
      pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
      userOp.paymasterData ?? '0x',
    ]) as Hex
  }

  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: toHex(userOp.preVerificationGas),
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  }
}

/** EIP-712 / ERC-4337 v0.9 Hash Constants */
const PACKED_USEROP_TYPEHASH = keccak256(
  stringToHex(
    'PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)'
  )
)
const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)
const EIP712_DOMAIN_NAME_HASH = keccak256(stringToHex('ERC4337'))
const EIP712_DOMAIN_VERSION_HASH = keccak256(stringToHex('1'))

/** Compute UserOperation hash (ERC-4337 v0.9 EIP-712) */
function computeUserOpHash(
  packed: ReturnType<typeof packForRpc>,
  entryPoint: Address,
  chainId: bigint
): Hex {
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
      ],
      [
        PACKED_USEROP_TYPEHASH,
        packed.sender,
        BigInt(packed.nonce),
        keccak256(packed.initCode as Hex),
        keccak256(packed.callData),
        packed.accountGasLimits as Hex,
        BigInt(packed.preVerificationGas),
        packed.gasFees as Hex,
        keccak256(packed.paymasterAndData as Hex),
      ]
    )
  )

  const domainSeparator = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
      [EIP712_DOMAIN_TYPEHASH, EIP712_DOMAIN_NAME_HASH, EIP712_DOMAIN_VERSION_HASH, chainId, entryPoint]
    )
  )

  return keccak256(concat(['0x1901' as Hex, domainSeparator, structHash]))
}

/** Send JSON-RPC request to bundler */
async function rpcCall(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
  })
  return response.json()
}

// =============================================================================
// Main Test
// =============================================================================

async function main() {
  // 1. Setup
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)

  const publicClient = createPublicClient({
    transport: http(CONFIG.rpcUrl),
  })

  // 2. Encode initialization data for Kernel account
  const initializeData = encodeInitializeData(CONFIG.ecdsaValidator, signer.address)
  const salt = pad(toHex(0n), { size: 32 })

  // 3. Get counterfactual address from Factory
  let smartAccountAddress: Address
  try {
    smartAccountAddress = await publicClient.readContract({
      address: CONFIG.factory,
      abi: KERNEL_FACTORY_ABI,
      functionName: 'getAddress',
      args: [initializeData, salt],
    })
  } catch (e) {
    console.error(`[3] Failed to get address from factory:`, e)
    process.exit(1)
  }

  // 4. Check if account is already deployed
  const code = await publicClient.getCode({ address: smartAccountAddress })
  const isDeployed = code !== undefined && code !== '0x'

  // 5. Get nonce from EntryPoint
  const nonce = await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: ENTRY_POINT_ABI,
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })

  // 6. Prepare factory data (only if not deployed)
  const factory = isDeployed ? undefined : CONFIG.factory
  const factoryData = isDeployed ? undefined : encodeFactoryData(initializeData, salt)
  if (factory) {
  } else {
  }

  // 7. Encode callData (simple 0 value call to self as a no-op)
  const callData = encodeKernelExecuteCallData(
    smartAccountAddress, // call to self
    0n,
    '0x' as Hex
  )

  // 8. Get gas prices
  const gasPrice = await publicClient.getGasPrice()
  const maxFeePerGas = gasPrice * 2n
  const maxPriorityFeePerGas = gasPrice

  // 9. Build UserOp
  const userOp = {
    sender: smartAccountAddress,
    nonce,
    factory,
    factoryData,
    callData,
    callGasLimit: 200000n,
    verificationGasLimit: isDeployed ? 200000n : 500000n, // Higher for account creation
    preVerificationGas: 100000n,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymaster: CONFIG.paymaster,
    paymasterVerificationGasLimit: 200000n,
    paymasterPostOpGasLimit: 100000n,
    paymasterData: '0x' as Hex,
    signature: '0x' as Hex, // placeholder
  }

  // 10. Pack and compute hash
  const packed = packForRpc(userOp)
  const userOpHash = computeUserOpHash(packed, CONFIG.entryPoint, CONFIG.chainId)

  // 11. Sign with ECDSA validator (Kernel v3 format: 0x02 + signature)
  const rawSignature = await signer.signMessage({
    message: { raw: userOpHash },
  })
  const signature = concat(['0x02' as Hex, rawSignature]) as Hex

  // 12. Update packed UserOp with real signature
  packed.signature = signature

  const result = await rpcCall(CONFIG.bundlerUrl, 'eth_sendUserOperation', [
    packed,
    CONFIG.entryPoint,
  ])

  if (result.error) {
    console.error(`\n[ERROR] Bundler rejected UserOp:`)
    console.error(`   Code: ${result.error.code}`)
    console.error(`   Message: ${result.error.message}`)
    if (result.error.data) {
      console.error(`   Data:`, result.error.data)
    }
  } else {
    await new Promise((r) => setTimeout(r, 5000))

    const receipt = await rpcCall(CONFIG.bundlerUrl, 'eth_getUserOperationReceipt', [result.result])

    if (receipt.result) {
    } else {
      // Check mempool
      const _mempool = await rpcCall(CONFIG.bundlerUrl, 'debug_bundler_dumpMempool', [
        CONFIG.entryPoint,
      ])
    }
  }
  const _finalCode = await publicClient.getCode({ address: smartAccountAddress })

  const _finalNonce = await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: ENTRY_POINT_ABI,
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })
}

main().catch(console.error)
