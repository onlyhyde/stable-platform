/**
 * Full E2E UserOp Test for StableNet Local (chainId 8283, native coin: WKRC)
 *
 * Fixes applied:
 * 1. Kernel v3: No mode prefix in signature (mode is in nonce, not signature)
 * 2. VerifyingPaymaster: Full paymasterData with validUntil + validAfter + signature
 * 3. Proper paymaster hash computation matching VerifyingPaymaster.sol getHash()
 */
import {
  type Address,
  type Hex,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  pad,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  chainId: 8283n,
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  factory: '0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3' as Address,
  ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  paymaster: '0x4217f538f989f617b5f8afdf5b18568ffd5bb271' as Address,
  // Account owner
  senderPrivateKey:
    '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
  // Paymaster signer (signs paymaster data to approve gas sponsorship)
  paymasterSignerKey:
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
}

const KERNEL_ACCOUNT_ABI = [
  {
    type: 'function', name: 'execute',
    inputs: [{ name: 'mode', type: 'bytes32' }, { name: 'executionCalldata', type: 'bytes' }],
    outputs: [], stateMutability: 'payable',
  },
  {
    type: 'function', name: 'initialize',
    inputs: [
      { name: 'rootValidator', type: 'bytes21' }, { name: 'hook', type: 'address' },
      { name: 'validatorData', type: 'bytes' }, { name: 'hookData', type: 'bytes' },
      { name: 'initConfig', type: 'bytes[]' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
] as const

const KERNEL_FACTORY_ABI = [
  {
    type: 'function', name: 'createAccount',
    inputs: [{ name: 'initData', type: 'bytes' }, { name: 'salt', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }], stateMutability: 'payable',
  },
  {
    type: 'function', name: 'getAddress',
    inputs: [{ name: 'initData', type: 'bytes' }, { name: 'salt', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }], stateMutability: 'view',
  },
] as const

const EP_ABI = [
  {
    type: 'function', name: 'getUserOpHash',
    inputs: [{
      name: 'userOp', type: 'tuple',
      components: [
        { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' },
        { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' },
        { name: 'signature', type: 'bytes' },
      ],
    }],
    outputs: [{ type: 'bytes32' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'simulateValidation',
    inputs: [{
      name: 'userOp', type: 'tuple',
      components: [
        { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' },
        { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' },
        { name: 'signature', type: 'bytes' },
      ],
    }],
    outputs: [], stateMutability: 'nonpayable',
  },
] as const

function packGasLimits(a: bigint, b: bigint): Hex {
  return concat([pad(toHex(a), { size: 16 }), pad(toHex(b), { size: 16 })]) as Hex
}

/**
 * Compute VerifyingPaymaster hash (matches VerifyingPaymaster.sol getHash())
 */
function computePaymasterHash(params: {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  chainId: bigint
  paymasterAddress: Address
  validUntil: bigint
  validAfter: bigint
}): Hex {
  return keccak256(
    encodePacked(
      [
        'address',   // sender
        'uint256',   // nonce
        'bytes32',   // keccak256(initCode)
        'bytes32',   // keccak256(callData)
        'bytes32',   // accountGasLimits
        'uint256',   // preVerificationGas
        'bytes32',   // gasFees
        'uint256',   // chainId
        'address',   // paymaster address
        'uint48',    // validUntil
        'uint48',    // validAfter
      ],
      [
        params.sender,
        params.nonce,
        keccak256(params.initCode),
        keccak256(params.callData),
        params.accountGasLimits as `0x${string}`,
        params.preVerificationGas,
        params.gasFees as `0x${string}`,
        params.chainId,
        params.paymasterAddress,
        Number(params.validUntil),
        Number(params.validAfter),
      ]
    )
  )
}

function parseRevertResult(raw: string): { type: string; reason?: string; inner?: string; raw?: string } {
  if (!raw || raw === '0x') return { type: 'empty', raw: '' }
  if (raw.startsWith('0xe0cff05f')) return { type: 'ValidationResult' }
  if (raw.startsWith('0x220266b6') || raw.startsWith('0x65c8fd4d')) {
    const isWithRevert = raw.startsWith('0x65c8fd4d')
    const decoded = raw.slice(10)
    try {
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      let inner: string | undefined
      if (isWithRevert) {
        const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2
        const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
        inner = '0x' + decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)
      }
      return { type: isWithRevert ? 'FailedOpWithRevert' : 'FailedOp', reason, inner }
    } catch {
      return { type: 'decode_error', raw: raw.slice(0, 200) }
    }
  }
  return { type: 'unknown', raw: raw.slice(0, 200) }
}

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const paymasterSigner = privateKeyToAccount(CONFIG.paymasterSignerKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  console.log('=== Full E2E UserOp Test (StableNet Local / WKRC) ===\n')
  console.log('Account Owner:', signer.address)
  console.log('Paymaster Signer:', paymasterSigner.address)

  // 1. Build init data for Kernel smart account
  const rootValidator = concat([pad(toHex(1n), { size: 1 }), CONFIG.ecdsaValidator]) as Hex
  const initializeData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'initialize',
    args: [
      rootValidator,
      '0x0000000000000000000000000000000000000000' as Address,
      signer.address,
      '0x' as Hex,
      [],
    ],
  })
  const salt = pad(toHex(0n), { size: 32 })

  const smartAccountAddress = (await publicClient.readContract({
    address: CONFIG.factory,
    abi: KERNEL_FACTORY_ABI,
    functionName: 'getAddress',
    args: [initializeData, salt],
  })) as Address
  console.log('Smart Account:', smartAccountAddress)

  // 2. Build callData (simple self-call / no-op)
  const factoryData = encodeFunctionData({
    abi: KERNEL_FACTORY_ABI,
    functionName: 'createAccount',
    args: [initializeData, salt],
  })
  const initCode = concat([CONFIG.factory, factoryData]) as Hex

  const execMode = `0x${'00'.repeat(32)}` as Hex
  const executionCalldata = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
    [smartAccountAddress, 0n, '0x' as Hex],
  )
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })

  // 3. Gas parameters
  const verificationGasLimit = 500000n
  const callGasLimit = 200000n
  const preVerificationGas = 100000n
  const maxPriorityFeePerGas = 1000000000n  // 1 gwei
  const maxFeePerGas = 2000000000n           // 2 gwei
  const paymasterVerificationGasLimit = 200000n
  const paymasterPostOpGasLimit = 100000n

  const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit)
  const gasFees = packGasLimits(maxPriorityFeePerGas, maxFeePerGas)

  // 4. Build paymaster data with proper signature
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  const validAfter = 0n

  // Compute paymaster hash
  const paymasterHash = computePaymasterHash({
    sender: smartAccountAddress,
    nonce: 0n, // Kernel v3: nonce=0 → root validator, default mode
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    chainId: CONFIG.chainId,
    paymasterAddress: CONFIG.paymaster,
    validUntil,
    validAfter,
  })
  console.log('\nPaymaster hash:', paymasterHash)

  // Sign paymaster hash
  const paymasterSignature = await paymasterSigner.signMessage({
    message: { raw: paymasterHash },
  })
  console.log('Paymaster signature:', paymasterSignature.slice(0, 20) + '...')

  // Encode paymasterData: validUntil(6B) + validAfter(6B) + signature(65B)
  const paymasterData = concat([
    pad(toHex(validUntil), { size: 6 }),
    pad(toHex(validAfter), { size: 6 }),
    paymasterSignature,
  ]) as Hex

  // Full paymasterAndData: paymaster(20B) + verificationGasLimit(16B) + postOpGasLimit(16B) + paymasterData
  const paymasterAndData = concat([
    CONFIG.paymaster,
    pad(toHex(paymasterVerificationGasLimit), { size: 16 }),
    pad(toHex(paymasterPostOpGasLimit), { size: 16 }),
    paymasterData,
  ]) as Hex
  console.log('paymasterAndData length:', (paymasterAndData.length - 2) / 2, 'bytes')

  // 5. Build packed UserOp (with placeholder signature for hash)
  const packedOp = {
    sender: smartAccountAddress,
    nonce: 0n, // Kernel v3: root validator, default mode
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: '0x' as Hex,
  }

  // 6. Get UserOp hash from EntryPoint
  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  console.log('UserOp hash:', userOpHash)

  // 7. Sign UserOp hash - NO mode prefix (Kernel v3)
  const userOpSignature = await signer.signMessage({
    message: { raw: userOpHash },
  })
  console.log('UserOp signature:', userOpSignature.slice(0, 20) + '... (', (userOpSignature.length - 2) / 2, 'bytes)')

  // 8. Simulate validation
  console.log('\n--- simulateValidation ---')
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature: userOpSignature }],
    })
    console.log('UNEXPECTED: no revert')
  } catch (err: any) {
    const raw: string = err?.cause?.raw || err?.cause?.data || ''
    const result = parseRevertResult(raw)
    if (result.type === 'ValidationResult') {
      console.log('SUCCESS! ValidationResult returned')
      console.log('  → Account + Paymaster validation passed')
      console.log('  → Ready to send to bundler')
    } else if (result.type === 'FailedOp') {
      console.log(`FAILED: FailedOp "${result.reason}"`)
    } else if (result.type === 'FailedOpWithRevert') {
      console.log(`FAILED: FailedOpWithRevert "${result.reason}" inner=${result.inner}`)
    } else {
      console.log('UNKNOWN result:', result.raw)

      // Try to check if this unknown error might be ValidationResult with different encoding
      if (raw) {
        const selector = raw.slice(0, 10)
        console.log('  Selector:', selector)
      }
    }
  }

  // 9. If simulation passed, send to bundler
  console.log('\n--- Send to bundler (eth_sendUserOperation) ---')
  try {
    const bundlerUrl = 'http://localhost:4337'
    const response = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: smartAccountAddress,
            nonce: toHex(0n),
            factory: CONFIG.factory,
            factoryData: factoryData,
            callData,
            callGasLimit: toHex(callGasLimit),
            verificationGasLimit: toHex(verificationGasLimit),
            preVerificationGas: toHex(preVerificationGas),
            maxFeePerGas: toHex(maxFeePerGas),
            maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
            paymaster: CONFIG.paymaster,
            paymasterData,
            paymasterVerificationGasLimit: toHex(paymasterVerificationGasLimit),
            paymasterPostOpGasLimit: toHex(paymasterPostOpGasLimit),
            signature: userOpSignature,
          },
          CONFIG.entryPoint,
        ],
        id: 1,
      }),
    })
    const result = await response.json()
    if (result.error) {
      console.log('Bundler error:', JSON.stringify(result.error, null, 2))
    } else {
      console.log('UserOp hash from bundler:', result.result)

      // Wait for receipt
      console.log('Waiting for receipt...')
      await new Promise((r) => setTimeout(r, 5000))

      const receiptRes = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getUserOperationReceipt',
          params: [result.result],
          id: 2,
        }),
      })
      const receipt = await receiptRes.json()
      if (receipt.result) {
        console.log('Receipt:', JSON.stringify(receipt.result, null, 2).slice(0, 500))
      } else {
        console.log('No receipt yet. Checking mempool...')
        const statusRes = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'debug_bundler_getStatus',
            params: [],
            id: 3,
          }),
        })
        const status = await statusRes.json()
        console.log('Mempool status:', JSON.stringify(status.result, null, 2))
      }
    }
  } catch (err: any) {
    console.log('Bundler request failed:', err.message)
  }
}

main().catch(console.error)
