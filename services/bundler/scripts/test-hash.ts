/**
 * Compare our UserOp hash computation with EntryPoint's getUserOpHash
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

const ENTRY_POINT_ABI = [
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
] as const

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  // Build same init data as test-userop.ts
  const rootValidator = concat([
    pad(toHex(1n), { size: 1 }),
    CONFIG.ecdsaValidator,
  ]) as Hex
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

  // Build callData
  const mode = `0x${'00'.repeat(32)}` as Hex
  const executionCalldata = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes' },
    ],
    [smartAccountAddress, 0n, '0x' as Hex],
  )
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [mode, executionCalldata],
  })

  const gasPrice = await publicClient.getGasPrice()
  const maxFeePerGas = gasPrice * 2n
  const maxPriorityFeePerGas = gasPrice

  // Pack fields
  const initCode = concat([CONFIG.factory, factoryData]) as Hex
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
    '0x' as Hex,
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

  // Get hash from EntryPoint
  const entryPointHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: ENTRY_POINT_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex

  console.log('EntryPoint hash:', entryPointHash)

  // Compute our hash
  const userOpEncoded = encodeAbiParameters(
    [
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
      smartAccountAddress,
      0n,
      keccak256(initCode),
      keccak256(callData),
      accountGasLimits as Hex,
      100000n,
      gasFees as Hex,
      keccak256(paymasterAndData),
    ],
  )
  const innerHash = keccak256(userOpEncoded)
  const ourHash = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [innerHash, CONFIG.entryPoint, CONFIG.chainId],
    ),
  )

  console.log('Our hash:       ', ourHash)
  console.log('Match:', entryPointHash === ourHash)

  if (entryPointHash !== ourHash) {
    // Debug: inner hash
    console.log('\n--- Debug inner hash ---')
    console.log('sender:', smartAccountAddress)
    console.log('nonce: 0')
    console.log('keccak256(initCode):', keccak256(initCode))
    console.log('keccak256(callData):', keccak256(callData))
    console.log('accountGasLimits:', accountGasLimits)
    console.log('preVerificationGas: 100000')
    console.log('gasFees:', gasFees)
    console.log('keccak256(paymasterAndData):', keccak256(paymasterAndData))
    console.log('entryPoint:', CONFIG.entryPoint)
    console.log('chainId:', CONFIG.chainId.toString())
    console.log('innerHash:', innerHash)
  }

  // Now sign with the EntryPoint's hash and try simulation
  console.log('\n--- Signing with EntryPoint hash ---')
  const rawSignature = await signer.signMessage({
    message: { raw: entryPointHash },
  })
  const signature = concat(['0x02' as Hex, rawSignature]) as Hex
  console.log('Signature:', signature.slice(0, 40) + '...')

  // Try simulation with correct hash
  const SIMULATE_ABI = [
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
    {
      type: 'error',
      name: 'ValidationResult',
      inputs: [
        {
          name: 'returnInfo',
          type: 'tuple',
          components: [
            { name: 'preOpGas', type: 'uint256' },
            { name: 'prefund', type: 'uint256' },
            { name: 'accountValidationData', type: 'uint256' },
            { name: 'paymasterValidationData', type: 'uint256' },
            { name: 'paymasterContext', type: 'bytes' },
          ],
        },
        {
          name: 'senderInfo',
          type: 'tuple',
          components: [
            { name: 'stake', type: 'uint256' },
            { name: 'unstakeDelaySec', type: 'uint256' },
          ],
        },
        {
          name: 'factoryInfo',
          type: 'tuple',
          components: [
            { name: 'stake', type: 'uint256' },
            { name: 'unstakeDelaySec', type: 'uint256' },
          ],
        },
        {
          name: 'paymasterInfo',
          type: 'tuple',
          components: [
            { name: 'stake', type: 'uint256' },
            { name: 'unstakeDelaySec', type: 'uint256' },
          ],
        },
      ],
    },
    {
      type: 'error',
      name: 'FailedOp',
      inputs: [
        { name: 'opIndex', type: 'uint256' },
        { name: 'reason', type: 'string' },
      ],
    },
    {
      type: 'error',
      name: 'FailedOpWithRevert',
      inputs: [
        { name: 'opIndex', type: 'uint256' },
        { name: 'reason', type: 'string' },
        { name: 'inner', type: 'bytes' },
      ],
    },
  ] as const

  try {
    await publicClient.simulateContract({
      address: CONFIG.entryPoint,
      abi: SIMULATE_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature }],
    })
    console.log('UNEXPECTED: no revert')
  } catch (err: any) {
    const raw = err?.cause?.raw || err?.cause?.data || 'no raw data'
    const name = err?.cause?.name || 'unknown'
    console.log('Error name:', name)
    if (typeof raw === 'string' && raw.startsWith('0xe0cff05f')) {
      console.log('SUCCESS! ValidationResult returned (simulation passed)')
    } else if (typeof raw === 'string' && raw.startsWith('0x65c8fd4d')) {
      console.log('FAILED: FailedOpWithRevert')
      console.log('Raw:', raw.slice(0, 200))
    } else if (typeof raw === 'string' && raw.startsWith('0x220266b6')) {
      console.log('FAILED: FailedOp')
      console.log('Raw:', raw.slice(0, 200))
    } else {
      console.log('Raw:', typeof raw === 'string' ? raw.slice(0, 300) : JSON.stringify(raw))
    }
  }
}

main().catch(console.error)
