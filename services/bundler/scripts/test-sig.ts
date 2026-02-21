/**
 * Debug signature: test different signing methods
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

function parseRevertResult(raw: string): { type: string; reason?: string; inner?: string } {
  if (raw.startsWith('0xe0cff05f')) return { type: 'ValidationResult' }
  if (raw.startsWith('0x220266b6') || raw.startsWith('0x65c8fd4d')) {
    const isWithRevert = raw.startsWith('0x65c8fd4d')
    const decoded = raw.slice(10)
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
  }
  return { type: 'unknown', reason: raw.slice(0, 100) }
}

async function trySimulate(
  publicClient: unknown,
  packedOp: unknown,
  signature: Hex,
  label: string
): Promise<void> {
  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature }],
    })
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || ''
    const result = parseRevertResult(raw)
    if (result.type === 'ValidationResult') {
    } else if (result.type === 'FailedOp') {
    } else if (result.type === 'FailedOpWithRevert') {
    } else {
    }
  }
}

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  // Build UserOp
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

  const accountGasLimits = concat([
    pad(toHex(500000n), { size: 16 }),
    pad(toHex(200000n), { size: 16 }),
  ]) as Hex
  const gasFees = concat([
    pad(toHex(1000000000n), { size: 16 }),
    pad(toHex(2000000000n), { size: 16 }),
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

  const entryPointHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex

  // 1. signMessage (EIP-191 personal sign)
  const sigEip191 = await signer.signMessage({ message: { raw: entryPointHash } })

  // 2. Raw sign (direct ecSign without EIP-191 prefix)
  const sigRaw = await signer.sign({ hash: entryPointHash })

  // Mode 0x02 + EIP-191 sign (SDK default)
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x02' as Hex, sigEip191]) as Hex,
    'mode=0x02 + EIP-191'
  )

  // Mode 0x02 + raw sign
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x02' as Hex, sigRaw]) as Hex,
    'mode=0x02 + raw'
  )

  // Mode 0x00 + EIP-191 sign
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x00' as Hex, sigEip191]) as Hex,
    'mode=0x00 + EIP-191'
  )

  // Mode 0x00 + raw sign
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x00' as Hex, sigRaw]) as Hex,
    'mode=0x00 + raw'
  )

  // Mode 0x01 + EIP-191 sign
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x01' as Hex, sigEip191]) as Hex,
    'mode=0x01 + EIP-191'
  )

  // Mode 0x01 + raw sign
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x01' as Hex, sigRaw]) as Hex,
    'mode=0x01 + raw'
  )

  // No mode prefix + EIP-191 sign
  await trySimulate(publicClient, packedOp, sigEip191, 'no-mode + EIP-191')

  // No mode prefix + raw sign
  await trySimulate(publicClient, packedOp, sigRaw, 'no-mode + raw')

  // Dummy signature (65 bytes of zeros + valid v)
  const dummySig = `0x${'00'.repeat(64)}1b` as Hex
  await trySimulate(
    publicClient,
    packedOp,
    concat(['0x02' as Hex, dummySig]) as Hex,
    'mode=0x02 + dummy'
  )
  const packedOpNoPaymaster = { ...packedOp, paymasterAndData: '0x' as Hex }
  const hashNoPM = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOpNoPaymaster],
  })) as Hex
  const sigNoPM_191 = await signer.signMessage({ message: { raw: hashNoPM } })
  const sigNoPM_raw = await signer.sign({ hash: hashNoPM })

  await trySimulate(
    publicClient,
    packedOpNoPaymaster,
    concat(['0x02' as Hex, sigNoPM_191]) as Hex,
    'no-pm + mode=0x02 + EIP-191'
  )
  await trySimulate(
    publicClient,
    packedOpNoPaymaster,
    concat(['0x02' as Hex, sigNoPM_raw]) as Hex,
    'no-pm + mode=0x02 + raw'
  )
  await trySimulate(
    publicClient,
    packedOpNoPaymaster,
    concat(['0x00' as Hex, sigNoPM_191]) as Hex,
    'no-pm + mode=0x00 + EIP-191'
  )
  await trySimulate(
    publicClient,
    packedOpNoPaymaster,
    concat(['0x00' as Hex, sigNoPM_raw]) as Hex,
    'no-pm + mode=0x00 + raw'
  )
}

main().catch(console.error)
