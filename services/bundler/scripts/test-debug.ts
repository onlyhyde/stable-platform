/**
 * Debug: Test factory createAccount and trace the full validation flow
 */
import {
  type Address,
  type Hex,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
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
  senderPrivateKey:
    '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
}

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

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  console.log('=== Debug UserOp Flow ===\n')
  console.log('Signer:', signer.address)

  // 1. Build init data
  const rootValidator = concat([
    pad(toHex(1n), { size: 1 }),
    CONFIG.ecdsaValidator,
  ]) as Hex
  console.log('\nrootValidator (bytes21):', rootValidator)

  const initializeData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'initialize',
    args: [
      rootValidator,
      '0x0000000000000000000000000000000000000000' as Address,
      signer.address, // validatorData = signer address as bytes
      '0x' as Hex,
      [],
    ],
  })
  console.log('initializeData:', initializeData.slice(0, 80) + '...')

  const salt = pad(toHex(0n), { size: 32 })

  // 2. Get counterfactual address
  const smartAccountAddress = (await publicClient.readContract({
    address: CONFIG.factory,
    abi: KERNEL_FACTORY_ABI,
    functionName: 'getAddress',
    args: [initializeData, salt],
  })) as Address
  console.log('Smart Account:', smartAccountAddress)

  // 3. Test factory.createAccount simulation
  console.log('\n--- Test 1: Simulate factory.createAccount ---')
  try {
    const result = await publicClient.simulateContract({
      address: CONFIG.factory,
      abi: KERNEL_FACTORY_ABI,
      functionName: 'createAccount',
      args: [initializeData, salt],
    })
    console.log('SUCCESS! Created account at:', result.result)
  } catch (err: any) {
    console.log('FAILED:', err?.shortMessage || err?.message)
    if (err?.cause?.raw) console.log('Raw:', err.cause.raw.slice(0, 200))
  }

  // 4. Build packed UserOp and get EntryPoint hash
  const factoryData = encodeFunctionData({
    abi: KERNEL_FACTORY_ABI,
    functionName: 'createAccount',
    args: [initializeData, salt],
  })
  const initCode = concat([CONFIG.factory, factoryData]) as Hex

  const mode = `0x${'00'.repeat(32)}` as Hex
  const executionCalldata = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
    [smartAccountAddress, 0n, '0x' as Hex],
  )
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [mode, executionCalldata],
  })

  // Use fixed gas values for reproducibility
  const maxPriorityFeePerGas = 1000000000n // 1 gwei
  const maxFeePerGas = 2000000000n // 2 gwei

  const accountGasLimits = concat([
    pad(toHex(500000n), { size: 16 }),
    pad(toHex(200000n), { size: 16 }),
  ]) as Hex
  const gasFees = concat([
    pad(toHex(maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(maxFeePerGas), { size: 16 }),
  ]) as Hex
  const paymasterAndData = concat([
    CONFIG.paymaster,
    pad(toHex(200000n), { size: 16 }),
    pad(toHex(100000n), { size: 16 }),
  ]) as Hex

  const packedOp = {
    sender: smartAccountAddress,
    nonce: 0n,
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas: 100000n,
    gasFees,
    paymasterAndData,
    signature: '0x' as Hex,
  }

  // Get EntryPoint's hash
  const EP_ABI = [
    {
      type: 'function',
      name: 'getUserOpHash',
      inputs: [{
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      }],
      outputs: [{ type: 'bytes32' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'simulateValidation',
      inputs: [{
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const

  console.log('\n--- Test 2: Get EntryPoint hash ---')
  const entryPointHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  console.log('EntryPoint hash:', entryPointHash)

  // Sign with correct hash
  const rawSignature = await signer.signMessage({
    message: { raw: entryPointHash },
  })
  const signature = concat(['0x02' as Hex, rawSignature]) as Hex
  console.log('Signature (mode 0x02):', signature.slice(0, 40) + '...')

  // 5. Simulate with correct signature
  console.log('\n--- Test 3: Simulate with correct signature ---')
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature }],
    })
    console.log('UNEXPECTED: no revert')
  } catch (err: any) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
      console.log('SUCCESS! ValidationResult (simulation passed)')
      // Decode validation data
      try {
        const data = raw.slice(10) // remove selector
        console.log('  (has validation result data)')
      } catch {}
    } else if (raw.startsWith('0x65c8fd4d')) {
      // FailedOpWithRevert - decode reason and inner
      console.log('FAILED: FailedOpWithRevert')
      // Decode manually: opIndex(32) + offset_reason(32) + offset_inner(32) + reason_len + reason + inner_len + inner
      try {
        const decoded = raw.slice(10) // remove selector
        // opIndex at offset 0: 32 bytes
        const opIndex = parseInt(decoded.slice(0, 64), 16)
        // offset for reason: 32 bytes
        const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
        // offset for inner: 32 bytes
        const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2

        // Read reason string
        const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
        const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
        const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')

        // Read inner bytes
        const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
        const inner = decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)

        console.log(`  opIndex: ${opIndex}`)
        console.log(`  reason: "${reason}"`)
        console.log(`  inner: 0x${inner}`)
        console.log(`  inner selector: 0x${inner.slice(0, 8)}`)
      } catch (e) {
        console.log('  (decode failed)', e)
        console.log('  raw:', raw.slice(0, 400))
      }
    } else if (raw.startsWith('0x220266b6')) {
      console.log('FAILED: FailedOp')
      console.log('Raw:', raw.slice(0, 300))
    } else {
      console.log('Unknown error')
      console.log('Raw:', raw ? raw.slice(0, 300) : 'no raw data')
      console.log('Message:', err?.shortMessage || err?.message)
    }
  }

  // 6. Try without paymaster
  console.log('\n--- Test 4: Simulate WITHOUT paymaster ---')
  const packedOpNoPaymaster = {
    ...packedOp,
    paymasterAndData: '0x' as Hex,
  }
  const hashNoPaymaster = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOpNoPaymaster],
  })) as Hex
  const rawSigNoPaymaster = await signer.signMessage({
    message: { raw: hashNoPaymaster },
  })
  const sigNoPaymaster = concat(['0x02' as Hex, rawSigNoPaymaster]) as Hex

  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOpNoPaymaster, signature: sigNoPaymaster }],
    })
  } catch (err: any) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
      console.log('SUCCESS! ValidationResult (simulation passed without paymaster)')
    } else if (raw.startsWith('0x65c8fd4d')) {
      console.log('FAILED: FailedOpWithRevert (still fails without paymaster)')
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2
      const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
      const inner = decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)
      console.log(`  reason: "${reason}", inner: 0x${inner}`)
    } else if (raw.startsWith('0x220266b6')) {
      console.log('FAILED: FailedOp')
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      console.log(`  reason: "${reason}"`)
    } else {
      console.log('Unknown result:', raw ? raw.slice(0, 200) : 'no raw')
    }
  }

  // 7. Try with mode 0x00 (enable mode)
  console.log('\n--- Test 5: Simulate with mode 0x00 (enable mode) signature ---')
  const sig00 = concat(['0x00' as Hex, rawSignature]) as Hex
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature: concat(['0x00' as Hex, (await signer.signMessage({ message: { raw: entryPointHash } }))]) }],
    })
  } catch (err: any) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
      console.log('SUCCESS with mode 0x00!')
    } else {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      console.log(`FAILED with mode 0x00: "${reason}"`)
    }
  }

  // 8. Try with raw signature (no mode prefix)
  console.log('\n--- Test 6: Simulate with raw signature (no mode prefix) ---')
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature: await signer.signMessage({ message: { raw: entryPointHash } }) }],
    })
  } catch (err: any) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
      console.log('SUCCESS with raw signature (no mode prefix)!')
    } else {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      console.log(`FAILED with raw signature: "${reason}"`)
    }
  }
}

main().catch(console.error)
