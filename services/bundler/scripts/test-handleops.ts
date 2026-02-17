/**
 * Direct handleOps test - calls handleOps via eth_call from bundler address
 * to check what revert reason occurs
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
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  chainId: 8283n,
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  paymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
  senderPrivateKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
  paymasterSignerKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
  bundlerAddress: '0x66bB0a59EBA0A44b755a6A797Ca46750a7C393b3' as Address,
}

const PACKED_USER_OP_COMPONENTS = [
  { name: 'sender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'initCode', type: 'bytes' },
  { name: 'callData', type: 'bytes' },
  { name: 'accountGasLimits', type: 'bytes32' },
  { name: 'preVerificationGas', type: 'uint256' },
  { name: 'gasFees', type: 'bytes32' },
  { name: 'paymasterAndData', type: 'bytes' },
  { name: 'signature', type: 'bytes' },
] as const

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
] as const

function packGasLimits(a: bigint, b: bigint): Hex {
  return concat([pad(toHex(a), { size: 16 }), pad(toHex(b), { size: 16 })]) as Hex
}

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const paymasterSigner = privateKeyToAccount(CONFIG.paymasterSignerKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  const smartAccountAddress = '0x8a1246Ab2379ddB21903dA21A29BC3Bb5007b397' as Address

  const currentNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: [
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
    ],
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })) as bigint

  const execMode = `0x${'00'.repeat(32)}` as Hex
  // Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
  const executionCalldata = concat([
    smartAccountAddress, // 20 bytes: target address
    pad(toHex(0n), { size: 32 }), // 32 bytes: value
  ]) as Hex
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })

  const verificationGasLimit = 500000n,
    callGasLimit = 200000n,
    preVerificationGas = 100000n
  const maxPriorityFeePerGas = 1000000000n,
    maxFeePerGas = 2000000000n
  const paymasterVerificationGasLimit = 200000n,
    paymasterPostOpGasLimit = 100000n
  const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit)
  const gasFees = packGasLimits(maxPriorityFeePerGas, maxFeePerGas)

  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600)
  const validAfter = 0n
  const senderNonce = (await publicClient.readContract({
    address: CONFIG.paymaster,
    abi: [
      {
        type: 'function',
        name: 'senderNonce',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'senderNonce',
    args: [smartAccountAddress],
  })) as bigint

  const paymasterHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint48' },
        { type: 'uint48' },
        { type: 'uint256' },
      ],
      [
        smartAccountAddress,
        currentNonce,
        keccak256('0x' as Hex),
        keccak256(callData),
        accountGasLimits as `0x${string}`,
        preVerificationGas,
        gasFees as `0x${string}`,
        CONFIG.chainId,
        CONFIG.paymaster,
        Number(validUntil),
        Number(validAfter),
        senderNonce,
      ]
    )
  )
  const paymasterSignature = await paymasterSigner.signMessage({ message: { raw: paymasterHash } })
  const paymasterData = concat([
    pad(toHex(validUntil), { size: 6 }),
    pad(toHex(validAfter), { size: 6 }),
    paymasterSignature,
  ]) as Hex
  const paymasterAndData = concat([
    CONFIG.paymaster,
    pad(toHex(paymasterVerificationGasLimit), { size: 16 }),
    pad(toHex(paymasterPostOpGasLimit), { size: 16 }),
    paymasterData,
  ]) as Hex

  const packedOp = {
    sender: smartAccountAddress,
    nonce: currentNonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: '0x' as Hex,
  }

  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: [
      {
        type: 'function',
        name: 'getUserOpHash',
        inputs: [{ name: 'userOp', type: 'tuple', components: PACKED_USER_OP_COMPONENTS }],
        outputs: [{ type: 'bytes32' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  const userOpSignature = await signer.signMessage({ message: { raw: userOpHash } })
  try {
    const handleOpsData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'handleOps',
          inputs: [
            { name: 'ops', type: 'tuple[]', components: PACKED_USER_OP_COMPONENTS },
            { name: 'beneficiary', type: 'address' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      args: [[{ ...packedOp, signature: userOpSignature }], CONFIG.bundlerAddress],
    })

    const _result = await publicClient.call({
      account: CONFIG.bundlerAddress,
      to: CONFIG.entryPoint,
      data: handleOpsData,
      gas: 3000000n,
    })
  } catch (err: unknown) {
    const data = err?.cause?.data || err?.data || ''
    if (data) {
      const _dataStr = typeof data === 'string' ? data : JSON.stringify(data)
      if (
        typeof data === 'string' &&
        (data.startsWith('0x220266b6') || data.startsWith('0x65c8fd4d'))
      ) {
        try {
          const decoded = data.slice(10)
          const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
          const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
          const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
          const _reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
        } catch {}
      }
    }
  }
}
main().catch(console.error)
