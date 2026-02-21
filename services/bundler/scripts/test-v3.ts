/**
 * Kernel v3 Proper Test
 *
 * Key insight: Kernel v3 encodes validation info in the NONCE, not the signature.
 * Nonce format: [1B mode][1B type][20B validatorId][2B nonceKey][8B seqNonce]
 * VALIDATION_TYPE_ROOT = 0x00 → uses root validator
 * VALIDATION_MODE_DEFAULT = 0x00
 * So nonce=0 means: root validator, default mode, first nonce
 *
 * The signature should be JUST the validator's signature (no mode prefix).
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
  {
    type: 'function',
    name: 'getNonce',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

const ECDSA_VALIDATOR_ABI = [
  {
    type: 'function',
    name: 'isInitialized',
    inputs: [{ name: 'smartAccount', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isModuleType',
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const

function parseRevertResult(raw: string): {
  type: string
  reason?: string
  inner?: string
  raw?: string
} {
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
  return { type: 'unknown', raw: raw.slice(0, 200) }
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
    const raw: string = err?.cause?.raw || err?.cause?.data || ''
    if (!raw) {
      return
    }
    const result = parseRevertResult(raw)
    if (result.type === 'ValidationResult') {
    } else if (result.type === 'FailedOp') {
    } else if (result.type === 'FailedOpWithRevert') {
    } else {
    }
  }
}

/**
 * Encode nonce for Kernel v3
 * Format: [1B mode][1B type][20B validatorId][2B nonceKey][8B seqNonce]
 *
 * For root validator (type=0x00), validatorId is ignored (Kernel uses stored root).
 * For validator type (0x01), validatorId = validator address.
 */
function encodeKernelV3Nonce(params: {
  mode?: number // 0x00=default, 0x01=enable, 0x02=install
  type?: number // 0x00=root, 0x01=validator, 0x02=permission
  validatorId?: Address
  nonceKey?: number
  seqNonce?: bigint
}): bigint {
  const mode = params.mode ?? 0x00
  const type = params.type ?? 0x00
  const validatorId = params.validatorId ?? (('0x' + '00'.repeat(20)) as Address)
  const nonceKey = params.nonceKey ?? 0
  const seqNonce = params.seqNonce ?? 0n

  // Build as BigInt: mode(1B) + type(1B) + validatorId(20B) + nonceKey(2B) + seqNonce(8B) = 32B
  let nonce = BigInt(mode) << 248n // byte 0
  nonce |= BigInt(type) << 240n // byte 1
  // validatorId: bytes 2-21 (20 bytes)
  nonce |= BigInt(validatorId) << 80n // shift by 10 bytes (nonceKey + seqNonce)
  nonce |= BigInt(nonceKey) << 64n // bytes 22-23
  nonce |= seqNonce // bytes 24-31

  return nonce
}

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
      signer.address, // 20-byte raw address as validatorData
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
  try {
    const _isType1 = await publicClient.readContract({
      address: CONFIG.ecdsaValidator,
      abi: ECDSA_VALIDATOR_ABI,
      functionName: 'isModuleType',
      args: [1n], // 1 = validator
    })
  } catch (_e: unknown) {}

  // Build UserOp
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
  {
    // Kernel v3: nonce=0 means root validator, default mode
    const nonce = 0n

    const packedOp = {
      sender: smartAccountAddress,
      nonce,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas: 100000n,
      gasFees,
      paymasterAndData: '0x' as Hex,
      signature: '0x' as Hex,
    }

    const entryPointHash = (await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getUserOpHash',
      args: [packedOp],
    })) as Hex

    // Sign with EIP-191 (signMessage)
    const sigEip191 = await signer.signMessage({ message: { raw: entryPointHash } })
    // Sign raw (direct sign)
    const sigRaw = await signer.sign({ hash: entryPointHash })
    await trySimulate(publicClient, packedOp, sigEip191, 'clean EIP-191')
    await trySimulate(publicClient, packedOp, sigRaw, 'clean raw')
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x02' as Hex, sigEip191]) as Hex,
      '0x02 + EIP-191'
    )
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x00' as Hex, sigEip191]) as Hex,
      '0x00 + EIP-191'
    )
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x00000002' as Hex, sigEip191]) as Hex,
      '0x00000002 + EIP-191'
    )
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x00000000' as Hex, sigEip191]) as Hex,
      '0x00000000 + EIP-191'
    )
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x00000002' as Hex, sigRaw]) as Hex,
      '0x00000002 + raw'
    )
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x00000000' as Hex, sigRaw]) as Hex,
      '0x00000000 + raw'
    )
  }
  {
    // Kernel v3 nonce: mode=0x00 (default), type=0x01 (validator), validatorId=ECDSA validator
    const nonce = encodeKernelV3Nonce({
      mode: 0x00,
      type: 0x01,
      validatorId: CONFIG.ecdsaValidator,
    })

    const packedOp = {
      sender: smartAccountAddress,
      nonce,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas: 100000n,
      gasFees,
      paymasterAndData: '0x' as Hex,
      signature: '0x' as Hex,
    }

    const entryPointHash = (await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getUserOpHash',
      args: [packedOp],
    })) as Hex

    const sigEip191 = await signer.signMessage({ message: { raw: entryPointHash } })
    const sigRaw = await signer.sign({ hash: entryPointHash })
    await trySimulate(publicClient, packedOp, sigEip191, 'validator-nonce + clean EIP-191')
    await trySimulate(publicClient, packedOp, sigRaw, 'validator-nonce + clean raw')
    await trySimulate(
      publicClient,
      packedOp,
      concat(['0x02' as Hex, sigEip191]) as Hex,
      'validator-nonce + 0x02 + EIP-191'
    )
  }
  {
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

    const sigEip191 = await signer.signMessage({ message: { raw: entryPointHash } })
    const sigRaw = await signer.sign({ hash: entryPointHash })

    await trySimulate(publicClient, packedOp, sigEip191, 'paymaster + clean EIP-191')
    await trySimulate(publicClient, packedOp, sigRaw, 'paymaster + clean raw')
  }
  try {
    const _epNonce = await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getNonce',
      args: [smartAccountAddress, 0n],
    })
  } catch (_e: unknown) {}
  {
    const _sigEip191 = await signer.signMessage({
      message: { raw: ('0x' + '00'.repeat(32)) as Hex },
    })

    // Build the same op with nonce=0 and clean signature
    const packedOp = {
      sender: smartAccountAddress,
      nonce: 0n,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas: 100000n,
      gasFees,
      paymasterAndData: '0x' as Hex,
      signature: '0x' as Hex,
    }

    const entryPointHash = (await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getUserOpHash',
      args: [packedOp],
    })) as Hex

    const sigCorrect = await signer.signMessage({ message: { raw: entryPointHash } })

    // Use raw transport to call simulateValidation
    const simulateValidationData = encodeFunctionData({
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature: sigCorrect }],
    })

    try {
      const _result = await publicClient.request({
        method: 'eth_call' as unknown,
        params: [
          {
            to: CONFIG.entryPoint,
            data: simulateValidationData,
          },
          'latest',
        ],
      })
    } catch (err: unknown) {
      const data = err?.cause?.data || err?.data || err?.error?.data || 'no data'

      if (typeof data === 'string' && data.startsWith('0x')) {
        const selector = data.slice(0, 10)
        if (selector === '0xe0cff05f') console.info('ValidationResult (SUCCESS)')
        else if (selector === '0x220266b6') console.info('FailedOp')
        else if (selector === '0x65c8fd4d') console.info('FailedOpWithRevert')
        else console.info('Unknown selector:', selector)
      }
    }
  }
}

main().catch(console.error)
