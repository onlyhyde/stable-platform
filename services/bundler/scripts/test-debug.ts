/**
 * Debug: Test factory createAccount and trace the full validation flow
 */
import {
  type Address,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
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
  senderPrivateKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
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

  // 1. Build init data
  const rootValidator = concat([pad(toHex(1n), { size: 1 }), CONFIG.ecdsaValidator]) as Hex

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

  const salt = pad(toHex(0n), { size: 32 })

  // 2. Get counterfactual address
  const smartAccountAddress = (await publicClient.readContract({
    address: CONFIG.factory,
    abi: KERNEL_FACTORY_ABI,
    functionName: 'getAddress',
    args: [initializeData, salt],
  })) as Address
  try {
    const _result = await publicClient.simulateContract({
      address: CONFIG.factory,
      abi: KERNEL_FACTORY_ABI,
      functionName: 'createAccount',
      args: [initializeData, salt],
    })
  } catch (err: unknown) {
    if (err?.cause?.raw) console.info('Raw:', err.cause.raw.slice(0, 200))
  }

  // 4. Build packed UserOp and get EntryPoint hash
  const factoryData = encodeFunctionData({
    abi: KERNEL_FACTORY_ABI,
    functionName: 'createAccount',
    args: [initializeData, salt],
  })
  const initCode = concat([CONFIG.factory, factoryData]) as Hex

  const mode = `0x${'00'.repeat(32)}` as Hex
  // Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
  const executionCalldata = concat([
    smartAccountAddress,             // 20 bytes: target address
    pad(toHex(0n), { size: 32 }),    // 32 bytes: value
  ]) as Hex // no callData for no-op
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
      inputs: [
        {
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
        },
      ],
      outputs: [{ type: 'bytes32' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'simulateValidation',
      inputs: [
        {
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
        },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const
  const entryPointHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex

  // Sign with correct hash
  const rawSignature = await signer.signMessage({
    message: { raw: entryPointHash },
  })
  const signature = concat(['0x02' as Hex, rawSignature]) as Hex
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature }],
    })
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
      // Decode validation data
      try {
        const _data = raw.slice(10) // remove selector
      } catch {}
    } else if (raw.startsWith('0x65c8fd4d')) {
      // Decode manually: opIndex(32) + offset_reason(32) + offset_inner(32) + reason_len + reason + inner_len + inner
      try {
        const decoded = raw.slice(10) // remove selector
        // opIndex at offset 0: 32 bytes
        const _opIndex = parseInt(decoded.slice(0, 64), 16)
        // offset for reason: 32 bytes
        const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
        // offset for inner: 32 bytes
        const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2

        // Read reason string
        const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
        const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
        const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')

        // Read inner bytes
        const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
        const _inner = decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)
      } catch (_e) {}
    } else if (raw.startsWith('0x220266b6')) {
    } else {
    }
  }
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
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
    } else if (raw.startsWith('0x65c8fd4d')) {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2
      const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
      const _inner = decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)
    } else if (raw.startsWith('0x220266b6')) {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
    } else {
    }
  }
  const _sig00 = concat(['0x00' as Hex, rawSignature]) as Hex
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [
        {
          ...packedOp,
          signature: concat([
            '0x00' as Hex,
            await signer.signMessage({ message: { raw: entryPointHash } }),
          ]),
        },
      ],
    })
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
    } else {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
    }
  }
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [
        { ...packedOp, signature: await signer.signMessage({ message: { raw: entryPointHash } }) },
      ],
    })
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || ''
    if (raw.startsWith('0xe0cff05f')) {
    } else {
      const decoded = raw.slice(10)
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
    }
  }
}

main().catch(console.error)
